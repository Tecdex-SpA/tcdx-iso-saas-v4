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

function itemText(item) {
  if (item && typeof item === 'object') {
    return cleanText(item.title || item.name || item.objective || item.kpi || item.control || item.description || item.summary || item.url, '');
  }
  return cleanText(item, '');
}

function list(items = [], limit = 8) {
  const rows = asArray(items).slice(0, limit);
  if (!rows.length) return '<p class="muted">Sin información registrada.</p>';
  return `<ul class="cleanList">${rows.map((item) => `<li>${escapeHtml(truncateText(itemText(item), 180))}</li>`).join('')}</ul>`;
}

function compactJoin(items = [], limit = 6) {
  return asArray(items).map(itemText).filter(Boolean).slice(0, limit).join('; ');
}

function objectTable(items = [], columns = [], limit = 6) {
  const rows = asArray(items).slice(0, limit);
  if (!rows.length) return '<p class="muted">Sin información registrada.</p>';
  return `<div class="tableLike">
    <div class="tableHeader">${columns.map((column) => `<span>${escapeHtml(column.label)}</span>`).join('')}</div>
    ${rows.map((item) => `<div class="tableRow">${columns.map((column) => {
      const value = typeof column.value === 'function' ? column.value(item) : item?.[column.value];
      return `<span>${escapeHtml(truncateText(value, column.max || 220))}</span>`;
    }).join('')}</div>`).join('')}
  </div>`;
}

function references(items = [], limit = 6) {
  const rows = asArray(items).slice(0, limit);
  if (!rows.length) return '<p class="muted">Sin referencias externas registradas.</p>';
  return `<div class="tableLike">
    <div class="tableHeader"><span>Referencia</span><span>Uso contextual</span></div>
    ${rows.map((item) => {
      const domain = cleanText(item.domain || (() => {
        try { return new URL(item.url || '').hostname.replace('www.', ''); } catch { return ''; }
      })(), 'Fuente externa');
      return `<div class="tableRow"><span>${escapeHtml(truncateText(itemText(item), 120))}<br><small>${escapeHtml(domain)}</small></span><span>${escapeHtml(truncateText(item.summary || item.description || 'Referencia de apoyo contextual; no reemplaza evidencia interna.', 220))}</span></div>`;
    }).join('')}
  </div>`;
}

