use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::AuthorityAccepted;
use crate::state::*;

pub fn handler(ctx: Context<AcceptAuthority>) -> Result<()> {
    let c = &mut ctx.accounts.config;
    require!(
        c.pending_authority != Pubkey::default(),
        TmbError::NoPendingAuthority
    );
    let previous = c.authority;
    c.authority = c.pending_authority;
    c.pending_authority = Pubkey::default();
    emit!(AuthorityAccepted {
        previous,
        new_authority: c.authority
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,
    #[account(
        mut, seeds = [CONFIG_SEED], bump = config.bump,
        constraint = config.pending_authority == new_authority.key() @ TmbError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,
}
