-- TCDX fresh baseline runtime dependency systemic closeout.
-- Purpose: align a clean fresh-baseline schema with active backend SQL
-- dependencies for commercially reachable runtime surfaces.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091007) THEN
    RAISE EXCEPTION 'fresh baseline runtime dependency systemic closeout lock unavailable';
  END IF;
END $$;

ALTER TABLE metric_calculation_policies
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  description text,
  href text,
  level text NOT NULL DEFAULT 'info',
  dedupe_key text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key),
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_unread
  ON notifications (tenant_id, is_read, updated_at DESC);

CREATE TABLE IF NOT EXISTS document_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_id uuid,
  integration_id uuid,
  provider text NOT NULL DEFAULT 'internal',
  provider_file_id text NOT NULL,
  provider_version_id text,
  file_name text,
  mime_type text,
  file_extension text,
  file_url text,
  web_view_url text,
  size_bytes bigint,
  checksum text,
  content_hash text,
  file_hash text,
  relative_path text,
  local_storage_path text,
  modified_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'indexed',
  processing_status text,
  analysis_status text,
  extracted_text text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, provider_file_id),
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_document_index_tenant_status
  ON document_index (tenant_id, status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_index_source
  ON document_index (tenant_id, source_id);

DO $$
BEGIN
  IF to_regclass('public.tenant_document_sources') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'uq_runtime_tenant_document_sources_tenant_id_id'
     ) THEN
    ALTER TABLE tenant_document_sources
      ADD CONSTRAINT uq_runtime_tenant_document_sources_tenant_id_id
      UNIQUE (tenant_id, id);
  END IF;

  IF to_regclass('public.tenant_integrations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'uq_runtime_tenant_integrations_tenant_id_id'
     ) THEN
    ALTER TABLE tenant_integrations
      ADD CONSTRAINT uq_runtime_tenant_integrations_tenant_id_id
      UNIQUE (tenant_id, id);
  END IF;

  IF to_regclass('public.tenant_document_sources') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'fk_runtime_document_index_source_same_tenant'
     ) THEN
    ALTER TABLE document_index
      ADD CONSTRAINT fk_runtime_document_index_source_same_tenant
      FOREIGN KEY (tenant_id, source_id)
      REFERENCES tenant_document_sources(tenant_id, id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF to_regclass('public.tenant_integrations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'fk_runtime_document_index_integration_same_tenant'
     ) THEN
    ALTER TABLE document_index
      ADD CONSTRAINT fk_runtime_document_index_integration_same_tenant
      FOREIGN KEY (tenant_id, integration_id)
      REFERENCES tenant_integrations(tenant_id, id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tenant_document_index_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_id uuid,
  document_index_id uuid,
  provider_file_id text NOT NULL,
  exclusion_scope text NOT NULL DEFAULT 'item',
  reason text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  excluded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  excluded_at timestamptz NOT NULL DEFAULT now(),
  restored_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  restored_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_runtime_document_index_exclusion_document_same_tenant
    FOREIGN KEY (tenant_id, document_index_id)
    REFERENCES document_index(tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_document_index_exclusions_active_provider_file
  ON tenant_document_index_exclusions (tenant_id, provider, provider_file_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS report_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'executive',
  default_format text NOT NULL DEFAULT 'pdf',
  template_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type_code text NOT NULL REFERENCES report_types(code) ON DELETE CASCADE,
  role_code text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_generate boolean NOT NULL DEFAULT true,
  can_schedule boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (report_type_code, role_code)
);

CREATE TABLE IF NOT EXISTS report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  report_type_code text NOT NULL REFERENCES report_types(code),
  report_title text NOT NULL,
  report_format text NOT NULL DEFAULT 'pdf',
  status text NOT NULL DEFAULT 'generated',
  file_url text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_report_exports_tenant_id
  ON report_exports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_report_type_code
  ON report_exports (report_type_code);
CREATE INDEX IF NOT EXISTS idx_report_exports_generated_at
  ON report_exports (generated_at DESC);

WITH runtime_report_types (
  code,
  name,
  description,
  category,
  default_format,
  template_key,
  sort_order,
  metadata
) AS (
  VALUES
    (
      'executive_iso_status',
      'Informe Ejecutivo de Estado ISO',
      'Resumen ejecutivo de health, brechas, riesgos, acciones y evidencias faltantes.',
      'executive',
      'pdf',
      'executive_premium',
      10,
      '{"source":"fresh_baseline_runtime_dependency_systemic_closeout","aliases":["executive_summary"]}'::jsonb
    ),
    (
      'maturity_gap_diagnostic',
      'Diagnostico de Madurez y Brechas',
      'Diagnostico de madurez, brechas de cumplimiento y plan recomendado.',
      'executive',
      'pdf',
      'maturity_gap_diagnostic_premium',
      20,
      '{"source":"fresh_baseline_runtime_dependency_systemic_closeout"}'::jsonb
    ),
    (
      'control_health_report',
      'Informe de Control Health',
      'Health por control desde F5_5_CONTROL_EFFECTIVENESS y trazas oficiales.',
      'operational',
      'pdf',
      'control_health_premium',
      30,
      '{"source":"fresh_baseline_runtime_dependency_systemic_closeout","aliases":["control_status"],"health_authority":"F5_5_CONTROL_EFFECTIVENESS"}'::jsonb
    ),
    (
      'iso_risk_report',
      'Informe de Riesgos ISO',
      'Riesgos por norma, controles relacionados y acciones de tratamiento.',
      'operational',
      'pdf',
      'iso_risk_premium',
      40,
      '{"source":"fresh_baseline_runtime_dependency_systemic_closeout"}'::jsonb
    ),
    (
      'action_plan_report',
      'Informe de Plan de Accion',
      'Estado de planes de accion, vencimientos, responsables y trazabilidad.',
      'operational',
      'pdf',
      'action_plan_premium',
      50,
      '{"source":"fresh_baseline_runtime_dependency_systemic_closeout"}'::jsonb
    ),
    (
      'internal_audit_report',
      'Informe de Auditoria Interna',
      'Auditorias, hallazgos, no conformidades, evidencias revisadas y cierre.',
      'audit',
      'pdf',
      'internal_audit_premium',
      60,
      '{"source":"fresh_baseline_runtime_dependency_systemic_closeout","aliases":["audit_report"]}'::jsonb
    ),
    (
      'platform_client_monthly',
      'Informe Mensual de Plataforma por Cliente',
      'Resumen mensual de uso y estado para administracion de plataforma.',
      'platform',
      'pdf',
      'executive_premium',
      90,
      '{"source":"fresh_baseline_runtime_dependency_systemic_closeout","platform_only":true}'::jsonb
    )
)
INSERT INTO report_types (
  code,
  name,
  description,
  category,
  default_format,
  template_key,
  is_active,
  sort_order,
  metadata
)
SELECT
  code,
  name,
  description,
  category,
  default_format,
  template_key,
  TRUE,
  sort_order,
  metadata
FROM runtime_report_types
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  default_format = EXCLUDED.default_format,
  template_key = EXCLUDED.template_key,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  metadata = report_types.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH runtime_report_access (
  report_type_code,
  role_code,
  can_view,
  can_generate,
  can_schedule
) AS (
  VALUES
    ('executive_iso_status', 'platform_admin', true, true, false),
    ('executive_iso_status', 'admin', true, true, false),
    ('executive_iso_status', 'manager', true, true, false),
    ('executive_iso_status', 'auditor', true, true, false),
    ('executive_iso_status', 'viewer', true, false, false),
    ('maturity_gap_diagnostic', 'platform_admin', true, true, false),
    ('maturity_gap_diagnostic', 'admin', true, true, false),
    ('maturity_gap_diagnostic', 'manager', true, true, false),
    ('maturity_gap_diagnostic', 'auditor', true, true, false),
    ('control_health_report', 'platform_admin', true, true, false),
    ('control_health_report', 'admin', true, true, false),
    ('control_health_report', 'manager', true, true, false),
    ('control_health_report', 'auditor', true, true, false),
    ('control_health_report', 'operativo', true, false, false),
    ('iso_risk_report', 'platform_admin', true, true, false),
    ('iso_risk_report', 'admin', true, true, false),
    ('iso_risk_report', 'manager', true, true, false),
    ('iso_risk_report', 'auditor', true, true, false),
    ('iso_risk_report', 'operativo', true, false, false),
    ('action_plan_report', 'platform_admin', true, true, false),
    ('action_plan_report', 'admin', true, true, false),
    ('action_plan_report', 'manager', true, true, false),
    ('action_plan_report', 'auditor', true, true, false),
    ('action_plan_report', 'operativo', true, false, false),
    ('internal_audit_report', 'platform_admin', true, true, false),
    ('internal_audit_report', 'admin', true, true, false),
    ('internal_audit_report', 'auditor', true, true, false),
    ('platform_client_monthly', 'platform_admin', true, true, false)
)
INSERT INTO report_access_rules (
  report_type_code,
  role_code,
  can_view,
  can_generate,
  can_schedule
)
SELECT
  report_type_code,
  role_code,
  can_view,
  can_generate,
  can_schedule
FROM runtime_report_access
ON CONFLICT (report_type_code, role_code) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_generate = EXCLUDED.can_generate,
  can_schedule = EXCLUDED.can_schedule;

CREATE TABLE IF NOT EXISTS iso_catalog_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL,
  version_code text NOT NULL,
  sync_target text NOT NULL,
  sync_status text NOT NULL DEFAULT 'not_started',
  synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (standard_code, version_code, sync_target)
);

CREATE TABLE IF NOT EXISTS iso_express_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  assessment_type text NOT NULL DEFAULT 'express',
  assessment_status text NOT NULL DEFAULT 'calculated',
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  certifiable_version boolean NOT NULL DEFAULT false,
  coverage_warning text,
  readiness_score numeric,
  readiness_level text,
  total_iso_controls integer NOT NULL DEFAULT 0,
  mapped_controls_count integer NOT NULL DEFAULT 0,
  evaluated_controls_count integer NOT NULL DEFAULT 0,
  controls_with_evidence_count integer NOT NULL DEFAULT 0,
  controls_without_evidence_count integer NOT NULL DEFAULT 0,
  gaps_count integer NOT NULL DEFAULT 0,
  critical_gaps_count integer NOT NULL DEFAULT 0,
  high_gaps_count integer NOT NULL DEFAULT 0,
  medium_gaps_count integer NOT NULL DEFAULT 0,
  low_gaps_count integer NOT NULL DEFAULT 0,
  risk_score numeric,
  maturity_score numeric,
  plan_30_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan_60_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan_90_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessments_tenant_standard
  ON iso_express_assessments (tenant_id, standard_code, version_code, created_at DESC);

CREATE TABLE IF NOT EXISTS iso_express_assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES iso_express_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  iso_control_id uuid,
  control_code text,
  control_title text,
  clause_code text,
  catalog_control_id uuid,
  tenant_control_id uuid,
  mapping_relationship_type text,
  mapping_confidence numeric,
  implementation_status text,
  health_status text,
  health_score numeric,
  evidence_count integer NOT NULL DEFAULT 0,
  approved_evidence_count integer NOT NULL DEFAULT 0,
  pending_evidence_count integer NOT NULL DEFAULT 0,
  rejected_evidence_count integer NOT NULL DEFAULT 0,
  has_expected_evidence boolean NOT NULL DEFAULT false,
  expected_evidence_count integer NOT NULL DEFAULT 0,
  evidence_gap boolean NOT NULL DEFAULT false,
  control_gap boolean NOT NULL DEFAULT false,
  risk_hint text,
  gap_severity text,
  recommendation text,
  item_score numeric,
  item_result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_express_items_assessment
  ON iso_express_assessment_items (assessment_id, clause_code, control_code);

CREATE TABLE IF NOT EXISTS iso_express_assessment_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES iso_express_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  iso_control_id uuid,
  control_code text,
  gap_type text,
  severity text,
  title text NOT NULL,
  description text,
  recommendation text,
  suggested_action_type text,
  suggested_owner_role text,
  suggested_due_days integer,
  source text NOT NULL DEFAULT 'diagnostic_engine',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_express_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES iso_express_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question_code text NOT NULL,
  question_text text,
  answer_value text,
  answer_score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_express_assessment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES iso_express_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_express_gaps_assessment
  ON iso_express_assessment_gaps (assessment_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iso_express_answers_assessment
  ON iso_express_assessment_answers (assessment_id, question_code);
CREATE INDEX IF NOT EXISTS idx_iso_express_audit_assessment
  ON iso_express_assessment_audit_log (tenant_id, assessment_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_iso_express_items_assessment_same_tenant'
  ) THEN
    ALTER TABLE iso_express_assessment_items
      ADD CONSTRAINT fk_iso_express_items_assessment_same_tenant
      FOREIGN KEY (tenant_id, assessment_id)
      REFERENCES iso_express_assessments(tenant_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_iso_express_gaps_assessment_same_tenant'
  ) THEN
    ALTER TABLE iso_express_assessment_gaps
      ADD CONSTRAINT fk_iso_express_gaps_assessment_same_tenant
      FOREIGN KEY (tenant_id, assessment_id)
      REFERENCES iso_express_assessments(tenant_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_iso_express_answers_assessment_same_tenant'
  ) THEN
    ALTER TABLE iso_express_assessment_answers
      ADD CONSTRAINT fk_iso_express_answers_assessment_same_tenant
      FOREIGN KEY (tenant_id, assessment_id)
      REFERENCES iso_express_assessments(tenant_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_iso_express_audit_assessment_same_tenant'
  ) THEN
    ALTER TABLE iso_express_assessment_audit_log
      ADD CONSTRAINT fk_iso_express_audit_assessment_same_tenant
      FOREIGN KEY (tenant_id, assessment_id)
      REFERENCES iso_express_assessments(tenant_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE iso_operational_suggestions
  ADD COLUMN IF NOT EXISTS standard_code text,
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_control_id uuid,
  ADD COLUMN IF NOT EXISTS source_module text,
  ADD COLUMN IF NOT EXISTS source_entity_type text,
  ADD COLUMN IF NOT EXISTS source_entity_id uuid,
  ADD COLUMN IF NOT EXISTS source_reason text,
  ADD COLUMN IF NOT EXISTS suggestion_type text NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS target_record_type text NOT NULL DEFAULT 'action_plan',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS suggested_owner text,
  ADD COLUMN IF NOT EXISTS suggested_due_date date,
  ADD COLUMN IF NOT EXISTS payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_trace_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_comment text,
  ADD COLUMN IF NOT EXISTS created_record_type text,
  ADD COLUMN IF NOT EXISTS created_record_id uuid;

UPDATE iso_operational_suggestions
SET
  dedupe_key = COALESCE(dedupe_key, suggestion_key),
  recommendation = COALESCE(recommendation, description, title)
WHERE dedupe_key IS NULL
   OR recommendation IS NULL;

ALTER TABLE iso_operational_suggestions
  ALTER COLUMN dedupe_key SET NOT NULL,
  ALTER COLUMN suggestion_key DROP NOT NULL,
  ALTER COLUMN source_type DROP NOT NULL,
  ALTER COLUMN recommendation DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_iso_operational_suggestions_runtime_dedupe
  ON iso_operational_suggestions (tenant_id, dedupe_key)
  WHERE status IN ('pending', 'approved', 'applied');

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_tenant_runtime
  ON iso_operational_suggestions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_standard_runtime
  ON iso_operational_suggestions (tenant_id, standard_code);
CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_status_runtime
  ON iso_operational_suggestions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_source_runtime
  ON iso_operational_suggestions (tenant_id, source_module, source_entity_type, source_entity_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_iso_operational_suggestions_tenant_id_id'
  ) THEN
    ALTER TABLE iso_operational_suggestions
      ADD CONSTRAINT uq_iso_operational_suggestions_tenant_id_id
      UNIQUE (tenant_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS iso_operational_suggestion_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  old_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestion_audit_tenant_created
  ON iso_operational_suggestion_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestion_audit_suggestion
  ON iso_operational_suggestion_audit_log (suggestion_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_iso_operational_suggestion_audit_same_tenant'
  ) THEN
    ALTER TABLE iso_operational_suggestion_audit_log
      ADD CONSTRAINT fk_iso_operational_suggestion_audit_same_tenant
      FOREIGN KEY (tenant_id, suggestion_id)
      REFERENCES iso_operational_suggestions(tenant_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE iso_recommended_action_conversions
  ADD COLUMN IF NOT EXISTS recommendation_id uuid,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS target_table text,
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS converted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz NOT NULL DEFAULT now();

UPDATE iso_recommended_action_conversions
SET
  recommendation_id = COALESCE(recommendation_id, suggestion_id),
  target_type = COALESCE(target_type, 'action_plan'),
  target_table = COALESCE(target_table, 'action_plans'),
  target_id = COALESCE(target_id, action_plan_id),
  converted_at = COALESCE(converted_at, updated_at, created_at, now())
WHERE recommendation_id IS NULL
   OR target_type IS NULL
   OR target_id IS NULL
   OR converted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'iso_recommended_action_conversions'
      AND column_name = 'recommendation_id'
  )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'fk_iso_recommended_action_conversions_recommendation_same_tenant'
     ) THEN
    ALTER TABLE iso_recommended_action_conversions
      ADD CONSTRAINT fk_iso_recommended_action_conversions_recommendation_same_tenant
      FOREIGN KEY (tenant_id, recommendation_id)
      REFERENCES iso_operational_suggestions(tenant_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_iso_recommended_action_conversions_runtime_target_type'
  ) THEN
    ALTER TABLE iso_recommended_action_conversions
      ADD CONSTRAINT chk_iso_recommended_action_conversions_runtime_target_type
      CHECK (
        target_type IS NULL OR target_type IN (
          'action_plan',
          'finding',
          'nonconformity',
          'evidence_request',
          'audit_task',
          'risk_mitigation',
          'control_review'
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_iso_recommended_action_conversions_runtime_status'
  ) THEN
    ALTER TABLE iso_recommended_action_conversions
      ADD CONSTRAINT chk_iso_recommended_action_conversions_runtime_status
      CHECK (conversion_status IN ('dry_run', 'converted', 'blocked', 'failed'))
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_conversions_tenant_runtime
  ON iso_recommended_action_conversions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_conversions_recommendation_runtime
  ON iso_recommended_action_conversions (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_conversions_target_runtime
  ON iso_recommended_action_conversions (target_type, target_table, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_iso_recommended_action_conversions_target_runtime
  ON iso_recommended_action_conversions (recommendation_id, target_type, target_id)
  WHERE target_id IS NOT NULL;

CREATE OR REPLACE VIEW public.v_iso_control_effective_health AS
WITH snapshot_candidates AS (
  SELECT
    ms.*,
    CASE
      WHEN ms.metadata->>'tenant_control_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (ms.metadata->>'tenant_control_id')::uuid
      WHEN ms.snapshot_payload->>'tenant_control_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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
  op.operation_type,
  cc.category
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

CREATE OR REPLACE VIEW public.v_iso_control_catalog_coverage AS
WITH iso_counts AS (
  SELECT
    v.standard_code,
    v.version_code,
    COUNT(ic.id)::int AS total_iso_controls
  FROM iso_standard_versions v
  LEFT JOIN iso_controls ic
    ON ic.standard_code = v.standard_code
   AND ic.version_code = v.version_code
   AND ic.is_active IS DISTINCT FROM false
  GROUP BY v.standard_code, v.version_code
),
linked AS (
  SELECT
    v.standard_code,
    v.version_code,
    COUNT(DISTINCT cc.id)::int AS linked_catalog_controls
  FROM iso_standard_versions v
  LEFT JOIN iso_controls ic
    ON ic.standard_code = v.standard_code
   AND ic.version_code = v.version_code
   AND ic.is_active IS DISTINCT FROM false
  LEFT JOIN controls_catalog cc
    ON cc.iso = v.standard_code
   AND cc.code = ic.control_code
   AND cc.is_active IS DISTINCT FROM false
  GROUP BY v.standard_code, v.version_code
)
SELECT
  c.standard_code,
  c.version_code,
  c.total_iso_controls,
  COALESCE(l.linked_catalog_controls, 0)::int AS linked_catalog_controls,
  GREATEST(c.total_iso_controls - COALESCE(l.linked_catalog_controls, 0), 0)::int AS unlinked_iso_controls,
  CASE
    WHEN c.total_iso_controls = 0 THEN 0::numeric
    ELSE ROUND((COALESCE(l.linked_catalog_controls, 0)::numeric / c.total_iso_controls::numeric) * 100, 2)
  END AS coverage_pct,
  COALESCE(l.linked_catalog_controls, 0)::int AS equivalent_links,
  0::int AS partial_links,
  0::int AS related_links,
  0::int AS transition_links,
  GREATEST(c.total_iso_controls - COALESCE(l.linked_catalog_controls, 0), 0)::int AS needs_review_count
FROM iso_counts c
LEFT JOIN linked l
  ON l.standard_code = c.standard_code
 AND l.version_code = c.version_code;

CREATE OR REPLACE VIEW public.v_iso_express_tenant_standard_readiness AS
SELECT
  ts.tenant_id,
  v.standard_code,
  v.version_code,
  v.display_name,
  v.certifiable,
  v.publication_status,
  COALESCE(ts.is_active, false) AS tenant_standard_active,
  COALESCE(c.coverage_pct, 0)::numeric AS catalog_coverage_pct,
  COALESCE(s.sync_status, 'not_started') AS sync_status,
  CASE
    WHEN v.certifiable IS TRUE AND COALESCE(c.coverage_pct, 0) >= 70 THEN 'certification_readiness'
    ELSE 'express'
  END AS recommended_assessment_type,
  CASE
    WHEN COALESCE(ts.is_active, false) IS NOT TRUE THEN 'Evaluacion preliminar: la norma no esta activa para este tenant.'
    WHEN COALESCE(c.coverage_pct, 0) < 70 THEN 'Cobertura de catalogo inferior al umbral recomendado.'
    ELSE NULL::text
  END AS warning_text
FROM tenant_standards ts
JOIN iso_standard_versions v
  ON v.standard_code = ts.standard_code
 AND v.is_active IS TRUE
LEFT JOIN v_iso_control_catalog_coverage c
  ON c.standard_code = v.standard_code
 AND c.version_code = v.version_code
LEFT JOIN iso_catalog_sync_status s
  ON s.standard_code = v.standard_code
 AND s.version_code = v.version_code
 AND s.sync_target = 'controls_catalog';

CREATE OR REPLACE VIEW public.v_health_root_causes_by_tenant AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  COUNT(v.tenant_control_id)::bigint AS total_controls,
  ROUND(AVG(v.effective_health_score) FILTER (WHERE v.effective_health_score IS NOT NULL), 2) AS avg_health_score,
  COUNT(*) FILTER (WHERE v.effective_health_status = 'saludable')::bigint AS healthy_controls,
  COUNT(*) FILTER (WHERE v.effective_health_status = 'atencion')::bigint AS attention_controls,
  COUNT(*) FILTER (WHERE v.effective_health_status = 'deteriorado')::bigint AS deteriorated_controls,
  COUNT(*) FILTER (WHERE v.effective_health_status = 'critico')::bigint AS critical_controls,
  COUNT(*) FILTER (WHERE v.evidence_count = 0)::bigint AS controls_with_evidence_gap,
  COUNT(*) FILTER (WHERE v.effective_health_status IN ('deteriorado','sin_datos'))::bigint AS controls_with_compliance_gap,
  COALESCE(SUM(v.open_findings_count), 0)::bigint AS controls_with_findings_gap,
  COALESCE(SUM(v.open_action_plans_count), 0)::bigint AS controls_with_action_gap,
  COALESCE(SUM(v.high_risks_count), 0)::bigint AS controls_with_risk_gap,
  COUNT(*) FILTER (WHERE v.effective_health_score IS NULL)::bigint AS controls_with_review_gap,
  CASE WHEN COUNT(v.tenant_control_id) = 0 THEN NULL::numeric ELSE ROUND((COUNT(*) FILTER (WHERE v.evidence_count > 0)::numeric / NULLIF(COUNT(v.tenant_control_id), 0)) * 100, 2) END AS avg_evidence_score,
  ROUND(AVG(v.effective_health_score) FILTER (WHERE v.effective_health_score IS NOT NULL), 2) AS avg_compliance_score,
  100 - LEAST(COALESCE(SUM(v.open_findings_count), 0), 100)::numeric AS avg_findings_score,
  100 - LEAST(COALESCE(SUM(v.overdue_action_plans_count), 0), 100)::numeric AS avg_action_score,
  100 - LEAST(COALESCE(SUM(v.high_risks_count), 0), 100)::numeric AS avg_risk_score,
  CASE WHEN COUNT(*) FILTER (WHERE v.effective_health_score IS NULL) > 0 THEN 0::numeric ELSE 100::numeric END AS avg_review_score,
  COALESCE(SUM(v.evidence_count), 0)::bigint AS total_evidences,
  COALESCE(SUM(v.approved_evidence_count), 0)::bigint AS approved_evidences,
  COALESCE(SUM(v.pending_evidence_count), 0)::bigint AS pending_evidences,
  COALESCE(SUM(v.rejected_evidence_count), 0)::bigint AS rejected_evidences,
  COALESCE(SUM(v.open_findings_count), 0)::bigint AS open_findings,
  COALESCE(SUM(v.open_action_plans_count), 0)::bigint AS open_actions,
  COALESCE(SUM(v.overdue_action_plans_count), 0)::bigint AS overdue_actions,
  COALESCE(SUM(v.high_risks_count), 0)::bigint AS high_risks,
  jsonb_build_object('source', 'v_iso_control_effective_health') AS main_cause_json,
  jsonb_build_array(
    jsonb_build_object('key', 'evidence', 'count', COUNT(*) FILTER (WHERE v.evidence_count = 0)),
    jsonb_build_object('key', 'findings', 'count', COALESCE(SUM(v.open_findings_count), 0)),
    jsonb_build_object('key', 'actions', 'count', COALESCE(SUM(v.overdue_action_plans_count), 0))
  ) AS causes_json,
  'Priorizar controles sin evidencia, hallazgos abiertos y acciones vencidas.'::text AS executive_recommendation
FROM tenants t
LEFT JOIN public.v_iso_control_effective_health v
  ON v.tenant_id = t.id
GROUP BY t.id, t.name;

CREATE OR REPLACE VIEW public.v_iso_operational_suggestions_queue AS
SELECT
  s.*,
  COALESCE(s.operation_id, tc.operation_id) AS resolved_operation_id,
  cc.iso AS control_iso,
  cc.clause AS control_clause,
  cc.category AS control_category,
  COALESCE(cc.description, cc.title, cc.code) AS control_description,
  COALESCE(s.payload_json, '{}'::jsonb) AS payload,
  COALESCE(s.source_trace_json, '{}'::jsonb) AS source_trace
FROM iso_operational_suggestions s
LEFT JOIN tenant_controls tc
  ON tc.tenant_id = s.tenant_id
 AND tc.id = s.tenant_control_id
LEFT JOIN controls_catalog cc
  ON cc.id = tc.control_id
WHERE s.status IS DISTINCT FROM 'archived';

CREATE OR REPLACE VIEW public.v_iso_operational_suggestions_summary AS
SELECT
  tenant_id,
  standard_code,
  COUNT(*)::integer AS total_suggestions,
  COUNT(*) FILTER (WHERE status IN ('pending','needs_review','approved'))::integer AS pending_count,
  COUNT(*) FILTER (WHERE status = 'approved')::integer AS approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected')::integer AS rejected_count,
  COUNT(*) FILTER (WHERE priority = 'critica')::integer AS critical_count,
  COUNT(*) FILTER (WHERE priority = 'alta')::integer AS high_count,
  MIN(created_at) AS first_created_at,
  MAX(updated_at) AS last_updated_at
FROM iso_operational_suggestions
WHERE status IS DISTINCT FROM 'archived'
GROUP BY tenant_id, standard_code;

GRANT SELECT ON
  public.v_iso_control_effective_health,
  public.v_iso_control_catalog_coverage,
  public.v_iso_express_tenant_standard_readiness,
  public.v_health_root_causes_by_tenant,
  public.v_iso_operational_suggestions_queue,
  public.v_iso_operational_suggestions_summary
TO tcdx_backend_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  notifications,
  document_index,
  tenant_document_index_exclusions,
  tenant_nonconformities,
  report_exports,
  iso_express_assessments,
  iso_express_assessment_items,
  iso_express_assessment_gaps,
  iso_express_assessment_answers,
  iso_express_assessment_audit_log,
  iso_operational_suggestions
TO tcdx_backend_runtime;

GRANT SELECT, INSERT, UPDATE ON
  iso_operational_suggestion_audit_log,
  iso_recommended_action_conversions
TO tcdx_backend_runtime;

GRANT SELECT ON
  report_types,
  report_access_rules,
  iso_catalog_sync_status
TO tcdx_backend_runtime;

GRANT INSERT, UPDATE ON
  iso_catalog_sync_status
TO tcdx_backend_runtime;

GRANT SELECT, INSERT, UPDATE ON
  metric_calculation_policies,
  tenant_controls
TO tcdx_backend_runtime;

COMMIT;
