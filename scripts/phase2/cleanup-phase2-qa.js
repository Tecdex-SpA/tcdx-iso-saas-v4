#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('../../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });
const { Pool } = require('../../backend/node_modules/pg');
const { readManifest, RESOURCE_KEYS } = require('./phase2-qa-manifest');

const ROOTS = Object.freeze({
  processing_activity_ids: ['privacy_processing_activities', 'code'],
  privacy_request_ids: ['privacy_data_subject_requests', 'request_number'],
  privacy_breach_ids: ['privacy_breaches', 'breach_number'],
  incident_ids: ['grc_incidents', 'incident_number'],
  supplier_ids: ['grc_suppliers', 'code'],
  questionnaire_template_ids: ['grc_questionnaire_templates', 'code'],
  connector_ids: ['tenant_integrations', 'display_name'],
  export_ids: ['grc_exports', null],
});

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function poolConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  const names = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = names.filter(name => !String(process.env[name] || '').trim());
  if (missing.length) throw new Error(`Database configuration is incomplete: ${missing.join(', ')}`);
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true'
      ? { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false' }
      : undefined,
  };
}

function validateGuard(manifest) {
  if (required('PHASE2_QA_ENV').toLowerCase() !== 'qa') throw new Error('PHASE2_QA_ENV must equal qa');
  const expected = `CLEAN_PHASE2_QA:${manifest.run_id}`;
  if (required('PHASE2_QA_CONFIRM') !== expected) throw new Error(`PHASE2_QA_CONFIRM must equal ${expected}`);
}

async function rootCount(client, table, ids, tenantId, prefixColumn, prefix) {
  if (!ids.length) return 0;
  const result = await client.query(
    `SELECT COUNT(*)::int AS selected,
            COUNT(*) FILTER (WHERE tenant_id=$2::uuid)::int AS owned,
            COUNT(*) FILTER (WHERE tenant_id=$2::uuid ${prefixColumn ? `AND ${prefixColumn} LIKE $3` : ''})::int AS safe
       FROM ${table} WHERE id=ANY($1::uuid[])`,
    prefixColumn ? [ids, tenantId, `${prefix}%`] : [ids, tenantId]
  );
  const row = result.rows[0];
  if (Number(row.selected) !== 0 && Number(row.selected) !== ids.length) {
    throw new Error(`${table} partial manifest selection is unsafe`);
  }
  if (Number(row.owned) !== Number(row.selected) || Number(row.safe) !== Number(row.selected)) {
    throw new Error(`${table} tenant ownership or QA prefix validation failed`);
  }
  return Number(row.selected);
}

