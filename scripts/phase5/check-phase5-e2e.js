#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

const requiredRoutes = [
  'frontend/src/app/datos/page.tsx',
  'frontend/src/app/datos/catalogo/page.tsx',
  'frontend/src/app/datos/calidad/page.tsx',
  'frontend/src/app/datos/lineage/page.tsx',
  'frontend/src/app/metricas/page.tsx',
  'frontend/src/app/metricas/[id]/page.tsx',
  'frontend/src/app/encuestas/page.tsx',
  'frontend/src/app/encuestas/[id]/page.tsx',
  'frontend/src/app/evaluaciones/page.tsx',
  'frontend/src/app/tests/page.tsx',
  'frontend/src/app/eventos-perdida/page.tsx',
  'frontend/src/app/bi/page.tsx',
  'frontend/src/app/bi/dashboards/[id]/page.tsx',
  'frontend/src/app/reportes/studio/page.tsx',
  'frontend/src/app/reportes/generaciones/page.tsx',
];

for (const route of requiredRoutes) {
  const filePath = path.join(root, route);
  if (!fs.existsSync(filePath)) throw new Error(`Missing frontend route: ${route}`);
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes('Phase5Workspace')) throw new Error(`Route does not render Phase5Workspace: ${route}`);
}

const workspace = fs.readFileSync(path.join(root, 'frontend/src/components/phase5/Phase5Workspace.tsx'), 'utf8');
for (const requiredText of ['Cargando información gobernada', 'Requiere atención', 'No fue posible cargar']) {
  if (!workspace.includes(requiredText)) throw new Error(`Workspace missing UX state: ${requiredText}`);
}

const nav = fs.readFileSync(path.join(root, 'frontend/src/utils/mvpPermissions.ts'), 'utf8');
for (const href of ['/datos','/metricas','/encuestas','/tests','/eventos-perdida','/bi','/reportes/studio']) {
  if (!nav.includes(`href: '${href}'`)) throw new Error(`Navigation missing: ${href}`);
}

process.stdout.write(JSON.stringify({
  status: 'VERIFIED_PHASE5_E2E_STATIC',
  routes: requiredRoutes.length,
}) + '\n');
