-- DB-N05 - Consolidated production baseline schema v1.
--
-- Purpose:
--   Create a clean PostgreSQL candidate from an empty database using only
--   current canonical objects needed for tenant, RBAC, commercial gating,
--   standards, controls, evidence, findings, actions, risks, audits,
--   workflows, governed metrics, GRC Health, AI read metadata, and DB-N01..04
--   runtime contracts.
--
-- This file intentionally does not create historical backup, preview, or QA
-- audit schemas/tables. It does not enable broad RLS; DB-N04 runtime context
-- prerequisites and staged pilot policies are present for the later RLS
-- rollout once ai_reader is tenant-safe.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090705) THEN
    RAISE EXCEPTION 'DB-N05 production baseline lock unavailable';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS tcdx_security;
CREATE SCHEMA IF NOT EXISTS ai_core;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tcdx_migration_admin') THEN
    CREATE ROLE tcdx_migration_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tcdx_backend_runtime') THEN
    CREATE ROLE tcdx_backend_runtime NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tcdx_platform_runtime') THEN
    CREATE ROLE tcdx_platform_runtime NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_reader') THEN
    CREATE ROLE ai_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tcdx_readonly_support') THEN
    CREATE ROLE tcdx_readonly_support NOLOGIN;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id text PRIMARY KEY,
  checksum char(64) NOT NULL,
  applied_at timestamptz,
  applied_by text NOT NULL,
  duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  status text NOT NULL CHECK (status IN ('running','applied','failed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  slug text NOT NULL UNIQUE,
  service_status text NOT NULL DEFAULT 'active' CHECK (service_status IN ('active','suspended','deleted')),
  ai_plan text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  role_level integer NOT NULL DEFAULT 100 CHECK (role_level >= 0),
  is_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  permission_group text NOT NULL DEFAULT 'general',
  display_name text NOT NULL DEFAULT '',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_key text NOT NULL REFERENCES app_roles(role_key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
  is_allowed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  full_name text,
  role text NOT NULL DEFAULT 'viewer',
  effective_role text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','invited','deleted')),
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS commercial_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commercial_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL REFERENCES commercial_plans(plan_key) ON DELETE CASCADE,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','retired')),
  published_at timestamptz,
  UNIQUE (plan_key, version)
);

CREATE TABLE IF NOT EXISTS saas_modules (
  module_key text PRIMARY KEY,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS commercial_technical_capabilities (
  capability_key text PRIMARY KEY,
  module_key text NOT NULL REFERENCES saas_modules(module_key),
  display_name text,
  description text,
  classification text NOT NULL,
  required_permission text REFERENCES permissions(permission_key),
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_version_capabilities (
  plan_version_id uuid NOT NULL REFERENCES commercial_plan_versions(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES commercial_technical_capabilities(capability_key) ON DELETE CASCADE,
  is_included boolean NOT NULL DEFAULT true,
  PRIMARY KEY (plan_version_id, capability_key)
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_key text NOT NULL REFERENCES commercial_plans(plan_key),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','cancelled','expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','expired','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, addon_key)
);

CREATE TABLE IF NOT EXISTS tenant_module_settings (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES saas_modules(module_key),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL UNIQUE,
  family text NOT NULL,
  display_name text NOT NULL,
  version_label text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Versioned global ISO reference authority. QA surrogate IDs are never imported.
CREATE TABLE IF NOT EXISTS iso_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  family text NOT NULL,
  description text,
  is_active boolean NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS iso_standard_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id uuid NOT NULL REFERENCES iso_standards(id),
  standard_code text NOT NULL REFERENCES iso_standards(standard_code),
  version_code text NOT NULL,
  product_standard_code text REFERENCES standards(standard_code),
  display_name text NOT NULL,
  publication_status text NOT NULL,
  certifiable boolean NOT NULL,
  replaces_version text,
  effective_from date,
  transition_until date,
  source_policy text NOT NULL,
  notes text,
  is_active boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('approved_for_loader', 'transition_only')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (standard_code, version_code),
  UNIQUE (id, standard_code, version_code),
  CHECK (publication_status = 'published' OR NOT certifiable),
  CHECK (status <> 'transition_only' OR (NOT certifiable AND product_standard_code IS NULL))
);
CREATE TABLE IF NOT EXISTS iso_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_version_id uuid NOT NULL,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  control_code text NOT NULL CHECK (btrim(control_code) <> ''),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text,
  control_type text,
  domain text,
  default_priority text NOT NULL,
  default_frequency text,
  owner_role_suggested text,
  copyright_safe_summary text,
  is_active boolean NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (standard_code, version_code, control_code),
  UNIQUE (id, standard_code, version_code, control_code),
  FOREIGN KEY (standard_version_id, standard_code, version_code)
    REFERENCES iso_standard_versions(id, standard_code, version_code)
);
CREATE TABLE IF NOT EXISTS iso_evidence_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_version_id uuid NOT NULL,
  control_id uuid NOT NULL,
  standard_code text NOT NULL,
  version_code text NOT NULL,
  control_code text NOT NULL,
  evidence_name text NOT NULL,
  evidence_type text NOT NULL,
  description text,
  required_level text NOT NULL,
  freshness_days integer,
  validation_criteria jsonb NOT NULL,
  ai_review_guidance text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (standard_code, version_code, control_code, evidence_type, evidence_name),
  FOREIGN KEY (standard_version_id, standard_code, version_code)
    REFERENCES iso_standard_versions(id, standard_code, version_code),
  FOREIGN KEY (control_id, standard_code, version_code, control_code)
    REFERENCES iso_controls(id, standard_code, version_code, control_code)
);

CREATE TABLE IF NOT EXISTS tenant_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code),
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, standard_code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS controls_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  base_control_id uuid,
  code text NOT NULL,
  clause text,
  category text,
  title text NOT NULL,
  description text,
  iso text NOT NULL REFERENCES standards(standard_code),
  domain text,
  source_type text NOT NULL DEFAULT 'production_reference',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (iso, code)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_controls_catalog_base_control'
      AND conrelid = 'controls_catalog'::regclass
  ) THEN
    ALTER TABLE controls_catalog
      ADD CONSTRAINT fk_controls_catalog_base_control
      FOREIGN KEY (base_control_id) REFERENCES controls_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS controls_catalog_standards (
  control_id uuid NOT NULL REFERENCES controls_catalog(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code),
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (control_id, standard_code)
);

CREATE TABLE IF NOT EXISTS tenant_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation_key text NOT NULL,
  code text,
  name text NOT NULL,
  operation_type text NOT NULL DEFAULT 'business_process',
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tenant_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  tenant_standard_id uuid,
  operation_id uuid,
  applicability_status text NOT NULL DEFAULT 'applicable',
  implementation_status text NOT NULL DEFAULT 'not_started',
  owner_user_id uuid,
  responsible_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  score numeric,
  health_status text,
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  applicability text NOT NULL DEFAULT 'applicable',
  last_reviewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, control_id),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn05_tenant_controls_standard_same_tenant
    FOREIGN KEY (tenant_id, tenant_standard_id)
    REFERENCES tenant_standards(tenant_id, id) ON DELETE SET NULL,
	  CONSTRAINT fk_dbn05_tenant_controls_operation_same_tenant
	    FOREIGN KEY (tenant_id, operation_id)
	    REFERENCES tenant_operations(tenant_id, id) ON DELETE SET NULL
	);

