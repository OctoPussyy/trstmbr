use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token::spl_token;
use anchor_spl::token_2022::spl_token_2022;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::*;
use crate::logic::*;
use crate::state::*;
use crate::utils::*;

/// Balance of the vault's canonical token account for `mint`, taken from `remaining`.
/// Never trusted: the key must equal the derived ATA (for either token program) and the account must
/// be a real token account of that mint/vault, or an empty system account (= nothing funded yet).
/// A missing account is an ERROR (not "ineligible"), so a cranker can't skew prize weights by
/// omitting accounts.
fn vault_balance_for(remaining: &[AccountInfo], vault: &Pubkey, mint: &Pubkey) -> Result<u64> {
    for prog in [spl_token::ID, spl_token_2022::ID] {
        let ata = get_associated_token_address_with_program_id(vault, mint, &prog);
        let Some(info) = remaining.iter().find(|i| i.key() == ata) else {
            continue;
        };
        if *info.owner == prog {
            let d = info.try_borrow_data()?;
            require!(
                d.len() >= 72 && d[0..32] == mint.to_bytes() && d[32..64] == vault.to_bytes(),
                TmbError::InvalidVaultAccount
            );
            let mut b = [0u8; 8];
            b.copy_from_slice(&d[64..72]);
            return Ok(u64::from_le_bytes(b));
        }
        require!(
            *info.owner == anchor_lang::system_program::ID && info.data_is_empty(),
            TmbError::InvalidVaultAccount
        );
        return Ok(0);
    }
    err!(TmbError::MissingAccounts)
}

#[inline(never)]
fn eligibility(
    entries: &[Prize],
    config: &Config,
    bro: &BroRecord,
    vault_tmb_amount: u64,
    vault: &Pubkey,
    remaining: &[AccountInfo],
    bonus_present: bool,
) -> Result<[bool; MAX_PRIZES]> {
    let pool = config.pool(vault_tmb_amount);
    let mut out = [false; MAX_PRIZES];
    for (i, p) in entries.iter().enumerate() {
        out[i] = match p.kind {
            PrizeKind::None => false,
            PrizeKind::Tmb => {
                tmb_payout_allowed(pool, p.amount, config.max_payout_bps, config.min_reserve)
                    && bro.tmb_balance.checked_add(p.amount).is_some()
            }
            PrizeKind::Token => {
                let bal = vault_balance_for(remaining, vault, &p.mint)?;
                let has_room = bro.holdings.iter().any(|h| h.mint == p.mint)
                    || bro.holdings.len() < MAX_HOLDINGS;
                has_room && token_payout_allowed(bal, p.amount, config.max_payout_bps)
            }
            PrizeKind::BonusBro => bonus_present && config.minted < config.max_supply,
        };
    }
    Ok(out)
}

fn credit_holding(bro: &mut BroRecord, p: &Prize) -> Result<()> {
    if let Some(h) = bro.holdings.iter_mut().find(|h| h.mint == p.mint) {
        h.amount = h.amount.checked_add(p.amount).ok_or(TmbError::Overflow)?;
        h.usd_value_snapshot = h
            .usd_value_snapshot
            .checked_add(p.usd_value)
            .ok_or(TmbError::Overflow)?;
    } else {
        bro.holdings.push(Holding {
            mint: p.mint,
            amount: p.amount,
            usd_value_snapshot: p.usd_value,
        });
    }
    Ok(())
}

