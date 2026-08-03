#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
DATABASE_NAME="tcdx_demo_check_$(date +%s)_$$"
CONTAINER_NAME="tcdx-demo-tenant-$$-$RANDOM"
DEMO_TENANT_ID="76c44a0e-6041-8bda-99c7-b740fccea001"
TENANT_B_ID="70000000-0000-0000-0000-000000000702"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tcdx-demo-check.XXXXXX")"
ATTESTATION_FILE="$RUN_DIR/dry-run-attestation.json"

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi
  rm -rf "$RUN_DIR"
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --detach --name "$CONTAINER_NAME" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$DATABASE_NAME" -p "127.0.0.1::5432" postgres:16-alpine >/dev/null
PORT="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "Docker did not publish PostgreSQL port" >&2; exit 1; }

run_psql() {
  psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE_NAME" "$@"
}

ready=0
for _attempt in {1..45}; do
  if run_psql -Atqc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
(( ready == 1 )) || { echo "PostgreSQL 16 did not become ready" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/fixtures/phase1-base-schema.sql" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/scripts/phase5-c2/fixtures/phase2-master-schema.fixture" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/fixtures/phase3-master-schema.sql" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260722_phase1_grc_core.sql" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260723_phase1r_operational_closeout.sql" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260727_phase2_integrated_grc.sql" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260728_phase3_operational_grc.sql" >/dev/null
run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260520_tenant_company_profiles.sql" >/dev/null

run_psql -v ON_ERROR_STOP=1 -c "
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rut text NOT NULL DEFAULT 'FIXTURE-RUT';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address text;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business text;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branches text;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_status text NOT NULL DEFAULT 'active';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at timestamp;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at timestamp;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_plan text NOT NULL DEFAULT 'none';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_web_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_report_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_auditor_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_monthly_quota integer;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_quota_used integer NOT NULL DEFAULT 0;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_features_json jsonb NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT 'fixture-hash';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS display_name text;
  ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS role_level integer NOT NULL DEFAULT 100;
  ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT true;
  ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
  ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
  ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  UPDATE app_roles SET display_name=COALESCE(display_name, role_key);
  CREATE TABLE IF NOT EXISTS roles (id serial PRIMARY KEY, name varchar(50) NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS user_roles (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id integer NOT NULL REFERENCES roles(id), PRIMARY KEY (user_id, role_id));
  CREATE TABLE IF NOT EXISTS tenant_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, plan_key text, contract_status text, started_at date, ends_at date, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  CREATE TABLE IF NOT EXISTS standards (id serial PRIMARY KEY, code varchar(50) NOT NULL UNIQUE, name varchar(255));
  CREATE TABLE IF NOT EXISTS controls_catalog (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), iso text, clause text, category text, description text, tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE, source_type text NOT NULL DEFAULT 'generic', is_active boolean NOT NULL DEFAULT true, base_control_id uuid, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS tenant_standards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, standard_code text NOT NULL REFERENCES standards(code), is_active boolean NOT NULL DEFAULT true, initialized_at timestamp, created_at timestamp NOT NULL DEFAULT now(), catalog_mode text NOT NULL DEFAULT 'generic', contracted_at timestamp DEFAULT now(), deactivated_at timestamp, updated_at timestamp DEFAULT now(), lifecycle_status text NOT NULL DEFAULT 'active', paused_at timestamp, permanently_deactivated_at timestamp);
  CREATE TABLE IF NOT EXISTS asset_risks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid REFERENCES assets(id) ON DELETE CASCADE, risk text, impact text, probability text, level text, created_at timestamp DEFAULT now());
  ALTER TABLE assets ADD COLUMN IF NOT EXISTS type text;
  ALTER TABLE assets ADD COLUMN IF NOT EXISTS iso text;
  ALTER TABLE assets ADD COLUMN IF NOT EXISTS criticality text;
  ALTER TABLE assets ADD COLUMN IF NOT EXISTS owner text;
  ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS control_id uuid REFERENCES controls_catalog(id);
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS status text DEFAULT '-';
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS score numeric DEFAULT 0;
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'sin_datos';
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS responsible_user_id uuid;
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS last_reviewed_at timestamp;
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS due_date date;
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media';
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS applicability text DEFAULT 'aplicable';
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS notes text;
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS operation_id uuid REFERENCES tenant_operations(id);
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
  ALTER TABLE tenant_controls ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS control_id uuid;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS file_name text;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS file_path text;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendiente';
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS validated boolean DEFAULT false;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS tenant_control_id uuid REFERENCES tenant_controls(id);
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS reviewed_by uuid;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS expires_at date;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS evidence_type text DEFAULT 'documento';
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS file_mime_type text;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS content_fingerprint text;
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS document_extraction_status text DEFAULT 'pending';
  ALTER TABLE evidences ADD COLUMN IF NOT EXISTS ai_analysis_status text DEFAULT 'pending';
  ALTER TABLE audits ADD COLUMN IF NOT EXISTS report_file text;
  ALTER TABLE audits ADD COLUMN IF NOT EXISTS audit_result text;
  ALTER TABLE audits ADD COLUMN IF NOT EXISTS audit_result_notes text;
  ALTER TABLE audits ADD COLUMN IF NOT EXISTS audit_result_at timestamp;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS iso_code text REFERENCES standards(code);
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS title text;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS finding_type text DEFAULT 'observacion';
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS severity text DEFAULT 'media';
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual';
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS source_id uuid;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS owner text;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS detected_by text;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS due_date date;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS closed_at timestamp;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS created_by uuid;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS tenant_control_id uuid;
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS audit_id uuid REFERENCES audits(id);
  ALTER TABLE findings ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets(id);
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS iso_code text REFERENCES standards(code);
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS title text;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual';
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS source_id uuid;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS owner text;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS created_by uuid;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS completed_at timestamp;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS tenant_control_id uuid REFERENCES tenant_controls(id);
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS finding_id uuid REFERENCES findings(id);
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS audit_id uuid REFERENCES audits(id);
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets(id);
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'no_requerida';
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS approval_reviewed_by uuid;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS approval_reviewed_at timestamp;
  ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS approval_comment text;
  ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_ai_enabled_plan_consistency_check;
  ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_ai_plan_check;
  ALTER TABLE tenants ADD CONSTRAINT tenants_ai_plan_check CHECK (ai_plan = ANY (ARRAY['none'::text, 'basic'::text, 'standard'::text, 'pro'::text, 'premium'::text, 'enterprise'::text]));
  ALTER TABLE tenants ADD CONSTRAINT tenants_ai_enabled_plan_consistency_check CHECK ((ai_enabled = false AND ai_plan = 'none'::text) OR (ai_enabled = true AND ai_plan <> 'none'::text));
  ALTER TABLE tenant_standards DROP CONSTRAINT IF EXISTS chk_tenant_standards_catalog_mode;
  ALTER TABLE tenant_standards ADD CONSTRAINT chk_tenant_standards_catalog_mode CHECK (catalog_mode = ANY (ARRAY['generic'::text, 'personalized'::text, 'mixed'::text]));
  ALTER TABLE tenant_standards DROP CONSTRAINT IF EXISTS tenant_standards_tenant_id_standard_code_key;
  ALTER TABLE tenant_standards ADD CONSTRAINT tenant_standards_tenant_id_standard_code_key UNIQUE (tenant_id, standard_code);
  ALTER TABLE controls_catalog DROP CONSTRAINT IF EXISTS chk_controls_catalog_source_type;
  ALTER TABLE controls_catalog ADD CONSTRAINT chk_controls_catalog_source_type CHECK (source_type = ANY (ARRAY['generic'::text, 'personalized'::text]));
  UPDATE findings SET finding_type=COALESCE(finding_type,'observacion'), severity=COALESCE(severity,'media'), status=COALESCE(status,'abierto'), source_type=COALESCE(source_type,'manual');
  ALTER TABLE findings ALTER COLUMN finding_type SET NOT NULL, ALTER COLUMN severity SET NOT NULL, ALTER COLUMN status SET NOT NULL, ALTER COLUMN source_type SET NOT NULL;
  ALTER TABLE findings DROP CONSTRAINT IF EXISTS chk_findings_type;
  ALTER TABLE findings DROP CONSTRAINT IF EXISTS chk_findings_severity;
  ALTER TABLE findings DROP CONSTRAINT IF EXISTS chk_findings_status;
  ALTER TABLE findings DROP CONSTRAINT IF EXISTS chk_findings_source_type;
  ALTER TABLE findings ADD CONSTRAINT chk_findings_type CHECK (finding_type = ANY (ARRAY['no conformidad'::text, 'observacion'::text, 'oportunidad de mejora'::text, 'fortaleza'::text]));
  ALTER TABLE findings ADD CONSTRAINT chk_findings_severity CHECK (severity = ANY (ARRAY['alta'::text, 'media'::text, 'baja'::text]));
  ALTER TABLE findings ADD CONSTRAINT chk_findings_status CHECK (status = ANY (ARRAY['abierto'::text, 'en revision'::text, 'accion definida'::text, 'cerrado'::text]));
  ALTER TABLE findings ADD CONSTRAINT chk_findings_source_type CHECK (source_type = ANY (ARRAY['manual'::text, 'audit'::text, 'diagnostic'::text, 'risk'::text, 'soa'::text, 'ia'::text, 'evidence'::text]));
  UPDATE action_plans SET source_type=COALESCE(source_type,'manual'), priority=COALESCE(priority,'media'), status=COALESCE(status,'abierto'), approval_status=COALESCE(approval_status,'no_requerida');
  ALTER TABLE action_plans ALTER COLUMN source_type SET NOT NULL, ALTER COLUMN priority SET NOT NULL, ALTER COLUMN status SET NOT NULL, ALTER COLUMN approval_status SET NOT NULL;
  ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS chk_action_plans_source_type;
  ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS chk_action_plans_priority;
  ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS chk_action_plans_status;
  ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS chk_action_plans_approval_status;
  ALTER TABLE action_plans ADD CONSTRAINT chk_action_plans_source_type CHECK (source_type = ANY (ARRAY['manual'::text, 'nonconformity'::text, 'risk'::text, 'audit'::text, 'control'::text, 'ia'::text, 'finding'::text]));
  ALTER TABLE action_plans ADD CONSTRAINT chk_action_plans_priority CHECK (priority = ANY (ARRAY['alta'::text, 'media'::text, 'baja'::text]));
  ALTER TABLE action_plans ADD CONSTRAINT chk_action_plans_status CHECK (status = ANY (ARRAY['abierto'::text, 'en progreso'::text, 'bloqueado'::text, 'completado'::text, 'cancelado'::text]));
  ALTER TABLE action_plans ADD CONSTRAINT chk_action_plans_approval_status CHECK (approval_status = ANY (ARRAY['no_requerida'::text, 'pendiente_aprobacion'::text, 'aprobada'::text, 'devuelta'::text]));
