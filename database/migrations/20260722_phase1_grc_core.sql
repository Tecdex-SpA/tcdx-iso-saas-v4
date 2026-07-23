-- TCDX ISO SaaS v4 - Phase 1 GRC core
-- Additive, tenant-scoped and deny-by-default. No licensed standard text is seeded.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO saas_modules (
  module_key, display_name, description, default_enabled, is_system, is_active, sort_order
) VALUES (
  'grc_phase1_core',
  'Nucleo GRC Fase 1',
  'Workflows, evidencia continua, readiness, cruces normativos y auditoria avanzada.',
  FALSE,
  TRUE,
  TRUE,
  45
)
ON CONFLICT (module_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  default_enabled = FALSE,
  is_active = TRUE,
  updated_at = now();

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('workflow.read', 'workflow', 'Consultar workflows', 'Consulta definiciones, instancias e historial.'),
  ('workflow.manage', 'workflow', 'Administrar workflows', 'Crea borradores, valida y publica versiones.'),
  ('workflow.transition', 'workflow', 'Ejecutar transiciones', 'Ejecuta transiciones autorizadas.'),
  ('evidence.request.read', 'evidence', 'Consultar solicitudes de evidencia', 'Consulta solicitudes, entregas y calidad.'),
  ('evidence.request.manage', 'evidence', 'Administrar solicitudes de evidencia', 'Crea solicitudes y recurrencias.'),
  ('evidence.review', 'evidence', 'Revisar evidencia', 'Aprueba o rechaza entregas con causa.'),
  ('readiness.read', 'readiness', 'Consultar readiness', 'Consulta snapshots y drill-down.'),
  ('readiness.generate', 'readiness', 'Generar readiness', 'Genera snapshots deterministas.'),
  ('framework.read', 'framework', 'Consultar frameworks', 'Consulta versiones, requisitos y mappings.'),
  ('framework.manage', 'framework', 'Administrar frameworks', 'Administra versiones y mappings.'),
  ('audit.plan.read', 'audit', 'Consultar plan de auditoria', 'Consulta universo, planes y programas.'),
  ('audit.plan.manage', 'audit', 'Administrar plan de auditoria', 'Administra universo y plan anual.'),
  ('audit.workpaper.manage', 'audit', 'Administrar papeles de trabajo', 'Crea y actualiza papeles de trabajo.'),
  ('audit.review', 'audit', 'Revisar auditoria', 'Revisa y aprueba entregables de auditoria.'),
  ('audit.report.generate', 'audit', 'Generar informe de auditoria', 'Genera informes reproducibles.'),
  ('grc.scheduler.run', 'workflow', 'Ejecutar scheduler GRC', 'Ejecuta manualmente jobs recurrentes controlados.'),
  ('grc.escalation.manage', 'workflow', 'Administrar escalamiento GRC', 'Configura politicas tenant de SLA y escalamiento.'),
  ('grc.export.generate', 'audit', 'Generar exportaciones GRC', 'Genera exportaciones trazables y reproducibles.')
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = now();

-- Conservative defaults: tenant admins manage, auditors operate/review, area owners submit.
INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin')
  AND (
    p.permission_key LIKE ANY (ARRAY['workflow.%', 'evidence.%', 'readiness.%', 'framework.%', 'audit.%'])
    OR p.permission_key IN ('grc.scheduler.run', 'grc.escalation.manage', 'grc.export.generate')
  )
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key = 'auditor'
  AND p.permission_key IN (
    'workflow.read', 'workflow.transition', 'evidence.request.read', 'evidence.review',
    'readiness.read', 'readiness.generate', 'framework.read', 'audit.plan.read',
    'audit.workpaper.manage', 'audit.review', 'audit.report.generate', 'grc.export.generate'
  )
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('operativo', 'responsable_area', 'area_owner')
  AND p.permission_key IN ('workflow.read', 'workflow.transition', 'evidence.request.read')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

-- Workflow definitions and immutable published versions.
CREATE TABLE IF NOT EXISTS grc_workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  entity_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  active_version_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES grc_workflow_definitions(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  approval_mode text NOT NULL DEFAULT 'simple' CHECK (approval_mode IN ('simple', 'sequential', 'parallel', 'quorum', 'unanimous')),
  quorum integer CHECK (quorum IS NULL OR quorum > 0),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, definition_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'grc_workflow_definitions_active_version_id_fkey'
      AND conrelid = 'grc_workflow_definitions'::regclass
  ) THEN
    ALTER TABLE grc_workflow_definitions
      ADD CONSTRAINT grc_workflow_definitions_active_version_id_fkey
      FOREIGN KEY (active_version_id) REFERENCES grc_workflow_versions(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS grc_workflow_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES grc_workflow_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  state_type text NOT NULL DEFAULT 'active' CHECK (state_type IN ('initial', 'active', 'terminal', 'rejected')),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, version_id, code)
);

