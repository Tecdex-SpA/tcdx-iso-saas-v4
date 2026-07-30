-- TCDX ISO SaaS v4 - Phase 5.5 official math governance persistence.
-- Additive, idempotent, tenant-scoped. No operational source data is mutated.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION reject_published_official_formula_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'official_formula_versions records are immutable once published';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_published_health_score_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'health_score_versions records are immutable once published';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS official_formula_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  formula_code text NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL,
  description text,
  owner text NOT NULL DEFAULT 'TCDX',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_official_formula_definitions_unique
  ON official_formula_definitions (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), formula_code);
CREATE INDEX IF NOT EXISTS idx_official_formula_definitions_category
  ON official_formula_definitions (tenant_id, category, status);

CREATE TABLE IF NOT EXISTS official_formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_definition_id uuid NOT NULL REFERENCES official_formula_definitions(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  methodology text NOT NULL,
  expression text NOT NULL,
  units jsonb NOT NULL DEFAULT '{}'::jsonb,
  precision integer NOT NULL DEFAULT 4 CHECK (precision >= 0 AND precision <= 12),
  rounding_policy text NOT NULL DEFAULT 'half_up',
  null_policy text NOT NULL,
  zero_division_policy text NOT NULL,
  minimum_sample_size integer NOT NULL DEFAULT 1 CHECK (minimum_sample_size >= 0),
  applicability text NOT NULL,
  limitations text NOT NULL,
  source_contract_code text,
  checksum char(64) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  reviewed_by text,
  approved_by text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE (formula_definition_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_official_formula_versions_status
  ON official_formula_versions (tenant_id, status, effective_from DESC);
DROP TRIGGER IF EXISTS trg_official_formula_versions_published_immutable ON official_formula_versions;
CREATE TRIGGER trg_official_formula_versions_published_immutable
BEFORE UPDATE OR DELETE ON official_formula_versions
FOR EACH ROW WHEN (OLD.status = 'published')
EXECUTE FUNCTION reject_published_official_formula_change();

CREATE TABLE IF NOT EXISTS official_formula_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid NOT NULL REFERENCES official_formula_versions(id) ON DELETE CASCADE,
  variable_name text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('number','integer','text','boolean','date','timestamp','array','object','currency','percentage')),
  unit text,
  required boolean NOT NULL DEFAULT true,
  default_value jsonb,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (formula_version_id, variable_name)
);

CREATE TABLE IF NOT EXISTS official_formula_source_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  source_code text NOT NULL,
  formula_code text,
  entity_name text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_joins jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone_policy text NOT NULL DEFAULT 'tenant_timezone',
  unit text,
  cardinality text NOT NULL CHECK (cardinality IN ('single','one_to_many','many_to_many','time_series','aggregate')),
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  null_policy text NOT NULL,
  availability text NOT NULL CHECK (availability IN ('available','partially_available','source_unavailable','legacy_adapter_required')),
  checksum char(64) NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE UNIQUE INDEX IF NOT EXISTS idx_formula_source_contracts_unique
  ON official_formula_source_contracts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), source_code, version_number);
CREATE INDEX IF NOT EXISTS idx_formula_source_contracts_formula
  ON official_formula_source_contracts (formula_code, availability, status);

CREATE TABLE IF NOT EXISTS official_formula_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid NOT NULL REFERENCES official_formula_versions(id) ON DELETE CASCADE,
  threshold_code text NOT NULL,
  comparator text NOT NULL CHECK (comparator IN ('lt','lte','eq','gte','gt','between')),
  value jsonb NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','positive','warning','high','critical')),
  label text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (formula_version_id, threshold_code)
);

CREATE TABLE IF NOT EXISTS official_formula_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid NOT NULL REFERENCES official_formula_versions(id) ON DELETE CASCADE,
  depends_on_formula_code text NOT NULL,
  dependency_type text NOT NULL CHECK (dependency_type IN ('input','component','threshold','comparison','explanation')),
  required boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (formula_version_id, depends_on_formula_code, dependency_type)
);

CREATE TABLE IF NOT EXISTS calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE SET NULL,
  formula_code text NOT NULL,
  source_contract_id uuid REFERENCES official_formula_source_contracts(id) ON DELETE SET NULL,
  run_status text NOT NULL CHECK (run_status IN ('source_unavailable','validating','calculated','not_calculable','failed','rolled_back')),
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
  duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_tenant_formula
  ON calculation_runs (tenant_id, formula_code, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_correlation
  ON calculation_runs (tenant_id, correlation_id) WHERE correlation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS calculation_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES calculation_runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variable_name text NOT NULL,
  input_value jsonb,
  unit text,
  source_row_count integer NOT NULL DEFAULT 0 CHECK (source_row_count >= 0),
  input_hash char(64) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (run_id, variable_name)
);

CREATE TABLE IF NOT EXISTS calculation_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES calculation_runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  output_name text NOT NULL DEFAULT 'value',
  output_value jsonb,
  unit text,
  precision integer NOT NULL DEFAULT 4,
  rounding_policy text NOT NULL,
  output_hash char(64) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (run_id, output_name)
);

CREATE TABLE IF NOT EXISTS calculation_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES calculation_runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  validation_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  message text NOT NULL,
  source_row jsonb,
  field_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_calculation_validations_run ON calculation_validations (run_id, severity);

