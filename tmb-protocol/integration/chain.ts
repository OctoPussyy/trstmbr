/**
 * `src/lib/chain.ts` for the Trust Me Bros web app.
 *
 * When the ACTIVE network's `network.game_program_id` is set (from `getPublicConfig`), the UI calls these
 * helpers with the connected wallet INSTEAD of the server functions in `game.functions.ts`. Every helper
 * returns exactly the shape its server-function twin returns:
 *
 *   getPlayerState  -> getPlayerStateChain(client)
 *   spinWheel       -> spinWheelChain(client, nftId, amount)
 *   rescueNft       -> rescueNftChain(client, rescuerNftId, burnedNftId, fee)
 *   topUpNft        -> topUpNftChain(client, nftId, amount)
 *   setBroEscrow    -> setBroEscrowChain(client, nftId, status)
 *   mintNft         -> mintNftChain(client, artKey?)
 *
 * Differences vs the off-chain path (unavoidable): ids are base58 (asset address), not uuids, and the
 * player id is `sol_<wallet>`. The chain decides every outcome; the wheel only animates `landingWedgeId`
 * (= wedge index as a string = the `prizePool[i].id` of the same call).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  BroRecord,
  BroView,
  Cluster,
  ODDS_LABELS,
  SpinSettled,
  TmbClient,
  WalletLike,
  decodeFixed,
  pickBro,
  prizeKindName,
} from "@tmb/sdk";

const DECIMALS = 6;
const ui = (base: { toString(): string }) => Number(base.toString()) / 10 ** DECIMALS;
const toBase = (whole: number) => Math.round(whole * 10 ** DECIMALS);

/** Row of `getPublicConfig().network`. Adjust the property names if your `network` object differs. */
export interface NetworkRow {
  cluster?: Cluster;
  rpc_url: string;
  game_program_id?: string | null;
  assets_base_url?: string | null; // where assets/bros is hosted (see README); needed for mintNft
}

/** null => no program on this network: keep using the off-chain server functions. */
export function chainClient(net: NetworkRow, activeNetwork: "devnet" | "mainnet", wallet: WalletLike): TmbClient | null {
  if (!net.game_program_id) return null;
  return new TmbClient(
    new Connection(net.rpc_url, "confirmed"),
    wallet,
    new PublicKey(net.game_program_id),
    net.cluster ?? activeNetwork,
  );
}

// ------------------------------------------------------------------------------------------------
// mapping helpers
// ------------------------------------------------------------------------------------------------

type PrizeType = "stock" | "nft" | "tmb_token" | "none";
const PRIZE_TYPE: Record<"none" | "tmb" | "token" | "bonusBro", PrizeType> = {
  none: "none",
  tmb: "tmb_token",
  token: "stock",
  bonusBro: "nft",
};

/** Player identity is the connected wallet (`sol_<address>`), as in the existing app. */
export const playerIdFor = (wallet: PublicKey) => `sol_${wallet.toBase58()}`;

/**
 * Bro metadata uri -> `art_key`. The Bro art variants are 1..5 (assets/bros/N.png), so the key is
 * "bro-N". CHANGE THIS ONE FUNCTION if your app's art keys are named differently.
 */
export function artKeyFromUri(uri: string): string {
  const m = /\/(\d+)\.json$/.exec(uri);
  return m ? `bro-${m[1]}` : uri;
}
/** Inverse, for mintNft(artKey): "bro-3" / "3" -> 3 */
const variantFromArtKey = (k?: string) => {
  const n = k ? Number(/(\d+)$/.exec(k)?.[1]) : NaN;
  return n >= 1 && n <= 5 ? n : undefined;
};

async function prizeIndex(client: TmbClient) {
  const prizes = await client.fetchPrizes();
  const tickerByMint = new Map<string, string>();
  for (const p of prizes) {
    if (prizeKindName(p.kind) === "token") tickerByMint.set(p.mint.toBase58(), decodeFixed(p.id).toUpperCase());
  }
  return { prizes, tickerByMint };
}

