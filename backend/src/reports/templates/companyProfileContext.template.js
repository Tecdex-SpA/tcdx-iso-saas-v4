'use strict';

const { renderBaseTemplate } = require('./common/baseTemplate');
const { escapeHtml, cleanText, truncateText } = require('./common/sanitize');
const { displayStatus, formatDate, yesNo } = require('./common/formatters');
const {
  resolveTcdxLogoUrl,
  resolveTenantLogoUrl,
  renderLogoOrFallback,
} = require('../helpers/reportBranding.helpers');

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function list(items = [], limit = 8) {
  const rows = asArray(items).slice(0, limit);
  if (!rows.length) return '<p class="muted">Sin información registrada.</p>';
  return `<ul class="cleanList">${rows.map((item) => `<li>${escapeHtml(truncateText(item, 180))}</li>`).join('')}</ul>`;
}

function field(label, value) {
  return `
    <div class="miniField">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(cleanText(value, 'No informado'))}</strong>
    </div>
  `;
}

function renderCompanyProfileContextTemplate(data = {}) {
  const tenant = data.tenant || {};
  const profile = data.profile_json || {};
  const ai = data.ai_profile_summary_json || {};
  const trace = data.ai_research_trace_json || {};
  const tenantName = cleanText(profile.company_name || tenant.name, 'Cliente');
  const tcdxLogo = resolveTcdxLogoUrl();
  const tenantLogo = resolveTenantLogoUrl(tenant);
  const fallbackUsed = trace.fallback_used === true || String(trace.selected_model || '').toLowerCase() === 'backend_fallback';
  const hasRealAi = trace.ai_engine_used === true && trace.used_llm === true && !fallbackUsed;
  const executiveText = hasRealAi
    ? (ai.executive_narrative || ai.summary || profile.business_model || 'Perfil empresa analizado con IA y contexto interno TCDX.')
    : 'El perfil empresa fue guardado como contexto operativo. El enriquecimiento IA no se completó en esta ejecución; las recomendaciones deben tratarse como base determinística hasta ejecutar un análisis IA exitoso.';
  const limitationsText = hasRealAi
    ? asArray(ai.limitations || trace.limitations).join(' ')
    : 'IA no ejecutada o completada con fallback controlado. La evidencia interna y la revisión humana siguen siendo obligatorias antes de usar este documento como soporte de auditoría.';

  const body = `
    <main class="pdfDocument">
      <section class="hero heroCompact">
        <div class="logoRow">
          ${renderLogoOrFallback(tcdxLogo, 'TCDX by Tecdex', { role: 'tcdx' })}
          ${renderLogoOrFallback(tenantLogo, tenantName, { role: 'tenant' })}
        </div>
        <div class="heroContent">
          <div>
            <p class="eyebrow">Contexto de la organización</p>
            <h1>${escapeHtml(tenantName)}</h1>
            <p class="heroLead">Documento de contexto organizacional para gestión ISO, auditoría y priorización de controles. La IA aporta interpretación; la evidencia interna sigue siendo la fuente de verdad.</p>
          </div>
          <div class="heroMeta">
            ${field('Industria', profile.industry || data.industry)}
            ${field('Subindustria', profile.subindustry || data.subindustry)}
            ${field('Madurez', displayStatus(profile.current_maturity_level || data.maturity_level))}
            ${field('Emitido', formatDate(new Date()))}
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Resumen ejecutivo</h2>
        <div class="callout">
          ${escapeHtml(truncateText(executiveText, 900))}
        </div>
        <div class="kpiGrid four">
          <div class="kpiCard"><span>Modelo de negocio</span><strong>${escapeHtml(truncateText(profile.business_model, 80, 'No informado'))}</strong></div>
          <div class="kpiCard"><span>Tamaño</span><strong>${escapeHtml(cleanText(profile.company_size || data.company_size, 'No informado'))}</strong></div>
          <div class="kpiCard"><span>Web research</span><strong>${escapeHtml(yesNo(data.allow_web_research))}</strong></div>
          <div class="kpiCard"><span>Contexto documental</span><strong>${escapeHtml(yesNo(data.allow_document_context))}</strong></div>
        </div>
      </section>

      <section class="gridTwo section">
        <article class="card">
          <h3>Alcance ISO sugerido</h3>
          <p>${escapeHtml(truncateText(ai.iso_scope_recommendations || profile.audit_scope || 'Definir alcance formal, exclusiones justificadas, procesos críticos y sedes incluidas.', 650))}</p>
        </article>
        <article class="card">
          <h3>Riesgos y oportunidades</h3>
          ${list(ai.typical_industry_risks || profile.known_weaknesses || profile.pain_points, 6)}
        </article>
      </section>

      <section class="gridTwo section">
        <article class="card">
          <h3>Procesos críticos</h3>
          ${list(profile.critical_processes || ai.critical_processes, 7)}
        </article>
        <article class="card">
          <h3>Activos y dependencias</h3>
          ${list(profile.critical_assets || profile.key_systems || ai.critical_assets, 7)}
        </article>
      </section>

      <section class="section keep-together">
        <h2>Objetivos, KPIs y evidencia esperada</h2>
        <div class="tableLike">
          <div class="tableHeader"><span>Dimensión</span><span>Recomendación</span></div>
          <div class="tableRow"><span>Objetivos</span><span>${escapeHtml(truncateText(asArray(ai.proposed_objectives || profile.quality_objectives).join('; '), 360, 'No informado'))}</span></div>
          <div class="tableRow"><span>KPIs</span><span>${escapeHtml(truncateText(asArray(ai.proposed_kpis).join('; '), 360, 'No informado'))}</span></div>
          <div class="tableRow"><span>Controles base</span><span>${escapeHtml(truncateText(asArray(ai.suggested_controls).join('; '), 360, 'No informado'))}</span></div>
          <div class="tableRow"><span>Evidencia base</span><span>${escapeHtml(truncateText(asArray(ai.suggested_evidence_baseline).join('; '), 360, 'No informado'))}</span></div>
        </div>
      </section>

      <section class="section keep-together">
        <h2>Hoja de ruta de mejora</h2>
        ${list(ai.improvement_roadmap || profile.improvement_priorities, 8)}
      </section>

      <section class="section traceBox">
        <h2>Trazabilidad IA y límites</h2>
        <div class="gridFour">
          ${field('AI Engine', hasRealAi ? 'Ejecutado' : 'No ejecutado / fallback')}
          ${field('Modelo', hasRealAi ? (trace.selected_model || trace.model_name || 'No disponible') : 'No disponible')}
          ${field('RAG', yesNo(trace.used_rag))}
          ${field('Web', yesNo(trace.used_web))}
        </div>
        <p class="muted">${escapeHtml(truncateText(limitationsText, 520, 'La información externa y la IA no reemplazan evidencia interna ni auditoría formal.'))}</p>
      </section>
    </main>
  `;

  return renderBaseTemplate({
    title: `Contexto de la organización - ${tenantName}`,
    body,
  });
}

module.exports = {
  renderCompanyProfileContextTemplate,
  render: renderCompanyProfileContextTemplate,
};
