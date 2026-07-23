#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
artifact="$repo_root/artifacts/fase-1/phase1-migration-check.json"
fixture="$repo_root/tests/fixtures/phase1-base-schema.sql"
migration="$repo_root/database/migrations/20260722_phase1_grc_core.sql"
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/tcdx-phase1-postgres.XXXXXX")"
data_dir="$runtime_dir/data"
socket_dir="$runtime_dir/socket"
port=55439
database_name="phase1_test_$(date +%s)_$$"
database_url=""
postgres_mode=""
container_name=""

finish() {
  local exit_code=$?
  if [[ "$postgres_mode" == "local" && -d "$data_dir" ]]; then
    pg_ctl -D "$data_dir" -m fast -w stop >/dev/null 2>&1 || :
  fi
  if [[ "$postgres_mode" == "docker" && -n "$container_name" ]]; then
    docker rm -f "$container_name" >/dev/null 2>&1 || :
  fi
  rm -rf "$runtime_dir"
  exit "$exit_code"
}
trap finish EXIT INT TERM

mkdir -p "$socket_dir" "$(dirname "$artifact")"

while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
  port=$((port + 1))
done

if command -v postgres >/dev/null 2>&1 && command -v initdb >/dev/null 2>&1 && command -v pg_ctl >/dev/null 2>&1 && command -v createdb >/dev/null 2>&1; then
  postgres_mode="local"
  initdb -D "$data_dir" -A trust -U postgres --no-locale >/dev/null
  pg_ctl -D "$data_dir" -o "-F -k $socket_dir -h 127.0.0.1 -p $port" -w start >/dev/null
  createdb -h 127.0.0.1 -p "$port" -U postgres "$database_name"
  database_url="postgresql://postgres@127.0.0.1:$port/$database_name"
elif command -v docker >/dev/null 2>&1; then
  postgres_mode="docker"
  container_name="tcdx-phase1-postgres-$$"
  docker run --detach --rm --name "$container_name" \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$database_name" \
    -p "127.0.0.1:$port:5432" postgres:16-alpine >/dev/null
  database_url="postgresql://postgres@127.0.0.1:$port/$database_name"
  for _attempt in $(seq 1 60); do
    if psql "$database_url" -Atqc 'SELECT 1' >/dev/null 2>&1; then break; fi
    sleep 1
  done
else
  echo "ERROR: initdb/pg_ctl or Docker is required for a real disposable PostgreSQL check" >&2
  exit 1
fi

if [[ "$(psql "$database_url" -Atqc 'SELECT current_database()')" != "$database_name" ]]; then
  echo "ERROR: disposable database identity mismatch" >&2
  exit 1
fi

if rg -n '^[[:space:]]*(DROP[[:space:]]|TRUNCATE[[:space:]]|DELETE[[:space:]]+FROM[[:space:]]|ALTER[[:space:]]+TABLE.*DROP[[:space:]])' "$migration"; then
  echo "ERROR: destructive SQL operation found in Phase 1 migration" >&2
  exit 1
fi

psql "$database_url" -v ON_ERROR_STOP=1 -f "$fixture" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null

table_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'grc_%'")"
index_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_grc_%'")"
constraint_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'grc_%'")"
foreign_key_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'grc_%'")"
invalid_foreign_keys="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'grc_%' AND NOT convalidated")"
permission_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM permissions WHERE permission_group IN ('workflow','evidence','readiness','framework','audit')")"
framework_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM grc_frameworks WHERE tenant_id IS NULL")"
version_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM grc_framework_versions WHERE tenant_id IS NULL AND status='published'")"
module_default="$(psql "$database_url" -Atqc "SELECT default_enabled FROM saas_modules WHERE module_key='grc_phase1_core'")"
function_present="$(psql "$database_url" -Atqc "SELECT to_regprocedure('grc_reject_immutable_update()') IS NOT NULL")"
trigger_count="$(psql "$database_url" -Atqc "SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('trg_grc_published_workflow_immutable','trg_grc_readiness_snapshot_immutable','trg_grc_readiness_result_immutable') AND NOT tgisinternal")"

if (( table_count < 47 )); then echo "ERROR: expected at least 47 grc tables, got $table_count" >&2; exit 1; fi
if (( index_count < 19 )); then echo "ERROR: expected at least 19 grc indexes, got $index_count" >&2; exit 1; fi
if (( constraint_count < 120 || foreign_key_count < 75 )); then echo "ERROR: incomplete constraints: total=$constraint_count fk=$foreign_key_count" >&2; exit 1; fi
if (( invalid_foreign_keys != 0 )); then echo "ERROR: unvalidated foreign keys: $invalid_foreign_keys" >&2; exit 1; fi
if (( permission_count < 18 )); then echo "ERROR: expected at least 18 permissions, got $permission_count" >&2; exit 1; fi
if (( framework_count != 9 || version_count != 9 )); then echo "ERROR: expected 9 frameworks and versions, got $framework_count/$version_count" >&2; exit 1; fi
if [[ "$module_default" != "f" || "$function_present" != "t" || "$trigger_count" != "3" ]]; then
  echo "ERROR: feature flag/function/trigger invariant failed" >&2
  exit 1
fi

PHASE1_MIGRATION_STATUS="VERIFIED_LOCAL_POSTGRESQL" \
PHASE1_MIGRATION_MODE="$postgres_mode" \
PHASE1_MIGRATION_TABLES="$table_count" \
PHASE1_MIGRATION_INDEXES="$index_count" \
PHASE1_MIGRATION_CONSTRAINTS="$constraint_count" \
PHASE1_MIGRATION_FOREIGN_KEYS="$foreign_key_count" \
PHASE1_MIGRATION_PERMISSIONS="$permission_count" \
PHASE1_MIGRATION_FRAMEWORKS="$framework_count" \
PHASE1_MIGRATION_VERSIONS="$version_count" \
PHASE1_MIGRATION_ARTIFACT="$artifact" \
node "$repo_root/scripts/phase1/write-phase1-migration-artifact.js"

echo "Phase 1 migration VERIFIED on disposable PostgreSQL ($postgres_mode): twice=true tables=$table_count indexes=$index_count constraints=$constraint_count fk=$foreign_key_count"
