#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const frontendRoot = path.join(root, 'frontend/src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'coverage'].includes(entry.name)) walk(full, files);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
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

const allowedAuthorityFiles = new Set([
  'frontend/src/utils/mvpPermissions.ts',
  'frontend/src/utils/auth.ts',
]);

const unsafe = [];
const platformAlias = String.raw`(?:superadmin|super_admin|admin_global|global_admin|owner)`;
const exactRoleCheck = new RegExp(String.raw`\b(?:role|currentRole|userRole|normalized|normalizedRole)\s*(?:={2,3}|!==|!=)\s*['"]${platformAlias}['"]`, 'g');
const localPlatformSet = /\b(?:const|let|var)\s+(?:PLATFORM|SUPER_ADMIN|SUPERADMIN|GLOBAL_ADMIN|ADMIN_GLOBAL|DASHBOARD_MANAGER|ADMIN|TECHNICAL)[A-Z0-9_]*\s*=\s*(?:new\s+Set\()?\s*\[/g;
const localSuperAdminHelper = /\bfunction\s+isSuperAdminRole\s*\(/g;
const platformAliasLiteral = new RegExp(String.raw`['"]${platformAlias}['"]`, 'g');

for (const file of walk(frontendRoot)) {
  const relative = rel(file);
  const source = stripComments(fs.readFileSync(file, 'utf8'));
  if (allowedAuthorityFiles.has(relative)) continue;

  const patterns = [exactRoleCheck, localPlatformSet, localSuperAdminHelper];
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source))) {
      const nearby = source.slice(Math.max(0, match.index - 180), match.index + 260);
      const delegatedToCentralHelper =
        /isPlatformRole|isDealerRole|isTenantAdminRole|isAuditorRole|isAreaOwnerRole|isExecutiveRole|isViewerRole|roleHasAnyMvpGroup/.test(nearby);
      if (!delegatedToCentralHelper) {
        unsafe.push({
          file: relative,
          line: lineOf(source, match.index),
          pattern: match[0].replace(/\s+/g, ' ').slice(0, 180),
        });
      }
    }
  }

  let aliasMatch;
  platformAliasLiteral.lastIndex = 0;
  while ((aliasMatch = platformAliasLiteral.exec(source))) {
    const nearby = source.slice(Math.max(0, aliasMatch.index - 220), aliasMatch.index + 220);
    const executable =
      /\b(?:includes|has)\s*\([^)]*(?:role|currentRole|userRole|normalized|normalizedRole)/.test(nearby) ||
      /\b(?:role|currentRole|userRole|normalized|normalizedRole)[^;\n]*(?:={2,3}|!==|!=)/.test(nearby);
    const delegatedToCentralHelper =
      /isPlatformRole|isDealerRole|isTenantAdminRole|isAuditorRole|isAreaOwnerRole|isExecutiveRole|isViewerRole|roleHasAnyMvpGroup/.test(nearby);
    if (executable && !delegatedToCentralHelper) {
      unsafe.push({
        file: relative,
        line: lineOf(source, aliasMatch.index),
        pattern: aliasMatch[0],
      });
    }
  }
}

const mvpPermissions = fs.readFileSync(path.join(root, 'frontend/src/utils/mvpPermissions.ts'), 'utf8');
const appLayout = fs.readFileSync(path.join(root, 'frontend/src/components/AppLayout.tsx'), 'utf8');
const recommendedActions = fs.readFileSync(path.join(root, 'frontend/src/components/acciones-recomendadas/utils.ts'), 'utf8');

assert.equal(unsafe.length, 0, `unsafe frontend legacy platform role authorities:\n${unsafe.map((item) => `${item.file}:${item.line}:${item.pattern}`).join('\n')}`);
assert.match(mvpPermissions, /viewer:\s*\{\s*canonicalRole:\s*'viewer'/, 'viewer must remain a distinct frontend mirror role');
assert.match(mvpPermissions, /superadmin:\s*\{\s*canonicalRole:\s*'platform'/, 'superadmin alias must normalize to platform in frontend mirror');
assert.match(mvpPermissions, /cliente:\s*\{\s*canonicalRole:\s*'viewer'/, 'cliente alias must normalize to viewer in frontend mirror');
assert.match(mvpPermissions, /solo_lectura:\s*\{\s*canonicalRole:\s*'viewer'/, 'solo_lectura alias must normalize to viewer in frontend mirror');
assert.match(mvpPermissions, /operativo:\s*\{\s*canonicalRole:\s*'area_owner'/, 'operativo alias must normalize to area_owner in frontend mirror');
assert.doesNotMatch(mvpPermissions, /viewer:\s*\{\s*canonicalRole:\s*'executive'/, 'viewer must not inherit executive family');
assert.match(appLayout, /\/api\/me\/permissions/, 'AppLayout must consume backend effective permissions');
assert.match(appLayout, /\/api\/me\/modules/, 'AppLayout must consume backend module entitlement map');
assert.match(appLayout, /canShowCapability\(requiredCapability\)/, 'AppLayout must enforce commercial capability visibility for tenant users');
assert.match(recommendedActions, /isDealerRole\(value\)/, 'dealer must remain denied from internal tenant mutation surfaces');

console.log('FRONTEND_BACKEND_AUTHORIZATION_CONSISTENCY=PASS');
console.log(`FRONTEND_UNSAFE_LEGACY_PLATFORM_AUTHORITY=${unsafe.length}`);
console.log('FRONTEND_VIEWER_DISTINCT_FROM_EXECUTIVE=PASS');
console.log('FRONTEND_ROLE_ALIAS_CONSISTENCY=PASS');
console.log('FRONTEND_IS_MIRROR_ONLY=PASS');
console.log('BACKEND_IS_AUTHORITY=PASS');
console.log('FRONTEND_BACKEND_EFFECTIVE_PERMISSION_MIRROR=PASS');
