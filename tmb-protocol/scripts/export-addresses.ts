/**
 * Prints the JSON for the website admin panel -> Networks -> <cluster> form (network_config row) and
 * writes the same addresses back into config/<cluster>.json.
 *   ts-node scripts/export-addresses.ts --cluster devnet
 */
import { clusterArg, context, saveClusterFile } from "./lib";

(async () => {
  const ctx = context(clusterArg());
  const out = await ctx.client.exportAddresses(ctx.conn.rpcEndpoint);
  Object.assign(ctx.file, out);
  saveClusterFile(ctx.cluster, ctx.file);
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
