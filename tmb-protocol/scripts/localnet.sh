#!/usr/bin/env bash
# Starts a local validator with the exact setup `anchor test` uses (tmb_game as an upgradeable program
# owned by your wallet, real Metaplex Core, mock Switchboard). Useful when running tests/e2e manually:
#   scripts/localnet.sh &   then   anchor test --skip-local-validator --skip-build
set -euo pipefail
cd "$(dirname "$0")/.."
WALLET=${ANCHOR_WALLET:-$HOME/.config/solana/id.json}
PROGRAM_ID=$(solana-keygen pubkey target/deploy/tmb_game-devnet.json)
exec solana-test-validator --reset \
  --upgradeable-program "$PROGRAM_ID" target/deploy/tmb_game.so "$WALLET" \
  --bpf-program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d tests/fixtures/mpl_core.so \
  --bpf-program Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2 tests/fixtures/mock_switchboard.so \
  "$@"
