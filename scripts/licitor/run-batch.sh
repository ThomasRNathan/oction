#!/usr/bin/env bash
#
# Manual driver: run exactly one Licitor batch and exit.
# This intentionally does NOT rotate VPN.
#
# Usage:
#   ./scripts/licitor/run-batch.sh index [maxRows]
#     - Runs one index batch, stopping after ~maxRows rows upserted (default 600).
#
#   ./scripts/licitor/run-batch.sh detail [batchSize]
#     - Runs one detail batch of N listings (lot_index=0 rows) (default 600).
#
# Examples:
#   ./scripts/licitor/run-batch.sh index 600
#   ./scripts/licitor/run-batch.sh detail 600
#
set -euo pipefail

MODE="${1:-}"
SIZE="${2:-600}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
cd "$repo"

if [[ -z "$MODE" ]]; then
  echo "Missing mode. Use: index | detail" >&2
  exit 2
fi

case "$MODE" in
  index)
    echo "Running one INDEX batch (maxRows=${SIZE})…"
    npm run licitor:index -- --maxRows "$SIZE"
    ;;
  detail)
    echo "Running one DETAIL batch (batchSize=${SIZE})…"
    npm run licitor:detail -- "$SIZE"
    ;;
  *)
    echo "Unknown mode: $MODE. Use: index | detail" >&2
    exit 2
    ;;
esac

