#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'artifacts/release-rbac');
const artifactPath = path.join(outDir, 'RESIDUAL_ROLE_AUTHORITY_CLASSIFICATION.md');

const filesToInspect = [
  'backend/src/middleware/rbac.middleware.js',
  'backend/src/middleware/auth.js',
  'backend/src/middleware/tenantScope.middleware.js',
  'backend/src/routes/admin-saas.routes.js',
  'backend/src/routes/ai-auditor.routes.js',
  'backend/src/routes/ai.routes.js',
  'backend/src/routes/audit-execution.routes.js',
  'backend/src/routes/audits.routes.js',
  'backend/src/routes/billing.routes.js',
  'backend/src/routes/controls.routes.js',
  'backend/src/routes/document-integrations.routes.js',
  'backend/src/routes/document-integrations-analysis.routes.js',
  'backend/src/routes/document-integrations-folders.routes.js',
  'backend/src/routes/document-integrations-google.routes.js',
  'backend/src/routes/document-integrations-sync.routes.js',
  'backend/src/routes/document-integrations-zoho.routes.js',
  'backend/src/routes/evidences.routes.js',
  'backend/src/routes/lifecycle.routes.js',
  'backend/src/routes/soa.routes.js',
  'backend/src/routes/users.routes.js',
  'backend/src/routes/quotes.routes.js',
  'backend/src/services/governance.service.js',
  'backend/src/services/grc/grcApprovalRules.js',
  'backend/src/services/grc/grc.service.js',
  'backend/src/services/grc/phase2.service.js',
  'backend/src/services/isoScopeRecommendation.service.js',
  'backend/src/services/isoRiskMatrix.service.js',
  'backend/src/services/reportBuilder.service.js',
  'frontend/src/app/auditorias/page.tsx',
  'frontend/src/app/ciclo-vida/page.tsx',
  'frontend/src/app/cotizador/page.tsx',
  'frontend/src/app/diagnostico/page.tsx',
  'frontend/src/app/exportes/page.tsx',
  'frontend/src/app/soa/page.tsx',
  'frontend/src/app/usuarios/page.tsx',
  'frontend/src/utils/auth.ts',
  'frontend/src/utils/mvpPermissions.ts',
  'frontend/src/components/acciones-recomendadas/utils.ts',
  'frontend/src/components/health/IsoHealthPageClient.tsx',
];

