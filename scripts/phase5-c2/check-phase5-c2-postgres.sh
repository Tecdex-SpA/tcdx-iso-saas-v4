#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BASE_FIXTURE="$REPO_ROOT/tests/fixtures/phase1-base-schema.sql"
PHASE2_MASTER="$REPO_ROOT/scripts/phase5-c2/fixtures/phase2-master-schema.fixture"
PHASE3_MASTER="$REPO_ROOT/tests/fixtures/phase3-master-schema.sql"
MIGRATIONS=(
  "$REPO_ROOT/database/migrations/20260722_phase1_grc_core.sql"
  "$REPO_ROOT/database/migrations/20260723_phase1r_operational_closeout.sql"
  "$REPO_ROOT/database/migrations/20260727_phase2_integrated_grc.sql"
  "$REPO_ROOT/database/migrations/20260728_phase3_operational_grc.sql"
)
PHASE4="$REPO_ROOT/database/migrations/20260729_phase4_commercial_product.sql"
PHASE5_RUNNER="$REPO_ROOT/scripts/phase5/apply-phase5-migration.js"
FORMULA_BOOTSTRAP="$REPO_ROOT/scripts/phase5-5/bootstrap-official-math-governance.js"
C2_RUNNER="$REPO_ROOT/scripts/phase5-c2/apply-phase5-c2-migration.js"

for file in "$BASE_FIXTURE" "$PHASE2_MASTER" "$PHASE3_MASTER" "$PHASE4" "$PHASE5_RUNNER" "$FORMULA_BOOTSTRAP" "$C2_RUNNER" "${MIGRATIONS[@]}"; do
  [[ -r "$file" ]] || { echo "Required Phase 5-C2 integration input is not readable: $file" >&2; exit 1; }
done

DATABASE_NAME="phase5_c2_semantic_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase5-c2-$$-$RANDOM"
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
run_psql -v ON_ERROR_STOP=1 -c "ALTER TABLE tenants DROP COLUMN IF EXISTS status; ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_status text DEFAULT 'active'; INSERT INTO tenants (id,name) VALUES ('70000000-0000-0000-0000-000000000701','Tenant A Semantic'),('70000000-0000-0000-0000-000000000702','Tenant B Semantic') ON CONFLICT (id) DO NOTHING; CREATE TABLE IF NOT EXISTS tenant_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,plan_key text,contract_status text,started_at date,ends_at date,billing_currency text,commercial_notes text,crm_reference text,max_active_standards integer,max_premium_modules integer,external_lookup_quota integer,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); INSERT INTO tenant_contracts (tenant_id,plan_key,contract_status) VALUES ('70000000-0000-0000-0000-000000000701','empresa','active'),('70000000-0000-0000-0000-000000000702','demo','active');" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$PHASE4" >/dev/null
DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME"
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$PHASE5_RUNNER" --apply >/tmp/tcdx-phase5-c2-phase5.txt
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$FORMULA_BOOTSTRAP" >/tmp/tcdx-phase5-c2-formulas.txt

c2_checksum="$(node "$C2_RUNNER" --checksum | awk -F= '/checksum=/ { print $2; exit }')"
failed_checksum="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
run_psql -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (migration_id,checksum,applied_at,applied_by,status,details) VALUES ('20260803_phase5_c2_semantic_layer','$failed_checksum',now(),current_user,'failed','{\"test\":\"failed-retry\"}'::jsonb) ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,status='failed',details=EXCLUDED.details;" >/dev/null
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$C2_RUNNER" --apply >/tmp/tcdx-phase5-c2-apply-1.txt
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$C2_RUNNER" --apply >/tmp/tcdx-phase5-c2-apply-2.txt

