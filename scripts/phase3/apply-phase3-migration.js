#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION_ID = '20260728_phase3_operational_grc';
const MIGRATION_FILE = path.join(
  root,
  'database/migrations/20260728_phase3_operational_grc.sql'
);
const ONBOARDING_MIGRATION_ID = '20260729_phase3_operational_onboarding';
const ONBOARDING_MIGRATION_FILE = path.join(
  root,
  'database/migrations/20260729_phase3_operational_onboarding.sql'
);
const UNIVERSAL_IMPORT_MIGRATION_ID = '20260730_universal_excel_import';
const UNIVERSAL_IMPORT_MIGRATION_FILE = path.join(
  root,
  'database/migrations/20260730_universal_excel_import.sql'
);
const ADVISORY_LOCK_NAMESPACE = 844332;
const ADVISORY_LOCK_KEY = 20260728;

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

function sanitizeError(error) {
  const message = String(error?.message || 'unknown migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/\bpassword\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/\bMIGRATION_DATABASE_URL\s*=\s*\S+/gi, 'MIGRATION_DATABASE_URL=[redacted]');
  return {
    code: String(error?.code || 'MIGRATION_ERROR').slice(0, 64),
    message: message.slice(0, 1000),
  };
}

function readMigration() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  return { sql, checksum };
}

function readOnboardingMigration() {
  const sql = fs.readFileSync(ONBOARDING_MIGRATION_FILE, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  return { sql, checksum };
}

function readUniversalImportMigration() {
  const sql = fs.readFileSync(UNIVERSAL_IMPORT_MIGRATION_FILE, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  return { sql, checksum };
}

function unwrapMigrationTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const beginIndexes = [];
  const commitIndexes = [];

  lines.forEach((line, index) => {
    const normalized = line.trim().toUpperCase();
    if (normalized === 'BEGIN;') beginIndexes.push(index);
    if (normalized === 'COMMIT;') commitIndexes.push(index);
  });

  if (
    beginIndexes.length !== 1
    || commitIndexes.length !== 1
    || beginIndexes[0] >= commitIndexes[0]
  ) {
    throw new Error('Migration must contain exactly one outer BEGIN/COMMIT pair');
  }

  return [
    ...lines.slice(0, beginIndexes[0]),
    ...lines.slice(beginIndexes[0] + 1, commitIndexes[0]),
    ...lines.slice(commitIndexes[0] + 1),
  ].join('\n');
}

function requireMigrationDatabaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!value) {
    throw new Error(
      'MIGRATION_DATABASE_URL is required for privileged DDL migrations; '
      + 'DATABASE_URL is not accepted as a fallback'
    );
  }
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL connection URL');
  }
  return value;
}

async function runPrivilegePreflight(client) {
  const result = await client.query(`
    WITH actor AS (
      SELECT oid, rolsuper
      FROM pg_roles
      WHERE rolname = current_user
    ),
    target AS (
      SELECT c.relowner, pg_get_userbyid(c.relowner) AS owner_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tenant_processes'
        AND c.relkind IN ('r', 'p')
    ),
    alter_targets AS (
      SELECT
        COUNT(*)::int AS target_count,
        BOOL_AND(
          actor.rolsuper
          OR c.relowner = actor.oid
          OR pg_has_role(c.relowner, 'USAGE')
        ) AS can_alter_all
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN actor
      WHERE n.nspname = 'public'
        AND c.relname = ANY(ARRAY[
          'tenant_processes', 'grc_phase2_relations', 'grc_exports'
        ])
        AND c.relkind IN ('r', 'p')
    )
    SELECT
      current_user AS migration_user,
      target.owner_name AS tenant_processes_owner,
      (
        actor.rolsuper
        OR target.relowner = actor.oid
        OR pg_has_role(target.relowner, 'USAGE')
      ) AS can_alter_tenant_processes,
      (
        alter_targets.target_count = 3
        AND alter_targets.can_alter_all
      ) AS can_alter_required_tables,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_tables,
      (
        has_schema_privilege(current_user, 'public', 'CREATE')
        AND (
          actor.rolsuper
          OR target.relowner = actor.oid
          OR pg_has_role(target.relowner, 'USAGE')
        )
      ) AS can_create_indexes,
      (
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
        OR (
          EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgcrypto')
          AND has_database_privilege(current_user, current_database(), 'CREATE')
        )
      ) AS pgcrypto_available,
      (
        has_table_privilege(current_user, 'public.permissions', 'SELECT,INSERT,UPDATE')
        AND has_table_privilege(current_user, 'public.role_permissions', 'SELECT,INSERT,UPDATE')
        AND has_table_privilege(current_user, 'public.saas_modules', 'SELECT,INSERT,UPDATE')
        AND has_table_privilege(
          current_user,
          'public.tenant_module_settings',
          'SELECT,INSERT,UPDATE'
        )
      ) AS can_write_catalog
    FROM actor
    CROSS JOIN target
    CROSS JOIN alter_targets
  `);

  if (result.rowCount !== 1) {
    throw new Error('Privilege preflight could not resolve public.tenant_processes');
  }

  const row = result.rows[0];
  const visible = {
    migration_user: row.migration_user,
    tenant_processes_owner: row.tenant_processes_owner,
    can_alter_tenant_processes: row.can_alter_tenant_processes === true,
    can_create_tables: row.can_create_tables === true,
    can_create_indexes: row.can_create_indexes === true,
    pgcrypto_available: row.pgcrypto_available === true,
  };

  for (const [key, value] of Object.entries(visible)) {
    process.stdout.write(`${key}=${value}\n`);
  }

  if (
    !visible.can_alter_tenant_processes
    || row.can_alter_required_tables !== true
    || row.migration_user === 'tecdex_user'
    || !visible.can_create_tables
    || !visible.can_create_indexes
    || !visible.pgcrypto_available
    || row.can_write_catalog !== true
  ) {
    throw new Error('Migration privilege preflight failed');
  }

  return visible;
}

