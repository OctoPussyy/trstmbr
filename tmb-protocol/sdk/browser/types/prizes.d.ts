import { Prize } from "./types";
export declare function fixedBytes(s: string, len: number): number[];
export declare function decodeFixed(bytes: number[] | Uint8Array): string;
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
export declare const USD_DECIMALS = 6;
export declare function prizeFromJson(p: PrizeJson, tmbDecimals: number): Prize;
export declare function prizeKindName(k: Prize["kind"]): "none" | "tmb" | "token" | "bonusBro";
