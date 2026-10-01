//! Pure game logic (no account access) so it can be unit-tested and fuzzed on the host.
use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::TmbError;
use crate::state::*;

/// Odds tier function. MUST stay identical to the website / SDK `computeOddsTier`.
/// (Branches are kept 1:1 with the spec table on purpose, hence the clippy allow.)
#[allow(clippy::if_same_then_else)]
pub fn compute_odds_tier(t: &Thresholds, tmb: u64, stock_count: usize, stock_value: u64) -> u8 {
    let many = stock_count >= t.stock_count_low as usize;
    if tmb >= t.high_tmb {
        TIER_HIGH
    } else if many && tmb >= t.stock_tmb_high {
        TIER_HIGH
    } else if tmb >= t.medium_tmb {
        TIER_MEDIUM
    } else if tmb >= t.low_tmb {
        TIER_LOW
    } else if many && stock_value >= t.stock_value_low {
        TIER_LOW
    } else {
        TIER_NEAR_IMPOSSIBLE
    }
}

/// Odds tier for `balance` plus the Bro's current holdings (used per spin inside a turbo request).
pub fn odds_tier_with_balance(bro: &BroRecord, t: &Thresholds, balance: u64) -> u8 {
    let value = bro
        .holdings
        .iter()
        .fold(0u64, |a, h| a.saturating_add(h.usd_value_snapshot));
    compute_odds_tier(t, balance, bro.holdings.len(), value)
}

pub fn odds_tier_for(bro: &BroRecord, t: &Thresholds) -> u8 {
    let value = bro
        .holdings
        .iter()
        .fold(0u64, |a, h| a.saturating_add(h.usd_value_snapshot));
    compute_odds_tier(t, bro.tmb_balance, bro.holdings.len(), value)
}

pub fn rekt_index(entries: &[Prize]) -> Option<usize> {
    entries.iter().position(|p| p.kind == PrizeKind::None)
}

pub fn validate_prizes(entries: &[Prize]) -> Result<()> {
    require!(
        !entries.is_empty() && entries.len() <= MAX_PRIZES,
        TmbError::PrizeTableInvalid
    );
    let rekt = entries.iter().filter(|p| p.kind == PrizeKind::None).count();
    require!(rekt == 1, TmbError::MissingRektWedge);
    for p in entries {
        match p.kind {
            PrizeKind::None => {}
            PrizeKind::Tmb => {
                require!(p.weight > 0 && p.amount > 0, TmbError::PrizeTableInvalid)
            }
            PrizeKind::Token => require!(
                p.weight > 0 && p.amount > 0 && p.mint != Pubkey::default(),
                TmbError::PrizeTableInvalid
            ),
            PrizeKind::BonusBro => require!(p.weight > 0, TmbError::PrizeTableInvalid),
        }
    }
    Ok(())
}

/// Splits 32 revealed bytes into the two draws. `r1` in 0..10000 (win roll), `r2` raw (prize roll).
pub fn roll(value: &[u8; 32]) -> (u16, u64) {
    let r1 = u16::from_le_bytes([value[0], value[1]]) % (BPS_DENOM as u16);
    let mut b = [0u8; 8];
    b.copy_from_slice(&value[2..10]);
    (r1, u64::from_le_bytes(b))
}

/// Per-spin randomness of a turbo request: sha256(value || index). A single spin (count == 1) uses the
/// revealed value itself, exactly as before, so normal spins are unchanged.
pub fn derive_seed(value: &[u8; 32], index: u8, count: u8) -> [u8; 32] {
    if count <= 1 {
        return *value;
    }
    anchor_lang::solana_program::hash::hashv(&[value.as_ref(), &[index]]).to_bytes()
}

pub fn is_win(r1: u16, odds_bps: u16) -> bool {
    r1 < odds_bps
}

/// Weighted pick among eligible entries. Returns the wedge index.
pub fn pick_weighted(entries: &[Prize], eligible: &[bool], r2: u64) -> Option<usize> {
    let mut total: u64 = 0;
    for (i, p) in entries.iter().enumerate() {
        if eligible.get(i).copied().unwrap_or(false) && p.kind != PrizeKind::None {
            total += p.weight as u64;
        }
    }
    if total == 0 {
        return None;
    }
    let mut pick = r2 % total;
    for (i, p) in entries.iter().enumerate() {
        if eligible.get(i).copied().unwrap_or(false) && p.kind != PrizeKind::None {
            let w = p.weight as u64;
            if pick < w {
                return Some(i);
            }
            pick -= w;
        }
    }
    None
}

pub fn bps_of(amount: u64, bps: u16) -> Option<u64> {
    ((amount as u128) * (bps as u128) / (BPS_DENOM as u128))
        .try_into()
        .ok()
}

/// TMB payout guard: payout <= max_payout_bps of pool AND pool - payout >= min_reserve.
pub fn tmb_payout_allowed(pool: u64, payout: u64, max_payout_bps: u16, min_reserve: u64) -> bool {
    match (bps_of(pool, max_payout_bps), pool.checked_sub(payout)) {
        (Some(cap), Some(rest)) => payout <= cap && rest >= min_reserve,
        _ => false,
    }
}

