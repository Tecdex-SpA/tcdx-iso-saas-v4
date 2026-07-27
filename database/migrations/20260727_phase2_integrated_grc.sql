-- TCDX ISO SaaS v4 - Phase 2 integrated GRC
-- Additive, tenant-scoped and deny-by-default.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE grc_exports DROP CONSTRAINT IF EXISTS grc_exports_domain_check;
ALTER TABLE grc_exports ADD CONSTRAINT grc_exports_domain_check CHECK (domain IN (
  'audit', 'evidence', 'readiness', 'frameworks', 'mappings', 'findings', 'actions',
  'privacy_inventory', 'privacy_risk', 'dpia_status', 'privacy_requests',
  'incidents', 'postmortem', 'suppliers', 'supplier_assessments',
  'supplier_evidence', 'connectors_health', 'executive_phase2'
));

INSERT INTO saas_modules (
  module_key, display_name, description, default_enabled, is_system, is_active, sort_order
) VALUES (
  'grc_phase2_integrated',
  'GRC integrado Fase 2',
  'Privacidad, incidentes, terceros, conectores y vista GRC global.',
  FALSE,
  TRUE,
  TRUE,
  46
)
ON CONFLICT (module_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  default_enabled = FALSE,
  is_active = TRUE,
  updated_at = now();

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('privacy.read', 'privacy', 'Consultar privacidad', 'Consulta actividades, DPIA, solicitudes y brechas.'),
  ('privacy.manage', 'privacy', 'Administrar privacidad', 'Administra el registro de tratamientos y relaciones.'),
  ('privacy.approve', 'privacy', 'Aprobar privacidad', 'Aprueba actividades, DPIA y cierres de privacidad.'),
  ('privacy.dpia.manage', 'privacy', 'Administrar DPIA', 'Gestiona evaluaciones de impacto de privacidad.'),
  ('privacy.requests.manage', 'privacy', 'Administrar solicitudes de titulares', 'Gestiona plazos, respuestas y cierres.'),
  ('privacy.breaches.manage', 'privacy', 'Administrar brechas de privacidad', 'Gestiona brechas y obligaciones asociadas.'),
  ('incidents.read', 'incidents', 'Consultar incidentes', 'Consulta incidentes e historial.'),
  ('incidents.manage', 'incidents', 'Administrar incidentes', 'Reporta, clasifica y gestiona incidentes.'),
  ('incidents.command', 'incidents', 'Comandar incidentes', 'Confirma severidad y coordina respuesta.'),
  ('incidents.close', 'incidents', 'Cerrar incidentes', 'Aprueba cierre y eficacia del incidente.'),
  ('incidents.notifications.manage', 'incidents', 'Administrar notificaciones', 'Gestiona comunicaciones y notificaciones regulatorias.'),
  ('suppliers.read', 'suppliers', 'Consultar proveedores', 'Consulta portafolio y evaluaciones.'),
  ('suppliers.manage', 'suppliers', 'Administrar proveedores', 'Administra onboarding, contratos y salida.'),
  ('suppliers.assess', 'suppliers', 'Evaluar proveedores', 'Gestiona cuestionarios, evidencia y riesgo.'),
  ('suppliers.approve', 'suppliers', 'Aprobar proveedores', 'Aprueba evaluaciones y riesgo residual.'),
  ('suppliers.portal.manage', 'suppliers', 'Administrar portal de proveedores', 'Emite y revoca invitaciones externas.'),
  ('connectors.read', 'connectors', 'Consultar conectores', 'Consulta catálogo, salud e historial.'),
  ('connectors.manage', 'connectors', 'Administrar conectores', 'Configura instancias, mappings y webhooks.'),
  ('connectors.credentials.manage', 'connectors', 'Administrar credenciales', 'Administra credenciales cifradas sin exponerlas.'),
  ('connectors.sync.run', 'connectors', 'Ejecutar sincronizaciones', 'Ejecuta y reintenta sincronizaciones.'),
  ('connectors.logs.read', 'connectors', 'Consultar logs de conectores', 'Consulta ejecuciones, errores y dead-letter.'),
  ('grc.phase2.export', 'reporting', 'Exportar Fase 2', 'Genera exportaciones tenant-scoped y auditadas.')
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin')
  AND (
    p.permission_group IN ('privacy', 'incidents', 'suppliers', 'connectors')
    OR p.permission_key = 'grc.phase2.export'
  )
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key = 'auditor'
  AND p.permission_key IN (
    'privacy.read', 'privacy.dpia.manage', 'incidents.read', 'incidents.manage',
    'suppliers.read', 'suppliers.assess', 'connectors.read', 'connectors.logs.read',
    'grc.phase2.export'
  )
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('operativo', 'responsable_area', 'area_owner')
  AND p.permission_key IN (
    'privacy.read', 'incidents.read', 'incidents.manage', 'suppliers.read', 'connectors.read'
  )
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

-- Controlled cross-domain relation. Polymorphism is limited by explicit checks and
-- every mutation is validated against a tenant-scoped entity registry in the service.
CREATE TABLE IF NOT EXISTS grc_phase2_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN (
    'requirement', 'obligation', 'process', 'operation', 'asset', 'supplier',
    'processing_activity', 'dpia', 'privacy_request', 'privacy_breach', 'incident',
    'risk', 'control', 'evidence', 'metric', 'audit', 'finding', 'nonconformity',
    'action', 'connector', 'external_record'
  )),
  source_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN (
    'requirement', 'obligation', 'process', 'operation', 'asset', 'supplier',
    'processing_activity', 'dpia', 'privacy_request', 'privacy_breach', 'incident',
    'risk', 'control', 'evidence', 'metric', 'audit', 'finding', 'nonconformity',
    'action', 'connector', 'external_record'
  )),
  target_id uuid NOT NULL,
  relation_type text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('proposed', 'active', 'rejected', 'expired', 'superseded')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,2) NOT NULL DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_type <> target_type OR source_id <> target_id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  UNIQUE (tenant_id, source_type, source_id, target_type, target_id, relation_type, version)
);

