#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260904_dbn02_health_metrics_lineage_normalization.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

function findPgBinDir() {
  if (process.env.DBN02_PG_BIN) return process.env.DBN02_PG_BIN;
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
const initdb = path.join(binDir, 'initdb');
const pgCtl = path.join(binDir, 'pg_ctl');
const psql = path.join(binDir, 'psql');

function uuid(label) {
  const hex = crypto.createHash('sha256').update(`db-n02:${label}`).digest('hex');
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'db-n02-pg-'));
  const dataDir = path.join(tempRoot, 'data');
  const socketDir = path.join(tempRoot, 'socket');
  const logPath = path.join(tempRoot, 'postgres.log');
  fs.mkdirSync(socketDir);

  run(initdb, ['-A', 'trust', '-U', 'postgres', '-D', dataDir]);
  const port = String(26000 + crypto.randomInt(10000));
  run(pgCtl, ['-D', dataDir, '-l', logPath, '-o', `-k ${socketDir} -p ${port} -h ''`, '-w', 'start']);
  return { tempRoot, dataDir, socketDir, port };
}

function stopPostgres(pg) {
  if (!pg) return;
  run(pgCtl, ['-D', pg.dataDir, '-m', 'fast', '-w', 'stop'], { allowFailure: true });
  fs.rmSync(pg.tempRoot, { recursive: true, force: true });
}

function psqlExec(pg, sql) {
  return run(psql, [
    '-X',
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
  ], { input: sql });
}

const tenantA = uuid('tenant:a');
const tenantB = uuid('tenant:b');
const catalogIso = uuid('catalog:iso27001');
const catalogAmbiguous = uuid('catalog:ambiguous');
const catalogInactive = uuid('catalog:inactive');
const catalogNoMapping = uuid('catalog:no-mapping');
const tcIso = uuid('tenant-control:iso');
const tcAmbiguous = uuid('tenant-control:ambiguous');
const tcInactive = uuid('tenant-control:inactive');
const tcNoMapping = uuid('tenant-control:no-mapping');
const chsWrong = uuid('chs:wrong');
const chsNull = uuid('chs:null');
const chsAmbiguous = uuid('chs:ambiguous');
const chsNoMapping = uuid('chs:no-mapping');

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
  control_id uuid NOT NULL
);

CREATE TABLE controls_catalog (
  id uuid PRIMARY KEY,
  iso text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE controls_catalog_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id uuid NOT NULL REFERENCES controls_catalog(id),
  standard_code text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false
);

CREATE TABLE tenant_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  lifecycle_status text NOT NULL DEFAULT 'active'
);

CREATE TABLE control_health_scores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tenant_control_id uuid NOT NULL REFERENCES tenant_controls(id),
  standard_code text,
  catalog_control_id uuid,
  health_score numeric,
  health_status text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO tenants (id, name) VALUES
  (${sqlLiteral(tenantA)}, 'Tenant A'),
  (${sqlLiteral(tenantB)}, 'Tenant B');

INSERT INTO controls_catalog (id, iso, is_active) VALUES
  (${sqlLiteral(catalogIso)}, 'ISO27001', true),
  (${sqlLiteral(catalogAmbiguous)}, NULL, true),
  (${sqlLiteral(catalogInactive)}, 'ISO9001', true),
  (${sqlLiteral(catalogNoMapping)}, NULL, true);

INSERT INTO controls_catalog_standards (control_id, standard_code, is_primary) VALUES
  (${sqlLiteral(catalogIso)}, 'ISO27001', true),
  (${sqlLiteral(catalogAmbiguous)}, 'ISO27001', true),
  (${sqlLiteral(catalogAmbiguous)}, 'ISO42001', false),
  (${sqlLiteral(catalogInactive)}, 'ISO9001', true);

INSERT INTO tenant_standards (tenant_id, standard_code, is_active, lifecycle_status) VALUES
  (${sqlLiteral(tenantA)}, 'ISO27001', true, 'active'),
  (${sqlLiteral(tenantA)}, 'ISO42001', true, 'active'),
  (${sqlLiteral(tenantA)}, 'ISO9001', false, 'inactive');

INSERT INTO tenant_controls (id, tenant_id, control_id) VALUES
  (${sqlLiteral(tcIso)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogIso)}),
  (${sqlLiteral(tcAmbiguous)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogAmbiguous)}),
  (${sqlLiteral(tcInactive)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogInactive)}),
  (${sqlLiteral(tcNoMapping)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogNoMapping)});

INSERT INTO control_health_scores (id, tenant_id, tenant_control_id, standard_code, catalog_control_id, health_score, health_status) VALUES
  (${sqlLiteral(chsWrong)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcIso)}, 'WRONG_OLD', NULL, 72, 'atencion'),
  (${sqlLiteral(chsNull)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcIso)}, NULL, NULL, 80, 'saludable'),
  (${sqlLiteral(chsAmbiguous)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcAmbiguous)}, 'WRONG_OLD', NULL, 40, 'ambiguo'),
  (${sqlLiteral(chsNoMapping)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(tcNoMapping)}, NULL, NULL, 50, 'sin_datos');
