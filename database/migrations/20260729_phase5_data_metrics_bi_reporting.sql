-- TCDX ISO SaaS v4 - Phase 5 trusted data, metrics, BI, surveys and reporting.
-- Additive, tenant-scoped, idempotent migration. PostgreSQL remains source of truth.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS data_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  domain_key text NOT NULL,
  display_name text NOT NULL,
  description text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, domain_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_domains_global_key
  ON data_domains (domain_key) WHERE tenant_id IS NULL;

CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  display_name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('table','view','api','file','manual','integration','system')),
  system_name text NOT NULL,
  entity_name text NOT NULL,
  connection_reference text,
  refresh_frequency text NOT NULL DEFAULT 'on_demand' CHECK (refresh_frequency IN ('realtime','daily','weekly','monthly','quarterly','semiannual','annual','on_demand')),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','unavailable','retired')),
  last_observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, source_key)
);

CREATE TABLE IF NOT EXISTS data_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES data_domains(id) ON DELETE RESTRICT,
  element_key text NOT NULL,
  display_name text NOT NULL,
  business_definition text NOT NULL,
  technical_definition text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('integer','numeric','text','boolean','date','timestamp','json','uuid','currency','percentage')),
  classification text NOT NULL DEFAULT 'internal' CHECK (classification IN ('public','internal','confidential','restricted')),
  source_type text NOT NULL CHECK (source_type IN ('table','view','api','file','manual','integration','system')),
  source_reference text NOT NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  steward_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','deprecated','retired')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE (tenant_id, element_key)
);
CREATE INDEX IF NOT EXISTS idx_data_elements_tenant_domain ON data_elements (tenant_id, domain_id, status);

CREATE TABLE IF NOT EXISTS data_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  element_id uuid NOT NULL REFERENCES data_elements(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  business_definition text NOT NULL,
  technical_definition text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published','retired')),
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, element_id, version_number)
);

CREATE TABLE IF NOT EXISTS data_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data_element_id uuid REFERENCES data_elements(id) ON DELETE CASCADE,
  data_domain_id uuid REFERENCES data_domains(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_type text NOT NULL CHECK (owner_type IN ('business_owner','technical_owner','steward','reviewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (data_element_id IS NOT NULL OR data_domain_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_owners_unique_scope
  ON data_owners (tenant_id, COALESCE(data_element_id, data_domain_id), owner_user_id, owner_type);

CREATE TABLE IF NOT EXISTS data_quality_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data_element_id uuid REFERENCES data_elements(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  display_name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('completeness','range','format','consistency','duplicate','reference','coverage','tolerance','max_age')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  rule_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, rule_key)
);

CREATE TABLE IF NOT EXISTS data_quality_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data_element_id uuid REFERENCES data_elements(id) ON DELETE SET NULL,
  quality_rule_id uuid REFERENCES data_quality_rules(id) ON DELETE SET NULL,
  assessed_entity_type text NOT NULL,
  assessed_entity_id uuid,
  assessment_status text NOT NULL CHECK (assessment_status IN ('valid','estimated','incomplete','inconsistent','rejected','unknown')),
  score numeric(5,2) CHECK (score >= 0 AND score <= 100),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  assessed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_data_quality_assessments_entity ON data_quality_assessments (tenant_id, assessed_entity_type, assessed_entity_id, assessed_at DESC);

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
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (from_type <> '' AND to_type <> '')
);
CREATE INDEX IF NOT EXISTS idx_data_lineage_from ON data_lineage_edges (tenant_id, from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_to ON data_lineage_edges (tenant_id, to_type, to_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_lineage_unique_edge
  ON data_lineage_edges (tenant_id, from_type, from_id, to_type, to_id, relation_type, COALESCE(correlation_id, ''));

CREATE TABLE IF NOT EXISTS data_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('metric','dashboard','report','readiness','risk','compliance','control','supplier','incident','loss','data')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  period_key text,
  snapshot_payload jsonb NOT NULL,
  source_hash char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_data_snapshots_entity ON data_snapshots (tenant_id, entity_type, entity_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_snapshots_unique_source
  ON data_snapshots (tenant_id, snapshot_type, entity_type, entity_id, COALESCE(period_key, ''), source_hash);

CREATE TABLE IF NOT EXISTS data_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comparison_type text NOT NULL CHECK (comparison_type IN ('period','unit','process','standard','supplier','before_after','plan')),
  baseline_snapshot_id uuid NOT NULL REFERENCES data_snapshots(id) ON DELETE RESTRICT,
  current_snapshot_id uuid NOT NULL REFERENCES data_snapshots(id) ON DELETE RESTRICT,
  baseline_value numeric,
  current_value numeric,
  absolute_change numeric,
  percentage_change numeric,
  direction text NOT NULL CHECK (direction IN ('increase','decrease','unchanged','not_comparable')),
  status text NOT NULL CHECK (status IN ('improved','degraded','stable','not_comparable')),
  explanation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_ids uuid[] NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  display_name text NOT NULL,
  business_definition text NOT NULL,
  technical_definition text NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('kpi','kri','kci','kqi','sla','compliance','operational','security','supplier','continuity','audit','data_quality')),
  unit text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('higher_is_better','lower_is_better','target_range','informational')),
  aggregation text NOT NULL CHECK (aggregation IN ('sum','average','min','max','count','count_distinct','ratio','percentage','latest','custom_declarative')),
  frequency text NOT NULL CHECK (frequency IN ('realtime','daily','weekly','monthly','quarterly','semiannual','annual','on_demand')),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published','retired')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE (tenant_id, metric_code),
  UNIQUE (metric_code)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_definitions_global_code ON metric_definitions (metric_code) WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_metric_definitions_tenant_type ON metric_definitions (tenant_id, metric_type, status);

CREATE TABLE IF NOT EXISTS metric_formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  expression jsonb NOT NULL,
  expression_language text NOT NULL DEFAULT 'tcdx_metric_dsl_v1' CHECK (expression_language = 'tcdx_metric_dsl_v1'),
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published','retired')),
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (metric_definition_id, version_number)
);

CREATE OR REPLACE FUNCTION reject_published_metric_formula_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'metric_formula_versions records are immutable after publishing';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_metric_formula_versions_immutable ON metric_formula_versions;
CREATE TRIGGER trg_metric_formula_versions_immutable
BEFORE UPDATE OR DELETE ON metric_formula_versions
FOR EACH ROW
WHEN (OLD.status = 'published')
EXECUTE FUNCTION reject_published_metric_formula_change();

CREATE TABLE IF NOT EXISTS metric_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  dimension_key text NOT NULL,
  display_name text NOT NULL,
  data_element_id uuid REFERENCES data_elements(id) ON DELETE SET NULL,
  required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (metric_definition_id, dimension_key)
);

