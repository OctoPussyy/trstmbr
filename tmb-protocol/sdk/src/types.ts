import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export type Cluster = "localnet" | "devnet" | "mainnet";

export enum OddsTier {
  NearImpossible = 0,
  Low = 1,
  Medium = 2,
  High = 3,
}
export const ODDS_LABELS = ["near_impossible", "low", "medium", "high"] as const;

export interface Thresholds {
  lowTmb: BN;
  mediumTmb: BN;
  highTmb: BN;
  stockCountLow: number;
  stockValueLow: BN;
  stockTmbHigh: BN;
}

export type PrizeKindName = "none" | "tmb" | "token" | "bonusBro";

export interface Prize {
  id: number[];
  kind: { none: {} } | { tmb: {} } | { token: {} } | { bonusBro: {} };
  label: number[];
  amount: BN;
  mint: PublicKey;
  weight: number;
  usdValue: BN;
}

export interface Holding {
  mint: PublicKey;
  amount: BN;
  usdValueSnapshot: BN;
}

export interface BroRecord {
  asset: PublicKey;
  owner: PublicKey;
  lossStreak: number;
  tmbBalance: BN;
  holdings: Holding[];
  status: { active: {} } | { burned: {} };
  inEscrow: boolean;
  pendingSpin: PublicKey | null;
  totalSpins: number;
  eligibleSlot: BN;
  bump: number;
}

export interface Config {
  authority: PublicKey;
  pendingAuthority: PublicKey;
  rewardWallet: PublicKey;
  pauser: PublicKey;
  tmbMint: PublicKey;
  collection: PublicKey;
  treasury: PublicKey;
  teamWallet: PublicKey;
  paused: boolean;
  burnAtLossStreak: number;
  spinAmounts: BN[];
  oddsBps: number[];
  thresholds: Thresholds;
  rescueBurnBps: number;
  rescueFeeOptions: BN[];
  maxPayoutBps: number;
  minReserve: BN;
  mintPriceLamports: BN;
  mintPoolShareBps: number;
  mintStartingBalance: BN;
  maxSupply: number;
  minted: number;
  transferCooldownSlots: BN;
  staleSlots: BN;
  totalUserTmb: BN;
  bonusUri: string;
}

/** Decoded `SpinSettled` event. `outcome`: 0 loss, 1 win, 2 stale-cancel loss. */
export interface SpinSettled {
  asset: PublicKey;
  owner: PublicKey;
  amount: BN;
  oddsTier: number;
  outcome: number;
  wedgeIndex: number;
  prizeId: number[];
  prizeKind: number;
  prizeAmount: BN;
  newStreak: number;
  burned: boolean;
  newBalance: BN;
  bonusAsset: PublicKey;
  /** 0-based position inside its request (0 for a normal spin) */
  spinIndex: number;
  /** how many spins the request held (1 normal, up to 5 turbo) */
  spinCount: number;
}

export interface Rescued {
  burnedAsset: PublicKey;
  newAsset: PublicKey;
  rescuer: PublicKey;
  rescuerAsset: PublicKey;
  lastOwner: PublicKey;
  fee: BN;
  burnedAmount: BN;
  /** TMB sent to the treasury wallet (25% by default) */
  treasuryAmount: BN;
  /** TMB sent to the wallet that lost the Bro (25% by default) */
  ownerAmount: BN;
}

/** Where a Bro currently is, from the player's point of view. */
export interface BroView {
  asset: PublicKey;
  name: string;
  uri: string;
  location: "wallet" | "escrow";
  /** BroRecord for (asset, owner) if one exists (a wallet-held Bro may not have one yet). */
  record: BroRecord | null;
  oddsTier: OddsTier;
}

/** Shape of the network_config row / admin panel "Networks" form. */
export interface NetworkConfigJson {
  cluster: Cluster;
  rpc_url: string;
  game_program_id: string;
  tmb_mint: string;
  collection_address: string;
  reward_vault: string;
  treasury_wallet: string;
  admin_authority: string;
}

export interface WalletLike {
  publicKey: PublicKey;
  signTransaction<T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]): Promise<T[]>;
}
