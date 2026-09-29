use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::RolesUpdated;
use crate::state::*;

pub fn handler(
    ctx: Context<SetRoles>,
    reward_wallet: Option<Pubkey>,
    pauser: Option<Pubkey>,
) -> Result<()> {
    let c = &mut ctx.accounts.config;
    if let Some(v) = reward_wallet {
        c.reward_wallet = v;
    }
    if let Some(v) = pauser {
        c.pauser = v;
    }
    emit!(RolesUpdated {
        reward_wallet: c.reward_wallet,
        pauser: c.pauser
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SetRoles<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut, seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ TmbError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,
}
