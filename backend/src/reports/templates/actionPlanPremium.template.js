'use strict';

const {
  getReportChartStyles,
  renderKpiCards,
  renderStatusDistribution,
  renderTopItems,
  renderPremiumTable,
  renderRoadmap306090,
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

function formatDate(date) {
  if (!date) return 'Sin fecha';
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date || 'Sin fecha');
  }
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
  return tenant?.report_logo_url || tenant?.logo_url || tenant?.brand_logo_url || tenant?.logo || '';
}

function renderLogo(src, fallback) {
  const safeSrc = String(src || '').trim();
  if (!safeSrc) return `<div class="logoFallback">${escapeHtml(fallback || 'Logo')}</div>`;
  return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(fallback || 'Logo')}" />`;
}

function getStandardContext(data) {
  const metadata = asObject(data?.metadata);
  const standardContext = data?.standard_context || null;
  const profileContext = data?.profile_context || metadata.profile_context || standardContext?.profile_context || null;
  const metrics = standardContext?.metrics || metadata.coverage_metrics || {};

  const standardCode = standardContext?.standard_code || metadata.standard_code || data?.standard_code || '';
  const versionCode = standardContext?.version_code || metadata.version_code || data?.version_code || '';
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

function getActionRows(data) {
  const direct = [
    ...asArray(data?.action_plans),
    ...asArray(data?.actions),
    ...asArray(data?.recommended_actions),
  ];

  if (direct.length) {
    return direct.slice(0, 18).map((item, index) => ({
      id: item.id || item.code || `A-${String(index + 1).padStart(2, '0')}`,
      action: item.title || item.name || item.action || item.description || `Acción ${index + 1}`,
      origin: item.origin || item.source || item.source_type || item.related_type || 'Sistema ISO',
      priority: item.priority || item.severity || item.impact || 'media',
      status: item.status || item.state || 'abierta',
      owner: item.owner || item.responsible || item.responsible_name || item.suggested_owner_role || 'Pendiente',
      due_date: item.due_date || item.deadline || item.target_date || null,
      recommendation: item.recommendation || item.next_step || item.suggested_action || 'Definir responsable, fecha objetivo y evidencia de cierre.',
    }));
  }

  const standard = getStandardContext(data);
  const metrics = standard.metrics || {};
  const stats = getStats(data);

  const openActions = toNumber(stats.actions.open_actions || stats.actions.open_action_plans, 0);
  const overdueActions = toNumber(stats.actions.overdue_actions, 0);
  const expiredEvidence = toNumber(metrics.expired_evidence_count || stats.evidences.expired_evidences, 0);
  const pendingEvidence = toNumber(metrics.pending_evidence_count || stats.evidences.pending_evidences, 0);
  const noResponsible = metrics.tenant_controls_count
    ? Math.max(toNumber(metrics.tenant_controls_count, 0) - toNumber(metrics.controls_with_responsible_count, 0), 0)
    : 0;

  return [
    {
      id: 'A-01',
      action: 'Regularizar evidencias vencidas o pendientes',
      origin: 'Evidencias',
      priority: expiredEvidence > 0 ? 'alta' : 'media',
      status: expiredEvidence > 0 || pendingEvidence > 0 ? 'abierta' : 'monitoreo',
      owner: 'Responsable documental',
      due_date: null,
      recommendation: `Actualizar ${expiredEvidence + pendingEvidence} evidencias con fecha, responsable, periodo cubierto y control asociado.`,
    },
    {
      id: 'A-02',
      action: 'Asignar responsables a controles sin propietario',
      origin: 'Control Health',
      priority: noResponsible > 0 ? 'alta' : 'media',
      status: noResponsible > 0 ? 'abierta' : 'monitoreo',
      owner: 'Responsable ISO / Gerencia',
      due_date: null,
      recommendation: `Asignar responsable operativo a ${noResponsible} controles para asegurar seguimiento y trazabilidad.`,
    },
    {
      id: 'A-03',
      action: 'Cerrar acciones vencidas',
      origin: 'Planes de acción',
      priority: overdueActions > 0 ? 'alta' : 'media',
      status: overdueActions > 0 ? 'vencida' : 'monitoreo',
      owner: 'Jefaturas de proceso',
      due_date: null,
      recommendation: `Revisar ${overdueActions} acciones vencidas, actualizar compromiso y adjuntar evidencia de avance o cierre.`,
    },
    {
      id: 'A-04',
      action: 'Convertir controles en atención en plan trimestral',
      origin: 'Controles',
      priority: 'media',
      status: openActions > 0 ? 'en progreso' : 'abierta',
      owner: 'Responsable ISO',
      due_date: null,
      recommendation: 'Agrupar controles en atención por prioridad, responsable y dependencia de evidencia.',
    },
  ];
}

function classifyPriority(priority) {
  const raw = String(priority || '').toLowerCase();
  if (raw.includes('crit') || raw.includes('alta') || raw.includes('high')) return 'alta';
  if (raw.includes('baja') || raw.includes('low')) return 'baja';
  return 'media';
}

function classifyStatus(status) {
  const raw = String(status || '').toLowerCase();
  if (raw.includes('cerr') || raw.includes('complete') || raw.includes('done')) return 'cerrada';
  if (raw.includes('venc') || raw.includes('overdue')) return 'vencida';
  if (raw.includes('progreso') || raw.includes('progress')) return 'en progreso';
  return 'abierta';
}

function buildActionKpis(data) {
  const rows = getActionRows(data);
  const open = rows.filter((row) => classifyStatus(row.status) === 'abierta').length;
  const overdue = rows.filter((row) => classifyStatus(row.status) === 'vencida').length;
  const progress = rows.filter((row) => classifyStatus(row.status) === 'en progreso').length;
  const closed = rows.filter((row) => classifyStatus(row.status) === 'cerrada').length;
  const high = rows.filter((row) => classifyPriority(row.priority) === 'alta').length;
  const noOwner = rows.filter((row) => !row.owner || row.owner === 'Pendiente').length;
  const total = rows.length;
  const completion = total ? Math.round((closed / total) * 1000) / 10 : 0;

  return [
    { label: 'Acciones totales', value: total, status: 'neutral', helper: 'Plan consolidado' },
    { label: 'Abiertas', value: open, status: open > 0 ? 'warning' : 'success', helper: 'Requieren ejecución' },
    { label: 'Vencidas', value: overdue, status: overdue > 0 ? 'danger' : 'success', helper: 'Escalamiento' },
    { label: 'Alta prioridad', value: high, status: high > 0 ? 'danger-soft' : 'success', helper: 'Atención gerencial' },
    { label: 'En progreso', value: progress, status: 'neutral', helper: 'Seguimiento operativo' },
    { label: 'Cerradas', value: closed, status: 'success', helper: 'Con evidencia de cierre' },
    { label: 'Sin responsable', value: noOwner, status: noOwner > 0 ? 'danger-soft' : 'success', helper: 'Gobernanza' },
    { label: 'Avance', value: completion, unit: '%', status: completion >= 70 ? 'success' : 'warning', helper: 'Cierre estimado' },
  ];
}

function buildStatusDistribution(data) {
  const rows = getActionRows(data);
  const counts = rows.reduce((acc, row) => {
    acc[classifyStatus(row.status)] = (acc[classifyStatus(row.status)] || 0) + 1;
    return acc;
  }, {});

  return [
    { label: 'Abiertas', value: counts.abierta || 0, status: 'warning' },
    { label: 'En progreso', value: counts['en progreso'] || 0, status: 'neutral' },
    { label: 'Vencidas', value: counts.vencida || 0, status: 'danger' },
    { label: 'Cerradas', value: counts.cerrada || 0, status: 'success' },
  ].filter((item) => item.value > 0);
}

function buildPriorityDistribution(data) {
  const rows = getActionRows(data);
  const counts = rows.reduce((acc, row) => {
    acc[classifyPriority(row.priority)] = (acc[classifyPriority(row.priority)] || 0) + 1;
    return acc;
  }, {});

  return [
    { label: 'Alta', value: counts.alta || 0, status: 'danger-soft' },
    { label: 'Media', value: counts.media || 0, status: 'warning' },
    { label: 'Baja', value: counts.baja || 0, status: 'success' },
  ].filter((item) => item.value > 0);
}

function buildTopActions(data) {
  return getActionRows(data)
    .slice(0, 5)
    .map((row) => ({
      title: `${row.id} · ${row.action}`,
      description: `${row.origin} · Responsable: ${row.owner} · Estado: ${row.status}`,
      value: row.priority,
      status: classifyPriority(row.priority) === 'alta' ? 'danger-soft' : 'warning',
    }));
}

function buildRoadmap(data) {
  const rows = getActionRows(data);

  const high = rows.filter((row) => classifyPriority(row.priority) === 'alta' || classifyStatus(row.status) === 'vencida');
  const medium = rows.filter((row) => classifyPriority(row.priority) === 'media' && classifyStatus(row.status) !== 'vencida');
  const low = rows.filter((row) => classifyPriority(row.priority) === 'baja' || classifyStatus(row.status) === 'cerrada');

  return {
    plan30: high.slice(0, 5).map((row) => ({ title: row.action, owner: row.owner })),
    plan60: medium.slice(0, 5).map((row) => ({ title: row.action, owner: row.owner })),
    plan90: low.slice(0, 5).map((row) => ({ title: row.action, owner: row.owner })),
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
      <main class="pdfContent">${content}</main>
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
  const rows = getActionRows(data);
  const overdue = rows.filter((row) => classifyStatus(row.status) === 'vencida').length;

  return `
    <div class="pageTitleBlock">
      <span>PLAN DE ACCIÓN</span>
      <h2>Ejecución, responsables y vencimientos</h2>
      <p>Seguimiento táctico de acciones abiertas, vencidas, críticas y roadmap de remediación.</p>
    </div>

    <section class="summaryHero">
      <div>
        <div class="reportBadge">Ejecución / Remediación</div>
        <h3>${escapeHtml(standard.displayName)}</h3>
        <p>Plan operativo para cerrar brechas, evidencias, controles y riesgos priorizados.</p>
        <div class="badgeRow">
          ${renderBadge(standard.coverageLabel || 'Cobertura evaluada', standard.coverageStatus || 'neutral')}
          ${renderBadge('Responsables y plazos', 'neutral')}
        </div>
      </div>
      <div class="scoreBox">
        <span>Acciones vencidas</span>
        <strong>${escapeHtml(overdue)}</strong>
        <em>requieren escalamiento</em>
      </div>
    </section>

    ${renderKpiCards(buildActionKpis(data), { columns: 4 })}

    <div class="twoCol">
      ${renderStatusDistribution(buildStatusDistribution(data), { title: 'Distribución por estado' })}
      ${renderStatusDistribution(buildPriorityDistribution(data), { title: 'Distribución por prioridad' })}
    </div>
  `;
}

function renderRoadmapPage(data) {
  return `
    <div class="pageTitleBlock">
      <span>ROADMAP</span>
      <h2>Plan 30/60/90 de remediación</h2>
      <p>Secuencia sugerida para resolver puntos críticos sin perder trazabilidad.</p>
    </div>

    ${renderRoadmap306090(buildRoadmap(data), { title: 'Roadmap de ejecución' })}

    ${renderTopItems(buildTopActions(data), {
      title: 'Acciones críticas priorizadas',
      valueLabel: 'Prioridad',
    })}

    <section class="noteBox">
      <strong>Uso recomendado:</strong>
      <ul>
        <li>Convertir cada acción en responsable, fecha objetivo y evidencia de cierre.</li>
        <li>Revisar semanalmente acciones vencidas o de alta prioridad.</li>
        <li>Usar este informe como base de comité operativo ISO.</li>
      </ul>
    </section>
  `;
}

function renderActionTablePage(data) {
  const rows = getActionRows(data).slice(0, 12).map((row) => ({
    id: row.id,
    accion: row.action,
    origen: row.origin,
    prioridad: row.priority,
    estado: row.status,
    responsable: row.owner,
    vence: row.due_date ? formatDate(row.due_date) : 'Sin fecha',
    recomendacion: row.recommendation,
  }));

  return `
    <div class="pageTitleBlock">
      <span>SEGUIMIENTO</span>
      <h2>Tabla ejecutiva de acciones</h2>
      <p>Registro priorizado para seguimiento operativo, responsable y evidencia de cierre.</p>
    </div>

    ${renderPremiumTable(
      [
        { key: 'id', label: 'ID' },
        { key: 'accion', label: 'Acción' },
        { key: 'origen', label: 'Origen' },
        { key: 'prioridad', label: 'Prioridad' },
        { key: 'estado', label: 'Estado' },
        { key: 'responsable', label: 'Responsable' },
        { key: 'vence', label: 'Vence' },
        { key: 'recomendacion', label: 'Recomendación' },
      ],
      rows,
      { title: 'Acciones priorizadas' }
    )}

    <section class="noteBox">
      <strong>Diferencia frente a otros informes:</strong>
      <p>Este informe no diagnostica madurez ni evalúa exposición al riesgo. Su foco es ejecución, seguimiento, responsables, plazos y cierre trazable.</p>
    </section>
  `;
}

function renderActionPlanPremiumTemplate(data = {}) {
  const tenant = data.tenant || {};
  const title = 'Informe de Plan de Acción';
  const generatedAt = data.generated_at || data.generatedAt || new Date();

  const pages = [
    renderCoverPage(data),
    renderRoadmapPage(data),
    renderActionTablePage(data),
  ];

  const totalPages = pages.length;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        ${getReportChartStyles()}
        <style>${baseCss('#ECFDF5', '#047857')}</style>
      </head>
      <body>
        ${pages.map((content, index) => pageShell({
          tenant,
          title,
          generatedAt,
          content,
          pageNumber: index + 1,
          totalPages,
        })).join('')}
      </body>
    </html>
  `;
}

function baseCss(kickerBg, kickerText) {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; background: #E2E8F0; color: #0F172A; font-family: Arial, Helvetica, sans-serif; }
    .pdfPage { width: 216mm; height: 279mm; margin: 0 auto; background: #F8FAFC; overflow: hidden; page-break-after: always; position: relative; }
    .pdfPage:last-child { page-break-after: auto; }
    .pdfHeader { height: 24mm; background: #0B2F4F; color: #FFFFFF; display: grid; grid-template-columns: 44mm 1fr 44mm; align-items: center; padding: 4.5mm 10mm; }
    .headerLogo img { max-width: 28mm; max-height: 17mm; object-fit: contain; }
    .headerLogo.right { text-align: right; }
    .headerLogo.right img { background: #FFFFFF; padding: 2mm; max-width: 25mm; max-height: 19mm; }
    .logoFallback { color: #FFFFFF; font-size: 9px; font-weight: 800; }
    .headerTitle { text-align: center; }
    .headerTitle h1 { margin: 0; font-size: 17px; line-height: 1.05; font-weight: 900; }
    .headerTitle p { margin: 1.5mm 0 0; font-size: 8.5px; opacity: 0.8; }
    .pdfContent { padding: 7mm 11mm 14mm; transform: scale(0.965); transform-origin: top center; width: 103.6%; margin-left: -1.8%; }
    .pdfFooter { position: absolute; left: 0; right: 0; bottom: 0; height: 10mm; background: #0B2F4F; color: #FFFFFF; padding: 0 10mm; display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 8mm; font-size: 7.4px; }
    .pageTitleBlock { margin-bottom: 5mm; }
    .pageTitleBlock span { display: inline-flex; border-radius: 999px; background: ${kickerBg}; color: ${kickerText}; padding: 1.5mm 3mm; font-size: 8px; font-weight: 900; letter-spacing: 0.12em; }
    .pageTitleBlock h2 { margin: 2mm 0 0; font-size: 22px; line-height: 1.1; color: #0B2F4F; }
    .pageTitleBlock p { margin: 1mm 0 0; color: #64748B; font-size: 10.5px; line-height: 1.35; }
    .summaryHero { display: grid; grid-template-columns: 1fr 52mm; gap: 5mm; background: #FFFFFF; border: 1px solid #DCE7F3; border-radius: 20px; padding: 5mm; margin-bottom: 5mm; }
    .reportBadge { display: inline-flex; border-radius: 999px; background: ${kickerBg}; color: ${kickerText}; border: 1px solid #BBF7D0; padding: 1.5mm 3mm; font-size: 8px; font-weight: 900; text-transform: uppercase; }
    .summaryHero h3 { margin: 3mm 0 1mm; font-size: 22px; color: #0F172A; }
    .summaryHero p { margin: 0; color: #64748B; font-size: 11px; }
    .badgeRow { display: flex; gap: 2mm; flex-wrap: wrap; margin-top: 4mm; }
    .scoreBox { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 18px; padding: 4mm; text-align: center; }
    .scoreBox span { display: block; color: ${kickerText}; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
    .scoreBox strong { display: block; color: ${kickerText}; font-size: 30px; line-height: 1; margin: 3mm 0; }
    .scoreBox em { color: ${kickerText}; font-size: 10px; font-style: normal; }
    .twoCol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm; margin-top: 4mm; }
    .noteBox { margin-top: 5mm; background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; border-radius: 16px; padding: 4mm; font-size: 11px; line-height: 1.45; }
    .noteBox ul { margin: 2mm 0 0; padding-left: 5mm; }
    .noteBox p { margin: 2mm 0 0; }
    .tcdx-chart-block, .tcdx-table-block, .tcdx-kpi-card, .noteBox, .summaryHero { break-inside: avoid; page-break-inside: avoid; }
  `;
}

module.exports = {
  renderActionPlanPremiumTemplate,
};
