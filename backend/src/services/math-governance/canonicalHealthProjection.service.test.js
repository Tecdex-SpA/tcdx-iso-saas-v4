'use strict';

const assert = require('assert');
const {
  EVIDENCE_COVERAGE_MAPPING,
  GLOBAL_HEALTH_AUTHORITY,
  GLOBAL_SCORE_FORMULA,
  GLOBAL_SCORE_VERSION,
  LEGACY_KPI_HLT_ROLE,
  classifyOfficialComponent,
  projectHealthFromComponents,
} = require('./canonicalHealthProjection.service');

const evidence = classifyOfficialComponent(
  { key: 'evidence', label: 'Vigencia de evidencia', weight: 0.2, metric_code: 'EVIDENCE-FRESH' },
  { value: 14.25, state: 'calculated', machine_reason: null },
);
assert.strictEqual(evidence.classification, 'AVAILABLE');
assert.strictEqual(evidence.value, 14.25);

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
assert.strictEqual(GLOBAL_HEALTH_AUTHORITY, 'official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings');
assert.strictEqual(GLOBAL_SCORE_FORMULA, 'F5_5_GRC_HEALTH');
assert.strictEqual(GLOBAL_SCORE_VERSION, 2);
assert.strictEqual(LEGACY_KPI_HLT_ROLE, 'COMPATIBILITY_SOURCE_COMPONENT');
assert.ok(EVIDENCE_COVERAGE_MAPPING.includes('compatibility_alias_only'));

process.stdout.write('NORMALIZATION02_CANONICAL_HEALTH_PROJECTION_PASS\n');
