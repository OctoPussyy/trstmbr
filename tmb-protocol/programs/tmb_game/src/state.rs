use anchor_lang::prelude::*;

use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, Debug, PartialEq)]
pub struct Thresholds {
    pub low_tmb: u64,
    pub medium_tmb: u64,
    pub high_tmb: u64,
    pub stock_count_low: u8,
    pub stock_value_low: u64,
    pub stock_tmb_high: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub pending_authority: Pubkey,
    pub reward_wallet: Pubkey,
    pub pauser: Pubkey,
    pub tmb_mint: Pubkey,
    pub collection: Pubkey,
    pub treasury: Pubkey,
    pub team_wallet: Pubkey,
    pub paused: bool,
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
    pub minted: u32,
    pub transfer_cooldown_slots: u64,
    pub stale_slots: u64,
    /// Sum of every BroRecord.tmb_balance. Reward pool = vault TMB - total_user_tmb.
    pub total_user_tmb: u64,
    pub bump: u8,
    pub vault_bump: u8,
    pub escrow_auth_bump: u8,
    /// False while a multi-transaction prize update is in flight (or after a failed one): spins are
    /// blocked until `set_prizes(.., finalize = true)` validates the complete table.
    pub prizes_ready: bool,
    /// Metadata uri for Bonus Bro mints. Empty = copy the escrowed Bro's uri.
    #[max_len(MAX_URI_LEN)]
    pub bonus_uri: String,
}

impl Config {
    /// Reward pool = vault TMB minus every Bro's internal balance.
    pub fn pool(&self, vault_amount: u64) -> u64 {
        vault_amount.saturating_sub(self.total_user_tmb)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, PartialEq, Eq)]
pub enum PrizeKind {
    /// REKT wedge.
    None,
    Tmb,
    /// Stock-like SPL token paid from its own vault ATA.
    Token,
    BonusBro,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub struct Prize {
    pub id: [u8; 16],
    pub kind: PrizeKind,
    pub label: [u8; 24],
    /// TMB base units (Tmb), token base units (Token), count (BonusBro).
    pub amount: u64,
    /// Prize token mint (Token only).
    pub mint: Pubkey,
    pub weight: u32,
    /// USD value snapshot (Token only), same units as `Thresholds::stock_value_low`.
    pub usd_value: u64,
}

#[account]
#[derive(InitSpace)]
pub struct PrizeTable {
    #[max_len(MAX_PRIZES)]
    pub entries: Vec<Prize>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, PartialEq)]
pub struct Holding {
    pub mint: Pubkey,
    pub amount: u64,
    pub usd_value_snapshot: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, PartialEq, Eq)]
pub enum BroStatus {
    Active,
    Burned,
}

#[account]
#[derive(InitSpace)]
pub struct BroRecord {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub loss_streak: u8,
    pub tmb_balance: u64,
    #[max_len(MAX_HOLDINGS)]
    pub holdings: Vec<Holding>,
    pub status: BroStatus,
    pub in_escrow: bool,
    pub pending_spin: Option<Pubkey>,
    pub total_spins: u32,
    /// Slot before which this (asset, owner) record may not spin (transfer cooldown).
    pub eligible_slot: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowReceipt {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub deposited_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SpinRequest {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub odds_tier: u8,
    pub randomness_account: Pubkey,
    /// Switchboard `seed_slot` the randomness was committed to.
    pub commit_slot: u64,
    pub requested_slot: u64,
    pub nonce: u32,
    pub at_stake: bool,
    pub resolved: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Graveyard {
    pub asset: Pubkey,
    pub last_owner: Pubkey,
    pub burned_at: i64,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    pub bump: u8,
}
