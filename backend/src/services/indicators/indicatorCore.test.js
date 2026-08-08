'use strict';

const assert = require('assert');
const core = require('./indicatorCore');

const weights = Object.fromEntries(core.TRUST_DIMENSIONS.map((key) => [key, 0.125]));
const dimension = (score, extra = {}) => ({ score, numerator: score, denominator: 100, evidence: { source: 'qa' }, rule: 'qa_v1', ...extra });

const trusted = core.calculateDataTrust({ dimensions: Object.fromEntries(core.TRUST_DIMENSIONS.map((key) => [key, dimension(90)])), weights });
assert.strictEqual(trusted.score, 90);
assert.strictEqual(trusted.status, 'trusted');
assert.strictEqual(Object.keys(trusted.dimensions).length, 8);

const noLineage = core.calculateDataTrust({ dimensions: { ...Object.fromEntries(core.TRUST_DIMENSIONS.map((key) => [key, dimension(100)])), lineage: dimension(80) }, weights });
assert.notStrictEqual(noLineage.score, 100);

const partial = core.calculateDataTrust({ dimensions: { ...Object.fromEntries(core.TRUST_DIMENSIONS.map((key) => [key, dimension(80)])), accuracy: {} }, weights });
assert.strictEqual(partial.dimensions.accuracy.score, null);
assert.notStrictEqual(partial.dimensions.accuracy.score, 0);
assert.notStrictEqual(partial.status, 'trusted');

const rejected = core.calculateDataTrust({ dimensions: { ...Object.fromEntries(core.TRUST_DIMENSIONS.map((key) => [key, dimension(95)])), validation: dimension(10) }, weights });
assert.strictEqual(rejected.status, 'untrusted');

const fresh = core.evaluateFreshness({ effectiveAt: '2026-08-07T00:00:00Z', frequency: 'daily', now: '2026-08-07T12:00:00Z' });
assert.strictEqual(fresh.status, 'fresh');
assert.strictEqual(core.evaluateFreshness({ frequency: 'daily' }).status, 'unknown');

assert.strictEqual(core.evaluateSufficiency({ sourceStatus: 'source_unavailable', requiredInputs: ['value'] }).status, 'source_unavailable');
assert.strictEqual(core.evaluateSufficiency({ sourceStatus: 'mapping_required', requiredInputs: ['value'] }).status, 'mapping_required');
assert.strictEqual(core.evaluateSufficiency({ requiredInputs: ['value'], availableInputs: { value: 0 }, sampleSize: 10, coverage: 1, rule: { minimum_sample_size: 1, minimum_coverage: 0.8 } }).status, 'sufficient');
assert.strictEqual(core.evaluateSufficiency({ requiredInputs: ['value'], availableInputs: { value: 1 }, sampleSize: 10, coverage: 0.4, rule: { minimum_coverage: 0.8 } }).reason, 'minimum_coverage');

assert.strictEqual(core.assertOfficialResult({ status: 'calculated', value: 0 }).value, 0);
assert.throws(() => core.assertOfficialResult({ status: 'source_unavailable', value: 0 }), /Solo calculated/);
assert.throws(() => core.assertOfficialResult({ status: 'calculated', value: null }), /requiere valor/);

const snapshotInput = {
  tenant_id: 'tenant-a', metric_code: 'COMPLIANCE', metric_definition_id: 'metric-a', definition_version: 1,
  formula_code: 'F5_5_COMPLIANCE_WEIGHTED', formula_version: 1, calculation_policy: { version: 1 }, methodology_version: 1,
  period: { key: '2026-07' }, effective_at: '2026-07-31T00:00:00Z', result: { status: 'calculated', value: 75 }, unit: '%',
  trust: trusted, freshness: fresh, sufficiency: { status: 'sufficient' }, threshold: { version: 1 },
  interpretation: { classification: { code: 'attention' } }, source_snapshot_ids: ['b', 'a', 'a'], lineage: [], calculation_run_id: 'run-a', correlation_id: 'corr-a',
};
const snap1 = core.buildSnapshotPayload(snapshotInput);
const snap2 = core.buildSnapshotPayload({ ...snapshotInput, source_snapshot_ids: ['a', 'b'] });
assert.strictEqual(snap1.checksum, snap2.checksum);
assert.deepStrictEqual(snap1.source_snapshot_ids, ['a', 'b']);
const replayed = core.buildSnapshotPayload({ ...snapshotInput, calculation_run_id: 'run-b', correlation_id: 'corr-b' });
assert.strictEqual(snap1.checksum, replayed.checksum);
const trustReplay = core.calculateDataTrust({ dimensions: Object.fromEntries(core.TRUST_DIMENSIONS.map((key) => [key, dimension(90,{evaluated_at:'later'})])), weights });
assert.strictEqual(trusted.checksum, trustReplay.checksum);

const previous = core.buildSnapshotPayload({ ...snapshotInput, result: { status: 'calculated', value: 70 }, period: { key: '2026-06' } });
const comparison = core.compareSnapshots(previous, snap1);
assert.strictEqual(comparison.absolute_change, 5);
assert.strictEqual(comparison.direction, 'increase');
assert.strictEqual(core.compareSnapshots({ ...previous, methodology_version: 2 }, snap1).status, 'not_comparable');
assert.strictEqual(core.compareSnapshots({ ...previous, result: { status: 'unmeasured', value: null } }, snap1).status, 'not_comparable');

const keyA = core.actionProposalKey({ tenant_id: 'a', metric_snapshot_id: 's', proposal_type: 'review' });
const keyB = core.actionProposalKey({ tenant_id: 'a', metric_snapshot_id: 's', proposal_type: 'review' });
assert.strictEqual(keyA, keyB);

assert.throws(() => core.normalizeWeights({ ...weights, coverage: 0.5 }), /sumar 1/);
process.stdout.write('indicatorCore tests passed\n');
