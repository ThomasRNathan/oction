#!/usr/bin/env bash
# Autonomous driver: rotate VPN, scrape a batch, repeat until no pending pages.
#
# Usage:
#   ./scripts/licitor/run-all.sh [batchSize] [maxBatches]
#     batchSize   default 500
#     maxBatches  default 20 (safety cap)
#
# Between batches: rotate-vpn.sh picks a new country; if rotation fails 3x, bail.
# Writes per-batch log to /tmp/licitor_batchN.log and appends a summary to
# /tmp/licitor_run.log so you can tail progress from a second terminal.

set -uo pipefail

BATCH_SIZE="${1:-500}"
MAX_BATCHES="${2:-20}"
RUN_LOG=/tmp/licitor_run.log

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
cd "$repo"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$RUN_LOG"; }

# How many pending pages remain?
pending_count() {
  node -e "
  require('dotenv').config({ path: '.env.local' });
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  db.from('scrape_progress')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .then(({ count }) => { console.log(count ?? 0); process.exit(0); })
    .catch(() => { console.log('?'); process.exit(1); });
  " 2>/dev/null
}

log "=== autonomous run started, batchSize=$BATCH_SIZE, maxBatches=$MAX_BATCHES ==="

for n in $(seq 1 "$MAX_BATCHES"); do
  remaining=$(pending_count)
  log "batch $n — $remaining pages still pending"
  if [[ "$remaining" == "0" ]]; then
    log "✓ all pages done. Exiting."
    break
  fi

  log "rotating VPN…"
  if ! "$here/rotate-vpn.sh" >> "$RUN_LOG" 2>&1; then
    log "✗ VPN rotation failed — bailing out"
    exit 1
  fi

  # Small settle time for the new tunnel + DNS
  sleep 4

  BATCH_LOG="/tmp/licitor_auto_batch${n}.log"
  log "launching batch $n → $BATCH_LOG"
  npm run licitor:index -- "$BATCH_SIZE" > "$BATCH_LOG" 2>&1
  rc=$?

  summary=$(grep -E '^Done:' "$BATCH_LOG" | tail -1)
  log "batch $n finished (rc=$rc) · $summary"

  # If the scraper auto-aborted on consecutive failures (exit 2), rotate harder
  if [[ $rc -eq 2 ]]; then
    log "scraper detected IP block — will rotate and retry"
    continue
  fi
  if [[ $rc -ne 0 ]]; then
    log "✗ unexpected exit code $rc — bailing out"
    exit 1
  fi
done

log "=== autonomous run finished ==="