CREATE TABLE IF NOT EXISTS control_soa (
  tenant_control_id uuid PRIMARY KEY REFERENCES tenant_controls(id) ON DELETE CASCADE,
  applicable boolean NOT NULL DEFAULT true,
  implementation_status text NOT NULL DEFAULT 'pendiente',
  justification text,
  notes text,
  owner text,
  review_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control_soa_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid NOT NULL,
  iso_code text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  status text NOT NULL DEFAULT 'draft',
  suggested_applicable boolean,
  suggested_implementation_status text,
  suggested_justification text,
  confidence_score numeric,
  confidence_level text,
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
  reviewed_at timestamptz,
  applied_by uuid REFERENCES users(id) ON DELETE SET NULL,
  applied_at timestamptz,
  rejected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn05_control_soa_assessments_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS control_soa_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid NOT NULL,
  assessment_id uuid,
  source text NOT NULL DEFAULT 'manual',
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn05_control_soa_change_log_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_dbn05_control_soa_change_log_assessment_same_tenant
    FOREIGN KEY (tenant_id, assessment_id)
    REFERENCES control_soa_assessments(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_key text NOT NULL,
  name text NOT NULL,
  criticality text NOT NULL DEFAULT 'medium',
  owner_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asset_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_key text NOT NULL,
  standard_code text REFERENCES standards(standard_code),
  status text NOT NULL DEFAULT 'planned',
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, audit_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tenant_nonconformities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid,
  tenant_control_id uuid,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn03_nonconformities_audit_same_tenant
    FOREIGN KEY (tenant_id, audit_id)
    REFERENCES audits(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn03_nonconformities_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid,
  catalog_control_id uuid REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  audit_id uuid,
  asset_id uuid,
  nonconformity_id uuid,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  iso_code text,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn03_findings_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn03_findings_audit_same_tenant
    FOREIGN KEY (tenant_id, audit_id)
    REFERENCES audits(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn03_findings_asset_same_tenant
    FOREIGN KEY (tenant_id, asset_id)
    REFERENCES assets(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_dbn03_findings_nonconformity_same_tenant
    FOREIGN KEY (tenant_id, nonconformity_id)
    REFERENCES tenant_nonconformities(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid,
  catalog_control_id uuid REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  title text NOT NULL,
  evidence_type text NOT NULL DEFAULT 'document',
  status text NOT NULL DEFAULT 'pending',
  validated boolean NOT NULL DEFAULT false,
  expires_at date,
  last_ai_analyzed_at timestamptz,
  ai_analysis_status text,
  uploaded_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn03_evidences_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid,
  finding_id uuid,
  audit_id uuid,
  asset_id uuid,
  nonconformity_id uuid,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  iso_code text,
  source_type text,
  source_id uuid,
  due_date date,
  completed_at timestamptz,
  owner_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn03_action_plans_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn03_action_plans_finding_same_tenant
    FOREIGN KEY (tenant_id, finding_id)
    REFERENCES findings(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn03_action_plans_audit_same_tenant
    FOREIGN KEY (tenant_id, audit_id)
    REFERENCES audits(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn03_action_plans_asset_same_tenant
    FOREIGN KEY (tenant_id, asset_id)
    REFERENCES assets(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_dbn03_action_plans_nonconformity_same_tenant
    FOREIGN KEY (tenant_id, nonconformity_id)
    REFERENCES tenant_nonconformities(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS action_plan_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comment text,
  progress_percent numeric CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
  status_after text,
  blocked_reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  risk_key text NOT NULL,
  title text NOT NULL,
  inherent_score numeric,
  residual_score numeric,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, risk_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS risk_control_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL,
  tenant_control_id uuid NOT NULL,
  relation_type text NOT NULL DEFAULT 'mitigates',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, risk_id, tenant_control_id),
  CONSTRAINT fk_dbn05_risk_control_risk_same_tenant
    FOREIGN KEY (tenant_id, risk_id)
    REFERENCES risks(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_dbn05_risk_control_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_key text NOT NULL,
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'policy',
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS grc_workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS grc_workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id uuid NOT NULL REFERENCES grc_workflow_definitions(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'published',
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workflow_definition_id, version)
);

CREATE TABLE IF NOT EXISTS grc_workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_version_id uuid NOT NULL REFERENCES grc_workflow_versions(id) ON DELETE RESTRICT,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open',
  state_key text NOT NULL DEFAULT 'created',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tcdx_async_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS usage_limit_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  default_limit numeric,
  unit text NOT NULL DEFAULT 'count',
  period text NOT NULL DEFAULT 'month' CHECK (period IN ('day','month','year','lifetime')),
  warning_threshold numeric NOT NULL DEFAULT 0.8 CHECK (warning_threshold > 0 AND warning_threshold <= 1),
  enforcement text NOT NULL DEFAULT 'block' CHECK (enforcement IN ('observe','warn','block')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_key text NOT NULL REFERENCES usage_limit_definitions(resource_key) ON DELETE RESTRICT,
  limit_value numeric,
  warning_threshold numeric NOT NULL DEFAULT 0.8 CHECK (warning_threshold > 0 AND warning_threshold <= 1),
  enforcement text NOT NULL DEFAULT 'block' CHECK (enforcement IN ('observe','warn','block')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, resource_key)
);

CREATE TABLE IF NOT EXISTS commercial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS official_formula_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  formula_code text NOT NULL,
  name text,
  display_name text,
  domain text,
  category text,
  description text,
  owner text,
  status text NOT NULL DEFAULT 'published',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, formula_code)
);

CREATE TABLE IF NOT EXISTS official_formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_definition_id uuid REFERENCES official_formula_definitions(id) ON DELETE CASCADE,
  tenant_id uuid,
  formula_code text,
  version text NOT NULL DEFAULT 'v1',
  version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'published',
  expression text NOT NULL,
  methodology text,
  units jsonb NOT NULL DEFAULT '{}'::jsonb,
  precision integer NOT NULL DEFAULT 4,
  rounding_policy text NOT NULL DEFAULT 'round_half_up',
  null_policy text,
  zero_division_policy text,
  minimum_sample_size integer NOT NULL DEFAULT 1,
  minimum_coverage numeric NOT NULL DEFAULT 0.80,
  applicability text,
  limitations text,
  source_contract_code text,
  checksum char(64),
  effective_from timestamptz,
  reviewed_by text,
  approved_by text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (formula_definition_id, version_number),
  UNIQUE (tenant_id, formula_code, version)
);

CREATE TABLE IF NOT EXISTS official_formula_source_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE CASCADE,
  tenant_id uuid,
  source_code text NOT NULL,
  formula_code text,
  contract_version text NOT NULL DEFAULT 'v1',
  version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'published',
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  entity_name text,
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_joins jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone_policy text NOT NULL DEFAULT 'tenant_timezone',
  unit text,
  cardinality text,
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  null_policy text,
  availability text,
  checksum char(64),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, source_code, contract_version)
);

CREATE TABLE IF NOT EXISTS metric_source_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_code text,
  metric_key text,
  formula_code text,
  source_code text,
  source_contract_id uuid REFERENCES official_formula_source_contracts(id) ON DELETE RESTRICT,
  binding_status text NOT NULL DEFAULT 'active',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metric_definition_id uuid,
  definition_version_id uuid,
  official_formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE RESTRICT,
  semantic_contract_version_id uuid,
  mapping_id uuid,
  version_number integer NOT NULL DEFAULT 1,
  methodology_version integer NOT NULL DEFAULT 1,
  unit text,
  checksum char(64),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, metric_code, source_code)
);

CREATE TABLE IF NOT EXISTS calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE RESTRICT,
  formula_code text,
  source_contract_id uuid REFERENCES official_formula_source_contracts(id) ON DELETE SET NULL,
  run_key text NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'completed',
  run_status text NOT NULL DEFAULT 'calculated',
  coverage numeric,
  period_start timestamptz,
  period_end timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  input_hash char(64),
  output_hash char(64),
  source_snapshot_hash char(64),
  correlation_id text,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, run_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS calculation_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,
  input_key text NOT NULL DEFAULT 'official_payload',
  variable_name text,
  numeric_value numeric,
  input_value jsonb,
  unit text,
  source_row_count integer NOT NULL DEFAULT 0,
  input_hash char(64),
  state text NOT NULL DEFAULT 'available',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_dbn03_calculation_inputs_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES calculation_runs(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calculation_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,
  output_key text NOT NULL DEFAULT 'value',
  output_name text NOT NULL DEFAULT 'value',
  numeric_value numeric,
  output_value jsonb,
  unit text,
  precision integer NOT NULL DEFAULT 4,
  rounding_policy text NOT NULL DEFAULT 'round_half_up',
  output_hash char(64),
  state text NOT NULL DEFAULT 'measured',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_dbn03_calculation_outputs_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES calculation_runs(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calculation_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  validation_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  message text NOT NULL,
  source_row jsonb,
  field_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_dbn03_calculation_validations_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES calculation_runs(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calculation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid,
  source_contract_id uuid REFERENCES official_formula_source_contracts(id) ON DELETE SET NULL,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('source_dataset','input','output','explanation','comparison')),
  snapshot_hash char(64) NOT NULL,
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_dbn03_calculation_snapshots_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES calculation_runs(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  run_id uuid,
  metric_definition_id uuid,
  measurement_id uuid,
  formula_version_id uuid,
  period_key text,
  snapshot_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash char(64),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  definition_version_id uuid,
  calculation_run_id uuid,
  official_formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE RESTRICT,
  trust_assessment_id uuid,
  threshold_version integer,
  methodology_version integer,
  numeric_value numeric,
  publication_state text NOT NULL DEFAULT 'not_measured',
  coverage numeric,
  effective_at timestamptz NOT NULL DEFAULT now(),
  source_snapshot_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  correlation_id text,
  snapshot_status text NOT NULL DEFAULT 'published',
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, metric_code, effective_at),
  CONSTRAINT fk_dbn03_metric_snapshots_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES calculation_runs(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS metric_interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_snapshot_id uuid NOT NULL REFERENCES metric_snapshots(id) ON DELETE RESTRICT,
  interpretation_version integer NOT NULL CHECK (interpretation_version > 0),
  result_status text NOT NULL,
  trend jsonb NOT NULL DEFAULT '{}'::jsonb,
  comparison jsonb NOT NULL DEFAULT '{}'::jsonb,
  cause text,
  impact text,
  recommendation text,
  proposed_action text,
  priority text NOT NULL,
  suggested_owner text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metric_snapshot_id, interpretation_version),
  UNIQUE (tenant_id, checksum)
);

CREATE TABLE IF NOT EXISTS metric_action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_snapshot_id uuid NOT NULL REFERENCES metric_snapshots(id) ON DELETE RESTRICT,
  interpretation_id uuid REFERENCES metric_interpretations(id) ON DELETE RESTRICT,
  proposal_type text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  priority text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  proposal_key char(64) NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected','transformed','expired')),
  proposed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  transformed_action_type text,
  transformed_action_id uuid,
  decision_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, proposal_key)
);

CREATE TABLE IF NOT EXISTS metric_job_policies (
  job_type text PRIMARY KEY CHECK (job_type IN ('metric.calculate','metric.snapshot','metric.compare','metric.freshness','metric.alert','metric.reconcile','metric.retention')),
  timeout_ms integer NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 300000),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  retry_backoff_seconds integer NOT NULL CHECK (retry_backoff_seconds BETWEEN 1 AND 86400),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  checksum char(64) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_key text NOT NULL,
  readiness_score numeric,
  state text NOT NULL DEFAULT 'missing',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS grc_readiness_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_id uuid,
  result_key text NOT NULL,
  result_value numeric,
  state text NOT NULL DEFAULT 'missing',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, result_key),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn03_grc_readiness_results_snapshot_same_tenant
    FOREIGN KEY (tenant_id, snapshot_id)
    REFERENCES grc_readiness_snapshots(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS grc_readiness_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_id uuid,
  result_id uuid,
  finding_id uuid,
  status text NOT NULL DEFAULT 'open',
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn03_grc_readiness_findings_snapshot_same_tenant
    FOREIGN KEY (tenant_id, snapshot_id)
    REFERENCES grc_readiness_snapshots(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn03_grc_readiness_findings_result_same_tenant
    FOREIGN KEY (tenant_id, result_id)
    REFERENCES grc_readiness_results(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_dbn05_grc_readiness_findings_finding_same_tenant
    FOREIGN KEY (tenant_id, finding_id)
    REFERENCES findings(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS data_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('metric','dashboard','report','readiness','risk','compliance','control','supplier','incident','loss','data','semantic_source')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  period_key text,
  snapshot_payload jsonb NOT NULL,
  source_hash char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, snapshot_type, entity_type, entity_id, period_key, source_hash)
);

CREATE TABLE IF NOT EXISTS data_lineage_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_type text NOT NULL,
  from_id uuid NOT NULL,
  to_type text NOT NULL,
  to_id uuid NOT NULL,
  relation_type text NOT NULL CHECK (relation_type IN ('derived_from','measured_from','validated_by','supported_by','affects','aggregates','reported_in','snapshot_of')),
  transformation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS data_source_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  source_code text NOT NULL,
  display_name text NOT NULL,
  entity_type text NOT NULL,
  adapter_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  current_version_id uuid,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS data_source_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES data_source_contracts(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  physical_tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_joins jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_key_candidates jsonb NOT NULL DEFAULT '["tenant_id"]'::jsonb,
  timestamp_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_equivalences jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  exclusion_policy jsonb NOT NULL DEFAULT '[]'::jsonb,
  fallback_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  minimum_coverage numeric(5,4) NOT NULL DEFAULT 0 CHECK (minimum_coverage BETWEEN 0 AND 1),
  maximum_age_seconds bigint CHECK (maximum_age_seconds IS NULL OR maximum_age_seconds > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  valid_from timestamptz,
  valid_until timestamptz,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from),
  UNIQUE (contract_id, version_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'data_source_contracts_current_version_fk'
      AND conrelid = 'data_source_contracts'::regclass
  ) THEN
    ALTER TABLE data_source_contracts ADD CONSTRAINT data_source_contracts_current_version_fk
      FOREIGN KEY (current_version_id) REFERENCES data_source_contract_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS data_source_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_version_id uuid NOT NULL REFERENCES data_source_contract_versions(id) ON DELETE CASCADE,
  physical_table text NOT NULL,
  physical_column text NOT NULL,
  canonical_field text NOT NULL,
  transformation_type text NOT NULL,
  transformation_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  observation_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  contract_id uuid NOT NULL REFERENCES data_source_contracts(id) ON DELETE RESTRICT,
  contract_version_id uuid NOT NULL REFERENCES data_source_contract_versions(id) ON DELETE RESTRICT,
  source_table text NOT NULL,
  source_record_id text NOT NULL,
  source_identity_hash char(64) NOT NULL,
  observed_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  period_start timestamptz,
  period_end timestamptz,
  status_value text,
  severity_value text,
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  unit text,
  quality_status text NOT NULL DEFAULT 'unknown' CHECK (quality_status IN ('valid','attention','failed','unknown')),
  quality_score numeric(5,2) CHECK (quality_score BETWEEN 0 AND 100),
  freshness_status text NOT NULL DEFAULT 'unknown' CHECK (freshness_status IN ('fresh','attention','stale','unknown')),
  freshness_age_seconds bigint CHECK (freshness_age_seconds IS NULL OR freshness_age_seconds >= 0),
  trust_score numeric(5,2) CHECK (trust_score IS NULL OR trust_score BETWEEN 0 AND 100),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_id uuid,
  correlation_id text NOT NULL,
  source_snapshot_id uuid REFERENCES data_snapshots(id) ON DELETE RESTRICT,
  supersedes_observation_id uuid REFERENCES grc_observations(id) ON DELETE RESTRICT,
  superseded_by_id uuid REFERENCES grc_observations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  CHECK (num_nonnulls(numeric_value, text_value, boolean_value) <= 1),
  UNIQUE (tenant_id, contract_version_id, source_identity_hash, is_current)
);

CREATE TABLE IF NOT EXISTS grc_observation_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  observation_id uuid NOT NULL REFERENCES grc_observations(id) ON DELETE CASCADE,
  related_entity_type text NOT NULL,
  related_entity_id uuid NOT NULL,
  relation_type text NOT NULL CHECK (relation_type IN ('describes','supports','evidences','affects','measures','owned_by','derived_from','related_to')),
  confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE (tenant_id, observation_id, related_entity_type, related_entity_id, relation_type)
);

CREATE TABLE IF NOT EXISTS grc_gap_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  rule_version integer NOT NULL CHECK (rule_version > 0),
  rule_type text NOT NULL DEFAULT 'deterministic' CHECK (rule_type IN ('deterministic')),
  input_observation_type text NOT NULL,
  gap_type text NOT NULL,
  severity_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  enabled boolean NOT NULL DEFAULT true,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gap_key char(64) NOT NULL,
  gap_type text NOT NULL,
  rule_id uuid NOT NULL REFERENCES grc_gap_rules(id) ON DELETE RESTRICT,
  rule_code text NOT NULL,
  rule_version integer NOT NULL CHECK (rule_version > 0),
  source_observation_id uuid NOT NULL REFERENCES grc_observations(id) ON DELETE RESTRICT,
  latest_source_observation_id uuid NOT NULL REFERENCES grc_observations(id) ON DELETE RESTRICT,
  affected_entity_type text NOT NULL,
  affected_entity_id uuid,
  severity text NOT NULL CHECK (severity IN ('informational','low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','in_treatment','verified','closed')),
  first_seen timestamptz NOT NULL,
  last_seen timestamptz NOT NULL,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  verified_at timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  correlation_id text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (last_seen >= first_seen),
  CHECK (status <> 'verified' OR verified_at IS NOT NULL),
  CHECK (status <> 'closed' OR resolved_at IS NOT NULL),
  UNIQUE (tenant_id, gap_key)
);

