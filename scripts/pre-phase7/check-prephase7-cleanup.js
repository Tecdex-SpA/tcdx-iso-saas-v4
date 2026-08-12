const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function walkFiles(relativePath, predicate = () => true) {
  const base = path.join(root, relativePath);
  if (!fs.existsSync(base)) return [];

  const files = [];
  const stack = [base];

  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      if (current.includes(`${path.sep}node_modules${path.sep}`) || current.includes(`${path.sep}.next${path.sep}`)) {
        continue;
      }
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (predicate(current)) files.push(path.relative(root, current));
  }

  return files;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function filesContaining(files, pattern) {
  return files.filter((file) => pattern.test(read(file)));
}

const app = read('backend/src/app.js');
const rbac = read('backend/src/middleware/rbac.middleware.js');
const permissions = read('frontend/src/utils/mvpPermissions.ts');
const sidebar = read('frontend/src/components/Sidebar.tsx');
const dashboardPage = read('frontend/src/app/dashboard/page.tsx');

assert(!exists('frontend/src/app/dashboard-v2/page.tsx'), 'frontend /dashboard-v2 route must be retired');
assert(!exists('frontend/src/components/dashboard-v2'), 'DashboardV2 product component directory must be retired');
assert(!exists('backend/src/routes/dashboard-v2.routes.js'), 'backend dashboard-v2 route must be retired');
assert(!exists('backend/src/services/dashboardV2.service.js'), 'backend dashboardV2 service must be retired');

assert(!/dashboard-v2\.routes/.test(app), 'backend app must not require dashboard-v2 routes');
assert(!/app\.use\(['"]\/api\/dashboard-v2['"]/.test(app), 'backend app must not mount /api/dashboard-v2');
assert(!/\/api\/dashboard-v2/.test(rbac), 'RBAC middleware must not keep /api/dashboard-v2 capability rules');

assert(/href:\s*'\/dashboard'/.test(permissions) || /routes:\s*\[[^\]]*'\/dashboard'/.test(permissions), '/dashboard must remain canonical');
assert(!/'\/dashboard-v2'/.test(permissions), '/dashboard-v2 must not remain in route permissions, hidden routes, or sidebar rules');
assert(!/\/dashboard-v2/.test(sidebar), 'sidebar must not expose /dashboard-v2');
assert(!/dashboard-v2|DashboardV2/.test(dashboardPage), '/dashboard must not depend on DashboardV2 code');

const scriptFiles = walkFiles('scripts', (file) => file.endsWith('.sh') || file.endsWith('.js') || file.endsWith('.mjs'));
const legacyV2ScriptRefs = filesContaining(
  scriptFiles.filter((file) => file !== 'scripts/pre-phase7/check-prephase7-cleanup.js'),
  /\/dashboard-v2|\/api\/dashboard-v2|dashboard_v2|user_dashboard_preferences|DashboardV2|dashboardV2/
);
assert(legacyV2ScriptRefs.length === 0, `scripts must not keep dashboard-v2 compatibility references: ${legacyV2ScriptRefs.join(', ')}`);

const productiveTsFiles = walkFiles('frontend/src', (file) => /\.(tsx?|jsx?)$/.test(file));
const responsiveContainerRefs = filesContaining(productiveTsFiles, /ResponsiveContainer/);
const allowedResponsiveRefs = new Set(['frontend/src/components/ui/enterprise/ResponsiveChartFrame.tsx']);
const disallowedResponsiveRefs = responsiveContainerRefs.filter((file) => !allowedResponsiveRefs.has(file));
assert(
  disallowedResponsiveRefs.length === 0,
  `ResponsiveContainer must be used only through ResponsiveChartFrame: ${disallowedResponsiveRefs.join(', ')}`
);

console.log('PRE_PHASE7_CLEANUP_CONTRACT_PASS');
