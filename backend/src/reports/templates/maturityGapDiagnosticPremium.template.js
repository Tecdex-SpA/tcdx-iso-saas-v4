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
  renderPremiumTable,
  renderBadge,
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

function getDiagnosticData(data) {
  const metadata = asObject(data?.metadata);
  const metrics = getStandardContext(data).metrics || {};
  const stats = data?.stats || {};
  const controls = stats.controls || {};
  const evidences = stats.evidences || {};

  return {
    readiness_score:
      toNumber(metrics.avg_readiness_score, 0) ||
      toNumber(data?.readiness_score, 0) ||
      toNumber(metadata.readiness_score, 0),

    maturity_score:
      toNumber(metrics.avg_maturity_score, 0) ||
      toNumber(data?.maturity_score, 0) ||
      toNumber(metadata.maturity_score, 0),

    total_controls:
      toNumber(metrics.tenant_controls_count || controls.total_controls, 0),

    evaluated_controls:
      toNumber(metrics.health_records_count || controls.evaluated_controls || controls.total_controls, 0),

    controls_with_evidence:
      toNumber(metrics.evidence_count || evidences.total_evidences, 0),

    expected_evidence:
      toNumber(metrics.expected_evidence_count, 0),

    evidence_coverage_pct:
      toNumber(metrics.evidence_coverage_pct, 0),

    catalog_coverage_pct:
      toNumber(metrics.catalog_coverage_pct, 0),

    operational_coverage_pct:
      toNumber(metrics.operational_coverage_pct, 0),

    assessments_count:
      toNumber(metrics.assessments_count, 0),

    risk_runs_count:
      toNumber(metrics.risk_runs_count, 0),
  };
}

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

function buildMaturityKpis(data) {
  const standard = getStandardContext(data);
  const diagnostic = getDiagnosticData(data);

  return [
    {
      label: 'Readiness',
      value: diagnostic.readiness_score,
      unit: '%',
      status: diagnostic.readiness_score >= 80 ? 'success' : diagnostic.readiness_score >= 60 ? 'warning' : 'danger-soft',
      helper: 'Preparación estimada',
    },
    {
      label: 'Madurez',
      value: diagnostic.maturity_score,
      unit: '%',
      status: diagnostic.maturity_score >= 80 ? 'success' : diagnostic.maturity_score >= 60 ? 'warning' : 'danger-soft',
      helper: standard.displayName,
    },
    {
      label: 'Controles evaluados',
      value: diagnostic.evaluated_controls,
      status: 'neutral',
      helper: `${diagnostic.total_controls} controles base`,
    },
    {
      label: 'Cobertura evidencias',
      value: diagnostic.evidence_coverage_pct,
      unit: '%',
      status: diagnostic.evidence_coverage_pct >= 70 ? 'success' : 'danger-soft',
      helper: `${diagnostic.controls_with_evidence}/${diagnostic.expected_evidence} esperadas`,
    },
    {
      label: 'Cobertura catálogo',
      value: diagnostic.catalog_coverage_pct,
      unit: '%',
      status: diagnostic.catalog_coverage_pct >= 80 ? 'success' : 'warning',
      helper: 'Base técnica disponible',
    },
    {
      label: 'Cobertura operacional',
      value: diagnostic.operational_coverage_pct,
      unit: '%',
      status: diagnostic.operational_coverage_pct >= 70 ? 'success' : 'warning',
      helper: 'Controles + evidencias + salud',
    },
    {
      label: 'Diagnósticos',
      value: diagnostic.assessments_count,
      status: diagnostic.assessments_count > 0 ? 'success' : 'warning',
      helper: 'Evaluaciones registradas',
    },
    {
      label: 'Matrices de riesgo',
      value: diagnostic.risk_runs_count,
      status: diagnostic.risk_runs_count > 0 ? 'success' : 'warning',
      helper: 'Ejecuciones completadas',
    },
  ];
}

function buildGapDistribution(data) {
  const diagnostic = getDiagnosticData(data);

  const missingEvidence = Math.max(diagnostic.expected_evidence - diagnostic.controls_with_evidence, 0);
  const nonEvaluated = Math.max(diagnostic.total_controls - diagnostic.evaluated_controls, 0);
  const weakMaturity = diagnostic.maturity_score < 60 ? 1 : 0;
  const weakReadiness = diagnostic.readiness_score < 60 ? 1 : 0;

  return [
    { label: 'Evidencias faltantes', value: missingEvidence, status: missingEvidence > 0 ? 'danger-soft' : 'success' },
    { label: 'Controles no evaluados', value: nonEvaluated, status: nonEvaluated > 0 ? 'warning' : 'success' },
    { label: 'Madurez baja', value: weakMaturity, status: weakMaturity > 0 ? 'danger' : 'success' },
    { label: 'Readiness bajo', value: weakReadiness, status: weakReadiness > 0 ? 'danger' : 'success' },
  ].filter((item) => Number(item.value) > 0);
}

