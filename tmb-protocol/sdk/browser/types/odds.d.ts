import BN from "bn.js";
import { OddsTier, Thresholds } from "./types";
type Numish = BN | number | bigint;
/**
 * Odds tier. MUST stay identical to programs/tmb_game/src/logic.rs::compute_odds_tier:
 *   tmb >= high_tmb                                          -> high
 *   stock_count >= stock_count_low && tmb >= stock_tmb_high  -> high
 *   tmb >= medium_tmb                                        -> medium
 *   tmb >= low_tmb                                           -> low
 *   stock_count >= stock_count_low && stock_value >= stock_value_low -> low
 *   else                                                     -> near_impossible
 */
export declare function computeOddsTier(t: Pick<Thresholds, "lowTmb" | "mediumTmb" | "highTmb" | "stockCountLow" | "stockValueLow" | "stockTmbHigh">, tmb: Numish, stockCount: number, stockValue: Numish): OddsTier;
export {};
