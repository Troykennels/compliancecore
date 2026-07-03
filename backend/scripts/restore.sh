#!/usr/bin/env bash
#
# ComplianceCore database restore. DESTRUCTIVE — overwrites objects in the
# target database. Only run against a database you intend to replace.
#
#   DATABASE_URL=postgres://...  ./restore.sh ./backups/compliancecore-XXXX.dump
#
# Requires: pg_restore (postgresql-client).
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
DUMP="${1:?Usage: restore.sh <path-to-.dump>}"

if [[ ! -f "$DUMP" ]]; then
  echo "[restore] file not found: $DUMP" >&2
  exit 1
fi

echo "[restore] !! This will overwrite data in the target database."
echo "[restore] target: ${DATABASE_URL%%\?*}"
echo "[restore] source: $DUMP"
read -r -p "[restore] Type 'yes' to continue: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "[restore] aborted"; exit 1; }

# --clean --if-exists drops objects before recreating; -j parallelises
pg_restore --clean --if-exists --no-owner --no-acl -j 4 -d "$DATABASE_URL" "$DUMP"

echo "[restore] done"
