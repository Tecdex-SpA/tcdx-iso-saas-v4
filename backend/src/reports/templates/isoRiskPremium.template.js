'use strict';

const {
  getReportChartStyles,
  renderKpiCards,
  renderProgressBars,
  renderDonut,
  renderStatusDistribution,
  renderTopItems,
  renderPremiumTable,
  renderRiskHeatmap,
  renderBadge,
} = require('../charts/reportCharts.helpers');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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

function getBaseUrl() {
  return (
    process.env.REPORT_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    'http://192.168.100.120:3000'
  ).replace(/\/+$/, '');
}

function getTcdxLogo() {
  return (
    process.env.REPORT_TCDX_LOGO_URL ||
    process.env.TCDX_LOGO_URL ||
    `${getBaseUrl()}/uploads/logos/tcdx-logo.png`
  );
}

function getTenantLogo(tenant) {
  return (
    tenant?.report_logo_url ||
    tenant?.logo_url ||
    tenant?.brand_logo_url ||
    tenant?.logo ||
    ''
  );
}

function renderLogo(src, fallback) {
  const safeSrc = String(src || '').trim();

  if (!safeSrc) {
    return `<div class="logoFallback">${escapeHtml(fallback || 'Logo')}</div>`;
  }

  return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(fallback || 'Logo')}" />`;
}

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

function formatDateTime(date) {
  if (!date) return 'Sin fecha';

  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  } catch {
    return String(date || '');
  }
}

function getStandardContext(data) {
  const metadata = asObject(data?.metadata);
  const standardContext = data?.standard_context || null;
  const profileContext =
    data?.profile_context ||
    metadata.profile_context ||
    standardContext?.profile_context ||
    null;

  const metrics = standardContext?.metrics || metadata.coverage_metrics || {};

  const standardCode =
    standardContext?.standard_code ||
    metadata.standard_code ||
    data?.standard_code ||
    '';

  const versionCode =
    standardContext?.version_code ||
    metadata.version_code ||
    data?.version_code ||
    '';

  const displayName =
    standardContext?.display_name ||
    metadata.standard_label ||
    profileContext?.display_name ||
    (standardCode && versionCode ? `${standardCode}:${versionCode}` : 'Norma ISO');

  return {
    standardCode,
    versionCode,
    displayName,
    coverageStatus: standardContext?.coverage_status || metadata.coverage_status || '',
    coverageLabel: standardContext?.coverage_label || metadata.coverage_label || '',
    profileContext,
    metrics,
    warnings: asArray(standardContext?.warnings).length
      ? asArray(standardContext.warnings)
      : asArray(metadata.coverage_warnings),
  };
}

function getStats(data) {
  const stats = data?.stats || {};

  return {
    controls: stats.controls || {},
    evidences: stats.evidences || {},
    findings: stats.findings || {},
    risks: stats.risks || {},
    actions: stats.action_plans || stats.actions || {},
  };
}

function getRiskItems(data) {
  return (
    asArray(data?.risk_items) ||
    asArray(data?.risks) ||
    asArray(data?.iso_risk_items) ||
    asArray(data?.risk_matrix_items) ||
    []
  );
}

