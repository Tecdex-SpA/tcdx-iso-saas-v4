#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const resultsPath = path.join(root, 'artifacts/phase5-5/browser-e2e-results.json');
const evidencePath = path.join(root, 'docs/phase5-5/browser-e2e-evidence.md');

const requiredTitles = [
  'login, tenant context and Portal GRC load against real backend',
  'crear métrica, configurar fuente, preview, publicar, ejecutar, resultado, explicación y lineage',
  'crear encuesta, publicar, campaña y scoring oficial',
  'crear assurance test, calcular muestra, registrar resultado y revisar',
  'crear evento de pérdida y ejecutar estadísticas oficiales',
  'crear dashboard, agregar widget oficial, publicar y snapshot',
  'crear reporte, generar PDF DOCX XLSX, aprobar y descargar artefactos',
  'consistencia entre Portal GRC, dominio, dashboard y reporte por cálculo oficial',
  'usuario restringido no puede persistir y Tenant B no ve datos de Tenant A',
  'accesibilidad WCAG AA en login y rutas críticas',
];

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing browser E2E results: ${path.relative(root, file)}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectSpecs(suite, out = []) {
  for (const spec of suite.specs || []) out.push(spec);
  for (const child of suite.suites || []) collectSpecs(child, out);
  return out;
}

const payload = readJson(resultsPath);
const specs = (payload.suites || []).flatMap((suite) => collectSpecs(suite));
const passedTitles = new Set();

for (const spec of specs) {
  const ok = spec.ok === true && (spec.tests || []).every((test) => test.status === 'expected' && (test.results || []).some((result) => result.status === 'passed'));
  if (ok) passedTitles.add(spec.title);
}

const missing = requiredTitles.filter((title) => !passedTitles.has(title));
if (payload.stats?.unexpected !== 0 || payload.stats?.skipped !== 0 || missing.length) {
  throw new Error(`Browser E2E evidence incomplete. missing=${missing.join('; ') || 'none'} unexpected=${payload.stats?.unexpected} skipped=${payload.stats?.skipped}`);
}

const evidence = fs.existsSync(evidencePath) ? fs.readFileSync(evidencePath, 'utf8') : '';
const requiredEvidencePatterns = [
  /Status:\s*COMPLETED\./,
  /Branch:\s*(?!unavailable\.)[^\r\n]+\./,
  /Commit:\s*[0-9a-f]{40}\./,
  /Chromium via Playwright/,
  /postgres:16-alpine/,
  /Tenant A, Tenant B, tenant admin A, tenant admin B, restricted user A/,
  /PDF: downloaded through backend, status 200/,
  /DOCX: downloaded through backend, status 200/,
  /XLSX: downloaded through backend, status 200/,
  /Content-Disposition and filename are validated/,
  /All \d+ browser E2E scenarios passed/,
];
const missingEvidence = requiredEvidencePatterns.filter((pattern) => !pattern.test(evidence)).map(String);
if (missingEvidence.length) {
  throw new Error(`Browser E2E markdown evidence is incomplete: ${missingEvidence.join('; ')}`);
}
if (!/Status:\s*COMPLETED\./.test(evidence) || !/All \d+ browser E2E scenarios passed/.test(evidence)) {
  throw new Error('Browser E2E markdown evidence does not reflect the passing Playwright run.');
}

console.log(JSON.stringify({ status: 'PHASE5_5_BROWSER_EVIDENCE_OK', scenarios: requiredTitles.length, duration_ms: payload.stats?.duration || null }));
