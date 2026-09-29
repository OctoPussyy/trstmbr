use anchor_lang::prelude::*;

use super::initialize::validate_tunables;
use crate::constants::*;
use crate::errors::TmbError;
use crate::events::ConfigUpdated;
use crate::state::*;

/// Every field optional; only `Some` fields are applied. Roles use `set_roles`, authority uses
/// propose/accept, pause uses `set_paused`, mint/collection are immutable after setup.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct UpdateConfigArgs {
    pub treasury: Option<Pubkey>,
    pub team_wallet: Option<Pubkey>,
    pub burn_at_loss_streak: Option<u8>,
    pub spin_amounts: Option<[u64; 4]>,
    pub odds_bps: Option<[u16; 4]>,
    pub thresholds: Option<Thresholds>,
    pub rescue_burn_bps: Option<u16>,
    pub rescue_fee_options: Option<[u64; 4]>,
    pub max_payout_bps: Option<u16>,
    pub min_reserve: Option<u64>,
    pub mint_price_lamports: Option<u64>,
    pub mint_pool_share_bps: Option<u16>,
    pub mint_starting_balance: Option<u64>,
    pub max_supply: Option<u32>,
    pub transfer_cooldown_slots: Option<u64>,
    pub stale_slots: Option<u64>,
    pub bonus_uri: Option<String>,
}

pub fn handler(ctx: Context<UpdateConfig>, a: UpdateConfigArgs) -> Result<()> {
    let c = &mut ctx.accounts.config;
    if let Some(v) = a.treasury {
        c.treasury = v;
    }
    if let Some(v) = a.team_wallet {
        c.team_wallet = v;
    }
    if let Some(v) = a.burn_at_loss_streak {
        c.burn_at_loss_streak = v;
    }
    if let Some(v) = a.spin_amounts {
        c.spin_amounts = v;
    }
    if let Some(v) = a.odds_bps {
        c.odds_bps = v;
    }
    if let Some(v) = a.thresholds {
        c.thresholds = v;
    }
    if let Some(v) = a.rescue_burn_bps {
        c.rescue_burn_bps = v;
    }
    if let Some(v) = a.rescue_fee_options {
        c.rescue_fee_options = v;
    }
    if let Some(v) = a.max_payout_bps {
        c.max_payout_bps = v;
    }
    if let Some(v) = a.min_reserve {
        c.min_reserve = v;
    }
    if let Some(v) = a.mint_price_lamports {
        c.mint_price_lamports = v;
    }
    if let Some(v) = a.mint_pool_share_bps {
        c.mint_pool_share_bps = v;
    }
    if let Some(v) = a.mint_starting_balance {
        c.mint_starting_balance = v;
    }
    if let Some(v) = a.max_supply {
        require!(v >= c.minted && v > 0, TmbError::InvalidConfig);
        c.max_supply = v;
    }
    if let Some(v) = a.transfer_cooldown_slots {
        c.transfer_cooldown_slots = v;
    }
    if let Some(v) = a.stale_slots {
        c.stale_slots = v;
    }
    if let Some(v) = a.bonus_uri {
        c.bonus_uri = v;
    }
    validate_tunables(
        c.burn_at_loss_streak,
        &c.odds_bps,
        c.rescue_burn_bps,
        c.max_payout_bps,
        c.mint_pool_share_bps,
        c.max_supply,
        c.stale_slots,
        &c.bonus_uri,
    )?;
    emit!(ConfigUpdated {
        by: ctx.accounts.authority.key()
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut, seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ TmbError::Unauthorized
    )]
    pub config: Box<Account<'info, Config>>,
}
