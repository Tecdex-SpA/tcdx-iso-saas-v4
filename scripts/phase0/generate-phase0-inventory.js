#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const rel = (...parts) => path.join(root, ...parts);

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'artifacts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out.sort();
}

function read(file) { return fs.readFileSync(file, 'utf8'); }
function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function writeJson(file, value) { ensureDir(file); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function csvEscape(v) { if (v == null) return ''; const s = Array.isArray(v) ? v.join('; ') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function writeCsv(file, rows) {
  ensureDir(file);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  fs.writeFileSync(file, [headers.join(','), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))].join('\n') + '\n');
}

function toRoute(appFile) {
  let route = path.relative(rel('frontend/src/app'), appFile).replace(/\\/g, '/');
  route = route.replace(/\/page\.(tsx|ts|jsx|js)$/, '');
  route = route.replace(/^page\.(tsx|ts|jsx|js)$/, '');
  route = route.replace(/\([^/]+\)\//g, '');
  route = route.replace(/\[([^\]]+)\]/g, ':$1');
  route = route.replace(/^\/+|\/+$/g, '');
  return route ? `/${route}` : '/';
}

function titleFromRoute(route) {
  if (route === '/') return 'Inicio';
  return route.split('/').filter(Boolean).map(s => s.replace(/^:/, '').replace(/-/g, ' ')).join(' / ');
}

function domainFromRoute(route) {
  const first = route.split('/').filter(Boolean)[0] || 'root';
  if (['ia', 'ia-auditor', 'ia-compliance'].includes(first)) return 'ai';
  if (['exportes', 'reportes'].includes(first)) return 'reporting';
  if (['usuarios', 'configuracion', 'admin-saas', 'empresas', 'perfil', 'perfil-empresa'].includes(first)) return 'administration';
  if (['riesgos', 'matriz-riesgo', 'activos'].includes(first)) return 'risk';
  if (['evidencias', 'documentos'].includes(first)) return 'evidence';
  if (['auditorias', 'hallazgos', 'no-conformidades', 'cumplimiento-auditoria', 'diagnostico', 'controles', 'soa', 'ciclo-vida'].includes(first)) return 'compliance';
  return 'operations';
}

function resolveFrontendImport(fromFile, specifier) {
  let candidate;
  if (specifier.startsWith('@/')) candidate = rel('frontend/src', specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [
    candidate,
    ...['.tsx', '.ts', '.jsx', '.js'].map(ext => `${candidate}${ext}`),
    ...['index.tsx', 'index.ts', 'index.jsx', 'index.js'].map(name => path.join(candidate, name)),
  ];
  return candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}

function collectFrontendSources(entryFile) {
  const visited = new Set();
  const pending = [entryFile];
  const importPattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  while (pending.length) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const content = read(file);
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const resolved = resolveFrontendImport(file, match[1]);
      if (resolved && !visited.has(resolved)) pending.push(resolved);
    }
  }
  return Array.from(visited);
}

