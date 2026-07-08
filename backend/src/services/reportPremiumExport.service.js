'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { renderHtmlToPdf } = require('../reports/services/htmlPdfRenderer.service');
const reportBuilder = require('./reportBuilder.service');
const reportAiNarrative = require('./reportAiNarrative.service');
const reportTemplates = require('./reportTemplates.service');

const DISCLAIMER = 'Este reporte es generado por TCDX Compliance como apoyo a la gestión. No constituye certificación, aprobación automática ni reemplaza la revisión de un auditor humano.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function asString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeFilePart(value, fallback = 'report') {
  return asString(value, fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function escapeHtml(value) {
  return asString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasTenantOverride(payload = {}) {
  return ['tenant_id', 'tenantId', 'company_id', 'companyId'].some((key) => (
    Object.prototype.hasOwnProperty.call(payload, key)
  ));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return asString(value);
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function templateName(templateCode) {
  const template = reportTemplates.getTemplate(templateCode);
  return template?.name || templateCode;
}

function assertExportPayload(payload = {}) {
  if (hasTenantOverride(payload)) {
    throw publicError(400, 'REPORT_EXPORT_BODY_TENANT_NOT_ALLOWED', 'tenant_id no debe enviarse en el body; se resuelve desde el token.');
  }
  if (payload.review_confirmed !== true) {
    throw publicError(400, 'REPORT_EXPORT_REVIEW_REQUIRED', 'Debe confirmar revisión humana antes de exportar PDF/ZIP.');
  }
  const templateCode = asString(payload.template_code);
  if (!templateCode) {
    throw publicError(400, 'REPORT_EXPORT_TEMPLATE_REQUIRED', 'template_code es obligatorio.');
  }
  if (!reportTemplates.getTemplate(templateCode)) {
    throw publicError(400, 'REPORT_EXPORT_TEMPLATE_INVALID', 'template_code no corresponde a una plantilla de reportes válida.');
  }
  if (payload.standard_id && !UUID_RE.test(asString(payload.standard_id))) {
    throw publicError(400, 'REPORT_EXPORT_INVALID_STANDARD_ID', 'standard_id debe ser un UUID interno válido.');
  }
  if (payload.process_id && !UUID_RE.test(asString(payload.process_id))) {
    throw publicError(400, 'REPORT_EXPORT_INVALID_PROCESS_ID', 'process_id debe ser un UUID interno válido.');
  }
}

function filterPayloadForPreview(payload = {}) {
  const allowed = [
    'template_code',
    'standard_id',
    'process_id',
    'operation_id',
    'standard_code',
    'period_from',
    'period_to',
    'include_sources',
    'include_sensitive_evidence',
    'sections',
    'narrative_style',
    'language',
    'max_source_items',
    'include_intelligence_brief',
    'intelligence_payload_ready',
    'intelligence_brief',
  ];
  return allowed.reduce((acc, key) => {
    if (payload[key] !== undefined) acc[key] = payload[key];
    return acc;
  }, {});
}

function sectionData(preview, code) {
  return asArray(preview.sections).find((section) => section.code === code)?.data || null;
}

function countSection(section, key) {
  if (!section) return 0;
  const value = section[key];
  if (Array.isArray(value)) return value.length;
  return Number(value || 0);
}

function metricCards(preview) {
  const health = sectionData(preview, 'health');
  const gaps = sectionData(preview, 'gaps');
  const risks = sectionData(preview, 'risks');
  const evidence = sectionData(preview, 'evidence');
  const controls = sectionData(preview, 'controls');
  return [
    { label: 'Health global', value: health?.summary?.global_score ?? health?.summary?.score ?? '-', tone: 'blue' },
    { label: 'Controles', value: controls?.totals?.applicable ?? '-', tone: 'slate' },
    { label: 'Brechas abiertas', value: gaps?.totals?.open ?? '-', tone: 'amber' },
    { label: 'Riesgos altos', value: risks?.totals?.high_or_critical ?? '-', tone: 'red' },
    { label: 'Evidencias activas', value: evidence?.totals?.active ?? countSection(evidence, 'active'), tone: 'green' },
    { label: 'Evidencias faltantes', value: evidence?.totals?.missing ?? countSection(evidence, 'missing'), tone: 'amber' },
  ];
}

function renderList(items, renderer, empty = 'Sin datos para el alcance seleccionado.') {
  const rows = asArray(items).slice(0, 12);
  if (!rows.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<div class="list">${rows.map(renderer).join('')}</div>`;
}

function renderSection(section) {
  const data = section.data || {};
  if (section.code === 'summary') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(data.recommendation_management || data.disclaimer || 'Resumen estructurado del reporte generado desde datos internos.')}</p>
      </div>
    `;
  }
  if (section.code === 'health') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="callout">
          <strong>Score:</strong> ${escapeHtml(data.summary?.global_score ?? data.summary?.score ?? '-')} ·
          <strong>Estado:</strong> ${escapeHtml(data.summary?.label || data.summary?.status || '-')}
        </div>
        ${renderList(data.summary?.drivers, (item) => `<div class="item">${escapeHtml(item)}</div>`, 'Sin drivers críticos destacados.')}
      </div>
    `;
  }
  if (section.code === 'kpis') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        ${renderList(data, (item) => `<div class="item"><strong>${escapeHtml(item.code || '')}</strong> ${escapeHtml(item.name || '')}: ${escapeHtml(item.value ?? '-')} ${escapeHtml(item.unit || '')}</div>`)}
      </div>
    `;
  }
  if (section.code === 'intelligence_brief') {
    const signals = asArray(data.key_signals);
    const actions = asArray(data.recommended_actions);
    const knowledge = asArray(data.knowledge_basis);
    return `
      <div class="section">
        <h2>${escapeHtml(section.title || 'Intelligence Brief / Análisis asistido')}</h2>
        <div class="callout">
          <strong>Revisión humana obligatoria:</strong> ${escapeHtml(data.disclaimer || 'Este análisis es un apoyo para gestión y preparación de auditoría. Requiere revisión humana.')}
        </div>
        <p>${escapeHtml(data.executive_summary || 'Sin resumen asistido disponible para el alcance seleccionado.')}</p>
        <p class="muted">
          Estado: ${escapeHtml(data.overall_state || '-')} · Score: ${escapeHtml(data.overall_score ?? '-')} · Generado: ${escapeHtml(formatDate(data.generated_at))}
        </p>
        <h3>Riesgos, brechas o señales relevantes</h3>
        ${renderList(signals, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Señal relevante')}</strong><br>${escapeHtml(item.description || '')}<br><span>${escapeHtml(item.priority || item.confidence || '')}</span></div>`, 'Sin señales relevantes informadas.')}
        <h3>Acciones recomendadas</h3>
        ${renderList(actions, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Acción recomendada')}</strong><br>${escapeHtml(item.description || '')}<br><span>${escapeHtml(item.priority || '')} · revisión humana requerida</span></div>`, 'Sin acciones recomendadas informadas.')}
        <h3>Base de conocimiento / fuentes internas</h3>
        ${renderList(knowledge, (item) => `<div class="item"><strong>${escapeHtml(item.ref_id || item.title || 'Fundamento')}</strong><br>${escapeHtml(item.title || '')}<br><span>${escapeHtml(item.source_type || '')}</span><br>${escapeHtml(item.basis || '')}</div>`, 'Sin anexo de knowledge basis disponible.')}
      </div>
    `;
  }
  if (section.code === 'controls') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p class="muted">Aplicables: ${escapeHtml(data.totals?.applicable ?? 0)} · Cubiertos: ${escapeHtml(data.totals?.covered ?? 0)} · Sin evidencia: ${escapeHtml(data.totals?.missing_evidence ?? 0)}</p>
        ${renderList(data.controls, (item) => `<div class="item"><strong>${escapeHtml(item.code || item.name || 'Control')}</strong><br>${escapeHtml(item.description || item.name || '')}<br><span>${escapeHtml(item.status || '')}</span></div>`)}
      </div>
    `;
  }
  if (section.code === 'gaps') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p class="muted">Abiertas: ${escapeHtml(data.totals?.open ?? 0)} · Críticas: ${escapeHtml(data.totals?.critical ?? 0)}</p>
        ${renderList(data.gaps, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Brecha')}</strong><br>${escapeHtml(item.description || item.missing_evidence || '')}<br><span>${escapeHtml(item.severity || item.status || '')}</span></div>`)}
      </div>
    `;
  }
  if (section.code === 'actions') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p class="muted">Abiertas: ${escapeHtml(data.totals?.open ?? 0)} · Vencidas: ${escapeHtml(data.totals?.overdue ?? 0)}</p>
        ${renderList(data.actions, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Acción')}</strong><br>${escapeHtml(item.description || '')}<br><span>${escapeHtml(item.priority || item.status || '')}</span></div>`)}
      </div>
    `;
  }
  if (section.code === 'evidence') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p class="muted">Activas: ${escapeHtml(data.totals?.active ?? 0)} · Faltantes: ${escapeHtml(data.totals?.missing ?? 0)} · Sugeridas: ${escapeHtml(data.totals?.suggested ?? 0)}</p>
        ${renderList(data.missing, (item) => `<div class="item"><strong>${escapeHtml(item.control_name || item.standard_code || 'Evidencia faltante')}</strong><br>${escapeHtml(item.reason || '')}</div>`, 'Sin evidencias faltantes destacadas.')}
      </div>
    `;
  }
  if (section.code === 'risks') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p class="muted">Altos/críticos: ${escapeHtml(data.totals?.high_or_critical ?? 0)} · Sin tratamiento: ${escapeHtml(data.totals?.without_treatment ?? 0)}</p>
        ${renderList(data.risks, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Riesgo')}</strong><br>${escapeHtml(item.category || '')}<br><span>${escapeHtml(item.residual_risk_level || item.inherent_risk_level || '')}</span></div>`)}
      </div>
    `;
  }
  if (section.code === 'audit') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        ${renderList(data.audits, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Auditoría')}</strong><br>${escapeHtml(item.status || '')} · ${escapeHtml(item.auditor_name || '')}</div>`)}
      </div>
    `;
  }
  if (section.code === 'lifecycle') {
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        ${renderList(data.transitions, (item) => `<div class="item"><strong>${escapeHtml(item.standard_code || 'ISO')}</strong><br>${escapeHtml(item.from_stage || '')} → ${escapeHtml(item.to_stage || '')}<br><span>${escapeHtml(item.status || '')}</span></div>`)}
      </div>
    `;
  }
  return `
    <div class="section">
      <h2>${escapeHtml(section.title || section.code)}</h2>
      <pre>${escapeHtml(JSON.stringify(data, null, 2)).slice(0, 4000)}</pre>
    </div>
  `;
}

