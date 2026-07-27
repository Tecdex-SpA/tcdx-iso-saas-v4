#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

artifact="$REPO_ROOT/artifacts/fase-1/phase1-migration-check.json"
fixture="$REPO_ROOT/tests/fixtures/phase1-base-schema.sql"
migration="$REPO_ROOT/database/migrations/20260722_phase1_grc_core.sql"
operational_migration="$REPO_ROOT/database/migrations/20260723_phase1r_operational_closeout.sql"
artifact_writer="$REPO_ROOT/scripts/phase1/write-phase1-migration-artifact.js"
integration_test="$REPO_ROOT/backend/src/services/grc/grcPostgres.integration.test.js"
cleanup_integration_test="$REPO_ROOT/scripts/phase1/cleanup-phase1-qa.integration.test.js"

for required_file in "$fixture" "$migration" "$operational_migration" "$artifact_writer" "$integration_test" "$cleanup_integration_test"; do
  if [[ ! -f "$required_file" ]]; then
    echo "ERROR: required Phase 1 migration-check file does not exist: $required_file" >&2
    exit 1
  fi
  if [[ ! -r "$required_file" ]]; then
    echo "ERROR: required Phase 1 migration-check file is not readable: $required_file" >&2
    exit 1
  fi
done

for required_command in psql node grep awk mktemp; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "ERROR: required command is not available: $required_command" >&2
    exit 1
  fi
done

runtime_dir=""
data_dir=""
socket_dir=""
port=""
database_name="phase1_test_$(date +%s)_$$"
postgres_mode=""
container_name=""
declare -a psql_connection

cleanup() {
  local exit_code=$?
  local cleanup_failed=0

  trap - EXIT INT TERM

  if [[ "$postgres_mode" == "local" && -d "$data_dir" ]]; then
    if ! pg_ctl -D "$data_dir" -m fast -w stop >/dev/null; then
      echo "ERROR: failed to stop disposable local PostgreSQL" >&2
      cleanup_failed=1
    fi
  fi
  if [[ "$postgres_mode" == "docker" && -n "$container_name" ]]; then
    if ! docker rm -f "$container_name" >/dev/null; then
      echo "ERROR: failed to remove disposable PostgreSQL container: $container_name" >&2
      cleanup_failed=1
    elif docker container inspect "$container_name" >/dev/null 2>&1; then
      echo "ERROR: disposable PostgreSQL container still exists after cleanup: $container_name" >&2
      cleanup_failed=1
    fi
  fi
  if [[ -n "$runtime_dir" && -d "$runtime_dir" ]]; then
    if ! rm -rf -- "$runtime_dir"; then
      echo "ERROR: failed to remove disposable PostgreSQL runtime directory: $runtime_dir" >&2
      cleanup_failed=1
    fi
  fi

  if (( exit_code != 0 )); then
    exit "$exit_code"
  fi
  if (( cleanup_failed != 0 )); then
    exit 1
  fi
  exit 0
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/tcdx-phase1-postgres.XXXXXX")"
data_dir="$runtime_dir/data"
socket_dir="$runtime_dir/socket"
mkdir -p "$socket_dir" "$(dirname "$artifact")"

run_psql() {
  psql "${psql_connection[@]}" "$@"
}

local_postgres_major=""
if command -v postgres >/dev/null 2>&1; then
  local_postgres_major="$(postgres --version | awk '{ split($3, version, "."); print version[1] }')"
fi

if [[ "$local_postgres_major" == "16" ]] \
  && command -v initdb >/dev/null 2>&1 \
  && command -v pg_ctl >/dev/null 2>&1 \
  && command -v createdb >/dev/null 2>&1; then
  port=55439
  initdb -D "$data_dir" -A trust -U postgres --no-locale >/dev/null
  pg_ctl -D "$data_dir" -o "-F -k $socket_dir -p $port -c listen_addresses=''" -w start >/dev/null
  postgres_mode="local"
  createdb -h "$socket_dir" -p "$port" -U postgres "$database_name"
  psql_connection=(-h "$socket_dir" -p "$port" -U postgres -d "$database_name")
  integration_host="$socket_dir"
elif command -v docker >/dev/null 2>&1; then
  container_name="tcdx-phase1-postgres-$$"
  docker run --detach --name "$container_name" \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$database_name" \
    -p "127.0.0.1::5432" postgres:16-alpine >/dev/null
  postgres_mode="docker"
  port="$(docker port "$container_name" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
  if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Docker did not publish a valid PostgreSQL port: $port" >&2
    exit 1
  fi
  psql_connection=(-h 127.0.0.1 -p "$port" -U postgres -d "$database_name")
  integration_host="127.0.0.1"
  ready=0
  attempt=1
  while (( attempt <= 60 )); do
    if run_psql -Atqc 'SELECT 1' >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  if (( ready != 1 )); then
    echo "ERROR: disposable PostgreSQL 16 container was not ready after 60 seconds" >&2
    exit 1
  fi
else
  echo "ERROR: PostgreSQL 16 server tools or Docker are required for the disposable migration check" >&2
  exit 1
fi

server_version_num="$(run_psql -Atqc 'SHOW server_version_num')"
if [[ ! "$server_version_num" =~ ^[0-9]+$ ]] \
  || (( server_version_num < 160000 || server_version_num >= 170000 )); then
  echo "ERROR: disposable server must be PostgreSQL 16, got server_version_num=$server_version_num" >&2
  exit 1
fi

if [[ "$(run_psql -Atqc 'SELECT current_database()')" != "$database_name" ]]; then
  echo "ERROR: disposable database identity mismatch" >&2
  exit 1
fi

destructive_pattern='^[[:space:]]*(DROP[[:space:]]|TRUNCATE[[:space:]]|DELETE[[:space:]]+FROM[[:space:]]|ALTER[[:space:]]+TABLE.*DROP[[:space:]])'
for migration_file in "$migration" "$operational_migration"; do
  if destructive_matches="$(LC_ALL=C grep -En "$destructive_pattern" "$migration_file")"; then
    printf '%s\n' "$destructive_matches" >&2
    echo "ERROR: destructive SQL operation found in Phase 1 migration: $migration_file" >&2
    exit 1
  else
    grep_status=$?
    if (( grep_status != 1 )); then
      echo "ERROR: failed to inspect Phase 1 migration for destructive SQL operations: $migration_file" >&2
      exit 1
    fi
  fi
done

run_psql -v ON_ERROR_STOP=1 -f "$fixture" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$operational_migration" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$operational_migration" >/dev/null

table_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'grc_%'")"
index_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_grc_%'")"
constraint_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'grc_%'")"
foreign_key_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'grc_%'")"
invalid_foreign_keys="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'grc_%' AND NOT convalidated")"
permission_count="$(run_psql -Atqc "SELECT COUNT(*) FROM permissions WHERE permission_group IN ('workflow','evidence','readiness','framework','audit')")"
framework_count="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_frameworks WHERE tenant_id IS NULL")"
version_count="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_framework_versions WHERE tenant_id IS NULL AND status='published'")"
module_default="$(run_psql -Atqc "SELECT default_enabled FROM saas_modules WHERE module_key='grc_phase1_core'")"
function_present="$(run_psql -Atqc "SELECT to_regprocedure('grc_reject_immutable_update()') IS NOT NULL")"
trigger_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('trg_grc_published_workflow_immutable','trg_grc_readiness_snapshot_immutable','trg_grc_readiness_result_immutable') AND NOT tgisinternal")"
bootstrap_table_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('grc_tenant_configurations','grc_bootstrap_runs')")"
bootstrap_index_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname='idx_grc_bootstrap_runs_tenant_created'")"
framework_root_count="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_framework_requirements WHERE tenant_id IS NULL AND reference_code='FRAMEWORK-ROOT'")"
mapping_metadata_present="$(run_psql -Atqc "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='grc_requirement_control_mappings' AND column_name='metadata'")"