tables_count="$(run_psql -Atqc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY(ARRAY['data_source_contracts','data_source_contract_versions','data_source_field_mappings','grc_observations','grc_observation_relations','metric_sufficiency_rules'])")"
ledger_status="$(run_psql -Atqc "SELECT status FROM schema_migrations WHERE migration_id='20260803_phase5_c2_semantic_layer'")"
ledger_checksum="$(run_psql -Atqc "SELECT checksum FROM schema_migrations WHERE migration_id='20260803_phase5_c2_semantic_layer'")"
contracts_count="$(run_psql -Atqc "SELECT COUNT(*) FROM data_source_contracts WHERE tenant_id IS NULL AND status='published'")"
versions_count="$(run_psql -Atqc "SELECT COUNT(*) FROM data_source_contract_versions WHERE status='published'")"
capability_count="$(run_psql -Atqc "SELECT COUNT(*) FROM commercial_technical_capabilities WHERE capability_key='data.semantic_layer' AND status='active'")"
[[ "$tables_count" == "6" && "$ledger_status" == "applied" && "$ledger_checksum" == "$c2_checksum" ]] || { echo "Phase 5-C2 migration/ledger verification failed" >&2; exit 1; }
[[ "$contracts_count" -ge "16" && "$versions_count" -ge "16" && "$capability_count" == "1" ]] || { echo "Phase 5-C2 bootstrap/capability verification failed" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -c "CREATE TABLE semantic_source_fixture (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),observed_at timestamptz NOT NULL,value_numeric numeric,status text); INSERT INTO semantic_source_fixture (tenant_id,observed_at,value_numeric,status) VALUES ('70000000-0000-0000-0000-000000000701',now(),85,'valid'),('70000000-0000-0000-0000-000000000702',now(),40,'attention'); INSERT INTO data_source_contracts (id,tenant_id,source_code,display_name,entity_type,adapter_key,status) VALUES ('70000000-0000-0000-0000-000000002001','70000000-0000-0000-0000-000000000701','qa.semantic.source','QA Semantic Source','qa_metric','official_formula_source','published'); INSERT INTO data_source_contract_versions (id,contract_id,version_number,physical_tables,tenant_key_candidates,timestamp_candidates,required_fields,status,checksum,published_at) VALUES ('70000000-0000-0000-0000-000000002002','70000000-0000-0000-0000-000000002001',1,'[\"semantic_source_fixture\"]','[\"tenant_id\"]','[\"observed_at\"]','[\"value\",\"observed_at\"]','published',repeat('a',64),now()); UPDATE data_source_contracts SET current_version_id='70000000-0000-0000-0000-000000002002' WHERE id='70000000-0000-0000-0000-000000002001'; INSERT INTO data_source_field_mappings (tenant_id,contract_version_id,physical_table,physical_column,canonical_field,transformation_type,required) VALUES ('70000000-0000-0000-0000-000000000701','70000000-0000-0000-0000-000000002002','semantic_source_fixture','value_numeric','value','numeric_parse',true),('70000000-0000-0000-0000-000000000701','70000000-0000-0000-0000-000000002002','semantic_source_fixture','observed_at','observed_at','timezone_normalize',true); INSERT INTO data_snapshots (id,tenant_id,snapshot_type,entity_type,entity_id,snapshot_payload,source_hash,correlation_id) VALUES ('70000000-0000-0000-0000-000000002003','70000000-0000-0000-0000-000000000701','semantic_source','source_contract_version','70000000-0000-0000-0000-000000002002','{\"rows\":1}',repeat('b',64),'semantic-pg'); INSERT INTO grc_observations (id,tenant_id,observation_type,entity_type,contract_id,contract_version_id,source_table,source_record_id,source_identity_hash,observed_at,numeric_value,quality_status,quality_score,freshness_status,freshness_age_seconds,correlation_id,source_snapshot_id,metadata) VALUES ('70000000-0000-0000-0000-000000002004','70000000-0000-0000-0000-000000000701','qa.metric','qa_metric','70000000-0000-0000-0000-000000002001','70000000-0000-0000-0000-000000002002','semantic_source_fixture','record-a',repeat('c',64),now(),85,'valid',100,'fresh',0,'semantic-pg','70000000-0000-0000-0000-000000002003','{\"content_hash\":\"first\"}'); INSERT INTO metric_sufficiency_rules (id,tenant_id,formula_code,rule_code,version_number,required_inputs,minimum_sample_size,minimum_coverage,status,checksum,published_at) VALUES ('70000000-0000-0000-0000-000000002005','70000000-0000-0000-0000-000000000701','F5_5_COMPLIANCE_WEIGHTED','qa.sufficiency',1,'[\"value\"]',1,1,'published',repeat('d',64),now());" >/dev/null

tenant_a="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_observations WHERE tenant_id='70000000-0000-0000-0000-000000000701'")"
tenant_b="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_observations WHERE tenant_id='70000000-0000-0000-0000-000000000702'")"
[[ "$tenant_a" == "1" && "$tenant_b" == "0" ]] || { echo "Semantic tenant isolation failed" >&2; exit 1; }

