use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Burn, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::Rescued;
use crate::logic::bps_of;
use crate::state::*;
use crate::utils::{core_mint, vault_seeds};

/// Rescue = BUYING a burned Bro out of the pool. `fee` comes out of the rescuer's Bro balance and is
/// split:
///   * `rescue_burn_bps` (default 50%) SPL-burned from the vault,
///   * `RESCUE_TREASURY_BPS` (25%) sent as TMB to the treasury wallet's token account,
///   * the rest (25%) sent as TMB to the wallet that LOST the Bro (compensation).
/// The rescuer gets no fee share: what they get is the Bro itself. A burned Core asset can't be
/// un-burned, so it is re-minted (same name/uri) into the RESCUER's wallet with a fresh record
/// (streak 0, empty balance). The original owner may also buy their own Bro back.
pub fn handler(ctx: Context<Rescue>, fee: u64) -> Result<()> {
    let a = ctx.accounts;
    require!(!a.config.paused, TmbError::Paused);
    require!(
        fee > 0 && a.config.rescue_fee_options.contains(&fee),
        TmbError::InvalidRescueFee
    );
    {
        let r = &a.rescuer_bro;
        require!(r.status == BroStatus::Active, TmbError::BroBurned);
        require!(r.in_escrow, TmbError::NotInEscrow);
        require!(r.pending_spin.is_none(), TmbError::SpinPending);
        require!(r.tmb_balance >= fee, TmbError::NotEnoughBags);
    }
    let burn_amount = bps_of(fee, a.config.rescue_burn_bps).ok_or(TmbError::Overflow)?;
    // treasury share never pushes burn + treasury past 100% of the fee
    let treasury_bps = RESCUE_TREASURY_BPS.min(10_000u16.saturating_sub(a.config.rescue_burn_bps));
    let treasury_amount = bps_of(fee, treasury_bps).ok_or(TmbError::Overflow)?;
    let owner_amount = fee
        .checked_sub(burn_amount)
        .and_then(|v| v.checked_sub(treasury_amount))
        .ok_or(TmbError::Overflow)?;
    require!(
        a.config.collection != Pubkey::default(),
        TmbError::CollectionNotSet
    );

    // --- state first ---
    a.rescuer_bro.tmb_balance -= fee;
    // the whole fee leaves the user balances (burned / treasury / previous owner are all paid out of
    // the vault), so total_user_tmb drops by exactly `fee`
    a.config.total_user_tmb = a
        .config
        .total_user_tmb
        .checked_sub(fee)
        .ok_or(TmbError::Overflow)?;
    let nb = &mut a.new_bro_record;
    nb.asset = a.new_asset.key();
    nb.owner = a.rescuer.key();
    nb.loss_streak = 0;
    nb.tmb_balance = 0;
    nb.holdings = Vec::new();
    nb.status = BroStatus::Active;
    nb.in_escrow = false;
    nb.pending_spin = None;
    nb.total_spins = 0;
    nb.eligible_slot = 0;
    nb.bump = ctx.bumps.new_bro_record;

    // --- burn the burn share of the fee out of the vault ---
    if burn_amount > 0 {
        let bump = a.config.vault_bump;
        let seeds = vault_seeds(&bump);
        token_interface::burn(
            CpiContext::new_with_signer(
                a.token_program.to_account_info(),
                Burn {
                    mint: a.tmb_mint.to_account_info(),
                    from: a.vault_tmb.to_account_info(),
                    authority: a.vault.to_account_info(),
                },
                &[&seeds],
            ),
            burn_amount,
        )?;
    }

    // --- treasury share, as TMB, to the treasury wallet's token account ---
    if treasury_amount > 0 {
        let bump = a.config.vault_bump;
        let seeds = vault_seeds(&bump);
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                a.token_program.to_account_info(),
                TransferChecked {
                    from: a.vault_tmb.to_account_info(),
                    mint: a.tmb_mint.to_account_info(),
                    to: a.treasury_tmb.to_account_info(),
                    authority: a.vault.to_account_info(),
                },
                &[&seeds],
            ),
            treasury_amount,
            a.tmb_mint.decimals,
        )?;
    }

    // --- previous owner's share, as TMB, to their wallet's token account ---
    if owner_amount > 0 {
        let bump = a.config.vault_bump;
        let seeds = vault_seeds(&bump);
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                a.token_program.to_account_info(),
                TransferChecked {
                    from: a.vault_tmb.to_account_info(),
                    mint: a.tmb_mint.to_account_info(),
                    to: a.last_owner_tmb.to_account_info(),
                    authority: a.vault.to_account_info(),
                },
                &[&seeds],
            ),
            owner_amount,
            a.tmb_mint.decimals,
        )?;
    }

    // --- re-mint the fallen Bro into the RESCUER's wallet ---
    core_mint(
        &a.mpl_core_program.to_account_info(),
        &a.new_asset.to_account_info(),
        &a.collection.to_account_info(),
        &a.config.to_account_info(),
        a.config.bump,
        &a.rescuer.to_account_info(),
        &a.rescuer.to_account_info(),
        &a.system_program.to_account_info(),
        a.graveyard.name.clone(),
        a.graveyard.metadata_uri.clone(),
    )?;

    emit!(Rescued {
        burned_asset: a.graveyard.asset,
        new_asset: a.new_asset.key(),
        rescuer: a.rescuer.key(),
        rescuer_asset: a.rescuer_bro.asset,
        last_owner: a.graveyard.last_owner,
        fee,
        burned_amount: burn_amount,
        treasury_amount,
        owner_amount,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Rescue<'info> {
    #[account(mut)]
    pub rescuer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: only its key is used, to bind the rescuer's BroRecord PDA.
    pub rescuer_asset: UncheckedAccount<'info>,
    #[account(
        mut, seeds = [BRO_SEED, rescuer_asset.key().as_ref(), rescuer.key().as_ref()],
        bump = rescuer_bro.bump
    )]
    pub rescuer_bro: Box<Account<'info, BroRecord>>,
    /// Closed on rescue; rent goes to the rescuer.
    #[account(
        mut, close = rescuer,
        seeds = [GRAVEYARD_SEED, graveyard.asset.as_ref()], bump = graveyard.bump
    )]
    pub graveyard: Box<Account<'info, Graveyard>>,
    /// New Core asset keypair, generated by the client.
    #[account(mut)]
    pub new_asset: Signer<'info>,
    /// CHECK: equals graveyard.last_owner; the wallet that lost the Bro and receives its share.
    #[account(address = graveyard.last_owner)]
    pub last_owner: UncheckedAccount<'info>,
    /// The previous owner's TMB token account (the client creates it if missing).
    #[account(
        mut,
        associated_token::mint = tmb_mint,
        associated_token::authority = last_owner,
        associated_token::token_program = token_program
    )]
    pub last_owner_tmb: InterfaceAccount<'info, TokenAccount>,
    /// Record of the re-minted Bro, owned by the RESCUER.
    #[account(
        init, payer = rescuer, space = 8 + BroRecord::INIT_SPACE,
        seeds = [BRO_SEED, new_asset.key().as_ref(), rescuer.key().as_ref()], bump
    )]
    pub new_bro_record: Box<Account<'info, BroRecord>>,
    /// CHECK: must be the configured Bro collection.
    #[account(mut, address = config.collection @ TmbError::CollectionNotSet)]
    pub collection: UncheckedAccount<'info>,
    /// CHECK: PDA owning the vault token accounts.
    #[account(seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut, address = config.tmb_mint)]
    pub tmb_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = tmb_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_tmb: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the configured treasury wallet (owner of `treasury_tmb`).
    #[account(address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    /// The treasury's TMB token account (the client creates it if missing).
    #[account(
        mut,
        associated_token::mint = tmb_mint,
        associated_token::authority = treasury,
        associated_token::token_program = token_program
    )]
    pub treasury_tmb: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: pinned to the Metaplex Core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
