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

for file in "$BASE_FIXTURE" "$PHASE2_MASTER" "$PHASE3_MASTER" "$PHASE1_MIGRATION" "$PHASE1R_MIGRATION" "$PHASE2_MIGRATION" "$PHASE3_MIGRATION" "$PHASE4_MIGRATION" "$PHASE5_RUNNER"; do
  [[ -r "$file" ]] || { echo "Required integration input is not readable: $file" >&2; exit 1; }
done

DATABASE_NAME="phase5_data_metrics_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase5-$$-$RANDOM"
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
(( ready == 1 )) || { echo "PostgreSQL 16 did not become ready" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -f "$BASE_FIXTURE" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE1R_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MIGRATION" >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "
  ALTER TABLE tenants DROP COLUMN IF EXISTS status;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_status text DEFAULT 'active';
  INSERT INTO tenants (id,name)
  VALUES
    ('70000000-0000-0000-0000-000000000701','Tenant A Phase5'),
    ('70000000-0000-0000-0000-000000000702','Tenant B Phase5')
  ON CONFLICT (id) DO NOTHING;
  CREATE TABLE IF NOT EXISTS tenant_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_key text,
    contract_status text,
    started_at date,
    ends_at date,
    billing_currency text,
    commercial_notes text,
    crm_reference text,
    max_active_standards integer,
    max_premium_modules integer,
    external_lookup_quota integer,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO tenant_contracts (tenant_id, plan_key, contract_status)
  VALUES
    ('70000000-0000-0000-0000-000000000701','empresa','active'),
    ('70000000-0000-0000-0000-000000000702','demo','active')
  ON CONFLICT DO NOTHING;
" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE4_MIGRATION" >/dev/null

phase5_checksum="$(node "$PHASE5_RUNNER" --checksum | awk '/20260729_phase5_data_metrics_bi_reporting/ { sub(/^.*checksum=/, ""); print; exit }')"
phase5_hotfix_checksum="$(node "$PHASE5_RUNNER" --checksum | awk '/20260730_phase5_tenant_shell_grc_data_integration/ { sub(/^.*checksum=/, ""); print; exit }')"
failed_checksum="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
run_psql -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    migration_id text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz,
    applied_by text NOT NULL,
    duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    status text NOT NULL CHECK (status IN ('running','applied','failed')),
    details jsonb NOT NULL DEFAULT '{}'::jsonb
  );
  INSERT INTO schema_migrations (migration_id, checksum, applied_at, applied_by, status, details)
  VALUES ('20260729_phase5_data_metrics_bi_reporting', '$failed_checksum', now(), current_user, 'failed', jsonb_build_object('test','failed-retry'))
  ON CONFLICT (migration_id) DO UPDATE
    SET checksum = EXCLUDED.checksum,
        applied_at = EXCLUDED.applied_at,
        applied_by = EXCLUDED.applied_by,
        status = 'failed',
        details = EXCLUDED.details;
" >/dev/null

MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE5_RUNNER" --apply >/tmp/tcdx-phase5-apply-1.txt
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE5_RUNNER" --apply >/tmp/tcdx-phase5-apply-2.txt

tables_count="$(run_psql -Atqc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['data_domains','data_elements','data_sources','metric_definitions','metric_formula_versions','metric_measurements','survey_definitions','survey_versions','assessment_campaigns','survey_responses','assurance_test_definitions','loss_events','dashboard_definitions','dashboard_widgets','report_definitions','report_generations','report_artifacts'])")"
ledger_status="$(run_psql -Atqc "SELECT status FROM schema_migrations WHERE migration_id='20260729_phase5_data_metrics_bi_reporting'")"
ledger_checksum="$(run_psql -Atqc "SELECT checksum FROM schema_migrations WHERE migration_id='20260729_phase5_data_metrics_bi_reporting'")"
hotfix_status="$(run_psql -Atqc "SELECT status FROM schema_migrations WHERE migration_id='20260730_phase5_tenant_shell_grc_data_integration'")"
hotfix_checksum="$(run_psql -Atqc "SELECT checksum FROM schema_migrations WHERE migration_id='20260730_phase5_tenant_shell_grc_data_integration'")"
metrics_count="$(run_psql -Atqc "SELECT COUNT(*) FROM metric_definitions WHERE tenant_id IS NULL AND status='published'")"
capabilities_count="$(run_psql -Atqc "SELECT COUNT(*) FROM commercial_technical_capabilities WHERE capability_key IN ('data.governance','metrics.catalog','metrics.engine','metrics.data_trust','data.lineage','data.impact_graph','surveys.engine','assurance.testing','loss.events','bi.dashboard_builder','bi.executive_dashboards','reporting.studio','reporting.pdf','reporting.docx','reporting.xlsx','reporting.scheduled')")"
limits_count="$(run_psql -Atqc "SELECT COUNT(*) FROM usage_limit_definitions WHERE resource_key IN ('metric_definitions','metric_measurements_monthly','survey_campaigns_monthly','survey_responses_monthly','dashboard_definitions','report_generations_monthly','scheduled_reports','report_storage_bytes')")"
impact_rules_count="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_analytical_impact_rules WHERE status='published'")"
trust_v2_count="$(run_psql -Atqc "SELECT COUNT(*) FROM data_trust_score_versions WHERE version_key='data_trust_score' AND version_number=2 AND status='published'")"

