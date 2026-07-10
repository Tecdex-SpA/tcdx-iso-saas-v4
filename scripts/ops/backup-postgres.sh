#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  PGHOST=<host> PGDATABASE=<db> PGUSER=<user> [PGPASSWORD=<password>] \
    bash scripts/ops/backup-postgres.sh

Required environment:
  PGHOST, PGDATABASE, PGUSER

Optional environment:
  PGPORT       Default: 5432
  BACKUP_DIR   Default: /tmp/tcdx-backups

Notes:
  - Uses pg_dump custom format (-Fc).
  - Does not use --clean.
  - Does not print passwords or tokens.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

PGPORT="${PGPORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/tcdx-backups}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "${name} is required. Export it before running this script."
  fi
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: ${cmd}"
}

sha_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" > "${file}.sha256"
    printf 'Checksum: %s\n' "${file}.sha256"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" > "${file}.sha256"
    printf 'Checksum: %s\n' "${file}.sha256"
  else
    printf 'WARN: sha256sum/shasum not found; checksum not generated.\n' >&2
  fi
}

file_size() {
  local file="$1"
  if command -v stat >/dev/null 2>&1; then
    stat -f '%z bytes' "$file" 2>/dev/null || stat -c '%s bytes' "$file" 2>/dev/null || wc -c < "$file"
  else
    wc -c < "$file"
  fi
}

check_connection() {
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null \
      || fail "PostgreSQL is not ready for the configured host/database."
    return 0
  fi

  require_cmd psql
  PGPASSWORD="${PGPASSWORD:-}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    -v ON_ERROR_STOP=1 -qAt -c 'select 1;' >/dev/null \
    || fail "PostgreSQL connection check failed."
}

require_env PGHOST
require_env PGDATABASE
require_env PGUSER
require_cmd pg_dump
check_connection

mkdir -p "$BACKUP_DIR"
[[ -d "$BACKUP_DIR" ]] || fail "BACKUP_DIR is not a directory: ${BACKUP_DIR}"
[[ -w "$BACKUP_DIR" ]] || fail "BACKUP_DIR is not writable: ${BACKUP_DIR}"

TS="$(date '+%Y%m%d_%H%M%S')"
SAFE_DB_NAME="$(printf '%s' "$PGDATABASE" | tr -c 'A-Za-z0-9_.-' '_')"
BACKUP_FILE="${BACKUP_DIR%/}/${SAFE_DB_NAME}_${TS}.dump"

printf 'Creating PostgreSQL logical backup...\n'
printf 'Host: %s\n' "$PGHOST"
printf 'Port: %s\n' "$PGPORT"
printf 'Database: %s\n' "$PGDATABASE"
printf 'User: %s\n' "$PGUSER"
printf 'Backup file: %s\n' "$BACKUP_FILE"

PGPASSWORD="${PGPASSWORD:-}" pg_dump \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  -Fc \
  -f "$BACKUP_FILE"

[[ -s "$BACKUP_FILE" ]] || fail "Backup file was not created or is empty: ${BACKUP_FILE}"

sha_file "$BACKUP_FILE"

printf 'Backup OK: %s\n' "$BACKUP_FILE"
printf 'Size: %s\n' "$(file_size "$BACKUP_FILE")"
