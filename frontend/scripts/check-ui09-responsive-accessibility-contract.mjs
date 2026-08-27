import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const frontendRoot = path.basename(cwd) === 'frontend' ? cwd : path.join(cwd, 'frontend');
const repoRoot = path.basename(cwd) === 'frontend' ? path.dirname(cwd) : cwd;
const srcRoot = path.join(frontendRoot, 'src');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
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

const permissions = read('frontend/src/utils/mvpPermissions.ts');
const permissionsAtHead = git(['show', 'HEAD:frontend/src/utils/mvpPermissions.ts']);
assert(permissions === permissionsAtHead, 'mvpPermissions.ts must remain unchanged.');

const routeFilesAtHead = git(['ls-tree', '-r', '--name-only', 'HEAD', 'frontend/src/app'])
  .split('\n')
  .filter((line) => /\/page\.(tsx|ts|jsx|js)$/.test(line))
  .sort();
const routeFilesNow = collectRouteFiles(path.join(srcRoot, 'app'));
assert(routeFilesAtHead.length === 97, `Expected 97 App Router routes at HEAD; found ${routeFilesAtHead.length}.`);
assert(routeFilesNow.length === 97, `Expected 97 App Router routes now; found ${routeFilesNow.length}.`);
assert(JSON.stringify(routeFilesAtHead) === JSON.stringify(routeFilesNow), 'UI-09 must not add, delete, or rename routes.');

const changedFiles = git(['diff', '--name-only'])
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(!changedFiles.some((file) => file.startsWith('backend/')), 'UI-09 must not change backend files.');
assert(!changedFiles.some((file) => /frontend\/src\/app\/.*\/route\.(ts|js)$/.test(file)), 'UI-09 must not introduce App Router API handlers.');

const productFiles = changedFiles.filter((file) => file.startsWith('frontend/src/'));
const productDiff = productFiles.length ? git(['diff', '--unified=0', '--', ...productFiles]) : '';
const addedLines = productDiff
  .split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  .join('\n');

assert(!/\/api\//.test(addedLines), 'UI-09 product additions must not introduce new frontend API endpoints.');
assert(!/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/.test(addedLines), 'UI-09 product additions must not introduce new mutations.');
assert(!/tenant[_-]?id\s*[:=]\s*['"][0-9a-f-]{8,}/i.test(addedLines), 'UI-09 product additions must not hardcode tenant identifiers.');
assert(!/\b(acme|demo)\b/i.test(addedLines), 'UI-09 product additions must not add demo data.');
assert(!/(value|snapshot\.value)\s*(\|\||\?\?)\s*0/.test(addedLines), 'UI-09 product additions must not coerce null values to zero.');

const globals = read('frontend/src/app/globals.css');
const tableShell = read('frontend/src/components/ui/enterprise/EnterpriseTableShell.tsx');
const filterBar = read('frontend/src/components/ui/enterprise/EnterpriseFilterBar.tsx');
const riskTabs = read('frontend/src/components/risk-control/RiskControlWorkspaceShell.tsx');
const domainTabs = read('frontend/src/components/enterprise-domain/EnterpriseDomainWorkspaceShell.tsx');
const header = read('frontend/src/components/Header.tsx');
const matrix = read('frontend/src/app/matriz-riesgo/page.tsx');
const universalState = read('frontend/src/components/ui/enterprise/UniversalStateBlock.tsx');
const dataTrust = read('frontend/src/components/ui/enterprise/DataTrustIndicator.tsx');

assert(/\.enterprise-tab-scroll/.test(globals), 'Global CSS must define enterprise-tab-scroll.');
assert(/data-ui09-scroll-region/.test(globals), 'Global CSS must style UI-09 scroll regions.');
assert(/button:disabled[\s\S]*?opacity:\s*0\.74/.test(globals), 'Global disabled affordance must remain strengthened.');
assert(/outline:\s*2px solid rgba\(240,\s*114,\s*29/.test(globals), 'Global focus-visible outline must remain visible.');

assert(/scrollLabel\?:\s*string/.test(tableShell), 'EnterpriseTableShell must expose scrollLabel.');
assert(/role="region"/.test(tableShell), 'EnterpriseTableShell scroll container must keep role=region.');
assert(/aria-label=\{regionLabel\}/.test(tableShell), 'EnterpriseTableShell scroll container must keep an accessible name.');
assert(/tabIndex=\{0\}/.test(tableShell), 'EnterpriseTableShell scroll container must stay keyboard reachable.');
assert(/data-ui09-scroll-region="true"/.test(tableShell), 'EnterpriseTableShell must keep the UI-09 scroll marker.');

assert(/aria-live="polite"/.test(filterBar), 'EnterpriseFilterBar count must keep aria-live=polite.');

for (const [label, source] of [['RiskControlWorkspaceShell', riskTabs], ['EnterpriseDomainWorkspaceShell', domainTabs]]) {
  assert(/enterprise-tab-scroll/.test(source), `${label} must keep tab overflow affordance.`);
  assert(/aria-describedby=\{scrollHelpId\}/.test(source), `${label} tabs must keep scroll help association.`);
  assert(/sr-only/.test(source), `${label} tabs must keep screen-reader scroll help.`);
  assert(/aria-current=\{active \? 'page' : undefined\}/.test(source), `${label} tabs must preserve active tab semantics.`);
}

assert(/event\.key === 'Escape'/.test(header), 'Header must handle Escape.');
assert(/notificationsButtonRef\.current\?\.focus\(\)/.test(header), 'Header must return focus to notifications trigger.');
assert(/userMenuButtonRef\.current\?\.focus\(\)/.test(header), 'Header must return focus to user menu trigger.');
assert(/aria-haspopup="listbox"/.test(header), 'Header search combobox must expose listbox popup.');
assert(/role="listbox"/.test(header), 'Header search results must keep role=listbox.');
assert(/role="option"/.test(header), 'Header search results must keep role=option.');
assert(/aria-selected=\{activeIndex === index\}/.test(header), 'Header search results must expose active option.');
assert(/role="menu"/.test(header), 'Header notifications menu must keep role=menu.');
assert(/role="menuitem"/.test(header), 'Header notification actions must keep role=menuitem.');
assert(/aria-label=\{`\$\{t\('header\.profile'\)\}: \$\{displayName\}`\}/.test(header), 'Header profile trigger must keep accessible name.');

assert(/Riesgos priorizados de la matriz ISO/.test(matrix), '/matriz-riesgo table scroll region must be named.');
assert(/data-ui09-scroll-region="true"/.test(matrix), '/matriz-riesgo must expose UI-09 scroll region marker.');
assert(/scope="col"/.test(matrix), '/matriz-riesgo table headers must keep scope=col.');

for (const state of ['measured', 'zero', 'empty', 'insufficient', 'not_calculable', 'not_available', 'error', 'stale', 'partial', 'loading']) {
  assert(universalState.includes(state), `UniversalStateBlock must continue supporting ${state}.`);
}

for (const status of ['trusted', 'trusted_with_warnings', 'low_confidence', 'insufficient_data', 'unavailable']) {
  assert(dataTrust.includes(status), `DataTrustIndicator must continue supporting ${status}.`);
}

console.log('UI09_RESPONSIVE_ACCESSIBILITY_CONTRACT_PASS routes=97->97 rbac=unchanged universal_states=preserved data_trust=preserved');
