/**
 * Helius webhook receiver: mirrors `SpinSettled` / `Rescued` events into the `spins` / `rescues` tables
 * (ticker, graveyard, admin stats). Framework-agnostic: mount it from
 * `src/routes/api/public/chain-webhook.ts` (TanStack Start server route) as `POST: ({ request }) => handleChainWebhook(request, deps)`.
 *
 * Configure the Helius webhook as type "raw" for the game program with an Authorization header equal to
 * CHAIN_WEBHOOK_SECRET; requests without the exact header are rejected.
 */
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { timingSafeEqual } from "crypto";
import { decodeFixed, tmbIdl } from "@tmb/sdk";

export interface WebhookDeps {
  secret: string;
  programId: PublicKey;
  cluster: "devnet" | "mainnet";
  insertSpin(row: Record<string, unknown>): Promise<void>; // upsert keyed by (signature, event_index)
  insertRescue(row: Record<string, unknown>): Promise<void>;
}

const eq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function handleChainWebhook(req: Request, d: WebhookDeps): Promise<Response> {
  if (!d.secret || !eq(req.headers.get("authorization") ?? "", d.secret)) return new Response("unauthorized", { status: 401 });
  const body = (await req.json()) as any[];
  const parser = new EventParser(d.programId, new BorshCoder(tmbIdl as any));
  let n = 0;
  for (const tx of Array.isArray(body) ? body : [body]) {
    const logs: string[] | undefined = tx?.meta?.logMessages ?? tx?.logMessages;
    const signature: string | undefined = tx?.transaction?.signatures?.[0] ?? tx?.signature;
    if (!logs || !signature || tx?.meta?.err) continue;
    let i = 0;
    for (const ev of parser.parseLogs(logs)) {
      const k = i++;
      if (ev.name === "spinSettled") {
        const e = ev.data as any;
        await d.insertSpin({
          network: d.cluster, signature, event_index: k, slot: tx.slot,
          asset: e.asset.toBase58(), owner: e.owner.toBase58(), amount: e.amount.toString(), odds_tier: e.oddsTier,
          outcome: ["loss", "win", "stale_loss"][e.outcome], wedge_index: e.wedgeIndex, prize_id: decodeFixed(e.prizeId),
          prize_amount: e.prizeAmount.toString(), new_streak: e.newStreak, burned: e.burned, new_balance: e.newBalance.toString(),
        });
        n++;
      } else if (ev.name === "rescued") {
        const e = ev.data as any;
        await d.insertRescue({
          network: d.cluster, signature, event_index: k, slot: tx.slot,
          burned_asset: e.burnedAsset.toBase58(), new_asset: e.newAsset.toBase58(), rescuer: e.rescuer.toBase58(),
          last_owner: e.lastOwner.toBase58(), fee: e.fee.toString(), burned_amount: e.burnedAmount.toString(), credited: e.credited.toString(),
        });
        n++;
      }
    }
  }
  return Response.json({ ok: true, events: n });
}
