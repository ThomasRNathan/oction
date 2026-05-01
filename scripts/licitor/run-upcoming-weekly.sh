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

exec npx tsx scripts/licitor/scrape-upcoming.ts >> "$LOG" 2>&1