function getRiskRowsFromData(data) {
  const riskItems = getRiskItems(data);
  const stats = getStats(data);
  const standard = getStandardContext(data);
  const metrics = standard.metrics || {};

  if (riskItems.length > 0) {
    return riskItems.slice(0, 12).map((item, index) => {
      const inherent = toNumber(
        item.inherent_score ||
          item.inherent_risk_score ||
          item.initial_score ||
          item.risk_score ||
          item.score,
        0
      );

      const residual = toNumber(
        item.residual_score ||
          item.residual_risk_score ||
          item.current_score ||
          item.risk_residual_score,
        inherent
      );

      const probability = toNumber(
        item.probability ||
          item.likelihood ||
          item.residual_likelihood ||
          item.inherent_likelihood,
        3
      );

      const impact = toNumber(
        item.impact ||
          item.residual_impact ||
          item.inherent_impact,
        3
      );

      return {
        id: item.id || item.code || `R-${String(index + 1).padStart(2, '0')}`,
        title:
          item.title ||
          item.name ||
          item.risk_name ||
          item.description ||
          `Riesgo ${index + 1}`,
        description:
          item.description ||
          item.risk_description ||
          item.scenario ||
          'Riesgo registrado en matriz ISO.',
        asset:
          item.asset_name ||
          item.asset ||
          item.process_name ||
          item.process ||
          item.scope ||
          'No especificado',
        probability,
        impact,
        inherent,
        residual,
        level:
          item.level ||
          item.risk_level ||
          item.residual_level ||
          item.severity ||
          classifyRiskLevel(residual || probability * impact),
        treatment:
          item.treatment ||
          item.treatment_strategy ||
          item.response ||
          suggestTreatment(residual || probability * impact),
        owner:
          item.owner ||
          item.responsible ||
          item.responsible_name ||
          'Pendiente',
      };
    });
  }

  const highRisks = toNumber(stats.risks.high_risks || stats.risks.critical_risks, 0);
  const totalRisks = toNumber(stats.risks.total_risks || metrics.risk_runs_count || 0, 0);

  return [
    {
      id: 'R-01',
      title: 'Riesgos altos o críticos detectados',
      description: 'Riesgos con exposición relevante que requieren tratamiento y seguimiento.',
      asset: 'Sistema de gestión',
      probability: highRisks > 0 ? 4 : 3,
      impact: highRisks > 0 ? 4 : 3,
      inherent: highRisks > 0 ? 16 : 9,
      residual: highRisks > 0 ? 12 : 6,
      level: highRisks > 0 ? 'Alto' : 'Medio',
      treatment: highRisks > 0 ? 'Mitigar' : 'Monitorear',
      owner: 'Responsable ISO',
    },
    {
      id: 'R-02',
      title: 'Evidencias insuficientes para sustentar controles',
      description: 'La falta de evidencia reduce la capacidad de demostrar control efectivo.',
      asset: 'Controles ISO',
      probability: (metrics.evidence_coverage_pct || 0) < 70 ? 4 : 2,
      impact: 4,
      inherent: 16,
      residual: (metrics.evidence_coverage_pct || 0) < 70 ? 12 : 6,
      level: (metrics.evidence_coverage_pct || 0) < 70 ? 'Alto' : 'Medio',
      treatment: 'Mitigar',
      owner: 'Responsable documental',
    },
    {
      id: 'R-03',
      title: 'Controles sin responsable operativo',
      description: 'La ausencia de propietario dificulta ejecución, revisión y mejora continua.',
      asset: 'Gobierno de controles',
      probability: metrics.controls_with_responsible_count > 0 ? 2 : 4,
      impact: 3,
      inherent: 12,
      residual: metrics.controls_with_responsible_count > 0 ? 6 : 12,
      level: metrics.controls_with_responsible_count > 0 ? 'Medio' : 'Alto',
      treatment: 'Mitigar',
      owner: 'Gerencia / Responsable ISO',
    },
  ].slice(0, Math.max(totalRisks, 1));
}

function classifyRiskLevel(score) {
  const n = toNumber(score, 0);

  if (n >= 20) return 'Crítico';
  if (n >= 12) return 'Alto';
  if (n >= 6) return 'Medio';
  return 'Bajo';
}

function suggestTreatment(score) {
  const n = toNumber(score, 0);

  if (n >= 20) return 'Mitigar / escalar';
  if (n >= 12) return 'Mitigar';
  if (n >= 6) return 'Monitorear';
  return 'Aceptar controladamente';
}

function buildRiskKpis(data) {
  const standard = getStandardContext(data);
  const metrics = standard.metrics || {};
  const stats = getStats(data);
  const riskRows = getRiskRowsFromData(data);

  const totalRisks = riskRows.length || toNumber(stats.risks.total_risks, 0);
  const highOrCritical = riskRows.filter((item) => {
    const level = String(item.level || '').toLowerCase();
    return level.includes('alto') || level.includes('crítico') || level.includes('critico');
  }).length;

  const avgResidual = riskRows.length
    ? Math.round(
        (riskRows.reduce((sum, item) => sum + toNumber(item.residual, 0), 0) / riskRows.length) *
          10
      ) / 10
    : 0;

  const riskRuns = toNumber(metrics.risk_runs_count, 0);

  return [
    {
      label: 'Riesgos analizados',
      value: totalRisks,
      status: totalRisks > 0 ? 'neutral' : 'warning',
      helper: standard.displayName,
    },
    {
      label: 'Altos / críticos',
      value: highOrCritical,
      status: highOrCritical > 0 ? 'danger-soft' : 'success',
      helper: 'Prioridad de tratamiento',
    },
    {
      label: 'Residual promedio',
      value: avgResidual,
      status: avgResidual >= 12 ? 'danger-soft' : avgResidual >= 6 ? 'warning' : 'success',
      helper: 'Escala estimada',
    },
    {
      label: 'Matrices ejecutadas',
      value: riskRuns,
      status: riskRuns > 0 ? 'success' : 'warning',
      helper: 'Runs completados',
    },
    {
      label: 'Cobertura controles',
      value: metrics.health_coverage_pct || 0,
      unit: '%',
      status: (metrics.health_coverage_pct || 0) >= 70 ? 'success' : 'warning',
      helper: 'Salud de controles',
    },
    {
      label: 'Cobertura evidencias',
      value: metrics.evidence_coverage_pct || 0,
      unit: '%',
      status: (metrics.evidence_coverage_pct || 0) >= 70 ? 'success' : 'danger-soft',
      helper: 'Evidencia disponible',
    },
    {
      label: 'Acciones vencidas',
      value: stats.actions.overdue_actions || 0,
      status: stats.actions.overdue_actions > 0 ? 'danger' : 'success',
      helper: 'Tratamiento pendiente',
    },
    {
      label: 'Hallazgos abiertos',
      value: stats.findings.open_findings || 0,
      status: stats.findings.open_findings > 0 ? 'warning' : 'success',
      helper: 'Impacto en riesgo',
    },
  ];
}

