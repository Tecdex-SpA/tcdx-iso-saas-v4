'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const files = [
  'frontend/src/app/bia/[id]/page.tsx',
  'frontend/src/app/conectores/[id]/page.tsx',
  'frontend/src/app/continuidad/planes/[id]/page.tsx',
  'frontend/src/app/continuidad/pruebas/[id]/page.tsx',
  'frontend/src/app/crisis/[id]/page.tsx',
  'frontend/src/app/incidentes/[id]/page.tsx',
  'frontend/src/app/indicadores/[id]/page.tsx',
  'frontend/src/app/privacidad/actividades/[id]/page.tsx',
  'frontend/src/app/procesos/[id]/page.tsx',
  'frontend/src/app/proveedores/[id]/page.tsx',
  'frontend/src/app/riesgo-cuantitativo/[id]/page.tsx',
  'frontend/src/app/servicios/[id]/page.tsx',
  'frontend/src/app/unidades/[id]/page.tsx',
];

let changed = 0;

for (const relativePath of files) {
  const absolutePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const updated = source.replace(
    /PageProps<'[^']+'>/g,
    '{ params: Promise<{ id: string }> }'
  );

  if (updated !== source) {
    fs.writeFileSync(absolutePath, updated, 'utf8');
    changed += 1;
  }
}

console.log(`Dynamic page props actualizados: ${changed}`);