[[ "$tables_count" == "17" ]] || { echo "Unexpected Phase 5 selected table count: $tables_count" >&2; exit 1; }
[[ "$ledger_status" == "applied" ]] || { echo "Phase 5 ledger status is not applied: $ledger_status" >&2; exit 1; }
[[ "$ledger_checksum" == "$phase5_checksum" ]] || { echo "Phase 5 failed retry did not replace checksum" >&2; exit 1; }
[[ "$hotfix_status" == "applied" ]] || { echo "Phase 5 hotfix ledger status is not applied: $hotfix_status" >&2; exit 1; }
[[ "$hotfix_checksum" == "$phase5_hotfix_checksum" ]] || { echo "Phase 5 hotfix checksum mismatch" >&2; exit 1; }
[[ "$metrics_count" -ge 29 ]] || { echo "Expected initial metrics were not seeded: $metrics_count" >&2; exit 1; }
[[ "$capabilities_count" == "16" ]] || { echo "Expected capabilities were not seeded: $capabilities_count" >&2; exit 1; }
[[ "$limits_count" == "8" ]] || { echo "Expected limits were not seeded: $limits_count" >&2; exit 1; }
[[ "$impact_rules_count" -ge 7 ]] || { echo "Expected impact rules were not seeded: $impact_rules_count" >&2; exit 1; }
[[ "$trust_v2_count" == "1" ]] || { echo "Expected Data Trust Score v2 seed missing: $trust_v2_count" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -c "
  INSERT INTO data_domains (tenant_id, domain_key, display_name, status)
  VALUES ('70000000-0000-0000-0000-000000000701','qa','QA','active');
  INSERT INTO data_lineage_edges (tenant_id, from_type, from_id, to_type, to_id, relation_type, transformation, correlation_id)
  VALUES (
    '70000000-0000-0000-0000-000000000701',
    'assurance_test_execution',
    '70000000-0000-0000-0000-000000001001',
    'control',
    '70000000-0000-0000-0000-000000001002',
    'tests',
    'hotfix relation verification',
    'phase5-hotfix'
  )
  ON CONFLICT DO NOTHING;
  INSERT INTO metric_measurements (
    tenant_id, metric_definition_id, period_key, period_start, period_end, value_numeric, unit,
    quality_status, freshness_status, validation_status, trust_score, trust_status, correlation_id
  )
  SELECT '70000000-0000-0000-0000-000000000701', id, '2026-07', '2026-07-01', '2026-07-31', 1, unit,
         'valid','current','valid',90,'trusted','tenant-a'
  FROM metric_definitions WHERE metric_code='open_findings';
" >/dev/null

tenant_b_rows="$(run_psql -Atqc "SELECT COUNT(*) FROM metric_measurements WHERE tenant_id='70000000-0000-0000-0000-000000000702'")"
tenant_a_rows="$(run_psql -Atqc "SELECT COUNT(*) FROM metric_measurements WHERE tenant_id='70000000-0000-0000-0000-000000000701'")"
tenant_a_lineage="$(run_psql -Atqc "SELECT COUNT(*) FROM data_lineage_edges WHERE tenant_id='70000000-0000-0000-0000-000000000701' AND relation_type='tests'")"
tenant_b_lineage="$(run_psql -Atqc "SELECT COUNT(*) FROM data_lineage_edges WHERE tenant_id='70000000-0000-0000-0000-000000000702'")"
[[ "$tenant_a_rows" == "1" && "$tenant_b_rows" == "0" ]] || { echo "Tenant isolation fixture failed" >&2; exit 1; }
[[ "$tenant_a_lineage" == "1" && "$tenant_b_lineage" == "0" ]] || { echo "Tenant lineage isolation fixture failed" >&2; exit 1; }

bad_applied_checksum="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
run_psql -v ON_ERROR_STOP=1 -c "
  UPDATE schema_migrations
     SET checksum = '$bad_applied_checksum', status = 'applied', details = jsonb_build_object('test','applied-mismatch')
   WHERE migration_id = '20260729_phase5_data_metrics_bi_reporting';
" >/dev/null
if MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE5_RUNNER" --apply >/tmp/tcdx-phase5-applied-mismatch.txt 2>&1; then
  echo "Applied checksum mismatch was not rejected" >&2
  exit 1
fi
if ! grep -q 'checksum differs from applied ledger entry' /tmp/tcdx-phase5-applied-mismatch.txt; then
  echo "Applied checksum mismatch did not produce the expected error" >&2
  cat /tmp/tcdx-phase5-applied-mismatch.txt >&2
  exit 1
fi

printf '{"status":"VERIFIED_PHASE5_POSTGRES","tables":%s,"global_metrics":%s,"capabilities":%s,"limits":%s,"impact_rules":%s,"trust_score_version":2,"tenant_isolation":"verified","lineage_isolation":"verified","failed_retry":"verified","applied_checksum_mismatch":"rejected"}\n' \
  "$tables_count" "$metrics_count" "$capabilities_count" "$limits_count" "$impact_rules_count"
