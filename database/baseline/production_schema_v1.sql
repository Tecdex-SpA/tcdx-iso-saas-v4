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
  service_status text NOT NULL DEFAULT 'active' CHECK (service_status IN ('active','trialing','past_due','suspended','suspended_non_payment','deleted','cancelled')),
  suspended_at timestamptz,
  suspension_reason text,
  deleted_at timestamptz,
  deletion_reason text,
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
  version_number integer NOT NULL DEFAULT 1,
  effective_from timestamptz,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','retired')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_key, version)
);

CREATE TABLE IF NOT EXISTS saas_modules (
  module_key text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 500,
  status text NOT NULL DEFAULT 'active',
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

CREATE TABLE IF NOT EXISTS plan_version_capabilities (
  plan_version_id uuid NOT NULL REFERENCES commercial_plan_versions(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES commercial_technical_capabilities(capability_key) ON DELETE CASCADE,
  is_included boolean NOT NULL DEFAULT true,
  PRIMARY KEY (plan_version_id, capability_key)
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_version_id uuid REFERENCES commercial_plan_versions(id) ON DELETE SET NULL,
  plan_key text NOT NULL REFERENCES commercial_plans(plan_key),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','suspended','cancelled','expired','replaced')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_subscription_id uuid REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
  addon_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','expired','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
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
  code text GENERATED ALWAYS AS (standard_code) STORED,
  family text NOT NULL,
  display_name text NOT NULL,
  name text GENERATED ALWAYS AS (display_name) STORED,
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
  catalog_mode text NOT NULL DEFAULT 'generic' CHECK (catalog_mode IN ('generic','personalized','mixed')),
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active',
  initialized_at timestamptz,
  contracted_at timestamptz,
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  paused_at timestamptz,
  permanently_deactivated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  process_id uuid,
  operation_key text NOT NULL DEFAULT ('operation-' || replace(gen_random_uuid()::text, '-', '')),
  code text,
  name text NOT NULL,
  description text,
  operation_type text NOT NULL DEFAULT 'business_process',
  frequency text,
  status text NOT NULL DEFAULT 'active',
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_key),
  UNIQUE (tenant_id, id)
);

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
  asset_key text NOT NULL DEFAULT ('asset-' || replace(gen_random_uuid()::text, '-', '')),
  name text NOT NULL,
  type text,
  iso text REFERENCES standards(standard_code),
  criticality text NOT NULL DEFAULT 'medium',
  owner text,
  owner_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asset_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS asset_standards (
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, standard_code)
);

CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_key text NOT NULL DEFAULT ('audit-' || replace(gen_random_uuid()::text, '-', '')),
  iso text REFERENCES standards(standard_code),
  standard_code text REFERENCES standards(standard_code),
  status text NOT NULL DEFAULT 'planned',
  start_date date,
  end_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  requester_name text,
  auditor_type text,
  auditor_name text,
  report_file text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, audit_key),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tenant_nonconformities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid,
  control_id uuid REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  tenant_control_id uuid,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  title text,
  control_description text,
  description text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
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
  control_id uuid REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  tenant_control_id uuid,
  catalog_control_id uuid REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  title text,
  description text,
  file_name text,
  file_path text,
  file_mime_type text,
  file_size_bytes bigint,
  evidence_type text NOT NULL DEFAULT 'document',
  status text NOT NULL DEFAULT 'pending',
  validated boolean NOT NULL DEFAULT false,
  expires_at date,
  last_ai_analyzed_at timestamptz,
  ai_analysis_status text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  content_fingerprint text,
  document_extraction_status text,
  last_extracted_at timestamptz,
  ai_last_error text,
  ai_model_name text,
  ai_model_version text,
  uploaded_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_dbn03_evidences_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS evidence_document_extracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  extraction_status text NOT NULL DEFAULT 'pending',
  extraction_engine text,
  file_type text,
  mime_type text,
  raw_text text,
  structured_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  text_char_count integer NOT NULL DEFAULT 0 CHECK (text_char_count >= 0),
  ocr_used boolean NOT NULL DEFAULT false,
  detected_language text,
  page_count integer,
  sheet_count integer,
  image_count integer,
  extraction_notes text,
  started_at timestamptz,
  extracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_document_extracts_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_ai_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  extract_id uuid,
  is_current boolean NOT NULL DEFAULT true,
  analysis_status text NOT NULL DEFAULT 'pending',
  validity_result text,
  contribution_level text,
  pertinence_score numeric NOT NULL DEFAULT 0,
  sufficiency_score numeric NOT NULL DEFAULT 0,
  freshness_score numeric NOT NULL DEFAULT 0,
  traceability_score numeric NOT NULL DEFAULT 0,
  consistency_score numeric NOT NULL DEFAULT 0,
  compliance_impact_score numeric NOT NULL DEFAULT 0,
  recommended_standard_code text,
  recommended_clause text,
  recommended_control_id uuid,
  recommended_operation_id uuid,
  headline text,
  narrative text,
  risks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_steps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_entities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  control_fit text,
  gap_summary text,
  duplicate_of_evidence_id uuid,
  appears_expired boolean NOT NULL DEFAULT false,
  appears_complete boolean NOT NULL DEFAULT false,
  appears_authentic boolean,
  model_name text,
  model_version text,
  source_system text,
  raw_response_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_trace_id uuid,
  ai_source_level text,
  ai_source_label text,
  ai_confidence text,
  ai_confidence_score numeric,
  ai_orchestration_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_enhanced_answer_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_ai_assessments_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_ai_assessments_extract_same_tenant
    FOREIGN KEY (tenant_id, extract_id)
    REFERENCES evidence_document_extracts(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ai_assessments_duplicate_same_tenant
    FOREIGN KEY (tenant_id, duplicate_of_evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ai_assessments_operation_same_tenant
    FOREIGN KEY (tenant_id, recommended_operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evidence_ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority smallint NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','processing','retry','completed','failed','cancelled')),
  run_after timestamptz NOT NULL DEFAULT now(),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries integer NOT NULL DEFAULT 5 CHECK (max_retries >= 0),
  error_message text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz,
  locked_by text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_ai_jobs_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  assessment_id uuid,
  extract_id uuid,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  chunk_type text NOT NULL DEFAULT 'text',
  content text NOT NULL,
  content_hash text NOT NULL,
  token_estimate integer NOT NULL DEFAULT 0 CHECK (token_estimate >= 0),
  embedding_status text NOT NULL DEFAULT 'pending',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_approved_signal boolean NOT NULL DEFAULT false,
  is_negative_signal boolean NOT NULL DEFAULT false,
  standard_code text,
  clause text,
  control_id uuid REFERENCES controls_catalog(id) ON DELETE SET NULL,
  tenant_control_id uuid,
  operation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evidence_id, chunk_index),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_knowledge_chunks_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_knowledge_chunks_assessment_same_tenant
    FOREIGN KEY (tenant_id, assessment_id)
    REFERENCES evidence_ai_assessments(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_knowledge_chunks_extract_same_tenant
    FOREIGN KEY (tenant_id, extract_id)
    REFERENCES evidence_document_extracts(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_knowledge_chunks_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_knowledge_chunks_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS standard_lifecycle_stage_catalog (
  stage_code text PRIMARY KEY,
  display_order integer NOT NULL,
  is_terminal boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  calculated_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  confirmed_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  effective_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  pending_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  pending_request_id uuid,
  pending_requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  pending_requested_at timestamptz,
  health_status text,
  maturity_score numeric,
  catalog_controls_count integer NOT NULL DEFAULT 0,
  enabled_controls_count integer NOT NULL DEFAULT 0,
  controls_enabled_pct numeric,
  controls_with_evidence_count integer NOT NULL DEFAULT 0,
  evidence_coverage_pct numeric,
  avg_health_score numeric,
  open_nonconformities_count integer NOT NULL DEFAULT 0,
  open_findings_count integer NOT NULL DEFAULT 0,
  open_action_plans_count integer NOT NULL DEFAULT 0,
  open_audits_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  last_snapshot_at timestamptz,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, standard_code, operation_id),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_status_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_status_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  calculated_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  confirmed_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  effective_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  health_status text,
  maturity_score numeric,
  catalog_controls_count integer NOT NULL DEFAULT 0,
  enabled_controls_count integer NOT NULL DEFAULT 0,
  controls_enabled_pct numeric,
  controls_with_evidence_count integer NOT NULL DEFAULT 0,
  evidence_coverage_pct numeric,
  avg_health_score numeric,
  open_nonconformities_count integer NOT NULL DEFAULT 0,
  open_findings_count integer NOT NULL DEFAULT 0,
  open_action_plans_count integer NOT NULL DEFAULT 0,
  open_audits_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  snapshot_date timestamptz NOT NULL DEFAULT now(),
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_snapshots_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_snapshots_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_stage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  from_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  to_stage_code text NOT NULL REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  request_status text NOT NULL DEFAULT 'por_confirmar' CHECK (request_status IN ('por_confirmar','confirmado','rechazado','devuelto')),
  request_source text NOT NULL DEFAULT 'manual',
  request_reason text,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_requests_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_requests_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_ai_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  event_type text NOT NULL,
  content_text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_ai_feed_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_ai_feed_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
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
  CHECK (run_status IN ('draft', 'completed', 'reviewed', 'archived', 'error')),
  CONSTRAINT uq_iso_risk_matrix_runs_tenant_id_id UNIQUE (tenant_id, id)
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_iso_risk_matrix_items_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_iso_risk_matrix_items_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES iso_risk_matrix_runs(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_iso_risk_matrix_items_asset_same_tenant
    FOREIGN KEY (tenant_id, asset_id)
    REFERENCES assets(tenant_id, id) ON DELETE SET NULL (asset_id),
  CONSTRAINT fk_iso_risk_matrix_items_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE SET NULL (tenant_control_id)
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_iso_risk_matrix_actions_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_iso_risk_matrix_actions_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES iso_risk_matrix_runs(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_iso_risk_matrix_actions_item_same_tenant
    FOREIGN KEY (tenant_id, risk_item_id)
    REFERENCES iso_risk_matrix_items(tenant_id, id) ON DELETE CASCADE
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
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_iso_risk_matrix_audit_run_same_tenant
    FOREIGN KEY (tenant_id, run_id)
    REFERENCES iso_risk_matrix_runs(tenant_id, id) ON DELETE SET NULL (run_id),
  CONSTRAINT fk_iso_risk_matrix_audit_item_same_tenant
    FOREIGN KEY (tenant_id, risk_item_id)
    REFERENCES iso_risk_matrix_items(tenant_id, id) ON DELETE SET NULL (risk_item_id)
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
  tc.operation_id,
  op.code AS operation_code,
  op.name AS operation_name,
  op.operation_type,
  cc.code,
  cc.title,
  cc.iso AS standard_code,
  tc.implementation_status
FROM tenant_controls tc
JOIN controls_catalog cc ON cc.id = tc.control_id
LEFT JOIN tenant_operations op ON op.tenant_id = tc.tenant_id AND op.id = tc.operation_id;

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
  jsonb_build_object(
    'authority', 'v_iso_control_effective_health',
    'metric_code', 'F5_5_CONTROL_EFFECTIVENESS',
    'grouped_by', jsonb_build_array('tenant_id','standard_code','operation_id')
  ) AS kpi_trace_json
FROM public.v_iso_control_effective_health
GROUP BY tenant_id, standard_code, operation_id, operation_name, operation_code, operation_type;

CREATE OR REPLACE VIEW public.v_iso_risk_matrix_latest_runs AS
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
LEFT JOIN iso_risk_matrix_items i
  ON i.run_id = r.id
WHERE r.run_status IS DISTINCT FROM 'archived'
GROUP BY r.tenant_id, r.standard_code, r.version_code, r.id, r.risk_posture, r.created_at;

CREATE OR REPLACE VIEW public.v_commercial_tenant_subscription AS
WITH latest_plan_version AS (
  SELECT DISTINCT ON (plan_key)
    id,
    plan_key,
    version,
    version_number,
    effective_from,
    published_at
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
  sc.id,
  sc.tenant_id,
  sc.plan_key,
  sc.effective_plan_version_id AS plan_version_id,
  sc.status,
  sc.effective_started_at AS started_at,
  sc.effective_ended_at AS ended_at,
  sc.starts_at,
  sc.expires_at,
  sc.created_at,
  cp.display_name AS plan_display_name,
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
  vts.tenant_id,
  vts.plan_key,
  sm.module_key,
  sm.display_name,
  sm.description,
  sm.sort_order,
  COALESCE(tms.enabled, true) AS enabled,
  'plan'::text AS source
FROM v_commercial_tenant_subscription vts
JOIN plan_version_capabilities pvc
  ON pvc.plan_version_id = vts.plan_version_id
 AND pvc.is_included = true
JOIN commercial_technical_capabilities ctc
  ON ctc.capability_key = pvc.capability_key
 AND ctc.status = 'active'
 AND ctc.is_active = true
JOIN saas_modules sm
  ON sm.module_key = ctc.module_key
 AND sm.status = 'active'
 AND sm.is_active = true
LEFT JOIN tenant_module_settings tms
  ON tms.tenant_id = vts.tenant_id
 AND tms.module_key = sm.module_key
UNION
SELECT DISTINCT
  vts.tenant_id,
  vts.plan_key,
  sm.module_key,
  sm.display_name,
  sm.description,
  sm.sort_order,
  COALESCE(tms.enabled, true) AS enabled,
  'addon'::text AS source
FROM v_commercial_tenant_subscription vts
JOIN tenant_subscription_addons tsa
  ON (tsa.tenant_subscription_id = vts.id OR (tsa.tenant_subscription_id IS NULL AND tsa.tenant_id = vts.tenant_id))
 AND tsa.status = 'active'
 AND (COALESCE(tsa.ended_at, tsa.expires_at) IS NULL OR COALESCE(tsa.ended_at, tsa.expires_at) > now())
JOIN commercial_technical_capabilities ctc
  ON tsa.addon_key = 'ai'
 AND ctc.capability_key LIKE 'ai.%'
 AND ctc.status = 'active'
 AND ctc.is_active = true
JOIN saas_modules sm
  ON sm.module_key = ctc.module_key
 AND sm.status = 'active'
 AND sm.is_active = true
LEFT JOIN tenant_module_settings tms
  ON tms.tenant_id = vts.tenant_id
 AND tms.module_key = sm.module_key;

CREATE OR REPLACE VIEW public.v_commercial_tenant_capabilities AS
SELECT DISTINCT
  vts.tenant_id,
  ctc.capability_key,
  ctc.required_permission,
  NULL::jsonb AS dependencies,
  true AS enabled,
  false AS read_only,
  'plan'::text AS source,
  vts.started_at AS effective_from,
  vts.ended_at AS effective_until,
  ctc.module_key
FROM v_commercial_tenant_subscription vts
JOIN plan_version_capabilities pvc
  ON pvc.plan_version_id = vts.plan_version_id
 AND pvc.is_included = true
JOIN commercial_technical_capabilities ctc
  ON ctc.capability_key = pvc.capability_key
 AND ctc.status = 'active'
 AND ctc.is_active = true
UNION
SELECT DISTINCT
  vts.tenant_id,
  ctc.capability_key,
  ctc.required_permission,
  NULL::jsonb AS dependencies,
  true AS enabled,
  false AS read_only,
  'addon'::text AS source,
  COALESCE(tsa.started_at, tsa.starts_at) AS effective_from,
  COALESCE(tsa.ended_at, tsa.expires_at) AS effective_until,
  ctc.module_key
FROM v_commercial_tenant_subscription vts
JOIN tenant_subscription_addons tsa
  ON (tsa.tenant_subscription_id = vts.id OR (tsa.tenant_subscription_id IS NULL AND tsa.tenant_id = vts.tenant_id))
 AND tsa.status = 'active'
 AND (COALESCE(tsa.ended_at, tsa.expires_at) IS NULL OR COALESCE(tsa.ended_at, tsa.expires_at) > now())
JOIN commercial_technical_capabilities ctc
  ON tsa.addon_key = 'ai'
 AND ctc.capability_key LIKE 'ai.%'
 AND ctc.status = 'active'
 AND ctc.is_active = true;

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

CREATE OR REPLACE VIEW public.vw_evidence_current_extracts AS
SELECT
  id, tenant_id, evidence_id, extraction_status, extraction_engine, file_type,
  mime_type, raw_text, structured_json, text_char_count, ocr_used,
  detected_language, page_count, sheet_count, image_count, extraction_notes,
  started_at, extracted_at, created_at, updated_at
FROM evidence_document_extracts
WHERE is_current IS TRUE;

CREATE OR REPLACE VIEW public.vw_evidence_current_ai_assessments AS
SELECT
  id, tenant_id, evidence_id, extract_id, analysis_status, validity_result,
  contribution_level, pertinence_score, sufficiency_score, freshness_score,
  traceability_score, consistency_score, compliance_impact_score,
  recommended_standard_code, recommended_clause, recommended_control_id,
  recommended_operation_id, headline, narrative, risks_json, next_steps_json,
  extracted_entities_json, control_fit, gap_summary, duplicate_of_evidence_id,
  appears_expired, appears_complete, appears_authentic, model_name, model_version,
  source_system, raw_response_json, ai_trace_id, ai_source_level, ai_source_label,
  ai_confidence, ai_confidence_score, ai_orchestration_json, ai_enhanced_answer_json,
  analyzed_at, created_at, updated_at
FROM evidence_ai_assessments
WHERE is_current IS TRUE;

CREATE OR REPLACE FUNCTION public.reconcile_tenant_nonconformity_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  catalog_from_tenant_control uuid;
  tenant_control_match_count integer;
  tenant_control_match_id uuid;
BEGIN
  IF NEW.tenant_control_id IS NOT NULL THEN
    SELECT tc.control_id INTO catalog_from_tenant_control
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.id = NEW.tenant_control_id;

    IF catalog_from_tenant_control IS NULL THEN
      RAISE EXCEPTION 'tenant_nonconformities.tenant_control_id does not belong to tenant %', NEW.tenant_id
        USING ERRCODE = '23503';
    END IF;

    IF NEW.control_id IS NULL THEN
      NEW.control_id := catalog_from_tenant_control;
    ELSIF NEW.control_id <> catalog_from_tenant_control THEN
      RAISE EXCEPTION 'tenant_nonconformities.control_id diverges from tenant_control_id for tenant %', NEW.tenant_id
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.control_id IS NOT NULL THEN
    SELECT count(*)::int, (array_agg(tc.id))[1]
    INTO tenant_control_match_count, tenant_control_match_id
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.control_id = NEW.control_id;

    IF tenant_control_match_count = 1 THEN
      NEW.tenant_control_id := tenant_control_match_id;
    END IF;
  END IF;

  IF NEW.control_description IS NULL AND NEW.control_id IS NOT NULL THEN
    SELECT COALESCE(cc.description, cc.title, cc.code)
    INTO NEW.control_description
    FROM controls_catalog cc
    WHERE cc.id = NEW.control_id;
  END IF;

  NEW.description := COALESCE(NULLIF(NEW.description, ''), NULLIF(NEW.control_description, ''), NEW.title);
  NEW.title := COALESCE(NULLIF(NEW.title, ''), NULLIF(NEW.control_description, ''), NULLIF(NEW.description, ''), 'No conformidad');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_evidence_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  catalog_from_tenant_control uuid;
  tenant_control_match_count integer;
  tenant_control_match_id uuid;
  effective_catalog_id uuid;
BEGIN
  IF NEW.control_id IS NOT NULL AND NEW.catalog_control_id IS NOT NULL AND NEW.control_id <> NEW.catalog_control_id THEN
    RAISE EXCEPTION 'evidences.control_id diverges from catalog_control_id for tenant %', NEW.tenant_id
      USING ERRCODE = '23514';
  END IF;

  effective_catalog_id := COALESCE(NEW.control_id, NEW.catalog_control_id);

  IF NEW.tenant_control_id IS NOT NULL THEN
    SELECT tc.control_id INTO catalog_from_tenant_control
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.id = NEW.tenant_control_id;

    IF catalog_from_tenant_control IS NULL THEN
      RAISE EXCEPTION 'evidences.tenant_control_id does not belong to tenant %', NEW.tenant_id
        USING ERRCODE = '23503';
    END IF;

    IF effective_catalog_id IS NULL THEN
      effective_catalog_id := catalog_from_tenant_control;
    ELSIF effective_catalog_id <> catalog_from_tenant_control THEN
      RAISE EXCEPTION 'evidences catalog control diverges from tenant_control_id for tenant %', NEW.tenant_id
        USING ERRCODE = '23514';
    END IF;
  ELSIF effective_catalog_id IS NOT NULL THEN
    SELECT count(*)::int, (array_agg(tc.id))[1]
    INTO tenant_control_match_count, tenant_control_match_id
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.control_id = effective_catalog_id;

    IF tenant_control_match_count = 1 THEN
      NEW.tenant_control_id := tenant_control_match_id;
    END IF;
  END IF;

  NEW.control_id := effective_catalog_id;
  NEW.catalog_control_id := effective_catalog_id;
  NEW.description := COALESCE(NULLIF(NEW.description, ''), NULLIF(NEW.title, ''), NULLIF(NEW.file_name, ''));
  NEW.title := COALESCE(NULLIF(NEW.title, ''), NULLIF(NEW.description, ''), NULLIF(NEW.file_name, ''), 'Evidencia');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tenant_nonconformities_contract_reconcile ON tenant_nonconformities;
CREATE TRIGGER trg_tenant_nonconformities_contract_reconcile
BEFORE INSERT OR UPDATE ON tenant_nonconformities
FOR EACH ROW EXECUTE FUNCTION public.reconcile_tenant_nonconformity_contract();

DROP TRIGGER IF EXISTS trg_evidences_contract_reconcile ON evidences;
CREATE TRIGGER trg_evidences_contract_reconcile
BEFORE INSERT OR UPDATE ON evidences
FOR EACH ROW EXECUTE FUNCTION public.reconcile_evidence_contract();

CREATE OR REPLACE FUNCTION public.enqueue_evidence_ai_job(
  p_tenant_id uuid,
  p_evidence_id uuid,
  p_job_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_priority smallint DEFAULT 50,
  p_run_after timestamp DEFAULT now(),
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO evidence_ai_jobs (
    tenant_id, evidence_id, job_type, payload, priority, status, run_after, created_by
  )
  VALUES (
    p_tenant_id,
    p_evidence_id,
    NULLIF(p_job_type, ''),
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_priority, 50),
    'pending',
    COALESCE(p_run_after::timestamptz, now()),
    p_created_by
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_standards_lifecycle ON tenant_standards(tenant_id, standard_code, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_tenant_standard_operations_tenant_standard ON tenant_standard_operations(tenant_id, standard_code);
CREATE INDEX IF NOT EXISTS idx_tenant_standard_operations_operation ON tenant_standard_operations(tenant_id, operation_id);
CREATE INDEX IF NOT EXISTS idx_tenant_controls_tenant ON tenant_controls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_controls_control ON tenant_controls(control_id);
CREATE INDEX IF NOT EXISTS idx_tenant_nonconformities_control ON tenant_nonconformities(tenant_id, control_id);
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
CREATE INDEX IF NOT EXISTS idx_control_soa_assessments_latest ON control_soa_assessments(tenant_id, iso_code, tenant_control_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_control_soa_change_log_tenant ON control_soa_change_log(tenant_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_tenant_control ON findings(tenant_id, tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_evidences_tenant_control ON evidences(tenant_id, tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_evidences_control_id ON evidences(tenant_id, control_id);
CREATE INDEX IF NOT EXISTS idx_evidence_extracts_current ON evidence_document_extracts(tenant_id, evidence_id) WHERE is_current IS TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_extracts_one_current ON evidence_document_extracts(evidence_id) WHERE is_current IS TRUE;
CREATE INDEX IF NOT EXISTS idx_evidence_ai_assessments_current ON evidence_ai_assessments(tenant_id, evidence_id) WHERE is_current IS TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_ai_assessments_one_current ON evidence_ai_assessments(evidence_id) WHERE is_current IS TRUE;
CREATE INDEX IF NOT EXISTS idx_evidence_ai_jobs_claim ON evidence_ai_jobs(status, run_after, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_ai_jobs_tenant_evidence ON evidence_ai_jobs(tenant_id, evidence_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_knowledge_chunks_evidence ON evidence_knowledge_chunks(tenant_id, evidence_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_action_plans_tenant_control ON action_plans(tenant_id, tenant_control_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_finding ON action_plans(tenant_id, finding_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_updates_plan_created ON action_plan_updates(action_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_status_tenant_standard ON standard_lifecycle_status(tenant_id, standard_code, operation_id);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_snapshots_tenant_standard ON standard_lifecycle_snapshots(tenant_id, standard_code, operation_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_stage_requests_pending ON standard_lifecycle_stage_requests(tenant_id, standard_code, operation_id, request_status);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_ai_feed_unprocessed ON standard_lifecycle_ai_feed(tenant_id, is_processed, created_at);
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


-- TCDX SaaSv2 GRC runtime contract closeout V3 baseline mirror.
-- Mirrors database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql
-- without migration transaction/advisory wrapper so fresh bootstrap and forward upgrade converge.
ALTER TABLE saas_modules
  ADD COLUMN IF NOT EXISTS default_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE tenant_module_settings
  ADD COLUMN IF NOT EXISTS is_enabled boolean,
  ADD COLUMN IF NOT EXISTS enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS enabled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE tenant_module_settings
SET is_enabled = COALESCE(is_enabled, enabled, false),
    enabled = COALESCE(enabled, is_enabled, false),
    enabled_at = CASE WHEN COALESCE(is_enabled, enabled, false) THEN COALESCE(enabled_at, updated_at, now()) ELSE enabled_at END,
    disabled_at = CASE WHEN NOT COALESCE(is_enabled, enabled, false) THEN COALESCE(disabled_at, updated_at, now()) ELSE disabled_at END,
    updated_at = COALESCE(updated_at, now())
WHERE is_enabled IS NULL OR enabled IS NULL;

ALTER TABLE tenant_module_settings
  ALTER COLUMN enabled DROP DEFAULT,
  ALTER COLUMN enabled DROP NOT NULL,
  ALTER COLUMN is_enabled DROP DEFAULT,
  ALTER COLUMN is_enabled DROP NOT NULL;

CREATE OR REPLACE FUNCTION reconcile_tenant_module_settings_enabled()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_enabled IS NOT NULL AND NEW.enabled IS NOT NULL
       AND NEW.is_enabled IS DISTINCT FROM NEW.enabled THEN
      RAISE EXCEPTION 'tenant_module_settings enabled/is_enabled divergence for tenant %, module %',
        NEW.tenant_id, NEW.module_key;
    END IF;
    NEW.is_enabled := COALESCE(NEW.is_enabled, NEW.enabled, false);
    NEW.enabled := COALESCE(NEW.enabled, NEW.is_enabled, false);
  ELSE
    IF NEW.is_enabled IS DISTINCT FROM OLD.is_enabled AND NEW.enabled IS DISTINCT FROM OLD.enabled
       AND NEW.is_enabled IS DISTINCT FROM NEW.enabled THEN
      RAISE EXCEPTION 'tenant_module_settings enabled/is_enabled divergence for tenant %, module %',
        NEW.tenant_id, NEW.module_key;
    ELSIF NEW.is_enabled IS DISTINCT FROM OLD.is_enabled THEN
      NEW.enabled := NEW.is_enabled;
    ELSIF NEW.enabled IS DISTINCT FROM OLD.enabled THEN
      NEW.is_enabled := NEW.enabled;
    ELSE
      NEW.is_enabled := COALESCE(NEW.is_enabled, NEW.enabled, false);
      NEW.enabled := COALESCE(NEW.enabled, NEW.is_enabled, false);
    END IF;
  END IF;

  IF NEW.is_enabled THEN
    NEW.enabled_at := COALESCE(NEW.enabled_at, now());
    NEW.disabled_at := NULL;
  ELSE
    NEW.disabled_at := COALESCE(NEW.disabled_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tenant_module_settings_enabled_sync ON tenant_module_settings;
CREATE TRIGGER trg_tenant_module_settings_enabled_sync
BEFORE INSERT OR UPDATE OF enabled, is_enabled, enabled_at, disabled_at, enabled_by, disabled_by, notes, metadata
ON tenant_module_settings
FOR EACH ROW EXECUTE FUNCTION reconcile_tenant_module_settings_enabled();

INSERT INTO saas_modules (module_key, display_name, description, default_enabled, is_system, is_active, sort_order, status)
VALUES
  ('grc_phase1_core', 'GRC Phase 1 Core', 'Workflows, evidence requests, readiness, frameworks and audit runtime.', false, true, true, 45, 'active'),
  ('grc_phase2_integrated', 'GRC Phase 2 Integrated', 'Privacy, incidents, suppliers, connectors and integrated GRC runtime.', false, true, true, 46, 'active'),
  ('grc_phase3_operations', 'GRC Phase 3 Operations', 'Operational units, processes, services, BIA, continuity, KPI/KRI and quantitative risk runtime.', false, true, true, 47, 'active')
ON CONFLICT (module_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  default_enabled = false,
  is_system = true,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  status = 'active',
  updated_at = now();

ALTER TABLE grc_workflow_definitions
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS active_version_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE grc_workflow_definitions ALTER COLUMN workflow_key DROP NOT NULL;
ALTER TABLE grc_workflow_definitions ALTER COLUMN display_name DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_workflow_definitions_tenant_code
  ON grc_workflow_definitions(tenant_id, code) WHERE tenant_id IS NOT NULL AND code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_workflow_definitions_tenant_id
  ON grc_workflow_definitions(tenant_id, id);

ALTER TABLE grc_workflow_versions
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS definition_id uuid REFERENCES grc_workflow_definitions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS quorum integer,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE grc_workflow_versions ALTER COLUMN workflow_definition_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_workflow_versions_tenant_id
  ON grc_workflow_versions(tenant_id, id);

CREATE TABLE IF NOT EXISTS grc_workflow_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid REFERENCES grc_workflow_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  state_type text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, version_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS grc_workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid REFERENCES grc_workflow_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  from_state_id uuid REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  to_state_id uuid REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  required_permission text REFERENCES permissions(permission_key) ON DELETE RESTRICT,
  approval_mode text NOT NULL DEFAULT 'none',
  quorum integer,
  approval_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sla_hours integer,
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, version_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS grc_workflow_transition_roles (
  transition_id uuid NOT NULL REFERENCES grc_workflow_transitions(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES app_roles(role_key) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (transition_id, role_key)
);

ALTER TABLE grc_workflow_instances
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS unit_id uuid,
  ADD COLUMN IF NOT EXISTS definition_id uuid REFERENCES grc_workflow_definitions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES grc_workflow_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS current_state_id uuid REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lock_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE grc_workflow_instances ALTER COLUMN workflow_version_id DROP NOT NULL;
ALTER TABLE grc_workflow_instances ALTER COLUMN subject_type DROP NOT NULL;
ALTER TABLE grc_workflow_instances ALTER COLUMN subject_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_workflow_instances_tenant_id
  ON grc_workflow_instances(tenant_id, id);

CREATE TABLE IF NOT EXISTS grc_workflow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE RESTRICT,
  transition_id uuid REFERENCES grc_workflow_transitions(id) ON DELETE RESTRICT,
  from_state_id uuid REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  to_state_id uuid REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role text,
  permission_key text,
  correlation_id text,
  comment text,
  precondition_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS grc_workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  transition_id uuid REFERENCES grc_workflow_transitions(id) ON DELETE RESTRICT,
  sequence_no integer NOT NULL DEFAULT 1,
  reviewer_role text,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL DEFAULT 'pending',
  comment text,
  assigned_reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  acted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  delegated_to uuid REFERENCES users(id) ON DELETE SET NULL,
  substitute_for uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, instance_id, transition_id, sequence_no, reviewer_id)
);

CREATE TABLE IF NOT EXISTS grc_workflow_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_workflow_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  document_id uuid,
  attached_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_workflow_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid REFERENCES grc_workflow_versions(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  code text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, version_id, rule_type, code)
);

CREATE TABLE IF NOT EXISTS grc_workflow_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES grc_workflow_automation_rules(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  job_id uuid REFERENCES tcdx_async_jobs(id) ON DELETE SET NULL,
  run_after timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS grc_scheduler_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_type text NOT NULL,
  window_key text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  attempt_count integer NOT NULL DEFAULT 1,
  correlation_id text,
  locked_by text,
  task_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error_code text,
  next_retry_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, run_type, window_key)
);

CREATE TABLE IF NOT EXISTS grc_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  format text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_hash text,
  content_hash text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  file_content bytea,
  version integer NOT NULL DEFAULT 1,
  correlation_id text,
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grc_evidence_requests
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS workflow_instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_id uuid,
  ADD COLUMN IF NOT EXISTS occurrence_key text;

CREATE TABLE IF NOT EXISTS grc_evidence_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_template_id uuid REFERENCES grc_evidence_requests(id) ON DELETE CASCADE,
  frequency text NOT NULL,
  interval_value integer NOT NULL DEFAULT 1,
  start_at timestamptz NOT NULL DEFAULT now(),
  next_run_at timestamptz,
  event_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_evidence_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id uuid REFERENCES grc_evidence_requests(id) ON DELETE CASCADE,
  requirement_type text NOT NULL,
  requirement_id uuid NOT NULL,
  mandatory boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, request_id, requirement_type, requirement_id)
);

CREATE TABLE IF NOT EXISTS grc_evidence_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id uuid REFERENCES grc_evidence_requests(id) ON DELETE RESTRICT,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'submitted',
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS grc_evidence_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES grc_evidence_submissions(id) ON DELETE CASCADE,
  version integer NOT NULL,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  content_hash text,
  source_type text NOT NULL DEFAULT 'manual',
  integrity_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, submission_id, version)
);

CREATE TABLE IF NOT EXISTS grc_evidence_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES grc_evidence_submissions(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evidence_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS grc_evidence_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES evidences(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL,
  formula_version text NOT NULL,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evidence_id, formula_version)
);

CREATE TABLE IF NOT EXISTS grc_readiness_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  dimension text NOT NULL,
  source_table text NOT NULL,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula text NOT NULL,
  weight numeric(8,4) NOT NULL DEFAULT 1,
  threshold numeric(8,4) NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE grc_readiness_snapshots
  ADD COLUMN IF NOT EXISTS score numeric(5,2),
  ADD COLUMN IF NOT EXISTS formula_version text,
  ADD COLUMN IF NOT EXISTS input_hash text,
  ADD COLUMN IF NOT EXISTS generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;
ALTER TABLE grc_readiness_snapshots ALTER COLUMN snapshot_key DROP NOT NULL;

ALTER TABLE grc_readiness_results
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES grc_readiness_rules(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS dimension text,
  ADD COLUMN IF NOT EXISTS score numeric(5,2),
  ADD COLUMN IF NOT EXISTS weight numeric(8,4),
  ADD COLUMN IF NOT EXISTS included_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_as_of timestamptz;
ALTER TABLE grc_readiness_results ALTER COLUMN result_key DROP NOT NULL;

ALTER TABLE grc_readiness_findings
  ADD COLUMN IF NOT EXISTS finding_code text,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS explanation text;

CREATE TABLE IF NOT EXISTS grc_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  publisher text,
  content_classification text NOT NULL DEFAULT 'tcdx_interpretation',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_framework_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  framework_id uuid REFERENCES grc_frameworks(id) ON DELETE RESTRICT,
  version_label text NOT NULL,
  effective_from date,
  status text NOT NULL DEFAULT 'draft',
  source_url text,
  license_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_framework_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid REFERENCES grc_framework_versions(id) ON DELETE RESTRICT,
  reference_code text NOT NULL,
  permitted_title text,
  tcdx_interpretation text,
  content_classification text NOT NULL DEFAULT 'tcdx_interpretation',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_requirement_control_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES grc_framework_requirements(id) ON DELETE RESTRICT,
  tenant_control_id uuid REFERENCES tenant_controls(id) ON DELETE RESTRICT,
  catalog_control_id uuid,
  mapping_type text NOT NULL DEFAULT 'pending_review',
  coverage_level numeric(5,2) NOT NULL DEFAULT 0,
  justification text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'tcdx_interpretation',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE grc_requirement_control_mappings ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2);
ALTER TABLE grc_requirement_control_mappings ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT false;
ALTER TABLE grc_requirement_control_mappings ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE TABLE IF NOT EXISTS grc_mapping_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  mapping_id uuid REFERENCES grc_requirement_control_mappings(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_audit_universe_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  name text NOT NULL,
  risk_score numeric(8,2),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS grc_audit_annual_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  prioritization_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_audit_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  annual_plan_id uuid REFERENCES grc_audit_annual_plans(id) ON DELETE CASCADE,
  universe_entity_id uuid REFERENCES grc_audit_universe_entities(id) ON DELETE RESTRICT,
  audit_id uuid REFERENCES audits(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium',
  planned_start date,
  planned_end date,
  effort_hours numeric(10,2),
  status text NOT NULL DEFAULT 'planned'
);
CREATE TABLE IF NOT EXISTS grc_audit_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  procedures jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_audit_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  team_role text NOT NULL,
  independence_status text NOT NULL DEFAULT 'pending',
  declaration jsonb NOT NULL DEFAULT '{}'::jsonb,
  declared_at timestamptz
);
CREATE TABLE IF NOT EXISTS grc_audit_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES grc_audit_team_members(id) ON DELETE CASCADE,
  conflict_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS grc_audit_sample_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  population_description text NOT NULL,
  population_size integer,
  method text NOT NULL,
  sample_size integer NOT NULL,
  selection_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  random_seed text,
  limitation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_audit_sample_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sample_plan_id uuid REFERENCES grc_audit_sample_plans(id) ON DELETE CASCADE,
  population_reference text NOT NULL,
  selection_reason text,
  result text,
  exception_detail text
);
CREATE TABLE IF NOT EXISTS grc_audit_workpapers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  objective text NOT NULL,
  procedure_text text NOT NULL,
  population text,
  sample_summary text,
  result text,
  conclusion text,
  status text NOT NULL DEFAULT 'draft',
  prepared_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_audit_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  agenda text,
  questions_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmation_status text NOT NULL DEFAULT 'pending',
  confidentiality text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_audit_evidence_links (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  workpaper_id uuid REFERENCES grc_audit_workpapers(id) ON DELETE CASCADE,
  linked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_audit_supervisor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  workpaper_id uuid REFERENCES grc_audit_workpapers(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL,
  observations text,
  version integer NOT NULL DEFAULT 1,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  previous_review_id uuid REFERENCES grc_audit_supervisor_reviews(id) ON DELETE SET NULL,
  confirmation_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  report_format text NOT NULL,
  file_url text,
  content_hash text,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE grc_audit_followups
  ADD COLUMN IF NOT EXISTS audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS action_plan_id uuid REFERENCES action_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE grc_audit_followups ALTER COLUMN title DROP NOT NULL;

CREATE TABLE IF NOT EXISTS grc_tenant_configurations (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  validated_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_bootstrap_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  status text NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_hash)
);

CREATE TABLE IF NOT EXISTS grc_phase2_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  relation_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,2) NOT NULL DEFAULT 100,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  causation_id uuid,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS grc_rule_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id uuid REFERENCES grc_domain_events(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  rule_version integer NOT NULL DEFAULT 1,
  matched boolean NOT NULL,
  explanation text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_id, rule_code, rule_version)
);
CREATE TABLE IF NOT EXISTS grc_operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  source_event_id uuid REFERENCES grc_domain_events(id) ON DELETE SET NULL,
  due_at timestamptz,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_metric_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  metric_type text NOT NULL,
  numeric_value numeric,
  text_value text,
  unit text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,2) NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES grc_framework_requirements(id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  source_reference text NOT NULL,
  jurisdiction text,
  due_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  evidence_required boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_control_assurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid REFERENCES tenant_controls(id) ON DELETE CASCADE,
  assurance_status text NOT NULL DEFAULT 'unknown',
  score numeric(5,2) NOT NULL DEFAULT 0,
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  source_event_id uuid REFERENCES grc_domain_events(id) ON DELETE SET NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version text NOT NULL DEFAULT 'phase2-assurance-v1',
  UNIQUE (tenant_id, tenant_control_id)
);
CREATE TABLE IF NOT EXISTS grc_effectiveness_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_plan_id uuid REFERENCES action_plans(id) ON DELETE RESTRICT,
  outcome text NOT NULL,
  criteria text NOT NULL,
  result text NOT NULL,
  verified_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now(),
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  followup_due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  tax_identifier text,
  country_code text,
  status text NOT NULL DEFAULT 'draft',
  criticality text NOT NULL DEFAULT 'medium',
  inherent_risk_score numeric(5,2),
  residual_risk_score numeric(5,2),
  risk_level text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  data_access_level text NOT NULL DEFAULT 'none',
  access_summary text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  next_assessment_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS tenant_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  area text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  criticality text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS grc_supplier_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, from_status text, to_status text NOT NULL,
  reason text, changed_by uuid REFERENCES users(id) ON DELETE SET NULL, changed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS grc_supplier_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, name text NOT NULL, description text,
  service_criticality text NOT NULL DEFAULT 'medium', process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  operation_id uuid REFERENCES tenant_operations(id) ON DELETE SET NULL, asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  dependency_type text NOT NULL DEFAULT 'supporting', active boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_supplier_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, contract_number text NOT NULL, title text NOT NULL,
  starts_on date, ends_on date, renewal_on date, status text NOT NULL DEFAULT 'draft', security_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_terms jsonb NOT NULL DEFAULT '{}'::jsonb, exit_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL, document_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_questionnaire_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, domain text NOT NULL, status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_questionnaire_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid REFERENCES grc_questionnaire_templates(id) ON DELETE CASCADE, version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft', scoring_model jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_questionnaire_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid REFERENCES grc_questionnaire_versions(id) ON DELETE CASCADE, code text NOT NULL, title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0, condition jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS grc_questionnaire_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  section_id uuid REFERENCES grc_questionnaire_sections(id) ON DELETE CASCADE, code text NOT NULL, prompt text NOT NULL,
  answer_type text NOT NULL, required boolean NOT NULL DEFAULT true, weight numeric(8,3) NOT NULL DEFAULT 1,
  options jsonb NOT NULL DEFAULT '[]'::jsonb, condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_required boolean NOT NULL DEFAULT false, risk_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  control_mapping jsonb NOT NULL DEFAULT '{}'::jsonb, sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS grc_supplier_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, questionnaire_version_id uuid REFERENCES grc_questionnaire_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft', due_at timestamptz, submitted_at timestamptz, score numeric(7,2),
  inherent_risk_score numeric(5,2), residual_risk_score numeric(5,2), reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz, expires_at timestamptz, decision_reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_supplier_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE, question_id uuid REFERENCES grc_questionnaire_questions(id) ON DELETE RESTRICT,
  answer jsonb NOT NULL, score numeric(7,2), observation text, evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  answered_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_supplier_assessment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE, from_status text, to_status text NOT NULL,
  comment text, changed_by uuid REFERENCES users(id) ON DELETE SET NULL, changed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS grc_supplier_portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, assessment_id uuid REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  invited_email text NOT NULL, token_hash text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL, max_file_bytes bigint NOT NULL DEFAULT 10485760, allowed_mime_types text[] NOT NULL DEFAULT ARRAY['application/pdf','image/png','image/jpeg','text/plain'],
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz, revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS grc_supplier_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, assessment_id uuid REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES grc_supplier_portal_invitations(id) ON DELETE CASCADE, session_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL, revoked_at timestamptz, last_seen_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_supplier_portal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, assessment_id uuid REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES grc_supplier_portal_invitations(id) ON DELETE CASCADE, question_id uuid REFERENCES grc_questionnaire_questions(id) ON DELETE RESTRICT,
  file_name text NOT NULL, mime_type text NOT NULL, size_bytes bigint NOT NULL, content_hash text NOT NULL,
  storage_path text NOT NULL, status text NOT NULL DEFAULT 'received', uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL, reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS grc_supplier_exit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE CASCADE, check_type text NOT NULL, status text NOT NULL DEFAULT 'pending',
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[], verified_by uuid REFERENCES users(id) ON DELETE SET NULL, verified_at timestamptz, notes text
);

CREATE TABLE IF NOT EXISTS privacy_processing_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, description text, status text NOT NULL DEFAULT 'draft',
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL, operation_id uuid REFERENCES tenant_operations(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL, legal_basis text, legal_basis_source text,
  purposes jsonb NOT NULL DEFAULT '[]'::jsonb, data_subject_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb, sensitive_data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb, recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_period text, retention_basis text, deletion_method text, international_transfers jsonb NOT NULL DEFAULT '[]'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb, asset_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  primary_supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE SET NULL, dpia_required boolean NOT NULL DEFAULT false,
  next_review_at timestamptz, approved_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz,
  version integer NOT NULL DEFAULT 1, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS privacy_processing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid REFERENCES privacy_processing_activities(id) ON DELETE CASCADE, version integer NOT NULL,
  snapshot jsonb NOT NULL, change_reason text NOT NULL, created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS privacy_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid REFERENCES privacy_processing_activities(id) ON DELETE CASCADE, supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE RESTRICT,
  role text NOT NULL, purpose text NOT NULL, contract_id uuid REFERENCES grc_supplier_contracts(id) ON DELETE SET NULL,
  tprm_assessment_id uuid REFERENCES grc_supplier_assessments(id) ON DELETE SET NULL, valid_from date, valid_to date,
  status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS privacy_dpias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid REFERENCES privacy_processing_activities(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'draft',
  screening jsonb NOT NULL DEFAULT '{}'::jsonb, necessity_assessment text, proportionality_assessment text,
  consultation jsonb NOT NULL DEFAULT '{}'::jsonb, residual_risk_level text, conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL, approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, next_review_at timestamptz, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS privacy_dpia_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dpia_id uuid REFERENCES privacy_dpias(id) ON DELETE CASCADE, title text NOT NULL, description text,
  likelihood integer NOT NULL DEFAULT 1, impact integer NOT NULL DEFAULT 1, inherent_score integer GENERATED ALWAYS AS (likelihood * impact) STORED,
  residual_likelihood integer NOT NULL DEFAULT 1, residual_impact integer NOT NULL DEFAULT 1,
  residual_score integer GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,
  tenant_control_id uuid REFERENCES tenant_controls(id) ON DELETE SET NULL, treatment text, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
);
CREATE TABLE IF NOT EXISTS privacy_data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL, request_type text NOT NULL, status text NOT NULL DEFAULT 'opened', subject_reference text NOT NULL,
  identity_verification jsonb NOT NULL DEFAULT '{}'::jsonb, received_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz NOT NULL DEFAULT now(),
  extension_until timestamptz, extension_reason text, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  processing_activity_ids uuid[] NOT NULL DEFAULT '{}'::uuid[], systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_summary text, response_evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[], approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, closed_at timestamptz, escalation_level integer NOT NULL DEFAULT 0, normative_source text NOT NULL DEFAULT 'tenant_policy',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid REFERENCES privacy_processing_activities(id) ON DELETE CASCADE, subject_reference_hash text NOT NULL,
  purpose_code text NOT NULL, status text NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz,
  source text NOT NULL, evidence_id uuid REFERENCES evidences(id) ON DELETE SET NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS privacy_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  breach_number text NOT NULL, processing_activity_id uuid REFERENCES privacy_processing_activities(id) ON DELETE SET NULL,
  incident_id uuid, status text NOT NULL DEFAULT 'opened', occurred_at timestamptz, detected_at timestamptz NOT NULL DEFAULT now(),
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb, affected_subjects_estimate integer, impact_summary text NOT NULL,
  notification_assessment jsonb NOT NULL DEFAULT '{}'::jsonb, notification_due_at timestamptz, authority_notified_at timestamptz,
  subjects_notified_at timestamptz, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL, closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_number text NOT NULL, title text NOT NULL, description text, status text NOT NULL DEFAULT 'reported',
  category text NOT NULL, priority text NOT NULL DEFAULT 'medium', calculated_severity text NOT NULL DEFAULT 'medium',
  confirmed_severity text, severity_inputs jsonb NOT NULL DEFAULT '{}'::jsonb, severity_formula_version text NOT NULL DEFAULT 'incident-severity-v1',
  severity_overridden boolean NOT NULL DEFAULT false, severity_override_reason text, severity_approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  severity_confirmed_at timestamptz, commander_user_id uuid REFERENCES users(id) ON DELETE SET NULL, reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_at timestamptz NOT NULL DEFAULT now(), detected_at timestamptz, contained_at timestamptz, recovered_at timestamptz,
  resolved_at timestamptz, closed_at timestamptz, recurrence_key text, process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  operation_id uuid REFERENCES tenant_operations(id) ON DELETE SET NULL, asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE SET NULL, privacy_impact boolean NOT NULL DEFAULT false,
  regulatory_impact boolean NOT NULL DEFAULT false, customer_impact boolean NOT NULL DEFAULT false, financial_impact numeric(16,2),
  duration_minutes integer, closure_summary text, effectiveness_verified boolean NOT NULL DEFAULT false, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, incident_number)
);
CREATE TABLE IF NOT EXISTS grc_incident_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES grc_incidents(id) ON DELETE CASCADE, from_status text, to_status text NOT NULL, from_severity text, to_severity text,
  note text, changed_by uuid REFERENCES users(id) ON DELETE SET NULL, changed_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS grc_incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES grc_incidents(id) ON DELETE CASCADE, event_type text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL, actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL, source text NOT NULL DEFAULT 'manual',
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[], metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_incident_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES grc_incidents(id) ON DELETE CASCADE, impact_type text NOT NULL, entity_id uuid, severity text NOT NULL,
  description text NOT NULL, started_at timestamptz, ended_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS grc_incident_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES grc_incidents(id) ON DELETE CASCADE, obligation_id uuid REFERENCES grc_obligations(id) ON DELETE SET NULL,
  recipient_type text NOT NULL, recipient text NOT NULL, status text NOT NULL DEFAULT 'planned', due_at timestamptz, sent_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL, evidence_id uuid REFERENCES evidences(id) ON DELETE SET NULL,
  message_hash text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_incident_root_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES grc_incidents(id) ON DELETE CASCADE, method text NOT NULL, cause_category text NOT NULL, description text NOT NULL,
  contributing_factors jsonb NOT NULL DEFAULT '[]'::jsonb, confirmed boolean NOT NULL DEFAULT false, confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_incident_postmortems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES grc_incidents(id) ON DELETE CASCADE, summary text NOT NULL, what_worked text, what_failed text,
  lessons jsonb NOT NULL DEFAULT '[]'::jsonb, action_plan_ids uuid[] NOT NULL DEFAULT '{}'::uuid[], status text NOT NULL DEFAULT 'draft',
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grc_connector_definitions
  ADD COLUMN IF NOT EXISTS supported_scopes text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE grc_connector_definitions ALTER COLUMN capabilities SET DEFAULT '{}'::jsonb;

ALTER TABLE grc_connector_instances
  ADD COLUMN IF NOT EXISTS connector_version text,
  ADD COLUMN IF NOT EXISTS connected_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scopes text,
  ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS credential_envelope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS oauth_state_hash text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_after timestamptz,
  ADD COLUMN IF NOT EXISTS cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '{"enabled":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS webhook_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rate_limit_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retry_config jsonb NOT NULL DEFAULT '{"max_attempts":5,"base_seconds":30}'::jsonb,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;
UPDATE grc_connector_instances i
SET connector_version = COALESCE(i.connector_version, d.version, '1.0.0')
FROM grc_connector_definitions d
WHERE i.definition_id = d.id AND i.connector_version IS NULL;
UPDATE grc_connector_instances SET connector_version = COALESCE(connector_version, '1.0.0');
ALTER TABLE grc_connector_instances ALTER COLUMN definition_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_connector_instances_tenant_id ON grc_connector_instances(tenant_id, id);

ALTER TABLE grc_connector_runs
  ADD COLUMN IF NOT EXISTS integration_id uuid,
  ADD COLUMN IF NOT EXISTS run_type text NOT NULL DEFAULT 'sync',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'started',
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS cursor_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cursor_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS records_seen integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS records_normalized integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS records_rejected integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alerts_created integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mappings_failed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS triggered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE grc_connector_runs SET integration_id = COALESCE(integration_id, connector_instance_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_connector_runs_tenant_id ON grc_connector_runs(tenant_id, id);

CREATE TABLE IF NOT EXISTS grc_external_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid,
  run_id uuid REFERENCES grc_connector_runs(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_type text NOT NULL,
  external_id text NOT NULL,
  external_version text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_hash text NOT NULL,
  normalized_payload jsonb NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_status text NOT NULL DEFAULT 'pending',
  mapped_entity_type text,
  mapped_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_connector_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid, external_type text NOT NULL, target_type text NOT NULL, mapping jsonb NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'active', version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_connector_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid, run_id uuid REFERENCES grc_connector_runs(id) ON DELETE SET NULL,
  external_record_id uuid REFERENCES grc_external_records(id) ON DELETE SET NULL, error_code text NOT NULL,
  error_message text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, attempts integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open', next_retry_at timestamptz, resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  area text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  criticality text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

ALTER TABLE tenant_processes
  ADD COLUMN IF NOT EXISTS organizational_unit_id uuid,
  ADD COLUMN IF NOT EXISTS parent_process_id uuid,
  ADD COLUMN IF NOT EXISTS backup_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS process_type text NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS criticality_score numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS criticality_confirmed text,
  ADD COLUMN IF NOT EXISTS criticality_override_reason text,
  ADD COLUMN IF NOT EXISTS criticality_approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS criticality_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS grc_organizational_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, description text, unit_type text NOT NULL DEFAULT 'area',
  parent_unit_id uuid, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  backup_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL, location_reference text, status text NOT NULL DEFAULT 'draft',
  valid_from date, valid_until date, next_review_at timestamptz, approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, version integer NOT NULL DEFAULT 1, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code), UNIQUE (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS grc_operational_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, description text, organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  primary_process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  backup_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL, minimum_service_level text, critical_schedule text,
  criticality text NOT NULL DEFAULT 'medium', rto_minutes integer, rpo_minutes integer, mtpd_minutes integer,
  status text NOT NULL DEFAULT 'draft', next_review_at timestamptz, approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, version integer NOT NULL DEFAULT 1, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code), UNIQUE (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS grc_operational_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL, source_id uuid NOT NULL, target_type text NOT NULL, target_id uuid NOT NULL,
  dependency_type text NOT NULL, criticality text NOT NULL DEFAULT 'medium', is_mandatory boolean NOT NULL DEFAULT true,
  alternative_description text, max_tolerable_minutes integer, valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz,
  source_reference text NOT NULL, approved_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_bia_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE RESTRICT, service_id uuid REFERENCES grc_operational_services(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL, assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  assumptions text, estimated_financial_impact numeric(18,2), mtpd_minutes integer NOT NULL DEFAULT 0, rto_minutes integer NOT NULL DEFAULT 0,
  rpo_minutes integer NOT NULL DEFAULT 0, minimum_service_level text, required_people integer, alternative_resources text,
  status text NOT NULL DEFAULT 'draft', next_review_at timestamptz NOT NULL DEFAULT now(), approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, provenance jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_bia_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bia_id uuid REFERENCES grc_bia_assessments(id) ON DELETE CASCADE, dimension text NOT NULL, duration_minutes integer NOT NULL DEFAULT 0,
  impact_level text NOT NULL, estimated_amount numeric(18,2), rationale text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_continuity_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, scope text NOT NULL, organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL, service_id uuid REFERENCES grc_operational_services(id) ON DELETE SET NULL,
  bia_id uuid REFERENCES grc_bia_assessments(id) ON DELETE SET NULL, activation_criteria text NOT NULL,
  activation_authority_user_id uuid REFERENCES users(id) ON DELETE SET NULL, procedures text NOT NULL, recovery_sequence text NOT NULL,
  communication_plan text, return_to_operation_criteria text NOT NULL, version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'draft',
  valid_from date, valid_until date, next_review_at timestamptz NOT NULL DEFAULT now(), approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, provenance jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_continuity_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES grc_continuity_plans(id) ON DELETE CASCADE, test_type text NOT NULL, objective text NOT NULL,
  scenario text NOT NULL, scope text NOT NULL, scheduled_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  expected_result text NOT NULL, actual_result text, target_rto_minutes integer, observed_rto_minutes integer,
  target_rpo_minutes integer, observed_rpo_minutes integer, status text NOT NULL DEFAULT 'planned', next_test_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_crisis_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, plan_id uuid REFERENCES grc_continuity_plans(id) ON DELETE SET NULL, incident_id uuid,
  organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL, process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  service_id uuid REFERENCES grc_operational_services(id) ON DELETE SET NULL, crisis_level text NOT NULL, activation_reason text NOT NULL,
  recovery_status text NOT NULL DEFAULT 'activated', lessons_learned text, status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, activated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb, updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_crisis_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crisis_id uuid REFERENCES grc_crisis_activations(id) ON DELETE CASCADE, entry_type text NOT NULL, entry_text text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(), recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, description text, metric_type text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL,
  formula_definition text NOT NULL, source_description text NOT NULL, frequency text NOT NULL, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  unit text NOT NULL, expected_direction text NOT NULL, target_value numeric NOT NULL DEFAULT 0, warning_threshold numeric NOT NULL DEFAULT 0,
  critical_threshold numeric NOT NULL DEFAULT 0, measurement_window text NOT NULL, status text NOT NULL DEFAULT 'draft',
  valid_from date, valid_until date, version integer NOT NULL DEFAULT 1, approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, provenance jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_metric_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_id uuid REFERENCES grc_metric_definitions(id) ON DELETE CASCADE, period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
  numeric_value numeric NOT NULL, source_description text NOT NULL, measured_at timestamptz NOT NULL DEFAULT now(),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb, evidence_id uuid REFERENCES evidences(id) ON DELETE SET NULL, quality text NOT NULL DEFAULT 'valid',
  validation_status text NOT NULL DEFAULT 'pending', approved_by uuid REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz,
  comment text, trend text, impact_status text NOT NULL DEFAULT 'normal', idempotency_key text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_quantitative_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, risk_id uuid NOT NULL, organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL, service_id uuid REFERENCES grc_operational_services(id) ON DELETE SET NULL,
  scenario text NOT NULL, minimum_impact numeric(18,2) NOT NULL DEFAULT 0, most_likely_impact numeric(18,2) NOT NULL DEFAULT 0,
  maximum_impact numeric(18,2) NOT NULL DEFAULT 0, estimated_frequency numeric(12,6) NOT NULL DEFAULT 0,
  expected_impact numeric(18,2) NOT NULL DEFAULT 0, annualized_loss numeric(18,2) NOT NULL DEFAULT 0,
  residual_annualized_loss numeric(18,2), treatment_annualized_loss numeric(18,2), control_cost numeric(18,2) NOT NULL DEFAULT 0,
  expected_reduction numeric(18,2) NOT NULL DEFAULT 0, net_expected_benefit numeric(18,2) NOT NULL DEFAULT 0,
  sensitivity_notes text, treatment_comparison text, assumptions text NOT NULL, source_description text NOT NULL,
  status text NOT NULL DEFAULT 'draft', version integer NOT NULL DEFAULT 1, approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz, provenance jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_phase3_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL, entity_id uuid NOT NULL, from_status text, to_status text NOT NULL, reason text NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL, changed_at timestamptz NOT NULL DEFAULT now(), source_event_id uuid REFERENCES grc_domain_events(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS grc_phase3_readiness_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_event_id uuid REFERENCES grc_domain_events(id) ON DELETE CASCADE, entity_type text NOT NULL, entity_id uuid NOT NULL,
  dimension text NOT NULL, previous_score numeric(5,2) NOT NULL DEFAULT 0, new_score numeric(5,2) NOT NULL DEFAULT 0,
  reason_code text NOT NULL, explanation text NOT NULL, owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS grc_phase3_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL, template_version text NOT NULL, definition_version text NOT NULL, file_name text NOT NULL,
  status text NOT NULL, total_rows integer NOT NULL DEFAULT 0, valid_rows integer NOT NULL DEFAULT 0, invalid_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0, failed_rows integer NOT NULL DEFAULT 0, rolled_back_rows integer NOT NULL DEFAULT 0,
  rollback_blocked_rows integer NOT NULL DEFAULT 0, summary jsonb NOT NULL DEFAULT '{}'::jsonb, duplicate_policy text NOT NULL DEFAULT 'create_only',
  created_rows integer NOT NULL DEFAULT 0, updated_rows integer NOT NULL DEFAULT 0, unchanged_rows integer NOT NULL DEFAULT 0,
  warning_rows integer NOT NULL DEFAULT 0, request_id text, upload_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL, confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rolled_back_by uuid REFERENCES users(id) ON DELETE SET NULL, confirmed_at timestamptz, rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS grc_phase3_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES grc_phase3_import_batches(id) ON DELETE CASCADE, row_number integer NOT NULL,
  raw_data jsonb NOT NULL, normalized_data jsonb NOT NULL, errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb, status text NOT NULL, operation text NOT NULL DEFAULT 'create',
  previous_data jsonb, changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb, imported_version integer,
  created_entity_type text, created_entity_id uuid, processed_at timestamptz, rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_domain_events_tenant_id ON grc_domain_events(tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_grc_connector_instances_tenant_id ON grc_connector_instances(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_grc_phase1_scheduler_tenant_modules ON tenant_module_settings(module_key, is_enabled, tenant_id);
CREATE INDEX IF NOT EXISTS idx_grc_phase2_scheduler_connectors ON grc_connector_instances(status, next_sync_at) WHERE status = 'connected';
CREATE INDEX IF NOT EXISTS idx_grc_connector_runs_integration ON grc_connector_runs(tenant_id, integration_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_external_records_mapping ON grc_external_records(tenant_id, integration_id, mapping_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_phase3_import_batches_tenant ON grc_phase3_import_batches(tenant_id, entity_type, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_v3_grc_connector_runs_integration_same_tenant') THEN
    ALTER TABLE grc_connector_runs
      ADD CONSTRAINT fk_v3_grc_connector_runs_integration_same_tenant
      FOREIGN KEY (tenant_id, integration_id)
      REFERENCES grc_connector_instances(tenant_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_v3_grc_external_records_integration_same_tenant') THEN
    ALTER TABLE grc_external_records
      ADD CONSTRAINT fk_v3_grc_external_records_integration_same_tenant
      FOREIGN KEY (tenant_id, integration_id)
      REFERENCES grc_connector_instances(tenant_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_v3_grc_dead_letters_integration_same_tenant') THEN
    ALTER TABLE grc_connector_dead_letters
      ADD CONSTRAINT fk_v3_grc_dead_letters_integration_same_tenant
      FOREIGN KEY (tenant_id, integration_id)
      REFERENCES grc_connector_instances(tenant_id, id) ON DELETE CASCADE;
  END IF;
END $$;

GRANT SELECT ON saas_modules TO tcdx_backend_runtime;
GRANT SELECT, INSERT, UPDATE ON tenant_module_settings TO tcdx_backend_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  grc_workflow_definitions, grc_workflow_versions, grc_workflow_states,
  grc_workflow_transitions, grc_workflow_transition_roles, grc_workflow_instances,
  grc_workflow_history, grc_workflow_approvals, grc_workflow_comments,
  grc_workflow_attachments, grc_workflow_automation_rules, grc_workflow_automation_runs,
  grc_scheduler_runs, grc_escalation_policies, grc_escalation_events, grc_exports,
  grc_evidence_requests, grc_evidence_schedules, grc_evidence_requirements,
  grc_evidence_submissions, grc_evidence_versions, grc_evidence_reviews,
  grc_evidence_links, grc_evidence_quality_scores, grc_readiness_rules,
  grc_readiness_snapshots, grc_readiness_results, grc_readiness_findings,
  grc_frameworks, grc_framework_versions, grc_framework_requirements,
  grc_requirement_control_mappings, grc_mapping_reviews, grc_audit_universe_entities,
  grc_audit_annual_plans, grc_audit_plan_items, grc_audit_programs,
  grc_audit_team_members, grc_audit_conflicts, grc_audit_sample_plans,
  grc_audit_sample_items, grc_audit_workpapers, grc_audit_interviews,
  grc_audit_evidence_links, grc_audit_supervisor_reviews, grc_audit_reports,
  grc_audit_followups, grc_tenant_configurations, grc_bootstrap_runs,
  grc_phase2_relations, grc_domain_events, grc_rule_executions, grc_operational_alerts,
  grc_metric_observations, grc_obligations, grc_control_assurance,
  grc_effectiveness_verifications, grc_suppliers, grc_supplier_history,
  grc_supplier_services, grc_supplier_contracts, grc_questionnaire_templates,
  grc_questionnaire_versions, grc_questionnaire_sections, grc_questionnaire_questions,
  grc_supplier_assessments, grc_supplier_answers, grc_supplier_assessment_history,
  grc_supplier_portal_invitations, grc_supplier_portal_sessions,
  grc_supplier_portal_evidence, grc_supplier_exit_checks, privacy_processing_activities,
  privacy_processing_versions, privacy_processors, privacy_dpias, privacy_dpia_risks,
  privacy_data_subject_requests, privacy_consents, privacy_breaches, grc_incidents,
  grc_incident_history, grc_incident_timeline, grc_incident_impacts,
  grc_incident_notifications, grc_incident_root_causes, grc_incident_postmortems,
  grc_connector_instances, grc_connector_runs, grc_external_records,
  grc_connector_mappings, grc_connector_dead_letters, grc_organizational_units,
  grc_operational_services, grc_operational_dependencies, grc_bia_assessments,
  grc_bia_impacts, grc_continuity_plans, grc_continuity_tests, grc_crisis_activations,
  grc_crisis_log, grc_metric_definitions, grc_metric_measurements,
  grc_quantitative_risk_assessments, grc_phase3_state_history,
  grc_phase3_readiness_impacts, grc_phase3_import_batches, grc_phase3_import_rows
TO tcdx_backend_runtime;
GRANT SELECT ON grc_connector_definitions TO tcdx_backend_runtime;

REVOKE EXECUTE ON FUNCTION reconcile_tenant_module_settings_enabled() FROM PUBLIC;


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
  dbn02_resolve_control_standard_code(uuid, uuid),
  reconcile_tenant_nonconformity_contract(),
  reconcile_evidence_contract(),
  enqueue_evidence_ai_job(uuid, uuid, text, jsonb, smallint, timestamp, uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  tcdx_security.current_tenant_id(),
  tcdx_security.platform_scope_enabled(),
  tcdx_security.tenant_visible(uuid),
  tcdx_security.tenant_write_allowed(uuid),
  dbn02_normalize_health_component_state(text, boolean, timestamptz, interval, timestamptz),
  dbn02_grc_health_publication_state(numeric, numeric, numeric),
  dbn02_resolve_control_standard_code(uuid, uuid),
  enqueue_evidence_ai_job(uuid, uuid, text, jsonb, smallint, timestamp, uuid)
TO tcdx_backend_runtime;
GRANT SELECT ON app_roles, permissions, role_permissions, standards, controls_catalog, controls_catalog_standards,
  commercial_plans, commercial_plan_versions, commercial_technical_capabilities, commercial_addons, plan_version_capabilities,
  official_formula_definitions, official_formula_versions, official_formula_source_contracts,
  data_source_contracts, data_source_contract_versions, data_source_field_mappings,
  usage_limit_definitions, metric_job_policies,
  grc_connector_definitions, grc_gap_rules, knowledge_sources, knowledge_items,
  standard_lifecycle_stage_catalog, regulatory_authoritative_sources, regulations,
  legal_obligations, regulatory_packs TO tcdx_backend_runtime;
GRANT SELECT ON public.v_iso_control_effective_health, public.v_iso_effective_kpi_summary,
  public.v_iso_risk_matrix_latest_runs, public.v_iso_risk_matrix_summary,
  public.v_commercial_tenant_subscription, public.v_commercial_tenant_modules,
  public.v_commercial_tenant_capabilities, public.v_tenant_commercial_entitlements,
  public.v_commercial_tenant_health, public.vw_evidence_current_extracts,
  public.vw_evidence_current_ai_assessments TO tcdx_backend_runtime;
GRANT SELECT ON commercial_addons TO tcdx_backend_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, tenant_standards, tenant_controls, control_soa, control_soa_assessments,
  tenant_operations, tenant_standard_operations, control_soa_change_log, findings, evidences, action_plans, action_plan_updates,
  assets, asset_standards, asset_risks, risks, risk_control_relations, audits,
  iso_risk_templates, iso_risk_matrix_runs, iso_risk_matrix_items, iso_risk_matrix_actions, iso_risk_matrix_audit_log,
  grc_readiness_snapshots, grc_readiness_results, grc_readiness_findings,
  metric_source_bindings, calculation_runs, calculation_inputs, calculation_validations, calculation_snapshots, metric_snapshots,
  tenant_usage_limits, commercial_events, metric_sufficiency_rules, metric_interpretations, metric_action_proposals, data_comparisons,
  audit_event_log, data_snapshots, data_lineage_edges, grc_observations, grc_observation_relations,
  grc_gaps, grc_gap_status_history, grc_gap_hypotheses, metric_definitions, metric_formula_versions,
  metric_definition_versions, metric_thresholds, metric_calculation_policies, metric_trust_policies,
  metric_measurements, metric_trust_assessments, knowledge_documents, knowledge_document_ingestions,
  evidence_document_extracts, evidence_ai_assessments, evidence_ai_jobs, evidence_knowledge_chunks,
  standard_lifecycle_status, standard_lifecycle_snapshots, standard_lifecycle_stage_requests,
  standard_lifecycle_ai_feed,
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
  evidence_document_extracts, evidence_ai_assessments, evidence_ai_jobs, evidence_knowledge_chunks,
  standard_lifecycle_stage_catalog, standard_lifecycle_status, standard_lifecycle_snapshots,
  standard_lifecycle_stage_requests, standard_lifecycle_ai_feed,
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
