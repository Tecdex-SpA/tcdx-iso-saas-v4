#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const routes = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-visual-routes.json'), 'utf8'));
const resultsFile = path.resolve(process.env.DEMO_BROWSER_RESULTS_FILE || path.join(root, 'artifacts/demo/demo-browser-results.json'));
if (!fs.existsSync(resultsFile)) throw new Error('Browser result JSON is missing');
const result = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const tests = [];
function walk(suite) { for (const spec of suite.specs || []) tests.push(spec); for (const child of suite.suites || []) walk(child); }
for (const suite of result.suites || []) walk(suite);
const rows = [];
for (const user of ['admin','auditor']) {
  for (const item of routes) {
    const title = `${user} ${item.route}`;
    const spec = tests.find((candidate) => candidate.title === title);
    const passed = spec?.tests?.some((entry) => entry.results?.some((run) => run.status === 'passed')) || false;
    const clean = item.route.split('?')[0];
    const slug = clean.replace(/^\//,'').replace(/\//g,'-') || 'home';
    const screenshot = `visual-evidence/${slug}-${user}.png`;
    const hasScreenshot = fs.existsSync(path.join(root, 'docs/demo', screenshot));
    rows.push(`| ${item.route} | ${user} | \`${item.endpoint}\` | ${item.minimum} | ${passed ? `≥${item.minimum}` : 'no observado'} | ${hasScreenshot ? `[captura](${screenshot})` : 'no requerida/no generada'} | ${passed ? 'PASS' : 'FAIL'} | ${passed ? 'API y representación visual verificadas' : 'Revisar resultado Playwright'} |`);
  }
}
const markdown = `# Evidencia browser E2E — Demo Tecdex\n\nGenerada: ${new Date().toISOString()}  \nAmbiente: QA controlado (nunca producción)\n\n| ruta | usuario | endpoint | conteo esperado | conteo observado | screenshot | resultado | observaciones |\n|---|---|---|---:|---:|---|---|---|\n${rows.join('\n')}\n`;
fs.writeFileSync(path.join(root, 'docs/demo/demo-browser-e2e-evidence.md'), markdown);
if (rows.some((row) => row.includes('| FAIL |'))) process.exitCode = 1;
