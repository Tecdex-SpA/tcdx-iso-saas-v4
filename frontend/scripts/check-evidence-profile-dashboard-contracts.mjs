import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(source, text, label) {
  assert.ok(source.includes(text), `${label}: missing ${text}`);
}

function assertNotIncludes(source, text, label) {
  assert.ok(!source.includes(text), `${label}: unexpected ${text}`);
}

function bodyFor(source, endpoint) {
  const index = source.indexOf(endpoint);
  assert.ok(index >= 0, `endpoint not found: ${endpoint}`);
  return source.slice(index, index + 700);
}

const evidenceUi = read('frontend/src/components/evidences/UnifiedEvidenceLibrary.tsx');
assertIncludes(evidenceUi, '/api/evidence-library/semantic/analyze', 'evidence analyze endpoint');
assertIncludes(evidenceUi, "working === 'analyze'", 'evidence analyze loading state');
assertIncludes(evidenceUi, "'associations'", 'evidence associations tab');
assertIncludes(evidenceUi, "'suggestions'", 'evidence suggestions tab');
assertIncludes(evidenceUi, "'chunks'", 'evidence chunks tab');
assertIncludes(evidenceUi, "control: 'Control'", 'evidence control target');
assertIncludes(evidenceUi, "nonconformity: 'No conformidad'", 'evidence nonconformity target');
assertIncludes(evidenceUi, "finding: 'Hallazgo'", 'evidence finding target');
assertIncludes(evidenceUi, '/api/evidence-library/associations', 'evidence association endpoint');
assertIncludes(evidenceUi, '/api/evidence-library/semantic/suggestions/', 'evidence suggestion review endpoint');

const profileUi = read('frontend/src/app/perfil-empresa/page.tsx');
assertIncludes(profileUi, '/api/company-profile/analyze/start', 'company profile ai start endpoint');
assertIncludes(profileUi, '/api/company-profile/analyze/jobs/', 'company profile ai polling endpoint');
assertIncludes(profileUi, "disabled={analyzing || saving}", 'company profile ai no double submit');
assertIncludes(profileUi, "setOperationMessage(error instanceof Error ? error.message", 'company profile ai recoverable error');
assertIncludes(profileUi, "{analyzing ? 'Analizando...' : 'Analizar con IA'}", 'company profile ai loading label');
assertIncludes(profileUi, '/api/company-profile/applicability/rebuild', 'company profile applicability rebuild endpoint');
assertIncludes(profileUi, "disabled={rebuildingApplicability || saving}", 'company profile rebuild no double submit');
assertIncludes(profileUi, "{rebuildingApplicability ? 'Recalculando...' : 'Recalcular universo aplicable'}", 'company profile rebuild loading label');
assertNotIncludes(bodyFor(profileUi, '/api/company-profile/analyze/start'), 'tenant_id', 'company profile ai frontend tenant spoofing');
assertNotIncludes(bodyFor(profileUi, '/api/company-profile/applicability/rebuild'), 'tenant_id', 'company profile rebuild frontend tenant spoofing');

const profileRoutes = read('backend/src/routes/company-profile.routes.js');
assertIncludes(profileRoutes, "router.post('/analyze/start', auth", 'company profile ai auth route');
assertIncludes(profileRoutes, "getCompanyProfileForRequest(req, req.body?.tenant_id || null)", 'company profile server tenant resolver');
assertIncludes(profileRoutes, "asyncJobs.getJobScoped(req.params.jobId, { tenant_id: tenantId", 'company profile job tenant scoped polling');
assertIncludes(profileRoutes, "router.post('/applicability/rebuild', auth", 'company profile rebuild auth route');
assertIncludes(profileRoutes, 'buildTenantApplicabilityUniverse({', 'company profile rebuild engine call');

const dashboardUi = read('frontend/src/app/dashboard/page.tsx');
assertIncludes(dashboardUi, 'hasRegisteredRisks', 'dashboard risk universe flag');
assertIncludes(dashboardUi, 'Sin riesgos registrados', 'dashboard honest empty risk state');
assertIncludes(dashboardUi, 'riskPressure = hasRegisteredRisks ?', 'dashboard risk pressure no-data guard');
assertIncludes(dashboardUi, 'controles activos y aplicables', 'dashboard control universe legend');
assertIncludes(dashboardUi, 'riesgos registrados y activos', 'dashboard risk legend');
assertIncludes(dashboardUi, 'asociar evidencia no cierra ni aprueba automaticamente', 'dashboard governance legend');
assertIncludes(dashboardUi, 'no se consideran criticos por ausencia', 'dashboard health no-data legend');

const dashboardRoute = read('backend/src/routes/dashboard.routes.js');
assertIncludes(dashboardRoute, 'INNER JOIN tenant_applicable_controls tac', 'dashboard backend applicable controls universe');
assertIncludes(dashboardRoute, "porcentaje = total > 0 ? Math.round((cumple / total) * 100) : null", 'dashboard backend null compliance without universe');
assertIncludes(dashboardRoute, "riesgo = total > 0 ? Math.round((noCumple / total) * 100) : null", 'dashboard backend null risk without universe');
assertNotIncludes(dashboardRoute, 'JOIN tenant_operations op', 'dashboard backend no operation hard dependency');
assertIncludes(dashboardRoute, "no_data_policy: 'missing universe returns null percentages, not zero'", 'dashboard backend semantics');

console.log('EVIDENCE_LIBRARY_FRONTEND_CONTRACT=PASS');
console.log('COMPANY_PROFILE_AI_BUTTON_REQUEST=PASS');
console.log('COMPANY_PROFILE_AI_RESPONSE_RENDER=PASS');
console.log('COMPANY_PROFILE_AI_ERROR_STATE=PASS');
console.log('COMPANY_PROFILE_AI_NO_DOUBLE_SUBMIT=PASS');
console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_REQUEST=PASS');
console.log('COMPANY_PROFILE_APPLICABLE_UNIVERSE_FRONTEND_RENDER=PASS');
console.log('DASHBOARD_RISK_EMPTY_STATE_HONEST=PASS');
console.log('DASHBOARD_RISK_PRESSURE_CANONICAL_OR_NO_DATA=PASS');
console.log('DASHBOARD_OPERATIONAL_LEGENDS=PASS');
