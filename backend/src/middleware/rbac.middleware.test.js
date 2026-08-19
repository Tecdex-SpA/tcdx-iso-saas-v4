'use strict';

const assert = require('node:assert/strict');
const { enforceApiAccess } = require('./rbac.middleware');
const {
  listImportDefinitions,
} = require('../services/imports/importDefinitions');

const batchId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function authorize({ method, path, role, requestId = 'req-import-rbac-test' }) {
  const req = {
    method,
    originalUrl: path,
    requestId,
    user: {
      role,
      tenant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
  };
  const res = {
    locals: {},
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  enforceApiAccess(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, res };
}

const adminRoutes = [
  ['GET', '/api/imports/definitions'],
  ['GET', '/api/imports/definitions/organizations'],
  ['GET', '/api/imports/templates/organizations.xlsx'],
  ['GET', '/api/imports/catalogs/organizations.xlsx'],
  ['POST', '/api/imports/preview'],
  ['GET', '/api/imports/history'],
  ['GET', `/api/imports/${batchId}`],
  ['POST', `/api/imports/${batchId}/confirm`],
  ['POST', `/api/imports/${batchId}/rollback`],
  ['GET', `/api/imports/${batchId}/errors.xlsx`],
];

for (const [method, path] of adminRoutes) {
  const result = authorize({ method, path, role: 'tenant_admin' });
  assert.equal(result.nextCalled, true, `tenant_admin ${method} ${path}`);
}

for (const [method, path] of adminRoutes.filter(([verb]) => verb === 'GET')) {
  const result = authorize({ method, path, role: 'auditor' });
  assert.equal(result.nextCalled, true, `auditor read ${method} ${path}`);
}

for (const path of [
  '/api/imports/preview',
  `/api/imports/${batchId}/confirm`,
  `/api/imports/${batchId}/rollback`,
]) {
  const result = authorize({ method: 'POST', path, role: 'auditor' });
  assert.equal(result.nextCalled, false, `auditor denied POST ${path}`);
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.payload.code, 'RBAC_DENIED');
  assert.equal(result.res.payload.request_id, 'req-import-rbac-test');
}

const unprivileged = authorize({
  method: 'GET',
  path: '/api/imports/definitions',
  role: 'viewer',
  requestId: 'req-import-no-permission',
});
assert.equal(unprivileged.nextCalled, false);
assert.equal(unprivileged.res.statusCode, 403);
assert.equal(unprivileged.res.payload.code, 'RBAC_DENIED');
assert.equal(unprivileged.res.payload.request_id, 'req-import-no-permission');

const unregistered = authorize({
  method: 'DELETE',
  path: `/api/imports/${batchId}`,
  role: 'tenant_admin',
});
assert.equal(unregistered.nextCalled, false);
assert.equal(unregistered.res.statusCode, 403);
assert.equal(unregistered.res.payload.error, 'Ruta API sin regla RBAC explícita');

const phase5ReadRoutes = [
  '/api/data/domains',
  '/api/data/quality',
  '/api/metrics',
  `/api/metrics/${batchId}/trend`,
  '/api/surveys',
  '/api/survey-campaigns',
  '/api/assurance-tests',
  '/api/loss-events',
  '/api/dashboards',
  '/api/report-generations',
];

for (const path of phase5ReadRoutes) {
  const result = authorize({ method: 'GET', path, role: 'viewer' });
  assert.equal(result.nextCalled, true, `viewer phase5 read ${path}`);
}

for (const path of [
  '/api/data/domains',
  '/api/metrics',
  '/api/surveys',
  '/api/loss-events',
  '/api/dashboards',
  '/api/report-schedules',
]) {
  const admin = authorize({ method: 'POST', path, role: 'tenant_admin' });
  assert.equal(admin.nextCalled, true, `tenant_admin phase5 write ${path}`);
}

const viewerDeniedMetricWrite = authorize({ method: 'POST', path: '/api/metrics', role: 'viewer' });
assert.equal(viewerDeniedMetricWrite.nextCalled, false);
assert.equal(viewerDeniedMetricWrite.res.statusCode, 403);

for (const prefix of ['/api/kpi', '/api/kpis']) {
  for (const role of ['auditor', 'viewer', 'operativo']) {
    const result = authorize({
      method: 'GET',
      path: `${prefix}/effective-health-summary/${batchId}`,
      role,
    });
    assert.equal(
      result.nextCalled,
      true,
      `${role} can read dashboard effective health summary from ${prefix}`
    );
  }

  const write = authorize({
    method: 'POST',
    path: `${prefix}/effective-health-summary/${batchId}`,
    role: 'viewer',
  });
  assert.equal(write.nextCalled, false, `viewer cannot write effective health summary from ${prefix}`);
  assert.equal(write.res.statusCode, 403);
}

const riskMatrixRead = authorize({
  method: 'GET',
  path: `/api/iso-risk-matrix/${batchId}/latest`,
  role: 'auditor',
});
assert.equal(riskMatrixRead.nextCalled, true, 'auditor can read ISO risk matrix');

const riskMatrixAdminWrite = authorize({
  method: 'PATCH',
  path: `/api/iso-risk-matrix/${batchId}/items/${batchId}/risk-inputs`,
  role: 'tenant_admin',
});
assert.equal(riskMatrixAdminWrite.nextCalled, true, 'tenant_admin can update ISO risk matrix inputs');

const riskMatrixAuditorWrite = authorize({
  method: 'PATCH',
  path: `/api/iso-risk-matrix/${batchId}/items/${batchId}/risk-inputs`,
  role: 'auditor',
});
assert.equal(riskMatrixAuditorWrite.nextCalled, false, 'auditor cannot update ISO risk matrix inputs');
assert.equal(riskMatrixAuditorWrite.res.statusCode, 403);
assert.equal(riskMatrixAuditorWrite.res.payload.code, 'RBAC_DENIED');

for (const path of ['/api/grc/gaps', `/api/grc/gaps/${batchId}`]) {
  const read = authorize({ method: 'GET', path, role: 'viewer' });
  assert.equal(read.nextCalled, true, `viewer can read GRC gaps route ${path}`);
}

for (const path of [
  `/api/grc/impact-graph/nodes/control/${batchId}/relationships`,
  `/api/grc/impact-graph/neighborhood/observation/${batchId}`,
  '/api/grc/priorities',
  `/api/grc/priorities/grc_gap/${batchId}`,
]) {
  const read = authorize({ method: 'GET', path, role: 'viewer' });
  assert.equal(read.nextCalled, true, `viewer can read GRC graph/priority route ${path}`);
  const write = authorize({ method: 'POST', path, role: 'viewer' });
  assert.equal(write.nextCalled, false, `viewer cannot write GRC graph/priority route ${path}`);
  assert.equal(write.res.statusCode, 403);
}

const gapEvaluate = authorize({ method: 'POST', path: '/api/grc/gaps/evaluate', role: 'auditor' });
assert.equal(gapEvaluate.nextCalled, true, 'auditor can evaluate deterministic GRC gap rules');

const gapTransition = authorize({ method: 'POST', path: `/api/grc/gaps/${batchId}/transitions`, role: 'auditor' });
assert.equal(gapTransition.nextCalled, true, 'auditor can transition GRC gaps through GRC route');

const gapViewerWriteDenied = authorize({ method: 'POST', path: '/api/grc/gaps/evaluate', role: 'viewer' });
assert.equal(gapViewerWriteDenied.nextCalled, false, 'viewer cannot evaluate GRC gaps');
assert.equal(gapViewerWriteDenied.res.statusCode, 403);

const knowledgeIngestionRead = authorize({ method: 'GET', path: '/api/knowledge-base/ingestions', role: 'viewer' });
assert.equal(knowledgeIngestionRead.nextCalled, true, 'viewer can read tenant knowledge ingestion metadata');

const knowledgeIngestionAdminWrite = authorize({ method: 'POST', path: '/api/knowledge-base/ingestions', role: 'tenant_admin' });
assert.equal(knowledgeIngestionAdminWrite.nextCalled, true, 'tenant_admin can ingest tenant knowledge documents');

const knowledgeIngestionAuditorWrite = authorize({ method: 'POST', path: '/api/knowledge-base/ingestions', role: 'auditor' });
assert.equal(knowledgeIngestionAuditorWrite.nextCalled, false, 'auditor cannot ingest tenant knowledge documents');
assert.equal(knowledgeIngestionAuditorWrite.res.statusCode, 403);

const knowledgeIngestionViewerWrite = authorize({ method: 'POST', path: '/api/knowledge-base/ingestions', role: 'viewer' });
assert.equal(knowledgeIngestionViewerWrite.nextCalled, false, 'viewer cannot ingest tenant knowledge documents');
assert.equal(knowledgeIngestionViewerWrite.res.statusCode, 403);

const definitions = listImportDefinitions();
assert.equal(definitions.length, 33);
assert.equal(
  definitions.filter(definition => definition.availability === 'importable_now').length,
  10
);
assert.equal(
  definitions.filter(definition => definition.availability === 'blocked').length,
  23
);

process.stdout.write(
  'Imports explicit RBAC: VERIFIED routes=10 definitions=33 operational=10 blocked=23\n'
);
