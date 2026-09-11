'use strict';

const assert = require('node:assert/strict');

const {
  normalizeControlImplementationStatus,
  recordControlSoAAssessment,
  resolveAffectedMetricCodes,
  publishAffectedOfficialIndicators,
} = require('./grcCalculationOrchestration.service');

const TENANT_A = '10000000-0000-4000-8000-0000000000a1';
const TENANT_B = '10000000-0000-4000-8000-0000000000b2';
const USER_ID = '10000000-0000-4000-8000-0000000000c3';
const TENANT_CONTROL_ID = '10000000-0000-4000-8000-0000000000d4';

async function testAffectedMetricMap() {
  assert.deepEqual(resolveAffectedMetricCodes({ factType: 'diagnostic' }), [
    'COMPLIANCE',
    'COVERAGE',
    'DATA-TRUST',
    'GRC-HEALTH',
  ]);

  assert.deepEqual(resolveAffectedMetricCodes({ factType: 'risk' }), [
    'RISK-INHERENT',
    'RISK-RESIDUAL',
    'DATA-TRUST',
    'GRC-HEALTH',
  ]);

  assert.deepEqual(resolveAffectedMetricCodes({ factType: 'action' }), [
    'REMEDIATION',
    'ACTIONS',
    'DATA-TRUST',
    'GRC-HEALTH',
  ]);
}

async function testCanonicalSoAAssessmentWrite() {
  const queries = [];
  const client = {
    async query(sql, params) {
      const compactSql = String(sql).replace(/\s+/g, ' ').trim();
      queries.push({ sql: compactSql, params });
      assert.doesNotMatch(compactSql, /control_health_scores|refresh_kpi_health_snapshots|KPI-HLT/);

      if (compactSql.includes('INSERT INTO control_soa_assessments')) {
        assert.equal(params[0], TENANT_A);
        assert.equal(params[1], TENANT_CONTROL_ID);
        assert.equal(params[2], 'ISO27001');
        assert.equal(params[3], 'system');
        assert.equal(params[4], false);
        assert.equal(params[5], 'no aplica');
        assert.equal(params[7], USER_ID);

        return {
          rows: [{
            id: 'assessment-a',
            tenant_id: params[0],
            tenant_control_id: params[1],
            iso_code: params[2],
            status: 'applied',
            suggested_applicable: params[4],
            suggested_implementation_status: params[5],
          }],
        };
      }

      if (compactSql.includes("to_regclass('public.grc_requirement_control_mappings')")) {
        return { rows: [{ has_mappings: false, has_assurance: false }] };
      }

      throw new Error(`unexpected SQL: ${compactSql}`);
    },
  };

  assert.equal(normalizeControlImplementationStatus('cumple'), 'implementado');
  assert.equal(normalizeControlImplementationStatus('no cumple'), 'no implementado');

  const result = await recordControlSoAAssessment({
    client,
    tenantId: TENANT_A,
    tenantControlId: TENANT_CONTROL_ID,
    isoCode: 'ISO27001',
    implementationStatus: 'no aplica',
    userId: USER_ID,
    metadata: {
      producer: 'test',
      endpoint: 'PUT /test',
      factType: 'diagnostic',
    },
  });

  assert.equal(result.suggested_implementation_status, 'no aplica');
  assert.equal(result.suggested_applicable, false);
  assert.equal(result.assurance_projection.status, 'skipped');
  assert.equal(result.assurance_projection.code, 'NO_ASSURANCE_PROJECTION_FOR_STATUS');
  assert.equal(queries.length, 1);
}

async function testMappedControlAssuranceProjection() {
  const queries = [];
  const client = {
    async query(sql, params) {
      const compactSql = String(sql).replace(/\s+/g, ' ').trim();
      queries.push({ sql: compactSql, params });

      if (compactSql.includes('INSERT INTO control_soa_assessments')) {
        return {
          rows: [{
            id: 'assessment-b',
            tenant_id: params[0],
            tenant_control_id: params[1],
            iso_code: params[2],
            status: 'applied',
            suggested_applicable: params[4],
            suggested_implementation_status: params[5],
          }],
        };
      }

      throw new Error(`unexpected SQL: ${compactSql}`);
    },
  };

  const result = await recordControlSoAAssessment({
    client,
    tenantId: TENANT_A,
    tenantControlId: TENANT_CONTROL_ID,
    isoCode: 'ISO_27001_2022',
    implementationStatus: 'cumple',
    userId: 'not-a-uuid',
    metadata: { producer: 'test' },
  });

  assert.equal(result.iso_code, 'ISO27001');
  assert.equal(result.assurance_projection.status, 'skipped');
  assert.equal(result.assurance_projection.code, 'ASSURANCE_STATUS_SCORE_CONVERSION_UNGOVERNED');
  assert.equal(queries.some((query) => query.sql.includes('INSERT INTO grc_control_assurance')), false);
}

