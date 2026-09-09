#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260904_dbn01_control_identity_normalization.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

function findPgBinDir() {
  if (process.env.DBN01_PG_BIN) return process.env.DBN01_PG_BIN;

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
const initdb = process.env.DBN01_INITDB || path.join(binDir, 'initdb');
const pgCtl = process.env.DBN01_PG_CTL || path.join(binDir, 'pg_ctl');
const psql = process.env.DBN01_PSQL || path.join(binDir, 'psql');

const tenantA = uuid('tenant:a');
const tenantB = uuid('tenant:b');
const catalogA = uuid('catalog:a');
const catalogB = uuid('catalog:b');
const catalogC = uuid('catalog:c');
const legacyA = uuid('legacy:a');
const legacyB = uuid('legacy:b');
const legacyC = uuid('legacy:c');
const tcA1 = uuid('tenant-control:a:1');
const tcA2 = uuid('tenant-control:a:2');
const tcB1 = uuid('tenant-control:b:1');
const tcOtherTenantA = uuid('tenant-control:other:a');
const missingRecord = uuid('record:missing');
const missingTenantControl = uuid('tenant-control:missing');

function uuid(label) {
  const hex = crypto.createHash('sha256').update(`db-n01:${label}`).digest('hex');
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

function decision(tableName, recordId, selectedTenantControlId, reason = 'postgres fixture') {
  return {
    table_name: tableName,
    record_id: recordId,
    selected_tenant_control_id: selectedTenantControlId,
    approved_by: 'db-n01-postgres-test',
    reason,
  };
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
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  return result;
}

function createPostgres() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'db-n01-pg-'));
  const dataDir = path.join(tempRoot, 'data');
  const socketDir = path.join(tempRoot, 'socket');
  const logPath = path.join(tempRoot, 'postgres.log');
  fs.mkdirSync(socketDir);

  run(initdb, ['-A', 'trust', '-U', 'postgres', '-D', dataDir]);

  const port = String(25000 + crypto.randomInt(10000));
  run(pgCtl, [
    '-D',
    dataDir,
    '-l',
    logPath,
    '-o',
    `-k ${socketDir} -p ${port} -h ''`,
    '-w',
    'start',
  ]);

  return { tempRoot, dataDir, socketDir, port, logPath };
}

function stopPostgres(pg) {
  if (!pg) return;
  run(pgCtl, ['-D', pg.dataDir, '-m', 'fast', '-w', 'stop'], { allowFailure: true });
  fs.rmSync(pg.tempRoot, { recursive: true, force: true });
}

function psqlExec(pg, sql, options = {}) {
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
  ], { input: sql, allowFailure: options.allowFailure });
}

function resetSchema(pg) {
  psqlExec(pg, `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE controls_catalog (
  id uuid PRIMARY KEY,
  code text NOT NULL
);

CREATE TABLE controls (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  catalog_control_id uuid NOT NULL REFERENCES controls_catalog(id)
);

CREATE TABLE tenant_controls (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  control_id uuid NOT NULL REFERENCES controls_catalog(id)
);

CREATE TABLE findings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tenant_control_id uuid,
  updated_at timestamptz
);

CREATE TABLE evidences (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  control_id uuid,
  tenant_control_id uuid
);

CREATE TABLE action_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tenant_control_id uuid
);

INSERT INTO tenants (id, name) VALUES
  (${sqlLiteral(tenantA)}, 'Tenant A'),
  (${sqlLiteral(tenantB)}, 'Tenant B');

INSERT INTO controls_catalog (id, code) VALUES
  (${sqlLiteral(catalogA)}, 'A.1'),
  (${sqlLiteral(catalogB)}, 'B.1'),
  (${sqlLiteral(catalogC)}, 'C.1');

INSERT INTO controls (id, tenant_id, catalog_control_id) VALUES
  (${sqlLiteral(legacyA)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogA)}),
  (${sqlLiteral(legacyB)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogB)}),
  (${sqlLiteral(legacyC)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogC)});

INSERT INTO tenant_controls (id, tenant_id, control_id) VALUES
  (${sqlLiteral(tcA1)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogA)}),
  (${sqlLiteral(tcA2)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogA)}),
  (${sqlLiteral(tcB1)}, ${sqlLiteral(tenantA)}, ${sqlLiteral(catalogB)}),
  (${sqlLiteral(tcOtherTenantA)}, ${sqlLiteral(tenantB)}, ${sqlLiteral(catalogA)});
`);
}