" >/dev/null

# The phase fixture provides a test-only assignment table. Production authorization
# resolves the role stored on users, so the disposable database mirrors that contract.
run_psql -v ON_ERROR_STOP=1 -c "
  CREATE OR REPLACE FUNCTION user_has_permission(requested_user_id uuid, requested_permission text)
  RETURNS boolean LANGUAGE sql STABLE AS \$\$
    SELECT EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_key=u.role AND rp.permission_key=requested_permission AND rp.is_allowed=true
      WHERE u.id=requested_user_id
    );
  \$\$;
" >/dev/null

run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260729_phase4_commercial_product.sql" >/dev/null
DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME"
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$REPO_ROOT/scripts/phase5/apply-phase5-migration.js" --apply >"$RUN_DIR/phase5.txt"
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$REPO_ROOT/scripts/phase5-5/bootstrap-official-math-governance.js" >"$RUN_DIR/formulas.txt"
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$REPO_ROOT/scripts/phase5-c2/apply-phase5-c2-migration.js" --apply >"$RUN_DIR/c2.txt"

run_psql -v ON_ERROR_STOP=1 -c '\d+ schema_migrations' >"$RUN_DIR/schema-migrations-describe.txt"
ledger_columns="$(run_psql -Atqc "SELECT string_agg(column_name || ':' || data_type, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='schema_migrations'")"
constraint_def="$(run_psql -Atqc "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.tenants'::regclass AND conname='tenants_ai_plan_check'")"
[[ "$ledger_columns" == *"migration_id:"* && "$ledger_columns" == *"checksum:"* && "$ledger_columns" == *"status:"* && "$ledger_columns" == *"details:"* ]] || { echo "schema_migrations ledger shape is incompatible: $ledger_columns" >&2; exit 1; }
[[ "$ledger_columns" != *"error_message:"* ]] || { echo "schema_migrations unexpectedly contains error_message" >&2; exit 1; }
[[ "$constraint_def" == *"'enterprise'"* && "$constraint_def" != *"demo_enterprise"* ]] || { echo "tenants_ai_plan_check does not allow enterprise exactly: $constraint_def" >&2; exit 1; }
catalog_constraint_def="$(run_psql -Atqc "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.tenant_standards'::regclass AND conname='chk_tenant_standards_catalog_mode'")"
[[ "$catalog_constraint_def" == *"'mixed'"* && "$catalog_constraint_def" != *"demo_integrated"* ]] || { echo "chk_tenant_standards_catalog_mode does not allow mixed exactly: $catalog_constraint_def" >&2; exit 1; }

demo_checksum="$(node "$REPO_ROOT/scripts/demo/apply-demo-tenant-migration.js" --checksum | awk -F= '/^20260803_demo_tenant_iso_grc checksum=/ {print $2}')"
run_psql -v ON_ERROR_STOP=1 -c "
  INSERT INTO schema_migrations (migration_id, checksum, applied_by, duration_ms, status, details)
  VALUES ('20260803_demo_tenant_iso_grc', repeat('f',64), current_user, 1, 'failed', '{\"fixture\":\"failed-retry\"}'::jsonb)
  ON CONFLICT (migration_id) DO UPDATE SET
    checksum = EXCLUDED.checksum,
    applied_by = current_user,
    duration_ms = EXCLUDED.duration_ms,
    status = 'failed',
    details = EXCLUDED.details;
" >/dev/null

if MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_DRY_RUN_ATTESTATION_FILE="$ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-tenant-migration.js" --apply >"$RUN_DIR/missing-dry-run-apply.txt" 2>&1; then
  echo "Apply unexpectedly ran without a dry-run attestation" >&2
  exit 1
fi
grep -q "dry-run attestation is missing" "$RUN_DIR/missing-dry-run-apply.txt" || { echo "Apply did not explain missing dry-run attestation" >&2; exit 1; }

MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_DRY_RUN_ATTESTATION_FILE="$ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-tenant-migration.js" --preflight >"$RUN_DIR/preflight.txt"
MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_DRY_RUN_ATTESTATION_FILE="$ATTESTATION_FILE" npm --prefix "$REPO_ROOT" run demo:migration:dry-run >"$RUN_DIR/dry-run-1.txt"
dry_run_presence="$(run_psql -Atqc "SELECT (SELECT count(*) FROM tenants WHERE id='$DEMO_TENANT_ID') || ':' || (SELECT count(*) FROM users WHERE tenant_id='$DEMO_TENANT_ID') || ':' || (SELECT status FROM schema_migrations WHERE migration_id='20260803_demo_tenant_iso_grc')")"
[[ "$dry_run_presence" == "0:0:failed" ]] || { echo "Dry-run did not roll back tenant/users/ledger: $dry_run_presence" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 -c "ALTER TABLE tenants ADD CONSTRAINT demo_fixture_schema_drift_check CHECK (name <> '');" >/dev/null
if MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_DRY_RUN_ATTESTATION_FILE="$ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-tenant-migration.js" --apply >"$RUN_DIR/schema-drift-apply.txt" 2>&1; then
  echo "Apply unexpectedly ignored schema drift after dry-run" >&2
  exit 1
fi
grep -q "schema changed after dry-run" "$RUN_DIR/schema-drift-apply.txt" || { echo "Apply did not explain schema-signature mismatch" >&2; exit 1; }
run_psql -v ON_ERROR_STOP=1 -c "ALTER TABLE tenants DROP CONSTRAINT demo_fixture_schema_drift_check;" >/dev/null

MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_DRY_RUN_ATTESTATION_FILE="$ATTESTATION_FILE" npm --prefix "$REPO_ROOT" run demo:migration:dry-run >"$RUN_DIR/dry-run-2.txt"
MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_DRY_RUN_ATTESTATION_FILE="$ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-tenant-migration.js" --apply >"$RUN_DIR/apply-1.txt"
MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_DRY_RUN_ATTESTATION_FILE="$ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-tenant-migration.js" --apply >"$RUN_DIR/apply-2.txt"

counts="$(run_psql -Atqc "SELECT jsonb_build_object(
  'tenant',(SELECT count(*) FROM tenants WHERE id='$DEMO_TENANT_ID'),
  'users',(SELECT count(*) FROM users WHERE tenant_id='$DEMO_TENANT_ID'),
  'standards',(SELECT count(*) FROM tenant_standards WHERE tenant_id='$DEMO_TENANT_ID'),
  'processes',(SELECT count(*) FROM tenant_processes WHERE tenant_id='$DEMO_TENANT_ID'),
  'risks',(SELECT count(*) FROM asset_risks ar JOIN assets a ON a.id=ar.asset_id WHERE a.tenant_id='$DEMO_TENANT_ID'),
  'controls',(SELECT count(*) FROM tenant_controls WHERE tenant_id='$DEMO_TENANT_ID'),
  'evidences',(SELECT count(*) FROM evidences WHERE tenant_id='$DEMO_TENANT_ID'),
  'audits',(SELECT count(*) FROM audits WHERE tenant_id='$DEMO_TENANT_ID'),
  'findings',(SELECT count(*) FROM findings WHERE tenant_id='$DEMO_TENANT_ID'),
  'actions',(SELECT count(*) FROM action_plans WHERE tenant_id='$DEMO_TENANT_ID'),
  'metrics',(SELECT count(*) FROM metric_definitions WHERE tenant_id='$DEMO_TENANT_ID'),
  'measurements',(SELECT count(*) FROM metric_measurements WHERE tenant_id='$DEMO_TENANT_ID'),
  'metric_snapshots',(SELECT count(*) FROM metric_snapshots WHERE tenant_id='$DEMO_TENANT_ID'),
  'data_snapshots',(SELECT count(*) FROM data_snapshots WHERE tenant_id='$DEMO_TENANT_ID'),
  'contracts',(SELECT count(*) FROM data_source_contracts WHERE tenant_id='$DEMO_TENANT_ID'),
  'mappings',(SELECT count(*) FROM data_source_field_mappings WHERE tenant_id='$DEMO_TENANT_ID'),
  'observations',(SELECT count(*) FROM grc_observations WHERE tenant_id='$DEMO_TENANT_ID'),
  'lineage',(SELECT count(*) FROM data_lineage_edges WHERE tenant_id='$DEMO_TENANT_ID'),
  'dashboards',(SELECT count(*) FROM dashboard_definitions WHERE tenant_id='$DEMO_TENANT_ID'),
  'widgets',(SELECT count(*) FROM dashboard_widgets WHERE tenant_id='$DEMO_TENANT_ID'),
  'reports',(SELECT count(*) FROM report_definitions WHERE tenant_id='$DEMO_TENANT_ID'),
  'report_generations',(SELECT count(*) FROM report_generations WHERE tenant_id='$DEMO_TENANT_ID'),
  'surveys',(SELECT count(*) FROM survey_definitions WHERE tenant_id='$DEMO_TENANT_ID'),
  'assurance',(SELECT count(*) FROM assurance_test_definitions WHERE tenant_id='$DEMO_TENANT_ID'),
  'losses',(SELECT count(*) FROM loss_events WHERE tenant_id='$DEMO_TENANT_ID'))")"
semantic_allowed="$(run_psql -Atqc "SELECT count(*) FROM v_commercial_tenant_capabilities WHERE tenant_id='$DEMO_TENANT_ID' AND capability_key='data.semantic_layer' AND enabled=true")"
user_roles_count="$(run_psql -Atqc "SELECT count(*) FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE tenant_id='$DEMO_TENANT_ID')")"
rbac_check="$(run_psql -Atqc "SELECT jsonb_build_object('admin_semantic_manage',user_has_permission((SELECT id FROM users WHERE email='admin.demo@tcdx.demo'),'semantic.contracts.manage'),'auditor_semantic_read',user_has_permission((SELECT id FROM users WHERE email='auditor.demo@tcdx.demo'),'semantic.contracts.read'),'auditor_semantic_manage',user_has_permission((SELECT id FROM users WHERE email='auditor.demo@tcdx.demo'),'semantic.contracts.manage'))")"
tenant_b_count="$(run_psql -Atqc "INSERT INTO tenants (id,name,rut,service_status) VALUES ('$TENANT_B_ID','Tenant B Fixture','FIXTURE-B','active') ON CONFLICT (id) DO NOTHING; SELECT count(*) FROM metric_measurements WHERE tenant_id='$TENANT_B_ID'")"
tenant_ai_plan="$(run_psql -Atqc "SELECT ai_plan FROM tenants WHERE id='$DEMO_TENANT_ID'")"
ledger_state="$(run_psql -Atqc "SELECT status || ':' || checksum FROM schema_migrations WHERE migration_id='20260803_demo_tenant_iso_grc'")"

[[ "$semantic_allowed" -ge 1 ]] || { echo "data.semantic_layer is not enabled" >&2; exit 1; }
[[ "$user_roles_count" -ge 2 ]] || { echo "Demo users have no real user_roles assignments" >&2; exit 1; }
[[ "$rbac_check" == '{"admin_semantic_manage": true, "auditor_semantic_read": true, "auditor_semantic_manage": false}' ]] || { echo "Demo RBAC contract failed: $rbac_check" >&2; exit 1; }
[[ "$tenant_b_count" == "0" ]] || { echo "Tenant B saw demo measurements" >&2; exit 1; }
[[ "$tenant_ai_plan" == "enterprise" ]] || { echo "Demo tenant ai_plan is not enterprise: $tenant_ai_plan" >&2; exit 1; }
[[ "$ledger_state" == "applied:$demo_checksum" ]] || { echo "Retry from failed did not converge to applied checksum: $ledger_state" >&2; exit 1; }
grep -q "Demo tenant migration dry-run OK: rollback=verified" "$RUN_DIR/dry-run-2.txt" || { echo "Demo dry-run did not verify rollback" >&2; exit 1; }
grep -q "Demo tenant migration applied: 20260803_demo_tenant_iso_grc" "$RUN_DIR/apply-1.txt" || { echo "First demo apply did not execute migration from failed ledger" >&2; exit 1; }
grep -q "Demo tenant migration applied: already_applied" "$RUN_DIR/apply-2.txt" || { echo "Second demo apply was not already_applied" >&2; exit 1; }

hash_check="$(MIGRATION_DATABASE_URL="$DATABASE_URL" node -e "const {Client}=require('./backend/node_modules/pg'); const bcrypt=require('./backend/node_modules/bcrypt'); (async()=>{const c=new Client({connectionString:process.env.MIGRATION_DATABASE_URL}); await c.connect(); const r=await c.query(\"SELECT password_hash FROM users WHERE tenant_id='${DEMO_TENANT_ID}'::uuid ORDER BY email\"); const p=Buffer.from('RGVtby4xMjM0NTY=','base64').toString('utf8'); const checks=[]; for (const row of r.rows) checks.push(await bcrypt.compare(p,row.password_hash)); await c.end(); process.stdout.write(JSON.stringify({users:r.rowCount,bcrypt:checks.every(Boolean)}));})().catch(e=>{process.stderr.write(e.message);process.exit(1);})")"
[[ "$hash_check" == '{"users":2,"bcrypt":true}' ]] || { echo "Bcrypt compatibility failed: $hash_check" >&2; exit 1; }

auth_check="$(DB_HOST=127.0.0.1 DB_PORT="$PORT" DB_USER=postgres DB_NAME="$DATABASE_NAME" JWT_SECRET=demo-check-secret node -e "const jwt=require('./backend/node_modules/jsonwebtoken'); const { login }=require('./backend/src/services/auth.service'); (async()=>{const p=Buffer.from('RGVtby4xMjM0NTY=','base64').toString('utf8'); const admin=await login('admin.demo@tcdx.demo',p); const auditor=await login('auditor.demo@tcdx.demo',p); const decoded=[jwt.decode(admin),jwt.decode(auditor)]; process.stdout.write(JSON.stringify({tokens:decoded.length,tenant_match:decoded.every(d=>d.tenant_id==='${DEMO_TENANT_ID}'),roles:decoded.map(d=>d.role).sort()})); process.exit(0);})().catch(e=>{process.stderr.write(e.message);process.exit(1);})")"
[[ "$auth_check" == '{"tokens":2,"tenant_match":true,"roles":["admin","auditor"]}' ]] || { echo "Auth service login failed: $auth_check" >&2; exit 1; }

if [[ "${DEMO_VISUAL_COMPLETION_CHECK:-0}" == "1" ]]; then
  VISUAL_ATTESTATION_FILE="$RUN_DIR/visual-completion-attestation.json"
  run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260506_iso_operational_execution.sql" >/dev/null
  run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/tests/fixtures/demo-visual-legacy-schema.sql" >/dev/null
  run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260522_tenant_applicability_universe.sql" >/dev/null
  run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260623_create_control_soa_assessments.sql" >/dev/null
  run_psql -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/migrations/20260616_operational_risk_montecarlo.sql" >/dev/null

  visual_checksum="$(node "$REPO_ROOT/scripts/demo/apply-demo-visual-completion.js" --checksum | awk -F= '/^20260803_demo_tenant_visual_completion checksum=/ {print $2}')"
  run_psql -v ON_ERROR_STOP=1 -c "
    INSERT INTO schema_migrations (migration_id,checksum,applied_by,duration_ms,status,details)
    VALUES ('20260803_demo_tenant_visual_completion',repeat('e',64),current_user,1,'failed','{\"fixture\":\"failed-retry\"}'::jsonb)
    ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,status='failed',details=EXCLUDED.details;
  " >/dev/null

  if MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_VISUAL_ATTESTATION_FILE="$VISUAL_ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-visual-completion.js" --apply >"$RUN_DIR/visual-missing-dry-run.txt" 2>&1; then
    echo "Visual completion apply unexpectedly ran without dry-run" >&2
    exit 1
  fi
  grep -q "dry-run attestation is missing" "$RUN_DIR/visual-missing-dry-run.txt" || { echo "Visual completion did not explain the missing attestation" >&2; exit 1; }

  MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_VISUAL_ATTESTATION_FILE="$VISUAL_ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-visual-completion.js" --preflight >"$RUN_DIR/visual-preflight.txt"
  MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_VISUAL_ATTESTATION_FILE="$VISUAL_ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-visual-completion.js" --dry-run >"$RUN_DIR/visual-dry-run.txt"
  dry_run_visual_count="$(run_psql -Atqc "SELECT count(*) FROM control_health_scores WHERE tenant_id='$DEMO_TENANT_ID'")"
  [[ "$dry_run_visual_count" == "0" ]] || { echo "Visual completion dry-run did not roll back: $dry_run_visual_count" >&2; exit 1; }

  MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_VISUAL_ATTESTATION_FILE="$VISUAL_ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-visual-completion.js" --apply >"$RUN_DIR/visual-apply-1.txt"
  MIGRATION_DATABASE_URL="$DATABASE_URL" DEMO_VISUAL_ATTESTATION_FILE="$VISUAL_ATTESTATION_FILE" node "$REPO_ROOT/scripts/demo/apply-demo-visual-completion.js" --apply >"$RUN_DIR/visual-apply-2.txt"

  visual_counts="$(run_psql -Atqc "SELECT jsonb_build_object(
    'applicable_controls',(SELECT count(*) FROM tenant_applicable_controls WHERE tenant_id='$DEMO_TENANT_ID'),
    'control_health',(SELECT count(*) FROM control_health_scores WHERE tenant_id='$DEMO_TENANT_ID'),
    'kpi_points',(SELECT count(*) FROM kpi_snapshots WHERE tenant_id='$DEMO_TENANT_ID'),
    'audit_workpapers',(SELECT count(*) FROM grc_audit_workpapers WHERE tenant_id='$DEMO_TENANT_ID'),
    'incidents',(SELECT count(*) FROM grc_incidents WHERE tenant_id='$DEMO_TENANT_ID'),
    'incident_events',(SELECT count(*) FROM grc_incident_timeline WHERE tenant_id='$DEMO_TENANT_ID'),
    'connector_runs',(SELECT count(*) FROM grc_connector_runs WHERE tenant_id='$DEMO_TENANT_ID'),
    'services',(SELECT count(*) FROM grc_operational_services WHERE tenant_id='$DEMO_TENANT_ID'),
    'continuity_tests',(SELECT count(*) FROM grc_continuity_tests WHERE tenant_id='$DEMO_TENANT_ID'),
    'quality_assessments',(SELECT count(*) FROM data_quality_assessments WHERE tenant_id='$DEMO_TENANT_ID'),
    'survey_answers',(SELECT count(*) FROM survey_response_items WHERE tenant_id='$DEMO_TENANT_ID'),
    'assurance_samples',(SELECT count(*) FROM assurance_test_samples WHERE tenant_id='$DEMO_TENANT_ID'),
    'operational_suggestions',(SELECT count(*) FROM iso_operational_suggestions WHERE tenant_id='$DEMO_TENANT_ID'),
    'report_exports',(SELECT count(*) FROM report_exports WHERE tenant_id='$DEMO_TENANT_ID'),
    'iso_risks',(SELECT count(*) FROM iso_risk_matrix_items WHERE tenant_id='$DEMO_TENANT_ID'),
    'risk_simulations',(SELECT count(*) FROM operational_risk_simulations WHERE tenant_id='$DEMO_TENANT_ID'))")"
  visual_ledger="$(run_psql -Atqc "SELECT status||':'||checksum FROM schema_migrations WHERE migration_id='20260803_demo_tenant_visual_completion'")"
  foreign_visual_rows="$(run_psql -Atqc "SELECT (SELECT count(*) FROM control_health_scores WHERE tenant_id='$TENANT_B_ID')+(SELECT count(*) FROM kpi_snapshots WHERE tenant_id='$TENANT_B_ID')+(SELECT count(*) FROM grc_incidents WHERE tenant_id='$TENANT_B_ID')")"
  [[ "$visual_ledger" == "applied:$visual_checksum" ]] || { echo "Visual completion ledger mismatch: $visual_ledger" >&2; exit 1; }
  [[ "$foreign_visual_rows" == "0" ]] || { echo "Visual completion affected Tenant B: $foreign_visual_rows" >&2; exit 1; }
  grep -q "Visual completion dry-run OK rollback=verified" "$RUN_DIR/visual-dry-run.txt" || { echo "Visual completion dry-run did not attest rollback" >&2; exit 1; }
  grep -q "Visual completion applied: 20260803_demo_tenant_visual_completion" "$RUN_DIR/visual-apply-1.txt" || { echo "Visual completion did not retry from failed" >&2; exit 1; }
  grep -q "Visual completion apply: already_applied" "$RUN_DIR/visual-apply-2.txt" || { echo "Visual completion second apply was not idempotent" >&2; exit 1; }
  printf '{"status":"VERIFIED_DEMO_VISUAL_POSTGRES","postgres":"16-alpine","counts":%s,"tenant_isolation":"verified","preflight":"verified","dry_run_rollback":"verified","idempotence":"verified","failed_retry":"verified"}\n' "$visual_counts"
  exit 0
fi

MIGRATION_DATABASE_URL="$DATABASE_URL" node "$REPO_ROOT/scripts/demo/remove-demo-tenant.js" >"$RUN_DIR/remove.txt"
removed_count="$(run_psql -Atqc "SELECT count(*) FROM tenants WHERE id='$DEMO_TENANT_ID'")"
tenant_b_remaining="$(run_psql -Atqc "SELECT count(*) FROM tenants WHERE id='$TENANT_B_ID'")"
[[ "$removed_count" == "0" ]] || { echo "Demo tenant removal failed" >&2; exit 1; }
[[ "$tenant_b_remaining" == "1" ]] || { echo "Demo removal affected Tenant B" >&2; exit 1; }
MIGRATION_DATABASE_URL="$DATABASE_URL" node "$REPO_ROOT/scripts/demo/remove-demo-tenant.js" >"$RUN_DIR/remove-again.txt"
grep -q "demo_tenant_remove=not_found" "$RUN_DIR/remove-again.txt" || { echo "Demo removal is not idempotent when tenant is absent" >&2; exit 1; }

printf '{"status":"VERIFIED_DEMO_TENANT_POSTGRES","postgres":"16-alpine","constraints":["tenants_ai_plan_check","chk_tenant_standards_catalog_mode","chk_controls_catalog_source_type","chk_findings_type","chk_findings_status","chk_action_plans_status"],"ai_plan":"%s","catalog_mode":"mixed","ledger_columns":"%s","counts":%s,"semantic_allowed":%s,"user_roles":%s,"rbac":%s,"tenant_b_measurements":%s,"bcrypt":"verified","auth_login":"verified","preflight":"verified","apply_without_dry_run":"blocked","dry_run_rollback":"verified","schema_signature_guard":"verified","idempotence":"verified","failed_retry":"verified","removal":"verified"}\n' "$tenant_ai_plan" "$ledger_columns" "$counts" "$semantic_allowed" "$user_roles_count" "$rbac_check" "$tenant_b_count"
