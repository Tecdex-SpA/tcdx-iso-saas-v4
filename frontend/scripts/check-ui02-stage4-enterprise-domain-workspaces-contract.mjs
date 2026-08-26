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

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getNestedValue(source, key) {
  return key.split('.').reduce((value, part) => value?.[part], source);
}

function collectRouteFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRouteFiles(fullPath, acc);
    } else if (/\/page\.(tsx|ts|jsx|js)$/.test(fullPath)) {
      acc.push(path.relative(repoRoot, fullPath).replaceAll(path.sep, '/'));
    }
  }
  return acc.sort();
}

function routeToPagePath(route) {
  const segments = route === '/' ? [] : route.split('/').filter(Boolean);
  return path.join(srcRoot, 'app', ...segments, 'page.tsx');
}

const shell = read(path.join(srcRoot, 'components/enterprise-domain/EnterpriseDomainWorkspaceShell.tsx'));
const mvpShell = read(path.join(srcRoot, 'components/mvp/MvpViewShell.tsx'));
const phase3 = read(path.join(srcRoot, 'components/phase3/Phase3Workspace.tsx'));
const phase5 = read(path.join(srcRoot, 'components/phase5/Phase5Workspace.tsx'));
const riskControl = read(path.join(srcRoot, 'components/risk-control/RiskControlWorkspaceShell.tsx'));
const quantitativePage = read(path.join(srcRoot, 'app/riesgo-cuantitativo/page.tsx'));
const permissions = read(path.join(srcRoot, 'utils/mvpPermissions.ts'));
const permissionsAtHead = git(['show', 'HEAD:frontend/src/utils/mvpPermissions.ts']);
const es = readJson(path.join(srcRoot, 'i18n/dictionaries/es.json'));
const en = readJson(path.join(srcRoot, 'i18n/dictionaries/en.json'));

const expectedDomains = ['compliance', 'audit', 'data', 'intelligence', 'reports'];
const expectedTabs = {
  compliance: ['/cumplimiento-auditoria', '/diagnostico', '/iso-health', '/soa', '/ciclo-vida'],
  audit: ['/planes-accion', '/auditorias', '/hallazgos', '/no-conformidades', '/acciones-recomendadas'],
  data: ['/evidencias', '/datos', '/datos/calidad', '/datos/catalogo', '/datos/lineage', '/datos/semantica', '/importaciones'],
  intelligence: ['/metricas', '/indicadores', '/grc', '/encuestas', '/ia-compliance'],
  reports: ['/exportes', '/bi', '/reportes/studio', '/reportes/generaciones'],
};

assert(/export type EnterpriseDomainWorkspaceKey/.test(shell), 'Universal enterprise domain shell must expose the domain key type.');
expectedDomains.forEach((domain) => {
  assert(shell.includes(`| '${domain}'`) || shell.includes(`${domain}: [`), `Domain ${domain} must be defined in the universal shell.`);
  assert(getNestedValue(es, `enterpriseDomainWorkspace.${domain}.title`), `Missing ES enterprise copy for ${domain}.`);
  assert(getNestedValue(en, `enterpriseDomainWorkspace.${domain}.title`), `Missing EN enterprise copy for ${domain}.`);
});

for (const [domain, routes] of Object.entries(expectedTabs)) {
  routes.forEach((route) => {
    assert(shell.includes(`href: '${route}'`), `Domain ${domain} must include tab route ${route}.`);
    assert(fs.existsSync(routeToPagePath(route)), `Domain tab ${route} must point to an existing App Router page.`);
  });
}

assert(!shell.includes("href: '/reportes'"), 'Stage 4 must not invent /reportes as a tab route.');
assert(/usePathname/.test(shell), 'Domain tabs must derive active state from usePathname.');
assert(/aria-current=\{active \? 'page' : undefined\}/.test(shell), 'Domain tabs must expose aria-current for the active view.');
assert(/getActiveTabHref/.test(shell) && /sort\(\(a, b\) => b\.href\.length - a\.href\.length\)/.test(shell), 'Domain tabs must select the most specific matching route.');

