import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  MockSwitchboardRandomness,
  ParamsJson,
  PrizeJson,
  RandomnessProvider,
  SwitchboardRandomness,
  TmbClient,
  paramsToConfigArgs,
  prizeFromJson,
} from "@tmb/sdk";

export const ROOT = path.resolve(__dirname, "..");
export type ClusterArg = "devnet" | "mainnet" | "localnet";

export interface ClusterFile {
  cluster: "devnet" | "mainnet";
  rpc_url: string;
  game_program_id: string;
  tmb_mint: string;
  collection_address: string;
  reward_vault: string;
  treasury_wallet: string;
  admin_authority: string;
  params: ParamsJson;
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return fallback;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);

export function clusterArg(): ClusterArg {
  const c = arg("cluster");
  if (c !== "devnet" && c !== "mainnet" && c !== "localnet") {
    console.error("usage: --cluster devnet|mainnet" + (process.argv[1].includes("e2e") ? "|localnet" : ""));
    process.exit(1);
  }
  return c;
}

const cfgPath = (c: ClusterArg) => path.join(ROOT, "config", `${c === "localnet" ? "devnet" : c}.json`);
const statePath = () => path.join(ROOT, ".localnet-state.json");

export function loadClusterFile(c: ClusterArg): ClusterFile {
  const file: ClusterFile = JSON.parse(fs.readFileSync(cfgPath(c), "utf8"));
  if (c === "localnet") {
    // localnet reuses devnet params but keeps its own (ephemeral, git-ignored) addresses
    Object.assign(file, { rpc_url: "http://127.0.0.1:8899", tmb_mint: "", collection_address: "", game_program_id: "" });
    if (fs.existsSync(statePath())) Object.assign(file, JSON.parse(fs.readFileSync(statePath(), "utf8")));
  }
  return file;
}

export function saveClusterFile(c: ClusterArg, file: ClusterFile) {
  if (c === "localnet") {
    const { tmb_mint, collection_address, game_program_id, treasury_wallet, admin_authority, reward_vault } = file;
    fs.writeFileSync(statePath(), JSON.stringify({ tmb_mint, collection_address, game_program_id, treasury_wallet, admin_authority, reward_vault }, null, 2));
  } else {
    fs.writeFileSync(cfgPath(c), JSON.stringify(file, null, 2) + "\n");
  }
}

