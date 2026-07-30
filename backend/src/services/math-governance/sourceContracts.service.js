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
    query: definition.query || null,
    limitations: definition.limitations || null,
  });
  return Object.freeze({ ...normalized, checksum: checksum(normalized) });
}

const SOURCE_CONTRACTS = Object.freeze([
  contract({
    source_code: 'compliance_requirements_assessments', entity: 'compliance', tables: ['grc_framework_requirements', 'grc_requirement_control_mappings', 'control_soa_assessments'],
    columns: ['tenant_id', 'requirement_id', 'control_id', 'status', 'applicability', 'weight', 'assessed_at'],
    joins: ['grc_requirement_control_mappings.requirement_id -> grc_framework_requirements.id', 'control_soa_assessments.control_id -> grc_requirement_control_mappings.control_id'],
    required_fields: ['id', 'tenant_id', 'status'], status_filter: { excluded: ['deleted', 'retired'] }, availability: 'legacy_adapter_required',
    limitations: 'Legacy compliance sources exist under framework and SoA tables; exact status normalization is package-3 work.'
  }),
  contract({ source_code: 'grc_readiness_operational_snapshot', entity: 'readiness', tables: ['grc_readiness_findings', 'grc_evidence_quality_scores', 'data_trust_scores'], columns: ['tenant_id','status','severity','score','created_at'], required_fields: ['id','tenant_id','status'], availability: 'partially_available', limitations: 'Readiness has evidence and finding signals, but final consumer weights are package-3 work.' }),
  contract({ source_code: 'risk_register_controls', entity: 'risk', tables: ['iso_risk_matrix_items', 'iso_risk_matrix_runs', 'grc_quantitative_risk_assessments', 'grc_control_assurance'], columns: ['tenant_id','risk_id','probability','impact','exposure','control_id','effectiveness','status'], required_fields: ['id','tenant_id'], availability: 'legacy_adapter_required', limitations: 'Risk data is split between ISO risk matrix and Phase 3 quantitative risk tables.' }),
  contract({ source_code: 'control_assurance_evidence', entity: 'control', tables: ['tenant_applicable_controls','grc_control_assurance','grc_evidence_links','grc_evidence_quality_scores'], columns: ['tenant_id','control_id','design_score','implementation_score','operation_score','evidence_score','frequency','status'], required_fields: ['id','tenant_id'], availability: 'legacy_adapter_required', limitations: 'Control effectiveness dimensions require package-3 adapter normalization.' }),
  contract({ source_code: 'audit_findings_actions', entity: 'audit', tables: ['grc_readiness_findings','grc_audit_followups','iso_recommended_action_workflow_events'], columns: ['tenant_id','severity','status','opened_at','closed_at','due_at','progress'], required_fields: ['id','tenant_id','status'], availability: 'partially_available', limitations: 'Findings and followups exist; action progress is split across readiness and workflow tables.' }),
  contract({ source_code: 'loss_events_operational', entity: 'loss', tables: ['loss_events','loss_recoveries'], columns: ['tenant_id','event_date','gross_loss_amount','net_loss_amount','currency','recovery_amount','status'], required_fields: ['id','tenant_id','event_date'], unit: 'currency', availability: 'available' }),
  contract({ source_code: 'continuity_resilience_tests', entity: 'continuity', tables: ['grc_bia_assessments','grc_continuity_plans','grc_continuity_tests'], columns: ['tenant_id','rto_hours','rpo_hours','actual_recovery_hours','actual_data_loss_hours','result','tested_at','status'], required_fields: ['id','tenant_id'], unit: 'hours', availability: 'available' }),
  contract({ source_code: 'asset_inventory_security', entity: 'asset', tables: ['data_elements'], columns: ['tenant_id','name','classification','owner_user_id','metadata','status'], required_fields: ['id','tenant_id'], availability: 'available', limitations: 'Package 4 binds asset criticality to data_elements until a dedicated asset inventory table supersedes it.' }),
  contract({ source_code: 'supplier_tprm_assessments', entity: 'supplier', tables: ['grc_suppliers','grc_supplier_assessments','grc_supplier_answers','grc_supplier_contracts'], columns: ['tenant_id','supplier_id','criticality','security_score','dependency_score','resilience_score','privacy_score','status'], required_fields: ['id','tenant_id','status'], availability: 'available' }),
  contract({ source_code: 'survey_response_scoring', entity: 'survey', tables: ['survey_definitions','survey_versions','survey_questions','assessment_campaigns','assessment_recipients','survey_responses','survey_response_items'], columns: ['tenant_id','response_id','question_id','score','max_score','weight','status','submitted_at'], required_fields: ['id','tenant_id','status'], availability: 'available' }),
  contract({ source_code: 'assurance_test_results', entity: 'assurance', tables: ['assurance_test_definitions','assurance_test_executions','assurance_test_samples','assurance_test_results','assurance_test_exceptions'], columns: ['tenant_id','execution_id','sample_id','result','weight','exception_count','status','executed_at'], required_fields: ['id','tenant_id','result'], availability: 'available' }),
  contract({ source_code: 'data_quality_observations', entity: 'data_quality', tables: ['data_quality_rules','data_quality_assessments','metric_validations'], columns: ['tenant_id','rule_type','expected_count','valid_count','invalid_count','coverage','assessed_at'], required_fields: ['id','tenant_id'], availability: 'available' }),
  contract({ source_code: 'data_lineage_observations', entity: 'data_lineage', tables: ['data_lineage_edges','data_sources','data_elements'], columns: ['tenant_id','source_entity_type','source_entity_id','target_entity_type','target_entity_id','relation_type','created_at'], required_fields: ['id','tenant_id','relation_type'], availability: 'available' }),
  contract({ source_code: 'statistical_metric_measurements', entity: 'statistics', tables: ['metric_measurements','metric_definitions','metric_dimensions'], columns: ['tenant_id','metric_id','numeric_value','measured_at','unit','dimension_values','status'], required_fields: ['id','tenant_id','numeric_value'], cardinality: 'time_series', availability: 'available' }),
  contract({ source_code: 'grc_health_components', entity: 'health', tables: ['calculation_runs','calculation_outputs','data_trust_scores','metric_measurements'], columns: ['tenant_id','formula_code','output_value','trust_score','measured_at','status'], required_fields: ['id','tenant_id'], availability: 'partially_available', limitations: 'Health score combines official calculation outputs after package-3 consumer migration.' }),
  contract({ source_code: 'maturity_assessments', entity: 'maturity', tables: ['grc_readiness_findings','survey_evaluations','metric_measurements'], columns: ['tenant_id','level','weight','evaluated_at','status'], required_fields: ['id','tenant_id'], availability: 'legacy_adapter_required', limitations: 'Maturity data exists as signals but not as one canonical operational table yet.' }),
  contract({ source_code: 'external_fx_rates', entity: 'currency_conversion', tables: ['external_fx_rates'], columns: ['base_currency','quote_currency','rate','effective_at','source'], required_fields: ['base_currency','quote_currency','rate'], availability: 'source_unavailable', limitations: 'No official tenant-safe FX source is configured; loss calculations must not mix currencies.' }),
]);

const SOURCE_CONTRACT_MAP = new Map(SOURCE_CONTRACTS.map((item) => [item.source_code, item]));

function getSourceCodeForFormula(formulaCode) {
  return FORMULA_SOURCE_MAP[formulaCode] || 'source_unavailable';
}

function listSourceContracts() {
  return SOURCE_CONTRACTS.map((item) => ({ ...item }));
}

function getSourceContract(sourceCode) {
  const contractDefinition = SOURCE_CONTRACT_MAP.get(sourceCode);
  if (!contractDefinition) return null;
  return { ...contractDefinition };
}

function listFormulaSourceBindings() {
  return Object.entries(FORMULA_SOURCE_MAP).map(([formula_code, source_code]) => ({ formula_code, source_code, contract: getSourceContract(source_code) }));
}

module.exports = { AVAILABILITY, FORMULA_SOURCE_MAP, SOURCE_CONTRACTS, getSourceCodeForFormula, getSourceContract, listSourceContracts, listFormulaSourceBindings };
