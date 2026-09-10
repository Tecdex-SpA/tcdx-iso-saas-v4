-- TCDX SaaSv2 runtime schema + privilege closeout.
-- Forward-only, idempotent, zero-legacy: no tenant/customer/demo data.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090901) THEN
    RAISE EXCEPTION 'TCDX SaaSv2 runtime closeout lock unavailable';
  END IF;
END $$;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'tenants'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%service_status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tenants DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE tenants
    ADD CONSTRAINT tenants_service_status_runtime_check
    CHECK (service_status IN ('active','trialing','past_due','suspended','suspended_non_payment','deleted','cancelled'));
END $$;

ALTER TABLE standards
  ADD COLUMN IF NOT EXISTS code text GENERATED ALWAYS AS (standard_code) STORED,
  ADD COLUMN IF NOT EXISTS name text GENERATED ALWAYS AS (display_name) STORED;

ALTER TABLE commercial_plan_versions
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE saas_modules
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS commercial_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO commercial_addons (addon_key, display_name, description, status, metadata)
VALUES (
  'ai',
  'AI',
  'Commercial add-on for tenant-scoped AI capabilities.',
  'active',
  '{"commercial_model":"base_plan_plus_addon","authority":"tenant_subscription_addons"}'::jsonb
)
ON CONFLICT (addon_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  metadata = commercial_addons.metadata || EXCLUDED.metadata,
  updated_at = now();

ALTER TABLE tenant_subscriptions
  ADD COLUMN IF NOT EXISTS plan_version_id uuid REFERENCES commercial_plan_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE tenant_subscriptions
SET started_at = COALESCE(started_at, starts_at, created_at, now()),
    ended_at = COALESCE(ended_at, expires_at),
    plan_version_id = COALESCE(
      plan_version_id,
      (
        SELECT cpv.id
        FROM commercial_plan_versions cpv
        WHERE cpv.plan_key = tenant_subscriptions.plan_key
          AND cpv.status = 'published'
        ORDER BY cpv.version_number DESC, cpv.published_at DESC NULLS LAST, cpv.created_at DESC
        LIMIT 1
      )
    );

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'tenant_subscriptions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tenant_subscriptions DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_status_runtime_check
    CHECK (status IN ('active','trialing','past_due','suspended','cancelled','expired','replaced'));
END $$;

ALTER TABLE tenant_subscription_addons
  ADD COLUMN IF NOT EXISTS tenant_subscription_id uuid REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE tenant_subscription_addons
SET started_at = COALESCE(started_at, starts_at, created_at, now()),
    ended_at = COALESCE(ended_at, expires_at),
    tenant_subscription_id = COALESCE(
      tenant_subscription_id,
      (
        SELECT ts.id
        FROM tenant_subscriptions ts
        WHERE ts.tenant_id = tenant_subscription_addons.tenant_id
          AND ts.status IN ('active','trialing','past_due','suspended')
        ORDER BY COALESCE(ts.started_at, ts.starts_at, ts.created_at) DESC, ts.created_at DESC
        LIMIT 1
      )
    );

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'tenant_subscription_addons'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tenant_subscription_addons DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE tenant_subscription_addons
    ADD CONSTRAINT tenant_subscription_addons_status_runtime_check
    CHECK (status IN ('active','inactive','suspended','expired','cancelled'));
END $$;

ALTER TABLE tenant_operations
  ADD COLUMN IF NOT EXISTS process_id uuid,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE tenant_operations
  ALTER COLUMN operation_key SET DEFAULT ('operation-' || replace(gen_random_uuid()::text, '-', ''));

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS iso text REFERENCES standards(standard_code),
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE assets
  ALTER COLUMN asset_key SET DEFAULT ('asset-' || replace(gen_random_uuid()::text, '-', ''));

CREATE TABLE IF NOT EXISTS asset_standards (
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, standard_code)
);

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS iso text REFERENCES standards(standard_code),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS auditor_type text,
  ADD COLUMN IF NOT EXISTS auditor_name text,
  ADD COLUMN IF NOT EXISTS report_file text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE audits
  ALTER COLUMN audit_key SET DEFAULT ('audit-' || replace(gen_random_uuid()::text, '-', ''));

UPDATE audits
SET iso = COALESCE(iso, standard_code),
    start_date = COALESCE(start_date, starts_at::date),
    end_date = COALESCE(end_date, ends_at::date);