async function acquireMigrationLock(client) {
  const result = await client.query(
    'SELECT pg_try_advisory_lock($1, $2) AS acquired',
    [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]
  );
  if (result.rows[0]?.acquired !== true) {
    throw new Error('Another Phase 3 migration process holds the advisory lock');
  }
}

async function releaseMigrationLock(client) {
  const result = await client.query(
    'SELECT pg_advisory_unlock($1, $2)',
    [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]
  );
  if (result.rows[0]?.pg_advisory_unlock !== true) {
    throw new Error('Phase 3 advisory lock was not released by this session');
  }
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      migration_id text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz,
      applied_by text NOT NULL,
      duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
      status text NOT NULL CHECK (status IN ('running', 'applied', 'failed')),
      details jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await client.query(`
    COMMENT ON TABLE public.schema_migrations IS
      'Administrative migration ledger. It never stores credentials or connection URLs.'
  `);

  const compatibility = await client.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE column_name IN (
          'migration_id', 'checksum', 'applied_at', 'applied_by',
          'duration_ms', 'status', 'details'
        )
      )::int AS required_columns,
      EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'schema_migrations'
          AND i.indisunique
          AND pg_get_indexdef(i.indexrelid) LIKE '%(migration_id)%'
      ) AS migration_id_unique
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
  `);

  const row = compatibility.rows[0];
  if (row.required_columns !== 7 || row.migration_id_unique !== true) {
    throw new Error('Existing public.schema_migrations schema is incompatible');
  }
}

async function readLedgerEntry(client) {
  const result = await client.query(
    `SELECT migration_id, checksum, status
     FROM public.schema_migrations
     WHERE migration_id = $1`,
    [MIGRATION_ID]
  );
  return result.rows[0] || null;
}

async function markRunning(client, checksum, migrationUser) {
  await client.query(
    `INSERT INTO public.schema_migrations (
       migration_id, checksum, applied_at, applied_by, duration_ms, status, details
     ) VALUES ($1, $2, NULL, $3, 0, 'running', $4::jsonb)
     ON CONFLICT (migration_id) DO UPDATE SET
       checksum = EXCLUDED.checksum,
       applied_at = NULL,
       applied_by = EXCLUDED.applied_by,
       duration_ms = 0,
       status = 'running',
       details = EXCLUDED.details`,
    [
      MIGRATION_ID,
      checksum,
      migrationUser,
      JSON.stringify({
        migration_file: path.relative(root, MIGRATION_FILE),
        started_at: new Date().toISOString(),
      }),
    ]
  );
}

async function markFailed(client, checksum, migrationUser, durationMs, error) {
  const safe = sanitizeError(error);
  await client.query(
    `INSERT INTO public.schema_migrations (
       migration_id, checksum, applied_at, applied_by, duration_ms, status, details
     ) VALUES ($1, $2, NULL, $3, $4, 'failed', $5::jsonb)
     ON CONFLICT (migration_id) DO UPDATE SET
       checksum = EXCLUDED.checksum,
       applied_at = NULL,
       applied_by = EXCLUDED.applied_by,
       duration_ms = EXCLUDED.duration_ms,
       status = 'failed',
       details = EXCLUDED.details`,
    [
      MIGRATION_ID,
      checksum,
      migrationUser,
      durationMs,
      JSON.stringify({
        migration_file: path.relative(root, MIGRATION_FILE),
        failed_at: new Date().toISOString(),
        error_code: safe.code,
        error_message: safe.message,
      }),
    ]
  );
}

async function verifyPostconditions(client) {
  const result = await client.query(
    `SELECT
       (SELECT COUNT(*)::int
        FROM permissions
        WHERE permission_key = ANY($1::text[])) AS permissions,
       (SELECT default_enabled
        FROM saas_modules
        WHERE module_key = 'grc_phase3_operations') AS default_enabled,
       (SELECT is_enabled
        FROM tenant_module_settings
        WHERE tenant_id = '70000000-0000-0000-0000-000000000701'::uuid
          AND module_key = 'grc_phase3_operations') AS tcdx_enabled,
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

  return {
    permissions: row.permissions,
    default_enabled: row.default_enabled,
    tcdx_enabled: row.tcdx_enabled,
    units_ready: row.units_ready,
    bia_ready: row.bia_ready,
    continuity_ready: row.continuity_ready,
    metrics_ready: row.metrics_ready,
  };
}

