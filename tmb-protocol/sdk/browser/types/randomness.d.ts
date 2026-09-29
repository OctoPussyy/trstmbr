import { Connection, PublicKey, Signer, TransactionInstruction } from "@solana/web3.js";
import { WalletLike } from "./types";
/** Everything the client needs from a randomness oracle for one spin. */
export interface RandomnessCommit {
    randomness: PublicKey;
    /** ixs placed BEFORE request_spin in the same transaction (create + commit). */
    commitIxs: TransactionInstruction[];
    /** extra signers for the commit transaction (e.g. the new randomness keypair). */
    signers: Signer[];
}
export interface RandomnessProvider {
    /** `fresh: true` forces a brand-new randomness account (never reuse one that may have a pending spin). */
    commit(connection: Connection, wallet: WalletLike, opts?: {
        fresh?: boolean;
    }): Promise<RandomnessCommit>;
    /** ixs for the oracle reveal. `payer` (default: the wallet) pays for / signs the reveal tx. */
    reveal(connection: Connection, wallet: WalletLike, randomness: PublicKey, payer?: PublicKey): Promise<TransactionInstruction[]>;
}
/** Where a wallet's reusable randomness keypair is kept between spins (e.g. localStorage, per wallet). */
export interface RandomnessPersist {
    load(): number[] | null;
    save(secretKey: number[]): void;
    clear(): void;
}
/**
 * Switchboard On-Demand. Flow per spin:
 *   tx A (1 wallet prompt): [create randomness, commit, request_spin]
 *   tx B: [reveal (oracle gateway), settle_spin]
 */
export declare class SwitchboardRandomness implements RandomnessProvider {
    private readonly opts;
    private cache?;
    private revealHandles;
    constructor(opts?: {
        queue?: PublicKey;
        persist?: RandomnessPersist;
    });
    private load;
    commit(connection: Connection, wallet: WalletLike, opts?: {
        fresh?: boolean;
    }): Promise<RandomnessCommit>;
    reveal(connection: Connection, wallet: WalletLike, randomness: PublicKey, payer?: PublicKey): Promise<TransactionInstruction[]>;
}