CREATE TABLE IF NOT EXISTS tenant_standard_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  operation_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, standard_code, operation_id),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_runtime_tso_standard_same_tenant
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_runtime_tso_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  risk text NOT NULL,
  impact text,
  probability text,
  level text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_risk_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL,
  version_code text NOT NULL,
  risk_code text NOT NULL,
  risk_title text NOT NULL,
  risk_description text,
  risk_category text,
  likelihood integer NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact integer NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  treatment_strategy text NOT NULL DEFAULT 'mitigar',
  suggested_controls text[] NOT NULL DEFAULT '{}',
  suggested_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_expectations jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (standard_code, version_code, risk_code)
);

CREATE TABLE IF NOT EXISTS iso_risk_matrix_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  source_assessment_id uuid,
  run_type text NOT NULL DEFAULT 'automated',
  run_status text NOT NULL DEFAULT 'completed',
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  certifiable_version boolean NOT NULL DEFAULT false,
  coverage_warning text,
  total_assets integer NOT NULL DEFAULT 0,
  total_risk_templates integer NOT NULL DEFAULT 0,
  suggested_risks_count integer NOT NULL DEFAULT 0,
  accepted_risks_count integer NOT NULL DEFAULT 0,
  rejected_risks_count integer NOT NULL DEFAULT 0,
  critical_risks_count integer NOT NULL DEFAULT 0,
  high_risks_count integer NOT NULL DEFAULT 0,
  medium_risks_count integer NOT NULL DEFAULT 0,
  low_risks_count integer NOT NULL DEFAULT 0,
  inherent_risk_avg numeric NOT NULL DEFAULT 0,
  residual_risk_avg numeric NOT NULL DEFAULT 0,
  risk_posture text,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (run_type IN ('automated', 'manual_review', 'transition_readiness', 'asset_based')),
  CHECK (run_status IN ('draft', 'completed', 'reviewed', 'archived', 'error'))
);

