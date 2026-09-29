/**
 * Builds the program for one cluster (cargo feature `devnet` | `mainnet`) and deploys it with that
 * cluster's program keypair.
 *
 *   ts-node scripts/deploy.ts --cluster devnet  [--keypair ~/.config/solana/id.json] [--rpc <url>]
 *   ts-node scripts/deploy.ts --cluster mainnet [--upgrade-authority <pubkey>]
 *
 * The deploying wallet becomes the upgrade authority unless --upgrade-authority is given. NOTE:
 * `initialize` must be signed by the upgrade authority, so on mainnet deploy with your own key, run
 * init.ts, then run handover.ts to move both authorities to the Squads multisig.
 */
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { ROOT, arg, clusterArg, loadClusterFile, programKeypairPath, saveClusterFile, loadKeypair } from "./lib";

function run(cmd: string, args: string[]) {
  console.log("$", cmd, args.join(" "));
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const cluster = clusterArg();
if (cluster === "localnet") throw new Error("use scripts/localnet.sh for localnet");
const file = loadClusterFile(cluster);
const rpc = arg("rpc") ?? file.rpc_url;
if (!rpc) throw new Error(`set rpc_url in config/${cluster}.json or pass --rpc`);
const keypair = arg("keypair") ?? process.env.ANCHOR_WALLET ?? `${process.env.HOME}/.config/solana/id.json`;
const progKp = programKeypairPath(cluster);
if (!fs.existsSync(progKp)) throw new Error(`missing ${progKp}. Run scripts/sync-keys.sh first.`);
const programId = loadKeypair(progKp).publicKey.toBase58();

// the declare_id! compiled into the binary must match the keypair we deploy with
const constants = fs.readFileSync(path.join(ROOT, "programs/tmb_game/src/constants.rs"), "utf8");
if (!constants.includes(`declare_id!("${programId}")`)) {
  throw new Error(`declare_id! in constants.rs does not contain ${programId}. Run scripts/sync-keys.sh.`);
}

run("anchor", ["build", "--", "--no-default-features", "--features", cluster]);
const deployArgs = ["program", "deploy", "target/deploy/tmb_game.so", "--program-id", progKp, "--url", rpc, "--keypair", keypair];
const ua = arg("upgrade-authority");
if (ua) deployArgs.push("--upgrade-authority", ua);
run("solana", deployArgs);

fs.copyFileSync(path.join(ROOT, "target/idl/tmb_game.json"), path.join(ROOT, "sdk/src/idl/tmb_game.json"));
fs.copyFileSync(path.join(ROOT, "target/types/tmb_game.ts"), path.join(ROOT, "sdk/src/idl/tmb_game.ts"));
file.game_program_id = programId;
saveClusterFile(cluster, file);
console.log(`\ndeployed ${cluster}: ${programId}  (written to config/${cluster}.json, IDL copied to sdk/src/idl)`);
