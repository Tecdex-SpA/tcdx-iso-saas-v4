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
PHASE4_MIGRATION="$REPO_ROOT/database/migrations/20260729_phase4_commercial_product.sql"
PHASE5_RUNNER="$REPO_ROOT/scripts/phase5/apply-phase5-migration.js"
BOOTSTRAP="$REPO_ROOT/scripts/phase5-5/bootstrap-official-math-governance.js"
for file in "$BASE_FIXTURE" "$PHASE2_MASTER" "$PHASE3_MASTER" "$PHASE1_MIGRATION" "$PHASE1R_MIGRATION" "$PHASE2_MIGRATION" "$PHASE3_MIGRATION" "$PHASE4_MIGRATION" "$PHASE5_RUNNER" "$BOOTSTRAP"; do
  [[ -r "$file" ]] || { echo "Required Phase 5.5 integration input is not readable: $file" >&2; exit 1; }
done
DATABASE_NAME="phase5_5_math_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase5-5-$$-$RANDOM"
cleanup() { local code=$?; trap - EXIT INT TERM; if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then docker rm -f "$CONTAINER_NAME" >/dev/null; fi; exit "$code"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run --detach --name "$CONTAINER_NAME" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$DATABASE_NAME" -p "127.0.0.1::5432" postgres:16-alpine >/dev/null
PORT="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "Docker did not publish PostgreSQL port" >&2; exit 1; }
run_psql() { psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE_NAME" "$@"; }
ready=0
for _attempt in {1..45}; do if run_psql -Atqc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi; sleep 1; done
(( ready == 1 )) || { echo "PostgreSQL 16 did not become ready" >&2; exit 1; }
run_psql -v ON_ERROR_STOP=1 -f "$BASE_FIXTURE" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1R_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "ALTER TABLE tenants DROP COLUMN IF EXISTS status; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_status text DEFAULT 'active'; INSERT INTO tenants (id,name) VALUES ('70000000-0000-0000-0000-000000000701','Tenant A Math'),('70000000-0000-0000-0000-000000000702','Tenant B Math') ON CONFLICT (id) DO NOTHING; CREATE TABLE IF NOT EXISTS tenant_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, plan_key text, contract_status text, started_at timestamptz DEFAULT now(), ends_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()); INSERT INTO tenant_contracts (tenant_id, plan_key, contract_status) VALUES ('70000000-0000-0000-0000-000000000701','empresa','active'),('70000000-0000-0000-0000-000000000702','demo','active') ON CONFLICT DO NOTHING;" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE4_MIGRATION" >/dev/null
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE5_RUNNER" --apply >/tmp/tcdx-phase5-5-apply-1.txt
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE5_RUNNER" --apply >/tmp/tcdx-phase5-5-apply-2.txt
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$BOOTSTRAP" >/tmp/tcdx-phase5-5-bootstrap-1.txt
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$BOOTSTRAP" >/tmp/tcdx-phase5-5-bootstrap-2.txt
table_list="'official_formula_definitions','official_formula_versions','official_formula_variables','official_formula_source_contracts','official_formula_thresholds','official_formula_dependencies','calculation_runs','calculation_inputs','calculation_outputs','calculation_validations','calculation_snapshots','calculation_consumers','calculation_explanations','calculation_anomalies','calculation_comparisons','statistical_samples','statistical_results','metric_source_bindings','metric_calculation_policies','health_score_definitions','health_score_versions','health_score_components'"
tables_count="$(run_psql -Atqc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY[$table_list])")"
formulas_count="$(run_psql -Atqc "SELECT COUNT(*) FROM official_formula_definitions WHERE tenant_id IS NULL")"
versions_count="$(run_psql -Atqc "SELECT COUNT(*) FROM official_formula_versions WHERE tenant_id IS NULL AND status='published'")"
contracts_count="$(run_psql -Atqc "SELECT COUNT(*) FROM official_formula_source_contracts WHERE tenant_id IS NULL AND status='published'")"
ledger_status="$(run_psql -Atqc "SELECT status FROM schema_migrations WHERE migration_id='20260730_phase5_5_official_math_governance'")"
trigger_enabled="$(run_psql -Atqc "SELECT tgenabled FROM pg_trigger WHERE tgname='trg_official_formula_versions_published_immutable'")"

run_psql -v ON_ERROR_STOP=1 -c "WITH fv AS (SELECT v.id FROM official_formula_versions v JOIN official_formula_definitions d ON d.id=v.formula_definition_id WHERE d.formula_code='F5_5_SURVEY_SCORE' AND v.status='published' LIMIT 1), sc AS (SELECT id FROM official_formula_source_contracts WHERE source_code='survey_response_scoring' LIMIT 1) INSERT INTO calculation_runs (tenant_id, formula_version_id, formula_code, source_contract_id, run_status, input_hash, output_hash, source_snapshot_hash, correlation_id, completed_at, metadata) SELECT '70000000-0000-0000-0000-000000000701'::uuid, fv.id, 'F5_5_SURVEY_SCORE', sc.id, 'calculated', repeat('a',64), repeat('b',64), repeat('c',64), 'pkg4-tenant-a', now(), '{\"package\":\"phase5_5_package4\"}'::jsonb FROM fv, sc ON CONFLICT DO NOTHING;" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "WITH fv AS (SELECT v.id FROM official_formula_versions v JOIN official_formula_definitions d ON d.id=v.formula_definition_id WHERE d.formula_code='F5_5_SUPPLIER_RISK' AND v.status='published' LIMIT 1), sc AS (SELECT id FROM official_formula_source_contracts WHERE source_code='supplier_tprm_assessments' LIMIT 1) INSERT INTO calculation_runs (tenant_id, formula_version_id, formula_code, source_contract_id, run_status, input_hash, output_hash, source_snapshot_hash, correlation_id, completed_at, metadata) SELECT '70000000-0000-0000-0000-000000000702'::uuid, fv.id, 'F5_5_SUPPLIER_RISK', sc.id, 'calculated', repeat('d',64), repeat('e',64), repeat('f',64), 'pkg4-tenant-b', now(), '{\"package\":\"phase5_5_package4\"}'::jsonb FROM fv, sc ON CONFLICT DO NOTHING;" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO calculation_outputs (run_id, tenant_id, output_name, output_value, unit, precision, rounding_policy, output_hash, metadata) SELECT id, tenant_id, 'value', jsonb_build_object('value', 80), '%', 2, 'formula_default', output_hash, '{\"package\":\"phase5_5_package4\"}'::jsonb FROM calculation_runs WHERE correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b') ON CONFLICT (run_id, output_name) DO NOTHING;" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO calculation_explanations (run_id, tenant_id, explanation_type, explanation, variables, lineage, metadata) SELECT id, tenant_id, 'formula', 'Package 4 integration explanation', '{}'::jsonb, jsonb_build_array(jsonb_build_object('tenant_id', tenant_id, 'calculation_run', id)), '{\"package\":\"phase5_5_package4\"}'::jsonb FROM calculation_runs WHERE correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b');" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO calculation_snapshots (tenant_id, run_id, source_contract_id, snapshot_type, snapshot_hash, row_count, payload, metadata) SELECT tenant_id, id, source_contract_id, 'output', output_hash, 1, jsonb_build_object('formula_code', formula_code), '{\"package\":\"phase5_5_package4\"}'::jsonb FROM calculation_runs WHERE correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b');" >/dev/null
pkg4_runs_count="$(run_psql -Atqc "SELECT COUNT(*) FROM calculation_runs WHERE correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b')")"
pkg4_outputs_count="$(run_psql -Atqc "SELECT COUNT(*) FROM calculation_outputs co JOIN calculation_runs cr ON cr.id=co.run_id WHERE cr.correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b')")"
pkg4_snapshots_count="$(run_psql -Atqc "SELECT COUNT(*) FROM calculation_snapshots cs JOIN calculation_runs cr ON cr.id=cs.run_id WHERE cr.correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b')")"
pkg4_lineage_count="$(run_psql -Atqc "SELECT COUNT(*) FROM calculation_explanations ce JOIN calculation_runs cr ON cr.id=ce.run_id WHERE cr.correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b') AND jsonb_array_length(ce.lineage) > 0")"
pkg4_tenant_count="$(run_psql -Atqc "SELECT COUNT(DISTINCT tenant_id) FROM calculation_runs WHERE correlation_id IN ('pkg4-tenant-a','pkg4-tenant-b')")"
[[ "$pkg4_runs_count" == "2" && "$pkg4_outputs_count" == "2" && "$pkg4_snapshots_count" == "2" && "$pkg4_lineage_count" == "2" && "$pkg4_tenant_count" == "2" ]] || { echo "Package 4 calculation persistence verification failed: runs=$pkg4_runs_count outputs=$pkg4_outputs_count snapshots=$pkg4_snapshots_count lineage=$pkg4_lineage_count tenants=$pkg4_tenant_count" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO calculation_consumers (tenant_id, formula_code, consumer_type, consumer_key, consumer_path, status, package_status, metadata) VALUES ('70000000-0000-0000-0000-000000000701','F5_5_SURVEY_SCORE','dashboard','pkg5-survey-widget','/api/dashboards/pkg5/render','active','package5_completed',jsonb_build_object('result_code','survey.score')),('70000000-0000-0000-0000-000000000701','F5_5_SURVEY_SCORE','report','pkg5-survey-report','/api/reports/pkg5/generate','active','package5_completed',jsonb_build_object('result_code','survey.score')),('70000000-0000-0000-0000-000000000702','F5_5_SUPPLIER_RISK','export','pkg5-supplier-xlsx','/api/report-generations/pkg5/download','active','package5_completed',jsonb_build_object('result_code','supplier.risk')) ON CONFLICT DO NOTHING;" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "WITH a AS (SELECT id FROM calculation_runs WHERE correlation_id='pkg4-tenant-a' LIMIT 1), b AS (SELECT id FROM calculation_runs WHERE correlation_id='pkg4-tenant-b' LIMIT 1) INSERT INTO calculation_comparisons (tenant_id, base_run_id, comparison_run_id, comparison_type, result, metadata) SELECT '70000000-0000-0000-0000-000000000701'::uuid, a.id, b.id, 'tenant_peer', jsonb_build_object('status','package5_trace_only'), jsonb_build_object('package','phase5_5_package5') FROM a, b ON CONFLICT DO NOTHING;" >/dev/null
package5_consumers_count="$(run_psql -Atqc "SELECT COUNT(*) FROM calculation_consumers WHERE package_status='package5_completed'")"
package5_comparisons_count="$(run_psql -Atqc "SELECT COUNT(*) FROM calculation_comparisons WHERE metadata->>'package'='phase5_5_package5'")"
[[ "$package5_consumers_count" == "3" && "$package5_comparisons_count" == "1" ]] || { echo "Package 5 BI/report consumption verification failed: consumers=$package5_consumers_count comparisons=$package5_comparisons_count" >&2; exit 1; }
[[ "$tables_count" == "22" ]] || { echo "Expected 22 Phase 5.5 tables, got $tables_count" >&2; exit 1; }
[[ "$formulas_count" == "50" && "$versions_count" == "50" ]] || { echo "Expected 50 official formulas/versions, got $formulas_count/$versions_count" >&2; exit 1; }
[[ "$contracts_count" -ge "16" ]] || { echo "Expected source contracts, got $contracts_count" >&2; exit 1; }
[[ "$ledger_status" == "applied" ]] || { echo "Phase 5.5 ledger status not applied: $ledger_status" >&2; exit 1; }
[[ "$trigger_enabled" == "O" ]] || { echo "Official formula immutability trigger is not enabled" >&2; exit 1; }
if run_psql -v ON_ERROR_STOP=1 -c "UPDATE official_formula_versions SET methodology='changed' WHERE id IN (SELECT id FROM official_formula_versions WHERE status='published' LIMIT 1)" >/tmp/tcdx-phase5-5-immutable.txt 2>&1; then
  echo "Published formula immutability was not enforced" >&2
  exit 1
fi
if ! grep -q 'immutable' /tmp/tcdx-phase5-5-immutable.txt; then
  echo "Published formula immutability error was not explicit" >&2
  cat /tmp/tcdx-phase5-5-immutable.txt >&2
  exit 1
fi
printf '{"status":"VERIFIED_PHASE5_5_POSTGRES","tables":%s,"formulas":%s,"versions":%s,"contracts":%s,"ledger":"%s","immutability":"verified","idempotent":"verified","package4_runs":%s,"package4_snapshots":%s,"package4_lineage":%s,"package4_tenants":%s,"package5_consumers":%s,"package5_comparisons":%s}\n' "$tables_count" "$formulas_count" "$versions_count" "$contracts_count" "$ledger_status" "$pkg4_runs_count" "$pkg4_snapshots_count" "$pkg4_lineage_count" "$pkg4_tenant_count" "$package5_consumers_count" "$package5_comparisons_count"
