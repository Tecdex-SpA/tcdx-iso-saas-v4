#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BASE_FIXTURE="$REPO_ROOT/tests/fixtures/phase1-base-schema.sql"
PHASE2_MASTER="$REPO_ROOT/scripts/phase5-c2/fixtures/phase2-master-schema.fixture"
PHASE3_MASTER="$REPO_ROOT/tests/fixtures/phase3-master-schema.sql"
PHASE1_MIGRATION="$REPO_ROOT/database/migrations/20260722_phase1_grc_core.sql"
PHASE1R_MIGRATION="$REPO_ROOT/database/migrations/20260723_phase1r_operational_closeout.sql"
PHASE2_MIGRATION="$REPO_ROOT/database/migrations/20260727_phase2_integrated_grc.sql"
PHASE3_MIGRATION="$REPO_ROOT/database/migrations/20260728_phase3_operational_grc.sql"
PHASE4_MIGRATION="$REPO_ROOT/database/migrations/20260729_phase4_commercial_product.sql"
PHASE5_RUNNER="$REPO_ROOT/scripts/phase5/apply-phase5-migration.js"
BOOTSTRAP="$REPO_ROOT/scripts/phase5-5/bootstrap-official-math-governance.js"
C2_RUNNER="$REPO_ROOT/scripts/phase5-c2/apply-phase5-c2-migration.js"

for file in "$BASE_FIXTURE" "$PHASE2_MASTER" "$PHASE3_MASTER" "$PHASE1_MIGRATION" "$PHASE1R_MIGRATION" "$PHASE2_MIGRATION" "$PHASE3_MIGRATION" "$PHASE4_MIGRATION" "$PHASE5_RUNNER" "$BOOTSTRAP" "$C2_RUNNER"; do
  [[ -r "$file" ]] || { echo "Required Phase 5.5 E2E input is not readable: $file" >&2; exit 1; }
done

DATABASE_NAME="phase5_5_browser_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase5-5-browser-$$-$RANDOM"
BACKEND_PORT="${PHASE5_5_BACKEND_PORT:-4105}"
FRONTEND_PORT="${PHASE5_5_FRONTEND_PORT:-3105}"
ARTIFACT_DIR="$REPO_ROOT/artifacts/phase5-5"
BACKEND_LOG="$ARTIFACT_DIR/backend-browser-e2e.log"
FRONTEND_LOG="$ARTIFACT_DIR/frontend-browser-e2e.log"
PASSWORD="${PHASE5_5_PASSWORD:-Phase55E2E!2026}"
TENANT_A="70000000-0000-0000-0000-000000000701"
TENANT_B="70000000-0000-0000-0000-000000000702"
ADMIN_A="70000000-0000-0000-0000-000000000711"
VIEWER_A="70000000-0000-0000-0000-000000000712"
ADMIN_B="70000000-0000-0000-0000-000000000721"
BACKEND_PID=""
FRONTEND_PID=""
PLAYWRIGHT_CONFIG="${PHASE5_5_PLAYWRIGHT_CONFIG:-playwright.phase5-5.config.ts}"
RESULTS_FILE="${PHASE5_5_E2E_RESULTS_FILE:-../artifacts/phase5-5/browser-e2e-results.json}"
REPORT_DIR="${PHASE5_5_PLAYWRIGHT_REPORT_DIR:-../artifacts/phase5-5/playwright-report}"
EVIDENCE_FILE="${PHASE5_5_EVIDENCE_FILE:-$REPO_ROOT/docs/phase5-5/browser-e2e-evidence.md}"
EVIDENCE_WRITER="${PHASE5_5_EVIDENCE_WRITER:-$SCRIPT_DIR/write-phase5-5-browser-evidence.js}"

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  for process_id in "${FRONTEND_PID:-}" "${BACKEND_PID:-}"; do
    if [[ -n "$process_id" ]] && kill -0 "$process_id" >/dev/null 2>&1; then
      kill "$process_id" >/dev/null 2>&1
      if ! wait "$process_id" 2>/dev/null; then
        : # SIGTERM is the expected result for local test servers.
      fi
    fi
  done
  if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then docker rm -f "$CONTAINER_NAME" >/dev/null; fi
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --detach --name "$CONTAINER_NAME" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$DATABASE_NAME" -p "127.0.0.1::5432" postgres:16-alpine >/dev/null
DB_PORT="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "$DB_PORT" =~ ^[0-9]+$ ]] || { echo "Docker did not publish PostgreSQL port" >&2; exit 1; }