CREATE TABLE IF NOT EXISTS metric_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  data_source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  source_key text NOT NULL,
  source_entity text NOT NULL,
  source_field text,
  role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','secondary','validation','evidence')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (metric_definition_id, source_key, role)
);

CREATE TABLE IF NOT EXISTS metric_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  threshold_key text NOT NULL,
  label text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('greater_than','greater_or_equal','less_than','less_or_equal','between','equals')),
  value_min numeric,
  value_max numeric,
  status_result text NOT NULL CHECK (status_result IN ('good','warning','critical','informational')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE (metric_definition_id, threshold_key)
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
  quality_status text NOT NULL DEFAULT 'unknown' CHECK (quality_status IN ('valid','estimated','incomplete','inconsistent','rejected','unknown')),
  freshness_status text NOT NULL DEFAULT 'unknown' CHECK (freshness_status IN ('current','aging','stale','expired','unavailable','unknown')),
  trust_score numeric(5,2) CHECK (trust_score >= 0 AND trust_score <= 100),
  trust_status text NOT NULL DEFAULT 'unknown' CHECK (trust_status IN ('trusted','acceptable','attention','untrusted','unknown')),
  validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','valid','rejected','approved')),
  evidence_id uuid,
  correlation_id text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (period_end > period_start),
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_metric_measurements_metric_period ON metric_measurements (tenant_id, metric_definition_id, period_start DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_measurements_unique_correlation
  ON metric_measurements (tenant_id, metric_definition_id, period_key, COALESCE(correlation_id, 'manual'));

CREATE TABLE IF NOT EXISTS metric_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  measurement_id uuid NOT NULL REFERENCES metric_measurements(id) ON DELETE CASCADE,
  validation_status text NOT NULL CHECK (validation_status IN ('valid','rejected','approved')),
  comment text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS metric_impact_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('risk','control','requirement','readiness','finding','action')),
  rule_definition jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE RESTRICT,
  measurement_id uuid REFERENCES metric_measurements(id) ON DELETE SET NULL,
  formula_version_id uuid REFERENCES metric_formula_versions(id) ON DELETE RESTRICT,
  period_key text NOT NULL,
  snapshot_payload jsonb NOT NULL,
  content_hash char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, metric_definition_id, period_key, content_hash)
);

CREATE TABLE IF NOT EXISTS data_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  score numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  status text NOT NULL CHECK (status IN ('trusted','acceptable','attention','untrusted','unknown')),
  components jsonb NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version text NOT NULL DEFAULT 'data_trust_score_v1',
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, entity_type, entity_id, correlation_id)
);

CREATE TABLE IF NOT EXISTS survey_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  survey_key text NOT NULL,
  display_name text NOT NULL,
  survey_type text NOT NULL CHECK (survey_type IN ('survey','questionnaire','self_assessment','supplier_assessment','process_assessment','control_assessment','risk_assessment','campaign')),
  description text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','active','closed','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, survey_key)
);

CREATE TABLE IF NOT EXISTS survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_definition_id uuid NOT NULL REFERENCES survey_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','active','closed','retired')),
  scoring_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  branching_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (survey_definition_id, version_number)
);

CREATE OR REPLACE FUNCTION reject_published_survey_version_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('published','active','closed') THEN
    RAISE EXCEPTION 'survey_versions records are immutable after publishing';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_survey_versions_immutable ON survey_versions;
CREATE TRIGGER trg_survey_versions_immutable
BEFORE UPDATE OR DELETE ON survey_versions
FOR EACH ROW
WHEN (OLD.status IN ('published','active','closed'))
EXECUTE FUNCTION reject_published_survey_version_change();

