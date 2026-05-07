'use strict';

const {
  escapeHtml,
  sanitizePdfText,
  sanitizeId,
  cleanFilename,
} = require('../helpers/reportTextSanitizer.helpers');

const {
  resolveTcdxLogoUrl,
  resolveTenantLogoUrl,
  renderLogoOrFallback,
} = require('../helpers/reportBranding.helpers');

const {
  getStandardContext: getScopedStandardContext,
  buildScopedStats,
  getIsoNormativeProfile,
  getScopedEvidences,
  getScopedFindings,
  getScopedActions,
  getScopedAudits,
  getScopedLifecycle,
  filterBySelectedStandard,
  toNumber: scopedToNumber,
} = require('../helpers/reportDataScope.helpers');


const {
  getReportChartStyles,
  renderKpiCards,
  renderProgressBars,
  renderDonut,
  renderStatusDistribution,
  renderTopItems,
  renderBadge,
  renderPremiumTable,
} = require('../charts/reportCharts.helpers');

function localEscapeHtml(value) { return escapeHtml(value); }

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(value) {
  const n = toNumber(value, 0);
  return `${Math.round(n * 10) / 10}%`;
}

function getBaseUrl() { return ''; }

function getTcdxLogo() { return resolveTcdxLogoUrl(); }

function getTenantLogo(tenant) { return resolveTenantLogoUrl(tenant); }

function renderLogo(src, fallback) { return renderLogoOrFallback(src, fallback); }

function formatDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date || '');
  }
}

function getStandardContext(data) { return getScopedStandardContext(data); }

function getStats(data) { return buildScopedStats(data); }

function pageShell({ tenant, title, generatedAt, pageNumber, totalPages, content }) {
  const tenantName = tenant?.name || 'Cliente';

  return `
    <section class="pdfPage">
      <header class="pdfHeader">
        <div class="headerLogo">${renderLogo(getTcdxLogo(), 'TCDX')}</div>
        <div class="headerTitle">
          <h1>${escapeHtml(title)}</h1>
          <p>Fecha de emisión: ${escapeHtml(formatDate(generatedAt || new Date()))}</p>
        </div>
        <div class="headerLogo right">${renderLogo(getTenantLogo(tenant), tenantName)}</div>
      </header>

      <main class="pdfContent">
        ${content}
      </main>

      <footer class="pdfFooter">
        <div><strong>© ${new Date().getFullYear()} ${escapeHtml(tenantName)}.</strong> Todos los derechos reservados.</div>
        <div>Documento confidencial · Generado por TCDX by Tecdex</div>
        <div><strong>Página ${pageNumber} de ${totalPages}</strong></div>
      </footer>
    </section>
  `;
}

