#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const routesRoot = path.join(repoRoot, 'backend/src/routes');
const frontendRoot = path.join(repoRoot, 'frontend/src');
const outputRoot = path.join(repoRoot, 'docs/final-phases/runtime');

function filesUnder(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  });
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}

const routeFiles = filesUnder(routesRoot, (file) => file.endsWith('.js'));
const frontendFiles = filesUnder(frontendRoot, (file) => /\.(ts|tsx|js|jsx)$/.test(file));
const frontendSources = frontendFiles.map((file) => ({ file: relative(file), source: fs.readFileSync(file, 'utf8') }));
const endpointPattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
const apiLiteralPattern = /['"](\/api\/[A-Za-z0-9_./:${}-]+)['"]/g;
const endpoints = [];

for (const file of routeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = endpointPattern.exec(source))) {
    const method = match[1].toUpperCase();
    const route = match[2];
    const marker = route.replace(/:[A-Za-z0-9_]+/g, '').replace(/\/$/, '');
    const consumers = frontendSources
      .filter(({ source: frontendSource }) => marker && frontendSource.includes(marker))
      .map(({ file: consumer }) => consumer);
    const localContext = source.slice(Math.max(0, match.index - 400), Math.min(source.length, match.index + 700));
    endpoints.push({
      method,
      route,
      route_file: relative(file),
      frontend_consumers: consumers,
      authorization_static_signal: /requirePermission|requireCapability|requireEntitlement|authenticate|authMiddleware/.test(localContext) ? 'present_near_route' : 'not_proven_by_static_scan',
      disposition: consumers.length ? 'consumer_detected' : 'technical_or_unverified_consumer',
    });
  }
}

const frontendApiLiterals = new Map();
for (const { file, source } of frontendSources) {
  let match;
  while ((match = apiLiteralPattern.exec(source))) {
    const apiPath = match[1];
    const files = frontendApiLiterals.get(apiPath) || [];
    files.push(file);
    frontendApiLiterals.set(apiPath, files);
  }
}

endpoints.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));
const summary = {
  generated_at: new Date().toISOString(),
  route_files: routeFiles.length,
  frontend_files_scanned: frontendFiles.length,
  endpoints: endpoints.length,
  endpoints_with_detected_frontend_consumer: endpoints.filter((entry) => entry.frontend_consumers.length).length,
  endpoints_without_detected_frontend_consumer: endpoints.filter((entry) => !entry.frontend_consumers.length).length,
  frontend_api_literals: frontendApiLiterals.size,
};

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, '02_endpoint_consumer_inventory.json'), `${JSON.stringify({ summary, endpoints, frontend_api_literals: Object.fromEntries(frontendApiLiterals) }, null, 2)}\n`);
const rows = endpoints.map((entry) => `| ${entry.method} | \`${entry.route}\` | \`${entry.route_file}\` | ${entry.frontend_consumers.length ? entry.frontend_consumers.map((consumer) => `\`${consumer}\``).join('<br>') : 'No detectado estáticamente; requiere clasificación técnica.'} | ${entry.authorization_static_signal} | ${entry.disposition} |`);
const report = [
  '# Matriz endpoint-consumer de 5-C1',
  '',
  `Generada por \`scripts/phase5-c1/generate-runtime-inventory.js\` el ${summary.generated_at}. El análisis es estático y conservador: una ausencia de coincidencia no implica endpoint huérfano; puede ser un job, descarga, callback o consumo dinámico.`,
  '',
  `- Archivos de rutas: ${summary.route_files}`,
  `- Archivos frontend analizados: ${summary.frontend_files_scanned}`,
  `- Endpoints detectados: ${summary.endpoints}`,
  `- Con consumidor frontend detectado: ${summary.endpoints_with_detected_frontend_consumer}`,
  `- Sin consumidor frontend detectado: ${summary.endpoints_without_detected_frontend_consumer}`,
  '',
  'La evidencia positiva, negativa y cross-tenant de las rutas críticas está en `04_runtime_rbac_evidence.md` y `06_browser_e2e_evidence.md`. Los endpoints sin consumidor detectado quedan clasificados como técnicos o pendientes de disposición, nunca como operativos por esta matriz.',
  '',
  '| Método | Ruta declarada | Archivo | Consumidor frontend detectado | Señal de autorización | Disposición |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  'El inventario máquina-legible completo, incluidos los literales API del frontend, está en `02_endpoint_consumer_inventory.json`.',
  '',
].join('\n');
fs.writeFileSync(path.join(outputRoot, '02_endpoint_consumer_matrix.md'), report);
console.log(JSON.stringify(summary));
