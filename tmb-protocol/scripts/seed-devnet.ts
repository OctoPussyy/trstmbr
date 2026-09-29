/**
 * Devnet seeding, idempotent. Run it twice:
 *   1) before init.ts: airdrop SOL, create the mock $TMB mint (1B supply) + mock TSLA/GME/DOGE mints
 *   2) after  init.ts: fund the reward vault (25% team bag + prize tokens) and mint test Bros
 *
 *   ts-node scripts/seed-devnet.ts [--bros 3] [--vault-tmb 250000000]
 */
import { PublicKey } from "@solana/web3.js";
import { airdropIfLow, arg, context, ensureMockMints, fundDevVault, isInitialized } from "./lib";

(async () => {
  const cluster = arg("cluster", "devnet") as "devnet" | "localnet";
  if (cluster !== "devnet" && cluster !== "localnet") throw new Error("seed-devnet only runs on devnet/localnet");
  const ctx = context(cluster);
  console.log("wallet:", ctx.payer.publicKey.toBase58(), "rpc:", ctx.conn.rpcEndpoint);
  await airdropIfLow(ctx.conn, ctx.payer.publicKey, 5, 2);

  const mintsFile = await ensureMockMints(ctx);
  if (!(await isInitialized(ctx))) {
    console.log(`\nmint config written (${mintsFile}). Now run: ts-node scripts/init.ts --cluster ${cluster}, then this script again.`);
    return;
  }

  const cfg = await ctx.client.fetchConfig();
  const pool = await ctx.client.fetchPool();
  if (pool.isZero()) await fundDevVault(ctx, Number(arg("vault-tmb", "250000000")));
  else console.log("vault already funded, pool =", pool.toString());

  const n = Number(arg("bros", "3"));
  for (let i = 0; i < n; i++) {
    const { asset } = await ctx.client.mintBro(`Test Bro #${i + 1}`, cfg.bonusUri || "https://example.com/tmb/bro.json");
    await ctx.client.depositBro(asset);
    console.log(`minted + staked test Bro ${asset.toBase58()}`);
  }
  console.log("\nseed complete. Next: ts-node scripts/export-addresses.ts --cluster", cluster);
})().catch((e) => { console.error(e); process.exit(1); });
