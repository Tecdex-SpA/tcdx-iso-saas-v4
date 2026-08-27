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
    else if (/\/page\.(tsx|ts|jsx|js)$/.test(fullPath)) acc.push(path.relative(repoRoot, fullPath).replaceAll(path.sep, '/'));
  }
  return acc.sort();
}

const universal = read(path.join(srcRoot, 'components/ui/enterprise/UniversalStateBlock.tsx'));
const dataTrust = read(path.join(srcRoot, 'components/ui/enterprise/DataTrustIndicator.tsx'));
const enterpriseIndex = read(path.join(srcRoot, 'components/ui/enterprise/index.ts'));
const phase5 = read(path.join(srcRoot, 'components/phase5/Phase5Workspace.tsx'));
const officialAnalytics = read(path.join(srcRoot, 'components/math-governance/OfficialAnalyticsPanel.tsx'));
const formulaCatalog = read(path.join(srcRoot, 'components/math-governance/FormulaCatalog.tsx'));
const indicatorCatalog = read(path.join(srcRoot, 'components/indicators/FunctionalIndicatorCatalog.tsx'));
const semantic = read(path.join(srcRoot, 'components/semantic/SemanticLayerWorkspace.tsx'));
const evidence = read(path.join(srcRoot, 'app/evidencias/page.tsx'));
const exportsPage = read(path.join(srcRoot, 'app/exportes/page.tsx'));
const permissions = read(path.join(srcRoot, 'utils/mvpPermissions.ts'));
const permissionsAtHead = git(['show', 'HEAD:frontend/src/utils/mvpPermissions.ts']);

const expectedStates = {
  zero: '0',
  empty: 'Sin datos',
  insufficient: 'Datos insuficientes',
  not_calculable: 'No calculable',
  not_available: 'No disponible',
  error: 'Error',
  stale: 'Desactualizado',
  partial: 'Datos parciales',
  loading: 'Cargando',
};

for (const [state, label] of Object.entries(expectedStates)) {
  assert(universal.includes(`| '${state}'`) || universal.includes(`${state}:`), `Universal state ${state} must be explicit.`);
  assert(universal.includes(label), `Universal state ${state} must render label ${label}.`);
}

assert(universal.includes("measured") && universal.includes('Con medición'), 'Measured state must remain distinct from zero.');
assert(universal.indexOf('zero:') !== universal.indexOf('empty:'), 'zero must be distinct from empty.');
assert(universal.indexOf('empty:') !== universal.indexOf('insufficient:'), 'empty must be distinct from insufficient.');
assert(universal.indexOf('insufficient:') !== universal.indexOf('not_calculable:'), 'insufficient must be distinct from not_calculable.');
assert(universal.indexOf('not_available:') !== universal.indexOf('error:'), 'not_available must be distinct from error.');
assert(/role: 'alert'/.test(universal), 'Error state must expose role alert.');
assert(/aria-busy/.test(universal), 'Loading state must expose busy semantics.');

['Confiable', 'Confiable con advertencias', 'Baja confianza', 'Datos insuficientes', 'No disponible'].forEach((label) => {
  assert(dataTrust.includes(label), `Data Trust component must render ${label}.`);
});
assert(dataTrust.includes('trusted_with_warnings'), 'Data Trust must distinguish trusted_with_warnings.');
assert(dataTrust.includes('low_confidence'), 'Data Trust must distinguish low_confidence.');
assert(dataTrust.includes('insufficient_data'), 'Data Trust must distinguish insufficient_data.');
assert(!/(score|confidence)\s*[<>]=?\s*0\.[0-9]/.test(dataTrust), 'Data Trust visual component must not calculate trust from numeric thresholds.');
assert(!/100/.test(dataTrust), 'Data Trust visual component must not invent 100% defaults.');
assert(/<details/.test(dataTrust) && /<summary/.test(dataTrust), 'Data Trust detail must be keyboard-accessible.');
assert(/provenance/.test(dataTrust), 'Data Trust component must support real provenance without fabricating it.');

assert(/UniversalStateBlock/.test(enterpriseIndex) && /DataTrustIndicator/.test(enterpriseIndex), 'Enterprise UI exports must expose the shared visual state components.');
assert(/DataTrustIndicator/.test(phase5), 'Phase5 surfaces must use the Data Trust visual component.');
assert(/UniversalStateBlock/.test(phase5), 'Phase5 surfaces must use the universal state block.');
assert(/DataTrustIndicator/.test(officialAnalytics), 'Official analytics snapshots must use Data Trust visual component.');
assert(/UniversalStateBadge/.test(officialAnalytics), 'Official analytics snapshots must use universal state badges.');
assert(/snapshot\.value\s*===\s*0/.test(indicatorCatalog) && /snapshot\.value\s*===\s*0/.test(officialAnalytics), 'Zero values must remain visible as zero, not empty.');
assert(/snapshot\.value\s*===\s*null\)\s*return 'No calculable'/.test(indicatorCatalog), 'Metric catalog must not coerce null official values to zero.');
assert(/snapshot\.value\s*===\s*null\)\s*return 'No calculable'/.test(officialAnalytics), 'Official analytics must not coerce null official values to zero.');
assert(/DataTrustIndicator/.test(indicatorCatalog), 'Metric catalog must render Data Trust separately from values.');
assert(/DataTrustIndicator/.test(semantic), 'Semantic data workspace must render Data Trust from contract preview fields.');
assert(/preview\.sufficiency\?\.usable_rows\)\}/.test(semantic) && !/preview\.sufficiency\?\.usable_rows \|\| 0/.test(semantic), 'Semantic preview must not coerce missing usable rows to zero.');
assert(!/source_counts\.received\|\|0|source_counts\.usable\|\|0|source_counts\.excluded\|\|0/.test(formulaCatalog), 'Formula catalog must not coerce source counts to zero in UI.');
assert(!/current_population \?\? 0|required_population \?\? 1/.test(formulaCatalog), 'Data requirements must not fabricate population defaults.');
assert(/return 'Sin datos'/.test(evidence) && !/const toPercent = \(value: unknown\) => `\$\{Math\.round\(toNumber\(value\)\)\}%`;/.test(evidence), 'Evidence signal percentages must preserve missing values.');
assert(/return 'Sin datos'/.test(exportsPage) && !/Number\(value \|\| 0\)/.test(exportsPage), 'Export coverage percentages must preserve missing values.');
assert(!/DataTrustIndicator/.test(read(path.join(srcRoot, 'app/ia-compliance/page.tsx'))), 'AI confidence must not be merged with Data Trust visuals.');

assert(permissions === permissionsAtHead, 'mvpPermissions.ts must remain unchanged.');
const routeFilesAtHead = git(['ls-tree', '-r', '--name-only', 'HEAD', 'frontend/src/app'])
  .split('\n')
  .filter((line) => /\/page\.(tsx|ts|jsx|js)$/.test(line))
  .sort();
const routeFilesNow = collectRouteFiles(path.join(srcRoot, 'app'));
assert(routeFilesAtHead.length === 97, `Expected 97 App Router routes at HEAD; found ${routeFilesAtHead.length}.`);
assert(routeFilesNow.length === 97, `Expected 97 App Router routes now; found ${routeFilesNow.length}.`);
assert(JSON.stringify(routeFilesAtHead) === JSON.stringify(routeFilesNow), 'Universal states/Data Trust block must not add, delete, or rename routes.');

console.log('UI02_UNIVERSAL_DATA_STATES_CONTRACT_PASS routes=97->97 rbac=unchanged');
