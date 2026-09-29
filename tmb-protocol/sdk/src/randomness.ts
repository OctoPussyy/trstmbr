import { Connection, Keypair, PublicKey, Signer, TransactionInstruction } from "@solana/web3.js";
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
  commit(connection: Connection, wallet: WalletLike, opts?: { fresh?: boolean }): Promise<RandomnessCommit>;
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
export class SwitchboardRandomness implements RandomnessProvider {
  private cache?: { sb: any; program: any; queue: PublicKey };
  private revealHandles = new Map<string, any>();

  constructor(private readonly opts: { queue?: PublicKey; persist?: RandomnessPersist } = {}) {}

  private async load(connection: Connection, wallet: WalletLike) {
    if (this.cache) return this.cache;
    // Lazy import so apps that only use the mock / read APIs don't load Switchboard.
    const sb = await import("@switchboard-xyz/on-demand");
    const program = await sb.AnchorUtils.loadProgramFromConnection(connection, wallet as any);
    const queue = this.opts.queue ?? (await sb.getDefaultQueue(connection.rpcEndpoint)).pubkey;
    this.cache = { sb, program, queue };
    return this.cache;
  }

  async commit(connection: Connection, wallet: WalletLike, opts: { fresh?: boolean } = {}): Promise<RandomnessCommit> {
    const { sb, program, queue } = await this.load(connection, wallet);
    // Reuse the wallet's randomness account: re-committing costs no rent (a new account costs ~0.007 SOL).
    const saved = !opts.fresh ? this.opts.persist?.load() : null;
    if (saved) {
      const old = Keypair.fromSecretKey(Uint8Array.from(saved));
      if (await connection.getAccountInfo(old.publicKey)) {
        const r = new sb.Randomness(program, old.publicKey);
        const commitIx = await r.commitIx(queue, wallet.publicKey);
        this.revealHandles.set(old.publicKey.toBase58(), r);
        return { randomness: old.publicKey, commitIxs: [commitIx], signers: [] };
      }
      this.opts.persist?.clear();
    }
    const kp = Keypair.generate();
    const [randomness, createIx] = await sb.Randomness.create(program, kp, queue, wallet.publicKey);
    const commitIx = await randomness.commitIx(queue, wallet.publicKey);
    this.revealHandles.set(randomness.pubkey.toBase58(), randomness);
    this.opts.persist?.save(Array.from(kp.secretKey));
    return { randomness: randomness.pubkey, commitIxs: [createIx, commitIx], signers: [kp] };
  }

  async reveal(connection: Connection, wallet: WalletLike, randomness: PublicKey, payer?: PublicKey): Promise<TransactionInstruction[]> {
    const { sb, program } = await this.load(connection, wallet);
    const handle = this.revealHandles.get(randomness.toBase58()) ?? new sb.Randomness(program, randomness);
    // The oracle gateway needs a moment after the commit lands; retry with backoff.
    let lastErr: unknown;
    for (let i = 0; i < 20; i++) {
      try {
        return [await handle.revealIx(payer ?? wallet.publicKey)];
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 1000 + i * 250));
      }
    }
    throw new Error(`Switchboard reveal failed: ${(lastErr as Error)?.message ?? lastErr}`);
  }
}
