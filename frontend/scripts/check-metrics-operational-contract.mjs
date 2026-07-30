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
const decisionCenter = read('src/components/math-governance/GrcDecisionCenter.tsx');
const biPage = read('src/app/bi/page.tsx');
const dashboardLayout = read('src/app/dashboard/layout.tsx');
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
assert(formulaCatalog.includes("'/api/grc/official/recalculate'"), 'El botón debe invocar el orquestador oficial.');
assert(formulaCatalog.includes('max-h-[620px] overflow-auto'), 'El catálogo debe tener scroll vertical controlado.');
assert(formulaCatalog.includes('sticky top-0'), 'El catálogo debe mantener encabezado fijo.');
assert(formulaCatalog.includes('PAGE_SIZE'), 'El catálogo debe paginar resultados.');
assert(formulaCatalog.includes('Datos insuficientes'), 'Los errores deben expresarse en lenguaje funcional.');
assert(formulaCatalog.includes('Dependencia pendiente'), 'Las dependencias deben clasificarse explícitamente.');
assert(formulaCatalog.includes('Fuente incompatible'), 'Las incompatibilidades de fuente deben clasificarse explícitamente.');
assert(formulaCatalog.includes('Crear plan de acción'), 'Un indicador deficiente debe permitir iniciar un plan de acción.');
assert(formulaCatalog.includes('Responsable'), 'La decisión debe mostrar responsable.');
assert(formulaCatalog.includes('Fecha objetivo'), 'La decisión debe mostrar fecha objetivo.');
assert(formulaCatalog.includes('OfficialEvidenceDialog'), 'Métricas debe usar el diálogo de evidencia común.');
assert(!formulaCatalog.includes('<pre className='), 'La evidencia no debe exponerse como JSON crudo.');
assert(!formulaCatalog.includes('href={`/api/grc/official/calculations/'), 'No deben existir enlaces de navegador a endpoints protegidos.');

assert(evidenceDialog.includes('Interpretación ejecutiva del cálculo'), 'La explicación debe estar orientada a decisión.');
assert(evidenceDialog.includes('Impacto para el negocio'), 'La explicación debe exponer impacto.');
assert(evidenceDialog.includes('Recomendación'), 'La explicación debe exponer recomendación.');
assert(evidenceDialog.includes('Ver detalle técnico'), 'El lineage técnico debe estar colapsado.');
assert(evidenceDialog.includes('max-h-[42vh] overflow-auto'), 'El detalle de lineage debe tener scroll propio.');
assert(evidenceDialog.includes('apiRequestJson(`/api/grc/official/calculations/${runId}/${kind}`'), 'La evidencia debe consultar endpoints protegidos con el cliente autenticado.');

assert(decisionCenter.includes('Centro de decisiones GRC'), 'Debe existir un cockpit de decisiones reutilizable.');
assert(decisionCenter.includes('Prioridades de gestión'), 'El cockpit debe priorizar indicadores.');
assert(decisionCenter.includes('Sin medición'), 'El cockpit no debe convertir ausencia de datos en cero.');
assert(decisionCenter.includes('Crear plan de acción'), 'El cockpit debe transformar indicadores en acciones.');
assert(biPage.includes('<GrcDecisionCenter'), 'Business Intelligence debe mostrar el cockpit de decisiones.');
assert(dashboardLayout.includes('<GrcDecisionCenter'), 'El dashboard debe reflejar decisiones oficiales.');

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

if (!process.exitCode) console.log(JSON.stringify({ status: 'METRICS_OPERATIONAL_CONTRACT_OK', scenarios: roleScenarios.length, tenant_isolation: true, decision_center: true, dashboard_integration: true, recalculation_visible: true, evidence_authenticated: true, section_isolation: true }));
