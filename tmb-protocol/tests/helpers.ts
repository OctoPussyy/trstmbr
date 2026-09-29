import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { fetchAssetV1, mplCore, transferV1 } from "@metaplex-foundation/mpl-core";
import { createSignerFromKeypair, publicKey as umiPk, signerIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { MockSwitchboardRandomness, Prize, TmbClient, prizeKindName, tmbIdl } from "@tmb/sdk";

export const DECIMALS = 6;
export const tmb = (n: number) => new BN(Math.round(n * 10 ** DECIMALS).toString());
export const num = (b: BN) => Number(b.toString());

export async function airdrop(conn: Connection, to: PublicKey, sol = 20) {
  const sig = await conn.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  const bh = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

export function newClient(conn: Connection, kp: Keypair, programId: PublicKey) {
  const mock = new MockSwitchboardRandomness();
  const client = new TmbClient(conn, new anchor.Wallet(kp), programId, "localnet", { randomness: mock });
  return { client, mock, kp };
}
export type Actor = ReturnType<typeof newClient>;

/** Assert that `p` rejects with the program error `name` (matches by name or hex code in the message). */
export async function fails(p: Promise<unknown>, name: string) {
  const err = (tmbIdl as any).errors.find((e: any) => e.name === name);
  const hex = err ? "0x" + err.code.toString(16) : "";
  try {
    await p;
  } catch (e: any) {
    const s = [e?.error?.errorCode?.code, e?.message, String(e), (e?.logs ?? e?.transactionLogs ?? []).join("\n")]
      .filter(Boolean)
      .join("\n");
    if (s.includes(name) || (hex && s.includes(hex))) return;
    throw new Error(`expected ${name}${hex ? ` (${hex})` : ""} but got: ${s}`);
  }
  throw new Error(`expected ${name} but the call succeeded`);
}

/** Assert a raw failure matching any of `needles` (for non-TMB errors, e.g. Anchor constraint errors). */
export async function failsAny(p: Promise<unknown>, ...needles: string[]) {
  try {
    await p;
  } catch (e: any) {
    const s = [e?.message, String(e), (e?.logs ?? e?.transactionLogs ?? []).join("\n")].join("\n");
    if (needles.some((n) => s.includes(n))) return;
    throw new Error(`expected one of [${needles}] but got: ${s}`);
  }
  throw new Error(`expected failure [${needles}] but the call succeeded`);
}

export function makeUmi(conn: Connection, kp: Keypair) {
  const umi = createUmi(conn.rpcEndpoint, { commitment: "confirmed" }).use(mplCore());
  umi.use(signerIdentity(createSignerFromKeypair(umi, fromWeb3JsKeypair(kp))));
  return umi;
}

export async function assetOwner(conn: Connection, kp: Keypair, asset: PublicKey): Promise<string> {
  const umi = makeUmi(conn, kp);
  return (await fetchAssetV1(umi, umiPk(asset.toBase58()))).owner.toString();
}

export async function assetExists(conn: Connection, asset: PublicKey): Promise<boolean> {
  const info = await conn.getAccountInfo(asset);
  // a burned Core asset is closed / left as a single Uninitialized (0) byte
  return !!info && info.lamports > 0 && info.data.length > 1 && info.data[0] !== 0;
}

/** Plain wallet-to-wallet Core transfer (what a marketplace sale does). */
export async function transferCore(conn: Connection, from: Keypair, asset: PublicKey, collection: PublicKey, to: PublicKey) {
  const umi = makeUmi(conn, from);
  await transferV1(umi, {
    asset: umiPk(asset.toBase58()),
    collection: umiPk(collection.toBase58()),
    newOwner: umiPk(to.toBase58()),
  }).sendAndConfirm(umi);
}

export async function makeMint(conn: Connection, payer: Keypair, decimals = DECIMALS) {
  return createMint(conn, payer, payer.publicKey, null, decimals);
}

export async function giveTokens(conn: Connection, payer: Keypair, mint: PublicKey, to: PublicKey, amount: BN) {
  const ata = await getOrCreateAssociatedTokenAccount(conn, payer, mint, to);
  await mintTo(conn, payer, mint, ata.address, payer, BigInt(amount.toString()));
  return ata.address;
}

export async function tokenBalance(conn: Connection, mint: PublicKey, owner: PublicKey, allowOffCurve = false): Promise<bigint> {
  try {
    return (await getAccount(conn, getAssociatedTokenAddressSync(mint, owner, allowOffCurve, TOKEN_PROGRAM_ID))).amount;
  } catch {
    return 0n;
  }
}

export async function supply(conn: Connection, mint: PublicKey): Promise<bigint> {
  return (await getMint(conn, mint)).supply;
}

/** r2 that makes `pick_weighted` return wedge `index`, given which wedges are eligible. */
export function r2For(prizes: Prize[], index: number, blocked: Set<number> = new Set()): bigint {
  let acc = 0n;
  for (let i = 0; i < prizes.length; i++) {
    if (prizeKindName(prizes[i].kind) === "none" || blocked.has(i)) continue;
    if (i === index) return acc;
    acc += BigInt(prizes[i].weight);
  }
  throw new Error("wedge not eligible");
}

export async function waitSlots(conn: Connection, n: number) {
  const start = await conn.getSlot("confirmed");
  while ((await conn.getSlot("confirmed")) < start + n) await new Promise((r) => setTimeout(r, 200));
}

export async function parseEvents(client: TmbClient, signature: string): Promise<{ name: string; data: any }[]> {
  const tx = await client.connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  const parser = new anchor.EventParser(client.programId, client.program.coder);
  return [...parser.parseLogs(tx!.meta!.logMessages!)] as any;
}

/** Builds the prize table from config/prizes.json with mock token mints substituted in. */
export function buildPrizes(
  json: any[],
  mints: { tsla: PublicKey; gme: PublicKey; doge: PublicKey },
  prizeFromJson: (p: any, d: number) => Prize,
): Prize[] {
  const byId: Record<string, PublicKey> = { tsla: mints.tsla, gme: mints.gme, doge: mints.doge };
  return json.map((p) => prizeFromJson({ ...p, mint: byId[p.id]?.toBase58() ?? undefined }, DECIMALS));
}