CREATE TABLE IF NOT EXISTS survey_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_version_id uuid NOT NULL REFERENCES survey_versions(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (survey_version_id, section_key)
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_version_id uuid NOT NULL REFERENCES survey_versions(id) ON DELETE CASCADE,
  section_id uuid REFERENCES survey_sections(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('text','textarea','number','date','single_choice','multiple_choice','scale','yes_no','matrix','evidence','signature','declaration')),
  help_text text,
  required boolean NOT NULL DEFAULT false,
  allow_not_applicable boolean NOT NULL DEFAULT true,
  validation_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 1 CHECK (weight >= 0),
  branching_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility_condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (survey_version_id, question_key)
);

CREATE TABLE IF NOT EXISTS survey_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  label text NOT NULL,
  score numeric,
  sort_order integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (question_id, option_key)
);

CREATE TABLE IF NOT EXISTS assessment_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  survey_definition_id uuid NOT NULL REFERENCES survey_definitions(id) ON DELETE RESTRICT,
  survey_version_id uuid NOT NULL REFERENCES survey_versions(id) ON DELETE RESTRICT,
  campaign_key text NOT NULL,
  display_name text NOT NULL,
  target_population jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  recurrence_rule text,
  reminder_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','closed','cancelled')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  UNIQUE (tenant_id, campaign_key)
);

CREATE TABLE IF NOT EXISTS assessment_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES assessment_campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  external_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_status text NOT NULL DEFAULT 'pending' CHECK (recipient_status IN ('pending','sent','opened','responded','reminded','cancelled')),
  invited_at timestamptz,
  responded_at timestamptz,
  token_hash char(64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (user_id IS NOT NULL OR external_contact <> '{}'::jsonb)
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES assessment_campaigns(id) ON DELETE SET NULL,
  survey_version_id uuid NOT NULL REFERENCES survey_versions(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES assessment_recipients(id) ON DELETE SET NULL,
  respondent_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','evaluated','approved','rejected')),
  submitted_at timestamptz,
  total_score numeric,
  max_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS survey_response_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  response_id uuid NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES survey_questions(id) ON DELETE RESTRICT,
  answer_text text,
  answer_numeric numeric,
  answer_date date,
  answer_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  not_applicable boolean NOT NULL DEFAULT false,
  score numeric,
  evidence_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, response_id, question_id)
);

CREATE TABLE IF NOT EXISTS survey_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  response_id uuid NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  evaluation_status text NOT NULL DEFAULT 'draft' CHECK (evaluation_status IN ('draft','previewed','confirmed','applied','rejected')),
  score numeric,
  findings_preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  consequences_preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS survey_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  response_id uuid REFERENCES survey_responses(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES survey_evaluations(id) ON DELETE CASCADE,
  approval_status text NOT NULL CHECK (approval_status IN ('approved','rejected','changes_requested')),
  comment text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (response_id IS NOT NULL OR evaluation_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS assurance_test_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  test_code text NOT NULL,
  display_name text NOT NULL,
  test_type text NOT NULL CHECK (test_type IN ('design_test','implementation_test','operating_test','effectiveness_test','technical_test','evidence_test','recovery_test')),
  objective text NOT NULL,
  procedure text NOT NULL,
  target_entity_type text NOT NULL CHECK (target_entity_type IN ('asset','risk','control','audit','evidence','supplier','continuity')),
  target_entity_id uuid,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, test_code)
);

CREATE TABLE IF NOT EXISTS assurance_test_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  test_definition_id uuid NOT NULL REFERENCES assurance_test_definitions(id) ON DELETE RESTRICT,
  execution_code text NOT NULL,
  population_description text NOT NULL,
  sample_method text NOT NULL,
  executed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  executed_at timestamptz,
  reviewed_at timestamptz,
  result text CHECK (result IN ('pass','pass_with_observations','fail','not_applicable','inconclusive')),
  conclusion text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','reviewed','approved','cancelled')),
  evidence_id uuid,
  finding_id uuid,
  action_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, execution_code)
);

CREATE TABLE IF NOT EXISTS assurance_test_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES assurance_test_executions(id) ON DELETE CASCADE,
  sample_reference text NOT NULL,
  sample_description text,
  selected_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS assurance_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES assurance_test_executions(id) ON DELETE CASCADE,
  sample_id uuid REFERENCES assurance_test_samples(id) ON DELETE SET NULL,
  result text NOT NULL CHECK (result IN ('pass','pass_with_observations','fail','not_applicable','inconclusive')),
  severity text CHECK (severity IN ('low','medium','high','critical')),
  observation text,
  evidence_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS assurance_test_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES assurance_test_executions(id) ON DELETE CASCADE,
  result_id uuid REFERENCES assurance_test_results(id) ON DELETE SET NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','remediated','closed')),
  finding_id uuid,
  action_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS loss_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  detected_at timestamptz,
  process_id uuid,
  service_id uuid,
  risk_id uuid,
  cause text,
  impact_description text NOT NULL,
  gross_loss numeric(18,2) NOT NULL DEFAULT 0 CHECK (gross_loss >= 0),
  recoveries numeric(18,2) NOT NULL DEFAULT 0 CHECK (recoveries >= 0),
  net_loss numeric(18,2) NOT NULL DEFAULT 0 CHECK (net_loss >= 0),
  currency char(3) NOT NULL DEFAULT 'CLP',
  supplier_id uuid,
  incident_id uuid,
  failed_control_id uuid,
  evidence_id uuid,
  action_plan_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','confirmed','recovered_partial','closed','cancelled')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, event_code),
  CHECK (detected_at IS NULL OR detected_at >= occurred_at),
  CHECK (net_loss = gross_loss - recoveries),
  CHECK (gross_loss - recoveries >= 0)
);

