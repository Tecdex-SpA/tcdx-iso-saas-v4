#!/usr/bin/env node
const fs = require('fs');

const file = 'frontend/tests/e2e/phase1-grc.spec.ts';
const source = fs.readFileSync(file, 'utf8');
const required = [
  'feature flag y permisos',
  'bootstrap explícito',
  'administrador crea workflow',
  'publica versión',
  'usuario no autorizado',
  'instancia conserva versión',
  'evidencia recurrente',
  'rechazo exige causa',
  'readiness es determinista',
  'nueve frameworks',
  'auditoría avanzada',
  'Tenant A no consulta',
  'aprobación con quorum',
  'rechazo de aprobación',
  'scheduler es idempotente',
  'revisión supervisora',
  'exportación avanzada',
  'feature flag apagado',
  'observabilidad expone',
  'administración SaaS',
  'persistencia web tras recarga',
  'instancia operada desde la web',
  'workflow editado desde la web',
  'evidencia operada desde la web',
  'mapping operado desde la web',
  'auditoría operada desde la web',
];
const missing = required.filter(marker => !source.includes(marker));
const forbidden = [/test\.skip\s*\(/, /test\.fixme\s*\(/, /continue-on-error/, /\|\|\s*true/];
if (missing.length || forbidden.some(pattern => pattern.test(source))) {
  console.error(`Phase 1 E2E contract failed. Missing: ${missing.join(', ') || 'none'}`);
  process.exit(1);
}
console.log(`Phase 1 E2E contracts: OK markers=${required.length}`);