const categories = [
  'CENTRAL_AUTHORITY_CONSUMER',
  'PRESENTATION_ONLY',
  'BUSINESS_ROLE_SEMANTICS',
  'COMPATIBILITY_ONLY',
  'RESIDUAL_AUTHORIZATION_AUTHORITY',
];

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function getFunctionContext(source, index) {
  const before = source.slice(0, index);
  const match = before.match(/(?:function\s+([A-Za-z0-9_$]+)\s*\(|const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|router\.(get|post|put|patch|delete)\s*\(([^,\n]+))/g);
  if (!match || !match.length) return 'module-scope';
  return match[match.length - 1].replace(/\s+/g, ' ').slice(0, 120);
}

function classify(file, source, index, pattern) {
  const nearby = source.slice(Math.max(0, index - 260), index + 360);
  const base = {
    file,
    line: lineOf(source, index),
    pattern: pattern.replace(/\s+/g, ' ').slice(0, 180),
    context: getFunctionContext(source, index),
    decides: 'no',
    authority: 'n/a',
    action: 'classified',
    evidence: 'static context after final residual centralization',
  };

  if (/roleCompatibility\.service|ROLE_GROUPS|roleMatchesAny|is(?:Platform|TenantAdmin|Auditor|AreaOwner|Executive|Viewer|Dealer)(?:Role|User)?\(/.test(nearby)) {
    return {
      ...base,
      classification: 'CENTRAL_AUTHORITY_CONSUMER',
      decides: /return|if\s*\(|roles?:|read:|write:|can[A-Z]|ensureTenantAccess|allowedRoles/.test(nearby) ? 'yes' : 'no',
      authority: 'roleCompatibility.service.js + RBAC/scope/entitlement',
      action: 'uses central helper/family contract',
      evidence: 'nearby source delegates to central role helper or ROLE_GROUPS',
    };
  }

  if (
    /FEATURE_ACCESS|MVP_ROLE_COMPATIBILITY|PLATFORM_ROLES|PLATFORM_ROUTES|ADMIN_ROLES|AUDITOR_ROLES|AREA_OWNER_ROLES|EXECUTIVE_ROLES|VIEWER_ROLES|DEALER_ROLES|DEALER_ROUTES/.test(nearby) &&
    file.includes('mvpPermissions.ts')
  ) {
    return {
      ...base,
      classification: 'COMPATIBILITY_ONLY',
      authority: 'frontend mirror compatibility map',
      action: 'allowed only in frontend mirror registry',
      evidence: 'central frontend mirror registry, not backend authority',
    };
  }

  if (/ROLE_COMPATIBILITY|ROLE_GROUPS|PLATFORM_ROLE_KEYS|TENANT_ADMIN_ROLE_KEYS|AREA_OWNER_ROLE_KEYS|VIEWER_ROLE_KEYS/.test(nearby) && file.includes('roleCompatibility.service.js')) {
    return {
      ...base,
      classification: 'COMPATIBILITY_ONLY',
      authority: 'backend roleCompatibility.service.js',
      action: 'allowed only in canonical backend compatibility map',
      evidence: 'canonical alias registry',
    };
  }

  if (/internal_ai|partner|ejecutivo_cliente|dependencyRole|validRoles|approval|workflow|assignable|allowedRolesFor/.test(nearby)) {
    return {
      ...base,
      classification: 'BUSINESS_ROLE_SEMANTICS',
      decides: /return|if\s*\(|allowedRoles|validRoles|roles\.includes/.test(nearby) ? 'yes' : 'no',
      authority: 'domain workflow/assignment semantics, not platform alias authority',
      action: 'preserved as explicit business rule or uses central role family validation',
      evidence: 'non-platform role business semantics or service role outside user RBAC families',
    };
  }

  if (/copy\.|Help|Label|RoleOption|roleOptions|display|template|report|sanitizeUser|role:\s*row\.role|is_superadmin|isSuperAdmin:/.test(nearby)) {
    return {
      ...base,
      classification: 'PRESENTATION_ONLY',
      authority: 'presentation/data projection only',
      action: 'no auth change required',
      evidence: 'no access decision or mutation gate in local context',
    };
  }

  return {
    ...base,
    classification: 'RESIDUAL_AUTHORIZATION_AUTHORITY',
    decides: 'yes',
    authority: 'missing central authority',
    action: 'must centralize before release',
    evidence: 'role comparison/list appears to decide authorization without central helper context',
  };
}

function scanFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return [];
  const source = stripComments(fs.readFileSync(full, 'utf8'));
  const patterns = [
    /\b(?:role|currentRole|userRole|normalizedRole)\s*(?:={2,3}|!==|!=)\s*['"][a-z_]+['"]/g,
    /\[[^\]\n]*(?:'superadmin'|'super_admin'|'global_admin'|'admin_global'|'owner'|'admin'|'tenant_admin'|'auditor'|'operativo'|'viewer'|'dealer'|'read_only'|'readonly'|'solo_lectura'|'cliente'|'client'|'ejecutivo')[^\]\n]*\]\.includes\([^)]*(?:role|currentRole|userRole|normalizedRole)/g,
    /\b(?:function|const)\s+(?:isSuperAdmin|isTenantAdmin|isOperativo|isReadOnly|isAdmin|isAuditor|isViewer|isPlatformRole|isPlatformUserRole)[A-Za-z0-9_$]*\b/g,
    /\b(?:const|let|var)\s+(?:PLATFORM|ADMIN|AUDITOR|AREA|EXECUTIVE|VIEWER|READ_ONLY|DEALER)[A-Z0-9_]*\s*=\s*(?:new\s+Set\()?\s*\[/g,
  ];

  const rows = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      rows.push(classify(file, source, match.index, match[0]));
    }
  }
  return rows;
}

function table(rows) {
  const headers = ['file', 'line', 'pattern', 'context', 'classification', 'decides', 'authority', 'action', 'evidence'];
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const rows = filesToInspect.flatMap(scanFile);
  const counts = Object.fromEntries(categories.map((category) => [category, 0]));
  for (const row of rows) counts[row.classification] += 1;

  const unclassified = rows.filter((row) => !categories.includes(row.classification));
  const residual = rows.filter((row) => row.classification === 'RESIDUAL_AUTHORIZATION_AUTHORITY');

  fs.writeFileSync(
    artifactPath,
    [
      '# Residual Role Authority Classification',
      '',
      'Generated by `scripts/release-rbac/check-residual-role-authority.js` from the human-review bundle patterns and current code.',
      '',
      '## Counts',
      '',
      ...categories.map((category) => `${category}=${counts[category]}`),
      `UNCLASSIFIED_ROLE_CHECKS=${unclassified.length}`,
      '',
      '## Findings',
      '',
      rows.length ? table(rows) : '_No residual role-authority candidates detected._',
      '',
    ].join('\n')
  );

  assert.equal(residual.length, 0, `residual authorization authority remains:\n${residual.map((row) => `${row.file}:${row.line}:${row.pattern}`).join('\n')}`);
  assert.equal(unclassified.length, 0, 'unclassified role checks remain');

  console.log(`RESIDUAL_AUTHORIZATION_AUTHORITY=${residual.length}`);
  console.log(`UNCLASSIFIED_ROLE_CHECKS=${unclassified.length}`);
  console.log(`RESIDUAL_ROLE_AUTHORITY_CLASSIFICATION=${artifactPath}`);
}

main();
