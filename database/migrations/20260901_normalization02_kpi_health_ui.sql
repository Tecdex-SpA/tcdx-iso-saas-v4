-- TCDX ISO SaaS v4 - NORMALIZATION-02 KPI/Health canonical projection.
-- Forward-only governance records. No tenant data, snapshots, RBAC, commercial plans or historical migrations are mutated.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  formula_definition uuid;
  formula_version uuid;
  metric_definition uuid;
  metric_definition_version uuid;
  source_contract uuid;
  coverage_metadata jsonb := jsonb_build_object(
    'normalization_package','NORMALIZATION-02',
    'global_health_authority','official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings',
    'global_score_formula','F5_5_GRC_HEALTH',
    'global_score_version',2,
    'coverage_policy','available_weight/applicable_weight; publish only when coverage >= minimum_coverage',
    'minimum_coverage',0.80,
    'component_states',jsonb_build_array('AVAILABLE','MISSING','NOT_APPLICABLE','NOT_CONFIGURED','STALE','INVALID','UNKNOWN'),
    'data_trust_accuracy_policy','accuracy remains NOT_CONFIGURED until a real measurable source or canonical binding exists',
    'evidence_coverage_mapping','EVIDENCE-FRESH=freshness; COVERAGE=compliance_coverage; EVIDENCE-COVERAGE=compatibility_alias_only',
    'legacy_kpi_hlt_role','COMPATIBILITY_SOURCE_COMPONENT',
    'historical_snapshots_mutated',false
  );