CREATE TABLE IF NOT EXISTS grc_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version integer NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  causation_id uuid REFERENCES grc_domain_events(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS grc_rule_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES grc_domain_events(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  rule_version integer NOT NULL DEFAULT 1 CHECK (rule_version > 0),
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
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
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
  metric_type text NOT NULL CHECK (metric_type IN ('kpi', 'kri', 'operational', 'assurance')),
  numeric_value numeric,
  text_value text,
  unit text,
  observed_at timestamptz NOT NULL,
  valid_until timestamptz,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  provenance jsonb NOT NULL,
  confidence numeric(5,2) NOT NULL DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (numeric_value IS NOT NULL OR text_value IS NOT NULL),
  CHECK (provenance <> '{}'::jsonb)
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
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'due', 'fulfilled', 'breached', 'waived')),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  evidence_required boolean NOT NULL DEFAULT TRUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_control_assurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid NOT NULL REFERENCES tenant_controls(id) ON DELETE CASCADE,
  assurance_status text NOT NULL CHECK (assurance_status IN ('unknown', 'incomplete', 'degraded', 'effective', 'ineffective')),
  score numeric(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  source_event_id uuid REFERENCES grc_domain_events(id) ON DELETE SET NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version text NOT NULL DEFAULT 'phase2-assurance-v1',
  UNIQUE (tenant_id, tenant_control_id)
);

CREATE TABLE IF NOT EXISTS grc_effectiveness_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('effective', 'partially_effective', 'ineffective')),
  criteria text NOT NULL,
  result text NOT NULL,
  verified_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now(),
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  followup_due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, action_plan_id, verified_at)
);

-- Third-party risk master and lifecycle.
CREATE TABLE IF NOT EXISTS grc_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  tax_identifier text,
  country_code text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'due_diligence', 'under_assessment', 'remediation_required',
    'pending_approval', 'approved', 'active', 'reassessment_required',
    'suspended', 'exit_in_progress', 'exited'
  )),
  criticality text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
  inherent_risk_score numeric(5,2) CHECK (inherent_risk_score BETWEEN 0 AND 100),
  residual_risk_score numeric(5,2) CHECK (residual_risk_score BETWEEN 0 AND 100),
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  data_access_level text NOT NULL DEFAULT 'none' CHECK (data_access_level IN ('none', 'internal', 'confidential', 'personal', 'sensitive')),
  access_summary text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  next_assessment_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_supplier_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_supplier_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  service_criticality text NOT NULL DEFAULT 'medium' CHECK (service_criticality IN ('low', 'medium', 'high', 'critical')),
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  operation_id uuid REFERENCES tenant_operations(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  dependency_type text NOT NULL DEFAULT 'supporting' CHECK (dependency_type IN ('supporting', 'important', 'critical')),
  active boolean NOT NULL DEFAULT TRUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_supplier_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  contract_number text NOT NULL,
  title text NOT NULL,
  starts_on date,
  ends_on date,
  renewal_on date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'renewal_due', 'expired', 'terminated')),
  security_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  exit_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_id, contract_number)
);