CREATE TABLE IF NOT EXISTS grc_gap_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gap_id uuid NOT NULL REFERENCES grc_gaps(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  transition_type text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source_observation_id uuid REFERENCES grc_observations(id) ON DELETE RESTRICT,
  rule_code text NOT NULL,
  rule_version integer NOT NULL,
  reason text,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_gap_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hypothesis_key char(64) NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  title text NOT NULL,
  statement text NOT NULL,
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','accepted','rejected','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, hypothesis_key)
);

CREATE TABLE IF NOT EXISTS metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  display_name text NOT NULL,
  business_definition text NOT NULL,
  technical_definition text NOT NULL,
  metric_type text NOT NULL,
  unit text NOT NULL,
  direction text NOT NULL,
  aggregation text NOT NULL,
  frequency text NOT NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, metric_code)
);

CREATE TABLE IF NOT EXISTS metric_formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  expression jsonb NOT NULL,
  expression_language text NOT NULL DEFAULT 'tcdx_metric_dsl_v1',
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (metric_definition_id, version_number)
);

CREATE TABLE IF NOT EXISTS metric_definition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  functional_code text NOT NULL,
  display_name text NOT NULL,
  business_definition text NOT NULL,
  domain text NOT NULL,
  objective text NOT NULL,
  unit text NOT NULL,
  favorable_direction text NOT NULL,
  frequency text NOT NULL,
  population_definition text NOT NULL,
  numerator_definition text,
  denominator_definition text,
  methodology text NOT NULL,
  semantic_contract_code text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (metric_definition_id, version_number)
);

CREATE TABLE IF NOT EXISTS metric_sufficiency_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid REFERENCES metric_definitions(id) ON DELETE CASCADE,
  formula_code text,
  rule_code text NOT NULL CHECK (rule_code ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  version_number integer NOT NULL CHECK (version_number > 0),
  required_inputs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_inputs) = 'array'),
  optional_inputs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(optional_inputs) = 'array'),
  minimum_sample_size integer NOT NULL DEFAULT 1 CHECK (minimum_sample_size > 0),
  minimum_coverage numeric(5,4) NOT NULL DEFAULT 0 CHECK (minimum_coverage BETWEEN 0 AND 1),
  maximum_age_seconds bigint CHECK (maximum_age_seconds IS NULL OR maximum_age_seconds > 0),
  allowed_quality_statuses text[] NOT NULL DEFAULT ARRAY['valid','attention'],
  allowed_freshness_statuses text[] NOT NULL DEFAULT ARRAY['fresh','attention'],
  allowed_units text[] NOT NULL DEFAULT ARRAY[]::text[],
  period_policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(period_policy) = 'object'),
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exclusions) = 'array'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (metric_definition_id IS NOT NULL OR formula_code IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS metric_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  threshold_key text NOT NULL,
  label text NOT NULL,
  operator text NOT NULL,
  value_min numeric,
  value_max numeric,
  status_result text NOT NULL,
  direction text,
  unit text,
  justification text,
  status text NOT NULL DEFAULT 'draft',
  version_number integer NOT NULL DEFAULT 1,
  checksum char(64),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS metric_calculation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  formula_code text,
  calculation_frequency text NOT NULL DEFAULT 'monthly',
  stale_after interval,
  minimum_sample_size integer NOT NULL DEFAULT 1,
  failure_policy text NOT NULL DEFAULT 'mark_unmeasured',
  status text NOT NULL DEFAULT 'draft',
  version_number integer NOT NULL DEFAULT 1,
  timeout_ms integer NOT NULL DEFAULT 30000,
  max_attempts integer NOT NULL DEFAULT 3,
  retry_backoff_seconds integer NOT NULL DEFAULT 30,
  retention_periods integer NOT NULL DEFAULT 24,
  checksum char(64),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS metric_trust_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid REFERENCES metric_definitions(id) ON DELETE CASCADE,
  policy_code text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  weights jsonb NOT NULL,
  critical_dimensions text[] NOT NULL DEFAULT ARRAY['freshness','lineage','validation','coverage'],
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS metric_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE RESTRICT,
  formula_version_id uuid REFERENCES metric_formula_versions(id) ON DELETE RESTRICT,
  period_key text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  value_numeric numeric,
  value_text text,
  unit text NOT NULL,
  source_timestamp timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  calculated_at timestamptz,
  quality_status text NOT NULL DEFAULT 'unknown',
  freshness_status text NOT NULL DEFAULT 'unknown',
  trust_score numeric(5,2),
  trust_status text NOT NULL DEFAULT 'unknown',
  validation_status text NOT NULL DEFAULT 'pending',
  evidence_id uuid,
  correlation_id text,
  official_state text,
  coverage_ratio numeric(7,6),
  sample_size integer,
  population_size integer,
  sufficiency_status text,
  source_snapshot_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  calculation_run_id uuid REFERENCES calculation_runs(id) ON DELETE RESTRICT,
  official_formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE RESTRICT,
  trust_assessment_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (period_end > period_start),
  CHECK ((official_state IS NULL AND (value_numeric IS NOT NULL OR value_text IS NOT NULL)) OR official_state IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS metric_trust_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE RESTRICT,
  measurement_id uuid REFERENCES metric_measurements(id) ON DELETE RESTRICT,
  calculation_run_id uuid REFERENCES calculation_runs(id) ON DELETE RESTRICT,
  trust_policy_id uuid NOT NULL REFERENCES metric_trust_policies(id) ON DELETE RESTRICT,
  score numeric(5,2) CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  trust_status text NOT NULL CHECK (trust_status IN ('trusted','acceptable','attention','untrusted','unknown')),
  dimensions jsonb NOT NULL,
  evidence_checksum char(64) NOT NULL,
  assessment_checksum char(64) NOT NULL,
  correlation_id text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, metric_definition_id, correlation_id, assessment_checksum)
);