CREATE TABLE IF NOT EXISTS loss_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loss_event_id uuid NOT NULL REFERENCES loss_events(id) ON DELETE CASCADE,
  recovery_code text NOT NULL,
  recovered_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL,
  source text NOT NULL,
  evidence_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, loss_event_id, recovery_code)
);

CREATE OR REPLACE FUNCTION set_loss_event_net_loss()
RETURNS trigger AS $$
BEGIN
  NEW.net_loss := NEW.gross_loss - NEW.recoveries;
  IF NEW.net_loss < 0 THEN
    RAISE EXCEPTION 'loss event net_loss cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loss_events_net_loss ON loss_events;
CREATE TRIGGER trg_loss_events_net_loss
BEFORE INSERT OR UPDATE ON loss_events
FOR EACH ROW
EXECUTE FUNCTION set_loss_event_net_loss();

CREATE TABLE IF NOT EXISTS dashboard_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dashboard_key text NOT NULL,
  display_name text NOT NULL,
  description text,
  dashboard_type text NOT NULL DEFAULT 'custom' CHECK (dashboard_type IN ('executive','compliance','risk','controls','audit','actions','suppliers','continuity','incidents_losses','data_quality','custom')),
  layout_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, dashboard_key, version_number)
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dashboard_id uuid NOT NULL REFERENCES dashboard_definitions(id) ON DELETE CASCADE,
  widget_key text NOT NULL,
  display_name text NOT NULL,
  widget_type text NOT NULL CHECK (widget_type IN ('kpi_card','trend','heat_map','distribution','matrix','table','timeline','status','gauge','relationship_graph','impact_graph')),
  data_source_type text NOT NULL CHECK (data_source_type IN ('metric','dataset','query','snapshot','lineage','impact')),
  data_source_ref text NOT NULL,
  position_row integer NOT NULL DEFAULT 1 CHECK (position_row > 0),
  position_col integer NOT NULL DEFAULT 1 CHECK (position_col > 0),
  width integer NOT NULL DEFAULT 4 CHECK (width > 0),
  height integer NOT NULL DEFAULT 2 CHECK (height > 0),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (dashboard_id, widget_key)
);

CREATE TABLE IF NOT EXISTS dashboard_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dashboard_id uuid NOT NULL REFERENCES dashboard_definitions(id) ON DELETE CASCADE,
  principal_type text NOT NULL CHECK (principal_type IN ('role','user')),
  principal_id text NOT NULL,
  permission_level text NOT NULL CHECK (permission_level IN ('read','manage','publish')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (dashboard_id, principal_type, principal_id, permission_level)
);

CREATE TABLE IF NOT EXISTS report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_key text NOT NULL,
  display_name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('executive_grc','risks','compliance','gap_analysis','soa','audit','findings','nonconformities','actions','suppliers','continuity','kpi_kri','data_quality','custom')),
  classification text NOT NULL DEFAULT 'internal' CHECK (classification IN ('public','internal','confidential','restricted')),
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  section_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, report_key)
);

CREATE TABLE IF NOT EXISTS report_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  display_name text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  format text NOT NULL CHECK (format IN ('pdf','docx','xlsx')),
  template_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, template_key, version_number, format)
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_definition_id uuid NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  schedule_key text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','annual','restricted_cron')),
  restricted_cron text,
  timezone text NOT NULL DEFAULT 'America/Santiago',
  next_run_at timestamptz,
  last_run_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, schedule_key)
);

CREATE TABLE IF NOT EXISTS report_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_definition_id uuid NOT NULL REFERENCES report_definitions(id) ON DELETE RESTRICT,
  schedule_id uuid REFERENCES report_schedules(id) ON DELETE SET NULL,
  generation_key text NOT NULL,
  format text NOT NULL CHECK (format IN ('pdf','docx','xlsx')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','generating','generated','failed','expired','cancelled')),
  snapshot_id uuid REFERENCES data_snapshots(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  approved_at timestamptz,
  checksum char(64),
  error_code text,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, generation_key, format)
);

CREATE TABLE IF NOT EXISTS report_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_generation_id uuid NOT NULL REFERENCES report_generations(id) ON DELETE CASCADE,
  artifact_format text NOT NULL CHECK (artifact_format IN ('pdf','docx','xlsx')),
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
  checksum char(64) NOT NULL,
  storage_path text NOT NULL,
  classification text NOT NULL DEFAULT 'internal' CHECK (classification IN ('public','internal','confidential','restricted')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, report_generation_id, artifact_format)
);