if (( table_count < 49 )); then echo "ERROR: expected at least 49 grc tables, got $table_count" >&2; exit 1; fi
if (( index_count < 21 )); then echo "ERROR: expected at least 21 grc indexes, got $index_count" >&2; exit 1; fi
if (( constraint_count < 120 || foreign_key_count < 75 )); then echo "ERROR: incomplete constraints: total=$constraint_count fk=$foreign_key_count" >&2; exit 1; fi
if (( invalid_foreign_keys != 0 )); then echo "ERROR: unvalidated foreign keys: $invalid_foreign_keys" >&2; exit 1; fi
if (( permission_count < 18 )); then echo "ERROR: expected at least 18 permissions, got $permission_count" >&2; exit 1; fi
if (( framework_count != 9 || version_count != 9 )); then echo "ERROR: expected 9 frameworks and versions, got $framework_count/$version_count" >&2; exit 1; fi
if (( bootstrap_table_count != 2 || bootstrap_index_count != 1 || framework_root_count != 9 || mapping_metadata_present != 1 )); then
  echo "ERROR: Phase 1R operational schema invariant failed: tables=$bootstrap_table_count indexes=$bootstrap_index_count framework_roots=$framework_root_count mapping_metadata=$mapping_metadata_present" >&2
  exit 1
fi
if [[ "$module_default" != "f" || "$function_present" != "t" || "$trigger_count" != "3" ]]; then
  echo "ERROR: feature flag/function/trigger invariant failed" >&2
  exit 1
fi

if [[ "${PHASE1_RUN_INTEGRATION:-false}" == "true" ]]; then
  PGHOST="$integration_host" \
  PGPORT="$port" \
  PGUSER="postgres" \
  PGDATABASE="$database_name" \
  node "$integration_test"
  DATABASE_URL="postgresql://postgres@${integration_host}:${port}/${database_name}" \
  PGHOST="$integration_host" \
  PGPORT="$port" \
  PGUSER="postgres" \
  PGDATABASE="$database_name" \
  PHASE1_QA_ENV="qa" \
  node "$cleanup_integration_test"
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
PHASE1_OPERATIONAL_MIGRATION_APPLICATIONS="2" \
PHASE1_BOOTSTRAP_TABLES="$bootstrap_table_count" \
PHASE1_MIGRATION_ARTIFACT="$artifact" \
PHASE1_REPO_ROOT="$REPO_ROOT" \
node "$artifact_writer"

echo "Phase 1/1R migrations VERIFIED on disposable PostgreSQL ($postgres_mode): twice=true tables=$table_count indexes=$index_count constraints=$constraint_count fk=$foreign_key_count"
