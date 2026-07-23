const assert = require('assert');
const {
  calculateReadiness,
  nextOccurrence,
  scoreEvidence,
  validateWorkflowDraft,
} = require('./grcRules');

function run() {
  const monthly = nextOccurrence({ frequency: 'monthly', from: '2026-01-31T00:00:00Z' });
  assert.equal(monthly.toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(nextOccurrence({ frequency: 'event', from: '2026-01-01T00:00:00Z' }), null);

  const quality = scoreEvidence({
    status: 'approved',
    validated: true,
    expiresAt: '2027-01-01',
    now: '2026-01-01',
    description: 'Registro aprobado',
    fileName: 'evidence.pdf',
    mimeType: 'application/pdf',
    sourceType: 'manual',
    contentHash: 'abc',
    ownerId: 'user',
    consistent: true,
    coverage: 100,
  });
  assert.equal(quality.score, 100);
  assert.equal(quality.formulaVersion, 'evidence-quality-v1');

  const readinessA = calculateReadiness([
    { code: 'controls', score: 80, weight: 2 },
    { code: 'evidence', score: 50, weight: 1 },
  ]);
  const readinessB = calculateReadiness([
    { code: 'controls', score: 80, weight: 2 },
    { code: 'evidence', score: 50, weight: 1 },
  ]);
  assert.equal(readinessA.score, 70);
  assert.equal(readinessA.inputHash, readinessB.inputHash);

  const workflow = validateWorkflowDraft({
    states: [
      { code: 'draft', state_type: 'initial' },
      { code: 'approved', state_type: 'terminal' },
    ],
    transitions: [{ code: 'approve', from_state: 'draft', to_state: 'approved' }],
  });
  assert.equal(workflow.valid, true);
  assert.deepEqual(workflow.errors, []);

  const invalid = validateWorkflowDraft({ states: [], transitions: [] });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('WORKFLOW_REQUIRES_ONE_INITIAL_STATE'));

  console.log('grcRules tests: OK');
}

run();
