'use strict';

const crypto = require('crypto');

const AVAILABILITY = new Set(['available', 'partially_available', 'source_unavailable', 'legacy_adapter_required']);
const SOURCE_STATUSES = new Set(['draft', 'reviewed', 'approved', 'published', 'retired']);

const FORMULA_SOURCE_MAP = Object.freeze({
  F5_5_COMPLIANCE_WEIGHTED: 'compliance_requirements_assessments',
  F5_5_COVERAGE: 'compliance_requirements_assessments',
  F5_5_READINESS: 'grc_readiness_operational_snapshot',
  F5_5_INHERENT_RISK: 'risk_register_controls',
  F5_5_RESIDUAL_RISK: 'risk_register_controls',
  F5_5_COMBINED_EFFECTIVENESS: 'control_assurance_evidence',
  F5_5_CONTROL_EFFECTIVENESS: 'control_assurance_evidence',
  F5_5_CONTROL_COVERAGE: 'control_assurance_evidence',
  F5_5_FREQUENCY_COMPLIANCE: 'control_assurance_evidence',
  F5_5_FAILURE_RATE: 'assurance_test_results',
  F5_5_SEVERITY_INDEX: 'audit_findings_actions',
  F5_5_CLOSURE_RATE: 'audit_findings_actions',
  F5_5_MTTC: 'audit_findings_actions',
  F5_5_AGE: 'audit_findings_actions',
  F5_5_WEIGHTED_PROGRESS: 'audit_findings_actions',
  F5_5_OVERDUE_RATE: 'audit_findings_actions',
  F5_5_EXPECTED_LOSS: 'loss_events_operational',
  F5_5_NET_LOSS: 'loss_events_operational',
  F5_5_LOSS_SEVERITY: 'loss_events_operational',
  F5_5_PARAMETRIC_VAR: 'loss_events_operational',
  F5_5_MONTE_CARLO: 'loss_events_operational',
  F5_5_FMEA_RPN: 'risk_register_controls',
  F5_5_AVAILABILITY: 'continuity_resilience_tests',
  F5_5_MTBF: 'continuity_resilience_tests',
  F5_5_MTTR: 'continuity_resilience_tests',
  F5_5_SLA_COMPLIANCE: 'continuity_resilience_tests',
  F5_5_RTO_GAP: 'continuity_resilience_tests',
  F5_5_RPO_GAP: 'continuity_resilience_tests',
  F5_5_ASSET_CRITICALITY: 'asset_inventory_security',
  F5_5_SUPPLIER_RISK: 'supplier_tprm_assessments',
  F5_5_SURVEY_SCORE: 'survey_response_scoring',
  F5_5_CRONBACH_ALPHA: 'survey_response_scoring',
  F5_5_RESPONSE_RATE: 'survey_response_scoring',
  F5_5_DROPOUT_RATE: 'survey_response_scoring',
  F5_5_ASSURANCE_SCORE: 'assurance_test_results',
  F5_5_SAMPLE_SIZE: 'statistical_metric_measurements',
  F5_5_COMPLETENESS: 'data_quality_observations',
  F5_5_ACCURACY: 'data_quality_observations',
  F5_5_CONSISTENCY: 'data_quality_observations',
  F5_5_FRESHNESS_CONTINUOUS: 'data_quality_observations',
  F5_5_LINEAGE_SCORE: 'data_lineage_observations',
  F5_5_Z_SCORE: 'statistical_metric_measurements',
  F5_5_ROBUST_Z_SCORE: 'statistical_metric_measurements',
  F5_5_LINEAR_TREND: 'statistical_metric_measurements',
  F5_5_PERCENT_VARIATION: 'statistical_metric_measurements',
  F5_5_MOVING_AVERAGE: 'statistical_metric_measurements',
  F5_5_EMA: 'statistical_metric_measurements',
  F5_5_CONFIDENCE_INTERVAL: 'statistical_metric_measurements',
  F5_5_GRC_HEALTH: 'grc_health_components',
  F5_5_MATURITY: 'maturity_assessments',
  F5_C3_DATA_TRUST: 'indicator_data_trust_assessments',
  F5_C3_OPERATIONAL_PERFORMANCE: 'grc_health_components',
  F5_C3_SUPPLIER_HEALTH: 'supplier_tprm_assessments',
});

