'use strict';

const assert = require('assert');
const catalog = require('./analyticsCatalog.service');
const phase5Package3 = require('./phase5Package3.service');

function main() {
  let assertions = 0;
  const results = catalog.listAnalyticalResults();
  assert(results.length >= 30); assertions += 1;
  const codes = new Set(results.map((item) => item.result_code));
  assert.strictEqual(codes.size, results.length); assertions += 1;
  for (const domain of ['compliance', 'readiness', 'risk', 'control', 'actions', 'health', 'survey', 'assurance', 'loss', 'continuity', 'asset', 'supplier', 'data_quality']) {
    assert(results.some((item) => item.domain === domain), `missing domain ${domain}`); assertions += 1;
  }
  for (const item of results) {
    assert(item.analytical_result_code); assertions += 1;
    assert(item.display_name); assertions += 1;
    assert(item.formula_code.startsWith('F5_5_')); assertions += 1;
    assert(Number.isInteger(item.formula_version)); assertions += 1;
    assert(item.unit !== undefined); assertions += 1;
    assert(Array.isArray(item.dimensions)); assertions += 1;
    assert(Array.isArray(item.supported_periods)); assertions += 1;
    assert.strictEqual(item.tenant_scope, 'tenant_scoped'); assertions += 1;
    assert(item.source_code || item.formula_code === 'F5_5_GRC_HEALTH'); assertions += 1;
    assert.strictEqual(item.publication_status, 'published'); assertions += 1;
  }

  const definition = catalog.getAnalyticalResultDefinition('compliance.weighted');
  assert.strictEqual(definition.metric_key, 'compliance'); assertions += 1;
  assert.strictEqual(catalog.getAnalyticalResultDefinition('compliance').result_code, 'compliance.weighted'); assertions += 1;

  const missingPayload = catalog.buildOfficialConsumptionPayload(definition, null, { period: { start: '2026-01-01', end: '2026-01-31' } });
  assert.strictEqual(missingPayload.result_code, 'compliance.weighted'); assertions += 1;
  assert.strictEqual(missingPayload.value, null); assertions += 1;
  assert.strictEqual(missingPayload.source_status, 'source_unavailable'); assertions += 1;
  assert.strictEqual(missingPayload.formula.code, 'F5_5_COMPLIANCE_WEIGHTED'); assertions += 1;
  assert.strictEqual(missingPayload.calculation_run_id, null); assertions += 1;
  assert(missingPayload.warnings.some((warning) => warning.includes('calculation_run'))); assertions += 1;

  const latestPayload = catalog.buildOfficialConsumptionPayload(definition, {
    run_id: '70000000-0000-0000-0000-000000000777',
    output_value: { value: 87.1255, status: 'completed' },
    unit: '%',
    period_start: '2026-01-01T00:00:00.000Z',
    period_end: '2026-01-31T23:59:59.000Z',
    timezone: 'tenant-configured',
    run_metadata: { trust_score: 91, trust_status: 'trusted', source_status: 'available', coverage: 98 },
    output_metadata: {},
    snapshot_id: '70000000-0000-0000-0000-000000000778',
  });
  assert.strictEqual(latestPayload.value, 87.13); assertions += 1;
  assert.strictEqual(latestPayload.trust.score, 91); assertions += 1;
  assert.strictEqual(latestPayload.coverage, 98); assertions += 1;
  assert.strictEqual(latestPayload.snapshot_id, '70000000-0000-0000-0000-000000000778'); assertions += 1;
  assert(latestPayload.explanation_url.includes(latestPayload.calculation_run_id)); assertions += 1;
  assert(latestPayload.lineage_url.includes(latestPayload.calculation_run_id)); assertions += 1;

  for (const key of ['compliance', 'risk-residual', 'survey-score', 'assurance-score', 'loss-expected', 'continuity-availability', 'asset-criticality', 'supplier-risk']) {
    assert.throws(
      () => phase5Package3.calculateOfficialByKey(key, sampleInputFor(key)),
      (error) => error?.code === 'PACKAGE3_CANONICAL_ORCHESTRATOR_REQUIRED'
    );
    assertions += 1;
  }

  const health = catalog.buildHealthCatalog();
  assert(health.some((item) => item.score_code === 'supplier_health')); assertions += 1;
  assert(health.every((item) => item.publication_status === 'published')); assertions += 1;

  console.log(JSON.stringify({ status: 'PHASE5_5_PACKAGE5_TESTS_OK', assertions }));
}

function sampleInputFor(key) {
  switch (key) {
    case 'compliance': return { assessments: [{ status: 'conform', weight: 1 }, { status: 'partial', weight: 1 }] };
    case 'risk-residual': return { inherentRisk: 20, controlEffectiveness: 0.5 };
    case 'survey-score': return { items: [{ score: 4, maxScore: 5, weight: 1 }] };
    case 'assurance-score': return { results: [{ result: 'pass', weight: 1 }] };
    case 'loss-expected': return { expectedFrequency: 2, meanSeverity: 100 };
    case 'continuity-availability': return { totalTime: 100, downtime: 1 };
    case 'asset-criticality': return { confidentiality: 4, integrity: 4, availability: 3, legal: 2 };
    case 'supplier-risk': return { compliance: 3, security: 4, dependency: 2, privacy: 3, resilience: 4 };
    default: return {};
  }
}

main();
