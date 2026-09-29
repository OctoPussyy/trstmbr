import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import {
  MockSwitchboardRandomness,
  OddsTier,
  Prize,
  TmbClient,
  computeOddsTier,
  decodeFixed,
  paramsToConfigArgs,
  prizeFromJson,
  prizeKindName,
  tmbIdl,
} from "@tmb/sdk";
import prizesJson from "../config/prizes.json";
import devnetJson from "../config/devnet.json";
import {
  Actor,
  DECIMALS,
  airdrop,
  assetExists,
  assetOwner,
  buildPrizes,
  fails,
  failsAny,
  giveTokens,
  makeMint,
  newClient,
  num,
  parseEvents,
  r2For,
  supply,
  tmb,
  tokenBalance,
  transferCore,
  waitSlots,
} from "./helpers";

const WIN = 0; // r1 that always wins
const LOSE = 9999; // r1 that always loses
const FEE = tmb(25);

describe("tmb_game", function () {
  this.timeout(600_000);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const conn = provider.connection;
  const adminKp = (provider.wallet as anchor.Wallet).payer;
  const programId = new PublicKey((tmbIdl as any).address);

  let admin: Actor, A: Actor, B: Actor, C: Actor, D: Actor, R: Actor, X: Actor;
  const treasury = Keypair.generate();
  const teamWallet = Keypair.generate();
  let tmbMint: PublicKey;
  let mints: { tsla: PublicKey; gme: PublicKey; doge: PublicKey };
  let collection: PublicKey;
  let prizes: Prize[];
  const rektIndex = prizesJson.findIndex((p) => p.kind === "None");
  const idx = (id: string) => prizesJson.findIndex((p) => p.id === id);

  /** forced spin helper: chooses r1 (win roll) and the wedge (via r2) */
  async function spin(who: Actor, asset: PublicKey, r1: number, wedge?: number, amount: BN = FEE, opts: any = {}) {
    who.mock.nextValue = MockSwitchboardRandomness.valueFor(r1, wedge === undefined ? 0n : r2For(prizes, wedge));
    return who.client.spin(asset, amount, opts);
  }

  /** mint + deposit a Bro for `who`; returns the asset */
  async function freshBro(who: Actor, stake = true): Promise<PublicKey> {
    const { asset } = await who.client.mintBro("Bro #" + Math.floor(Math.random() * 9999), "https://example.com/bro.json");
    if (stake) await who.client.depositBro(asset);
    return asset;
  }

  /** sum(BroRecord.tmb_balance) == config.total_user_tmb and vault >= total_user_tmb */
  async function invariants() {
    const cfg = await admin.client.fetchConfig();
    const recs = await admin.client.program.account.broRecord.all();
    const sum = recs.reduce((a, r) => a.add(r.account.tmbBalance), new BN(0));
    expect(sum.toString(), "sum of bro balances == total_user_tmb").to.equal(cfg.totalUserTmb.toString());
    const vault = getAssociatedTokenAddressSync(tmbMint, admin.client.pdas.vault, true);
    const bal = await conn.getTokenAccountBalance(vault);
    expect(BigInt(bal.value.amount) >= BigInt(cfg.totalUserTmb.toString()), "vault covers all bro balances").to.equal(true);
  }

  before(async () => {
    const kps = [0, 1, 2, 3, 4, 5].map(() => Keypair.generate());
    for (const k of [...kps, treasury, teamWallet]) await airdrop(conn, k.publicKey, 30);
    admin = newClient(conn, adminKp, programId);
    [A, B, C, D, R, X] = kps.map((k) => newClient(conn, k, programId));

    tmbMint = await makeMint(conn, adminKp);
    mints = { tsla: await makeMint(conn, adminKp), gme: await makeMint(conn, adminKp), doge: await makeMint(conn, adminKp) };

    const params = { ...(devnetJson as any).params, stale_slots: 10, min_reserve: 1000 };
    await admin.client.initialize(
      tmbMint,
      paramsToConfigArgs(params, {
        rewardWallet: R.kp.publicKey,
        pauser: D.kp.publicKey,
        treasury: treasury.publicKey,
        teamWallet: teamWallet.publicKey,
      }),
    );
    collection = (await admin.client.createCollection("Trust Me Bros (test)", "https://example.com/c.json")).collection;
    prizes = buildPrizes(prizesJson, mints, prizeFromJson as any);

    // reward wallet gets bags and funds the vault
    await giveTokens(conn, adminKp, tmbMint, R.kp.publicKey, tmb(2_000_000));
    for (const m of [mints.tsla, mints.gme, mints.doge]) await giveTokens(conn, adminKp, m, R.kp.publicKey, tmb(10_000));
    // players get some TMB in their wallets
    for (const p of [A, B, C]) await giveTokens(conn, adminKp, tmbMint, p.kp.publicKey, tmb(5_000));
    await giveTokens(conn, adminKp, tmbMint, adminKp.publicKey, tmb(1));
  });

  // -------------------------------------------------------------------------------------------
  it("1. initialize; set_prizes rejects tables without exactly one REKT", async () => {
    const cfg = await admin.client.fetchConfig();
    expect(cfg.authority.toBase58()).to.equal(adminKp.publicKey.toBase58());
    expect(cfg.collection.toBase58()).to.equal(collection.toBase58());
    expect(cfg.burnAtLossStreak).to.equal(5);

    // re-initialising must fail
    await failsAny(
      admin.client.initialize(tmbMint, paramsToConfigArgs((devnetJson as any).params, {
        rewardWallet: R.kp.publicKey, pauser: D.kp.publicKey, treasury: treasury.publicKey, teamWallet: teamWallet.publicKey,
      })),
      "already in use", "custom program error: 0x0",
    );

    const noRekt = prizes.filter((p) => prizeKindName(p.kind) !== "none");
    await fails(R.client.setPrizes(noRekt), "MissingRektWedge");
    const twoRekt = [...prizes, prizes[rektIndex]];
    await fails(R.client.setPrizes(twoRekt), "MissingRektWedge");
    const tooMany = [prizes[rektIndex], ...Array.from({ length: 16 }, () => prizes[idx("tmb-10")])];
    await fails(R.client.setPrizes(tooMany), "PrizeTableInvalid");
    const zeroWeight = prizes.map((p, i) => (i === 0 ? { ...p, weight: 0 } : p));
    await fails(R.client.setPrizes(zeroWeight), "PrizeTableInvalid");

    await R.client.setPrizes(prizes);
    const onChain = await admin.client.fetchPrizes();
    expect(onChain.length).to.equal(prizes.length);
    expect(decodeFixed(onChain[6].label)).to.equal("1000 TMB JACKPOT");

    // fund the vault (TMB + prize tokens)
    await R.client.fundVault(tmbMint, tmb(1_000_000));
    for (const m of [mints.tsla, mints.gme, mints.doge]) await R.client.fundVault(m, tmb(10_000));
    expect((await admin.client.fetchPool()).toString()).to.equal(tmb(1_000_000).toString());
  });

  it("2. mint_bro charges SOL, splits it, creates a record with the starting balance", async () => {
    const cfg = await admin.client.fetchConfig();
    const t0 = await conn.getBalance(treasury.publicKey);
    const w0 = await conn.getBalance(teamWallet.publicKey);
    const { asset } = await A.client.mintBro("Bro #1", "https://example.com/1.json");
    const price = num(cfg.mintPriceLamports);
    expect((await conn.getBalance(treasury.publicKey)) - t0).to.equal(price / 2);
    expect((await conn.getBalance(teamWallet.publicKey)) - w0).to.equal(price - price / 2);

    const rec = await A.client.fetchBro(asset);
    expect(rec!.tmbBalance.toString()).to.equal(tmb(250).toString());
    expect(rec!.lossStreak).to.equal(0);
    expect(rec!.inEscrow).to.equal(false);
    expect(await assetOwner(conn, adminKp, asset)).to.equal(A.kp.publicKey.toBase58());
    expect((await admin.client.fetchConfig()).minted).to.equal(1);
    // starting balance is carved out of the pool
    expect((await admin.client.fetchPool()).toString()).to.equal(tmb(1_000_000 - 250).toString());
    (globalThis as any).broA1 = asset;
    await invariants();
  });

  it("2b. mint_bro rejects when paused and when max supply is reached", async () => {
    await admin.client.setPaused(true);
    await fails(B.client.mintBro("x", "y"), "Paused");
    await admin.client.setPaused(false);
    const cfg = await admin.client.fetchConfig();
    await admin.client.updateConfig({ maxSupply: cfg.minted });
    await fails(B.client.mintBro("x", "y"), "MaxSupply");
    await admin.client.updateConfig({ maxSupply: 10_000 });
  });

  it("3. deposit/withdraw Bro; streak persists across withdraw -> redeposit", async () => {
    const asset: PublicKey = (globalThis as any).broA1;
    await A.client.depositBro(asset);
    expect(await assetOwner(conn, adminKp, asset)).to.equal(A.client.pdas.escrowAuth.toBase58());
    expect((await A.client.fetchBro(asset))!.inEscrow).to.equal(true);

    // a loss -> streak 1
    const ev = await spin(A, asset, LOSE);
    expect(ev.outcome).to.equal(0);
    expect(ev.newStreak).to.equal(1);
    expect(ev.wedgeIndex).to.equal(rektIndex);
    expect(num((await A.client.fetchBro(asset))!.tmbBalance)).to.equal(num(tmb(225)));

    await A.client.withdrawBro(asset);
    expect(await assetOwner(conn, adminKp, asset)).to.equal(A.kp.publicKey.toBase58());
    expect((await A.client.fetchBro(asset))!.lossStreak).to.equal(1);

    await A.client.depositBro(asset);
    expect((await A.client.fetchBro(asset))!.lossStreak).to.equal(1); // NOT reset
    await invariants();
  });

  it("3b. deposit_tmb / withdraw_tmb move tokens and keep the accounting invariant", async () => {
    const asset: PublicKey = (globalThis as any).broA1;
    const before = await tokenBalance(conn, tmbMint, A.kp.publicKey);
    await A.client.depositTmb(asset, tmb(300));
    expect(num((await A.client.fetchBro(asset))!.tmbBalance)).to.equal(num(tmb(525)));
    expect(before - (await tokenBalance(conn, tmbMint, A.kp.publicKey))).to.equal(BigInt(tmb(300).toString()));
    await A.client.withdrawTmb(asset, tmb(300));
    expect(num((await A.client.fetchBro(asset))!.tmbBalance)).to.equal(num(tmb(225)));
    await fails(A.client.withdrawTmb(asset, tmb(10_000)), "NotEnoughBags");
    await fails(A.client.depositTmb(asset, 0), "InvalidAmount");
    await invariants();
  });

  it("4. transfer to wallet B -> fresh record (streak 0); back to A -> A's old streak returns", async () => {
    const asset: PublicKey = (globalThis as any).broA1;
    await A.client.withdrawBro(asset);
    await transferCore(conn, A.kp, asset, collection, B.kp.publicKey);
    expect(await assetOwner(conn, adminKp, asset)).to.equal(B.kp.publicKey.toBase58());

    // A can no longer deposit it (not the owner)
    await fails(A.client.depositBro(asset), "NotOwner");

    await B.client.depositBro(asset);
    const recB = await B.client.fetchBro(asset);
    expect(recB!.lossStreak).to.equal(0);
    expect(recB!.tmbBalance.toString()).to.equal("0");

    // B has no bags -> can't spin
    await fails(B.client.requestSpin(asset, FEE), "NotEnoughBags");
    await B.client.withdrawBro(asset);
    await transferCore(conn, B.kp, asset, collection, A.kp.publicKey);

    await A.client.depositBro(asset);
    const recA = await A.client.fetchBro(asset);
    expect(recA!.lossStreak).to.equal(1); // A's streak resumed
    expect(num(recA!.tmbBalance)).to.equal(num(tmb(225)));
    await invariants();
  });

  it("4b. a newly seen owner record is subject to transfer_cooldown_slots", async () => {
    const { asset } = await A.client.mintBro("Cooldown Bro", "https://example.com/cd.json");
    await admin.client.updateConfig({ transferCooldownSlots: new BN(1_000_000) });
    await transferCore(conn, A.kp, asset, collection, B.kp.publicKey);
    await B.client.depositBro(asset);
    await B.client.depositTmb(asset, tmb(100));
    await fails(B.client.requestSpin(asset, FEE), "CooldownActive");
    await admin.client.updateConfig({ transferCooldownSlots: new BN(0) });
    // the record keeps its eligible_slot: cooldown was stamped at creation
    await fails(B.client.requestSpin(asset, FEE), "CooldownActive");
  });

  it("5. request_spin rejections", async () => {
    const asset: PublicKey = (globalThis as any).broA1;

    await admin.client.setPaused(true);
    await fails(A.client.requestSpin(asset, FEE), "Paused");
    await admin.client.setPaused(false);

    await fails(A.client.requestSpin(asset, tmb(30)), "InvalidSpinAmount");
    await fails(A.client.requestSpin(asset, new BN(0)), "InvalidSpinAmount");

    // wrong signer: C tries to spin with A's BroRecord -> PDA seeds (asset, signer) don't match
    const recA = await A.client.fetchBro(asset);
    await failsAny(
      C.client.program.methods
        .requestSpin(FEE)
        .accountsPartial({
          player: C.kp.publicKey,
          config: C.client.pdas.config,
          asset,
          broRecord: A.client.pdas.bro(asset, A.kp.publicKey),
          spinRequest: A.client.pdas.spin(asset, recA!.totalSpins),
          randomnessAccount: Keypair.generate().publicKey,
        })
        .rpc(),
      "ConstraintSeeds", "2006",
    );
    // ...and C has no record of their own for it
    await failsAny(C.client.requestSpin(asset, FEE), "no BroRecord");

    // not escrowed
    await A.client.withdrawBro(asset);
    await fails(A.client.requestSpin(asset, FEE), "NotInEscrow");
    await A.client.depositBro(asset);

    // insufficient bags: a Bro with balance < amount
    const poor = await freshBro(C);
    await C.client.withdrawTmb(poor, tmb(240));
    await fails(C.client.requestSpin(poor, FEE), "NotEnoughBags");

    // randomness checks
    A.mock.forceSeedSlot = 5n;
    await fails(A.client.requestSpin(asset, FEE), "StaleRandomness");
    A.mock.forceSeedSlot = undefined;

    // pending spin blocks a second request, withdraw, deposit/withdraw tmb
    const first = await A.client.requestSpin(asset, FEE);
    await fails(A.client.requestSpin(asset, FEE), "SpinPending");
    await fails(A.client.withdrawBro(asset), "SpinPending");
    await fails(A.client.withdrawTmb(asset, tmb(1)), "SpinPending");
    await fails(A.client.depositTmb(asset, tmb(1)), "SpinPending");

    // settle before the oracle revealed -> RandomnessNotReady
    const cfg = await admin.client.fetchConfig();
    const bonusKp = Keypair.generate();
    const mk = (randomness: PublicKey, bonus: PublicKey | null) =>
      A.client.settleIx({ settler: A.kp.publicKey, asset, owner: A.kp.publicKey, randomness, bonusAsset: bonus, cfg });
    const send = (ixs: anchor.web3.TransactionInstruction[], signers: Keypair[] = []) =>
      A.client.provider.sendAndConfirm(new anchor.web3.Transaction().add(...ixs), signers);
    await fails(send([await mk(first.randomness, bonusKp.publicKey)], [bonusKp]), "RandomnessNotReady");

    // a different randomness account can't be swapped in
    const other = await A.mock.commit(conn, A.client.wallet);
    await fails(
      send([...other.commitIxs, await mk(other.randomness, bonusKp.publicKey)], [...(other.signers as Keypair[]), bonusKp]),
      "StaleRandomness",
    );

    // a cranker can't skew the odds by omitting accounts: bonus asset / prize-token vault ATAs are mandatory
    A.mock.nextValue = MockSwitchboardRandomness.valueFor(WIN, 0n);
    const reveal = await A.mock.reveal(conn, A.client.wallet, first.randomness);
    const noBonus = await mk(first.randomness, bonusKp.publicKey);
    const bi = noBonus.keys.findIndex((k) => k.pubkey.equals(bonusKp.publicKey));
    noBonus.keys[bi] = { pubkey: programId, isSigner: false, isWritable: false }; // Anchor's encoding of `None`
    await fails(send([...reveal, noBonus]), "MissingAccounts");
    const noVaults = await mk(first.randomness, bonusKp.publicKey);
    noVaults.keys.splice(-3); // drop the three prize-token vault ATAs
    await fails(send([...reveal, noVaults], [bonusKp]), "MissingAccounts");

    // now settle properly (loss) so the Bro is free again
    A.mock.nextValue = MockSwitchboardRandomness.valueFor(LOSE);
    const ev = await A.client.settleSpin(asset, first.spinRequest, first.randomness);
    expect(ev.outcome).to.equal(0);
    await invariants();
  });

  it("5b. randomness already revealed at request time is rejected", async () => {
    const asset: PublicKey = (globalThis as any).broA1;
    const commit = await A.mock.commit(conn, A.client.wallet);
    const reveal = await A.mock.reveal(conn, A.client.wallet, commit.randomness);
    const rec = await A.client.fetchBro(asset);
    const ix = await A.client.program.methods
      .requestSpin(FEE)
      .accountsPartial({
        player: A.kp.publicKey,
        config: A.client.pdas.config,
        asset,
        broRecord: A.client.pdas.bro(asset, A.kp.publicKey),
        spinRequest: A.client.pdas.spin(asset, rec!.totalSpins),
        randomnessAccount: commit.randomness,
      })
      .instruction();
    await fails(
      A.client.provider.sendAndConfirm(new anchor.web3.Transaction().add(...commit.commitIxs, ...reveal, ix), commit.signers as Keypair[]),
      "RandomnessAlreadyRevealed",
    );
  });

  it("6. settle: win credits the prize + resets streak; loss increments; tiers + boundaries", async () => {
    const asset = await freshBro(A); // balance 250 -> tier medium (>=200, <500)
    const cfg = await admin.client.fetchConfig();
    const expectTier = computeOddsTier(cfg.thresholds, tmb(250), 0, 0);
    expect(expectTier).to.equal(OddsTier.Medium);

    // loss -> streak 1 (balance 225 -> still medium)
    let ev = await spin(A, asset, LOSE);
    expect(ev.oddsTier).to.equal(OddsTier.Medium);
    expect(ev.newStreak).to.equal(1);

    // boundary: medium odds are 2000 bps -> r1 = 2000 loses, r1 = 1999 wins
    ev = await spin(A, asset, 2000);
    expect(ev.outcome).to.equal(0);
    expect(ev.newStreak).to.equal(2);
    const bal0 = num((await A.client.fetchBro(asset))!.tmbBalance); // 200
    ev = await spin(A, asset, 1999, idx("tmb-10"));
    expect(ev.outcome).to.equal(1);
    expect(ev.wedgeIndex).to.equal(idx("tmb-10"));
    expect(decodeFixed(ev.prizeId)).to.equal("tmb-10");
    expect(ev.newStreak).to.equal(0);
    expect(num(ev.newBalance)).to.equal(bal0 - num(FEE) + num(tmb(10)));
    expect(ev.burned).to.equal(false);

    // token prize -> holding; claim moves the tokens out of the vault
    const holdingsBefore = await tokenBalance(conn, mints.gme, A.kp.publicKey);
    ev = await spin(A, asset, WIN, idx("gme"));
    expect(ev.outcome).to.equal(1);
    expect(ev.wedgeIndex).to.equal(idx("gme"));
    let rec = await A.client.fetchBro(asset);
    expect(rec!.holdings.length).to.equal(1);
    expect(rec!.holdings[0].mint.toBase58()).to.equal(mints.gme.toBase58());
    expect(num(rec!.holdings[0].usdValueSnapshot)).to.equal(15_000_000);
    await fails(
      A.client.program.methods
        .claimHolding(3)
        .accountsPartial({
          player: A.kp.publicKey,
          config: A.client.pdas.config,
          asset,
          broRecord: A.client.pdas.bro(asset, A.kp.publicKey),
          prizeMint: mints.gme,
          vault: A.client.pdas.vault,
          vaultToken: getAssociatedTokenAddressSync(mints.gme, A.client.pdas.vault, true),
          playerToken: getAssociatedTokenAddressSync(mints.gme, A.kp.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      "InvalidHolding",
    );
    await A.client.claimHolding(asset, 0);
    expect((await tokenBalance(conn, mints.gme, A.kp.publicKey)) - holdingsBefore).to.equal(BigInt(tmb(1).toString()));
    rec = await A.client.fetchBro(asset);
    expect(rec!.holdings.length).to.equal(0);

    // bonus bro -> a brand new Core asset owned by the player
    const mintedBefore = (await admin.client.fetchConfig()).minted;
    ev = await spin(A, asset, WIN, idx("bonus"));
    expect(ev.wedgeIndex).to.equal(idx("bonus"));
    expect(await assetOwner(conn, adminKp, ev.bonusAsset)).to.equal(A.kp.publicKey.toBase58());
    expect((await admin.client.fetchConfig()).minted).to.equal(mintedBefore + 1);

    // jackpot
    ev = await spin(A, asset, WIN, idx("tmb-1000"));
    expect(decodeFixed(ev.prizeId)).to.equal("tmb-1000");
    await invariants();
    (globalThis as any).broA2 = asset;
  });

  it("6b. tier thresholds drive the win odds (near-impossible vs high)", async () => {
    // near_impossible (bal 25..49): 200 bps -> r1 = 200 loses, 199 wins
    const poor = await freshBro(C);
    await C.client.withdrawTmb(poor, tmb(200)); // 250 -> 50 (low tier). fee 25 -> 25 left
    let ev = await spin(C, poor, 199, idx("tmb-10")); // pre-spin tier low (800 bps) -> win
    expect(ev.oddsTier).to.equal(OddsTier.Low);
    expect(ev.outcome).to.equal(1);
    // bal now 25 - 25... 50-25+10 = 35 -> near impossible
    const rec = await C.client.fetchBro(poor);
    expect(num(rec!.tmbBalance)).to.equal(num(tmb(35)));
    ev = await spin(C, poor, 200);
    expect(ev.oddsTier).to.equal(OddsTier.NearImpossible);
    expect(ev.outcome).to.equal(0);

    // high: deposit -> >=500
    const rich = await freshBro(B);
    await B.client.depositTmb(rich, tmb(400)); // 650
    ev = await spin(B, rich, 3499, idx("tmb-10"));
    expect(ev.oddsTier).to.equal(OddsTier.High);
    expect(ev.outcome).to.equal(1);
    ev = await spin(B, rich, 3500);
    expect(ev.outcome).to.equal(0);
    await invariants();
  });

  it("7. the 5th consecutive loss atomically burns the Bro", async () => {
    const asset = await freshBro(A);
    const crank = Keypair.generate();
    await airdrop(conn, crank.publicKey, 2);
    for (let i = 1; i <= 4; i++) {
      const ev = await spin(A, asset, LOSE);
      expect(ev.newStreak).to.equal(i);
      expect(ev.burned).to.equal(false);
    }
    // 5th spin is flagged at_stake on-chain
    A.mock.nextValue = MockSwitchboardRandomness.valueFor(LOSE);
    const req = await A.client.requestSpin(asset, FEE);
    const reqEv = (await parseEvents(A.client, req.requestSig)).find((e) => e.name === "spinRequested")!;
    expect(reqEv.data.atStake).to.equal(true);
    expect(reqEv.data.lossStreak).to.equal(4);

    const poolBefore = await admin.client.fetchPool();
    const cfgBefore = await admin.client.fetchConfig();
    const ownerLamports = await conn.getBalance(A.kp.publicKey);
    // a third party cranks the settle (permissionless)
    const ev = await A.client.settleSpin(asset, req.spinRequest, req.randomness, { settler: crank });
    expect(ev.burned).to.equal(true);
    expect(ev.newStreak).to.equal(5);
    expect(ev.outcome).to.equal(0);

    // NFT is gone, record is burned + zeroed, receipt closed, graveyard written
    expect(await assetExists(conn, asset)).to.equal(false);
    const rec = await A.client.fetchBro(asset);
    expect("burned" in rec!.status).to.equal(true);
    expect(rec!.tmbBalance.toString()).to.equal("0");
    expect(rec!.holdings.length).to.equal(0);
    expect(rec!.inEscrow).to.equal(false);
    expect(rec!.pendingSpin).to.equal(null);
    expect(await conn.getAccountInfo(A.client.pdas.escrow(asset))).to.equal(null);
    const grave = await A.client.program.account.graveyard.fetch(A.client.pdas.graveyard(asset));
    expect(grave.lastOwner.toBase58()).to.equal(A.kp.publicKey.toBase58());
    expect(grave.name.startsWith("Bro #")).to.equal(true);
    expect(grave.metadataUri).to.equal("https://example.com/bro.json");

    // remaining balance (250 - 5*25 = 125) joined the pool; owner got the reclaimed rent
    expect((await admin.client.fetchPool()).sub(poolBefore).toString()).to.equal(tmb(125).toString());
    expect((await admin.client.fetchConfig()).totalUserTmb.toString()).to.equal(cfgBefore.totalUserTmb.sub(tmb(125)).toString());
    expect(await conn.getBalance(A.kp.publicKey)).to.be.greaterThan(ownerLamports);

    // a burned Bro can't do anything any more
    await fails(A.client.depositTmb(asset, tmb(1)), "BroBurned");
    await fails(A.client.requestSpin(asset, FEE), "BroBurned");
    (globalThis as any).burnedA = asset;
    await invariants();
  });

  it("8. cancel_stale_spin counts as a loss", async () => {
    const asset = await freshBro(B);
    B.mock.nextValue = MockSwitchboardRandomness.valueFor(WIN, r2For(prizes, idx("tmb-1000")));
    const req = await B.client.requestSpin(asset, FEE);
    await fails(C.client.cancelStaleSpin(asset, B.kp.publicKey), "SpinNotStale");

    const cfg = await admin.client.fetchConfig();
    await waitSlots(conn, num(cfg.staleSlots) + 2);
    // even a winning reveal can't be claimed late: anyone may cancel and it is a loss
    const ev = await C.client.cancelStaleSpin(asset, B.kp.publicKey);
    expect(ev.outcome).to.equal(2);
    expect(ev.newStreak).to.equal(1);
    expect(ev.wedgeIndex).to.equal(rektIndex);
    const rec = await B.client.fetchBro(asset);
    expect(rec!.pendingSpin).to.equal(null);
    expect(num(rec!.tmbBalance)).to.equal(num(tmb(225))); // fee was never refunded
    expect(await conn.getAccountInfo(req.spinRequest)).to.equal(null);
    await invariants();
  });

  it("9. payout guard blocks / downgrades prizes that would breach the reserve", async () => {
    const asset = await freshBro(B);
    const P = (a: number) => tmb(a);

    // (a) reserve leaves room for <= 60 TMB: 150 / 1000 wedges are ineligible -> a different prize hits
    B.mock.nextValue = MockSwitchboardRandomness.valueFor(WIN, r2For(prizes, idx("tmb-1000")));
    const req = await B.client.requestSpin(asset, FEE);
    const pool = await admin.client.fetchPool();
    await admin.client.updateConfig({ minReserve: pool.sub(P(60)) });
    B.mock.nextValue = MockSwitchboardRandomness.valueFor(WIN, r2For(prizes, idx("tmb-1000")));
    let ev = await B.client.settleSpin(asset, req.spinRequest, req.randomness);
    expect(ev.outcome).to.equal(1);
    expect(ev.wedgeIndex).to.not.equal(idx("tmb-1000"));
    expect(ev.wedgeIndex).to.not.equal(idx("tmb-150"));
    const kind = prizeKindName(prizes[ev.wedgeIndex].kind);
    if (kind === "tmb") expect(num(prizes[ev.wedgeIndex].amount)).to.be.at.most(num(P(60)));

    // (b) block everything: TMB (reserve = pool), tokens (0 bps), bonus (max supply) -> forced win becomes a loss
    const cfg = await admin.client.fetchConfig();
    await admin.client.updateConfig({ minReserve: (await admin.client.fetchPool()).add(P(1_000_000)), maxPayoutBps: 0, maxSupply: cfg.minted });
    const before = (await B.client.fetchBro(asset))!;
    const streak0 = before.lossStreak;
    ev = await spin(B, asset, WIN, idx("tmb-10"));
    expect(ev.outcome).to.equal(0);
    expect(ev.wedgeIndex).to.equal(rektIndex);
    expect(ev.newStreak).to.equal(streak0 + 1);
    expect((await B.client.fetchBro(asset))!.holdings.length).to.equal(before.holdings.length);

    // restore
    await admin.client.updateConfig({ minReserve: P(1000), maxPayoutBps: 200, maxSupply: 10_000 });
    await invariants();
  });

  it("10. rescue burns exactly 50% (SPL supply drops), credits 50%, re-mints to the last owner", async () => {
    const burned: PublicKey = (globalThis as any).burnedA;
    const rescuerBro = await freshBro(C);
    const fee = tmb(100);

    await fails(C.client.rescue(rescuerBro, burned, tmb(123)), "InvalidRescueFee");

    // self rescue: A (last owner) can't rescue their own Bro
    const aBro = await freshBro(A);
    await fails(A.client.rescue(aBro, burned, fee), "SelfRescue");

    // not burned: a live asset has no graveyard entry
    const live: PublicKey = (globalThis as any).broA1;
    await failsAny(C.client.rescue(rescuerBro, live, fee), "Account does not exist", "AccountNotInitialized", "3012");

    const supplyBefore = await supply(conn, tmbMint);
    const recBefore = await C.client.fetchBro(rescuerBro);
    const { newAsset } = await C.client.rescue(rescuerBro, burned, fee);

    expect(supplyBefore - (await supply(conn, tmbMint))).to.equal(BigInt(tmb(50).toString()));
    expect(await assetOwner(conn, adminKp, newAsset)).to.equal(A.kp.publicKey.toBase58());
    const recNew = await A.client.fetchBro(newAsset);
    expect(recNew!.lossStreak).to.equal(0);
    expect("active" in recNew!.status).to.equal(true);
    expect(recNew!.tmbBalance.toString()).to.equal(tmb(50).toString());
    expect((await C.client.fetchBro(rescuerBro))!.tmbBalance.toString()).to.equal(recBefore!.tmbBalance.sub(fee).toString());
    expect(await conn.getAccountInfo(A.client.pdas.graveyard(burned))).to.equal(null);
    // second rescue of the same Bro is impossible
    await failsAny(C.client.rescue(rescuerBro, burned, fee), "Account does not exist", "AccountNotInitialized", "3012");
    const asset = await A.client.program.account.graveyard.all();
    expect(asset.length).to.equal(0);
    await invariants();
  });

  it("11. admin role checks", async () => {
    // pauser can only pause
    await D.client.setPaused(true);
    await fails(D.client.setPaused(false), "Unauthorized");
    await fails(D.client.setPrizes(prizes), "Unauthorized");
    await fails(D.client.updateConfig({ staleSlots: new BN(5) }), "Unauthorized");
    await admin.client.setPaused(false);

    // reward wallet: may edit prizes + fund, may NOT withdraw
    await R.client.setPrizes(prizes);
    await R.client.fundVault(tmbMint, tmb(1_000));
    await fails(R.client.withdrawVault(tmbMint, tmb(1)), "Unauthorized");
    await fails(R.client.updateConfig({ staleSlots: new BN(5) }), "Unauthorized");
    await fails(R.client.setRoles({ pauser: R.kp.publicKey }), "Unauthorized");

    // authority can withdraw, but never below the reserve
    const pool = await admin.client.fetchPool();
    await fails(admin.client.withdrawVault(tmbMint, pool), "PoolReserveBreached");
    await fails(admin.client.withdrawVault(tmbMint, pool.sub(tmb(999))), "PoolReserveBreached");
    await admin.client.withdrawVault(tmbMint, tmb(1_000));

    // random wallets can't touch anything
    await fails(B.client.updateConfig({ maxPayoutBps: 10_000 }), "Unauthorized");
    await fails(B.client.setPaused(true), "Unauthorized");
    await fails(B.client.createCollection("x", "y"), "Unauthorized");

    // invalid config values are rejected
    await fails(admin.client.updateConfig({ oddsBps: [20_000, 0, 0, 0] }), "InvalidConfig");
    await fails(admin.client.updateConfig({ burnAtLossStreak: 0 }), "InvalidConfig");

    // two-step authority hand-over
    await admin.client.proposeAuthority(X.kp.publicKey);
    await fails(B.client.acceptAuthority(), "Unauthorized");
    await X.client.acceptAuthority();
    expect((await admin.client.fetchConfig()).authority.toBase58()).to.equal(X.kp.publicKey.toBase58());
    await fails(admin.client.setPaused(true), "Unauthorized");
    await X.client.proposeAuthority(adminKp.publicKey);
    await admin.client.acceptAuthority();
    expect((await admin.client.fetchConfig()).authority.toBase58()).to.equal(adminKp.publicKey.toBase58());
    await invariants();
  });

  it("12. exportAddresses matches the admin panel Networks form", async () => {
    const out = await admin.client.exportAddresses(conn.rpcEndpoint);
    expect(Object.keys(out).sort()).to.deep.equal(
      ["admin_authority", "cluster", "collection_address", "game_program_id", "reward_vault", "rpc_url", "tmb_mint", "treasury_wallet"].sort(),
    );
    expect(out.game_program_id).to.equal(programId.toBase58());
    expect(out.collection_address).to.equal(collection.toBase58());
  });
});
