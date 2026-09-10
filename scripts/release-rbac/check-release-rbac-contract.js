#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const {
  CANONICAL_ROLES,
  RUNTIME_ACTIVE_PERMISSIONS,
  capabilityRows,
  matrixRows,
  rolesAllowedForPermission,
} = require('./release-rbac-contract');
const {
  ROLE_CLASSIFICATION,
  resolveRoleCompatibility,
  roleMatchesAny,
} = require('../../backend/src/services/auth/roleCompatibility.service');

const root = path.resolve(__dirname, '../..');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'coverage'].includes(entry.name)) walk(full, files);
    } else if (entry.isFile() && full.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function rel(file) {
  return path.relative(root, file);
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const platformAliasPattern = /['"](superadmin|super_admin|admin_global|global_admin|owner)['"]/g;
const allowedAliasFiles = new Set([
  'backend/src/services/auth/roleCompatibility.service.js',
  'scripts/release-rbac/check-release-rbac-contract.js',
]);

const unsafe = [];
for (const file of walk(path.join(root, 'backend/src'))) {
  const relative = rel(file);
  const source = stripComments(fs.readFileSync(file, 'utf8'));
  if (allowedAliasFiles.has(relative)) continue;
  const exactPatterns = [
    /\b(?:req\.user(?:\?\.)?\.role|getRole\(req\)|roleOf\(req\)|userRole|role)\s*={2,3}\s*['"]superadmin['"]/g,
    /\b(?:req\.user(?:\?\.)?\.role|getRole\(req\)|roleOf\(req\)|userRole|role)\s*!={1,2}\s*['"]superadmin['"]/g,
    /\b(?:const|let|var)\s+PLATFORM_ROLES\s*=\s*(?:new\s+Set\()?\s*\[/g,
  ];
  for (const pattern of exactPatterns) {
    let match;
    while ((match = pattern.exec(source))) {
      const nearby = source.slice(match.index, match.index + 260);
      if (/ROLE_GROUPS\.platform|roleCompatibility\.service/.test(nearby)) continue;
      unsafe.push(`${relative}:${lineOf(source, match.index)}:${match[0]}`);
    }
  }
  let alias;
  while ((alias = platformAliasPattern.exec(source))) {
    const nearby = source.slice(Math.max(0, alias.index - 220), alias.index + 220);
    const executablePlatformList =
      /\b(?:PLATFORM|SUPER_ADMIN|SUPERADMIN|GLOBAL_ADMIN|ADMIN_GLOBAL)[A-Z0-9_]*\b/.test(nearby) ||
      /\b(?:includes|has)\s*\([^)]*(?:role|userRole|getRole|roleOf|normalizeRole)/.test(nearby) ||
      /\b(?:role|userRole|getRole|roleOf|normalizeRole)[^;\n]*(?:={2,3}|!==|!=)/.test(nearby);
    const centrallyNormalized = /ROLE_GROUPS|roleCompatibility\.service|isPlatformRole|isPlatformUser|normalizeRoleKey/.test(nearby);
    if (executablePlatformList && !centrallyNormalized) {
      unsafe.push(`${relative}:${lineOf(source, alias.index)}:${alias[0]}`);
    }
  }
}

if (unsafe.length) {
  process.stderr.write(`RELEASE_RBAC_UNSAFE_LEGACY_PLATFORM_CHECKS=${unsafe.length}\n`);
}
assert.deepEqual(unsafe, [], `unsafe legacy platform role checks remain:\n${unsafe.join('\n')}`);

const contractPermissionClassificationPath = path.join(root, 'artifacts/release-rbac/CONTRACT_PERMISSION_CLASSIFICATION.md');
if (fs.existsSync(contractPermissionClassificationPath)) {
  const classification = fs.readFileSync(contractPermissionClassificationPath, 'utf8');
  assert.equal(/UNCLASSIFIED:\s*[1-9]/.test(classification), false, 'contract permissions must not remain unclassified');
}

const legacyAuthorityClassificationPath = path.join(root, 'artifacts/release-rbac/LEGACY_AUTHORITY_CLASSIFICATION.md');
if (fs.existsSync(legacyAuthorityClassificationPath)) {
  const classification = fs.readFileSync(legacyAuthorityClassificationPath, 'utf8');
  assert.equal(/CURRENT_UNSAFE_EXECUTABLE_LEGACY_PLATFORM_CHECKS:\s*[1-9]/.test(classification), false, 'legacy authority classification must report zero current unsafe executable checks');
}

assert.deepEqual(CANONICAL_ROLES, [
  'platform_admin',
  'tenant_admin',
  'auditor',
  'area_owner',
  'executive',
  'dealer',
  'viewer',
]);

for (const [alias, canonical] of Object.entries({
  superadmin: 'platform_admin',
  super_admin: 'platform_admin',
  admin_global: 'platform_admin',
  global_admin: 'platform_admin',
  owner: 'platform_admin',
  admin: 'tenant_admin',
  admin_cumplimiento: 'tenant_admin',
  compliance_admin: 'tenant_admin',
  compliance_manager: 'tenant_admin',
  operativo: 'area_owner',
  responsable_area: 'area_owner',
  ejecutivo: 'executive',
  cliente: 'viewer',
  client: 'viewer',
  read_only: 'viewer',
  readonly: 'viewer',
  solo_lectura: 'viewer',
})) {
  const resolved = resolveRoleCompatibility(alias);
  assert.equal(resolved.canonical_role, canonical, `${alias} must resolve to ${canonical}`);
  assert.notEqual(resolved.classification, ROLE_CLASSIFICATION.UNKNOWN_REQUIRES_DECISION);
  assert.equal(roleMatchesAny(alias, [canonical]), true, `${alias} must satisfy canonical ${canonical} gate`);
}

const allMatrixRows = matrixRows();
assert.equal(allMatrixRows.length, RUNTIME_ACTIVE_PERMISSIONS.length);
assert.equal(rolesAllowedForPermission('audit.review').includes('auditor'), true, 'auditor must have audit.review');
assert.equal(rolesAllowedForPermission('actions.manage').includes('executive'), false, 'executive must be read-only');
assert.equal(rolesAllowedForPermission('actions.manage').includes('viewer'), false, 'viewer must be read-only');
assert.equal(rolesAllowedForPermission('controls.view').includes('dealer'), false, 'dealer must not receive generic tenant read');
assert.equal(rolesAllowedForPermission('dealer.clients.view').includes('dealer'), true, 'dealer portal permission must exist');

const missingCapabilityRoles = capabilityRows().filter((row) => row.required_permission && !rolesAllowedForPermission(row.required_permission).length);
assert.deepEqual(missingCapabilityRoles, [], `capabilities with no satisfying role: ${missingCapabilityRoles.map((row) => row.capability).join(', ')}`);

for (const script of [
  'scripts/release-rbac/check-role-alias-equivalence.js',
  'scripts/release-rbac/check-residual-role-authority.js',
]) {
  process.stdout.write(execFileSync('node', [script], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

process.stdout.write(`RELEASE_RBAC_CONTRACT_PASS permissions=${RUNTIME_ACTIVE_PERMISSIONS.length} roles=${CANONICAL_ROLES.length}\n`);
