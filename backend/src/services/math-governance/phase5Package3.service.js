'use strict';

const { unmeasured } = require('./officialCalculation.service');

const PACKAGE3_FORMULA_CODES = Object.freeze([
  'F5_5_COMPLIANCE_WEIGHTED',
  'F5_5_CONTROL_EFFECTIVENESS',
  'F5_5_WEIGHTED_PROGRESS',
  'F5_5_READINESS',
  'F5_5_RESIDUAL_RISK',
  'F5_5_GRC_HEALTH',
]);

const OVERVIEW_KEY_BY_FORMULA_CODE = Object.freeze({
  F5_5_COMPLIANCE_WEIGHTED: 'compliance',
  F5_5_CONTROL_EFFECTIVENESS: 'control_effectiveness',
  F5_5_WEIGHTED_PROGRESS: 'actions',
  F5_5_READINESS: 'readiness',
  F5_5_RESIDUAL_RISK: 'risk',
  F5_5_GRC_HEALTH: 'health',
});

const SOURCE_CODE_BY_FORMULA_CODE = Object.freeze({
  F5_5_COMPLIANCE_WEIGHTED: 'compliance_requirements_assessments',
  F5_5_CONTROL_EFFECTIVENESS: 'control_assurance_evidence',
  F5_5_WEIGHTED_PROGRESS: 'audit_findings_actions',
  F5_5_READINESS: 'grc_readiness_operational_snapshot',
  F5_5_RESIDUAL_RISK: 'risk_register_controls',
  F5_5_GRC_HEALTH: 'grc_health_components',
});

const FORMULA_CODE_BY_METRIC_KEY = Object.freeze({
  compliance: 'F5_5_COMPLIANCE_WEIGHTED',
  'compliance.weighted': 'F5_5_COMPLIANCE_WEIGHTED',
  readiness: 'F5_5_READINESS',
  'readiness.iso': 'F5_5_READINESS',
  'risk-residual': 'F5_5_RESIDUAL_RISK',
  'risk.residual': 'F5_5_RESIDUAL_RISK',
  'control-effectiveness': 'F5_5_CONTROL_EFFECTIVENESS',
  'control.effectiveness': 'F5_5_CONTROL_EFFECTIVENESS',
  'actions-progress': 'F5_5_WEIGHTED_PROGRESS',
  'actions.progress': 'F5_5_WEIGHTED_PROGRESS',
  'health-grc': 'F5_5_GRC_HEALTH',
  'health.grc': 'F5_5_GRC_HEALTH',
  'health.iso': 'F5_5_GRC_HEALTH',
  'operational_excellence.health': 'F5_5_GRC_HEALTH',
  'survey-score': 'F5_5_SURVEY_SCORE',
  'survey.response_rate': 'F5_5_RESPONSE_RATE',
  'survey-response-rate': 'F5_5_RESPONSE_RATE',
  'survey.dropout_rate': 'F5_5_DROPOUT_RATE',
  'survey-dropout-rate': 'F5_5_DROPOUT_RATE',
  'survey.cronbach': 'F5_5_CRONBACH_ALPHA',
  'survey-cronbach': 'F5_5_CRONBACH_ALPHA',
  'assurance-score': 'F5_5_ASSURANCE_SCORE',
  'assurance.score': 'F5_5_ASSURANCE_SCORE',
  'assurance-sample-size': 'F5_5_SAMPLE_SIZE',
  'assurance.sample_size': 'F5_5_SAMPLE_SIZE',
  'loss-net': 'F5_5_NET_LOSS',
  'loss.net': 'F5_5_NET_LOSS',
  'loss-expected': 'F5_5_EXPECTED_LOSS',
  'loss.expected': 'F5_5_EXPECTED_LOSS',
  'loss-severity': 'F5_5_LOSS_SEVERITY',
  'loss.severity': 'F5_5_LOSS_SEVERITY',
  'loss-var': 'F5_5_PARAMETRIC_VAR',
  'loss.var': 'F5_5_PARAMETRIC_VAR',
  'loss-monte-carlo': 'F5_5_MONTE_CARLO',
  'loss.monte_carlo': 'F5_5_MONTE_CARLO',
  'continuity-availability': 'F5_5_AVAILABILITY',
  'continuity.availability': 'F5_5_AVAILABILITY',
  'continuity-mtbf': 'F5_5_MTBF',
  'continuity.mtbf': 'F5_5_MTBF',
  'continuity-mttr': 'F5_5_MTTR',
  'continuity.mttr': 'F5_5_MTTR',
  'continuity-sla': 'F5_5_SLA_COMPLIANCE',
  'continuity.sla': 'F5_5_SLA_COMPLIANCE',
  'continuity-rto-gap': 'F5_5_RTO_GAP',
  'continuity.rto_gap': 'F5_5_RTO_GAP',
  'continuity-rpo-gap': 'F5_5_RPO_GAP',
  'continuity.rpo_gap': 'F5_5_RPO_GAP',
  'asset-criticality': 'F5_5_ASSET_CRITICALITY',
  'asset.criticality': 'F5_5_ASSET_CRITICALITY',
  'supplier-risk': 'F5_5_SUPPLIER_RISK',
  'supplier.risk': 'F5_5_SUPPLIER_RISK',
});

function sourceFromCompatibility(sourceCode, period) {
  return {
    status: 'source_unavailable',
    warnings: ['package3_parallel_truth_disabled'],
    counts: null,
    input_hash: null,
    lineage: [
      { step: 'compatibility_layer', status: 'requires_official_calculation_orchestrator', source_contract: sourceCode || null, period },
    ],
  };
}

function formulaCodeForKey(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return null;
  if (normalized.startsWith('F5_')) return normalized;
  return FORMULA_CODE_BY_METRIC_KEY[normalized] || FORMULA_CODE_BY_METRIC_KEY[normalized.replace(/_/g, '-')] || null;
}

function overviewKeyForFormula(formulaCode) {
  return OVERVIEW_KEY_BY_FORMULA_CODE[formulaCode] || null;
}

function buildOverviewOfficialCalculations(_overview = {}, { period = {} } = {}) {
  return Object.fromEntries(PACKAGE3_FORMULA_CODES.map((formulaCode) => {
    const key = overviewKeyForFormula(formulaCode);
    const result = unmeasured(formulaCode, 'Package3 es una capa de compatibilidad; el cálculo oficial debe provenir de officialCalculationOrchestrator.', {
      period,
      source: sourceFromCompatibility(SOURCE_CODE_BY_FORMULA_CODE[formulaCode], period),
      warnings: ['canonical_orchestrator_required'],
    });
    result.metadata = { package: 'phase5_5_package3_compatibility', canonical_pipeline_required: true };
    return [key, result];
  }));
}

function calculateOfficialByKey(key) {
  const formulaCode = formulaCodeForKey(key);
  const error = new Error('Package3 no calcula fórmulas oficiales; use officialCalculationOrchestrator.');
  error.code = 'PACKAGE3_CANONICAL_ORCHESTRATOR_REQUIRED';
  error.status = 409;
  error.details = { key, formula_code: formulaCode };
  throw error;
}

module.exports = {
  PACKAGE3_FORMULA_CODES,
  OVERVIEW_KEY_BY_FORMULA_CODE,
  FORMULA_CODE_BY_METRIC_KEY,
  SOURCE_CODE_BY_FORMULA_CODE,
  buildOverviewOfficialCalculations,
  calculateOfficialByKey,
  formulaCodeForKey,
  overviewKeyForFormula,
};