run_psql() { psql -h 127.0.0.1 -p "$DB_PORT" -U postgres -d "$DATABASE_NAME" "$@"; }

ready=0
for _attempt in {1..45}; do
  if run_psql -Atqc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
(( ready == 1 )) || { echo "PostgreSQL 16 did not become ready" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -f "$BASE_FIXTURE" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1R_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "ALTER TABLE tenants DROP COLUMN IF EXISTS status; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_status text DEFAULT 'active'; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at timestamptz; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspension_reason text; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deletion_reason text; INSERT INTO tenants (id,name,service_status) VALUES ('$TENANT_A','Tenant A Phase 5.5','active'),('$TENANT_B','Tenant B Phase 5.5','active') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, service_status=EXCLUDED.service_status; CREATE TABLE IF NOT EXISTS tenant_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, plan_key text, contract_status text, started_at timestamptz DEFAULT now(), ends_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()); INSERT INTO tenant_contracts (tenant_id, plan_key, contract_status) VALUES ('$TENANT_A','enterprise','active'),('$TENANT_B','demo','active') ON CONFLICT DO NOTHING;" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE4_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
CREATE OR REPLACE VIEW v_tenant_modules AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  cm.module_key,
  cm.display_name AS module_name,
  cm.description AS module_description,
  cm.sort_order,
  true AS is_enabled,
  now() AS enabled_at,
  NULL::timestamptz AS disabled_at,
  'phase5_5_browser_e2e'::text AS notes,
  '{"source":"phase5_5_browser_e2e"}'::jsonb AS metadata
FROM tenants t
CROSS JOIN commercial_modules cm
WHERE t.id IN ('$TENANT_A'::uuid, '$TENANT_B'::uuid)
  AND cm.status = 'active';
SQL
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$DB_PORT/$DATABASE_NAME" node "$PHASE5_RUNNER" --apply >/dev/null
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$DB_PORT/$DATABASE_NAME" node "$BOOTSTRAP" >/dev/null
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$DB_PORT/$DATABASE_NAME" node "$C2_RUNNER" --apply >/dev/null

PASSWORD_HASH="$(cd "$REPO_ROOT/backend" && PHASE5_5_PASSWORD="$PASSWORD" node - <<'NODE'
const bcrypt = require('bcrypt');
bcrypt.hash(process.env.PHASE5_5_PASSWORD, 10).then((hash) => process.stdout.write(hash));
NODE
)"

run_psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;

INSERT INTO app_roles(role_key, is_active) VALUES ('admin', true), ('tenant_admin', true), ('viewer', true), ('ejecutivo', true)
ON CONFLICT (role_key) DO UPDATE SET is_active = EXCLUDED.is_active;

INSERT INTO users (id, tenant_id, email, password_hash, role, full_name, name)
VALUES
  ('$ADMIN_A', '$TENANT_A', 'phase55.admin@tcdx.local', '$PASSWORD_HASH', 'tenant_admin', 'Phase 5.5 Admin A', 'Phase 5.5 Admin A'),
  ('$VIEWER_A', '$TENANT_A', 'phase55.viewer@tcdx.local', '$PASSWORD_HASH', 'viewer', 'Phase 5.5 Viewer A', 'Phase 5.5 Viewer A'),
  ('$ADMIN_B', '$TENANT_B', 'phase55.admin.b@tcdx.local', '$PASSWORD_HASH', 'tenant_admin', 'Phase 5.5 Admin B', 'Phase 5.5 Admin B')
ON CONFLICT (id) DO UPDATE
SET tenant_id=EXCLUDED.tenant_id,
    email=EXCLUDED.email,
    password_hash=EXCLUDED.password_hash,
    role=EXCLUDED.role,
    full_name=EXCLUDED.full_name,
    name=EXCLUDED.name;

