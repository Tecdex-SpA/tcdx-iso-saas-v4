#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BASE_FIXTURE="$REPO_ROOT/tests/fixtures/phase1-base-schema.sql"
MASTER_FIXTURE="$REPO_ROOT/tests/fixtures/phase2-master-schema.sql"
PHASE1_MIGRATION="$REPO_ROOT/database/migrations/20260722_phase1_grc_core.sql"
PHASE1R_MIGRATION="$REPO_ROOT/database/migrations/20260723_phase1r_operational_closeout.sql"
PHASE2_MIGRATION="$REPO_ROOT/database/migrations/20260727_phase2_integrated_grc.sql"

for file in "$BASE_FIXTURE" "$MASTER_FIXTURE" "$PHASE1_MIGRATION" "$PHASE1R_MIGRATION" "$PHASE2_MIGRATION"; do
  [[ -r "$file" ]] || { echo "Required migration input is not readable: $file" >&2; exit 1; }
done

for command in docker psql awk; do
  command -v "$command" >/dev/null 2>&1 || { echo "Required command is unavailable: $command" >&2; exit 1; }
done

DATABASE_NAME="phase2_test_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase2-postgres-$$"
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

server_version="$(run_psql -Atqc 'SHOW server_version_num')"
[[ "$server_version" =~ ^16[0-9]{4}$ ]] || { echo "PostgreSQL 16 required, got $server_version" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -f "$BASE_FIXTURE" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$MASTER_FIXTURE" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1R_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MIGRATION" >/dev/null

phase2_tables="$(run_psql -Atqc "
  SELECT COUNT(*) FROM pg_tables
  WHERE schemaname = 'public'
    AND (
      tablename LIKE 'privacy_%'
      OR tablename LIKE 'grc_supplier_%'
      OR tablename LIKE 'grc_incident_%'
      OR tablename LIKE 'grc_connector_%'
      OR tablename IN (
        'grc_phase2_relations', 'grc_domain_events', 'grc_rule_executions',
        'grc_operational_alerts', 'grc_metric_observations', 'grc_obligations',
        'grc_control_assurance', 'grc_effectiveness_verifications',
        'grc_suppliers', 'grc_questionnaire_templates',
        'grc_questionnaire_versions', 'grc_questionnaire_sections',
        'grc_questionnaire_questions', 'grc_external_records'
      )
    )")"
phase2_permissions="$(run_psql -Atqc "
  SELECT COUNT(*) FROM permissions
  WHERE permission_key = ANY(ARRAY[
    'privacy.read','privacy.manage','privacy.approve','privacy.dpia.manage',
    'privacy.requests.manage','privacy.breaches.manage','incidents.read',
    'incidents.manage','incidents.command','incidents.close',
    'incidents.notifications.manage','suppliers.read','suppliers.manage',
    'suppliers.assess','suppliers.approve','suppliers.portal.manage',
    'connectors.read','connectors.manage','connectors.credentials.manage',
    'connectors.sync.run','connectors.logs.read','grc.phase2.export'
  ])")"
invalid_fks="$(run_psql -Atqc "
  SELECT COUNT(*) FROM pg_constraint
  WHERE contype = 'f'
    AND connamespace = 'public'::regnamespace
    AND NOT convalidated")"
module_default="$(run_psql -Atqc "SELECT default_enabled FROM saas_modules WHERE module_key='grc_phase2_integrated'")"
connector_definitions="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_connector_definitions WHERE status='active'")"
credential_column="$(run_psql -Atqc "
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tenant_integrations'
    AND column_name='credential_envelope' AND data_type='jsonb'")"
provenance_check="$(run_psql -Atqc "
  SELECT COUNT(*) FROM pg_constraint
  WHERE conrelid='grc_metric_observations'::regclass
    AND pg_get_constraintdef(oid) LIKE '%provenance%'")"

(( phase2_tables >= 39 )) || { echo "Expected at least 39 Phase 2 tables, got $phase2_tables" >&2; exit 1; }
(( phase2_permissions == 22 )) || { echo "Expected 22 Phase 2 permissions, got $phase2_permissions" >&2; exit 1; }
(( invalid_fks == 0 )) || { echo "Unvalidated foreign keys found: $invalid_fks" >&2; exit 1; }
[[ "$module_default" == "f" ]] || { echo "Phase 2 module must be disabled by default" >&2; exit 1; }
(( connector_definitions == 4 )) || { echo "Expected four active connector definitions" >&2; exit 1; }
(( credential_column == 1 )) || { echo "Encrypted credential envelope column missing" >&2; exit 1; }
(( provenance_check >= 1 )) || { echo "Metric provenance constraint missing" >&2; exit 1; }

echo "Phase 2 migration VERIFIED on disposable PostgreSQL 16: twice=true tables=$phase2_tables permissions=$phase2_permissions connectors=$connector_definitions"
