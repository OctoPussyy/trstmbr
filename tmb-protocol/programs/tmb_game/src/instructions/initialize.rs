use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::ConfigInitialized;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigArgs {
    pub reward_wallet: Pubkey,
    pub pauser: Pubkey,
    pub treasury: Pubkey,
    pub team_wallet: Pubkey,
    pub burn_at_loss_streak: u8,
    pub spin_amounts: [u64; 4],
    pub odds_bps: [u16; 4],
    pub thresholds: Thresholds,
    pub rescue_burn_bps: u16,
    pub rescue_fee_options: [u64; 4],
    pub max_payout_bps: u16,
    pub min_reserve: u64,
    pub mint_price_lamports: u64,
    pub mint_pool_share_bps: u16,
    pub mint_starting_balance: u64,
    pub max_supply: u32,
    pub transfer_cooldown_slots: u64,
    pub stale_slots: u64,
    pub bonus_uri: String,
}

/// Validates the tunables shared by `initialize` and `update_config`.
#[allow(clippy::too_many_arguments)]
pub fn validate_tunables(
    burn_at: u8,
    odds_bps: &[u16; 4],
    rescue_burn_bps: u16,
    max_payout_bps: u16,
    mint_pool_share_bps: u16,
    max_supply: u32,
    stale_slots: u64,
    bonus_uri: &str,
) -> Result<()> {
    require!(burn_at >= 1, TmbError::InvalidConfig);
    require!(
        odds_bps.iter().all(|o| *o <= 10_000),
        TmbError::InvalidConfig
    );
    require!(rescue_burn_bps <= 10_000, TmbError::InvalidConfig);
    require!(max_payout_bps <= 10_000, TmbError::InvalidConfig);
    require!(mint_pool_share_bps <= 10_000, TmbError::InvalidConfig);
    require!(max_supply > 0, TmbError::InvalidConfig);
    require!(stale_slots > 0, TmbError::InvalidConfig);
    require!(bonus_uri.len() <= MAX_URI_LEN, TmbError::StringTooLong);
    Ok(())
}

pub fn handler(ctx: Context<Initialize>, args: ConfigArgs) -> Result<()> {
    validate_tunables(
        args.burn_at_loss_streak,
        &args.odds_bps,
        args.rescue_burn_bps,
        args.max_payout_bps,
        args.mint_pool_share_bps,
        args.max_supply,
        args.stale_slots,
        &args.bonus_uri,
    )?;
    let c = &mut ctx.accounts.config;
    c.authority = ctx.accounts.authority.key();
    c.pending_authority = Pubkey::default();
    c.reward_wallet = args.reward_wallet;
    c.pauser = args.pauser;
    c.tmb_mint = ctx.accounts.tmb_mint.key();
    c.collection = Pubkey::default();
    c.treasury = args.treasury;
    c.team_wallet = args.team_wallet;
    c.paused = false;
    c.burn_at_loss_streak = args.burn_at_loss_streak;
    c.spin_amounts = args.spin_amounts;
    c.odds_bps = args.odds_bps;
    c.thresholds = args.thresholds;
    c.rescue_burn_bps = args.rescue_burn_bps;
    c.rescue_fee_options = args.rescue_fee_options;
    c.max_payout_bps = args.max_payout_bps;
    c.min_reserve = args.min_reserve;
    c.mint_price_lamports = args.mint_price_lamports;
    c.mint_pool_share_bps = args.mint_pool_share_bps;
    c.mint_starting_balance = args.mint_starting_balance;
    c.max_supply = args.max_supply;
    c.minted = 0;
    c.transfer_cooldown_slots = args.transfer_cooldown_slots;
    c.stale_slots = args.stale_slots;
    c.total_user_tmb = 0;
    c.bump = ctx.bumps.config;
    c.vault_bump = ctx.bumps.vault;
    c.escrow_auth_bump = ctx.bumps.escrow_auth;
    c.prizes_ready = false;
    c.bonus_uri = args.bonus_uri;
    ctx.accounts.prizes.entries = Vec::new();
    emit!(ConfigInitialized {
        authority: c.authority,
        tmb_mint: c.tmb_mint,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Must be the program's upgrade authority (blocks front-running of initialization).
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init, payer = authority, space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED], bump
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(
        init, payer = authority, space = 8 + PrizeTable::INIT_SPACE,
        seeds = [PRIZES_SEED], bump
    )]
    pub prizes: Box<Account<'info, PrizeTable>>,
    /// CHECK: PDA that owns the reward vault token accounts.
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: PDA that owns escrowed Core assets.
    #[account(seeds = [ESCROW_AUTH_SEED], bump)]
    pub escrow_auth: UncheckedAccount<'info>,
    pub tmb_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init, payer = authority,
        associated_token::mint = tmb_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_tmb: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, crate::program::TmbGame>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ TmbError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