function nftView(
  b: { asset: PublicKey; name: string; uri: string; location: "wallet" | "escrow"; record: BroRecord | null; oddsTier: number },
  ownerId: string,
  tickerByMint: Map<string, string>,
) {
  const rec = b.record;
  return {
    id: b.asset.toBase58(),
    name: b.name,
    art_key: artKeyFromUri(b.uri),
    owner_id: ownerId,
    tmb_balance: rec ? ui(rec.tmbBalance) : 0,
    stock_holdings: (rec?.holdings ?? []).map((h) => ({
      ticker: tickerByMint.get(h.mint.toBase58()) ?? h.mint.toBase58().slice(0, 4),
      value: ui(h.usdValueSnapshot),
    })),
    loss_streak: rec?.lossStreak ?? 0,
    status: (rec && "burned" in rec.status ? "burned" : "active") as "active" | "burned",
    escrow_status: b.location,
    odds_tier: ODDS_LABELS[b.oddsTier] as string,
    odds_label: ODDS_LABELS[b.oddsTier] as string,
  };
}

function prizeRow(p: Awaited<ReturnType<TmbClient["fetchPrizes"]>>[number], i: number) {
  const kind = prizeKindName(p.kind);
  return {
    id: String(i), // wedge index == prizePool row == wheel wedge (clockwise from 12 o'clock)
    label: decodeFixed(p.label),
    prize_type: PRIZE_TYPE[kind],
    // stock: USD value; tmb_token: TMB amount; nft: count; none: 0
    value: kind === "token" ? ui(p.usdValue) : kind === "tmb" ? ui(p.amount) : kind === "bonusBro" ? Number(p.amount.toString()) : 0,
    weight: p.weight,
    ticker: kind === "token" ? decodeFixed(p.id).toUpperCase() : null,
  };
}

// ------------------------------------------------------------------------------------------------
// getPlayerState
// ------------------------------------------------------------------------------------------------

export async function getPlayerStateChain(client: TmbClient, activeNetwork: "devnet" | "mainnet") {
  const [cfg, { prizes, tickerByMint }, bros] = await Promise.all([client.fetchConfig(), prizeIndex(client), client.fetchBrosForOwner()]);
  const id = playerIdFor(client.me);
  const addr = client.me.toBase58();
  return {
    player: { id, device_id: id, handle: `${addr.slice(0, 4)}…${addr.slice(-4)}` },
    nfts: bros.map((b: BroView) => nftView(b, id, tickerByMint)),
    prizePool: prizes.map(prizeRow),
    config: {
      spinAmounts: cfg.spinAmounts.map(ui).filter((a) => a > 0),
      burnAtLossStreak: cfg.burnAtLossStreak,
      activeNetwork,
      spinsPaused: cfg.paused,
      rescueFeeOptions: cfg.rescueFeeOptions.map(ui).filter((a) => a > 0),
      minRescueFee: Math.min(...cfg.rescueFeeOptions.map(ui).filter((a) => a > 0)),
    },
  };
}

// ------------------------------------------------------------------------------------------------
// spinWheel
// ------------------------------------------------------------------------------------------------

/**
 * One wallet prompt for commit+request, then the oracle reveal + settle. Pass `onRequested` to start the
 * wheel animation as soon as the request tx lands (the landing wedge is only known after settle).
 */
export async function spinWheelChain(client: TmbClient, nftId: string, amount: number, onRequested?: () => void) {
  const asset = new PublicKey(nftId);
  const [{ prizes, tickerByMint }, cfg] = await Promise.all([prizeIndex(client), client.fetchConfig()]);
  const ev: SpinSettled = await client.spin(asset, toBase(amount), { onRequested: () => onRequested?.() });
  const won = ev.outcome === 1;
  const wedge = prizes[ev.wedgeIndex];
  const row = prizeRow(wedge, ev.wedgeIndex);
  const label = ODDS_LABELS[ev.oddsTier] as string;
  const hasBonus = !ev.bonusAsset.equals(PublicKey.default);

  const rec = ev.burned ? null : await client.fetchBro(asset);
  return {
    outcome: (won ? "win" : "loss") as "win" | "loss",
    oddsTier: label,
    oddsLabel: label,
    prize: won ? { id: row.id, label: row.label, prize_type: row.prize_type, value: row.value } : null,
    landingWedgeId: row.id,
    nft: {
      id: ev.asset.toBase58(),
      loss_streak: ev.newStreak,
      tmb_balance: ui(ev.newBalance),
      status: (ev.burned ? "burned" : "active") as "active" | "burned",
      stock_holdings: (rec?.holdings ?? []).map((h) => ({
        ticker: tickerByMint.get(h.mint.toBase58()) ?? h.mint.toBase58().slice(0, 4),
        value: ui(h.usdValueSnapshot),
      })),
    },
    burned: ev.burned,
    bonusNft: hasBonus ? { id: ev.bonusAsset.toBase58(), name: "Bonus Bro" } : null,
    banner: ev.burned
      ? "Your Bro has been burned. Trust me, bro."
      : won
        ? `You won ${row.label}!`
        : ev.outcome === 2
          ? "Spin timed out. Counted as a loss."
          : "REKT.",
    streakWarning:
      !ev.burned && ev.newStreak === cfg.burnAtLossStreak - 1
        ? `One more loss and this Bro is burned forever.`
        : null,
  };
}

