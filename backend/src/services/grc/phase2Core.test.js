const assert = require('assert');
const {
  EVENT_NAMES,
  assertTransition,
  calculateIncidentSeverity,
  evaluateRules,
  scoreSupplierAssessment,
} = require('./phase2Rules');
const {
  decryptCredential,
  encryptCredential,
  hashToken,
  redactIntegration,
} = require('./phase2Crypto');
const { normalizeRecord, pullConnectorRecords } = require('./phase2ConnectorAdapters');
const { createPhase2Service, Phase2Error } = require('./phase2.service');

async function run() {
  assert.strictEqual(EVENT_NAMES.size, 38);
  assert.strictEqual(assertTransition('incident', 'reported', 'triaged'), true);
  assert.throws(
    () => assertTransition('incident', 'reported', 'closed'),
    error => error.code === 'PHASE2_TRANSITION_INVALID'
  );

  const severity = calculateIncidentSeverity({
    service_criticality: 'critical',
    process_criticality: 'high',
    asset_criticality: 'high',
    supplier_criticality: 'medium',
    privacy_impact: true,
    regulatory_impact: true,
    customer_impact: true,
    duration_impact: 'medium',
    financial_impact: 'medium',
  });
  assert.strictEqual(severity.severity, 'critical');
  assert.strictEqual(severity.formulaVersion, 'incident-severity-v1');
  assert.strictEqual(Object.keys(severity.contributions).length, 9);

  const score = scoreSupplierAssessment({
    questions: [{ id: 'q1', weight: 2 }, { id: 'q2', weight: 1 }],
    answers: [{ question_id: 'q1', score: 100 }, { question_id: 'q2', score: 40 }],
  });
  assert.strictEqual(score.score, 80);
  assert.match(score.limitations[0], /no aprueba/i);

  const rejectedEffects = evaluateRules('evidence.rejected', {
    tenant_control_id: '10000000-0000-4000-8000-000000000001',
  });
  assert(rejectedEffects.some(effect => effect.kind === 'assurance' && effect.status === 'ineffective'));
  assert(rejectedEffects.some(effect => effect.kind === 'alert'));
  const externalEffects = evaluateRules('connector.record.normalized', {
    provenance: { provider: 'github' },
    alert: { code: 'BRANCH_PROTECTION_DISABLED', severity: 'high' },
  });
  assert(externalEffects.some(effect => effect.kind === 'metric'));
  assert(externalEffects.some(effect => effect.kind === 'alert'));

  const environment = { CONNECTOR_CREDENTIAL_ENCRYPTION_KEY: 'phase2-controlled-test-key' };
  const envelope = encryptCredential({ access_token: 'secret-value', base_url: 'https://example.test' }, environment);
  assert.strictEqual(envelope.algorithm, 'aes-256-gcm');
  assert(!JSON.stringify(envelope).includes('secret-value'));
  assert.deepStrictEqual(
    decryptCredential(envelope, environment),
    { access_token: 'secret-value', base_url: 'https://example.test' }
  );
  assert.strictEqual(hashToken('a'), hashToken('a'));
  const redacted = redactIntegration({
    id: 'connector',
    credential_envelope: envelope,
    encrypted_access_token: 'legacy-secret',
    oauth_state_hash: 'state',
  });
  assert.strictEqual(redacted.credentials_configured, true);
  assert.strictEqual(redacted.credential_envelope, undefined);
  assert(!JSON.stringify(redacted).includes('legacy-secret'));

  const normalized = normalizeRecord('github', {
    type: 'repository',
    id: '1',
    version: '1',
    observed_at: '2026-07-27T00:00:00.000Z',
    data: { name: 'controlled' },
    provenance: { mode: 'sandbox' },
  });
  assert.strictEqual(normalized.external_type, 'repository');
  assert.strictEqual(normalized.payload_hash.length, 64);

  for (const provider of ['microsoft_graph', 'google_workspace', 'jira', 'github']) {
    const pulled = await pullConnectorRecords({
      provider,
      mode: 'sandbox',
      clock: () => Date.parse('2026-07-27T00:00:00.000Z'),
    });
    assert(pulled.records.length >= 3);
    assert(pulled.records.every(record => record.provenance.controlled_fixture === true));
    assert(pulled.records.every(record => record.payload_hash.length === 64));
  }

  const connectorGate = createPhase2Service({
    async query() {
      throw new Error('A tenant connector gate must reject before database access.');
    },
  });
  assert.deepStrictEqual(await connectorGate.listConnectors('tenant', 'tenant_admin'), []);
  assert.deepStrictEqual(await connectorGate.listConnectorRuns('tenant', {}, 'tenant_admin'), []);
  assert.strictEqual(
    (await connectorGate.integrationHealth('tenant', 'tenant_admin')).operational_status,
    'no_disponible'
  );
  for (const operation of [
    () => connectorGate.createConnector({
      tenantId: 'tenant', userId: 'user', role: 'tenant_admin', body: {},
    }),
    () => connectorGate.updateConnector({
      tenantId: 'tenant', userId: 'user', role: 'tenant_admin', id: 'connector', body: {},
    }),
    () => connectorGate.prepareConnectorOAuth({
      tenantId: 'tenant', role: 'tenant_admin', id: 'connector',
    }),
    () => connectorGate.runConnector({
      tenantId: 'tenant', userId: 'user', role: 'tenant_admin', id: 'connector',
    }),
  ]) {
    await assert.rejects(
      operation(),
      error => error instanceof Phase2Error
        && error.code === 'CONNECTOR_NOT_AVAILABLE'
        && error.status === 403
    );
  }

  console.log('grc Phase 2 core tests: OK');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