export function loadKeypair(p?: string): Keypair {
  const file = (p ?? process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config/solana/id.json")).replace(/^~/, os.homedir());
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

export function programKeypairPath(c: ClusterArg) {
  return path.join(ROOT, "target/deploy", `tmb_game-${c === "localnet" ? "devnet" : c}.json`);
}

export function programIdFor(c: ClusterArg, file: ClusterFile): PublicKey {
  if (file.game_program_id) return new PublicKey(file.game_program_id);
  return loadKeypair(programKeypairPath(c)).publicKey;
}

export interface Ctx {
  cluster: ClusterArg;
  file: ClusterFile;
  conn: Connection;
  payer: Keypair;
  programId: PublicKey;
  client: TmbClient;
}

export function context(cluster: ClusterArg, opts: { randomness?: RandomnessProvider } = {}): Ctx {
  const file = loadClusterFile(cluster);
  const rpc = arg("rpc") ?? file.rpc_url;
  if (!rpc) throw new Error(`rpc_url is empty in config/${cluster}.json (or pass --rpc)`);
  const payer = loadKeypair(arg("keypair"));
  const conn = new Connection(rpc, "confirmed");
  const programId = programIdFor(cluster, file);
  const sdkCluster = cluster === "mainnet" ? "mainnet" : cluster;
  const randomness = opts.randomness ?? (cluster === "localnet" ? new MockSwitchboardRandomness() : new SwitchboardRandomness());
  const client = new TmbClient(conn, new anchor.Wallet(payer), programId, sdkCluster, { randomness });
  return { cluster, file, conn, payer, programId, client };
}

export async function airdropIfLow(conn: Connection, who: PublicKey, minSol: number, topUpSol = 2) {
  if ((await conn.getBalance(who)) >= minSol * LAMPORTS_PER_SOL) return;
  for (let i = 0; i < 3; i++) {
    try {
      const sig = await conn.requestAirdrop(who, topUpSol * LAMPORTS_PER_SOL);
      const bh = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      return;
    } catch (e) {
      console.warn(`airdrop attempt ${i + 1} failed: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("airdrop failed (devnet faucet is rate limited: use https://faucet.solana.com)");
}

export function prizesPath(cluster: ClusterArg): string {
  const explicit = arg("prizes");
  if (explicit) return path.resolve(explicit);
  const perCluster = path.join(ROOT, "config", `prizes.${cluster}.json`);
  return fs.existsSync(perCluster) ? perCluster : path.join(ROOT, "config", "prizes.json");
}

export function loadPrizes(cluster: ClusterArg, decimals: number) {
  const p = prizesPath(cluster);
  const rows: PrizeJson[] = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const r of rows) {
    if (r.kind === "Token" && !r.mint) throw new Error(`prize "${r.id}" is a Token prize but has no mint (${p}). Run seed-devnet.ts (devnet) or fill real mints (mainnet).`);
  }
  return { path: p, rows, prizes: rows.map((r) => prizeFromJson(r, decimals)) };
}

// ------------------------------------------------------------------------------------------------
// Shared setup steps (used by seed-devnet.ts, init.ts and e2e.ts --bootstrap)
// ------------------------------------------------------------------------------------------------

const tmbUi = (n: number, d: number) => new BN(Math.round(n * 10 ** d).toString());

/** Creates the mock $TMB (1B supply) + mock TSLA/GME/DOGE mints and writes them to config. Devnet/localnet only. */
export async function ensureMockMints(ctx: Ctx) {
  const d = ctx.file.params.tmb_decimals;
  if (!ctx.file.tmb_mint) {
    const mint = await createMint(ctx.conn, ctx.payer, ctx.payer.publicKey, null, d);
    const ata = await getOrCreateAssociatedTokenAccount(ctx.conn, ctx.payer, mint, ctx.payer.publicKey);
    await mintTo(ctx.conn, ctx.payer, mint, ata.address, ctx.payer, BigInt(1_000_000_000) * BigInt(10) ** BigInt(d));
    ctx.file.tmb_mint = mint.toBase58();
    console.log("mock $TMB mint:", ctx.file.tmb_mint, "(1,000,000,000 supply minted to", ctx.payer.publicKey.toBase58() + ")");
  }
  const rows: PrizeJson[] = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "prizes.json"), "utf8"));
  const out = path.join(ROOT, "config", `prizes.${ctx.cluster === "localnet" ? "localnet" : ctx.cluster}.json`);
  const existing: PrizeJson[] = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : [];
  for (const r of rows) {
    if (r.kind !== "Token") continue;
    const prev = existing.find((e) => e.id === r.id)?.mint;
    if (prev) { r.mint = prev; continue; }
    const m = await createMint(ctx.conn, ctx.payer, ctx.payer.publicKey, null, r.token_decimals ?? 6);
    r.mint = m.toBase58();
    console.log(`mock ${r.label} mint:`, r.mint);
  }
  fs.writeFileSync(out, JSON.stringify(rows, null, 2) + "\n");
  saveClusterFile(ctx.cluster, ctx.file);
  return out;
}

export async function isInitialized(ctx: Ctx): Promise<boolean> {
  return !!(await ctx.conn.getAccountInfo(ctx.client.pdas.config));
}

/** initialize + create_collection + set_prizes. Wallet must be the program's upgrade authority. */
export async function initProtocol(ctx: Ctx) {
  const { file, client, payer } = ctx;
  if (!file.tmb_mint) throw new Error("tmb_mint is empty in config (devnet: run seed-devnet.ts first; mainnet: paste the pump.fun mint)");
  const p = file.params;
  const key = (s: string, fallback: PublicKey) => (s ? new PublicKey(s) : fallback);
  const keys = {
    rewardWallet: key(p.reward_wallet, payer.publicKey),
    pauser: key(p.pauser, payer.publicKey),
    treasury: key(file.treasury_wallet, payer.publicKey),
    teamWallet: key(p.team_wallet, payer.publicKey),
  };
  console.log("initialize ...");
  await client.initialize(new PublicKey(file.tmb_mint), paramsToConfigArgs(p, keys));
  console.log("create_collection ...");
  const { collection } = await client.createCollection(p.collection_name, p.collection_uri);
  file.collection_address = collection.toBase58();
  file.reward_vault = client.pdas.vault.toBase58();
  file.treasury_wallet = keys.treasury.toBase58();
  file.admin_authority = payer.publicKey.toBase58();
  file.game_program_id = ctx.programId.toBase58();
  saveClusterFile(ctx.cluster, file);
  const { prizes, path: pp } = loadPrizes(ctx.cluster, p.tmb_decimals);
  console.log(`set_prizes from ${path.relative(ROOT, pp)} ...`);
  await client.setPrizes(prizes);
}

/** Funds the reward vault (TMB + prize tokens) from the payer's wallet. */
export async function fundDevVault(ctx: Ctx, tmbAmountUi: number, tokenAmountUi = 100_000) {
  const d = ctx.file.params.tmb_decimals;
  const tmbMint = new PublicKey(ctx.file.tmb_mint);
  await ctx.client.fundVault(tmbMint, tmbUi(tmbAmountUi, d));
  console.log(`vault funded with ${tmbAmountUi.toLocaleString()} TMB`);
  const { rows } = loadPrizes(ctx.cluster, d);
  for (const r of rows) {
    if (r.kind !== "Token") continue;
    const m = new PublicKey(r.mint!);
    const dec = r.token_decimals ?? 6;
    const ata = await getOrCreateAssociatedTokenAccount(ctx.conn, ctx.payer, m, ctx.payer.publicKey);
    await mintTo(ctx.conn, ctx.payer, m, ata.address, ctx.payer, BigInt(tokenAmountUi) * BigInt(10) ** BigInt(dec));
    await ctx.client.fundVault(m, tmbUi(tokenAmountUi, dec));
    console.log(`vault funded with ${tokenAmountUi.toLocaleString()} ${r.label}`);
  }
}
