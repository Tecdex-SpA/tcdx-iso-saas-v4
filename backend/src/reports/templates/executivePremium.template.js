const { createReportTranslator, reportLocaleToIntl, normalizeReportLocale } = require('../i18n/reportLocale');

let activeReportLocale = 'es';
let activeReportTranslator = createReportTranslator(activeReportLocale);

function setActiveReportLocale(locale) {
  activeReportLocale = normalizeReportLocale(locale || 'es');
  activeReportTranslator = createReportTranslator(activeReportLocale);
}

function getActiveReportLocale() {
  return activeReportLocale || 'es';
}

function tr(key, params = {}) {
  return activeReportTranslator(key, params);
}

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

function asString(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value) {
  const n = toNumber(value, 0);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 10) / 10;
}

function fmtNumber(value) {
  return toNumber(value, 0).toLocaleString(reportLocaleToIntl(getActiveReportLocale()));
}

function fmtPercent(value) {
  return `${clampPercent(value).toFixed(1)}%`;
}

function formatDateEs(date = new Date()) {
  if (!date) return tr('empty.noDate');

  try {
    return new Intl.DateTimeFormat(reportLocaleToIntl(getActiveReportLocale()), {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date || tr('empty.noDate'));
  }
}

function formatDateTimeEs(date = new Date()) {
  if (!date) return tr('empty.noDate');

  try {
    return new Intl.DateTimeFormat(reportLocaleToIntl(getActiveReportLocale()), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  } catch {
    return String(date || tr('empty.noDate'));
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

function encodePath(value) {
  return String(value || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function buildImageCandidates(rawSrc) {
  const raw = asString(rawSrc);
  const base = getBaseUrl();

  if (!raw) return [];

  const candidates = [];

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('file:')
  ) {
    candidates.push(raw);
  }

  if (raw.startsWith('/')) {
    candidates.push(`${base}${raw}`);
    candidates.push(raw);
  } else {
    const encoded = encodePath(raw);

    candidates.push(`${base}/uploads/logos/${encoded}`);
    candidates.push(`${base}/uploads/tenants/${encoded}`);
    candidates.push(`${base}/uploads/tenant-logos/${encoded}`);
    candidates.push(`${base}/uploads/${encoded}`);
    candidates.push(`${base}/${encoded}`);
    candidates.push(raw);
  }

  return [...new Set(candidates.filter(Boolean))];
}

function renderLogo(rawSrc, fallbackText, side = 'left') {
  const candidates = buildImageCandidates(rawSrc);
  const first = candidates[0] || '';
  const fallback1 = candidates[1] || '';
  const fallback2 = candidates[2] || '';
  const safeText = escapeHtml(fallbackText || 'Logo');

  if (!first) {
    return `
      <div class="logoBox logoFallback ${side === 'right' ? 'logoRight' : ''}">
        <span>${safeText}</span>
      </div>
    `;
  }

  const onError = [
    "if(!this.dataset.try1&&this.dataset.fallback1){this.dataset.try1='1';this.src=this.dataset.fallback1;return;}",
    "if(!this.dataset.try2&&this.dataset.fallback2){this.dataset.try2='1';this.src=this.dataset.fallback2;return;}",
    "this.style.display='none';",
    "if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}",
  ].join('');

  return `
    <div class="logoBox ${side === 'right' ? 'logoRight' : ''}">
      <img
        src="${escapeHtml(first)}"
        data-fallback1="${escapeHtml(fallback1)}"
        data-fallback2="${escapeHtml(fallback2)}"
        onerror="${onError}"
        alt="${safeText}"
      />
      <div class="logoFallbackText">${safeText}</div>
    </div>
  `;
}

function getTcdxLogo() {
  return (
    process.env.REPORT_TCDX_LOGO_URL ||
    process.env.TCDX_LOGO_URL ||
    'http://192.168.100.120:3000/uploads/logos/tcdx-logo.png'
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

function getReportConfig(reportTypeCode) {
  const code = reportTypeCode || 'executive_summary';
  const known = ['executive_summary', 'audit_report', 'control_status', 'platform_client_monthly'];
  const safeCode = known.includes(code) ? code : 'executive_summary';

  return {
    title: tr(`reports.config.${safeCode}.title`),
    badge: tr(`reports.config.${safeCode}.badge`),
    subtitle: tr(`reports.config.${safeCode}.subtitle`),
    scoreLabel: tr(`reports.config.${safeCode}.scoreLabel`),
  };
}

function cleanText(value, maxLength = 360) {
  let text = asString(value)
    .replace(/\s+/g, ' ')
    .replace(/([.:;!?])(?=[A-ZÁÉÍÓÚÑ0-9])/g, '$1 ')
    .replace(/(relevantes:)(\d)/gi, '$1 $2')
    .replace(/(recomendadas:)(\d)/gi, '$1 $2')
    .trim();

  if (text.length > maxLength) {
    text = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
    text = `${text}...`;
  }

  return text;
}

function dedupe(items, limit = 8) {
  const out = [];
  const seen = new Set();

  for (const item of asArray(items).flat(Infinity)) {
    const text = cleanText(item, 220);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) continue;

    seen.add(key);
    out.push(text);

    if (out.length >= limit) break;
  }

  return out;
}

function chunk(items, size) {
  const safe = asArray(items);
  const out = [];

  for (let i = 0; i < safe.length; i += size) {
    out.push(safe.slice(i, i + size));
  }

  return out;
}

function firstArray(data, keys) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function getStats(data) {
  const stats = data?.stats || {};

  return {
    controls: stats.controls || {},
    evidences: stats.evidences || {},
    findings: stats.findings || {},
    risks: stats.risks || {},
    actions: stats.action_plans || stats.actions || {},
    audits: stats.audits || {},
  };
}

function getGeneralTone(score) {
  const safe = clampPercent(score);
  if (safe >= 85) return tr('tone.healthy');
  if (safe >= 65) return tr('tone.attention');
  return tr('tone.critical');
}

function renderHeader({ tenant, title, generatedAt }) {
  const tenantName = tenant?.name || 'Cliente';

  return `
    <header class="pdfHeader">
      <div class="headerLogoLeft">
        ${renderLogo(getTcdxLogo(), 'TCDX by Tecdex', 'left')}
      </div>

      <div class="headerTitle">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(tr('reports.issueDate'))}: ${escapeHtml(formatDateEs(generatedAt || new Date()))}</p>
      </div>

      <div class="headerLogoRight">
        ${renderLogo(getTenantLogo(tenant), tenantName, 'right')}
      </div>
    </header>
  `;
}

function renderFooter({ tenant, pageNumber, totalPages, label }) {
  const tenantName = tenant?.name || 'Cliente';

  return `
    <footer class="pdfFooter">
      <div>
        <strong>© ${new Date().getFullYear()} ${escapeHtml(tenantName)}.</strong>
        <span> ${escapeHtml(tr('reports.allRightsReserved'))}</span>
      </div>

      <div class="footerCenter">
        ${escapeHtml(tr('reports.confidentialDocument'))} · ${escapeHtml(tr('reports.generatedBy'))}
      </div>

      <div class="footerRight">
        ${escapeHtml(tr('reports.page'))} ${pageNumber} ${escapeHtml(tr('reports.of'))} ${totalPages}
      </div>
    </footer>
  `;
}

function pageShell({ tenant, title, generatedAt, content, pageNumber, totalPages, label }) {
  return `
    <section class="pdfPage">
      ${renderHeader({ tenant, title, generatedAt })}

      <main class="pdfContent">
        ${content}
      </main>

      ${renderFooter({ tenant, pageNumber, totalPages, label })}
    </section>
  `;
}

function card(title, body, extra = '') {
  return `
    <section class="card ${extra}">
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>
  `;
}

function miniMetric(label, value, sub = '', tone = '') {
  return `
    <div class="metricCard ${tone}">
      <div class="metricLabel">${escapeHtml(label)}</div>
      <div class="metricValue">${escapeHtml(value)}</div>
      <div class="metricSub">${escapeHtml(sub)}</div>
    </div>
  `;
}

function bulletList(items) {
  const safe = dedupe(items, 8);

  if (!safe.length) {
    return `<div class="emptyBox">${escapeHtml(tr('empty.noPrioritizedObservations'))}</div>`;
  }

  return `
    <ul class="bulletList">
      ${safe.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function table(headers, rows, emptyMessage = tr('empty.noData')) {
  const safeRows = asArray(rows);

  return `
    <div class="tableBox">
      <table>
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${
            safeRows.length
              ? safeRows.join('')
              : `<tr><td colspan="${headers.length}" class="emptyCell">${escapeHtml(emptyMessage)}</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
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

function getAiAuditorAnalysis(run) {
  return asObject(run?.suggestions_json);
}

function aiRecommendationTitles(items, fallbackKey = 'title') {
  return asArray(items)
    .map((item) => {
      if (typeof item === 'string') return item;
      return item?.[fallbackKey] || item?.recommended_next_step || item?.why || '';
    })
    .filter(Boolean);
}

function statusBadge(value) {
  const raw = asString(value).toLowerCase();
  let cls = 'badge badgeNeutral';

  if (raw.includes('verde') || raw.includes('green') || raw.includes('valid') || raw.includes('confirm') || raw.includes('aprob')) {
    cls = 'badge badgeGreen';
  }

  if (raw.includes('amarillo') || raw.includes('yellow') || raw.includes('pend') || raw.includes('atenc')) {
    cls = 'badge badgeYellow';
  }

  if (raw.includes('rojo') || raw.includes('red') || raw.includes('rechaz') || raw.includes('critic')) {
    cls = 'badge badgeRed';
  }

  return `<span class="${cls}">${escapeHtml(value || '-')}</span>`;
}

function renderPage1(data) {
  const config = getReportConfig(data.report_type_code);
  const { controls, evidences, findings, risks, actions } = getStats(data);
  const score = clampPercent(controls.average_score || controls.score || data.score || 0);
  const standards = asArray(data.standards);
  const ai = data.ai_report_addendum || {};
  const shortSummary = cleanText(
    ai.summary ||
      data.executive_summary ||
      tr('page1.defaultSummary', { score }),
    320
  );

  const standardsHtml = standards.length
    ? standards.map((standard) => `<span class="pill">${escapeHtml(standard.code || standard.standard_code || standard)}</span>`).join('')
    : `<span class="pill">${escapeHtml(tr('empty.noActiveStandards'))}</span>`;

  return `
    <div class="heroGrid">
      <section class="heroCard">
        <div class="reportBadge">${escapeHtml(config.badge)}</div>
        <h2>${escapeHtml(tr('page1.executiveDashboard'))}</h2>
        <p>${escapeHtml(config.subtitle)}</p>

        <div class="periodBox">
          <span>${escapeHtml(tr('page1.evaluatedPeriod'))}</span>
          <strong>${escapeHtml(data.period || tr('empty.noCurrentPeriod'))}</strong>
        </div>
      </section>

      <section class="scoreCard">
        <span>${escapeHtml(config.scoreLabel)}</span>
        <strong>${fmtPercent(score)}</strong>
        <em>${escapeHtml(getGeneralTone(score))}</em>
        <p>${escapeHtml(shortSummary)}</p>
      </section>
    </div>

    <div class="infoGrid">
      ${card(tr('page1.reportIdentification'), `
        <div class="infoLine"><span>${escapeHtml(tr('page1.company'))}</span><strong>${escapeHtml(data.tenant?.name || 'Cliente')}</strong></div>
        <div class="infoLine"><span>${escapeHtml(tr('page1.reportType'))}</span><strong>${escapeHtml(config.badge)}</strong></div>
        <div class="infoLine"><span>${escapeHtml(tr('page1.activeStandards'))}</span><div class="pillWrap">${standardsHtml}</div></div>
      `)}

      ${card(tr('page1.executivePriority'), `
        <p class="bodyText">${escapeHtml(cleanText(ai.headline || shortSummary, 240))}</p>
        ${bulletList(asArray(ai.priorities).slice(0, 3))}
      `)}
    </div>

    <div class="metricGrid">
      ${miniMetric(tr('page1.overallCompliance'), fmtPercent(score), getGeneralTone(score))}
      ${miniMetric(tr('page1.evaluatedControls'), fmtNumber(controls.total_controls), tr('page1.totalCoverage'))}
      ${miniMetric(tr('page1.healthy'), fmtNumber(controls.healthy_controls), `${controls.healthy_percent || 0}%`)}
      ${miniMetric(tr('page1.attention'), fmtNumber(controls.warning_controls), `${controls.warning_percent || 0}%`, 'warning')}
      ${miniMetric(tr('page1.deteriorated'), fmtNumber(controls.critical_controls), `${controls.critical_percent || 0}%`, 'danger')}
      ${miniMetric(tr('page1.pendingEvidence'), fmtNumber(evidences.pending_evidences), tr('page1.managementRequired'), 'warning')}
      ${miniMetric(tr('page1.openFindings'), fmtNumber(findings.open_findings), tr('page1.followUp'))}
      ${miniMetric(tr('page1.criticalRisks'), fmtNumber(risks.critical_risks || risks.high_risks || 0), tr('page1.exposure'))}
    </div>
  `;
}

function renderAiPage(data) {
  const ai = data.ai_report_addendum || {};
  const fallbackSummary = tr('ai.defaultSummary');
  const summary = cleanText(ai.summary || fallbackSummary, 650);

  return `
    <div class="pageTitleBlock">
      <span>${escapeHtml(tr('ai.kicker'))}</span>
      <h2>${escapeHtml(tr('ai.title'))}</h2>
      <p>${escapeHtml(tr('ai.subtitle'))}</p>
    </div>

    ${card(ai.headline || tr('ai.summaryTitle'), `
      <p class="bodyText">${escapeHtml(summary)}</p>
      <div class="sourceTag">${escapeHtml(tr('ai.source'))}: ${escapeHtml(ai.source || tr('ai.defaultSource'))}</div>
    `, 'wideCard')}

    <div class="twoCol">
      ${card(tr('ai.recommendedPriorities'), bulletList(ai.priorities))}
      ${card(tr('ai.executiveRisks'), bulletList(ai.risks))}
    </div>

    <div class="twoCol">
      ${card(tr('ai.suggestedDecisions'), bulletList(ai.decisions))}
      ${card(tr('ai.recommendedUse'), bulletList([
        tr('ai.use.1'),
        tr('ai.use.2'),
        tr('ai.use.3'),
      ]))}
    </div>
  `;
}


function renderAuditSummaryPage(data) {
  const auditData = data.audit_summary || {};
  const summary = auditData.summary || {};
  const next = auditData.next_audit || null;
  const recent = asArray(auditData.recent_audits).slice(0, 8);
  const execution = data.audit_execution_summary || {};
  const reviews = execution.reviews || {};
  const latestAiRun = execution.latest_ai_auditor_run || null;
  const aiAnalysis = getAiAuditorAnalysis(latestAiRun);
  const aiDiagnosis = aiAnalysis.diagnosis || {};
  const aiCriticalControls = asArray(aiAnalysis.critical_controls).slice(0, 5);
  const aiEvidenceGaps = asArray(aiAnalysis.evidence_gaps).slice(0, 5);
  const aiRecommendations = [
    ...aiRecommendationTitles(aiAnalysis.recommended_findings),
    ...aiRecommendationTitles(aiAnalysis.recommended_actions),
    ...aiRecommendationTitles(aiAnalysis.recommended_evidence_requests),
    ...aiRecommendationTitles(aiAnalysis.governance_warnings),
    ...aiRecommendationTitles(aiAnalysis.suggested_next_steps),
  ].slice(0, 8);

  const rows = recent.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.iso || '-')}</strong></td>
      <td>${escapeHtml(formatDateEs(row.start_date))}</td>
      <td>${escapeHtml(formatDateEs(row.end_date))}</td>
      <td>${escapeHtml(row.auditor_name || '-')}</td>
      <td>${escapeHtml(row.auditor_type || '-')}</td>
      <td>${statusBadge(row.normalized_status || row.status || tr('status.pending'))}</td>
      <td>${row.report_file ? statusBadge(tr('status.withReport')) : statusBadge(tr('status.withoutReport'))}</td>
    </tr>
  `);

  return `
    <div class="pageTitleBlock">
      <span>${escapeHtml(tr('audit.kicker'))}</span>
      <h2>${escapeHtml(tr('audit.title'))}</h2>
      <p>${escapeHtml(tr('audit.subtitle'))}</p>
    </div>

    <div class="metricGrid">
      ${miniMetric(tr('audit.total'), fmtNumber(summary.total), tr('audit.registered'))}
      ${miniMetric(tr('audit.pending'), fmtNumber(summary.pendientes), tr('audit.planned'), 'warning')}
      ${miniMetric(tr('audit.running'), fmtNumber(summary.en_ejecucion), tr('audit.noKpiDeterioration'), 'warning')}
      ${miniMetric(tr('audit.completed'), fmtNumber(summary.completadas), tr('audit.formalClosure'))}
      ${miniMetric(tr('audit.withReport'), fmtNumber(summary.con_informe), tr('audit.documentarySupport'))}
      ${miniMetric(tr('audit.withoutReport'), fmtNumber(summary.sin_informe), tr('audit.requiresUpload'), 'warning')}
      ${miniMetric(tr('audit.derivedFindings'), fmtNumber(summary.hallazgos), tr('audit.linked'))}
      ${miniMetric(tr('audit.derivedActions'), fmtNumber(summary.acciones), tr('page1.followUp'))}
    </div>

    <div class="twoCol" style="margin-top:5mm;">
      ${card(tr('audit.nextAudit'), next ? `
        <div class="infoLine"><span>${escapeHtml(tr('audit.standard'))}</span><strong>${escapeHtml(next.iso || '-')}</strong></div>
        <div class="infoLine"><span>${escapeHtml(tr('audit.startDate'))}</span><strong>${escapeHtml(formatDateEs(next.start_date))}</strong></div>
        <div class="infoLine"><span>${escapeHtml(tr('audit.auditor'))}</span><strong>${escapeHtml(next.auditor_name || '-')}</strong></div>
        <div class="infoLine"><span>${escapeHtml(tr('audit.status'))}</span>${statusBadge(next.normalized_status || next.status || tr('status.pending'))}</div>
      ` : `
        <div class="emptyBox">${escapeHtml(tr('empty.noUpcomingAudits'))}</div>
      `)}

      ${card(tr('audit.kpiImpactCriteria'), `
        <p class="bodyText">
          ${escapeHtml(auditData.note || tr('audit.kpiImpactNote'))}
        </p>
        ${bulletList([
          tr('audit.criteria.1'),
          tr('audit.criteria.2'),
          tr('audit.criteria.3'),
        ])}
      `)}
    </div>

    ${card(tr('audit.operationalByControl'), `
      <div class="metricGrid three">
        ${miniMetric(tr('audit.reviewedControls'), fmtNumber(reviews.total_reviews), tr('audit.auditChecklist'))}
        ${miniMetric(tr('audit.nonConforming'), fmtNumber(reviews.no_conformes), tr('audit.formalResult'), 'danger')}
        ${miniMetric(tr('audit.noEvidence'), fmtNumber(reviews.sin_evidencia), tr('audit.requiresEvidence'), 'warning')}
      </div>

      ${latestAiRun ? `
        <div class="emptyBox" style="margin-top:4mm;">
          <strong>${escapeHtml(tr('audit.latestAiRun'))}:</strong>
          ${escapeHtml(formatDateTimeEs(latestAiRun.created_at))}
        </div>

        <div class="metricGrid three" style="margin-top:4mm;">
          ${miniMetric(
            tr('audit.readinessScore'),
            fmtPercent(aiAnalysis.readiness_score ?? aiDiagnosis.readiness_score),
            latestAiRun.standard_code || 'IA Auditor'
          )}
          ${miniMetric(
            tr('audit.checklistReview'),
            fmtPercent(aiAnalysis.reviewed_percent ?? aiDiagnosis.reviewed_percent),
            tr('audit.reviewedControls')
          )}
          ${miniMetric(
            tr('audit.conformity'),
            fmtPercent(aiAnalysis.conformity_percent ?? aiDiagnosis.conformity_percent),
            tr('audit.noHumanReplacement')
          )}
        </div>

        <p class="bodyText" style="margin-top:4mm;">
          ${escapeHtml(cleanText(aiAnalysis.executive_summary || latestAiRun.summary || tr('empty.noAiSummary'), 420))}
        </p>

        <div class="twoCol" style="margin-top:4mm;">
          ${card(tr('audit.prioritizedCriticalControls'), bulletList(
            aiCriticalControls.map((item) =>
              `${item.control_title || item.control_code || 'Control'}: ${item.result || tr('status.noResult')} (${item.risk_level || tr('status.risk')} ${item.risk_score || 0})`
            )
          ))}

          ${card(tr('audit.evidenceGaps'), bulletList(
            aiEvidenceGaps.map((item) =>
              `${item.control_title || item.control_code || 'Control'}: ${item.reason || tr('status.requiresEvidence')}`
            )
          ))}
        </div>

        ${card(tr('audit.aiRecommendations'), bulletList(aiRecommendations), 'wideCard')}

        <div class="emptyBox" style="margin-top:4mm;">
          ${escapeHtml(
            aiAnalysis.human_approval_note ||
              tr('audit.humanApprovalNote')
          )}
        </div>
      ` : `
        <div class="emptyBox" style="margin-top:4mm;">
          <strong>${escapeHtml(tr('audit.latestAiRun'))}:</strong>
          ${escapeHtml(tr('empty.noAiRun'))}
        </div>
      `}
    `, 'wideCard')}

    ${card(tr('audit.recentAudits'), table(
      [tr('audit.table.iso'), tr('audit.table.start'), tr('audit.table.end'), tr('audit.table.auditor'), tr('audit.table.type'), tr('audit.table.status'), tr('audit.table.report')],
      rows,
      tr('empty.noRecentAudits')
    ), 'wideCard')}
  `;
}


function renderHealthPage(data) {
  const health = firstArray(data, [
    'iso_health_by_standard',
    'health_by_standard',
    'compliance_by_standard',
    'complianceByStandard',
    'standards_health',
    'standards',
  ]).slice(0, 7);

  const risks = firstArray(data, [
    'top_risks',
    'critical_risks',
    'risks',
    'risk_rows',
  ]).slice(0, 6);

  const healthRows = health.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.code || row.standard_code || '-')}</strong></td>
      <td>${escapeHtml(row.name || row.standard_name || '-')}</td>
      <td><strong>${fmtPercent(row.score || row.health_score || row.average_score)}</strong></td>
      <td>${fmtNumber(row.controls_count || row.total_controls)}</td>
      <td>${fmtNumber(row.healthy_controls)}</td>
      <td>${fmtNumber(row.warning_controls)}</td>
      <td>${fmtNumber(row.critical_controls)}</td>
      <td>${fmtNumber(row.pending_evidence_count || row.pending_evidences)}</td>
    </tr>
  `);

  const riskRows = risks.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.code || row.risk_code || '-')}</strong></td>
      <td>${escapeHtml(row.title || row.description || row.name || '-')}</td>
      <td>${escapeHtml(row.asset_name || row.asset || '-')}</td>
      <td>${escapeHtml(row.probability || '-')}</td>
      <td>${statusBadge(row.level || row.risk_level || '-')}</td>
    </tr>
  `);

  return `
    <div class="pageTitleBlock">
      <span>${escapeHtml(tr('health.kicker'))}</span>
      <h2>${escapeHtml(tr('health.title'))}</h2>
      <p>${escapeHtml(tr('health.subtitle'))}</p>
    </div>

    ${card(tr('health.isoByStandard'), table(
      [tr('health.table.standard'), tr('health.table.name'), tr('health.table.health'), tr('health.table.controls'), tr('health.table.healthy'), tr('health.table.attention'), tr('health.table.deteriorated'), tr('health.table.pendingEvidenceShort')],
      healthRows,
      tr('empty.noIsoHealth')
    ), 'wideCard')}

    ${card(tr('health.criticalRisksExposure'), table(
      [tr('health.table.risk'), tr('health.table.description'), tr('health.table.asset'), tr('health.table.probabilityShort'), tr('health.table.level')],
      riskRows,
      tr('empty.noCriticalRisks')
    ), 'wideCard')}
  `;
}

function renderRecommendationsPage(data) {
  const ai = data.ai_report_addendum || {};
  const compliance = firstArray(data, [
    'compliance_by_standard',
    'complianceByStandard',
    'iso_health_by_standard',
    'health_by_standard',
    'standards',
  ]).slice(0, 6);

  const recommendations = dedupe([
    ...(ai.priorities || []),
    ...(data.recommendations || []),
    ...(data.executive_recommendations || []),
  ], 8);

  return `
    <div class="pageTitleBlock">
      <span>${escapeHtml(tr('recommendations.kicker'))}</span>
      <h2>${escapeHtml(tr('recommendations.title'))}</h2>
      <p>${escapeHtml(tr('recommendations.subtitle'))}</p>
    </div>

    <div class="twoCol">
      ${card(tr('recommendations.executive'), bulletList(recommendations), 'tallCard')}

      ${card(tr('recommendations.complianceByStandard'), `
        <div class="barList">
          ${
            compliance.length
              ? compliance.map((row) => {
                  const code = row.code || row.standard_code || '-';
                  const score = clampPercent(row.score || row.health_score || row.average_score);
                  return `
                    <div class="barRow">
                      <div class="barLabel">${escapeHtml(code)}</div>
                      <div class="barTrack"><div class="barFill" style="width:${score}%"></div></div>
                      <div class="barValue">${score.toFixed(1)}%</div>
                    </div>
                  `;
                }).join('')
              : `<div class="emptyBox">${escapeHtml(tr('empty.noStandardData'))}</div>`
          }
        </div>
      `, 'tallCard')}
    </div>
  `;
}

function renderKpiPages(data) {
  const kpis = firstArray(data, [
    'recent_kpis',
    'kpis',
    'kpi_snapshots',
    'kpiRows',
  ]);

  return chunk(kpis, 12).map((items, index) => {
    const rows = items.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.code || '-')}</strong></td>
        <td>${escapeHtml(row.name || row.kpi_name || '-')}</td>
        <td>${escapeHtml(row.standard_code || '-')}</td>
        <td><strong>${fmtPercent(row.value || row.score || row.kpi_value)}</strong></td>
        <td>${statusBadge(row.status_color || row.status || '-')}</td>
        <td>${escapeHtml(formatDateEs(row.calculated_at || row.created_at || row.date))}</td>
      </tr>
    `);

    return `
      <div class="pageTitleBlock">
        <span>${escapeHtml(tr('kpi.kicker'))}</span>
        <h2>${escapeHtml(tr('kpi.recentTitle'))}${index > 0 ? ' (' + escapeHtml(tr('kpi.continuation')) + ')' : ''}</h2>
        <p>Indicadores calculados sobre el alcance activo del tenant.</p>
      </div>

      ${card('Indicadores recientes', table(
        ['KPI', 'Nombre', 'Norma', 'Valor', 'Estado', 'Fecha'],
        rows,
        'No existen KPIs calculados para este periodo.'
      ), 'wideCard')}
    `;
  });
}

function renderEvidencePages(data) {
  const evidences = firstArray(data, [
    'recent_evidences',
    'evidences',
    'evidence_rows',
  ]);

  return chunk(evidences, 10).map((items, index) => {
    const rows = items.map((row) => `
      <tr>
        <td>${escapeHtml(row.iso_code || row.standard_code || '-')}</td>
        <td>${escapeHtml(row.clause || row.control_clause || '-')}</td>
        <td>${escapeHtml(row.file_name || row.name || 'Sin archivo')}</td>
        <td>${escapeHtml(row.evidence_type || row.type || '-')}</td>
        <td>${statusBadge(row.validated ? 'Validada' : row.status || 'Pendiente')}</td>
        <td>${escapeHtml(formatDateEs(row.changed_at || row.created_at || row.updated_at))}</td>
      </tr>
    `);

    return `
      <div class="pageTitleBlock">
        <span>${escapeHtml(tr('evidence.kicker'))}</span>
        <h2>Evidencias recientes con contexto útil${index > 0 ? ' (continuación)' : ''}</h2>
        <p>${escapeHtml(tr('evidence.subtitle'))}</p>
      </div>

      ${card(tr('evidence.recent'), table(
        [tr('evidence.table.iso'), tr('evidence.table.clause'), tr('evidence.table.file'), tr('evidence.table.type'), tr('evidence.table.status'), tr('evidence.table.date')],
        rows,
        'No existen evidencias recientes.'
      ), 'wideCard')}
    `;
  });
}

function renderActionsAndFindingsPage(data) {
  const actions = firstArray(data, [
    'open_actions',
    'action_plans',
    'actions',
    'action_rows',
  ]).slice(0, 8);

  const findings = firstArray(data, [
    'open_findings',
    'findings',
    'finding_rows',
  ]).slice(0, 6);

  const actionRows = actions.map((row) => `
    <tr>
      <td>${escapeHtml(row.iso_code || row.standard_code || '-')}</td>
      <td>${escapeHtml(row.title || row.name || '-')}</td>
      <td>${statusBadge(row.priority || '-')}</td>
      <td>${escapeHtml(row.status || '-')}</td>
      <td>${escapeHtml(row.owner || row.responsible || '-')}</td>
      <td>${escapeHtml(formatDateEs(row.due_date))}</td>
    </tr>
  `);

  const findingRows = findings.map((row) => `
    <tr>
      <td>${escapeHtml(row.iso_code || row.standard_code || '-')}</td>
      <td>${escapeHtml(row.title || row.name || '-')}</td>
      <td>${statusBadge(row.severity || '-')}</td>
      <td>${escapeHtml(row.status || '-')}</td>
      <td>${escapeHtml(row.owner || row.responsible || '-')}</td>
      <td>${escapeHtml(formatDateEs(row.due_date))}</td>
    </tr>
  `);

  return `
    <div class="pageTitleBlock">
      <span>${escapeHtml(tr('operations.kicker'))}</span>
      <h2>${escapeHtml(tr('operations.title'))}</h2>
      <p>${escapeHtml(tr('operations.subtitle'))}</p>
    </div>

    ${card(tr('operations.openActions'), table(
      [tr('operations.table.iso'), tr('operations.table.action'), tr('operations.table.priority'), tr('operations.table.status'), tr('operations.table.owner'), tr('operations.table.dueDate')],
      actionRows,
      tr('operations.emptyActions')
    ), 'wideCard')}

    ${card(tr('operations.openFindings'), table(
      [tr('operations.table.iso'), tr('operations.table.finding'), tr('operations.table.severity'), tr('operations.table.status'), tr('operations.table.owner'), tr('operations.table.dueDate')],
      findingRows,
      tr('operations.emptyFindings')
    ), 'wideCard')}
  `;
}

function renderLifecyclePages(data) {
  const lifecycle = asArray(data.lifecycle_history);

  return chunk(lifecycle, 7).map((items, index) => {
    const rows = items.map((row) => `
      <tr>
        <td>${escapeHtml(formatDateTimeEs(row.requested_at || row.reviewed_at))}</td>
        <td><strong>${escapeHtml(row.standard_code || '-')}</strong></td>
        <td>${escapeHtml(row.operation_name || row.operation_id || '-')}</td>
        <td>
          <strong>${escapeHtml(row.from_stage_name || row.from_stage_code || 'Sin etapa')}</strong>
          <div class="tinyMuted">hacia</div>
          <strong>${escapeHtml(row.to_stage_name || row.to_stage_code || 'Sin etapa')}</strong>
        </td>
        <td>${statusBadge(row.request_status_label || row.request_status || 'Pendiente')}</td>
        <td>${escapeHtml(row.requested_by_name || row.requested_by_email || 'No informado')}</td>
        <td>${escapeHtml(row.reviewed_by_name || row.reviewed_by_email || 'Pendiente')}</td>
        <td>${escapeHtml(cleanText([row.request_reason, row.review_comment].filter(Boolean).join(' · '), 130))}</td>
      </tr>
    `);

    return `
      <div class="pageTitleBlock">
        <span>${escapeHtml(tr('lifecycle.kicker'))}</span>
        <h2>Historial de Ciclo de Vida${index > 0 ? ' (continuación)' : ''}</h2>
        <p>${escapeHtml(tr('lifecycle.subtitle'))}</p>
      </div>

      <div class="metricGrid three">
        ${miniMetric(tr('lifecycle.includedMoves'), fmtNumber(lifecycle.length), tr('lifecycle.latestRecords'))}
        ${miniMetric(tr('lifecycle.auditUse'), tr('lifecycle.evidence'), tr('lifecycle.systemGovernance'))}
        ${miniMetric(tr('lifecycle.coverage'), tr('lifecycle.lifecycle'), tr('lifecycle.traceability'))}
      </div>

      ${card(tr('lifecycle.registeredMoves'), table(
        ['Fecha', 'Norma', 'Operación', 'Movimiento', 'Estado', 'Solicitado por', 'Revisado por', 'Motivo / comentario'],
        rows,
        tr('lifecycle.empty')
      ), 'wideCard')}
    `;
  });
}

function renderStyles() {
  return `
    <style>
      @page {
        size: Letter;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .pdfPage {
        width: 216mm;
        height: 279mm;
        min-height: 279mm;
        max-height: 279mm;
        overflow: hidden;
        position: relative;
        background: #ffffff;
        page-break-after: always;
      }

      .pdfPage:last-child {
        page-break-after: auto;
      }

      .pdfHeader {
        height: 30mm;
        background: #0B2F4F;
        color: #ffffff;
        display: grid;
        grid-template-columns: 64mm 1fr 64mm;
        gap: 4mm;
        align-items: center;
        padding: 2mm 8mm;
      }

      .headerTitle {
        text-align: center;
        min-width: 0;
      }

      .headerTitle h1 {
        margin: 0 0 2mm;
        color: #ffffff;
        font-size: 18px;
        line-height: 1.05;
        font-weight: 800;
      }

      .headerTitle p {
        margin: 0;
        color: #dbeafe;
        font-size: 10px;
      }

      .logoBox {
        width: 64mm;
        height: 26mm;
        background: #0B2F4F;
        border-radius: 0;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        overflow: hidden;
      }

      .logoRight {
        justify-content: flex-end;
      }

      .logoBox img {
        display: block;
        width: auto;
        height: auto;
        max-width: 62mm;
        max-height: 27mm;
        object-fit: contain;
      }

      .logoFallbackText,
      .logoFallback span {
        display: none;
        color: #ffffff;
        font-size: 12px;
        line-height: 1.1;
        font-weight: 800;
        text-align: left;
      }

      .logoFallback span {
        display: block;
      }

      .pdfContent {
        height: 234mm;
        max-height: 234mm;
        overflow: hidden;
        padding: 7mm 10mm 5mm;
        background: #f8fafc;
      }

      .pdfFooter {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 15mm;
        background: #0B2F4F;
        color: #ffffff;
        display: grid;
        grid-template-columns: 1.15fr 1.1fr 0.55fr;
        gap: 6mm;
        align-items: center;
        padding: 3.2mm 10mm;
        font-size: 9px;
      }

      .footerCenter {
        text-align: center;
        color: #dbeafe;
      }

      .footerRight {
        text-align: right;
        font-weight: 800;
      }

      .pageTitleBlock {
        margin-bottom: 5mm;
      }

      .pageTitleBlock span,
      .reportBadge {
        display: inline-flex;
        border-radius: 999px;
        background: #e0f2fe;
        color: #075985;
        padding: 3px 8px;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .pageTitleBlock h2 {
        margin: 3mm 0 1mm;
        font-size: 22px;
        line-height: 1.05;
        color: #0B2F4F;
      }

      .pageTitleBlock p {
        margin: 0;
        color: #475569;
        font-size: 11.5px;
      }

      .heroGrid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 5mm;
        margin-bottom: 5mm;
      }

      .heroCard,
      .scoreCard,
      .card,
      .metricCard {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
      }

      .heroCard,
      .scoreCard {
        min-height: 48mm;
        padding: 6mm;
      }

      .heroCard h2 {
        margin: 4mm 0 2mm;
        color: #0B2F4F;
        font-size: 24px;
        line-height: 1.05;
      }

      .heroCard p,
      .bodyText {
        margin: 0;
        color: #334155;
        font-size: 11.5px;
        line-height: 1.45;
      }

      .periodBox {
        margin-top: 5mm;
        border-radius: 14px;
        background: #f1f5f9;
        padding: 4mm;
      }

      .periodBox span,
      .metricLabel,
      .infoLine span {
        display: block;
        color: #64748b;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .periodBox strong {
        display: block;
        margin-top: 1mm;
        color: #0f172a;
        font-size: 14px;
      }

      .scoreCard span {
        color: #64748b;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .scoreCard strong {
        display: block;
        margin: 3mm 0 0;
        color: #0B2F4F;
        font-size: 38px;
        line-height: 1;
      }

      .scoreCard em {
        display: inline-flex;
        margin: 2mm 0;
        border-radius: 999px;
        background: #fef3c7;
        color: #92400e;
        padding: 3px 9px;
        font-size: 10px;
        font-style: normal;
        font-weight: 800;
        text-transform: uppercase;
      }

      .scoreCard p {
        margin: 2mm 0 0;
        color: #334155;
        font-size: 11px;
        line-height: 1.35;
      }

      .infoGrid,
      .twoCol {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5mm;
        margin-bottom: 5mm;
      }

      .card {
        padding: 5mm;
        min-height: 42mm;
      }

      .wideCard {
        margin-bottom: 5mm;
      }

      .tallCard {
        min-height: 118mm;
      }

      .card h2 {
        margin: 0 0 3mm;
        color: #0B2F4F;
        font-size: 15px;
        line-height: 1.1;
      }

      .infoLine {
        margin-bottom: 3mm;
      }

      .infoLine strong {
        display: block;
        margin-top: 1mm;
        color: #0f172a;
        font-size: 12px;
      }

      .pillWrap {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 1mm;
      }

      .pill {
        display: inline-flex;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        padding: 3px 7px;
        font-size: 9px;
        font-weight: 800;
      }

      .metricGrid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4mm;
      }

      .metricGrid.three {
        grid-template-columns: repeat(3, 1fr);
        margin-bottom: 5mm;
      }

      .metricCard {
        min-height: 25mm;
        padding: 4mm;
      }

      .metricValue {
        margin-top: 2mm;
        color: #0B2F4F;
        font-size: 22px;
        line-height: 1;
        font-weight: 800;
      }

      .metricSub {
        margin-top: 1.5mm;
        color: #64748b;
        font-size: 9.5px;
      }

      .metricCard.warning .metricValue {
        color: #b45309;
      }

      .metricCard.danger .metricValue {
        color: #b91c1c;
      }

      .bulletList {
        margin: 0;
        padding-left: 17px;
        color: #334155;
        font-size: 11px;
        line-height: 1.45;
      }

      .bulletList li {
        margin-bottom: 2mm;
      }

      .emptyBox {
        border-radius: 12px;
        background: #f8fafc;
        color: #64748b;
        font-size: 11px;
        padding: 4mm;
      }

      .sourceTag {
        display: inline-flex;
        margin-top: 3mm;
        border-radius: 999px;
        background: #f1f5f9;
        color: #475569;
        padding: 3px 8px;
        font-size: 9px;
        font-weight: 800;
      }

      .tableBox {
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        overflow: hidden;
        background: #ffffff;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th {
        background: #f1f5f9;
        color: #334155;
        font-size: 8.4px;
        text-align: left;
        padding: 5px;
        border-bottom: 1px solid #e2e8f0;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      td {
        color: #334155;
        font-size: 8.8px;
        line-height: 1.25;
        padding: 5px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: top;
        word-break: break-word;
      }

      tr:last-child td {
        border-bottom: none;
      }

      .emptyCell {
        text-align: center;
        color: #64748b;
        padding: 12px;
      }

      .badge {
        display: inline-flex;
        border-radius: 999px;
        padding: 2px 6px;
        font-size: 8px;
        font-weight: 800;
        border: 1px solid #cbd5e1;
        color: #475569;
        background: #f8fafc;
      }

      .badgeGreen {
        border-color: #86efac;
        color: #047857;
        background: #ecfdf5;
      }

      .badgeYellow {
        border-color: #fcd34d;
        color: #92400e;
        background: #fffbeb;
      }

      .badgeRed {
        border-color: #fca5a5;
        color: #b91c1c;
        background: #fef2f2;
      }

      .barList {
        display: grid;
        gap: 3mm;
      }

      .barRow {
        display: grid;
        grid-template-columns: 28mm 1fr 18mm;
        gap: 3mm;
        align-items: center;
      }

      .barLabel,
      .barValue {
        font-size: 11px;
        font-weight: 800;
        color: #334155;
      }

      .barTrack {
        height: 8px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }

      .barFill {
        height: 100%;
        background: linear-gradient(90deg, #0B2F4F, #2b6cb0);
      }

      .tinyMuted {
        color: #64748b;
        font-size: 8px;
        margin: 1px 0;
      }
    </style>
  `;
}

function renderExecutivePremiumTemplate(data = {}, options = {}) {
  const requestedLocale = options?.locale || data?.locale || data?.metadata?.locale || data?.report_locale || 'es';
  setActiveReportLocale(requestedLocale);

  const tenant = data.tenant || {};
  const config = getReportConfig(data.report_type_code);
  const title = data.report_title || config.title;
  const generatedAt = data.generated_at || data.generatedAt || new Date();

  const pageContents = [
    renderPage1(data),
    renderAiPage(data),
    renderAuditSummaryPage(data),
    renderHealthPage(data),
    renderRecommendationsPage(data),
    ...renderKpiPages(data),
    ...renderEvidencePages(data),
    renderActionsAndFindingsPage(data),
    ...renderLifecyclePages(data),
  ].filter(Boolean);

  const totalPages = pageContents.length;

  const pagesHtml = pageContents
    .map((content, index) =>
      pageShell({
        tenant,
        title,
        generatedAt,
        content,
        pageNumber: index + 1,
        totalPages,
        label: config.badge,
      })
    )
    .join('');

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        ${renderStyles()}
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;
}

module.exports = {
  renderExecutivePremiumTemplate,
};
