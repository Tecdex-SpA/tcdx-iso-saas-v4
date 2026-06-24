-- SoA Intelligence: recomendaciones gobernadas separadas del SoA oficial.
-- No modifica control_soa ni tablas operativas existentes.

CREATE TABLE IF NOT EXISTS control_soa_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  iso_code text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  status text NOT NULL DEFAULT 'draft',
  suggested_applicable boolean,
  suggested_implementation_status text,
  suggested_justification text,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  confidence_level text NOT NULL DEFAULT 'baja',
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  finding_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  nonconformity_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  kpi_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_model text,
  ai_prompt_version text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp without time zone,
  applied_by uuid REFERENCES users(id) ON DELETE SET NULL,
  applied_at timestamp without time zone,
  rejected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rejected_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT chk_control_soa_assessments_source
    CHECK (source IN ('system','ai','hybrid')),
  CONSTRAINT chk_control_soa_assessments_status
    CHECK (status IN ('draft','reviewed','applied','rejected')),
  CONSTRAINT chk_control_soa_assessments_implementation_status
    CHECK (
      suggested_implementation_status IS NULL OR
      suggested_implementation_status IN (
        'pendiente',
        'implementado',
        'parcial',
        'no implementado',
        'no aplica'
      )
    ),
  CONSTRAINT chk_control_soa_assessments_confidence_level
    CHECK (confidence_level IN ('alta','media','baja'))
);

CREATE INDEX IF NOT EXISTS idx_control_soa_assessments_tenant
  ON control_soa_assessments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_soa_assessments_control
  ON control_soa_assessments (tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_control_soa_assessments_iso
  ON control_soa_assessments (tenant_id, iso_code);
CREATE INDEX IF NOT EXISTS idx_control_soa_assessments_status
  ON control_soa_assessments (status);
CREATE INDEX IF NOT EXISTS idx_control_soa_assessments_created
  ON control_soa_assessments (created_at DESC);

CREATE TABLE IF NOT EXISTS control_soa_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES control_soa_assessments(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT chk_control_soa_change_log_source
    CHECK (source IN ('manual','system_suggestion_applied','ai_suggestion_applied','initialize','import'))
);

CREATE INDEX IF NOT EXISTS idx_control_soa_change_log_tenant
  ON control_soa_change_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_soa_change_log_control
  ON control_soa_change_log (tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_control_soa_change_log_changed_at
  ON control_soa_change_log (changed_at DESC);
