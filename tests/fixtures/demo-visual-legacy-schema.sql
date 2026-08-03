-- Disposable PostgreSQL contract fixture for product tables that predate the
-- migration history retained in this repository. Never apply outside tests.

CREATE TYPE kpi_category_enum AS ENUM ('estrategico','operacional','riesgo','cumplimiento','cliente','industrial','financiero','personalizado');
CREATE TYPE kpi_type_enum AS ENUM ('manual','hibrido','automatico');
CREATE TYPE kpi_scope_enum AS ENUM ('global','tenant','standard','operation');
CREATE TYPE kpi_frequency_enum AS ENUM ('mensual','trimestral','semestral','anual');
CREATE TYPE kpi_direction_enum AS ENUM ('higher_is_better','lower_is_better','target_range');
CREATE TYPE kpi_period_type_enum AS ENUM ('mensual','trimestral','semestral','anual');
CREATE TYPE kpi_status_color_enum AS ENUM ('green','yellow','red','gray');

CREATE TABLE tenant_standard_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(code) ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES tenant_operations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,standard_code,operation_id)
);

CREATE TABLE controls_catalog_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id uuid NOT NULL REFERENCES controls_catalog(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  clause text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (control_id,standard_code)
);

CREATE TABLE controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  iso_code text,
  clause text,
  status text,
  score integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  catalog_control_id uuid REFERENCES controls_catalog(id) ON DELETE SET NULL
);

CREATE TABLE control_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_control_id uuid NOT NULL UNIQUE REFERENCES tenant_controls(id) ON DELETE CASCADE,
  standard_code varchar(50),
  catalog_control_id uuid,
  health_score numeric NOT NULL DEFAULT 0,
  health_status text NOT NULL DEFAULT 'sin_datos',
  evidence_score numeric NOT NULL DEFAULT 0,
  compliance_score numeric NOT NULL DEFAULT 0,
  findings_score numeric NOT NULL DEFAULT 0,
  risk_score numeric NOT NULL DEFAULT 0,
  action_score numeric NOT NULL DEFAULT 0,
  review_score numeric NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  approved_evidence_count integer NOT NULL DEFAULT 0,
  pending_evidence_count integer NOT NULL DEFAULT 0,
  rejected_evidence_count integer NOT NULL DEFAULT 0,
  open_findings_count integer NOT NULL DEFAULT 0,
  open_actions_count integer NOT NULL DEFAULT 0,
  overdue_actions_count integer NOT NULL DEFAULT 0,
  high_risks_count integer NOT NULL DEFAULT 0,
  calculated_at timestamp NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  category kpi_category_enum NOT NULL,
  kpi_type kpi_type_enum NOT NULL,
  scope kpi_scope_enum NOT NULL DEFAULT 'global',
  unit varchar(50) NOT NULL,
  base_formula text,
  formula_expression text,
  data_source_summary text,
  frequency kpi_frequency_enum NOT NULL,
  direction kpi_direction_enum NOT NULL,
  target_value numeric,
  min_value numeric,
  max_value numeric,
  display_order integer NOT NULL DEFAULT 0,
  is_standard boolean NOT NULL DEFAULT true,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK ((is_standard AND tenant_id IS NULL) OR (NOT is_standard AND tenant_id IS NOT NULL))
);

