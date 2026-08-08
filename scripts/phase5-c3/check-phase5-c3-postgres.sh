#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BASE_FIXTURE="$REPO_ROOT/tests/fixtures/phase1-base-schema.sql"
PHASE2_MASTER="$REPO_ROOT/scripts/phase5-c2/fixtures/phase2-master-schema.fixture"
PHASE3_MASTER="$REPO_ROOT/tests/fixtures/phase3-master-schema.sql"
PHASE4="$REPO_ROOT/database/migrations/20260729_phase4_commercial_product.sql"
PHASE5_RUNNER="$REPO_ROOT/scripts/phase5/apply-phase5-migration.js"
FORMULA_BOOTSTRAP="$REPO_ROOT/scripts/phase5-5/bootstrap-official-math-governance.js"
C2_RUNNER="$REPO_ROOT/scripts/phase5-c2/apply-phase5-c2-migration.js"
C3_RUNNER="$REPO_ROOT/scripts/phase5-c3/apply-phase5-c3-migration.js"
MIGRATIONS=(
  "$REPO_ROOT/database/migrations/20260722_phase1_grc_core.sql"
  "$REPO_ROOT/database/migrations/20260723_phase1r_operational_closeout.sql"
  "$REPO_ROOT/database/migrations/20260727_phase2_integrated_grc.sql"
  "$REPO_ROOT/database/migrations/20260728_phase3_operational_grc.sql"
)

