#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION_FILE = path.join(root, 'database/migrations/20260803_demo_tenant_visual_completion.sql');
const MANIFEST_FILE = path.join(__dirname, 'demo-visual-completion.manifest.json');
const DEFAULT_ATTESTATION = path.join(root, '.demo-migration/visual-completion-attestation.json');
const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026080304;
const ATTESTATION_TTL_MS = 30 * 60 * 1000;
const PROHIBITED_SQL = [
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bDROP\s+(?:TABLE|DATABASE|SCHEMA)\b/i,
  /\bCREATE\s+DATABASE\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bCOPY\b[\s\S]*\bPROGRAM\b/i,
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i
];

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sanitizeError(error) {
  return String(error?.message || 'demo visual completion error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/(?:password|token|secret)\s*=\s*\S+/gi, '[redacted-secret]')
    .replace(new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[repo]')
    .slice(0, 1800);
}

function loadInputs() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const meaningful = sql.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('--'));
  if (!/^BEGIN\s*;$/i.test(meaningful[0]) || !/^COMMIT\s*;$/i.test(meaningful.at(-1))) {
    throw new Error('Visual completion SQL must be wrapped by one outer BEGIN/COMMIT');
  }
  if (meaningful.filter((line) => /^BEGIN\s*;$/i.test(line)).length !== 1 || meaningful.filter((line) => /^COMMIT\s*;$/i.test(line)).length !== 1) {
    throw new Error('Visual completion SQL must contain exactly one outer transaction');
  }
  for (const pattern of PROHIBITED_SQL) {
    if (pattern.test(sql)) throw new Error(`Visual completion SQL contains prohibited statement: ${pattern.source}`);
  }
  const tempTables = new Set(Array.from(sql.matchAll(/\bCREATE\s+TEMP(?:ORARY)?\s+TABLE\s+([a-z_][a-z0-9_]*)/gi), (match) => match[1].toLowerCase()));
  const actual = new Set(Array.from(sql.matchAll(/\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)/gi), (match) => match[1].toLowerCase()));
  for (const match of sql.matchAll(/\bUPDATE\s+([a-z_][a-z0-9_]*)/gi)) actual.add(match[1].toLowerCase());
  actual.delete('set');
  for (const table of tempTables) actual.delete(table);
  const declared = new Set(manifest.touchedTables);
  const missing = [...actual].filter((table) => !declared.has(table));
  const stale = [...declared].filter((table) => !actual.has(table));
  if (missing.length || stale.length) throw new Error(`Manifest/SQL table mismatch missing=${missing.join(',') || 'none'} stale=${stale.join(',') || 'none'}`);
  if (!sql.includes(manifest.demoTenantId) || !sql.includes(manifest.demoRut)) throw new Error('Visual completion SQL is missing deterministic tenant identity guards');
  return { manifest, sql, body: meaningful.slice(1, -1).join('\n'), checksum: sha256(sql) };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL URL');
  if (/prod|production/i.test(value) && process.env.ALLOW_DEMO_PRODUCTION_WRITE !== 'I_UNDERSTAND') {
    throw new Error('Refusing a production-looking database URL without explicit production acknowledgement');
  }
  return value;
}

function attestationFile() {
  return path.resolve(process.env.DEMO_VISUAL_ATTESTATION_FILE || DEFAULT_ATTESTATION);
}

