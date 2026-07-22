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
function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function writeJson(file, value) { ensureDir(file); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function csvEscape(v) { if (v == null) return ''; const s = Array.isArray(v) ? v.join('; ') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function writeCsv(file, rows) {
  ensureDir(file);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  fs.writeFileSync(file, [headers.join(','), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))].join('\n') + '\n');
}

const routeFiles = walk(rel('frontend/src/app'), f => /\/page\.(tsx|ts|jsx|js)$/.test(f));
const endpointRows = [];
const endpointPattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
for (const file of walk(rel('backend/src/routes'), f => /\.js$/.test(f))) {
  const content = read(file);
  let match;
  while ((match = endpointPattern.exec(content)) !== null) {
    const window = content.slice(Math.max(0, match.index - 700), Math.min(content.length, match.index + 700));
    endpointRows.push({
      method: match[1].toUpperCase(),
      routePath: match[2],
      file: path.relative(root, file),
      authSignal: /auth|authenticate|requireAuth|verifyToken/i.test(window),
      roleSignal: /requireRole|requirePermission|authorize|rbac|role/i.test(window),
      tenantSignal: /tenantScope|tenant_id|tenantId|req\.tenant|tenant/i.test(window),
      auditSignal: /audit|logEvent|auditLog/i.test(window),
    });
  }
}

const capabilities = routeFiles.map(file => {
  const route = toRoute(file);
  const content = read(file);
  const first = route.split('/').filter(Boolean)[0] || 'root';
  const endpoints = endpointRows.filter(e => e.file.includes(first) || e.routePath.includes(first));
  const mockSignal = /\b(mock|placeholder|coming soon|pr[oó]ximamente|demo)\b/i.test(content);
  return {
    code: route === '/' ? 'root.home' : route.replace(/^\//, '').replace(/[:/]+/g, '.').replace(/-/g, '_'),
    name: titleFromRoute(route),
    domain: domainFromRoute(route),
    description: `Capacidad visible derivada de la ruta ${route}.`,
    commercialState: mockSignal || endpoints.length === 0 ? 'partial' : 'productive',
    runtimeState: mockSignal || endpoints.length === 0 ? 'partial' : 'productive',
    visible: true,
    routePatterns: [route],
    actions: [],
    frontendComponents: [path.relative(root, file)],
    backendEndpoints: endpoints.map(e => `${e.method} ${e.routePath}`),
    services: [],
    databaseEntities: [],
    requiredPermissions: [],
    requiredRoles: [],
    tenantScope: domainFromRoute(route) !== 'root',
    organizationScope: false,
    unitScope: false,
    auditEvents: [],
    featureFlag: null,
    jobs: [],
    exports: [],
    aiPrompts: [],
    aiModels: [],
    dependencies: [],
    testCoverage: { unit: false, integration: false, e2e: false },
    evidence: ['artifacts/fase-0/baseline/stack-inventory.txt'],
    owner: 'TCDX ISO SaaS',
    notes: endpoints.length ? 'Inventario estático; requiere validación dinámica de persistencia, autorización y auditoría.' : 'Sin endpoint detectado por heurística; no puede clasificarse como productiva sin revisión adicional.',
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
  role: '', permission: '', route: '', action: `${e.method} ${e.routePath}`, endpoint: e.routePath, method: e.method,
  resource: path.basename(e.file, '.js'), dataScope: e.tenantSignal ? 'tenant-signal' : 'unknown', allowed: '', conditions: '',
  featureCapability: '', auditEvent: e.auditSignal ? 'audit-signal' : '', positiveTest: '', negativeTest: '', crossTenantTest: '',
  sourceFile: e.file, authSignal: String(e.authSignal), roleSignal: String(e.roleSignal), tenantSignal: String(e.tenantSignal),
}));
writeJson('config/capabilities/catalog.json', { generatedAt: new Date().toISOString(), source: 'scripts/phase0/generate-phase0-inventory.js', capabilities });
writeJson('artifacts/fase-0/capability-matrix.json', { generatedAt: new Date().toISOString(), matrix });
writeCsv('artifacts/fase-0/capability-matrix.csv', matrix);
writeJson('config/security/authorization-matrix.json', { generatedAt: new Date().toISOString(), source: 'scripts/phase0/generate-phase0-inventory.js', authorization });
writeCsv('artifacts/fase-0/authorization-matrix.csv', authorization);
const summary = { routes: capabilities.length, backendEndpoints: endpointRows.length, capabilitiesWithoutEndpoint: capabilities.filter(c => c.backendEndpoints.length === 0).length, endpointsWithoutAuthSignal: endpointRows.filter(e => !e.authSignal).length, endpointsWithoutTenantSignal: endpointRows.filter(e => !e.tenantSignal).length };
writeJson('artifacts/fase-0/inventory-summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
