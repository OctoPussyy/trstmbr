import { AnchorProvider, BN, EventParser, Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { TmbGame } from "./idl/tmb_game";
import idlJson from "./idl/tmb_game.json";
import { computeOddsTier } from "./odds";
import { MPL_CORE_PROGRAM_ID, TmbPdas, findPdas } from "./pdas";
import { prizeKindName } from "./prizes";
import { RandomnessProvider, SwitchboardRandomness } from "./randomness";
import {
  BroRecord,
  BroView,
  Cluster,
  Config,
  NetworkConfigJson,
  OddsTier,
  Prize,
  Rescued,
  SpinSettled,
  WalletLike,
} from "./types";

export * from "./types";
export * from "./pdas";
export * from "./odds";
export * from "./prizes";
export * from "./randomness";
export * from "./mock";
export type { TmbGame } from "./idl/tmb_game";
export { idlJson as tmbIdl };

export type ConfigArgs = Parameters<Program<TmbGame>["methods"]["initialize"]>[0];
export type UpdateConfigArgs = Parameters<Program<TmbGame>["methods"]["updateConfig"]>[0];

export interface TmbClientOptions {
  randomness?: RandomnessProvider;
  commitment?: "processed" | "confirmed" | "finalized";
}

export interface SpinOptions {
  /** Pays for + signs the reveal/settle tx instead of the wallet (a session key or crank). */
  settler?: Keypair;
  /** Called after the request tx confirms and before waiting for the oracle. */
  onRequested?: (signature: string) => void;
  /** Compute unit limit for the settle tx. */
  settleComputeUnits?: number;
}

const enc = (s: string) => Buffer.from(s);

export class TmbClient {
  readonly connection: Connection;
  readonly wallet: WalletLike;
  readonly programId: PublicKey;
  readonly cluster: Cluster;
  readonly provider: AnchorProvider;
  readonly program: Program<TmbGame>;
  readonly pdas: TmbPdas;
  randomness: RandomnessProvider;
  private tokenProgramCache = new Map<string, PublicKey>();

  constructor(
    connection: Connection,
    wallet: WalletLike,
    programId: PublicKey,
    cluster: Cluster,
    opts: TmbClientOptions = {},
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = programId;
    this.cluster = cluster;
    this.provider = new AnchorProvider(connection, wallet as any, {
      commitment: opts.commitment ?? "confirmed",
      preflightCommitment: opts.commitment ?? "confirmed",
    });
    this.program = new Program<TmbGame>({ ...(idlJson as any), address: programId.toBase58() }, this.provider);
    this.pdas = findPdas(programId);
    this.randomness = opts.randomness ?? new SwitchboardRandomness();
  }

  get me(): PublicKey {
    return this.wallet.publicKey;
  }

  // ---------------------------------------------------------------------------------------------
  // reads
  // ---------------------------------------------------------------------------------------------

  async fetchConfig(): Promise<Config> {
    return (await this.program.account.config.fetch(this.pdas.config)) as unknown as Config;
  }

  async fetchPrizes(): Promise<Prize[]> {
    return (await this.program.account.prizeTable.fetch(this.pdas.prizes)).entries as unknown as Prize[];
  }

  async fetchBro(asset: PublicKey, owner: PublicKey = this.me): Promise<BroRecord | null> {
    return (await this.program.account.broRecord.fetchNullable(this.pdas.bro(asset, owner))) as unknown as BroRecord | null;
  }

  async fetchGraveyard() {
    return this.program.account.graveyard.all();
  }

  /** Vault TMB minus every Bro balance: what prizes/withdrawals may draw on. */
  async fetchPool(): Promise<BN> {
    const cfg = await this.fetchConfig();
    const vaultTmb = getAssociatedTokenAddressSync(cfg.tmbMint, this.pdas.vault, true, await this.tokenProgramFor(cfg.tmbMint));
    const bal = await this.connection.getTokenAccountBalance(vaultTmb);
    const pool = new BN(bal.value.amount).sub(cfg.totalUserTmb);
    return pool.isNeg() ? new BN(0) : pool;
  }

  /** Wallet-held + escrowed Bros for `owner`, joined with their BroRecords. */
  async fetchBrosForOwner(owner: PublicKey = this.me): Promise<BroView[]> {
    const cfg = await this.fetchConfig();
    const umi = await this.umi();
    const { getAssetV1GpaBuilder, fetchAssetV1, updateAuthority, Key } = await import("@metaplex-foundation/mpl-core");
    const { publicKey: umiPk } = await import("@metaplex-foundation/umi");

    // 1. wallet-held assets of our collection
    const held = await getAssetV1GpaBuilder(umi)
      .whereField("key", Key.AssetV1)
      .whereField("owner", umiPk(owner.toBase58()))
      .whereField("updateAuthority", updateAuthority("Collection", [umiPk(cfg.collection.toBase58())]))
      .getDeserialized();

    // 2. records + escrow receipts for this owner
    const records = (await this.program.account.broRecord.all([
      { memcmp: { offset: 8 + 32, bytes: owner.toBase58() } },
    ])) as unknown as { publicKey: PublicKey; account: BroRecord }[];
    const byAsset = new Map(records.map((r) => [r.account.asset.toBase58(), r.account]));

    const out: BroView[] = [];
    const tier = (r: BroRecord | null) =>
      r
        ? computeOddsTier(
            cfg.thresholds,
            r.tmbBalance,
            r.holdings.length,
            r.holdings.reduce((a, h) => a.add(h.usdValueSnapshot), new BN(0)),
          )
        : OddsTier.NearImpossible;

    for (const a of held) {
      const rec = byAsset.get(a.publicKey.toString()) ?? null;
      out.push({
        asset: new PublicKey(a.publicKey.toString()),
        name: a.name,
        uri: a.uri,
        location: "wallet",
        record: rec,
        oddsTier: tier(rec),
      });
    }
    for (const r of records) {
      if (!r.account.inEscrow || "burned" in r.account.status) continue;
      const a = await fetchAssetV1(umi, umiPk(r.account.asset.toBase58()));
      out.push({
        asset: r.account.asset,
        name: a.name,
        uri: a.uri,
        location: "escrow",
        record: r.account,
        oddsTier: tier(r.account),
      });
    }
    return out;
  }

  private async umi() {
    const { createUmi } = await import("@metaplex-foundation/umi-bundle-defaults");
    const { mplCore } = await import("@metaplex-foundation/mpl-core");
    return createUmi(this.connection.rpcEndpoint, { commitment: this.provider.opts.commitment ?? "confirmed" }).use(mplCore());
  }

  async tokenProgramFor(mint: PublicKey): Promise<PublicKey> {
    const k = mint.toBase58();
    const hit = this.tokenProgramCache.get(k);
    if (hit) return hit;
    const info = await this.connection.getAccountInfo(mint);
    if (!info) throw new Error(`mint ${k} not found`);
    const p = info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    this.tokenProgramCache.set(k, p);
    return p;
  }

  // ---------------------------------------------------------------------------------------------
  // player actions
  // ---------------------------------------------------------------------------------------------

  async mintBro(name: string, uri: string): Promise<{ signature: string; asset: PublicKey }> {
    const cfg = await this.fetchConfig();
    const asset = Keypair.generate();
    const tokenProgram = await this.tokenProgramFor(cfg.tmbMint);
    const signature = await this.program.methods
      .mintBro(name, uri)
      .accountsPartial({
        player: this.me,
        config: this.pdas.config,
        asset: asset.publicKey,
        collection: cfg.collection,
        treasury: cfg.treasury,
        teamWallet: cfg.teamWallet,
        broRecord: this.pdas.bro(asset.publicKey, this.me),
        vault: this.pdas.vault,
        tmbMint: cfg.tmbMint,
        vaultTmb: getAssociatedTokenAddressSync(cfg.tmbMint, this.pdas.vault, true, tokenProgram),
        tokenProgram,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([asset])
      .rpc();
    return { signature, asset: asset.publicKey };
  }

  async depositBro(asset: PublicKey): Promise<string> {
    const cfg = await this.fetchConfig();
    return this.program.methods
      .depositBro()
      .accountsPartial({
        player: this.me,
        config: this.pdas.config,
        asset,
        collection: cfg.collection,
        escrowReceipt: this.pdas.escrow(asset),
        broRecord: this.pdas.bro(asset, this.me),
        escrowAuth: this.pdas.escrowAuth,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async withdrawBro(asset: PublicKey): Promise<string> {
    const cfg = await this.fetchConfig();
    return this.program.methods
      .withdrawBro()
      .accountsPartial({
        player: this.me,
        config: this.pdas.config,
        asset,
        collection: cfg.collection,
        broRecord: this.pdas.bro(asset, this.me),
        escrowReceipt: this.pdas.escrow(asset),
        escrowAuth: this.pdas.escrowAuth,
        owner: this.me,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  private async tmbAccounts(asset: PublicKey) {
    const cfg = await this.fetchConfig();
    const tokenProgram = await this.tokenProgramFor(cfg.tmbMint);
    return {
      player: this.me,
      config: this.pdas.config,
      asset,
      broRecord: this.pdas.bro(asset, this.me),
      tmbMint: cfg.tmbMint,
      playerTmb: getAssociatedTokenAddressSync(cfg.tmbMint, this.me, false, tokenProgram),
      vault: this.pdas.vault,
      vaultTmb: getAssociatedTokenAddressSync(cfg.tmbMint, this.pdas.vault, true, tokenProgram),
      tokenProgram,
    };
  }

  /** wallet -> Bro balance (the website's "top up"). `amount` in TMB base units. */
  async depositTmb(asset: PublicKey, amount: BN | number | bigint): Promise<string> {
    return this.program.methods.depositTmb(new BN(amount.toString())).accountsPartial(await this.tmbAccounts(asset)).rpc();
  }

  async withdrawTmb(asset: PublicKey, amount: BN | number | bigint): Promise<string> {
    return this.program.methods.withdrawTmb(new BN(amount.toString())).accountsPartial(await this.tmbAccounts(asset)).rpc();
  }

  async claimHolding(asset: PublicKey, index: number): Promise<string> {
    const rec = await this.fetchBro(asset);
    if (!rec || !rec.holdings[index]) throw new Error("no such holding");
    const mint = rec.holdings[index].mint;
    const tokenProgram = await this.tokenProgramFor(mint);
    return this.program.methods
      .claimHolding(index)
      .accountsPartial({
        player: this.me,
        config: this.pdas.config,
        asset,
        broRecord: this.pdas.bro(asset, this.me),
        prizeMint: mint,
        vault: this.pdas.vault,
        vaultToken: getAssociatedTokenAddressSync(mint, this.pdas.vault, true, tokenProgram),
        playerToken: getAssociatedTokenAddressSync(mint, this.me, false, tokenProgram),
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Full spin: commit + request (one wallet prompt), wait for the oracle reveal, then settle.
   * Resolves with the decoded `SpinSettled` event. `amount` is in TMB base units.
   */
  async spin(asset: PublicKey, amount: BN | number | bigint, opts: SpinOptions = {}): Promise<SpinSettled> {
    const { requestSig, spinRequest, randomness } = await this.requestSpin(asset, amount);
    opts.onRequested?.(requestSig);
    return this.settleSpin(asset, spinRequest, randomness, opts);
  }

  /** Step 1 of `spin`. Exposed so UIs can animate between request and settle. */
  async requestSpin(asset: PublicKey, amount: BN | number | bigint) {
    const rec = await this.fetchBro(asset);
    if (!rec) throw new Error("no BroRecord for this wallet/asset (deposit the Bro first)");
    const commit = await this.randomness.commit(this.connection, this.wallet);
    const spinRequest = this.pdas.spin(asset, rec.totalSpins);
    const requestIx = await this.program.methods
      .requestSpin(new BN(amount.toString()))
      .accountsPartial({
        player: this.me,
        config: this.pdas.config,
        asset,
        broRecord: this.pdas.bro(asset, this.me),
        spinRequest,
        randomnessAccount: commit.randomness,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ...commit.commitIxs, requestIx);
    const requestSig = await this.provider.sendAndConfirm(tx, commit.signers as Signer[]);
    return { requestSig, spinRequest, randomness: commit.randomness };
  }

  /** Step 2 of `spin` (permissionless: any wallet may crank it). */
  async settleSpin(
    asset: PublicKey,
    spinRequest: PublicKey,
    randomness: PublicKey,
    opts: SpinOptions & { owner?: PublicKey } = {},
  ): Promise<SpinSettled> {
    const cfg = await this.fetchConfig();
    const owner = opts.owner ?? this.me;
    const payer = opts.settler?.publicKey ?? this.me;
    const revealIxs = await this.randomness.reveal(this.connection, this.wallet, randomness);
    const bonusAsset = Keypair.generate();
    const settleIx = await this.settleIx({ settler: payer, asset, owner, randomness, bonusAsset: bonusAsset.publicKey, cfg });
    // Switchboard's reveal ix is large, so it goes in its own tx (a combined tx exceeds 1232 bytes).
    const send = async (ixs: TransactionInstruction[], extra: Signer[]) => {
      const tx = new Transaction().add(...ixs);
      if (opts.settler) return sendAndConfirmTransaction(this.connection, tx, [opts.settler, ...extra], { commitment: "confirmed" });
      return this.provider.sendAndConfirm(tx, extra);
    };
    await send([ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), ...revealIxs], []);
    const sig = await send([ComputeBudgetProgram.setComputeUnitLimit({ units: opts.settleComputeUnits ?? 600_000 }), settleIx], [bonusAsset]);
    return this.readSettled(sig);
  }

  async settleIx(p: {
    settler: PublicKey;
    asset: PublicKey;
    owner: PublicKey;
    randomness: PublicKey;
    bonusAsset: PublicKey | null;
    cfg: Config;
  }): Promise<TransactionInstruction> {
    const { cfg } = p;
    const tokenProgram = await this.tokenProgramFor(cfg.tmbMint);
    const remaining = await this.prizeVaultAccounts();
    const hasBonus = (await this.fetchPrizes()).some((p) => prizeKindName(p.kind) === "bonusBro");
    if (hasBonus && !p.bonusAsset) throw new Error("bonusAsset is required while the wheel has a Bonus Bro wedge");
    return this.program.methods
      .settleSpin()
      .accountsPartial({
        settler: p.settler,
        config: this.pdas.config,
        prizes: this.pdas.prizes,
        broRecord: this.pdas.bro(p.asset, p.owner),
        spinRequest: await this.spinRequestFor(p.asset, p.owner),
        owner: p.owner,
        escrowReceipt: this.pdas.escrow(p.asset),
        graveyard: this.pdas.graveyard(p.asset),
        asset: p.asset,
        collection: cfg.collection,
        randomnessAccount: p.randomness,
        escrowAuth: this.pdas.escrowAuth,
        vault: this.pdas.vault,
        tmbMint: cfg.tmbMint,
        vaultTmb: getAssociatedTokenAddressSync(cfg.tmbMint, this.pdas.vault, true, tokenProgram),
        bonusAsset: p.bonusAsset,
        tokenProgram,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remaining)
      .instruction();
  }

  private async spinRequestFor(asset: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const rec = await this.fetchBro(asset, owner);
    if (!rec?.pendingSpin) throw new Error("no pending spin for this Bro");
    return rec.pendingSpin;
  }

  /** Vault ATAs of every distinct Token prize mint (the program validates each by re-deriving it). */
  private async prizeVaultAccounts() {
    const prizes = await this.fetchPrizes();
    const mints = new Map<string, PublicKey>();
    for (const p of prizes) if (prizeKindName(p.kind) === "token") mints.set(p.mint.toBase58(), p.mint);
    const out: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
    for (const m of mints.values()) {
      const tp = await this.tokenProgramFor(m);
      out.push({ pubkey: getAssociatedTokenAddressSync(m, this.pdas.vault, true, tp), isWritable: false, isSigner: false });
    }
    return out;
  }

  /** Anyone may call this once `staleSlots` have passed; it counts as a loss. */
  async cancelStaleSpin(asset: PublicKey, owner: PublicKey): Promise<SpinSettled> {
    const cfg = await this.fetchConfig();
    const sig = await this.program.methods
      .cancelStaleSpin()
      .accountsPartial({
        settler: this.me,
        config: this.pdas.config,
        prizes: this.pdas.prizes,
        broRecord: this.pdas.bro(asset, owner),
        spinRequest: await this.spinRequestFor(asset, owner),
        owner,
        escrowReceipt: this.pdas.escrow(asset),
        graveyard: this.pdas.graveyard(asset),
        asset,
        collection: cfg.collection,
        escrowAuth: this.pdas.escrowAuth,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .rpc();
    return this.readSettled(sig);
  }

  /** Rescue `burnedAsset` using the Bro `rescuerAsset` (must be staked with enough balance). */
  async rescue(rescuerAsset: PublicKey, burnedAsset: PublicKey, fee: BN | number | bigint): Promise<{ signature: string; newAsset: PublicKey }> {
    const cfg = await this.fetchConfig();
    const grave = await this.program.account.graveyard.fetch(this.pdas.graveyard(burnedAsset));
    const newAsset = Keypair.generate();
    const tokenProgram = await this.tokenProgramFor(cfg.tmbMint);
    const signature = await this.program.methods
      .rescue(new BN(fee.toString()))
      .accountsPartial({
        rescuer: this.me,
        config: this.pdas.config,
        rescuerAsset,
        rescuerBro: this.pdas.bro(rescuerAsset, this.me),
        graveyard: this.pdas.graveyard(burnedAsset),
        newAsset: newAsset.publicKey,
        lastOwner: grave.lastOwner,
        newBroRecord: this.pdas.bro(newAsset.publicKey, grave.lastOwner),
        collection: cfg.collection,
        vault: this.pdas.vault,
        tmbMint: cfg.tmbMint,
        vaultTmb: getAssociatedTokenAddressSync(cfg.tmbMint, this.pdas.vault, true, tokenProgram),
        tokenProgram,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([newAsset])
      .rpc();
    return { signature, newAsset: newAsset.publicKey };
  }

  // ---------------------------------------------------------------------------------------------
  // events
  // ---------------------------------------------------------------------------------------------

  /** Decodes the SpinSettled event out of a confirmed transaction. */
  async readSettled(signature: string): Promise<SpinSettled> {
    const tx = await this.connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx?.meta?.logMessages) throw new Error(`transaction ${signature} not found`);
    const parser = new EventParser(this.programId, this.program.coder);
    for (const ev of parser.parseLogs(tx.meta.logMessages)) {
      if (ev.name === "spinSettled") return ev.data as unknown as SpinSettled;
    }
    throw new Error("SpinSettled event not found in transaction logs");
  }

  onSpinSettled(cb: (e: SpinSettled, slot: number, signature: string) => void): number {
    return this.program.addEventListener("spinSettled", cb as any);
  }
  onRescued(cb: (e: Rescued, slot: number, signature: string) => void): number {
    return this.program.addEventListener("rescued", cb as any);
  }
  async removeListener(id: number) {
    await this.program.removeEventListener(id);
  }

  // ---------------------------------------------------------------------------------------------
  // admin
  // ---------------------------------------------------------------------------------------------

  async initialize(tmbMint: PublicKey, args: ConfigArgs): Promise<string> {
    const tokenProgram = await this.tokenProgramFor(tmbMint);
    return this.program.methods
      .initialize(args)
      .accountsPartial({
        authority: this.me,
        config: this.pdas.config,
        prizes: this.pdas.prizes,
        vault: this.pdas.vault,
        escrowAuth: this.pdas.escrowAuth,
        tmbMint,
        vaultTmb: getAssociatedTokenAddressSync(tmbMint, this.pdas.vault, true, tokenProgram),
        program: this.programId,
        programData: this.pdas.programData,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async createCollection(name: string, uri: string): Promise<{ signature: string; collection: PublicKey }> {
    const collection = Keypair.generate();
    const signature = await this.program.methods
      .createCollection(name, uri)
      .accountsPartial({
        authority: this.me,
        config: this.pdas.config,
        collection: collection.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([collection])
      .rpc();
    return { signature, collection: collection.publicKey };
  }

  async updateConfig(args: Partial<UpdateConfigArgs>): Promise<string> {
    const full: any = {
      treasury: null, teamWallet: null, burnAtLossStreak: null, spinAmounts: null, oddsBps: null,
      thresholds: null, rescueBurnBps: null, rescueFeeOptions: null, maxPayoutBps: null, minReserve: null,
      mintPriceLamports: null, mintPoolShareBps: null, mintStartingBalance: null, maxSupply: null,
      transferCooldownSlots: null, staleSlots: null, bonusUri: null,
      ...args,
    };
    return this.program.methods
      .updateConfig(full)
      .accountsPartial({ authority: this.me, config: this.pdas.config })
      .rpc();
  }

  async setRoles(roles: { rewardWallet?: PublicKey; pauser?: PublicKey }): Promise<string> {
    return this.program.methods
      .setRoles(roles.rewardWallet ?? null, roles.pauser ?? null)
      .accountsPartial({ authority: this.me, config: this.pdas.config })
      .rpc();
  }

  async proposeAuthority(next: PublicKey): Promise<string> {
    return this.program.methods.proposeAuthority(next).accountsPartial({ authority: this.me, config: this.pdas.config }).rpc();
  }

  async acceptAuthority(): Promise<string> {
    return this.program.methods.acceptAuthority().accountsPartial({ newAuthority: this.me, config: this.pdas.config }).rpc();
  }

  async setPaused(paused: boolean): Promise<string> {
    return this.program.methods.setPaused(paused).accountsPartial({ signer: this.me, config: this.pdas.config }).rpc();
  }

  /**
   * Writes the whole wheel. Tables that don't fit in one transaction are sent in chunks of
   * `chunkSize`; the program validates the complete table on the last chunk and blocks spins until
   * then (fail-closed). Pause the game first when replacing a live table with >1 chunk.
   */
  async setPrizes(entries: Prize[], chunkSize = 8): Promise<string[]> {
    const sigs: string[] = [];
    const chunks: Prize[][] = [];
    for (let i = 0; i < Math.max(entries.length, 1); i += chunkSize) chunks.push(entries.slice(i, i + chunkSize));
    for (let i = 0; i < chunks.length; i++) {
      sigs.push(
        await this.program.methods
          .setPrizes(chunks[i] as any, i > 0, i === chunks.length - 1)
          .accountsPartial({ signer: this.me, config: this.pdas.config, prizes: this.pdas.prizes })
          .rpc(),
      );
    }
    return sigs;
  }

  /** reward_wallet/authority moves `amount` of `mint` from its own ATA into the vault. */
  async fundVault(mint: PublicKey, amount: BN | number | bigint): Promise<string> {
    const tokenProgram = await this.tokenProgramFor(mint);
    return this.program.methods
      .fundVault(new BN(amount.toString()))
      .accountsPartial({
        funder: this.me,
        config: this.pdas.config,
        mint,
        source: getAssociatedTokenAddressSync(mint, this.me, false, tokenProgram),
        vault: this.pdas.vault,
        vaultToken: getAssociatedTokenAddressSync(mint, this.pdas.vault, true, tokenProgram),
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async withdrawVault(mint: PublicKey, amount: BN | number | bigint, destination?: PublicKey): Promise<string> {
    const tokenProgram = await this.tokenProgramFor(mint);
    return this.program.methods
      .withdrawVault(new BN(amount.toString()))
      .accountsPartial({
        authority: this.me,
        config: this.pdas.config,
        mint,
        vault: this.pdas.vault,
        vaultToken: getAssociatedTokenAddressSync(mint, this.pdas.vault, true, tokenProgram),
        destination: destination ?? getAssociatedTokenAddressSync(mint, this.me, false, tokenProgram),
        tokenProgram,
      })
      .rpc();
  }

  /** JSON in the exact shape of the admin panel "Networks" form / `network_config` table. */
  async exportAddresses(rpcUrl: string): Promise<NetworkConfigJson> {
    const cfg = await this.fetchConfig();
    return {
      cluster: this.cluster,
      rpc_url: rpcUrl,
      game_program_id: this.programId.toBase58(),
      tmb_mint: cfg.tmbMint.toBase58(),
      collection_address: cfg.collection.toBase58(),
      reward_vault: this.pdas.vault.toBase58(),
      treasury_wallet: cfg.treasury.toBase58(),
      admin_authority: cfg.authority.toBase58(),
    };
  }
}
export * from "./params";
export * from "./bros";