async function tableMetadata(client, tables) {
  const columns = await client.query(`SELECT table_name,column_name,data_type,udt_schema,udt_name,is_nullable,column_default
      FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])
      ORDER BY table_name,ordinal_position`, [tables]);
  const constraints = await client.query(`SELECT rel.relname table_name,c.conname,c.contype,c.convalidated,pg_get_constraintdef(c.oid,true) definition
      FROM pg_constraint c JOIN pg_class rel ON rel.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=rel.relnamespace
      WHERE ns.nspname='public' AND rel.relname=ANY($1::text[]) ORDER BY rel.relname,c.conname`, [tables]);
  const indexes = await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1::text[]) ORDER BY tablename,indexname`, [tables]);
  const triggers = await client.query(`SELECT rel.relname table_name,t.tgname,pg_get_triggerdef(t.oid,true) definition
      FROM pg_trigger t JOIN pg_class rel ON rel.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=rel.relnamespace
      WHERE ns.nspname='public' AND NOT t.tgisinternal AND rel.relname=ANY($1::text[]) ORDER BY rel.relname,t.tgname`, [tables]);
  const enums = await client.query(`SELECT typ.typname,en.enumlabel,en.enumsortorder FROM pg_type typ JOIN pg_enum en ON en.enumtypid=typ.oid
      WHERE typ.oid IN (SELECT DISTINCT a.atttypid FROM pg_attribute a JOIN pg_class r ON r.oid=a.attrelid
        JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname=ANY($1::text[]))
      ORDER BY typ.typname,en.enumsortorder`, [tables]);
  return { columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows, triggers: triggers.rows, enums: enums.rows };
}

async function schemaSignature(client, manifest) {
  return sha256(stableStringify(await tableMetadata(client, [...manifest.touchedTables, 'schema_migrations'])));
}

async function databaseFingerprint(client) {
  const result = await client.query(`SELECT current_database() database_name,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) database_oid,
    COALESCE(inet_server_addr()::text,'socket') server_address,
    COALESCE(inet_server_port()::text,'socket') server_port,
    current_setting('server_version_num') server_version`);
  return { identity: result.rows[0], hash: sha256(stableStringify(result.rows[0])) };
}

async function ledgerEntry(client, migrationId) {
  const result = await client.query('SELECT migration_id,checksum,status,details FROM schema_migrations WHERE migration_id=$1', [migrationId]);
  return result.rows[0] || null;
}

async function rowCounts(client, tables) {
  const output = {};
  for (const table of tables) {
    const result = await client.query(`SELECT count(*)::int count FROM ${table}`);
    output[table] = result.rows[0].count;
  }
  return output;
}

async function foreignTenantCounts(client, manifest) {
  const columnResult = await client.query(`SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='tenant_id' AND table_name=ANY($1::text[]) ORDER BY table_name`, [manifest.touchedTables]);
  const output = {};
  for (const { table_name: table } of columnResult.rows) {
    const result = await client.query(`SELECT count(*)::int count FROM ${table} WHERE tenant_id<>$1::uuid`, [manifest.demoTenantId]);
    output[table] = result.rows[0].count;
  }
  return output;
}

async function postconditions(client, manifest) {
  const result = await client.query(`SELECT jsonb_build_object(
    'applicable_controls',(SELECT count(*) FROM tenant_applicable_controls WHERE tenant_id=$1::uuid),
    'control_health',(SELECT count(*) FROM control_health_scores WHERE tenant_id=$1::uuid),
    'kpi_points',(SELECT count(*) FROM kpi_snapshots WHERE tenant_id=$1::uuid),
    'audit_workpapers',(SELECT count(*) FROM grc_audit_workpapers WHERE tenant_id=$1::uuid),
    'incidents',(SELECT count(*) FROM grc_incidents WHERE tenant_id=$1::uuid),
    'incident_events',(SELECT count(*) FROM grc_incident_timeline WHERE tenant_id=$1::uuid),
    'supplier_assessments',(SELECT count(*) FROM grc_supplier_assessments WHERE tenant_id=$1::uuid),
    'continuity_tests',(SELECT count(*) FROM grc_continuity_tests WHERE tenant_id=$1::uuid),
    'operational_metric_points',(SELECT count(*) FROM grc_metric_measurements WHERE tenant_id=$1::uuid),
    'quality_assessments',(SELECT count(*) FROM data_quality_assessments WHERE tenant_id=$1::uuid),
    'survey_answers',(SELECT count(*) FROM survey_response_items WHERE tenant_id=$1::uuid),
    'assurance_samples',(SELECT count(*) FROM assurance_test_samples WHERE tenant_id=$1::uuid),
    'operational_suggestions',(SELECT count(*) FROM iso_operational_suggestions WHERE tenant_id=$1::uuid),
    'report_exports',(SELECT count(*) FROM report_exports WHERE tenant_id=$1::uuid),
    'iso_risks',(SELECT count(*) FROM iso_risk_matrix_items WHERE tenant_id=$1::uuid),
    'risk_simulations',(SELECT count(*) FROM operational_risk_simulations WHERE tenant_id=$1::uuid)
  ) checks`, [manifest.demoTenantId]);
  const checks = result.rows[0].checks;
  const minimums = { applicable_controls: 55, control_health: 55, kpi_points: 144, audit_workpapers: 15, incidents: 12, incident_events: 48, supplier_assessments: 8, continuity_tests: 24, operational_metric_points: 96, quality_assessments: 216, survey_answers: 96, assurance_samples: 60, operational_suggestions: 16, report_exports: 12, iso_risks: 24, risk_simulations: 8 };
  for (const [name, minimum] of Object.entries(minimums)) {
    if (Number(checks[name] || 0) < minimum) throw new Error(`Visual completion postcondition failed: ${name}=${checks[name]} minimum=${minimum}`);
  }
  process.stdout.write(`visual_postconditions=${JSON.stringify(checks)}\n`);
  return checks;
}

async function preflight(client, inputs) {
  const { manifest, checksum } = inputs;
  const ledgerColumns = await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='schema_migrations'`);
  const names = new Set(ledgerColumns.rows.map((row) => row.column_name));
  for (const required of ['migration_id','checksum','applied_at','applied_by','duration_ms','status','details']) {
    if (!names.has(required)) throw new Error(`schema_migrations is missing ${required}`);
  }
  const foundTables = await client.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name=ANY($1::text[])`, [manifest.touchedTables]);
  const found = new Set(foundTables.rows.map((row) => row.table_name));
  const missing = manifest.touchedTables.filter((table) => !found.has(table));
  if (missing.length) throw new Error(`Visual completion preflight missing tables: ${missing.join(', ')}`);
  const identity = await client.query(`SELECT t.id,t.rut,t.name,
    array_agg(u.email ORDER BY u.email) FILTER (WHERE u.email=ANY($2::text[])) users
    FROM tenants t LEFT JOIN users u ON u.tenant_id=t.id WHERE t.id=$1::uuid GROUP BY t.id,t.rut,t.name`,
  [manifest.demoTenantId, manifest.demoUsers]);
  const tenant = identity.rows[0];
  if (!tenant || tenant.rut !== manifest.demoRut || tenant.name !== manifest.demoName || stableStringify(tenant.users) !== stableStringify([...manifest.demoUsers].sort())) {
    throw new Error('Visual completion preflight requires the exact deterministic Demo Tecdex tenant and both demo users');
  }
  const baseLedger = await ledgerEntry(client, manifest.baseMigrationId);
  if (!baseLedger || baseLedger.status !== 'applied') throw new Error(`Base demo migration ${manifest.baseMigrationId} is not applied`);
  const ledger = await ledgerEntry(client, manifest.migrationId);
  if (ledger?.status === 'applied' && ledger.checksum !== checksum) {
    const error = new Error('Applied visual completion checksum differs from the local migration');
    error.preserveLedger = true;
    throw error;
  }
  const denied = [];
  for (const table of manifest.touchedTables) {
    const permission = await client.query(`SELECT has_table_privilege(current_user,$1,'SELECT,INSERT,UPDATE') allowed`, [`public.${table}`]);
    if (permission.rows[0].allowed !== true) denied.push(table);
  }
  if (denied.length) throw new Error(`Visual completion preflight missing privileges: ${denied.join(', ')}`);
  const signature = await schemaSignature(client, manifest);
  const fingerprint = await databaseFingerprint(client);
  process.stdout.write(`database_name=${fingerprint.identity.database_name}\n`);
  process.stdout.write(`migration_user=${client.user}\n`);
  process.stdout.write(`ledger_status=${ledger?.status || 'not_recorded'}\n`);
  process.stdout.write(`retry_from_failed=${ledger?.status === 'failed'}\n`);
  process.stdout.write(`touched_tables=${manifest.touchedTables.length}\n`);
  process.stdout.write(`schema_signature=${signature}\n`);
  process.stdout.write(`database_fingerprint=${fingerprint.hash}\n`);
  return { ledger, signature, fingerprint };
}

function writeAttestation(data) {
  const file = attestationFile();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  return file;
}

function validateAttestation(expected) {
  const file = attestationFile();
  if (!fs.existsSync(file)) throw new Error('Visual completion apply blocked: successful dry-run attestation is missing');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.migrationId !== expected.migrationId || data.checksum !== expected.checksum) throw new Error('Visual completion apply blocked: checksum attestation mismatch');
  if (data.schemaSignature !== expected.schemaSignature) throw new Error('Visual completion apply blocked: schema changed after dry-run');
  if (data.databaseFingerprint !== expected.databaseFingerprint) throw new Error('Visual completion apply blocked: attestation belongs to another database');
  const completed = Date.parse(data.completedAt);
  if (!Number.isFinite(completed) || completed > Date.now() + 60_000 || Date.now() - completed > ATTESTATION_TTL_MS) throw new Error('Visual completion apply blocked: dry-run attestation expired');
  return data;
}

async function runDryRun(client, url, inputs, context) {
  const baselineRows = await rowCounts(client, inputs.manifest.touchedTables);
  const baselineForeign = await foreignTenantCounts(client, inputs.manifest);
  const ledgerBefore = context.ledger;
  await client.query('BEGIN');
  try {
    await client.query(inputs.body);
    const checks = await postconditions(client, inputs.manifest);
    await client.query('ROLLBACK');
    const verifier = new Client({ connectionString: url });
    await verifier.connect();
    try {
      const rowsAfter = await rowCounts(verifier, inputs.manifest.touchedTables);
      const foreignAfter = await foreignTenantCounts(verifier, inputs.manifest);
      const ledgerAfter = await ledgerEntry(verifier, inputs.manifest.migrationId);
      const signatureAfter = await schemaSignature(verifier, inputs.manifest);
      if (stableStringify(rowsAfter) !== stableStringify(baselineRows)) throw new Error('Dry-run rollback changed persistent table counts');
      if (stableStringify(foreignAfter) !== stableStringify(baselineForeign)) throw new Error('Dry-run changed another tenant');
      if (stableStringify(ledgerAfter) !== stableStringify(ledgerBefore)) throw new Error('Dry-run changed schema_migrations');
      if (signatureAfter !== context.signature) throw new Error('Dry-run changed persistent schema');
    } finally {
      await verifier.end();
    }
    const completedAt = new Date().toISOString();
    const file = writeAttestation({ version: 1, migrationId: inputs.manifest.migrationId, checksum: inputs.checksum,
      schemaSignature: context.signature, databaseFingerprint: context.fingerprint.hash, completedAt,
      expiresAt: new Date(Date.parse(completedAt) + ATTESTATION_TTL_MS).toISOString(), checks });
    process.stdout.write(`Visual completion dry-run OK rollback=verified attestation=${path.relative(root, file)}\n`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { process.stderr.write(`rollback_error=${sanitizeError(rollbackError)}\n`); }
    throw error;
  }
}

async function main(mode) {
  const inputs = loadInputs();
  if (mode === 'checksum') {
    process.stdout.write(`${inputs.manifest.migrationId} checksum=${inputs.checksum}\n`);
    process.stdout.write(`manifest_checksum=${sha256(stableStringify(inputs.manifest))}\n`);
    return;
  }
  const url = databaseUrl();
  const client = new Client({ connectionString: url });
  const started = Date.now();
  let locked = false;
  let recordFailure = false;
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1,$2) acquired', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0].acquired !== true) throw new Error('Another visual completion process holds the advisory lock');
    locked = true;
    const context = await preflight(client, inputs);
    if (mode === 'preflight') {
      process.stdout.write(`Visual completion preflight OK pending=${context.ledger?.status === 'applied' ? 'none' : inputs.manifest.migrationId}\n`);
      return;
    }
    if (mode === 'dry-run') return await runDryRun(client, url, inputs, context);
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight, --dry-run or --apply');
    validateAttestation({ migrationId: inputs.manifest.migrationId, checksum: inputs.checksum,
      schemaSignature: context.signature, databaseFingerprint: context.fingerprint.hash });
    if (context.ledger?.status === 'applied') {
      await postconditions(client, inputs.manifest);
      process.stdout.write('Visual completion apply: already_applied\n');
      return;
    }
    const foreignBefore = await foreignTenantCounts(client, inputs.manifest);
    await client.query('BEGIN');
    recordFailure = true;
    await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
      VALUES ($1,$2,current_user,'running',$3::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
    [inputs.manifest.migrationId, inputs.checksum, JSON.stringify({ scope: 'demo-tenant-only', schema_signature: context.signature })]);
    await client.query(inputs.body);
    const checks = await postconditions(client, inputs.manifest);
    const foreignAfter = await foreignTenantCounts(client, inputs.manifest);
    if (stableStringify(foreignAfter) !== stableStringify(foreignBefore)) throw new Error('Tenant isolation failed: another tenant changed');
    await client.query(`UPDATE schema_migrations SET checksum=$2,applied_at=now(),applied_by=current_user,
      duration_ms=$3,status='applied',details=$4::jsonb WHERE migration_id=$1`,
    [inputs.manifest.migrationId, inputs.checksum, Date.now() - started, JSON.stringify({ ...checks, schema_signature: context.signature })]);
    await client.query('COMMIT');
    recordFailure = false;
    process.stdout.write(`Visual completion applied: ${inputs.manifest.migrationId}\n`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { process.stderr.write(`rollback_error=${sanitizeError(rollbackError)}\n`); }
    if (recordFailure && !error.preserveLedger) {
      try {
        await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,duration_ms,status,details)
          VALUES ($1,$2,current_user,$3,'failed',$4::jsonb)
          ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,
            duration_ms=EXCLUDED.duration_ms,status='failed',details=EXCLUDED.details`,
        [inputs.manifest.migrationId, inputs.checksum, Date.now() - started, JSON.stringify({ error: sanitizeError(error) })]);
      } catch (ledgerError) { process.stderr.write(`ledger_error=${sanitizeError(ledgerError)}\n`); }
    }
    throw error;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1,$2)', [LOCK_NAMESPACE, LOCK_KEY]).catch((error) => process.stderr.write(`unlock_error=${sanitizeError(error)}\n`));
    await client.end();
  }
}

main((process.argv[2] || '--checksum').replace(/^--/, '')).catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
