import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const permissions = read(path.join(srcRoot, 'utils/mvpPermissions.ts'));
const enterpriseNavigation = read(path.join(srcRoot, 'config/enterpriseNavigation.ts'));
const sidebar = read(path.join(srcRoot, 'components/Sidebar.tsx'));
const appLayout = read(path.join(srcRoot, 'components/AppLayout.tsx'));
const header = read(path.join(srcRoot, 'components/Header.tsx'));

assert(
  /export const CAPABILITY_BY_PATH/.test(permissions),
  'Route capability mapping must be centralized in mvpPermissions.ts.'
);

assert(
  /'\/exportes'\s*:\s*'core\.reports'/.test(permissions),
  '/exportes must be explicitly guarded by the core.reports ISO commercial capability.'
);

assert(
  /export function getMvpRouteCapability/.test(permissions),
  'mvpPermissions.ts must expose getMvpRouteCapability for shared sidebar and deep-link checks.'
);

assert(
  /export const CLIENT_ENTERPRISE_NAV_DOMAINS/.test(enterpriseNavigation),
  'Enterprise shell navigation domains must be centralized in enterpriseNavigation.ts.'
);

assert(
  !/CLIENT_ENTERPRISE_NAV_DOMAINS/.test(permissions),
  'mvpPermissions.ts must remain the authorization contract and not own visual enterprise navigation.'
);

const enterpriseNavigationBlock = enterpriseNavigation.match(
  /export const CLIENT_ENTERPRISE_NAV_DOMAINS:[\s\S]*?\n\];/
);
assert(
  enterpriseNavigationBlock,
  'CLIENT_ENTERPRISE_NAV_DOMAINS must be declared as a single auditable navigation contract.'
);

const domainIds = [
  ...enterpriseNavigationBlock[0].matchAll(/^\s+id:\s*'([^']+)'/gm),
].map((match) => match[1]);
const expectedDomainIds = [
  'home',
  'compliance',
  'risk-control',
  'audit-improvement',
  'operations-resilience',
  'data-evidence',
  'intelligence',
  'reports',
  'administration',
];

assert(
  domainIds.length === expectedDomainIds.length,
  `Enterprise shell must expose ${expectedDomainIds.length} primary domains; found ${domainIds.length}.`
);

assert(
  expectedDomainIds.every((domainId, index) => domainIds[index] === domainId),
  'Enterprise shell primary domains must remain in the approved UI-02 order.'
);

assert(
  /getMvpRouteCapability/.test(sidebar) && !/const CAPABILITY_BY_PATH/.test(sidebar),
  'Sidebar must consume the shared route capability helper, not a local capability map.'
);

assert(
  /@\/config\/enterpriseNavigation/.test(sidebar) &&
    /CLIENT_ENTERPRISE_NAV_DOMAINS/.test(sidebar) &&
    !/CLIENT_MVP_NAV_ITEMS/.test(sidebar),
  'Sidebar must present enterprise domains from config instead of the full legacy route list.'
);

assert(
  /aria-label=\{label\}/.test(sidebar) &&
    /title=\{label\}/.test(sidebar) &&
    /focus-visible:outline/.test(sidebar) &&
    /shadow-\[inset_4px_0_0/.test(sidebar),
  'Collapsed sidebar entries must expose tooltips/accessibility names, visible focus, and an active state beyond color.'
);

assert(
  !/sectionLabel\(t\('navigation\.sections\.enterpriseDomains'\)\)/.test(sidebar) &&
    !/>\{t\('navigation\.sections\.domainViews'\)\}<\/div>/.test(sidebar),
  'Sidebar must not render internal enterprise/domain-view labels as visible section text.'
);

assert(
  /breadcrumbSegments/.test(header) &&
    /visibleBreadcrumbSegments/.test(header) &&
    /navigationContext\.domain\.id !== 'home'/.test(header) &&
    /aria-current="page"/.test(header) &&
    /breadcrumb-ellipsis/.test(header),
  'Header breadcrumb must derive from enterprise navigation, avoid duplicated Inicio, preserve aria-current, and use structural middle compression.'
);

assert(
  /getMvpRouteCapability/.test(appLayout) &&
    /canShowCapability\(requiredCapability\)/.test(appLayout),
  'AppLayout must enforce shared commercial capabilities for direct URL access.'
);

assert(
  /event\.key === 'Escape'/.test(appLayout) &&
    /handleMobileDrawerKeyDown/.test(appLayout) &&
    /mobileMenuButtonRef\.current\?\.focus/.test(appLayout) &&
    /document\.body\.style\.overflow = 'hidden'/.test(appLayout) &&
    /tabIndex=\{-1\}/.test(appLayout),
  'Mobile drawer must close on Escape, trap focus, lock background scroll, and restore focus to the menu button.'
);

assert(
  !/'\/dashboard-v2'/.test(permissions),
  '/dashboard-v2 must be retired from navigation and hidden-route contracts.'
);

assert(
  !fs.existsSync(path.join(srcRoot, 'app/dashboard-v2/page.tsx')),
  '/dashboard-v2 app route must remain retired; /dashboard is canonical.'
);

assert(
  !/tenant_id\s*===|tenantId\s*===|credex|admin\.demo|auditor\.demo|@credex\.cl/i.test(
    `${permissions}\n${sidebar}\n${appLayout}`
  ),
  'Navigation/RBAC production code must not contain tenant, customer, or demo-account hardcodes.'
);

console.log('PHASE6_SIDEBAR_NAVIGATION_RBAC_CONTRACT_PASS');