function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex');
}

function contract(definition) {
  if (!AVAILABILITY.has(definition.availability)) throw new Error(`Invalid source availability: ${definition.source_code}`);
  if (!SOURCE_STATUSES.has(definition.status || 'published')) throw new Error(`Invalid source status: ${definition.source_code}`);
  const normalized = Object.freeze({
    source_code: definition.source_code,
    entity: definition.entity,
    tables: Object.freeze(definition.tables || []),
    columns: Object.freeze(definition.columns || []),
    joins: Object.freeze(definition.joins || []),
    tenant_filter: Object.freeze(definition.tenant_filter || { column: 'tenant_id', required: true }),
    status_filter: Object.freeze(definition.status_filter || {}),
    period: Object.freeze(definition.period || { column: 'created_at', mode: 'optional_range' }),
    timezone: definition.timezone || 'tenant_timezone',
    unit: definition.unit || null,
    cardinality: definition.cardinality || 'one_to_many',
    required_fields: Object.freeze(definition.required_fields || ['id', 'tenant_id']),
    exclusions: Object.freeze(definition.exclusions || []),
    null_policy: definition.null_policy || 'exclude_invalid_rows',
    availability: definition.availability,
    version: definition.version || 1,
    status: definition.status || 'published',
    adapter: definition.adapter || definition.source_code,
    variable_map: Object.freeze(definition.variable_map || {}),
    query: definition.query || null,
    limitations: definition.limitations || null,
  });
  return Object.freeze({ ...normalized, checksum: checksum(normalized) });
}

