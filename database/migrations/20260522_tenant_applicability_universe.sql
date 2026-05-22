-- =========================================================
-- TCDX ISO SaaS
-- Universo operativo aplicable por tenant
-- Migracion no destructiva e idempotente
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant_applicability_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_source varchar NULL,
  profile_hash text NULL,
  industry text NULL,
  subindustry text NULL,
  company_size text NULL,
  maturity_level text NULL,
  risk_appetite text NULL,
  active_standards jsonb NOT NULL DEFAULT '[]'::jsonb,
  declared_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  critical_processes jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text NULL,
  ai_used boolean NOT NULL DEFAULT false,
  web_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_applicable_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid NULL,
  control_catalog_id uuid NULL,
  standard_code text NULL,
  control_code text NULL,
  control_name text NOT NULL,
  applicability_status text NOT NULL DEFAULT 'applicable',
  applicability_reason text NULL,
  applicability_score numeric NULL,
  priority text NULL,
  profile_drivers jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_weight numeric NOT NULL DEFAULT 1,
  must_exist boolean NOT NULL DEFAULT true,
  visible_to_tenant boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'profile_engine',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_applicable_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kpi_definition_id uuid NULL,
  kpi_code text NULL,
  kpi_name text NOT NULL,
  applicability_status text NOT NULL DEFAULT 'applicable',
  applicability_reason text NULL,
  applicability_score numeric NULL,
  priority text NULL,
  calculation_weight numeric NOT NULL DEFAULT 1,
  visible_to_tenant boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'profile_engine',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_applicable_evidence_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  related_control_id uuid NULL,
  related_kpi_id uuid NULL,
  evidence_type text NULL,
  evidence_name text NOT NULL,
  requirement_reason text NULL,
  priority text NULL,
  active boolean NOT NULL DEFAULT true,
  visible_to_tenant boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'profile_engine',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_applicability_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  object_id uuid NULL,
  object_code text NULL,
  object_name text NULL,
  exclusion_reason text NOT NULL,
  excluded_by text NOT NULL DEFAULT 'profile_engine',
  profile_drivers jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_applicability_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  error_json jsonb NULL,
  summary_json jsonb NULL,
  trace_json jsonb NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_applicability_profiles_tenant
  ON tenant_applicability_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_controls_tenant_active
  ON tenant_applicable_controls (tenant_id, active, visible_to_tenant);

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_controls_tenant_standard
  ON tenant_applicable_controls (tenant_id, standard_code, applicability_status);

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_controls_catalog
  ON tenant_applicable_controls (tenant_id, control_catalog_id)
  WHERE control_catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_controls_tenant_control
  ON tenant_applicable_controls (tenant_id, tenant_control_id)
  WHERE tenant_control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_controls_code
  ON tenant_applicable_controls (tenant_id, control_code)
  WHERE control_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_kpis_tenant_active
  ON tenant_applicable_kpis (tenant_id, active, visible_to_tenant);

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_kpis_code
  ON tenant_applicable_kpis (tenant_id, kpi_code)
  WHERE kpi_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_kpis_definition
  ON tenant_applicable_kpis (tenant_id, kpi_definition_id)
  WHERE kpi_definition_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_evidence_tenant_active
  ON tenant_applicable_evidence_requirements (tenant_id, active, visible_to_tenant);

CREATE INDEX IF NOT EXISTS idx_tenant_applicability_exclusions_tenant_active
  ON tenant_applicability_exclusions (tenant_id, active, object_type);

CREATE INDEX IF NOT EXISTS idx_tenant_applicability_runs_tenant_created
  ON tenant_applicability_runs (tenant_id, created_at DESC);
