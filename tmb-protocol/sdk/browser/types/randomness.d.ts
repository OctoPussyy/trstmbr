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
    commit(connection: Connection, wallet: WalletLike): Promise<RandomnessCommit>;
    /** ixs placed BEFORE settle_spin in the settle transaction (oracle reveal). */
    reveal(connection: Connection, wallet: WalletLike, randomness: PublicKey): Promise<TransactionInstruction[]>;
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
    });
    private load;
    commit(connection: Connection, wallet: WalletLike): Promise<RandomnessCommit>;
    reveal(connection: Connection, wallet: WalletLike, randomness: PublicKey): Promise<TransactionInstruction[]>;
}