const SOURCE_CONTRACTS = Object.freeze([
  contract({
    source_code: 'compliance_requirements_assessments', entity: 'compliance',
    tables: ['grc_framework_requirements', 'grc_requirement_control_mappings', 'grc_control_assurance'],
    columns: ['tenant_id', 'requirement_id', 'tenant_control_id', 'mapping_type', 'coverage_level', 'status', 'score', 'created_at', 'updated_at'],
    joins: ['grc_requirement_control_mappings.requirement_id -> grc_framework_requirements.id', 'grc_control_assurance.tenant_control_id -> grc_requirement_control_mappings.tenant_control_id'],
    required_fields: ['id', 'tenant_id', 'status'], status_filter: { excluded: ['deleted', 'retired', 'rejected'] },
    variable_map: { assessments: 'rows[{status,weight,applicability}]', evaluated: 'count(status not pending)', applicable: 'count(applicability=true)' },
    availability: 'available', version: 2,
    limitations: 'El adaptador normaliza mappings publicados/revisados y assurance de control; requisitos sin mapping permanecen pendientes y no se convierten en cero.'
  }),
  contract({
    source_code: 'grc_readiness_operational_snapshot', entity: 'readiness',
    tables: ['grc_readiness_snapshots', 'grc_readiness_results', 'grc_readiness_findings'],
    columns: ['tenant_id','snapshot_id','dimension','score','weight','source_as_of','severity'], required_fields: ['id','tenant_id','score'],
    variable_map: { compliance: 'dimension=compliance', evidence: 'dimension=evidence', health: 'dimension=health', actions: 'dimension=actions' },
    availability: 'available', version: 2,
    limitations: 'Usa el snapshot más reciente del período; dimensiones ausentes producen unmeasured en vez de imputación.'
  }),
  contract({
    source_code: 'risk_register_controls', entity: 'risk',
    tables: ['iso_risk_matrix_items', 'iso_risk_matrix_runs', 'grc_quantitative_risk_assessments', 'grc_control_assurance'],
    columns: ['tenant_id','risk_id','probability','impact','exposure','severity','occurrence','detection','tenant_control_id','score','status'], required_fields: ['id','tenant_id'],
    variable_map: { probability: 'probability', impact: 'impact', inherentRisk: 'exposure|probability*impact', controlEffectiveness: 'assurance_score/100', severity: 'severity', occurrence: 'occurrence', detection: 'detection' },
    availability: 'available', version: 2,
    limitations: 'Resuelve primero evaluaciones cuantitativas y usa la matriz ISO como fallback; no cruza tenants ni inventa escalas ausentes.'
  }),
  contract({
    source_code: 'control_assurance_evidence', entity: 'control',
    tables: ['grc_control_assurance', 'grc_evidence_links', 'grc_evidence_quality_scores'],
    columns: ['tenant_id','tenant_control_id','score','assurance_status','calculated_at','evidence_score'], required_fields: ['id','tenant_id','score'],
    variable_map: { design: 'dimension.design|score/100', implementation: 'dimension.implementation|score/100', operation: 'dimension.operation|score/100', evidence: 'evidence_score|score/100', effectivenesses: 'rows.score/100' },
    availability: 'available', version: 2,
    limitations: 'Cuando no hay dimensiones separadas se usa el score oficial de assurance como medida compuesta declarada, conservando warning metodológico.'
  }),
  contract({
    source_code: 'audit_findings_actions', entity: 'audit',
    tables: ['grc_readiness_findings', 'action_plans', 'grc_effectiveness_verifications'],
    columns: ['tenant_id','severity','status','created_at','opened_at','closed_at','due_at','progress','weight'], required_fields: ['id','tenant_id','status'],
    variable_map: { low: 'count(severity=low)', medium: 'count(severity=medium)', high: 'count(severity=high)', critical: 'count(severity=critical)', items: 'rows[{createdAt,openedAt,closedAt,progress,weight,overdue}]' },
    availability: 'available', version: 2,
    limitations: 'Unifica hallazgos de readiness y planes de acción; campos ausentes se excluyen y se registran en warnings.'
  }),
  contract({ source_code: 'loss_events_operational', entity: 'loss', tables: ['loss_events','loss_recoveries'], columns: ['tenant_id','event_date','gross_loss_amount','net_loss_amount','currency','recovery_amount','status'], required_fields: ['id','tenant_id','event_date'], unit: 'currency', availability: 'available' }),
  contract({ source_code: 'continuity_resilience_tests', entity: 'continuity', tables: ['grc_bia_assessments','grc_continuity_plans','grc_continuity_tests'], columns: ['tenant_id','rto_hours','rpo_hours','actual_recovery_hours','actual_data_loss_hours','result','tested_at','status'], required_fields: ['id','tenant_id'], unit: 'hours', availability: 'available' }),
  contract({ source_code: 'asset_inventory_security', entity: 'asset', tables: ['data_elements'], columns: ['tenant_id','name','classification','owner_user_id','metadata','status'], required_fields: ['id','tenant_id'], availability: 'available', limitations: 'Package 4 binds asset criticality to data_elements until a dedicated asset inventory table supersedes it.' }),
  contract({ source_code: 'supplier_tprm_assessments', entity: 'supplier', tables: ['grc_suppliers','grc_supplier_assessments','grc_supplier_answers','grc_supplier_contracts'], columns: ['tenant_id','supplier_id','criticality','security_score','dependency_score','resilience_score','privacy_score','status'], required_fields: ['id','tenant_id','status'], availability: 'available' }),
  contract({ source_code: 'survey_response_scoring', entity: 'survey', tables: ['survey_definitions','survey_versions','survey_questions','assessment_campaigns','assessment_recipients','survey_responses','survey_response_items'], columns: ['tenant_id','response_id','question_id','score','max_score','weight','status','submitted_at'], required_fields: ['id','tenant_id','status'], availability: 'available' }),
  contract({ source_code: 'assurance_test_results', entity: 'assurance', tables: ['assurance_test_definitions','assurance_test_executions','assurance_test_samples','assurance_test_results','assurance_test_exceptions'], columns: ['tenant_id','execution_id','sample_id','result','weight','exception_count','status','executed_at'], required_fields: ['id','tenant_id','result'], availability: 'available' }),
  contract({ source_code: 'data_quality_observations', entity: 'data_quality', tables: ['data_quality_rules','data_quality_assessments','metric_validations'], columns: ['tenant_id','rule_type','expected_count','valid_count','invalid_count','coverage','assessed_at'], required_fields: ['id','tenant_id'], availability: 'available' }),
  contract({ source_code: 'data_lineage_observations', entity: 'data_lineage', tables: ['data_lineage_edges','data_sources','data_elements'], columns: ['tenant_id','source_entity_type','source_entity_id','target_entity_type','target_entity_id','relation_type','created_at'], required_fields: ['id','tenant_id','relation_type'], availability: 'available' }),
  contract({ source_code: 'statistical_metric_measurements', entity: 'statistics', tables: ['metric_measurements','metric_definitions','metric_dimensions'], columns: ['tenant_id','metric_id','numeric_value','measured_at','unit','dimension_values','status'], required_fields: ['id','tenant_id','numeric_value'], cardinality: 'time_series', availability: 'available' }),
  contract({
    source_code: 'indicator_data_trust_assessments', entity: 'data_trust',
    tables: ['metric_trust_assessments'], columns: ['tenant_id','dimensions','trust_status','assessed_at','assessment_checksum'],
    required_fields: ['id','tenant_id','dimensions'],
    variable_map: { completeness:'dimensions.completeness.score',accuracy:'dimensions.accuracy.score',consistency:'dimensions.consistency.score',freshness:'dimensions.freshness.score',lineage:'dimensions.lineage.score',validation:'dimensions.validation.score',stability:'dimensions.stability.score',coverage:'dimensions.coverage.score' },
    availability: 'available', version: 1,
    limitations: 'Compone únicamente las ocho dimensiones persistidas; una dimensión desconocida impide calcular y nunca se renormaliza.'
  }),
  contract({
    source_code: 'grc_health_components', entity: 'health',
    tables: ['calculation_runs','calculation_outputs','data_trust_scores'],
    columns: ['tenant_id','formula_code','output_value','trust_score','period_start','period_end','run_status'], required_fields: ['id','tenant_id','formula_code'],
    variable_map: { risk: 'latest risk output', compliance: 'latest compliance output', actions: 'latest actions output', evidence: 'latest evidence/trust output', dataTrust: 'latest trust score' },
    availability: 'available', version: 2,
    limitations: 'Solo consume outputs oficiales calculados y aprobados; componentes ausentes dejan Health como unmeasured.'
  }),
  contract({
    source_code: 'maturity_assessments', entity: 'maturity',
    tables: ['survey_evaluations','metric_measurements'],
    columns: ['tenant_id','score','numeric_value','weight','evaluated_at','measured_at','status','metadata'], required_fields: ['id','tenant_id'],
    variable_map: { levels: 'rows[{level|score|numeric_value,weight}]' },
    availability: 'available', version: 2,
    limitations: 'Prioriza evaluaciones publicadas y usa mediciones de madurez como fallback; no infiere niveles sin datos.'
  }),
  contract({ source_code: 'external_fx_rates', entity: 'currency_conversion', tables: ['external_fx_rates'], columns: ['base_currency','quote_currency','rate','effective_at','source'], required_fields: ['base_currency','quote_currency','rate'], availability: 'source_unavailable', limitations: 'No official tenant-safe FX source is configured; loss calculations must not mix currencies.' }),
]);

const SOURCE_CONTRACT_MAP = new Map(SOURCE_CONTRACTS.map((item) => [item.source_code, item]));

function getSourceCodeForFormula(formulaCode) { return FORMULA_SOURCE_MAP[formulaCode] || 'source_unavailable'; }
function listSourceContracts() { return SOURCE_CONTRACTS.map((item) => ({ ...item })); }
function getSourceContract(sourceCode) { const value = SOURCE_CONTRACT_MAP.get(sourceCode); return value ? { ...value } : null; }
function listFormulaSourceBindings() { return Object.entries(FORMULA_SOURCE_MAP).map(([formula_code, source_code]) => ({ formula_code, source_code, contract: getSourceContract(source_code) })); }

module.exports = { AVAILABILITY, FORMULA_SOURCE_MAP, SOURCE_CONTRACTS, getSourceCodeForFormula, getSourceContract, listSourceContracts, listFormulaSourceBindings };