CREATE TABLE IF NOT EXISTS grc_workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES grc_workflow_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  from_state_id uuid NOT NULL REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  to_state_id uuid NOT NULL REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  required_permission text REFERENCES permissions(permission_key) ON DELETE RESTRICT,
  approval_mode text NOT NULL DEFAULT 'none' CHECK (approval_mode IN ('none', 'simple', 'sequential', 'parallel', 'quorum', 'unanimous')),
  quorum integer CHECK (quorum IS NULL OR quorum > 0),
  approval_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sla_hours integer CHECK (sla_hours IS NULL OR sla_hours > 0),
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, version_id, code),
  CHECK (from_state_id <> to_state_id)
);

CREATE TABLE IF NOT EXISTS grc_workflow_transition_roles (
  transition_id uuid NOT NULL REFERENCES grc_workflow_transitions(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES app_roles(role_key) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (transition_id, role_key)
);

CREATE TABLE IF NOT EXISTS grc_workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid,
  unit_id uuid,
  definition_id uuid NOT NULL REFERENCES grc_workflow_definitions(id) ON DELETE RESTRICT,
  version_id uuid NOT NULL REFERENCES grc_workflow_versions(id) ON DELETE RESTRICT,
  current_state_id uuid NOT NULL REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'rejected', 'cancelled')),
  due_at timestamptz,
  correlation_id text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  lock_version integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id, definition_id)
);

CREATE TABLE IF NOT EXISTS grc_workflow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES grc_workflow_instances(id) ON DELETE RESTRICT,
  transition_id uuid REFERENCES grc_workflow_transitions(id) ON DELETE RESTRICT,
  from_state_id uuid REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  to_state_id uuid NOT NULL REFERENCES grc_workflow_states(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role text,
  permission_key text,
  correlation_id text,
  comment text,
  precondition_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  transition_id uuid NOT NULL REFERENCES grc_workflow_transitions(id) ON DELETE RESTRICT,
  sequence_no integer NOT NULL DEFAULT 1,
  reviewer_role text,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected', 'returned', 'expired', 'delegated', 'substituted')),
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
  instance_id uuid NOT NULL REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  comment text NOT NULL CHECK (length(trim(comment)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_workflow_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  document_id uuid,
  attached_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_workflow_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES grc_workflow_versions(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('sla', 'reminder', 'escalation', 'webhook')),
  code text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, version_id, rule_type, code)
);

CREATE TABLE IF NOT EXISTS grc_workflow_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES grc_workflow_automation_rules(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'dead_letter')),
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
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'partial_failure', 'failed', 'skipped')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
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

CREATE TABLE IF NOT EXISTS grc_escalation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  entity_type text NOT NULL,
  criticality text,
  sla_hours integer CHECK (sla_hours IS NULL OR sla_hours > 0),
  prior_notice_hours integer NOT NULL DEFAULT 24 CHECK (prior_notice_hours >= 0),
  first_escalation_hours integer NOT NULL DEFAULT 0 CHECK (first_escalation_hours >= 0),
  second_escalation_hours integer NOT NULL DEFAULT 24 CHECK (second_escalation_hours >= 0),
  responsible_id uuid REFERENCES users(id) ON DELETE SET NULL,
  supervisor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  role_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_escalation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES grc_escalation_policies(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  stage text NOT NULL CHECK (stage IN ('prior_notice', 'overdue', 'escalation_1', 'escalation_2', 'resolved', 'cancelled')),
  due_at timestamptz,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_id, entity_type, entity_id, stage)
);