CREATE TABLE IF NOT EXISTS grc_questionnaire_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_questionnaire_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES grc_questionnaire_templates(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  scoring_model jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS grc_questionnaire_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES grc_questionnaire_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (version_id, code)
);

CREATE TABLE IF NOT EXISTS grc_questionnaire_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES grc_questionnaire_sections(id) ON DELETE CASCADE,
  code text NOT NULL,
  prompt text NOT NULL,
  answer_type text NOT NULL CHECK (answer_type IN ('boolean', 'text', 'number', 'single_choice', 'multiple_choice', 'date')),
  required boolean NOT NULL DEFAULT TRUE,
  weight numeric(8,3) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_required boolean NOT NULL DEFAULT FALSE,
  risk_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  control_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (section_id, code)
);

CREATE TABLE IF NOT EXISTS grc_supplier_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  questionnaire_version_id uuid NOT NULL REFERENCES grc_questionnaire_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'invited', 'in_progress', 'submitted', 'under_review',
    'remediation_required', 'approved', 'rejected', 'expired'
  )),
  due_at timestamptz,
  submitted_at timestamptz,
  score numeric(7,2),
  inherent_risk_score numeric(5,2) CHECK (inherent_risk_score BETWEEN 0 AND 100),
  residual_risk_score numeric(5,2) CHECK (residual_risk_score BETWEEN 0 AND 100),
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  expires_at timestamptz,
  decision_reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_supplier_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES grc_questionnaire_questions(id) ON DELETE RESTRICT,
  answer jsonb NOT NULL,
  score numeric(7,2),
  observation text,
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  answered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, assessment_id, question_id)
);

CREATE TABLE IF NOT EXISTS grc_supplier_assessment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  comment text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_supplier_portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  max_file_bytes bigint NOT NULL DEFAULT 10485760 CHECK (max_file_bytes BETWEEN 1024 AND 52428800),
  allowed_mime_types text[] NOT NULL DEFAULT ARRAY['application/pdf','image/png','image/jpeg','text/plain'],
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS grc_supplier_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES grc_supplier_portal_invitations(id) ON DELETE CASCADE,
  session_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_supplier_portal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES grc_supplier_assessments(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES grc_supplier_portal_invitations(id) ON DELETE CASCADE,
  question_id uuid REFERENCES grc_questionnaire_questions(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  content_hash text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'accepted', 'rejected', 'deleted')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  UNIQUE (tenant_id, assessment_id, content_hash)
);

CREATE TABLE IF NOT EXISTS grc_supplier_exit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE CASCADE,
  check_type text NOT NULL CHECK (check_type IN ('access_revocation', 'data_return', 'data_deletion', 'asset_return', 'account_closure')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'verified', 'rejected')),
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  notes text,
  UNIQUE (tenant_id, supplier_id, check_type)
);

-- Privacy and personal data governance.
CREATE TABLE IF NOT EXISTS privacy_processing_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'under_review', 'approved', 'active', 'review_required', 'suspended', 'retired'
  )),
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  operation_id uuid REFERENCES tenant_operations(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  legal_basis text,
  legal_basis_source text,
  purposes jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_subject_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitive_data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_period text,
  retention_basis text,
  deletion_method text,
  international_transfers jsonb NOT NULL DEFAULT '[]'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  asset_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  primary_supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE SET NULL,
  dpia_required boolean NOT NULL DEFAULT FALSE,
  next_review_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS privacy_processing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid NOT NULL REFERENCES privacy_processing_activities(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  snapshot jsonb NOT NULL,
  change_reason text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, processing_activity_id, version)
);

CREATE TABLE IF NOT EXISTS privacy_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid NOT NULL REFERENCES privacy_processing_activities(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES grc_suppliers(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('processor', 'subprocessor', 'joint_controller', 'recipient')),
  purpose text NOT NULL,
  contract_id uuid REFERENCES grc_supplier_contracts(id) ON DELETE SET NULL,
  tprm_assessment_id uuid REFERENCES grc_supplier_assessments(id) ON DELETE SET NULL,
  valid_from date,
  valid_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('proposed', 'active', 'suspended', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, processing_activity_id, supplier_id, role)
);