CREATE TABLE IF NOT EXISTS iso_risk_matrix_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  risk_template_id uuid REFERENCES iso_risk_templates(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  iso_control_id uuid REFERENCES iso_controls(id) ON DELETE SET NULL,
  catalog_control_id uuid REFERENCES controls_catalog(id) ON DELETE SET NULL,
  tenant_control_id uuid REFERENCES tenant_controls(id) ON DELETE SET NULL,
  source_assessment_id uuid,
  source_gap_id uuid,
  risk_code text,
  risk_title text NOT NULL,
  risk_description text,
  risk_category text,
  asset_name text,
  asset_type text,
  asset_criticality text,
  likelihood integer NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact integer NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  inherent_risk_score integer NOT NULL DEFAULT 9,
  inherent_risk_level text NOT NULL DEFAULT 'medio' CHECK (inherent_risk_level IN ('bajo','medio','alto','critico')),
  control_effectiveness_score numeric NOT NULL DEFAULT 0,
  residual_likelihood integer NOT NULL DEFAULT 3 CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact integer NOT NULL DEFAULT 3 CHECK (residual_impact BETWEEN 1 AND 5),
  residual_risk_score integer NOT NULL DEFAULT 9,
  residual_risk_level text NOT NULL DEFAULT 'medio' CHECK (residual_risk_level IN ('bajo','medio','alto','critico')),
  treatment_strategy text NOT NULL DEFAULT 'mitigar',
  suggested_controls text[] NOT NULL DEFAULT '{}',
  suggested_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_expectations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','rejected','needs_review','archived')),
  confidence numeric NOT NULL DEFAULT 0.75 CHECK (confidence >= 0 AND confidence <= 1),
  source_type text NOT NULL DEFAULT 'risk_template',
  source_trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_risk_matrix_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE,
  risk_item_id uuid NOT NULL REFERENCES iso_risk_matrix_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_title text NOT NULL,
  action_description text,
  suggested_owner_role text,
  suggested_due_days integer NOT NULL DEFAULT 30,
  priority text NOT NULL DEFAULT 'media',
  action_type text NOT NULL DEFAULT 'risk_treatment',
  creates_action_plan_candidate boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'suggested',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_risk_matrix_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES iso_risk_matrix_runs(id) ON DELETE SET NULL,
  risk_item_id uuid REFERENCES iso_risk_matrix_items(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  old_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_runs'::regclass AND conname = 'uq_iso_risk_matrix_runs_tenant_id_id') THEN
    ALTER TABLE iso_risk_matrix_runs ADD CONSTRAINT uq_iso_risk_matrix_runs_tenant_id_id UNIQUE (tenant_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_items'::regclass AND conname = 'uq_iso_risk_matrix_items_tenant_id_id') THEN
    ALTER TABLE iso_risk_matrix_items ADD CONSTRAINT uq_iso_risk_matrix_items_tenant_id_id UNIQUE (tenant_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_actions'::regclass AND conname = 'uq_iso_risk_matrix_actions_tenant_id_id') THEN
    ALTER TABLE iso_risk_matrix_actions ADD CONSTRAINT uq_iso_risk_matrix_actions_tenant_id_id UNIQUE (tenant_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_items'::regclass AND conname = 'fk_iso_risk_matrix_items_run_same_tenant') THEN
    ALTER TABLE iso_risk_matrix_items ADD CONSTRAINT fk_iso_risk_matrix_items_run_same_tenant
      FOREIGN KEY (tenant_id, run_id) REFERENCES iso_risk_matrix_runs(tenant_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_items'::regclass AND conname = 'fk_iso_risk_matrix_items_asset_same_tenant') THEN
    ALTER TABLE iso_risk_matrix_items ADD CONSTRAINT fk_iso_risk_matrix_items_asset_same_tenant
      FOREIGN KEY (tenant_id, asset_id) REFERENCES assets(tenant_id, id) ON DELETE SET NULL (asset_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_items'::regclass AND conname = 'fk_iso_risk_matrix_items_tenant_control_same_tenant') THEN
    ALTER TABLE iso_risk_matrix_items ADD CONSTRAINT fk_iso_risk_matrix_items_tenant_control_same_tenant
      FOREIGN KEY (tenant_id, tenant_control_id) REFERENCES tenant_controls(tenant_id, id) ON DELETE SET NULL (tenant_control_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_actions'::regclass AND conname = 'fk_iso_risk_matrix_actions_run_same_tenant') THEN
    ALTER TABLE iso_risk_matrix_actions ADD CONSTRAINT fk_iso_risk_matrix_actions_run_same_tenant
      FOREIGN KEY (tenant_id, run_id) REFERENCES iso_risk_matrix_runs(tenant_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_actions'::regclass AND conname = 'fk_iso_risk_matrix_actions_item_same_tenant') THEN
    ALTER TABLE iso_risk_matrix_actions ADD CONSTRAINT fk_iso_risk_matrix_actions_item_same_tenant
      FOREIGN KEY (tenant_id, risk_item_id) REFERENCES iso_risk_matrix_items(tenant_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_audit_log'::regclass AND conname = 'fk_iso_risk_matrix_audit_run_same_tenant') THEN
    ALTER TABLE iso_risk_matrix_audit_log ADD CONSTRAINT fk_iso_risk_matrix_audit_run_same_tenant
      FOREIGN KEY (tenant_id, run_id) REFERENCES iso_risk_matrix_runs(tenant_id, id) ON DELETE SET NULL (run_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'iso_risk_matrix_audit_log'::regclass AND conname = 'fk_iso_risk_matrix_audit_item_same_tenant') THEN
    ALTER TABLE iso_risk_matrix_audit_log ADD CONSTRAINT fk_iso_risk_matrix_audit_item_same_tenant
      FOREIGN KEY (tenant_id, risk_item_id) REFERENCES iso_risk_matrix_items(tenant_id, id) ON DELETE SET NULL (risk_item_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_standard_operations_tenant_standard ON tenant_standard_operations(tenant_id, standard_code);
CREATE INDEX IF NOT EXISTS idx_tenant_standard_operations_operation ON tenant_standard_operations(tenant_id, operation_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_iso ON assets(tenant_id, iso);
CREATE INDEX IF NOT EXISTS idx_asset_risks_asset ON asset_risks(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_standards_standard ON asset_standards(standard_code);
CREATE INDEX IF NOT EXISTS idx_audits_tenant_iso ON audits(tenant_id, iso);
CREATE INDEX IF NOT EXISTS idx_iso_risk_templates_standard ON iso_risk_templates(standard_code, version_code);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_runs_tenant_standard ON iso_risk_matrix_runs(tenant_id, standard_code, version_code);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_runs_tenant_created ON iso_risk_matrix_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_run ON iso_risk_matrix_items(run_id);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_tenant_standard ON iso_risk_matrix_items(tenant_id, standard_code, version_code);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_tenant_level ON iso_risk_matrix_items(tenant_id, residual_risk_level);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_asset ON iso_risk_matrix_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_status ON iso_risk_matrix_items(status);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_actions_run ON iso_risk_matrix_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_actions_item ON iso_risk_matrix_actions(risk_item_id);
CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_audit_tenant_created ON iso_risk_matrix_audit_log(tenant_id, created_at DESC);

CREATE OR REPLACE VIEW public.v_iso_control_effective_health AS
WITH snapshot_candidates AS (
  SELECT
    ms.*,
    CASE
      WHEN ms.metadata->>'tenant_control_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (ms.metadata->>'tenant_control_id')::uuid
      WHEN ms.snapshot_payload->>'tenant_control_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (ms.snapshot_payload->>'tenant_control_id')::uuid
      ELSE NULL::uuid
    END AS snapshot_tenant_control_id
  FROM metric_snapshots ms
  WHERE ms.tenant_id IS NOT NULL
    AND ms.snapshot_status = 'published'
    AND ms.metric_code = 'F5_5_CONTROL_EFFECTIVENESS'
),
latest_control_snapshot AS (
  SELECT DISTINCT ON (tenant_id, snapshot_tenant_control_id)
    tenant_id,
    snapshot_tenant_control_id AS tenant_control_id,
    metric_code,
    numeric_value,
    publication_state,
    coverage,
    effective_at,
    published_at,
    metadata,
    snapshot_payload
  FROM snapshot_candidates
  WHERE snapshot_tenant_control_id IS NOT NULL
  ORDER BY tenant_id, snapshot_tenant_control_id, effective_at DESC, created_at DESC
),
evidence_stats AS (
  SELECT
    tenant_id,
    tenant_control_id,
    COUNT(*)::int AS evidence_count,
    COUNT(*) FILTER (WHERE lower(COALESCE(status, '')) IN ('aprobada','aprobado','approved','validada','validated'))::int AS approved_evidence_count,
    COUNT(*) FILTER (WHERE validated IS TRUE OR lower(COALESCE(status, '')) IN ('aprobada','aprobado','approved','validada','validated'))::int AS official_evidence_count,
    COUNT(*) FILTER (WHERE lower(COALESCE(status, '')) IN ('pendiente','pending','draft'))::int AS pending_evidence_count,
    COUNT(*) FILTER (WHERE lower(COALESCE(status, '')) IN ('rechazada','rechazado','rejected'))::int AS rejected_evidence_count
  FROM evidences
  WHERE tenant_control_id IS NOT NULL
  GROUP BY tenant_id, tenant_control_id
),
finding_stats AS (
  SELECT
    tenant_id,
    tenant_control_id,
    COUNT(*) FILTER (WHERE closed_at IS NULL AND lower(COALESCE(status, 'open')) NOT IN ('cerrado','closed','resuelto','resolved'))::int AS open_findings_count
  FROM findings
  WHERE tenant_control_id IS NOT NULL
  GROUP BY tenant_id, tenant_control_id
),
nonconformity_stats AS (
  SELECT
    tenant_id,
    tenant_control_id,
    COUNT(*) FILTER (WHERE resolved_at IS NULL AND lower(COALESCE(status, 'open')) NOT IN ('cerrada','closed','resuelta','resolved'))::int AS open_nonconformities_count
  FROM tenant_nonconformities
  WHERE tenant_control_id IS NOT NULL
  GROUP BY tenant_id, tenant_control_id
),
action_stats AS (
  SELECT
    tenant_id,
    tenant_control_id,
    COUNT(*) FILTER (WHERE lower(COALESCE(status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado'))::int AS open_action_plans_count,
    COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE AND lower(COALESCE(status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado'))::int AS overdue_action_plans_count
  FROM action_plans
  WHERE tenant_control_id IS NOT NULL
  GROUP BY tenant_id, tenant_control_id
),
risk_stats AS (
  SELECT
    rcr.tenant_id,
    rcr.tenant_control_id,
    COUNT(DISTINCT r.id) FILTER (
      WHERE lower(COALESCE(r.status, 'open')) NOT IN ('closed','cerrado','archived','rejected')
        AND (COALESCE(r.inherent_score, 0) >= 15 OR COALESCE(r.residual_score, 0) >= 15)
    )::int AS high_risks_count
  FROM risk_control_relations rcr
  JOIN risks r ON r.tenant_id = rcr.tenant_id AND r.id = rcr.risk_id
  GROUP BY rcr.tenant_id, rcr.tenant_control_id
)
SELECT
  tc.tenant_id,
  tc.id AS tenant_control_id,
  tc.control_id AS catalog_control_id,
  cc.code,
  cc.title,
  cc.iso AS standard_code,
  cc.iso,
  COALESCE(cc.clause, cc.code) AS clause,
  COALESCE(cc.description, cc.title, cc.code) AS control_description,
  CASE WHEN lcs.publication_state = 'measured' THEN lcs.numeric_value ELSE NULL::numeric END AS effective_health_score,
  CASE
    WHEN lcs.publication_state IS NULL THEN 'sin_datos'
    WHEN lcs.publication_state <> 'measured' THEN lcs.publication_state
    WHEN lcs.numeric_value IS NULL THEN 'sin_datos'
    WHEN lcs.numeric_value >= 80 THEN 'saludable'
    WHEN lcs.numeric_value >= 50 THEN 'atencion'
    ELSE 'deteriorado'
  END AS effective_health_status,
  CASE
    WHEN lcs.publication_state <> 'measured' OR lcs.numeric_value IS NULL THEN 'sin_datos'
    WHEN lcs.numeric_value >= 80 THEN 'alto'
    WHEN lcs.numeric_value >= 50 THEN 'medio'
    ELSE 'bajo'
  END AS compliance_bucket,
  CASE
    WHEN COALESCE(es.official_evidence_count, 0) > 0 THEN 'official'
    WHEN COALESCE(es.evidence_count, 0) > 0 THEN 'available'
    ELSE 'sin_datos'
  END AS evidence_quality_status,
  COALESCE(es.evidence_count, 0) AS evidence_count,
  COALESCE(es.approved_evidence_count, 0) AS approved_evidence_count,
  COALESCE(es.official_evidence_count, 0) AS official_evidence_count,
  COALESCE(es.pending_evidence_count, 0) AS pending_evidence_count,
  COALESCE(es.rejected_evidence_count, 0) AS rejected_evidence_count,
  COALESCE(fs.open_findings_count, 0) AS open_findings_count,
  COALESCE(ncs.open_nonconformities_count, 0) AS open_nonconformities_count,
  COALESCE(acs.open_action_plans_count, 0) AS open_action_plans_count,
  COALESCE(acs.overdue_action_plans_count, 0) AS overdue_action_plans_count,
  COALESCE(rs.high_risks_count, 0) AS high_risks_count,
  (
    lower(COALESCE(tc.status, 'active')) NOT IN ('deleted','archived')
    AND lower(COALESCE(op.status, 'active')) = 'active'
    AND COALESCE(op.is_active, true) IS TRUE
    AND COALESCE(ts.is_active, true) IS TRUE
  ) AS is_in_active_operational_scope,
  jsonb_build_object(
    'authority', 'metric_snapshots',
    'metric_code', lcs.metric_code,
    'publication_state', lcs.publication_state,
    'coverage', lcs.coverage,
    'effective_at', lcs.effective_at,
    'published_at', lcs.published_at
  ) AS health_trace_json,
  tc.operation_id,
  op.code AS operation_code,
  op.name AS operation_name,
  op.operation_type
FROM tenant_controls tc
JOIN controls_catalog cc ON cc.id = tc.control_id
LEFT JOIN tenant_operations op ON op.tenant_id = tc.tenant_id AND op.id = tc.operation_id
LEFT JOIN tenant_standards ts ON ts.tenant_id = tc.tenant_id AND ts.id = tc.tenant_standard_id
LEFT JOIN latest_control_snapshot lcs ON lcs.tenant_id = tc.tenant_id AND lcs.tenant_control_id = tc.id
LEFT JOIN evidence_stats es ON es.tenant_id = tc.tenant_id AND es.tenant_control_id = tc.id
LEFT JOIN finding_stats fs ON fs.tenant_id = tc.tenant_id AND fs.tenant_control_id = tc.id
LEFT JOIN nonconformity_stats ncs ON ncs.tenant_id = tc.tenant_id AND ncs.tenant_control_id = tc.id
LEFT JOIN action_stats acs ON acs.tenant_id = tc.tenant_id AND acs.tenant_control_id = tc.id
LEFT JOIN risk_stats rs ON rs.tenant_id = tc.tenant_id AND rs.tenant_control_id = tc.id;

CREATE OR REPLACE VIEW public.v_iso_risk_matrix_latest_runs AS
SELECT DISTINCT ON (tenant_id, standard_code, version_code)
  id AS run_id, tenant_id, standard_code, version_code, source_assessment_id,
  run_type, run_status, certifiable_version, coverage_warning, total_assets,
  total_risk_templates, suggested_risks_count, accepted_risks_count,
  rejected_risks_count, critical_risks_count, high_risks_count,
  medium_risks_count, low_risks_count, inherent_risk_avg, residual_risk_avg,
  risk_posture, summary_json, created_at, updated_at, completed_at
FROM iso_risk_matrix_runs
WHERE run_status IS DISTINCT FROM 'archived'
ORDER BY tenant_id, standard_code, version_code, created_at DESC;

CREATE OR REPLACE VIEW public.v_iso_risk_matrix_summary AS
SELECT
  r.tenant_id,
  r.standard_code,
  r.version_code,
  r.id AS run_id,
  COUNT(i.id)::integer AS total_risks,
  COUNT(i.id) FILTER (WHERE i.residual_risk_level = 'critico')::integer AS critical_risks,
  COUNT(i.id) FILTER (WHERE i.residual_risk_level = 'alto')::integer AS high_risks,
  COUNT(i.id) FILTER (WHERE i.residual_risk_level = 'medio')::integer AS medium_risks,
  COUNT(i.id) FILTER (WHERE i.residual_risk_level = 'bajo')::integer AS low_risks,
  COUNT(i.id) FILTER (WHERE i.status = 'accepted')::integer AS accepted_risks,
  COUNT(i.id) FILTER (WHERE i.status = 'suggested')::integer AS suggested_risks,
  COUNT(i.id) FILTER (WHERE i.status = 'needs_review')::integer AS needs_review_risks,
  ROUND(AVG(i.inherent_risk_score)::numeric, 2) AS inherent_risk_avg,
  ROUND(AVG(i.residual_risk_score)::numeric, 2) AS residual_risk_avg,
  r.risk_posture,
  r.created_at
FROM iso_risk_matrix_runs r
LEFT JOIN iso_risk_matrix_items i ON i.run_id = r.id
WHERE r.run_status IS DISTINCT FROM 'archived'
GROUP BY r.tenant_id, r.standard_code, r.version_code, r.id, r.risk_posture, r.created_at;

CREATE OR REPLACE VIEW public.v_iso_effective_kpi_summary AS
SELECT
  tenant_id,
  standard_code AS iso,
  standard_code,
  operation_id,
  operation_name,
  operation_code,
  operation_type,
  COUNT(*)::int AS total_controls,
  COUNT(*)::int AS controls_count,
  COUNT(*) FILTER (WHERE is_in_active_operational_scope IS TRUE)::int AS active_scope_controls,
  COUNT(*) FILTER (WHERE is_in_active_operational_scope IS NOT TRUE)::int AS out_of_scope_controls,
  COUNT(*) FILTER (WHERE effective_health_status = 'saludable')::int AS complies_controls,
  COUNT(*) FILTER (WHERE effective_health_status = 'atencion')::int AS partial_controls,
  COUNT(*) FILTER (WHERE effective_health_status IN ('deteriorado','sin_datos'))::int AS non_compliant_or_no_data_controls,
  COUNT(*) FILTER (WHERE effective_health_status = 'saludable')::int AS healthy_controls,
  COUNT(*) FILTER (WHERE effective_health_status = 'atencion')::int AS attention_controls,
  COUNT(*) FILTER (WHERE effective_health_status = 'deteriorado')::int AS deteriorated_controls,
  COUNT(*) FILTER (WHERE official_evidence_count > 0)::int AS controls_with_official_evidence,
  COUNT(*) FILTER (WHERE approved_evidence_count > 0 AND official_evidence_count = 0)::int AS controls_with_approved_non_official_evidence,
  COUNT(*) FILTER (WHERE evidence_count = 0)::int AS controls_without_evidence,
  SUM(approved_evidence_count)::int AS approved_evidence_count,
  SUM(official_evidence_count)::int AS official_evidence_count,
  SUM(open_findings_count)::int AS open_findings_count,
  SUM(open_nonconformities_count)::int AS open_nonconformities_count,
  SUM(open_action_plans_count)::int AS open_action_plans_count,
  SUM(overdue_action_plans_count)::int AS overdue_action_plans_count,
  AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) AS avg_effective_health_score,
  AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) AS effective_health_score,
  CASE
    WHEN COUNT(*) FILTER (WHERE is_in_active_operational_scope IS TRUE) = 0 THEN NULL::numeric
    ELSE ROUND((COUNT(*) FILTER (WHERE effective_health_status = 'saludable')::numeric / NULLIF(COUNT(*) FILTER (WHERE is_in_active_operational_scope IS TRUE), 0)) * 100, 2)
  END AS compliance_percentage,
  CASE
    WHEN COUNT(*) = 0 THEN NULL::numeric
    ELSE ROUND((COUNT(*) FILTER (WHERE official_evidence_count > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 2)
  END AS official_evidence_percentage,
  CASE
    WHEN AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) IS NULL THEN 'sin_datos'
    WHEN AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) >= 80 THEN 'saludable'
    WHEN AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) >= 50 THEN 'atencion'
    ELSE 'deteriorado'
  END AS kpi_health_status,
  CASE
    WHEN AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) IS NULL THEN 'sin_datos'
    WHEN AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) >= 80 THEN 'saludable'
    WHEN AVG(effective_health_score) FILTER (WHERE effective_health_score IS NOT NULL) >= 50 THEN 'atencion'
    ELSE 'deteriorado'
  END AS effective_health_status,
  jsonb_build_object('authority','v_iso_control_effective_health','metric_code','F5_5_CONTROL_EFFECTIVENESS') AS kpi_trace_json
FROM public.v_iso_control_effective_health
GROUP BY tenant_id, standard_code, operation_id, operation_name, operation_code, operation_type;

CREATE OR REPLACE VIEW public.v_commercial_tenant_subscription AS
WITH latest_plan_version AS (
  SELECT DISTINCT ON (plan_key)
    id, plan_key, version, version_number, effective_from, published_at
  FROM commercial_plan_versions
  WHERE status = 'published'
  ORDER BY plan_key, version_number DESC, published_at DESC NULLS LAST, created_at DESC
),
subscription_candidates AS (
  SELECT
    ts.*,
    COALESCE(ts.plan_version_id, lpv.id) AS effective_plan_version_id,
    COALESCE(ts.started_at, ts.starts_at) AS effective_started_at,
    COALESCE(ts.ended_at, ts.expires_at) AS effective_ended_at
  FROM tenant_subscriptions ts
  LEFT JOIN latest_plan_version lpv ON lpv.plan_key = ts.plan_key
  WHERE ts.status IN ('active','trialing','past_due','suspended')
)
SELECT DISTINCT ON (sc.tenant_id)
  sc.id, sc.tenant_id, sc.plan_key, sc.effective_plan_version_id AS plan_version_id,
  sc.status, sc.effective_started_at AS started_at, sc.effective_ended_at AS ended_at,
  sc.starts_at, sc.expires_at, sc.created_at, cp.display_name AS plan_display_name,
  COALESCE(cpv.version_number, lpv.version_number, 1) AS version_number,
  COALESCE(cpv.effective_from, lpv.effective_from) AS plan_effective_from,
  sc.metadata
FROM subscription_candidates sc
LEFT JOIN commercial_plans cp ON cp.plan_key = sc.plan_key
LEFT JOIN commercial_plan_versions cpv ON cpv.id = sc.effective_plan_version_id
LEFT JOIN latest_plan_version lpv ON lpv.plan_key = sc.plan_key
ORDER BY sc.tenant_id, sc.effective_started_at DESC, sc.created_at DESC;

CREATE OR REPLACE VIEW public.v_commercial_tenant_modules AS
SELECT DISTINCT
  vts.tenant_id, vts.plan_key, sm.module_key, sm.display_name, sm.description,
  sm.sort_order, COALESCE(tms.enabled, true) AS enabled, 'plan'::text AS source
FROM v_commercial_tenant_subscription vts
JOIN plan_version_capabilities pvc ON pvc.plan_version_id = vts.plan_version_id AND pvc.is_included = true
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = pvc.capability_key AND ctc.status = 'active' AND ctc.is_active = true
JOIN saas_modules sm ON sm.module_key = ctc.module_key AND sm.status = 'active' AND sm.is_active = true
LEFT JOIN tenant_module_settings tms ON tms.tenant_id = vts.tenant_id AND tms.module_key = sm.module_key
UNION
SELECT DISTINCT
  vts.tenant_id, vts.plan_key, sm.module_key, sm.display_name, sm.description,
  sm.sort_order, COALESCE(tms.enabled, true) AS enabled, 'addon'::text AS source
FROM v_commercial_tenant_subscription vts
JOIN tenant_subscription_addons tsa
  ON (tsa.tenant_subscription_id = vts.id OR (tsa.tenant_subscription_id IS NULL AND tsa.tenant_id = vts.tenant_id))
 AND tsa.status = 'active'
 AND (COALESCE(tsa.ended_at, tsa.expires_at) IS NULL OR COALESCE(tsa.ended_at, tsa.expires_at) > now())
JOIN commercial_technical_capabilities ctc ON tsa.addon_key = 'ai' AND ctc.capability_key LIKE 'ai.%' AND ctc.status = 'active' AND ctc.is_active = true
JOIN saas_modules sm ON sm.module_key = ctc.module_key AND sm.status = 'active' AND sm.is_active = true
LEFT JOIN tenant_module_settings tms ON tms.tenant_id = vts.tenant_id AND tms.module_key = sm.module_key;

CREATE OR REPLACE VIEW public.v_commercial_tenant_capabilities AS
SELECT DISTINCT
  vts.tenant_id, ctc.capability_key, ctc.required_permission, NULL::jsonb AS dependencies,
  true AS enabled, false AS read_only, 'plan'::text AS source,
  vts.started_at AS effective_from, vts.ended_at AS effective_until, ctc.module_key
FROM v_commercial_tenant_subscription vts
JOIN plan_version_capabilities pvc ON pvc.plan_version_id = vts.plan_version_id AND pvc.is_included = true
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = pvc.capability_key AND ctc.status = 'active' AND ctc.is_active = true
UNION
SELECT DISTINCT
  vts.tenant_id, ctc.capability_key, ctc.required_permission, NULL::jsonb AS dependencies,
  true AS enabled, false AS read_only, 'addon'::text AS source,
  COALESCE(tsa.started_at, tsa.starts_at) AS effective_from,
  COALESCE(tsa.ended_at, tsa.expires_at) AS effective_until,
  ctc.module_key
FROM v_commercial_tenant_subscription vts
JOIN tenant_subscription_addons tsa
  ON (tsa.tenant_subscription_id = vts.id OR (tsa.tenant_subscription_id IS NULL AND tsa.tenant_id = vts.tenant_id))
 AND tsa.status = 'active'
 AND (COALESCE(tsa.ended_at, tsa.expires_at) IS NULL OR COALESCE(tsa.ended_at, tsa.expires_at) > now())
JOIN commercial_technical_capabilities ctc ON tsa.addon_key = 'ai' AND ctc.capability_key LIKE 'ai.%' AND ctc.status = 'active' AND ctc.is_active = true;

CREATE OR REPLACE VIEW public.v_tenant_commercial_entitlements AS
SELECT * FROM public.v_commercial_tenant_capabilities;

CREATE OR REPLACE VIEW public.v_commercial_tenant_health AS
SELECT
  vts.tenant_id,
  jsonb_build_object(
    'status', CASE WHEN COUNT(vtc.capability_key) > 0 THEN 'healthy' ELSE 'attention' END,
    'score', CASE WHEN COUNT(vtc.capability_key) > 0 THEN 100 ELSE 50 END,
    'factors', jsonb_build_array(),
    'recommended_actions', jsonb_build_array(),
    'calculated_at', now()
  ) AS health
FROM public.v_commercial_tenant_subscription vts
LEFT JOIN public.v_commercial_tenant_capabilities vtc ON vtc.tenant_id = vts.tenant_id
GROUP BY vts.tenant_id;

GRANT SELECT ON public.v_iso_control_effective_health, public.v_iso_effective_kpi_summary,
  public.v_iso_risk_matrix_latest_runs, public.v_iso_risk_matrix_summary,
  public.v_commercial_tenant_subscription, public.v_commercial_tenant_modules,
  public.v_commercial_tenant_capabilities, public.v_tenant_commercial_entitlements,
  public.v_commercial_tenant_health TO tcdx_backend_runtime;
GRANT SELECT ON commercial_addons TO tcdx_backend_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_operations, tenant_standard_operations,
  assets, asset_standards, asset_risks, risks, risk_control_relations, audits,
  iso_risk_templates, iso_risk_matrix_runs, iso_risk_matrix_items,
  iso_risk_matrix_actions, iso_risk_matrix_audit_log TO tcdx_backend_runtime;

INSERT INTO schema_migrations (migration_id, checksum, applied_at, applied_by, duration_ms, status, details)
VALUES (
  '20260909_tcdx_saasv2_runtime_schema_privilege_closeout',
  repeat('0', 64),
  now(),
  current_user,
  0,
  'applied',
  '{"scope":"runtime_schema_privilege_closeout","zero_legacy":true}'::jsonb
)
ON CONFLICT (migration_id) DO UPDATE SET
  applied_at = EXCLUDED.applied_at,
  applied_by = EXCLUDED.applied_by,
  status = EXCLUDED.status,
  details = schema_migrations.details || EXCLUDED.details;

COMMIT;
