#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function mustInclude(file, needle) {
  const source = read(file);
  if (!source.includes(needle)) throw new Error(`${file} missing ${needle}`);
}

const layoutSegments = [
  'datos',
  'metricas',
  'encuestas',
  'evaluaciones',
  'tests',
  'eventos-perdida',
  'bi',
  'reportes',
  'grc',
];

for (const segment of layoutSegments) {
  const file = `frontend/src/app/${segment}/layout.tsx`;
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing shell layout for /${segment}`);
  mustInclude(file, 'AppLayout');
}

mustInclude('frontend/src/utils/apiClient.ts', 'X-Tenant-Id');
mustInclude('frontend/src/utils/apiClient.ts', 'resolveEffectiveTenantContext');
mustInclude('frontend/src/utils/apiClient.ts', 'TENANT_REQUIRED');
mustInclude('frontend/src/hooks/useTenantEntitlements.ts', 'no-tenant-selected');
mustInclude('frontend/src/app/admin-saas/page.tsx', 'setActiveTenantId(selectedTenantId');
mustInclude('frontend/src/components/grc/GrcPortal.tsx', '/api/grc/overview');
mustInclude('frontend/src/app/grc/page.tsx', 'GrcPortal');
mustInclude('backend/src/utils/effectiveTenant.js', 'TENANT_FORBIDDEN');
mustInclude('backend/src/utils/effectiveTenant.js', 'TENANT_INVALID');
mustInclude('backend/src/routes/phase5.routes.js', "grcRouter.get('/overview'");
mustInclude('backend/src/services/phase5/phase5.service.js', 'getGrcOverview');
mustInclude('backend/src/services/phase5/phase5.service.js', 'recordLineageEdge');
mustInclude('backend/src/services/phase5/dataTrustScore.js', 'data_trust_score_v2');

const workspace = read('frontend/src/components/phase5/Phase5Workspace.tsx');
if (/\bfetch\s*\(/.test(workspace)) throw new Error('Phase5Workspace still uses direct fetch');
if (/Fase 5/.test(workspace)) throw new Error('Phase5Workspace exposes internal phase copy');

const lineagePage = read('frontend/src/app/datos/lineage/page.tsx');
if (!lineagePage.includes('/api/data/lineage') || !lineagePage.includes('/api/data/impact')) {
  throw new Error('Lineage explorer does not call real lineage/impact endpoints');
}

const migration = read('database/migrations/20260730_phase5_tenant_shell_grc_data_integration.sql');
for (const relation of ['mitigates', 'tests', 'evidences', 'generates', 'requires', 'owned_by', 'related_to']) {
  if (!migration.includes(`'${relation}'`)) throw new Error(`Hotfix migration missing lineage relation: ${relation}`);
}

process.stdout.write(JSON.stringify({
  status: 'VERIFIED_PHASE5_TENANT_SHELL_GRC',
  layouts: layoutSegments.length,
  tenant_context: 'verified',
  grc_portal: 'verified',
  lineage_impact: 'verified',
}) + '\n');
