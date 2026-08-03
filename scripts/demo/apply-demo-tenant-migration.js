#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION_ID = '20260803_demo_tenant_iso_grc';
const MIGRATION_FILE = path.join(root, 'database/migrations/20260803_demo_tenant_iso_grc.sql');
const MANIFEST_FILE = path.join(__dirname, 'demo-seed-compatibility.manifest.json');
const DEFAULT_ATTESTATION_FILE = path.join(root, '.demo-migration/dry-run-attestation.json');
const ADVISORY_LOCK_NAMESPACE = 844332;
const ADVISORY_LOCK_KEY = 2026080303;
const DRY_RUN_TTL_MS = 30 * 60 * 1000;
const DEMO_AI_PLAN = 'enterprise';
const DEMO_CATALOG_MODE = 'mixed';
const PROHIBITED_SQL = [
  /\bCREATE\s+DATABASE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bVACUUM\b/i,
  /\bREINDEX\s+CONCURRENTLY\b/i,
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bCOPY\b[\s\S]*\bPROGRAM\b/i,
  /\bTRUNCATE\b/i,
];

function sanitizeError(error) {
  return String(error?.message || 'demo tenant migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .replace(/secret\s*=\s*\S+/gi, 'secret=[redacted]')
    .slice(0, 1600);
}

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

function readManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) throw new Error('Demo seed compatibility manifest is missing');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  if (manifest.migrationId !== MIGRATION_ID) throw new Error('Demo compatibility manifest migrationId mismatch');
  if (!Array.isArray(manifest.touchedTables) || !manifest.touchedTables.length) throw new Error('Demo compatibility manifest has no touchedTables');
  if (!Array.isArray(manifest.categoricalContracts) || !manifest.categoricalContracts.length) throw new Error('Demo compatibility manifest has no categoricalContracts');
  return manifest;
}

function assertControlledTransaction(sql) {
  const meaningful = sql.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('--'));
  const beginLines = meaningful.filter((line) => /^BEGIN\s*;$/i.test(line));
  const commitLines = meaningful.filter((line) => /^COMMIT\s*;$/i.test(line));
  if (beginLines.length !== 1 || commitLines.length !== 1) {
    throw new Error('Demo migration must contain exactly one outer BEGIN and one outer COMMIT');
  }
  if (!/^BEGIN\s*;$/i.test(meaningful[0]) || !/^COMMIT\s*;$/i.test(meaningful[meaningful.length - 1])) {
    throw new Error('Demo migration outer transaction must wrap the complete SQL file');
  }
  for (const pattern of PROHIBITED_SQL) {
    if (pattern.test(sql)) throw new Error(`Demo migration contains prohibited non-transactional SQL: ${pattern.source}`);
  }
}

function unwrapMigrationTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => /^BEGIN\s*;$/i.test(line.trim()));
  const commit = lines.findIndex((line) => /^COMMIT\s*;$/i.test(line.trim()));
  if (begin < 0 || commit < 0 || begin >= commit) throw new Error('Demo migration outer transaction is invalid');
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

function extractTouchedTables(sql) {
  const tempTables = new Set(Array.from(sql.matchAll(/\bCREATE\s+TEMP(?:ORARY)?\s+TABLE\s+([a-z_][a-z0-9_]*)/gi), (match) => match[1].toLowerCase()));
  const touched = new Set();
  for (const match of sql.matchAll(/\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)/gi)) touched.add(match[1].toLowerCase());
  for (const match of sql.matchAll(/\bUPDATE\s+([a-z_][a-z0-9_]*)/gi)) {
    if (match[1].toLowerCase() !== 'set') touched.add(match[1].toLowerCase());
  }
  for (const table of tempTables) touched.delete(table);
  return [...touched].sort();
}

function assertManifestMatchesSql(manifest, sql) {
  const actual = extractTouchedTables(sql);
  const declared = [...manifest.touchedTables].sort();
  const missing = actual.filter((table) => !declared.includes(table));
  const stale = declared.filter((table) => !actual.includes(table));
  if (missing.length || stale.length) {
    throw new Error(`Demo manifest touchedTables mismatch: missing=${missing.join(',') || 'none'} stale=${stale.join(',') || 'none'}`);
  }
  for (const contract of manifest.categoricalContracts) {
    for (const value of contract.seedValues) {
      if (!contract.allowedValues.includes(value)) {
        throw new Error(`Manifest rejects seed value ${contract.table}.${contract.column}=${value}`);
      }
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`'${escaped}'`).test(sql)) {
        throw new Error(`Manifest seed value is not present in SQL: ${contract.table}.${contract.column}=${value}`);
      }
    }
  }
}

