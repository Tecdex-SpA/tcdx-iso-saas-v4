'use strict';

const assert = require('assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  EVIDENCE_COVERAGE_MAPPING,
  GLOBAL_HEALTH_AUTHORITY,
  GLOBAL_SCORE_FORMULA,
  GLOBAL_SCORE_VERSION,
  OFFICIAL_PROJECTION_ROLE,
  classifyOfficialComponent,
  isSourceStale,
  loadComponentPolicies,
  projectHealthFromComponents,
  selectOfficialGlobalHealth,
} = require('./canonicalHealthProjection.service');

const serviceSource = fs.readFileSync(path.join(__dirname, 'canonicalHealthProjection.service.js'), 'utf8');

const evidence = classifyOfficialComponent(
  { key: 'evidence', label: 'Vigencia de evidencia', weight: 0.2, metric_code: 'EVIDENCE-FRESH' },
  { value: 14.25, state: 'calculated', machine_reason: null },
);
assert.strictEqual(evidence.classification, 'AVAILABLE');
assert.strictEqual(evidence.value, 14.25);

const missingWithNumber = classifyOfficialComponent(
  { key: 'evidence', label: 'Vigencia de evidencia', weight: 0.2, metric_code: 'EVIDENCE-FRESH' },
  { value: 90, state: 'insufficient_data', machine_reason: 'dataset_missing' },
);
assert.strictEqual(missingWithNumber.classification, 'MISSING');
assert.strictEqual(missingWithNumber.value, null);

const unknownWithNumber = classifyOfficialComponent(
  { key: 'risk', label: 'Riesgo', weight: 0.2, metric_code: 'RISK-RESIDUAL' },
  { value: 90, state: 'unexpected_runtime_state', machine_reason: 'state_unmapped' },
);
assert.strictEqual(unknownWithNumber.classification, 'UNKNOWN');
assert.strictEqual(unknownWithNumber.value, null);

const staleEvidence = classifyOfficialComponent(
  { key: 'evidence', label: 'Vigencia de evidencia', weight: 0.2, metric_code: 'EVIDENCE-FRESH' },
  { value: 90, state: 'calculated', effective_at: '2026-01-01T00:00:00.000Z', stale_after_ms: 24 * 60 * 60 * 1000 },
  { asOf: '2026-01-03T00:00:00.000Z' },
);
assert.strictEqual(staleEvidence.classification, 'STALE');
assert.strictEqual(staleEvidence.value, null);
assert.strictEqual(isSourceStale({ effective_at: '2026-01-01T00:00:00.000Z', stale_after: { days: 1 } }, '2026-01-03T00:00:00.000Z'), true);

const dataTrust = classifyOfficialComponent(
  { key: 'dataTrust', label: 'Data Trust', weight: 0.2, metric_code: 'DATA-TRUST' },
  { value: null, state: 'unmeasured', machine_reason: 'FORMULA_VARIABLE_REQUIRED: accuracy' },
);
assert.strictEqual(dataTrust.classification, 'NOT_CONFIGURED');

const projection = projectHealthFromComponents({
  minimumCoverage: 0.8,
  components: [
    { key: 'risk', label: 'Riesgo', weight: 0.2, classification: 'MISSING', value: null },
    { key: 'compliance', label: 'Cumplimiento', weight: 0.25, classification: 'MISSING', value: null },
    { key: 'actions', label: 'Acciones', weight: 0.15, classification: 'NOT_APPLICABLE', value: null },
    evidence,
    dataTrust,
  ],
});

assert.strictEqual(projection.global_status, 'insufficient_coverage');
assert.strictEqual(projection.score_publicable, false);
assert.strictEqual(projection.coverage, 0.2353);
assert.strictEqual(projection.score, 14.25);
assert.deepStrictEqual(projection.missing_components.map((item) => item.key).sort(), ['compliance', 'dataTrust', 'risk']);

const officialProjection = selectOfficialGlobalHealth({
  globalSource: {
    value: 88,
    state: 'calculated',
    payload: { details: { coverage: 0.82, minimum_coverage: 0.8 } },
  },
  componentProjection: projection,
});
assert.strictEqual(officialProjection.global_score, 88);
assert.strictEqual(officialProjection.published_score, 88);
assert.strictEqual(officialProjection.score_publicable, true);
assert.strictEqual(officialProjection.coverage, 0.82);

const lowCoverageOfficialProjection = selectOfficialGlobalHealth({
  globalSource: {
    value: 88,
    state: 'calculated',
    payload: { details: { coverage: 0.5, minimum_coverage: 0.8 } },
  },
  componentProjection: projection,
});
assert.strictEqual(lowCoverageOfficialProjection.global_score, null);
assert.strictEqual(lowCoverageOfficialProjection.global_status, 'insufficient_coverage');

assert.strictEqual(GLOBAL_HEALTH_AUTHORITY, 'official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings');
assert.strictEqual(GLOBAL_SCORE_FORMULA, 'F5_5_GRC_HEALTH');
assert.strictEqual(GLOBAL_SCORE_VERSION, 2);
assert.strictEqual(OFFICIAL_PROJECTION_ROLE, 'READ_NORMALIZE_EXPLAIN_PRESENT_ONLY');
assert.ok(EVIDENCE_COVERAGE_MAPPING.includes('compatibility_alias_only'));
assert.doesNotMatch(serviceSource, /\bcr\.source_as_of\b/);
assert.doesNotMatch(serviceSource, /\bcr\.created_at\b/);
assert.match(serviceSource, /COALESCE\(cr\.period_end, cr\.completed_at, cr\.started_at, cr\.period_start\)/);

async function testLoadComponentPolicies() {
  const policyQueries = [];
  const fakeClient = {
    async query(sql, params = []) {
      const compactSql = String(sql).replace(/\s+/g, ' ').trim();
      if (compactSql.includes('to_regclass')) return { rows: [{ relation: 'metric_calculation_policies' }], rowCount: 1 };
      policyQueries.push({ sql: compactSql, params });
      assert.match(compactSql, /SELECT DISTINCT ON \(metric_key, formula_code\)/);
      assert.match(compactSql, /ORDER BY metric_key, formula_code, tenant_id DESC NULLS LAST, version_number DESC, published_at DESC NULLS LAST, created_at DESC/);
      return {
        rows: [
          {
            metric_key: 'EVIDENCE-FRESH',
            formula_code: 'F5_5_FRESHNESS_CONTINUOUS',
            stale_after: { days: 7 },
            metadata: { source: 'tenant' },
          },
          {
            metric_key: 'ACTIONS',
            formula_code: 'F5_5_WEIGHTED_PROGRESS',
            stale_after: { days: 30 },
            metadata: { source: 'global' },
          },
        ],
        rowCount: 2,
      };
    },
  };

  const policies = await loadComponentPolicies(fakeClient, '70000000-0000-0000-0000-000000000701');
  assert.strictEqual(policyQueries.length, 1);
  assert.strictEqual(policies.get('metric:EVIDENCE-FRESH').metadata.source, 'tenant');
  assert.strictEqual(policies.get('formula:F5_5_FRESHNESS_CONTINUOUS').stale_after_ms, 7 * 24 * 60 * 60 * 1000);
  assert.strictEqual(policies.get('metric:ACTIONS').metadata.source, 'global');
  assert.strictEqual(policies.get('formula:F5_5_WEIGHTED_PROGRESS').stale_after_ms, 30 * 24 * 60 * 60 * 1000);
}

testLoadComponentPolicies()
  .then(() => {
    process.stdout.write('NORMALIZATION02_CANONICAL_HEALTH_PROJECTION_PASS\n');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