CREATE TABLE IF NOT EXISTS data_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comparison_type text NOT NULL CHECK (comparison_type IN ('period','unit','process','standard','supplier','before_after','plan','baseline','target','window')),
  baseline_snapshot_id uuid REFERENCES data_snapshots(id) ON DELETE RESTRICT,
  current_snapshot_id uuid REFERENCES data_snapshots(id) ON DELETE RESTRICT,
  baseline_metric_snapshot_id uuid REFERENCES metric_snapshots(id) ON DELETE RESTRICT,
  current_metric_snapshot_id uuid REFERENCES metric_snapshots(id) ON DELETE RESTRICT,
  metric_definition_id uuid REFERENCES metric_definitions(id) ON DELETE RESTRICT,
  baseline_value numeric,
  current_value numeric,
  absolute_change numeric,
  percentage_change numeric,
  direction text NOT NULL CHECK (direction IN ('increase','decrease','unchanged','not_comparable')),
  status text NOT NULL CHECK (status IN ('improved','degraded','stable','not_comparable')),
  explanation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_ids uuid[] NOT NULL,
  methodology_compatible boolean,
  compatibility_reason text,
  period_distance integer CHECK (period_distance IS NULL OR period_distance >= 0),
  comparison_checksum char(64),
  target_value numeric,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (
    (baseline_snapshot_id IS NOT NULL AND current_snapshot_id IS NOT NULL AND baseline_metric_snapshot_id IS NULL AND current_metric_snapshot_id IS NULL)
    OR (baseline_snapshot_id IS NULL AND current_snapshot_id IS NULL AND baseline_metric_snapshot_id IS NOT NULL AND current_metric_snapshot_id IS NOT NULL)
    OR (comparison_type='target' AND baseline_snapshot_id IS NULL AND current_snapshot_id IS NULL AND baseline_metric_snapshot_id IS NULL AND current_metric_snapshot_id IS NOT NULL AND target_value IS NOT NULL)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'metric_measurements_trust_assessment_fkey'
      AND conrelid = 'metric_measurements'::regclass
  ) THEN
    ALTER TABLE metric_measurements ADD CONSTRAINT metric_measurements_trust_assessment_fkey
      FOREIGN KEY (trust_assessment_id) REFERENCES metric_trust_assessments(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_key text NOT NULL,
  source_key text,
  scope text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  classification text NOT NULL DEFAULT 'internal',
  document_type text NOT NULL,
  title text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_to timestamptz,
  supersedes_document_id uuid REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  source_authority text NOT NULL,
  source_uri_or_reference text,
  original_file_reference text,
  original_file_checksum text,
  extracted_text_reference text,
  extracted_text_checksum text,
  content_checksum text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_documents_scope_check
    CHECK (scope IN ('GLOBAL','REGULATORY','TENANT')),
  CONSTRAINT knowledge_documents_tenant_scope_check
    CHECK (
      (scope = 'TENANT' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','REGULATORY') AND tenant_id IS NULL)
    ),
  CONSTRAINT knowledge_documents_status_check
    CHECK (status IN ('draft','indexing','active','deprecated','rejected','error')),
  CONSTRAINT knowledge_documents_source_authority_check
    CHECK (source_authority IN ('tcdx_internal','authoritative','tenant_private','imported','derived')),
  CONSTRAINT knowledge_documents_regulatory_authority_check
    CHECK (scope <> 'REGULATORY' OR source_authority = 'authoritative'),
  CONSTRAINT knowledge_documents_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  CONSTRAINT knowledge_documents_content_checksum_check
    CHECK (content_checksum ~ '^[a-f0-9]{64}$'),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_document_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  source_key text NOT NULL,
  source_name text NOT NULL,
  source_type text,
  license_class text NOT NULL DEFAULT 'derived_summary',
  use_in_system text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_url text,
  source_file text,
  seed_version text NOT NULL DEFAULT 'v2',
  version text,
  effective_date date,
  active boolean NOT NULL DEFAULT true,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key)
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  source_key text NOT NULL REFERENCES knowledge_sources(source_key) ON UPDATE CASCADE,
  source_record_id text,
  standard_family text,
  standard_code text,
  clause_or_control text NOT NULL,
  title text NOT NULL,
  domain text,
  item_type text,
  intent_summary text,
  license_class text NOT NULL DEFAULT 'derived_summary',
  use_in_system text[] NOT NULL DEFAULT ARRAY[]::text[],
  search_text text,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  implementation_guidance text,
  evidence_examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  severity_default text,
  lifecycle_state text NOT NULL DEFAULT 'active',
  checksum text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_key)
);

CREATE TABLE IF NOT EXISTS knowledge_evidence_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES knowledge_items(id) ON DELETE CASCADE,
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  expectation_key text,
  description text,
  expectation_text text,
  evidence_type text,
  required_level text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_audit_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES knowledge_items(id) ON DELETE CASCADE,
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  question_key text,
  question text,
  question_text text,
  question_type text NOT NULL DEFAULT 'audit',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_common_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES knowledge_items(id) ON DELETE CASCADE,
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  gap_key text,
  description text,
  gap_text text,
  severity_hint text,
  severity_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_recommended_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES knowledge_items(id) ON DELETE CASCADE,
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  action_key text,
  description text,
  action_text text,
  action_basis text,
  priority_hint text,
  priority_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES knowledge_items(id) ON DELETE CASCADE,
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  rule_key text NOT NULL,
  rule_type text NOT NULL,
  expression jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_text text,
  severity_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_key, rule_key)
);

CREATE TABLE IF NOT EXISTS knowledge_rule_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES knowledge_rules(id) ON DELETE CASCADE,
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  hint_key text,
  hint text,
  hint_text text,
  severity_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES knowledge_items(id) ON DELETE CASCADE,
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  mapping_key text,
  target_type text,
  target_key text,
  entity_type text,
  standard_family text,
  standard_code text,
  clause_or_control text,
  domain text,
  match_weight numeric(5,2) NOT NULL DEFAULT 1,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file text NOT NULL,
  seed_version text NOT NULL DEFAULT 'v2',
  source_sha256 text,
  source_checksum text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  item_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  valid_records integer NOT NULL DEFAULT 0,
  inserted_items integer NOT NULL DEFAULT 0,
  updated_items integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  error_message text,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_document_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  ingestion_status text NOT NULL DEFAULT 'pending',
  ingestion_source text NOT NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, knowledge_document_id, ingestion_source)
);

