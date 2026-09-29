import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { RandomnessCommit, RandomnessProvider } from "./randomness";
import { WalletLike } from "./types";
export declare const MOCK_RANDOMNESS_LEN = 408;
/**
 * TEST / LOCALNET ONLY. Talks to `tests/mock_switchboard` (loaded at the Switchboard program id) so
 * the real tmb_game binary can be driven with a chosen random value. `nextValue` is what the "oracle"
 * reveals for the next spin.
 */
export declare class MockSwitchboardRandomness implements RandomnessProvider {
    private readonly programId;
    nextValue: Uint8Array;
    /** override the seed slot to simulate a stale commit (test only) */
    forceSeedSlot?: bigint;
    constructor(programId?: PublicKey);
    /** Random bytes that produce the requested r1 (win roll, 0..9999) and r2 (prize roll). */
    static valueFor(r1: number, r2?: bigint): Uint8Array;
    commit(connection: Connection, wallet: WalletLike): Promise<RandomnessCommit>;
    reveal(_c: Connection, _w: WalletLike, randomness: PublicKey): Promise<TransactionInstruction[]>;
}
