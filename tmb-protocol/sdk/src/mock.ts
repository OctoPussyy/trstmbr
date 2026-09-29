import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { RandomnessCommit, RandomnessProvider } from "./randomness";
import { SWITCHBOARD_PROGRAM_IDS } from "./pdas";
import { WalletLike } from "./types";

export const MOCK_RANDOMNESS_LEN = 408;

/**
 * TEST / LOCALNET ONLY. Talks to `tests/mock_switchboard` (loaded at the Switchboard program id) so
 * the real tmb_game binary can be driven with a chosen random value. `nextValue` is what the "oracle"
 * reveals for the next spin.
 */
export class MockSwitchboardRandomness implements RandomnessProvider {
  nextValue: Uint8Array = new Uint8Array(32).fill(0xff);
  /** override the seed slot to simulate a stale commit (test only) */
  forceSeedSlot?: bigint;
  constructor(private readonly programId: PublicKey = SWITCHBOARD_PROGRAM_IDS.devnet) {}

  /** Random bytes that produce the requested r1 (win roll, 0..9999) and r2 (prize roll). */
  static valueFor(r1: number, r2: bigint = 0n): Uint8Array {
    const v = new Uint8Array(32);
    // roll(): r1 = u16le(v[0..2]) % 10000, r2 = u64le(v[2..10])
    v[0] = r1 & 0xff;
    v[1] = (r1 >> 8) & 0xff;
    let x = r2;
    for (let i = 0; i < 8; i++) {
      v[2 + i] = Number(x & 0xffn);
      x >>= 8n;
    }
    v[31] = 1; // never all-zero
    return v;
  }

  async commit(connection: Connection, wallet: WalletLike, _opts?: { fresh?: boolean }): Promise<RandomnessCommit> {
    const kp = Keypair.generate();
    const rent = await connection.getMinimumBalanceForRentExemption(MOCK_RANDOMNESS_LEN);
    const create = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: kp.publicKey,
      lamports: rent,
      space: MOCK_RANDOMNESS_LEN,
      programId: this.programId,
    });
    let data: Buffer;
    if (this.forceSeedSlot !== undefined) {
      data = Buffer.alloc(9);
      data[0] = 2;
      data.writeBigUInt64LE(this.forceSeedSlot, 1);
    } else {
      data = Buffer.from([0]);
    }
    const commit = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: kp.publicKey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: false, isWritable: false },
      ],
      data,
    });
    return { randomness: kp.publicKey, commitIxs: [create, commit], signers: [kp] };
  }

  async reveal(_c: Connection, _w: WalletLike, randomness: PublicKey, _payer?: PublicKey): Promise<TransactionInstruction[]> {
    return [
      new TransactionInstruction({
        programId: this.programId,
        keys: [{ pubkey: randomness, isSigner: false, isWritable: true }],
        data: Buffer.concat([Buffer.from([1]), Buffer.from(this.nextValue)]),
      }),
    ];
  }
}
