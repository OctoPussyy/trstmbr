# Trust Me Bros — Solana protocol (`tmb_game`)

Anchor 0.31.1 program + `@tmb/sdk` TypeScript client + deploy/ops scripts. One crate, one IDL, built per
cluster with a cargo feature (`devnet` | `mainnet`) that selects the program id and the pinned
Switchboard On-Demand program.

```
programs/tmb_game/      Anchor program (lib, state, errors, events, constants, logic, utils, instructions/*)
sdk/                    @tmb/sdk: TmbClient, PDAs, computeOddsTier, randomness providers, generated IDL
scripts/                deploy, init, seed-devnet, sync-prizes, export-addresses, handover, e2e, sync-keys, localnet, fetch-fixtures
config/                 devnet.json / mainnet.json (same schema) + prizes.json
tests/                  tmb_game.ts (17 mocha tests), helpers.ts, mock_switchboard/ (TEST-ONLY oracle stand-in)
integration/            drop-in adapters for the web app (chain.ts, chain-webhook.ts)
```

## What is verified, and what is not

| | |
|---|---|
| `cargo test` (odds tiers, prize validation, payout guard, proptest fuzz of roll/weights/guard), both cargo features | passing |
| 17 on-chain tests on a local validator against the **real** Metaplex Core binary and the **real** tmb_game binary | passing |
| `scripts/e2e.ts` on localnet: mint → stake → 5 losses → burn → rescue → restake → withdraw | passing |
| Mainnet-feature binary compiles and embeds the mainnet program id | verified |
| Switchboard **live** commit → reveal → settle | **NOT run.** Localnet uses `tests/mock_switchboard` at the Switchboard program id. The real SDK path was only smoke-tested read-only on devnet (builds create+commit ixs against the real program; wallet is the commit authority). Deploy to devnet and run `e2e.ts --cluster devnet` before anything else. |
| External audit | **not done.** Get one (OtterSec / Neodyme / Sec3) before mainnet. |

## Deviations from the brief (deliberate — read these)

1. **Switchboard randomness is parsed by hand, not via the `switchboard-on-demand` crate.** The crate does not
   compile against Anchor 0.31 / borsh 0.10 (`E0119` duplicate `AnchorDeserialize`). `utils::parse_randomness` pins the
   account **owner** to the cluster's Switchboard program, checks the 8-byte discriminator and reads
   `authority / seed_slot / reveal_slot / value` at fixed offsets (layout copied from `switchboard-on-demand 0.11.3`).
   It is **not** slot-hash randomness: `request_spin` requires `seed_slot == slot - 1`, `reveal_slot == 0` and
   `authority == player`; `settle_spin` requires the same `seed_slot`, `reveal_slot > seed_slot` and a non-zero value.
2. **No collection-wide BurnDelegate / TransferDelegate plugins.** Escrowed Bros are *owned* by the `escrow_auth` PDA,
   which already lets the program transfer/burn exactly those assets. A collection-level delegate would additionally let the
   program move Bros sitting in player wallets, for no benefit. `create_collection` only sets `update_authority = config PDA`.
