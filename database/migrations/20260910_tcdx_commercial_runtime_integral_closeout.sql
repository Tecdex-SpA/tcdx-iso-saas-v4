BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091006) THEN
    RAISE EXCEPTION 'commercial runtime integral closeout migration lock not available';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS finding_type text NOT NULL DEFAULT 'observacion',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS detected_by text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_findings_tenant_due_date
  ON findings (tenant_id, due_date)
  WHERE due_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS tenant_standard_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  action text NOT NULL,
  old_is_active boolean,
  new_is_active boolean,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_standard_audit_tenant_standard
  ON tenant_standard_audit (tenant_id, standard_code, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  industry text,
  subindustry text,
  company_size text,
  maturity_level text,
  risk_appetite text,
  allow_web_research boolean NOT NULL DEFAULT false,
  allow_document_context boolean NOT NULL DEFAULT true,
  allow_ai_recommendations boolean NOT NULL DEFAULT true,
  context_document_file_id uuid,
  context_document_url text,
  ai_profile_summary_json jsonb,
  ai_research_trace_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_company_profiles_tenant
  ON tenant_company_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_company_profiles_industry
  ON tenant_company_profiles (industry, subindustry);

CREATE TABLE IF NOT EXISTS tenant_applicability_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_source text,
  profile_hash text,
  industry text,
  subindustry text,
  company_size text,
  maturity_level text,
  risk_appetite text,
  active_standards jsonb NOT NULL DEFAULT '[]'::jsonb,
  declared_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  critical_processes jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text,
  ai_used boolean NOT NULL DEFAULT false,
  web_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_applicable_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid,
  control_catalog_id uuid REFERENCES controls_catalog(id) ON DELETE SET NULL,
  standard_code text,
  control_code text,
  control_name text NOT NULL,
  applicability_status text NOT NULL DEFAULT 'applicable',
  applicability_reason text,
  applicability_score numeric,
  priority text,
  profile_drivers jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_weight numeric NOT NULL DEFAULT 1,
  must_exist boolean NOT NULL DEFAULT true,
  visible_to_tenant boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'profile_engine',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_runtime_tenant_applicable_controls_tenant_control
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_applicable_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kpi_definition_id uuid,
  kpi_code text,
  kpi_name text NOT NULL,
  applicability_status text NOT NULL DEFAULT 'applicable',
  applicability_reason text,
  applicability_score numeric,
  priority text,
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
  related_control_id uuid,
  related_kpi_id uuid,
  evidence_type text,
  evidence_name text NOT NULL,
  requirement_reason text,
  priority text,
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
  object_id uuid,
  object_code text,
  object_name text,
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
  started_at timestamptz,
  completed_at timestamptz,
  error_json jsonb,
  summary_json jsonb,
  trace_json jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
CREATE INDEX IF NOT EXISTS idx_tenant_applicable_kpis_tenant_active
  ON tenant_applicable_kpis (tenant_id, active, visible_to_tenant);
CREATE INDEX IF NOT EXISTS idx_tenant_applicability_runs_tenant_created
  ON tenant_applicability_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_document_object_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_label text,
  evidence_usage text NOT NULL DEFAULT 'supporting_evidence',
  relation_type text NOT NULL DEFAULT 'associated',
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT tenant_document_object_links_source_type_check
    CHECK (source_type IN ('document_index', 'evidence')),
  CONSTRAINT tenant_document_object_links_target_type_check
    CHECK (target_type IN ('control', 'nonconformity', 'finding', 'process', 'operation', 'risk', 'action')),
  CONSTRAINT tenant_document_object_links_usage_check
    CHECK (evidence_usage IN ('primary_evidence','supporting_evidence','remediation_evidence','finding_evidence','process_evidence','operation_evidence','risk_evidence','action_evidence','reference'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_document_object_links_active
  ON tenant_document_object_links (tenant_id, source_type, source_id, target_type, target_id, evidence_usage)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tenant_document_object_links_source
  ON tenant_document_object_links (tenant_id, source_type, source_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_document_object_links_target
  ON tenant_document_object_links (tenant_id, target_type, target_id, is_active);

CREATE TABLE IF NOT EXISTS tenant_evidence_semantic_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text,
  document_type text NOT NULL DEFAULT 'unknown',
  semantic_status text NOT NULL DEFAULT 'not_processed',
  usefulness_score numeric(5,2),
  classification_confidence numeric(5,2),
  classification_method text NOT NULL DEFAULT 'rule_based',
  classification_reason text,
  scoring_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  processed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_evidence_semantic_profiles_source
  ON tenant_evidence_semantic_profiles (tenant_id, source_type, source_id);

CREATE TABLE IF NOT EXISTS tenant_evidence_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text,
  chunk_index integer NOT NULL DEFAULT 0,
  chunk_text text NOT NULL,
  chunk_hash text,
  page_number integer,
  section_title text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_evidence_chunks_source
  ON tenant_evidence_chunks (tenant_id, source_type, source_id, chunk_index);

CREATE TABLE IF NOT EXISTS tenant_evidence_applicability_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text,
  chunk_id uuid REFERENCES tenant_evidence_chunks(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_code text,
  suggestion_type text NOT NULL DEFAULT 'applicability',
  confidence numeric(5,2),
  rationale text,
  status text NOT NULL DEFAULT 'pending_review',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_evidence_applicability_source
  ON tenant_evidence_applicability_suggestions (tenant_id, source_type, source_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_evidence_applicability_target
  ON tenant_evidence_applicability_suggestions (tenant_id, target_type, target_id);

GRANT SELECT, INSERT, UPDATE ON
  tenant_standard_audit,
  tenant_company_profiles,
  tenant_applicability_profiles,
  tenant_applicable_controls,
  tenant_applicable_kpis,
  tenant_applicable_evidence_requirements,
  tenant_applicability_exclusions,
  tenant_applicability_runs,
  tenant_document_object_links,
  tenant_evidence_semantic_profiles,
  tenant_evidence_chunks,
  tenant_evidence_applicability_suggestions
TO tcdx_backend_runtime;

GRANT DELETE ON
  tenant_applicable_controls,
  tenant_applicable_kpis,
  tenant_applicable_evidence_requirements,
  tenant_applicability_exclusions,
  tenant_document_object_links
TO tcdx_backend_runtime;

COMMIT;
