'use strict';

const { renderBaseTemplate } = require('./common/baseTemplate');
const { escapeHtml, truncateText } = require('./common/sanitize');
const { displayStatus, severityClass, yesNo } = require('./common/formatters');
const { _internal: aiAuditorPdfInternals } = require('../helpers/aiAuditorPdfKitPremium.helpers');

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function esc(value) {
  return escapeHtml(value);
}

function normalize({ locale = 'es', tenant = {}, analysis = {} } = {}) {
  return aiAuditorPdfInternals.normalizeData({ locale, tenant, analysis });
}

function renderKpis(data) {
  const items = [
    ['Score auditor', `${pct(data.auditScore)}%`],
    ['Confianza', `${pct(data.confidenceScore)}%`],
    ['Preparacion', data.readinessLabel],
    ['Motor usado', data.trace.engine_label],
    ['Modelo / modo', `${data.trace.model_name} · ${data.trace.model_mode}`],
    ['RAG / Web / Drive', `${data.trace.rag_used} / ${data.trace.web_used} / ${data.trace.drive_used}`],
    ['Revision humana', data.governance.human_review_required ? 'Requerida' : 'Recomendada'],
    ['Escritura automatica', 'Sin cambios automaticos'],
  ];
  return `<div class="grid-4">${items.map(([label, value]) => `
    <div class="kpi-card keep-together">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('')}</div>`;
}

function renderBullets(items, limit = 3) {
  const rows = Array.isArray(items) ? items.slice(0, limit) : [];
  if (!rows.length) return '<p class="muted">Sin datos suficientes.</p>';
  return `<ul>${rows.map((item) => `<li>${esc(truncateText(item, 150))}</li>`).join('')}</ul>`;
}

function renderGapCards(data) {
  const rows = data.gaps.slice(0, 5);
  if (!rows.length) return '<div class="card muted">Sin brechas priorizadas para este analisis.</div>';
  return `<div class="grid-2">${rows.map((gap) => `
    <article class="card keep-together">
      <div><span class="badge ${severityClass(gap.severity)}">${esc(gap.severity)}</span></div>
      <h3 style="margin-top:7px">${esc(gap.title)}</h3>
      <p class="muted"><strong>${esc(gap.requirement)}</strong> · ${esc(gap.risk)}</p>
      <p style="margin-top:5px">${esc(gap.recommendation)}</p>
    </article>
  `).join('')}</div>`;
}

function renderEvidenceTable(data) {
  const rows = data.evidences.slice(0, 6);
  return `<table>
    <thead><tr><th>Evidencia</th><th>Prioridad</th><th>Razon auditora</th><th>Control</th></tr></thead>
    <tbody>${rows.length ? rows.map((row) => `
      <tr class="table-row">
        <td><strong>${esc(row.evidence)}</strong></td>
        <td><span class="badge ${severityClass(row.priority)}">${esc(row.priority)}</span></td>
        <td>${esc(row.reason)}</td>
        <td>${esc(row.control)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">Sin evidencias requeridas priorizadas.</td></tr>'}</tbody>
  </table>`;
}

function renderActionsTable(data) {
  const rows = data.actions.slice(0, 5);
  return `<table>
    <thead><tr><th>Prioridad</th><th>Accion</th><th>Responsable</th><th>Plazo</th><th>Evidencia esperada</th></tr></thead>
    <tbody>${rows.length ? rows.map((row) => `
      <tr class="table-row">
        <td><span class="badge ${severityClass(row.priority)}">${esc(row.priority)}</span></td>
        <td><strong>${esc(row.action)}</strong></td>
        <td>${esc(row.owner)}</td>
        <td>${esc(row.due)}</td>
        <td>${esc(row.evidence)}</td>
      </tr>
    `).join('') : '<tr><td colspan="5">Sin acciones sugeridas priorizadas.</td></tr>'}</tbody>
  </table>`;
}

function renderTrace(data) {
  const trace = data.trace;
  const items = trace.hasTrace ? [
    ['ID analisis', trace.history_run_id],
    ['Request ID', trace.request_id],
    ['Tenant', data.tenantName],
    ['Norma', data.standard],
    ['Profundidad', data.depth],
    ['Modo modelo', trace.model_mode],
    ['Motor', trace.engine_label],
    ['LLM/Ollama', trace.llm_used],
    ['Proveedor', trace.llm_provider],
    ['Modelo', trace.model_name],
    ['RAG', trace.rag_used],
    ['Web', trace.web_used],
    ['Drive', trace.drive_used],
    ['Fallback', yesNo(trace.fallback_used, 'No')],
    ['Duracion', `${trace.duration_ms}${String(trace.duration_ms).match(/^[0-9]+$/) ? ' ms' : ''}`],
    ['Fuente', trace.source],
  ] : [
    ['Trazabilidad IA', 'Trazabilidad IA no disponible en analisis antiguo'],
    ['ID analisis', trace.history_run_id],
    ['Fuente', 'Resultado historico persistido en TCDX'],
  ];
  return `<div class="trace-grid">${items.map(([label, value]) => `
    <div class="trace-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>
  `).join('')}</div>`;
}

function renderIaAuditorHistoricTemplate(input = {}) {
  const data = normalize(input);
  const body = `
    <main>
      <section class="page">
        <div class="hero keep-together">
          <div class="hero-top">
            <div>
              <div class="brand">TCDX by Tecdex</div>
              <h1>Informe IA Auditor Senior</h1>
              <p class="subtitle">Evaluacion auditora no destructiva con gobernanza de revision humana obligatoria.</p>
            </div>
            <div style="text-align:right">
              <div class="brand">${esc(data.tenantName)}</div>
              <p class="muted">${esc(data.emittedAt)}</p>
            </div>
          </div>
          <div class="meta-grid">
            <div class="meta-item"><span>Norma</span><strong>${esc(data.standard || 'Multinorma')}</strong></div>
            <div class="meta-item"><span>Foco auditor</span><strong>${esc(data.focus)}</strong></div>
            <div class="meta-item"><span>Profundidad</span><strong>${esc(data.depth)}</strong></div>
            <div class="meta-item"><span>Estado</span><strong>${esc(data.readinessLabel)}</strong></div>
          </div>
        </div>

        ${renderKpis(data)}

        <section class="section card keep-together">
          <div class="section-title"><h2>Conclusion ejecutiva</h2><span class="badge ${severityClass(data.readiness)}">${esc(displayStatus(data.readinessLabel))}</span></div>
          <p>${esc(data.executiveSummary)}</p>
          <div class="bar"><i style="width:${pct(data.auditScore)}%"></i></div>
        </section>

        <section class="section card keep-together">
          <div class="section-title"><h2>Lectura auditora</h2></div>
          ${renderBullets(data.auditorReading, 3)}
        </section>
      </section>

      <section class="page">
        <section class="section">
          <div class="section-title"><h2>Brechas principales</h2><span class="muted">Top 5</span></div>
          ${renderGapCards(data)}
        </section>

        <section class="section">
          <div class="section-title"><h2>Evidencias requeridas</h2><span class="muted">Top 6</span></div>
          ${renderEvidenceTable(data)}
        </section>

        <section class="section">
          <div class="section-title"><h2>Plan sugerido</h2><span class="muted">Top 5</span></div>
          ${renderActionsTable(data)}
        </section>

        <section class="section card keep-together">
          <div class="section-title"><h2>Conclusion auditora</h2></div>
          <p>Priorizar cierre de evidencia, trazabilidad y responsables antes de declarar preparacion formal. La revision humana es obligatoria para cualquier decision auditora o declaracion de conformidad.</p>
        </section>

        <section class="section keep-together">
          <div class="section-title"><h2>Trazabilidad tecnica compacta</h2></div>
          ${renderTrace(data)}
          <p class="footer-note">Documento confidencial generado por TCDX by Tecdex. La IA no modifica registros criticos ni sustituye revision humana.</p>
        </section>
      </section>
    </main>
  `;
  return renderBaseTemplate({
    title: 'Informe IA Auditor Senior',
    body,
    extraStyles: `
      ul { margin: 0; padding-left: 16px; }
      li { margin: 0 0 5px; }
      .page { padding: 0; }
    `,
  });
}

module.exports = {
  render: renderIaAuditorHistoricTemplate,
  renderIaAuditorHistoricTemplate,
};
