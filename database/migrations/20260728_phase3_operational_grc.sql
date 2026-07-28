-- TCDX ISO SaaS v4 - Phase 3 operational GRC integration
-- Additive, tenant-scoped, idempotent and deny-by-default.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO saas_modules (
  module_key, display_name, description, default_enabled, is_system, is_active, sort_order
) VALUES (
  'grc_phase3_operations',
  'Operación y continuidad GRC',
  'Unidades, procesos, servicios, BIA, continuidad, KPI/KRI y riesgo cuantitativo.',
  FALSE,
  TRUE,
  TRUE,
  47
)
ON CONFLICT (module_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  default_enabled = FALSE,
  is_active = TRUE,
  updated_at = now();

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('organizations.read', 'operations', 'Consultar unidades', 'Consulta unidades organizacionales y su vista 360.'),
  ('organizations.manage', 'operations', 'Administrar unidades', 'Crea y actualiza unidades organizacionales.'),
  ('processes.read', 'operations', 'Consultar procesos', 'Consulta procesos operacionales y su vista 360.'),
  ('processes.manage', 'operations', 'Administrar procesos', 'Crea y actualiza procesos operacionales.'),
  ('processes.approve', 'operations', 'Aprobar procesos', 'Aprueba criticidad, vigencia y cambios de procesos.'),
  ('services.read', 'operations', 'Consultar servicios', 'Consulta servicios operacionales y dependencias.'),
  ('services.manage', 'operations', 'Administrar servicios', 'Crea y actualiza servicios operacionales.'),
  ('bia.read', 'continuity', 'Consultar BIA', 'Consulta análisis de impacto al negocio.'),
  ('bia.manage', 'continuity', 'Administrar BIA', 'Crea y actualiza análisis de impacto al negocio.'),
  ('bia.approve', 'continuity', 'Aprobar BIA', 'Aprueba y mantiene vigentes los BIA.'),
  ('continuity.read', 'continuity', 'Consultar continuidad', 'Consulta planes, pruebas y estado de continuidad.'),
  ('continuity.manage', 'continuity', 'Administrar continuidad', 'Crea y actualiza planes de continuidad.'),
  ('continuity.approve', 'continuity', 'Aprobar continuidad', 'Aprueba planes y resultados de pruebas.'),
  ('continuity.activate', 'continuity', 'Activar continuidad', 'Activa planes y coordina recuperación.'),
  ('continuity.tests.manage', 'continuity', 'Administrar pruebas', 'Planifica y registra pruebas de continuidad.'),
  ('crisis.read', 'continuity', 'Consultar crisis', 'Consulta activaciones y bitácora de crisis.'),
  ('crisis.manage', 'continuity', 'Administrar crisis', 'Activa, registra decisiones y cierra crisis.'),
  ('metrics.read', 'metrics', 'Consultar KPI/KRI', 'Consulta indicadores, mediciones e impacto.'),
  ('metrics.manage', 'metrics', 'Administrar KPI/KRI', 'Crea y actualiza definiciones de indicadores.'),
  ('metrics.record', 'metrics', 'Registrar mediciones', 'Registra mediciones con fuente y calidad.'),
  ('metrics.approve', 'metrics', 'Aprobar mediciones', 'Aprueba definiciones y mediciones.'),
  ('quantitative_risk.read', 'risk', 'Consultar riesgo cuantitativo', 'Consulta escenarios cuantitativos simplificados.'),
  ('quantitative_risk.manage', 'risk', 'Administrar riesgo cuantitativo', 'Crea y actualiza evaluaciones cuantitativas.'),
  ('quantitative_risk.approve', 'risk', 'Aprobar riesgo cuantitativo', 'Aprueba escenarios y supuestos cuantitativos.'),
  ('operations.dashboard.read', 'operations', 'Consultar dashboard operacional', 'Consulta métricas e impactos operacionales integrados.'),
  ('operations.360.read', 'operations', 'Consultar vistas 360', 'Consulta relaciones e impacto transversal de entidades operacionales.')
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
  AND p.permission_group IN ('operations', 'continuity', 'metrics', 'risk')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key = 'auditor'
  AND p.permission_key IN (
    'organizations.read', 'processes.read', 'services.read', 'bia.read',
    'continuity.read', 'crisis.read', 'metrics.read', 'quantitative_risk.read',
    'operations.dashboard.read', 'operations.360.read'
  )
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('operativo', 'responsable_area', 'area_owner')
  AND p.permission_key IN (
    'organizations.read', 'processes.read', 'processes.manage', 'services.read',
    'services.manage', 'bia.read', 'bia.manage', 'continuity.read',
    'continuity.manage', 'continuity.tests.manage', 'crisis.read', 'metrics.read',
    'metrics.record', 'quantitative_risk.read', 'operations.dashboard.read',
    'operations.360.read'
  )
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

-- Fase 3 is enabled only for the confirmed TCDX tenant. The module remains
-- disabled by default for every other tenant.
INSERT INTO tenant_module_settings (
  tenant_id, module_key, is_enabled, enabled_at, notes, metadata
)
SELECT
  t.id,
  'grc_phase3_operations',
  TRUE,
  now(),
  'Fase 3 operacional habilitada para tcdx.local.',
  jsonb_build_object(
    'source', 'phase3_migration',
    'tenant_domain', 'tcdx.local',
    'capability_scope', 'operations_continuity_metrics'
  )
FROM tenants t
WHERE t.id = '70000000-0000-0000-0000-000000000701'::uuid
ON CONFLICT (tenant_id, module_key) DO UPDATE SET
  is_enabled = TRUE,
  enabled_at = COALESCE(tenant_module_settings.enabled_at, now()),
  disabled_at = NULL,
  disabled_by = NULL,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = now();

CREATE TABLE IF NOT EXISTS grc_organizational_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  unit_type text NOT NULL DEFAULT 'area'
    CHECK (unit_type IN ('company', 'division', 'department', 'area', 'team', 'location', 'other')),
  parent_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  backup_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  location_reference text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'active', 'review_required', 'suspended', 'retired')),
  valid_from date,
  valid_until date,
  next_review_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  UNIQUE (tenant_id, code)
);

