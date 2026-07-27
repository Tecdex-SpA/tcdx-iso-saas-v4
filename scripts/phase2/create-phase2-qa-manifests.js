#!/usr/bin/env node
const path = require('path');
const { createManifest: createPhase2 } = require('./phase2-qa-manifest');
const { createManifest: createPhase1 } = require('../phase1/phase1-qa-manifest');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const tenantId = required('PHASE2_TENANT_ID');
const phase2 = createPhase2({
  tenantId,
  runId: required('PHASE2_QA_RUN_ID'),
  file: path.resolve(required('PHASE2_QA_MANIFEST')),
});
let phase1 = null;
if (process.env.PHASE1_QA_MANIFEST) {
  phase1 = createPhase1({
    tenantId,
    runId: required('PHASE1_QA_RUN_ID'),
    file: path.resolve(process.env.PHASE1_QA_MANIFEST),
  });
}
process.stdout.write(`QA manifests created: phase2=${phase2.run_id}${phase1 ? ` phase1=${phase1.run_id}` : ''}\n`);
