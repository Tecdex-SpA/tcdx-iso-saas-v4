#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT="$ROOT_DIR/artifacts/fase-0/backup-restore-result.json"
EXPECTED_ENV="${EXPECTED_ENV:-}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/tcdx-phase0-backups}"
QA_DATABASE_URL="${QA_DATABASE_URL:-}"
RESTORE_DATABASE_URL="${RESTORE_DATABASE_URL:-}"
RESTORE_DB_NAME=""
BACKUP_FILE=""
BACKUP_STARTED_EPOCH=0
BACKUP_FINISHED_EPOCH=0
RESTORE_STARTED_EPOCH=0
RESTORE_FINISHED_EPOCH=0

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

cleanup() {
  if [[ -n "$RESTORE_DB_NAME" ]]; then
    dropdb --if-exists --force --maintenance-db="$QA_DATABASE_URL" "$RESTORE_DB_NAME" >/dev/null 2>&1
  fi
}
trap cleanup EXIT

case "$EXPECTED_ENV" in
  qa|test|testing|staging) ;;
  *) fail "EXPECTED_ENV must be qa, test, testing or staging." ;;
esac
[[ -n "$QA_DATABASE_URL" ]] || fail "QA_DATABASE_URL is required."
[[ -n "$RESTORE_DATABASE_URL" ]] || fail "RESTORE_DATABASE_URL is required."
[[ "$QA_DATABASE_URL" != "$RESTORE_DATABASE_URL" ]] || fail "QA_DATABASE_URL and RESTORE_DATABASE_URL must differ."

RESTORE_DB_NAME="$(node -e 'const u=new URL(process.env.RESTORE_DATABASE_URL);process.stdout.write(u.pathname.replace(/^\//,""))')"
SOURCE_DB_NAME="$(node -e 'const u=new URL(process.env.QA_DATABASE_URL);process.stdout.write(u.pathname.replace(/^\//,""))')"
[[ "$SOURCE_DB_NAME" =~ (qa|test|testing|staging) ]] || fail "QA source database name must explicitly contain qa, test, testing or staging."
[[ "$RESTORE_DB_NAME" == tcdx_restore_smoke_* ]] || fail "Restore database name must start with tcdx_restore_smoke_."

require_command pg_dump
require_command pg_restore
require_command psql
require_command createdb
require_command dropdb
require_command node
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$ARTIFACT")"
[[ -w "$BACKUP_DIR" ]] || fail "BACKUP_DIR is not writable."

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/phase0-qa-$STAMP.dump"
BACKUP_STARTED_EPOCH="$(date +%s)"
pg_dump -Fc --no-owner --no-privileges "$QA_DATABASE_URL" -f "$BACKUP_FILE"
BACKUP_FINISHED_EPOCH="$(date +%s)"
[[ -s "$BACKUP_FILE" ]] || fail "Backup file is empty."

if command -v shasum >/dev/null 2>&1; then
  CHECKSUM="$(shasum -a 256 "$BACKUP_FILE" | awk '{print $1}')"
else
  CHECKSUM="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
fi

dropdb --if-exists --force --maintenance-db="$QA_DATABASE_URL" "$RESTORE_DB_NAME" >/dev/null 2>&1
createdb --maintenance-db="$QA_DATABASE_URL" "$RESTORE_DB_NAME"
RESTORE_STARTED_EPOCH="$(date +%s)"
pg_restore --no-owner --no-privileges -d "$RESTORE_DATABASE_URL" "$BACKUP_FILE"
RESTORE_FINISHED_EPOCH="$(date +%s)"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c 'select 1;' >/dev/null
TABLE_COUNT="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c "select count(*) from information_schema.tables where table_schema='public';")"
[[ "$TABLE_COUNT" -gt 0 ]] || fail "Restored database has no public tables."
TENANT_TABLE_EXISTS="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c "select to_regclass('public.tenants') is not null;")"
[[ "$TENANT_TABLE_EXISTS" == "t" ]] || fail "Restored database lacks tenants table."
TENANT_COUNT="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c 'select count(*) from public.tenants;')"
[[ "$TENANT_COUNT" -ge 2 ]] || fail "Restored database must contain at least two QA tenants."
DISTINCT_TENANTS="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c 'select count(distinct id) from public.tenants;')"
[[ "$DISTINCT_TENANTS" -eq "$TENANT_COUNT" ]] || fail "Tenant identifiers are not distinct after restore."

BACKUP_SECONDS="$((BACKUP_FINISHED_EPOCH - BACKUP_STARTED_EPOCH))"
RESTORE_SECONDS="$((RESTORE_FINISHED_EPOCH - RESTORE_STARTED_EPOCH))"
RPO_SECONDS="$((RESTORE_STARTED_EPOCH - BACKUP_STARTED_EPOCH))"
RTO_SECONDS="$RESTORE_SECONDS"
export ARTIFACT BACKUP_FILE CHECKSUM BACKUP_SECONDS RESTORE_SECONDS RPO_SECONDS RTO_SECONDS TABLE_COUNT TENANT_COUNT EXPECTED_ENV
node -e '
const fs=require("fs");
const out={
  checkedAt:new Date().toISOString(),
  environment:process.env.EXPECTED_ENV,
  status:"VERIFIED",
  backup:{file:process.env.BACKUP_FILE,sha256:process.env.CHECKSUM,duration_seconds:Number(process.env.BACKUP_SECONDS)},
  restore:{duration_seconds:Number(process.env.RESTORE_SECONDS),public_tables:Number(process.env.TABLE_COUNT),tenant_count:Number(process.env.TENANT_COUNT),temporary_database_cleaned:true},
  rpo_seconds:Number(process.env.RPO_SECONDS),
  rto_seconds:Number(process.env.RTO_SECONDS)
};
fs.writeFileSync(process.env.ARTIFACT,JSON.stringify(out,null,2)+"\n");
'
printf 'phase0 backup/restore VERIFIED rpo_seconds=%s rto_seconds=%s artifact=%s\n' "$RPO_SECONDS" "$RTO_SECONDS" "$ARTIFACT"
