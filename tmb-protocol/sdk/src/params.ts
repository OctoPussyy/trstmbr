import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { ConfigArgs } from "./index";
import { USD_DECIMALS } from "./prizes";

/** `params` block of config/<cluster>.json. TMB amounts are in UI units. */
export interface ParamsJson {
  tmb_decimals: number;
  burn_at_loss_streak: number;
  spin_amounts: number[];
  odds_bps: number[];
  thresholds: {
    low_tmb: number;
    medium_tmb: number;
    high_tmb: number;
    stock_count_low: number;
    /** whole USD */
    stock_value_low: number;
    stock_tmb_high: number;
  };
  rescue_burn_bps: number;
  rescue_fee_options: number[];
  max_payout_bps: number;
  min_reserve: number;
  mint_price_lamports: number;
  mint_pool_share_bps: number;
  mint_starting_balance: number;
  max_supply: number;
  transfer_cooldown_slots: number;
  stale_slots: number;
  team_wallet: string;
  reward_wallet: string;
  pauser: string;
  collection_name: string;
  collection_uri: string;
  bonus_uri: string;
  /** Public folder holding 1..5.png + metadata/1..5.json (see scripts/make-metadata.ts) */
  assets_base_url?: string;
  /** SOL price (lamports) of ONE whole TMB for `buy_tmb`; devnet test price = 1000 (0.0001 SOL per 100 TMB) */
  tmb_price_lamports?: number;
}

const scale = (ui: number, decimals: number) => new BN(Math.round(ui * 10 ** decimals).toString());

export function paramsToConfigArgs(
  p: ParamsJson,
  keys: { rewardWallet: PublicKey; pauser: PublicKey; treasury: PublicKey; teamWallet: PublicKey },
): ConfigArgs {
  const d = p.tmb_decimals;
  const arr4 = <T>(a: T[], fill: T): T[] => [...a, fill, fill, fill, fill].slice(0, 4);
  return {
    rewardWallet: keys.rewardWallet,
    pauser: keys.pauser,
    treasury: keys.treasury,
    teamWallet: keys.teamWallet,
    burnAtLossStreak: p.burn_at_loss_streak,
    spinAmounts: arr4(p.spin_amounts.map((a) => scale(a, d)), new BN(0)),
    oddsBps: arr4(p.odds_bps, 0),
    thresholds: {
      lowTmb: scale(p.thresholds.low_tmb, d),
      mediumTmb: scale(p.thresholds.medium_tmb, d),
      highTmb: scale(p.thresholds.high_tmb, d),
      stockCountLow: p.thresholds.stock_count_low,
      stockValueLow: scale(p.thresholds.stock_value_low, USD_DECIMALS),
      stockTmbHigh: scale(p.thresholds.stock_tmb_high, d),
    },
    rescueBurnBps: p.rescue_burn_bps,
    rescueFeeOptions: arr4(p.rescue_fee_options.map((a) => scale(a, d)), new BN(0)),
    maxPayoutBps: p.max_payout_bps,
    minReserve: scale(p.min_reserve, d),
    mintPriceLamports: new BN(p.mint_price_lamports),
    mintPoolShareBps: p.mint_pool_share_bps,
    mintStartingBalance: scale(p.mint_starting_balance, d),
    maxSupply: p.max_supply,
    transferCooldownSlots: new BN(p.transfer_cooldown_slots),
    staleSlots: new BN(p.stale_slots),
    bonusUri: p.bonus_uri,
  } as ConfigArgs;
}