CREATE TABLE IF NOT EXISTS report_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_generation_id uuid NOT NULL REFERENCES report_generations(id) ON DELETE CASCADE,
  approval_status text NOT NULL CHECK (approval_status IN ('approved','rejected','changes_requested')),
  comment text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('data.catalog.read','data','Consultar catalogo de datos','Consulta dominios, elementos y fuentes de datos.'),
  ('data.catalog.manage','data','Administrar catalogo de datos','Crea y mantiene catalogo maestro de datos.'),
  ('data.quality.read','data','Consultar calidad de datos','Consulta calidad, freshness y confianza.'),
  ('data.quality.manage','data','Administrar calidad de datos','Ejecuta evaluaciones y reglas de calidad.'),
  ('data.lineage.read','data','Consultar lineage','Navega lineage e impacto GRC.'),
  ('data.lineage.manage','data','Administrar lineage','Registra relaciones de lineage e impacto.'),
  ('metrics.read','metrics','Consultar metricas','Consulta catalogo, mediciones, tendencia y confianza.'),
  ('metrics.manage','metrics','Administrar metricas','Crea y actualiza definiciones de metricas.'),
  ('metrics.publish','metrics','Publicar metricas','Aprueba y publica metricas y formulas.'),
  ('metrics.measure','metrics','Medir metricas','Registra mediciones manuales o calculadas.'),
  ('metrics.validate','metrics','Validar metricas','Valida mediciones y calidad.'),
  ('metrics.recalculate','metrics','Recalcular metricas','Ejecuta recalculo controlado.'),
  ('surveys.read','surveys','Consultar encuestas','Consulta encuestas, campañas y respuestas.'),
  ('surveys.manage','surveys','Administrar encuestas','Crea y actualiza encuestas y campañas.'),
  ('surveys.publish','surveys','Publicar encuestas','Publica versiones inmutables.'),
  ('surveys.respond','surveys','Responder encuestas','Registra respuestas autorizadas.'),
  ('surveys.evaluate','surveys','Evaluar encuestas','Evalua respuestas y consecuencias GRC.'),
  ('surveys.approve','surveys','Aprobar encuestas','Aprueba respuestas o evaluaciones.'),
  ('assurance_tests.read','assurance','Consultar tests','Consulta tests de assurance.'),
  ('assurance_tests.manage','assurance','Administrar tests','Crea definiciones de tests.'),
  ('assurance_tests.execute','assurance','Ejecutar tests','Ejecuta tests y registra resultados.'),
  ('assurance_tests.review','assurance','Revisar tests','Revisa y aprueba ejecuciones.'),
  ('loss_events.read','loss','Consultar perdidas','Consulta eventos de perdida.'),
  ('loss_events.manage','loss','Administrar perdidas','Crea y actualiza eventos de perdida.'),
  ('loss_events.approve','loss','Aprobar perdidas','Confirma y cierra eventos de perdida.'),
  ('dashboards.read','bi','Consultar dashboards','Consulta dashboards y widgets.'),
  ('dashboards.manage','bi','Administrar dashboards','Crea y actualiza dashboards.'),
  ('dashboards.publish','bi','Publicar dashboards','Publica dashboards gobernados.'),
  ('reports.read','reports','Consultar reportes','Consulta definiciones e historial.'),
  ('reports.manage','reports','Administrar reportes','Crea y actualiza reportes.'),
  ('reports.generate','reports','Generar reportes','Genera emisiones bajo snapshot.'),
  ('reports.schedule','reports','Programar reportes','Administra programacion de reportes.'),
  ('reports.approve','reports','Aprobar reportes','Aprueba emisiones.'),
  ('reports.download','reports','Descargar reportes','Descarga artefactos autorizados.')
