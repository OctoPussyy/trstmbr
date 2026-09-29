use anchor_lang::prelude::*;

// --- program id (selected per cluster by cargo feature) -------------------------------------
// Run `scripts/sync-keys.sh` to (re)generate the keypairs and rewrite these two lines.
#[cfg(all(feature = "devnet", not(feature = "mainnet")))]
declare_id!("Axew8h91qZGHhxWBeapvx8Fd7EXVk82xYQCY6kxRcBNv");
#[cfg(feature = "mainnet")]
declare_id!("AuWBVGU95FjrUpEzEQkEWEPUg9fpcQn5ZReVypp2kyva");

// --- Switchboard On-Demand program (pinned per cluster) -----------------------------------
#[cfg(all(feature = "devnet", not(feature = "mainnet")))]
pub const SWITCHBOARD_PROGRAM_ID: Pubkey = pubkey!("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");
#[cfg(feature = "mainnet")]
pub const SWITCHBOARD_PROGRAM_ID: Pubkey = pubkey!("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");

// --- PDA seeds ------------------------------------------------------------------------------
pub const CONFIG_SEED: &[u8] = b"config";
pub const PRIZES_SEED: &[u8] = b"prizes";
pub const VAULT_SEED: &[u8] = b"vault";
pub const ESCROW_AUTH_SEED: &[u8] = b"escrow_auth";
pub const BRO_SEED: &[u8] = b"bro";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const SPIN_SEED: &[u8] = b"spin";
pub const GRAVEYARD_SEED: &[u8] = b"burned";
pub const PRICE_SEED: &[u8] = b"price";

// --- limits ---------------------------------------------------------------------------------
pub const MAX_PRIZES: usize = 16;
pub const MAX_HOLDINGS: usize = 8;
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_URI_LEN: usize = 200;
pub const BPS_DENOM: u64 = 10_000;
/// Share of every rescue fee sent (as TMB) to the treasury wallet. The rest after the burn share
/// (`Config::rescue_burn_bps`, default 50%) is credited to the revived Bro's owner. Default split: 50/25/25.
pub const RESCUE_TREASURY_BPS: u16 = 2_500;

// --- odds tiers -----------------------------------------------------------------------------
pub const TIER_NEAR_IMPOSSIBLE: u8 = 0;
pub const TIER_LOW: u8 = 1;
pub const TIER_MEDIUM: u8 = 2;
pub const TIER_HIGH: u8 = 3;

// --- Switchboard randomness account layout (8-byte discriminator + repr(C) struct) ----------
pub const SB_RANDOMNESS_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
pub const SB_OFF_AUTHORITY: usize = 8;
pub const SB_OFF_SEED_SLOT: usize = 104;
pub const SB_OFF_REVEAL_SLOT: usize = 144;
pub const SB_OFF_VALUE: usize = 152;
pub const SB_MIN_LEN: usize = SB_OFF_VALUE + 32;

#[cfg(test)]
mod cluster_tests {
    use super::*;

    #[cfg(all(feature = "devnet", not(feature = "mainnet")))]
    #[test]
    fn devnet_build_pins_devnet_switchboard() {
        assert_eq!(
            SWITCHBOARD_PROGRAM_ID.to_string(),
            "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"
        );
    }

    #[cfg(feature = "mainnet")]
    #[test]
    fn mainnet_build_pins_mainnet_switchboard() {
        assert_eq!(
            SWITCHBOARD_PROGRAM_ID.to_string(),
            "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"
        );
        assert_ne!(
            ID.to_string(),
            "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"
        );
    }
}
