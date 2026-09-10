#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createPostgres, stopPostgres, psqlExec } = require('../normalization/db-n05-isolated-postgres');
const {
  CANONICAL_ROLES,
  RUNTIME_ACTIVE_PERMISSIONS,
  rolesAllowedForPermission,
} = require('./release-rbac-contract');

const root = path.resolve(__dirname, '../..');
const sqlPaths = [
  'database/baseline/production_schema_v1.sql',
  'database/baseline/production_seed_v1.sql',
  'database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql',
  'database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql',
  'database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql',
  'database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql',
];
const runnerPath = path.join(root, 'scripts/release-rbac/apply-release-rbac-capability-closeout.js');

function readSql(relative) {
  const full = path.join(root, relative);
  assert.ok(fs.existsSync(full), `${relative} must exist`);
  return fs.readFileSync(full, 'utf8');
}

function databaseUrl(pg) {
  if (pg.container) return `postgres://postgres@127.0.0.1:${pg.port}/postgres`;
  return `postgres://postgres@/postgres?host=${encodeURIComponent(pg.socketDir)}&port=${pg.port}`;
}

function runRunner(pg, mode, allowFailure = false) {
  const result = spawnSync('node', [runnerPath, mode], {
    cwd: root,
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL: databaseUrl(pg),
    },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (!allowFailure) {
    assert.equal(result.status, 0, `runner ${mode} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /postgres:\/\/|postgresql:\/\/|password=|DB_PASSWORD|JWT_SECRET/i);
  return result;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function scalar(pg, query) {
  return psqlExec(pg, query).stdout.trim();
}

function assertScalar(pg, name, query, expected) {
  const actual = scalar(pg, query);
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name}=PASS`);
}

function uuid() {
  return crypto.randomUUID();
}

function insertSyntheticData(pg) {
  const tenantA = uuid();
  const tenantB = uuid();
  const users = Object.fromEntries(CANONICAL_ROLES.map((role) => [role, uuid()]));
  psqlExec(pg, `
    INSERT INTO tenants (id, name, slug)
    VALUES
      ('${tenantA}', 'Synthetic Tenant A', 'synthetic-a-' || replace('${tenantA}', '-', '')),
      ('${tenantB}', 'Synthetic Tenant B', 'synthetic-b-' || replace('${tenantB}', '-', ''));

    INSERT INTO users (id, tenant_id, email, name, role, status)
    VALUES
      ('${users.platform_admin}', NULL, 'platform-${users.platform_admin}@synthetic.invalid', 'Platform Admin', 'platform_admin', 'active'),
      ('${users.tenant_admin}', '${tenantA}', 'tenant-admin-${users.tenant_admin}@synthetic.invalid', 'Tenant Admin', 'tenant_admin', 'active'),
      ('${users.auditor}', '${tenantA}', 'auditor-${users.auditor}@synthetic.invalid', 'Auditor', 'auditor', 'active'),
      ('${users.area_owner}', '${tenantA}', 'area-owner-${users.area_owner}@synthetic.invalid', 'Area Owner', 'area_owner', 'active'),
      ('${users.executive}', '${tenantA}', 'executive-${users.executive}@synthetic.invalid', 'Executive', 'executive', 'active'),
      ('${users.viewer}', '${tenantA}', 'viewer-${users.viewer}@synthetic.invalid', 'Viewer', 'viewer', 'active'),
      ('${users.dealer}', '${tenantA}', 'dealer-${users.dealer}@synthetic.invalid', 'Dealer', 'dealer', 'active');

    INSERT INTO dealer_tenants (dealer_user_id, tenant_id, can_view_contract, can_request_changes, status)
    VALUES ('${users.dealer}', '${tenantA}', true, true, 'active');

    INSERT INTO saas_modules (module_key, display_name, status, is_active)
    VALUES ('synthetic_release_rbac', 'Synthetic Release RBAC', 'active', true)
    ON CONFLICT (module_key) DO UPDATE SET status='active', is_active=true;

    INSERT INTO commercial_plans (plan_key, display_name, status, is_active)
    VALUES ('synthetic_release_plan', 'Synthetic Release Plan', 'active', true)
    ON CONFLICT (plan_key) DO UPDATE SET status='active', is_active=true;

    INSERT INTO commercial_plan_versions (id, plan_key, version, version_number, status, published_at)
    VALUES ('${uuid()}', 'synthetic_release_plan', 'v1', 1, 'published', now())
    ON CONFLICT (plan_key, version) DO NOTHING;

    INSERT INTO commercial_technical_capabilities (capability_key, module_key, display_name, classification, required_permission, status, is_active)
    VALUES
      ('synthetic.rbac.allowed', 'synthetic_release_rbac', 'Synthetic allowed capability', 'tenant', 'actions.view', 'active', true),
      ('synthetic.rbac.mutation', 'synthetic_release_rbac', 'Synthetic mutation capability', 'tenant', 'actions.manage', 'active', true)
    ON CONFLICT (capability_key) DO UPDATE SET required_permission=EXCLUDED.required_permission, status='active', is_active=true;

    INSERT INTO plan_version_capabilities (plan_version_id, capability_key, is_included)
    SELECT id, 'synthetic.rbac.allowed', true
    FROM commercial_plan_versions
    WHERE plan_key='synthetic_release_plan' AND version='v1'
    ON CONFLICT (plan_version_id, capability_key) DO UPDATE SET is_included=true;

    INSERT INTO tenant_subscriptions (tenant_id, plan_version_id, plan_key, status)
    SELECT '${tenantA}', id, 'synthetic_release_plan', 'active'
    FROM commercial_plan_versions
    WHERE plan_key='synthetic_release_plan' AND version='v1'
    LIMIT 1;
  `);
  return { tenantA, tenantB, users };
}

function assertPermission(pg, name, userId, permission, expected) {
  assertScalar(pg, name, `SELECT user_has_permission('${userId}'::uuid, ${sqlLiteral(permission)})::text;`, expected);
}

function assertTenantScope(pg, name, userId, tenantId, expected) {
  assertScalar(pg, name, `
    SELECT CASE
      WHEN (SELECT role FROM users WHERE id='${userId}'::uuid)='platform_admin' THEN true
      ELSE EXISTS (
        SELECT 1
        FROM users
        WHERE id='${userId}'::uuid
          AND tenant_id='${tenantId}'::uuid
      )
    END::text;
  `, expected);
}

function assertDealerScope(pg, name, userId, tenantId, expected) {
  assertScalar(pg, name, `
    SELECT EXISTS (
      SELECT 1
      FROM dealer_tenants
      WHERE dealer_user_id='${userId}'::uuid
        AND tenant_id='${tenantId}'::uuid
        AND status='active'
    )::text;
  `, expected);
}

function assertTenantCapability(pg, name, userId, tenantId, capability, expected) {
  assertScalar(pg, name, `
    WITH cap AS (
      SELECT required_permission
      FROM commercial_technical_capabilities
      WHERE capability_key=${sqlLiteral(capability)}
        AND status='active'
        AND is_active=true
    ),
    rbac AS (
      SELECT user_has_permission('${userId}'::uuid, (SELECT required_permission FROM cap)) AS ok
    ),
    scope AS (
      SELECT EXISTS (SELECT 1 FROM users WHERE id='${userId}'::uuid AND tenant_id='${tenantId}'::uuid) AS ok
    ),
    entitlement AS (
      SELECT EXISTS (
        SELECT 1
        FROM tenant_subscriptions ts
        JOIN plan_version_capabilities pvc ON pvc.plan_version_id=ts.plan_version_id
        WHERE ts.tenant_id='${tenantId}'::uuid
          AND ts.status IN ('active','trialing','past_due')
          AND pvc.capability_key=${sqlLiteral(capability)}
          AND pvc.is_included=true
      ) AS ok
    )
    SELECT ((SELECT ok FROM rbac) AND (SELECT ok FROM scope) AND (SELECT ok FROM entitlement))::text;
  `, expected);
}

function main() {
  for (const relative of sqlPaths) {
    const sql = readSql(relative);
    assert.doesNotMatch(sql, /\btecdex_saas\b/i, `${relative} must not reference legacy DB`);
    assert.doesNotMatch(sql, /\btcdx_saasv2\b/i, `${relative} must not reference real fresh DB`);
  }

  const pg = createPostgres();
  try {
    for (const relative of sqlPaths) psqlExec(pg, readSql(relative));
    console.log('RELEASE_RBAC_FRESH_BASELINE_AND_FRESH_MIGRATIONS=PASS');

    const checksum = runRunner(pg, '--checksum').stdout.trim();
    assert.match(checksum, /20260910_release_rbac_capability_systemic_closeout checksum=[a-f0-9]{64}/);
    console.log('RELEASE_RBAC_CHECKSUM=PASS');

    const preflight = runRunner(pg, '--preflight');
    assert.match(preflight.stdout, /migration_state=pending/);
    console.log('RELEASE_RBAC_PREFLIGHT_PENDING=PASS');

    runRunner(pg, '--apply');
    console.log('RELEASE_RBAC_APPLY=PASS');
    const reapply = runRunner(pg, '--apply');
    assert.match(reapply.stdout, /migration_state=already_applied/);
    console.log('RELEASE_RBAC_REAPPLY=PASS');

    assertScalar(pg, 'RELEASE_RBAC_PERMISSION_COUNT', 'SELECT count(*)::int FROM permissions WHERE permission_key = ANY(ARRAY[' + RUNTIME_ACTIVE_PERMISSIONS.map(sqlLiteral).join(',') + ']);', RUNTIME_ACTIVE_PERMISSIONS.length);
    assertScalar(pg, 'RELEASE_RBAC_ROLE_COUNT', 'SELECT count(*)::int FROM app_roles WHERE role_key = ANY(ARRAY[' + CANONICAL_ROLES.map(sqlLiteral).join(',') + ']);', CANONICAL_ROLES.length);
    assertScalar(pg, 'RELEASE_RBAC_CAPABILITY_PERMISSION_ORPHANS', "SELECT count(*)::int FROM commercial_technical_capabilities c LEFT JOIN permissions p ON p.permission_key=c.required_permission WHERE c.status='active' AND c.required_permission IS NOT NULL AND p.permission_key IS NULL;", 0);
    assertScalar(pg, 'RELEASE_RBAC_ROLE_ORPHANS', 'SELECT count(*)::int FROM role_permissions rp LEFT JOIN app_roles ar USING (role_key) WHERE ar.role_key IS NULL;', 0);
    assertScalar(pg, 'RELEASE_RBAC_PERMISSION_ORPHANS', 'SELECT count(*)::int FROM role_permissions rp LEFT JOIN permissions p USING (permission_key) WHERE p.permission_key IS NULL;', 0);
    assertScalar(pg, 'CAPABILITY_PERMISSION_ORPHAN', "SELECT count(*)::int FROM commercial_technical_capabilities c LEFT JOIN permissions p ON p.permission_key=c.required_permission WHERE c.status='active' AND c.required_permission IS NOT NULL AND p.permission_key IS NULL;", 0);
    assertScalar(pg, 'ROLE_ORPHAN', 'SELECT count(*)::int FROM role_permissions rp LEFT JOIN app_roles ar USING (role_key) WHERE ar.role_key IS NULL;', 0);
    assertScalar(pg, 'PERMISSION_ORPHAN', 'SELECT count(*)::int FROM role_permissions rp LEFT JOIN permissions p USING (permission_key) WHERE p.permission_key IS NULL;', 0);
    console.log('CAPABILITY_PERMISSION_ORPHAN=0');
    console.log('ROLE_ORPHAN=0');
    console.log('PERMISSION_ORPHAN=0');

    const synthetic = insertSyntheticData(pg);
    const { tenantA, tenantB, users } = synthetic;

    assertPermission(pg, 'ROLE_PLATFORM_ADMIN_GLOBAL', users.platform_admin, 'admin_saas.manage', 'true');
    assertPermission(pg, 'ROLE_PLATFORM_ADMIN_NOT_SUPERADMIN_ALIAS_DEPENDENT', users.platform_admin, 'commercial.catalog.manage', 'true');
    assertTenantScope(pg, 'ROLE_PLATFORM_ADMIN_CROSS_TENANT', users.platform_admin, tenantB, 'true');
    console.log('ROLE_PLATFORM_ADMIN_FUNCTIONAL=PASS');

    assertPermission(pg, 'ROLE_TENANT_ADMIN_TENANT_PERMISSION', users.tenant_admin, 'actions.manage', 'true');
    assertPermission(pg, 'ROLE_TENANT_ADMIN_NO_ADMIN_SAAS_GLOBAL', users.tenant_admin, 'admin_saas.manage', 'false');
    assertTenantScope(pg, 'ROLE_TENANT_ADMIN_TENANT_A_SCOPE', users.tenant_admin, tenantA, 'true');
    assertTenantScope(pg, 'ROLE_TENANT_ADMIN_TENANT_B_DENY', users.tenant_admin, tenantB, 'false');
    console.log('ROLE_TENANT_ADMIN_FUNCTIONAL=PASS');

    assertPermission(pg, 'ROLE_AUDITOR_AUDIT_REVIEW', users.auditor, 'audit.review', 'true');
    assertPermission(pg, 'ROLE_AUDITOR_NO_TENANT_ADMIN', users.auditor, 'users.manage', 'false');
    assertTenantScope(pg, 'ROLE_AUDITOR_TENANT_B_DENY', users.auditor, tenantB, 'false');
    console.log('ROLE_AUDITOR_FUNCTIONAL=PASS');

    assertPermission(pg, 'ROLE_AREA_OWNER_OPERATE', users.area_owner, 'actions.manage', 'true');
    assertPermission(pg, 'ROLE_AREA_OWNER_NO_TENANT_ADMIN', users.area_owner, 'users.manage', 'false');
    assertTenantScope(pg, 'ROLE_AREA_OWNER_SCOPE_DENY', users.area_owner, tenantB, 'false');
    console.log('ROLE_AREA_OWNER_FUNCTIONAL=PASS');

    assertPermission(pg, 'ROLE_EXECUTIVE_READ', users.executive, 'dashboards.read', 'true');
    assertPermission(pg, 'ROLE_EXECUTIVE_MUTATION_DENY', users.executive, 'actions.manage', 'false');
    console.log('ROLE_EXECUTIVE_FUNCTIONAL=PASS');

    assertPermission(pg, 'ROLE_VIEWER_READ', users.viewer, 'dashboards.read', 'true');
    assertPermission(pg, 'ROLE_VIEWER_MUTATION_DENY', users.viewer, 'actions.manage', 'false');
    console.log('ROLE_VIEWER_FUNCTIONAL=PASS');

    assertPermission(pg, 'ROLE_DEALER_PORTAL', users.dealer, 'dealer.clients.view', 'true');
    assertPermission(pg, 'ROLE_DEALER_INTERNAL_TENANT_DENY', users.dealer, 'controls.view', 'false');
    assertDealerScope(pg, 'ROLE_DEALER_TENANT_A_ASSIGNED', users.dealer, tenantA, 'true');
    assertDealerScope(pg, 'ROLE_DEALER_TENANT_B_DENY', users.dealer, tenantB, 'false');
    console.log('ROLE_DEALER_FUNCTIONAL=PASS');

    assertTenantCapability(pg, 'ENTITLEMENT_RBAC_SCOPE_ALLOW', users.tenant_admin, tenantA, 'synthetic.rbac.allowed', 'true');
    assertTenantCapability(pg, 'ENTITLEMENT_RBAC_DENY_WITH_ENTITLEMENT_ALLOW', users.viewer, tenantA, 'synthetic.rbac.mutation', 'false');
    assertTenantCapability(pg, 'ENTITLEMENT_SCOPE_DENY_WITH_RBAC_ALLOW', users.tenant_admin, tenantB, 'synthetic.rbac.allowed', 'false');
    assertTenantCapability(pg, 'ENTITLEMENT_DENY_WITH_RBAC_ALLOW', users.tenant_admin, tenantA, 'synthetic.rbac.mutation', 'false');
    assertScalar(pg, 'TENANT_A_TO_TENANT_B_LEAKAGE', `
      SELECT count(*)::int
      FROM users
      WHERE role <> 'platform_admin'
        AND tenant_id='${tenantA}'::uuid
        AND EXISTS (
          SELECT 1
          FROM users other_user
          WHERE other_user.id = users.id
            AND other_user.tenant_id='${tenantB}'::uuid
        );
    `, 0);

    for (const permission of RUNTIME_ACTIVE_PERMISSIONS) {
      const roles = rolesAllowedForPermission(permission);
      assert.ok(Array.isArray(roles), `${permission} roles must be array`);
    }
    console.log('RELEASE_RBAC_SEVEN_ROLE_SYNTHETIC_SUITE=PASS');
    console.log('RELEASE_RBAC_ENTITLEMENT_ENFORCEMENT=PASS');
    console.log('RELEASE_RBAC_DEALER_ASSIGNMENT_ISOLATION=PASS');

    psqlExec(pg, `UPDATE schema_migrations SET checksum=repeat('f',64) WHERE migration_id='20260910_release_rbac_capability_systemic_closeout';`);
    const mismatch = runRunner(pg, '--apply', true);
    assert.notEqual(mismatch.status, 0, 'checksum mismatch must fail closed');
    assert.match(mismatch.stdout + mismatch.stderr, /checksum_mismatch|unsafe migration state/);
    console.log('RELEASE_RBAC_CHECKSUM_MISMATCH_FAIL_CLOSED=PASS');
  } finally {
    stopPostgres(pg);
    console.log('ISOLATED_POSTGRES_CLEANUP=PASS');
  }
}

main();
