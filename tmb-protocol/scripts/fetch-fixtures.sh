#!/usr/bin/env bash
# Downloads the Metaplex Core program binary used by localnet tests and builds the test-only mock
# Switchboard program. Run once: `npm run fixtures`.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/fixtures
MPL_CORE=CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
if [ ! -f tests/fixtures/mpl_core.so ]; then
  solana program dump -u mainnet-beta "$MPL_CORE" tests/fixtures/mpl_core.so
fi
( cd tests/mock_switchboard && cargo build-sbf --sbf-out-dir ../fixtures )
ls -la tests/fixtures