CREATE TABLE IF NOT EXISTS knowledge_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  scope text NOT NULL DEFAULT 'TENANT',
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  document_version text NOT NULL,
  chunk_ordinal integer NOT NULL,
  chunk_text text NOT NULL,
  text_checksum text NOT NULL,
  page_number integer,
  section_label text,
  heading text,
  source_start_offset integer,
  source_end_offset integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_document_chunks_scope_check CHECK (scope IN ('TENANT','REGULATORY')),
  CONSTRAINT knowledge_document_chunks_scope_tenant_check
    CHECK ((scope='TENANT' AND tenant_id IS NOT NULL) OR (scope='REGULATORY' AND tenant_id IS NULL)),
  CONSTRAINT knowledge_document_chunks_ordinal_check
    CHECK (chunk_ordinal >= 0),
  CONSTRAINT knowledge_document_chunks_text_checksum_check
    CHECK (text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_document_chunks_offsets_check
    CHECK (
      source_start_offset IS NULL
      OR source_end_offset IS NULL
      OR source_end_offset >= source_start_offset
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_document_chunks_scope_document_ordinal
  ON knowledge_document_chunks(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), knowledge_document_id, document_version, chunk_ordinal);

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_document_chunks_tenant_chunk_id
  ON knowledge_document_chunks(tenant_id, id);

CREATE TABLE IF NOT EXISTS knowledge_chunk_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  chunk_id uuid NOT NULL,
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  document_version text NOT NULL,
  embedding_contract_version text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  model_version text NOT NULL,
  dimensions integer NOT NULL,
  input_checksum text NOT NULL,
  embedding_checksum text,
  embedding vector,
  status text NOT NULL DEFAULT 'pending',
  failure_code text,
  failure_message text,
  generated_at timestamptz,
  stale_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_chunk_embeddings_chunk_tenant_fkey
    FOREIGN KEY (tenant_id, chunk_id)
    REFERENCES knowledge_document_chunks(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT knowledge_chunk_embeddings_status_check
    CHECK (status IN ('pending','ready','failed','stale','skipped')),
  CONSTRAINT knowledge_chunk_embeddings_dimensions_check
    CHECK (dimensions > 0 AND dimensions <= 4096),
  CONSTRAINT knowledge_chunk_embeddings_input_checksum_check
    CHECK (input_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_chunk_embeddings_embedding_checksum_check
    CHECK (embedding_checksum IS NULL OR embedding_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_chunk_embeddings_ready_check
    CHECK (
      status <> 'ready'
      OR (embedding IS NOT NULL AND embedding_checksum IS NOT NULL AND generated_at IS NOT NULL)
    ),
  CONSTRAINT knowledge_chunk_embeddings_vector_dimensions_check
    CHECK (embedding IS NULL OR vector_dims(embedding) = dimensions),
  CONSTRAINT knowledge_chunk_embeddings_identity_text_check
    CHECK (
      length(trim(embedding_contract_version)) > 0
      AND length(trim(provider)) > 0
      AND length(trim(model)) > 0
      AND length(trim(model_version)) > 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_chunk_embeddings_identity
  ON knowledge_chunk_embeddings(
    tenant_id,
    chunk_id,
    embedding_contract_version,
    provider,
    model,
    model_version,
    dimensions,
    input_checksum
  );

CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embeddings_tenant_status
  ON knowledge_chunk_embeddings(
    tenant_id,
    status,
    embedding_contract_version,
    provider,
    model,
    model_version,
    dimensions
  );

CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embeddings_chunk
  ON knowledge_chunk_embeddings(tenant_id, chunk_id, status);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embeddings_document
  ON knowledge_chunk_embeddings(tenant_id, knowledge_document_id, document_version, status);



CREATE TABLE IF NOT EXISTS regulatory_authoritative_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  scope text NOT NULL DEFAULT 'JURISDICTIONAL',
  tenant_id uuid,
  authority_classification text NOT NULL,
  authority_type text NOT NULL,
  jurisdiction text NOT NULL,
  country_region text,
  issuing_authority text NOT NULL,
  official_name text NOT NULL,
  stable_identifier text NOT NULL,
  official_domain text NOT NULL,
  official_source_uri text NOT NULL,
  allowed_ingestion_method text NOT NULL,
  content_type text,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_to timestamptz,
  owner text NOT NULL DEFAULT 'CODEX_B_REGULATORY',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_successful_fetch_at timestamptz,
  health_status text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_authoritative_sources_scope_check
    CHECK (scope IN ('GLOBAL','JURISDICTIONAL','TENANT_PRIVATE')),
  CONSTRAINT regulatory_authoritative_sources_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','JURISDICTIONAL') AND tenant_id IS NULL)
    ),
  CONSTRAINT regulatory_authoritative_sources_classification_check
    CHECK (authority_classification IN ('AUTHORITATIVE','APPROVED_REFERENCE','INFORMATIONAL')),
  CONSTRAINT regulatory_authoritative_sources_method_check
    CHECK (allowed_ingestion_method IN ('manual_upload','official_url_fetch','api','registry_reference')),
  CONSTRAINT regulatory_authoritative_sources_status_check
    CHECK (status IN ('draft','active','deprecated','rejected','error')),
  CONSTRAINT regulatory_authoritative_sources_health_check
    CHECK (health_status IN ('unknown','healthy','degraded','unreachable','not_checked')),
  CONSTRAINT regulatory_authoritative_sources_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS regulatory_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  scope text NOT NULL DEFAULT 'REGULATORY',
  tenant_id uuid,
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  regulation_source_identifier text NOT NULL,
  version_identifier text NOT NULL,
  retrieved_uri text NOT NULL,
  original_artifact_reference text,
  original_artifact_checksum text,
  extracted_text_reference text,
  extracted_text_checksum text,
  content_checksum text NOT NULL,
  acquired_at timestamptz NOT NULL,
  publication_date date,
  effective_from timestamptz,
  effective_to timestamptz,
  ingestion_contract_version text NOT NULL,
  parser_version text NOT NULL,
  extraction_method text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'active',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_ingestions_scope_check
    CHECK (scope IN ('REGULATORY','TENANT_PRIVATE')),
  CONSTRAINT regulatory_ingestions_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope='REGULATORY' AND tenant_id IS NULL)
    ),
  CONSTRAINT regulatory_ingestions_status_check
    CHECK (lifecycle_status IN ('draft','active','deprecated','rejected','error')),
  CONSTRAINT regulatory_ingestions_original_checksum_check
    CHECK (original_artifact_checksum IS NULL OR original_artifact_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_ingestions_extracted_checksum_check
    CHECK (extracted_text_checksum IS NULL OR extracted_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_ingestions_content_checksum_check
    CHECK (content_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_ingestions_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_key text NOT NULL,
  scope text NOT NULL DEFAULT 'JURISDICTIONAL',
  tenant_id uuid,
  jurisdiction text NOT NULL,
  source_id uuid NOT NULL REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  issuing_authority text NOT NULL,
  official_identifier text NOT NULL,
  official_title text NOT NULL,
  regulation_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulations_scope_check
    CHECK (scope IN ('GLOBAL','JURISDICTIONAL','TENANT_PRIVATE')),
  CONSTRAINT regulations_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','JURISDICTIONAL') AND tenant_id IS NULL)
    ),
  CONSTRAINT regulations_status_check
    CHECK (status IN ('draft','reviewed','published','deprecated','rejected','error'))
);

CREATE TABLE IF NOT EXISTS regulation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  regulatory_ingestion_id uuid REFERENCES regulatory_ingestions(id) ON DELETE SET NULL,
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  version_identifier text NOT NULL,
  publication_date date,
  effective_from timestamptz,
  effective_to timestamptz,
  content_checksum text NOT NULL,
  supersedes_version_id uuid REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulation_versions_status_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT regulation_versions_content_checksum_check
    CHECK (content_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulation_versions_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS legal_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  regulation_version_id uuid NOT NULL REFERENCES regulation_versions(id) ON DELETE CASCADE,
  obligation_key text NOT NULL,
  reference text,
  obligation_text text NOT NULL,
  obligation_text_checksum text NOT NULL,
  subject text,
  action_type text,
  requirement_summary text,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  source_chunk_id uuid REFERENCES knowledge_document_chunks(id) ON DELETE SET NULL,
  source_text_checksum text,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_obligations_status_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT legal_obligations_text_checksum_check
    CHECK (obligation_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT legal_obligations_source_checksum_check
    CHECK (source_text_checksum IS NULL OR source_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT legal_obligations_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS regulatory_semantic_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_diff_key text NOT NULL UNIQUE,
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  from_version_id uuid NOT NULL REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  to_version_id uuid NOT NULL REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  from_knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  to_knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  contract_version text NOT NULL,
  comparison_method text NOT NULL,
  structural_checksum text NOT NULL,
  content_checksum text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  ai_interpretation_status text NOT NULL DEFAULT 'not_used',
  human_review_status text NOT NULL DEFAULT 'pending_review',
  publication_status text NOT NULL DEFAULT 'not_published',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_semantic_diffs_version_order_check
    CHECK (from_version_id <> to_version_id),
  CONSTRAINT regulatory_semantic_diffs_checksum_check
    CHECK (structural_checksum ~ '^[a-f0-9]{64}$' AND content_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_semantic_diffs_status_check
    CHECK (status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT regulatory_semantic_diffs_ai_status_check
    CHECK (ai_interpretation_status IN ('not_used','draft','pending_review','reviewed','rejected')),
  CONSTRAINT regulatory_semantic_diffs_human_review_check
    CHECK (human_review_status IN ('pending_review','reviewed','rejected')),
  CONSTRAINT regulatory_semantic_diffs_publication_check
    CHECK (publication_status IN ('not_published','published','superseded'))
);

CREATE TABLE IF NOT EXISTS regulatory_semantic_diff_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_diff_id uuid NOT NULL REFERENCES regulatory_semantic_diffs(id) ON DELETE CASCADE,
  change_key text NOT NULL,
  change_type text NOT NULL,
  object_type text NOT NULL,
  from_object_id uuid,
  to_object_id uuid,
  from_reference text,
  to_reference text,
  from_checksum text,
  to_checksum text,
  similarity numeric(8,6),
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  temporal_semantics jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_semantic_diff_changes_type_check
    CHECK (change_type IN ('added','removed','modified','moved','unchanged','unaffected')),
  CONSTRAINT regulatory_semantic_diff_changes_object_check
    CHECK (object_type IN ('text_section','legal_obligation','version_temporality','reference_scope')),
  CONSTRAINT regulatory_semantic_diff_changes_checksum_check
    CHECK (
      (from_checksum IS NULL OR from_checksum ~ '^[a-f0-9]{64}$')
      AND (to_checksum IS NULL OR to_checksum ~ '^[a-f0-9]{64}$')
    ),
  CONSTRAINT regulatory_semantic_diff_changes_review_check
    CHECK (review_status IN ('pending_review','reviewed','rejected'))
);

CREATE TABLE IF NOT EXISTS regulatory_obligation_change_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_diff_id uuid NOT NULL REFERENCES regulatory_semantic_diffs(id) ON DELETE CASCADE,
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  from_version_id uuid REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  to_version_id uuid REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  previous_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE RESTRICT,
  next_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE RESTRICT,
  lineage_type text NOT NULL,
  lineage_key text NOT NULL,
  evidence_change_id uuid REFERENCES regulatory_semantic_diff_changes(id) ON DELETE SET NULL,
  contract_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_obligation_lineage_type_check
    CHECK (lineage_type IN ('added','modified','removed','deprecated','unchanged','unaffected')),
  CONSTRAINT regulatory_obligation_lineage_review_check
    CHECK (review_status IN ('pending_review','reviewed','rejected'))
);

CREATE TABLE IF NOT EXISTS regulatory_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_key text NOT NULL,
  scope text NOT NULL DEFAULT 'JURISDICTIONAL',
  tenant_id uuid,
  jurisdiction text,
  domain text,
  subject text,
  display_name text NOT NULL,
  description text,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  owner text NOT NULL DEFAULT 'CODEX_B_REGULATORY',
  model_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_packs_scope_check
    CHECK (scope IN ('GLOBAL','JURISDICTIONAL','TENANT_PRIVATE')),
  CONSTRAINT regulatory_packs_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','JURISDICTIONAL') AND tenant_id IS NULL)
    ),
  CONSTRAINT regulatory_packs_lifecycle_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error'))
);

CREATE TABLE IF NOT EXISTS regulatory_pack_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulatory_pack_id uuid NOT NULL REFERENCES regulatory_packs(id) ON DELETE CASCADE,
  version_identifier text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_to timestamptz,
  supersedes_pack_version_id uuid REFERENCES regulatory_pack_versions(id) ON DELETE RESTRICT,
  composition_checksum text NOT NULL,
  source_registry_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  regulation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  regulation_version_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  obligation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  contract_version text NOT NULL,
  activation_contract_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_versions_lifecycle_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT regulatory_pack_versions_checksum_check
    CHECK (composition_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_pack_versions_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS regulatory_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulatory_pack_version_id uuid NOT NULL REFERENCES regulatory_pack_versions(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_type text NOT NULL,
  source_id uuid REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  regulation_id uuid REFERENCES regulations(id) ON DELETE CASCADE,
  regulation_version_id uuid REFERENCES regulation_versions(id) ON DELETE CASCADE,
  legal_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE CASCADE,
  semantic_diff_id uuid REFERENCES regulatory_semantic_diffs(id) ON DELETE SET NULL,
  reference text,
  lifecycle_status text NOT NULL DEFAULT 'active',
  effective_from timestamptz,
  effective_to timestamptz,
  applicability_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_items_type_check
    CHECK (item_type IN ('source','regulation','regulation_version','legal_obligation','semantic_diff')),
  CONSTRAINT regulatory_pack_items_lifecycle_check
    CHECK (lifecycle_status IN ('active','inactive','deprecated')),
  CONSTRAINT regulatory_pack_items_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  CONSTRAINT regulatory_pack_items_reference_check
    CHECK (
      (item_type='source' AND source_id IS NOT NULL)
      OR (item_type='regulation' AND regulation_id IS NOT NULL)
      OR (item_type='regulation_version' AND regulation_version_id IS NOT NULL)
      OR (item_type='legal_obligation' AND legal_obligation_id IS NOT NULL)
      OR (item_type='semantic_diff' AND semantic_diff_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS regulatory_pack_tenant_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  regulatory_pack_id uuid NOT NULL REFERENCES regulatory_packs(id) ON DELETE CASCADE,
  regulatory_pack_version_id uuid NOT NULL REFERENCES regulatory_pack_versions(id) ON DELETE CASCADE,
  activation_status text NOT NULL DEFAULT 'draft',
  activated_at timestamptz,
  deactivated_at timestamptz,
  configured_by uuid,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  activation_contract_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_activation_status_check
    CHECK (activation_status IN ('draft','active','paused','deprecated','rejected')),
  CONSTRAINT regulatory_pack_activation_range_check
    CHECK (deactivated_at IS NULL OR activated_at IS NULL OR deactivated_at > activated_at)
);

CREATE TABLE IF NOT EXISTS regulatory_pack_applicability_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  regulatory_pack_id uuid NOT NULL REFERENCES regulatory_packs(id) ON DELETE CASCADE,
  regulatory_pack_version_id uuid NOT NULL REFERENCES regulatory_pack_versions(id) ON DELETE CASCADE,
  activation_id uuid REFERENCES regulatory_pack_tenant_activations(id) ON DELETE SET NULL,
  evaluation_key text NOT NULL,
  evaluation_status text NOT NULL DEFAULT 'draft',
  recommendation text NOT NULL,
  confidence numeric(8,6) NOT NULL DEFAULT 0,
  human_confirmation_required boolean NOT NULL DEFAULT true,
  contract_version text NOT NULL,
  evaluated_by uuid,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  inputs_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_applicability_status_check
    CHECK (evaluation_status IN ('draft','reviewed','confirmed','rejected','error')),
  CONSTRAINT regulatory_pack_applicability_recommendation_check
    CHECK (recommendation IN ('applicable','not_applicable','needs_review','insufficient_data')),
  CONSTRAINT regulatory_pack_applicability_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS regulatory_pack_applicability_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicability_evaluation_id uuid NOT NULL REFERENCES regulatory_pack_applicability_evaluations(id) ON DELETE CASCADE,
  regulatory_pack_item_id uuid REFERENCES regulatory_pack_items(id) ON DELETE SET NULL,
  legal_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE SET NULL,
  recommendation text NOT NULL,
  confidence numeric(8,6) NOT NULL DEFAULT 0,
  human_confirmation_required boolean NOT NULL DEFAULT true,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_applicability_result_recommendation_check
    CHECK (recommendation IN ('applicable','not_applicable','needs_review','insufficient_data')),
  CONSTRAINT regulatory_pack_applicability_result_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS regulatory_governance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  object_type text NOT NULL,
  object_id uuid,
  previous_state jsonb,
  new_state jsonb,
  contract_version text NOT NULL,
  source_id uuid REFERENCES regulatory_authoritative_sources(id) ON DELETE SET NULL,
  regulation_id uuid REFERENCES regulations(id) ON DELETE SET NULL,
  regulation_version_id uuid REFERENCES regulation_versions(id) ON DELETE SET NULL,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_connector_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  version text NOT NULL,
  display_name text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, version)
);

CREATE TABLE IF NOT EXISTS grc_connector_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  definition_id uuid REFERENCES grc_connector_definitions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, display_name)
);

CREATE TABLE IF NOT EXISTS grc_connector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_instance_id uuid REFERENCES grc_connector_instances(id) ON DELETE SET NULL,
  run_status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_escalation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_key text NOT NULL,
  display_name text NOT NULL,
  trigger_type text NOT NULL,
  severity text,
  status text NOT NULL DEFAULT 'active',
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_key)
);

