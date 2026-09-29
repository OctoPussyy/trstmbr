//! Trust Me Bros (TMB) game protocol.
//!
//! Metaplex Core "Bro" NFTs are staked into escrow, players spend $TMB spinning a prize wheel whose
//! randomness comes from Switchboard On-Demand (commit-reveal), and five consecutive losses burn the
//! Bro. Burned Bros can be rescued by other players.
use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod logic;
pub mod state;
pub mod utils;

pub use constants::*;
use instructions::*;
use state::{Prize, Thresholds};

#[program]
pub mod tmb_game {
    use super::*;

    // ---- admin ----
    pub fn initialize(ctx: Context<Initialize>, args: ConfigArgs) -> Result<()> {
        instructions::initialize::handler(ctx, args)
    }
    pub fn update_config(ctx: Context<UpdateConfig>, args: UpdateConfigArgs) -> Result<()> {
        instructions::update_config::handler(ctx, args)
    }
    pub fn propose_authority(ctx: Context<ProposeAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::propose_authority::handler(ctx, new_authority)
    }
    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::accept_authority::handler(ctx)
    }
    pub fn set_roles(
        ctx: Context<SetRoles>,
        reward_wallet: Option<Pubkey>,
        pauser: Option<Pubkey>,
    ) -> Result<()> {
        instructions::set_roles::handler(ctx, reward_wallet, pauser)
    }
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::set_paused::handler(ctx, paused)
    }
    pub fn set_prizes(
        ctx: Context<SetPrizes>,
        entries: Vec<Prize>,
        append: bool,
        finalize: bool,
    ) -> Result<()> {
        instructions::set_prizes::handler(ctx, entries, append, finalize)
    }
    pub fn fund_vault(ctx: Context<FundVault>, amount: u64) -> Result<()> {
        instructions::fund_vault::handler(ctx, amount)
    }
    pub fn withdraw_vault(ctx: Context<WithdrawVault>, amount: u64) -> Result<()> {
        instructions::withdraw_vault::handler(ctx, amount)
    }
    pub fn create_collection(
        ctx: Context<CreateCollection>,
        name: String,
        uri: String,
    ) -> Result<()> {
        instructions::create_collection::handler(ctx, name, uri)
    }

    // ---- player ----
    pub fn mint_bro(ctx: Context<MintBro>, name: String, uri: String) -> Result<()> {
        instructions::mint_bro::handler(ctx, name, uri)
    }
    pub fn deposit_bro(ctx: Context<DepositBro>) -> Result<()> {
        instructions::deposit_bro::handler(ctx)
    }
    pub fn withdraw_bro(ctx: Context<WithdrawBro>) -> Result<()> {
        instructions::withdraw_bro::handler(ctx)
    }
    pub fn deposit_tmb(ctx: Context<DepositTmb>, amount: u64) -> Result<()> {
        instructions::deposit_tmb::handler(ctx, amount)
    }
    pub fn withdraw_tmb(ctx: Context<WithdrawTmb>, amount: u64) -> Result<()> {
        instructions::withdraw_tmb::handler(ctx, amount)
    }
    pub fn request_spin(ctx: Context<RequestSpin>, amount: u64) -> Result<()> {
        instructions::request_spin::handler(ctx, amount)
    }
    pub fn settle_spin(ctx: Context<SettleSpin>) -> Result<()> {
        instructions::settle_spin::handler(ctx)
    }
    pub fn cancel_stale_spin(ctx: Context<CancelStaleSpin>) -> Result<()> {
        instructions::cancel_stale_spin::handler(ctx)
    }
    pub fn claim_holding(ctx: Context<ClaimHolding>, index: u8) -> Result<()> {
        instructions::claim_holding::handler(ctx, index)
    }
    pub fn rescue(ctx: Context<Rescue>, fee: u64) -> Result<()> {
        instructions::rescue::handler(ctx, fee)
    }
}

// Keep `Thresholds` in the IDL types even though it is only used inside args.
#[allow(dead_code)]
fn _thresholds_marker(_: Thresholds) {}