CREATE TABLE IF NOT EXISTS grc_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain text NOT NULL CHECK (domain IN ('audit', 'evidence', 'readiness', 'frameworks', 'mappings', 'findings', 'actions')),
  format text NOT NULL CHECK (format IN ('pdf', 'docx', 'xlsx', 'csv')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot jsonb NOT NULL,
  source_hash text NOT NULL,
  content_hash text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
  file_content bytea NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  correlation_id text,
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- Continuous evidence requests, recurrence, submissions, versions and shared links.
CREATE TABLE IF NOT EXISTS grc_evidence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'requested', 'submitted', 'under_review', 'approved', 'rejected', 'expired', 'cancelled', 'superseded')),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_at timestamptz,
  valid_until date,
  workflow_instance_id uuid REFERENCES grc_workflow_instances(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_evidence_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_template_id uuid NOT NULL REFERENCES grc_evidence_requests(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom', 'event')),
  interval_value integer NOT NULL DEFAULT 1 CHECK (interval_value > 0),
  start_at timestamptz NOT NULL,
  next_run_at timestamptz,
  event_key text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grc_evidence_requests
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES grc_evidence_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_evidence_request_occurrence
  ON grc_evidence_requests (tenant_id, schedule_id, occurrence_key)
  WHERE schedule_id IS NOT NULL AND occurrence_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS grc_evidence_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES grc_evidence_requests(id) ON DELETE CASCADE,
  requirement_type text NOT NULL CHECK (requirement_type IN ('control', 'requirement', 'framework', 'audit', 'risk')),
  requirement_id uuid NOT NULL,
  mandatory boolean NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, request_id, requirement_type, requirement_id)
);

CREATE TABLE IF NOT EXISTS grc_evidence_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES grc_evidence_requests(id) ON DELETE RESTRICT,
  evidence_id uuid NOT NULL REFERENCES evidences(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'superseded')),
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS grc_evidence_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES grc_evidence_submissions(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  evidence_id uuid NOT NULL REFERENCES evidences(id) ON DELETE RESTRICT,
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
  submission_id uuid NOT NULL REFERENCES grc_evidence_submissions(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'reopened')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision <> 'rejected' OR length(trim(COALESCE(reason, ''))) > 0)
);

CREATE TABLE IF NOT EXISTS grc_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidences(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evidence_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS grc_evidence_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  formula_version text NOT NULL,
  factors jsonb NOT NULL,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evidence_id, formula_version)
);

-- Deterministic audit-readiness rules and immutable snapshots.
CREATE TABLE IF NOT EXISTS grc_readiness_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('requirements', 'controls', 'evidence', 'risks', 'actions', 'audits', 'documents', 'objectives')),
  source_table text NOT NULL,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula text NOT NULL,
  weight numeric(8,4) NOT NULL CHECK (weight > 0),
  threshold numeric(8,4) NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT TRUE,
  UNIQUE NULLS NOT DISTINCT (tenant_id, code, version)
);

CREATE TABLE IF NOT EXISTS grc_readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  formula_version text NOT NULL,
  input_hash text NOT NULL,
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  period_start date,
  period_end date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, input_hash)
);

CREATE TABLE IF NOT EXISTS grc_readiness_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES grc_readiness_snapshots(id) ON DELETE RESTRICT,
  rule_id uuid NOT NULL REFERENCES grc_readiness_rules(id) ON DELETE RESTRICT,
  dimension text NOT NULL,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  weight numeric(8,4) NOT NULL,
  included_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_as_of timestamptz NOT NULL,
  UNIQUE (tenant_id, snapshot_id, rule_id)
);

