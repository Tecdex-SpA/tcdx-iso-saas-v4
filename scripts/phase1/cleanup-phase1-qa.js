#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('../../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });
const { Pool } = require('../../backend/node_modules/pg');
const { readManifest, RESOURCE_KEYS } = require('./phase1-qa-manifest');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validateGuard(manifest) {
  if (required('PHASE1_QA_ENV').toLowerCase() !== 'qa') {
    throw new Error('PHASE1_QA_ENV must equal qa');
  }
  const expected = `CLEAN_PHASE1_QA:${manifest.run_id}`;
  if (required('PHASE1_QA_CONFIRM') !== expected) {
    throw new Error(`PHASE1_QA_CONFIRM must equal ${expected}`);
  }
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

async function countFrozen(client, table) {
  return Number((await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`)).rows[0].count);
}

async function assertRootSelection(client, { table, tempTable, ids, tenantId, extra = '' }) {
  const present = await client.query(
    `SELECT COUNT(*)::int AS count FROM ${table} r JOIN ${tempTable} t ON t.id = r.id`,
  );
  const selected = Number(present.rows[0].count);
  if (selected !== 0 && selected !== ids.length) {
    throw new Error(`${table} partial selection is unsafe: manifest=${ids.length} present=${selected}`);
  }
  if (selected) {
    const ownership = await client.query(
      `SELECT COUNT(*)::int AS count FROM ${table} r JOIN ${tempTable} t ON t.id = r.id
       WHERE r.tenant_id = $1::uuid ${extra}`,
      [tenantId]
    );
    if (Number(ownership.rows[0].count) !== selected) throw new Error(`${table} ownership or QA prefix validation failed`);
  }
  return selected;
}

async function runCleanup({ manifest, pool }) {
  const tenantId = manifest.tenant_id;
  const client = await pool.connect();
  const deleted = {};
  let workflowTriggerDisabled = false;
  let readinessTriggersDisabled = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('phase1_qa_cleanup:' || $1::text))", [tenantId]);

    for (const key of RESOURCE_KEYS) {
      const table = `qa_${key.replace(/_ids$/, '')}`;
      await client.query(`CREATE TEMP TABLE ${table} (id uuid PRIMARY KEY) ON COMMIT DROP`);
      if (manifest.resources[key].length) {
        await client.query(`INSERT INTO ${table} (id) SELECT unnest($1::uuid[])`, [manifest.resources[key]]);
      }
    }

    await client.query(`CREATE TEMP TABLE qa_bootstrap_run ON COMMIT DROP AS
      SELECT id FROM grc_bootstrap_runs
      WHERE tenant_id = $1::uuid
        AND idempotency_key = ANY($2::text[])`, [
      tenantId,
      [`phase1-${manifest.run_id}`, `phase1-bootstrap-${manifest.run_id.toLowerCase()}`],
    ]);

    await assertRootSelection(client, { table: 'grc_workflow_definitions', tempTable: 'qa_workflow_definition', ids: manifest.resources.workflow_definition_ids, tenantId, extra: "AND r.code LIKE 'phase1r_qa_%'" });
    await assertRootSelection(client, { table: 'grc_evidence_requests', tempTable: 'qa_evidence_request', ids: manifest.resources.evidence_request_ids, tenantId, extra: "AND r.title LIKE 'PHASE1R_QA_%'" });
    const roots = [
      ['grc_workflow_instances', 'qa_workflow_instance', 'workflow_instance_ids'],
      ['grc_readiness_snapshots', 'qa_readiness_snapshot', 'readiness_snapshot_ids'],
      ['grc_audit_annual_plans', 'qa_audit_annual_plan', 'audit_annual_plan_ids'],
      ['grc_escalation_policies', 'qa_escalation_policy', 'escalation_policy_ids'],
      ['grc_scheduler_runs', 'qa_scheduler_run', 'scheduler_run_ids'],
      ['grc_audit_workpapers', 'qa_audit_workpaper', 'audit_workpaper_ids'],
      ['grc_requirement_control_mappings', 'qa_mapping', 'mapping_ids'],
      ['grc_audit_programs', 'qa_audit_program', 'audit_program_ids'],
      ['grc_audit_team_members', 'qa_audit_team_member', 'audit_team_member_ids'],
      ['grc_audit_sample_plans', 'qa_audit_sample_plan', 'audit_sample_plan_ids'],
      ['grc_exports', 'qa_export', 'export_ids'],
    ];
    for (const [table, tempTable, key] of roots) {
      await assertRootSelection(client, { table, tempTable, ids: manifest.resources[key], tenantId });
    }

    await client.query(`CREATE TEMP TABLE qa_workflow_version ON COMMIT DROP AS
      SELECT v.id FROM grc_workflow_versions v JOIN qa_workflow_definition d ON d.id = v.definition_id
      WHERE v.tenant_id = $1::uuid`, [tenantId]);
    await client.query(`INSERT INTO qa_workflow_instance (id)
      SELECT i.id FROM grc_workflow_instances i JOIN qa_workflow_definition d ON d.id = i.definition_id
      WHERE i.tenant_id = $1::uuid ON CONFLICT DO NOTHING`, [tenantId]);
    await client.query(`CREATE TEMP TABLE qa_evidence_submission ON COMMIT DROP AS
      SELECT s.id FROM grc_evidence_submissions s JOIN qa_evidence_request r ON r.id = s.request_id
      WHERE s.tenant_id = $1::uuid`, [tenantId]);

    async function remove(name, sql, parameters = [tenantId]) {
      const result = await client.query(sql, parameters);
      deleted[name] = result.rowCount;
    }

    await remove('bootstrap_audit_events', `DELETE FROM audit_event_log r USING qa_bootstrap_run q
      WHERE r.tenant_id = $1::uuid AND r.table_name = 'grc_bootstrap_runs' AND r.record_id = q.id`);
    await remove('bootstrap_runs', 'DELETE FROM grc_bootstrap_runs r USING qa_bootstrap_run q WHERE r.tenant_id = $1::uuid AND r.id = q.id');

    await remove('exports', 'DELETE FROM grc_exports r USING qa_export q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('audit_supervisor_reviews', 'DELETE FROM grc_audit_supervisor_reviews r USING qa_audit_workpaper q WHERE r.tenant_id = $1::uuid AND r.workpaper_id = q.id');
    await remove('audit_workpapers', 'DELETE FROM grc_audit_workpapers r USING qa_audit_workpaper q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('audit_samples', 'DELETE FROM grc_audit_sample_plans r USING qa_audit_sample_plan q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('audit_programs', 'DELETE FROM grc_audit_programs r USING qa_audit_program q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('audit_team_members', 'DELETE FROM grc_audit_team_members r USING qa_audit_team_member q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('audit_annual_plans', 'DELETE FROM grc_audit_annual_plans r USING qa_audit_annual_plan q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('mappings', 'DELETE FROM grc_requirement_control_mappings r USING qa_mapping q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('escalation_events', 'DELETE FROM grc_escalation_events r USING qa_escalation_policy q WHERE r.tenant_id = $1::uuid AND r.policy_id = q.id');
    await remove('escalation_policies', 'DELETE FROM grc_escalation_policies r USING qa_escalation_policy q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('scheduler_runs', 'DELETE FROM grc_scheduler_runs r USING qa_scheduler_run q WHERE r.tenant_id = $1::uuid AND r.id = q.id');

    if (await countFrozen(client, 'qa_readiness_snapshot')) {
      await client.query('LOCK TABLE grc_readiness_results, grc_readiness_snapshots IN ACCESS EXCLUSIVE MODE');
      await client.query('ALTER TABLE grc_readiness_results DISABLE TRIGGER trg_grc_readiness_result_immutable');
      await client.query('ALTER TABLE grc_readiness_snapshots DISABLE TRIGGER trg_grc_readiness_snapshot_immutable');
      readinessTriggersDisabled = true;
      await remove('readiness_findings', 'DELETE FROM grc_readiness_findings r USING qa_readiness_snapshot q WHERE r.tenant_id = $1::uuid AND r.snapshot_id = q.id');
      await remove('readiness_results', 'DELETE FROM grc_readiness_results r USING qa_readiness_snapshot q WHERE r.tenant_id = $1::uuid AND r.snapshot_id = q.id');
      await remove('readiness_snapshots', 'DELETE FROM grc_readiness_snapshots r USING qa_readiness_snapshot q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
      await client.query('ALTER TABLE grc_readiness_results ENABLE TRIGGER trg_grc_readiness_result_immutable');
      await client.query('ALTER TABLE grc_readiness_snapshots ENABLE TRIGGER trg_grc_readiness_snapshot_immutable');
      readinessTriggersDisabled = false;
    }

    await remove('evidence_reviews', 'DELETE FROM grc_evidence_reviews r USING qa_evidence_submission q WHERE r.tenant_id = $1::uuid AND r.submission_id = q.id');
    await remove('evidence_versions', 'DELETE FROM grc_evidence_versions r USING qa_evidence_submission q WHERE r.tenant_id = $1::uuid AND r.submission_id = q.id');
    await remove('evidence_submissions', 'DELETE FROM grc_evidence_submissions r USING qa_evidence_submission q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await client.query('UPDATE grc_evidence_requests r SET schedule_id = NULL FROM qa_evidence_request q WHERE r.tenant_id = $1::uuid AND r.id = q.id', [tenantId]);
    await remove('evidence_requests', 'DELETE FROM grc_evidence_requests r USING qa_evidence_request q WHERE r.tenant_id = $1::uuid AND r.id = q.id');

    await remove('workflow_history', 'DELETE FROM grc_workflow_history r USING qa_workflow_instance q WHERE r.tenant_id = $1::uuid AND r.instance_id = q.id');
    await remove('workflow_approvals', 'DELETE FROM grc_workflow_approvals r USING qa_workflow_instance q WHERE r.tenant_id = $1::uuid AND r.instance_id = q.id');
    await remove('workflow_comments', 'DELETE FROM grc_workflow_comments r USING qa_workflow_instance q WHERE r.tenant_id = $1::uuid AND r.instance_id = q.id');
    await remove('workflow_attachments', 'DELETE FROM grc_workflow_attachments r USING qa_workflow_instance q WHERE r.tenant_id = $1::uuid AND r.instance_id = q.id');
    await remove('workflow_automation_runs', 'DELETE FROM grc_workflow_automation_runs r USING qa_workflow_instance q WHERE r.tenant_id = $1::uuid AND r.instance_id = q.id');
    await remove('workflow_instances', 'DELETE FROM grc_workflow_instances r USING qa_workflow_instance q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
    await remove('workflow_automation_rules', 'DELETE FROM grc_workflow_automation_rules r USING qa_workflow_version q WHERE r.tenant_id = $1::uuid AND r.version_id = q.id');
    await remove('workflow_transition_roles', `DELETE FROM grc_workflow_transition_roles r USING grc_workflow_transitions t, qa_workflow_version q
      WHERE r.tenant_id = $1::uuid AND r.transition_id = t.id AND t.version_id = q.id`);
    await remove('workflow_transitions', 'DELETE FROM grc_workflow_transitions r USING qa_workflow_version q WHERE r.tenant_id = $1::uuid AND r.version_id = q.id');
    await remove('workflow_states', 'DELETE FROM grc_workflow_states r USING qa_workflow_version q WHERE r.tenant_id = $1::uuid AND r.version_id = q.id');
    await client.query('UPDATE grc_workflow_definitions r SET active_version_id = NULL FROM qa_workflow_definition q WHERE r.tenant_id = $1::uuid AND r.id = q.id', [tenantId]);
    if (await countFrozen(client, 'qa_workflow_version')) {
      await client.query('LOCK TABLE grc_workflow_versions IN ACCESS EXCLUSIVE MODE');
      await client.query('ALTER TABLE grc_workflow_versions DISABLE TRIGGER trg_grc_published_workflow_immutable');
      workflowTriggerDisabled = true;
      await remove('workflow_versions', 'DELETE FROM grc_workflow_versions r USING qa_workflow_version q WHERE r.tenant_id = $1::uuid AND r.id = q.id');
      await client.query('ALTER TABLE grc_workflow_versions ENABLE TRIGGER trg_grc_published_workflow_immutable');
      workflowTriggerDisabled = false;
    }
    await remove('workflow_definitions', 'DELETE FROM grc_workflow_definitions r USING qa_workflow_definition q WHERE r.tenant_id = $1::uuid AND r.id = q.id');

    const triggerState = await client.query(`SELECT tgname, tgenabled FROM pg_trigger
      WHERE tgname IN ('trg_grc_published_workflow_immutable','trg_grc_readiness_snapshot_immutable','trg_grc_readiness_result_immutable')`);
    if (triggerState.rows.length !== 3 || triggerState.rows.some(row => row.tgenabled !== 'O')) {
      throw new Error('One or more GRC immutability triggers are not enabled');
    }
    const remaining = {
      workflow_definitions: Number((await client.query('SELECT COUNT(*)::int AS count FROM grc_workflow_definitions r JOIN qa_workflow_definition q ON q.id = r.id')).rows[0].count),
      evidence_requests: Number((await client.query('SELECT COUNT(*)::int AS count FROM grc_evidence_requests r JOIN qa_evidence_request q ON q.id = r.id')).rows[0].count),
      workflow_instances: Number((await client.query('SELECT COUNT(*)::int AS count FROM grc_workflow_instances r JOIN qa_workflow_instance q ON q.id = r.id')).rows[0].count),
      bootstrap_runs: Number((await client.query('SELECT COUNT(*)::int AS count FROM grc_bootstrap_runs r JOIN qa_bootstrap_run q ON q.id = r.id')).rows[0].count),
    };
    if (Object.values(remaining).some(Boolean)) throw new Error(`QA cleanup verification failed: ${JSON.stringify(remaining)}`);
    await client.query('COMMIT');
    return {
      ok: true,
      tenant_id: tenantId,
      run_id: manifest.run_id,
      status: Object.values(deleted).some(Boolean) ? 'CLEANED' : 'ALREADY_CLEAN',
      deleted,
      remaining,
      immutability_triggers: 'enabled',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (workflowTriggerDisabled || readinessTriggersDisabled) {
      error.message = `${error.message}; trigger DDL rolled back transactionally`;
    }
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const tenantId = required('PHASE1_TENANT_ID');
  const manifestPath = path.resolve(required('PHASE1_QA_MANIFEST'));
  const manifest = readManifest(manifestPath, tenantId);
  validateGuard(manifest);
  const pool = new Pool(poolConfig());
  const reportPath = path.resolve(process.env.PHASE1_QA_CLEANUP_REPORT || 'artifacts/fase-1/phase1-cleanup-result.json');
  try {
    const report = await runCleanup({ manifest, pool });
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Phase 1 QA cleanup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { poolConfig, runCleanup, validateGuard };