function readMigration(manifest) {
  if (!fs.existsSync(MIGRATION_FILE)) throw new Error('Demo tenant migration file is missing');
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  assertControlledTransaction(sql);
  assertManifestMatchesSql(manifest, sql);
  const invalidValues = ['demo_enterprise', 'demo_integrated', 'tenant_demo', 'no_conformidad_menor', 'oportunidad_mejora', 'conformidad_destacada', 'en_progreso', 'planificado'];
  const found = invalidValues.filter((value) => sql.includes(`'${value}'`));
  if (found.length) throw new Error(`Demo migration contains production-incompatible categorical values: ${found.join(', ')}`);
  if (!sql.includes(`ai_plan = '${DEMO_AI_PLAN}'`) || !sql.includes(`now(), '${DEMO_CATALOG_MODE}', now(), 'active'`)) {
    throw new Error('Demo migration does not contain required production ai_plan/catalog_mode values');
  }
  return { sql, checksum: sha256(sql) };
}

function requireMigrationDatabaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!value) throw new Error('MIGRATION_DATABASE_URL is required for demo tenant data migrations');
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL connection URL');
  if (/prod|production/i.test(value) && process.env.ALLOW_DEMO_PRODUCTION_WRITE !== 'I_UNDERSTAND') {
    throw new Error('Refusing to run demo tenant migration against a production-looking database URL');
  }
  return value;
}

function attestationPath() {
  return path.resolve(process.env.DEMO_DRY_RUN_ATTESTATION_FILE || DEFAULT_ATTESTATION_FILE);
}

async function getLedgerColumns(client) {
  const result = await client.query(`SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='schema_migrations'
    ORDER BY ordinal_position`);
  return result.rows;
}

function assertLedgerShape(rows, manifest) {
  if (!rows.length) throw new Error('schema_migrations is missing; apply structural migrations before demo data');
  const names = rows.map((row) => row.column_name);
  const missing = manifest.ledgerColumns.filter((name) => !names.includes(name));
  if (missing.length) throw new Error(`schema_migrations missing required columns: ${missing.join(', ')}`);
  if (names.includes('error_message')) throw new Error('schema_migrations must use details jsonb; error_message is not part of the production ledger');
}

