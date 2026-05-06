-- =========================================================
-- TCDX ISO SaaS - ISO Risk Matrix
-- Fase 1.6: matriz de riesgos automatizada multinorma.
--
-- Modo no destructivo:
-- - Solo crea objetos iso_risk_* y vistas v_iso_risk_*.
-- - No modifica tablas operativas existentes.
-- - No inserta ni actualiza asset_risks, tenant_controls, evidences,
--   findings, action_plans ni tenant_nonconformities.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS iso_risk_matrix_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code text NOT NULL,
  version_code text NOT NULL,
  source_assessment_id uuid NULL REFERENCES iso_express_assessments(id),
  run_type text NOT NULL DEFAULT 'automated',
  run_status text NOT NULL DEFAULT 'completed',
  requested_by uuid NULL REFERENCES users(id),
  certifiable_version boolean NOT NULL DEFAULT false,
  coverage_warning text NULL,
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
  risk_posture text NULL,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT chk_iso_risk_matrix_runs_type CHECK (
    run_type IN ('automated', 'manual_review', 'transition_readiness', 'asset_based')
  ),
  CONSTRAINT chk_iso_risk_matrix_runs_status CHECK (
    run_status IN ('draft', 'completed', 'reviewed', 'archived', 'error')
  )
);

CREATE TABLE IF NOT EXISTS iso_risk_matrix_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  risk_template_id uuid NULL REFERENCES iso_risk_templates(id),
  asset_id uuid NULL REFERENCES assets(id),
  iso_control_id uuid NULL REFERENCES iso_controls(id),
  catalog_control_id uuid NULL REFERENCES controls_catalog(id),
  tenant_control_id uuid NULL REFERENCES tenant_controls(id),
  source_assessment_id uuid NULL REFERENCES iso_express_assessments(id),
  source_gap_id uuid NULL REFERENCES iso_express_assessment_gaps(id),
  risk_code text NULL,
  risk_title text NOT NULL,
  risk_description text NULL,
  risk_category text NULL,
  asset_name text NULL,
  asset_type text NULL,
  asset_criticality text NULL,
  likelihood integer NOT NULL DEFAULT 3,
  impact integer NOT NULL DEFAULT 3,
  inherent_risk_score integer NOT NULL DEFAULT 9,
  inherent_risk_level text NOT NULL DEFAULT 'medio',
  control_effectiveness_score numeric NOT NULL DEFAULT 0,
  residual_likelihood integer NOT NULL DEFAULT 3,
  residual_impact integer NOT NULL DEFAULT 3,
  residual_risk_score integer NOT NULL DEFAULT 9,
  residual_risk_level text NOT NULL DEFAULT 'medio',
  treatment_strategy text NOT NULL DEFAULT 'mitigar',
  suggested_controls text[] NOT NULL DEFAULT '{}',
  suggested_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_expectations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'suggested',
  confidence numeric NOT NULL DEFAULT 0.75,
  source_type text NOT NULL DEFAULT 'risk_template',
  source_trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_user_id uuid NULL REFERENCES users(id),
  reviewed_at timestamptz NULL,
  review_comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_iso_risk_matrix_items_status CHECK (
    status IN ('suggested', 'accepted', 'rejected', 'needs_review', 'archived')
  ),
  CONSTRAINT chk_iso_risk_matrix_items_treatment CHECK (
    treatment_strategy IN ('mitigar', 'aceptar', 'transferir', 'evitar', 'monitorear')
  ),
  CONSTRAINT chk_iso_risk_matrix_items_inherent_level CHECK (
    inherent_risk_level IN ('bajo', 'medio', 'alto', 'critico')
  ),
  CONSTRAINT chk_iso_risk_matrix_items_residual_level CHECK (
    residual_risk_level IN ('bajo', 'medio', 'alto', 'critico')
  ),
  CONSTRAINT chk_iso_risk_matrix_items_likelihood CHECK (likelihood BETWEEN 1 AND 5),
  CONSTRAINT chk_iso_risk_matrix_items_impact CHECK (impact BETWEEN 1 AND 5),
  CONSTRAINT chk_iso_risk_matrix_items_residual_likelihood CHECK (residual_likelihood BETWEEN 1 AND 5),
  CONSTRAINT chk_iso_risk_matrix_items_residual_impact CHECK (residual_impact BETWEEN 1 AND 5),
  CONSTRAINT chk_iso_risk_matrix_items_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS iso_risk_matrix_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE,
  risk_item_id uuid NOT NULL REFERENCES iso_risk_matrix_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  action_title text NOT NULL,
  action_description text NULL,
  suggested_owner_role text NULL,
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
  run_id uuid NULL REFERENCES iso_risk_matrix_runs(id),
  risk_item_id uuid NULL REFERENCES iso_risk_matrix_items(id),
  tenant_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid NULL REFERENCES users(id),
  old_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_runs_tenant_standard
  ON iso_risk_matrix_runs(tenant_id, standard_code, version_code);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_runs_tenant_created
  ON iso_risk_matrix_runs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_run
  ON iso_risk_matrix_items(run_id);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_tenant_standard
  ON iso_risk_matrix_items(tenant_id, standard_code, version_code);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_tenant_level
  ON iso_risk_matrix_items(tenant_id, residual_risk_level);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_asset
  ON iso_risk_matrix_items(asset_id);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_items_status
  ON iso_risk_matrix_items(status);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_actions_run
  ON iso_risk_matrix_actions(run_id);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_actions_item
  ON iso_risk_matrix_actions(risk_item_id);