INSERT INTO permissions (permission_key, permission_group, display_name, is_active)
SELECT permission_key, 'phase5_5_e2e', permission_key, true
FROM (VALUES
  ('data.catalog.read'),('data.quality.read'),('data.lineage.read'),
  ('metrics.read'),('metrics.measure'),('surveys.read'),('surveys.respond'),
  ('assurance_tests.read'),('assurance_tests.execute'),('loss_events.read'),
  ('dashboards.read'),('reports.read'),('reports.generate'),('reports.download'),('reports.schedule'),
  ('semantic.contracts.read'),('semantic.contracts.manage'),('semantic.contracts.review'),('semantic.contracts.publish'),
  ('semantic.mappings.read'),('semantic.mappings.manage'),('semantic.mappings.validate'),
  ('semantic.observations.read'),('semantic.observations.ingest'),('semantic.lineage.read'),
  ('semantic.sufficiency.read'),('semantic.sufficiency.manage'),('semantic.sufficiency.publish')
) AS p(permission_key)
ON CONFLICT (permission_key) DO UPDATE SET is_active=true;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'tenant_admin', permission_key, true FROM permissions WHERE permission_group='phase5_5_e2e'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed=EXCLUDED.is_allowed;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'viewer', permission_key, true FROM permissions WHERE permission_key IN ('data.catalog.read','data.quality.read','data.lineage.read','metrics.read','surveys.read','dashboards.read','reports.read','reports.download')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed=EXCLUDED.is_allowed;

DROP FUNCTION IF EXISTS user_has_permission(uuid, text);
CREATE FUNCTION user_has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
AS \$\$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    LEFT JOIN role_permissions rp ON rp.role_key = u.role AND rp.permission_key = p_permission_key AND rp.is_allowed = true
    WHERE u.id = p_user_id
      AND (u.role IN ('admin','tenant_admin','superadmin','platform_admin','owner') OR rp.permission_key IS NOT NULL)
  )
\$\$;

INSERT INTO tenant_feature_overrides (tenant_id, capability_key, enabled, read_only, status, reason, created_by, metadata)
SELECT '$TENANT_A'::uuid, capability_key, true, false, 'active', 'phase5_5_browser_e2e', '$ADMIN_A'::uuid, '{"source":"phase5_5_browser_e2e"}'::jsonb
FROM commercial_technical_capabilities
WHERE capability_key IN (
  'data.governance','metrics.catalog','metrics.engine','metrics.data_trust','data.lineage','data.impact_graph',
  'surveys.engine','assurance.testing','loss.events','bi.dashboard_builder','bi.executive_dashboards',
  'reporting.studio','reporting.pdf','reporting.docx','reporting.xlsx','reporting.scheduled','data.semantic_layer'
)
ON CONFLICT (tenant_id, capability_key) DO UPDATE
SET enabled=true, read_only=false, status='active', updated_at=now(), metadata=tenant_feature_overrides.metadata || EXCLUDED.metadata;

INSERT INTO tenant_feature_overrides (tenant_id, capability_key, enabled, read_only, status, reason, created_by, metadata)
SELECT '$TENANT_B'::uuid, capability_key, true, false, 'active', 'phase5_c2_tenant_isolation', '$ADMIN_B'::uuid, '{"source":"phase5_c2_browser_e2e"}'::jsonb
FROM commercial_technical_capabilities
WHERE capability_key IN ('data.governance','data.semantic_layer')
ON CONFLICT (tenant_id, capability_key) DO UPDATE
SET enabled=true, read_only=false, status='active', updated_at=now(), metadata=tenant_feature_overrides.metadata || EXCLUDED.metadata;

CREATE TABLE IF NOT EXISTS semantic_browser_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  observed_at timestamptz NOT NULL,
  value_numeric numeric NOT NULL,
  status text NOT NULL
);
INSERT INTO semantic_browser_source (tenant_id,observed_at,value_numeric,status)
VALUES ('$TENANT_A',now(),88,'valid'),('$TENANT_B',now(),31,'attention');

