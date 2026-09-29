import BN from "bn.js";
import { OddsTier, Thresholds } from "./types";

type Numish = BN | number | bigint;
const big = (v: Numish): bigint => (BN.isBN(v) ? BigInt((v as BN).toString()) : BigInt(v as number | bigint));

/**
 * Odds tier. MUST stay identical to programs/tmb_game/src/logic.rs::compute_odds_tier:
 *   tmb >= high_tmb                                          -> high
 *   stock_count >= stock_count_low && tmb >= stock_tmb_high  -> high
 *   tmb >= medium_tmb                                        -> medium
 *   tmb >= low_tmb                                           -> low
 *   stock_count >= stock_count_low && stock_value >= stock_value_low -> low
 *   else                                                     -> near_impossible
 */
export function computeOddsTier(
  t: Pick<Thresholds, "lowTmb" | "mediumTmb" | "highTmb" | "stockCountLow" | "stockValueLow" | "stockTmbHigh">,
  tmb: Numish,
  stockCount: number,
  stockValue: Numish,
): OddsTier {
  const bal = big(tmb);
  const val = big(stockValue);
  const many = stockCount >= t.stockCountLow;
  if (bal >= big(t.highTmb)) return OddsTier.High;
  if (many && bal >= big(t.stockTmbHigh)) return OddsTier.High;
  if (bal >= big(t.mediumTmb)) return OddsTier.Medium;
  if (bal >= big(t.lowTmb)) return OddsTier.Low;
  if (many && val >= big(t.stockValueLow)) return OddsTier.Low;
  return OddsTier.NearImpossible;
}
