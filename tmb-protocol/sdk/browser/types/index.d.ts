import "./polyfill";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import type { TmbGame } from "./idl/tmb_game";
import idlJson from "./idl/tmb_game.json";
import { TmbPdas } from "./pdas";
import { RandomnessProvider } from "./randomness";
import { BroRecord, BroView, Cluster, Config, NetworkConfigJson, Prize, Rescued, SpinSettled, WalletLike } from "./types";
export * from "./types";
export * from "./pdas";
export * from "./odds";
export * from "./prizes";
export * from "./randomness";
export * from "./mock";
export type { TmbGame } from "./idl/tmb_game";
export { idlJson as tmbIdl };
export type ConfigArgs = Parameters<Program<TmbGame>["methods"]["initialize"]>[0];
export type UpdateConfigArgs = Parameters<Program<TmbGame>["methods"]["updateConfig"]>[0];
export interface TmbClientOptions {
    randomness?: RandomnessProvider;
    commitment?: "processed" | "confirmed" | "finalized";
}
export interface SpinOptions {
    /** Pays for + signs the reveal/settle tx instead of the wallet (a session key or crank). */
    settler?: Keypair;
    /** Called after the request tx confirms and before waiting for the oracle. */
    onRequested?: (signature: string) => void;
    /** Compute unit limit for the settle tx. */
    settleComputeUnits?: number;
    /**
     * With `settler`: if the settler's SOL balance is below `settlerMinLamports` (default 0.01 SOL), the
     * REQUEST tx (the only wallet prompt) also tops it up by `settlerTopUpLamports` (default 0.02 SOL).
     */
    settlerMinLamports?: number;
    settlerTopUpLamports?: number;
}
export declare class TmbClient {
    readonly connection: Connection;
    readonly wallet: WalletLike;
    readonly programId: PublicKey;
    readonly cluster: Cluster;
    readonly provider: AnchorProvider;
    readonly program: Program<TmbGame>;
    readonly pdas: TmbPdas;
    randomness: RandomnessProvider;
    private tokenProgramCache;
    constructor(connection: Connection, wallet: WalletLike, programId: PublicKey, cluster: Cluster, opts?: TmbClientOptions);
    get me(): PublicKey;
    fetchConfig(): Promise<Config>;
    fetchPrizes(): Promise<Prize[]>;
    fetchBro(asset: PublicKey, owner?: PublicKey): Promise<BroRecord | null>;
    fetchGraveyard(): Promise<import("@coral-xyz/anchor").ProgramAccount<{
        asset: PublicKey;
        lastOwner: PublicKey;
        burnedAt: BN;
        metadataUri: string;
        name: string;
        bump: number;
    }>[]>;
    /** Vault TMB minus every Bro balance: what prizes/withdrawals may draw on. */
    fetchPool(): Promise<BN>;
    /** Wallet-held + escrowed Bros for `owner`, joined with their BroRecords. */
    fetchBrosForOwner(owner?: PublicKey): Promise<BroView[]>;
    private umi;
    tokenProgramFor(mint: PublicKey): Promise<PublicKey>;
    mintBro(name: string, uri: string): Promise<{
        signature: string;
        asset: PublicKey;
    }>;
    depositBro(asset: PublicKey): Promise<string>;
    withdrawBro(asset: PublicKey): Promise<string>;
    private tmbAccounts;
    /** wallet -> Bro balance (the website's "top up"). `amount` in TMB base units. */
    depositTmb(asset: PublicKey, amount: BN | number | bigint): Promise<string>;
    /** SOL price of ONE whole TMB in lamports, or null if the admin hasn't set it yet. */
    fetchTmbPrice(): Promise<BN | null>;
    /** Lamports needed to buy `amount` TMB base units (rounded UP, same as the program). */
    static quoteTmb(lamportsPerTmb: BN, amount: BN | number | bigint, decimals?: number): BN;
    /** Buy TMB with SOL, credited straight to the Bro's balance (the website's "+100 TMB"). */
    buyTmb(asset: PublicKey, amount: BN | number | bigint): Promise<string>;
    /** Admin: SOL price (lamports) of one whole TMB. */
    setTmbPrice(lamportsPerTmb: BN | number | bigint): Promise<string>;
    withdrawTmb(asset: PublicKey, amount: BN | number | bigint): Promise<string>;
    claimHolding(asset: PublicKey, index: number): Promise<string>;
    /**
     * Full spin: commit + request (one wallet prompt), wait for the oracle reveal, then settle.
     * Resolves with the decoded `SpinSettled` event. `amount` is in TMB base units.
     */
    spin(asset: PublicKey, amount: BN | number | bigint, opts?: SpinOptions): Promise<SpinSettled>;
    /** Step 1 of `spin`. Exposed so UIs can animate between request and settle. */
    requestSpin(asset: PublicKey, amount: BN | number | bigint, opts?: {
        fundSettler?: {
            to: PublicKey;
            lamports: number;
        };
    }): Promise<{
        requestSig: string;
        spinRequest: PublicKey;
        randomness: PublicKey;
    }>;
    /** Step 2 of `spin` (permissionless: any wallet may crank it). */
    settleSpin(asset: PublicKey, spinRequest: PublicKey, randomness: PublicKey, opts?: SpinOptions & {
        owner?: PublicKey;
    }): Promise<SpinSettled>;
    settleIx(p: {
        settler: PublicKey;
        asset: PublicKey;
        owner: PublicKey;
        randomness: PublicKey;
        bonusAsset: PublicKey | null;
        cfg: Config;
    }): Promise<TransactionInstruction>;
    private spinRequestFor;
    /** Vault ATAs of every distinct Token prize mint (the program validates each by re-deriving it). */
    private prizeVaultAccounts;
    /** Anyone may call this once `staleSlots` have passed; it counts as a loss. */
    cancelStaleSpin(asset: PublicKey, owner: PublicKey): Promise<SpinSettled>;
    /** Rescue `burnedAsset` using the Bro `rescuerAsset` (must be staked with enough balance). */
    rescue(rescuerAsset: PublicKey, burnedAsset: PublicKey, fee: BN | number | bigint): Promise<{
        signature: string;
        newAsset: PublicKey;
    }>;
    /** Decodes the SpinSettled event out of a confirmed transaction. */
    readSettled(signature: string): Promise<SpinSettled>;
    onSpinSettled(cb: (e: SpinSettled, slot: number, signature: string) => void): number;
    onRescued(cb: (e: Rescued, slot: number, signature: string) => void): number;
    removeListener(id: number): Promise<void>;
    initialize(tmbMint: PublicKey, args: ConfigArgs): Promise<string>;
    createCollection(name: string, uri: string): Promise<{
        signature: string;
        collection: PublicKey;
    }>;
    updateConfig(args: Partial<UpdateConfigArgs>): Promise<string>;
    setRoles(roles: {
        rewardWallet?: PublicKey;
        pauser?: PublicKey;
    }): Promise<string>;
    proposeAuthority(next: PublicKey): Promise<string>;
    acceptAuthority(): Promise<string>;
    setPaused(paused: boolean): Promise<string>;
    /**
     * Writes the whole wheel. Tables that don't fit in one transaction are sent in chunks of
     * `chunkSize`; the program validates the complete table on the last chunk and blocks spins until
     * then (fail-closed). Pause the game first when replacing a live table with >1 chunk.
     */
    setPrizes(entries: Prize[], chunkSize?: number): Promise<string[]>;
    /** reward_wallet/authority moves `amount` of `mint` from its own ATA into the vault. */
    fundVault(mint: PublicKey, amount: BN | number | bigint): Promise<string>;
    withdrawVault(mint: PublicKey, amount: BN | number | bigint, destination?: PublicKey): Promise<string>;
    /** JSON in the exact shape of the admin panel "Networks" form / `network_config` table. */
    exportAddresses(rpcUrl: string): Promise<NetworkConfigJson>;
}
export * from "./params";
export * from "./bros";
