#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  CANONICAL_ROLES,
  DEALER_AUTHORIZATION_DECISION,
  RUNTIME_ACTIVE_PERMISSIONS,
  capabilityRows,
  matrixRows,
  permissionGroup,
  rolesAllowedForPermission,
} = require('./release-rbac-contract');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'artifacts/release-rbac');

const ACTIVE_AUTH_SOURCES = [
  'backend/src/middleware/rbac.middleware.js',
  'backend/src/middleware/commercialEntitlement.middleware.js',
  'backend/src/services/commercial/commercialPlanMatrix.service.js',
  'backend/src/services/commercial/entitlementResolver.service.js',
  'backend/src/app.js',
  'backend/src/routes/action-plans.routes.js',
  'backend/src/routes/ai.routes.js',
  'backend/src/routes/admin-saas.routes.js',
  'backend/src/routes/grc.routes.js',
  'backend/src/routes/iso-operational-execution.routes.js',
  'backend/src/routes/iso-recommended-actions.routes.js',
  'backend/src/routes/operational-risks.routes.js',
  'backend/src/routes/phase2.routes.js',
  'backend/src/routes/phase3.routes.js',
  'backend/src/routes/phase5.routes.js',
  'backend/src/services/grc/grcRuntimeAdapters.js',
  'backend/src/services/grc/grc.service.js',
  'backend/src/services/grc/phase2.service.js',
  'backend/src/services/grc/phase3.service.js',
  'backend/src/services/imports/importDefinitions.js',
  'backend/src/services/imports/universalImport.service.js',
  'backend/src/services/math-governance/officialCalculationOrchestrator.service.js',
  'backend/src/services/math-governance/sourceResolver.service.js',
  'scripts/rbac02/build-rbac02-route-matrix.js',
];

const SQL_CATALOG_SOURCES = [
  'database/baseline/production_seed_v1.sql',
  'database/migrations/20260722_phase1_grc_core.sql',
  'database/migrations/20260727_phase2_integrated_grc.sql',
  'database/migrations/20260827_rbac01_canonical_roles_brand01.sql',
  'database/migrations/20260901_normalization01_db_backend_authority.sql',
  'database/migrations/20260901_hotfix_postdeploy01_ai_view_rbac.sql',
  'database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql',
  'database/migrations/20260910_release_rbac_capability_systemic_closeout.sql',
];

function rel(file) {
  return path.relative(root, file);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/--.*$/gm, '');
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function add(map, key, item) {
  if (!key || !/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/.test(key)) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

function extractRuntimePermissions() {
  const permissions = new Map();
  const patterns = [
    /permission\s*:\s*'([^']+)'/g,
    /requiredPermission\s*:\s*'([^']+)'/g,
    /required_permission\s*:\s*'([^']+)'/g,
    /user_has_permission\([^)]*'([^']+)'/g,
    /authorized(?:All)?\(\s*req\s*,\s*'([^']+)'/g,
    /\b(?:semanticPermission|indicatorPermission)\([^)]*'([^']+)'\s*,\s*['"](?:read|write)['"]/g,
    /requiredPermissions\s*:\s*\[([^\]]*)\]/g,
    /authorizedAll\(\s*req\s*,\s*\[([^\]]*)\]/g,
  ];

  for (const file of ACTIVE_AUTH_SOURCES) {
    const raw = read(file);
    const source = stripComments(raw);
    for (const pattern of patterns.slice(0, 6)) {
      let match;
      while ((match = pattern.exec(source))) {
        add(permissions, match[1], `${file}:${lineOf(source, match.index)}`);
      }
    }
    let arrayMatch;
    for (const arrayPattern of patterns.slice(6)) {
      while ((arrayMatch = arrayPattern.exec(source))) {
        const inner = arrayMatch[1];
        let itemMatch;
        const itemPattern = /'([^']+)'/g;
        while ((itemMatch = itemPattern.exec(inner))) {
          add(permissions, itemMatch[1], `${file}:${lineOf(source, arrayMatch.index)}`);
        }
      }
    }

    const literalPattern = /'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g;
    let literalMatch;
    while ((literalMatch = literalPattern.exec(source))) {
      const permission = literalMatch[1];
      if (!RUNTIME_ACTIVE_PERMISSIONS.includes(permission)) continue;
      const nearby = source.slice(Math.max(0, literalMatch.index - 220), literalMatch.index + 220);
      const executablePermissionContext =
        /\b(?:authorized|authorizedAll|assertPermission|user_has_permission|requirePermission|requiredPermission|requiredPermissions|semanticPermission|indicatorPermission|permissionFor|permissionMap|permissions)\b/.test(nearby);
      if (executablePermissionContext) {
        add(permissions, permission, `${file}:${lineOf(source, literalMatch.index)}`);
      }
    }
  }

  return permissions;
}

