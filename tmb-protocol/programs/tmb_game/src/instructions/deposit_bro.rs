use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::BroDeposited;
use crate::state::*;
use crate::utils::{core_transfer_by_user, read_bro_asset};

/// Stakes a Bro: transfers the Core asset to the escrow authority and get-or-creates the
/// (asset, wallet) BroRecord. A record first seen here is subject to `transfer_cooldown_slots`.
pub fn handler(ctx: Context<DepositBro>) -> Result<()> {
    let c = &ctx.accounts.config;
    let core = read_bro_asset(&ctx.accounts.asset.to_account_info(), &c.collection)?;
    require_keys_eq!(core.owner, ctx.accounts.player.key(), TmbError::NotOwner);

    let b = &mut ctx.accounts.bro_record;
    if b.owner == Pubkey::default() {
        b.asset = ctx.accounts.asset.key();
        b.owner = ctx.accounts.player.key();
        b.loss_streak = 0;
        b.tmb_balance = 0;
        b.holdings = Vec::new();
        b.status = BroStatus::Active;
        b.pending_spin = None;
        b.total_spins = 0;
        b.eligible_slot = Clock::get()?
            .slot
            .checked_add(c.transfer_cooldown_slots)
            .ok_or(TmbError::Overflow)?;
        b.bump = ctx.bumps.bro_record;
    }
    require!(b.status == BroStatus::Active, TmbError::BroBurned);
    require!(!b.in_escrow, TmbError::NotOwner);
    b.in_escrow = true;

    let r = &mut ctx.accounts.escrow_receipt;
    r.asset = ctx.accounts.asset.key();
    r.owner = ctx.accounts.player.key();
    r.deposited_at = Clock::get()?.unix_timestamp;
    r.bump = ctx.bumps.escrow_receipt;

    core_transfer_by_user(
        &ctx.accounts.mpl_core_program.to_account_info(),
        &ctx.accounts.asset.to_account_info(),
        &ctx.accounts.collection.to_account_info(),
        &ctx.accounts.player.to_account_info(),
        &ctx.accounts.escrow_auth.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
    )?;
    emit!(BroDeposited {
        asset: b.asset,
        owner: b.owner,
        loss_streak: b.loss_streak,
        eligible_slot: b.eligible_slot,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct DepositBro<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: parsed and validated as a Core asset of the Bro collection.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: must be the configured Bro collection.
    #[account(mut, address = config.collection @ TmbError::CollectionNotSet)]
    pub collection: UncheckedAccount<'info>,
    #[account(
        init, payer = player, space = 8 + EscrowReceipt::INIT_SPACE,
        seeds = [ESCROW_SEED, asset.key().as_ref()], bump
    )]
    pub escrow_receipt: Box<Account<'info, EscrowReceipt>>,
    #[account(
        init_if_needed, payer = player, space = 8 + BroRecord::INIT_SPACE,
        seeds = [BRO_SEED, asset.key().as_ref(), player.key().as_ref()], bump
    )]
    pub bro_record: Box<Account<'info, BroRecord>>,
    /// CHECK: PDA that becomes the asset owner while staked.
    #[account(seeds = [ESCROW_AUTH_SEED], bump = config.escrow_auth_bump)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: pinned to the Metaplex Core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