async function applyMigration(client, rawSql, checksum, migrationUser) {
  const existing = await readLedgerEntry(client);
  if (existing && existing.checksum !== checksum) {
    throw new Error(
      `Checksum mismatch for migration_id ${MIGRATION_ID}; refusing to execute changed DDL`
    );
  }

  if (existing?.status === 'applied') {
    await verifyPostconditions(client);
    process.stdout.write(
      `migration_id=${MIGRATION_ID} status=already_applied checksum=${checksum}\n`
    );
    return;
  }

  const sql = unwrapMigrationTransaction(rawSql);
  const startedAt = Date.now();
  await markRunning(client, checksum, migrationUser);

  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(sql);
    const postconditions = await verifyPostconditions(client);
    const durationMs = Date.now() - startedAt;
    await client.query(
      `UPDATE public.schema_migrations
       SET applied_at = now(),
           applied_by = $2,
           duration_ms = $3,
           status = 'applied',
           details = $4::jsonb
       WHERE migration_id = $1
         AND checksum = $5`,
      [
        MIGRATION_ID,
        migrationUser,
        durationMs,
        JSON.stringify({
          migration_file: path.relative(root, MIGRATION_FILE),
          postconditions,
        }),
        checksum,
      ]
    );
    await client.query('COMMIT');
    process.stdout.write(
      `migration_id=${MIGRATION_ID} status=applied checksum=${checksum} `
      + `duration_ms=${durationMs}\n`
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const durationMs = Date.now() - startedAt;
    try {
      await markFailed(client, checksum, migrationUser, durationMs, error);
    } catch (ledgerError) {
      const primary = sanitizeError(error);
      const ledger = sanitizeError(ledgerError);
      throw new Error(
        `Migration rolled back [${primary.code}]; `
        + `failed to record ledger [${ledger.code}]`
      );
    }
    throw error;
  }
}