/// Token prize guard: payout <= max_payout_bps of that mint's vault balance.
pub fn token_payout_allowed(vault_balance: u64, payout: u64, max_payout_bps: u16) -> bool {
    match bps_of(vault_balance, max_payout_bps) {
        Some(cap) => payout <= cap && payout <= vault_balance,
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn thresholds() -> Thresholds {
        Thresholds {
            low_tmb: 50,
            medium_tmb: 200,
            high_tmb: 500,
            stock_count_low: 3,
            stock_value_low: 50,
            stock_tmb_high: 200,
        }
    }

    fn prize(kind: PrizeKind, weight: u32) -> Prize {
        Prize {
            id: [0; 16],
            kind,
            label: [0; 24],
            amount: 1,
            mint: Pubkey::new_unique(),
            weight,
            usd_value: 0,
        }
    }

    #[test]
    fn odds_tiers_match_spec() {
        let t = thresholds();
        assert_eq!(compute_odds_tier(&t, 500, 0, 0), TIER_HIGH);
        assert_eq!(compute_odds_tier(&t, 200, 3, 0), TIER_HIGH);
        assert_eq!(compute_odds_tier(&t, 200, 2, 0), TIER_MEDIUM);
        assert_eq!(compute_odds_tier(&t, 199, 3, 0), TIER_LOW);
        assert_eq!(compute_odds_tier(&t, 50, 0, 0), TIER_LOW);
        assert_eq!(compute_odds_tier(&t, 0, 3, 50), TIER_LOW);
        assert_eq!(compute_odds_tier(&t, 0, 3, 49), TIER_NEAR_IMPOSSIBLE);
        assert_eq!(compute_odds_tier(&t, 49, 2, 999), TIER_NEAR_IMPOSSIBLE);
    }

    #[test]
    fn prize_table_validation() {
        assert!(validate_prizes(&[]).is_err());
        assert!(validate_prizes(&[prize(PrizeKind::Tmb, 1)]).is_err()); // no REKT
        assert!(validate_prizes(&[prize(PrizeKind::None, 0), prize(PrizeKind::None, 0)]).is_err());
        assert!(validate_prizes(&[prize(PrizeKind::None, 0), prize(PrizeKind::Tmb, 0)]).is_err());
        assert!(validate_prizes(&[prize(PrizeKind::None, 0), prize(PrizeKind::Tmb, 3)]).is_ok());
        let many: Vec<Prize> = std::iter::once(prize(PrizeKind::None, 0))
            .chain((0..16).map(|_| prize(PrizeKind::Tmb, 1)))
            .collect();
        assert!(validate_prizes(&many).is_err()); // 17 entries
    }

    #[test]
    fn payout_guard() {
        // pool 1000, 2% cap = 20
        assert!(tmb_payout_allowed(1000, 20, 200, 0));
        assert!(!tmb_payout_allowed(1000, 21, 200, 0));
        assert!(!tmb_payout_allowed(1000, 20, 200, 990)); // reserve breach
        assert!(!tmb_payout_allowed(10, 20, 10_000, 0)); // payout > pool
        assert!(token_payout_allowed(1000, 20, 200));
        assert!(!token_payout_allowed(1000, 21, 200));
    }

    #[test]
    fn derive_seed_single_is_identity_and_turbo_is_distinct() {
        let v = [7u8; 32];
        assert_eq!(derive_seed(&v, 0, 1), v);
        let seeds: Vec<[u8; 32]> = (0..5).map(|i| derive_seed(&v, i, 5)).collect();
        for i in 0..5 {
            for j in (i + 1)..5 {
                assert_ne!(seeds[i], seeds[j]);
            }
        }
    }

    proptest! {
        #[test]
        fn roll_is_in_range(bytes in proptest::array::uniform32(any::<u8>())) {
            let (r1, _) = roll(&bytes);
            prop_assert!(r1 < 10_000);
        }

        #[test]
        fn win_rate_tracks_odds(odds in 0u16..=10_000u16, r1 in 0u16..10_000u16) {
            prop_assert_eq!(is_win(r1, odds), (r1 as u32) < odds as u32);
        }

        #[test]
        fn pick_never_returns_ineligible_or_rekt(
            weights in proptest::collection::vec(1u32..1000, 1..15),
            mask in proptest::collection::vec(any::<bool>(), 1..15),
            r2 in any::<u64>(),
        ) {
            let mut entries: Vec<Prize> =
                weights.iter().map(|w| prize(PrizeKind::Tmb, *w)).collect();
            entries.push(prize(PrizeKind::None, 0));
            let mut eligible: Vec<bool> = mask.clone();
            eligible.resize(entries.len(), false);
            let last = entries.len() - 1;
            eligible[last] = true; // REKT flagged eligible must still never be picked
            match pick_weighted(&entries, &eligible, r2) {
                Some(i) => {
                    prop_assert!(eligible[i]);
                    prop_assert!(entries[i].kind != PrizeKind::None);
                }
                None => {
                    let any_eligible = (0..last).any(|i| eligible[i]);
                    prop_assert!(!any_eligible);
                }
            }
        }

        #[test]
        fn pick_distribution_is_proportional(
            w1 in 1u32..100, w2 in 1u32..100,
        ) {
            let entries = vec![prize(PrizeKind::Tmb, w1), prize(PrizeKind::Tmb, w2), prize(PrizeKind::None, 0)];
            let eligible = vec![true, true, false];
            let total = (w1 + w2) as u64;
            let (mut c1, mut c2) = (0u64, 0u64);
            for r in 0..total {
                match pick_weighted(&entries, &eligible, r) { Some(0) => c1 += 1, Some(1) => c2 += 1, _ => prop_assert!(false) }
            }
            prop_assert_eq!(c1, w1 as u64);
            prop_assert_eq!(c2, w2 as u64);
        }

        #[test]
        fn payout_guard_never_overdraws(
            pool in 0u64..u64::MAX/2, payout in 0u64..u64::MAX/2, bps in 0u16..=10_000, reserve in 0u64..u64::MAX/2,
        ) {
            if tmb_payout_allowed(pool, payout, bps, reserve) {
                prop_assert!(payout <= pool);
                prop_assert!(pool - payout >= reserve);
            }
        }
    }
}