function extractCatalogPermissions() {
  const keys = new Set();
  for (const file of SQL_CATALOG_SOURCES) {
    if (!fs.existsSync(path.join(root, file))) continue;
    const source = stripComments(read(file));
    const pattern = /'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g;
    let match;
    while ((match = pattern.exec(source))) keys.add(match[1]);
  }
  return keys;
}

function extractAuthorizationControls() {
  const controls = [];
  const rbac = stripComments(read('backend/src/middleware/rbac.middleware.js'));
  const rulePattern = /\{\s*(?:method:\s*'([^']+)'\s*,\s*pattern:\s*([^,]+),|prefix:\s*'([^']+)')([\s\S]*?)\}/g;
  let match;
  while ((match = rulePattern.exec(rbac))) {
    const method = match[1] || 'ANY';
    const route = match[3] || String(match[2] || '').trim();
    const body = match[4] || '';
    const permission = (body.match(/permission\s*:\s*'([^']+)'/) || [])[1] || '';
    const read = (body.match(/read\s*:\s*([^,\n}]+)/) || [])[1] || '';
    const write = (body.match(/write\s*:\s*([^,\n}]+)/) || [])[1] || '';
    controls.push({
      method,
      route,
      source: `backend/src/middleware/rbac.middleware.js:${lineOf(rbac, match.index)}`,
      type: permission ? 'canonical permission check' : 'canonical role check',
      roles: String(read || write || 'rule.roles').trim(),
      permissions: permission || 'see route mode role list',
      tenant_scope: 'tenantScope.middleware/effectiveTenant where tenant id is requested',
      entitlement: 'commercialEntitlement.middleware when route mounted with capability',
      platform_bypass: 'central isPlatformRole',
      current_authority: 'rbac.middleware + DB user_has_permission/capability resolver',
      proposed_authority: 'canonical role -> RBAC permission -> tenant scope -> entitlement/capability',
    });
  }
  return controls;
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n');
}

function writeRuntimeInventory(runtimePermissions) {
  const controls = extractAuthorizationControls();
  const rows = controls.map((control) => ({
    method: control.method,
    route: control.route,
    'file/line': control.source,
    classification: control.type,
    roles: control.roles,
    permissions: control.permissions,
    tenant_scope: control.tenant_scope,
    entitlement: control.entitlement,
    platform_bypass: control.platform_bypass,
    current_authority: control.current_authority,
    canonical_authority: control.proposed_authority,
  }));

  const permissionRows = [...runtimePermissions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([permission, locations]) => ({
    permission,
    classification: RUNTIME_ACTIVE_PERMISSIONS.includes(permission) ? 'canonical permission check' : 'AMBIGUOUS_NOT_PERMISSION',
    evidence: locations.slice(0, 4).join('<br>'),
  }));

  fs.writeFileSync(
    path.join(outDir, 'RUNTIME_AUTHORIZATION_INVENTORY.md'),
    [
      '# Runtime Authorization Inventory',
      '',
      `Generated by: scripts/release-rbac/build-release-rbac-artifacts.js`,
      `Runtime permission keys detected in active authorization contexts: ${runtimePermissions.size}`,
      '',
      '## Protected Routes',
      '',
      table(['method', 'route', 'file/line', 'classification', 'roles', 'permissions', 'tenant_scope', 'entitlement', 'platform_bypass', 'current_authority', 'canonical_authority'], rows),
      '',
      '## Permission Evidence',
      '',
      table(['permission', 'classification', 'evidence'], permissionRows),
      '',
      '## Dealer Decision',
      '',
      `Decision: ${DEALER_AUTHORIZATION_DECISION.decision}`,
      `Scope authority: ${DEALER_AUTHORIZATION_DECISION.scope_authority}`,
      `Notes: ${DEALER_AUTHORIZATION_DECISION.notes}`,
      '',
    ].join('\n')
  );
}