function insertRowsSql({ findings = [], evidences = [], actionPlans = [] }) {
  const statements = [];

  for (const row of findings) {
    statements.push(`INSERT INTO findings (id, tenant_id, tenant_control_id) VALUES (${sqlLiteral(row.id)}, ${sqlLiteral(row.tenantId || tenantA)}, ${row.tenantControlId ? sqlLiteral(row.tenantControlId) : 'NULL'});`);
  }

  for (const row of evidences) {
    statements.push(`INSERT INTO evidences (id, tenant_id, control_id, tenant_control_id) VALUES (${sqlLiteral(row.id)}, ${sqlLiteral(row.tenantId || tenantA)}, ${row.controlId ? sqlLiteral(row.controlId) : 'NULL'}, ${row.tenantControlId ? sqlLiteral(row.tenantControlId) : 'NULL'});`);
  }

  for (const row of actionPlans) {
    statements.push(`INSERT INTO action_plans (id, tenant_id, tenant_control_id) VALUES (${sqlLiteral(row.id)}, ${sqlLiteral(row.tenantId || tenantA)}, ${row.tenantControlId ? sqlLiteral(row.tenantControlId) : 'NULL'});`);
  }

  return statements.join('\n');
}

function applyMigration(pg, decisions = [], options = {}) {
  const configSql = `SELECT set_config('tcdx.dbn01_manual_decisions', ${sqlLiteral(JSON.stringify(decisions))}, false);`;
  return psqlExec(pg, `${configSql}\n${migrationSql}`, { allowFailure: options.allowFailure });
}

function runScenario(pg, scenario) {
  resetSchema(pg);
  psqlExec(pg, insertRowsSql(scenario.rows));
  const result = applyMigration(pg, scenario.decisions || [], { allowFailure: scenario.expectFailure });

  if (scenario.expectFailure) {
    assert.notStrictEqual(result.status, 0, `${scenario.name} should fail`);
    assert.match(result.stderr, scenario.errorPattern, `${scenario.name} failed with unexpected error: ${result.stderr}`);
    return { name: scenario.name, status: 'PASS' };
  }

  assert.strictEqual(result.status, 0, `${scenario.name} should pass\nstderr:\n${result.stderr}`);
  if (scenario.verifySql) {
    const verify = psqlExec(pg, scenario.verifySql);
    assert.strictEqual(verify.stdout.trim(), scenario.expected, `${scenario.name} verification mismatch`);
  }
  return { name: scenario.name, status: 'PASS' };
}

function integritySql() {
  return `
SELECT 'findings_fk=' || count(*)
FROM findings f
LEFT JOIN tenant_controls tc ON tc.id = f.tenant_control_id
WHERE f.tenant_control_id IS NOT NULL AND tc.id IS NULL;

SELECT 'evidences_fk=' || count(*)
FROM evidences e
LEFT JOIN tenant_controls tc ON tc.id = e.tenant_control_id
WHERE e.tenant_control_id IS NOT NULL AND tc.id IS NULL;

SELECT 'action_plans_fk=' || count(*)
FROM action_plans ap
LEFT JOIN tenant_controls tc ON tc.id = ap.tenant_control_id
WHERE ap.tenant_control_id IS NOT NULL AND tc.id IS NULL;

SELECT 'cross_tenant=' || (
  (SELECT count(*) FROM findings f JOIN tenant_controls tc ON tc.id = f.tenant_control_id WHERE tc.tenant_id <> f.tenant_id) +
  (SELECT count(*) FROM evidences e JOIN tenant_controls tc ON tc.id = e.tenant_control_id WHERE tc.tenant_id <> e.tenant_id) +
  (SELECT count(*) FROM action_plans ap JOIN tenant_controls tc ON tc.id = ap.tenant_control_id WHERE tc.tenant_id <> ap.tenant_id)
);

SELECT 'orphan_tenant_controls=' || count(*)
FROM tenant_controls tc
LEFT JOIN controls_catalog cc ON cc.id = tc.control_id
WHERE cc.id IS NULL;

SELECT 'unresolved_rows=' || (
  (SELECT count(*) FROM findings f LEFT JOIN tenant_controls tc ON tc.id = f.tenant_control_id AND tc.tenant_id = f.tenant_id WHERE f.tenant_control_id IS NOT NULL AND tc.id IS NULL) +
  (SELECT count(*) FROM evidences e WHERE e.control_id IS NOT NULL AND e.tenant_control_id IS NULL)
);

SELECT 'controls_table=' || (to_regclass('public.controls') IS NOT NULL)::text;
SELECT 'evidences_control_id=' || EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'evidences' AND column_name = 'control_id'
)::text;
`;
}

