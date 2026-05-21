#!/usr/bin/env bash
#
# Take a backup of the production database through an open Scalingo tunnel.
#
# Prerequisites:
#   1. `scalingo` CLI installed and authenticated.
#   2. A Postgres tunnel open on 127.0.0.1:10000, e.g.:
#        scalingo --app crmenergy db-tunnel SCALINGO_POSTGRESQL_URL
#   3. `pg_dump` installed locally (Postgres client). On macOS:
#        brew install postgresql@17
#
# Output:
#   backups/lummus-YYYYMMDD-HHMMSS.dump  (Postgres custom format, compressed)
#
# Restore example (to a local db named "lummus_restore"):
#   createdb lummus_restore
#   pg_restore -d lummus_restore --no-owner --no-privileges backups/lummus-...dump
#
# Schema-only or data-only variants:
#   ./scripts/backup-prod.sh --schema   # structure only
#   ./scripts/backup-prod.sh --data     # rows only
#   ./scripts/backup-prod.sh --plain    # plain SQL .sql.gz instead of -Fc
#
set -euo pipefail

APP="${SCALINGO_APP:-crmenergy}"
TUNNEL_PORT="${TUNNEL_PORT:-10000}"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"

# ---------- argument parsing ----------
MODE="full"  # full | schema | data
FORMAT="custom"  # custom (-Fc) | plain (.sql.gz)
for arg in "$@"; do
	case "$arg" in
		--schema) MODE="schema" ;;
		--data) MODE="data" ;;
		--plain) FORMAT="plain" ;;
		-h|--help)
			sed -n '2,25p' "$0"  # print the doc comment
			exit 0
			;;
		*)
			echo "Unknown argument: $arg" >&2
			exit 1
			;;
	esac
done

# ---------- preflight ----------
if ! command -v pg_dump >/dev/null; then
	echo "✗ pg_dump not found. Install postgresql client tools first." >&2
	exit 1
fi

if ! lsof -nP -iTCP:"$TUNNEL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
	echo "✗ No tunnel on 127.0.0.1:$TUNNEL_PORT." >&2
	echo "  Open one with: scalingo --app $APP db-tunnel SCALINGO_POSTGRESQL_URL" >&2
	exit 1
fi

if ! command -v scalingo >/dev/null; then
	echo "✗ scalingo CLI not found. Install from https://doc.scalingo.com/cli." >&2
	exit 1
fi

# ---------- fetch DB credentials from Scalingo env ----------
echo "→ Fetching DB credentials for app $APP…"
PROD_URL="$(scalingo --app "$APP" env 2>/dev/null \
	| awk -F= '/^SCALINGO_POSTGRESQL_URL=/{ sub(/^SCALINGO_POSTGRESQL_URL=/,""); print; exit }')"

if [ -z "${PROD_URL:-}" ]; then
	echo "✗ Could not read SCALINGO_POSTGRESQL_URL from $APP env." >&2
	exit 1
fi

# Rewrite the host:port to point at the local tunnel.
# Original: postgres://user:pass@host:port/dbname?…
# Rewritten: postgres://user:pass@127.0.0.1:$TUNNEL_PORT/dbname?…
LOCAL_URL="$(printf '%s' "$PROD_URL" \
	| sed -E "s|@[^/:]+:[0-9]+/|@127.0.0.1:${TUNNEL_PORT}/|")"

# ---------- run the dump ----------
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

PG_DUMP_OPTS=( "--no-owner" "--no-privileges" )
case "$MODE" in
	schema) PG_DUMP_OPTS+=( "--schema-only" ) ;;
	data)   PG_DUMP_OPTS+=( "--data-only" ) ;;
esac

if [ "$FORMAT" = "custom" ]; then
	OUT="$BACKUP_DIR/lummus-${MODE}-${STAMP}.dump"
	echo "→ Dumping ($MODE, custom format) to $OUT…"
	pg_dump "$LOCAL_URL" --format=custom "${PG_DUMP_OPTS[@]}" --file="$OUT"
else
	OUT="$BACKUP_DIR/lummus-${MODE}-${STAMP}.sql.gz"
	echo "→ Dumping ($MODE, plain SQL gzipped) to $OUT…"
	pg_dump "$LOCAL_URL" "${PG_DUMP_OPTS[@]}" | gzip -9 > "$OUT"
fi

# ---------- report ----------
SIZE="$(du -h "$OUT" | awk '{print $1}')"
echo ""
echo "✓ Backup written: $OUT ($SIZE)"

if [ "$FORMAT" = "custom" ]; then
	echo ""
	echo "  Inspect contents:    pg_restore --list \"$OUT\" | head"
	echo "  Restore to new DB:   createdb lummus_restore && pg_restore -d lummus_restore --no-owner --no-privileges \"$OUT\""
fi