async function verifyOnboardingPostconditions(client) {
  const result = await client.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM permissions
         WHERE permission_key='operations.import' AND is_active=TRUE
       ) AS import_permission,
       to_regclass('public.grc_phase3_import_batches') IS NOT NULL AS batches_ready,
       to_regclass('public.grc_phase3_import_rows') IS NOT NULL AS rows_ready`
  );
  const row = result.rows[0];
  if (!row.import_permission || !row.batches_ready || !row.rows_ready) {
    throw new Error('Phase 3 onboarding migration postcondition failed');
  }
  return row;
}

async function applyOnboardingMigration(client, rawSql, checksum, migrationUser) {
  const existingResult = await client.query(
    `SELECT migration_id,checksum,status FROM public.schema_migrations
     WHERE migration_id=$1`,
    [ONBOARDING_MIGRATION_ID]
  );
  const existing = existingResult.rows[0] || null;
  if (existing && existing.checksum !== checksum) {
    throw new Error(
      `Checksum mismatch for migration_id ${ONBOARDING_MIGRATION_ID}; refusing to execute changed DDL`
    );
  }
  if (existing?.status === 'applied') {
    await verifyOnboardingPostconditions(client);
    process.stdout.write(
      `migration_id=${ONBOARDING_MIGRATION_ID} status=already_applied checksum=${checksum}\n`
    );
    return;
  }

  const sql = unwrapMigrationTransaction(rawSql);
  const startedAt = Date.now();
  await client.query(
    `INSERT INTO public.schema_migrations (
       migration_id,checksum,applied_at,applied_by,duration_ms,status,details
     ) VALUES ($1,$2,NULL,$3,0,'running',$4::jsonb)
     ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,
       applied_at=NULL,applied_by=EXCLUDED.applied_by,duration_ms=0,
       status='running',details=EXCLUDED.details`,
    [
      ONBOARDING_MIGRATION_ID,
      checksum,
      migrationUser,
      JSON.stringify({
        migration_file: path.relative(root, ONBOARDING_MIGRATION_FILE),
        started_at: new Date().toISOString(),
      }),
    ]
  );
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(sql);
    const postconditions = await verifyOnboardingPostconditions(client);
    const durationMs = Date.now() - startedAt;
    await client.query(
      `UPDATE public.schema_migrations SET applied_at=now(),applied_by=$2,
         duration_ms=$3,status='applied',details=$4::jsonb
       WHERE migration_id=$1 AND checksum=$5`,
      [
        ONBOARDING_MIGRATION_ID,
        migrationUser,
        durationMs,
        JSON.stringify({
          migration_file: path.relative(root, ONBOARDING_MIGRATION_FILE),
          postconditions,
        }),
        checksum,
      ]
    );
    await client.query('COMMIT');
    process.stdout.write(
      `migration_id=${ONBOARDING_MIGRATION_ID} status=applied checksum=${checksum} `
      + `duration_ms=${durationMs}\n`
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const safe = sanitizeError(error);
    await client.query(
      `UPDATE public.schema_migrations SET status='failed',duration_ms=$2,
         details=$3::jsonb WHERE migration_id=$1`,
      [
        ONBOARDING_MIGRATION_ID,
        Date.now() - startedAt,
        JSON.stringify({
          migration_file: path.relative(root, ONBOARDING_MIGRATION_FILE),
          failed_at: new Date().toISOString(),
          error_code: safe.code,
          error_message: safe.message,
        }),
      ]
    );
    throw error;
  }
}

async function verifyUniversalImportPostconditions(client) {
  const result = await client.query(
    `SELECT
       to_regclass('public.grc_import_files') IS NOT NULL AS files_ready,
       to_regclass('public.grc_import_cell_errors') IS NOT NULL AS errors_ready,
       to_regclass('public.grc_import_audit_events') IS NOT NULL AS audit_ready,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='grc_phase3_import_batches'
           AND column_name='file_checksum'
       ) AS checksum_ready`
  );
  const row = result.rows[0];
  if (!row.files_ready || !row.errors_ready || !row.audit_ready || !row.checksum_ready) {
    throw new Error('Universal import migration postcondition failed');
  }
  return row;
}

async function applyUniversalImportMigration(client, rawSql, checksum, migrationUser) {
  const existingResult = await client.query(
    `SELECT migration_id,checksum,status FROM public.schema_migrations
     WHERE migration_id=$1`,
    [UNIVERSAL_IMPORT_MIGRATION_ID]
  );
  const existing = existingResult.rows[0] || null;
  if (existing && existing.checksum !== checksum) {
    throw new Error(
      `Checksum mismatch for migration_id ${UNIVERSAL_IMPORT_MIGRATION_ID}; refusing changed DDL`
    );
  }
  if (existing?.status === 'applied') {
    await verifyUniversalImportPostconditions(client);
    process.stdout.write(
      `migration_id=${UNIVERSAL_IMPORT_MIGRATION_ID} status=already_applied checksum=${checksum}\n`
    );
    return;
  }

  const sql = unwrapMigrationTransaction(rawSql);
  const startedAt = Date.now();
  await client.query(
    `INSERT INTO public.schema_migrations (
       migration_id,checksum,applied_at,applied_by,duration_ms,status,details
     ) VALUES ($1,$2,NULL,$3,0,'running',$4::jsonb)
     ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,
       applied_at=NULL,applied_by=EXCLUDED.applied_by,duration_ms=0,
       status='running',details=EXCLUDED.details`,
    [
      UNIVERSAL_IMPORT_MIGRATION_ID,
      checksum,
      migrationUser,
      JSON.stringify({
        migration_file: path.relative(root, UNIVERSAL_IMPORT_MIGRATION_FILE),
        started_at: new Date().toISOString(),
      }),
    ]
  );
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(sql);
    const postconditions = await verifyUniversalImportPostconditions(client);
    const durationMs = Date.now() - startedAt;
    await client.query(
      `UPDATE public.schema_migrations SET applied_at=now(),applied_by=$2,
         duration_ms=$3,status='applied',details=$4::jsonb
       WHERE migration_id=$1 AND checksum=$5`,
      [
        UNIVERSAL_IMPORT_MIGRATION_ID,
        migrationUser,
        durationMs,
        JSON.stringify({
          migration_file: path.relative(root, UNIVERSAL_IMPORT_MIGRATION_FILE),
          postconditions,
        }),
        checksum,
      ]
    );
    await client.query('COMMIT');
    process.stdout.write(
      `migration_id=${UNIVERSAL_IMPORT_MIGRATION_ID} status=applied checksum=${checksum} `
      + `duration_ms=${durationMs}\n`
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const safe = sanitizeError(error);
    await client.query(
      `UPDATE public.schema_migrations SET status='failed',duration_ms=$2,
         details=$3::jsonb WHERE migration_id=$1`,
      [
        UNIVERSAL_IMPORT_MIGRATION_ID,
        Date.now() - startedAt,
        JSON.stringify({
          migration_file: path.relative(root, UNIVERSAL_IMPORT_MIGRATION_FILE),
          failed_at: new Date().toISOString(),
          error_code: safe.code,
          error_message: safe.message,
        }),
      ]
    );
    throw error;
  }
}

async function main() {
  const mode = process.argv[2];
  const { sql, checksum } = readMigration();
  const onboarding = readOnboardingMigration();
  const universalImport = readUniversalImportMigration();

  if (mode === '--checksum') {
    process.stdout.write(`migration_id=${MIGRATION_ID} checksum=${checksum}\n`);
    process.stdout.write(
      `migration_id=${ONBOARDING_MIGRATION_ID} checksum=${onboarding.checksum}\n`
    );
    process.stdout.write(
      `migration_id=${UNIVERSAL_IMPORT_MIGRATION_ID} checksum=${universalImport.checksum}\n`
    );
    return;
  }

  if (!['--preflight', '--apply'].includes(mode)) {
    throw new Error('Usage: apply-phase3-migration.js --checksum|--preflight|--apply');
  }

  const client = new Client({
    connectionString: requireMigrationDatabaseUrl(),
    application_name: 'TCDX Phase 3 privileged migration runner',
  });
  let lockAcquired = false;
  let operationError = null;

  try {
    await client.connect();
    const preflight = await runPrivilegePreflight(client);
    if (mode === '--preflight') {
      process.stdout.write(`migration_id=${MIGRATION_ID} status=preflight_ok\n`);
    } else {
      await acquireMigrationLock(client);
      lockAcquired = true;
      await ensureLedger(client);
      await applyMigration(client, sql, checksum, preflight.migration_user);
      await applyOnboardingMigration(
        client,
        onboarding.sql,
        onboarding.checksum,
        preflight.migration_user
      );
      await applyUniversalImportMigration(
        client,
        universalImport.sql,
        universalImport.checksum,
        preflight.migration_user
      );
    }
  } catch (error) {
    operationError = error;
  }

  let cleanupError = null;
  try {
    if (lockAcquired) {
      await releaseMigrationLock(client);
    }
  } catch (error) {
    cleanupError = error;
  }
  try {
    await client.end();
  } catch (error) {
    cleanupError ||= error;
  }

  if (operationError) {
    throw operationError;
  }
  if (cleanupError) {
    throw cleanupError;
  }
}

main().catch(error => {
  const safe = sanitizeError(error);
  console.error(`Phase 3 migration failed [${safe.code}]: ${safe.message}`);
  process.exit(1);
});
