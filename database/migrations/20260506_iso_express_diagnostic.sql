-- =========================================================
-- TCDX ISO SaaS - ISO Express Diagnostic
-- Fase 1.4: diagnostico express multinorma con iso_*.
--
-- Modo no destructivo:
-- - Crea solo tablas/vistas/indices iso_express_*.
-- - No modifica tablas operativas.
-- - No inicializa tenant_controls.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS iso_express_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code text NOT NULL,
  version_code text NOT NULL,
  assessment_type text NOT NULL DEFAULT 'express',
  assessment_status text NOT NULL DEFAULT 'draft',
  requested_by uuid REFERENCES users(id),
  source text NOT NULL DEFAULT 'manual',
  certifiable_version boolean NOT NULL DEFAULT false,
  coverage_warning text,
  readiness_score numeric NOT NULL DEFAULT 0,
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
  risk_score numeric NOT NULL DEFAULT 0,
  maturity_score numeric NOT NULL DEFAULT 0,
  plan_30_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan_60_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan_90_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT chk_iso_express_assessment_status CHECK (
    assessment_status IN ('draft', 'calculated', 'reviewed', 'archived', 'error')
  ),
  CONSTRAINT chk_iso_express_assessment_type CHECK (
    assessment_type IN ('express', 'transition_readiness', 'certification_readiness')
  )
);

CREATE TABLE IF NOT EXISTS iso_express_assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES iso_express_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  iso_control_id uuid REFERENCES iso_controls(id),
  control_code text NOT NULL,
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
  gap_severity text NOT NULL DEFAULT 'media',
  recommendation text,
  item_score numeric NOT NULL DEFAULT 0,
  item_result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_express_assessment_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES iso_express_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  iso_control_id uuid REFERENCES iso_controls(id),
  control_code text,
  gap_type text NOT NULL,
  severity text NOT NULL DEFAULT 'media',
  title text NOT NULL,
  description text,
  recommendation text,
  suggested_action_type text,
  suggested_owner_role text,
  suggested_due_days integer NOT NULL DEFAULT 30,
  source text NOT NULL DEFAULT 'diagnostic_engine',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_express_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES iso_express_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  question_code text NOT NULL,
  question_text text NOT NULL,
  answer_value text,
  answer_score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_express_assessment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid,
  tenant_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid,
  old_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessments_tenant_standard
  ON iso_express_assessments(tenant_id, standard_code, version_code);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessments_tenant_created
  ON iso_express_assessments(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessment_items_assessment
  ON iso_express_assessment_items(assessment_id);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessment_items_tenant_standard
  ON iso_express_assessment_items(tenant_id, standard_code, version_code);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessment_gaps_assessment
  ON iso_express_assessment_gaps(assessment_id);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessment_gaps_tenant_severity
  ON iso_express_assessment_gaps(tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessment_answers_assessment
  ON iso_express_assessment_answers(assessment_id);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessment_audit_assessment
  ON iso_express_assessment_audit_log(assessment_id);

CREATE INDEX IF NOT EXISTS idx_iso_express_assessment_audit_tenant_created
  ON iso_express_assessment_audit_log(tenant_id, created_at DESC);

CREATE OR REPLACE VIEW v_iso_express_tenant_standard_readiness AS
SELECT
  ts.tenant_id,
  ts.standard_code,
  v.version_code,
  v.certifiable,
  v.publication_status,
  ts.is_active AS tenant_standard_active,
  COALESCE(c.coverage_pct, 0)::numeric AS catalog_coverage_pct,
  COALESCE(s.sync_status, 'not_started') AS sync_status,
  CASE
    WHEN ts.standard_code = 'ISO9001' AND v.version_code = '2026_FDIS' THEN 'transition_readiness'
    WHEN v.certifiable = true THEN 'express'
    ELSE 'express'
  END AS recommended_assessment_type,
  CASE
    WHEN ts.standard_code = 'ISO9001' AND v.version_code = '2026_FDIS'
      THEN 'Preparacion de transicion: no es version final certificable y no reemplaza ISO9001:2015.'
    WHEN COALESCE(c.coverage_pct, 0) < 30
      THEN 'Cobertura operativa baja: diagnostico preliminar basado principalmente en iso_*.'
    WHEN COALESCE(c.coverage_pct, 0) < 80
      THEN 'Cobertura operativa parcial: revisar brechas antes de auditoria.'
    ELSE NULL
  END AS warning_text
FROM tenant_standards ts
JOIN iso_standard_versions v
  ON v.standard_code = ts.standard_code
 AND v.is_active = true
LEFT JOIN v_iso_control_catalog_coverage c
  ON c.standard_code = v.standard_code
 AND c.version_code = v.version_code
LEFT JOIN iso_catalog_sync_status s
  ON s.standard_code = v.standard_code
 AND s.version_code = v.version_code
 AND s.sync_target = 'controls_catalog'
WHERE ts.is_active IS DISTINCT FROM false;

CREATE OR REPLACE VIEW v_iso_express_latest_assessments AS
SELECT DISTINCT ON (tenant_id, standard_code, version_code)
  *
FROM iso_express_assessments
WHERE assessment_status IS DISTINCT FROM 'archived'
ORDER BY tenant_id, standard_code, version_code, created_at DESC;

CREATE OR REPLACE VIEW v_iso_express_gap_summary AS
SELECT
  assessment_id,
  tenant_id,
  standard_code,
  version_code,
  COUNT(*)::integer AS gaps_count,
  COUNT(*) FILTER (WHERE severity = 'critica')::integer AS critical_gaps_count,
  COUNT(*) FILTER (WHERE severity = 'alta')::integer AS high_gaps_count,
  COUNT(*) FILTER (WHERE severity = 'media')::integer AS medium_gaps_count,
  COUNT(*) FILTER (WHERE severity = 'baja')::integer AS low_gaps_count
FROM iso_express_assessment_gaps
GROUP BY assessment_id, tenant_id, standard_code, version_code;

COMMENT ON TABLE iso_express_assessments IS
  'Snapshots de diagnostico ISO Express por tenant y version normativa. No modifica controles operativos.';

COMMENT ON TABLE iso_express_assessment_items IS
  'Detalle por control ISO evaluado dentro de un diagnostico express.';

COMMENT ON TABLE iso_express_assessment_gaps IS
  'Brechas calculadas por el motor de diagnostico express, sin crear findings ni action_plans.';

COMMENT ON VIEW v_iso_express_tenant_standard_readiness IS
  'Normas/versiones evaluables por tenant usando tenant_standards, iso_* y cobertura de links gobernados.';