function parseAllowedTextValues(definition) {
  return [...new Set(Array.from(String(definition).matchAll(/'([^']+)'(?:::text)?/g), (match) => match[1]))];
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) return value;
  const text = String(value || '');
  if (text === '{}') return [];
  if (text.startsWith('{') && text.endsWith('}')) return text.slice(1, -1).split(',').map((item) => item.replace(/^"|"$/g, ''));
  return [text];
}

async function getTableColumns(client, tables) {
  const result = await client.query(`SELECT table_name,column_name,data_type,udt_schema,udt_name,is_nullable,column_default,is_generated,generation_expression
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name = ANY($1::text[])
    ORDER BY table_name,ordinal_position`, [tables]);
  return result.rows;
}

async function getConstraints(client, tables) {
  const result = await client.query(`SELECT rel.relname AS table_name,c.conname,c.contype,c.convalidated,
      pg_get_constraintdef(c.oid,true) AS definition,
      COALESCE(array_agg(att.attname ORDER BY keys.ordinality) FILTER (WHERE att.attname IS NOT NULL), ARRAY[]::text[]) AS columns
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid=c.conrelid
    JOIN pg_namespace ns ON ns.oid=rel.relnamespace AND ns.nspname='public'
    LEFT JOIN LATERAL unnest(c.conkey) WITH ORDINALITY keys(attnum,ordinality) ON true
    LEFT JOIN pg_attribute att ON att.attrelid=rel.oid AND att.attnum=keys.attnum
    WHERE rel.relname = ANY($1::text[])
    GROUP BY rel.relname,c.oid,c.conname,c.contype,c.convalidated
    ORDER BY rel.relname,c.conname`, [tables]);
  return result.rows.map((row) => ({ ...row, columns: normalizeTextArray(row.columns) }));
}

async function getUniqueIndexes(client, tables) {
  const result = await client.query(`SELECT rel.relname AS table_name,idx.relname AS index_name,
      COALESCE(array_agg(att.attname ORDER BY keys.ordinality) FILTER (WHERE att.attname IS NOT NULL), ARRAY[]::text[]) AS columns,
      pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i
    JOIN pg_class rel ON rel.oid=i.indrelid
    JOIN pg_namespace ns ON ns.oid=rel.relnamespace AND ns.nspname='public'
    JOIN pg_class idx ON idx.oid=i.indexrelid
    LEFT JOIN LATERAL unnest(i.indkey) WITH ORDINALITY keys(attnum,ordinality) ON true
    LEFT JOIN pg_attribute att ON att.attrelid=rel.oid AND att.attnum=keys.attnum
    WHERE i.indisunique AND rel.relname = ANY($1::text[])
    GROUP BY rel.relname,idx.relname,i.indexrelid
    ORDER BY rel.relname,idx.relname`, [tables]);
  return result.rows.map((row) => ({ ...row, columns: normalizeTextArray(row.columns) }));
}

async function getTriggers(client, tables) {
  const result = await client.query(`SELECT rel.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid,true) AS definition
    FROM pg_trigger t
    JOIN pg_class rel ON rel.oid=t.tgrelid
    JOIN pg_namespace ns ON ns.oid=rel.relnamespace AND ns.nspname='public'
    WHERE NOT t.tgisinternal AND rel.relname = ANY($1::text[])
    ORDER BY rel.relname,t.tgname`, [tables]);
  return result.rows;
}

async function getEnums(client, tables) {
  const result = await client.query(`SELECT DISTINCT typ.typnamespace::regnamespace::text AS enum_schema,typ.typname AS enum_name,en.enumlabel,en.enumsortorder
    FROM pg_attribute att
    JOIN pg_class rel ON rel.oid=att.attrelid
    JOIN pg_namespace ns ON ns.oid=rel.relnamespace AND ns.nspname='public'
    JOIN pg_type typ ON typ.oid=att.atttypid AND typ.typtype='e'
    JOIN pg_enum en ON en.enumtypid=typ.oid
    WHERE att.attnum>0 AND NOT att.attisdropped AND rel.relname = ANY($1::text[])
    ORDER BY enum_schema,enum_name,en.enumsortorder`, [tables]);
  return result.rows;
}

async function calculateSchemaSignature(client, manifest) {
  const signatureTables = [...new Set([...manifest.touchedTables, ...manifest.categoricalContracts.map((item) => item.table), 'schema_migrations'])].sort();
  const columns = await getTableColumns(client, signatureTables);
  const constraints = await getConstraints(client, signatureTables);
  const indexes = await getUniqueIndexes(client, signatureTables);
  const triggers = await getTriggers(client, signatureTables);
  const enums = await getEnums(client, signatureTables);
  return sha256(stableStringify({ columns, constraints, indexes, triggers, enums }));
}

async function getDatabaseFingerprint(client) {
  const result = await client.query(`SELECT current_database() AS database_name,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
    COALESCE(inet_server_addr()::text,'local_socket') AS server_address,
    COALESCE(inet_server_port()::text,'local_socket') AS server_port,
    current_setting('server_version_num') AS server_version_num`);
  const identity = result.rows[0];
  return { hash: sha256(stableStringify(identity)), identity };
}

async function getLedgerEntry(client) {
  const result = await client.query(`SELECT migration_id,checksum,applied_at,applied_by,duration_ms,status,details
    FROM schema_migrations WHERE migration_id=$1`, [MIGRATION_ID]);
  return result.rows[0] || null;
}

async function getDemoPresence(client, tenantId) {
  const result = await client.query(`SELECT
    (SELECT count(*)::int FROM tenants WHERE id=$1::uuid OR name='Demo Tecdex') AS tenants,
    (SELECT count(*)::int FROM users WHERE tenant_id=$1::uuid OR email IN ('admin.demo@tcdx.demo','auditor.demo@tcdx.demo')) AS users`, [tenantId]);
  return result.rows[0];
}

async function validateCompatibility(client, manifest) {
  const requiredRuntime = await client.query(`SELECT
    to_regprocedure('public.user_has_permission(uuid,text)') IS NOT NULL AS permission_resolver,
    to_regclass('public.v_commercial_tenant_capabilities') IS NOT NULL AS capability_resolver`);
  if (!requiredRuntime.rows[0].permission_resolver || !requiredRuntime.rows[0].capability_resolver) {
    throw new Error('Demo preflight missing production permission or capability resolver');
  }
  const ledgerColumns = await getLedgerColumns(client);
  assertLedgerShape(ledgerColumns, manifest);
  const signatureTables = [...new Set([...manifest.touchedTables, ...manifest.categoricalContracts.map((item) => item.table)])];
  const columns = await getTableColumns(client, signatureTables);
  const columnMap = new Map(columns.map((row) => [`${row.table_name}.${row.column_name}`, row]));
  const tableNames = new Set(columns.map((row) => row.table_name));
  const missingTables = signatureTables.filter((table) => !tableNames.has(table));
  if (missingTables.length) throw new Error(`Demo preflight missing tables: ${missingTables.join(', ')}`);

  const constraints = await getConstraints(client, signatureTables);
  const constraintMap = new Map(constraints.map((row) => [`${row.table_name}.${row.conname}`, row]));
  const enums = await getEnums(client, signatureTables);
  const enumMap = new Map();
  for (const row of enums) {
    const key = `${row.enum_schema}.${row.enum_name}`;
    if (!enumMap.has(key)) enumMap.set(key, []);
    enumMap.get(key).push(row.enumlabel);
  }

  for (const contract of manifest.categoricalContracts) {
    const key = `${contract.table}.${contract.column}`;
    const column = columnMap.get(key);
    if (!column) throw new Error(`Demo preflight missing categorical column: ${key}`);
    const actualNullable = column.is_nullable === 'YES';
    if (actualNullable !== contract.nullable) throw new Error(`Demo preflight nullable mismatch: ${key} expected=${contract.nullable} actual=${actualNullable}`);
    if (contract.enumType) {
      const labels = enumMap.get(contract.enumType) || [];
      const rejected = contract.seedValues.filter((value) => !labels.includes(value));
      if (rejected.length) throw new Error(`Demo preflight enum rejection: ${key} values=${rejected.join(',')} enum=${contract.enumType} allowed=${labels.join(',')}`);
    }
    if (contract.constraint) {
      const constraint = constraintMap.get(`${contract.table}.${contract.constraint}`);
      if (!constraint) throw new Error(`Demo preflight missing constraint: ${contract.table}.${contract.constraint}`);
      const databaseAllowed = parseAllowedTextValues(constraint.definition);
      const rejected = contract.seedValues.filter((value) => !databaseAllowed.includes(value));
      if (rejected.length) {
        throw new Error(`Demo preflight categorical rejection: ${key} value=${rejected.join(',')} constraint=${contract.constraint} allowed=${databaseAllowed.join(',')}`);
      }
      const manifestAllowedMissing = contract.allowedValues.filter((value) => !databaseAllowed.includes(value));
      if (manifestAllowedMissing.length) {
        throw new Error(`Demo preflight constraint drift: ${key} constraint=${contract.constraint} missing_expected=${manifestAllowedMissing.join(',')} actual=${databaseAllowed.join(',')}`);
      }
    }
  }

  for (const fk of manifest.foreignKeys) {
    const matches = constraints.filter((row) => row.table_name === fk.table && row.contype === 'f' && row.columns.includes(fk.column));
    const expectedReference = `REFERENCES ${fk.targetTable}(${fk.targetColumn})`;
    if (!matches.some((row) => row.definition.replace(/\s+/g, ' ').includes(expectedReference))) {
      throw new Error(`Demo preflight FK mismatch: ${fk.table}.${fk.column} expected=${fk.targetTable}.${fk.targetColumn}`);
    }
  }

  const uniqueIndexes = await getUniqueIndexes(client, signatureTables);
  for (const unique of manifest.uniqueContracts) {
    const found = uniqueIndexes.some((index) => index.table_name === unique.table && stableStringify(index.columns) === stableStringify(unique.columns));
    if (!found) {
      const actual = uniqueIndexes.filter((index) => index.table_name === unique.table).map((index) => `${index.index_name}(${index.columns.join(',')})`);
      throw new Error(`Demo preflight missing idempotency key: ${unique.table}(${unique.columns.join(',')}) actual=${actual.join(';') || 'none'}`);
    }
  }

  const privilegeResult = await client.query(`SELECT table_name,
      has_table_privilege(current_user,format('public.%I',table_name),'SELECT,INSERT,UPDATE') AS allowed
    FROM unnest($1::text[]) AS table_name`, [manifest.touchedTables]);
  const denied = privilegeResult.rows.filter((row) => row.allowed !== true).map((row) => row.table_name);
  if (denied.length) throw new Error(`Demo preflight missing table privileges: ${denied.join(', ')}`);

  for (const extension of manifest.requiredExtensions) {
    const installed = await client.query('SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname=$1) AS installed', [extension]);
    if (!installed.rows[0].installed) throw new Error(`Demo preflight required extension is not installed: ${extension}`);
  }

  return { ledgerColumns, columns, constraints, enums };
}

async function acquireLock(client) {
  const result = await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  if (result.rows[0]?.acquired !== true) throw new Error('Another demo tenant migration process holds the advisory lock');
}

async function releaseLock(client) {
  await client.query('SELECT pg_advisory_unlock($1,$2)', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
}

async function postconditions(client, manifest) {
  const tenantId = manifest.demoTenantId;
  const result = await client.query(`SELECT jsonb_build_object(
    'tenant', (SELECT count(*) FROM tenants WHERE id=$1::uuid AND service_status='active' AND ai_plan='enterprise'),
    'users', (SELECT count(*) FROM users WHERE tenant_id=$1::uuid AND email IN ('admin.demo@tcdx.demo','auditor.demo@tcdx.demo')),
    'subscriptions', (SELECT count(*) FROM tenant_subscriptions WHERE tenant_id=$1::uuid AND plan_key='enterprise' AND status='active'),
    'semantic_layer', (SELECT count(*) FROM tenant_feature_overrides WHERE tenant_id=$1::uuid AND capability_key='data.semantic_layer' AND enabled=true AND status='active'),
    'semantic_effective', (SELECT count(*) FROM v_commercial_tenant_capabilities WHERE tenant_id=$1::uuid AND capability_key='data.semantic_layer' AND enabled=true),
    'admin_write', user_has_permission((SELECT id FROM users WHERE tenant_id=$1::uuid AND email='admin.demo@tcdx.demo'),'semantic.contracts.manage'),
    'auditor_read', user_has_permission((SELECT id FROM users WHERE tenant_id=$1::uuid AND email='auditor.demo@tcdx.demo'),'semantic.contracts.read'),
    'auditor_write', user_has_permission((SELECT id FROM users WHERE tenant_id=$1::uuid AND email='auditor.demo@tcdx.demo'),'semantic.contracts.manage'),
    'standards', (SELECT count(*) FROM tenant_standards WHERE tenant_id=$1::uuid AND is_active AND catalog_mode='mixed'),
    'processes', (SELECT count(*) FROM tenant_processes WHERE tenant_id=$1::uuid),
    'risks', (SELECT count(*) FROM asset_risks ar JOIN assets a ON a.id=ar.asset_id WHERE a.tenant_id=$1::uuid),
    'controls', (SELECT count(*) FROM tenant_controls WHERE tenant_id=$1::uuid),
    'evidences', (SELECT count(*) FROM evidences WHERE tenant_id=$1::uuid),
    'audits', (SELECT count(*) FROM audits WHERE tenant_id=$1::uuid),
    'findings', (SELECT count(*) FROM findings WHERE tenant_id=$1::uuid),
    'actions', (SELECT count(*) FROM action_plans WHERE tenant_id=$1::uuid),
    'metrics', (SELECT count(*) FROM metric_definitions WHERE tenant_id=$1::uuid),
    'measurements', (SELECT count(*) FROM metric_measurements WHERE tenant_id=$1::uuid),
    'metric_snapshots', (SELECT count(*) FROM metric_snapshots WHERE tenant_id=$1::uuid),
    'data_snapshots', (SELECT count(*) FROM data_snapshots WHERE tenant_id=$1::uuid),
    'semantic_contracts', (SELECT count(*) FROM data_source_contracts WHERE tenant_id=$1::uuid),
    'mappings', (SELECT count(*) FROM data_source_field_mappings WHERE tenant_id=$1::uuid),
    'observations', (SELECT count(*) FROM grc_observations WHERE tenant_id=$1::uuid),
    'lineage', (SELECT count(*) FROM data_lineage_edges WHERE tenant_id=$1::uuid),
    'dashboards', (SELECT count(*) FROM dashboard_definitions WHERE tenant_id=$1::uuid AND status='published'),
    'widgets', (SELECT count(*) FROM dashboard_widgets WHERE tenant_id=$1::uuid AND status='active'),
    'reports', (SELECT count(*) FROM report_definitions WHERE tenant_id=$1::uuid AND status='published'),
    'report_generations', (SELECT count(*) FROM report_generations WHERE tenant_id=$1::uuid AND status='generated'),
    'surveys', (SELECT count(*) FROM survey_definitions WHERE tenant_id=$1::uuid),
    'assurance', (SELECT count(*) FROM assurance_test_definitions WHERE tenant_id=$1::uuid),
    'losses', (SELECT count(*) FROM loss_events WHERE tenant_id=$1::uuid)
  ) AS checks`, [tenantId]);
  const checks = result.rows[0].checks;
  const exact = { tenant: 1, users: 2, subscriptions: 1, standards: 2, processes: 10, risks: 24, controls: 55, evidences: 80, audits: 5, findings: 18, actions: 24, metrics: 12, measurements: 144, metric_snapshots: 12, data_snapshots: 12, semantic_contracts: 6, mappings: 24, observations: 12, dashboards: 4, reports: 4, report_generations: 12, surveys: 1, assurance: 12, losses: 6 };
  for (const [key, expected] of Object.entries(exact)) {
    if (Number(checks[key]) !== expected) throw new Error(`Demo tenant postcondition failed: ${key}=${checks[key]} expected=${expected}`);
  }
  for (const [key, minimum] of Object.entries({ semantic_layer: 1, semantic_effective: 1, lineage: 128, widgets: 18 })) {
    if (Number(checks[key] || 0) < minimum) throw new Error(`Demo tenant postcondition failed: ${key}=${checks[key]} minimum=${minimum}`);
  }
  if (checks.admin_write !== true || checks.auditor_read !== true || checks.auditor_write !== false) {
    throw new Error(`Demo tenant postcondition failed: RBAC admin_write=${checks.admin_write} auditor_read=${checks.auditor_read} auditor_write=${checks.auditor_write}`);
  }
  const orphanResult = await client.query(`SELECT
    (SELECT count(*) FROM tenant_controls tc LEFT JOIN controls_catalog cc ON cc.id=tc.control_id WHERE tc.tenant_id=$1::uuid AND cc.id IS NULL) +
    (SELECT count(*) FROM evidences e LEFT JOIN tenant_controls tc ON tc.id=e.tenant_control_id WHERE e.tenant_id=$1::uuid AND tc.id IS NULL) +
    (SELECT count(*) FROM action_plans a LEFT JOIN findings f ON f.id=a.finding_id WHERE a.tenant_id=$1::uuid AND f.id IS NULL) +
    (SELECT count(*) FROM dashboard_widgets w LEFT JOIN dashboard_definitions d ON d.id=w.dashboard_id WHERE w.tenant_id=$1::uuid AND d.id IS NULL) +
    (SELECT count(*) FROM report_generations g LEFT JOIN report_definitions r ON r.id=g.report_definition_id WHERE g.tenant_id=$1::uuid AND r.id IS NULL) AS orphan_count`, [tenantId]);
  if (Number(orphanResult.rows[0].orphan_count) !== 0) throw new Error(`Demo tenant postcondition failed: orphan_count=${orphanResult.rows[0].orphan_count}`);
  const emptyDashboards = await client.query(`SELECT count(*)::int AS count FROM dashboard_definitions d
    WHERE d.tenant_id=$1::uuid AND d.status='published'
      AND NOT EXISTS (SELECT 1 FROM dashboard_widgets w WHERE w.dashboard_id=d.id AND w.status='active')`, [tenantId]);
  if (emptyDashboards.rows[0].count !== 0) throw new Error(`Demo tenant postcondition failed: empty_dashboards=${emptyDashboards.rows[0].count}`);
  process.stdout.write(`demo_tenant_postconditions=${JSON.stringify(checks)}\n`);
  return checks;
}

async function preflight(client, manifest, migration) {
  const compatibility = await validateCompatibility(client, manifest);
  const ledger = await getLedgerEntry(client);
  const presence = await getDemoPresence(client, manifest.demoTenantId);
  if ((!ledger || ledger.status !== 'applied') && (presence.tenants !== 0 || presence.users !== 0)) {
    throw new Error(`Demo preflight found partial data before apply: tenants=${presence.tenants} users=${presence.users}`);
  }
  if (ledger?.status === 'applied' && ledger.checksum !== migration.checksum) {
    const error = new Error('Demo tenant migration checksum differs from applied ledger entry');
    error.preserveLedger = true;
    throw error;
  }
  const schemaSignature = await calculateSchemaSignature(client, manifest);
  const databaseFingerprint = await getDatabaseFingerprint(client);
  process.stdout.write(`database_name=${databaseFingerprint.identity.database_name}\n`);
  process.stdout.write(`migration_user=${client.user}\n`);
  process.stdout.write(`schema_migrations_columns=${compatibility.ledgerColumns.map((column) => `${column.column_name}:${column.data_type}`).join(',')}\n`);
  process.stdout.write(`ledger_status=${ledger?.status || 'not_recorded'}\n`);
  process.stdout.write(`retry_from_failed=${ledger?.status === 'failed'}\n`);
  process.stdout.write(`schema_signature=${schemaSignature}\n`);
  process.stdout.write(`database_fingerprint=${databaseFingerprint.hash}\n`);
  process.stdout.write(`categorical_contracts=${manifest.categoricalContracts.length}\n`);
  process.stdout.write(`touched_tables=${manifest.touchedTables.length}\n`);
  return { ledger, presence, schemaSignature, databaseFingerprint };
}

function writeDryRunAttestation(data) {
  const file = attestationPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  return file;
}

function readDryRunAttestation(expected) {
  const file = attestationPath();
  if (!fs.existsSync(file)) throw new Error('Demo apply blocked: successful dry-run attestation is missing');
  const attestation = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (attestation.migrationId !== MIGRATION_ID || attestation.checksum !== expected.checksum) throw new Error('Demo apply blocked: dry-run checksum mismatch');
  if (attestation.schemaSignature !== expected.schemaSignature) throw new Error('Demo apply blocked: schema changed after dry-run; run --dry-run again');
  if (attestation.databaseFingerprint !== expected.databaseFingerprint) throw new Error('Demo apply blocked: dry-run belongs to a different database');
  const completedAt = Date.parse(attestation.completedAt);
  if (!Number.isFinite(completedAt) || Date.now() - completedAt > DRY_RUN_TTL_MS || completedAt > Date.now() + 60_000) {
    throw new Error('Demo apply blocked: dry-run attestation is expired or invalid');
  }
  return attestation;
}

async function runDryRun(client, databaseUrl, manifest, migration, context) {
  if (context.ledger?.status === 'applied') throw new Error('Demo dry-run requires an unapplied or failed ledger state');
  if (context.presence.tenants !== 0 || context.presence.users !== 0) throw new Error('Demo dry-run requires no pre-existing demo tenant data');
  const ledgerBefore = context.ledger;
  await client.query('BEGIN');
  try {
    await client.query(unwrapMigrationTransaction(migration.sql));
    const checks = await postconditions(client, manifest);
    await client.query('ROLLBACK');

    const verifier = new Client({ connectionString: databaseUrl });
    await verifier.connect();
    try {
      const presenceAfter = await getDemoPresence(verifier, manifest.demoTenantId);
      const ledgerAfter = await getLedgerEntry(verifier);
      if (presenceAfter.tenants !== 0 || presenceAfter.users !== 0) {
        throw new Error(`Demo dry-run rollback failed: tenants=${presenceAfter.tenants} users=${presenceAfter.users}`);
      }
      if (stableStringify(ledgerAfter) !== stableStringify(ledgerBefore)) throw new Error('Demo dry-run modified schema_migrations');
      const schemaAfter = await calculateSchemaSignature(verifier, manifest);
      if (schemaAfter !== context.schemaSignature) throw new Error('Demo dry-run changed the persistent schema');
    } finally {
      await verifier.end();
    }
    const completedAt = new Date().toISOString();
    const file = writeDryRunAttestation({
      version: 1,
      migrationId: MIGRATION_ID,
      checksum: migration.checksum,
      schemaSignature: context.schemaSignature,
      databaseFingerprint: context.databaseFingerprint.hash,
      completedAt,
      expiresAt: new Date(Date.parse(completedAt) + DRY_RUN_TTL_MS).toISOString(),
      postconditions: checks,
    });
    process.stdout.write(`Demo tenant migration dry-run OK: rollback=verified attestation=${path.relative(root, file)}\n`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { process.stderr.write(`rollback_error=${sanitizeError(rollbackError)}\n`); }
    throw error;
  }
}

async function run(mode) {
  const manifest = readManifest();
  const migration = readMigration(manifest);
  if (mode === 'checksum') {
    process.stdout.write(`${MIGRATION_ID} checksum=${migration.checksum}\n`);
    process.stdout.write(`manifest_checksum=${sha256(stableStringify(manifest))}\n`);
    return;
  }

  const databaseUrl = requireMigrationDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });
  const started = Date.now();
  let lockHeld = false;
  let shouldRecordFailure = false;
  await client.connect();
  try {
    await acquireLock(client);
    lockHeld = true;
    const context = await preflight(client, manifest, migration);
    if (mode === 'preflight') {
      process.stdout.write(`Demo tenant migration preflight OK: pending=${context.ledger?.status === 'applied' ? 'none' : MIGRATION_ID}\n`);
      return;
    }
    if (mode === 'dry-run') {
      await runDryRun(client, databaseUrl, manifest, migration, context);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight, --dry-run or --apply');

    readDryRunAttestation({ checksum: migration.checksum, schemaSignature: context.schemaSignature, databaseFingerprint: context.databaseFingerprint.hash });
    const applied = context.ledger?.status === 'applied' && context.ledger.checksum === migration.checksum;
    if (applied) {
      await postconditions(client, manifest);
      process.stdout.write('Demo tenant migration applied: already_applied\n');
      return;
    }
    await client.query('BEGIN');
    shouldRecordFailure = true;
    await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
      VALUES ($1,$2,current_user,'running',$3::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
    [MIGRATION_ID, migration.checksum, JSON.stringify({ file: path.relative(root, MIGRATION_FILE), scope: 'demo-tenant-only', schema_signature: context.schemaSignature })]);
    await client.query(unwrapMigrationTransaction(migration.sql));
    const details = await postconditions(client, manifest);
    await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [MIGRATION_ID, migration.checksum, Date.now() - started, JSON.stringify({ ...details, schema_signature: context.schemaSignature })]);
    await client.query('COMMIT');
    shouldRecordFailure = false;
    process.stdout.write(`Demo tenant migration applied: ${MIGRATION_ID}\n`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { process.stderr.write(`rollback_error=${sanitizeError(rollbackError)}\n`); }
    if (shouldRecordFailure && !error.preserveLedger) {
      try {
        await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,duration_ms,status,details)
          VALUES ($1,$2,current_user,$3,'failed',$4::jsonb)
          ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='failed',details=EXCLUDED.details`,
        [MIGRATION_ID, migration.checksum, Date.now() - started, JSON.stringify({ error: sanitizeError(error) })]);
      } catch (ledgerError) {
        process.stderr.write(`ledger_error=${sanitizeError(ledgerError)}\n`);
      }
    }
    throw error;
  } finally {
    if (lockHeld) await releaseLock(client).catch((error) => process.stderr.write(`unlock_error=${sanitizeError(error)}\n`));
    await client.end();
  }
}

run((process.argv[2] || '--checksum').replace(/^--/, '')).catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
