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

const dashboard = read(path.join(srcRoot, 'app/dashboard/page.tsx'));
const indicatorCatalog = read(path.join(srcRoot, 'components/indicators/FunctionalIndicatorCatalog.tsx'));
const chartFrame = read(path.join(srcRoot, 'components/ui/enterprise/ResponsiveChartFrame.tsx'));
const permissions = read(path.join(srcRoot, 'utils/mvpPermissions.ts'));
const permissionsAtHead = git(['show', 'HEAD:frontend/src/utils/mvpPermissions.ts']);
const diff = git([
  'diff',
  '--unified=0',
  '--',
  'frontend/src/app/dashboard/page.tsx',
  'frontend/src/components/indicators/FunctionalIndicatorCatalog.tsx',
  'frontend/src/components/ui/enterprise/ResponsiveChartFrame.tsx',
]);
const addedLines = diff
  .split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  .join('\n');

assert(permissions === permissionsAtHead, 'mvpPermissions.ts must remain unchanged.');

const routeFilesAtHead = git(['ls-tree', '-r', '--name-only', 'HEAD', 'frontend/src/app'])
  .split('\n')
  .filter((line) => /\/page\.(tsx|ts|jsx|js)$/.test(line))
  .sort();
const routeFilesNow = collectRouteFiles(path.join(srcRoot, 'app'));
assert(routeFilesAtHead.length === 97, `Expected 97 App Router routes at HEAD; found ${routeFilesAtHead.length}.`);
assert(routeFilesNow.length === 97, `Expected 97 App Router routes now; found ${routeFilesNow.length}.`);
assert(JSON.stringify(routeFilesAtHead) === JSON.stringify(routeFilesNow), 'UI-06 must not add, delete, or rename routes.');

assert(/ResponsiveChartFrame/.test(dashboard), '/dashboard charts must reuse ResponsiveChartFrame.');
assert(/ResponsiveChartFrame/.test(indicatorCatalog), '/metricas detail trend must reuse ResponsiveChartFrame.');
assert(/ariaLabel/.test(chartFrame) && /ariaDescription/.test(chartFrame), 'ResponsiveChartFrame must expose accessible chart context.');
assert(/ariaDescription=/.test(dashboard) && /ariaDescription=/.test(indicatorCatalog), 'Charts must provide accessible textual descriptions.');

assert(/UniversalStateBlock/.test(dashboard), '/dashboard charts must integrate Universal Data States.');
assert(/UniversalStateBlock/.test(indicatorCatalog), '/metricas trend must integrate Universal Data States.');
assert(/DataTrustIndicator/.test(dashboard), '/dashboard must preserve DataTrustIndicator reuse.');
assert(/DataTrustIndicator/.test(indicatorCatalog), '/metricas must preserve DataTrustIndicator reuse.');

assert(/formatChartTooltip/.test(dashboard), '/dashboard chart tooltips must be normalized.');
assert(/labelFormatter/.test(dashboard) && /labelFormatter/.test(indicatorCatalog), 'Chart tooltips must label periods in Spanish.');
assert(/Unidad:/.test(indicatorCatalog), '/metricas trend must display the real unit when available.');
assert(
  /Snapshot/.test(indicatorCatalog) &&
    /snapshot\.state\s*===\s*'calculated'\s*\?\s*numberOrNull\(snapshot\.value\)\s*:\s*null/.test(indicatorCatalog),
  'Metric trend must use calculated official snapshots only and preserve null as absent.'
);
assert(/trend\.length\s*<\s*2/.test(indicatorCatalog), 'Metric trend must require at least two official points.');
assert(/trend\.length < 2/.test(dashboard), 'Executive trend must require at least two official points.');

assert(!/snapshot\.value\s*(\|\||\?\?)\s*0/.test(indicatorCatalog), 'Metric visualizations must not coerce null snapshot values to zero.');
assert(!/value\s*(\|\||\?\?)\s*0/.test(addedLines), 'UI-06 additions must not add value-to-zero fallbacks.');
assert(!/\/api\//.test(addedLines), 'UI-06 additions must not introduce frontend API endpoints.');
assert(!/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/.test(addedLines), 'UI-06 additions must not introduce new mutations.');
assert(!/tenant[_-]?id\s*[:=]\s*['"][0-9a-f-]{8,}/i.test(addedLines), 'UI-06 additions must not hardcode tenant identifiers.');
assert(!/demo|acme|fixture|mock/i.test(addedLines), 'UI-06 additions must not add demo/mock product data.');

console.log('UI06_DATA_VISUALIZATION_CONTRACT_PASS routes=97->97 rbac=unchanged');
