use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::HoldingClaimed;
use crate::state::*;
use crate::utils::vault_seeds;

/// Moves a won prize token from the vault to the owner's wallet.
pub fn handler(ctx: Context<ClaimHolding>, index: u8) -> Result<()> {
    let b = &mut ctx.accounts.bro_record;
    require!(b.pending_spin.is_none(), TmbError::SpinPending);
    let idx = index as usize;
    require!(idx < b.holdings.len(), TmbError::InvalidHolding);
    let h = b.holdings[idx];
    require_keys_eq!(
        h.mint,
        ctx.accounts.prize_mint.key(),
        TmbError::InvalidHolding
    );
    b.holdings.remove(idx);
    let (asset, owner) = (b.asset, b.owner);

    let bump = ctx.accounts.config.vault_bump;
    let seeds = vault_seeds(&bump);
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token.to_account_info(),
                mint: ctx.accounts.prize_mint.to_account_info(),
                to: ctx.accounts.player_token.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[&seeds],
        ),
        h.amount,
        ctx.accounts.prize_mint.decimals,
    )?;
    emit!(HoldingClaimed {
        asset,
        owner,
        mint: h.mint,
        amount: h.amount
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimHolding<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: only its key is used, to bind the BroRecord PDA.
    pub asset: UncheckedAccount<'info>,
    #[account(
        mut, seeds = [BRO_SEED, asset.key().as_ref(), player.key().as_ref()],
        bump = bro_record.bump
    )]
    pub bro_record: Box<Account<'info, BroRecord>>,
    pub prize_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: PDA owning the vault token accounts.
    #[account(seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = prize_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed, payer = player,
        associated_token::mint = prize_mint,
        associated_token::authority = player,
        associated_token::token_program = token_program
    )]
    pub player_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
