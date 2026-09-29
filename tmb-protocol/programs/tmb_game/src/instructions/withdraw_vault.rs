use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::VaultWithdrawn;
use crate::state::*;
use crate::utils::vault_seeds;

/// Authority only. TMB withdrawals may only touch the reward pool (vault minus every Bro balance)
/// and can never take the pool below `min_reserve`.
pub fn handler(ctx: Context<WithdrawVault>, amount: u64) -> Result<()> {
    require!(amount > 0, TmbError::InvalidAmount);
    let c = &ctx.accounts.config;
    if ctx.accounts.mint.key() == c.tmb_mint {
        let pool = c.pool(ctx.accounts.vault_token.amount);
        let rest = pool
            .checked_sub(amount)
            .ok_or(TmbError::PoolReserveBreached)?;
        require!(rest >= c.min_reserve, TmbError::PoolReserveBreached);
    }
    let bump = c.vault_bump;
    let seeds = vault_seeds(&bump);
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[&seeds],
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;
    emit!(VaultWithdrawn {
        mint: ctx.accounts.mint.key(),
        amount,
        by: ctx.accounts.authority.key()
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawVault<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ TmbError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: PDA owning the vault token accounts.
    #[account(seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = mint)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}