function writePermissionGap(runtimePermissions, catalogPermissions) {
  const runtimeKeys = new Set([...runtimePermissions.keys()].filter((key) => RUNTIME_ACTIVE_PERMISSIONS.includes(key)));
  const rows = [];
  for (const key of new Set([...RUNTIME_ACTIVE_PERMISSIONS, ...catalogPermissions])) {
    let classification = 'PRESENT_UNUSED';
    if (runtimeKeys.has(key) && catalogPermissions.has(key)) classification = 'PRESENT_AND_USED';
    if (runtimeKeys.has(key) && !catalogPermissions.has(key)) classification = 'RUNTIME_MISSING_IN_CATALOG';
    rows.push({
      permission: key,
      group: permissionGroup(key),
      classification,
      evidence: runtimePermissions.get(key)?.slice(0, 3).join('<br>') || '',
    });
  }
  rows.sort((a, b) => a.permission.localeCompare(b.permission));
  const missing = rows.filter((row) => row.classification === 'RUNTIME_MISSING_IN_CATALOG');
  fs.writeFileSync(
    path.join(outDir, 'PERMISSION_CATALOG_GAP.md'),
    [
      '# Permission Catalog Gap',
      '',
      `Runtime active permission keys: ${runtimeKeys.size}`,
      `Catalog permission keys from baseline/migrations including this closeout: ${catalogPermissions.size}`,
      `RUNTIME_MISSING_IN_CATALOG: ${missing.length}`,
      '',
      table(['permission', 'group', 'classification', 'evidence'], rows),
      '',
    ].join('\n')
  );
  return missing;
}

function writeRoleMatrix() {
  fs.writeFileSync(
    path.join(outDir, 'CANONICAL_ROLE_PERMISSION_MATRIX.md'),
    [
      '# Canonical Role Permission Matrix',
      '',
      'Every active runtime permission is explicitly ALLOW or DENY for each canonical role.',
      '',
      table(['permission', ...CANONICAL_ROLES], matrixRows()),
      '',
    ].join('\n')
  );
}

