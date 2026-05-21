#!/usr/bin/env bash
#
# Download the most recent Scalingo nightly backup to backups/.
#
# Scalingo runs an automated nightly backup of the Postgres addon at
# ~02:00 CEST. This script grabs the latest one via the Scalingo CLI —
# no tunnel needed, no pg_dump needed locally.
#
# Prerequisites:
#   - `scalingo` CLI installed and authenticated.
#
# Usage:
#   ./scripts/backup-from-scalingo.sh                # latest backup
#   ./scripts/backup-from-scalingo.sh --trigger      # ask for a fresh one, wait, then download
#
# Output:
#   backups/scalingo-YYYYMMDD-HHMMSS-<id>.tar.gz
#
# Restore example:
#   tar -xvzf backups/scalingo-...tar.gz
#   # The archive contains a Postgres custom-format dump; restore with pg_restore.
#
# Exit codes:
#   0  success
#   1  CLI missing or auth issue
#   2  could not parse a backup ID
#
set -euo pipefail

APP="${SCALINGO_APP:-crmenergy}"
ADDON_ID="${SCALINGO_PG_ADDON:-ad-3b90431d-3dd1-4b3f-80da-288cd4808ddf}"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"

TRIGGER=0
for arg in "$@"; do
	case "$arg" in
		--trigger) TRIGGER=1 ;;
		-h|--help)
			sed -n '2,22p' "$0"
			exit 0
			;;
		*)
			echo "Unknown argument: $arg" >&2
			exit 1
			;;
	esac
done

if ! command -v scalingo >/dev/null; then
	echo "✗ scalingo CLI not found. Install from https://cli.scalingo.com" >&2
	exit 1
fi

# Strip ANSI escapes from CLI output for reliable parsing.
strip_ansi() {
	# shellcheck disable=SC2001
	sed $'s/\033\\[[0-9;]*[a-zA-Z]//g'
}

if [ "$TRIGGER" = "1" ]; then
	echo "→ Triggering a fresh backup on Scalingo…"
	scalingo --app "$APP" --addon "$ADDON_ID" backups-create
	# Poll until the most-recent backup is "done". Scalingo finishes
	# small DBs within a few seconds.
	for _ in 1 2 3 4 5 6 7 8 9 10; do
		LATEST_STATUS="$(scalingo --app "$APP" --addon "$ADDON_ID" backups 2>/dev/null \
			| strip_ansi | awk 'NR==4 { print $NF }')"
		if [ "$LATEST_STATUS" = "done" ]; then break; fi
		sleep 3
	done
fi

echo "→ Fetching latest backup id…"
# Header rows are lines 1–3 (box drawing). Data starts at line 4.
LATEST_ID="$(scalingo --app "$APP" --addon "$ADDON_ID" backups 2>/dev/null \
	| strip_ansi | awk 'NR==4 { print $2 }')"

if [ -z "${LATEST_ID:-}" ] || [ "${#LATEST_ID}" -lt 16 ]; then
	echo "✗ Could not parse latest backup ID." >&2
	exit 2
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/scalingo-${STAMP}-${LATEST_ID}.tar.gz"

echo "→ Downloading $LATEST_ID → $OUT"
scalingo --app "$APP" --addon "$ADDON_ID" backups-download \
	--backup "$LATEST_ID" \
	--output "$OUT"

SIZE="$(du -h "$OUT" | awk '{print $1}')"
echo ""
echo "✓ Backup written: $OUT ($SIZE)"
echo ""
echo "  Inspect: tar -tzf \"$OUT\""
echo "  Extract: tar -xzf \"$OUT\" -C backups/"
