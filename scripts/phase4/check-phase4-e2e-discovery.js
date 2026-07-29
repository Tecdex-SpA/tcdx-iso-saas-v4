#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const file = path.join(root, 'frontend/tests/e2e/phase4-commercial.spec.ts');
if (!fs.existsSync(file)) throw new Error('Phase 4 E2E spec missing');
const source = fs.readFileSync(file, 'utf8');
const scenarios = ['publica plan y lo asigna', 'tenant admin ve capabilities', 'sin capability recibe bloqueo', 'downgrade conserva historicos', 'Tenant B no ve Tenant A', 'trial expira', 'pack quickstart', 'dealer ve solo su cartera', 'cache cambia al cambiar tenant', 'auditoria muestra before after'];
const missing = scenarios.filter((scenario) => !source.includes(scenario));
if (missing.length) throw new Error(`Phase 4 E2E discovery gaps: ${missing.join(', ')}`);
process.stdout.write(`Phase 4 E2E discovery: VERIFIED scenarios=${scenarios.length}\n`);
