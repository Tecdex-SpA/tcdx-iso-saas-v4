'use strict';

const { escapeHtml, sanitizePdfText } = require('../helpers/reportTextSanitizer.helpers');

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = '-') {
  const safe = sanitizePdfText(value ?? '');
  return safe || fallback;
}

function score(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function renderList(items, mapper) {
  const rows = asArray(items).slice(0, 8);
  if (!rows.length) return '<p class="aiAuditorMuted">Sin datos suficientes.</p>';

  return `
    <ul class="aiAuditorList">
      ${rows.map((item) => `<li>${escapeHtml(mapper(item))}</li>`).join('')}
    </ul>
  `;
}

function renderAiAuditorPremiumTemplate(data = {}) {
  const full = asObject(data.full_result_json || data.ai?.senior_auditor || data.senior_auditor || data);
  const summary = asObject(full.summary || data.summary_json || data.summary);
  const governance = asObject(full.governance || full.trace || data.trace_json);
  const traceability = asObject(full.traceability || full.trace || data.trace_json);
  const auditScore = score(full.audit_score ?? summary.audit_score ?? summary.score, 0);
  const confidenceScore = score(full.confidence_score ?? summary.confidence_score ?? summary.confidence, auditScore ? 65 : 0);
  const readiness = text(full.readiness_level ?? summary.readiness_level, 'partial');
  const opinion = text(full.audit_opinion ?? summary.auditor_opinion, readiness === 'ready' ? 'Apto con revision final' : 'Apto con observaciones');
  const controls = asArray(full.reviewed_controls);
  const evidences = asArray(full.reviewed_evidences);
  const gaps = asArray(full.gaps || summary.main_gaps);
  const findings = asArray(full.suggested_findings || full.findings_suggestions);
  const actions = asArray(full.suggested_actions || full.action_plan_suggestions || full.next_steps);

  return `
    <section class="aiAuditorPremiumBlock">
      <style>
        .aiAuditorPremiumBlock {
          margin: 24px 0;
          padding: 22px;
          border: 1px solid #dbeafe;
          border-radius: 18px;
          background: linear-gradient(135deg, #f8fbff 0%, #ffffff 58%, #eff6ff 100%);
          color: #0f172a;
          break-inside: avoid;
        }
        .aiAuditorHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          border-bottom: 1px solid #dbeafe;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .aiAuditorEyebrow {
          color: #2563eb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .aiAuditorTitle {
          margin: 5px 0 0;
          font-size: 24px;
          line-height: 1.15;
        }
        .aiAuditorOpinion {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          font-weight: 800;
          font-size: 12px;
          white-space: nowrap;
        }
        .aiAuditorKpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin: 14px 0 18px;
        }
        .aiAuditorKpi {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px;
          background: #fff;
        }
        .aiAuditorKpi span {
          display: block;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .aiAuditorKpi strong {
          display: block;
          margin-top: 4px;
          font-size: 22px;
          color: #1d4ed8;
        }
        .aiAuditorGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .aiAuditorPanel {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          background: rgba(255,255,255,.84);
        }
        .aiAuditorPanel h3 {
          margin: 0 0 8px;
          font-size: 13px;
          color: #0f172a;
        }
        .aiAuditorList {
          margin: 0;
          padding-left: 18px;
          color: #334155;
          font-size: 11px;
          line-height: 1.45;
        }
        .aiAuditorMuted {
          color: #64748b;
          font-size: 11px;
          margin: 0;
        }
        .aiAuditorStatement {
          margin-top: 16px;
          padding: 12px;
          border-radius: 12px;
          background: #fefce8;
          border: 1px solid #fde68a;
          color: #854d0e;
          font-size: 11px;
          line-height: 1.45;
        }
      </style>
      <div class="aiAuditorHeader">
        <div>
          <div class="aiAuditorEyebrow">TCDX by Tecdex · IA Auditor</div>
          <h2 class="aiAuditorTitle">Informe auditor premium</h2>
        </div>
        <div class="aiAuditorOpinion">${escapeHtml(opinion)}</div>
      </div>
      <div class="aiAuditorKpis">
        <div class="aiAuditorKpi"><span>Score auditor</span><strong>${auditScore}%</strong></div>
        <div class="aiAuditorKpi"><span>Confidence</span><strong>${confidenceScore}%</strong></div>
        <div class="aiAuditorKpi"><span>Readiness</span><strong>${escapeHtml(readiness)}</strong></div>
        <div class="aiAuditorKpi"><span>AI Engine</span><strong>${governance.ai_engine_used === true || traceability.ai_engine_used === true ? 'Si' : 'No'}</strong></div>
      </div>
      <p class="aiAuditorMuted">${escapeHtml(text(full.executive_summary || summary.executive_summary || summary.executive_message, 'Analisis auditor no destructivo sujeto a revision humana.'))}</p>
      <div class="aiAuditorGrid">
        <div class="aiAuditorPanel">
          <h3>Controles revisados</h3>
          ${renderList(controls, (item) => `${text(item.clause || item.control_id)} · ${text(item.control_name || item.name)} · ${text(item.status)} · ${text(item.ai_observation)}`)}
        </div>
        <div class="aiAuditorPanel">
          <h3>Evidencias revisadas</h3>
          ${renderList(evidences, (item) => `${text(item.filename || item.evidence_id)} · ${text(item.status)} · ${text(item.ai_observation)}`)}
        </div>
        <div class="aiAuditorPanel">
          <h3>Brechas principales</h3>
          ${renderList(gaps, (item) => `${text(item.severity || item.priority)} · ${text(item.title || item.requirement)} · ${text(item.recommendation)}`)}
        </div>
        <div class="aiAuditorPanel">
          <h3>Hallazgos y acciones sugeridas</h3>
          ${renderList([...findings, ...actions], (item) => `${text(item.type || item.priority || 'Accion')} · ${text(item.description || item.action || item.title)} · ${text(item.recommendation || item.expected_evidence)}`)}
        </div>
      </div>
      <div class="aiAuditorStatement">
        IA Auditor no aprueba, no cierra, no modifica evidencias ni crea registros criticos sin validacion humana explicita.
      </div>
    </section>
  `;
}

module.exports = {
  renderAiAuditorPremiumTemplate,
};
