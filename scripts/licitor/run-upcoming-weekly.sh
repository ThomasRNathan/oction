#!/usr/bin/env bash
# Wrapper invoked by launchd every Monday at 06:00.
# Idempotent: re-running mid-week is a no-op for already-detailed rows.
#
# Manual one-shot:   bash scripts/licitor/run-upcoming-weekly.sh
# Tail today's log:  tail -f /tmp/oction-upcoming-$(date +%Y%m%d).log
set -euo pipefail

REPO_DIR="/Users/thomaspc/coding/oction"
cd "$REPO_DIR"

# launchd does NOT load the user's shell profile. Without an explicit PATH it
# can't find npx/node, so set the same PATH a Terminal session would have.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

LOG="/tmp/oction-upcoming-$(date +%Y%m%d).log"
{
  echo "=== oction weekly upcoming scrape — $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
  echo "cwd: $(pwd)"
  echo "node: $(node --version 2>/dev/null || echo 'NOT FOUND')"
  echo
} >> "$LOG"

npx tsx scripts/licitor/scrape-upcoming.ts >> "$LOG" 2>&1

# DVF enrichment for the fresh upcoming pool: fetch medians for any new
# localities from CEREMA, then stamp them onto rows. Powers the décote
# column on /upcoming and the home-page radar. Best-effort — a CEREMA
# outage must not mark the (already successful) scrape run as failed.
{
  echo "=== DVF enrich upcoming — $(date '+%H:%M:%S') ==="
  npx tsx scripts/analytics/enrich-past-auctions-dvf.ts --status upcoming ||
    echo "WARN: enrich-past-auctions-dvf --status upcoming failed (CEREMA down?)"
  npx tsx scripts/analytics/apply-dvf-to-past-auctions.ts --status upcoming ||
    echo "WARN: apply-dvf-to-past-auctions --status upcoming failed"
} >> "$LOG" 2>&1