function buildControlKpis(data) {
  const standard = getStandardContext(data);
  const metrics = standard.metrics || {};
  const { controls, evidences, findings, actions } = getStats(data);

  const avgHealth = toNumber(metrics.avg_health_score || controls.average_score || controls.score, 0);
  const totalControls = toNumber(metrics.tenant_controls_count || controls.total_controls, 0);
  const healthRecords = toNumber(metrics.health_records_count, 0);
  const evidenceCount = toNumber(metrics.evidence_count || evidences.total_evidences, 0);
  const expiredEvidence = toNumber(metrics.expired_evidence_count || evidences.expired_evidences, 0);
  const attention = toNumber(metrics.attention_controls_count || controls.warning_controls, 0);
  const deteriorated = toNumber(metrics.deteriorated_controls_count || controls.critical_controls, 0);
  const openActions = toNumber(actions.open_actions || actions.open_action_plans, 0);

  return [
    {
      label: 'Salud promedio',
      value: avgHealth,
      unit: '%',
      status: avgHealth >= 80 ? 'success' : avgHealth >= 60 ? 'warning' : 'danger',
      helper: standard.displayName,
    },
    {
      label: 'Controles evaluados',
      value: totalControls,
      status: 'neutral',
      helper: `${healthRecords} con salud calculada`,
    },
    {
      label: 'Controles en atención',
      value: attention,
      status: attention > 0 ? 'warning' : 'success',
      helper: 'Requieren seguimiento',
    },
    {
      label: 'Controles deteriorados',
      value: deteriorated,
      status: deteriorated > 0 ? 'danger' : 'success',
      helper: 'Remediación prioritaria',
    },
    {
      label: 'Evidencias',
      value: evidenceCount,
      status: 'neutral',
      helper: `${expiredEvidence} vencidas`,
    },
    {
      label: 'Cobertura evidencias',
      value: metrics.evidence_coverage_pct || 0,
      unit: '%',
      status: (metrics.evidence_coverage_pct || 0) >= 70 ? 'success' : 'danger-soft',
      helper: 'Evidencia aprobada/esperada',
    },
    {
      label: 'Hallazgos abiertos',
      value: findings.open_findings || 0,
      status: findings.open_findings > 0 ? 'warning' : 'success',
      helper: 'Vinculados a controles',
    },
    {
      label: 'Acciones abiertas',
      value: openActions,
      status: openActions > 0 ? 'warning' : 'success',
      helper: `${actions.overdue_actions || 0} vencidas`,
    },
  ];
}

function buildHealthDistribution(data) {
  const { controls } = getStats(data);
  const metrics = getStandardContext(data).metrics || {};

  return [
    { label: 'Saludables', value: metrics.healthy_controls_count ?? controls.healthy_controls ?? 0, status: 'success' },
    { label: 'En atención', value: metrics.attention_controls_count ?? controls.warning_controls ?? 0, status: 'warning' },
    { label: 'Deteriorados', value: metrics.deteriorated_controls_count ?? controls.critical_controls ?? 0, status: 'danger' },
  ].filter((item) => Number(item.value) > 0);
}

function buildEvidenceDistribution(data) {
  const { evidences } = getStats(data);
  const metrics = getStandardContext(data).metrics || {};

  return [
    { label: 'Aprobadas', value: metrics.approved_evidence_count ?? evidences.approved_evidences ?? 0, status: 'success' },
    { label: 'Pendientes', value: metrics.pending_evidence_count ?? evidences.pending_evidences ?? 0, status: 'warning' },
    { label: 'Vencidas', value: metrics.expired_evidence_count ?? evidences.expired_evidences ?? 0, status: 'danger' },
  ].filter((item) => Number(item.value) > 0);
}

function buildCoverageBars(data) {
  const metrics = getStandardContext(data).metrics || {};

  return [
    { label: 'Cobertura salud', value: metrics.health_coverage_pct || 0, status: (metrics.health_coverage_pct || 0) >= 80 ? 'success' : 'warning' },
    { label: 'Cobertura evidencia', value: metrics.evidence_coverage_pct || 0, status: (metrics.evidence_coverage_pct || 0) >= 70 ? 'success' : 'danger-soft' },
    { label: 'Cobertura operacional', value: metrics.operational_coverage_pct || 0, status: (metrics.operational_coverage_pct || 0) >= 70 ? 'success' : 'warning' },
    { label: 'Mapeo catálogo', value: metrics.catalog_coverage_pct || 0, status: (metrics.catalog_coverage_pct || 0) >= 80 ? 'success' : 'warning' },
  ];
}

