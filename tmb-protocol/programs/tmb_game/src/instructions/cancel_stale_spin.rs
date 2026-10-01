use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::*;
use crate::logic::rekt_index;
use crate::state::*;
use crate::utils::*;

/// Anyone may close a spin that stayed unsettled for `stale_slots`. It counts as a LOSS (never a
/// refund) so a player can't withhold an unfavourable reveal.
pub fn handler(ctx: Context<CancelStaleSpin>) -> Result<()> {
    let a = ctx.accounts;
    require!(!a.spin_request.resolved, TmbError::NoSpinPending);
    let due = a
        .spin_request
        .requested_slot
        .checked_add(a.config.stale_slots)
        .ok_or(TmbError::Overflow)?;
    require!(now_slot()? >= due, TmbError::SpinNotStale);
    // A stale-loss must never be charged while the prize table is being replaced.
    require!(a.config.prizes_ready, TmbError::PrizeTableInvalid);
    let rekt = rekt_index(&a.prizes.entries).ok_or(TmbError::MissingRektWedge)?;

    // a stale request counts every spin in it as a loss (a turbo can't be withheld either)
    let spins = a.spin_request.count.max(1);
    let mut burned = false;
    for _ in 0..spins {
        burned = apply_loss(&a.config, &mut a.bro_record);
        if burned {
            break;
        }
    }
    a.bro_record.pending_spin = None;
    a.spin_request.resolved = true;

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
    emit_settled(
        &a.bro_record,
        &a.spin_request,
        a.spin_request.odds_tier,
        OUTCOME_STALE_LOSS,
        rekt as u8,
        None,
        burned,
        Pubkey::default(),
        0,
        spins,
    );
    Ok(())
}

#[derive(Accounts)]
pub struct CancelStaleSpin<'info> {
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
    /// CHECK: signer PDA that owns escrowed assets.
    #[account(mut, seeds = [ESCROW_AUTH_SEED], bump = config.escrow_auth_bump)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: pinned to the Metaplex Core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