CREATE TABLE IF NOT EXISTS privacy_dpias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid NOT NULL REFERENCES privacy_processing_activities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'screening', 'assessment', 'consultation', 'pending_approval', 'approved', 'rejected', 'review_required', 'closed')),
  screening jsonb NOT NULL DEFAULT '{}'::jsonb,
  necessity_assessment text,
  proportionality_assessment text,
  consultation jsonb NOT NULL DEFAULT '{}'::jsonb,
  residual_risk_level text CHECK (residual_risk_level IN ('low', 'medium', 'high', 'critical')),
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  next_review_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS privacy_dpia_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dpia_id uuid NOT NULL REFERENCES privacy_dpias(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  likelihood integer NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact integer NOT NULL CHECK (impact BETWEEN 1 AND 5),
  inherent_score integer GENERATED ALWAYS AS (likelihood * impact) STORED,
  residual_likelihood integer NOT NULL CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact integer NOT NULL CHECK (residual_impact BETWEEN 1 AND 5),
  residual_score integer GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,
  tenant_control_id uuid REFERENCES tenant_controls(id) ON DELETE SET NULL,
  treatment text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'treated', 'accepted', 'closed'))
);

CREATE TABLE IF NOT EXISTS privacy_data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'rectification', 'deletion', 'restriction', 'objection', 'portability', 'withdraw_consent', 'other')),
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'identity_verification', 'in_progress', 'extended', 'pending_approval', 'responded', 'closed', 'rejected')),
  subject_reference text NOT NULL,
  identity_verification jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  extension_until timestamptz,
  extension_reason text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  processing_activity_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_summary text,
  response_evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  closed_at timestamptz,
  escalation_level integer NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 5),
  normative_source text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_number)
);

CREATE TABLE IF NOT EXISTS privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  processing_activity_id uuid NOT NULL REFERENCES privacy_processing_activities(id) ON DELETE CASCADE,
  subject_reference_hash text NOT NULL,
  purpose_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'withdrawn', 'expired', 'invalid')),
  captured_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  source text NOT NULL,
  evidence_id uuid REFERENCES evidences(id) ON DELETE SET NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, processing_activity_id, subject_reference_hash, purpose_code, captured_at)
);

CREATE TABLE IF NOT EXISTS privacy_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  breach_number text NOT NULL,
  processing_activity_id uuid REFERENCES privacy_processing_activities(id) ON DELETE SET NULL,
  incident_id uuid,
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'assessing', 'contained', 'notification_required', 'notified', 'closed')),
  occurred_at timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  affected_subjects_estimate integer CHECK (affected_subjects_estimate IS NULL OR affected_subjects_estimate >= 0),
  impact_summary text NOT NULL,
  notification_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_due_at timestamptz,
  authority_notified_at timestamptz,
  subjects_notified_at timestamptz,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, breach_number)
);

-- Incident lifecycle.
CREATE TABLE IF NOT EXISTS grc_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_number text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'triaged', 'classified', 'active', 'contained', 'recovering', 'resolved', 'post_incident_review', 'closed')),
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  calculated_severity text NOT NULL CHECK (calculated_severity IN ('low', 'medium', 'high', 'critical')),
  confirmed_severity text CHECK (confirmed_severity IN ('low', 'medium', 'high', 'critical')),
  severity_inputs jsonb NOT NULL,
  severity_formula_version text NOT NULL DEFAULT 'incident-severity-v1',
  severity_overridden boolean NOT NULL DEFAULT FALSE,
  severity_override_reason text,
  severity_approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  severity_confirmed_at timestamptz,
  commander_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  detected_at timestamptz,
  contained_at timestamptz,
  recovered_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  recurrence_key text,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  operation_id uuid REFERENCES tenant_operations(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES grc_suppliers(id) ON DELETE SET NULL,
  privacy_impact boolean NOT NULL DEFAULT FALSE,
  regulatory_impact boolean NOT NULL DEFAULT FALSE,
  customer_impact boolean NOT NULL DEFAULT FALSE,
  financial_impact numeric(16,2),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  closure_summary text,
  effectiveness_verified boolean NOT NULL DEFAULT FALSE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, incident_number)
);

ALTER TABLE privacy_breaches
  DROP CONSTRAINT IF EXISTS privacy_breaches_incident_id_fkey;