CREATE TABLE IF NOT EXISTS grc_readiness_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES grc_readiness_snapshots(id) ON DELETE RESTRICT,
  result_id uuid NOT NULL REFERENCES grc_readiness_results(id) ON DELETE RESTRICT,
  finding_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  source_type text NOT NULL,
  source_id uuid,
  explanation text NOT NULL,
  UNIQUE (tenant_id, snapshot_id, finding_code, source_id)
);

-- Versioned framework registry; only references/interpretations are stored.
CREATE TABLE IF NOT EXISTS grc_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  publisher text,
  content_classification text NOT NULL CHECK (content_classification IN ('official_reference', 'tcdx_interpretation', 'customer_content', 'licensed_content', 'public_law')),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_framework_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES grc_frameworks(id) ON DELETE RESTRICT,
  version_label text NOT NULL,
  effective_from date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'superseded', 'archived')),
  source_url text,
  license_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, framework_id, version_label)
);

CREATE TABLE IF NOT EXISTS grc_framework_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES grc_framework_versions(id) ON DELETE RESTRICT,
  reference_code text NOT NULL,
  permitted_title text,
  tcdx_interpretation text,
  content_classification text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE NULLS NOT DISTINCT (tenant_id, version_id, reference_code)
);

CREATE TABLE IF NOT EXISTS grc_requirement_control_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES grc_framework_requirements(id) ON DELETE RESTRICT,
  tenant_control_id uuid REFERENCES tenant_controls(id) ON DELETE RESTRICT,
  catalog_control_id uuid,
  mapping_type text NOT NULL CHECK (mapping_type IN ('exact', 'partial', 'related', 'support', 'not_equivalent', 'pending_review')),
  coverage_level numeric(5,2) NOT NULL DEFAULT 0 CHECK (coverage_level BETWEEN 0 AND 100),
  justification text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('official_reference', 'tcdx_interpretation', 'customer_content', 'licensed_content', 'public_law')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published', 'rejected')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, requirement_id, tenant_control_id, catalog_control_id)
);

CREATE TABLE IF NOT EXISTS grc_mapping_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  mapping_id uuid NOT NULL REFERENCES grc_requirement_control_mappings(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit advanced workspace, linked to the existing audits table.
CREATE TABLE IF NOT EXISTS grc_audit_universe_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('process', 'unit', 'site', 'system', 'supplier', 'control', 'framework', 'risk')),
  entity_id uuid,
  name text NOT NULL,
  risk_score numeric(8,2),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS grc_audit_annual_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'archived')),
  prioritization_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, year, version)
);

CREATE TABLE IF NOT EXISTS grc_audit_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  annual_plan_id uuid NOT NULL REFERENCES grc_audit_annual_plans(id) ON DELETE CASCADE,
  universe_entity_id uuid NOT NULL REFERENCES grc_audit_universe_entities(id) ON DELETE RESTRICT,
  audit_id uuid REFERENCES audits(id) ON DELETE SET NULL,
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  planned_start date,
  planned_end date,
  effort_hours numeric(10,2),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  UNIQUE (tenant_id, annual_plan_id, universe_entity_id)
);

CREATE TABLE IF NOT EXISTS grc_audit_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'locked')),
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  procedures jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, audit_id, version)
);

CREATE TABLE IF NOT EXISTS grc_audit_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  team_role text NOT NULL,
  independence_status text NOT NULL DEFAULT 'pending' CHECK (independence_status IN ('pending', 'declared', 'conflict', 'cleared')),
  declaration jsonb NOT NULL DEFAULT '{}'::jsonb,
  declared_at timestamptz,
  UNIQUE (tenant_id, audit_id, user_id)
);