function getTopControlIssues(data) {
  const metrics = getStandardContext(data).metrics || {};
  const { controls, evidences, findings, actions } = getStats(data);

  return [
    {
      title: 'Controles en atención',
      description: 'Controles que requieren revisión, evidencia o seguimiento operativo.',
      value: metrics.attention_controls_count || controls.warning_controls || 0,
      status: 'warning',
    },
    {
      title: 'Controles sin responsable',
      description: 'Controles sin propietario operativo asignado.',
      value: metrics.tenant_controls_count ? (metrics.tenant_controls_count - (metrics.controls_with_responsible_count || 0)) : 0,
      status: 'danger-soft',
    },
    {
      title: 'Evidencias vencidas',
      description: 'Documentos o registros que deben renovarse.',
      value: metrics.expired_evidence_count || evidences.expired_evidences || 0,
      status: 'danger',
    },
    {
      title: 'Hallazgos abiertos',
      description: 'Hallazgos que pueden afectar la salud de controles.',
      value: findings.open_findings || 0,
      status: 'warning',
    },
    {
      title: 'Acciones vencidas',
      description: 'Compromisos de remediación fuera de plazo.',
      value: actions.overdue_actions || 0,
      status: 'danger',
    },
  ];
}

function renderCoverPage(data) {
  const standard = getStandardContext(data);
  const profile = standard.profileContext || {};
  const managementSystem = profile.management_system || 'Sistema de gestión evaluado';

  return `
    <div class="pageTitleBlock">
      <span>CONTROL HEALTH</span>
      <h2>Estado operativo de controles</h2>
      <p>Evaluación técnica de salud, evidencias, responsables, hallazgos y acciones asociadas.</p>
    </div>

    <section class="summaryHero">
      <div>
        <div class="reportBadge">Control operativo</div>
        <h3>${escapeHtml(standard.displayName)}</h3>
        <p>${escapeHtml(managementSystem)}</p>
        <div class="badgeRow">
          ${renderBadge(standard.coverageLabel || 'Cobertura evaluada', standard.coverageStatus || 'neutral')}
          ${renderBadge('Uso técnico / auditor interno', 'neutral')}
        </div>
      </div>

      <div class="scoreBox">
        <span>Salud promedio</span>
        <strong>${pct(standard.metrics?.avg_health_score || data?.stats?.controls?.average_score || 0)}</strong>
        <em>Base de control operativo</em>
      </div>
    </section>

    ${renderKpiCards(buildControlKpis(data), { columns: 4 })}

    <div class="twoCol">
      ${renderDonut(buildHealthDistribution(data), { title: 'Distribución de salud de controles', centerLabel: 'Controles' })}
      ${renderProgressBars(buildCoverageBars(data), { title: 'Cobertura operativa' })}
    </div>
  `;
}

function renderEvidenceAndIssuesPage(data) {
  return `
    <div class="pageTitleBlock">
      <span>EVIDENCIAS Y DESVIACIONES</span>
      <h2>Factores que afectan la salud de controles</h2>
      <p>Lectura operativa para priorizar remediación y preparar revisión/auditoría.</p>
    </div>

    <div class="twoCol">
      ${renderStatusDistribution(buildEvidenceDistribution(data), { title: 'Estado de evidencias' })}
      ${renderTopItems(getTopControlIssues(data), { title: 'Principales focos de deterioro', valueLabel: 'Total' })}
    </div>

    <section class="noteBox">
      <strong>Uso recomendado:</strong>
      <ul>
        <li>Asignar responsables a controles sin propietario.</li>
        <li>Regularizar evidencias vencidas o pendientes.</li>
        <li>Transformar controles en atención en acciones con fecha objetivo.</li>
        <li>Revisar hallazgos abiertos antes de auditoría interna o externa.</li>
      </ul>
    </section>
  `;
}

