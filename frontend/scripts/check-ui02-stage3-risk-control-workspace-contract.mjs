import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function getNestedValue(source, key) {
  return key.split('.').reduce((value, part) => value?.[part], source);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertValue(dictionary, key, expected, locale) {
  const actual = getNestedValue(dictionary, key);
  assert(actual === expected, `${locale}.${key} must be "${expected}"; found "${actual}".`);
}

const workspaceShell = read(path.join(srcRoot, 'components/risk-control/RiskControlWorkspaceShell.tsx'));
const riskRegister = read(path.join(srcRoot, 'components/risk-control/RiskRegisterWorkspace.tsx'));
const riesgosPage = read(path.join(srcRoot, 'app/riesgos/page.tsx'));
const matrixPage = read(path.join(srcRoot, 'app/matriz-riesgo/page.tsx'));
const controlsPage = read(path.join(srcRoot, 'app/controles/page.tsx'));
const assetsPage = read(path.join(srcRoot, 'app/activos/page.tsx'));
const phase3Workspace = read(path.join(srcRoot, 'components/phase3/Phase3Workspace.tsx'));
const permissions = read(path.join(srcRoot, 'utils/mvpPermissions.ts'));
const enterpriseNavigation = read(path.join(srcRoot, 'config/enterpriseNavigation.ts'));
const es = readJson(path.join(srcRoot, 'i18n/dictionaries/es.json'));
const en = readJson(path.join(srcRoot, 'i18n/dictionaries/en.json'));

const expectedTabs = [
  ['/riesgos', 'riskControlWorkspace.tabs.register'],
  ['/matriz-riesgo', 'riskControlWorkspace.tabs.matrix'],
  ['/controles', 'riskControlWorkspace.tabs.controls'],
  ['/activos', 'riskControlWorkspace.tabs.assets'],
  ['/riesgo-cuantitativo', 'riskControlWorkspace.tabs.quantitative'],
];

expectedTabs.forEach(([href, labelKey]) => {
  assert(workspaceShell.includes(`href: '${href}'`), `Workspace tabs must preserve route ${href}.`);
  assert(workspaceShell.includes(`labelKey: '${labelKey}'`), `Workspace tab ${href} must use i18n key ${labelKey}.`);
});

assert(/aria-current=\{active \? 'page' : undefined\}/.test(workspaceShell), 'Workspace tabs must expose aria-current on the active view.');
assert(/usePathname/.test(workspaceShell), 'Workspace tabs must derive active state from the current path.');

assert(/<RiskRegisterWorkspace/.test(riesgosPage) && /<Suspense/.test(riesgosPage), '/riesgos must render the enterprise register inside a Suspense boundary.');
assert(/RiskControlWorkspaceShell activeView="matrix"/.test(matrixPage), '/matriz-riesgo must include the Risk and Control workspace shell.');
assert(/RiskControlWorkspaceShell activeView="controls"/.test(controlsPage), '/controles must include the Risk and Control workspace shell.');
assert(/RiskControlWorkspaceShell activeView="assets"/.test(assetsPage), '/activos must include the Risk and Control workspace shell.');
assert(/RiskControlWorkspaceShell activeView="quantitative"/.test(phase3Workspace), '/riesgo-cuantitativo must include the Risk and Control workspace shell.');

[
  '/api/iso-risk-matrix/',
  '/api/assets/',
  '/api/assets/risk/',
  '/quantitative-risks?limit=200&offset=0',
].forEach((needle) => {
  assert(riskRegister.includes(needle), `Risk register must consume existing endpoint/source ${needle}.`);
});

assert(/resolveEffectiveTenantContext/.test(riskRegister), 'Risk register must resolve tenant through the existing API client context.');
assert(!/tenant_id\s*===|tenantId\s*===|credex|admin\.demo|auditor\.demo|@credex\.cl/i.test(riskRegister), 'Risk register production code must not hardcode tenants or demo accounts.');

assert(/stableKey:\s*`iso_matrix:\$\{item\.id\}`/.test(riskRegister), 'ISO matrix rows must use source plus item id as stable identity.');
assert(/stableKey:\s*`asset_risk:\$\{risk\.id\}`/.test(riskRegister), 'Asset risk rows must use source plus risk id as stable identity.');
assert(/stableKey:\s*`quantitative:\$\{record\.id\}`/.test(riskRegister), 'Quantitative rows must use source plus record id as stable identity.');
assert(!/new Set\(.*title|dedup|risk_title.*Map/i.test(riskRegister), 'Risk register must not deduplicate risks by title.');

['zero', 'no_data', 'insufficient', 'not_calculable', 'unavailable', 'error'].forEach((state) => {
  assert(riskRegister.includes(state), `Risk register must preserve semantic data state ${state}.`);
});
assert(!/Number\([^)]*\|\|\s*0\)/.test(riskRegister), 'Risk register must not coerce missing numeric fields to zero.');

assert(/aria-sort=/.test(riskRegister), 'Risk register table must announce sorting state.');
assert(/updateSort/.test(riskRegister), 'Risk register must implement sorting interactions.');
assert(/SelectFilter/.test(riskRegister) && /updateQuery/.test(riskRegister), 'Risk register filters must persist through query parameters.');
assert(/role="dialog"/.test(riskRegister) && /aria-modal="true"/.test(riskRegister), 'Risk detail must be an accessible dialog.');
assert(/event\.key === 'Escape'/.test(riskRegister), 'Risk detail drawer must close with Escape.');
assert(/previous\?\.focus/.test(riskRegister), 'Risk detail drawer must restore focus to the origin element.');
assert(/document\.body\.style\.overflow = 'hidden'/.test(riskRegister), 'Risk detail drawer must lock background scroll.');

assert(!/method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/.test(riskRegister), '/riesgos register must not introduce mutation requests.');
assert(!/fetch\([^)]*,\s*\{[^}]*method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/s.test(riskRegister), '/riesgos register must not introduce raw mutation fetches.');

[
  [`'/riesgos'`, `'risks.read'`],
  [`'/matriz-riesgo'`, `'risks.functional_subflows.read'`],
  [`'/activos'`, `'risks.functional_subflows.read'`],
  [`'/controles'`, `'compliance.functional_subflows.read'`],
  [`'/riesgo-cuantitativo'`, `'phase3.read'`],
].forEach(([route, feature]) => {
  assert(permissions.includes(route) && permissions.includes(feature), `Permission contract must still include ${route} guarded by ${feature}.`);
});
assert(!/FEATURE_ACCESS/.test(enterpriseNavigation), 'Visual enterprise navigation must not become an authorization source.');

[
  ['riskControlWorkspace.eyebrow', 'Riesgo y Control'],
  ['riskControlWorkspace.views.register.title', 'Registro de riesgos'],
  ['riskControlWorkspace.tabs.matrix', 'Matriz'],
  ['riskControlWorkspace.sources.isoMatrix', 'Matriz ISO'],
].forEach(([key, expected]) => assertValue(es, key, expected, 'es'));

[
  ['riskControlWorkspace.eyebrow', 'Risk and Control'],
  ['riskControlWorkspace.views.register.title', 'Risk Register'],
  ['riskControlWorkspace.tabs.matrix', 'Matrix'],
  ['riskControlWorkspace.sources.isoMatrix', 'ISO Matrix'],
].forEach(([key, expected]) => assertValue(en, key, expected, 'en'));

assert(!/Risk matrixs/i.test(`${workspaceShell}\n${riskRegister}\n${JSON.stringify(en)}`), 'Stage 3 sources must not contain "Risk matrixs".');

console.log('UI02_STAGE3_RISK_CONTROL_WORKSPACE_CONTRACT_PASS');
