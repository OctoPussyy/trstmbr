use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::CollectionCreated;
use crate::state::*;
use crate::utils::core_create_collection;

/// Creates the Bro collection with `update_authority = config PDA`.
///
/// No Burn/Transfer delegate plugins are installed on the collection on purpose: escrowed assets are
/// *owned* by the `escrow_auth` PDA, which already lets the program transfer/burn exactly those
/// assets and nothing else. A collection-wide delegate would also let the program move Bros that sit
/// in player wallets.
pub fn handler(ctx: Context<CreateCollection>, name: String, uri: String) -> Result<()> {
    require!(
        ctx.accounts.config.collection == Pubkey::default(),
        TmbError::CollectionAlreadySet
    );
    require!(
        name.len() <= MAX_NAME_LEN && uri.len() <= MAX_URI_LEN,
        TmbError::StringTooLong
    );
    core_create_collection(
        &ctx.accounts.mpl_core_program.to_account_info(),
        &ctx.accounts.collection.to_account_info(),
        &ctx.accounts.config.to_account_info(),
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        name,
        uri,
    )?;
    ctx.accounts.config.collection = ctx.accounts.collection.key();
    emit!(CollectionCreated {
        collection: ctx.accounts.collection.key()
    });
    Ok(())
}

#[derive(Accounts)]
pub struct CreateCollection<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut, seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ TmbError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub collection: Signer<'info>,
    /// CHECK: pinned to the Metaplex Core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