CREATE TABLE IF NOT EXISTS calculation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid REFERENCES calculation_runs(id) ON DELETE SET NULL,
  source_contract_id uuid REFERENCES official_formula_source_contracts(id) ON DELETE SET NULL,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('source_dataset','input','output','explanation','comparison')),
  snapshot_hash char(64) NOT NULL,
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_calculation_snapshots_tenant_hash ON calculation_snapshots (tenant_id, snapshot_hash);

CREATE TABLE IF NOT EXISTS calculation_consumers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  formula_code text NOT NULL,
  consumer_type text NOT NULL CHECK (consumer_type IN ('dashboard','report','api','job','alert','frontend_view','export')),
  consumer_key text NOT NULL,
  consumer_path text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','retired')),
  package_status text NOT NULL DEFAULT 'pending_later_package',
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calculation_consumers_unique
  ON calculation_consumers (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), formula_code, consumer_type, consumer_key);

CREATE TABLE IF NOT EXISTS calculation_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES calculation_runs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  explanation_type text NOT NULL CHECK (explanation_type IN ('formula','source','validation','threshold','lineage','comparison')),
  explanation text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  lineage jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS calculation_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid REFERENCES calculation_runs(id) ON DELETE SET NULL,
  anomaly_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','high','critical')),
  detected_value jsonb,
  expected_range jsonb,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','dismissed','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_calculation_anomalies_tenant_status ON calculation_anomalies (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS calculation_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  base_run_id uuid REFERENCES calculation_runs(id) ON DELETE CASCADE,
  comparison_run_id uuid REFERENCES calculation_runs(id) ON DELETE CASCADE,
  comparison_type text NOT NULL CHECK (comparison_type IN ('period','formula_version','tenant_peer','target','snapshot')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (base_run_id IS NOT NULL OR comparison_run_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS statistical_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid REFERENCES calculation_runs(id) ON DELETE SET NULL,
  sample_code text NOT NULL,
  source_contract_id uuid REFERENCES official_formula_source_contracts(id) ON DELETE SET NULL,
  population_size integer CHECK (population_size IS NULL OR population_size >= 0),
  sample_size integer NOT NULL CHECK (sample_size >= 0),
  sampling_method text NOT NULL CHECK (sampling_method IN ('complete','random','stratified','systematic','judgmental','not_applicable')),
  sample_hash char(64) NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, sample_code, sample_hash)
);

CREATE TABLE IF NOT EXISTS statistical_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sample_id uuid REFERENCES statistical_samples(id) ON DELETE CASCADE,
  run_id uuid REFERENCES calculation_runs(id) ON DELETE SET NULL,
  method_code text NOT NULL,
  result jsonb NOT NULL,
  precision integer NOT NULL DEFAULT 4,
  confidence_level numeric(6,5) CHECK (confidence_level IS NULL OR (confidence_level > 0 AND confidence_level < 1)),
  result_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_statistical_results_tenant_method ON statistical_results (tenant_id, method_code, created_at DESC);

CREATE TABLE IF NOT EXISTS metric_source_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  formula_code text NOT NULL,
  source_contract_id uuid REFERENCES official_formula_source_contracts(id) ON DELETE RESTRICT,
  binding_status text NOT NULL DEFAULT 'draft' CHECK (binding_status IN ('draft','active','retired')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_source_bindings_unique
  ON metric_source_bindings (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_key, formula_code, binding_status);

CREATE TABLE IF NOT EXISTS metric_calculation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  formula_code text NOT NULL,
  calculation_frequency text NOT NULL CHECK (calculation_frequency IN ('realtime','hourly','daily','weekly','monthly','quarterly','annual','on_demand')),
  stale_after interval,
  minimum_sample_size integer NOT NULL DEFAULT 1 CHECK (minimum_sample_size >= 0),
  failure_policy text NOT NULL CHECK (failure_policy IN ('fail_closed','use_latest_valid','mark_unmeasured','manual_review')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_calculation_policies_unique
  ON metric_calculation_policies (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_key, formula_code);

CREATE TABLE IF NOT EXISTS health_score_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  score_code text NOT NULL,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_score_definitions_unique
  ON health_score_definitions (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), score_code);

CREATE TABLE IF NOT EXISTS health_score_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score_definition_id uuid NOT NULL REFERENCES health_score_definitions(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  methodology text NOT NULL,
  weights jsonb NOT NULL,
  precision integer NOT NULL DEFAULT 2 CHECK (precision >= 0 AND precision <= 12),
  checksum char(64) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE (health_score_definition_id, version_number)
);
DROP TRIGGER IF EXISTS trg_health_score_versions_published_immutable ON health_score_versions;
CREATE TRIGGER trg_health_score_versions_published_immutable
BEFORE UPDATE OR DELETE ON health_score_versions
FOR EACH ROW WHEN (OLD.status = 'published')
EXECUTE FUNCTION reject_published_health_score_change();

CREATE TABLE IF NOT EXISTS health_score_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score_version_id uuid NOT NULL REFERENCES health_score_versions(id) ON DELETE CASCADE,
  formula_code text NOT NULL,
  component_key text NOT NULL,
  weight numeric(12,8) NOT NULL CHECK (weight >= 0),
  source_contract_code text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (health_score_version_id, component_key)
);

COMMIT;