DATABASE_NAME="phase5_c3_indicators_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase5-c3-$$-$RANDOM"
cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then docker rm -f "$CONTAINER_NAME" >/dev/null; fi
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --detach --name "$CONTAINER_NAME" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$DATABASE_NAME" -p "127.0.0.1::5432" postgres:16-alpine >/dev/null
PORT="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "Docker did not publish PostgreSQL port" >&2; exit 1; }
run_psql() { psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE_NAME" "$@"; }
ready=0
for _attempt in {1..45}; do
  if run_psql -Atqc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
(( ready == 1 )) || { echo "PostgreSQL 16 did not become ready" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -f "$BASE_FIXTURE" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE2_MASTER" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE3_MASTER" >/dev/null
for migration in "${MIGRATIONS[@]}"; do run_psql -v ON_ERROR_STOP=1 -f "$migration" >/dev/null; done
run_psql -v ON_ERROR_STOP=1 -c "ALTER TABLE tenants DROP COLUMN IF EXISTS status; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_status text DEFAULT 'active'; INSERT INTO tenants (id,name) VALUES ('70000000-0000-0000-0000-000000000701','Tenant A Indicators'),('70000000-0000-0000-0000-000000000702','Tenant B Indicators') ON CONFLICT (id) DO NOTHING; CREATE TABLE IF NOT EXISTS tenant_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,plan_key text,contract_status text,started_at date,ends_at date,billing_currency text,commercial_notes text,crm_reference text,max_active_standards integer,max_premium_modules integer,external_lookup_quota integer,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); INSERT INTO tenant_contracts (tenant_id,plan_key,contract_status) VALUES ('70000000-0000-0000-0000-000000000701','empresa','active'),('70000000-0000-0000-0000-000000000702','demo','active');" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE4" >/dev/null
DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME"
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$PHASE5_RUNNER" --apply >/tmp/tcdx-phase5-c3-phase5.txt
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$FORMULA_BOOTSTRAP" >/tmp/tcdx-phase5-c3-formulas.txt
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$C2_RUNNER" --apply >/tmp/tcdx-phase5-c3-c2.txt

c3_checksum="$(node "$C3_RUNNER" --checksum | awk -F= '/checksum=/ { print $2; exit }')"
run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations(migration_id,checksum,applied_by,status,details) VALUES('20260807_phase5_c3_indicators_trust_snapshots',repeat('f',64),current_user,'failed','{\"test\":\"failed-retry\"}'::jsonb) ON CONFLICT(migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,status='failed',details=EXCLUDED.details;" >/dev/null
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$C3_RUNNER" --apply >/tmp/tcdx-phase5-c3-apply-1.txt
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$C3_RUNNER" --apply >/tmp/tcdx-phase5-c3-apply-2.txt

catalog_count="$(run_psql -Atqc "SELECT count(*) FROM metric_definition_versions WHERE tenant_id IS NULL AND status='published'")"
binding_count="$(run_psql -Atqc "SELECT count(*) FROM metric_source_bindings WHERE tenant_id IS NULL AND binding_status='published'")"
dimension_count="$(run_psql -Atqc "SELECT count(*) FROM metric_trust_policies p CROSS JOIN LATERAL jsonb_object_keys(p.weights) WHERE p.tenant_id IS NULL AND p.status='published'")"
ledger="$(run_psql -Atqc "SELECT status||':'||checksum FROM schema_migrations WHERE migration_id='20260807_phase5_c3_indicators_trust_snapshots'")"
[[ "$catalog_count" -ge 22 && "$binding_count" -ge 22 && "$dimension_count" == "8" && "$ledger" == "applied:$c3_checksum" ]] || { echo "Phase 5-C3 catalog, binding, trust or ledger verification failed" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -c "WITH definition AS (SELECT md.id FROM metric_definitions md JOIN metric_definition_versions v ON v.metric_definition_id=md.id WHERE v.functional_code='COMPLIANCE' AND v.status='published' LIMIT 1), policy AS (SELECT id FROM metric_trust_policies WHERE tenant_id IS NULL AND status='published' LIMIT 1), trust AS (INSERT INTO metric_trust_assessments(tenant_id,metric_definition_id,trust_policy_id,score,trust_status,dimensions,evidence_checksum,assessment_checksum,correlation_id) SELECT '70000000-0000-0000-0000-000000000701',definition.id,policy.id,88,'acceptable','{}',repeat('1',64),repeat('2',64),'pg-c3' FROM definition,policy RETURNING id,metric_definition_id), measurement AS (INSERT INTO metric_measurements(tenant_id,metric_definition_id,period_key,period_start,period_end,value_numeric,unit,source_timestamp,quality_status,freshness_status,trust_score,trust_status,validation_status,correlation_id,metadata,official_state,coverage_ratio,sample_size,population_size,sufficiency_status,source_snapshot_ids,trust_assessment_id) SELECT '70000000-0000-0000-0000-000000000701',trust.metric_definition_id,'2026-08','2026-08-01'::timestamptz,'2026-08-31'::timestamptz,0,'%','2026-08-31'::timestamptz,'valid','current',88,'acceptable','valid','pg-c3','{}','calculated',1,10,10,'sufficient','{}',trust.id FROM trust RETURNING id,metric_definition_id,trust_assessment_id) INSERT INTO metric_snapshots(tenant_id,metric_definition_id,measurement_id,period_key,snapshot_payload,content_hash,trust_assessment_id,effective_at,snapshot_status,published_at) SELECT '70000000-0000-0000-0000-000000000701',measurement.metric_definition_id,measurement.id,'2026-08','{\"metric_code\":\"COMPLIANCE\",\"result\":{\"status\":\"calculated\",\"value\":0},\"unit\":\"%\",\"coverage\":1,\"trust\":{\"score\":88,\"status\":\"acceptable\"},\"freshness\":{\"status\":\"fresh\"},\"sufficiency\":{\"status\":\"sufficient\"}}',repeat('3',64),measurement.trust_assessment_id,'2026-08-31'::timestamptz,'published',now() FROM measurement;" >/dev/null

tenant_a="$(run_psql -Atqc "SELECT count(*) FROM metric_snapshots WHERE tenant_id='70000000-0000-0000-0000-000000000701'")"
tenant_b="$(run_psql -Atqc "SELECT count(*) FROM metric_snapshots WHERE tenant_id='70000000-0000-0000-0000-000000000702'")"
zero_value="$(run_psql -Atqc "SELECT snapshot_payload->'result'->>'value' FROM metric_snapshots WHERE tenant_id='70000000-0000-0000-0000-000000000701'")"
[[ "$tenant_a" == "1" && "$tenant_b" == "0" && "$zero_value" == "0" ]] || { echo "Tenant isolation or real-zero preservation failed" >&2; exit 1; }
run_psql -v ON_ERROR_STOP=1 -c "WITH original AS (SELECT * FROM metric_snapshots WHERE tenant_id='70000000-0000-0000-0000-000000000701' LIMIT 1), second AS (INSERT INTO metric_snapshots(tenant_id,metric_definition_id,period_key,snapshot_payload,content_hash,effective_at,snapshot_status,published_at) SELECT tenant_id,metric_definition_id,'2026-09',jsonb_set(snapshot_payload,'{result,value}','10'),repeat('9',64),'2026-09-30','published',now() FROM original RETURNING *) INSERT INTO data_comparisons(tenant_id,comparison_type,baseline_metric_snapshot_id,current_metric_snapshot_id,baseline_value,current_value,absolute_change,percentage_change,direction,status,explanation_inputs,source_snapshot_ids,metric_definition_id,methodology_compatible,period_distance,comparison_checksum) SELECT original.tenant_id,'period',original.id,second.id,0,10,10,NULL,'increase','improved','{}',ARRAY[original.id,second.id],original.metric_definition_id,true,1,repeat('a',64) FROM original,second;" >/dev/null
comparison_count="$(run_psql -Atqc "SELECT count(*) FROM data_comparisons WHERE tenant_id='70000000-0000-0000-0000-000000000701' AND baseline_metric_snapshot_id IS NOT NULL AND baseline_snapshot_id IS NULL")"
[[ "$comparison_count" == "1" ]] || { echo "Metric snapshot comparison FK contract failed" >&2; exit 1; }
run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO data_comparisons(tenant_id,comparison_type,current_metric_snapshot_id,baseline_value,current_value,absolute_change,percentage_change,direction,status,explanation_inputs,source_snapshot_ids,metric_definition_id,methodology_compatible,period_distance,comparison_checksum,target_value) SELECT tenant_id,'target',id,80,(snapshot_payload->'result'->>'value')::numeric,(snapshot_payload->'result'->>'value')::numeric-80,NULL,'decrease','degraded','{\"target\":80}',ARRAY[id],metric_definition_id,true,0,repeat('b',64),80 FROM metric_snapshots WHERE tenant_id='70000000-0000-0000-0000-000000000701' ORDER BY effective_at DESC LIMIT 1;" >/dev/null
target_count="$(run_psql -Atqc "SELECT count(*) FROM data_comparisons WHERE comparison_type='target' AND baseline_metric_snapshot_id IS NULL AND target_value=80")"
[[ "$target_count" == "1" ]] || { echo "Target comparison contract failed" >&2; exit 1; }
if run_psql -v ON_ERROR_STOP=1 -c "UPDATE metric_snapshots SET content_hash=repeat('4',64) WHERE tenant_id='70000000-0000-0000-0000-000000000701'" >/tmp/tcdx-phase5-c3-immutable.txt 2>&1; then echo "Published indicator snapshot was mutable" >&2; exit 1; fi
if run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO metric_measurements(tenant_id,metric_definition_id,period_key,period_start,period_end,value_numeric,quality_status,freshness_status,trust_status,validation_status,metadata,official_state,sufficiency_status) SELECT '70000000-0000-0000-0000-000000000701',metric_definition_id,'invalid-null',now(),now(),1,'unknown','unknown','unknown','pending','{}','source_unavailable','source_unavailable' FROM metric_snapshots LIMIT 1" >/tmp/tcdx-phase5-c3-null-state.txt 2>&1; then echo "Non-calculated state accepted a numeric official value" >&2; exit 1; fi

run_psql -v ON_ERROR_STOP=1 -c "UPDATE schema_migrations SET checksum=repeat('e',64),status='applied' WHERE migration_id='20260807_phase5_c3_indicators_trust_snapshots'" >/dev/null
if MIGRATION_DATABASE_URL="$DATABASE_URL" node "$C3_RUNNER" --apply >/tmp/tcdx-phase5-c3-checksum-mismatch.txt 2>&1; then echo "Applied checksum mismatch was not rejected" >&2; exit 1; fi
grep -q 'checksum differs from applied ledger entry' /tmp/tcdx-phase5-c3-checksum-mismatch.txt || { echo "Applied checksum mismatch error was not explicit" >&2; exit 1; }

printf '{"status":"VERIFIED_PHASE5_C3_POSTGRES","catalog":%s,"bindings":%s,"trust_dimensions":%s,"tenant_isolation":"verified","real_zero":"preserved","metric_comparison_fk":"verified","target_comparison":"verified","failed_retry":"verified","idempotent":"verified","published_immutable":"verified","null_to_zero":"rejected","applied_checksum_mismatch":"rejected"}\n' "$catalog_count" "$binding_count" "$dimension_count"