CREATE TABLE IF NOT EXISTS grc_escalation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES grc_escalation_policies(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_id uuid,
  status text NOT NULL DEFAULT 'open',
  severity text,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_evidence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid REFERENCES tenant_controls(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_audit_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES findings(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_operational_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  suggestion_key text NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  title text NOT NULL,
  recommendation text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, suggestion_key)
);

CREATE TABLE IF NOT EXISTS iso_recommended_action_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  suggestion_id uuid REFERENCES iso_operational_suggestions(id) ON DELETE SET NULL,
  action_plan_id uuid REFERENCES action_plans(id) ON DELETE SET NULL,
  conversion_status text NOT NULL DEFAULT 'proposed',
  converted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_decision_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  suggestion_id uuid REFERENCES iso_operational_suggestions(id) ON DELETE SET NULL,
  conversion_id uuid REFERENCES iso_recommended_action_conversions(id) ON DELETE SET NULL,
  decision_key text NOT NULL,
  decision text NOT NULL,
  decision_reason text,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, decision_key)
);

CREATE TABLE IF NOT EXISTS recommendation_effectiveness_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ledger_id uuid REFERENCES recommendation_decision_ledger(id) ON DELETE SET NULL,
  conversion_id uuid REFERENCES iso_recommended_action_conversions(id) ON DELETE SET NULL,
  evaluation_key text NOT NULL,
  effectiveness_state text NOT NULL,
  score numeric(5,2),
  evaluated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, evaluation_key)
);

CREATE TABLE IF NOT EXISTS operational_memory_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  case_type text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  learned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, case_key)
);

CREATE TABLE IF NOT EXISTS operational_memory_case_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES operational_memory_cases(id) ON DELETE CASCADE,
  related_entity_type text NOT NULL,
  related_entity_id uuid NOT NULL,
  relation_type text NOT NULL DEFAULT 'related_to',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, related_entity_type, related_entity_id, relation_type)
);

CREATE TABLE IF NOT EXISTS ai_prompt_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_type text NOT NULL,
  source_module text,
  source_entity_type text,
  source_entity_id uuid,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  error_message text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ai_query_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid,
  request_kind text NOT NULL,
  status text NOT NULL DEFAULT 'accepted',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS dbn01_control_identity_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id text NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  previous_tenant_control_id uuid,
  new_tenant_control_id uuid,
  catalog_control_id uuid,
  resolution_source text NOT NULL,
  decision_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (migration_id, table_name, record_id)
);

CREATE OR REPLACE FUNCTION tcdx_security.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.tenant_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN current_setting('app.tenant_id', true)::uuid
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION tcdx_security.platform_scope_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(COALESCE(current_setting('app.platform_scope', true), 'false')) IN ('1', 'true', 'on', 'yes')
$$;