function renderNarrative(narrativeData) {
  const narrative = narrativeData?.narrative;
  if (!narrative) return '';
  return `
    <div class="page-break"></div>
    <div class="section">
      <h2>Narrativa IA / determinística</h2>
      ${narrativeData.fallback_used ? '<div class="warning">No fue posible generar narrativa IA. Se muestra narrativa determinística basada en datos del reporte.</div>' : ''}
      <h3>Resumen ejecutivo</h3>
      <p>${escapeHtml(narrative.executive_summary || '')}</p>
      <h3>Hallazgos clave</h3>
      ${renderList(narrative.key_findings, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Hallazgo')}</strong><br>${escapeHtml(item.description || '')}<br><span>${escapeHtml(item.severity || '')} · ${escapeHtml(asArray(item.source_refs).join(', '))}</span></div>`)}
      <h3>Acciones recomendadas</h3>
      ${renderList(narrative.recommended_actions, (item) => `<div class="item"><strong>${escapeHtml(item.title || 'Acción')}</strong><br>${escapeHtml(item.description || '')}<br><span>${escapeHtml(item.priority || '')} · revisión humana requerida</span></div>`)}
      <h3>Limitaciones</h3>
      ${renderList(narrative.limitations, (item) => `<div class="item">${escapeHtml(item)}</div>`, 'Sin limitaciones adicionales informadas.')}
    </div>
  `;
}

function renderSources(sources) {
  return `
    <div class="page-break"></div>
    <div class="section">
      <h2>Fuentes trazables</h2>
      ${renderList(sources, (source) => `
        <div class="item">
          <strong>${escapeHtml(source.title || 'Fuente')}</strong><br>
          <span>${escapeHtml(source.source_type || '')} · ${escapeHtml(source.status || '')} · ${escapeHtml(source.used_for || '')}</span><br>
          <span>ID interno: ${escapeHtml(source.source_id || '')}</span>
          ${source.used_for === 'excluded_reference' ? '<div class="warning small">Referencia excluida: no cuenta como cobertura activa.</div>' : ''}
        </div>
      `, 'No se incluyeron fuentes en este export.')}
    </div>
  `;
}

function buildPremiumReportHtml({ preview, narrative, metadata }) {
  const cards = metricCards(preview);
  const filters = preview.filters || {};
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(templateName(preview.template_code))}</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, Arial, sans-serif; color: #172033; background: #ffffff; font-size: 12px; line-height: 1.5; }
        .cover { min-height: 690px; display: flex; flex-direction: column; justify-content: space-between; padding: 36px; background: linear-gradient(135deg, #0B2F4F 0%, #16486f 100%); color: white; border-radius: 18px; }
        .brand { font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,.72); }
        h1 { font-size: 34px; line-height: 1.08; margin: 18px 0 14px; }
        h2 { font-size: 19px; margin: 0 0 12px; color: #0B2F4F; }
        h3 { font-size: 14px; margin: 18px 0 8px; color: #22324a; }
        .cover p { max-width: 620px; color: rgba(255,255,255,.78); font-size: 13px; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 28px; }
        .meta { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); border-radius: 12px; padding: 11px 13px; }
        .meta b { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.55); }
        .meta span { display:block; margin-top:4px; color:#fff; font-weight:700; }
        .section { margin: 24px 0; padding: 20px; border: 1px solid #d9e2ef; border-radius: 14px; break-inside: avoid; }
        .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 22px 0; }
        .card { border: 1px solid #d9e2ef; border-radius: 12px; padding: 13px; background: #f8fafc; }
        .card b { display:block; color:#64748b; font-size:10px; text-transform:uppercase; letter-spacing:.1em; }
        .card span { display:block; margin-top:6px; font-size:23px; font-weight:800; color:#0f172a; }
        .item { border: 1px solid #e2e8f0; border-radius: 11px; padding: 11px 12px; margin: 8px 0; background: #ffffff; }
        .item span, .muted { color: #64748b; }
        .callout { border-left: 4px solid #0B2F4F; background: #f1f5f9; padding: 12px; border-radius: 10px; margin-bottom: 10px; }
        .warning { border: 1px solid #f59e0b; background: #fffbeb; color: #92400e; padding: 10px 12px; border-radius: 10px; margin: 10px 0; }
        .small { font-size: 10px; padding: 6px 8px; }
        .page-break { page-break-before: always; }
        .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; color: #64748b; font-size: 10px; }
        pre { white-space: pre-wrap; font-size: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
      </style>
    </head>
    <body>
      <section class="cover">
        <div>
          <div class="brand">TCDX Compliance · Reporte Premium</div>
          <h1>${escapeHtml(templateName(preview.template_code))}</h1>
          <p>Vista previa exportada para revisión humana. El documento conserva fuentes trazables y no constituye aprobación automática.</p>
          <div class="meta-grid">
            <div class="meta"><b>Tenant</b><span>${escapeHtml(preview.tenant?.name || '-')}</span></div>
            <div class="meta"><b>Plantilla</b><span>${escapeHtml(preview.template_code)}</span></div>
            <div class="meta"><b>Periodo</b><span>${escapeHtml(filters.period_from || '-')} → ${escapeHtml(filters.period_to || '-')}</span></div>
            <div class="meta"><b>Generado</b><span>${escapeHtml(formatDate(metadata.generated_at))}</span></div>
            <div class="meta"><b>Revisión humana</b><span>Requerida</span></div>
            <div class="meta"><b>Estado</b><span>generated_preview_export</span></div>
          </div>
        </div>
        <div>${escapeHtml(DISCLAIMER)}</div>
      </section>

      <div class="section">
        <h2>Índice</h2>
        <p>Resumen ejecutivo · Health/KPIs · Secciones del reporte · Narrativa · Fuentes · Advertencias y revisión humana.</p>
      </div>

      <div class="cards">
        ${cards.map((card) => `<div class="card"><b>${escapeHtml(card.label)}</b><span>${escapeHtml(card.value)}</span></div>`).join('')}
      </div>

      ${asArray(preview.sections).map(renderSection).join('')}
      ${renderNarrative(narrative)}
      ${renderSources(preview.sources || [])}

      <div class="section">
        <h2>Advertencias y revisión humana</h2>
        ${renderList(preview.warnings, (item) => `<div class="item">${escapeHtml(item)}</div>`, 'Sin advertencias adicionales.')}
        <div class="warning">${escapeHtml(DISCLAIMER)}</div>
      </div>

      <div class="footer">
        Generado por TCDX Compliance. No incluye prompts internos, traces IA ni secretos. Fuentes externas se muestran solo como referencias autorizadas del preview.
      </div>
    </body>
  </html>`;
}

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function zipBuffer(files = []) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data || ''), 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(now.dosTime, 12);
    central.writeUInt16LE(now.dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

async function buildExportBundle({ user, payload = {}, requestedTenantId = null, format = 'pdf' } = {}) {
  assertExportPayload(payload);
  const previewPayload = filterPayloadForPreview({
    ...payload,
    include_sources: payload.include_sources !== false,
  });
  const preview = await reportBuilder.buildPreview({
    user,
    payload: previewPayload,
    requestedTenantId,
  });
  const narrative = payload.include_narrative === false
    ? null
    : await reportAiNarrative.buildNarrative({
      user,
      payload: previewPayload,
      requestedTenantId,
    });
  const metadata = {
    export_status: 'generated_preview_export',
    export_type: format,
    requires_human_review: true,
    review_confirmed: true,
    intelligence_brief_included: Boolean(preview.intelligence_brief),
    generated_at: new Date().toISOString(),
    generated_by: preview.generated_by,
    disclaimer: DISCLAIMER,
  };
  const html = buildPremiumReportHtml({ preview, narrative, metadata });
  const baseName = `${safeFilePart(preview.template_code)}-${safeFilePart(preview.tenant?.name || 'tenant')}-${Date.now()}`;
  const outputDir = path.join(os.tmpdir(), 'tcdx-report-exports');
  fs.mkdirSync(outputDir, { recursive: true });
  const pdfPath = path.join(outputDir, `${baseName}.pdf`);

  await renderHtmlToPdf({
    html,
    outputPath: pdfPath,
    requestId: crypto.randomUUID(),
    format: process.env.PDF_RENDER_FORMAT || 'A4',
    printBackground: true,
    timeoutMs: Number(process.env.PDF_RENDER_TIMEOUT_MS || 300000),
    metadata: {
      templateName: `premium-${preview.template_code}`,
      fallback_used: narrative?.fallback_used ?? null,
    },
  });

  const pdfBuffer = fs.readFileSync(pdfPath);
  fs.unlink(pdfPath, () => {});

  if (format === 'zip') {
    const sourcePayload = {
      sources: preview.sources || [],
      source_map: asArray(preview.sources).reduce((acc, source, index) => {
        acc[`source_${index + 1}`] = source;
        return acc;
      }, {}),
    };
    const zip = zipBuffer([
      { name: `${baseName}.pdf`, data: pdfBuffer },
      { name: 'report_preview.json', data: JSON.stringify(preview, null, 2) },
      { name: 'report_sources.json', data: JSON.stringify(sourcePayload, null, 2) },
      ...(narrative ? [{ name: 'report_narrative.json', data: JSON.stringify(narrative, null, 2) }] : []),
      ...(preview.intelligence_brief ? [
        { name: 'intelligence_brief.json', data: JSON.stringify(preview.intelligence_brief, null, 2) },
        { name: 'knowledge_basis_annex.json', data: JSON.stringify(preview.intelligence_brief.knowledge_basis || [], null, 2) },
      ] : []),
      { name: 'metadata.json', data: JSON.stringify(metadata, null, 2) },
    ]);
    return {
      buffer: zip,
      fileName: `${baseName}.zip`,
      contentType: 'application/zip',
      preview,
      narrative,
      metadata,
    };
  }

  return {
    buffer: pdfBuffer,
    fileName: `${baseName}.pdf`,
    contentType: 'application/pdf',
    preview,
    narrative,
    metadata,
  };
}

module.exports = {
  DISCLAIMER,
  buildExportBundle,
  buildPremiumReportHtml,
  zipBuffer,
};
