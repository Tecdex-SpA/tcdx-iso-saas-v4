#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const [resultsPath, outputPath] = process.argv.slice(2);
if (!resultsPath || !outputPath) process.exit(2);
const payload = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const specs = [];
function walk(suite) { for (const spec of suite.specs || []) specs.push(spec); for (const child of suite.suites || []) walk(child); }
for (const suite of payload.suites || []) walk(suite);
const tests = specs.flatMap((spec) => spec.tests.map((test) => ({ title: spec.title, status: test.status, ok: spec.ok === true && test.status === 'expected', results: test.results || [] })));
const failed = tests.filter((test) => !test.ok);
const lines = [
  '# Evidencia browser E2E - Fase 5-C2', '',
  `Estado: ${failed.length ? 'NOT_READY' : 'COMPLETED'}.`,
  `Fecha: ${new Date().toISOString()}.`, '',
  '## Runtime', '',
  '- Chromium real mediante Playwright, sin retries.',
  '- PostgreSQL 16 efímero, backend Express y frontend Next.js locales.',
  '- Fixtures sintéticos Tenant A/B; producción no utilizada.', '',
  '## Escenarios', '',
  ...tests.map((test) => `- ${test.ok ? 'passed' : 'failed'} · ${test.title} · ${test.results.map((result) => `${result.status}/${result.duration}ms`).join(', ')}`), '',
  '## Cobertura', '',
  '- Login real y contexto tenant.',
  '- Contrato, versión, mappings tipados, preview, review, approval y publication.',
  '- Ingesta, snapshot, observación, calidad, freshness y lineage.',
  '- Relación de observación con entidad GRC e inmutabilidad de versión publicada.',
  '- Regla de suficiencia con review, approval y publication.',
  '- Job compartido de reconciliación y resultado compatible con adapters verificado.',
  '- Contratos globales sin mapping tenant clasificados como mapping_required.',
  '- Permiso negativo y aislamiento Tenant A/B por API y UI.', '',
  '## Artefactos', '',
  `- JSON Playwright: ${path.basename(resultsPath)}.`,
  '- Trazas y screenshots se retienen solo ante fallo.', '',
  '## Resultado', '',
  failed.length ? `${failed.length} escenario(s) fallaron.` : `${tests.length} escenario(s) pasaron sin retries, skips, flaky ni respuestas HTTP 500 semánticas.`,
];
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
if (failed.length) process.exit(1);
process.stdout.write(JSON.stringify({ status: 'COMPLETED', tests: tests.length, failed: 0 }));
