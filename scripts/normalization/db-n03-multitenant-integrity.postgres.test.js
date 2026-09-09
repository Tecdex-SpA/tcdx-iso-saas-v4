#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260907_dbn03_multitenant_integrity_rls.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

function findPgBinDir() {
  if (process.env.DBN03_PG_BIN) return process.env.DBN03_PG_BIN;
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
const initdb = process.env.DBN03_INITDB || path.join(binDir, 'initdb');
const pgCtl = process.env.DBN03_PG_CTL || path.join(binDir, 'pg_ctl');
const psql = process.env.DBN03_PSQL || path.join(binDir, 'psql');

function uuid(label) {
  const hex = crypto.createHash('sha256').update(`db-n03:${label}`).digest('hex');
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'db-n03-pg-'));
  const dataDir = path.join(tempRoot, 'data');
  const socketDir = path.join(tempRoot, 'socket');
  const logPath = path.join(tempRoot, 'postgres.log');
  fs.mkdirSync(socketDir);

  run(initdb, ['-A', 'trust', '-U', 'postgres', '-D', dataDir]);
  const port = String(27000 + crypto.randomInt(10000));
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
const tcA = uuid('tenant-control:a');
const tcB = uuid('tenant-control:b');
const findingA = uuid('finding:a');
const evidenceA = uuid('evidence:a');
const actionA = uuid('action:a');
const healthA = uuid('health:a');

function resetSchema(pg) {
  psqlExec(pg, `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE tenant_controls (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  control_id uuid
);

CREATE TABLE findings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tenant_control_id uuid,
  status text,
  updated_at timestamptz
);

CREATE TABLE evidences (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tenant_control_id uuid,
  control_id uuid
);

CREATE TABLE action_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tenant_control_id uuid,
  finding_id uuid,
  status text
);

CREATE TABLE control_health_scores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tenant_control_id uuid NOT NULL,
  standard_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO tenants (id, name) VALUES
  (${sqlLiteral(tenantA)}, 'Tenant A'),
  (${sqlLiteral(tenantB)}, 'Tenant B');

INSERT INTO tenant_controls (id, tenant_id, control_id) VALUES
  (${sqlLiteral(tcA)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(uuid('catalog:a'))}),
  (${sqlLiteral(tcB)}, ${sqlLiteral(tenantB)}, ${sqlLiteral(uuid('catalog:b'))});
`);
}

function assertSql(pg, name, sql, expected) {
  const actual = psqlExec(pg, sql).stdout.trim();
  assert.strictEqual(actual, expected, `${name} expected ${expected}, got ${actual}`);
  console.log(`${name} PASS`);
}

function assertSqlFails(pg, name, sql, pattern) {
  const result = psqlExec(pg, sql, { allowFailure: true });
  assert.notStrictEqual(result.status, 0, `${name} expected failure`);
  assert.match(result.stderr, pattern, `${name} stderr did not match ${pattern}\n${result.stderr}`);
  console.log(`${name} PASS`);
}

function main() {
  let pg;
  try {
    pg = createPostgres();
    resetSchema(pg);
    psqlExec(pg, migrationSql);

    assertSql(
      pg,
      'I01 findings same-tenant insert',
      `INSERT INTO findings (id, tenant_id, tenant_control_id) VALUES (${sqlLiteral(findingA)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcA)});
       SELECT count(*) FROM findings WHERE id = ${sqlLiteral(findingA)};`,
      '1',
    );
    assertSqlFails(
      pg,
      'I02 findings cross-tenant insert',
      `INSERT INTO findings (id, tenant_id, tenant_control_id) VALUES (${sqlLiteral(uuid('finding:bad'))}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcB)});`,
      /fk_dbn03_findings_tenant_control_same_tenant/,
    );
    assertSql(
      pg,
      'I03 evidences same-tenant insert',
      `INSERT INTO evidences (id, tenant_id, tenant_control_id) VALUES (${sqlLiteral(evidenceA)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcA)});
       SELECT count(*) FROM evidences WHERE id = ${sqlLiteral(evidenceA)};`,
      '1',
    );
    assertSqlFails(
      pg,
      'I04 evidences tenant_id update breaks ownership',
      `UPDATE evidences SET tenant_id = ${sqlLiteral(tenantB)} WHERE id = ${sqlLiteral(evidenceA)};`,
      /fk_dbn03_evidences_tenant_control_same_tenant/,
    );
    assertSql(
      pg,
      'I05 action_plans same-tenant insert',
      `INSERT INTO action_plans (id, tenant_id, tenant_control_id, finding_id) VALUES (${sqlLiteral(actionA)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcA)}, ${sqlLiteral(findingA)});
       SELECT count(*) FROM action_plans WHERE id = ${sqlLiteral(actionA)};`,
      '1',
    );
    assertSqlFails(
      pg,
      'I06 action_plans cross-tenant control update',
      `UPDATE action_plans SET tenant_control_id = ${sqlLiteral(tcB)} WHERE id = ${sqlLiteral(actionA)};`,
      /fk_dbn03_action_plans_tenant_control_same_tenant/,
    );
    assertSqlFails(
      pg,
      'I07 action_plans tenant_id update breaks finding link',
      `UPDATE action_plans SET tenant_id = ${sqlLiteral(tenantB)} WHERE id = ${sqlLiteral(actionA)};`,
      /fk_dbn03_action_plans_(tenant_control|finding)_same_tenant/,
    );
    assertSql(
      pg,
      'I08 control_health_scores same-tenant insert',
      `INSERT INTO control_health_scores (id, tenant_id, tenant_control_id) VALUES (${sqlLiteral(healthA)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcA)});
       SELECT count(*) FROM control_health_scores WHERE id = ${sqlLiteral(healthA)};`,
      '1',
    );
    assertSqlFails(
      pg,
      'I09 control_health_scores cross-tenant update',
      `UPDATE control_health_scores SET tenant_control_id = ${sqlLiteral(tcB)} WHERE id = ${sqlLiteral(healthA)};`,
      /fk_dbn03_control_health_scores_tenant_control_same_tenant/,
    );
    assertSql(
      pg,
      'I10 safe re-run',
      `${migrationSql}
       SELECT count(*) FROM pg_constraint WHERE conname LIKE 'fk_dbn03_%_same_tenant';`,
      '5',
    );
    assertSql(
      pg,
      'RLS01 policies staged but not enabled',
      `SELECT count(*) FILTER (WHERE c.relrowsecurity)::int || '|' || count(p.polname)::int
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_policy p ON p.polrelid = c.oid AND p.polname LIKE 'dbn03_tenant_isolation_%'
        WHERE n.nspname = 'public'
          AND c.relname IN ('tenant_controls','findings','evidences','action_plans','control_health_scores');`,
      '0|5',
    );

    const version = psqlExec(pg, 'SHOW server_version;').stdout.trim();
    console.log(`PostgreSQL ${version}`);
    console.log('ISOLATED_FROM_DB_V4 YES');
  } finally {
    stopPostgres(pg);
  }
}

main();