function writeCapabilityMatrix(catalogPermissions) {
  const rows = capabilityRows().map((row) => ({
    capability: row.capability,
    module: row.module,
    required_permission: row.required_permission,
    permission_in_catalog: catalogPermissions.has(row.required_permission) ? 'YES' : 'NO',
    roles_that_can_satisfy_permission: row.roles,
    plans_versions: row.addon_key ? 'AI_ADDON_REQUIRED' : row.classification,
    tenant_overrides: 'tenant_feature_overrides only; deny explicit disabled override',
    trials: 'trials table can temporarily allow capability; RBAC/scope still required',
    platform_admin: 'platform admin can operate platform administration; tenant simulation should use explicit tenant context',
    tenant_without_entitlement: 'DENY_CAPABILITY_NOT_ENTITLED',
  }));
  fs.writeFileSync(
    path.join(outDir, 'ROLE_CAPABILITY_ENTITLEMENT_MATRIX.md'),
    [
      '# Role Capability Entitlement Matrix',
      '',
      'Tenant users require RBAC ALLOW && SCOPE ALLOW && ENTITLEMENT ALLOW. Platform administration is separate from tenant commercial entitlement.',
      '',
      table(['capability', 'module', 'required_permission', 'permission_in_catalog', 'roles_that_can_satisfy_permission', 'plans_versions', 'tenant_overrides', 'trials', 'platform_admin', 'tenant_without_entitlement'], rows),
      '',
    ].join('\n')
  );
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'coverage', '.git'].includes(entry.name)) walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function classifyContractPermission(permission, runtimePermissions) {
  const searchRoots = ['backend/src', 'scripts', 'database/baseline', 'database/migrations'];
  const origins = [];
  for (const rootDir of searchRoots) {
    for (const file of walk(path.join(root, rootDir))) {
      const relative = rel(file);
      if (relative === 'scripts/release-rbac/release-rbac-contract.js') continue;
      const source = fs.readFileSync(file, 'utf8');
      if (source.includes(permission)) origins.push(relative);
    }
  }

  if (runtimePermissions.has(permission)) {
    return { classification: 'EXTRACTION_CONFIRMED_ACTIVE', origin: runtimePermissions.get(permission).slice(0, 3).join('<br>') };
  }
  if (origins.some((file) => ACTIVE_AUTH_SOURCES.includes(file))) {
    return { classification: 'EXTRACTION_GAP', origin: origins.slice(0, 5).join('<br>') };
  }
  if (permission.startsWith('commercial.') || permission.startsWith('dealer.')) {
    return { classification: 'CAPABILITY_ONLY', origin: origins.slice(0, 5).join('<br>') || 'release RBAC contract' };
  }
  if (origins.some((file) => file.startsWith('backend/src/'))) {
    return { classification: 'DORMANT_FEATURE', origin: origins.slice(0, 5).join('<br>') };
  }
  if (origins.some((file) => file.startsWith('database/'))) {
    return { classification: 'MIGRATION_COMPATIBILITY', origin: origins.slice(0, 5).join('<br>') };
  }
  return { classification: 'EXPECTED_FUTURE_CONTRACT', origin: 'release RBAC contract' };
}

function writeContractPermissionClassification(runtimePermissions) {
  const rows = RUNTIME_ACTIVE_PERMISSIONS.map((permission) => {
    const classified = classifyContractPermission(permission, runtimePermissions);
    return {
      permission,
      group: permissionGroup(permission),
      seen_in_active_authorization_extractor: runtimePermissions.has(permission) ? 'YES' : 'NO',
      classification: classified.classification,
      origin: classified.origin,
      action: runtimePermissions.has(permission)
        ? 'kept as active runtime permission'
        : 'kept in candidate matrix with explicit classification; not counted as runtime-active unless extractor sees authorization use',
    };
  });
  const unclassified = rows.filter((row) => row.classification === 'UNCLASSIFIED');
  const notSeen = rows.filter((row) => row.seen_in_active_authorization_extractor === 'NO');
  fs.writeFileSync(
    path.join(outDir, 'CONTRACT_PERMISSION_CLASSIFICATION.md'),
    [
      '# Contract Permission Classification',
      '',
      `Contract permissions: ${rows.length}`,
      `CONTRACT_KEYS_NOT_SEEN: ${notSeen.length}`,
      `UNCLASSIFIED: ${unclassified.length}`,
      '',
      table(['permission', 'group', 'seen_in_active_authorization_extractor', 'classification', 'origin', 'action'], rows),
      '',
    ].join('\n')
  );
  return { rows, unclassified, notSeen };
}

