use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::SpinRequested;
use crate::logic::odds_tier_for;
use crate::state::*;
use crate::utils::parse_randomness;

/// Commit phase. Must be sent in the same transaction as (and after) Switchboard's `commitIx`,
/// so the randomness seed slot is exactly `current_slot - 1` and can't have been peeked at.
pub fn handler(ctx: Context<RequestSpin>, amount: u64) -> Result<()> {
    let c = &mut ctx.accounts.config;
    require!(!c.paused, TmbError::Paused);
    require!(c.prizes_ready, TmbError::PrizeTableInvalid);
    require!(
        amount > 0 && c.spin_amounts.contains(&amount),
        TmbError::InvalidSpinAmount
    );
    let clock = Clock::get()?;
    let b = &mut ctx.accounts.bro_record;
    require!(b.status == BroStatus::Active, TmbError::BroBurned);
    require!(b.in_escrow, TmbError::NotInEscrow);
    require!(b.pending_spin.is_none(), TmbError::SpinPending);
    require!(b.tmb_balance >= amount, TmbError::NotEnoughBags);
    require!(clock.slot >= b.eligible_slot, TmbError::CooldownActive);

    // --- randomness must be freshly committed and unrevealed ---
    let rd = parse_randomness(&ctx.accounts.randomness_account.to_account_info())?;
    require_keys_eq!(
        rd.authority,
        ctx.accounts.player.key(),
        TmbError::StaleRandomness
    );
    require!(
        rd.seed_slot == clock.slot.saturating_sub(1),
        TmbError::StaleRandomness
    );
    require!(rd.reveal_slot == 0, TmbError::RandomnessAlreadyRevealed);

    // --- odds tier from PRE-spin balance + holdings ---
    let tier = odds_tier_for(b, &c.thresholds);

    // --- debit the fee now; it joins the reward pool by accounting ---
    b.tmb_balance -= amount;
    c.total_user_tmb = c
        .total_user_tmb
        .checked_sub(amount)
        .ok_or(TmbError::Overflow)?;

    let at_stake = b.loss_streak.saturating_add(1) >= c.burn_at_loss_streak;
    let s = &mut ctx.accounts.spin_request;
    s.asset = b.asset;
    s.owner = b.owner;
    s.amount = amount;
    s.odds_tier = tier;
    s.randomness_account = ctx.accounts.randomness_account.key();
    s.commit_slot = rd.seed_slot;
    s.requested_slot = clock.slot;
    s.nonce = b.total_spins;
    s.at_stake = at_stake;
    s.resolved = false;
    s.bump = ctx.bumps.spin_request;

    b.total_spins = b.total_spins.checked_add(1).ok_or(TmbError::Overflow)?;
    b.pending_spin = Some(s.key());

    emit!(SpinRequested {
        asset: b.asset,
        owner: b.owner,
        amount,
        odds_tier: tier,
        commit_slot: rd.seed_slot,
        loss_streak: b.loss_streak,
        at_stake,
        randomness_account: s.randomness_account,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RequestSpin<'info> {
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
    #[account(
        init, payer = player, space = 8 + SpinRequest::INIT_SPACE,
        seeds = [SPIN_SEED, asset.key().as_ref(), &bro_record.total_spins.to_le_bytes()], bump
    )]
    pub spin_request: Box<Account<'info, SpinRequest>>,
    /// CHECK: owner-pinned to the Switchboard program and parsed in the handler.
    pub randomness_account: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