WITH seeded(formula_code, value_num, unit_text) AS (
  VALUES
    ('F5_5_COMPLETENESS', 92.5::numeric, '%'),
    ('F5_5_SURVEY_SCORE', 84.0::numeric, 'score'),
    ('F5_5_ASSURANCE_SCORE', 88.0::numeric, 'score'),
    ('F5_5_NET_LOSS', 900.0::numeric, 'CLP'),
    ('F5_5_GRC_HEALTH', 81.0::numeric, 'score')
),
versions AS (
  SELECT s.formula_code, s.value_num, s.unit_text, ofv.id AS version_id
  FROM seeded s
  JOIN official_formula_definitions ofd ON ofd.formula_code = s.formula_code AND ofd.tenant_id IS NULL
  JOIN official_formula_versions ofv ON ofv.formula_definition_id = ofd.id AND ofv.version_number = 1 AND ofv.status = 'published'
),
runs AS (
  INSERT INTO calculation_runs (
    tenant_id, formula_version_id, formula_code, run_status,
    period_start, period_end, timezone, input_hash, output_hash,
    correlation_id, requested_by, completed_at, metadata
  )
  SELECT
    '$TENANT_A'::uuid,
    version_id,
    formula_code,
    'calculated',
    '2026-01-01'::timestamptz,
    '2026-01-31'::timestamptz,
    'America/Santiago',
    encode(digest(('input:' || formula_code)::bytea, 'sha256'), 'hex'),
    encode(digest(('output:' || formula_code || ':' || value_num)::bytea, 'sha256'), 'hex'),
    'phase5_5_browser_seed_' || formula_code,
    '$ADMIN_A'::uuid,
    now(),
    jsonb_build_object('source_status','available','trust_score',91,'trust_status','trusted','coverage',100,'fixture','phase5_5_browser_e2e')
  FROM versions
  RETURNING id, tenant_id, formula_code, output_hash
)
INSERT INTO calculation_outputs (run_id, tenant_id, output_name, output_value, unit, precision, rounding_policy, output_hash, metadata)
SELECT
  r.id,
  r.tenant_id,
  'value',
  jsonb_build_object('value', v.value_num, 'status', 'completed'),
  v.unit_text,
  4,
  'formula_default',
  r.output_hash,
  jsonb_build_object('formula_code', r.formula_code, 'formula_version', 1, 'source', 'phase5_5_browser_e2e')
FROM runs r
JOIN versions v ON v.formula_code = r.formula_code;
SQL

(cd "$REPO_ROOT/backend" && exec env \
  DB_HOST=127.0.0.1 DB_PORT="$DB_PORT" DB_USER=postgres DB_NAME="$DATABASE_NAME" \
  DB_POOL_MAX=5 NODE_ENV=test PORT="$BACKEND_PORT" JWT_SECRET="phase5_5_browser_local_secret" \
  CORS_ORIGINS="http://127.0.0.1:$FRONTEND_PORT,http://localhost:$FRONTEND_PORT" \
  SECURITY_RATE_LIMIT_MAX=5000 AUTH_RATE_LIMIT_MAX=500 AI_RATE_LIMIT_MAX=5000 SECURITY_RATE_LIMIT_WINDOW_MS=60000 \
  GRC_PHASE1_SCHEDULER_ENABLED=false DISABLE_PHASE2_SCHEDULER=1 \
  node src/app.js >"$BACKEND_LOG" 2>&1) &
BACKEND_PID=$!

backend_ready=0
for _attempt in {1..60}; do
  if curl -fsS "http://127.0.0.1:$BACKEND_PORT/" >/dev/null 2>&1; then backend_ready=1; break; fi
  sleep 1
done
if (( backend_ready != 1 )); then
  echo "Backend did not become ready. Last log lines:" >&2
  tail -80 "$BACKEND_LOG" >&2 || true
  exit 1
fi

(cd "$REPO_ROOT/frontend" && exec env \
  PORT="$FRONTEND_PORT" NEXT_PUBLIC_API_URL="http://127.0.0.1:$BACKEND_PORT" \
  ./node_modules/.bin/next dev -H 0.0.0.0 -p "$FRONTEND_PORT" >"$FRONTEND_LOG" 2>&1) &
FRONTEND_PID=$!

frontend_ready=0
for _attempt in {1..90}; do
  if curl -fsS "http://127.0.0.1:$FRONTEND_PORT/login" >/dev/null 2>&1; then frontend_ready=1; break; fi
  sleep 1
done
if (( frontend_ready != 1 )); then
  echo "Frontend did not become ready. Last log lines:" >&2
  tail -120 "$FRONTEND_LOG" >&2 || true
  exit 1
fi

(cd "$REPO_ROOT/frontend" && \
  WEB_BASE_URL="http://localhost:$FRONTEND_PORT" \
  API_BASE_URL="http://127.0.0.1:$BACKEND_PORT" \
  PHASE5_5_E2E_RESULTS_FILE="$RESULTS_FILE" \
  PHASE5_5_PLAYWRIGHT_REPORT_DIR="$REPORT_DIR" \
  PHASE5_5_TENANT_A_ID="$TENANT_A" \
  PHASE5_5_TENANT_B_ID="$TENANT_B" \
  PHASE5_5_PASSWORD="$PASSWORD" \
  env -u FORCE_COLOR -u NO_COLOR npx playwright test --config="$PLAYWRIGHT_CONFIG")

node "$EVIDENCE_WRITER" "$REPO_ROOT/frontend/$RESULTS_FILE" "$EVIDENCE_FILE"
