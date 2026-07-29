#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

const required = [
  'database/migrations/20260729_phase4_commercial_product.sql',
  'scripts/phase4/apply-phase4-migration.js',
  'backend/src/services/commercial/commercialCatalog.js',
  'backend/src/services/commercial/entitlementResolver.service.js',
  'backend/src/services/commercial/commercialAdmin.service.js',
  'backend/src/middleware/commercialEntitlement.middleware.js',
  'backend/src/routes/admin-saas-commercial.routes.js',
  'backend/src/routes/me.routes.js',
  'backend/src/middleware/rbac.middleware.js',
  'frontend/src/hooks/useTenantEntitlements.ts',
  'frontend/src/components/commercial/Phase4CommercialPanel.tsx',
  'frontend/src/app/admin-saas/page.tsx',
];
const missing = required.filter((file) => !exists(file));
if (missing.length) throw new Error(`Phase 4 missing files: ${missing.join(', ')}`);

const migration = read('database/migrations/20260729_phase4_commercial_product.sql');
const app = read('backend/src/app.js');
const routes = read('backend/src/routes/admin-saas-commercial.routes.js');
const resolver = read('backend/src/services/commercial/entitlementResolver.service.js');
const rbac = read('backend/src/middleware/rbac.middleware.js');
const hook = read('frontend/src/hooks/useTenantEntitlements.ts');
const panel = read('frontend/src/components/commercial/Phase4CommercialPanel.tsx');
const packageJson = read('package.json');

const markers = [
  'product_families', 'commercial_editions', 'commercial_plans', 'commercial_plan_versions',
  'commercial_modules', 'commercial_addons', 'commercial_features', 'commercial_technical_capabilities',
  'plan_version_modules', 'plan_version_addons', 'module_features', 'feature_capabilities',
  'tenant_subscriptions', 'tenant_subscription_addons', 'tenant_entitlements', 'tenant_feature_overrides',
  'usage_limit_definitions', 'tenant_usage_limits', 'usage_measurements', 'trials', 'commercial_events',
  'support_tiers', 'deployment_profiles', 'pack_definitions', 'pack_versions', 'pack_items',
  'pack_dependencies', 'tenant_pack_installations', 'tenant_pack_installation_items',
  'risk_methodology_versions', 'audit_workpaper_template_versions', 'v_tenant_commercial_entitlements'
];
const missingMigration = markers.filter((marker) => !migration.includes(marker));
if (missingMigration.length) throw new Error(`Phase 4 migration gaps: ${missingMigration.join(', ')}`);

const routeMarkers = [
  "router.get('/catalog'", "router.post('/catalog/items'", "router.get('/plans'", "router.post('/plans/publish'",
  "router.get('/tenants/:tenantId/subscription'", "router.get('/tenants/:tenantId/entitlements'", "router.get('/tenants/:tenantId/limits'",
  "router.put('/tenants/:tenantId/limits/:resourceKey'", "router.get('/tenants/:tenantId/usage'", "router.get('/tenants/:tenantId/health'",
  "router.post('/tenants/:tenantId/change-preview'", "router.post('/tenants/:tenantId/change-plan'", "router.post('/tenants/:tenantId/trials'",
  "router.post('/tenants/:tenantId/overrides'", "router.post('/tenants/:tenantId/packs/:packKey/preview'", "router.post('/tenants/:tenantId/packs/:packKey/install'",
  "router.get('/methodologies'", "router.post('/methodologies'", "router.get('/workpapers'", "router.post('/workpapers'", "router.get('/history'"
];
const missingRoutes = routeMarkers.filter((marker) => !routes.includes(marker));
if (missingRoutes.length) throw new Error(`Phase 4 route gaps: ${missingRoutes.join(', ')}`);

for (const marker of ['resolveTenantEntitlements', 'resolveCapability', 'calculateTenantHealth', 'recordCommercialEvent']) {
  if (!resolver.includes(marker)) throw new Error(`Phase 4 resolver marker missing: ${marker}`);
}
for (const permission of ['commercial.catalog.read', 'commercial.subscription.manage', 'commercial.pack.install']) {
  if (!rbac.includes(permission) || !migration.includes(permission)) throw new Error(`Phase 4 RBAC permission missing: ${permission}`);
}
if (!app.includes("adminSaasCommercialRoutes") || app.indexOf("adminSaasCommercialRoutes") > app.indexOf("adminSaasRoutes);")) {
  throw new Error('Phase 4 commercial router must be mounted before legacy admin-saas router');
}
for (const marker of ['hasModule', 'hasCapability', 'getLimit', 'getUsage', 'isReadOnly', 'canUseAiFeature']) {
  if (!hook.includes(marker)) throw new Error(`Phase 4 hook helper missing: ${marker}`);
}
for (const marker of ['Gobierno comercial del producto', 'Cambio de plan', 'Packs y metodologías', 'Capabilities efectivas']) {
  if (!panel.includes(marker)) throw new Error(`Phase 4 admin UI marker missing: ${marker}`);
}
for (const script of ['phase4:migration:checksum', 'phase4:contracts:check', 'phase4:check']) {
  if (!packageJson.includes(script)) throw new Error(`Phase 4 package script missing: ${script}`);
}

process.stdout.write(`Phase 4 contracts: VERIFIED tables=${markers.length} routes=${routeMarkers.length}\n`);
