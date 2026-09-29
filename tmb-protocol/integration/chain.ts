/**
 * Drop-in adapter for the Trust Me Bros web app (TanStack Start + Lovable Cloud): `src/lib/chain.ts`.
 *
 * When the ACTIVE network's `game_program_id` is set (from `getPublicConfig`), the UI calls these helpers
 * with the connected wallet instead of the off-chain server functions. They return the same shapes as
 * `getPlayerState` / `spinWheel` in `src/lib/game.functions.ts` (as described in the brief), so the
 * components need no redesign. The chain decides everything; the wheel only animates `landingWedgeId`.
 *
 * NOTE: written against the shapes in the brief, not against the app's source (which is not in this repo);
 * adjust field names if `game.functions.ts` differs.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  BroView,
  Cluster,
  ODDS_LABELS,
  SpinSettled,
  TmbClient,
  WalletLike,
  decodeFixed,
  prizeKindName,
} from "@tmb/sdk";

export interface NetworkConfigRow {
  cluster: Cluster;
  rpc_url: string;
  game_program_id: string;
}

export function chainClient(net: NetworkConfigRow, wallet: WalletLike): TmbClient | null {
  if (!net.game_program_id) return null; // fall back to the off-chain server functions
  return new TmbClient(new Connection(net.rpc_url, "confirmed"), wallet, new PublicKey(net.game_program_id), net.cluster);
}

const tmbUi = (base: { toString(): string }, decimals = 6) => Number(base.toString()) / 10 ** decimals;

export async function getPlayerStateChain(client: TmbClient, activeNetwork: string) {
  const [cfg, prizes, bros] = await Promise.all([client.fetchConfig(), client.fetchPrizes(), client.fetchBrosForOwner()]);
  const prizePool = prizes.map((p, i) => ({
    id: String(i), // wedge index == prize_pool row (wheel geometry contract)
    label: decodeFixed(p.label),
    prize_type: prizeKindName(p.kind),
    value: tmbUi(p.amount),
    weight: p.weight,
  }));
  return {
    nfts: bros.map((b: BroView) => ({
      id: b.asset.toBase58(),
      name: b.name,
      art_key: b.uri,
      tmb_balance: tmbUi(b.record?.tmbBalance ?? 0),
      stock_holdings: (b.record?.holdings ?? []).map((h) => ({ ticker: h.mint.toBase58(), value: tmbUi(h.usdValueSnapshot) })),
      loss_streak: b.record?.lossStreak ?? 0,
      status: b.record && "burned" in b.record.status ? "burned" : "active",
      escrow_status: b.location,
      odds_label: ODDS_LABELS[b.oddsTier],
    })),
    prizePool,
    config: {
      spinAmounts: cfg.spinAmounts.map((a) => tmbUi(a)).filter((a) => a > 0),
      burnAtLossStreak: cfg.burnAtLossStreak,
      activeNetwork,
      spinsPaused: cfg.paused,
    },
  };
}

/** One wallet prompt for the commit+request tx; the settle tx follows once the oracle reveals. */
export async function spinWheelChain(client: TmbClient, asset: PublicKey, amountUi: number, onRequested?: () => void) {
  const prizes = await client.fetchPrizes();
  const ev: SpinSettled = await client.spin(asset, Math.round(amountUi * 1e6), { onRequested });
  const won = ev.outcome === 1;
  const wedge = prizes[ev.wedgeIndex];
  const cfg = await client.fetchConfig();
  return {
    outcome: won ? "win" : "lose",
    oddsTier: ev.oddsTier,
    oddsLabel: ODDS_LABELS[ev.oddsTier],
    prize: won && wedge ? { id: String(ev.wedgeIndex), label: decodeFixed(wedge.label), prize_type: prizeKindName(wedge.kind) } : null,
    landingWedgeId: String(ev.wedgeIndex),
    nft: { id: ev.asset.toBase58(), loss_streak: ev.newStreak, tmb_balance: tmbUi(ev.newBalance), status: ev.burned ? "burned" : "active" },
    burned: ev.burned,
    bonusNft: ev.bonusAsset.equals(PublicKey.default) ? null : { id: ev.bonusAsset.toBase58() },
    banner: ev.burned ? "Your Bro has been burned. Trust me, bro." : won ? "Winner winner." : "REKT.",
    streakWarning: !ev.burned && ev.newStreak === cfg.burnAtLossStreak - 1,
  };
}

export const setBroEscrowChain = (c: TmbClient, asset: PublicKey, escrow: boolean) => (escrow ? c.depositBro(asset) : c.withdrawBro(asset));
export const topUpNftChain = (c: TmbClient, asset: PublicKey, amountUi: number) => c.depositTmb(asset, Math.round(amountUi * 1e6));
export const rescueNftChain = (c: TmbClient, rescuerAsset: PublicKey, burnedAsset: PublicKey, feeUi: number) =>
  c.rescue(rescuerAsset, burnedAsset, Math.round(feeUi * 1e6));
export const mintNftChain = (c: TmbClient, name: string, uri: string) => c.mintBro(name, uri);