ALTER TABLE tenant_processes
  ADD COLUMN IF NOT EXISTS organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS grc_operational_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  primary_process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  backup_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  minimum_service_level text,
  critical_schedule text,
  criticality text NOT NULL DEFAULT 'medium'
    CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
  rto_minutes integer CHECK (rto_minutes IS NULL OR rto_minutes >= 0),
  rpo_minutes integer CHECK (rpo_minutes IS NULL OR rpo_minutes >= 0),
  mtpd_minutes integer CHECK (mtpd_minutes IS NULL OR mtpd_minutes >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'active', 'review_required', 'suspended', 'retired')),
  next_review_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rto_minutes IS NULL OR mtpd_minutes IS NULL OR rto_minutes <= mtpd_minutes),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_operational_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('organization', 'process', 'service')),
  source_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN (
    'organization', 'process', 'service', 'asset', 'system', 'location',
    'supplier', 'control', 'requirement'
  )),
  target_id uuid NOT NULL,
  dependency_type text NOT NULL CHECK (dependency_type IN (
    'unit_to_process', 'process_to_process', 'process_to_service',
    'process_to_asset', 'process_to_system', 'process_to_location',
    'process_to_supplier', 'service_to_asset', 'service_to_system',
    'service_to_supplier', 'service_to_location', 'service_to_control',
    'service_to_requirement'
  )),
  criticality text NOT NULL DEFAULT 'medium'
    CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
  is_mandatory boolean NOT NULL DEFAULT TRUE,
  alternative_description text,
  max_tolerable_minutes integer CHECK (max_tolerable_minutes IS NULL OR max_tolerable_minutes >= 0),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  source_reference text NOT NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_type <> target_type OR source_id <> target_id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  UNIQUE (tenant_id, source_type, source_id, target_type, target_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS grc_bia_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES grc_operational_services(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  assumptions text,
  estimated_financial_impact numeric(18,2) CHECK (estimated_financial_impact IS NULL OR estimated_financial_impact >= 0),
  mtpd_minutes integer NOT NULL CHECK (mtpd_minutes >= 0),
  rto_minutes integer NOT NULL CHECK (rto_minutes >= 0),
  rpo_minutes integer NOT NULL CHECK (rpo_minutes >= 0),
  minimum_service_level text,
  required_people integer CHECK (required_people IS NULL OR required_people >= 0),
  alternative_resources text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'current', 'review_required', 'expired', 'superseded')),
  next_review_at timestamptz NOT NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (process_id IS NOT NULL OR service_id IS NOT NULL),
  CHECK (rto_minutes <= mtpd_minutes),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_bia_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bia_id uuid NOT NULL REFERENCES grc_bia_assessments(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN (
    'operational', 'financial', 'customer', 'legal_regulatory',
    'reputational', 'security', 'privacy', 'contractual'
  )),
  duration_minutes integer NOT NULL CHECK (duration_minutes >= 0),
  impact_level text NOT NULL CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  estimated_amount numeric(18,2) CHECK (estimated_amount IS NULL OR estimated_amount >= 0),
  rationale text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bia_id, dimension, duration_minutes)
);

