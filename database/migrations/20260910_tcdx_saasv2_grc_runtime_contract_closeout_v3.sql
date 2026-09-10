BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091003) THEN
    RAISE EXCEPTION 'TCDX SaaSv2 GRC runtime contract closeout V3 lock unavailable';
  END IF;
END $$;

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

COMMIT;