function renderOperationalDetailPage(data) {
  const standard = getStandardContext(data);
  const metrics = standard.metrics || {};
  const stats = getStats(data);

  const controls = stats.controls || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const actions = stats.actions || stats.action_plans || {};

  const tenantControls = metrics.tenant_controls_count || controls.total_controls || 0;
  const healthRecords = metrics.health_records_count || controls.evaluated_controls || 0;
  const attentionControls = metrics.attention_controls_count || controls.warning_controls || 0;
  const deterioratedControls = metrics.deteriorated_controls_count || controls.critical_controls || 0;
  const pendingEvidences = metrics.pending_evidence_count || evidences.pending_evidences || 0;
  const expiredEvidences = metrics.expired_evidence_count || evidences.expired_evidences || 0;
  const openFindings = findings.open_findings || 0;
  const openActions = actions.open_actions || actions.open_action_plans || 0;
  const overdueActions = actions.overdue_actions || 0;

  const rows = [
    {
      area: 'Controles',
      indicador: 'Total controles de la norma',
      valor: tenantControls,
      lectura: `Base operativa específica para ${standard.displayName}.`,
    },
    {
      area: 'Controles',
      indicador: 'Controles con salud calculada',
      valor: healthRecords,
      lectura: 'Controles con medición reciente de salud.',
    },
    {
      area: 'Controles',
      indicador: 'Controles en atención',
      valor: attentionControls,
      lectura: 'Requieren revisión, evidencia o remediación.',
    },
    {
      area: 'Controles',
      indicador: 'Controles deteriorados',
      valor: deterioratedControls,
      lectura: 'Requieren remediación prioritaria.',
    },
    {
      area: 'Evidencias',
      indicador: 'Evidencias pendientes',
      valor: pendingEvidences,
      lectura: 'Limitan trazabilidad auditable de la norma seleccionada.',
    },
    {
      area: 'Evidencias',
      indicador: 'Evidencias vencidas',
      valor: expiredEvidences,
      lectura: 'Deben reemplazarse por evidencia vigente.',
    },
    {
      area: 'Hallazgos',
      indicador: 'Hallazgos abiertos',
      valor: openFindings,
      lectura: 'Pueden derivar en no conformidades o acciones correctivas.',
    },
    {
      area: 'Acciones',
      indicador: 'Acciones abiertas / vencidas',
      valor: `${openActions} / ${overdueActions}`,
      lectura: 'Requieren seguimiento operativo y evidencia de cierre.',
    },
  ];

  return `
    <div class="pageTitleBlock">
      <span>DETALLE OPERATIVO</span>
      <h2>Lectura técnica para remediación</h2>
      <p>Resumen de indicadores accionables para responsables del sistema de gestión.</p>
    </div>

    ${renderPremiumTable(
      [
        { key: 'area', label: 'Área' },
        { key: 'indicador', label: 'Indicador' },
        { key: 'valor', label: 'Valor' },
        { key: 'lectura', label: 'Lectura operativa' },
      ],
      rows,
      { title: `Resumen operativo accionable · ${standard.displayName}` }
    )}

    <section class="noteBox">
      <strong>Diferencia frente al informe ejecutivo:</strong>
      <p>
        Este informe no busca decidir inversión o certificabilidad general. Su objetivo es identificar controles,
        evidencias y acciones que deben corregirse para mejorar la salud operativa de la norma seleccionada.
      </p>
    </section>
  `;
}

