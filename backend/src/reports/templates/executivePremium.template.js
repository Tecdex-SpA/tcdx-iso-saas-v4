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
  return toNumber(value, 0).toLocaleString('es-CL');
}

function fmtPercent(value) {
  return `${clampPercent(value).toFixed(1)}%`;
}

function formatDateEs(date = new Date()) {
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

function formatDateTimeEs(date = new Date()) {
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
  const configs = {
    executive_summary: {
      title: 'Resumen Ejecutivo de Cumplimiento',
      badge: 'Gerencia',
      subtitle: 'Visión gerencial del cumplimiento, riesgos, KPIs, evidencias y prioridades de decisión.',
      scoreLabel: 'Score Ejecutivo',
    },
    audit_report: {
      title: 'Informe para Auditoría',
      badge: 'Auditoría',
      subtitle: 'Trazabilidad de controles, evidencias, hallazgos y preparación de auditoría.',
      scoreLabel: 'Preparación Auditoría',
    },
    control_status: {
      title: 'Informe de Control de Estado',
      badge: 'Control operativo',
      subtitle: 'Seguimiento operativo de controles, salud ISO, acciones y prioridades de remediación.',
      scoreLabel: 'Salud de Control',
    },
    platform_client_monthly: {
      title: 'Informe Mensual de Plataforma',
      badge: 'Plataforma cliente',
      subtitle: 'Estado mensual del cliente, módulos activos, actividad y acompañamiento.',
      scoreLabel: 'Estado Cliente',
    },
  };

  return configs[reportTypeCode] || configs.executive_summary;
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
  if (safe >= 85) return 'Saludable';
  if (safe >= 65) return 'Atención';
  return 'Crítico';
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
        <p>Fecha de emisión: ${escapeHtml(formatDateEs(generatedAt || new Date()))}</p>
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
        <span> Todos los derechos reservados.</span>
      </div>

      <div class="footerCenter">
        Documento confidencial · Generado por TCDX by Tecdex
      </div>

      <div class="footerRight">
        Página ${pageNumber} de ${totalPages}
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
    return `<div class="emptyBox">No existen observaciones priorizadas para este bloque.</div>`;
  }

  return `
    <ul class="bulletList">
      ${safe.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function table(headers, rows, emptyMessage = 'Sin datos disponibles') {
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
      `El periodo evaluado registra un score consolidado de ${score}%. Se recomienda priorizar evidencia, responsables y fechas de cierre.`,
    320
  );

  const standardsHtml = standards.length
    ? standards.map((standard) => `<span class="pill">${escapeHtml(standard.code || standard.standard_code || standard)}</span>`).join('')
    : '<span class="pill">Sin normas activas</span>';

  return `
    <div class="heroGrid">
      <section class="heroCard">
        <div class="reportBadge">${escapeHtml(config.badge)}</div>
        <h2>Tablero Ejecutivo de Cumplimiento</h2>
        <p>${escapeHtml(config.subtitle)}</p>

        <div class="periodBox">
          <span>Periodo evaluado</span>
          <strong>${escapeHtml(data.period || 'Periodo actual')}</strong>
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
      ${card('Individualización del informe', `
        <div class="infoLine"><span>Empresa</span><strong>${escapeHtml(data.tenant?.name || 'Cliente')}</strong></div>
        <div class="infoLine"><span>Tipo de informe</span><strong>${escapeHtml(config.badge)}</strong></div>
        <div class="infoLine"><span>Normas activas</span><div class="pillWrap">${standardsHtml}</div></div>
      `)}

      ${card('Prioridad ejecutiva', `
        <p class="bodyText">${escapeHtml(cleanText(ai.headline || shortSummary, 240))}</p>
        ${bulletList(asArray(ai.priorities).slice(0, 3))}
      `)}
    </div>

    <div class="metricGrid">
      ${miniMetric('Cumplimiento general', fmtPercent(score), getGeneralTone(score))}
      ${miniMetric('Controles evaluados', fmtNumber(controls.total_controls), 'Cobertura total')}
      ${miniMetric('Saludables', fmtNumber(controls.healthy_controls), `${controls.healthy_percent || 0}%`)}
      ${miniMetric('En atención', fmtNumber(controls.warning_controls), `${controls.warning_percent || 0}%`, 'warning')}
      ${miniMetric('Deteriorados', fmtNumber(controls.critical_controls), `${controls.critical_percent || 0}%`, 'danger')}
      ${miniMetric('Evidencias pendientes', fmtNumber(evidences.pending_evidences), 'Gestión requerida', 'warning')}
      ${miniMetric('Hallazgos abiertos', fmtNumber(findings.open_findings), 'Seguimiento')}
      ${miniMetric('Riesgos críticos', fmtNumber(risks.critical_risks || risks.high_risks || 0), 'Exposición')}
    </div>
  `;
}

function renderAiPage(data) {
  const ai = data.ai_report_addendum || {};
  const fallbackSummary = `El periodo evaluado debe gestionarse priorizando evidencia objetiva, controles en atención, hallazgos abiertos y trazabilidad del ciclo de vida.`;
  const summary = cleanText(ai.summary || fallbackSummary, 650);

  return `
    <div class="pageTitleBlock">
      <span>Lectura ejecutiva asistida por IA</span>
      <h2>Síntesis ejecutiva y decisiones recomendadas</h2>
      <p>Análisis complementario generado sobre los datos reales del sistema.</p>
    </div>

    ${card(ai.headline || 'Resumen ejecutivo IA', `
      <p class="bodyText">${escapeHtml(summary)}</p>
      <div class="sourceTag">Fuente: ${escapeHtml(ai.source || 'Motor IA TCDX')}</div>
    `, 'wideCard')}

    <div class="twoCol">
      ${card('Prioridades recomendadas', bulletList(ai.priorities))}
      ${card('Riesgos ejecutivos', bulletList(ai.risks))}
    </div>

    <div class="twoCol">
      ${card('Decisiones sugeridas', bulletList(ai.decisions))}
      ${card('Uso recomendado del informe', bulletList([
        'Revisar los puntos críticos con responsables de proceso.',
        'Convertir prioridades en planes de acción con fecha y responsable.',
        'Usar trazabilidad del ciclo de vida como evidencia de gobierno.',
      ]))}
    </div>
  `;
}


function renderAuditSummaryPage(data) {
  const auditData = data.audit_summary || {};
  const summary = auditData.summary || {};
  const next = auditData.next_audit || null;
  const recent = asArray(auditData.recent_audits).slice(0, 8);

  const rows = recent.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.iso || '-')}</strong></td>
      <td>${escapeHtml(formatDateEs(row.start_date))}</td>
      <td>${escapeHtml(formatDateEs(row.end_date))}</td>
      <td>${escapeHtml(row.auditor_name || '-')}</td>
      <td>${escapeHtml(row.auditor_type || '-')}</td>
      <td>${statusBadge(row.normalized_status || row.status || 'pendiente')}</td>
      <td>${row.report_file ? statusBadge('Con informe') : statusBadge('Sin informe')}</td>
    </tr>
  `);

  return `
    <div class="pageTitleBlock">
      <span>Auditorías</span>
      <h2>Estado ejecutivo de auditorías</h2>
      <p>Seguimiento de planificación, ejecución, cierre, hallazgos y acciones asociadas.</p>
    </div>

    <div class="metricGrid">
      ${miniMetric('Total auditorías', fmtNumber(summary.total), 'Registradas')}
      ${miniMetric('Pendientes', fmtNumber(summary.pendientes), 'Planificadas', 'warning')}
      ${miniMetric('En ejecución', fmtNumber(summary.en_ejecucion), 'No deterioran KPI', 'warning')}
      ${miniMetric('Completadas', fmtNumber(summary.completadas), 'Con cierre formal')}
      ${miniMetric('Con informe', fmtNumber(summary.con_informe), 'Respaldo documental')}
      ${miniMetric('Sin informe', fmtNumber(summary.sin_informe), 'Requiere carga', 'warning')}
      ${miniMetric('Hallazgos derivados', fmtNumber(summary.hallazgos), 'Vinculados')}
      ${miniMetric('Acciones derivadas', fmtNumber(summary.acciones), 'Seguimiento')}
    </div>

    <div class="twoCol" style="margin-top:5mm;">
      ${card('Próxima auditoría', next ? `
        <div class="infoLine"><span>Norma</span><strong>${escapeHtml(next.iso || '-')}</strong></div>
        <div class="infoLine"><span>Fecha inicio</span><strong>${escapeHtml(formatDateEs(next.start_date))}</strong></div>
        <div class="infoLine"><span>Auditor</span><strong>${escapeHtml(next.auditor_name || '-')}</strong></div>
        <div class="infoLine"><span>Estado</span>${statusBadge(next.normalized_status || next.status || 'pendiente')}</div>
      ` : `
        <div class="emptyBox">No hay auditorías próximas registradas.</div>
      `)}

      ${card('Criterio de impacto KPI', `
        <p class="bodyText">
          ${escapeHtml(auditData.note || 'Las auditorías en ejecución son trazabilidad operativa y no deterioran KPI hasta existir resultado formal.')}
        </p>
        ${bulletList([
          'Auditoría pendiente: planificación, no afecta score.',
          'Auditoría en ejecución: seguimiento operativo, no afecta score.',
          'Auditoría completada: puede generar hallazgos, acciones o evidencias que sí impactan salud y KPI.',
        ])}
      `)}
    </div>

    ${card('Auditorías recientes', table(
      ['ISO', 'Inicio', 'Término', 'Auditor', 'Tipo', 'Estado', 'Informe'],
      rows,
      'No existen auditorías recientes registradas.'
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
      <span>Salud y exposición</span>
      <h2>Salud ISO por norma y riesgos relevantes</h2>
      <p>Vista consolidada para priorizar decisiones gerenciales.</p>
    </div>

    ${card('Salud ISO por norma', table(
      ['Norma', 'Nombre', 'Salud', 'Controles', 'Saludables', 'Atención', 'Deteriorados', 'Evid. pend.'],
      healthRows,
      'No existen datos de salud ISO.'
    ), 'wideCard')}

    ${card('Riesgos críticos y exposición', table(
      ['Riesgo', 'Descripción', 'Activo', 'Prob.', 'Nivel'],
      riskRows,
      'No existen riesgos críticos registrados.'
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
      <span>Plan ejecutivo</span>
      <h2>Recomendaciones y foco gerencial</h2>
      <p>Elementos priorizados para seguimiento de comité o reunión ejecutiva.</p>
    </div>

    <div class="twoCol">
      ${card('Recomendaciones ejecutivas', bulletList(recommendations), 'tallCard')}

      ${card('Cumplimiento por norma', `
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
              : '<div class="emptyBox">No existen datos por norma.</div>'
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
        <span>KPIs</span>
        <h2>KPIs recientes para seguimiento gerencial${index > 0 ? ' (continuación)' : ''}</h2>
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
        <span>Evidencias</span>
        <h2>Evidencias recientes con contexto útil${index > 0 ? ' (continuación)' : ''}</h2>
        <p>Base documental reciente para respaldar controles, auditorías y reportes.</p>
      </div>

      ${card('Evidencias recientes', table(
        ['ISO', 'Cláusula', 'Archivo', 'Tipo', 'Estado', 'Fecha'],
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
      <span>Gestión operativa</span>
      <h2>Hallazgos y acciones abiertas</h2>
      <p>Seguimiento ejecutivo de brechas, responsables y vencimientos.</p>
    </div>

    ${card('Acciones abiertas relevantes', table(
      ['ISO', 'Acción', 'Prioridad', 'Estado', 'Responsable', 'Vence'],
      actionRows,
      'No existen acciones abiertas.'
    ), 'wideCard')}

    ${card('Hallazgos abiertos relevantes', table(
      ['ISO', 'Hallazgo', 'Severidad', 'Estado', 'Responsable', 'Vence'],
      findingRows,
      'No existen hallazgos abiertos.'
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
        <span>Trazabilidad auditable</span>
        <h2>Historial de Ciclo de Vida${index > 0 ? ' (continuación)' : ''}</h2>
        <p>Movimientos, aprobaciones, rechazos, responsables y comentarios de revisión.</p>
      </div>

      <div class="metricGrid three">
        ${miniMetric('Movimientos incluidos', fmtNumber(lifecycle.length), 'Últimos registros')}
        ${miniMetric('Uso auditor', 'Evidencia', 'Gobierno del sistema')}
        ${miniMetric('Cobertura', 'Ciclo de Vida', 'Trazabilidad')}
      </div>

      ${card('Movimientos registrados', table(
        ['Fecha', 'Norma', 'Operación', 'Movimiento', 'Estado', 'Solicitado por', 'Revisado por', 'Motivo / comentario'],
        rows,
        'No existen movimientos de ciclo de vida registrados.'
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

function renderExecutivePremiumTemplate(data = {}) {
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
