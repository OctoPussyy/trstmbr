/**
 * initialize + create_collection + set_prizes for a cluster. The signing wallet must be the program's
 * upgrade authority (the program refuses anyone else, so nobody can front-run initialization).
 *   ts-node scripts/init.ts --cluster devnet
 */
import { clusterArg, context, initProtocol, isInitialized } from "./lib";

(async () => {
  const ctx = context(clusterArg());
  if (await isInitialized(ctx)) {
    console.log("already initialized:", ctx.client.pdas.config.toBase58());
    return;
  }
  await initProtocol(ctx);
  console.log("\ninitialized. Next: fund the vault (devnet: seed-devnet.ts; mainnet: fund-vault with the team bag), then export-addresses.ts");
})().catch((e) => { console.error(e); process.exit(1); });
