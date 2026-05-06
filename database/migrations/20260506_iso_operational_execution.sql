-- =========================================================
-- TCDX ISO SaaS - ISO Operational Execution
-- Fase 1.7: puente entre inteligencia ISO y ejecucion operativa.
--
-- Modo no destructivo:
-- - Solo crea objetos iso_operational_*.
-- - No crea planes, hallazgos ni no conformidades durante la migracion.
-- - No modifica tenant_controls, evidences, action_plans, findings,
--   tenant_nonconformities ni tablas operativas existentes.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS iso_operational_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code text NULL,
  operation_id uuid NULL,
  tenant_control_id uuid NULL REFERENCES tenant_controls(id),
  source_module text NOT NULL,
  source_entity_type text NULL,
  source_entity_id uuid NULL,
  source_reason text NULL,
  suggestion_type text NOT NULL,
  target_record_type text NOT NULL,
  title text NOT NULL,
  description text NULL,
  rationale text NULL,
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pending',
  dedupe_key text NOT NULL,
  suggested_owner text NULL,
  suggested_due_date date NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_trace_id uuid NULL,
  created_by uuid NULL REFERENCES users(id),
  approved_by uuid NULL REFERENCES users(id),
  approved_at timestamptz NULL,
  rejected_by uuid NULL REFERENCES users(id),
  rejected_at timestamptz NULL,
  rejection_comment text NULL,
  created_record_type text NULL,
  created_record_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_iso_operational_suggestions_priority CHECK (
    priority IN ('critica', 'alta', 'media', 'baja')
  ),
  CONSTRAINT chk_iso_operational_suggestions_status CHECK (
    status IN ('pending', 'approved', 'applied', 'rejected', 'archived', 'error')
  ),
  CONSTRAINT chk_iso_operational_suggestions_target CHECK (
    target_record_type IN ('action_plan', 'finding', 'nonconformity', 'evidence_request')
  )
);

CREATE TABLE IF NOT EXISTS iso_operational_suggestion_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NULL REFERENCES iso_operational_suggestions(id),
  tenant_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid NULL REFERENCES users(id),
  old_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_tenant
  ON iso_operational_suggestions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_standard
  ON iso_operational_suggestions(tenant_id, standard_code);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_status
  ON iso_operational_suggestions(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_priority
  ON iso_operational_suggestions(tenant_id, priority);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_type
  ON iso_operational_suggestions(tenant_id, suggestion_type);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_source
  ON iso_operational_suggestions(tenant_id, source_module, source_entity_type, source_entity_id);

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestions_created
  ON iso_operational_suggestions(tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_iso_operational_suggestions_active_dedupe
  ON iso_operational_suggestions(tenant_id, dedupe_key)
  WHERE status IN ('pending', 'approved', 'applied');

CREATE INDEX IF NOT EXISTS idx_iso_operational_suggestion_audit_tenant_created
  ON iso_operational_suggestion_audit_log(tenant_id, created_at DESC);

CREATE OR REPLACE VIEW v_iso_operational_suggestions_summary AS
SELECT
  tenant_id,
  standard_code,
  COUNT(*)::integer AS total_suggestions,
  COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending_count,
  COUNT(*) FILTER (WHERE status IN ('approved', 'applied'))::integer AS approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected')::integer AS rejected_count,
  COUNT(*) FILTER (WHERE priority = 'critica')::integer AS critical_count,
  COUNT(*) FILTER (WHERE priority = 'alta')::integer AS high_count,
  COUNT(*) FILTER (WHERE priority = 'media')::integer AS medium_count,
  COUNT(*) FILTER (WHERE priority = 'baja')::integer AS low_count,
  COUNT(*) FILTER (WHERE target_record_type = 'action_plan')::integer AS action_plan_targets,
  COUNT(*) FILTER (WHERE target_record_type = 'finding')::integer AS finding_targets,
  COUNT(*) FILTER (WHERE target_record_type = 'nonconformity')::integer AS nonconformity_targets,
  COUNT(*) FILTER (WHERE target_record_type = 'evidence_request')::integer AS evidence_request_targets,
  MAX(created_at) AS latest_suggestion_at
FROM iso_operational_suggestions
WHERE status IS DISTINCT FROM 'archived'
GROUP BY tenant_id, standard_code;

CREATE OR REPLACE VIEW v_iso_operational_suggestions_queue AS
SELECT
  s.*,
  tc.operation_id AS resolved_operation_id,
  cc.iso AS control_iso,
  cc.clause AS control_clause,
  cc.category AS control_category,
  cc.description AS control_description
FROM iso_operational_suggestions s
LEFT JOIN tenant_controls tc
  ON tc.id = s.tenant_control_id
LEFT JOIN controls_catalog cc
  ON cc.id = tc.control_id
WHERE s.status IS DISTINCT FROM 'archived';

COMMENT ON TABLE iso_operational_suggestions IS
  'Sugerencias operativas ISO generadas desde diagnosticos, matriz de riesgos, salud de controles y evidencias. No son registros operativos hasta aprobacion humana.';

COMMENT ON TABLE iso_operational_suggestion_audit_log IS
  'Trazabilidad de generacion, aprobacion, rechazo y archivo de sugerencias operativas ISO.';
