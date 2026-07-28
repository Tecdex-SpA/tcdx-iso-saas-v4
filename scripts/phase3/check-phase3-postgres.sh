#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BASE_FIXTURE="$REPO_ROOT/tests/fixtures/phase1-base-schema.sql"
PHASE2_MASTER="$REPO_ROOT/tests/fixtures/phase2-master-schema.sql"
PHASE3_MASTER="$REPO_ROOT/tests/fixtures/phase3-master-schema.sql"
PHASE1_MIGRATION="$REPO_ROOT/database/migrations/20260722_phase1_grc_core.sql"
PHASE1R_MIGRATION="$REPO_ROOT/database/migrations/20260723_phase1r_operational_closeout.sql"
PHASE2_MIGRATION="$REPO_ROOT/database/migrations/20260727_phase2_integrated_grc.sql"
PHASE3_MIGRATION="$REPO_ROOT/database/migrations/20260728_phase3_operational_grc.sql"
ONBOARDING_MIGRATION="$REPO_ROOT/database/migrations/20260729_phase3_operational_onboarding.sql"
MIGRATION_RUNNER="$REPO_ROOT/scripts/phase3/apply-phase3-migration.js"
INTEGRATION_TEST="$REPO_ROOT/backend/src/services/grc/phase3Postgres.integration.test.js"

for file in \
  "$BASE_FIXTURE" "$PHASE2_MASTER" "$PHASE3_MASTER" "$PHASE1_MIGRATION" \
  "$PHASE1R_MIGRATION" "$PHASE2_MIGRATION" "$PHASE3_MIGRATION" \
  "$ONBOARDING_MIGRATION" "$MIGRATION_RUNNER" "$INTEGRATION_TEST"; do
  [[ -r "$file" ]] || { echo "Required integration input is not readable: $file" >&2; exit 1; }
done

DATABASE_NAME="phase3_runtime_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase3-runtime-$$-$RANDOM"
PORT=""

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --detach --name "$CONTAINER_NAME" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB="$DATABASE_NAME" \
  -p "127.0.0.1::5432" \
  postgres:16-alpine >/dev/null

PORT="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "Docker did not publish PostgreSQL port" >&2; exit 1; }

run_psql() {
  psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE_NAME" "$@"
}

ready=0
for _attempt in {1..45}; do
  if run_psql -Atqc 'SELECT 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
(( ready == 1 )) || { echo "Disposable PostgreSQL 16 did not become ready" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -f "$BASE_FIXTURE" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1R_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "
  INSERT INTO tenants (id,name)
  VALUES ('70000000-0000-0000-0000-000000000701','Synthetic migration tenant');
" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "
  CREATE TABLE public.schema_migrations (
    migration_id text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz,
    applied_by text NOT NULL,
    duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    status text NOT NULL CHECK (status IN ('running','applied','failed')),
    details jsonb NOT NULL DEFAULT '{}'::jsonb
  );
  INSERT INTO public.schema_migrations (
    migration_id,checksum,applied_at,applied_by,status
  ) VALUES (
    '20260728_phase3_operational_grc',
    '2dd9376e49937795bc7dbd03332536e26f4e8bfbc883d731818dda9fa620bb50',
    now(),
    current_user,
    'applied'
  );
" >/dev/null

MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" \
  node "$MIGRATION_RUNNER" --apply

DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" \
  DISABLE_PHASE2_SCHEDULER=1 \
  node "$INTEGRATION_TEST"
