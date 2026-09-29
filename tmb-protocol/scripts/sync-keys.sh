#!/usr/bin/env bash
# Generates the per-cluster program keypairs (if missing) and rewrites the declare_id! lines in
# programs/tmb_game/src/constants.rs plus Anchor.toml so they match.
#   scripts/sync-keys.sh            # keep existing keypairs
#   scripts/sync-keys.sh --force    # regenerate BOTH keypairs (do this once, on your own machine)
# Keep target/deploy/tmb_game-mainnet.json backed up offline; it is the program's address forever.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p target/deploy
FORCE=${1:-}
for c in devnet mainnet; do
  f=target/deploy/tmb_game-$c.json
  if [ ! -f "$f" ] || [ "$FORCE" = "--force" ]; then
    solana-keygen new --no-bip39-passphrase --silent --force -o "$f"
  fi
done
DEV=$(solana-keygen pubkey target/deploy/tmb_game-devnet.json)
MAIN=$(solana-keygen pubkey target/deploy/tmb_game-mainnet.json)
python3 - "$DEV" "$MAIN" <<'PY'
import re, sys
dev, main = sys.argv[1], sys.argv[2]
p = "programs/tmb_game/src/constants.rs"
s = open(p).read()
s = re.sub(r'(feature = "devnet", not\(feature = "mainnet"\)\)\]\ndeclare_id!\(")[1-9A-HJ-NP-Za-km-z]+("\);)', r'\g<1>%s\2' % dev, s, count=1)
s = re.sub(r'(#\[cfg\(feature = "mainnet"\)\]\ndeclare_id!\(")[1-9A-HJ-NP-Za-km-z]+("\);)', r'\g<1>%s\2' % main, s, count=1)
open(p, "w").write(s)
p = "Anchor.toml"
s = open(p).read()
s = re.sub(r'(\[programs\.localnet\]\ntmb_game = ")[^"]+(")', r'\g<1>%s\2' % dev, s)
s = re.sub(r'(\[programs\.devnet\]\ntmb_game = ")[^"]+(")', r'\g<1>%s\2' % dev, s)
s = re.sub(r'(\[programs\.mainnet\]\ntmb_game = ")[^"]+(")', r'\g<1>%s\2' % main, s)
open(p, "w").write(s)
print("devnet  program id:", dev)
print("mainnet program id:", main)
PY
# `anchor test` / `anchor build` look for the default keypair name
cp target/deploy/tmb_game-devnet.json target/deploy/tmb_game-keypair.json