function runRerunScenario(pg) {
  resetSchema(pg);
  const fModern = uuid('rerun:f01');
  const fSingle = uuid('rerun:f02');
  const fManual = uuid('rerun:f05');
  const eModern = uuid('rerun:e01');
  const eSingle = uuid('rerun:e02');
  const eManual = uuid('rerun:e05');
  const ap = uuid('rerun:ap01');

  psqlExec(pg, insertRowsSql({
    findings: [
      { id: fModern, tenantControlId: tcA1 },
      { id: fSingle, tenantControlId: legacyB },
      { id: fManual, tenantControlId: legacyA },
    ],
    evidences: [
      { id: eModern, controlId: catalogA, tenantControlId: tcA1 },
      { id: eSingle, controlId: legacyB },
      { id: eManual, controlId: legacyA },
    ],
    actionPlans: [
      { id: ap, tenantControlId: tcB1 },
    ],
  }));

  const decisions = [
    decision('findings', fManual, tcA2, 'F05 selected candidate'),
    decision('evidences', eManual, tcA2, 'E05 selected candidate'),
  ];

  const first = applyMigration(pg, decisions);
  assert.strictEqual(first.status, 0, `first migration should pass\nstderr:\n${first.stderr}`);

  const afterFirst = psqlExec(pg, `
SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(fModern)};
SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(fSingle)};
SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(fManual)};
SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(eModern)};
SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(eSingle)};
SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(eManual)};
SELECT count(*) FROM dbn01_control_identity_audit;
${integritySql()}
`);

  const second = applyMigration(pg, decisions);
  assert.strictEqual(second.status, 0, `second migration should pass\nstderr:\n${second.stderr}`);

  const afterSecond = psqlExec(pg, `
SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(fModern)};
SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(fSingle)};
SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(fManual)};
SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(eModern)};
SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(eSingle)};
SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(eManual)};
SELECT count(*) FROM dbn01_control_identity_audit;
${integritySql()}
`);

  assert.strictEqual(afterSecond.stdout, afterFirst.stdout, 'second migration must not change semantic output or duplicate audit rows');
  assert.deepStrictEqual(afterFirst.stdout.trim().split('\n'), [
    tcA1,
    tcB1,
    tcA2,
    tcA1,
    tcB1,
    tcA2,
    '4',
    'findings_fk=0',
    'evidences_fk=0',
    'action_plans_fk=0',
    'cross_tenant=0',
    'orphan_tenant_controls=0',
    'unresolved_rows=0',
    'controls_table=true',
    'evidences_control_id=true',
  ]);

  return {
    name: 'RERUN',
    status: 'PASS',
    integrity: afterFirst.stdout.trim().split('\n').slice(7),
  };
}

