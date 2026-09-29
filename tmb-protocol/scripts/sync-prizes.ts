/**
 * Pushes the prize table (config/prizes.json, or prizes.<cluster>.json / --prizes <file>) on chain.
 * Signer must be the authority or reward_wallet. Tables that don't fit one tx are sent in chunks and
 * validated on the last one; spins stay blocked until then, so consider `set_paused` first on mainnet.
 *   ts-node scripts/sync-prizes.ts --cluster devnet
 */
import { clusterArg, context, loadPrizes } from "./lib";
import { decodeFixed, prizeKindName } from "@tmb/sdk";

(async () => {
  const ctx = context(clusterArg());
  const { prizes, path: p } = loadPrizes(ctx.cluster, ctx.file.params.tmb_decimals);
  console.log(`pushing ${prizes.length} wedges from ${p}`);
  const sigs = await ctx.client.setPrizes(prizes);
  console.log("txs:", sigs.join(", "));
  const onChain = await ctx.client.fetchPrizes();
  onChain.forEach((w, i) => console.log(String(i).padStart(2), prizeKindName(w.kind).padEnd(9), decodeFixed(w.label).padEnd(20), "weight", w.weight));
})().catch((e) => { console.error(e); process.exit(1); });
