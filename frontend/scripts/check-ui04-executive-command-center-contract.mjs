import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const frontendRoot = path.basename(cwd) === 'frontend' ? cwd : path.join(cwd, 'frontend');
const repoRoot = path.basename(cwd) === 'frontend' ? path.dirname(cwd) : cwd;
const srcRoot = path.join(frontendRoot, 'src');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectRouteFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectRouteFiles(fullPath, acc);
    else if (/\/page\.(tsx|ts|jsx|js)$/.test(fullPath)) {
      acc.push(path.relative(repoRoot, fullPath).replaceAll(path.sep, '/'));
    }
  }
  return acc.sort();
}

const dashboardPagePath = path.join(srcRoot, 'app/dashboard/page.tsx');
const dashboardLayoutPath = path.join(srcRoot, 'app/dashboard/layout.tsx');
const dashboard = read(dashboardPagePath);
const dashboardLayout = read(dashboardLayoutPath);
const permissions = read(path.join(srcRoot, 'utils/mvpPermissions.ts'));
const permissionsAtHead = git(['show', 'HEAD:frontend/src/utils/mvpPermissions.ts']);

assert(fs.existsSync(dashboardPagePath), 'Executive route /dashboard must be preserved.');
assert(!fs.existsSync(path.join(srcRoot, 'app/centro-ejecutivo/page.tsx')), 'UI-04 must not create /centro-ejecutivo route.');
assert(!fs.existsSync(path.join(srcRoot, 'app/executive-center/page.tsx')), 'UI-04 must not create /executive-center route.');
assert(/return <>\{children\}<\/>;/.test(dashboardLayout), 'Dashboard layout must not wrap a second AppLayout.');
assert(/<AppLayout>/.test(dashboard), 'Dashboard page must keep the approved App Shell.');

[
  'ExecutiveAttentionPanel',
  'ExecutiveTrendPanel',
  'ExecutiveDataTrustPanel',
  'Requiere atención',
  'Prioridades ejecutivas',
  'Sin ranking fabricado',
].forEach((needle) => {
  assert(dashboard.includes(needle), `Executive command center must include ${needle}.`);
});

assert(/DataTrustIndicator/.test(dashboard), 'Executive center must reuse DataTrustIndicator.');
assert(/UniversalStateBlock/.test(dashboard), 'Executive center must reuse UniversalStateBlock.');
assert(/UniversalStateBadge/.test(dashboard), 'Executive center must reuse UniversalStateBadge.');
assert(!/ExecutiveTrustScore/.test(dashboard), 'Executive center must not create an ExecutiveTrustScore.');
assert(!/\/api\/executive|\/api\/command-center/.test(dashboard), 'Executive center must not introduce a new executive source of truth endpoint.');
assert(!/tenant[_-]?id\s*[:=]\s*['"][0-9a-f-]{8,}/i.test(dashboard), 'Executive center must not hardcode tenant identifiers.');
assert(!/demo|acme|fixture|mock/i.test(dashboard), 'Product dashboard must not include demo/mock labels.');

[
  "href: '/plan-accion'",
  "href: '/matriz-riesgo'",
  "href: '/no-conformidades'",
  "href: '/hallazgos'",
  "href: '/metricas'",
  "href: '/datos/calidad'",
].forEach((needle) => {
  assert(dashboard.includes(needle), `Executive priorities must navigate to an existing workspace via ${needle}.`);
});

assert(permissions === permissionsAtHead, 'mvpPermissions.ts must remain unchanged.');

const routeFilesAtHead = git(['ls-tree', '-r', '--name-only', 'HEAD', 'frontend/src/app'])
  .split('\n')
  .filter((line) => /\/page\.(tsx|ts|jsx|js)$/.test(line))
  .sort();
const routeFilesNow = collectRouteFiles(path.join(srcRoot, 'app'));

assert(routeFilesAtHead.length === 97, `Expected 97 App Router routes at HEAD; found ${routeFilesAtHead.length}.`);
assert(routeFilesNow.length === 97, `Expected 97 App Router routes now; found ${routeFilesNow.length}.`);
assert(JSON.stringify(routeFilesAtHead) === JSON.stringify(routeFilesNow), 'UI-04 must not add, delete, or rename routes.');

console.log('UI04_EXECUTIVE_COMMAND_CENTER_CONTRACT_PASS route=/dashboard routes=97->97 rbac=unchanged');