3. **Anchor 0.31.1**, not 0.32: `mpl-core 0.11.1` (borsh 0.10) is the newest Core crate that builds against Anchor.
4. **`set_prizes(entries, append, finalize)` is chunked.** A 16-wedge table (16 × 93 B) exceeds both Anchor's 1000-byte
   instruction buffer and the 1232-byte tx limit. `client.setPrizes()` chunks automatically; the program validates the
   *complete* table on the last chunk. Until then `config.prizes_ready = false` and `request_spin`/`settle_spin`/`cancel_stale_spin`
   are refused (fail-closed; stale spins can't be charged while the wheel is being replaced). **Pause the game before a
   multi-tx update.**
5. **`initialize` only accepts the program's upgrade authority** as signer (front-running protection). Mainnet flow:
   deploy with your own key → `init.ts` → `handover.ts` to the multisig.
6. **Extra state** beyond the brief (all needed for correctness): `Prize.usd_value`, `Config.{team_wallet, pending_authority,
   transfer_cooldown_slots, stale_slots, total_user_tmb, prizes_ready, bonus_uri, mint_pool_share_bps}`, `BroRecord.eligible_slot`,
   `SpinRequest.{requested_slot, nonce, at_stake}`, `Graveyard.bump`.
7. **Mint split remainder:** `mint_pool_share_bps` of the SOL price goes to `treasury`; the rest to `team_wallet`.
8. **Pool accounting:** the vault holds every Bro's balance *and* the reward pool. `pool = vault_TMB − Σ Bro balances`
   (`Config.total_user_tmb`, asserted by the tests after every scenario). The payout guard, `withdraw_vault` and starting
   balances only draw on the pool.
9. **Bonus Bro / prize-token accounts are mandatory for whoever cranks `settle_spin`** (a fresh `bonus_asset` signer when the wheel has a
   BonusBro wedge; the vault ATA of every Token-prize mint as remaining accounts, validated by re-deriving the ATA). Omitting them is an error,
   never a silent "ineligible", so a third-party cranker cannot skew prize weights. `TmbClient` does this for you.
10. **Pause scope:** `mint_bro`, `request_spin`, `rescue` are blocked. Settling, cancelling stale spins, withdrawing Bros/TMB and claiming
    holdings keep working so nobody's funds are trapped by a pause.
11. **One wallet prompt for the request** (create randomness + commit + `request_spin` in one tx). The settle tx (reveal + `settle_spin`) needs a second
    signature unless you pass `{ settler: Keypair }` (session key / crank) to `spin()`. `settle_spin` is permissionless.

## Streak scoping and its trade-off

`BroRecord` is keyed by `(asset, owner wallet)`. A Bro that changes wallets starts a fresh record (streak 0); returning to a
previous owner resumes that owner's old record; withdrawing from escrow never resets it. **Known trade-off:** a player can still
"reset" a streak by transferring the Bro to an alt wallet. Mitigation: `transfer_cooldown_slots` — a record first seen at
`deposit_bro` cannot spin until N slots later (216 000 ≈ 1 day on mainnet, 0 on devnet). Bros minted by the wallet itself
(`mint_bro`, rescue re-mint) have no cooldown.

## Tokenomics knobs (all admin-tunable via `update_config`)

Spin amounts, odds per tier, tier thresholds, burn streak, rescue burn %, rescue fee options, payout cap (`max_payout_bps`), `min_reserve`,
mint price, mint split, starting balance, max supply, cooldown, stale slots, bonus uri. Amounts in `config/*.json` are UI units
(`tmb_decimals`, default 6, like pump.fun); the SDK converts. `$TMB` may be SPL or Token-2022 (`token_interface`); deposits credit the amount the vault
*actually received*.

Known limits: token-prize payouts are guarded by `max_payout_bps` of that mint's vault balance but unclaimed holdings are not tracked as a
liability (over-commitment shows up as a failing `claim_holding` until the vault is refilled). `withdraw_vault` on a prize-token mint is not restricted.
Editing the prize table changes the wedge mapping of spins already pending (the wedge is resolved at settle time).

## Setup

Prerequisites: Rust stable, Solana CLI 2.x/3.x/4.x (`cargo-build-sbf`), Anchor CLI 0.31.1, Node ≥ 20.

```bash
cd tmb-protocol
npm install
bash scripts/sync-keys.sh --force     # generate YOUR program keypairs + rewrite declare_id!/Anchor.toml (once!)
npm run fixtures                      # downloads the Metaplex Core binary, builds the test-only mock Switchboard
```

> The program ids currently in the repo belong to throw-away keypairs generated during development. Run `sync-keys.sh --force`
> once on your own machine and **back up `target/deploy/tmb_game-mainnet.json` offline** — it is the program's address forever.
> Never commit `target/deploy/*.json` (git-ignored).

## Build & test (localnet)

```bash
cargo test -p tmb_game                                    # unit + proptest (devnet feature)
cargo test -p tmb_game --no-default-features --features mainnet
anchor build                                              # devnet feature, also writes target/idl + target/types
anchor test                                               # starts a validator with Core + mock Switchboard, runs tests/tmb_game.ts
# if your environment can't let `anchor test` spawn its own validator:
scripts/localnet.sh &  &&  anchor test --skip-local-validator --skip-build
```

## Devnet

```bash
solana config set -u devnet && solana airdrop 2          # deploy needs ~6 SOL (use faucet.solana.com if rate limited)
npm run deploy:devnet                                    # builds with --features devnet, deploys with tmb_game-devnet.json, copies the IDL into sdk/
npm run seed:devnet                                      # 1st run: airdrop, mock $TMB (1B) + mock TSLA/GME/DOGE mints -> config
npm run init:devnet                                      # initialize, create_collection, set_prizes (authority = your wallet)
npm run seed:devnet                                      # 2nd run: fund vault (250M TMB + prize tokens), mint + stake 3 test Bros
npm run e2e -- --cluster devnet                          # REAL Switchboard: mint -> stake -> spin until burn -> rescue -> withdraw
npm run export:devnet                                    # prints the JSON for the admin panel
```

`export-addresses.ts` prints (values are examples) exactly the keys of the admin panel **Networks** form / `network_config` table:

```json
{
  "cluster": "devnet",
  "rpc_url": "https://api.devnet.solana.com",
  "game_program_id": "<program id>",
  "tmb_mint": "<mock TMB mint>",
  "collection_address": "<Core collection>",
  "reward_vault": "<vault PDA, owner of the reward token accounts>",
  "treasury_wallet": "<SOL treasury>",
  "admin_authority": "<authority>"
}
```

Paste it into **Admin → Networks → Devnet**, set the admin panel to Devnet, run the full flow in the website, audit.

## Mainnet

Checklist: build → test on localnet → deploy devnet → init → seed → full E2E on the website with the admin panel on Devnet → **audit** → mainnet.

1. `config/mainnet.json`: set `rpc_url` (a paid RPC), `tmb_mint` (the pump.fun mint), `treasury_wallet`, `params.team_wallet`, `params.reward_wallet`,
   `params.pauser`, `params.collection_uri`. Fill real stock-token mints in `config/prizes.mainnet.json` (copy `prizes.json`, set `mint`, `token_decimals`, `usd_value`).
   Everything else is identical to devnet except: cooldown 216 000, `stale_slots` 3 000, starting balance 0.
2. `npm run deploy:mainnet` (deployer key = upgrade authority for now) → `npm run init:mainnet` (initialize, collection, prizes).
3. Fund the vault from the reward wallet: the 20–30 % team bag, prize tokens (`client.fundVault(mint, amount)`; ongoing: 50 % of pump.fun creator fees, manually).
4. `npm run handover -- --cluster mainnet --multisig <squads vault>`: proposes the multisig as authority and moves the upgrade authority; then execute
   `accept_authority` from the multisig (signer = the vault PDA). Verify with `npm run export:mainnet`.
5. Paste `export:mainnet` JSON into **Admin → Networks → Mainnet**, then switch the admin panel to Mainnet.

Ops: `npm run prizes:mainnet` re-pushes the wheel from JSON (pause first). Roles: `authority` (Squads) does everything; `reward_wallet` may fund the vault and edit
prizes only; `pauser` may only pause.

## Website wiring

`integration/chain.ts` maps the SDK onto the `getPlayerState` / `spinWheel` / `setBroEscrow` / `topUpNft` / `rescueNft` / `mintNft` shapes from the brief and
returns `landingWedgeId = wedge_index` (wheel geometry contract: wedge `i` of the on-chain `PrizeTable` == wedge `i` on the wheel, clockwise from 12 o'clock; a loss lands on the REKT wedge).
`integration/chain-webhook.ts` is the Helius receiver that mirrors `SpinSettled` / `Rescued` into `spins` / `rescues`. Both were written against the shapes in the brief — the
web app's own source is not in this repo, so field names may need small adjustments.

## Program reference

| Instruction | Signer | Notes |
|---|---|---|
| `initialize`, `create_collection`, `update_config`, `withdraw_vault`, `propose_authority` | authority | `initialize` = upgrade authority; `withdraw_vault` cannot take the TMB pool below `min_reserve` |
| `accept_authority` | pending authority | two-step hand-over |
| `set_roles` | authority | reward_wallet / pauser |
| `set_paused` | authority or pauser | pauser can only pause |
| `set_prizes`, `fund_vault` | authority or reward_wallet | exactly one REKT wedge, ≤ 16 wedges, weights > 0 |
| `mint_bro` | player | SOL split, Core CreateV2, BroRecord + starting balance (if the payout guard allows) |
| `deposit_bro` / `withdraw_bro` | player | escrow; streak never reset |
| `deposit_tmb` / `withdraw_tmb` | player | in escrow, no pending spin |
| `request_spin` | player | commit; debits fee, computes tier from pre-spin balance + holdings, sets `at_stake` |
| `settle_spin` | anyone | reveal; prize, streak, atomic burn + Graveyard on the 5th loss |
| `cancel_stale_spin` | anyone | after `stale_slots`; counts as a loss, never a refund |
| `claim_holding` | player | prize token vault → wallet |
| `rescue` | player | burns `rescue_burn_bps` of the fee (SPL burn), credits the rest, re-mints the fallen Bro to its last owner |

Events are emitted for every state change (`SpinRequested`, `SpinSettled { asset, owner, amount, odds_tier, outcome, wedge_index, prize_id, new_streak, burned, new_balance, … }`, `Rescued`, …).
Odds function (identical in `logic.rs` and `sdk/src/odds.ts`): `tmb ≥ high → high; stocks ≥ n ∧ tmb ≥ stock_tmb_high → high; tmb ≥ medium → medium; tmb ≥ low → low; stocks ≥ n ∧ value ≥ min → low; else near_impossible`.
Win roll: `r1 = u16le(v[0..2]) % 10000 < odds_bps[tier]`; prize roll: `u64le(v[2..10]) % Σ eligible weights`.