`);
}

function applyMigration(pg) {
  psqlExec(pg, migrationSql);
}

function assertSql(pg, name, sql, expected) {
  const actual = psqlExec(pg, sql).stdout.trim();
  assert.strictEqual(actual, expected, `${name} expected ${expected}, got ${actual}`);
  console.log(`${name} PASS`);
}

function main() {
  let pg;
  try {
    pg = createPostgres();
    resetSchema(pg);
    applyMigration(pg);

    assertSql(
      pg,
      'H01',
      `SELECT canonical_standard_code || '|' || lineage_status FROM dbn02_resolve_control_standard_code(${sqlLiteral(tenantA)}, ${sqlLiteral(tcIso)});`,
      'ISO27001|RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE',
    );
    assertSql(
      pg,
      'H02',
      `SELECT COALESCE((SELECT canonical_standard_code FROM dbn02_resolve_control_standard_code(${sqlLiteral(tenantA)}, ${sqlLiteral(tcNoMapping)})), 'NO_MAPPING');`,
      'NO_MAPPING',
    );
    assertSql(
      pg,
      'H03',
      `SELECT COALESCE((SELECT canonical_standard_code FROM dbn02_resolve_control_standard_code(${sqlLiteral(tenantA)}, ${sqlLiteral(tcInactive)})), 'INACTIVE_STANDARD_BLOCKED');`,
      'INACTIVE_STANDARD_BLOCKED',
    );
    assertSql(
      pg,
      'H04',
      `SELECT refreshed_count >= 2, missing_standard_mapping FROM refresh_control_health_scores_v2_1(${sqlLiteral(tenantA)});`,
      't|2',
    );
    assertSql(
      pg,
      'H05',
       `WITH reset AS (
         UPDATE control_health_scores
         SET standard_code = 'CIRCULAR_BAD_VALUE', metadata = '{}'::jsonb
         WHERE id = ${sqlLiteral(chsWrong)}
         RETURNING 1
       )
       SELECT count(*) FROM reset;
       SELECT refreshed_count >= 1 FROM refresh_control_health_scores_v2_1(${sqlLiteral(tenantA)});
       SELECT standard_code || '|' || (metadata->>'db_n02_circular_dependency_removed') FROM control_health_scores WHERE id = ${sqlLiteral(chsWrong)};`,
      '1\nt\nISO27001|true',
    );
    assertSql(
      pg,
      'H06',
      `SELECT dbn02_normalize_health_component_state('calculated', true, '2026-09-01'::timestamptz, interval '30 days', '2026-09-02'::timestamptz);`,
      'AVAILABLE',
    );
    assertSql(
      pg,
      'H07',
      `SELECT dbn02_normalize_health_component_state('missing', true, NULL, NULL, '2026-09-02'::timestamptz);`,
      'MISSING',
    );
    assertSql(
      pg,
      'H08',
      `SELECT dbn02_normalize_health_component_state('unexpected', true, NULL, NULL, '2026-09-02'::timestamptz);`,
      'UNKNOWN',
    );
    assertSql(
      pg,
      'H09',
      `SELECT dbn02_normalize_health_component_state('calculated', true, '2026-07-01'::timestamptz, interval '30 days', '2026-09-02'::timestamptz);`,
      'STALE',
    );
    assertSql(
      pg,
      'H10',
      `SELECT dbn02_normalize_health_component_state('not_applicable', false, NULL, NULL, '2026-09-02'::timestamptz);`,
      'NOT_APPLICABLE',
    );
    assertSql(
      pg,
      'H11',
      `SELECT dbn02_grc_health_publication_state(0.50, 0.80, 88);`,
      'insufficient_coverage',
    );
    assertSql(
      pg,
      'H12',
      `SELECT dbn02_grc_health_publication_state(0.80, 0.80, 88);`,
      'measured',
    );
    applyMigration(pg);
    assertSql(
      pg,
      'H13',
      `SELECT to_regclass('public.v_control_health_scores_dbn02_lineage') IS NOT NULL
          AND to_regprocedure('public.refresh_control_health_scores_v2_1(uuid)') IS NOT NULL;`,
      't',
    );
    assertSql(
      pg,
      'H14',
      `WITH refresh AS (
         SELECT * FROM refresh_control_health_scores_v2_1(${sqlLiteral(tenantA)})
       )
       SELECT
         lineage.lineage_status || '|' ||
         COALESCE(chs.standard_code, 'NULL') || '|' ||
         refresh.missing_standard_mapping
       FROM control_health_scores chs
       JOIN refresh ON refresh.tenant_id = chs.tenant_id
       JOIN LATERAL dbn02_resolve_control_standard_code(chs.tenant_id, chs.tenant_control_id) lineage ON true
       WHERE chs.id = ${sqlLiteral(chsAmbiguous)};`,
      'AMBIGUOUS|WRONG_OLD|2',
    );

    const version = psqlExec(pg, 'SHOW server_version;').stdout.trim();
    console.log(`POSTGRES_VERSION ${version}`);
    console.log(`POSTGRES_SOCKET ${pg.socketDir}`);
    console.log('ISOLATED_FROM_DB_V4 YES');
    console.log('DB-N02 PostgreSQL migration checks: OK');
  } finally {
    stopPostgres(pg);
  }
}

main();
