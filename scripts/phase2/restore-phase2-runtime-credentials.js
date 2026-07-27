#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
require(path.join(root, 'backend/node_modules/dotenv')).config({ path: path.join(root, 'backend/.env') });
const pool = require(path.join(root, 'backend/src/config/db'));

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  if (required('PHASE2_QA_CONFIRM') !== 'RESTORE_PHASE2_QA_CREDENTIALS') {
    throw new Error('PHASE2_QA_CONFIRM must equal RESTORE_PHASE2_QA_CREDENTIALS');
  }
  const restoreFile = path.resolve(required('PHASE2_QA_RESTORE_FILE'));
  const envFile = path.resolve(required('PHASE2_QA_ENV_FILE'));
  const restore = JSON.parse(fs.readFileSync(restoreFile, 'utf8'));
  if (restore.run_id !== required('PHASE2_QA_RUN_ID')) throw new Error('Restore run does not match PHASE2_QA_RUN_ID');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('phase2_runtime_credentials'))");
    for (const user of restore.users) {
      const current = await client.query('SELECT password_hash FROM users WHERE id=$1::uuid FOR UPDATE', [user.id]);
      if (!current.rowCount || current.rows[0].password_hash !== user.temporary_password_hash) {
        throw new Error(`Temporary credential state changed for QA user ${user.id}`);
      }
      await client.query('UPDATE users SET password_hash=$2 WHERE id=$1::uuid', [user.id, user.old_password_hash]);
    }
    for (const [moduleKey, previous] of Object.entries(restore.modules)) {
      if (!previous) {
        await client.query(
          `DELETE FROM tenant_module_settings
           WHERE tenant_id=$1::uuid AND module_key=$2
             AND metadata->>'runtime_qa_run_id'=$3`,
          [restore.tenant_id, moduleKey, restore.run_id]
        );
      } else {
        await client.query(
          `UPDATE tenant_module_settings SET
             is_enabled=$3,enabled_at=$4,disabled_at=$5,enabled_by=$6::uuid,
             disabled_by=$7::uuid,notes=$8,metadata=$9::jsonb,updated_at=$10
           WHERE tenant_id=$1::uuid AND module_key=$2`,
          [
            restore.tenant_id, moduleKey, previous.is_enabled, previous.enabled_at,
            previous.disabled_at, previous.enabled_by, previous.disabled_by,
            previous.notes, JSON.stringify(previous.metadata || {}), previous.updated_at,
          ]
        );
      }
    }
    await client.query('COMMIT');
    fs.unlinkSync(restoreFile);
    if (fs.existsSync(envFile)) fs.unlinkSync(envFile);
    process.stdout.write(`Phase 2 runtime credentials restored: run=${restore.run_id} accounts=${restore.users.length}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error(`Phase 2 runtime credential restoration failed: ${error.message}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
