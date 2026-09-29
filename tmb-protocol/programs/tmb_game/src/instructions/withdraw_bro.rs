use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::BroWithdrawn;
use crate::state::*;
use crate::utils::core_transfer_from_escrow;

/// Unstakes a Bro back to its depositor. The loss streak is never reset.
pub fn handler(ctx: Context<WithdrawBro>) -> Result<()> {
    let b = &mut ctx.accounts.bro_record;
    require!(b.status == BroStatus::Active, TmbError::BroBurned);
    require!(b.in_escrow, TmbError::NotInEscrow);
    require!(b.pending_spin.is_none(), TmbError::SpinPending);
    b.in_escrow = false;
    let (asset, owner, streak) = (b.asset, b.owner, b.loss_streak);

    core_transfer_from_escrow(
        &ctx.accounts.mpl_core_program.to_account_info(),
        &ctx.accounts.asset.to_account_info(),
        &ctx.accounts.collection.to_account_info(),
        &ctx.accounts.player.to_account_info(),
        &ctx.accounts.escrow_auth.to_account_info(),
        ctx.accounts.config.escrow_auth_bump,
        &ctx.accounts.player.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
    )?;
    emit!(BroWithdrawn {
        asset,
        owner,
        loss_streak: streak
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawBro<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: bound to the record via its PDA seeds; the Core program validates ownership.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: must be the configured Bro collection.
    #[account(mut, address = config.collection @ TmbError::CollectionNotSet)]
    pub collection: UncheckedAccount<'info>,
    #[account(
        mut, seeds = [BRO_SEED, asset.key().as_ref(), player.key().as_ref()],
        bump = bro_record.bump, has_one = owner @ TmbError::NotOwner
    )]
    pub bro_record: Box<Account<'info, BroRecord>>,
    #[account(
        mut, close = player,
        seeds = [ESCROW_SEED, asset.key().as_ref()], bump = escrow_receipt.bump,
        constraint = escrow_receipt.owner == player.key() @ TmbError::NotOwner
    )]
    pub escrow_receipt: Box<Account<'info, EscrowReceipt>>,
    /// CHECK: signer PDA that owns the escrowed asset.
    #[account(seeds = [ESCROW_AUTH_SEED], bump = config.escrow_auth_bump)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: equals bro_record.owner == player (has_one).
    #[account(address = player.key())]
    pub owner: UncheckedAccount<'info>,
    /// CHECK: pinned to the Metaplex Core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