BEGIN
  INSERT INTO official_formula_definitions (
    tenant_id, formula_code, display_name, category, description, owner, status, metadata
  )
  SELECT
    NULL,
    'F5_5_GRC_HEALTH',
    'Health GRC',
    'health',
    'Canonical governed GRC Health score.',
    'TCDX',
    'published',
    coverage_metadata
  WHERE NOT EXISTS (
    SELECT 1
    FROM official_formula_definitions
    WHERE tenant_id IS NULL
      AND formula_code = 'F5_5_GRC_HEALTH'
  );

  SELECT id INTO formula_definition
  FROM official_formula_definitions
  WHERE tenant_id IS NULL
    AND formula_code = 'F5_5_GRC_HEALTH'
  LIMIT 1;

  INSERT INTO official_formula_versions (
    formula_definition_id, tenant_id, version_number, methodology, expression, units, precision,
    rounding_policy, null_policy, zero_division_policy, minimum_sample_size, applicability,
    limitations, source_contract_code, checksum, status, effective_from, reviewed_by, approved_by, metadata
  )
  SELECT
    formula_definition,
    NULL,
    2,
    'GRC health v2 dynamic denominator with explicit component classification, minimum coverage and confidence reporting',
    'weighted average over AVAILABLE applicable components with coverage threshold',
    jsonb_build_object('output','score'),
    2,
    'half_up',
    'partial_available_components_with_coverage_threshold',
    'return_not_calculable_or_error_by_formula',
    1,
    'tenant_or_global_dataset',
    'Excludes only NOT_APPLICABLE from applicable weight; MISSING, NOT_CONFIGURED, INVALID, STALE and UNKNOWN reduce coverage and confidence.',
    'grc_health_components',
    encode(digest('NORMALIZATION-02:F5_5_GRC_HEALTH:v2:partial_available_components_with_coverage_threshold:minimum_coverage=0.80','sha256'),'hex'),
    'published',
    now(),
    'TCDX',
    'TCDX',
    coverage_metadata
  WHERE formula_definition IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM official_formula_versions
      WHERE formula_definition_id = formula_definition
        AND version_number = 2
    )
  RETURNING id INTO formula_version;

  IF formula_version IS NULL THEN
    SELECT id INTO formula_version
    FROM official_formula_versions
    WHERE formula_definition_id = formula_definition
      AND version_number = 2
    LIMIT 1;
  END IF;

  INSERT INTO official_formula_variables (
    formula_version_id, variable_name, data_type, unit, required, validation_rules, display_order, metadata
  )
  SELECT formula_version, item.variable_name, 'number', 'declared_input_unit', false,
         jsonb_build_object('component_state_required',true), item.display_order, coverage_metadata
  FROM (VALUES
    ('risk',1),
    ('compliance',2),
    ('actions',3),
    ('evidence',4),
    ('dataTrust',5),
    ('minimum_coverage',6)
  ) AS item(variable_name, display_order)
  WHERE formula_version IS NOT NULL
  ON CONFLICT (formula_version_id, variable_name) DO NOTHING;

  INSERT INTO official_formula_dependencies (
    formula_version_id, depends_on_formula_code, dependency_type, required, metadata
  )
  SELECT formula_version, item.formula_code, 'component', false, coverage_metadata
  FROM (VALUES
    ('F5_5_RESIDUAL_RISK'),
    ('F5_5_COMPLIANCE_WEIGHTED'),
    ('F5_5_WEIGHTED_PROGRESS'),
    ('F5_5_FRESHNESS_CONTINUOUS'),
    ('F5_C3_DATA_TRUST')
  ) AS item(formula_code)
  WHERE formula_version IS NOT NULL
  ON CONFLICT (formula_version_id, depends_on_formula_code, dependency_type) DO NOTHING;

  SELECT id INTO metric_definition
  FROM metric_definitions
  WHERE tenant_id IS NULL
    AND metric_code = 'GRC-HEALTH'
  LIMIT 1;

  INSERT INTO metric_definition_versions (
    tenant_id, metric_definition_id, version_number, functional_code, display_name, business_definition,
    domain, objective, unit, favorable_direction, frequency, population_definition,
    numerator_definition, denominator_definition, methodology, semantic_contract_code,
    status, effective_from, checksum, reviewed_by, published_by, reviewed_at, published_at, metadata
  )
  SELECT
    latest.tenant_id,
    latest.metric_definition_id,
    2,
    latest.functional_code,
    latest.display_name,
    latest.business_definition,
    latest.domain,
    latest.objective,
    latest.unit,
    latest.favorable_direction,
    latest.frequency,
    latest.population_definition,
    latest.numerator_definition,
    latest.denominator_definition,
    'GRC Health v2 uses available official components with explicit coverage/confidence; insufficient coverage is not published as executive score.',
    latest.semantic_contract_code,
    'published',
    now(),
    encode(digest('NORMALIZATION-02:metric_definition:GRC-HEALTH:v2:coverage_policy=0.80','sha256'),'hex'),
    latest.reviewed_by,
    latest.published_by,
    now(),
    now(),
    COALESCE(latest.metadata,'{}'::jsonb) || coverage_metadata
  FROM LATERAL (
    SELECT *
    FROM metric_definition_versions
    WHERE metric_definition_id = metric_definition
      AND status = 'published'
    ORDER BY version_number DESC
    LIMIT 1
  ) latest
  WHERE metric_definition IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM metric_definition_versions
      WHERE metric_definition_id = metric_definition
        AND version_number = 2
    )
  RETURNING id INTO metric_definition_version;

  IF metric_definition_version IS NULL THEN
    SELECT id INTO metric_definition_version
    FROM metric_definition_versions
    WHERE metric_definition_id = metric_definition
      AND version_number = 2
    LIMIT 1;
  END IF;

  SELECT id INTO source_contract
  FROM official_formula_source_contracts
  WHERE tenant_id IS NULL
    AND formula_code = 'F5_5_GRC_HEALTH'
    AND status = 'published'
  ORDER BY version_number DESC
  LIMIT 1;

  INSERT INTO metric_source_bindings (
    tenant_id, metric_key, formula_code, source_contract_id, binding_status, effective_from,
    metric_definition_id, definition_version_id, official_formula_version_id, version_number,
    methodology_version, unit, checksum, published_at, metadata
  )
  SELECT
    NULL,
    'GRC-HEALTH',
    'F5_5_GRC_HEALTH',
    source_contract,
    'published',
    now(),
    metric_definition,
    metric_definition_version,
    formula_version,
    2,
    2,
    'score',
    encode(digest('NORMALIZATION-02:metric_source_binding:GRC-HEALTH:F5_5_GRC_HEALTH:v2','sha256'),'hex'),
    now(),
    coverage_metadata
  WHERE metric_definition IS NOT NULL
    AND formula_version IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM metric_source_bindings
      WHERE tenant_id IS NULL
        AND metric_key = 'GRC-HEALTH'
        AND version_number = 2
    );

  INSERT INTO metric_calculation_policies (
    tenant_id, metric_key, formula_code, calculation_frequency, stale_after, minimum_sample_size,
    failure_policy, status, version_number, timeout_ms, max_attempts, retry_backoff_seconds,
    retention_periods, checksum, published_at, metadata
  )
  SELECT
    NULL,
    'GRC-HEALTH',
    'F5_5_GRC_HEALTH',
    'monthly',
    interval '30 days',
    1,
    'mark_unmeasured',
    'published',
    2,
    30000,
    3,
    30,
    24,
    encode(digest('NORMALIZATION-02:metric_calculation_policy:GRC-HEALTH:v2:minimum_coverage=0.80','sha256'),'hex'),
    now(),
    coverage_metadata
  WHERE NOT EXISTS (
    SELECT 1 FROM metric_calculation_policies
    WHERE tenant_id IS NULL
      AND metric_key = 'GRC-HEALTH'
      AND version_number = 2
  );
END $$;

COMMIT;
