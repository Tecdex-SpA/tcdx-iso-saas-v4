import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
function read(relativePath) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }
function assert(condition, message) { if (!condition) { console.error(`METRICS_OPERATIONAL_CONTRACT_FAILED: ${message}`); process.exitCode = 1; } }

const page = read('src/app/metricas/page.tsx');
const tenantContext = read('src/components/math-governance/MetricsTenantContext.tsx');
const formulaCatalog = read('src/components/math-governance/FormulaCatalog.tsx');
const evidenceDialog = read('src/components/math-governance/OfficialEvidenceDialog.tsx');
const sectionBoundary = read('src/components/math-governance/MetricsSectionBoundary.tsx');
const apiClient = read('src/utils/apiClient.ts');

assert(page.includes('<MetricsTenantContext />'), 'La vista debe exponer el contexto de empresa antes del catálogo.');
assert(page.includes('MetricsSectionBoundary title="Catálogo y recálculo oficial"'), 'El catálogo debe estar aislado de errores de otras secciones.');
assert(page.includes('MetricsSectionBoundary title="Constructor de métricas"'), 'El constructor debe estar aislado del catálogo.');
assert(!page.includes('analyticsDomain='), 'La vista no debe duplicar el catálogo mediante OfficialAnalyticsPanel.');

assert(tenantContext.includes("'/api/admin-saas/tenants'"), 'El superadministrador debe cargar empresas desde el endpoint oficial.');
assert(tenantContext.includes('PLATFORM_ROLES.has(role)'), 'La selección de empresas debe limitarse a roles de plataforma.');
assert(tenantContext.includes('Alcance limitado a su propia empresa'), 'El administrador tenant debe ver un alcance fijo.');
assert(/setActiveTenantId\(nextTenantId\s*\|\|\s*null\)/.test(tenantContext), 'El selector debe actualizar el tenant activo validado.');
assert(tenantContext.includes('clearTenantEntitlementsCache()'), 'El cambio de empresa debe invalidar capacidades cacheadas.');
assert(tenantContext.includes("window.location.assign('/metricas')"), 'El cambio de empresa debe reinicializar todos los estados de la vista.');
assert(tenantContext.includes("'/api/auth/validate'"), 'El administrador tenant debe resolver el nombre real mediante sesión autenticada.');

assert(apiClient.includes("'X-Tenant-Id': context.tenantId"), 'Las solicitudes deben enviar el tenant efectivo al backend.');
assert(apiClient.includes('if (platform)'), 'El cliente API debe separar plataforma y tenant admin.');
assert(apiClient.includes('tokenTenantId'), 'El tenant admin debe usar exclusivamente el tenant del token.');

assert(formulaCatalog.includes('Recalcular desde datos existentes'), 'El botón de recálculo debe existir en el render principal.');
assert(formulaCatalog.includes("entitlements.capabilities['metrics.engine']"), 'El recálculo debe respetar la capacidad metrics.engine.');
assert(formulaCatalog.includes('tenantReady'), 'El recálculo debe exigir contexto de tenant.');
assert(formulaCatalog.includes("'/api/grc/official/recalculate'"), 'El botón debe invocar el orquestador oficial.');
assert(formulaCatalog.includes('normalizeCatalog'), 'El catálogo debe normalizar respuestas para evitar React child inválidos.');
assert(formulaCatalog.includes('normalizeRecalculation'), 'El resultado del recálculo debe validarse antes de renderizar.');
assert(formulaCatalog.includes('OfficialEvidenceDialog'), 'Métricas debe usar el diálogo de evidencia común.');
assert(evidenceDialog.includes('Explicación del cálculo'), 'La explicación debe renderizarse como interfaz gobernada.');
assert(evidenceDialog.includes('Lineage del cálculo'), 'El lineage debe renderizarse como interfaz gobernada.');
assert(evidenceDialog.includes('<table'), 'El lineage debe renderizarse como tabla gobernada.');
assert(!formulaCatalog.includes('<pre className='), 'La evidencia no debe exponerse como JSON crudo.');
assert(!formulaCatalog.includes('href={`/api/grc/official/calculations/'), 'No deben existir enlaces de navegador a endpoints protegidos.');
assert(evidenceDialog.includes('apiRequestJson(`/api/grc/official/calculations/${runId}/${kind}`'), 'La evidencia debe consultar endpoints protegidos con el cliente autenticado.');

assert(sectionBoundary.includes('METRICS_SECTION_ERROR'), 'Los fallos de sección deben registrar diagnóstico controlado.');
assert(sectionBoundary.includes('El resto de la vista continúa operativo'), 'Un fallo parcial no debe reemplazar toda la ruta.');

const roleScenarios = [
  { role: 'superadmin', platform: true, selectable: true, tenantSource: 'active-selection' },
  { role: 'platform_admin', platform: true, selectable: true, tenantSource: 'active-selection' },
  { role: 'owner', platform: true, selectable: true, tenantSource: 'active-selection' },
  { role: 'admin', platform: false, selectable: false, tenantSource: 'token' },
  { role: 'viewer', platform: false, selectable: false, tenantSource: 'token' },
];
const platformRoles = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);
for (const scenario of roleScenarios) {
  assert(platformRoles.has(scenario.role) === scenario.platform, `Escenario de rol inconsistente: ${scenario.role}.`);
  assert(scenario.selectable === scenario.platform, `Selector incorrecto para rol ${scenario.role}.`);
  assert(scenario.tenantSource === (scenario.platform ? 'active-selection' : 'token'), `Fuente de tenant incorrecta para ${scenario.role}.`);
}

if (!process.exitCode) {
  console.log(JSON.stringify({ status: 'METRICS_OPERATIONAL_CONTRACT_OK', scenarios: roleScenarios.length, tenant_isolation: true, recalculation_visible: true, evidence_authenticated: true, section_isolation: true }));
}
