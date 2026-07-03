#!/usr/bin/env bash
#
# ComplianceCore database backup.
# Dumps the full Postgres database (all tenant schemas) in compressed custom
# format, then optionally uploads to S3 and prunes old local copies.
#
#   DATABASE_URL=postgres://...  ./backup.sh
#
# Optional env:
#   BACKUP_DIR      local output dir            (default ./backups)
#   BACKUP_S3_URI   e.g. s3://my-bucket/db      (upload if set + aws cli present)
#   RETENTION_DAYS  prune local dumps older than N days (default 14)
#
# Requires: pg_dump (postgresql-client), gzip. aws cli only if BACKUP_S3_URI set.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/compliancecore-${STAMP}.dump"

echo "[backup] dumping database -> $FILE"
# -Fc = custom compressed format (restore with pg_restore); --no-owner for portability
pg_dump "$DATABASE_URL" -Fc --no-owner --no-acl -f "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "[backup] wrote $FILE ($SIZE)"

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  if command -v aws >/dev/null 2>&1; then
    echo "[backup] uploading -> ${BACKUP_S3_URI}/compliancecore-${STAMP}.dump"
    aws s3 cp "$FILE" "${BACKUP_S3_URI}/compliancecore-${STAMP}.dump"
  else
    echo "[backup] WARN: BACKUP_S3_URI set but aws cli not found — skipping upload" >&2
  fi
fi

echo "[backup] pruning local dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'compliancecore-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete || true

echo "[backup] done"
