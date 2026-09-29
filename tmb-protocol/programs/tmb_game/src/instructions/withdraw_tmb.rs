use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::TmbWithdrawn;
use crate::state::*;
use crate::utils::vault_seeds;

/// Vault -> wallet. Requires the Bro in escrow with no spin pending (spec).
pub fn handler(ctx: Context<WithdrawTmb>, amount: u64) -> Result<()> {
    require!(amount > 0, TmbError::InvalidAmount);
    let b = &mut ctx.accounts.bro_record;
    require!(b.status == BroStatus::Active, TmbError::BroBurned);
    require!(b.in_escrow, TmbError::NotInEscrow);
    require!(b.pending_spin.is_none(), TmbError::SpinPending);
    b.tmb_balance = b
        .tmb_balance
        .checked_sub(amount)
        .ok_or(TmbError::NotEnoughBags)?;
    let c = &mut ctx.accounts.config;
    c.total_user_tmb = c
        .total_user_tmb
        .checked_sub(amount)
        .ok_or(TmbError::Overflow)?;
    let (asset, owner, new_balance) = (b.asset, b.owner, b.tmb_balance);

    let bump = c.vault_bump;
    let seeds = vault_seeds(&bump);
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_tmb.to_account_info(),
                mint: ctx.accounts.tmb_mint.to_account_info(),
                to: ctx.accounts.player_tmb.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[&seeds],
        ),
        amount,
        ctx.accounts.tmb_mint.decimals,
    )?;
    emit!(TmbWithdrawn {
        asset,
        owner,
        amount,
        new_balance
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawTmb<'info> {
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
