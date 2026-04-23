#!/usr/bin/env bash
# Rotate NordVPN to a different random country, wait for IP change, log result.
#
# Usage:
#   ./scripts/licitor/rotate-vpn.sh           # random country from CANDIDATES
#   ./scripts/licitor/rotate-vpn.sh France    # specific country
#
# Requires: NordVPN.app installed (no CLI needed, uses nordvpn:// URL scheme).
# Detects IP change via api.ipify.org and retries up to 3 times if unchanged.

set -euo pipefail

# Countries that work well for scraping a FR site (varied IPs, low latency)
CANDIDATES=(
  "France" "Germany" "Belgium" "Netherlands" "Switzerland"
  "Luxembourg" "Austria" "Italy" "Spain" "Portugal"
  "United_Kingdom" "Ireland"
)

current_ip() {
  curl -sS --max-time 8 https://api.ipify.org 2>/dev/null || echo "unknown"
}

random_country() {
  echo "${CANDIDATES[$RANDOM % ${#CANDIDATES[@]}]}"
}

TARGET="${1:-$(random_country)}"
OLD_IP=$(current_ip)
echo "[$(date +%H:%M:%S)] old IP: $OLD_IP · target: $TARGET"

# NordVPN URL scheme: nordvpn://connect?country=France
# Firing this via `open` tells NordVPN.app to switch.
for attempt in 1 2 3; do
  open "nordvpn://connect?country=${TARGET}"
  # Wait for the connection to actually complete. NordVPN takes 3-8s typically.
  sleep 12

  NEW_IP=$(current_ip)
  if [[ "$NEW_IP" != "$OLD_IP" && "$NEW_IP" != "unknown" ]]; then
    echo "[$(date +%H:%M:%S)] ✓ new IP: $NEW_IP (attempt $attempt)"
    # Log to history
    echo "$(date -Iseconds) $OLD_IP → $NEW_IP ($TARGET)" >> /tmp/vpn-rotations.log
    exit 0
  fi

  echo "[$(date +%H:%M:%S)] attempt $attempt: IP did not change ($NEW_IP), retrying with a different country…"
  TARGET=$(random_country)
  sleep 3
done

echo "[$(date +%H:%M:%S)] ✗ FAILED after 3 attempts. IP still $OLD_IP" >&2
exit 1
