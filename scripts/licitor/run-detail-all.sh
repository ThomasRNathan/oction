#!/usr/bin/env bash
# Autonomous driver (detail phase): rotate VPN, scrape a batch, repeat until done.
#
# Usage:
#   ./scripts/licitor/run-detail-all.sh [batchSize] [maxBatches]
#     batchSize   default 600
#     maxBatches  default 50 (safety cap)
#
# Rotates VPN via ./scripts/licitor/rotate-vpn.sh.
# Writes per-batch log to /tmp/licitor_detail_batchN.log and appends a summary to
# /tmp/licitor_detail_run.log so you can tail progress from a second terminal.
#
set -uo pipefail

BATCH_SIZE="${1:-600}"
MAX_BATCHES="${2:-50}"
RUN_LOG=/tmp/licitor_detail_run.log

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
cd "$repo"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$RUN_LOG"; }

# How many detail pages remain? (one per auction = lot_index=0)
missing_detail_count() {
  node -e "
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config({ path: '.env' });
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const db = createClient(url, key);
  db.from('past_auctions')
    .select('licitor_id', { count: 'exact', head: true })
    .eq('lot_index', 0)
    .is('detail_fetched_at', null)
    .then(({ count, error }) => {
      if (error) throw error;
      console.log(count ?? 0);
      process.exit(0);
    })
    .catch(() => { console.log('?'); process.exit(1); });
  " 2>/dev/null
}

log "=== autonomous DETAIL run started, batchSize=$BATCH_SIZE, maxBatches=$MAX_BATCHES ==="

for n in $(seq 1 "$MAX_BATCHES"); do
  remaining=$(missing_detail_count)
  log "batch $n — $remaining auctions still missing detail"
  if [[ "$remaining" == "0" ]]; then
    log "✓ all detail rows done. Exiting."
    break
  fi

  log "rotating VPN…"
  if ! "$here/rotate-vpn.sh" >> "$RUN_LOG" 2>&1; then
    log "✗ VPN rotation failed — bailing out"
    exit 1
  fi

  # Small settle time for the new tunnel + DNS
  sleep 4

  BATCH_LOG="/tmp/licitor_detail_batch${n}.log"
  log "launching detail batch $n → $BATCH_LOG"
  npm run licitor:detail -- "$BATCH_SIZE" > "$BATCH_LOG" 2>&1
  rc=$?

  summary=$(grep -E '^BATCH DONE \(detail\):' "$BATCH_LOG" | tail -1)
  if [[ -z "$summary" ]]; then
    summary=$(grep -E '^Done:' "$BATCH_LOG" | tail -1)
  fi
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

log "=== autonomous DETAIL run finished ==="

