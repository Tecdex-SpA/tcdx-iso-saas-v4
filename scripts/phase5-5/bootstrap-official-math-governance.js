#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const { syncMathGovernanceCatalog } = require('../../backend/src/services/math-governance/formulaBootstrap.service');
function requireUrl() { const value = String(process.env.MIGRATION_DATABASE_URL || '').trim(); if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL is required for local math-governance bootstrap'); return value; }
async function main() {
  const client = new Client({ connectionString: requireUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const result = await syncMathGovernanceCatalog(client, {});
    await client.query('COMMIT');
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM official_formula_definitions WHERE tenant_id IS NULL) AS formulas,
        (SELECT COUNT(*)::int FROM official_formula_versions WHERE tenant_id IS NULL AND status='published') AS versions,
        (SELECT COUNT(*)::int FROM official_formula_source_contracts WHERE tenant_id IS NULL AND status='published') AS contracts`);
    process.stdout.write(JSON.stringify({ status: result.status, counts: counts.rows[0] }) + '\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    await client.end();
  }
}
main().catch((error) => { process.stderr.write(String(error.message || error).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]') + '\n'); process.exit(1); });