function firstNonEmpty(...values) {
  return values.find((value) => asArray(value).length > 0) || [];
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
  const impact = data.company_profile_impact || {};
  const impactProfile = impact.impact_profile || {};
  const applicability = impactProfile.applicability_universe || impact.trace?.applicability_summary || {};
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
  const externalReferences = ai.external_references || ai.industry_references || ai.external_context?.sources || ai.external_context?.usable_context_sources || [];
  const applied = ai.tenant_applied_context_summary || trace.internal_context_counts || {};
  const counts = trace.internal_context_counts || applied || {};

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

      <section class="section keep-together">
        <h2>Datos internos usados</h2>
        <div class="kpiGrid four">
          <div class="kpiCard"><span>Controles</span><strong>${escapeHtml(counts.controls_analyzed ?? applied.controls_analyzed ?? 0)}</strong></div>
          <div class="kpiCard"><span>KPIs</span><strong>${escapeHtml(counts.kpis_analyzed ?? applied.kpis_analyzed ?? 0)}</strong></div>
          <div class="kpiCard"><span>Riesgos</span><strong>${escapeHtml(counts.risks_analyzed ?? applied.risks_analyzed ?? 0)}</strong></div>
          <div class="kpiCard"><span>Evidencias</span><strong>${escapeHtml(counts.evidences_analyzed ?? applied.evidences_analyzed ?? 0)}</strong></div>
          <div class="kpiCard"><span>NC</span><strong>${escapeHtml(counts.nonconformities_analyzed ?? applied.nonconformities_analyzed ?? 0)}</strong></div>
          <div class="kpiCard"><span>Hallazgos</span><strong>${escapeHtml(counts.findings_analyzed ?? applied.findings_analyzed ?? 0)}</strong></div>
          <div class="kpiCard"><span>Acciones</span><strong>${escapeHtml(counts.action_plans_analyzed ?? applied.action_plans_analyzed ?? 0)}</strong></div>
          <div class="kpiCard"><span>Auditorías</span><strong>${escapeHtml(counts.audits_analyzed ?? applied.audits_analyzed ?? 0)}</strong></div>
        </div>
      </section>

      <section class="gridTwo section">
        <article class="card">
          <h3>Alcance ISO sugerido</h3>
          ${list(ai.iso_scope_recommendations || profile.audit_scope || ['Definir alcance formal, exclusiones justificadas, procesos críticos y sedes incluidas.'], 5)}
        </article>
        <article class="card">
          <h3>Riesgos y oportunidades</h3>
          ${list(ai.risk_and_gap_analysis || ai.typical_industry_risks || profile.known_weaknesses || profile.pain_points, 6)}
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
        <h2>Objetivos sugeridos</h2>
        ${objectTable(ai.proposed_objectives || profile.quality_objectives, [
          { label: 'Objetivo', value: (item) => item.objective || item.title || itemText(item), max: 180 },
          { label: 'Señal interna', value: (item) => item.linked_internal_signal || item.reason || 'Perfil empresa / datos internos', max: 240 },
          { label: 'KPI / evidencia', value: (item) => `${item.suggested_kpi || ''} ${asArray(item.required_evidence).join(', ')}`, max: 240 },
        ], 5)}
      </section>

      <section class="section keep-together">
        <h2>KPIs y controles sugeridos</h2>
        <div class="gridTwo">
          <article class="card">
            <h3>KPIs propuestos</h3>
        ${objectTable(firstNonEmpty(ai.proposed_kpis, impactProfile.suggested_kpis), [
              { label: 'KPI', value: (item) => item.kpi || item.title || itemText(item), max: 140 },
              { label: 'Fórmula / fuente', value: (item) => item.formula || item.source_data_needed || item.reason, max: 220 },
            ], 5)}
          </article>
          <article class="card">
            <h3>Controles sugeridos</h3>
        ${objectTable(firstNonEmpty(ai.suggested_controls, impactProfile.suggested_controls), [
              { label: 'Control', value: (item) => item.control || item.title || itemText(item), max: 140 },
              { label: 'Brecha / evidencia', value: (item) => item.linked_internal_gap || asArray(item.required_evidence).join(', ') || item.reason, max: 220 },
            ], 5)}
          </article>
        </div>
      </section>

      <section class="section keep-together">
        <h2>Evidencia base y foco gerencial</h2>
        <div class="gridTwo">
          <article class="card">
            <h3>Evidencia esperada</h3>
            ${list(firstNonEmpty(ai.evidence_baseline, ai.suggested_evidence_baseline, impactProfile.suggested_evidence_baseline), 7)}
          </article>
          <article class="card">
            <h3>Foco de gestión</h3>
            ${list(firstNonEmpty(ai.management_focus, ai.audit_focus_areas, impactProfile.management_focus), 7)}
          </article>
        </div>
      </section>

      ${trace.used_web === true ? `
      <section class="section keep-together">
        <h2>Referencias externas de apoyo</h2>
        ${references(externalReferences, 6)}
        <p class="muted">Estas referencias se usan como contexto complementario; no son evidencia de cumplimiento ni sustituyen fuentes normativas oficiales.</p>
      </section>
      ` : ''}

      <section class="section keep-together">
        <h2>Hoja de ruta de mejora</h2>
        ${objectTable(firstNonEmpty(ai.improvement_roadmap, impactProfile.improvement_roadmap, profile.improvement_priorities), [
          { label: 'Horizonte', value: (item) => item.horizon || item.title || 'Mejora continua', max: 80 },
          { label: 'Acciones', value: (item) => asArray(item.actions).join('; ') || itemText(item), max: 260 },
          { label: 'Criterio / evidencia', value: (item) => `${asArray(item.success_criteria).join('; ')} ${asArray(item.evidence_to_collect).join('; ')}`, max: 260 },
        ], 6)}
      </section>

      <section class="section keep-together">
        <h2>Universo operativo aplicable</h2>
        <div class="kpiGrid four">
          <div class="kpiCard"><span>Controles aplicables</span><strong>${escapeHtml(applicability.applicable_controls_count ?? 0)}</strong></div>
          <div class="kpiCard"><span>KPIs aplicables</span><strong>${escapeHtml(applicability.applicable_kpis_count ?? 0)}</strong></div>
          <div class="kpiCard"><span>Evidencias esperadas</span><strong>${escapeHtml(applicability.applicable_evidence_requirements_count ?? 0)}</strong></div>
          <div class="kpiCard"><span>Excluidos por perfil</span><strong>${escapeHtml(applicability.exclusions_count ?? 0)}</strong></div>
        </div>
        <p class="muted">El sistema calcula salud, reportes, auditoría y recomendaciones contra este universo aplicable tenant-scoped. Los elementos excluidos no se tratan como brecha del cliente.</p>
      </section>

      <section class="section keep-together">
        <h2>Impacto operativo del perfil</h2>
        <div class="gridTwo">
          <article class="card">
            <h3>Controles priorizados por perfil</h3>
            ${objectTable(impactProfile.prioritized_controls || impactProfile.profile_adjusted_controls, [
              { label: 'Control', value: (item) => item.description || item.control || itemText(item), max: 150 },
              { label: 'Razón / acción', value: (item) => item.profile_priority_reason || item.profile_recommended_attention || item.reason, max: 230 },
            ], 5)}
          </article>
          <article class="card">
            <h3>Riesgos típicos relevantes</h3>
            ${objectTable(impactProfile.risk_focus_areas, [
              { label: 'Riesgo', value: (item) => item.risk || item.title || itemText(item), max: 140 },
              { label: 'Fundamento', value: (item) => item.reason || item.source || item.description, max: 220 },
            ], 5)}
          </article>
        </div>
        <p class="muted">Esta capa ajusta prioridad operativa y recomendaciones. No cambia cumplimiento formal ni reemplaza evidencia interna aprobada.</p>
      </section>

      <section class="section keep-together">
        <h2>Limitaciones y conclusiones no permitidas</h2>
        <div class="gridTwo">
          <article class="card">
            <h3>Limitaciones de datos</h3>
            ${list(ai.data_quality_limitations || ai.limitations, 6)}
          </article>
          <article class="card">
            <h3>Qué no se puede concluir</h3>
            ${list(ai.what_not_to_conclude, 6)}
          </article>
        </div>
      </section>

      <section class="section traceBox">
        <h2>Trazabilidad IA y límites</h2>
        <div class="gridFour">
          ${field('AI Engine', hasRealAi ? 'Ejecutado' : 'No ejecutado / fallback')}
          ${field('Modelo', hasRealAi ? (trace.selected_model || trace.model_name || 'No disponible') : 'No disponible')}
          ${field('RAG', yesNo(trace.used_rag))}
          ${field('Web', yesNo(trace.used_web))}
          ${field('Duración', trace.duration_ms ? `${trace.duration_ms} ms` : 'No informada')}
          ${field('Request ID', trace.request_id || 'No informado')}
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
