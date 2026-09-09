#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260907_dbn04_runtime_tenant_and_legacy_cleanup.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const { Pool } = require(path.join(root, 'backend/node_modules/pg'));
const {
  assertTenantContext,
  createTenantAwarePool,
  setLocalTenantContext,
  withPlatformTransaction,
  withTenantTransaction,
} = require(path.join(root, 'backend/src/utils/dbTenantContext'));

function findPgBinDir() {
  if (process.env.DBN04_PG_BIN) return process.env.DBN04_PG_BIN;
  for (const candidate of [
    '/opt/homebrew/opt/postgresql@16/bin',
    '/opt/homebrew/opt/postgresql@17/bin',
    '/opt/homebrew/opt/postgresql@18/bin',
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ]) {
    if (fs.existsSync(path.join(candidate, 'postgres'))) return candidate;
  }
  return '/opt/homebrew/bin';
}

const binDir = findPgBinDir();
const initdb = process.env.DBN04_INITDB || path.join(binDir, 'initdb');
const pgCtl = process.env.DBN04_PG_CTL || path.join(binDir, 'pg_ctl');
const psql = process.env.DBN04_PSQL || path.join(binDir, 'psql');

function uuid(label) {
  const hex = crypto.createHash('sha256').update(`db-n04:${label}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${(parseInt(hex.slice(16, 18), 16) & 0x3f | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    input: options.input,
    env: { ...process.env, LC_ALL: 'C' },
  });
  if (options.allowFailure) return result;
  assert.strictEqual(
    result.status,
    0,
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function createPostgres() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'db-n04-pg-'));
  const dataDir = path.join(tempRoot, 'data');
  const socketDir = path.join(tempRoot, 'socket');
  const logPath = path.join(tempRoot, 'postgres.log');
  fs.mkdirSync(socketDir);

  run(initdb, ['-A', 'trust', '-U', 'postgres', '-D', dataDir]);
  const port = String(28000 + crypto.randomInt(7000));
  run(pgCtl, ['-D', dataDir, '-l', logPath, '-o', `-k ${socketDir} -p ${port} -h ''`, '-w', 'start']);
  return { tempRoot, dataDir, socketDir, port };
}

function stopPostgres(pg) {
  if (!pg) return;
  run(pgCtl, ['-D', pg.dataDir, '-m', 'fast', '-w', 'stop'], { allowFailure: true });
  fs.rmSync(pg.tempRoot, { recursive: true, force: true });
}

function psqlExec(pg, sql, options = {}) {
  return run(psql, [
    '-X',
    '-q',
    '-v',
    'ON_ERROR_STOP=1',
    '-h',
    pg.socketDir,
    '-p',
    pg.port,
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-At',
  ], { input: sql, allowFailure: options.allowFailure });
}

const tenantA = uuid('tenant:a');
const tenantB = uuid('tenant:b');
const rowA = uuid('row:a');
const rowB = uuid('row:b');
const rowA2 = uuid('row:a2');
const rowRollback = uuid('row:rollback');

function resetSchema(pg) {
  psqlExec(pg, `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA tcdx_security;
CREATE ROLE app_user LOGIN;

CREATE TABLE tenant_runtime_records (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  label text NOT NULL
);

CREATE TABLE tenant_controls (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL
);

CREATE TABLE findings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL
);

CREATE TABLE evidences (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL
);

CREATE TABLE action_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL
);

CREATE TABLE control_health_scores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  tenant_control_id uuid
);

CREATE TABLE control_health_scores_backup_history (
  id uuid PRIMARY KEY,
  tenant_id uuid
);

CREATE OR REPLACE FUNCTION tcdx_security.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.tenant_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN current_setting('app.tenant_id', true)::uuid
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION tcdx_security.platform_scope_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(COALESCE(current_setting('app.platform_scope', true), 'false')) IN ('1', 'true', 'on', 'yes')
$$;