assert(permissions === permissionsAtHead, 'mvpPermissions.ts must remain unchanged in Stage 4.');

const routeFilesAtHead = git(['ls-tree', '-r', '--name-only', 'HEAD', 'frontend/src/app'])
  .split('\n')
  .filter((line) => /\/page\.(tsx|ts|jsx|js)$/.test(line))
  .sort();
const routeFilesNow = collectRouteFiles(path.join(srcRoot, 'app'));
assert(routeFilesAtHead.length === 97, `Expected 97 App Router routes at HEAD; found ${routeFilesAtHead.length}.`);
assert(routeFilesNow.length === 97, `Expected 97 App Router routes now; found ${routeFilesNow.length}.`);
assert(JSON.stringify(routeFilesAtHead) === JSON.stringify(routeFilesNow), 'Stage 4 must not add, delete, or rename App Router page routes.');

assert(/domainWorkspace\?: EnterpriseDomainWorkspaceKey/.test(mvpShell), 'MvpViewShell must support opt-in domainWorkspace.');
assert(/domainWorkspace\?: EnterpriseDomainWorkspaceKey/.test(phase3), 'Phase3Workspace must support opt-in domainWorkspace.');
assert(/domainWorkspace\?: EnterpriseDomainWorkspaceKey/.test(phase5), 'Phase5Workspace must support opt-in domainWorkspace.');
assert(/!domainWorkspace && <Phase3Nav/.test(phase3), 'Phase3 legacy navigation must be suppressed only when domainWorkspace is present.');
assert(/!domainWorkspace && \(/.test(phase5), 'Phase5 legacy header must be suppressed only when domainWorkspace is present.');
assert(/RiskControlWorkspaceShell activeView="quantitative"/.test(phase3), 'Phase3 quantitative view must still render RiskControlWorkspaceShell.');
assert(/view="quantitative_risks"/.test(quantitativePage), '/riesgo-cuantitativo must still use the quantitative Phase3 view.');
assert(!/EnterpriseDomainWorkspaceShell/.test(quantitativePage), '/riesgo-cuantitativo page must not be converted to generic domain shell.');
assert(/riskControlWorkspace/.test(riskControl) && /aria-current=\{active \? 'page' : undefined\}/.test(riskControl), 'RiskControlWorkspaceShell must remain intact.');

[
  'frontend/src/components/enterprise-domain/EnterpriseDomainWorkspaceShell.tsx',
  'frontend/src/components/mvp/MvpViewShell.tsx',
  'frontend/src/components/phase3/Phase3Workspace.tsx',
  'frontend/src/components/phase5/Phase5Workspace.tsx',
].forEach((relativePath) => {
  const source = read(path.join(repoRoot, relativePath));
  assert(!/method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/.test(source), `${relativePath} must not introduce mutation requests.`);
  assert(!/admin\.demo|auditor\.demo|credex|@credex\.cl|tenant[_-]?demo/i.test(source), `${relativePath} must not hardcode tenants or demo accounts.`);
});

[
  'dataCatalog',
  'semanticLayer',
].forEach((key) => {
  assert(getNestedValue(es, `navigation.destinations.${key}`), `Missing ES navigation destination ${key}.`);
  assert(getNestedValue(en, `navigation.destinations.${key}`), `Missing EN navigation destination ${key}.`);
});

assert(!/const DOMAIN_TABS/.test(mvpShell), 'MvpViewShell must not define a second domain-tab source of truth.');
assert(!/const DOMAIN_TABS/.test(phase3), 'Phase3Workspace must not define a second domain-tab source of truth.');
assert(!/const DOMAIN_TABS/.test(phase5), 'Phase5Workspace must not define a second domain-tab source of truth.');
assert(!/FEATURE_ACCESS|MVP_ROUTE_RULES|CAPABILITY_BY_PATH/.test(shell), 'Domain shell must not become an authorization source.');

console.log('UI02_STAGE4_ENTERPRISE_DOMAIN_WORKSPACES_CONTRACT_PASS');
