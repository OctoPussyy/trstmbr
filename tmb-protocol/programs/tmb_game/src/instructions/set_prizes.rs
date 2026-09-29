use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::PrizesSet;
use crate::logic::validate_prizes;
use crate::state::*;

/// Writes the wheel. A full 16-wedge table doesn't fit in one transaction, so it can be written in
/// chunks: `append = false` starts a new table, `append = true` extends it, and only the call with
/// `finalize = true` validates the complete table and re-opens spinning. Until then (or if any chunk
/// fails) `prizes_ready` stays false and `request_spin` is refused: fail-closed. Pause the game before
/// a multi-transaction update so pending spins aren't left waiting.
pub fn handler(
    ctx: Context<SetPrizes>,
    entries: Vec<Prize>,
    append: bool,
    finalize: bool,
) -> Result<()> {
    let who = ctx.accounts.signer.key();
    let c = &mut ctx.accounts.config;
    require!(
        who == c.authority || who == c.reward_wallet,
        TmbError::Unauthorized
    );
    c.prizes_ready = false;
    let table = &mut ctx.accounts.prizes;
    if append {
        table.entries.extend(entries);
    } else {
        table.entries = entries;
    }
    require!(
        table.entries.len() <= MAX_PRIZES,
        TmbError::PrizeTableInvalid
    );
    if finalize {
        validate_prizes(&table.entries)?;
        c.prizes_ready = true;
        emit!(PrizesSet {
            count: table.entries.len() as u8,
            by: who
        });
    }
    Ok(())
}

#[derive(Accounts)]
pub struct SetPrizes<'info> {
    pub signer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [PRIZES_SEED], bump)]
    pub prizes: Box<Account<'info, PrizeTable>>,
}