CREATE INDEX IF NOT EXISTS idx_iso_risk_matrix_audit_tenant_created
  ON iso_risk_matrix_audit_log(tenant_id, created_at DESC);

CREATE OR REPLACE VIEW v_iso_risk_matrix_latest_runs AS
SELECT DISTINCT ON (tenant_id, standard_code, version_code)
  id AS run_id,
  tenant_id,
  standard_code,
  version_code,
  source_assessment_id,
  run_type,
  run_status,
  certifiable_version,
  coverage_warning,
  total_assets,
  total_risk_templates,
  suggested_risks_count,
  accepted_risks_count,
  rejected_risks_count,
  critical_risks_count,
  high_risks_count,
  medium_risks_count,
  low_risks_count,
  inherent_risk_avg,
  residual_risk_avg,
  risk_posture,
  summary_json,
  created_at,
  updated_at,
  completed_at
FROM iso_risk_matrix_runs
WHERE run_status IS DISTINCT FROM 'archived'
ORDER BY tenant_id, standard_code, version_code, created_at DESC;

CREATE OR REPLACE VIEW v_iso_risk_matrix_summary AS
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
  COALESCE(ROUND(AVG(i.inherent_risk_score)::numeric, 2), 0) AS inherent_risk_avg,
  COALESCE(ROUND(AVG(i.residual_risk_score)::numeric, 2), 0) AS residual_risk_avg,
  r.risk_posture,
  r.created_at
FROM iso_risk_matrix_runs r
LEFT JOIN iso_risk_matrix_items i
  ON i.run_id = r.id
WHERE r.run_status IS DISTINCT FROM 'archived'
GROUP BY
  r.tenant_id,
  r.standard_code,
  r.version_code,
  r.id,
  r.risk_posture,
  r.created_at;

CREATE OR REPLACE VIEW v_iso_risk_matrix_by_asset AS
SELECT
  tenant_id,
  asset_id,
  COALESCE(asset_name, 'Sin activo especifico') AS asset_name,
  asset_type,
  asset_criticality,
  COUNT(*)::integer AS total_risks,
  MAX(residual_risk_score)::integer AS max_residual_risk_score,
  CASE
    WHEN MAX(residual_risk_score) >= 16 THEN 'critico'
    WHEN MAX(residual_risk_score) >= 10 THEN 'alto'
    WHEN MAX(residual_risk_score) >= 5 THEN 'medio'
    ELSE 'bajo'
  END AS highest_risk_level,
  COALESCE(SUM(jsonb_array_length(suggested_actions)), 0)::integer AS open_suggested_actions
FROM iso_risk_matrix_items
WHERE status IN ('suggested', 'accepted', 'needs_review')
GROUP BY tenant_id, asset_id, COALESCE(asset_name, 'Sin activo especifico'), asset_type, asset_criticality;

CREATE OR REPLACE VIEW v_iso_risk_matrix_actions_summary AS
SELECT
  r.tenant_id,
  r.standard_code,
  r.version_code,
  r.id AS run_id,
  COUNT(a.id)::integer AS suggested_actions,
  COUNT(a.id) FILTER (WHERE a.priority = 'critica')::integer AS critical_actions,
  COUNT(a.id) FILTER (WHERE a.priority = 'alta')::integer AS high_actions,
  COUNT(a.id) FILTER (WHERE a.priority = 'media')::integer AS medium_actions,
  COUNT(a.id) FILTER (WHERE a.status = 'accepted')::integer AS accepted_actions,
  r.created_at
FROM iso_risk_matrix_runs r
LEFT JOIN iso_risk_matrix_actions a
  ON a.run_id = r.id
WHERE r.run_status IS DISTINCT FROM 'archived'
GROUP BY r.tenant_id, r.standard_code, r.version_code, r.id, r.created_at;

COMMENT ON TABLE iso_risk_matrix_runs IS
  'Corridas de matriz de riesgos ISO automatizada. No modifica asset_risks ni action_plans.';

COMMENT ON TABLE iso_risk_matrix_items IS
  'Riesgos sugeridos y revisables generados desde iso_risk_templates, activos, diagnostico express y controles mapeados.';

COMMENT ON TABLE iso_risk_matrix_actions IS
  'Acciones recomendadas como candidatos. No crea action_plans reales.';

COMMENT ON TABLE iso_risk_matrix_audit_log IS
  'Trazabilidad de generacion, revision y archivo de matrices ISO.';
