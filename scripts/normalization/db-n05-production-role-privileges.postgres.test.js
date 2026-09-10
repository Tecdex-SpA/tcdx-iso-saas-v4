#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(path.join(root, 'database/baseline/production_schema_v1.sql'), 'utf8');

function grantBlocks(role) {
  return schema
    .split(';')
    .map((statement) => `${statement.trim()};`)
    .filter((statement) => new RegExp(`\\bTO ${role};$`).test(statement));
}

function grants(role) {
  const text = grantBlocks(role).join('\n');
  assert.ok(text, `${role} grants must exist`);
  return text;
}

function grantPrivilegeLists(role) {
  return grantBlocks(role)
    .map((statement) => statement.match(/^GRANT\s+(.+?)\s+ON\b/is)?.[1] || '')
    .filter(Boolean);
}

const backend = grants('tcdx_backend_runtime');
const platform = grants('tcdx_platform_runtime');
const support = grants('tcdx_readonly_support');
const aiReader = grants('ai_reader');

assert.doesNotMatch(schema, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'R00 no broad ALL TABLES grants');
assert.doesNotMatch(schema, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\b/i, 'R00 no broad ALL FUNCTIONS grants');
assert.doesNotMatch(schema, /\bBYPASSRLS\b/i, 'R07 tenant runtime roles must not receive BYPASSRLS');
assert.doesNotMatch(schema, /GRANT\s+CREATE\s+ON SCHEMA\s+(public|ai_core|tcdx_security)/i, 'R08 no unexpected CREATE/DDL grants');
assert.match(schema, /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/, 'future public functions must not inherit public EXECUTE');
assert.match(schema, /ALTER DEFAULT PRIVILEGES IN SCHEMA tcdx_security REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/, 'future security functions must not inherit public EXECUTE');

assert.match(backend, /SELECT, INSERT, UPDATE, DELETE ON tenants, users, tenant_standards, tenant_controls, control_soa, control_soa_assessments,[^;]*control_soa_change_log, findings, evidences, action_plans/is, 'R01 backend required read/write PASS');
assert.match(backend, /SELECT, INSERT, UPDATE, DELETE ON [^;]*tenant_operations, tenant_standard_operations[^;]*assets, asset_standards, asset_risks, risks, risk_control_relations, audits/is, 'R01 backend runtime operational DML PASS');
assert.match(backend, /SELECT ON app_roles, permissions, role_permissions,[^;]*commercial_addons/is, 'R01 backend commercial addon catalog SELECT PASS');
assert.match(backend, /SELECT ON public\.v_iso_control_effective_health, public\.v_iso_effective_kpi_summary,[^;]*public\.v_commercial_tenant_capabilities[^;]*public\.v_commercial_tenant_health/is, 'R01 backend runtime view SELECT PASS');
assert.doesNotMatch(backend, /schema_migrations|app_roles, permissions, role_permissions[^;]*SELECT, INSERT, UPDATE, DELETE/is, 'R02 backend cannot mutate migration/admin-only objects');
assert.doesNotMatch(backend, /refresh_control_health_scores_v2_1/, 'R01 backend must not receive legacy Health refresh function');

assert.match(support, /GRANT SELECT ON tenants, users, tenant_standards, tenant_controls, findings, evidences, action_plans/, 'R03 support SELECT approved PASS');
for (const privilegeList of grantPrivilegeLists('tcdx_readonly_support')) {
  assert.doesNotMatch(privilegeList, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i, 'R04 support write blocked');
}

assert.doesNotMatch(aiReader, /SELECT/i, 'R05 ai_reader unsafe tenant read blocked');
assert.doesNotMatch(schema, /GRANT\s+[^;]*\bSELECT\b[^;]*\bTO\s+ai_reader\s*;/i, 'R05 ai_reader must not receive direct SELECT grants');

