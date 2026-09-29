/**
 * Mainnet hand-over to the Squads multisig:
 *   1) proposes the multisig as game authority (it must then execute `accept_authority`, see README)
 *   2) moves the program's upgrade authority to the multisig
 *   ts-node scripts/handover.ts --cluster mainnet --multisig <squads vault pubkey>
 */
import { spawnSync } from "child_process";
import { PublicKey } from "@solana/web3.js";
import { ROOT, arg, clusterArg, context } from "./lib";

(async () => {
  const ctx = context(clusterArg());
  const ms = new PublicKey(arg("multisig") ?? (() => { throw new Error("--multisig <pubkey> required"); })());
  console.log("proposing", ms.toBase58(), "as authority ...");
  await ctx.client.proposeAuthority(ms);
  console.log("setting upgrade authority ...");
  const r = spawnSync("solana", ["program", "set-upgrade-authority", ctx.programId.toBase58(), "--new-upgrade-authority", ms.toBase58(),
    "--url", ctx.conn.rpcEndpoint, "--keypair", arg("keypair") ?? process.env.ANCHOR_WALLET ?? `${process.env.HOME}/.config/solana/id.json`, "--skip-new-upgrade-authority-signer-check"], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log("\nNow have the multisig execute `accept_authority` (signer = multisig vault). Verify with export-addresses.ts.");
})().catch((e) => { console.error(e); process.exit(1); });
