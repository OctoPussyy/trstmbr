use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::TmbDeposited;
use crate::state::*;

/// Wallet -> vault; credits the Bro with the amount the vault actually received.
pub fn handler(ctx: Context<DepositTmb>, amount: u64) -> Result<()> {
    require!(amount > 0, TmbError::InvalidAmount);
    {
        let b = &ctx.accounts.bro_record;
        require!(b.status == BroStatus::Active, TmbError::BroBurned);
        require!(b.in_escrow, TmbError::NotInEscrow);
        require!(b.pending_spin.is_none(), TmbError::SpinPending);
    }
    let before = ctx.accounts.vault_tmb.amount;
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.player_tmb.to_account_info(),
                mint: ctx.accounts.tmb_mint.to_account_info(),
                to: ctx.accounts.vault_tmb.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.tmb_mint.decimals,
    )?;
    ctx.accounts.vault_tmb.reload()?;
    let received = ctx
        .accounts
        .vault_tmb
        .amount
        .checked_sub(before)
        .ok_or(TmbError::Overflow)?;

    let b = &mut ctx.accounts.bro_record;
    b.tmb_balance = b
        .tmb_balance
        .checked_add(received)
        .ok_or(TmbError::Overflow)?;
    let c = &mut ctx.accounts.config;
    c.total_user_tmb = c
        .total_user_tmb
        .checked_add(received)
        .ok_or(TmbError::Overflow)?;
    emit!(TmbDeposited {
        asset: b.asset,
        owner: b.owner,
        amount: received,
        new_balance: b.tmb_balance
    });
    Ok(())
}

#[derive(Accounts)]
pub struct DepositTmb<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: only its key is used, to bind the BroRecord PDA.
    pub asset: UncheckedAccount<'info>,
    #[account(
        mut, seeds = [BRO_SEED, asset.key().as_ref(), player.key().as_ref()],
        bump = bro_record.bump
    )]
    pub bro_record: Box<Account<'info, BroRecord>>,
    #[account(address = config.tmb_mint)]
    pub tmb_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = tmb_mint, token::authority = player)]
    pub player_tmb: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: PDA owning the vault token accounts.
    #[account(seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = tmb_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_tmb: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}