function buildReadinessBars(data) {
  const diagnostic = getDiagnosticData(data);

  return [
    { label: 'Readiness', value: diagnostic.readiness_score, status: diagnostic.readiness_score >= 80 ? 'success' : 'warning' },
    { label: 'Madurez', value: diagnostic.maturity_score, status: diagnostic.maturity_score >= 80 ? 'success' : 'warning' },
    { label: 'Evidencias', value: diagnostic.evidence_coverage_pct, status: diagnostic.evidence_coverage_pct >= 70 ? 'success' : 'danger-soft' },
    { label: 'Operacional', value: diagnostic.operational_coverage_pct, status: diagnostic.operational_coverage_pct >= 70 ? 'success' : 'warning' },
    { label: 'Catálogo', value: diagnostic.catalog_coverage_pct, status: diagnostic.catalog_coverage_pct >= 80 ? 'success' : 'warning' },
  ];
}

function buildGapTopItems(data) {
  const diagnostic = getDiagnosticData(data);
  const missingEvidence = Math.max(diagnostic.expected_evidence - diagnostic.controls_with_evidence, 0);
  const nonEvaluated = Math.max(diagnostic.total_controls - diagnostic.evaluated_controls, 0);

  return [
    {
      title: 'Evidencias faltantes',
      description: 'La ausencia de evidencia limita la demostración objetiva de cumplimiento.',
      value: missingEvidence,
      status: missingEvidence > 0 ? 'danger-soft' : 'success',
    },
    {
      title: 'Controles no evaluados',
      description: 'Controles sin medición reciente de salud o cumplimiento.',
      value: nonEvaluated,
      status: nonEvaluated > 0 ? 'warning' : 'success',
    },
    {
      title: 'Madurez del sistema',
      description: 'Nivel estimado del sistema frente a la norma seleccionada.',
      value: pct(diagnostic.maturity_score),
      status: diagnostic.maturity_score >= 70 ? 'success' : 'warning',
    },
    {
      title: 'Preparación para auditoría',
      description: 'Lectura preliminar de readiness para avanzar a verificación.',
      value: pct(diagnostic.readiness_score),
      status: diagnostic.readiness_score >= 70 ? 'success' : 'danger-soft',
    },
  ];
}

function renderCoverPage(data) {
  const standard = getStandardContext(data);
  const profile = standard.profileContext || {};
  const diagnostic = getDiagnosticData(data);

  return `
    <div class="pageTitleBlock">
      <span>DIAGNÓSTICO ISO</span>
      <h2>Madurez y brechas</h2>
      <p>Evaluación del estado actual frente a la norma seleccionada y priorización de brechas.</p>
    </div>

    <section class="summaryHero">
      <div>
        <div class="reportBadge">Diagnóstico / Gap Analysis</div>
        <h3>${escapeHtml(standard.displayName)}</h3>
        <p>${escapeHtml(profile.management_system || 'Sistema de gestión evaluado')}</p>
        <div class="badgeRow">
          ${renderBadge(standard.coverageLabel || 'Cobertura evaluada', standard.coverageStatus || 'neutral')}
          ${renderBadge('Madurez y readiness', 'neutral')}
        </div>
      </div>

      <div class="scoreBox">
        <span>Readiness</span>
        <strong>${pct(diagnostic.readiness_score)}</strong>
        <em>Preparación estimada</em>
      </div>
    </section>

    ${renderKpiCards(buildMaturityKpis(data), { columns: 4 })}

    <div class="twoCol">
      ${renderProgressBars(buildReadinessBars(data), { title: 'Lectura de madurez y cobertura' })}
      ${renderDonut(buildGapDistribution(data), { title: 'Distribución de brechas principales', centerLabel: 'Brechas' })}
    </div>
  `;
}

