'use strict';

const assert = require('assert');
const { validateDataset } = require('./datasetValidation.service');

function main() {
  const tenantId = 'tenant-a';
  const period = {
    start: '2026-08-01T00:00:00.000Z',
    end: '2026-08-31T23:59:59.999Z',
  };
  const now = new Date('2026-08-15T12:00:00.000Z');

  const canonicalEventTime = validateDataset({
    tenantId,
    period,
    now,
    sourceKey: 'canonical-event-time-test',
    requiredFields: ['id', 'tenant_id'],
    rows: [{
      id: 'row-1',
      tenant_id: tenantId,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
      __event_time: '2026-08-10T12:00:00.000Z',
    }],
  });
  assert.strictEqual(canonicalEventTime.usable_rows.length, 1, 'adapter canonical __event_time inside period must control period validation');
  assert.strictEqual(canonicalEventTime.invalid_rows.length, 0);
  assert.strictEqual(canonicalEventTime.excludedCount, 0);

  const multiIssueSingleRow = validateDataset({
    tenantId,
    period,
    now,
    sourceKey: 'row-count-test',
    requiredFields: ['id', 'tenant_id', 'value'],
    rangeRules: { value: { min: 0, max: 100 } },
    rows: [{
      id: 'row-2',
      tenant_id: 'tenant-b',
      value: 150,
      __event_time: '2026-07-01T00:00:00.000Z',
    }],
  });
  assert.strictEqual(multiIssueSingleRow.invalid_rows.length, 1, 'one invalid row must remain one excluded row');
  assert.strictEqual(multiIssueSingleRow.excludedCount, 1, 'excludedCount must count excluded rows, not issue cardinality');
  assert.ok(multiIssueSingleRow.exclusionIssueCount >= 3, 'issue detail must remain fully observable');
  assert.ok(multiIssueSingleRow.exclusions.some((issue) => issue.code === 'tenant_mismatch'));
  assert.ok(multiIssueSingleRow.exclusions.some((issue) => issue.code === 'range_above_max'));
  assert.ok(multiIssueSingleRow.exclusions.some((issue) => issue.code === 'date_before_period'));

  console.log('datasetValidation canonical event-time and exclusion-count tests: PASS');
}

main();
