import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { Prize } from "./types";

export function fixedBytes(s: string, len: number): number[] {
  const b = Buffer.alloc(len);
  const src = Buffer.from(s, "utf8");
  if (src.length > len) throw new Error(`"${s}" is longer than ${len} bytes`);
  src.copy(b);
  return [...b];
}

export function decodeFixed(bytes: number[] | Uint8Array): string {
  const b = Buffer.from(bytes);
  const end = b.indexOf(0);
  return b.subarray(0, end === -1 ? b.length : end).toString("utf8");
}

/** Row of config/prizes.json. Amounts are in UI units; `decimals` converts to base units. */
export interface PrizeJson {
  id: string;
  kind: "None" | "Tmb" | "Token" | "BonusBro";
  label: string;
  amount: number;
  weight: number;
  /** Token prizes: mint (filled by seed-devnet.ts on devnet, real mints on mainnet) */
  mint?: string;
  /** Token prizes: token decimals */
  token_decimals?: number;
  /** Token prizes: USD value snapshot credited to holdings (whole dollars) */
  usd_value?: number;
}

export const USD_DECIMALS = 6; // stock_value thresholds are expressed in micro-USD

const scale = (ui: number, decimals: number) => new BN(Math.round(ui * 10 ** decimals).toString());

export function prizeFromJson(p: PrizeJson, tmbDecimals: number): Prize {
  const kind =
    p.kind === "None" ? { none: {} } : p.kind === "Tmb" ? { tmb: {} } : p.kind === "Token" ? { token: {} } : { bonusBro: {} };
  let amount = new BN(0);
  if (p.kind === "Tmb") amount = scale(p.amount, tmbDecimals);
  else if (p.kind === "Token") amount = scale(p.amount, p.token_decimals ?? 6);
  else if (p.kind === "BonusBro") amount = new BN(p.amount);
  return {
    id: fixedBytes(p.id, 16),
    kind,
    label: fixedBytes(p.label, 24),
    amount,
    mint: p.mint ? new PublicKey(p.mint) : PublicKey.default,
    weight: p.weight,
    usdValue: p.kind === "Token" ? scale(p.usd_value ?? 0, USD_DECIMALS) : new BN(0),
  };
}

export function prizeKindName(k: Prize["kind"]): "none" | "tmb" | "token" | "bonusBro" {
  return Object.keys(k)[0] as "none" | "tmb" | "token" | "bonusBro";
}