function renderGapsPage(data) {
  return `
    <div class="pageTitleBlock">
      <span>BRECHAS PRIORIZADAS</span>
      <h2>Principales desviaciones de preparación</h2>
      <p>Brechas que deben cerrarse antes de avanzar hacia auditoría o certificación.</p>
    </div>

    ${renderTopItems(buildGapTopItems(data), { title: 'Top brechas de diagnóstico', valueLabel: 'Impacto' })}

    <section class="noteBox">
      <strong>Interpretación:</strong>
      <p>
        Este diagnóstico no reemplaza una auditoría formal. Su objetivo es orientar el cierre de brechas,
        mejorar la preparación documental y priorizar acciones antes de someter el sistema a verificación.
      </p>
    </section>
  `;
}


function renderNormativeReadingPage(data) {
  const standard = getStandardContext(data);
  const normative = getIsoNormativeProfile(data);

  const rows = normative.auditCriteria.slice(0, 8).map((criterion, index) => ({
    area: criterion,
    lectura: index < 3
      ? 'Requiere validación prioritaria de evidencia, responsable y trazabilidad.'
      : 'Debe mantenerse bajo seguimiento como parte de la mejora continua.',
    foco: normative.managementSystem,
  }));

  return `
    <div class="pageTitleBlock">
      <span>LECTURA NORMATIVA</span>
      <h2>Interpretación ISO de brechas</h2>
      <p>${escapeHtml(normative.maturityFocus)}</p>
    </div>

    ${renderPremiumTable(
      [
        { key: 'area', label: 'Área normativa' },
        { key: 'lectura', label: 'Lectura consultiva' },
        { key: 'foco', label: 'Sistema' },
      ],
      rows,
      { title: `Criterios relevantes para ${standard.displayName}` }
    )}

    <section class="noteBox">
      <strong>Uso recomendado:</strong>
      <p>Usar esta lectura para transformar brechas técnicas en acciones de implementación, auditoría interna y revisión por la dirección.</p>
    </section>
  `;
}


function renderRoadmapPage(data) {
  const diagnostic = getDiagnosticData(data);
  const missingEvidence = Math.max(diagnostic.expected_evidence - diagnostic.controls_with_evidence, 0);
  const nonEvaluated = Math.max(diagnostic.total_controls - diagnostic.evaluated_controls, 0);

  const rows = [
    {
      horizonte: '30 días',
      foco: 'Evidencias y responsables',
      accion: `Regularizar ${missingEvidence} evidencias faltantes o insuficientes. Asignar responsables por control.`,
      resultado: 'Base documental mínima para revisión.',
    },
    {
      horizonte: '60 días',
      foco: 'Evaluación de controles',
      accion: `Completar medición de ${nonEvaluated} controles no evaluados y revisar controles en atención.`,
      resultado: 'Control health consolidado.',
    },
    {
      horizonte: '90 días',
      foco: 'Readiness y auditoría',
      accion: 'Ejecutar revisión interna, cerrar brechas críticas y actualizar plan de acción.',
      resultado: 'Preparación para auditoría interna/externa.',
    },
  ];

  return `
    <div class="pageTitleBlock">
      <span>PLAN 30/60/90</span>
      <h2>Ruta recomendada de cierre de brechas</h2>
      <p>Secuencia ejecutable para mejorar madurez y readiness.</p>
    </div>

    ${renderPremiumTable(
      [
        { key: 'horizonte', label: 'Horizonte' },
        { key: 'foco', label: 'Foco' },
        { key: 'accion', label: 'Acción recomendada' },
        { key: 'resultado', label: 'Resultado esperado' },
      ],
      rows,
      { title: 'Roadmap de madurez' }
    )}

    <section class="noteBox">
      <strong>Uso recomendado:</strong>
      <ul>
        <li>Usar este informe como entrada para comité ISO o planificación de implementación.</li>
        <li>Convertir cada brecha en plan de acción con responsable y fecha.</li>
        <li>Recalcular diagnóstico después del cierre de evidencias y controles.</li>
      </ul>
    </section>
  `;
}

function renderMaturityGapDiagnosticPremiumTemplate(data = {}) {
  const tenant = data.tenant || {};
  const title = 'Diagnóstico de Madurez y Brechas';
  const generatedAt = data.generated_at || data.generatedAt || new Date();

  const pages = [
    renderCoverPage(data),
    renderGapsPage(data),
    renderNormativeReadingPage(data),
    renderRoadmapPage(data),
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

          .pdfPage:last-child { page-break-after: auto; }

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

          .headerLogo.right { text-align: right; }

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

          .headerTitle { text-align: center; }

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

          .pageTitleBlock { margin-bottom: 5mm; }

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

          .noteBox p { margin: 2mm 0 0; }

          .noteBox ul {
            margin: 2mm 0 0;
            padding-left: 5mm;
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
  renderMaturityGapDiagnosticPremiumTemplate,
};
