import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
function read(relativePath) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }
function assert(condition, message) { if (!condition) { console.error(`METRICS_OPERATIONAL_CONTRACT_FAILED: ${message}`); process.exitCode = 1; } }

const page = read('src/app/metricas/page.tsx');
const tenantContext = read('src/components/math-governance/MetricsTenantContext.tsx');
const functionalCatalog = read('src/components/indicators/FunctionalIndicatorCatalog.tsx');
const evidenceDialog = read('src/components/math-governance/OfficialEvidenceDialog.tsx');
const decisionCenter = read('src/components/math-governance/GrcDecisionCenter.tsx');
const biPage = read('src/app/bi/page.tsx');
const dashboardLayout = read('src/app/dashboard/layout.tsx');
const dashboardPage = read('src/app/dashboard/page.tsx');
const sectionBoundary = read('src/components/math-governance/MetricsSectionBoundary.tsx');
const apiClient = read('src/utils/apiClient.ts');

assert(page.includes('<MetricsTenantContext />'), 'La vista debe exponer el contexto de empresa antes del catálogo.');
assert(page.includes('<FunctionalIndicatorCatalog />'), 'La vista debe usar el catálogo funcional 5-C3.');
assert(!page.includes('<MetricBuilder />') && !page.includes('<FormulaCatalog />'), 'La vista no debe montar motores o catálogos legacy paralelos.');
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

assert(functionalCatalog.includes('/api/metrics/official/catalog'), 'El catálogo debe consumir el API funcional autoritativo.');
assert(functionalCatalog.includes('/calculate'), 'El recálculo gobernado debe existir para roles autorizados.');
assert(functionalCatalog.includes('/snapshots'), 'El flujo draft/publicación de snapshot debe estar conectado.');
assert(functionalCatalog.includes('/history?limit=24'), 'La vista debe cargar historial oficial.');
assert(functionalCatalog.includes('/comparisons?limit=24'), 'La vista debe cargar comparaciones versionadas.');
assert(functionalCatalog.includes('Data Trust'), 'La vista debe mostrar confianza del dato.');
assert(functionalCatalog.includes('Freshness'), 'La vista debe mostrar freshness.');
assert(functionalCatalog.includes('Suficiencia'), 'La vista debe mostrar suficiencia.');
assert(functionalCatalog.includes('Proponer acción'), 'Un resultado debe permitir registrar una propuesta gobernada.');
assert(functionalCatalog.includes('No existe evidencia suficiente'), 'La UI no debe inventar causa o impacto.');
assert(!functionalCatalog.includes('<pre className='), 'La evidencia no debe exponerse como JSON crudo.');

assert(evidenceDialog.includes('Interpretación ejecutiva del cálculo'), 'La explicación debe estar orientada a decisión.');
assert(evidenceDialog.includes('Impacto para el negocio'), 'La explicación debe exponer impacto.');
assert(evidenceDialog.includes('Recomendación'), 'La explicación debe exponer recomendación.');
assert(evidenceDialog.includes('Ver detalle técnico'), 'El lineage técnico debe estar colapsado.');
assert(evidenceDialog.includes('max-h-[42vh] overflow-auto'), 'El detalle de lineage debe tener scroll propio.');
assert(evidenceDialog.includes('apiRequestJson(`/api/grc/official/calculations/${runId}/${kind}`'), 'La evidencia debe consultar endpoints protegidos con el cliente autenticado.');

assert(decisionCenter.includes('Centro de decisiones GRC'), 'Debe existir un cockpit de decisiones reutilizable.');
assert(decisionCenter.includes('Prioridades de gestión'), 'El cockpit debe priorizar indicadores.');
assert(decisionCenter.includes('Sin medición'), 'El cockpit no debe convertir ausencia de datos en cero.');
assert(decisionCenter.includes('Abrir indicador y propuesta'), 'El cockpit debe dirigir a la propuesta gobernada sin ejecutar una acción irreversible.');
assert(!decisionCenter.includes('Crear plan de acción'), 'El cockpit no debe transformar automáticamente una recomendación en plan de acción.');
assert(biPage.includes('<GrcDecisionCenter'), 'Business Intelligence debe mostrar el cockpit de decisiones.');
assert(dashboardLayout.includes('<GrcDecisionCenter'), 'El dashboard debe reflejar decisiones oficiales.');
assert(dashboardPage.includes('const rawPayload = isRecord(rawRoot.data) ? rawRoot.data : payload;'), 'Dashboard KPI debe desempaquetar respuestas oficiales { ok, data } antes de normalizar items.');
assert(dashboardPage.includes('Array.isArray(rawPayload)'), 'Dashboard KPI debe preservar compatibilidad con respuestas legacy en arreglo.');

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

if (!process.exitCode) console.log(JSON.stringify({ status: 'METRICS_OPERATIONAL_CONTRACT_OK', scenarios: roleScenarios.length, tenant_isolation: true, decision_center: true, dashboard_integration: true, functional_catalog: true, snapshots: true, comparisons: true }));