CREATE OR REPLACE FUNCTION tcdx_security.tenant_visible(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT tcdx_security.platform_scope_enabled()
      OR row_tenant_id = tcdx_security.current_tenant_id()
$$;

CREATE OR REPLACE FUNCTION tcdx_security.tenant_write_allowed(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT row_tenant_id = tcdx_security.current_tenant_id()
$$;

ALTER TABLE tenant_runtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_runtime_records FORCE ROW LEVEL SECURITY;
CREATE POLICY dbn04_tenant_isolation_runtime_records
  ON tenant_runtime_records
  USING (tcdx_security.tenant_visible(tenant_id))
  WITH CHECK (tcdx_security.tenant_write_allowed(tenant_id));

GRANT USAGE ON SCHEMA public, tcdx_security TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_runtime_records TO app_user;

INSERT INTO tenant_runtime_records (id, tenant_id, label) VALUES
  (${sqlLiteral(rowA)}, ${sqlLiteral(tenantA)}, 'tenant-a-original'),
  (${sqlLiteral(rowB)}, ${sqlLiteral(tenantB)}, 'tenant-b-original');
`);
}

function assertMigrationSafeRerun(pg) {
  psqlExec(pg, migrationSql);
  psqlExec(pg, migrationSql);

  const readiness = psqlExec(pg, `
SELECT count(*)::int || '|' || min(readiness_state) || '|' || max(readiness_state)
FROM tcdx_security.dbn04_rls_runtime_readiness;
`).stdout.trim();
  assert.strictEqual(readiness, '5|POLICY_MISSING|POLICY_MISSING');

  const comment = psqlExec(pg, `
SELECT obj_description('public.control_health_scores_backup_history'::regclass, 'pg_class') LIKE 'DB-N04 classification:%';
`).stdout.trim();
  assert.strictEqual(comment, 't');

  console.log('M01 DB-N04 migration safe re-run PASS');
  console.log('M02 DB-N04 cleanup comments only PASS');
}

async function createRuntimePool(pg) {
  const pool = new Pool({
    host: pg.socketDir,
    port: Number(pg.port),
    database: 'postgres',
    user: 'app_user',
    max: 1,
  });
  return createTenantAwarePool(pool);
}

async function rowsForTenant(pool, tenantId) {
  return withTenantTransaction(pool, { tenantId, role: 'test_tenant_runtime' }, async (client) => {
    const result = await client.query('SELECT id, tenant_id, label FROM tenant_runtime_records ORDER BY label');
    return result.rows;
  });
}

async function main() {
  let pg;
  let pool;
  try {
    pg = createPostgres();
    resetSchema(pg);
    assertMigrationSafeRerun(pg);
    pool = await createRuntimePool(pg);

    const tenantARows = await rowsForTenant(pool, tenantA);
    assert.deepStrictEqual(tenantARows.map((row) => row.label), ['tenant-a-original']);
    console.log('T01 tenant A SELECT solo A PASS');

    await withTenantTransaction(pool, { tenantId: tenantA, role: 'test_tenant_runtime' }, async (client) => {
      const result = await client.query(
        'INSERT INTO tenant_runtime_records (id, tenant_id, label) VALUES ($1::uuid, $2::uuid, $3)',
        [rowA2, tenantA, 'tenant-a-inserted'],
      );
      assert.strictEqual(result.rowCount, 1);
    });
    console.log('T02 tenant A INSERT A PASS');

    await assert.rejects(
      withTenantTransaction(pool, { tenantId: tenantA, role: 'test_tenant_runtime' }, (client) => client.query(
        'INSERT INTO tenant_runtime_records (id, tenant_id, label) VALUES ($1::uuid, $2::uuid, $3)',
        [uuid('row:bad-cross-insert'), tenantB, 'bad-cross-insert'],
      )),
      /row-level security policy/,
    );
    console.log('T03 tenant A INSERT B FAIL expected PASS');

    await withTenantTransaction(pool, { tenantId: tenantA, role: 'test_tenant_runtime' }, async (client) => {
      const result = await client.query('UPDATE tenant_runtime_records SET label = $1 WHERE id = $2::uuid', ['bad-update', rowB]);
      assert.strictEqual(result.rowCount, 0);
    });
    console.log('T04 tenant A UPDATE B bloqueado PASS');

    await withTenantTransaction(pool, { tenantId: tenantA, role: 'test_tenant_runtime' }, async (client) => {
      const result = await client.query('DELETE FROM tenant_runtime_records WHERE id = $1::uuid', [rowB]);
      assert.strictEqual(result.rowCount, 0);
    });
    console.log('T05 tenant A DELETE B bloqueado PASS');

    const tenantBRows = await rowsForTenant(pool, tenantB);
    assert.deepStrictEqual(tenantBRows.map((row) => row.label), ['tenant-b-original']);
    console.log('T06 tenant B despues de A ve solo B PASS');

    const noContext = await pool.query('SELECT count(*)::int AS count FROM tenant_runtime_records');
    assert.strictEqual(noContext.rows[0].count, 0);
    console.log('T07 no leakage entre transacciones PASS');

    const platformRows = await withPlatformTransaction(
      pool,
      { role: 'platform_admin', reason: 'dbn04_isolated_platform_read' },
      async (client) => {
        const result = await client.query('SELECT count(*)::int AS count FROM tenant_runtime_records');
        return result.rows[0].count;
      },
    );
    assert.strictEqual(platformRows, 3);
    console.log('T08 platform operation explicita PASS');

    assert.throws(
      () => assertTenantContext({ tenantId: tenantA, platformScope: true }),
      /platform scope requires explicit platform DB context/,
    );
    console.log('T09 tenant no puede escalar a platform PASS');

    await assert.rejects(
      withTenantTransaction(pool, { tenantId: tenantA, role: 'test_tenant_runtime' }, async (client) => {
        await client.query(
          'INSERT INTO tenant_runtime_records (id, tenant_id, label) VALUES ($1::uuid, $2::uuid, $3)',
          [rowRollback, tenantA, 'rollback-me'],
        );
        throw new Error('synthetic callback failure');
      }),
      /synthetic callback failure/,
    );
    const rolledBackCount = await withPlatformTransaction(
      pool,
      { role: 'platform_admin', reason: 'dbn04_rollback_verification' },
      async (client) => {
        const result = await client.query('SELECT count(*)::int AS count FROM tenant_runtime_records WHERE id = $1::uuid', [rowRollback]);
        return result.rows[0].count;
      },
    );
    assert.strictEqual(rolledBackCount, 0);
    console.log('T10 callback error -> ROLLBACK PASS');

    assert.ok(pool.idleCount >= 1, 'client must be returned to the pool after rollback');
    console.log('T11 client release despues de error PASS');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setLocalTenantContext(client, { tenantId: tenantA, role: 'rollback_context_check' });
      await client.query('ROLLBACK');
      const result = await client.query(
        "SELECT current_setting('app.tenant_id', true) AS tenant_id, current_setting('app.platform_scope', true) AS platform_scope",
      );
      assert.notStrictEqual(result.rows[0].tenant_id, tenantA);
      assert.notStrictEqual(String(result.rows[0].platform_scope || '').toLowerCase(), 'true');
    } finally {
      client.release();
    }
    console.log('T12 tenant context no persiste despues de rollback PASS');

    const version = psqlExec(pg, 'SHOW server_version;').stdout.trim();
    console.log(`PostgreSQL ${version}`);
    console.log('ISOLATED_FROM_DB_V4 YES');
  } finally {
    if (pool) await pool.end();
    stopPostgres(pg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