if run_psql -v ON_ERROR_STOP=1 -c "UPDATE data_source_contract_versions SET minimum_coverage=0.5 WHERE id='70000000-0000-0000-0000-000000002002'" >/tmp/tcdx-phase5-c2-version-immutable.txt 2>&1; then echo "Published semantic version was mutable" >&2; exit 1; fi
if run_psql -v ON_ERROR_STOP=1 -c "UPDATE data_snapshots SET source_hash=repeat('e',64) WHERE id='70000000-0000-0000-0000-000000002003'" >/tmp/tcdx-phase5-c2-snapshot-immutable.txt 2>&1; then echo "Semantic source snapshot was mutable" >&2; exit 1; fi
if run_psql -v ON_ERROR_STOP=1 -c "UPDATE metric_sufficiency_rules SET minimum_sample_size=2 WHERE id='70000000-0000-0000-0000-000000002005'" >/tmp/tcdx-phase5-c2-rule-immutable.txt 2>&1; then echo "Published sufficiency rule was mutable" >&2; exit 1; fi

run_psql -v ON_ERROR_STOP=1 -c "BEGIN; SET CONSTRAINTS ALL DEFERRED; UPDATE grc_observations SET is_current=false,superseded_by_id='70000000-0000-0000-0000-000000002006' WHERE id='70000000-0000-0000-0000-000000002004'; INSERT INTO grc_observations (id,tenant_id,observation_type,entity_type,contract_id,contract_version_id,source_table,source_record_id,source_identity_hash,observed_at,numeric_value,quality_status,quality_score,freshness_status,freshness_age_seconds,correlation_id,source_snapshot_id,supersedes_observation_id,metadata) VALUES ('70000000-0000-0000-0000-000000002006','70000000-0000-0000-0000-000000000701','qa.metric','qa_metric','70000000-0000-0000-0000-000000002001','70000000-0000-0000-0000-000000002002','semantic_source_fixture','record-a',repeat('c',64),now(),90,'valid',100,'fresh',0,'semantic-pg-2','70000000-0000-0000-0000-000000002003','70000000-0000-0000-0000-000000002004','{\"content_hash\":\"second\"}'); COMMIT;" >/dev/null
current_count="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_observations WHERE tenant_id='70000000-0000-0000-0000-000000000701' AND source_identity_hash=repeat('c',64) AND is_current")"
history_count="$(run_psql -Atqc "SELECT COUNT(*) FROM grc_observations WHERE tenant_id='70000000-0000-0000-0000-000000000701' AND source_identity_hash=repeat('c',64)")"
[[ "$current_count" == "1" && "$history_count" == "2" ]] || { echo "Semantic supersession failed" >&2; exit 1; }

bad_checksum="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
run_psql -v ON_ERROR_STOP=1 -c "UPDATE schema_migrations SET checksum='$bad_checksum',status='applied' WHERE migration_id='20260803_phase5_c2_semantic_layer';" >/dev/null
if MIGRATION_DATABASE_URL="$DATABASE_URL" node "$C2_RUNNER" --apply >/tmp/tcdx-phase5-c2-checksum-mismatch.txt 2>&1; then echo "Applied checksum mismatch was not rejected" >&2; exit 1; fi
grep -q 'checksum differs from applied ledger entry' /tmp/tcdx-phase5-c2-checksum-mismatch.txt || { echo "Applied checksum mismatch error was not explicit" >&2; exit 1; }

printf '{"status":"VERIFIED_PHASE5_C2_POSTGRES","tables":%s,"contracts":%s,"versions":%s,"tenant_isolation":"verified","failed_retry":"verified","idempotent":"verified","published_immutable":"verified","snapshot_immutable":"verified","sufficiency_immutable":"verified","supersession":"verified","applied_checksum_mismatch":"rejected"}\n' "$tables_count" "$contracts_count" "$versions_count"
