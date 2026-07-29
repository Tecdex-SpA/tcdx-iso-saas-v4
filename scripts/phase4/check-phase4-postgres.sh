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
PHASE3_RUNNER="$REPO_ROOT/scripts/phase3/apply-phase3-migration.js"
PHASE4_RUNNER="$REPO_ROOT/scripts/phase4/apply-phase4-migration.js"

for file in "$BASE_FIXTURE" "$PHASE2_MASTER" "$PHASE3_MASTER" "$PHASE1_MIGRATION" "$PHASE1R_MIGRATION" "$PHASE2_MIGRATION" "$PHASE3_MIGRATION" "$PHASE3_RUNNER" "$PHASE4_RUNNER"; do
  [[ -r "$file" ]] || { echo "Required integration input is not readable: $file" >&2; exit 1; }
done

DATABASE_NAME="phase4_commercial_$(date +%s)_$$"
CONTAINER_NAME="tcdx-phase4-commercial-$$-$RANDOM"
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
run_psql -v ON_ERROR_STOP=1 -c "
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_status text DEFAULT 'active';
  INSERT INTO tenants (id,name)
  VALUES
    ('70000000-0000-0000-0000-000000000701','Tenant A Comercial'),
    ('70000000-0000-0000-0000-000000000702','Tenant B Comercial')
  ON CONFLICT (id) DO NOTHING;
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
  INSERT INTO public.schema_migrations (migration_id, checksum, applied_at, applied_by, status)
  VALUES ('20260728_phase3_operational_grc','2dd9376e49937795bc7dbd03332536e26f4e8bfbc883d731818dda9fa620bb50',now(),current_user,'applied')
  ON CONFLICT (migration_id) DO NOTHING;
" >/dev/null

MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE3_RUNNER" --apply >/dev/null
run_psql -v ON_ERROR_STOP=1 -c "
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

MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE4_RUNNER" --apply >/tmp/tcdx-phase4-apply-1.txt
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" node "$PHASE4_RUNNER" --apply >/tmp/tcdx-phase4-apply-2.txt

tables_count="$(run_psql -Atqc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['product_families','commercial_editions','commercial_plans','commercial_plan_versions','commercial_modules','commercial_addons','commercial_features','commercial_technical_capabilities','tenant_subscriptions','tenant_feature_overrides','tenant_usage_limits','usage_measurements','trials','commercial_events','pack_definitions','pack_versions','pack_items','risk_methodology_versions','audit_workpaper_template_versions'])")"
views_count="$(run_psql -Atqc "SELECT COUNT(*) FROM information_schema.views WHERE table_schema='public' AND table_name = ANY(ARRAY['v_commercial_plan_capabilities','v_commercial_tenant_subscription','v_commercial_tenant_modules','v_commercial_tenant_capabilities','v_commercial_tenant_health','v_tenant_commercial_entitlements'])")"
ledger_status="$(run_psql -Atqc "SELECT status FROM schema_migrations WHERE migration_id='20260729_phase4_commercial_product'")"
legacy_subscriptions="$(run_psql -Atqc "SELECT COUNT(*) FROM tenant_subscriptions WHERE tenant_id IN ('70000000-0000-0000-0000-000000000701','70000000-0000-0000-0000-000000000702')")"
capabilities_count="$(run_psql -Atqc "SELECT COUNT(*) FROM v_commercial_tenant_capabilities WHERE tenant_id='70000000-0000-0000-0000-000000000701'")"
pack_count="$(run_psql -Atqc "SELECT COUNT(*) FROM pack_definitions WHERE status='published'")"
trigger_enabled="$(run_psql -Atqc "SELECT tgenabled FROM pg_trigger WHERE tgname='trg_commercial_plan_versions_immutable'")"

[[ "$tables_count" == "19" ]] || { echo "Unexpected Phase 4 table count: $tables_count" >&2; exit 1; }
[[ "$views_count" == "6" ]] || { echo "Unexpected Phase 4 view count: $views_count" >&2; exit 1; }
[[ "$ledger_status" == "applied" ]] || { echo "Phase 4 ledger status is not applied: $ledger_status" >&2; exit 1; }
[[ "$legacy_subscriptions" -ge 2 ]] || { echo "Legacy tenant subscriptions were not seeded" >&2; exit 1; }
[[ "$capabilities_count" -gt 0 ]] || { echo "Tenant A capabilities were not resolved" >&2; exit 1; }
[[ "$pack_count" -ge 4 ]] || { echo "Expected published packs were not seeded" >&2; exit 1; }
[[ "$trigger_enabled" == "O" ]] || { echo "Plan version immutability trigger is not enabled" >&2; exit 1; }

printf '{"status":"VERIFIED_PHASE4_POSTGRES","tables":%s,"views":%s,"legacy_subscriptions":%s,"tenant_a_capabilities":%s,"published_packs":%s,"ledger":"%s","trigger":"%s"}\n' \
  "$tables_count" "$views_count" "$legacy_subscriptions" "$capabilities_count" "$pack_count" "$ledger_status" "$trigger_enabled"
