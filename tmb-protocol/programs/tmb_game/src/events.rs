use anchor_lang::prelude::*;

pub const OUTCOME_LOSS: u8 = 0;
pub const OUTCOME_WIN: u8 = 1;
pub const OUTCOME_STALE_LOSS: u8 = 2;

#[event]
pub struct ConfigInitialized {
    pub authority: Pubkey,
    pub tmb_mint: Pubkey,
}
#[event]
pub struct ConfigUpdated {
    pub by: Pubkey,
}
#[event]
pub struct AuthorityProposed {
    pub current: Pubkey,
    pub proposed: Pubkey,
}
#[event]
pub struct AuthorityAccepted {
    pub previous: Pubkey,
    pub new_authority: Pubkey,
}
#[event]
pub struct RolesUpdated {
    pub reward_wallet: Pubkey,
    pub pauser: Pubkey,
}
#[event]
pub struct PausedChanged {
    pub paused: bool,
    pub by: Pubkey,
}
#[event]
pub struct PrizesSet {
    pub count: u8,
    pub by: Pubkey,
}
#[event]
pub struct VaultFunded {
    pub mint: Pubkey,
    pub amount: u64,
    pub by: Pubkey,
}
#[event]
pub struct VaultWithdrawn {
    pub mint: Pubkey,
    pub amount: u64,
    pub by: Pubkey,
}
#[event]
pub struct CollectionCreated {
    pub collection: Pubkey,
}
#[event]
pub struct BroMinted {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub price_lamports: u64,
    pub starting_balance: u64,
    pub bonus: bool,
}
#[event]
pub struct BroDeposited {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub loss_streak: u8,
    pub eligible_slot: u64,
}
#[event]
pub struct BroWithdrawn {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub loss_streak: u8,
}
#[event]
pub struct TmbDeposited {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}
#[event]
pub struct TmbWithdrawn {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}
#[event]
pub struct SpinRequested {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub odds_tier: u8,
    pub commit_slot: u64,
    pub loss_streak: u8,
    /// True when a loss streak inside this request can burn the Bro.
    pub at_stake: bool,
    /// Number of spins in this request (turbo > 1).
    pub count: u8,
    pub randomness_account: Pubkey,
}
#[event]
pub struct SpinSettled {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub odds_tier: u8,
    /// 0 loss, 1 win, 2 stale-cancel loss
    pub outcome: u8,
    pub wedge_index: u8,
    pub prize_id: [u8; 16],
    pub prize_kind: u8,
    pub prize_amount: u64,
    pub new_streak: u8,
    pub burned: bool,
    pub new_balance: u64,
    pub bonus_asset: Pubkey,
    /// 0-based position of this spin inside its request (always 0 for a normal spin).
    pub spin_index: u8,
    /// How many spins the request held.
    pub spin_count: u8,
}
#[event]
pub struct HoldingClaimed {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}
#[event]
pub struct Rescued {
    pub burned_asset: Pubkey,
    pub new_asset: Pubkey,
    pub rescuer: Pubkey,
    pub rescuer_asset: Pubkey,
    pub last_owner: Pubkey,
    pub fee: u64,
    pub burned_amount: u64,
    /// TMB sent to the treasury wallet (25% by default)
    pub treasury_amount: u64,
    /// TMB sent to the wallet that lost the Bro (25% by default)
    pub owner_amount: u64,
}
#[event]
pub struct TmbPriceSet {
    pub lamports_per_tmb: u64,
    pub by: Pubkey,
}
#[event]
pub struct TmbBought {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub lamports_paid: u64,
    pub new_balance: u64,
}
