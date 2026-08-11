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
const sidebar = read(path.join(srcRoot, 'components/Sidebar.tsx'));
const appLayout = read(path.join(srcRoot, 'components/AppLayout.tsx'));
const dashboardV2 = read(path.join(srcRoot, 'app/dashboard-v2/page.tsx'));

assert(
  /export const CAPABILITY_BY_PATH/.test(permissions),
  'Route capability mapping must be centralized in mvpPermissions.ts.'
);

assert(
  /'\/exportes'\s*:\s*'reports\.premium'/.test(permissions),
  '/exportes must be explicitly guarded by the reports.premium commercial capability.'
);

assert(
  /export function getMvpRouteCapability/.test(permissions),
  'mvpPermissions.ts must expose getMvpRouteCapability for shared sidebar and deep-link checks.'
);

assert(
  /getMvpRouteCapability/.test(sidebar) && !/const CAPABILITY_BY_PATH/.test(sidebar),
  'Sidebar must consume the shared route capability helper, not a local capability map.'
);

assert(
  /getMvpRouteCapability/.test(appLayout) &&
    /hasCapability\(requiredCapability\)/.test(appLayout),
  'AppLayout must enforce shared commercial capabilities for direct URL access.'
);

assert(
  /'\/dashboard-v2'/.test(permissions) &&
    /INTERNAL_CLIENT_HIDDEN_ROUTES/.test(permissions),
  '/dashboard-v2 must remain hidden from commercial navigation.'
);

assert(
  /redirect\(['"]\/dashboard['"]\)/.test(dashboardV2) ||
    /replace\(['"]\/dashboard['"]\)/.test(dashboardV2),
  '/dashboard-v2 must remain compatibility-only and redirect to /dashboard.'
);

assert(
  !/tenant_id\s*===|tenantId\s*===|credex|admin\.demo|auditor\.demo|@credex\.cl/i.test(
    `${permissions}\n${sidebar}\n${appLayout}`
  ),
  'Navigation/RBAC production code must not contain tenant, customer, or demo-account hardcodes.'
);

console.log('PHASE6_SIDEBAR_NAVIGATION_RBAC_CONTRACT_PASS');
