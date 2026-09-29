use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::AuthorityProposed;
use crate::state::*;

pub fn handler(ctx: Context<ProposeAuthority>, new_authority: Pubkey) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.pending_authority = new_authority;
    emit!(AuthorityProposed {
        current: c.authority,
        proposed: new_authority
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ProposeAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut, seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ TmbError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,
}