CREATE OR REPLACE FUNCTION tcdx_security.tenant_visible(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT tcdx_security.platform_scope_enabled()
      OR row_tenant_id = tcdx_security.current_tenant_id()
$$;

CREATE OR REPLACE FUNCTION tcdx_security.tenant_write_allowed(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT row_tenant_id = tcdx_security.current_tenant_id()
$$;

CREATE OR REPLACE FUNCTION dbn02_normalize_health_component_state(
  raw_state text,
  has_numeric boolean DEFAULT false,
  effective_at timestamptz DEFAULT NULL,
  stale_after interval DEFAULT NULL,
  as_of timestamptz DEFAULT now()
) RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(trim(coalesce(raw_state, '')));
  IF normalized = ANY (ARRAY['calculated','completed','available','measured']) THEN
    IF effective_at IS NOT NULL AND stale_after IS NOT NULL AND effective_at + stale_after < as_of THEN
      RETURN 'STALE';
    END IF;
    RETURN 'AVAILABLE';
  END IF;
  IF normalized = ANY (ARRAY['not_applicable','excluded']) THEN
    RETURN 'NOT_APPLICABLE';
  END IF;
  IF normalized = ANY (ARRAY['stale','stale_source']) THEN
    RETURN 'STALE';
  END IF;
  IF normalized = ANY (ARRAY['failed','source_incompatible','technical_error','validation_failed','invalid']) THEN
    RETURN 'INVALID';
  END IF;
  IF normalized = ANY (ARRAY['not_configured','configuration_missing']) THEN
    RETURN 'NOT_CONFIGURED';
  END IF;
  IF normalized = ANY (ARRAY['dependency_pending','unmeasured','insufficient_data','insufficient_coverage','source_unavailable','not_calculable','missing']) THEN
    RETURN 'MISSING';
  END IF;
  RETURN 'UNKNOWN';
END $$;

CREATE OR REPLACE FUNCTION dbn02_grc_health_publication_state(
  coverage numeric,
  minimum_coverage numeric DEFAULT 0.80,
  score numeric DEFAULT NULL
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN score IS NULL THEN 'not_calculable'
    WHEN COALESCE(coverage, 0) >= COALESCE(minimum_coverage, 0.80) THEN 'measured'
    ELSE 'insufficient_coverage'
  END;
$$;

CREATE OR REPLACE FUNCTION dbn02_resolve_control_standard_code(
  p_tenant_id uuid,
  p_tenant_control_id uuid
) RETURNS TABLE (
  canonical_standard_code text,
  catalog_control_id uuid,
  standard_source text,
  lineage_status text
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT tc.tenant_id, tc.control_id AS catalog_control_id, cc.iso AS catalog_iso, cc.is_active AS catalog_is_active
    FROM tenant_controls tc
    JOIN controls_catalog cc ON cc.id = tc.control_id
    WHERE tc.tenant_id = p_tenant_id AND tc.id = p_tenant_control_id
  ), candidates AS (
    SELECT ccs.standard_code, b.catalog_control_id,
           'tenant_controls.control_id->controls_catalog_standards.standard_code->tenant_standards.active'::text AS source,
           1 AS priority, ccs.is_primary
    FROM base b
    JOIN controls_catalog_standards ccs ON ccs.control_id = b.catalog_control_id
    JOIN tenant_standards ts ON ts.tenant_id = b.tenant_id
      AND ts.standard_code = ccs.standard_code
      AND ts.is_active IS TRUE
      AND lower(coalesce(ts.lifecycle_status, 'active')) NOT IN ('inactive','retired','deactivated','permanently_deactivated')
    WHERE b.catalog_is_active IS TRUE
    UNION ALL
    SELECT b.catalog_iso, b.catalog_control_id,
           'tenant_controls.control_id->controls_catalog.iso->tenant_standards.active'::text AS source,
           2 AS priority, true
    FROM base b
    JOIN tenant_standards ts ON ts.tenant_id = b.tenant_id
      AND ts.standard_code = b.catalog_iso
      AND ts.is_active IS TRUE
      AND lower(coalesce(ts.lifecycle_status, 'active')) NOT IN ('inactive','retired','deactivated','permanently_deactivated')
    WHERE b.catalog_is_active IS TRUE
  ), ranked AS (
    SELECT DISTINCT ON (standard_code) standard_code, catalog_control_id, source, priority, is_primary
    FROM candidates
    ORDER BY standard_code, priority, is_primary DESC
  ), summary AS (
    SELECT count(*)::int AS candidate_count FROM ranked
  )
  SELECT
    CASE WHEN summary.candidate_count = 1 THEN ranked.standard_code END,
    base.catalog_control_id,
    CASE WHEN summary.candidate_count = 1 THEN ranked.source END,
    CASE
      WHEN base.catalog_control_id IS NULL THEN 'TENANT_CONTROL_NOT_FOUND'
      WHEN summary.candidate_count = 1 THEN 'RESOLVED'
      WHEN summary.candidate_count > 1 THEN 'AMBIGUOUS_STANDARD'
      ELSE 'NO_ACTIVE_TENANT_STANDARD'
    END
  FROM base
  CROSS JOIN summary
  LEFT JOIN ranked ON summary.candidate_count = 1;
$$;

CREATE OR REPLACE VIEW tcdx_security.dbn04_rls_runtime_readiness AS
WITH pilot_tables(schema_name, table_name) AS (
  VALUES
    ('public', 'tenant_controls'),
    ('public', 'findings'),
    ('public', 'evidences'),
    ('public', 'action_plans')
),
policy_state AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls_enabled,
    count(p.polname) FILTER (WHERE p.polname LIKE 'dbn03_tenant_isolation_%') AS staged_policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE c.relkind IN ('r', 'p')
  GROUP BY n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
)
SELECT
  p.schema_name,
  p.table_name,
  COALESCE(s.rls_enabled, false) AS rls_enabled,
  COALESCE(s.force_rls_enabled, false) AS force_rls_enabled,
  COALESCE(s.staged_policy_count, 0) AS staged_policy_count,
  to_regprocedure('tcdx_security.current_tenant_id()') IS NOT NULL
    AND to_regprocedure('tcdx_security.platform_scope_enabled()') IS NOT NULL
    AND to_regprocedure('tcdx_security.tenant_visible(uuid)') IS NOT NULL
    AND to_regprocedure('tcdx_security.tenant_write_allowed(uuid)') IS NOT NULL
    AS db_context_functions_ready,
  CASE
    WHEN COALESCE(s.staged_policy_count, 0) > 0 THEN 'POLICY_STAGED_RLS_DISABLED'
    ELSE 'POLICY_MISSING'
  END AS readiness_state
FROM pilot_tables p
LEFT JOIN policy_state s
  ON s.schema_name = p.schema_name
 AND s.table_name = p.table_name
ORDER BY p.schema_name, p.table_name;

CREATE OR REPLACE VIEW ai_core.v_tenant_health_context AS
SELECT
  ms.tenant_id,
  ms.metric_code,
  ms.numeric_value,
  ms.publication_state,
  ms.coverage,
  ms.effective_at
FROM metric_snapshots ms
WHERE ms.tenant_id IS NOT NULL
  AND ms.snapshot_status = 'published';

CREATE OR REPLACE VIEW ai_core.v_control_context AS
SELECT
  tc.tenant_id,
  tc.id AS tenant_control_id,
  tc.control_id AS catalog_control_id,
  cc.code,
  cc.title,
  cc.iso AS standard_code,
  tc.implementation_status
FROM tenant_controls tc
JOIN controls_catalog cc ON cc.id = tc.control_id;

CREATE OR REPLACE VIEW ai_core.v_finding_context AS
SELECT tenant_id, id AS finding_id, tenant_control_id, title, severity, status, created_at
FROM findings;

CREATE OR REPLACE VIEW ai_core.v_kpi_context AS
SELECT tenant_id, metric_code, numeric_value, publication_state, coverage, effective_at
FROM metric_snapshots
WHERE tenant_id IS NOT NULL
  AND snapshot_status = 'published';

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
  CASE
    WHEN lcs.publication_state = 'measured' THEN lcs.numeric_value
    ELSE NULL::numeric
  END AS effective_health_score,
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
  ) AS health_trace_json
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

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_controls_tenant ON tenant_controls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_controls_control ON tenant_controls(control_id);
CREATE INDEX IF NOT EXISTS idx_control_soa_assessments_latest ON control_soa_assessments(tenant_id, iso_code, tenant_control_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_control_soa_change_log_tenant ON control_soa_change_log(tenant_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_tenant_control ON findings(tenant_id, tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_evidences_tenant_control ON evidences(tenant_id, tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_tenant_control ON action_plans(tenant_id, tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_finding ON action_plans(tenant_id, finding_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_updates_plan_created ON action_plan_updates(action_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_events_tenant_created ON commercial_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_latest ON metric_snapshots(tenant_id, metric_code, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_tenant ON calculation_runs(tenant_id, formula_version_id);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_tenant_formula ON calculation_runs(tenant_id, formula_code, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_calculation_inputs_run_variable ON calculation_inputs(run_id, variable_name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_calculation_outputs_run_output ON calculation_outputs(run_id, output_name);
CREATE INDEX IF NOT EXISTS idx_calculation_validations_run ON calculation_validations(tenant_id, run_id, severity);
CREATE INDEX IF NOT EXISTS idx_calculation_snapshots_tenant_hash ON calculation_snapshots(tenant_id, snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_async_jobs_next_run ON tcdx_async_jobs(status, next_run_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_source_binding_version
  ON metric_source_bindings (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_key, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_definitions_scope_code
  ON metric_definitions (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_measurements_unique_correlation
  ON metric_measurements (tenant_id, metric_definition_id, period_key, COALESCE(correlation_id, 'manual'));
CREATE INDEX IF NOT EXISTS idx_metric_measurements_metric_period
  ON metric_measurements (tenant_id, metric_definition_id, period_start DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sufficiency_rules_tenant_code_version
  ON metric_sufficiency_rules (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_code, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_thresholds_scope_definition_version_key
  ON metric_thresholds (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_definition_id, version_number, threshold_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_calculation_policies_scope_key_version
  ON metric_calculation_policies (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_key, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_trust_policies_scope_code_version
  ON metric_trust_policies (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), policy_code, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_observations_current_identity
  ON grc_observations (tenant_id, contract_version_id, source_identity_hash)
  WHERE is_current IS TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_snapshots_logical
  ON data_snapshots (tenant_id, snapshot_type, entity_type, entity_id, COALESCE(period_key, ''), source_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_document ON knowledge_document_chunks(tenant_id, knowledge_document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_tenant ON knowledge_document_chunks(tenant_id);


CREATE INDEX IF NOT EXISTS idx_grc_connector_instances_tenant ON grc_connector_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_logs_tenant_created ON ai_prompt_logs(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_snapshot_logical_publish
  ON metric_snapshots (tenant_id, metric_definition_id, period_key, content_hash)
  ;
CREATE INDEX IF NOT EXISTS idx_metric_action_proposals_status
  ON metric_action_proposals(tenant_id, status, priority, proposed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_comparison_unique
  ON data_comparisons (tenant_id, baseline_metric_snapshot_id, current_metric_snapshot_id, comparison_type, COALESCE(metric_definition_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE baseline_metric_snapshot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_target_comparison_unique
  ON data_comparisons (tenant_id, current_metric_snapshot_id, target_value, COALESCE(metric_definition_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE comparison_type='target' AND baseline_metric_snapshot_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dbn05_official_formula_definitions_global
  ON official_formula_definitions(formula_code)
  WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dbn05_official_formula_versions_global
  ON official_formula_versions(formula_code, version)
  WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dbn05_official_formula_source_contracts_global
  ON official_formula_source_contracts(source_code, contract_version)
  WHERE tenant_id IS NULL;

DO $$
DECLARE
  table_name text;
BEGIN
	  FOREACH table_name IN ARRAY ARRAY['tenant_controls','findings','evidences','action_plans','control_soa_assessments','control_soa_change_log']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = 'dbn03_tenant_isolation_' || table_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I USING (tcdx_security.tenant_visible(tenant_id)) WITH CHECK (tcdx_security.tenant_write_allowed(tenant_id))',
        'dbn03_tenant_isolation_' || table_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON VIEW tcdx_security.dbn04_rls_runtime_readiness IS
  'DB-N05 inherits DB-N04 RLS readiness posture: policies staged, broad RLS disabled until ai_reader is tenant-safe.';
COMMENT ON SCHEMA ai_core IS
  'DB-N05 AI read schema keeps tenant-bearing views but does not grant ai_reader direct read while broad RLS remains deferred.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_sources_scope_key
  ON regulatory_authoritative_sources(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), source_key);
CREATE INDEX IF NOT EXISTS idx_regulatory_sources_jurisdiction
  ON regulatory_authoritative_sources(jurisdiction, authority_classification, status);
CREATE INDEX IF NOT EXISTS idx_regulatory_sources_stable_identifier
  ON regulatory_authoritative_sources(stable_identifier);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_ingestions_source_version_checksum
  ON regulatory_ingestions(source_id, regulation_source_identifier, version_identifier, content_checksum);
CREATE INDEX IF NOT EXISTS idx_regulatory_ingestions_document
  ON regulatory_ingestions(knowledge_document_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_ingestions_source_acquired
  ON regulatory_ingestions(source_id, acquired_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulations_scope_key
  ON regulations(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), regulation_key);
CREATE INDEX IF NOT EXISTS idx_regulations_jurisdiction
  ON regulations(jurisdiction, status);
CREATE INDEX IF NOT EXISTS idx_regulations_source
  ON regulations(source_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulation_versions_identity
  ON regulation_versions(regulation_id, version_identifier);
CREATE INDEX IF NOT EXISTS idx_regulation_versions_regulation_status
  ON regulation_versions(regulation_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_regulation_versions_document
  ON regulation_versions(knowledge_document_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_legal_obligations_version_key
  ON legal_obligations(regulation_version_id, obligation_key);
CREATE INDEX IF NOT EXISTS idx_legal_obligations_regulation
  ON legal_obligations(regulation_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_legal_obligations_version
  ON legal_obligations(regulation_version_id);
CREATE INDEX IF NOT EXISTS idx_legal_obligations_effective
  ON legal_obligations(lifecycle_status, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_regulatory_semantic_diffs_regulation
  ON regulatory_semantic_diffs(regulation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_semantic_diffs_versions
  ON regulatory_semantic_diffs(from_version_id, to_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_semantic_diff_changes_key
  ON regulatory_semantic_diff_changes(semantic_diff_id, change_key);
CREATE INDEX IF NOT EXISTS idx_regulatory_semantic_diff_changes_type
  ON regulatory_semantic_diff_changes(object_type, change_type);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_obligation_change_lineage_key
  ON regulatory_obligation_change_lineage(semantic_diff_id, lineage_key);
CREATE INDEX IF NOT EXISTS idx_regulatory_obligation_change_lineage_regulation
  ON regulatory_obligation_change_lineage(regulation_id, lineage_type);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_packs_scope_key
  ON regulatory_packs(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), pack_key);
CREATE INDEX IF NOT EXISTS idx_regulatory_packs_filters
  ON regulatory_packs(scope, jurisdiction, domain, lifecycle_status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_versions_identity
  ON regulatory_pack_versions(regulatory_pack_id, version_identifier);
CREATE INDEX IF NOT EXISTS idx_regulatory_pack_versions_status
  ON regulatory_pack_versions(lifecycle_status, effective_from, effective_to);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_items_key
  ON regulatory_pack_items(regulatory_pack_version_id, item_key);
CREATE INDEX IF NOT EXISTS idx_regulatory_pack_items_targets
  ON regulatory_pack_items(item_type, regulation_id, regulation_version_id, legal_obligation_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_tenant_activation
  ON regulatory_pack_tenant_activations(tenant_id, regulatory_pack_version_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_pack_tenant_activation_status
  ON regulatory_pack_tenant_activations(tenant_id, activation_status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_applicability_evaluation
  ON regulatory_pack_applicability_evaluations(tenant_id, regulatory_pack_version_id, evaluation_key);
CREATE INDEX IF NOT EXISTS idx_regulatory_pack_applicability_tenant
  ON regulatory_pack_applicability_evaluations(tenant_id, recommendation, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_pack_applicability_results_evaluation
  ON regulatory_pack_applicability_results(applicability_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_governance_audit_object
  ON regulatory_governance_audit(object_type, object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_governance_audit_tenant
  ON regulatory_governance_audit(tenant_id, created_at DESC);

GRANT USAGE ON SCHEMA public, tcdx_security, ai_core TO tcdx_backend_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA tcdx_security REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION
  tcdx_security.current_tenant_id(),
  tcdx_security.platform_scope_enabled(),
  tcdx_security.tenant_visible(uuid),
  tcdx_security.tenant_write_allowed(uuid),
  dbn02_normalize_health_component_state(text, boolean, timestamptz, interval, timestamptz),
  dbn02_grc_health_publication_state(numeric, numeric, numeric),
  dbn02_resolve_control_standard_code(uuid, uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  tcdx_security.current_tenant_id(),
  tcdx_security.platform_scope_enabled(),
  tcdx_security.tenant_visible(uuid),
  tcdx_security.tenant_write_allowed(uuid),
  dbn02_normalize_health_component_state(text, boolean, timestamptz, interval, timestamptz),
  dbn02_grc_health_publication_state(numeric, numeric, numeric),
  dbn02_resolve_control_standard_code(uuid, uuid)
TO tcdx_backend_runtime;
GRANT SELECT ON app_roles, permissions, role_permissions, standards, controls_catalog, controls_catalog_standards,
  commercial_plans, commercial_plan_versions, commercial_technical_capabilities, plan_version_capabilities,
  official_formula_definitions, official_formula_versions, official_formula_source_contracts,
  data_source_contracts, data_source_contract_versions, data_source_field_mappings,
  usage_limit_definitions, metric_job_policies,
  grc_connector_definitions, grc_gap_rules, knowledge_sources, knowledge_items,
  regulatory_authoritative_sources, regulations, legal_obligations, regulatory_packs TO tcdx_backend_runtime;
GRANT SELECT ON public.v_iso_control_effective_health TO tcdx_backend_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, tenant_standards, tenant_controls, control_soa, control_soa_assessments,
  control_soa_change_log, findings, evidences, action_plans, action_plan_updates,
  grc_readiness_snapshots, grc_readiness_results, grc_readiness_findings,
  metric_source_bindings, calculation_runs, calculation_inputs, calculation_validations, calculation_snapshots, metric_snapshots,
  tenant_usage_limits, commercial_events, metric_sufficiency_rules, metric_interpretations, metric_action_proposals, data_comparisons,
  audit_event_log, data_snapshots, data_lineage_edges, grc_observations, grc_observation_relations,
  grc_gaps, grc_gap_status_history, grc_gap_hypotheses, metric_definitions, metric_formula_versions,
  metric_definition_versions, metric_thresholds, metric_calculation_policies, metric_trust_policies,
  metric_measurements, metric_trust_assessments, knowledge_documents, knowledge_document_ingestions,
  knowledge_document_chunks, knowledge_chunk_embeddings, regulatory_ingestions, regulation_versions,
  regulatory_semantic_diffs, regulatory_semantic_diff_changes, regulatory_obligation_change_lineage,
  regulatory_pack_versions, regulatory_pack_items, regulatory_pack_tenant_activations,
  regulatory_pack_applicability_evaluations, regulatory_pack_applicability_results, regulatory_governance_audit,
  grc_connector_instances, grc_connector_runs, grc_escalation_policies, grc_escalation_events,
  grc_evidence_requests, grc_audit_followups, iso_operational_suggestions,
  iso_recommended_action_conversions, recommendation_decision_ledger,
  recommendation_effectiveness_evaluations, operational_memory_cases, operational_memory_case_links,
  ai_prompt_logs, ai_query_audit TO tcdx_backend_runtime;
-- Active job persistence and official calculation output readers/writers.
GRANT SELECT, INSERT, UPDATE, DELETE ON tcdx_async_jobs, calculation_outputs TO tcdx_backend_runtime;
GRANT USAGE ON SCHEMA public, tcdx_security, ai_core TO tcdx_platform_runtime;
GRANT EXECUTE ON FUNCTION
  tcdx_security.current_tenant_id(),
  tcdx_security.platform_scope_enabled(),
  tcdx_security.tenant_visible(uuid),
  tcdx_security.tenant_write_allowed(uuid)
TO tcdx_platform_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_roles, permissions, role_permissions, standards, controls_catalog,
  controls_catalog_standards, commercial_plans, commercial_plan_versions, commercial_technical_capabilities,
  plan_version_capabilities, official_formula_definitions, official_formula_versions,
  official_formula_source_contracts, data_source_contracts, data_source_contract_versions,
  data_source_field_mappings, usage_limit_definitions, metric_job_policies,
  grc_connector_definitions, grc_gap_rules, regulatory_authoritative_sources,
  regulatory_packs TO tcdx_platform_runtime;
GRANT SELECT ON tenants, users, tenant_standards, tenant_controls, findings, evidences, action_plans,
  action_plan_updates,
  grc_readiness_snapshots, grc_readiness_results, grc_readiness_findings,
  metric_source_bindings, calculation_runs, calculation_inputs, calculation_validations, calculation_snapshots, metric_snapshots,
  usage_limit_definitions, tenant_usage_limits, commercial_events, metric_sufficiency_rules, metric_interpretations,
  metric_action_proposals, data_comparisons, metric_job_policies,
  audit_event_log, data_snapshots, data_lineage_edges, grc_observations, grc_observation_relations,
  grc_gaps, grc_gap_status_history, grc_gap_hypotheses, metric_definitions, metric_formula_versions,
  metric_definition_versions, metric_thresholds, metric_calculation_policies, metric_trust_policies,
  metric_measurements, metric_trust_assessments, knowledge_documents, knowledge_sources, knowledge_items,
  knowledge_document_ingestions, knowledge_document_chunks, knowledge_chunk_embeddings,
  regulatory_ingestions, regulations, regulation_versions, legal_obligations, regulatory_semantic_diffs,
  regulatory_semantic_diff_changes, regulatory_obligation_change_lineage, regulatory_pack_versions,
  regulatory_pack_items, regulatory_pack_tenant_activations, regulatory_pack_applicability_evaluations,
  regulatory_pack_applicability_results, regulatory_governance_audit, grc_connector_instances,
  grc_connector_runs, grc_escalation_policies, grc_escalation_events, grc_evidence_requests,
  grc_audit_followups, iso_operational_suggestions, iso_recommended_action_conversions,
  recommendation_decision_ledger, recommendation_effectiveness_evaluations, operational_memory_cases,
  operational_memory_case_links, ai_prompt_logs, ai_query_audit TO tcdx_readonly_support;
GRANT USAGE ON SCHEMA tcdx_security TO ai_reader;

-- Runtime may read governed references; only migration/admin loads their content.
GRANT SELECT ON iso_standards, iso_standard_versions, iso_controls, iso_evidence_expectations
  TO tcdx_backend_runtime, tcdx_platform_runtime, tcdx_readonly_support;

COMMIT;
