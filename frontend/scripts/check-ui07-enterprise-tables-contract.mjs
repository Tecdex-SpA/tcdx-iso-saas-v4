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

const permissions = read(path.join(srcRoot, 'utils/mvpPermissions.ts'));
const permissionsAtHead = git(['show', 'HEAD:frontend/src/utils/mvpPermissions.ts']);
assert(permissions === permissionsAtHead, 'mvpPermissions.ts must remain unchanged.');

const routeFilesAtHead = git(['ls-tree', '-r', '--name-only', 'HEAD', 'frontend/src/app'])
  .split('\n')
  .filter((line) => /\/page\.(tsx|ts|jsx|js)$/.test(line))
  .sort();
const routeFilesNow = collectRouteFiles(path.join(srcRoot, 'app'));
assert(routeFilesAtHead.length === 97, `Expected 97 App Router routes at HEAD; found ${routeFilesAtHead.length}.`);
assert(routeFilesNow.length === 97, `Expected 97 App Router routes now; found ${routeFilesNow.length}.`);
assert(JSON.stringify(routeFilesAtHead) === JSON.stringify(routeFilesNow), 'UI-07 must not add, delete, or rename routes.');

const productFiles = [
  'frontend/src/app/evidencias/page.tsx',
  'frontend/src/app/controles/page.tsx',
  'frontend/src/app/exportes/page.tsx',
  'frontend/src/components/phase3/Phase3Workspace.tsx',
  'frontend/src/components/phase5/Phase5Workspace.tsx',
  'frontend/src/components/risk-control/RiskRegisterWorkspace.tsx',
  'frontend/src/components/ui/enterprise/EnterpriseTableShell.tsx',
  'frontend/src/components/ui/enterprise/EnterpriseFilterBar.tsx',
  'frontend/src/components/ui/enterprise/EnterpriseRowActions.tsx',
  'frontend/src/components/ui/enterprise/index.ts',
  'frontend/src/app/globals.css',
];

const diff = git(['diff', '--unified=0', '--', ...productFiles]);
const addedLines = diff
  .split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  .join('\n');

const phase5 = read(path.join(srcRoot, 'components/phase5/Phase5Workspace.tsx'));
const phase3 = read(path.join(srcRoot, 'components/phase3/Phase3Workspace.tsx'));
const risks = read(path.join(srcRoot, 'components/risk-control/RiskRegisterWorkspace.tsx'));
const evidences = read(path.join(srcRoot, 'app/evidencias/page.tsx'));
const controls = read(path.join(srcRoot, 'app/controles/page.tsx'));
const exportsPage = read(path.join(srcRoot, 'app/exportes/page.tsx'));
const tableShell = read(path.join(srcRoot, 'components/ui/enterprise/EnterpriseTableShell.tsx'));
const filterBar = read(path.join(srcRoot, 'components/ui/enterprise/EnterpriseFilterBar.tsx'));
const rowActions = read(path.join(srcRoot, 'components/ui/enterprise/EnterpriseRowActions.tsx'));
const dataTrust = read(path.join(srcRoot, 'components/ui/enterprise/DataTrustIndicator.tsx'));
const universalState = read(path.join(srcRoot, 'components/ui/enterprise/UniversalStateBlock.tsx'));

assert(/density\?: 'compact' \| 'comfortable'/.test(tableShell), 'EnterpriseTableShell must expose enterprise density.');
assert(/EnterpriseFilterBar/.test(filterBar), 'EnterpriseFilterBar primitive must exist.');
assert(/EnterpriseRowActions/.test(rowActions), 'EnterpriseRowActions primitive must exist.');

assert(/EnterpriseTableShell/.test(phase5), '/datos Phase5 table must use EnterpriseTableShell.');
assert(/EnterpriseFilterBar/.test(phase5), '/datos Phase5 table must use EnterpriseFilterBar.');
assert(/EnterpriseRowActions/.test(phase5), '/datos Phase5 table must use EnterpriseRowActions.');
assert(/type="search"/.test(phase5) && /Buscar en/.test(phase5), '/datos table search must have search input and Spanish placeholder.');
assert(/UniversalStateBlock/.test(phase5), '/datos table empty/error/loading states must reuse UniversalStateBlock.');

assert(/EnterpriseTableShell/.test(phase3), '/indicadores Phase3 table must use EnterpriseTableShell.');
assert(/EnterpriseFilterBar/.test(phase3), '/indicadores Phase3 filters must use EnterpriseFilterBar.');
assert(/P[aá]gina/.test(phase3), 'Phase3 pagination must remain visible.');

assert(/EnterpriseFilterBar/.test(risks), '/riesgos filters must use EnterpriseFilterBar.');
assert(/aria-sort/.test(risks) && /↑/.test(risks) && /↓/.test(risks), '/riesgos sorting affordance must remain visible and accessible.');
assert(/Buscar riesgo, activo, responsable o fuente/.test(risks), '/riesgos search placeholder must be operational and Spanish.');
assert(/dataStateLabel\(row\.sourceState, locale\)/.test(risks), '/riesgos source column must expose state text, not only color.');

assert(/EnterpriseFilterBar/.test(evidences), '/evidencias must use EnterpriseFilterBar for dense filters.');
assert(/UniversalStateBlock/.test(evidences), '/evidencias empty state must use UniversalStateBlock.');
assert(/Buscar evidencia, archivo, control o cláusula/.test(evidences), '/evidencias search placeholder must be Spanish and useful.');

assert(/EnterpriseFilterBar/.test(controls), '/controles must use EnterpriseFilterBar for dense filters.');
assert(/type="search"/.test(controls), '/controles search input must be explicit.');
assert(/activos ·/.test(controls), '/controles must expose operational counts in the filter bar.');

assert(/EnterpriseTableShell/.test(exportsPage), '/exportes history must use EnterpriseTableShell.');
assert(/EnterpriseRowActions/.test(exportsPage), '/exportes row actions must use EnterpriseRowActions.');
assert(/scope="col"/.test(exportsPage), '/exportes table headers must expose scope.');
assert(/Desde/.test(exportsPage) && /Hasta/.test(exportsPage), '/exportes date filters must have Spanish labels.');

for (const label of ['trusted_with_warnings', 'low_confidence', 'insufficient_data']) {
  assert(dataTrust.includes(label), `DataTrustIndicator must continue normalizing ${label}.`);
}
for (const state of ['empty', 'insufficient', 'not_available', 'error', 'stale', 'partial', 'loading']) {
  assert(universalState.includes(state), `UniversalStateBlock must continue supporting ${state}.`);
}

assert(!/\/api\//.test(addedLines), 'UI-07 product additions must not introduce frontend API endpoints.');
assert(!/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/.test(addedLines), 'UI-07 product additions must not introduce new mutations.');
assert(!/tenant[_-]?id\s*[:=]\s*['"][0-9a-f-]{8,}/i.test(addedLines), 'UI-07 product additions must not hardcode tenant identifiers.');
assert(!/\b(acme|demo)\b/i.test(addedLines), 'UI-07 product additions must not add demo data.');
assert(!/(value|snapshot\.value)\s*(\|\||\?\?)\s*0/.test(addedLines), 'UI-07 product additions must not coerce null values to zero.');

console.log('UI07_ENTERPRISE_TABLES_CONTRACT_PASS routes=97->97 rbac=unchanged');