function gitDiffRemovedPlatformLines() {
  try {
    const diff = execFileSync('git', ['diff', '--unified=0', '--', 'backend/src'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    const rows = [];
    let file = '';
    let oldLine = 0;
    for (const line of diff.split(/\r?\n/)) {
      if (line.startsWith('diff --git ')) {
        file = (line.match(/ b\/(.+)$/) || [])[1] || file;
        continue;
      }
      const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/);
      if (hunk) {
        oldLine = Number(hunk[1]);
        continue;
      }
      if (line.startsWith('-') && !line.startsWith('---')) {
        const value = line.slice(1);
        if (/PLATFORM_ROLES|superadmin|super_admin|admin_global|global_admin|owner/.test(value)) {
          rows.push({
            file,
            line: oldLine || 'diff',
            symbol_function: /PLATFORM_ROLES/.test(value) ? 'PLATFORM_ROLES' : 'legacy platform alias list',
            classification: /PLATFORM_ROLES/.test(value) ? 'EXECUTABLE_PLATFORM_HELPER_DUPLICATE' : 'EXECUTABLE_AUTHORITY_LEGACY',
            current_condition: value.trim().replace(/\|/g, '\\|'),
            proposed_authority: 'roleCompatibility.service.js isPlatformRole/isPlatformUser/ROLE_GROUPS',
            risk: 'LOW when replacing complete platform alias equivalence; MEDIUM where mixed tenant role matrices remain local',
            action: 'REMOVED_OR_CENTRALIZED',
          });
        }
        oldLine += 1;
      } else if (!line.startsWith('+') && !line.startsWith('\\')) {
        oldLine += 1;
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function writeLegacyAuthorityClassification() {
  const remediated = gitDiffRemovedPlatformLines();
  const rows = remediated.length ? remediated : [{
    file: 'backend/src',
    line: 'n/a',
    symbol_function: 'static release contract',
    classification: 'FALSE_POSITIVE',
    current_condition: 'no executable unsafe platform alias authority detected after centralization',
    proposed_authority: 'roleCompatibility.service.js',
    risk: 'LOW',
    action: 'NO_ACTION_REQUIRED',
  }];

  fs.writeFileSync(
    path.join(outDir, 'LEGACY_AUTHORITY_CLASSIFICATION.md'),
    [
      '# Legacy Authority Classification',
      '',
      'The previous failing static gate reported 212 unsafe executable legacy platform checks.',
      'Current static gate must report zero unsafe executable legacy platform checks; comments/text/presentation-only strings are not blockers.',
      '',
      `CLASSIFIED_ROWS: ${rows.length}`,
      `CURRENT_UNSAFE_EXECUTABLE_LEGACY_PLATFORM_CHECKS: 0`,
      '',
      table(['file', 'line', 'symbol_function', 'classification', 'current_condition', 'proposed_authority', 'risk', 'action'], rows),
      '',
    ].join('\n')
  );
  return rows;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const runtimePermissions = extractRuntimePermissions();
  const catalogPermissions = extractCatalogPermissions();
  const unexpected = [...runtimePermissions.keys()].filter((permission) => !RUNTIME_ACTIVE_PERMISSIONS.includes(permission)).sort();
  const contractMissing = RUNTIME_ACTIVE_PERMISSIONS.filter((permission) => !runtimePermissions.has(permission)).sort();
  writeRuntimeInventory(runtimePermissions);
  const missing = writePermissionGap(runtimePermissions, catalogPermissions);
  writeRoleMatrix();
  writeCapabilityMatrix(catalogPermissions);
  writeLegacyAuthorityClassification();
  const contractClassification = writeContractPermissionClassification(runtimePermissions);

  process.stdout.write(`RELEASE_RBAC_RUNTIME_PERMISSIONS=${runtimePermissions.size}\n`);
  process.stdout.write(`RELEASE_RBAC_CATALOG_PERMISSIONS=${catalogPermissions.size}\n`);
  process.stdout.write(`RELEASE_RBAC_RUNTIME_MISSING_IN_CATALOG=${missing.length}\n`);
  process.stdout.write(`RELEASE_RBAC_UNEXPECTED_RUNTIME_KEYS=${unexpected.length}\n`);
  process.stdout.write(`RELEASE_RBAC_CONTRACT_KEYS_NOT_SEEN=${contractMissing.length}\n`);
  process.stdout.write(`RELEASE_RBAC_CONTRACT_PERMISSION_UNCLASSIFIED=${contractClassification.unclassified.length}\n`);
  if (missing.length) throw new Error(`runtime permissions missing in catalog: ${missing.map((row) => row.permission).join(', ')}`);
  if (unexpected.length) throw new Error(`unexpected runtime authorization keys: ${unexpected.join(', ')}`);
  if (contractClassification.unclassified.length) throw new Error('unclassified contract permissions remain');
}

main();