const scenarios = [
  {
    name: 'F01',
    rows: { findings: [{ id: uuid('f01'), tenantControlId: tcA1 }], actionPlans: [{ id: uuid('f01:ap'), tenantControlId: tcB1 }] },
    verifySql: `SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(uuid('f01'))};`,
    expected: tcA1,
  },
  {
    name: 'F02',
    rows: { findings: [{ id: uuid('f02'), tenantControlId: legacyB }], actionPlans: [{ id: uuid('f02:ap'), tenantControlId: tcB1 }] },
    verifySql: `SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(uuid('f02'))};`,
    expected: tcB1,
  },
  {
    name: 'F03',
    rows: { findings: [{ id: uuid('f03'), tenantControlId: legacyC }], actionPlans: [{ id: uuid('f03:ap'), tenantControlId: tcB1 }] },
    expectFailure: true,
    errorPattern: /DB-N01 findings unresolved/,
  },
  {
    name: 'F04',
    rows: { findings: [{ id: uuid('f04'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('f04:ap'), tenantControlId: tcB1 }] },
    expectFailure: true,
    errorPattern: /DB-N01 findings ambiguous without approved manual decision/,
  },
  {
    name: 'F05',
    rows: { findings: [{ id: uuid('f05'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('f05:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('f05'), tcA2)],
    verifySql: `SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(uuid('f05'))};`,
    expected: tcA2,
  },
  {
    name: 'F06',
    rows: { findings: [{ id: uuid('f06'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('f06:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('f06'), tcB1, 'wrong catalog')],
    expectFailure: true,
    errorPattern: /expected catalog control/,
  },
  {
    name: 'E01',
    rows: { evidences: [{ id: uuid('e01'), controlId: catalogA, tenantControlId: tcA1 }], actionPlans: [{ id: uuid('e01:ap'), tenantControlId: tcB1 }] },
    verifySql: `SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(uuid('e01'))};`,
    expected: tcA1,
  },
  {
    name: 'E02',
    rows: { evidences: [{ id: uuid('e02'), controlId: legacyB }], actionPlans: [{ id: uuid('e02:ap'), tenantControlId: tcB1 }] },
    verifySql: `SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(uuid('e02'))};`,
    expected: tcB1,
  },
  {
    name: 'E03',
    rows: { evidences: [{ id: uuid('e03'), controlId: legacyC }], actionPlans: [{ id: uuid('e03:ap'), tenantControlId: tcB1 }] },
    expectFailure: true,
    errorPattern: /DB-N01 evidences legacy-only unresolved/,
  },
  {
    name: 'E04',
    rows: { evidences: [{ id: uuid('e04'), controlId: legacyA }], actionPlans: [{ id: uuid('e04:ap'), tenantControlId: tcB1 }] },
    expectFailure: true,
    errorPattern: /DB-N01 evidences legacy-only ambiguous without approved manual decision/,
  },
  {
    name: 'E05',
    rows: { evidences: [{ id: uuid('e05'), controlId: legacyA }], actionPlans: [{ id: uuid('e05:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('evidences', uuid('e05'), tcA2)],
    verifySql: `SELECT tenant_control_id FROM evidences WHERE id = ${sqlLiteral(uuid('e05'))};`,
    expected: tcA2,
  },
  {
    name: 'MD01',
    rows: { findings: [{ id: uuid('md01'), tenantControlId: legacyB }], actionPlans: [{ id: uuid('md01:ap'), tenantControlId: tcB1 }] },
    verifySql: `SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(uuid('md01'))};`,
    expected: tcB1,
  },
  {
    name: 'MD02',
    rows: { findings: [{ id: uuid('md02'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('md02:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('md02'), tcA1)],
    verifySql: `SELECT tenant_control_id FROM findings WHERE id = ${sqlLiteral(uuid('md02'))};`,
    expected: tcA1,
  },
  {
    name: 'MD03',
    rows: { findings: [{ id: uuid('md03'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('md03:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('md03'), tcA1), decision('findings', uuid('md03'), tcA1)],
    expectFailure: true,
    errorPattern: /manual decisions duplicate/,
  },
  {
    name: 'MD04',
    rows: { findings: [{ id: uuid('md04'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('md04:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('md04'), tcA1), decision('findings', uuid('md04'), tcA2)],
    expectFailure: true,
    errorPattern: /manual decisions duplicate/,
  },
  {
    name: 'MD05',
    rows: { findings: [{ id: uuid('md05'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('md05:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('md05'), missingTenantControl)],
    expectFailure: true,
    errorPattern: /selected_tenant_control_id invalid or missing/,
  },
  {
    name: 'MD06',
    rows: { findings: [{ id: uuid('md06'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('md06:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('md06'), tcOtherTenantA)],
    expectFailure: true,
    errorPattern: /belongs to another tenant/,
  },
  {
    name: 'MD07',
    rows: { findings: [{ id: uuid('md07'), tenantControlId: legacyA }], actionPlans: [{ id: uuid('md07:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', uuid('md07'), tcB1)],
    expectFailure: true,
    errorPattern: /expected catalog control/,
  },
  {
    name: 'MD08',
    rows: { findings: [{ id: uuid('md08'), tenantControlId: legacyB }], actionPlans: [{ id: uuid('md08:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('controls', uuid('md08'), tcB1)],
    expectFailure: true,
    errorPattern: /invalid table_name/,
  },
  {
    name: 'MD09',
    rows: { findings: [{ id: uuid('md09'), tenantControlId: legacyB }], actionPlans: [{ id: uuid('md09:ap'), tenantControlId: tcB1 }] },
    decisions: [decision('findings', missingRecord, tcB1)],
    expectFailure: true,
    errorPattern: /record_id invalid or missing/,
  },
];

function main() {
  let pg;
  try {
    pg = createPostgres();
    const version = psqlExec(pg, 'SHOW server_version;').stdout.trim();
    const results = scenarios.map((scenario) => runScenario(pg, scenario));
    const rerun = runRerunScenario(pg);
    results.push(rerun);

    for (const result of results) {
      console.log(`${result.name} ${result.status}`);
    }
    console.log(`POSTGRES_VERSION ${version}`);
    console.log(`POSTGRES_SOCKET ${pg.socketDir}`);
    console.log(`ISOLATED_FROM_DB_V4 YES`);
    console.log('POST_MIGRATION_INTEGRITY');
    for (const line of rerun.integrity) console.log(line);
    console.log('DB-N01 PostgreSQL migration checks: OK');
  } finally {
    stopPostgres(pg);
  }
}

main();
