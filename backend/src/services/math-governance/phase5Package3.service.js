 'use strict';
const compliance = require('./complianceCalculation.service');
const controls = require('./controlCalculation.service');
const risk = require('./riskCalculation.service');
const actions = require('./actionCalculation.service');
const readiness = require('./readinessCalculation.service');
const health = require('./grcHealthCalculation.service');
const { operationalExcellence } = require('./operationalExcellence.service');
const survey = require('./surveyCalculation.service');
const assurance = require('./assuranceCalculation.service');
const loss = require('./lossCalculation.service');
const continuity = require('./continuityCalculation.service');
const asset = require('./assetCalculation.service');
const supplier = require('./supplierCalculation.service');
const { officialResult, unmeasured, clamp } = require('./officialCalculation.service');

function ratio(value) { if (value === null || value === undefined) return null; const n = Number(value); return Number.isFinite(n) ? clamp(n / 100, 0, 1) : null; }
function pctValue(block, keys = []) { for (const key of keys) { const value = block?.data?.[key] ?? block?.[key]; if (value !== null && value !== undefined) return Number(value); } return block?.trust?.score ?? null; }
function sourceFromBlock(sourceCode, block) { return { status: block?.status === 'ok' || block?.status === 'attention' ? 'ready' : 'source_unavailable', warnings: block?.warnings || [], counts: { received: block?.source_count || 0, usable: block?.source_count || 0, excluded: 0 }, input_hash: block?.input_hash || null, lineage: block?.source_count ? [{ source_record: null, source_contract: sourceCode, dataset_snapshot: null, formula_version: null, calculation_run: null }] : [] }; }
function buildOverviewOfficialCalculations(overview = {}, { period = {}, requestId = null } = {}) {
  const complianceScore = pctValue(overview.compliance, ['score', 'records']);
  const complianceRatio = ratio(complianceScore ?? overview.metrics?.trust?.score ?? null);
  const evidenceRatio = ratio(overview.evidence?.trust?.score ?? overview.data_trust?.trust?.score ?? null);
  const actionRatio = ratio(overview.actions?.trust?.score ?? overview.metrics?.trust?.score ?? null);
  const dataTrustRatio = ratio(overview.data_trust?.trust?.score ?? overview.metrics?.trust?.score ?? null);
  const riskRatio = overview.risks?.status === 'attention' ? 0.5 : overview.risks?.status === 'ok' ? 0.8 : null;
  const controlRatio = ratio(overview.controls?.trust?.score ?? null);
  const official = {};
  official.compliance = complianceScore === null || complianceScore === undefined
    ? unmeasured('F5_5_COMPLIANCE_WEIGHTED', 'Overview sin dataset de cumplimiento evaluado.', { unit: '%', period, source: sourceFromBlock('compliance_requirements_assessments', overview.compliance) })
    : officialResult('F5_5_COMPLIANCE_WEIGHTED', { assessments: [{ status: 'conform', weight: complianceScore }, { status: 'non_conform', weight: Math.max(0, 100 - complianceScore) }] }, { period, source: sourceFromBlock('compliance_requirements_assessments', overview.compliance), coverage: overview.compliance?.source_count ? 100 : null, runId: requestId ? `overview-${requestId}-compliance` : null });
  official.control_effectiveness = controlRatio === null
    ? unmeasured('F5_5_CONTROL_EFFECTIVENESS', 'Overview sin dimensiones oficiales de controles.', { unit: 'ratio', period, source: sourceFromBlock('control_assurance_evidence', overview.controls) })
    : controls.officialControlEffectiveness({ design: controlRatio, implementation: controlRatio, operation: controlRatio, evidence: evidenceRatio ?? controlRatio, period, source: sourceFromBlock('control_assurance_evidence', overview.controls) });
  official.actions = actionRatio === null
    ? unmeasured('F5_5_WEIGHTED_PROGRESS', 'Overview sin progreso de acciones medido.', { unit: '%', period, source: sourceFromBlock('audit_findings_actions', overview.actions) })
    : actions.officialWeightedProgress({ items: [{ progress: actionRatio, weight: 1 }], period, source: sourceFromBlock('audit_findings_actions', overview.actions) });
  official.readiness = [complianceRatio, evidenceRatio, controlRatio, actionRatio].some((value) => value === null)
    ? unmeasured('F5_5_READINESS', 'Readiness incompleto en overview oficial.', { unit: 'score', period, source: sourceFromBlock('grc_readiness_operational_snapshot', overview.metrics) })
    : readiness.officialReadiness({ compliance: complianceRatio, evidence: evidenceRatio, health: controlRatio, actions: actionRatio, coverage: overview.metrics?.source_count ? 100 : 0, period, source: sourceFromBlock('grc_readiness_operational_snapshot', overview.metrics) });
  official.risk = riskRatio === null
    ? unmeasured('F5_5_RESIDUAL_RISK', 'Overview sin riesgo residual oficial medido.', { unit: 'score', period, source: sourceFromBlock('risk_register_controls', overview.risks) })
    : risk.officialResidualRisk({ inherentRisk: 25, controlEffectiveness: riskRatio, period, source: sourceFromBlock('risk_register_controls', overview.risks), method: 'overview_adapter' });
  official.health = [riskRatio, complianceRatio, actionRatio, evidenceRatio, dataTrustRatio].some((value) => value === null)
    ? unmeasured('F5_5_GRC_HEALTH', 'GRC Health incompleto por componentes unmeasured.', { unit: 'score', period, source: sourceFromBlock('grc_health_components', overview.metrics) })
    : health.officialGrcHealth({ risk: riskRatio, compliance: complianceRatio, actions: actionRatio, evidence: evidenceRatio, dataTrust: dataTrustRatio, period, source: sourceFromBlock('grc_health_components', overview.metrics) });
  official.operational_excellence = operationalExcellence({ compliance: official.compliance.value, actions: official.actions.value, risk: official.health.value, quality: evidenceRatio === null ? null : evidenceRatio * 100, dataTrust: dataTrustRatio === null ? null : dataTrustRatio * 100, period, source: sourceFromBlock('grc_health_components', overview.metrics) });
  return official;
}
function calculateOfficialByKey(key, input = {}) {
  switch (key) {
    case 'compliance': return compliance.officialCompliance(input);
    case 'coverage': return compliance.officialCoverage(input);
    case 'readiness': return readiness.officialReadiness(input);
    case 'risk-inherent': return risk.officialInherentRisk(input);
    case 'risk-residual': return risk.officialResidualRisk(input);
    case 'risk-expected-loss': return risk.officialExpectedLoss(input);
    case 'control-effectiveness': return controls.officialControlEffectiveness(input);
    case 'control-combined': return controls.officialCombinedEffectiveness(input);
    case 'findings-severity': return actions.officialSeverity(input);
    case 'actions-closure': return actions.officialClosureRate(input);
    case 'actions-progress': return actions.officialWeightedProgress(input);
    case 'actions-overdue': return actions.officialOverdueRate(input);
    case 'health-grc': return health.officialGrcHealth(input);
    case 'health-iso': return health.officialIsoHealth(input);
    case 'operational-excellence': return operationalExcellence(input);
    case 'survey-score': return survey.officialSurveyScore(input);
    case 'survey-response-rate': return survey.officialResponseRate(input);
    case 'survey-dropout-rate': return survey.officialDropoutRate(input);
    case 'survey-cronbach': return survey.officialCronbach(input);
    case 'assurance-score': return assurance.officialAssuranceScore(input);
    case 'assurance-sample-size': return assurance.officialSampleSize(input);
    case 'loss-net': return loss.officialNetLoss(input);
    case 'loss-expected': return loss.officialExpectedLoss(input);
    case 'loss-severity': return loss.officialSeverity(input);
    case 'loss-var': return loss.officialVaR(input);
    case 'loss-monte-carlo': return loss.officialMonteCarlo(input);
    case 'continuity-availability': return continuity.officialAvailability(input);
    case 'continuity-mtbf': return continuity.officialMtbf(input);
    case 'continuity-mttr': return continuity.officialMttr(input);
    case 'continuity-sla': return continuity.officialSla(input);
    case 'continuity-rto-gap': return continuity.officialRtoGap(input);
    case 'continuity-rpo-gap': return continuity.officialRpoGap(input);
    case 'asset-criticality': return asset.officialAssetCriticality(input);
    case 'supplier-risk': return supplier.officialSupplierRisk(input);
    default: throw Object.assign(new Error('Calculo oficial no soportado.'), { code: 'OFFICIAL_CALCULATION_NOT_FOUND', status: 404, details: { key } });
  }
}
module.exports = { buildOverviewOfficialCalculations, calculateOfficialByKey };
