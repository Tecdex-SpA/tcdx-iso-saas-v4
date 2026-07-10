#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  PGHOST=<host> PGDATABASE=<prod_db> PGUSER=<user> [PGPASSWORD=<password>] \
    bash scripts/ops/restore-postgres-smoke-test.sh /path/to/backup.dump

Required environment:
  PGHOST, PGDATABASE, PGUSER

Optional environment:
  PGPORT                 Default: 5432
  RESTORE_TEST_DB        Default: tcdx_restore_smoke_YYYYMMDD_HHMMSS
  DROP_RESTORE_TEST_DB   Default: false. Set true to drop the temporary DB after validation.

Safety:
  - Never restores into PGDATABASE.
  - Never restores into tecdx_saas.
  - Temporary DB names must start with tcdx_restore_smoke_.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

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

run_psql() {
  PGPASSWORD="${PGPASSWORD:-}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$@"
}

validate_db_name() {
  local name="$1"

  [[ "$name" != "$PGDATABASE" ]] || fail "RESTORE_TEST_DB cannot equal PGDATABASE (${PGDATABASE})."
  [[ "$name" != "tecdx_saas" ]] || fail "RESTORE_TEST_DB cannot be tecdx_saas."
  [[ "$name" == tcdx_restore_smoke_* ]] || fail "RESTORE_TEST_DB must start with tcdx_restore_smoke_."
  [[ "$name" =~ ^[A-Za-z0-9_]+$ ]] || fail "RESTORE_TEST_DB may contain only letters, numbers and underscores."
}

count_table_if_exists() {
  local table="$1"
  local exists
  local count

  exists="$(run_psql -d "$RESTORE_TEST_DB" -v ON_ERROR_STOP=1 -qAt \
    -c "select to_regclass('public.${table}') is not null;")"

  if [[ "$exists" == "t" ]]; then
    count="$(run_psql -d "$RESTORE_TEST_DB" -v ON_ERROR_STOP=1 -qAt \
      -c "select count(*) from public.${table};")"
    printf 'Table %-28s count=%s\n' "$table" "$count"
  else
    printf 'Table %-28s not present; skipped\n' "$table"
  fi
}

BACKUP_FILE="${1:-}"
[[ -n "$BACKUP_FILE" ]] || fail "Backup file argument is required. Use --help for usage."
[[ -f "$BACKUP_FILE" ]] || fail "Backup file not found: ${BACKUP_FILE}"
[[ -s "$BACKUP_FILE" ]] || fail "Backup file is empty: ${BACKUP_FILE}"

PGPORT="${PGPORT:-5432}"
TS="$(date '+%Y%m%d_%H%M%S')"
RESTORE_TEST_DB="${RESTORE_TEST_DB:-tcdx_restore_smoke_${TS}}"
DROP_RESTORE_TEST_DB="${DROP_RESTORE_TEST_DB:-false}"

require_env PGHOST
require_env PGDATABASE
require_env PGUSER
require_cmd psql
require_cmd createdb
require_cmd pg_restore

if [[ "$DROP_RESTORE_TEST_DB" == "true" ]]; then
  require_cmd dropdb
fi

validate_db_name "$RESTORE_TEST_DB"

printf 'Restore smoke test plan:\n'
printf 'Host: %s\n' "$PGHOST"
printf 'Port: %s\n' "$PGPORT"
printf 'Production database reference: %s\n' "$PGDATABASE"
printf 'Temporary restore database: %s\n' "$RESTORE_TEST_DB"
printf 'Backup file: %s\n' "$BACKUP_FILE"
printf 'Drop temporary DB after test: %s\n' "$DROP_RESTORE_TEST_DB"

PGPASSWORD="${PGPASSWORD:-}" createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$RESTORE_TEST_DB"

printf 'Restoring backup into temporary database...\n'
PGPASSWORD="${PGPASSWORD:-}" pg_restore \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$RESTORE_TEST_DB" \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"

printf 'Validating restored database...\n'
run_psql -d "$RESTORE_TEST_DB" -v ON_ERROR_STOP=1 -qAt -c 'select 1;' >/dev/null
run_psql -d "$RESTORE_TEST_DB" -v ON_ERROR_STOP=1 \
  -c "select current_database() as restored_database, count(*) as public_tables from information_schema.tables where table_schema = 'public';"

for table in \
  tenants \
  users \
  tenant_controls \
  control_soa \
  control_soa_assessments \
  control_soa_change_log \
  evidences \
  findings \
  action_plans \
  audits
do
  count_table_if_exists "$table"
done

if [[ "$DROP_RESTORE_TEST_DB" == "true" ]]; then
  printf 'DROP_RESTORE_TEST_DB=true: dropping temporary database %s\n' "$RESTORE_TEST_DB"
  PGPASSWORD="${PGPASSWORD:-}" dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$RESTORE_TEST_DB"
else
  printf 'Temporary database preserved for inspection: %s\n' "$RESTORE_TEST_DB"
  printf 'Manual cleanup command:\n'
  printf "  dropdb -h '%s' -p '%s' -U '%s' '%s'\n" "$PGHOST" "$PGPORT" "$PGUSER" "$RESTORE_TEST_DB"
fi

printf 'Restore smoke test OK.\n'
