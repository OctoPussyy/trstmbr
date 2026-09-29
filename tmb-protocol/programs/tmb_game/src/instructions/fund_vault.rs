use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::VaultFunded;
use crate::state::*;

/// reward_wallet (or authority) moves `amount` of `mint` from its own token account into the vault.
pub fn handler(ctx: Context<FundVault>, amount: u64) -> Result<()> {
    require!(amount > 0, TmbError::InvalidAmount);
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.source.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.funder.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;
    emit!(VaultFunded {
        mint: ctx.accounts.mint.key(),
        amount,
        by: ctx.accounts.funder.key()
    });
    Ok(())
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(
        mut,
        constraint = funder.key() == config.reward_wallet || funder.key() == config.authority
            @ TmbError::Unauthorized
    )]
    pub funder: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = funder)]
    pub source: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: PDA owning the vault token accounts.
    #[account(seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        init_if_needed, payer = funder,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
