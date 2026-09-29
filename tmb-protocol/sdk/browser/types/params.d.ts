import { PublicKey } from "@solana/web3.js";
import type { ConfigArgs } from "./index";
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
export declare function paramsToConfigArgs(p: ParamsJson, keys: {
    rewardWallet: PublicKey;
    pauser: PublicKey;
    treasury: PublicKey;
    teamWallet: PublicKey;
}): ConfigArgs;
