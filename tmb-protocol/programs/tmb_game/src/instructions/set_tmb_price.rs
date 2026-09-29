use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::TmbPriceSet;
use crate::state::*;

/// Authority sets the SOL price of one whole TMB. Devnet uses a fixed test price; on mainnet an
/// operator/bot must keep it in line with the LP price (there is no on-chain oracle).
pub fn handler(ctx: Context<SetTmbPrice>, lamports_per_tmb: u64) -> Result<()> {
    require!(lamports_per_tmb > 0, TmbError::InvalidConfig);
    let p = &mut ctx.accounts.price;
    p.lamports_per_tmb = lamports_per_tmb;
    p.bump = ctx.bumps.price;
    emit!(TmbPriceSet {
        lamports_per_tmb,
        by: ctx.accounts.authority.key()
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SetTmbPrice<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ TmbError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(
        init_if_needed, payer = authority, space = 8 + TmbPrice::INIT_SPACE,
        seeds = [PRICE_SEED], bump
    )]
    pub price: Box<Account<'info, TmbPrice>>,
    pub system_program: Program<'info, System>,
}