ALTER TABLE privacy_breaches
  ADD CONSTRAINT privacy_breaches_incident_id_fkey
  FOREIGN KEY (incident_id) REFERENCES grc_incidents(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS grc_incident_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES grc_incidents(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  from_severity text,
  to_severity text,
  note text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES grc_incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  evidence_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_incident_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES grc_incidents(id) ON DELETE CASCADE,
  impact_type text NOT NULL CHECK (impact_type IN ('service', 'process', 'asset', 'supplier', 'privacy', 'regulatory', 'customer', 'financial')),
  entity_id uuid,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS grc_incident_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES grc_incidents(id) ON DELETE CASCADE,
  obligation_id uuid REFERENCES grc_obligations(id) ON DELETE SET NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('authority', 'customer', 'data_subject', 'internal', 'supplier', 'insurer')),
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'pending_approval', 'approved', 'sent', 'failed', 'not_required')),
  due_at timestamptz,
  sent_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_id uuid REFERENCES evidences(id) ON DELETE SET NULL,
  message_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_incident_root_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES grc_incidents(id) ON DELETE CASCADE,
  method text NOT NULL,
  cause_category text NOT NULL,
  description text NOT NULL,
  contributing_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed boolean NOT NULL DEFAULT FALSE,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_incident_postmortems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES grc_incidents(id) ON DELETE CASCADE,
  summary text NOT NULL,
  what_worked text,
  what_failed text,
  lessons jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_plan_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, incident_id)
);

-- Connector framework extends the existing tenant integration master.
ALTER TABLE tenant_integrations
  DROP CONSTRAINT IF EXISTS tenant_integrations_provider_check;
ALTER TABLE tenant_integrations
  ADD CONSTRAINT tenant_integrations_provider_check
  CHECK (provider IN (
    'google_drive', 'google_workspace', 'microsoft_graph', 'microsoft_365',
    'entra_id', 'onedrive', 'sharepoint', 'jira', 'confluence', 'github'
  ));

ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS connector_version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'sandbox'
    CHECK (execution_mode IN ('sandbox', 'live')),
  ADD COLUMN IF NOT EXISTS credential_envelope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS oauth_state_hash text,
  ADD COLUMN IF NOT EXISTS refresh_after timestamptz,
  ADD COLUMN IF NOT EXISTS cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '{"enabled":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS webhook_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rate_limit_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retry_config jsonb NOT NULL DEFAULT '{"max_attempts":5,"base_seconds":30}'::jsonb,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'unknown'
    CHECK (health_status IN ('unknown', 'healthy', 'degraded', 'failed', 'disabled')),
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz;

CREATE TABLE IF NOT EXISTS grc_connector_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  version text NOT NULL,
  display_name text NOT NULL,
  capabilities jsonb NOT NULL,
  supported_scopes text[] NOT NULL DEFAULT '{}'::text[],
  default_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, version)
);

INSERT INTO grc_connector_definitions (provider, version, display_name, capabilities, supported_scopes, default_mapping)
VALUES
  ('microsoft_graph', '1.0.0', 'Microsoft', '{"users":true,"groups":true,"mfa":true,"documents":true,"evidence":true}'::jsonb,
    ARRAY['User.Read.All','Group.Read.All','Directory.Read.All','Files.Read.All','Sites.Read.All'],
    '{"inactive_user":"metric","privileged_without_mfa":"alert","document":"evidence"}'::jsonb),
  ('google_workspace', '1.0.0', 'Google Workspace', '{"users":true,"groups":true,"drive":true,"evidence":true}'::jsonb,
    ARRAY['admin.directory.user.readonly','admin.directory.group.readonly','drive.metadata.readonly'],
    '{"inactive_user":"metric","document":"evidence"}'::jsonb),
  ('jira', '1.0.0', 'Jira y Confluence', '{"issues":true,"comments":true,"documents":true,"remedials":true}'::jsonb,
    ARRAY['read:jira-work','read:confluence-content.all'],
    '{"issue":"action","comment":"provenance","page":"evidence"}'::jsonb),
  ('github', '1.0.0', 'GitHub', '{"repositories":true,"branches":true,"reviews":true,"workflows":true,"alerts":true}'::jsonb,
    ARRAY['repo:read','workflow:read','security_events:read'],
    '{"repository":"metric","branch_protection":"control_assurance","security_alert":"alert"}'::jsonb)