CREATE TABLE IF NOT EXISTS grc_audit_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES grc_audit_team_members(id) ON DELETE CASCADE,
  conflict_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'accepted', 'rejected')),
  resolution text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS grc_audit_sample_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  population_description text NOT NULL,
  population_size integer CHECK (population_size IS NULL OR population_size >= 0),
  method text NOT NULL,
  sample_size integer NOT NULL CHECK (sample_size > 0),
  selection_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  random_seed text,
  limitation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_audit_sample_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sample_plan_id uuid NOT NULL REFERENCES grc_audit_sample_plans(id) ON DELETE CASCADE,
  population_reference text NOT NULL,
  selection_reason text,
  result text,
  exception_detail text,
  UNIQUE (tenant_id, sample_plan_id, population_reference)
);

CREATE TABLE IF NOT EXISTS grc_audit_workpapers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  objective text NOT NULL,
  procedure_text text NOT NULL,
  population text,
  sample_summary text,
  result text,
  conclusion text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'changes_requested', 'approved', 'locked')),
  prepared_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, audit_id, code, version)
);

CREATE TABLE IF NOT EXISTS grc_audit_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  agenda text,
  questions_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmation_status text NOT NULL DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'disputed')),
  confidentiality text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_audit_evidence_links (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidences(id) ON DELETE RESTRICT,
  workpaper_id uuid REFERENCES grc_audit_workpapers(id) ON DELETE CASCADE,
  linked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, audit_id, evidence_id, workpaper_id)
);

CREATE TABLE IF NOT EXISTS grc_audit_supervisor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  workpaper_id uuid REFERENCES grc_audit_workpapers(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('assigned', 'approved', 'returned', 'changes_requested', 'reopened', 'accepted')),
  observations text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_id uuid REFERENCES evidences(id) ON DELETE RESTRICT,
  previous_review_id uuid REFERENCES grc_audit_supervisor_reviews(id) ON DELETE SET NULL,
  confirmation_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'superseded')),
  report_format text NOT NULL CHECK (report_format IN ('pdf', 'docx', 'xlsx')),
  file_url text,
  content_hash text,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, audit_id, version, report_format)
);

CREATE TABLE IF NOT EXISTS grc_audit_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES findings(id) ON DELETE RESTRICT,
  action_plan_id uuid REFERENCES action_plans(id) ON DELETE RESTRICT,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'verified', 'closed', 'overdue')),
  verification_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Global framework references. Titles are identifiers only; no protected clause text.
INSERT INTO grc_frameworks (tenant_id, code, name, publisher, content_classification)
VALUES
  (NULL, 'ISO-9001', 'ISO 9001', 'ISO', 'official_reference'),
  (NULL, 'ISO-27001', 'ISO/IEC 27001', 'ISO/IEC', 'official_reference'),
  (NULL, 'ISO-27002', 'ISO/IEC 27002', 'ISO/IEC', 'official_reference'),
  (NULL, 'ISO-42001', 'ISO/IEC 42001', 'ISO/IEC', 'official_reference'),
  (NULL, 'ISO-22301', 'ISO 22301', 'ISO', 'official_reference'),
  (NULL, 'NIST-CSF', 'NIST Cybersecurity Framework', 'NIST', 'official_reference'),
  (NULL, 'CIS-CONTROLS', 'CIS Controls', 'CIS', 'official_reference'),
  (NULL, 'LEY-21663', 'Ley 21.663', 'Estado de Chile', 'public_law'),
  (NULL, 'LEY-21719', 'Ley 21.719', 'Estado de Chile', 'public_law')
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  publisher = EXCLUDED.publisher,
  content_classification = EXCLUDED.content_classification,
  is_active = TRUE;