function buildRiskLevelDistribution(data) {
  const rows = getRiskRowsFromData(data);

  const counts = rows.reduce(
    (acc, item) => {
      const level = String(item.level || classifyRiskLevel(item.residual)).toLowerCase();

      if (level.includes('crítico') || level.includes('critico') || level.includes('critical')) {
        acc.critical += 1;
      } else if (level.includes('alto') || level.includes('high')) {
        acc.high += 1;
      } else if (level.includes('medio') || level.includes('medium')) {
        acc.medium += 1;
      } else {
        acc.low += 1;
      }

      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  return [
    { label: 'Crítico', value: counts.critical, status: 'danger' },
    { label: 'Alto', value: counts.high, status: 'danger-soft' },
    { label: 'Medio', value: counts.medium, status: 'warning' },
    { label: 'Bajo', value: counts.low, status: 'success' },
  ].filter((item) => item.value > 0);
}

function buildTreatmentDistribution(data) {
  const rows = getRiskRowsFromData(data);

  const counts = rows.reduce((acc, item) => {
    const treatment = String(item.treatment || 'Monitorear').toLowerCase();

    if (treatment.includes('mitigar')) acc.mitigate += 1;
    else if (treatment.includes('transfer')) acc.transfer += 1;
    else if (treatment.includes('evitar')) acc.avoid += 1;
    else if (treatment.includes('acept')) acc.accept += 1;
    else acc.monitor += 1;

    return acc;
  }, { mitigate: 0, transfer: 0, avoid: 0, accept: 0, monitor: 0 });

  return [
    { label: 'Mitigar', value: counts.mitigate, status: 'danger-soft' },
    { label: 'Transferir', value: counts.transfer, status: 'neutral' },
    { label: 'Evitar', value: counts.avoid, status: 'danger' },
    { label: 'Aceptar', value: counts.accept, status: 'success' },
    { label: 'Monitorear', value: counts.monitor, status: 'warning' },
  ].filter((item) => item.value > 0);
}

function buildInherentResidualBars(data) {
  const rows = getRiskRowsFromData(data).slice(0, 6);

  return rows.map((item) => ({
    label: item.id || item.title,
    value: Math.min(100, Math.round((toNumber(item.residual, 0) / 25) * 100)),
    status:
      toNumber(item.residual, 0) >= 12
        ? 'danger-soft'
        : toNumber(item.residual, 0) >= 6
          ? 'warning'
          : 'success',
  }));
}

function buildTopRisks(data) {
  return getRiskRowsFromData(data)
    .sort((a, b) => toNumber(b.residual, 0) - toNumber(a.residual, 0))
    .slice(0, 5)
    .map((item) => ({
      title: `${item.id} · ${item.title}`,
      description: `${item.asset} · Tratamiento: ${item.treatment} · Responsable: ${item.owner}`,
      value: item.residual || item.impact * item.probability,
      status:
        toNumber(item.residual, 0) >= 12
          ? 'danger-soft'
          : toNumber(item.residual, 0) >= 6
            ? 'warning'
            : 'success',
    }));
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

function renderCoverPage(data) {
  const standard = getStandardContext(data);
  const profile = standard.profileContext || {};
  const rows = getRiskRowsFromData(data);

  const highOrCritical = rows.filter((item) => {
    const level = String(item.level || '').toLowerCase();
    return level.includes('alto') || level.includes('crítico') || level.includes('critico');
  }).length;

  return `
    <div class="pageTitleBlock">
      <span>RIESGOS ISO</span>
      <h2>Mapa de exposición y tratamiento</h2>
      <p>Evaluación de riesgos inherentes/residuales, exposición, controles relacionados y acciones de tratamiento.</p>
    </div>

    <section class="summaryHero">
      <div>
        <div class="reportBadge">Riesgo / Tratamiento</div>
        <h3>${escapeHtml(standard.displayName)}</h3>
        <p>${escapeHtml(profile.risk_language || 'Riesgos asociados al sistema de gestión')}</p>
        <div class="badgeRow">
          ${renderBadge(standard.coverageLabel || 'Cobertura evaluada', standard.coverageStatus || 'neutral')}
          ${renderBadge('Comité de riesgos / auditoría', 'neutral')}
        </div>
      </div>

      <div class="scoreBox">
        <span>Riesgos altos</span>
        <strong>${escapeHtml(highOrCritical)}</strong>
        <em>Priorización inmediata</em>
      </div>
    </section>

    ${renderKpiCards(buildRiskKpis(data), { columns: 4 })}

    <div class="twoCol">
      ${renderRiskHeatmap(
        getRiskRowsFromData(data).map((item) => ({
          impact: item.impact,
          likelihood: item.probability,
        })),
        { title: 'Mapa de calor de riesgos residuales' }
      )}

      ${renderDonut(buildRiskLevelDistribution(data), {
        title: 'Riesgos por nivel residual',
        centerLabel: 'Riesgos',
      })}
    </div>
  `;
}

function renderTreatmentPage(data) {
  return `
    <div class="pageTitleBlock">
      <span>TRATAMIENTO</span>
      <h2>Riesgos prioritarios y estrategia sugerida</h2>
      <p>Foco táctico para mitigar, aceptar, transferir o evitar riesgos según exposición residual.</p>
    </div>

    <div class="twoCol">
      ${renderTopItems(buildTopRisks(data), {
        title: 'Top riesgos por exposición residual',
        valueLabel: 'Residual',
      })}

      ${renderStatusDistribution(buildTreatmentDistribution(data), {
        title: 'Distribución de tratamiento sugerido',
      })}
    </div>

    ${renderProgressBars(buildInherentResidualBars(data), {
      title: 'Exposición residual relativa por riesgo',
    })}

    <section class="noteBox">
      <strong>Uso recomendado:</strong>
      <ul>
        <li>Validar que cada riesgo alto tenga control asociado, responsable y fecha de tratamiento.</li>
        <li>Revisar si el riesgo residual sigue sobre el apetito de riesgo definido por gerencia.</li>
        <li>Convertir tratamientos pendientes en planes de acción trazables.</li>
      </ul>
    </section>
  `;
}

function renderRiskDetailPage(data) {
  const rows = getRiskRowsFromData(data).slice(0, 10).map((item) => ({
    id: item.id,
    riesgo: item.title,
    activo: item.asset,
    prob: item.probability,
    impacto: item.impact,
    residual: item.residual,
    nivel: item.level,
    tratamiento: item.treatment,
    responsable: item.owner,
  }));

  return `
    <div class="pageTitleBlock">
      <span>DETALLE AUDITABLE</span>
      <h2>Registro ejecutivo de riesgos</h2>
      <p>Tabla resumida para seguimiento gerencial, auditoría interna y responsables del sistema.</p>
    </div>

    ${renderPremiumTable(
      [
        { key: 'id', label: 'ID' },
        { key: 'riesgo', label: 'Riesgo' },
        { key: 'activo', label: 'Activo / proceso' },
        { key: 'prob', label: 'Prob.' },
        { key: 'impacto', label: 'Impacto' },
        { key: 'residual', label: 'Residual' },
        { key: 'nivel', label: 'Nivel' },
        { key: 'tratamiento', label: 'Tratamiento' },
        { key: 'responsable', label: 'Responsable' },
      ],
      rows,
      {
        title: 'Riesgos priorizados',
        emptyMessage: 'No existen riesgos registrados para este periodo.',
      }
    )}

    <section class="noteBox">
      <strong>Diferencia frente a otros informes:</strong>
      <p>
        Este informe no evalúa madurez ni lista controles operativos en detalle. Su foco es la exposición al riesgo,
        el nivel residual y las decisiones de tratamiento necesarias para reducir o aceptar dicha exposición.
      </p>
    </section>
  `;
}

function renderIsoRiskPremiumTemplate(data = {}) {
  const tenant = data.tenant || {};
  const title = 'Informe de Riesgos ISO';
  const generatedAt = data.generated_at || data.generatedAt || new Date();

  const pages = [
    renderCoverPage(data),
    renderTreatmentPage(data),
    renderRiskDetailPage(data),
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
            background: #FEE2E2;
            color: #B91C1C;
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
            background: #FEF2F2;
            color: #B91C1C;
            border: 1px solid #FECACA;
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
            background: #FFF7ED;
            border: 1px solid #FED7AA;
            border-radius: 18px;
            padding: 4mm;
            text-align: center;
          }

          .scoreBox span {
            display: block;
            color: #9A3412;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .scoreBox strong {
            display: block;
            color: #9A3412;
            font-size: 30px;
            line-height: 1;
            margin: 3mm 0;
          }

          .scoreBox em {
            color: #9A3412;
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
  renderIsoRiskPremiumTemplate,
};