CREATE TABLE IF NOT EXISTS grc_continuity_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  scope text NOT NULL,
  organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  service_id uuid REFERENCES grc_operational_services(id) ON DELETE SET NULL,
  bia_id uuid REFERENCES grc_bia_assessments(id) ON DELETE SET NULL,
  activation_criteria text NOT NULL,
  activation_authority_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  procedures text NOT NULL,
  recovery_sequence text NOT NULL,
  communication_plan text,
  return_to_operation_criteria text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'under_review', 'approved', 'active', 'activated',
    'recovery_in_progress', 'return_to_normal', 'closed',
    'review_required', 'expired', 'superseded'
  )),
  valid_from date,
  valid_until date,
  next_review_at timestamptz NOT NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (process_id IS NOT NULL OR service_id IS NOT NULL),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_continuity_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES grc_continuity_plans(id) ON DELETE CASCADE,
  test_type text NOT NULL CHECK (test_type IN (
    'tabletop', 'walkthrough', 'technical_recovery', 'supplier_test',
    'communication_test', 'partial_simulation', 'full_simulation'
  )),
  objective text NOT NULL,
  scenario text NOT NULL,
  scope text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  completed_at timestamptz,
  expected_result text NOT NULL,
  actual_result text,
  target_rto_minutes integer CHECK (target_rto_minutes IS NULL OR target_rto_minutes >= 0),
  observed_rto_minutes integer CHECK (observed_rto_minutes IS NULL OR observed_rto_minutes >= 0),
  target_rpo_minutes integer CHECK (target_rpo_minutes IS NULL OR target_rpo_minutes >= 0),
  observed_rpo_minutes integer CHECK (observed_rpo_minutes IS NULL OR observed_rpo_minutes >= 0),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'ready', 'in_progress', 'completed', 'passed',
    'passed_with_observations', 'failed', 'cancelled'
  )),
  next_test_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_crisis_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  plan_id uuid REFERENCES grc_continuity_plans(id) ON DELETE SET NULL,
  incident_id uuid,
  organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  service_id uuid REFERENCES grc_operational_services(id) ON DELETE SET NULL,
  crisis_level text NOT NULL CHECK (crisis_level IN ('level_1', 'level_2', 'level_3', 'critical')),
  activation_reason text NOT NULL,
  recovery_status text NOT NULL DEFAULT 'activated',
  lessons_learned text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'stabilized', 'recovery', 'closed')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  activated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_crisis_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crisis_id uuid NOT NULL REFERENCES grc_crisis_activations(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('decision', 'communication', 'action', 'status', 'observation')),
  entry_text text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  metric_type text NOT NULL CHECK (metric_type IN ('kpi', 'kri')),
  entity_type text NOT NULL CHECK (entity_type IN (
    'organization', 'process', 'service', 'risk', 'control', 'requirement',
    'supplier', 'incident', 'action', 'audit', 'evidence', 'continuity_plan'
  )),
  entity_id uuid NOT NULL,
  formula_definition text NOT NULL,
  source_description text NOT NULL,
  frequency text NOT NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  unit text NOT NULL,
  expected_direction text NOT NULL CHECK (expected_direction IN ('higher_is_better', 'lower_is_better', 'target_range')),
  target_value numeric NOT NULL,
  warning_threshold numeric NOT NULL,
  critical_threshold numeric NOT NULL,
  measurement_window text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'active', 'review_required', 'retired')),
  valid_from date,
  valid_until date,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_metric_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_id uuid NOT NULL REFERENCES grc_metric_definitions(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  numeric_value numeric NOT NULL,
  source_description text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  provenance jsonb NOT NULL,
  evidence_id uuid REFERENCES evidences(id) ON DELETE SET NULL,
  quality text NOT NULL CHECK (quality IN ('valid', 'estimated', 'incomplete', 'stale', 'rejected')),
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  comment text,
  trend text CHECK (trend IS NULL OR trend IN ('improving', 'stable', 'deteriorating')),
  impact_status text NOT NULL DEFAULT 'normal'
    CHECK (impact_status IN ('normal', 'warning', 'critical', 'excluded')),
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (provenance <> '{}'::jsonb),
  UNIQUE (tenant_id, metric_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS grc_quantitative_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  risk_id uuid NOT NULL,
  organizational_unit_id uuid REFERENCES grc_organizational_units(id) ON DELETE SET NULL,
  process_id uuid REFERENCES tenant_processes(id) ON DELETE SET NULL,
  service_id uuid REFERENCES grc_operational_services(id) ON DELETE SET NULL,
  scenario text NOT NULL,
  minimum_impact numeric(18,2) NOT NULL CHECK (minimum_impact >= 0),
  most_likely_impact numeric(18,2) NOT NULL CHECK (most_likely_impact >= 0),
  maximum_impact numeric(18,2) NOT NULL CHECK (maximum_impact >= 0),
  estimated_frequency numeric(12,6) NOT NULL CHECK (estimated_frequency >= 0),
  expected_impact numeric(18,2) NOT NULL CHECK (expected_impact >= 0),
  annualized_loss numeric(18,2) NOT NULL CHECK (annualized_loss >= 0),
  residual_annualized_loss numeric(18,2) CHECK (residual_annualized_loss IS NULL OR residual_annualized_loss >= 0),
  treatment_annualized_loss numeric(18,2) CHECK (treatment_annualized_loss IS NULL OR treatment_annualized_loss >= 0),
  control_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (control_cost >= 0),
  expected_reduction numeric(18,2) NOT NULL DEFAULT 0 CHECK (expected_reduction >= 0),
  net_expected_benefit numeric(18,2) NOT NULL DEFAULT 0,
  sensitivity_notes text,
  treatment_comparison text,
  assumptions text NOT NULL,
  source_description text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'under_review', 'approved', 'current', 'review_required', 'superseded')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (minimum_impact <= most_likely_impact AND most_likely_impact <= maximum_impact),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS grc_phase3_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid REFERENCES grc_domain_events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS grc_phase3_readiness_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_event_id uuid NOT NULL REFERENCES grc_domain_events(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  dimension text NOT NULL CHECK (dimension IN (
    'operations', 'continuity', 'requirements', 'controls', 'evidence',
    'risks', 'actions', 'suppliers', 'metrics'
  )),
  previous_score numeric(5,2) NOT NULL CHECK (previous_score BETWEEN 0 AND 100),
  new_score numeric(5,2) NOT NULL CHECK (new_score BETWEEN 0 AND 100),
  reason_code text NOT NULL,
  explanation text NOT NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (tenant_id, source_event_id, dimension, entity_type, entity_id)
);

ALTER TABLE grc_phase2_relations DROP CONSTRAINT IF EXISTS grc_phase2_relations_source_type_check;
ALTER TABLE grc_phase2_relations DROP CONSTRAINT IF EXISTS grc_phase2_relations_target_type_check;
ALTER TABLE grc_phase2_relations ADD CONSTRAINT grc_phase2_relations_source_type_check CHECK (source_type IN (
  'requirement', 'obligation', 'organization', 'process', 'operation', 'service',
  'asset', 'system', 'location', 'supplier', 'processing_activity', 'dpia',
  'privacy_request', 'privacy_breach', 'incident', 'risk', 'control', 'evidence',
  'metric', 'bia', 'continuity_plan', 'continuity_test', 'crisis', 'quantitative_risk',
  'audit', 'finding', 'nonconformity', 'action', 'connector', 'external_record'
));
ALTER TABLE grc_phase2_relations ADD CONSTRAINT grc_phase2_relations_target_type_check CHECK (target_type IN (
  'requirement', 'obligation', 'organization', 'process', 'operation', 'service',
  'asset', 'system', 'location', 'supplier', 'processing_activity', 'dpia',
  'privacy_request', 'privacy_breach', 'incident', 'risk', 'control', 'evidence',
  'metric', 'bia', 'continuity_plan', 'continuity_test', 'crisis', 'quantitative_risk',
  'audit', 'finding', 'nonconformity', 'action', 'connector', 'external_record'
));

ALTER TABLE grc_exports DROP CONSTRAINT IF EXISTS grc_exports_domain_check;
ALTER TABLE grc_exports ADD CONSTRAINT grc_exports_domain_check CHECK (domain IN (
  'audit', 'evidence', 'readiness', 'frameworks', 'mappings', 'findings', 'actions',
  'privacy_inventory', 'privacy_risk', 'dpia_status', 'privacy_requests',
  'incidents', 'postmortem', 'suppliers', 'supplier_assessments',
  'supplier_evidence', 'connectors_health', 'executive_phase2',
  'organizations', 'processes', 'services', 'bia', 'continuity',
  'continuity_tests', 'metrics', 'quantitative_risk', 'executive_phase3'
));

CREATE INDEX IF NOT EXISTS idx_phase3_units_parent
  ON grc_organizational_units (tenant_id, parent_unit_id, status);
CREATE INDEX IF NOT EXISTS idx_phase3_processes_unit
  ON tenant_processes (tenant_id, organizational_unit_id, lifecycle_status, criticality_score DESC);
CREATE INDEX IF NOT EXISTS idx_phase3_services_portfolio
  ON grc_operational_services (tenant_id, status, criticality, organizational_unit_id);
CREATE INDEX IF NOT EXISTS idx_phase3_dependencies_source
  ON grc_operational_dependencies (tenant_id, source_type, source_id, criticality);
CREATE INDEX IF NOT EXISTS idx_phase3_dependencies_target
  ON grc_operational_dependencies (tenant_id, target_type, target_id, criticality);
CREATE INDEX IF NOT EXISTS idx_phase3_bia_current
  ON grc_bia_assessments (tenant_id, status, next_review_at, process_id, service_id);
CREATE INDEX IF NOT EXISTS idx_phase3_plans_current
  ON grc_continuity_plans (tenant_id, status, next_review_at, process_id, service_id);
CREATE INDEX IF NOT EXISTS idx_phase3_tests_plan
  ON grc_continuity_tests (tenant_id, plan_id, status, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase3_crisis_active
  ON grc_crisis_activations (tenant_id, status, activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase3_metric_entity
  ON grc_metric_definitions (tenant_id, entity_type, entity_id, status);
CREATE INDEX IF NOT EXISTS idx_phase3_measurements_metric
  ON grc_metric_measurements (tenant_id, metric_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase3_quant_risk
  ON grc_quantitative_risk_assessments (tenant_id, risk_id, status, annualized_loss DESC);
CREATE INDEX IF NOT EXISTS idx_phase3_readiness_active
  ON grc_phase3_readiness_impacts (tenant_id, active, dimension, new_score);
CREATE INDEX IF NOT EXISTS idx_phase3_history_entity
  ON grc_phase3_state_history (tenant_id, entity_type, entity_id, changed_at DESC);

COMMENT ON TABLE grc_operational_dependencies IS
  'Explicit tenant-scoped dependencies between operations and shared GRC entities.';
COMMENT ON TABLE grc_phase3_readiness_impacts IS
  'Explainable readiness deltas caused by domain events; not a replacement for immutable readiness snapshots.';
COMMENT ON COLUMN grc_metric_definitions.formula_definition IS
  'Declarative formula description only. It is never evaluated as executable code.';

COMMIT;