assert.match(platform, /SELECT, INSERT, UPDATE, DELETE ON app_roles, permissions, role_permissions, standards, controls_catalog/, 'R06 platform catalog/config behavior PASS');
assert.doesNotMatch(platform, /SELECT, INSERT, UPDATE, DELETE ON tenants, users, tenant_standards, tenant_controls, control_soa, control_soa_assessments,\s+control_soa_change_log, findings, evidences, action_plans/, 'R06 platform must not receive operational tenant DML grant');
assert.match(platform, /GRANT EXECUTE ON FUNCTION\s+[\s\S]*tcdx_security\.tenant_write_allowed\(uuid\)\s+TO tcdx_platform_runtime;/, 'R06 platform security function allowlist must be explicit');
assert.doesNotMatch(platform, /dbn02_|refresh_control_health_scores_v2_1/, 'R06 platform must not receive Health mutation/helper functions without evidence');

console.log('PRODUCTION_ROLE_PRIVILEGES STATIC PASS');

// Effective ACL checks run only in a newly provisioned, disposable cluster.
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');
const pg = createPostgres();
try {
  psqlExec(pg, `CREATE EXTENSION vector; CREATE EXTENSION pgcrypto; CREATE EXTENSION pg_trgm;
    CREATE ROLE tcdx_migration_admin NOLOGIN;
    CREATE ROLE tcdx_backend_runtime NOLOGIN;
    CREATE ROLE tcdx_platform_runtime NOLOGIN;
    CREATE ROLE tcdx_readonly_support NOLOGIN;
    CREATE ROLE ai_reader NOLOGIN;
    GRANT CREATE ON DATABASE postgres TO tcdx_migration_admin;
    GRANT CREATE ON SCHEMA public TO tcdx_migration_admin;`);
  psqlExec(pg, `SET ROLE tcdx_migration_admin;\n${schema}`);
  psqlExec(pg, `SET ROLE tcdx_migration_admin;\n${fs.readFileSync(path.join(root, 'database/baseline/production_seed_v1.sql'), 'utf8')}`);
  psqlExec(pg, `SET ROLE tcdx_migration_admin;\n${schema}`);
  console.log('MIGRATION_ADMIN_BOOTSTRAP PASS');
  function allowed(role, sql) { psqlExec(pg, `BEGIN; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`); }
  function denied(role, sql) {
    const r = psqlExec(pg, `BEGIN; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`, { allowFailure: true });
    assert.notEqual(r.status, 0, `${role} unexpectedly allowed: ${sql}`);
    assert.match(r.stderr, /permission denied/, `${role} must fail for ACL, not schema/data errors: ${r.stderr}`);
  }
  function executableAppFunctions(role) {
    const sql = `
      SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE (n.nspname = 'tcdx_security' OR p.proname LIKE 'dbn02_%')
        AND has_function_privilege('${role}', p.oid, 'EXECUTE')
      ORDER BY 1;
    `;
    return psqlExec(pg, sql).stdout.trim().split('\n').filter(Boolean);
  }
  const securityFunctions = [
    'tcdx_security.current_tenant_id()',
    'tcdx_security.platform_scope_enabled()',
    'tcdx_security.tenant_visible(row_tenant_id uuid)',
    'tcdx_security.tenant_write_allowed(row_tenant_id uuid)',
  ].sort();
  const healthFunctions = [
    'public.dbn02_grc_health_publication_state(coverage numeric, minimum_coverage numeric, score numeric)',
    'public.dbn02_normalize_health_component_state(raw_state text, has_numeric boolean, effective_at timestamp with time zone, stale_after interval, as_of timestamp with time zone)',
    'public.dbn02_resolve_control_standard_code(p_tenant_id uuid, p_tenant_control_id uuid)',
  ].sort();
  assert.deepStrictEqual(executableAppFunctions('tcdx_backend_runtime'), [...healthFunctions, ...securityFunctions].sort(), 'backend function EXECUTE must match allowlist');
  assert.deepStrictEqual(executableAppFunctions('tcdx_platform_runtime'), securityFunctions, 'platform function EXECUTE must match allowlist');
  assert.deepStrictEqual(executableAppFunctions('tcdx_readonly_support'), [], 'support must not execute app functions');
  assert.deepStrictEqual(executableAppFunctions('ai_reader'), [], 'ai_reader must not execute app functions');
  console.log('R00 FUNCTION_EXECUTE_ALLOWLIST PASS');
  allowed('tcdx_backend_runtime', "INSERT INTO tenants(slug) VALUES ('dbn05-acl-test'); SELECT id FROM tenants; UPDATE tenants SET name='acl' WHERE slug='dbn05-acl-test'; DELETE FROM tenants WHERE slug='dbn05-acl-test'");
  console.log('R01 BACKEND_DML PASS');
  for (const table of ['schema_migrations', 'app_roles', 'permissions', 'role_permissions']) {
    denied('tcdx_backend_runtime', `INSERT INTO ${table} DEFAULT VALUES`);
    denied('tcdx_backend_runtime', `DELETE FROM ${table}`);
    denied('tcdx_backend_runtime', `UPDATE ${table} SET ${table === 'schema_migrations' ? 'duration_ms=0' : table === 'permissions' ? 'is_active=true' : table === 'app_roles' ? 'is_active=true' : 'is_allowed=true'}`);
  }
  console.log('R02 BACKEND_ADMIN_DML_DENIED PASS');
  allowed('tcdx_readonly_support', 'SELECT id FROM tenants');
  for (const sql of ["INSERT INTO tenants(slug) VALUES ('denied')", "UPDATE tenants SET name='denied'", 'DELETE FROM tenants']) denied('tcdx_readonly_support', sql);
  console.log('R03_R04 SUPPORT_READ_ONLY PASS');
  for (const table of ['tenants', 'knowledge_document_chunks', 'ai_core.v_tenant_health_context']) denied('ai_reader', `SELECT * FROM ${table}`);
  assert.equal(psqlExec(pg, `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','ai_core') AND c.relkind IN ('r','v','m','p') AND has_table_privilege('ai_reader', c.oid, 'SELECT');`).stdout.trim(), '0');
  console.log('R05 AI_READER_SAFE_DEFER PASS');
  allowed('tcdx_platform_runtime', "UPDATE app_roles SET display_name=display_name WHERE role_key='viewer'");
  for (const sql of ["INSERT INTO tenants(slug) VALUES ('denied')", "UPDATE tenants SET name='denied'", 'DELETE FROM tenants']) denied('tcdx_platform_runtime', sql);
  console.log('R06 PLATFORM_CATALOG_ONLY PASS');
  assert.equal(psqlExec(pg, `SELECT count(*) FROM pg_roles WHERE rolname IN ('tcdx_backend_runtime','tcdx_platform_runtime','tcdx_readonly_support','ai_reader') AND (rolbypassrls OR rolsuper OR rolcreaterole OR rolcreatedb);`).stdout.trim(), '0');
  for (const role of ['tcdx_backend_runtime', 'tcdx_platform_runtime', 'tcdx_readonly_support', 'ai_reader']) denied(role, 'CREATE TABLE public.dbn05_unexpected_ddl(id int)');
  console.log('R07_R08 NO_BYPASSRLS_NO_DDL PASS');
  for (const table of ['iso_standards','iso_standard_versions','iso_controls','iso_evidence_expectations']) {
    for (const role of ['tcdx_backend_runtime','tcdx_platform_runtime','tcdx_readonly_support']) {
      allowed(role, `SELECT * FROM ${table}`);
      denied(role, `DELETE FROM ${table}`);
      denied(role, `INSERT INTO ${table} DEFAULT VALUES`);
      denied(role, `UPDATE ${table} SET metadata=metadata`);
    }
    denied('ai_reader', `SELECT * FROM ${table}`);
  }
  console.log('VERSIONED_REFERENCE_READ_ONLY_ACL PASS');
  console.log('PRODUCTION_ROLE_PRIVILEGES EFFECTIVE PASS');
  console.log('PRODUCTION_ROLE_PRIVILEGES PASS');
} finally { stopPostgres(pg); }
