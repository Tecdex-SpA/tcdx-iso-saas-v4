'use strict';

const { FORMULA_MAP } = require('./formulaRegistry.service');
const { getSourceCodeForFormula } = require('./sourceContracts.service');
const { HEALTH_DEFINITIONS } = require('./grcHealthCalculation.service');
const { unmeasured, round } = require('./officialCalculation.service');

const RESULT_DEFINITIONS = Object.freeze([
  ['compliance.weighted', 'Cumplimiento ponderado', 'compliance', 'requirement_assessment', 'compliance', 'F5_5_COMPLIANCE_WEIGHTED', 'weighted_average', ['standard', 'clause', 'domain', 'process', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['compliance.coverage', 'Cobertura de cumplimiento', 'compliance', 'requirement_assessment', 'coverage', 'F5_5_COVERAGE', 'ratio', ['standard', 'domain', 'process', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['readiness.iso', 'Readiness ISO', 'readiness', 'readiness_snapshot', 'readiness', 'F5_5_READINESS', 'weighted_score', ['standard', 'process', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['risk.inherent', 'Riesgo inherente', 'risk', 'risk', 'risk-inherent', 'F5_5_INHERENT_RISK', 'formula', ['risk', 'process', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['risk.residual', 'Riesgo residual', 'risk', 'risk', 'risk-residual', 'F5_5_RESIDUAL_RISK', 'formula', ['risk', 'process', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['risk.expected_loss', 'Pérdida esperada de riesgo', 'risk', 'risk', 'risk-expected-loss', 'F5_5_EXPECTED_LOSS', 'formula', ['risk', 'process', 'supplier'], ['month', 'quarter', 'year', 'custom']],
  ['control.effectiveness', 'Efectividad de control', 'control', 'control', 'control-effectiveness', 'F5_5_CONTROL_EFFECTIVENESS', 'weighted_score', ['control', 'risk', 'process'], ['month', 'quarter', 'year', 'custom']],
  ['control.combined_effectiveness', 'Efectividad combinada', 'control', 'control_set', 'control-combined', 'F5_5_COMBINED_EFFECTIVENESS', 'complement_product', ['risk', 'process'], ['month', 'quarter', 'year', 'custom']],
  ['actions.progress', 'Avance ponderado de acciones', 'actions', 'action', 'actions-progress', 'F5_5_WEIGHTED_PROGRESS', 'weighted_average', ['owner', 'severity', 'status'], ['month', 'quarter', 'year', 'custom']],
  ['actions.closure_rate', 'Tasa de cierre de acciones', 'actions', 'action', 'actions-closure', 'F5_5_CLOSURE_RATE', 'ratio', ['owner', 'severity', 'status'], ['month', 'quarter', 'year', 'custom']],
  ['actions.overdue_rate', 'Índice de atraso', 'actions', 'action', 'actions-overdue', 'F5_5_OVERDUE_RATE', 'ratio', ['owner', 'severity', 'status'], ['month', 'quarter', 'year', 'custom']],
  ['health.grc', 'GRC Health', 'health', 'health_score', 'health-grc', 'F5_5_GRC_HEALTH', 'health_score', ['component'], ['month', 'quarter', 'year', 'custom']],
  ['health.iso', 'ISO Health', 'health', 'health_score', 'health-iso', 'F5_5_GRC_HEALTH', 'health_score', ['component'], ['month', 'quarter', 'year', 'custom']],
  ['operational_excellence.health', 'Operational Excellence Health', 'health', 'health_score', 'operational-excellence', 'F5_5_GRC_HEALTH', 'health_score', ['component'], ['month', 'quarter', 'year', 'custom']],
  ['survey.score', 'Score de encuesta', 'survey', 'survey_response', 'survey-score', 'F5_5_SURVEY_SCORE', 'weighted_score', ['campaign', 'dimension', 'section'], ['campaign', 'month', 'quarter', 'year', 'custom']],
  ['survey.response_rate', 'Tasa de respuesta', 'survey', 'assessment_campaign', 'survey-response-rate', 'F5_5_RESPONSE_RATE', 'ratio', ['campaign', 'population'], ['campaign', 'month', 'quarter', 'year', 'custom']],
  ['survey.dropout_rate', 'Tasa de abandono', 'survey', 'assessment_campaign', 'survey-dropout-rate', 'F5_5_DROPOUT_RATE', 'ratio', ['campaign', 'population'], ['campaign', 'month', 'quarter', 'year', 'custom']],
  ['survey.cronbach', 'Alfa de Cronbach', 'survey', 'survey_dimension', 'survey-cronbach', 'F5_5_CRONBACH_ALPHA', 'statistical', ['campaign', 'dimension'], ['campaign', 'month', 'quarter', 'year', 'custom']],
  ['assurance.score', 'Assurance Score', 'assurance', 'assurance_execution', 'assurance-score', 'F5_5_ASSURANCE_SCORE', 'weighted_score', ['test', 'control', 'risk', 'process'], ['month', 'quarter', 'year', 'custom']],
  ['assurance.sample_size', 'Tamaño de muestra', 'assurance', 'assurance_population', 'assurance-sample-size', 'F5_5_SAMPLE_SIZE', 'statistical', ['test', 'population'], ['on_demand', 'custom']],
  ['loss.net', 'Pérdida neta', 'loss', 'loss_event', 'loss-net', 'F5_5_NET_LOSS', 'formula', ['currency', 'process', 'risk', 'supplier'], ['month', 'quarter', 'year', 'custom']],
  ['loss.expected', 'Pérdida esperada', 'loss', 'loss_event', 'loss-expected', 'F5_5_EXPECTED_LOSS', 'formula', ['currency', 'process', 'risk', 'supplier'], ['month', 'quarter', 'year', 'custom']],
  ['loss.severity', 'Severidad de pérdidas', 'loss', 'loss_event', 'loss-severity', 'F5_5_LOSS_SEVERITY', 'statistical', ['currency', 'process', 'risk', 'supplier'], ['month', 'quarter', 'year', 'custom']],
  ['loss.var', 'VaR de pérdidas', 'loss', 'loss_distribution', 'loss-var', 'F5_5_PARAMETRIC_VAR', 'statistical', ['currency', 'process', 'risk'], ['month', 'quarter', 'year', 'custom']],
  ['loss.monte_carlo', 'Monte Carlo de pérdidas', 'loss', 'loss_distribution', 'loss-monte-carlo', 'F5_5_MONTE_CARLO', 'simulation', ['currency', 'process', 'risk'], ['on_demand', 'custom']],
  ['continuity.availability', 'Disponibilidad', 'continuity', 'continuity_test', 'continuity-availability', 'F5_5_AVAILABILITY', 'ratio', ['service', 'process'], ['month', 'quarter', 'year', 'custom']],
  ['continuity.mtbf', 'MTBF', 'continuity', 'continuity_incident', 'continuity-mtbf', 'F5_5_MTBF', 'statistical', ['service', 'process'], ['month', 'quarter', 'year', 'custom']],
  ['continuity.mttr', 'MTTR', 'continuity', 'continuity_incident', 'continuity-mttr', 'F5_5_MTTR', 'statistical', ['service', 'process'], ['month', 'quarter', 'year', 'custom']],
  ['continuity.sla', 'Cumplimiento SLA', 'continuity', 'continuity_case', 'continuity-sla', 'F5_5_SLA_COMPLIANCE', 'ratio', ['service', 'process'], ['month', 'quarter', 'year', 'custom']],
  ['continuity.rto_gap', 'Brecha RTO', 'continuity', 'continuity_test', 'continuity-rto-gap', 'F5_5_RTO_GAP', 'formula', ['service', 'process'], ['test', 'month', 'quarter', 'year', 'custom']],
  ['continuity.rpo_gap', 'Brecha RPO', 'continuity', 'continuity_test', 'continuity-rpo-gap', 'F5_5_RPO_GAP', 'formula', ['service', 'process'], ['test', 'month', 'quarter', 'year', 'custom']],
  ['asset.criticality', 'Criticidad de activos', 'asset', 'asset', 'asset-criticality', 'F5_5_ASSET_CRITICALITY', 'weighted_score', ['asset', 'process', 'supplier'], ['month', 'quarter', 'year', 'custom']],
  ['supplier.risk', 'Riesgo de proveedor', 'supplier', 'supplier', 'supplier-risk', 'F5_5_SUPPLIER_RISK', 'weighted_score', ['supplier', 'criticality'], ['month', 'quarter', 'year', 'custom']],
  ['data.completeness', 'Completitud de datos', 'data_quality', 'data_element', 'data-completeness', 'F5_5_COMPLETENESS', 'ratio', ['domain', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['data.accuracy', 'Exactitud de datos', 'data_quality', 'data_element', 'data-accuracy', 'F5_5_ACCURACY', 'ratio', ['domain', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['data.consistency', 'Consistencia de datos', 'data_quality', 'data_element', 'data-consistency', 'F5_5_CONSISTENCY', 'ratio', ['domain', 'owner'], ['month', 'quarter', 'year', 'custom']],
  ['data.freshness', 'Freshness continuo', 'data_quality', 'data_element', 'data-freshness', 'F5_5_FRESHNESS_CONTINUOUS', 'decay', ['domain', 'owner'], ['hour', 'day', 'month', 'custom']],
  ['data.lineage_score', 'Lineage Score', 'data_quality', 'data_lineage', 'data-lineage-score', 'F5_5_LINEAGE_SCORE', 'ratio', ['domain', 'owner'], ['month', 'quarter', 'year', 'custom']],
]);

const BY_RESULT_CODE = new Map(RESULT_DEFINITIONS.map((row) => [row[0], row]));
const BY_METRIC_KEY = new Map(RESULT_DEFINITIONS.map((row) => [row[4], row]));

function formulaMeta(formulaCode) {
  const formula = FORMULA_MAP.get(formulaCode);
  return {
    code: formulaCode,
    version: formula?.version || 1,
    unit: formula?.units?.output || null,
    precision: formula?.precision ?? 2,
    rounding_policy: formula?.rounding_policy || 'formula_default',
  };
}

function definitionFromRow(row) {
  const [analytical_result_code, display_name, domain, entity_type, metric_key, formula_code, aggregation, dimensions, supported_periods] = row;
  const formula = formulaMeta(formula_code);
  return {
    analytical_result_code,
    result_code: analytical_result_code,
    display_name,
    domain,
    entity_type,
    metric_key,
    formula_code,
    formula_version: formula.version,
    unit: formula.unit,
    precision: formula.precision,
    rounding_policy: formula.rounding_policy,
    aggregation,
    dimensions,
    supported_periods,
    available_filters: ['period', 'tenant_id', ...dimensions],
    tenant_scope: 'tenant_scoped',
    source_code: getSourceCodeForFormula(formula_code),
    source_status: 'requires_latest_calculation',
    latest_calculation_run: null,
    latest_snapshot: null,
    trust_status: 'unknown',
    publication_status: 'published',
  };
}

function listAnalyticalResults() {
  return RESULT_DEFINITIONS.map(definitionFromRow);
}

function getAnalyticalResultDefinition(codeOrMetricKey) {
  const key = String(codeOrMetricKey || '').trim();
  const row = BY_RESULT_CODE.get(key) || BY_METRIC_KEY.get(key);
  if (!row) {
    const error = new Error('Resultado analítico oficial no registrado.');
    error.code = 'ANALYTICAL_RESULT_NOT_FOUND';
    error.status = 404;
    error.details = { result_code: key };
    throw error;
  }
  return definitionFromRow(row);
}

function valueFromOutput(outputValue) {
  if (outputValue && typeof outputValue === 'object' && Object.prototype.hasOwnProperty.call(outputValue, 'value')) return outputValue.value;
  return outputValue ?? null;
}

function buildOfficialConsumptionPayload(definition, latest = null, { period = {}, comparison = null, trend = null, warnings = [] } = {}) {
  if (!latest?.run_id) {
    const missing = unmeasured(definition.formula_code, 'No existe calculation_run oficial publicado para este resultado analítico.', {
      unit: definition.unit,
      period,
      source: { status: 'source_unavailable', warnings, lineage: [] },
    });
    return {
      result_code: definition.analytical_result_code,
      value: null,
      unit: definition.unit,
      period,
      comparison: comparison || {},
      trend: trend || {},
      formula: { code: definition.formula_code, version: definition.formula_version },
      coverage: null,
      trust: { score: null, status: 'unknown' },
      source_status: missing.source_status,
      warnings: missing.warnings,
      calculation_run_id: null,
      snapshot_id: null,
      explanation_url: null,
      lineage_url: null,
      analytical_definition: definition,
    };
  }
  const value = valueFromOutput(latest.output_value);
  const metadata = latest.run_metadata || {};
  const outputMetadata = latest.output_metadata || {};
  const trustScore = metadata.trust_score ?? outputMetadata.trust_score ?? null;
  const trustStatus = metadata.trust_status || outputMetadata.trust_status || 'unknown';
  return {
    result_code: definition.analytical_result_code,
    value: typeof value === 'number' ? round(value, definition.precision) : value,
    unit: latest.unit || definition.unit,
    period: {
      start: latest.period_start || period.start || null,
      end: latest.period_end || period.end || null,
      timezone: latest.timezone || period.timezone || 'UTC',
    },
    comparison: comparison || {},
    trend: trend || {},
    formula: { code: definition.formula_code, version: definition.formula_version },
    coverage: metadata.coverage ?? outputMetadata.coverage ?? null,
    trust: { score: trustScore, status: trustStatus },
    source_status: metadata.source_status || outputMetadata.source_status || 'available',
    warnings: [...(metadata.warnings || []), ...(outputMetadata.warnings || []), ...warnings],
    calculation_run_id: latest.run_id,
    snapshot_id: latest.snapshot_id || null,
    explanation_url: `/api/grc/official/calculations/${latest.run_id}/explanation`,
    lineage_url: `/api/grc/official/calculations/${latest.run_id}/lineage`,
    analytical_definition: definition,
  };
}

function buildHealthCatalog() {
  return Object.entries(HEALTH_DEFINITIONS).map(([score_code, definition]) => ({
    score_code,
    formula_code: definition.formula_code,
    formula_version: definition.version,
    components: definition.components,
    weights: definition.weights,
    publication_status: 'published',
  }));
}

module.exports = {
  listAnalyticalResults,
  getAnalyticalResultDefinition,
  buildOfficialConsumptionPayload,
  buildHealthCatalog,
};
