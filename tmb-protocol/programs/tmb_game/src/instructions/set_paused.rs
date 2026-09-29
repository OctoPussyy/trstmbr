use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::PausedChanged;
use crate::state::*;

/// Authority may pause/unpause. The pauser may only pause.
pub fn handler(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    let c = &mut ctx.accounts.config;
    let who = ctx.accounts.signer.key();
    let allowed = who == c.authority || (paused && who == c.pauser);
    require!(allowed, TmbError::Unauthorized);
    c.paused = paused;
    emit!(PausedChanged { paused, by: who });
    Ok(())
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub signer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
}
