#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requiredFiles = [
  'database/migrations/20260803_phase5_c2_semantic_layer.sql',
  'scripts/phase5-c2/apply-phase5-c2-migration.js',
  'backend/src/services/semantic/semanticBootstrap.service.js',
  'backend/src/services/semantic/typedTransformations.js',
  'backend/src/services/semantic/semanticEvaluation.service.js',
  'backend/src/services/semantic/semanticLayer.service.js',
  'backend/src/routes/phase5.routes.js',
  'frontend/src/app/datos/semantica/page.tsx',
  'frontend/src/components/semantic/SemanticLayerWorkspace.tsx',
];

const failures = [];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) failures.push(`missing:${file}`);
if (!failures.length) {
  const migration = read(requiredFiles[0]);
  const service = read('backend/src/services/semantic/semanticLayer.service.js');
  const routes = read('backend/src/routes/phase5.routes.js');
  const deploy = read('scripts/deploy-vms.sh');
  const tables = ['data_source_contracts','data_source_contract_versions','data_source_field_mappings','grc_observations','grc_observation_relations','metric_sufficiency_rules'];
  for (const table of tables) if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) failures.push(`table:${table}`);
  for (const endpoint of ['source-contracts','reconciliation','versions/:versionId/preview','versions/:versionId/assessment','mappings/:mappingId/validate','observations/:observationId/lineage','observations/:observationId/relations','sufficiency-rules','jobs/:jobType','jobs/id/:jobId/execute']) {
    if (!routes.includes(endpoint)) failures.push(`endpoint:${endpoint}`);
  }
  for (const token of ['eval(', 'new Function', 'child_process', 'tenant_id=${', 'SELECT * FROM ${']) {
    if (service.includes(token)) failures.push(`unsafe:${token}`);
  }
  const phase5 = deploy.indexOf('scripts/phase5/apply-phase5-migration.js');
  const phase5c2 = deploy.indexOf('scripts/phase5-c2/apply-phase5-c2-migration.js');
  const backend = deploy.indexOf('deploy_remote "backend"');
  if (!(phase5 >= 0 && phase5c2 > phase5 && backend > phase5c2)) failures.push('deploy-order');
  if (!migration.includes('protect_semantic_source_snapshot') || !migration.includes('reject_published_semantic_version_change')) failures.push('immutability');
  if (!migration.includes('allowed_joins jsonb') || !service.includes('validateAllowedJoins')) failures.push('allowlisted-joins');
  if (!service.includes('reconcileLegacyContracts') || !service.includes('official_formula_source_contracts')) failures.push('legacy-reconciliation');
  if (!service.includes('executeJob') || !service.includes('maxAttempts') || !service.includes('timeoutMs')) failures.push('job-execution-contract');
  if (!migration.includes("'data.semantic_layer'")) failures.push('capability');
  if (!routes.includes("requiredPermission: permission")) failures.push('permission-enforcement');
}

if (failures.length) {
  process.stderr.write(`Phase 5-C2 contract check failed: ${failures.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write('Phase 5-C2 contract check passed.\n');