ON CONFLICT (permission_key) DO UPDATE
SET permission_group = EXCLUDED.permission_group,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, permission_key, true
FROM (VALUES ('admin'),('tenant_admin'),('admin_cumplimiento'),('compliance_admin')) AS r(role_key)
JOIN app_roles ar ON ar.role_key = r.role_key
CROSS JOIN permissions p
WHERE p.permission_group IN ('data','metrics','surveys','assurance','loss','bi','reports')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, permission_key, true
FROM (VALUES ('auditor'),('operativo'),('responsable_area'),('area_owner')) AS r(role_key)
JOIN app_roles ar ON ar.role_key = r.role_key
CROSS JOIN permissions p
WHERE p.permission_key IN (
  'data.catalog.read','data.quality.read','data.lineage.read',
  'metrics.read','metrics.measure','surveys.read','surveys.respond',
  'assurance_tests.read','assurance_tests.execute','loss_events.read',
  'dashboards.read','reports.read','reports.generate','reports.download'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, permission_key, true
FROM (VALUES ('viewer'),('cliente'),('client'),('read_only'),('readonly'),('solo_lectura'),('ejecutivo')) AS r(role_key)
JOIN app_roles ar ON ar.role_key = r.role_key
CROSS JOIN permissions p
WHERE p.permission_key IN (
  'data.catalog.read','data.quality.read','data.lineage.read',
  'metrics.read','surveys.read','dashboards.read','reports.read','reports.download'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed;

INSERT INTO commercial_technical_capabilities (capability_key, display_name, description, required_permission, status)
VALUES
  ('data.governance','Gobierno de datos','Catalogo maestro, ownership y definiciones.', 'data.catalog.read','active'),
  ('metrics.catalog','Catalogo de metricas','Metricas versionadas KPI/KRI/KCI/KQI/SLA.', 'metrics.read','active'),
  ('metrics.engine','Motor de metricas','Calculo declarativo y mediciones reproducibles.', 'metrics.measure','active'),
  ('metrics.data_trust','Data Trust Score','Score de confianza explicable y determinista.', 'data.quality.read','active'),
  ('data.lineage','Lineage de datos','Trazabilidad extremo a extremo.', 'data.lineage.read','active'),
  ('data.impact_graph','Impact Graph GRC','Grafo de impacto dato-metrica-riesgo-control.', 'data.lineage.read','active'),
  ('surveys.engine','Motor de encuestas','Encuestas, campañas, respuestas y scoring.', 'surveys.read','active'),
  ('assurance.testing','Tests de assurance','Tests de controles, riesgos, activos y evidencias.', 'assurance_tests.read','active'),
  ('loss.events','Eventos de perdida','Registro de perdidas, recuperaciones y KRI.', 'loss_events.read','active'),
  ('bi.dashboard_builder','Dashboard builder','Dashboards y widgets gobernados.', 'dashboards.read','active'),
  ('bi.executive_dashboards','Dashboards ejecutivos','Dashboards ejecutivos GRC predefinidos.', 'dashboards.read','active'),
  ('reporting.studio','Report Studio','Definiciones, emisiones e historial de reportes.', 'reports.read','active'),
  ('reporting.pdf','Reportes PDF','Generacion de PDF valido.', 'reports.generate','active'),
  ('reporting.docx','Reportes DOCX','Generacion de DOCX valido.', 'reports.generate','active'),
  ('reporting.xlsx','Reportes XLSX','Generacion de XLSX valido.', 'reports.generate','active'),
  ('reporting.scheduled','Reporting programado','Programacion gobernada de reportes.', 'reports.schedule','active')
ON CONFLICT (capability_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    required_permission = EXCLUDED.required_permission,
    status = EXCLUDED.status,
    updated_at = now();

INSERT INTO commercial_modules (module_key, display_name, description, status, sort_order)
VALUES
  ('data_governance','Datos y confianza','Catalogo, calidad, lineage e impacto de datos.','active',90),
  ('metrics_bi','Metricas y BI','Metricas versionadas, dashboards y analitica GRC.','active',100),
  ('surveys_assessments','Encuestas y evaluaciones','Encuestas, campañas y evaluaciones GRC.','active',110),
  ('assurance_loss','Assurance y perdidas','Tests de assurance y eventos de perdida.','active',120),
  ('report_studio','Report Studio','Reporting gobernado PDF DOCX XLSX y scheduling.','active',130)
ON CONFLICT (module_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO commercial_features (feature_key, display_name, description, status)
VALUES
  ('data_governance_core','Datos gobernados','Datos, calidad, trust score, lineage e impacto.','active'),
  ('metrics_bi_core','Metricas y BI','Metricas, mediciones, dashboards y widgets.','active'),
  ('surveys_assessments_core','Encuestas y evaluaciones','Encuestas, campañas, scoring y evaluaciones.','active'),
  ('assurance_loss_core','Assurance y perdidas','Tests de assurance y eventos de perdida.','active'),
  ('report_studio_core','Report Studio','Reportes gobernados y formatos de salida.','active')
ON CONFLICT (feature_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = now();

INSERT INTO module_features (module_key, feature_key)
VALUES
  ('data_governance','data_governance_core'),
  ('metrics_bi','metrics_bi_core'),
  ('surveys_assessments','surveys_assessments_core'),
  ('assurance_loss','assurance_loss_core'),
  ('report_studio','report_studio_core')
ON CONFLICT (module_key, feature_key) DO NOTHING;

INSERT INTO feature_capabilities (feature_key, capability_key)
VALUES
  ('data_governance_core','data.governance'),
  ('data_governance_core','metrics.data_trust'),
  ('data_governance_core','data.lineage'),
  ('data_governance_core','data.impact_graph'),
  ('metrics_bi_core','metrics.catalog'),
  ('metrics_bi_core','metrics.engine'),
  ('metrics_bi_core','bi.dashboard_builder'),
  ('metrics_bi_core','bi.executive_dashboards'),
  ('surveys_assessments_core','surveys.engine'),
  ('assurance_loss_core','assurance.testing'),
  ('assurance_loss_core','loss.events'),
  ('report_studio_core','reporting.studio'),
  ('report_studio_core','reporting.pdf'),
  ('report_studio_core','reporting.docx'),
  ('report_studio_core','reporting.xlsx'),
  ('report_studio_core','reporting.scheduled')
ON CONFLICT (feature_key, capability_key) DO NOTHING;

INSERT INTO plan_version_modules (plan_version_id, module_key, included)
SELECT cpv.id, module_key, true
FROM commercial_plan_versions cpv
CROSS JOIN (VALUES
  ('enterprise','data_governance'),('enterprise','metrics_bi'),('enterprise','surveys_assessments'),('enterprise','assurance_loss'),('enterprise','report_studio'),
  ('empresa','data_governance'),('empresa','metrics_bi'),('empresa','surveys_assessments'),('empresa','report_studio'),
  ('pyme','metrics_bi'),('pyme','report_studio'),
  ('demo','metrics_bi'),('demo','surveys_assessments'),('demo','report_studio')
) AS allowed(plan_key, module_key)
WHERE cpv.plan_key = allowed.plan_key AND cpv.status = 'published'
ON CONFLICT (plan_version_id, module_key) DO UPDATE SET included = EXCLUDED.included, updated_at = now();

INSERT INTO usage_limit_definitions (resource_key, display_name, description, default_limit, unit, period, warning_threshold, enforcement)
VALUES
  ('metric_definitions','Definiciones de metricas','Cantidad total de metricas configuradas.',100,'count','lifetime',0.8,'warn'),
  ('metric_measurements_monthly','Mediciones mensuales','Mediciones registradas por mes.',5000,'count','month',0.8,'block'),
  ('survey_campaigns_monthly','Campañas mensuales','Campañas de encuesta creadas por mes.',20,'count','month',0.8,'block'),
  ('survey_responses_monthly','Respuestas mensuales','Respuestas de encuesta recibidas por mes.',2000,'count','month',0.8,'block'),
  ('dashboard_definitions','Dashboards','Dashboards configurados.',25,'count','lifetime',0.8,'warn'),
  ('report_generations_monthly','Generaciones de reporte','Emisiones de reporte por mes.',100,'count','month',0.8,'block'),
  ('scheduled_reports','Reportes programados','Programaciones activas de reporte.',20,'count','lifetime',0.8,'block'),
  ('report_storage_bytes','Almacenamiento reportes','Bytes usados por artefactos de reporte.',10737418240,'bytes','lifetime',0.8,'block')
ON CONFLICT (resource_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_limit = EXCLUDED.default_limit,
    unit = EXCLUDED.unit,
    period = EXCLUDED.period,
    warning_threshold = EXCLUDED.warning_threshold,
    enforcement = EXCLUDED.enforcement,
    updated_at = now();

INSERT INTO metric_definitions (
  tenant_id, metric_code, display_name, business_definition, technical_definition,
  metric_type, unit, direction, aggregation, frequency, status, metadata
)
VALUES
  (NULL,'control_conformance_percentage','Porcentaje de controles conformes','Proporcion de controles evaluados como conformes.','Conteo de controles conformes dividido por controles evaluados; queda sin medicion si no hay fuente tenant.', 'compliance','%','higher_is_better','percentage','monthly','published','{"domain":"cumplimiento"}'),
  (NULL,'controls_without_current_evidence','Controles sin evidencia vigente','Cantidad de controles aplicables sin evidencia vigente.','Conteo derivable desde evidencias y controles cuando el tenant tiene fuente operacional.', 'kci','count','lower_is_better','count','monthly','published','{"domain":"cumplimiento"}'),
  (NULL,'requirements_not_evaluated','Requisitos no evaluados','Requisitos aplicables sin evaluacion registrada.','Conteo de requisitos aplicables sin evaluacion.', 'compliance','count','lower_is_better','count','monthly','published','{"domain":"cumplimiento"}'),
  (NULL,'standard_readiness_score','Readiness por norma','Score readiness por norma ISO.','Ultimo snapshot readiness tenant/norma.', 'kpi','score','higher_is_better','latest','monthly','published','{"domain":"cumplimiento"}'),
  (NULL,'open_findings','Hallazgos abiertos','Hallazgos abiertos por periodo.','Conteo de hallazgos no cerrados.', 'audit','count','lower_is_better','count','weekly','published','{"domain":"cumplimiento"}'),
  (NULL,'overdue_nonconformities','No conformidades vencidas','No conformidades abiertas con fecha vencida.','Conteo de no conformidades vencidas.', 'audit','count','lower_is_better','count','weekly','published','{"domain":"cumplimiento"}'),
  (NULL,'critical_risks','Riesgos criticos','Cantidad de riesgos residuales criticos.','Conteo de riesgos con nivel residual critico.', 'kri','count','lower_is_better','count','monthly','published','{"domain":"riesgo"}'),
  (NULL,'residual_exposure','Exposicion residual','Exposicion residual agregada.','Suma de exposicion residual cuantificada si existe.', 'kri','currency','lower_is_better','sum','monthly','published','{"domain":"riesgo"}'),
  (NULL,'overdue_risk_treatments','Tratamientos vencidos','Tratamientos de riesgo vencidos.','Conteo de tratamientos vencidos.', 'kri','count','lower_is_better','count','weekly','published','{"domain":"riesgo"}'),
  (NULL,'risks_without_owner','Riesgos sin propietario','Riesgos activos sin responsable.','Conteo de riesgos activos owner null.', 'kri','count','lower_is_better','count','monthly','published','{"domain":"riesgo"}'),
  (NULL,'risks_with_degraded_controls','Riesgos con controles degradados','Riesgos vinculados a controles degradados.','Conteo por relacion riesgo-control con control degradado.', 'kri','count','lower_is_better','count','monthly','published','{"domain":"riesgo"}'),
  (NULL,'control_effectiveness','Efectividad de controles','Efectividad promedio de controles testeados.','Promedio de resultados de tests de efectividad.', 'kci','%','higher_is_better','average','monthly','published','{"domain":"controles"}'),
  (NULL,'control_coverage','Cobertura de controles','Cobertura de controles respecto de requisitos aplicables.','Controles cubiertos dividido por controles aplicables.', 'kci','%','higher_is_better','percentage','monthly','published','{"domain":"controles"}'),
  (NULL,'control_frequency_compliance','Cumplimiento de frecuencia','Controles ejecutados dentro de frecuencia requerida.','Porcentaje de controles con ejecucion vigente.', 'kci','%','higher_is_better','percentage','monthly','published','{"domain":"controles"}'),
  (NULL,'expired_evidence','Evidencia expirada','Evidencias vencidas o stale.','Conteo de evidencias expiradas.', 'kci','count','lower_is_better','count','weekly','published','{"domain":"controles"}'),
  (NULL,'failed_tests','Tests fallidos','Tests de assurance con resultado fail.','Conteo de tests fallidos.', 'kci','count','lower_is_better','count','weekly','published','{"domain":"controles"}'),
  (NULL,'overdue_actions','Acciones vencidas','Planes de accion vencidos.','Conteo de acciones abiertas con fecha vencida.', 'operational','count','lower_is_better','count','weekly','published','{"domain":"operacion"}'),
  (NULL,'mean_time_to_close','Tiempo medio de cierre','Promedio de dias para cerrar acciones o hallazgos.','Promedio entre created_at y closed_at.', 'operational','days','lower_is_better','average','monthly','published','{"domain":"operacion"}'),
  (NULL,'incidents_by_period','Incidentes por periodo','Cantidad de incidentes registrados.','Conteo de incidentes por periodo.', 'security','count','lower_is_better','count','monthly','published','{"domain":"operacion"}'),
  (NULL,'net_losses','Perdidas netas','Perdidas netas confirmadas.','Suma de loss_events.net_loss por periodo.', 'kri','currency','lower_is_better','sum','monthly','published','{"domain":"operacion"}'),
  (NULL,'recovery_amount','Recuperacion','Monto recuperado frente a perdidas.','Suma de recoveries por periodo.', 'kpi','currency','higher_is_better','sum','monthly','published','{"domain":"operacion"}'),
  (NULL,'critical_suppliers_without_assessment','Terceros criticos sin evaluacion','Proveedores criticos sin evaluacion vigente.','Conteo de proveedores criticos sin assessment vigente.', 'supplier','count','lower_is_better','count','monthly','published','{"domain":"proveedores"}'),
  (NULL,'overdue_supplier_assessments','Evaluaciones vencidas','Evaluaciones de proveedor vencidas.','Conteo de evaluaciones vencidas.', 'supplier','count','lower_is_better','count','weekly','published','{"domain":"proveedores"}'),
  (NULL,'high_risk_suppliers','Proveedores con riesgo alto','Proveedores con riesgo alto o critico.','Conteo de proveedores con riesgo alto/critico.', 'supplier','count','lower_is_better','count','monthly','published','{"domain":"proveedores"}'),
  (NULL,'data_trust_score','Data Trust Score','Confianza determinista de dato o medicion.','Score ponderado completeness accuracy consistency freshness lineage validation stability coverage.', 'data_quality','score','higher_is_better','latest','on_demand','published','{"domain":"datos"}'),
  (NULL,'data_quality_score','Calidad de datos','Calidad promedio de datos evaluados.','Promedio de data_quality_assessments.score.', 'data_quality','score','higher_is_better','average','monthly','published','{"domain":"datos"}'),
  (NULL,'freshness_status_count','Freshness','Conteo de datos por freshness.','Agrupacion de freshness_status en mediciones y fuentes.', 'data_quality','count','informational','count','daily','published','{"domain":"datos"}'),
  (NULL,'unavailable_sources','Fuentes indisponibles','Fuentes de datos indisponibles.','Conteo de data_sources status unavailable.', 'data_quality','count','lower_is_better','count','daily','published','{"domain":"datos"}'),
  (NULL,'rejected_measurements','Mediciones rechazadas','Mediciones rechazadas por validacion.','Conteo de metric_measurements validation/quality rejected.', 'data_quality','count','lower_is_better','count','daily','published','{"domain":"datos"}')
ON CONFLICT (metric_code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    business_definition = EXCLUDED.business_definition,
    technical_definition = EXCLUDED.technical_definition,
    metric_type = EXCLUDED.metric_type,
    unit = EXCLUDED.unit,
    direction = EXCLUDED.direction,
    aggregation = EXCLUDED.aggregation,
    frequency = EXCLUDED.frequency,
    status = EXCLUDED.status,
    updated_at = now(),
    metadata = metric_definitions.metadata || EXCLUDED.metadata;

INSERT INTO metric_formula_versions (metric_definition_id, version_number, expression, inputs, status, effective_from, metadata)
SELECT id, 1,
       jsonb_build_object('op','unmeasured','reason','Sin fuente tenant configurada. No se inventan valores.'),
       '[]'::jsonb,
       'published',
       now(),
       '{"seed":"phase5_initial_catalog"}'::jsonb
FROM metric_definitions
WHERE tenant_id IS NULL
ON CONFLICT (metric_definition_id, version_number) DO NOTHING;

COMMIT;