CREATE TABLE kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  standard_code varchar(50) REFERENCES standards(code),
  period_type kpi_period_type_enum NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric,
  numerator_value numeric,
  denominator_value numeric,
  status_color kpi_status_color_enum NOT NULL DEFAULT 'gray',
  direction kpi_direction_enum NOT NULL,
  target_value numeric,
  calculated_from varchar(50) NOT NULL DEFAULT 'engine',
  calculation_rule_id uuid,
  breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE action_plan_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comment text NOT NULL,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  status_after text NOT NULL DEFAULT 'abierto',
  blocked_reason text,
  created_by uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  report_type_code text NOT NULL,
  report_title text NOT NULL,
  report_format text NOT NULL DEFAULT 'pdf',
  status text NOT NULL DEFAULT 'generated',
  file_url text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE iso_risk_matrix_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code text NOT NULL, version_code text NOT NULL, source_assessment_id uuid,
  run_type text NOT NULL DEFAULT 'automated', run_status text NOT NULL DEFAULT 'completed', requested_by uuid REFERENCES users(id),
  certifiable_version boolean NOT NULL DEFAULT false, coverage_warning text,
  total_assets integer NOT NULL DEFAULT 0, total_risk_templates integer NOT NULL DEFAULT 0,
  suggested_risks_count integer NOT NULL DEFAULT 0, accepted_risks_count integer NOT NULL DEFAULT 0,
  rejected_risks_count integer NOT NULL DEFAULT 0, critical_risks_count integer NOT NULL DEFAULT 0,
  high_risks_count integer NOT NULL DEFAULT 0, medium_risks_count integer NOT NULL DEFAULT 0,
  low_risks_count integer NOT NULL DEFAULT 0, inherent_risk_avg numeric NOT NULL DEFAULT 0,
  residual_risk_avg numeric NOT NULL DEFAULT 0, risk_posture text, summary_json jsonb NOT NULL DEFAULT '{}',
  input_json jsonb NOT NULL DEFAULT '{}', result_json jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);

ALTER TABLE iso_risk_matrix_items
  ADD COLUMN run_id uuid REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE,
  ADD COLUMN standard_code text,
  ADD COLUMN version_code text,
  ADD COLUMN risk_template_id uuid,
  ADD COLUMN asset_id uuid REFERENCES assets(id),
  ADD COLUMN iso_control_id uuid,
  ADD COLUMN catalog_control_id uuid REFERENCES controls_catalog(id),
  ADD COLUMN tenant_control_id uuid REFERENCES tenant_controls(id),
  ADD COLUMN source_assessment_id uuid,
  ADD COLUMN source_gap_id uuid,
  ADD COLUMN risk_category text,
  ADD COLUMN asset_name text,
  ADD COLUMN asset_type text,
  ADD COLUMN asset_criticality text,
  ADD COLUMN likelihood integer NOT NULL DEFAULT 3,
  ADD COLUMN impact integer NOT NULL DEFAULT 3,
  ADD COLUMN inherent_risk_score integer NOT NULL DEFAULT 9,
  ADD COLUMN inherent_risk_level text NOT NULL DEFAULT 'medio',
  ADD COLUMN control_effectiveness_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN residual_likelihood integer NOT NULL DEFAULT 3,
  ADD COLUMN residual_impact integer NOT NULL DEFAULT 3,
  ADD COLUMN residual_risk_score integer NOT NULL DEFAULT 9,
  ADD COLUMN residual_risk_level text NOT NULL DEFAULT 'medio',
  ADD COLUMN treatment_strategy text NOT NULL DEFAULT 'mitigar',
  ADD COLUMN suggested_controls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN suggested_actions jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN evidence_expectations jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN confidence numeric NOT NULL DEFAULT 0.75,
  ADD COLUMN source_type text NOT NULL DEFAULT 'risk_template',
  ADD COLUMN source_trace_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN reviewer_user_id uuid REFERENCES users(id),
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN review_comment text;

CREATE TABLE iso_risk_matrix_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE,
  risk_item_id uuid NOT NULL REFERENCES iso_risk_matrix_items(id) ON DELETE CASCADE, tenant_id uuid NOT NULL,
  action_title text NOT NULL, action_description text, suggested_owner_role text,
  suggested_due_days integer NOT NULL DEFAULT 30, priority text NOT NULL DEFAULT 'media',
  action_type text NOT NULL DEFAULT 'risk_treatment', creates_action_plan_candidate boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'suggested', metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE iso_risk_matrix_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid REFERENCES iso_risk_matrix_runs(id),
  risk_item_id uuid REFERENCES iso_risk_matrix_items(id), tenant_id uuid NOT NULL,
  action text NOT NULL, actor_user_id uuid REFERENCES users(id), old_data jsonb NOT NULL DEFAULT '{}',
  new_data jsonb NOT NULL DEFAULT '{}', metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
