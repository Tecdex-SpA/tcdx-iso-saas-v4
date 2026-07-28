#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
require(path.join(root, 'backend/node_modules/dotenv')).config({
  path: path.join(root, 'backend/.env'),
});
const pool = require(path.join(root, 'backend/src/config/db'));

const permissionKeys = [
  'organizations.read', 'organizations.manage',
  'processes.read', 'processes.manage', 'processes.approve',
  'services.read', 'services.manage',
  'bia.read', 'bia.manage', 'bia.approve',
  'continuity.read', 'continuity.manage', 'continuity.approve',
  'continuity.activate', 'continuity.tests.manage',
  'crisis.read', 'crisis.manage',
  'metrics.read', 'metrics.manage', 'metrics.record', 'metrics.approve',
  'quantitative_risk.read', 'quantitative_risk.manage', 'quantitative_risk.approve',
  'operations.dashboard.read', 'operations.360.read',
];

async function main() {
  const file = path.join(root, 'database/migrations/20260728_phase3_operational_grc.sql');
  await pool.query(fs.readFileSync(file, 'utf8'));

  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM permissions WHERE permission_key = ANY($1::text[])) AS permissions,
       (SELECT default_enabled FROM saas_modules WHERE module_key='grc_phase3_operations') AS default_enabled,
       (SELECT is_enabled FROM tenant_module_settings
        WHERE tenant_id='70000000-0000-0000-0000-000000000701'::uuid
          AND module_key='grc_phase3_operations') AS tcdx_enabled,
       to_regclass('public.grc_organizational_units') IS NOT NULL AS units_ready,
       to_regclass('public.grc_bia_assessments') IS NOT NULL AS bia_ready,
       to_regclass('public.grc_continuity_plans') IS NOT NULL AS continuity_ready,
       to_regclass('public.grc_metric_definitions') IS NOT NULL AS metrics_ready`,
    [permissionKeys]
  );
  const row = result.rows[0];
  if (
    row.permissions !== permissionKeys.length
    || row.default_enabled !== false
    || row.tcdx_enabled !== true
    || !row.units_ready
    || !row.bia_ready
    || !row.continuity_ready
    || !row.metrics_ready
  ) {
    throw new Error('Phase 3 migration postcondition failed');
  }
  process.stdout.write(
    `Phase 3 migration applied: permissions=${row.permissions} default_enabled=false tcdx_enabled=true\n`
  );
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error(`Phase 3 migration failed: ${error.message}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