/// Reveal phase. Permissionless: the player's client (or any crank) submits it right after
/// Switchboard's `revealIx`.
pub fn handler(ctx: Context<SettleSpin>) -> Result<()> {
    let a = ctx.accounts;
    require!(!a.spin_request.resolved, TmbError::NoSpinPending);
    require!(a.config.prizes_ready, TmbError::PrizeTableInvalid);

    // --- randomness ---
    let rd = parse_randomness(&a.randomness_account.to_account_info())?;
    require!(
        rd.seed_slot == a.spin_request.commit_slot,
        TmbError::StaleRandomness
    );
    require!(rd.reveal_slot > rd.seed_slot, TmbError::RandomnessNotReady);
    require!(rd.value != [0u8; 32], TmbError::RandomnessNotReady);
    let (r1, r2) = roll(&rd.value);
    // Whoever cranks must supply the bonus asset if the wheel has a Bonus Bro wedge; otherwise a
    // cranker could make that wedge ineligible and skew the odds.
    require!(
        a.bonus_asset.is_some()
            || !a
                .prizes
                .entries
                .iter()
                .any(|p| p.kind == PrizeKind::BonusBro),
        TmbError::MissingAccounts
    );

    // --- win roll + prize pick ---
    let tier = a.spin_request.odds_tier as usize;
    require!(tier < 4, TmbError::StaleRandomness);
    let won_roll = is_win(r1, a.config.odds_bps[tier]);
    let rekt = rekt_index(&a.prizes.entries).ok_or(TmbError::MissingRektWedge)?;
    let mut picked: Option<usize> = None;
    if won_roll {
        let elig = eligibility(
            &a.prizes.entries,
            &a.config,
            &a.bro_record,
            a.vault_tmb.amount,
            &a.vault.key(),
            ctx.remaining_accounts,
            a.bonus_asset.is_some(),
        )?;
        picked = pick_weighted(&a.prizes.entries, &elig, r2);
    }

    // --- state transitions (before any CPI) ---
    let prize: Option<Prize> = picked.map(|i| a.prizes.entries[i]);
    let mut bonus_key = Pubkey::default();
    let mut mint_bonus = false;
    let mut burned = false;
    match &prize {
        Some(p) => {
            match p.kind {
                PrizeKind::Tmb => {
                    a.bro_record.tmb_balance = a
                        .bro_record
                        .tmb_balance
                        .checked_add(p.amount)
                        .ok_or(TmbError::Overflow)?;
                    a.config.total_user_tmb = a
                        .config
                        .total_user_tmb
                        .checked_add(p.amount)
                        .ok_or(TmbError::Overflow)?;
                }
                PrizeKind::Token => credit_holding(&mut a.bro_record, p)?,
                PrizeKind::BonusBro => {
                    mint_bonus = true;
                    a.config.minted = a.config.minted.checked_add(1).ok_or(TmbError::Overflow)?;
                }
                PrizeKind::None => {}
            }
            a.bro_record.loss_streak = 0;
        }
        None => {
            burned = apply_loss(&a.config, &mut a.bro_record);
        }
    }
    a.bro_record.pending_spin = None;
    a.spin_request.resolved = true;

    // --- CPIs ---
    if mint_bonus {
        let bonus = a.bonus_asset.as_ref().ok_or(TmbError::InvalidAsset)?;
        bonus_key = bonus.key();
        let parent = read_bro_asset(&a.asset.to_account_info(), &a.config.collection)?;
        let uri = if a.config.bonus_uri.is_empty() {
            parent.uri
        } else {
            a.config.bonus_uri.clone()
        };
        core_mint(
            &a.mpl_core_program.to_account_info(),
            &bonus.to_account_info(),
            &a.collection.to_account_info(),
            &a.config.to_account_info(),
            a.config.bump,
            &a.settler.to_account_info(),
            &a.owner.to_account_info(),
            &a.system_program.to_account_info(),
            "Bonus Bro".to_string(),
            uri,
        )?;
        emit!(BroMinted {
            asset: bonus_key,
            owner: a.owner.key(),
            price_lamports: 0,
            starting_balance: 0,
            bonus: true,
        });
    }
    if burned {
        let (asset, collection, escrow_auth, owner, graveyard, settler, mpl, sys) = (
            a.asset.to_account_info(),
            a.collection.to_account_info(),
            a.escrow_auth.to_account_info(),
            a.owner.to_account_info(),
            a.graveyard.to_account_info(),
            a.settler.to_account_info(),
            a.mpl_core_program.to_account_info(),
            a.system_program.to_account_info(),
        );
        let infos = BurnInfos {
            asset: &asset,
            collection: &collection,
            escrow_auth: &escrow_auth,
            owner: &owner,
            graveyard: &graveyard,
            settler: &settler,
            mpl_core: &mpl,
            system: &sys,
        };
        execute_burn(
            &mut a.config,
            &mut a.bro_record,
            &a.escrow_receipt,
            &infos,
            ctx.bumps.graveyard,
        )?;
    }

    let (outcome, wedge) = if prize.is_some() {
        (OUTCOME_WIN, picked.unwrap() as u8)
    } else {
        (OUTCOME_LOSS, rekt as u8)
    };
    emit_settled(
        &a.bro_record,
        &a.spin_request,
        outcome,
        wedge,
        prize.as_ref(),
        burned,
        bonus_key,
    );
    Ok(())
}

#[derive(Accounts)]
pub struct SettleSpin<'info> {
    #[account(mut)]
    pub settler: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(seeds = [PRIZES_SEED], bump)]
    pub prizes: Box<Account<'info, PrizeTable>>,
    #[account(
        mut,
        seeds = [BRO_SEED, bro_record.asset.as_ref(), bro_record.owner.as_ref()],
        bump = bro_record.bump,
        constraint = bro_record.pending_spin == Some(spin_request.key()) @ TmbError::NoSpinPending
    )]
    pub bro_record: Box<Account<'info, BroRecord>>,
    #[account(
        mut, close = owner,
        seeds = [SPIN_SEED, bro_record.asset.as_ref(), &spin_request.nonce.to_le_bytes()],
        bump = spin_request.bump
    )]
    pub spin_request: Box<Account<'info, SpinRequest>>,
    /// CHECK: equals bro_record.owner; receives rent.
    #[account(mut, address = bro_record.owner)]
    pub owner: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, bro_record.asset.as_ref()], bump = escrow_receipt.bump
    )]
    pub escrow_receipt: Box<Account<'info, EscrowReceipt>>,
    /// CHECK: graveyard PDA; created only when the Bro burns.
    #[account(mut, seeds = [GRAVEYARD_SEED, bro_record.asset.as_ref()], bump)]
    pub graveyard: UncheckedAccount<'info>,
    /// CHECK: the record's Core asset.
    #[account(mut, address = bro_record.asset)]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: must be the configured Bro collection.
    #[account(mut, address = config.collection @ TmbError::CollectionNotSet)]
    pub collection: UncheckedAccount<'info>,
    /// CHECK: must equal the randomness account bound at request time; parsed in the handler.
    #[account(address = spin_request.randomness_account @ TmbError::StaleRandomness)]
    pub randomness_account: UncheckedAccount<'info>,
    /// CHECK: signer PDA that owns escrowed assets.
    #[account(mut, seeds = [ESCROW_AUTH_SEED], bump = config.escrow_auth_bump)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: PDA owning the vault token accounts.
    #[account(seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(address = config.tmb_mint)]
    pub tmb_mint: InterfaceAccount<'info, Mint>,
    #[account(
        associated_token::mint = tmb_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_tmb: InterfaceAccount<'info, TokenAccount>,
    /// Fresh keypair for a possible Bonus Bro. Required when the wheel has a Bonus Bro wedge.
    #[account(mut)]
    pub bonus_asset: Option<Signer<'info>>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: pinned to the Metaplex Core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
