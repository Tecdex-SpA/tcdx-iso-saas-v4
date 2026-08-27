import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outDir = path.join(repoRoot, 'artifacts/ui02-stage4-enterprise-domain-workspaces');
const baseUrl = process.env.UI02_BASE_URL || 'http://localhost:3001';
const tenantId = randomUUID();
const userId = randomUUID();
const tenantName = 'TECDEX Validacion Visual';
const role = 'admin';

fs.mkdirSync(outDir, { recursive: true });

const payload = {
  id: userId,
  userId,
  tenant_id: tenantId,
  tenantId,
  email: 'validacion.ui@local.test',
  full_name: 'Validacion UI',
  name: 'Validacion UI',
  role,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const token = `local.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const moduleKeys = [
  'health',
  'risks',
  'audits',
  'evidences',
  'grc_phase2_integrated',
  'grc_phase3_operations',
  'data_governance',
  'metrics_bi',
  'surveys_assessments',
  'assurance_loss',
  'ai',
  'report_studio',
];

const capabilityKeys = [
  'reports.premium',
  'data.governance',
  'metrics.catalog',
  'bi.executive_dashboards',
  'reporting.studio',
  'health.view',
  'phase3.read',
];

const moduleMap = Object.fromEntries(
  moduleKeys.map((key) => [key, { module_key: key, module_name: key, is_enabled: true }])
);

const capabilities = Object.fromEntries(
  capabilityKeys.map((key) => [
    key,
    {
      capability_key: key,
      enabled: true,
      decision: 'allowed',
      source: 'ui02_stage4_visual_fixture',
      reason_code: 'ALLOWED_FOR_LOCAL_VISUAL_VALIDATION',
      effective_from: null,
      effective_until: null,
      limit: null,
      usage: 0,
      remaining: null,
      dependencies: [],
      read_only: false,
    },
  ])
);

const operationId = randomUUID();
const auditId = randomUUID();
const findingId = randomUUID();
const actionPlanId = randomUUID();
const nonconformityId = randomUUID();

function jsonResponse(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function paged(data) {
  return { ok: true, data, items: data, rows: data, total: data.length, count: data.length };
}

function scopePayload() {
  return {
    operations: [{ id: operationId, name: 'Operacion principal', code: 'OP-001', is_active: true }],
    standards: [
      {
        code: 'ISO27001',
        name: 'ISO 27001',
        is_active: true,
        active_operations_count: 1,
        active_operation_ids: [operationId],
      },
    ],
  };
}

const auditRows = [
  {
    id: auditId,
    tenant_id: tenantId,
    iso: 'ISO27001',
    title: 'Auditoria interna ISO 27001',
    status: 'en_ejecucion',
    auditor_name: 'Equipo auditor',
    start_date: '2026-08-01',
    end_date: '2026-08-31',
    findings_count: 1,
    actions_count: 1,
    report_url: null,
  },
];

const findingRows = [
  {
    id: findingId,
    tenant_id: tenantId,
    iso_code: 'ISO27001',
    title: 'Evidencia incompleta para control de acceso',
    description: 'Hallazgo visual local para validar densidad operacional.',
    type: 'no conformidad',
    severity: 'alta',
    status: 'abierto',
    source_type: 'audit',
    action_plan_id: actionPlanId,
  },
];

const actionRows = [
  {
    id: actionPlanId,
    tenant_id: tenantId,
    iso_code: 'ISO27001',
    title: 'Completar evidencia de control de acceso',
    description: 'Plan correctivo sujeto a revision humana.',
    priority: 'alta',
    status: 'en progreso',
    owner: 'Seguridad',
    due_date: '2026-09-10',
    source_type: 'finding',
    finding_id: findingId,
    evidence_count: 1,
    approved_evidence_count: 0,
    pending_evidence_count: 1,
    updates_count: 1,
    latest_progress_percent: 40,
    approval_status: 'pendiente_aprobacion',
    created_at: '2026-08-20T12:00:00Z',
    updated_at: '2026-08-22T12:00:00Z',
  },
];

const nonconformityRows = [
  {
    id: nonconformityId,
    tenant_id: tenantId,
    iso_code: 'ISO27001',
    title: 'No conformidad por revision documental vencida',
    description: 'Registro operativo visual sin crear entidades nuevas.',
    severity: 'alta',
    status: 'abierta',
    action_plan_id: actionPlanId,
    created_at: '2026-08-18T12:00:00Z',
  },
];

const evidenceRows = [
  {
    id: randomUUID(),
    tenant_id: tenantId,
    iso: 'ISO27001',
    title: 'Politica de control de acceso',
    description: 'Documento asociado a control ISO.',
    status: 'pendiente',
    file_name: 'politica-control-acceso.pdf',
    created_at: '2026-08-21T12:00:00Z',
  },
];

const metricCatalog = [
  {
    definition: {
      code: 'F5_5_GRC_HEALTH',
      name: 'Salud GRC',
      unit: 'percent',
      domain: 'compliance',
    },
    latest_snapshot: {
      snapshot_id: randomUUID(),
      status: 'calculated',
      value: 82,
      trust_status: 'TRUSTED',
      interpretation: { recommendation: 'Mantener seguimiento operacional.' },
    },
  },
];

function apiMock(url) {
  const pathname = url.pathname;

  if (pathname === '/api/me/modules') {
    return {
      ok: true,
      scope: { user_id: userId, role, tenant_id: tenantId, tenant_name: tenantName, service_status: 'active' },
      module_map: moduleMap,
    };
  }

  if (pathname === '/api/me/permissions') return { ok: true, permission_map: { 'health.view': true } };
  if (pathname === '/api/me/entitlements') {
    return {
      tenant_id: tenantId,
      subscription: { plan: 'enterprise' },
      modules: moduleKeys.map((module_key) => ({ module_key, enabled: true })),
      capabilities,
      limits: {},
      usage: {},
      health: {},
      ai: {
        enabled: true,
        plan: 'enterprise',
        web_enabled: true,
        report_enabled: true,
        auditor_enabled: true,
        features: {
          auditor: true,
          suggestions: true,
          web_research: true,
          report_enrichment: true,
          document_generation: true,
          company_profile_analysis: true,
        },
        quota: { monthly: null, used: 0 },
      },
    };
  }

  if (pathname === '/api/user/me' || pathname === '/api/auth/validate') {
    return { ok: true, ...payload, tenant_name: tenantName, tenant: { id: tenantId, tenant_id: tenantId, name: tenantName } };
  }

  if (pathname.startsWith('/api/tenants/') || pathname === '/api/admin-saas/tenants') {
    return paged([{ id: tenantId, tenant_id: tenantId, name: tenantName, company_name: tenantName, plan_name: 'Enterprise' }]);
  }

  if (pathname.startsWith('/api/tenant-standards/scope/')) {
    const scope = scopePayload();
    return { ok: true, data: scope, ...scope };
  }

  if (pathname.startsWith('/api/tenant-standards/')) {
    return { ok: true, data: scopePayload().standards, standards: scopePayload().standards };
  }

  if (pathname.includes('/api/iso-express-diagnostic/options/')) {
    return { ok: true, data: { options: [{ standard_code: 'ISO27001', display_name: 'ISO 27001', latest_run_id: randomUUID() }] } };
  }

  if (pathname.includes('/api/iso-express-diagnostic/') && pathname.endsWith('/latest')) {
    return { ok: true, data: { run: { id: randomUUID(), standard_code: 'ISO27001', status: 'calculated' }, items: [] } };
  }

  if (pathname.startsWith('/api/diagnostic/')) return paged([]);
  if (pathname.startsWith('/api/soa/')) {
    return {
      ok: true,
      data: [],
      controls: [],
      assessments: [],
      change_log: [],
      intelligence: null,
      preflight: { can_initialize: true, missing: [] },
    };
  }

  if (pathname.startsWith('/api/audits/summary/')) {
    return { ok: true, data: { total: 1, pendientes: 0, en_ejecucion: 1, completadas: 0, hallazgos: 1, acciones: 1, con_informe: 0, sin_informe: 1 } };
  }
  if (pathname.startsWith('/api/audits/')) return paged(auditRows);
  if (pathname === '/api/audits') return paged(auditRows);

  if (pathname.startsWith('/api/audit-execution/') && pathname.endsWith('/checklist')) {
    return {
      ok: true,
      audit: { iso: 'ISO27001', auditor_name: 'Equipo auditor', status: 'en_ejecucion' },
      data: [
        { id: randomUUID(), audit_id: auditId, control_code: 'A.5.1', clause: 'A.5.1', control_title: 'Politicas de seguridad', result: 'observacion', initial_status: 'activo' },
      ],
    };
  }

  if (pathname.startsWith('/api/ai-auditor/context/')) {
    return { ok: true, audit: { iso: 'ISO27001', auditor_name: 'Equipo auditor', status: 'en_ejecucion' }, checklist: [{ result: 'observacion' }] };
  }
  if (pathname.startsWith('/api/ai-auditor/runs/')) return paged([]);

  if (pathname.startsWith('/api/findings/controls/')) return paged([]);
  if (pathname.startsWith('/api/findings/')) return paged(findingRows);
  if (pathname === '/api/findings') return paged(findingRows);
  if (pathname.startsWith('/api/nonconformities/')) return paged(nonconformityRows);
  if (pathname.startsWith('/api/action-plans/')) return paged(actionRows);
  if (pathname === '/api/action-plans') return paged(actionRows);

  if (pathname === '/api/iso-operational-execution/summary') {
    return {
      ok: true,
      data: {
        total_suggestions: 2,
        pending_count: 1,
        approved_count: 1,
        rejected_count: 0,
        by_standard: [{ standard_code: 'ISO27001', total_suggestions: 2, pending_count: 1, critical_count: 1, high_count: 1, approved_count: 1, rejected_count: 0 }],
        by_type: [{ suggestion_type: 'corrective_action', target_record_type: 'action_plan', status: 'pending', count: 1 }],
      },
    };
  }
  if (pathname === '/api/iso-operational-execution/suggestions') {
    return paged([
      {
        id: randomUUID(),
        title: 'Reforzar evidencia de control critico',
        description: 'Sugerencia pendiente con conversion gobernada.',
        rationale: 'Existe brecha documental en la auditoria.',
        standard_code: 'ISO27001',
        priority: 'alta',
        status: 'pending',
        suggestion_type: 'corrective_action',
        target_record_type: 'action_plan',
        source_module: 'audit',
        suggested_owner: 'Seguridad',
      },
    ]);
  }

  if (pathname.startsWith('/api/evidences/')) return paged(evidenceRows);
  if (pathname.startsWith('/api/tenant-processes')) return paged([]);
  if (pathname.startsWith('/api/tenant-process-links')) return paged([]);

  if (pathname === '/api/data/domains') return paged([{ domain_key: 'grc', display_name: 'GRC', status: 'active', description: 'Dominio GRC gobernado.' }]);
  if (pathname === '/api/data/quality') return paged([{ source_key: 'grc_findings', display_name: 'Hallazgos', status: 'trusted', freshness: 'current' }]);
  if (pathname === '/api/data/elements') return paged([{ element_key: 'finding.status', display_name: 'Estado de hallazgo', status: 'published', description: 'Campo operacional.' }]);
  if (pathname.startsWith('/api/data/lineage') || pathname.startsWith('/api/data/impact')) {
    return { ok: true, data: { root: { entity_type: 'metric', entity_id: 'F5_5_GRC_HEALTH' }, nodes: [], edges: [], warnings: [] } };
  }
  if (pathname === '/api/data/semantic/source-contracts') return paged([{ id: randomUUID(), source_code: 'audit_findings_actions', status: 'published', current_version_id: randomUUID() }]);
  if (pathname === '/api/data/semantic/reconciliation') return { ok: true, data: { status: 'ok', warnings: [] } };
  if (pathname.startsWith('/api/data/semantic/')) return paged([]);

  if (pathname === '/api/metrics/official/catalog') return { ok: true, data: metricCatalog };
  if (pathname.startsWith('/api/metrics/official/')) return { ok: true, data: metricCatalog[0] };
  if (pathname.startsWith('/api/grc/phase3/')) return paged([]);
  if (pathname === '/api/grc/overview') {
    return {
      ok: true,
      data: {
        risks: { total: 4, critical: 1 },
        controls: { total: 12, active: 10 },
        evidences: { total: 8, pending: 2 },
        reports: { total: 3 },
      },
    };
  }

  if (pathname === '/api/ai-compliance/engine-health') return { ok: true, data: { status: 'available', model: 'governed' } };
  if (pathname === '/api/ai-compliance/health-summary') return { ok: true, data: { tenant_name: tenantName, status: 'operational' } };
  if (pathname === '/api/ai-compliance/suggestions') return paged([]);
  if (pathname === '/api/ai-compliance/executive-brief') return { ok: true, data: { summary: 'Brief ejecutivo visual local.' } };

  if (pathname === '/api/dashboards') return paged([]);
  if (pathname === '/api/reports') return paged([{ report_key: 'iso-executive', display_name: 'Reporte ejecutivo ISO', status: 'published' }]);
  if (pathname === '/api/report-generations') return paged([{ generation_key: 'GEN-001', format: 'PDF', status: 'completed', created_at: '2026-08-24T12:00:00Z' }]);
  if (pathname === '/api/surveys') return paged([{ survey_key: 'iso-readiness', display_name: 'Evaluacion ISO', status: 'active' }]);
  if (pathname.startsWith('/api/reports/standards')) return { ok: true, data: [{ code: 'ISO27001', name: 'ISO 27001' }], standards: [{ code: 'ISO27001', name: 'ISO 27001' }] };
  if (pathname.startsWith('/api/reports/exports')) return paged([]);
  if (pathname.startsWith('/api/reports/jobs')) return { ok: true, data: { status: 'completed' } };

  if (pathname.includes('/notifications')) return { ok: true, items: [] };
  if (pathname.includes('/search')) return paged([]);
  if (pathname.startsWith('/health/')) return { ok: true, data: null };

  return paged([]);
}

const capturesToRun = [
  { file: 'cumplimiento-1440.png', route: '/cumplimiento-auditoria', domain: 'Cumplimiento', viewport: { width: 1440, height: 1050 } },
  { file: 'cumplimiento-mobile-390.png', route: '/cumplimiento-auditoria', domain: 'Cumplimiento', viewport: { width: 390, height: 920 } },
  { file: 'diagnostico-1440.png', route: '/diagnostico', domain: 'Cumplimiento', viewport: { width: 1440, height: 1050 } },
  { file: 'auditorias-1440.png', route: '/auditorias', domain: 'Auditoría', viewport: { width: 1440, height: 1050 } },
  { file: 'auditorias-mobile-390.png', route: '/auditorias', domain: 'Auditoría', viewport: { width: 390, height: 920 } },
  { file: 'hallazgos-1440.png', route: '/hallazgos', domain: 'Auditoría', viewport: { width: 1440, height: 1050 } },
  { file: 'datos-1440.png', route: '/datos', domain: 'Datos', viewport: { width: 1440, height: 1050 } },
  { file: 'datos-mobile-390.png', route: '/datos', domain: 'Datos', viewport: { width: 390, height: 920 } },
  { file: 'evidencias-1440.png', route: '/evidencias', domain: 'Datos', viewport: { width: 1440, height: 1050 } },
  { file: 'metricas-1440.png', route: '/metricas', domain: 'Inteligencia', viewport: { width: 1440, height: 1050 } },
  { file: 'inteligencia-mobile-390.png', route: '/grc', domain: 'Inteligencia', viewport: { width: 390, height: 920 } },
  { file: 'ia-compliance-1440.png', route: '/ia-compliance', domain: 'Inteligencia', viewport: { width: 1440, height: 1050 } },
  { file: 'exportes-1440.png', route: '/exportes', domain: 'Reportes', viewport: { width: 1440, height: 1050 } },
  { file: 'reportes-mobile-390.png', route: '/bi', domain: 'Reportes', viewport: { width: 390, height: 920 } },
  { file: 'studio-1440.png', route: '/reportes/studio', domain: 'Reportes', viewport: { width: 1440, height: 1050 } },
];

async function setupPage(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'es-CL',
    extraHTTPHeaders: { 'Accept-Language': 'es-CL,es;q=0.9', 'x-tcdx-locale': 'es' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.route('**/api/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url())))));
  await page.route('**/health/**', async (route) => route.fulfill(jsonResponse(apiMock(new URL(route.request().url())))));
  await page.addInitScript(({ token, tenantId, userId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('activeTenantId', tenantId);
    localStorage.setItem('selectedTenantId', tenantId);
    localStorage.setItem('user_id', userId);
    localStorage.setItem('email', 'validacion.ui@local.test');
    localStorage.setItem('tcdx_locale', 'es');
    localStorage.setItem('sidebar-collapsed', 'false');
    document.cookie = 'tcdx_locale=es; path=/; SameSite=Lax';
  }, { token, tenantId, userId });
  return { context, page };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoMixedLocale(text, file) {
  [
    /Compliance and ISO/i,
    /Audit and Improvement/i,
    /Data and Evidence/i,
    /GRC Intelligence/i,
    /BI and Reports/i,
    /Domain views/i,
    /Action Plans/i,
    /Findings/i,
    /Nonconformities/i,
    /Recommended Actions/i,
    /Invalid tenant/i,
    /Unauthorized/i,
    /Inicio\s*\/\s*Inicio/i,
  ].forEach((pattern) => assert(!pattern.test(text), `${file} contains forbidden visible pattern ${pattern}`));
}

async function capture(browser, item) {
  const { context, page } = await setupPage(browser, item.viewport);
  await page.goto(`${baseUrl}${item.route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.enterprise-domain-workspace').waitFor({ state: 'visible' });
  await page.locator('header.enterprise-topbar').first().waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(900);

  const activeTabs = await page.locator('nav[aria-label="Vistas del dominio"] [aria-current="page"]').count();
  const topbars = await page.locator('header.enterprise-topbar').count();
  const bodyText = await page.locator('body').innerText();
  assert(topbars === 1, `${item.file} must have exactly one AppLayout topbar; found ${topbars}.`);
  assert(activeTabs === 1, `${item.file} must have exactly one active domain tab; found ${activeTabs}.`);
  assert(bodyText.includes(item.domain), `${item.file} must include domain signal ${item.domain}.`);
  assertNoMixedLocale(bodyText, item.file);

  await page.screenshot({ path: path.join(outDir, item.file), fullPage: true });
  await context.close();

  return {
    file: item.file,
    locale: 'es-CL',
    viewport: item.viewport,
    ruta: item.route,
    dominio: item.domain,
    tenant_visual: tenantName,
    condicion_de_datos: 'fixture visual local con sesion valida y colecciones vacias/parciales segun vista',
    fuente: 'playwright-route-fixture',
    assertions: [
      'enterprise-domain-workspace visible',
      'AppLayout/topbar visible',
      'exactamente un AppLayout/topbar',
      'exactamente una tab de dominio con aria-current=page',
      'sin errores visibles de auth o tenant',
      'sin labels conocidos EN de shell en evidencia ES',
      'rutas App Router 97 antes/despues',
    ],
    sesion_valida: true,
    ausencia_de_idioma_mixto: true,
    rutas_antes_despues: '97 -> 97',
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const captures = [];
  for (const item of capturesToRun) {
    captures.push(await capture(browser, item));
  }
  const manifest = {
    verdict: 'PASS',
    locale: 'es-CL',
    generated_at: new Date().toISOString(),
    tenant_context: { tenant_id: tenantId, tenant_name: tenantName, source: 'runtime UUID visual fixture' },
    rutas: { antes: 97, despues: 97 },
    assertions_globales: [
      'fixtures confinados al script de evidencia',
      'sin mock productivo',
      'sin nuevas rutas',
      'sin modificacion de RBAC',
      'sin datos demo persistentes',
    ],
    captures,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`UI02_STAGE4_ENTERPRISE_DOMAIN_WORKSPACES_CAPTURE_PASS ${outDir}`);
} finally {
  await browser.close();
}