INSERT INTO grc_framework_versions (tenant_id, framework_id, version_label, status, effective_from, source_url, published_at)
SELECT NULL, f.id, seed.version_label, 'published', seed.effective_from::date, seed.source_url, now()
FROM grc_frameworks f
JOIN (VALUES
  ('ISO-9001', '2015', '2015-09-15', 'https://www.iso.org/standard/62085.html'),
  ('ISO-27001', '2022', '2022-10-25', 'https://www.iso.org/standard/27001'),
  ('ISO-27002', '2022', '2022-02-15', 'https://www.iso.org/standard/75652.html'),
  ('ISO-42001', '2023', '2023-12-18', 'https://www.iso.org/standard/81230.html'),
  ('ISO-22301', '2019', '2019-10-31', 'https://www.iso.org/standard/75106.html'),
  ('NIST-CSF', '2.0', '2024-02-26', 'https://www.nist.gov/cyberframework'),
  ('CIS-CONTROLS', '8', '2021-05-18', 'https://www.cisecurity.org/controls/v8'),
  ('LEY-21663', 'vigente', '2024-04-08', 'https://www.bcn.cl/leychile/navegar?idNorma=1202434'),
  ('LEY-21719', 'vigente', '2024-12-13', 'https://www.bcn.cl/leychile/navegar?idNorma=1209272')
) AS seed(code, version_label, effective_from, source_url) ON seed.code = f.code
WHERE f.tenant_id IS NULL
ON CONFLICT (tenant_id, framework_id, version_label) DO NOTHING;

-- Tenant/status/due-date indexes used by all runtime paths.
CREATE INDEX IF NOT EXISTS idx_grc_workflow_definitions_tenant_entity ON grc_workflow_definitions (tenant_id, entity_type, status);
CREATE INDEX IF NOT EXISTS idx_grc_workflow_instances_tenant_state ON grc_workflow_instances (tenant_id, status, current_state_id);
CREATE INDEX IF NOT EXISTS idx_grc_workflow_instances_due ON grc_workflow_instances (tenant_id, due_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_grc_workflow_history_instance_created ON grc_workflow_history (tenant_id, instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_workflow_automation_due ON grc_workflow_automation_runs (tenant_id, status, run_after);
CREATE INDEX IF NOT EXISTS idx_grc_scheduler_retry ON grc_scheduler_runs (tenant_id, status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_grc_escalation_policy_entity ON grc_escalation_policies (tenant_id, entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_grc_escalation_event_entity ON grc_escalation_events (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_exports_tenant_generated ON grc_exports (tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_evidence_requests_status_due ON grc_evidence_requests (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_grc_evidence_schedules_due ON grc_evidence_schedules (tenant_id, next_run_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_grc_evidence_links_entity ON grc_evidence_links (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_grc_readiness_snapshots_tenant_generated ON grc_readiness_snapshots (tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_readiness_results_snapshot_dimension ON grc_readiness_results (tenant_id, snapshot_id, dimension);
CREATE INDEX IF NOT EXISTS idx_grc_framework_versions_status ON grc_framework_versions (framework_id, status, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_grc_mappings_tenant_status ON grc_requirement_control_mappings (tenant_id, status, mapping_type);
CREATE INDEX IF NOT EXISTS idx_grc_audit_plan_year_status ON grc_audit_annual_plans (tenant_id, year, status);
CREATE INDEX IF NOT EXISTS idx_grc_audit_workpapers_status ON grc_audit_workpapers (tenant_id, audit_id, status);
CREATE INDEX IF NOT EXISTS idx_grc_audit_followups_due ON grc_audit_followups (tenant_id, status, due_at);

-- Published workflow versions and readiness snapshots are immutable.
CREATE OR REPLACE FUNCTION grc_reject_immutable_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grc_published_workflow_immutable') THEN
    CREATE TRIGGER trg_grc_published_workflow_immutable
    BEFORE UPDATE OR DELETE ON grc_workflow_versions
    FOR EACH ROW WHEN (OLD.status = 'published')
    EXECUTE FUNCTION grc_reject_immutable_update();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grc_readiness_snapshot_immutable') THEN
    CREATE TRIGGER trg_grc_readiness_snapshot_immutable
    BEFORE UPDATE OR DELETE ON grc_readiness_snapshots
    FOR EACH ROW EXECUTE FUNCTION grc_reject_immutable_update();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grc_readiness_result_immutable') THEN
    CREATE TRIGGER trg_grc_readiness_result_immutable
    BEFORE UPDATE OR DELETE ON grc_readiness_results
    FOR EACH ROW EXECUTE FUNCTION grc_reject_immutable_update();
  END IF;
END;
$$;

COMMIT;
