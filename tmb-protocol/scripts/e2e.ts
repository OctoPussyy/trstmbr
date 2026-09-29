/**
 * Full end-to-end run: seed -> mint -> deposit -> spins until the 5th loss burns the Bro -> rescue -> withdraw.
 *
 *   localnet (mock oracle, forced losses):  scripts/localnet.sh &  ts-node scripts/e2e.ts --cluster localnet --bootstrap
 *   devnet   (REAL Switchboard randomness): ts-node scripts/e2e.ts --cluster devnet
 *
 * On devnet the oracle decides, so a spin can win; the script keeps spinning (up to --max-spins) until
 * the streak reaches the burn threshold.
 */
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { MockSwitchboardRandomness, SwitchboardRandomness, TmbClient, decodeFixed, prizeKindName } from "@tmb/sdk";
import { airdropIfLow, arg, clusterArg, context, ensureMockMints, flag, fundDevVault, initProtocol, isInitialized } from "./lib";

(async () => {
  const cluster = clusterArg();
  if (cluster === "mainnet") throw new Error("e2e never runs against mainnet");
  const ctx = context(cluster);
  const mock = cluster === "localnet" ? (ctx.client.randomness as MockSwitchboardRandomness) : null;
  const say = (m: string) => console.log(`\n== ${m}`);

  await airdropIfLow(ctx.conn, ctx.payer.publicKey, 5, 5);
  if (!(await isInitialized(ctx))) {
    if (!flag("bootstrap")) throw new Error("program not initialized: run init.ts/seed-devnet.ts or pass --bootstrap");
    say("bootstrap: mints, initialize, collection, prizes, vault funding");
    await ensureMockMints(ctx);
    await initProtocol(ctx);
    await fundDevVault(ctx, 1_000_000, 10_000);
  }
  const cfg = await ctx.client.fetchConfig();
  const tmbMint = cfg.tmbMint;
  const fee = cfg.spinAmounts[0];

  const mkPlayer = async (label: string) => {
    const kp = Keypair.generate();
    const t = new Transaction().add(SystemProgram.transfer({ fromPubkey: ctx.payer.publicKey, toPubkey: kp.publicKey, lamports: (cluster === "localnet" ? 1 : 0.6) * LAMPORTS_PER_SOL }));
    await ctx.client.provider.sendAndConfirm(t);
    const ata = await getOrCreateAssociatedTokenAccount(ctx.conn, ctx.payer, tmbMint, kp.publicKey);
    // the payer holds the mock supply; move some bags to the player
    await mintTo(ctx.conn, ctx.payer, tmbMint, ata.address, ctx.payer, 5_000n * 10n ** 6n).catch(() => {});
    const rnd = mock ? new MockSwitchboardRandomness() : new SwitchboardRandomness();
    const client = new TmbClient(ctx.conn, new anchor.Wallet(kp), ctx.programId, ctx.client.cluster, { randomness: rnd });
    console.log(label, kp.publicKey.toBase58());
    return { kp, client, rnd };
  };

  say("players");
  const alice = await mkPlayer("alice (will get burned)");
  const carol = await mkPlayer("carol (rescuer)");

  say("mint + stake");
  const { asset } = await alice.client.mintBro("E2E Bro", "https://example.com/e2e.json");
  await alice.client.depositBro(asset);
  console.log("alice bro:", asset.toBase58(), "balance:", (await alice.client.fetchBro(asset))!.tmbBalance.toString());
  await alice.client.depositTmb(asset, new BN(200_000_000));

  say("spin until the Bro burns");
  const max = Number(arg("max-spins", "60"));
  let burned = false;
  for (let i = 1; i <= max && !burned; i++) {
    if (alice.rnd instanceof MockSwitchboardRandomness) alice.rnd.nextValue = MockSwitchboardRandomness.valueFor(9999);
    const ev = await alice.client.spin(asset, fee);
    const prizes = await ctx.client.fetchPrizes();
    console.log(`spin ${i}: ${ev.outcome === 1 ? "WIN " + decodeFixed(prizes[ev.wedgeIndex].label) : "loss"} | wedge ${ev.wedgeIndex} (${prizeKindName(prizes[ev.wedgeIndex].kind)}) | streak ${ev.newStreak} | balance ${ev.newBalance.toString()} | burned ${ev.burned}`);
    burned = ev.burned;
  }
  if (!burned) throw new Error("Bro did not burn within --max-spins");

  say("rescue");
  const { asset: carolBro } = await carol.client.mintBro("Carol Bro", "https://example.com/carol.json");
  await carol.client.depositBro(carolBro);
  const rescueFee = cfg.rescueFeeOptions[0];
  const { newAsset } = await carol.client.rescue(carolBro, asset, rescueFee);
  console.log("rescued -> new asset", newAsset.toBase58(), "owned by alice");

  say("alice stakes + withdraws the revived Bro and her TMB");
  await alice.client.depositBro(newAsset);
  const rec = await alice.client.fetchBro(newAsset);
  console.log("revived record: streak", rec!.lossStreak, "balance", rec!.tmbBalance.toString());
  await alice.client.withdrawTmb(newAsset, rec!.tmbBalance);
  await alice.client.withdrawBro(newAsset);
  console.log("\nE2E OK");
})().catch((e) => { console.error(e); process.exit(1); });
