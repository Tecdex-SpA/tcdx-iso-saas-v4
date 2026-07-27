#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
require(path.join(root, 'backend/node_modules/dotenv')).config({
  path: path.join(root, 'backend/.env'),
});
const pool = require(path.join(root, 'backend/src/config/db'));

async function main() {
  const file = path.join(root, 'database/migrations/20260727_phase2_integrated_grc.sql');
  const sql = fs.readFileSync(file, 'utf8');
  await pool.query(sql);
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM permissions
        WHERE permission_key IN (
          'privacy.read','privacy.manage','privacy.approve','privacy.dpia.manage',
          'privacy.requests.manage','privacy.breaches.manage','incidents.read',
          'incidents.manage','incidents.command','incidents.close',
          'incidents.notifications.manage','suppliers.read','suppliers.manage',
          'suppliers.assess','suppliers.approve','suppliers.portal.manage',
          'connectors.read','connectors.manage','connectors.credentials.manage',
          'connectors.sync.run','connectors.logs.read','grc.phase2.export'
        )) AS permissions,
       (SELECT COUNT(*)::int FROM grc_connector_definitions WHERE status='active') AS connectors,
       (SELECT default_enabled FROM saas_modules WHERE module_key='grc_phase2_integrated') AS default_enabled`
  );
  const row = result.rows[0];
  if (row.permissions !== 22 || row.connectors !== 4 || row.default_enabled !== false) {
    throw new Error('Phase 2 migration postcondition failed');
  }
  process.stdout.write('Phase 2 migration applied: permissions=22 connectors=4 default_enabled=false\n');
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error(`Phase 2 migration failed: ${error.message}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