async function testSupportedIsoIdentityConvergence() {
  const observedIsoCodes = [];
  const client = {
    async query(sql, params) {
      const compactSql = String(sql).replace(/\s+/g, ' ').trim();
      if (compactSql.includes('INSERT INTO control_soa_assessments')) {
        observedIsoCodes.push(params[2]);
        return {
          rows: [{
            id: `assessment-${observedIsoCodes.length}`,
            tenant_id: params[0],
            tenant_control_id: params[1],
            iso_code: params[2],
            status: 'applied',
            suggested_applicable: params[4],
            suggested_implementation_status: params[5],
          }],
        };
      }
      throw new Error(`unexpected SQL: ${compactSql}`);
    },
  };

  await recordControlSoAAssessment({
    client,
    tenantId: TENANT_A,
    tenantControlId: TENANT_CONTROL_ID,
    isoCode: 'ISO_27001_2022',
    implementationStatus: 'no aplica',
  });
  await recordControlSoAAssessment({
    client,
    tenantId: TENANT_A,
    tenantControlId: TENANT_CONTROL_ID,
    isoCode: 'ISO27001',
    implementationStatus: 'no aplica',
  });
  await recordControlSoAAssessment({
    client,
    tenantId: TENANT_A,
    tenantControlId: TENANT_CONTROL_ID,
    isoCode: 'ISO/IEC 27701',
    implementationStatus: 'no aplica',
  });
  await recordControlSoAAssessment({
    client,
    tenantId: TENANT_A,
    tenantControlId: TENANT_CONTROL_ID,
    isoCode: 'iso/iec27017',
    implementationStatus: 'no aplica',
  });

  assert.deepEqual(observedIsoCodes, ['ISO27001', 'ISO27001', 'ISO27701', 'ISO27017']);
}

async function testOfficialPublicationTenantIsolation() {
  const calls = [];
  const indicatorService = {
    async calculateIndicator(scope, metricCode, body, requestId) {
      calls.push({ stage: 'calculate', tenantId: scope.tenant_id, metricCode, requestId, metadata: body.metadata });
      return {
        measurement: {
          id: `${scope.tenant_id}:${metricCode}:measurement`,
        },
        output: {
          value: metricCode === 'GRC-HEALTH' ? null : 87,
        },
      };
    },
    async createSnapshot(scope, metricCode, body, requestId) {
      calls.push({ stage: 'snapshot', tenantId: scope.tenant_id, metricCode, measurementId: body.measurement_id, requestId });
      assert.ok(body.measurement_id.startsWith(`${scope.tenant_id}:`));
      return {
        snapshot: {
          snapshot_id: `${scope.tenant_id}:${metricCode}:snapshot`,
        },
      };
    },
    async publishSnapshot(scope, snapshotId, requestId) {
      calls.push({ stage: 'publish', tenantId: scope.tenant_id, snapshotId, requestId });
      assert.ok(snapshotId.startsWith(`${scope.tenant_id}:`));
      return {
        status: 'published',
        snapshot_id: snapshotId,
      };
    },
  };

  const tenantAResult = await publishAffectedOfficialIndicators({
    tenantId: TENANT_A,
    user: { id: USER_ID, tenant_id: TENANT_A },
    factType: 'diagnostic',
    requestId: 'req-a',
    dependencies: { indicatorService },
    metadata: { producer: 'test' },
  });

  const tenantBResult = await publishAffectedOfficialIndicators({
    tenantId: TENANT_B,
    user: { id: USER_ID, tenant_id: TENANT_B },
    factType: 'evidence',
    requestId: 'req-b',
    dependencies: { indicatorService },
    metadata: { producer: 'test' },
  });

  assert.equal(tenantAResult.summary.published, 4);
  assert.equal(tenantBResult.summary.published, 3);
  assert.equal(calls.filter((call) => call.tenantId === TENANT_A && call.stage === 'calculate').length, 4);
  assert.equal(calls.filter((call) => call.tenantId === TENANT_B && call.stage === 'calculate').length, 3);
  assert.equal(calls.some((call) => call.tenantId === TENANT_A && String(call.snapshotId || call.measurementId || '').includes(TENANT_B)), false);
  assert.equal(calls.some((call) => call.tenantId === TENANT_B && String(call.snapshotId || call.measurementId || '').includes(TENANT_A)), false);
}

async function testFailedMetricIsExplicitAndDoesNotStopChain() {
  const indicatorService = {
    async calculateIndicator(scope, metricCode) {
      if (metricCode === 'COVERAGE') {
        const error = new Error('source unavailable in focused fixture');
        error.code = 'SOURCE_UNAVAILABLE';
        throw error;
      }
      return { measurement: { id: `${scope.tenant_id}:${metricCode}:measurement` } };
    },
    async createSnapshot(scope, metricCode) {
      return { snapshot: { snapshot_id: `${scope.tenant_id}:${metricCode}:snapshot` } };
    },
    async publishSnapshot() {
      return { status: 'published' };
    },
  };

  const result = await publishAffectedOfficialIndicators({
    tenantId: TENANT_A,
    user: { id: USER_ID, tenant_id: TENANT_A },
    factType: 'diagnostic',
    dependencies: { indicatorService },
  });

  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.published, 3);
  assert.equal(result.results.find((item) => item.metric_code === 'COVERAGE').error.code, 'SOURCE_UNAVAILABLE');
}

async function testPostCommitUnexpectedFailureIsObservableWithoutThrow() {
  const result = await publishAffectedOfficialIndicators({
    tenantId: TENANT_A,
    user: { id: USER_ID, tenant_id: TENANT_A },
    factType: 'diagnostic',
    dependencies: {
      indicatorService: {
        calculateIndicator() {
          throw new TypeError('post-commit publisher blew up before source resolution');
        },
      },
    },
  });

  assert.equal(result.status, 'completed_with_failures');
  assert.equal(result.summary.failed, 4);
  assert.equal(result.results.find((item) => item.metric_code === 'COMPLIANCE').error.code, 'OFFICIAL_INDICATOR_PUBLICATION_FAILED');
}

(async () => {
  await testAffectedMetricMap();
  await testCanonicalSoAAssessmentWrite();
  await testMappedControlAssuranceProjection();
  await testSupportedIsoIdentityConvergence();
  await testOfficialPublicationTenantIsolation();
  await testFailedMetricIsExplicitAndDoesNotStopChain();
  await testPostCommitUnexpectedFailureIsObservableWithoutThrow();
  console.log('grcCalculationOrchestration.service.test PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