ON CONFLICT (provider, version) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  capabilities = EXCLUDED.capabilities,
  supported_scopes = EXCLUDED.supported_scopes,
  default_mapping = EXCLUDED.default_mapping,
  status = 'active';

CREATE TABLE IF NOT EXISTS grc_connector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES tenant_integrations(id) ON DELETE CASCADE,
  run_type text NOT NULL DEFAULT 'sync' CHECK (run_type IN ('sync', 'webhook', 'retry', 'healthcheck')),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('queued', 'started', 'completed', 'completed_with_warnings', 'failed', 'dead_lettered')),
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  idempotency_key text NOT NULL,
  cursor_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  cursor_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  records_seen integer NOT NULL DEFAULT 0,
  records_normalized integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  alerts_created integer NOT NULL DEFAULT 0,
  mappings_failed integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  next_retry_at timestamptz,
  triggered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  correlation_id text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, integration_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS grc_external_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES tenant_integrations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES grc_connector_runs(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_type text NOT NULL,
  external_id text NOT NULL,
  external_version text,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_hash text NOT NULL,
  normalized_payload jsonb NOT NULL,
  provenance jsonb NOT NULL,
  mapping_status text NOT NULL DEFAULT 'pending' CHECK (mapping_status IN ('pending', 'mapped', 'ignored', 'failed')),
  mapped_entity_type text,
  mapped_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_id, external_type, external_id, payload_hash)
);

CREATE TABLE IF NOT EXISTS grc_connector_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES tenant_integrations(id) ON DELETE CASCADE,
  external_type text NOT NULL,
  target_type text NOT NULL,
  mapping jsonb NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'disabled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_id, external_type, target_type, version)
);

CREATE TABLE IF NOT EXISTS grc_connector_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES tenant_integrations(id) ON DELETE CASCADE,
  run_id uuid REFERENCES grc_connector_runs(id) ON DELETE SET NULL,
  external_record_id uuid REFERENCES grc_external_records(id) ON DELETE SET NULL,
  error_code text NOT NULL,
  error_message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'retrying', 'resolved', 'discarded')),
  next_retry_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phase2_relations_source
  ON grc_phase2_relations (tenant_id, source_type, source_id, status);
CREATE INDEX IF NOT EXISTS idx_phase2_relations_target
  ON grc_phase2_relations (tenant_id, target_type, target_id, status);
CREATE INDEX IF NOT EXISTS idx_phase2_events_aggregate
  ON grc_domain_events (tenant_id, aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase2_alerts_open
  ON grc_operational_alerts (tenant_id, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase2_metrics_entity
  ON grc_metric_observations (tenant_id, entity_type, entity_id, metric_code, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase2_obligations_due
  ON grc_obligations (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_portfolio
  ON grc_suppliers (tenant_id, status, criticality, next_assessment_at);
CREATE INDEX IF NOT EXISTS idx_supplier_assessments_due
  ON grc_supplier_assessments (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_supplier_portal_invitation_hash
  ON grc_supplier_portal_invitations (token_hash, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_supplier_portal_session_hash
  ON grc_supplier_portal_sessions (session_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_privacy_processing_status
  ON privacy_processing_activities (tenant_id, status, next_review_at);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_due
  ON privacy_data_subject_requests (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_privacy_breaches_status
  ON privacy_breaches (tenant_id, status, notification_due_at);
CREATE INDEX IF NOT EXISTS idx_incidents_status
  ON grc_incidents (tenant_id, status, calculated_severity, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_recurrence
  ON grc_incidents (tenant_id, recurrence_key, reported_at DESC)
  WHERE recurrence_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connector_runs_history
  ON grc_connector_runs (tenant_id, integration_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_records_mapping
  ON grc_external_records (tenant_id, integration_id, mapping_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_connector_dead_letters_open
  ON grc_connector_dead_letters (tenant_id, integration_id, status, next_retry_at);

COMMENT ON TABLE grc_phase2_relations IS
  'Controlled tenant-scoped cross-domain links with provenance, confidence, approval and temporal versioning.';
COMMENT ON TABLE grc_domain_events IS
  'Immutable idempotent domain event ledger for Phase 2 rules and operational effects.';
COMMENT ON TABLE grc_metric_observations IS
  'Metric observations require explicit provenance and never replace KPI/KRI definitions.';
COMMENT ON COLUMN tenant_integrations.credential_envelope IS
  'Ciphertext envelope only. Plaintext credentials are rejected by the service and never returned by the API.';

COMMIT;
