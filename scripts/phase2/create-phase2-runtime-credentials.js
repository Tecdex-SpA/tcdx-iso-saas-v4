#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
require(path.join(root, 'backend/node_modules/dotenv')).config({ path: path.join(root, 'backend/.env') });
const bcrypt = require(path.join(root, 'backend/node_modules/bcrypt'));
const pool = require(path.join(root, 'backend/src/config/db'));

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assignment(name, value) {
  return `${name}=${JSON.stringify(String(value))}`;
}

async function main() {
  if (required('PHASE2_QA_CONFIRM') !== 'CREATE_PHASE2_QA_CREDENTIALS') {
    throw new Error('PHASE2_QA_CONFIRM must equal CREATE_PHASE2_QA_CREDENTIALS');
  }
  const runId = required('PHASE2_QA_RUN_ID');
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(runId)) throw new Error('PHASE2_QA_RUN_ID is invalid');
  const tenantA = process.env.PHASE2_TENANT_ID || '70000000-0000-0000-0000-000000000701';
  const envFile = path.resolve(required('PHASE2_QA_ENV_FILE'));
  const restoreFile = path.resolve(required('PHASE2_QA_RESTORE_FILE'));
  if (fs.existsSync(envFile) || fs.existsSync(restoreFile)) {
    throw new Error('Protected runtime credential or restore file already exists');
  }

  const client = await pool.connect();
  let restore;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('phase2_runtime_credentials'))");
    const tenants = await client.query(
      `SELECT id,name,service_status FROM tenants
       WHERE id=$1::uuid OR (
         id<>$1::uuid AND COALESCE(service_status,'active')='active'
         AND lower(name) ~ '(demo|qa|test)'
         AND EXISTS (
           SELECT 1 FROM users u WHERE u.tenant_id=tenants.id
             AND lower(u.role) IN ('admin','tenant_admin','admin_cumplimiento','compliance_admin')
         )
         AND NOT EXISTS (
           SELECT 1 FROM tenant_module_settings tms
           WHERE tms.tenant_id=tenants.id
             AND tms.module_key IN ('grc_phase1_core','grc_phase2_integrated')
             AND tms.is_enabled=TRUE
         )
       )
       ORDER BY CASE WHEN id=$1::uuid THEN 0 ELSE 1 END,name`,
      [tenantA]
    );
    const tenantARow = tenants.rows.find(row => row.id === tenantA);
    const tenantBRow = tenants.rows.find(row => row.id !== tenantA);
    if (
      !tenantARow || !tenantBRow
      || !/(demo|qa|test)/i.test(tenantARow.name)
      || !['active', 'trial'].includes(String(tenantARow.service_status || 'active').toLowerCase())
    ) {
      throw new Error('Dedicated QA/demo tenants are unavailable');
    }
    const users = await client.query(
      `SELECT id,tenant_id,email,role,password_hash
       FROM users WHERE tenant_id=ANY($1::uuid[]) ORDER BY tenant_id,role,email FOR UPDATE`,
      [[tenantA, tenantBRow.id]]
    );
    const inTenant = (id, roles) => users.rows.find(row => row.tenant_id === id && roles.includes(String(row.role).toLowerCase()));
    const admin = inTenant(tenantA, ['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin']);
    const reviewer = inTenant(tenantA, ['auditor']);
    const restricted = inTenant(tenantA, ['viewer', 'user']);
    const tenantBAdmin = inTenant(tenantBRow.id, ['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin', 'auditor']);
    if (!admin || !reviewer || !restricted || !tenantBAdmin) {
      throw new Error('QA tenants do not contain admin, auditor, restricted and cross-tenant accounts');
    }
    const fixtures = await client.query(
      `SELECT
        (SELECT id FROM audits WHERE tenant_id=$1::uuid ORDER BY created_at NULLS LAST,id LIMIT 1) audit_id,
        (SELECT id FROM evidences WHERE tenant_id=$1::uuid ORDER BY id LIMIT 1) evidence_id,
        (SELECT id FROM tenant_controls WHERE tenant_id=$1::uuid ORDER BY id LIMIT 1) control_id`,
      [tenantA]
    );
    if (!fixtures.rows[0].audit_id || !fixtures.rows[0].evidence_id || !fixtures.rows[0].control_id) {
      throw new Error('QA tenant lacks audit, evidence or control fixture');
    }
    const selected = [...new Map([admin, reviewer, restricted, tenantBAdmin].map(user => [user.id, user])).values()];
    const credentialRows = [];
    for (const user of selected) {
      const password = `P2!${crypto.randomBytes(24).toString('base64url')}a9`;
      const temporaryHash = await bcrypt.hash(password, 12);
      await client.query('UPDATE users SET password_hash=$2 WHERE id=$1::uuid', [user.id, temporaryHash]);
      credentialRows.push({
        id: user.id,
        old_password_hash: user.password_hash,
        temporary_password_hash: temporaryHash,
        password,
      });
    }
    const modules = {};
    for (const moduleKey of ['grc_phase1_core', 'grc_phase2_integrated']) {
      const previous = await client.query(
        'SELECT * FROM tenant_module_settings WHERE tenant_id=$1::uuid AND module_key=$2',
        [tenantA, moduleKey]
      );
      modules[moduleKey] = previous.rows[0] || null;
      await client.query(
        `INSERT INTO tenant_module_settings (
           tenant_id,module_key,is_enabled,enabled_at,enabled_by,notes,metadata
         ) VALUES ($1::uuid,$2,TRUE,now(),$3::uuid,$4,$5::jsonb)
         ON CONFLICT (tenant_id,module_key) DO UPDATE SET
           is_enabled=TRUE,enabled_at=now(),disabled_at=NULL,enabled_by=$3::uuid,
           disabled_by=NULL,notes=$4,metadata=$5::jsonb,updated_at=now()`,
        [tenantA, moduleKey, admin.id, 'Controlled Phase 2 runtime QA activation', JSON.stringify({ runtime_qa_run_id: runId })]
      );
    }
    restore = {
      version: 1,
      run_id: runId,
      tenant_id: tenantA,
      tenant_b_id: tenantBRow.id,
      users: credentialRows.map(({ password: _password, ...row }) => row),
      modules,
      created_at: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(envFile), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(restoreFile), { recursive: true, mode: 0o700 });
    fs.writeFileSync(restoreFile, `${JSON.stringify(restore, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    const passwordById = new Map(credentialRows.map(row => [row.id, row.password]));
    const values = {
      WEB_BASE_URL: process.env.WEB_BASE_URL || 'https://tcdx-iso.tecdex.net',
      API_BASE_URL: process.env.API_BASE_URL || 'https://tcdx-iso.tecdex.net',
      E2E_ADMIN_EMAIL: admin.email,
      E2E_ADMIN_PASSWORD: passwordById.get(admin.id),
      E2E_RESTRICTED_EMAIL: restricted.email,
      E2E_RESTRICTED_PASSWORD: passwordById.get(restricted.id),
      E2E_TENANT_A_EMAIL: admin.email,
      E2E_TENANT_A_PASSWORD: passwordById.get(admin.id),
      E2E_TENANT_A_ID: tenantA,
      E2E_TENANT_B_EMAIL: tenantBAdmin.email,
      E2E_TENANT_B_PASSWORD: passwordById.get(tenantBAdmin.id),
      E2E_TENANT_B_ID: tenantBRow.id,
      E2E_REVIEWER_EMAIL: reviewer.email,
      E2E_REVIEWER_PASSWORD: passwordById.get(reviewer.id),
      E2E_REVIEWER_ID: reviewer.id,
      E2E_AUDIT_ID: fixtures.rows[0].audit_id,
      E2E_EVIDENCE_ID: fixtures.rows[0].evidence_id,
      E2E_CONTROL_ID: fixtures.rows[0].control_id,
    };
    fs.writeFileSync(envFile, `${Object.entries(values).map(([name, value]) => assignment(name, value)).join('\n')}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    await client.query('COMMIT');
    process.stdout.write(`Phase 2 protected runtime credentials created: run=${runId} accounts=${selected.length} tenants=2\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    if (restore && fs.existsSync(restoreFile)) fs.unlinkSync(restoreFile);
    if (fs.existsSync(envFile)) fs.unlinkSync(envFile);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error(`Phase 2 runtime credential creation failed: ${error.message}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