function safePortalPath(storagePath, tenantId) {
  const root = path.resolve(__dirname, '../../backend/uploads/supplier-portal', tenantId);
  const resolved = path.resolve(storagePath);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

async function runCleanup({ manifest, pool }) {
  const client = await pool.connect();
  const tenantId = manifest.tenant_id;
  const deleted = {};
  let portalPaths = [];
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('phase2_qa_cleanup:' || $1::text))", [tenantId]);
    for (const key of RESOURCE_KEYS) {
      const [table, prefixColumn] = ROOTS[key];
      await rootCount(client, table, manifest.resources[key], tenantId, prefixColumn, manifest.prefix);
    }

    const allRootIds = RESOURCE_KEYS.flatMap(key => manifest.resources[key]);
    const supplierIds = manifest.resources.supplier_ids;
    if (supplierIds.length) {
      const evidence = await client.query(
        `SELECT e.storage_path FROM grc_supplier_portal_evidence e
         WHERE e.tenant_id=$1::uuid AND e.supplier_id=ANY($2::uuid[])`,
        [tenantId, supplierIds]
      );
      portalPaths = evidence.rows.map(row => safePortalPath(row.storage_path, tenantId)).filter(Boolean);
    }
    const external = manifest.resources.connector_ids.length
      ? await client.query(
        `SELECT id FROM grc_external_records
         WHERE tenant_id=$1::uuid AND integration_id=ANY($2::uuid[])`,
        [tenantId, manifest.resources.connector_ids]
      )
      : { rows: [] };
    const auditDescendantIds = [];
    if (manifest.resources.processing_activity_ids.length) {
      const rows = await client.query(
        `SELECT id FROM privacy_dpias
         WHERE tenant_id=$1::uuid AND processing_activity_id=ANY($2::uuid[])`,
        [tenantId, manifest.resources.processing_activity_ids]
      );
      auditDescendantIds.push(...rows.rows.map(row => row.id));
    }
    if (manifest.resources.supplier_ids.length) {
      const rows = await client.query(
        `SELECT id FROM grc_supplier_portal_invitations
         WHERE tenant_id=$1::uuid AND supplier_id=ANY($2::uuid[])`,
        [tenantId, manifest.resources.supplier_ids]
      );
      auditDescendantIds.push(...rows.rows.map(row => row.id));
    }
    const relatedIds = [...new Set([...allRootIds, ...auditDescendantIds, ...external.rows.map(row => row.id)])];
    let cleanupAuditIds = relatedIds;

    async function remove(name, sql, parameters) {
      const result = await client.query(sql, parameters);
      deleted[name] = result.rowCount;
    }

    if (relatedIds.length) {
      const relationRows = await client.query(
        `SELECT id FROM grc_phase2_relations
         WHERE tenant_id=$1::uuid AND (source_id=ANY($2::uuid[]) OR target_id=ANY($2::uuid[]))`,
        [tenantId, relatedIds]
      );
      const auditIds = [...new Set([...relatedIds, ...relationRows.rows.map(row => row.id)])];
      cleanupAuditIds = auditIds;
      await remove('relations', `DELETE FROM grc_phase2_relations
        WHERE tenant_id=$1::uuid AND (source_id=ANY($2::uuid[]) OR target_id=ANY($2::uuid[]))`, [tenantId, relatedIds]);
      await remove('alerts', `DELETE FROM grc_operational_alerts
        WHERE tenant_id=$1::uuid AND entity_id=ANY($2::uuid[])`, [tenantId, relatedIds]);
      await remove('metrics', `DELETE FROM grc_metric_observations
        WHERE tenant_id=$1::uuid AND (entity_id=ANY($2::uuid[]) OR source_id=ANY($2::uuid[]))`, [tenantId, relatedIds]);
      await remove('events', `DELETE FROM grc_domain_events
        WHERE tenant_id=$1::uuid AND aggregate_id=ANY($2::uuid[])`, [tenantId, relatedIds]);
      await remove('audit_events', `DELETE FROM audit_event_log
        WHERE tenant_id=$1::uuid AND record_id=ANY($2::uuid[])`, [tenantId, auditIds]);
    }

    const order = [
      ['privacy_breach_ids', 'privacy_breaches'],
      ['privacy_request_ids', 'privacy_data_subject_requests'],
      ['processing_activity_ids', 'privacy_processing_activities'],
      ['incident_ids', 'grc_incidents'],
      ['supplier_ids', 'grc_suppliers'],
      ['questionnaire_template_ids', 'grc_questionnaire_templates'],
      ['connector_ids', 'tenant_integrations'],
      ['export_ids', 'grc_exports'],
    ];
    for (const [key, table] of order) {
      const ids = manifest.resources[key];
      if (ids.length) {
        await remove(key.replace(/_ids$/, ''), `DELETE FROM ${table}
          WHERE tenant_id=$1::uuid AND id=ANY($2::uuid[])`, [tenantId, ids]);
      } else {
        deleted[key.replace(/_ids$/, '')] = 0;
      }
    }

    const remaining = {};
    for (const key of RESOURCE_KEYS) {
      const [table] = ROOTS[key];
      const ids = manifest.resources[key];
      remaining[key] = ids.length
        ? Number((await client.query(`SELECT COUNT(*)::int AS count FROM ${table}
            WHERE tenant_id=$1::uuid AND id=ANY($2::uuid[])`, [tenantId, ids])).rows[0].count)
        : 0;
    }
    if (relatedIds.length) {
      remaining.relations = Number((await client.query(
        `SELECT COUNT(*)::int AS count FROM grc_phase2_relations
         WHERE tenant_id=$1::uuid AND (source_id=ANY($2::uuid[]) OR target_id=ANY($2::uuid[]))`,
        [tenantId, relatedIds]
      )).rows[0].count);
      remaining.events = Number((await client.query(
        `SELECT COUNT(*)::int AS count FROM grc_domain_events
         WHERE tenant_id=$1::uuid AND aggregate_id=ANY($2::uuid[])`,
        [tenantId, relatedIds]
      )).rows[0].count);
      remaining.alerts = Number((await client.query(
        `SELECT COUNT(*)::int AS count FROM grc_operational_alerts
         WHERE tenant_id=$1::uuid AND entity_id=ANY($2::uuid[])`,
        [tenantId, relatedIds]
      )).rows[0].count);
      remaining.metrics = Number((await client.query(
        `SELECT COUNT(*)::int AS count FROM grc_metric_observations
         WHERE tenant_id=$1::uuid AND (entity_id=ANY($2::uuid[]) OR source_id=ANY($2::uuid[]))`,
        [tenantId, relatedIds]
      )).rows[0].count);
      remaining.audit_events = Number((await client.query(
        `SELECT COUNT(*)::int AS count FROM audit_event_log
         WHERE tenant_id=$1::uuid AND record_id=ANY($2::uuid[])`,
        [tenantId, cleanupAuditIds]
      )).rows[0].count);
    }
    if (Object.values(remaining).some(Boolean)) {
      throw new Error(`Phase 2 QA cleanup verification failed: ${JSON.stringify(remaining)}`);
    }
    const triggers = await client.query(`SELECT tgname,tgenabled FROM pg_trigger
      WHERE tgname IN ('trg_grc_published_workflow_immutable','trg_grc_readiness_snapshot_immutable','trg_grc_readiness_result_immutable')`);
    if (triggers.rows.length !== 3 || triggers.rows.some(row => row.tgenabled !== 'O')) {
      throw new Error('One or more GRC immutability triggers are not enabled');
    }
    await client.query('COMMIT');
    for (const storagePath of portalPaths) {
      await fs.promises.unlink(storagePath).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    return {
      ok: true,
      status: Object.values(deleted).some(Boolean) ? 'CLEANED' : 'ALREADY_CLEAN',
      tenant_id: tenantId,
      run_id: manifest.run_id,
      deleted,
      remaining,
      portal_files_removed: portalPaths.length,
      immutability_triggers: 'enabled',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const tenantId = required('PHASE2_TENANT_ID');
  const manifest = readManifest(path.resolve(required('PHASE2_QA_MANIFEST')), tenantId);
  validateGuard(manifest);
  const pool = new Pool(poolConfig());
  try {
    const report = await runCleanup({ manifest, pool });
    const output = path.resolve(process.env.PHASE2_QA_CLEANUP_REPORT || 'artifacts/fase-2/phase2-cleanup-result.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Phase 2 QA cleanup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { poolConfig, runCleanup, validateGuard };
