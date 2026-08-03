#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const files = [
  'backend/src/services/semantic/semanticLayer.service.js',
  'backend/src/services/semantic/typedTransformations.js',
  'backend/src/routes/phase5.routes.js',
  'database/migrations/20260803_phase5_c2_semantic_layer.sql',
];
const combined = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const failures = [];
const required = ['requireCommercialCapability(\'data.semantic_layer\')','semantic.contracts.publish','semantic.observations.ingest','SEMANTIC_ZERO_FALLBACK_FORBIDDEN','quoteIdentifier','tenantId(scope)','validateAllowedJoins','SEMANTIC_GLOBAL_FORBIDDEN'];
for (const token of required) if (!combined.includes(token)) failures.push(`missing:${token}`);
for (const pattern of [/postgres(?:ql)?:\/\/[^\s'"`]+:[^\s'"`]+@/i, /BEGIN (RSA|OPENSSH) PRIVATE KEY/, /password\s*=\s*['"][^'"]+/i]) {
  if (pattern.test(combined)) failures.push(`secret:${pattern}`);
}
if (/\beval\s*\(|\bFunction\s*\(/.test(combined)) failures.push('configurable-code-execution');
if (failures.length) {
  process.stderr.write(`Phase 5-C2 security check failed: ${failures.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write('Phase 5-C2 security check passed.\n');
