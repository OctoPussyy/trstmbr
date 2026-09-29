use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::TmbBought;
use crate::state::*;

/// Pays SOL (to the treasury) for `amount` TMB base units, credited to the Bro's balance out of the
/// reward pool (the tokens are already in the vault). The pool can't drop below `min_reserve`.
pub fn handler(ctx: Context<BuyTmb>, amount: u64) -> Result<()> {
    require!(amount > 0, TmbError::InvalidAmount);
    let c = &mut ctx.accounts.config;
    require!(!c.paused, TmbError::Paused);
    {
        let b = &ctx.accounts.bro_record;
        require!(b.status == BroStatus::Active, TmbError::BroBurned);
        require!(b.in_escrow, TmbError::NotInEscrow);
        require!(b.pending_spin.is_none(), TmbError::SpinPending);
    }
    let price = ctx.accounts.price.lamports_per_tmb;
    require!(price > 0, TmbError::PriceNotSet);

    // cost = ceil(amount * price / 10^decimals): never rounds down to a free purchase
    let unit = 10u128.pow(ctx.accounts.tmb_mint.decimals as u32);
    let cost: u64 = ((amount as u128) * (price as u128))
        .checked_add(unit - 1)
        .ok_or(TmbError::Overflow)?
        .checked_div(unit)
        .ok_or(TmbError::Overflow)?
        .try_into()
        .map_err(|_| TmbError::Overflow)?;
    require!(cost > 0, TmbError::InvalidAmount);

    let pool = c.pool(ctx.accounts.vault_tmb.amount);
    let rest = pool
        .checked_sub(amount)
        .ok_or(TmbError::PoolReserveBreached)?;
    require!(rest >= c.min_reserve, TmbError::PoolReserveBreached);

    // state first, then the SOL transfer
    let b = &mut ctx.accounts.bro_record;
    b.tmb_balance = b
        .tmb_balance
        .checked_add(amount)
        .ok_or(TmbError::Overflow)?;
    c.total_user_tmb = c
        .total_user_tmb
        .checked_add(amount)
        .ok_or(TmbError::Overflow)?;
    let (asset, owner, new_balance) = (b.asset, b.owner, b.tmb_balance);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        cost,
    )?;
    emit!(TmbBought {
        asset,
        owner,
        amount,
        lamports_paid: cost,
        new_balance
    });
    Ok(())
}

#[derive(Accounts)]
pub struct BuyTmb<'info> {
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
    #[account(seeds = [PRICE_SEED], bump = price.bump)]
    pub price: Box<Account<'info, TmbPrice>>,
    /// CHECK: configured SOL treasury.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(address = config.tmb_mint)]
    pub tmb_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: PDA owning the vault token accounts.
    #[account(seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        associated_token::mint = tmb_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_tmb: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
