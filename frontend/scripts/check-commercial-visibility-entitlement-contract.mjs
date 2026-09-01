import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const repoRoot = path.resolve(root, '..');
const srcRoot = path.join(root, 'src');
const require = createRequire(import.meta.url);

const {
  ADDON_CAPABILITIES,
  capabilitiesForPlan,
} = require(path.join(repoRoot, 'backend/src/services/commercial/commercialPlanMatrix.service.js'));

function read(relativePath) {
  return fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function routeCapabilityMap(source) {
  return Object.fromEntries(
    [...source.matchAll(/^\s*'([^']+)':\s*'([^']+)'/gm)].map((match) => [
      match[1],
      match[2],
    ])
  );
}

function capabilitySet({ planKey, aiAddon = false }) {
  const set = new Set(capabilitiesForPlan(planKey).map((item) => item.capability_key));
  if (aiAddon) {
    for (const capabilityKey of ADDON_CAPABILITIES.ai) set.add(capabilityKey);
  }
  return set;
}

function routeVisible({ route, planKey, aiAddon = false, aiSuggestions = true, aiAuditor = true }) {
  const capabilityKey = routeCapabilities[route];
  if (!capabilityKey) return false;
  const allowed = capabilitySet({ planKey, aiAddon }).has(capabilityKey);
  if (!allowed) return false;
  if (capabilityKey === 'ai.compliance') return aiSuggestions === true;
  if (capabilityKey === 'ai.auditor') return aiAuditor === true;
  return true;
}

function assertHidden(label, options, routes) {
  for (const route of routes) {
    assert(!routeVisible({ ...options, route }), `${label} must hide ${route}`);
  }
}

function assertVisible(label, options, routes) {
  for (const route of routes) {
    assert(routeVisible({ ...options, route }), `${label} must show ${route}`);
  }
}

const permissions = read('utils/mvpPermissions.ts');
const sidebar = read('components/Sidebar.tsx');
const appLayout = read('components/AppLayout.tsx');
const dashboard = read('app/dashboard/page.tsx');
const tenantEntitlementsHook = read('hooks/useTenantEntitlements.ts');
const adminSaas = read('app/admin-saas/page.tsx');
const routeCapabilities = routeCapabilityMap(permissions);

const requiredProtectedRoutes = [
  '/metricas',
  '/bi',
  '/grc-global',
  '/privacidad',
  '/datos',
  '/reportes/studio',
  '/ia',
  '/ia-compliance',
  '/ia-auditor',
  '/auditorias/ia',
  '/riesgo-cuantitativo',
  '/bia',
];

for (const route of requiredProtectedRoutes) {
  assert(routeCapabilities[route], `${route} must have a centralized commercial capability mapping`);
}

assert(
  sidebar.includes('canShowCapability') && !/hasCapability\(capability\)/.test(sidebar),
  'Sidebar must use effective capability visibility, including AI feature flags, for navigation entries.'
);

assert(
  appLayout.includes('canShowCapability(requiredCapability)'),
  'Direct route access must fail closed on effective commercial visibility.'
);

assert(
  tenantEntitlementsHook.includes('const enabled = ai.enabled === true;') &&
    !tenantEntitlementsHook.includes("planValue.toLowerCase() !== 'none'"),
  'Frontend entitlements must not use legacy ai_plan as commercial authority.'
);

assert(
  !adminSaas.includes('selectedAiDraft.ai_plan') &&
    !adminSaas.includes('<option value="basic">basic</option>') &&
    !adminSaas.includes('<option value="premium">premium</option>') &&
    !adminSaas.includes('<option value="enterprise">enterprise</option>'),
  'Admin SaaS must not expose legacy AI plan selection.'
);

assert(
  dashboard.includes('if (!canShowAdvancedMetrics)') &&
    dashboard.includes('canShowGrcAnalysis') &&
    dashboard.includes('canShowGrcAdvanced') &&
    dashboard.includes('canShowMetricsEngine'),
  'Dashboard must gate advanced metrics/GRC blocks before fetching or rendering them.'
);

assertHidden('ISO without AI', { planKey: 'pyme' }, [
  '/metricas',
  '/bi',
  '/grc-global',
  '/privacidad',
  '/datos',
  '/reportes/studio',
  '/ia',
  '/ia-compliance',
  '/ia-auditor',
  '/auditorias/ia',
  '/riesgo-cuantitativo',
  '/bia',
]);
assertVisible('ISO without AI', { planKey: 'pyme' }, [
  '/dashboard',
  '/cumplimiento-auditoria',
  '/iso-health',
  '/riesgos',
  '/exportes',
]);

assertVisible('ISO + Riesgo without AI', { planKey: 'empresa' }, [
  '/operaciones-grc',
  '/riesgo-cuantitativo',
  '/bia',
]);
assertHidden('ISO + Riesgo without AI', { planKey: 'empresa' }, [
  '/metricas',
  '/bi',
  '/grc-global',
  '/privacidad',
  '/datos',
  '/reportes/studio',
  '/ia',
  '/ia-compliance',
  '/ia-auditor',
  '/auditorias/ia',
]);

assertVisible('GRC without AI', { planKey: 'enterprise' }, [
  '/metricas',
  '/bi',
  '/grc-global',
  '/privacidad',
  '/datos',
  '/reportes/studio',
  '/riesgo-cuantitativo',
  '/bia',
]);
assertHidden('GRC without AI', { planKey: 'enterprise' }, [
  '/ia',
  '/ia-compliance',
  '/ia-auditor',
  '/auditorias/ia',
]);

assertVisible('GRC with AI', { planKey: 'enterprise', aiAddon: true }, [
  '/ia',
  '/ia-compliance',
  '/ia-auditor',
  '/auditorias/ia',
]);
assertHidden('GRC with AI but auditor feature off', { planKey: 'enterprise', aiAddon: true, aiAuditor: false }, [
  '/ia-auditor',
  '/auditorias/ia',
]);
assertHidden('GRC with AI but suggestions feature off', { planKey: 'enterprise', aiAddon: true, aiSuggestions: false }, [
  '/ia',
  '/ia-compliance',
]);

console.log('COMMERCIAL_VISIBILITY_ENTITLEMENT_CONTRACT_PASS');