// ------------------------------------------------------------------------------------------------
// rescueNft
// ------------------------------------------------------------------------------------------------

export async function rescueNftChain(client: TmbClient, rescuerNftId: string, burnedNftId: string, fee: number) {
  const rescuerAsset = new PublicKey(rescuerNftId);
  const burnedAsset = new PublicKey(burnedNftId);
  const cfg = await client.fetchConfig();
  const feeBase = toBase(fee);
  const { newAsset } = await client.rescue(rescuerAsset, burnedAsset, feeBase);
  const burnedAmount = Math.floor((feeBase * cfg.rescueBurnBps) / 10_000);
  const creditedAmount = feeBase - burnedAmount;
  const rescuer = await client.fetchBro(rescuerAsset);
  return {
    rescuer: { id: rescuerAsset.toBase58(), tmb_balance: rescuer ? ui(rescuer.tmbBalance) : 0 },
    // A burned Core asset can't be un-burned: the fallen Bro comes back as a NEW asset (new id).
    fallen: { id: newAsset.toBase58(), status: "active" as const, tmb_balance: ui(creditedAmount), loss_streak: 0 as const },
    burnedAmount: ui(burnedAmount),
    creditedAmount: ui(creditedAmount),
  };
}

// ------------------------------------------------------------------------------------------------
// topUpNft / setBroEscrow / mintNft
// (return shapes of these three weren't provided: they return the updated `nft` view, adjust if needed)
// ------------------------------------------------------------------------------------------------

async function viewOf(client: TmbClient, nftId: string) {
  const id = playerIdFor(client.me);
  const { tickerByMint } = await prizeIndex(client);
  const bros = await client.fetchBrosForOwner();
  const b = bros.find((x) => x.asset.toBase58() === nftId);
  return b ? nftView(b, id, tickerByMint) : null;
}

/** "+N TMB" now costs SOL (price set on-chain by the admin), credited straight to the Bro. */
export async function topUpNftChain(client: TmbClient, nftId: string, amount: number) {
  await client.buyTmb(new PublicKey(nftId), toBase(amount));
  return { nft: await viewOf(client, nftId) };
}

/** SOL cost of `amount` TMB, to show next to the "+100 TMB" button. null = price not set yet. */
export async function quoteTopUpChain(client: TmbClient, amount: number): Promise<number | null> {
  const price = await client.fetchTmbPrice();
  return price ? Number(TmbClient.quoteTmb(price, toBase(amount)).toString()) / 1e9 : null;
}

export async function setBroEscrowChain(client: TmbClient, nftId: string, status: "wallet" | "escrow") {
  const asset = new PublicKey(nftId);
  if (status === "escrow") await client.depositBro(asset);
  else await client.withdrawBro(asset);
  return { nft: await viewOf(client, nftId) };
}

export async function mintNftChain(client: TmbClient, net: NetworkRow, artKey?: string) {
  if (!net.assets_base_url) throw new Error("assets_base_url is not set for this network");
  const pick = pickBro(net.assets_base_url, variantFromArtKey(artKey));
  const { asset } = await client.mintBro(pick.name, pick.uri);
  return { nft: await viewOf(client, asset.toBase58()) };
}

// ------------------------------------------------------------------------------------------------
// graveyard (shape of getGraveyard wasn't provided: best-effort, adjust field names)
// ------------------------------------------------------------------------------------------------

export async function getGraveyardChain(client: TmbClient) {
  const rows = await client.fetchGraveyard();
  return rows.map((r: any) => ({
    id: r.account.asset.toBase58(),
    name: r.account.name as string,
    art_key: artKeyFromUri(r.account.metadataUri as string),
    last_owner: playerIdFor(r.account.lastOwner),
    burned_at: new Date(Number(r.account.burnedAt.toString()) * 1000).toISOString(),
  }));
}