function renderControlHealthPremiumTemplate(data = {}) {
  const tenant = data.tenant || {};
  const title = 'Informe de Control Health';
  const generatedAt = data.generated_at || data.generatedAt || new Date();

  const pages = [
    renderCoverPage(data),
    renderEvidenceAndIssuesPage(data),
    renderOperationalDetailPage(data),
  ];

  const totalPages = pages.length;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        ${getReportChartStyles()}
        <style>
          * { box-sizing: border-box; }

          body {
            margin: 0;
            background: #E2E8F0;
            color: #0F172A;
            font-family: Arial, Helvetica, sans-serif;
          }

          .pdfPage {
            width: 216mm;
            height: 279mm;
            margin: 0 auto;
            background: #F8FAFC;
            overflow: hidden;
            page-break-after: always;
            position: relative;
          }

          .pdfPage:last-child {
            page-break-after: auto;
          }

          .pdfHeader {
            height: 24mm;
            background: #0B2F4F;
            color: #FFFFFF;
            display: grid;
            grid-template-columns: 44mm 1fr 44mm;
            align-items: center;
            padding: 4.5mm 10mm;
          }

          .headerLogo img {
            max-width: 28mm;
            max-height: 17mm;
            object-fit: contain;
          }

          .headerLogo.right {
            text-align: right;
          }

          .headerLogo.right img {
            background: #FFFFFF;
            padding: 2mm;
            max-width: 25mm;
            max-height: 19mm;
          }

          .logoFallback {
            color: #FFFFFF;
            font-size: 9px;
            font-weight: 800;
          }

          .headerTitle {
            text-align: center;
          }

          .headerTitle h1 {
            margin: 0;
            font-size: 17px;
            line-height: 1.05;
            font-weight: 900;
          }

          .headerTitle p {
            margin: 1.5mm 0 0;
            font-size: 8.5px;
            opacity: 0.8;
          }

          .pdfContent {
            padding: 7mm 11mm 14mm;
            transform: scale(0.965);
            transform-origin: top center;
            width: 103.6%;
            margin-left: -1.8%;
          }

          .pdfFooter {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 10mm;
            background: #0B2F4F;
            color: #FFFFFF;
            padding: 0 10mm;
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            align-items: center;
            gap: 8mm;
            font-size: 7.4px;
          }

          .pageTitleBlock {
            margin-bottom: 5mm;
          }

          .pageTitleBlock span {
            display: inline-flex;
            border-radius: 999px;
            background: #E0F2FE;
            color: #0369A1;
            padding: 1.5mm 3mm;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.12em;
          }

          .pageTitleBlock h2 {
            margin: 2mm 0 0;
            font-size: 22px;
            line-height: 1.1;
            color: #0B2F4F;
          }

          .pageTitleBlock p {
            margin: 1mm 0 0;
            color: #64748B;
            font-size: 10.5px;
            line-height: 1.35;
          }

          .summaryHero {
            display: grid;
            grid-template-columns: 1fr 52mm;
            gap: 5mm;
            background: #FFFFFF;
            border: 1px solid #DCE7F3;
            border-radius: 20px;
            padding: 5mm;
            margin-bottom: 5mm;
          }

          .reportBadge {
            display: inline-flex;
            border-radius: 999px;
            background: #EFF6FF;
            color: #1D4ED8;
            border: 1px solid #BFDBFE;
            padding: 1.5mm 3mm;
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .summaryHero h3 {
            margin: 3mm 0 1mm;
            font-size: 22px;
            color: #0F172A;
          }

          .summaryHero p {
            margin: 0;
            color: #64748B;
            font-size: 11px;
          }

          .badgeRow {
            display: flex;
            gap: 2mm;
            flex-wrap: wrap;
            margin-top: 4mm;
          }

          .scoreBox {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 18px;
            padding: 4mm;
            text-align: center;
          }

          .scoreBox span {
            display: block;
            color: #64748B;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .scoreBox strong {
            display: block;
            color: #0B2F4F;
            font-size: 30px;
            line-height: 1;
            margin: 3mm 0;
          }

          .scoreBox em {
            color: #64748B;
            font-size: 10px;
            font-style: normal;
          }

          .twoCol {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4mm;
            margin-top: 4mm;
          }

          .noteBox {
            margin-top: 5mm;
            background: #FFFBEB;
            border: 1px solid #FDE68A;
            color: #92400E;
            border-radius: 16px;
            padding: 4mm;
            font-size: 11px;
            line-height: 1.45;
          }

          .noteBox ul {
            margin: 2mm 0 0;
            padding-left: 5mm;
          }

          .noteBox p {
            margin: 2mm 0 0;
          }

          .tcdx-chart-block,
          .tcdx-table-block,
          .tcdx-kpi-card,
          .noteBox,
          .summaryHero {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        ${pages
          .map((content, index) =>
            pageShell({
              tenant,
              title,
              generatedAt,
              content,
              pageNumber: index + 1,
              totalPages,
            })
          )
          .join('')}
      </body>
    </html>
  `;
}

module.exports = {
  renderControlHealthPremiumTemplate,
};