function apiFamiliesForSources(files) {
  const families = new Set();
  for (const file of files) {
    const content = read(file);
    const pattern = /\/(api\/)?([a-z0-9][a-z0-9-]*)(?=[/?`'"${])/gi;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const family = match[1] ? `/api/${match[2]}` : `/${match[2]}`;
      if (family.startsWith('/api/') || family === '/health') families.add(family);
    }
  }
  return families;
}

function readE2eCoverage() {
  const file = rel('config/phase0/e2e-capability-coverage.json');
  if (!fs.existsSync(file)) return new Map();
  const parsed = JSON.parse(read(file));
  return new Map((parsed.capabilities || []).map(item => [item.code, item]));
}

function normalizeJoin(prefix, routePath) {
  const left = String(prefix || '').replace(/\/+$/g, '');
  const right = String(routePath || '').replace(/^\/+|\/+$/g, '');
  if (!right) return left || '/';
  return `${left}/${right}`.replace(/\/+/g, '/');
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function parseAppMounts() {
  const appPath = rel('backend/src/app.js');
  const content = read(appPath);
  const routeRequires = new Map();
  const requirePattern = /const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g;
  let match;
  while ((match = requirePattern.exec(content)) !== null) {
    const variable = match[1];
    const routeFile = `backend/src/routes/${match[2].replace(/\.js$/, '')}.js`;
    routeRequires.set(variable, routeFile);
  }

  const globalAuthIndex = content.indexOf("app.use('/api', auth, enforceApiAccess)");
  const globalTenantIndex = content.indexOf("app.use('/api', enforceTenantRequestScope)");
  const mounts = [];
  const mountPattern = /app\.use\(\s*['"]([^'"]+)['"]\s*,([\s\S]*?)\)\s*;/g;
  while ((match = mountPattern.exec(content)) !== null) {
    const prefix = match[1];
    const args = match[2];
    const line = lineForIndex(content, match.index);
    for (const [variable, routeFile] of routeRequires.entries()) {
      const variablePattern = new RegExp(`(^|[^A-Za-z0-9_$])${variable}([^A-Za-z0-9_$]|$)`);
      if (!variablePattern.test(args)) continue;
      mounts.push({
        prefix,
        variable,
        routeFile,
        appFile: 'backend/src/app.js',
        appLine: line,
        mountedAfterGlobalAuth: globalAuthIndex >= 0 && match.index > globalAuthIndex && prefix.startsWith('/api'),
        mountedAfterTenantGuard: globalTenantIndex >= 0 && match.index > globalTenantIndex && prefix.startsWith('/api'),
        mountHasAuth: /\bauth\b|authenticate|requireAuth|verifyToken/i.test(args),
        mountHasRbac: /enforceApiAccess|requireRole|requirePermission|authorize|rbac|role/i.test(args),
        mountHasTenantGuard: /enforceTenantRequestScope|tenantScope/i.test(args),
      });
    }
  }
  return mounts;
}

const PUBLIC_ENDPOINTS = new Map([
  ['POST /api/auth/login', 'Login público controlado por rate limit y validación de credenciales.'],
  ['POST /api/auth/register', 'Registro público solo si ENABLE_PUBLIC_REGISTER=true; la ruta deniega por defecto.'],
  ['GET /', 'Health textual raíz sin datos tenant.'],
]);

const appMounts = parseAppMounts();
const mountsByRouteFile = appMounts.reduce((acc, mount) => {
  if (!acc.has(mount.routeFile)) acc.set(mount.routeFile, []);
  acc.get(mount.routeFile).push(mount);
  return acc;
}, new Map());

const routeFiles = walk(rel('frontend/src/app'), f => /\/page\.(tsx|ts|jsx|js)$/.test(f));
const e2eCoverage = readE2eCoverage();
const endpointRows = [];
const endpointPattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
for (const file of walk(rel('backend/src/routes'), f => /\.js$/.test(f))) {
  const content = read(file);
  const routeFile = path.relative(root, file);
  const mounts = mountsByRouteFile.get(routeFile) || [];
  let match;
  while ((match = endpointPattern.exec(content)) !== null) {
    const localWindow = content.slice(Math.max(0, match.index - 900), Math.min(content.length, match.index + 900));
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const fileScopeWindow = content.slice(0, Math.min(content.length, 14000));
    const localAuthSignal = /auth|authenticate|requireAuth|verifyToken/i.test(localWindow) || /router\.use\(\s*(auth|authenticate|authenticateHealth)/i.test(fileScopeWindow);
    const localRoleSignal = /requireRole|requirePermission|authorize|rbac|role|permission/i.test(localWindow);
    const localTenantSignal = /tenantScope|tenant_id|tenantId|req\.tenant|resolvedTenantId|tenant|resolveTenantScope|requireTenantForNonSuper|addTenantCondition/i.test(localWindow) || /resolveTenantScope|requireTenantForNonSuper|addTenantCondition/i.test(fileScopeWindow);
    const localAuditSignal = /audit|logEvent|auditLog/i.test(localWindow);
    const effectiveMounts = mounts.length ? mounts : [{ prefix: '', mountedAfterGlobalAuth: false, mountedAfterTenantGuard: false, mountHasAuth: false, mountHasRbac: false, mountHasTenantGuard: false, appFile: null, appLine: null }];
    for (const mount of effectiveMounts) {
      const fullPath = normalizeJoin(mount.prefix, routePath);
      const publicJustification = PUBLIC_ENDPOINTS.get(`${method} ${fullPath}`) || null;
      const inheritedAuthSignal = Boolean(mount.mountedAfterGlobalAuth || mount.mountHasAuth);
      const inheritedRoleSignal = Boolean(mount.mountedAfterGlobalAuth || mount.mountHasRbac);
      const inheritedTenantSignal = Boolean(mount.mountedAfterTenantGuard || mount.mountHasTenantGuard);
      endpointRows.push({
        method,
        routePath,
        fullPath,
        mountPrefix: mount.prefix || '',
        file: routeFile,
        routeLine: lineForIndex(content, match.index),
        appMountFile: mount.appFile,
        appMountLine: mount.appLine,
        publicEndpoint: Boolean(publicJustification),
        publicJustification,
        authMechanism: publicJustification ? 'public_exception' : inheritedAuthSignal ? 'global_api_auth_middleware' : localAuthSignal ? 'route_or_handler_auth_signal' : '',
        permissionMechanism: publicJustification ? 'public_exception' : inheritedRoleSignal ? 'global_enforce_api_access' : localRoleSignal ? 'route_or_handler_permission_signal' : '',
        tenantMechanism: publicJustification ? 'public_exception' : inheritedTenantSignal ? 'global_enforce_tenant_request_scope' : localTenantSignal ? 'route_or_handler_tenant_signal' : '',
        authSignal: Boolean(publicJustification || inheritedAuthSignal || localAuthSignal),
        roleSignal: Boolean(publicJustification || inheritedRoleSignal || localRoleSignal),
        tenantSignal: Boolean(publicJustification || inheritedTenantSignal || localTenantSignal),
        auditSignal: localAuditSignal,
      });
    }
  }
}

const capabilities = routeFiles.map(file => {
  const route = toRoute(file);
  const frontendSources = collectFrontendSources(file);
  const content = frontendSources.map(read).join('\n');
  const first = route.split('/').filter(Boolean)[0] || 'root';
  const apiFamilies = apiFamiliesForSources(frontendSources);
  const endpoints = endpointRows.filter(e =>
    e.file.includes(first)
    || e.fullPath.includes(`/${first}`)
    || e.routePath.includes(first)
    || Array.from(apiFamilies).some(family => e.fullPath === family || e.fullPath.startsWith(`${family}/`))
  );
  const explicitNonProductiveSignal = /PHASE0_NON_PRODUCTIVE\s*:\s*(true|beta|internal|disabled)/i.test(content);
  const code = route === '/' ? 'root.home' : route.replace(/^\//, '').replace(/[:/]+/g, '.').replace(/-/g, '_');
  const e2e = e2eCoverage.get(code);
  const frontendOnly = code === 'root.home' || code === 'empresas';
  const productive = !explicitNonProductiveSignal && (endpoints.length > 0 || frontendOnly);
  return {
    code,
    name: titleFromRoute(route),
    domain: domainFromRoute(route),
    description: `Capacidad visible derivada de la ruta ${route}.`,
    commercialState: productive ? 'productive' : 'disabled',
    runtimeState: productive ? 'productive' : 'disabled',
    visible: true,
    routePatterns: [route],
    actions: [],
    frontendComponents: frontendSources.map(source => path.relative(root, source)),
    backendEndpoints: endpoints.map(e => `${e.method} ${e.fullPath}`),
    backendContractRequired: !frontendOnly,
    services: [],
    databaseEntities: [],
    requiredPermissions: [],
    requiredRoles: [],
    tenantScope: domainFromRoute(route) !== 'root',
    organizationScope: false,
    unitScope: false,
    auditEvents: [],
    featureFlag: productive ? null : 'PHASE0_NON_PRODUCTIVE',
    jobs: [],
    exports: [],
    aiPrompts: [],
    aiModels: [],
    dependencies: [],
    testCoverage: { unit: false, integration: false, e2e: Boolean(e2e) },
    evidence: [
      'artifacts/fase-0/baseline/stack-inventory.txt',
      ...(e2e ? [e2e.testFile, e2e.scenario] : []),
    ],
    owner: 'TCDX ISO SaaS',
    notes: frontendOnly
      ? 'Ruta frontend de navegación o redirección sin contrato backend propio.'
      : endpoints.length
        ? 'Inventario estático enlazado por referencias API del árbol de componentes; requiere validación dinámica en VM.'
        : 'Capacidad deshabilitada por ausencia de contrato backend detectable.',
  };
});

const matrix = capabilities.map(c => ({
  capacidad: c.code,
  ruta: c.routePatterns[0],
  componente: c.frontendComponents[0],
  accion: 'view/action',
  metodoHTTP: c.backendEndpoints[0]?.split(' ')[0] || '',
  endpoint: c.backendEndpoints[0]?.slice(c.backendEndpoints[0].indexOf(' ') + 1) || '',
  validador: '',
  servicio: '',
  tablaEntidad: '',
  permiso: c.requiredPermissions.join(';'),
  rol: c.requiredRoles.join(';'),
  tenantScope: String(c.tenantScope),
  eventoAuditoria: c.auditEvents.join(';'),
  featureFlag: c.featureFlag || '',
  pruebaUnitaria: 'pending',
  pruebaIntegracion: 'pending',
  pruebaE2E: 'pending',
  estado: c.runtimeState,
  evidencia: c.evidence.join(';'),
}));

const authorization = endpointRows.map(e => ({
  role: '',
  permission: e.permissionMechanism || '',
  route: e.fullPath,
  action: `${e.method} ${e.fullPath}`,
  endpoint: e.fullPath,
  method: e.method,
  resource: path.basename(e.file, '.js'),
  dataScope: e.tenantSignal ? e.tenantMechanism : 'unknown',
  allowed: '',
  conditions: e.publicJustification || '',
  featureCapability: '',
  auditEvent: e.auditSignal ? 'audit-signal' : '',
  positiveTest: '',
  negativeTest: '',
  crossTenantTest: '',
  sourceFile: e.file,
  sourceLine: e.routeLine,
  appMountFile: e.appMountFile || '',
  appMountLine: e.appMountLine || '',
  authSignal: String(e.authSignal),
  roleSignal: String(e.roleSignal),
  tenantSignal: String(e.tenantSignal),
  authMechanism: e.authMechanism,
  permissionMechanism: e.permissionMechanism,
  tenantMechanism: e.tenantMechanism,
  publicEndpoint: String(e.publicEndpoint),
  publicJustification: e.publicJustification || '',
}));

writeJson('config/capabilities/catalog.json', { generatedAt: new Date().toISOString(), source: 'scripts/phase0/generate-phase0-inventory.js', capabilities });
writeJson('artifacts/fase-0/capability-matrix.json', { generatedAt: new Date().toISOString(), matrix });
writeCsv('artifacts/fase-0/capability-matrix.csv', matrix);
writeJson('config/security/authorization-matrix.json', { generatedAt: new Date().toISOString(), source: 'scripts/phase0/generate-phase0-inventory.js', authorization });
writeCsv('artifacts/fase-0/authorization-matrix.csv', authorization);

const summary = {
  routes: capabilities.length,
  backendEndpoints: endpointRows.length,
  capabilitiesWithoutEndpoint: capabilities.filter(c => c.runtimeState === 'productive' && c.backendEndpoints.length === 0 && !['root.home', 'empresas'].includes(c.code)).length,
  endpointsWithoutAuthSignal: endpointRows.filter(e => !e.authSignal).length,
  endpointsWithoutTenantSignal: endpointRows.filter(e => !e.tenantSignal).length,
  publicEndpoints: endpointRows.filter(e => e.publicEndpoint).length,
  endpointsProtectedByGlobalAuth: endpointRows.filter(e => e.authMechanism === 'global_api_auth_middleware').length,
  endpointsScopedByGlobalTenantGuard: endpointRows.filter(e => e.tenantMechanism === 'global_enforce_tenant_request_scope').length,
};
writeJson('artifacts/fase-0/inventory-summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
