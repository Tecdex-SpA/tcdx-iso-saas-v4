function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateEs(date = new Date()) {
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

function getBaseUrl() {
  return (
    process.env.REPORT_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    'http://192.168.100.120:3000'
  ).replace(/\/+$/, '');
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

function fmtDate(value) {
  if (!value) return 'Sin fecha';
  return formatDateEs(value);
}

function normalizeText(value) {
  return asString(value).toLowerCase();
}

function dedupeStrings(items = [], limit = 12) {
  const seen = new Set();
  const result = [];

  for (const item of items.flat(Infinity)) {
    const value = asString(item);
    const key = normalizeText(value);

    if (!value || seen.has(key)) continue;

    seen.add(key);
    result.push(value);

    if (result.length >= limit) break;
  }

  return result;
}

function chunkArray(items, size) {
  const safeItems = asArray(items);
  const safeSize = Math.max(Number(size || 1), 1);
  const chunks = [];

  for (let i = 0; i < safeItems.length; i += safeSize) {
    chunks.push(safeItems.slice(i, i + safeSize));
  }

  return chunks;
}

function stripBadChars(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0000-\u001F\u007F-\u009F\uFFFE\uFFFF]/g, '')
    .replace(/[^\x20-\x7EÁÉÍÓÚáéíóúÑñÜü°%().,:;_+\-/ ]/g, '')
    .trim();
}

function cleanKpiCode(value) {
  const normalized = stripBadChars(value)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized) return '-';

  const match = normalized.match(/^(KPI)-?(HLT)-?(\d+)$/i);
  if (match) {
    return `KPI-HLT-${String(match[3]).padStart(3, '0')}`;
  }

  return normalized.toUpperCase();
}

function cleanKpiLabel(value) {
  return stripBadChars(value).replace(/\s+/g, ' ') || 'KPI sin nombre';
}

function translateStatusColor(value) {
  const normalized = normalizeText(value);

  if (['green', 'verde'].includes(normalized)) return 'Verde';
  if (['yellow', 'amarillo'].includes(normalized)) return 'Amarillo';
  if (['red', 'rojo'].includes(normalized)) return 'Rojo';
  if (['gray', 'grey', 'gris'].includes(normalized)) return 'Sin dato';

  return asString(value) || '-';
}

function getGeneralTone(score) {
  const safe = clampPercent(score);
  if (safe >= 85) return 'saludable';
  if (safe >= 65) return 'atencion';
  return 'critico';
}

function getGeneralToneLabel(score) {
  const tone = getGeneralTone(score);
  if (tone === 'saludable') return 'SALUDABLE';
  if (tone === 'atencion') return 'ATENCIÓN';
  return 'CRÍTICO';
}

function getReportConfig(reportTypeCode) {
  const configs = {
    executive_summary: {
      title: 'Resumen Ejecutivo de Cumplimiento',
      badge: 'Gerencia',
      pageOneTitle: 'Tablero Ejecutivo de Cumplimiento',
      subtitle:
        'Visión gerencial del cumplimiento, riesgos, hallazgos relevantes, KPIs y prioridades de decisión.',
      scoreLabel: 'Score Ejecutivo',
      focusTitle: 'Indicadores Ejecutivos',
    },
    audit_report: {
      title: 'Informe para Auditoría',
      badge: 'Auditoría',
      pageOneTitle: 'Tablero de Auditoría y Evidencias',
      subtitle:
        'Trazabilidad de controles, evidencias, hallazgos, acciones correctivas y preparación para auditoría.',
      scoreLabel: 'Preparación Auditoría',
      focusTitle: 'Indicadores de Auditoría',
    },
    control_status: {
      title: 'Informe de Control de Estado',
      badge: 'Control operativo',
      pageOneTitle: 'Tablero Operativo de Controles',
      subtitle:
        'Seguimiento operativo de controles, salud ISO, vencimientos, acciones abiertas y prioridades de remediación.',
      scoreLabel: 'Salud de Control',
      focusTitle: 'Indicadores Operativos',
    },
    platform_client_monthly: {
      title: 'Informe Mensual de Estado de Plataforma',
      badge: 'Plataforma cliente',
      pageOneTitle: 'Tablero Mensual de Plataforma',
      subtitle:
        'Estado mensual del cliente, módulos activos, usuarios, reportes generados, actividad y acompañamiento.',
      scoreLabel: 'Estado Cliente',
      focusTitle: 'Indicadores de Plataforma',
    },
  };

  return configs[reportTypeCode] || configs.executive_summary;
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
  } else {
    candidates.push(`${base}/${raw}`);
    candidates.push(`${base}/uploads/${raw}`);
    candidates.push(`${base}/uploads/logos/${raw}`);
    candidates.push(`${base}/uploads/tenants/${raw}`);
    candidates.push(`${base}/uploads/tenant-logos/${raw}`);
    candidates.push(`${base}/public/${raw}`);
  }

  candidates.push(raw);

  return [...new Set(candidates.filter(Boolean))];
}

function renderSmartLogo(rawSrc, fallbackText, className, imageAlt = '') {
  const candidates = buildImageCandidates(rawSrc);
  const first = candidates[0] || '';
  const fallback1 = candidates[1] || '';
  const fallback2 = candidates[2] || '';

  const safeFallbackText = escapeHtml(fallbackText || 'Logo');

  if (!first) {
    return `
      <div class="${className} logoHolder logoHolder--fallback">
        <div class="logoFallbackText">${safeFallbackText}</div>
      </div>
    `;
  }

  const onErrorParts = [
    "if(!this.dataset.try1 && this.dataset.fallback1){this.dataset.try1='1';this.src=this.dataset.fallback1;return;}",
    "if(!this.dataset.try2 && this.dataset.fallback2){this.dataset.try2='1';this.src=this.dataset.fallback2;return;}",
    "this.style.display='none';",
    "if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}",
  ];

  return `
    <div class="${className} logoHolder">
      <img
        src="${escapeHtml(first)}"
        alt="${escapeHtml(imageAlt || '')}"
        data-fallback1="${escapeHtml(fallback1)}"
        data-fallback2="${escapeHtml(fallback2)}"
        onerror="${onErrorParts.join('')}"
      />
      <div class="logoFallbackText" style="display:none;">${safeFallbackText}</div>
    </div>
  `;
}

function renderBrandLogo() {
  const brandLogo =
    process.env.REPORT_TCDX_LOGO_URL ||
    process.env.TCDX_LOGO_URL ||
    'http://192.168.100.130:3000/logo.png';

  if (brandLogo) {
    return renderSmartLogo(brandLogo, 'TCDX by Tecdex', 'brandLogo', 'TCDX by Tecdex');
  }

  return `
    <div class="brandLogo brandTextLockup">
      <div>TCDX by</div>
      <div>Tecdex</div>
    </div>
  `;
}

function renderClientLogo(tenant) {
  const name = asString(tenant?.name || 'Cliente');
  const logo =
    tenant?.report_logo_url ||
    tenant?.logo_url ||
    tenant?.logo ||
    tenant?.brand_logo_url ||
    '';

  return renderSmartLogo(logo, name, 'clientLogo', name);
}

function renderHeader({ tenant, reportTitle, generatedAt }) {
  return `
    <header class="header">
      ${renderBrandLogo()}

      <div class="headerCenter">
        <h1 class="documentTitle">${escapeHtml(reportTitle)}</h1>
        <div class="documentDate">
          Fecha de emisión: ${escapeHtml(formatDateEs(generatedAt))}
        </div>
      </div>

      ${renderClientLogo(tenant)}
    </header>
  `;
}

function renderFooter({
  rightsMessage,
  privacyMessage,
  footerText,
  pageNumber,
  totalPages,
}) {
  return `
    <footer class="footer">
      <div class="footerLine"></div>

      <div class="footerCol">
        <strong>${escapeHtml(rightsMessage)}</strong>
        <span class="footerMuted">${escapeHtml(footerText)}</span>
      </div>

      <div class="footerCol footerColCenter">
        <span class="footerMuted">${escapeHtml(privacyMessage)}</span>
      </div>

      <div class="footerCol footerColRight">
        <span class="pageNumber">Página ${pageNumber} de ${totalPages}</span>
      </div>
    </footer>
  `;
}

function renderPageShell({ header, footer, content }) {
  return `
    <section class="reportPage">
      ${header}
      <main class="pageContent">
        ${content}
      </main>
      ${footer}
    </section>
  `;
}

function renderSection(title, body, extraClass = '') {
  return `
    <section class="sectionCard ${extraClass}">
      <h2 class="sectionTitle">${escapeHtml(title)}</h2>
      ${body}
    </section>
  `;
}

function renderCompactSection(title, body, extraClass = '') {
  return renderSection(title, body, `compact ${extraClass}`.trim());
}

function renderEmpty(message) {
  return `<div class="emptyBox">${escapeHtml(message)}</div>`;
}

function renderBulletList(items, extraClass = '') {
  const safeItems = asArray(items).filter(Boolean);

  if (safeItems.length === 0) {
    return renderEmpty('No existen observaciones relevantes para este bloque.');
  }

  return `
    <ul class="bulletList ${extraClass}">
      ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function renderMetricList(items) {
  const safeItems = asArray(items).filter((item) => item && item.label);

  if (safeItems.length === 0) {
    return renderEmpty('No existen métricas disponibles.');
  }

  return safeItems
    .map(
      (item) => `
        <div class="metricLine">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
    )
    .join('');
}

function renderTable(headers, rowsHtml) {
  return `
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function renderStandardPills(standards) {
  const safeStandards = asArray(standards);

  if (safeStandards.length === 0) {
    return '<span class="pill">Sin normas activas registradas</span>';
  }

  return safeStandards
    .map((standard) => `<span class="pill">${escapeHtml(standard.code)}</span>`)
    .join('');
}

function shouldKeepInsight(text) {
  const value = normalizeText(text);

  if (!value) return false;
  if (/^iso[\w/.-]*\s*\(\d+([.,]\d+)?%\)$/.test(value)) return false;
  if (/^regularizar 0 /.test(value)) return false;
  if (/^tratar 0 /.test(value)) return false;
  if (/^disminuir 0 /.test(value)) return false;
  if (/^sin riesgos destacados/.test(value)) return false;
  if (/^sin decisiones sugeridas/.test(value)) return false;

  return true;
}

function normalizeInsights(items = [], limit = 6) {
  return dedupeStrings(asArray(items), limit).filter(shouldKeepInsight).slice(0, limit);
}

function renderRecommendations(items) {
  const safeItems = normalizeInsights(items, 8);

  if (safeItems.length === 0) {
    return renderEmpty('No existen recomendaciones priorizadas para este periodo.');
  }

  return safeItems
    .map(
      (item) => `
        <div class="recommendation">
          <div class="recommendationIcon">✓</div>
          <div>${escapeHtml(item)}</div>
        </div>
      `
    )
    .join('');
}

function renderKpiCards(kpis) {
  const safeKpis = asArray(kpis);

  return safeKpis
    .map(
      (kpi) => `
        <div class="kpiCard">
          <div class="kpiIcon">${escapeHtml(kpi.icon)}</div>
          <div class="kpiValue">${escapeHtml(kpi.value)}</div>
          <div class="kpiLabel">${escapeHtml(kpi.label)}</div>
          <div class="kpiSub">${escapeHtml(kpi.sub || '')}</div>
        </div>
      `
    )
    .join('');
}

function renderComplianceBars(items) {
  const safeItems = asArray(items);

  if (safeItems.length === 0) {
    return renderEmpty('No existen datos de cumplimiento por norma.');
  }

  return safeItems
    .map((item) => {
      const score = clampPercent(item.score);

      return `
        <div class="barRow">
          <div class="barLabel">${escapeHtml(item.code || '-')}</div>
          <div class="barTrack">
            <div class="barFill" style="width:${score}%"></div>
          </div>
          <div class="barValue">${score}%</div>
        </div>
      `;
    })
    .join('');
}

function renderDistribution(controls) {
  const healthyPercent = clampPercent(controls?.healthy_percent || 0);
  const warningPercent = clampPercent(controls?.warning_percent || 0);

  return `
    <div class="distribution">
      <div class="distributionCircle">
        <div class="distributionCenter">
          <div class="distributionTotal">${fmtNumber(controls?.total_controls || 0)}</div>
          <div class="distributionText">Total</div>
        </div>
      </div>

      <div class="distributionLegend">
        <div class="legendItem">
          <span class="legendDot greenDot"></span>
          <span>Saludables: ${controls?.healthy_percent || 0}% (${fmtNumber(
    controls?.healthy_controls || 0
  )})</span>
        </div>

        <div class="legendItem">
          <span class="legendDot yellowDot"></span>
          <span>En atención: ${controls?.warning_percent || 0}% (${fmtNumber(
    controls?.warning_controls || 0
  )})</span>
        </div>

        <div class="legendItem">
          <span class="legendDot redDot"></span>
          <span>Deteriorados: ${controls?.critical_percent || 0}% (${fmtNumber(
    controls?.critical_controls || 0
  )})</span>
        </div>
      </div>

      <style>
        .distributionCircle {
          background:
            conic-gradient(
              var(--secondary-color) 0 ${healthyPercent}%,
              #f59e0b ${healthyPercent}% ${healthyPercent + warningPercent}%,
              #ef4444 ${healthyPercent + warningPercent}% 100%
            );
        }
      </style>
    </div>
  `;
}

function renderAiHighlightCards(items, tone = 'default') {
  const safeItems = asArray(items).filter(Boolean);

  if (safeItems.length === 0) {
    return renderEmpty('No se generaron insights adicionales para este bloque.');
  }

  return `
    <div class="insightGrid">
      ${safeItems
        .map(
          (item) => `
            <div class="insightCard ${tone}">
              <div class="insightTitle">${escapeHtml(item.title || 'Insight')}</div>
              ${
                item.subtitle
                  ? `<div class="insightSubtitle">${escapeHtml(item.subtitle)}</div>`
                  : ''
              }
              ${
                item.body
                  ? `<div class="insightBody">${escapeHtml(item.body)}</div>`
                  : ''
              }
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderKnowledgeSourcePills(items) {
  const safeItems = asArray(items).filter(Boolean);

  if (safeItems.length === 0) {
    return renderEmpty('No se registraron fuentes normativas para este periodo.');
  }

  return `
    <div class="pillWrap">
      ${safeItems
        .map((item) => {
          const title = [item.norma, item.clausula_o_control, item.titulo]
            .filter(Boolean)
            .join(' · ');
          return `<span class="pill sourcePill">${escapeHtml(title || item.record_id || 'Fuente IA')}</span>`;
        })
        .join('')}
    </div>
  `;
}

function renderTopRisksRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="5">No existen riesgos registrados para este periodo.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td class="codeCell">${escapeHtml(row.code || '-')}</td>
          <td>${escapeHtml(row.title || 'Riesgo sin descripción')}</td>
          <td>${escapeHtml(row.asset_name || '-')}</td>
          <td>${escapeHtml(row.probability || '-')}</td>
          <td><span class="badgeDanger">${escapeHtml(row.level || '-')}</span></td>
        </tr>
      `
    )
    .join('');
}

function renderIsoHealthRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="9">No existen datos de salud ISO para este periodo.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td class="codeCell">${escapeHtml(row.code || '-')}</td>
          <td>${escapeHtml(row.name || row.code || '-')}</td>
          <td><strong>${fmtPercent(row.score)}</strong></td>
          <td>${fmtNumber(row.controls_count)}</td>
          <td>${fmtNumber(row.healthy_controls)}</td>
          <td>${fmtNumber(row.warning_controls)}</td>
          <td>${fmtNumber(row.critical_controls)}</td>
          <td>${fmtNumber(row.pending_evidence_count)}</td>
          <td>${fmtNumber(row.open_findings_count)}</td>
        </tr>
      `
    )
    .join('');
}

function renderControlStatusRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="7">No existen estados de control disponibles.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.health_status || '-')}</td>
          <td><strong>${fmtNumber(row.total)}</strong></td>
          <td><strong>${fmtPercent(row.average_score)}</strong></td>
          <td>${fmtNumber(row.pending_evidence_count)}</td>
          <td>${fmtNumber(row.open_findings_count)}</td>
          <td>${fmtNumber(row.open_actions_count)}</td>
          <td>${fmtNumber(row.overdue_actions_count)}</td>
        </tr>
      `
    )
    .join('');
}

function renderAuditControlsRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="7">No existen controles priorizados para auditoría.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td class="codeCell">${escapeHtml(row.code || '-')}</td>
          <td>${escapeHtml(row.name || 'Control sin descripción')}</td>
          <td>${escapeHtml(row.health_status || '-')}</td>
          <td><strong>${fmtPercent(row.score)}</strong></td>
          <td>${fmtNumber(row.pending_evidence_count)}</td>
          <td>${fmtNumber(row.open_findings_count)}</td>
          <td>${fmtNumber(row.high_risks_count)}</td>
        </tr>
      `
    )
    .join('');
}

function renderEvidenceRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="6">No existen evidencias recientes con contexto útil.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.iso_code || '-')}</td>
          <td>${escapeHtml(row.clause || '-')}</td>
          <td>${escapeHtml(row.file_name || 'Sin archivo asociado')}</td>
          <td>${escapeHtml(row.evidence_type || '-')}</td>
          <td>${row.validated ? 'Validada' : 'Pendiente'}</td>
          <td>${fmtDate(row.changed_at)}</td>
        </tr>
      `
    )
    .join('');
}

function renderFindingRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="6">No existen hallazgos abiertos.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.iso_code || '-')}</td>
          <td>${escapeHtml(row.title || 'Hallazgo sin título')}</td>
          <td>${escapeHtml(row.severity || '-')}</td>
          <td>${escapeHtml(row.status || '-')}</td>
          <td>${escapeHtml(row.owner || '-')}</td>
          <td>${fmtDate(row.due_date)}</td>
        </tr>
      `
    )
    .join('');
}

function renderActionRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="6">No existen acciones abiertas.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.iso_code || '-')}</td>
          <td>${escapeHtml(row.title || 'Acción sin título')}</td>
          <td>${escapeHtml(row.priority || '-')}</td>
          <td>${escapeHtml(row.status || '-')}</td>
          <td>${escapeHtml(row.owner || '-')}</td>
          <td>${fmtDate(row.due_date)}</td>
        </tr>
      `
    )
    .join('');
}

function renderKpiRows(rows) {
  const safeRows = asArray(rows);

  if (safeRows.length === 0) {
    return `<tr><td colspan="6">No existen KPIs calculados para este periodo.</td></tr>`;
  }

  return safeRows
    .map(
      (row) => `
        <tr>
          <td class="codeCell">${escapeHtml(cleanKpiCode(row.code || '-'))}</td>
          <td>${escapeHtml(cleanKpiLabel(row.name || row.code || 'KPI sin nombre'))}</td>
          <td>${escapeHtml(row.standard_code || '-')}</td>
          <td><strong>${fmtPercent(row.value)}</strong></td>
          <td>${escapeHtml(translateStatusColor(row.status_color))}</td>
          <td>${fmtDate(row.calculated_at)}</td>
        </tr>
      `
    )
    .join('');
}

function getTypeSpecificKpis(data) {
  const stats = data.stats || {};
  const controls = stats.controls || {};
  const controlHealth = stats.control_health || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const risks = stats.risks || {};
  const assets = stats.assets || {};
  const audits = stats.audits || {};
  const actions = stats.action_plans || {};
  const ncs = stats.nonconformities || {};
  const platform = data.platform_monthly_stats || {};

  if (data.report_type_code === 'audit_report') {
    return [
      { icon: 'E', value: fmtNumber(evidences.total_evidences), label: 'Evidencias cargadas', sub: 'Base documental' },
      { icon: '✓', value: fmtNumber(evidences.approved_evidences), label: 'Evidencias aprobadas', sub: 'Validadas' },
      { icon: '⌛', value: fmtNumber(evidences.pending_evidences), label: 'Pendientes', sub: 'Revisión requerida' },
      { icon: 'H', value: fmtNumber(findings.open_findings), label: 'Hallazgos abiertos', sub: 'Trazabilidad' },
      { icon: '!', value: fmtNumber(findings.critical_findings), label: 'Hallazgos críticos', sub: 'Prioridad' },
      { icon: 'A', value: fmtNumber(audits.active_audits), label: 'Auditorías activas', sub: 'En curso' },
      { icon: 'C', value: fmtNumber(controls.critical_controls), label: 'Controles críticos', sub: 'Muestra sugerida' },
      { icon: 'NC', value: fmtNumber(ncs.open_nonconformities), label: 'NC abiertas', sub: 'Seguimiento' },
    ];
  }

  if (data.report_type_code === 'control_status') {
    return [
      { icon: 'C', value: fmtNumber(controls.total_controls), label: 'Controles totales', sub: 'Base operativa' },
      { icon: '✓', value: fmtNumber(controls.healthy_controls), label: 'Saludables', sub: `${controls.healthy_percent || 0}%` },
      { icon: '!', value: fmtNumber(controls.warning_controls), label: 'En atención', sub: `${controls.warning_percent || 0}%` },
      { icon: '×', value: fmtNumber(controls.critical_controls), label: 'Deteriorados', sub: `${controls.critical_percent || 0}%` },
      { icon: 'V', value: fmtNumber(controls.overdue_controls), label: 'Vencidos', sub: `${controls.overdue_percent || 0}%` },
      { icon: 'PA', value: fmtNumber(actions.open_actions), label: 'Acciones abiertas', sub: 'Plan de acción' },
      { icon: '⏱', value: fmtNumber(actions.overdue_actions), label: 'Acciones vencidas', sub: 'Remediación' },
      { icon: 'R', value: fmtNumber(controlHealth.high_risks_count), label: 'Riesgos altos', sub: 'Control health' },
    ];
  }

  if (data.report_type_code === 'platform_client_monthly') {
    return [
      { icon: 'U', value: fmtNumber(platform.total_users), label: 'Usuarios cliente', sub: 'Usuarios registrados' },
      { icon: 'M', value: fmtNumber(platform.enabled_modules), label: 'Módulos activos', sub: 'Servicios habilitados' },
      { icon: 'PDF', value: fmtNumber(platform.reports_generated), label: 'Reportes generados', sub: 'Histórico total' },
      { icon: '30', value: fmtNumber(platform.reports_last_30_days), label: 'Reportes 30 días', sub: 'Actividad reciente' },
      { icon: 'E', value: fmtNumber(evidences.total_evidences), label: 'Evidencias', sub: 'Uso funcional' },
      { icon: 'H', value: fmtNumber(findings.open_findings), label: 'Hallazgos', sub: 'Seguimiento cliente' },
      { icon: 'C', value: fmtNumber(controls.total_controls), label: 'Controles activos', sub: 'Base de cumplimiento' },
      { icon: '%', value: fmtPercent(controls.average_score), label: 'Score cliente', sub: 'Estado consolidado' },
    ];
  }

  return [
    { icon: '%', value: fmtPercent(controls.average_score), label: 'Cumplimiento general', sub: controls.general_status || 'Sin estado' },
    { icon: 'C', value: fmtNumber(controls.total_controls), label: 'Controles evaluados', sub: 'Cobertura total' },
    { icon: '✓', value: fmtNumber(controls.healthy_controls), label: 'Saludables', sub: `${controls.healthy_percent || 0}%` },
    { icon: '!', value: fmtNumber(controls.warning_controls), label: 'En atención', sub: `${controls.warning_percent || 0}%` },
    { icon: '×', value: fmtNumber(controls.critical_controls), label: 'Deteriorados', sub: `${controls.critical_percent || 0}%` },
    { icon: 'E', value: fmtNumber(evidences.pending_evidences), label: 'Evidencias pendientes', sub: 'Gestión requerida' },
    { icon: 'H', value: fmtNumber(findings.critical_findings), label: 'Hallazgos críticos', sub: 'Prioridad ejecutiva' },
    { icon: 'R', value: fmtNumber(risks.critical_risks), label: 'Riesgos críticos', sub: `${fmtNumber(assets.critical_assets)} activos críticos` },
  ];
}

function pickAiExecutiveSummary(data) {
  return (
    data?.ai?.executive_brief?.summary ||
    data?.ai?.executive_brief?.headline ||
    ''
  );
}

function pickAiExecutivePriorities(data) {
  return normalizeInsights([
    ...(data?.ai?.executive_brief?.priorities || []),
    ...(data?.ai?.health_summary?.suggestions || []),
    ...(data?.ai?.executive_brief?.recommendations || []),
  ], 6);
}

function pickAiRisks(data) {
  return normalizeInsights(data?.ai?.executive_brief?.risks || [], 4);
}

function pickAiDecisions(data) {
  return normalizeInsights(data?.ai?.executive_brief?.decisions || [], 4);
}

function pickAiFindingAnalyses(data) {
  return asArray(data?.ai?.top_finding_analyses || []).filter(Boolean).slice(0, 2);
}

function pickAiKnowledgeSources(data) {
  return asArray(data?.ai?.knowledge_sources || []).filter(Boolean).slice(0, 10);
}

function buildNarrative(data) {
  const tenant = data.tenant || {};
  const stats = data.stats || {};
  const controls = stats.controls || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const risks = stats.risks || {};
  const standards = asArray(data.standards || []);
  const standardsText = standards.map((s) => s.code).join(', ') || 'sin normas activas';

  const aiSummary = pickAiExecutiveSummary(data);

  if (aiSummary) {
    return {
      summary: [aiSummary],
      decisions:
        pickAiDecisions(data).length > 0
          ? pickAiDecisions(data)
          : [
              `La dirección debe priorizar las brechas con impacto directo en continuidad, cumplimiento y trazabilidad.`,
              `El informe debe apoyar decisiones ejecutivas sobre cierre, priorización y asignación de responsables.`,
            ],
    };
  }

  if (data.report_type_code === 'audit_report') {
    return {
      summary: [
        `${tenant.name || 'Cliente'} mantiene ${fmtNumber(
          controls.total_controls
        )} controles en el alcance activo del periodo ${data.period || 'actual'}.`,
        `La preparación documental considera ${fmtNumber(
          evidences.total_evidences
        )} evidencias cargadas, ${fmtNumber(
          evidences.pending_evidences
        )} pendientes y ${fmtNumber(findings.open_findings)} hallazgos abiertos.`,
      ],
      decisions: [
        'Conviene priorizar la muestra sobre controles con menor score, mayor brecha documental y mayor criticidad.',
        'Antes de auditoría debe validarse trazabilidad entre requisito, control, evidencia y tratamiento.',
      ],
    };
  }

  if (data.report_type_code === 'control_status') {
    return {
      summary: [
        `${tenant.name || 'Cliente'} mantiene ${fmtNumber(
          controls.total_controls
        )} controles vigentes distribuidos en ${fmtNumber(standards.length)} norma(s): ${standardsText}.`,
        `Hoy existen ${fmtNumber(controls.warning_controls)} controles en atención, ${fmtNumber(
          controls.critical_controls
        )} deteriorados y ${fmtNumber(
          stats?.action_plans?.overdue_actions || 0
        )} acciones vencidas.`,
      ],
      decisions: [
        'El uso esperado de este informe es seguimiento operativo semanal y escalamiento oportuno de desviaciones.',
        'La salud por norma debe orientar la secuencia de remediación y asignación de responsables.',
      ],
    };
  }

  if (data.report_type_code === 'platform_client_monthly') {
    return {
      summary: [
        `El cliente registra ${fmtNumber(
          (data.platform_monthly_stats || {}).total_users
        )} usuario(s), ${fmtNumber(
          (data.platform_monthly_stats || {}).enabled_modules
        )} módulo(s) activo(s) y ${fmtNumber(
          (data.platform_monthly_stats || {}).reports_last_30_days
        )} reportes generados durante los últimos 30 días.`,
        `A nivel de cumplimiento, existen ${fmtNumber(
          findings.open_findings
        )} hallazgos abiertos y score general de ${fmtPercent(controls.average_score)}.`,
      ],
      decisions: [
        'El informe debe apoyar gestión comercial, customer success y seguimiento del servicio.',
        'Conviene revisar adopción de plataforma junto con salud operativa del cliente.',
      ],
    };
  }

  return {
    summary: [
      `${tenant.name || 'Cliente'} presenta ${fmtNumber(
        controls.total_controls
      )} controles dentro del alcance activo del periodo ${data.period || 'actual'}.`,
      `El score consolidado es ${fmtPercent(
        controls.average_score
      )}, con ${fmtNumber(controls.warning_controls)} controles en atención, ${fmtNumber(
        controls.critical_controls
      )} deteriorados, ${fmtNumber(
        evidences.pending_evidences
      )} evidencias pendientes y ${fmtNumber(risks.critical_risks)} riesgos críticos.`,
    ],
    decisions: [
      'La lectura ejecutiva debe enfocarse en brechas que afecten continuidad, cumplimiento y cierre oportuno.',
      'El propósito de este informe es priorizar decisiones y no solo listar métricas.',
    ],
  };
}

function buildExecutiveInsights(data) {
  const fromAi = pickAiExecutivePriorities(data);
  if (fromAi.length > 0) return fromAi.slice(0, 4);

  const weakest = [...asArray(data.compliance_by_standard || [])]
    .sort((a, b) => toNumber(a?.score, 999) - toNumber(b?.score, 999))
    .slice(0, 3);

  const pending = toNumber(data.stats?.evidences?.pending_evidences, 0);
  const criticalFindings = toNumber(data.stats?.findings?.critical_findings, 0);
  const criticalRisks = toNumber(data.stats?.risks?.critical_risks, 0);
  const warnings = toNumber(data.stats?.controls?.warning_controls, 0);
  const criticalControls = toNumber(data.stats?.controls?.critical_controls, 0);

  const insights = [];

  if (weakest.length > 0) {
    insights.push(
      `Las normas con menor salud del periodo son ${weakest
        .map((item) => `${item.code} (${fmtPercent(item.score)})`)
        .join(', ')}.`
    );
  }

  if (warnings > 0 || criticalControls > 0) {
    insights.push(
      `La principal presión del sistema está en ${fmtNumber(
        warnings
      )} controles en atención y ${fmtNumber(
        criticalControls
      )} deteriorados, por lo que conviene priorizar responsables y fechas de cierre.`
    );
  }

  if (pending > 0) {
    insights.push(
      `Existen ${fmtNumber(
        pending
      )} evidencias pendientes que pueden afectar trazabilidad, cierre y preparación de auditoría.`
    );
  }

  if (criticalFindings > 0 || criticalRisks > 0) {
    insights.push(
      `Se observan ${fmtNumber(
        criticalFindings
      )} hallazgos críticos y ${fmtNumber(
        criticalRisks
      )} riesgos críticos, lo que requiere validación ejecutiva de mitigación.`
    );
  }

  return normalizeInsights(insights, 4);
}

function buildControlInsights(data) {
  const fromAi = pickAiExecutivePriorities(data);
  if (fromAi.length > 0) return fromAi.slice(0, 4);

  const weakest = [...asArray(data.compliance_by_standard || [])]
    .sort((a, b) => toNumber(a?.score, 999) - toNumber(b?.score, 999))
    .slice(0, 3);

  const highestPending = [...asArray(data.compliance_by_standard || [])]
    .sort(
      (a, b) =>
        toNumber(b?.pending_evidence_count, 0) - toNumber(a?.pending_evidence_count, 0)
    )
    .slice(0, 2);

  const warnings = toNumber(data.stats?.controls?.warning_controls, 0);
  const critical = toNumber(data.stats?.controls?.critical_controls, 0);
  const overdueActions = toNumber(data.stats?.action_plans?.overdue_actions, 0);

  const insights = [];

  if (weakest.length > 0) {
    insights.push(
      `Las normas con menor salud actual son ${weakest
        .map((item) => `${item.code} (${fmtPercent(item.score)})`)
        .join(', ')}.`
    );
  }

  if (highestPending.some((item) => toNumber(item.pending_evidence_count, 0) > 0)) {
    insights.push(
      `La mayor carga documental pendiente se concentra en ${highestPending
        .map((item) => `${item.code} (${fmtNumber(item.pending_evidence_count)} evidencias)`)
        .join(', ')}.`
    );
  }

  if (warnings > 0 || critical > 0) {
    insights.push(
      `El backlog operativo combina ${fmtNumber(
        warnings
      )} controles en atención y ${fmtNumber(
        critical
      )} deteriorados.`
    );
  }

  if (overdueActions > 0) {
    insights.push(
      `Existen ${fmtNumber(overdueActions)} acciones vencidas que deben escalarse.`
    );
  }

  return normalizeInsights(insights, 4);
}

function buildAuditInsights(data) {
  const stats = data.stats || {};
  const insights = [];

  if (toNumber(stats?.evidences?.pending_evidences, 0) > 0) {
    insights.push(
      `Debe reforzarse la preparación documental, ya que existen ${fmtNumber(
        stats.evidences.pending_evidences
      )} evidencias pendientes.`
    );
  }

  if (toNumber(stats?.controls?.critical_controls, 0) > 0) {
    insights.push(
      `La muestra de auditoría debiera concentrarse en ${fmtNumber(
        stats.controls.critical_controls
      )} controles deteriorados o de menor score.`
    );
  }

  if (toNumber(stats?.findings?.open_findings, 0) > 0) {
    insights.push(
      `Se mantienen ${fmtNumber(
        stats.findings.open_findings
      )} hallazgos abiertos que podrían exigir evidencia adicional o CAPA.`
    );
  }

  return normalizeInsights(insights, 4);
}

function renderCompactFocusStrip(items) {
  const safeItems = normalizeInsights(items, 3);

  if (safeItems.length === 0) {
    return '';
  }

  return `
    <div class="compactFocus">
      <div class="compactFocusTitle">Foco ejecutivo asistido por IA</div>
      <ul class="compactFocusList">
        ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderPageOne(data, config) {
  const tenant = data.tenant || {};
  const controls = data.stats?.controls || {};
  const score = clampPercent(controls.average_score || 0);
  const tone = getGeneralTone(score);
  const toneLabel = getGeneralToneLabel(score);
  const narrative = buildNarrative(data);

  return `
    <section class="reportMode">
      <div>
        <div class="modeBadge">${escapeHtml(config.badge)}</div>
        <h2>${escapeHtml(config.pageOneTitle)}</h2>
        <p>${escapeHtml(config.subtitle)}</p>
      </div>

      <div class="modeMeta">
        <div class="smallLabel">Periodo evaluado</div>
        <strong>${escapeHtml(data.period || 'Periodo actual')}</strong>
      </div>
    </section>

    <section class="hero">
      <div class="sectionCard">
        <h2 class="sectionTitle">Información del informe</h2>

        <div class="reportInfoGrid">
          <div>
            <div class="smallLabel">Empresa</div>
            <div class="strongValue">${escapeHtml(tenant.name || 'Cliente')}</div>
          </div>

          <div>
            <div class="smallLabel">Tipo de informe</div>
            <div class="strongValue">${escapeHtml(config.badge)}</div>
          </div>
        </div>

        <div class="blockSpacing">
          <div class="smallLabel">Normas activas</div>
          <div class="pillWrap">${renderStandardPills(data.standards)}</div>
        </div>

        <div class="blockSpacing">
          ${renderBulletList(narrative.summary)}
        </div>
      </div>

      <div class="darkCard">
        <h2 class="sectionTitle">${escapeHtml(config.scoreLabel)}</h2>

        <div class="scoreWrap">
          <div class="donut">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="14" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="var(--secondary-color)"
                stroke-width="14"
                stroke-linecap="round"
                stroke-dasharray="${Math.round((score / 100) * 314)} 314"
              />
            </svg>

            <div class="donutCenter">
              <div class="scoreNumber">${score}%</div>
              <div class="scoreLabel">Score</div>
            </div>
          </div>

          <div>
            <div class="statusBadge statusBadge--${tone}">
              <span class="statusDot"></span>
              ${escapeHtml(toneLabel)}
            </div>

            <div class="subtitle">
              Indicador consolidado según el alcance activo del tenant y el objetivo del informe.
            </div>
          </div>
        </div>

        <div class="blockSpacing">
          ${renderBulletList(narrative.decisions)}
        </div>
      </div>
    </section>

    <section class="sectionCard">
      <h2 class="sectionTitle">${escapeHtml(config.focusTitle)}</h2>
      <div class="kpiGrid">
        ${renderKpiCards(getTypeSpecificKpis(data))}
      </div>
    </section>

    ${renderCompactFocusStrip(buildExecutiveInsights(data))}
  `;
}

function renderAiNarrativePage(data) {
  const executiveBrief = data?.ai?.executive_brief || {};
  const healthSummary = data?.ai?.health_summary || {};
  const riskLines = pickAiRisks(data);
  const decisionLines = pickAiDecisions(data);
  const priorities = pickAiExecutivePriorities(data);
  const knowledgeSources = pickAiKnowledgeSources(data);

  const cards = [];

  if (executiveBrief.summary) {
    cards.push({
      title: 'Síntesis ejecutiva IA',
      subtitle: `Confianza ${executiveBrief.confidence || 'media'}`,
      body: executiveBrief.summary,
    });
  }

  if (healthSummary.summary) {
    cards.push({
      title: 'Lectura de salud',
      subtitle: `Fuente ${healthSummary.source || 'ai-engine-knowledge'}`,
      body: healthSummary.summary,
    });
  }

  return `
    <div class="pageStack">
      ${renderSection(
        'Narrativa gerencial asistida por IA',
        cards.length
          ? renderAiHighlightCards(cards, 'soft')
          : renderEmpty('No se generó narrativa IA adicional para este periodo.'),
        'accentCard'
      )}

      <div class="twoCol">
        ${renderCompactSection(
          'Prioridades sugeridas por IA',
          priorities.length
            ? renderBulletList(priorities, 'compactList')
            : renderEmpty('No se identificaron prioridades IA adicionales.')
        )}

        ${renderCompactSection(
          'Riesgos y decisiones sugeridas',
          `
            <div class="miniTitle">Riesgos destacados</div>
            ${
              riskLines.length
                ? renderBulletList(riskLines, 'compactList')
                : renderEmpty('Sin riesgos destacados por IA.')
            }
            <div class="miniTitle blockSpacing">Decisiones sugeridas</div>
            ${
              decisionLines.length
                ? renderBulletList(decisionLines, 'compactList')
                : renderEmpty('Sin decisiones sugeridas por IA.')
            }
          `
        )}
      </div>

      ${renderCompactSection(
        'Fuentes normativas consideradas por IA',
        renderKnowledgeSourcePills(knowledgeSources)
      )}
    </div>
  `;
}

function renderAiFindingHighlightsPage(data) {
  const analyses = pickAiFindingAnalyses(data);

  return renderSection(
    'Hallazgos estratégicos con lectura IA',
    analyses.length === 0
      ? renderEmpty('No existen hallazgos abiertos priorizados para análisis IA en este periodo.')
      : `
          <div class="findingInsightGrid">
            ${analyses
              .map(
                (item) => `
                  <div class="findingInsightCard">
                    <div class="findingInsightTop">
                      <div class="findingInsightTitle">${escapeHtml(item.title || 'Hallazgo')}</div>
                      <div class="findingPriority">${escapeHtml(item.priority || item.severity || 'media')}</div>
                    </div>

                    ${
                      item.summary
                        ? `<div class="findingInsightBody"><strong>Resumen:</strong> ${escapeHtml(item.summary)}</div>`
                        : ''
                    }

                    ${
                      item.impact
                        ? `<div class="findingInsightBody"><strong>Impacto:</strong> ${escapeHtml(item.impact)}</div>`
                        : ''
                    }

                    ${
                      asArray(item.recommended_actions).length > 0
                        ? `
                          <div class="findingInsightBody">
                            <strong>Acciones sugeridas:</strong>
                            <ul class="bulletList compactList">
                              ${asArray(item.recommended_actions)
                                .slice(0, 4)
                                .map((line) => `<li>${escapeHtml(line)}</li>`)
                                .join('')}
                            </ul>
                          </div>
                        `
                        : ''
                    }
                  </div>
                `
              )
              .join('')}
          </div>
        `,
    'accentCard'
  );
}

function renderExecutiveSummaryPage(data) {
  return `
    <div class="pageStack">
      ${renderCompactSection(
        'Lectura gerencial del periodo',
        `
          ${renderBulletList(buildExecutiveInsights(data))}
          <div class="blockSpacing">${renderComplianceBars(data.compliance_by_standard || [])}</div>
        `,
        'accentCard'
      )}

      ${renderCompactSection(
        'Recomendaciones ejecutivas',
        renderRecommendations(data.recommendations || []),
        'accentCard'
      )}
    </div>
  `;
}

function renderControlReadingPage(data) {
  return `
    <div class="pageStack">
      ${renderCompactSection(
        'Lectura operativa y distribución',
        `
          ${renderMetricList([
            { label: 'Controles saludables', value: fmtNumber(data.stats?.controls?.healthy_controls) },
            { label: 'Controles en atención', value: fmtNumber(data.stats?.controls?.warning_controls) },
            { label: 'Controles deteriorados', value: fmtNumber(data.stats?.controls?.critical_controls) },
            { label: 'Controles vencidos', value: fmtNumber(data.stats?.controls?.overdue_controls) },
            { label: 'Acciones abiertas', value: fmtNumber(data.stats?.action_plans?.open_actions) },
            { label: 'Acciones vencidas', value: fmtNumber(data.stats?.action_plans?.overdue_actions) },
          ])}
          <div class="blockSpacing">
            ${renderDistribution(data.stats?.controls || {})}
          </div>
        `,
        'accentCard'
      )}

      ${renderCompactSection(
        'Cumplimiento operativo por norma',
        renderComplianceBars(data.compliance_by_standard || [])
      )}

      ${renderCompactSection(
        'Prioridades de remediación',
        renderRecommendations([
          ...buildControlInsights(data),
          ...(data.recommendations || []),
        ]),
        'accentCard'
      )}
    </div>
  `;
}

function renderAuditReadinessPage(data) {
  return `
    <div class="pageStack">
      ${renderCompactSection(
        'Panorama por norma para auditoría',
        renderComplianceBars(data.compliance_by_standard || []),
        'accentCard'
      )}

      ${renderCompactSection(
        'Recomendaciones y preparación',
        renderRecommendations([
          ...buildAuditInsights(data),
          ...(data.recommendations || []),
        ]),
        'accentCard'
      )}
    </div>
  `;
}

function renderPlatformOverviewPage(data) {
  const platform = data.platform_monthly_stats || {};

  return `
    <div class="pageStack">
      ${renderCompactSection(
        'Uso de plataforma y servicio',
        renderMetricList([
          { label: 'Usuarios registrados', value: fmtNumber(platform.total_users) },
          { label: 'Módulos habilitados', value: fmtNumber(platform.enabled_modules) },
          { label: 'Contratos asociados', value: fmtNumber(platform.total_contracts) },
          { label: 'Reportes generados', value: fmtNumber(platform.reports_generated) },
          { label: 'Reportes últimos 30 días', value: fmtNumber(platform.reports_last_30_days) },
        ])
      )}

      ${renderCompactSection(
        'Salud ISO por norma',
        renderComplianceBars(data.compliance_by_standard || [])
      )}

      ${renderCompactSection(
        'Recomendaciones de acompañamiento',
        renderRecommendations(data.recommendations || []),
        'accentCard'
      )}
    </div>
  `;
}

function buildSectionPages(sections, maxPerPage = 2) {
  const pageChunks = chunkArray(sections, maxPerPage);
  return pageChunks.map((chunk) => `<div class="pageStack">${chunk.join('')}</div>`);
}

function buildExecutivePages(data) {
  const pages = [];
  const isoChunks = chunkArray(data.compliance_by_standard || [], 6);
  const riskChunks = chunkArray(data.top_risks || [], 6);
  const kpiChunks = chunkArray(data.latest_kpis || [], 6);
  const evidenceChunks = chunkArray(data.recent_evidences || [], 6);
  const actionChunks = chunkArray(data.open_action_plans || [], 6);

  pages.push(renderPageOne(data, getReportConfig(data.report_type_code)));
  pages.push(renderAiNarrativePage(data));
  pages.push(renderAiFindingHighlightsPage(data));

  const sectionPool = [];

  isoChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Salud ISO por norma' : 'Salud ISO por norma (continuación)',
        renderTable(
          ['Norma', 'Nombre', 'Salud', 'Controles', 'Saludables', 'Atención', 'Deteriorados', 'Evid. pend.', 'Hallazgos'],
          renderIsoHealthRows(chunk)
        )
      )
    );
  });

  riskChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Riesgos críticos y exposición' : 'Riesgos críticos y exposición (continuación)',
        renderTable(
          ['Riesgo', 'Descripción', 'Activo', 'Prob.', 'Nivel'],
          renderTopRisksRows(chunk)
        )
      )
    );
  });

  sectionPool.push(renderExecutiveSummaryPage(data));

  kpiChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'KPIs recientes para seguimiento gerencial' : 'KPIs recientes para seguimiento gerencial (continuación)',
        renderTable(
          ['KPI', 'Nombre', 'Norma', 'Valor', 'Estado', 'Fecha'],
          renderKpiRows(chunk)
        )
      )
    );
  });

  evidenceChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Evidencias recientes con contexto útil' : 'Evidencias recientes con contexto útil (continuación)',
        renderTable(
          ['ISO', 'Cláusula', 'Archivo', 'Tipo', 'Estado', 'Fecha'],
          renderEvidenceRows(chunk)
        )
      )
    );
  });

  actionChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Acciones abiertas relevantes' : 'Acciones abiertas relevantes (continuación)',
        renderTable(
          ['ISO', 'Acción', 'Prioridad', 'Estado', 'Responsable', 'Vence'],
          renderActionRows(chunk)
        )
      )
    );
  });

  pages.push(...buildSectionPages(sectionPool, 2));

  return pages;
}

function buildAuditPages(data) {
  const pages = [];
  const auditControlChunks = chunkArray(data.audit_focus_controls || [], 6);
  const evidenceChunks = chunkArray(data.recent_evidences || [], 6);
  const findingChunks = chunkArray(data.open_findings || [], 6);
  const actionChunks = chunkArray(data.open_action_plans || [], 6);
  const kpiChunks = chunkArray(data.latest_kpis || [], 6);

  pages.push(renderPageOne(data, getReportConfig(data.report_type_code)));
  pages.push(renderAiNarrativePage(data));
  pages.push(renderAiFindingHighlightsPage(data));

  const sectionPool = [];

  auditControlChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Controles priorizados para auditoría' : 'Controles priorizados para auditoría (continuación)',
        renderTable(
          ['Control', 'Descripción', 'Estado', 'Score', 'Evid. pend.', 'Hallazgos', 'Riesgos'],
          renderAuditControlsRows(chunk)
        )
      )
    );
  });

  sectionPool.push(renderAuditReadinessPage(data));

  evidenceChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Línea de evidencias recientes' : 'Línea de evidencias recientes (continuación)',
        renderTable(
          ['ISO', 'Cláusula', 'Archivo', 'Tipo', 'Estado', 'Fecha'],
          renderEvidenceRows(chunk)
        )
      )
    );
  });

  findingChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Hallazgos abiertos para revisión' : 'Hallazgos abiertos para revisión (continuación)',
        renderTable(
          ['ISO', 'Hallazgo', 'Severidad', 'Estado', 'Responsable', 'Vence'],
          renderFindingRows(chunk)
        )
      )
    );
  });

  actionChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Acciones correctivas abiertas' : 'Acciones correctivas abiertas (continuación)',
        renderTable(
          ['ISO', 'Acción', 'Prioridad', 'Estado', 'Responsable', 'Vence'],
          renderActionRows(chunk)
        )
      )
    );
  });

  kpiChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'KPIs de seguimiento de auditoría' : 'KPIs de seguimiento de auditoría (continuación)',
        renderTable(
          ['KPI', 'Nombre', 'Norma', 'Valor', 'Estado', 'Fecha'],
          renderKpiRows(chunk)
        )
      )
    );
  });

  pages.push(...buildSectionPages(sectionPool, 2));

  return pages;
}

function buildControlPages(data) {
  const pages = [];
  const isoChunks = chunkArray(data.compliance_by_standard || [], 6);
  const statusChunks = chunkArray(data.control_status_rows || [], 6);
  const actionChunks = chunkArray(data.open_action_plans || [], 6);
  const evidenceChunks = chunkArray(data.recent_evidences || [], 6);
  const kpiChunks = chunkArray(data.latest_kpis || [], 6);

  pages.push(renderPageOne(data, getReportConfig(data.report_type_code)));
  pages.push(renderAiNarrativePage(data));
  pages.push(renderAiFindingHighlightsPage(data));

  const sectionPool = [];

  isoChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Estado de Salud ISO por norma' : 'Estado de Salud ISO por norma (continuación)',
        renderTable(
          ['Norma', 'Nombre', 'Salud', 'Controles', 'Saludables', 'Atención', 'Deteriorados', 'Evid. pend.', 'Hallazgos'],
          renderIsoHealthRows(chunk)
        )
      )
    );
  });

  statusChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Distribución por estado de control' : 'Distribución por estado de control (continuación)',
        renderTable(
          ['Estado', 'Total', 'Score prom.', 'Evid. pend.', 'Hallazgos', 'Acciones', 'Vencidas'],
          renderControlStatusRows(chunk)
        )
      )
    );
  });

  sectionPool.push(renderControlReadingPage(data));

  evidenceChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Evidencias recientes con contexto útil' : 'Evidencias recientes con contexto útil (continuación)',
        renderTable(
          ['ISO', 'Cláusula', 'Archivo', 'Tipo', 'Estado', 'Fecha'],
          renderEvidenceRows(chunk)
        )
      )
    );
  });

  actionChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Plan de acción abierto' : 'Plan de acción abierto (continuación)',
        renderTable(
          ['ISO', 'Acción', 'Prioridad', 'Estado', 'Responsable', 'Vence'],
          renderActionRows(chunk)
        )
      )
    );
  });

  kpiChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'KPIs de seguimiento operativo' : 'KPIs de seguimiento operativo (continuación)',
        renderTable(
          ['KPI', 'Nombre', 'Norma', 'Valor', 'Estado', 'Fecha'],
          renderKpiRows(chunk)
        )
      )
    );
  });

  pages.push(...buildSectionPages(sectionPool, 2));

  return pages;
}

function buildPlatformPages(data) {
  const pages = [];
  const riskChunks = chunkArray(data.top_risks || [], 6);
  const findingChunks = chunkArray(data.open_findings || [], 6);
  const kpiChunks = chunkArray(data.latest_kpis || [], 6);

  pages.push(renderPageOne(data, getReportConfig(data.report_type_code)));
  pages.push(renderAiNarrativePage(data));
  pages.push(renderAiFindingHighlightsPage(data));

  const sectionPool = [];

  sectionPool.push(renderPlatformOverviewPage(data));

  riskChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Riesgos principales del cliente' : 'Riesgos principales del cliente (continuación)',
        renderTable(
          ['Riesgo', 'Descripción', 'Activo', 'Prob.', 'Nivel'],
          renderTopRisksRows(chunk)
        )
      )
    );
  });

  findingChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'Hallazgos abiertos del cliente' : 'Hallazgos abiertos del cliente (continuación)',
        renderTable(
          ['ISO', 'Hallazgo', 'Severidad', 'Estado', 'Responsable', 'Vence'],
          renderFindingRows(chunk)
        )
      )
    );
  });

  kpiChunks.forEach((chunk, index) => {
    sectionPool.push(
      renderCompactSection(
        index === 0 ? 'KPIs de seguimiento mensual' : 'KPIs de seguimiento mensual (continuación)',
        renderTable(
          ['KPI', 'Nombre', 'Norma', 'Valor', 'Estado', 'Fecha'],
          renderKpiRows(chunk)
        )
      )
    );
  });

  pages.push(...buildSectionPages(sectionPool, 2));

  return pages;
}

function buildPagesByType(data) {
  if (data.report_type_code === 'audit_report') {
    return buildAuditPages(data);
  }

  if (data.report_type_code === 'control_status') {
    return buildControlPages(data);
  }

  if (data.report_type_code === 'platform_client_monthly') {
    return buildPlatformPages(data);
  }

  return buildExecutivePages(data);
}

function renderExecutivePremiumTemplate(data) {
  const tenant = data.tenant || {};
  const config = getReportConfig(data.report_type_code);

  const primaryColor = tenant.report_primary_color || '#0B2F4F';
  const secondaryColor = tenant.report_secondary_color || '#22C55E';

  const rightsMessage =
    tenant.report_rights_message ||
    `© ${new Date().getFullYear()} ${tenant.name || 'Cliente'}. Todos los derechos reservados.`;

  const privacyMessage =
    tenant.report_privacy_message ||
    `Este documento es confidencial. Su uso y distribución están sujetos a la Política de Privacidad de ${
      tenant.name || 'la empresa cliente'
    }.`;

  const footerText =
    tenant.report_footer_text || 'Generado por TCDX by Tecdex.';

  const rawPages = buildPagesByType(data);
  const totalPages = rawPages.length;

  const header = renderHeader({
    tenant,
    reportTitle: config.title,
    generatedAt: data.generated_at,
  });

  const pages = rawPages.map((content, index) =>
    renderPageShell({
      header,
      footer: renderFooter({
        rightsMessage,
        privacyMessage,
        footerText,
        pageNumber: index + 1,
        totalPages,
      }),
      content,
    })
  );

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(config.title)}</title>
  <style>
    :root {
      --primary-color: ${primaryColor};
      --secondary-color: ${secondaryColor};
      --text-color: #0f172a;
      --muted-color: #64748b;
      --card-border: #dbe4ee;
      --card-bg: #f8fafc;
      --white: #ffffff;
    }

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
      background: #eef3f7;
      color: var(--text-color);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.34;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .reportPage {
      width: 8.5in;
      height: 11in;
      padding: 28px 34px 0 34px;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(circle at 86% 10%, rgba(34, 197, 94, 0.06), transparent 20%),
        linear-gradient(180deg, #f7fbfd 0%, #f3f7fb 100%);
      page-break-after: always;
      break-after: page;
    }

    .reportPage:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .header {
      display: grid;
      grid-template-columns: 160px 1fr 160px;
      align-items: center;
      gap: 14px;
      padding-bottom: 12px;
      border-bottom: 4px solid var(--primary-color);
      height: 82px;
    }

    .brandLogo,
    .clientLogo {
      min-height: 48px;
      display: flex;
      align-items: center;
    }

    .clientLogo {
      justify-content: flex-end;
    }

    .brandTextLockup {
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      font-weight: 900;
      color: var(--primary-color);
      font-size: 25px;
      line-height: 0.95;
      letter-spacing: -1px;
    }

    .logoHolder {
      min-height: 48px;
      min-width: 120px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
    }

    .clientLogo.logoHolder {
      justify-content: flex-end;
    }

    .logoHolder img {
      max-width: 150px;
      max-height: 48px;
      object-fit: contain;
      display: block;
    }

    .logoHolder--fallback {
      justify-content: flex-start;
    }

    .clientLogo.logoHolder--fallback {
      justify-content: flex-end;
    }

    .logoFallbackText {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 8px 12px;
      border-radius: 12px;
      background: #eaf0f6;
      color: var(--primary-color);
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      line-height: 1.2;
      max-width: 150px;
      word-break: break-word;
    }

    .headerCenter {
      text-align: center;
    }

    .documentTitle {
      margin: 0;
      color: #11243a;
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.3px;
      line-height: 1.15;
    }

    .documentDate {
      margin-top: 6px;
      color: #50637b;
      font-size: 11px;
      font-weight: 700;
    }

    .pageContent {
      padding-top: 16px;
      padding-bottom: 108px;
      height: calc(11in - 82px - 28px - 108px);
      overflow: hidden;
    }

    .footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 86px;
      padding: 18px 40px 14px 40px;
      background: var(--primary-color);
      color: #ffffff;
      display: grid;
      grid-template-columns: 1.1fr 1.5fr auto;
      gap: 18px;
      align-items: end;
      font-size: 10px;
    }

    .footerLine {
      position: absolute;
      left: 40px;
      right: 40px;
      top: 12px;
      height: 1px;
      background: rgba(255,255,255,0.26);
    }

    .footerCol {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .footerColCenter {
      justify-content: flex-end;
    }

    .footerColRight {
      align-items: flex-end;
      justify-content: flex-end;
    }

    .footer strong {
      font-size: 10px;
      line-height: 1.25;
    }

    .footerMuted {
      color: rgba(255,255,255,0.78);
      font-size: 9.5px;
      line-height: 1.35;
    }

    .pageNumber {
      font-size: 10px;
      font-weight: 800;
      color: rgba(255,255,255,0.92);
      white-space: nowrap;
    }

    .pageStack {
      display: flex;
      flex-direction: column;
      gap: 10px;
      height: 100%;
    }

    .twoCol {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .reportMode {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,0.74);
      border: 1px solid var(--card-border);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
    }

    .reportMode h2 {
      margin: 6px 0 4px 0;
      color: var(--text-color);
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.3px;
    }

    .reportMode p {
      margin: 0;
      color: var(--muted-color);
      font-size: 11px;
      line-height: 1.35;
    }

    .modeBadge {
      display: inline-flex;
      border-radius: 999px;
      padding: 5px 11px;
      background: #e8f0f8;
      color: var(--primary-color);
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .modeMeta {
      border-radius: 16px;
      background: rgba(248, 250, 252, 0.9);
      border: 1px solid var(--card-border);
      padding: 14px;
      text-align: center;
    }

    .modeMeta strong {
      display: block;
      margin-top: 4px;
      color: var(--text-color);
      font-size: 14px;
    }

    .hero {
      display: grid;
      grid-template-columns: 1.04fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .sectionCard,
    .darkCard {
      border-radius: 18px;
      padding: 14px 16px;
      border: 1px solid var(--card-border);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.03);
    }

    .sectionCard {
      background: rgba(255,255,255,0.62);
      backdrop-filter: blur(2px);
    }

    .sectionCard.compact {
      padding: 12px 14px;
    }

    .darkCard {
      background: linear-gradient(180deg, #0d3658 0%, #0a2f4f 100%);
      color: #ffffff;
      border-color: rgba(255,255,255,0.06);
    }

    .accentCard {
      background: linear-gradient(180deg, rgba(255,255,255,0.74) 0%, rgba(242, 251, 246, 0.92) 100%);
      border-color: rgba(34, 197, 94, 0.22);
    }

    .sectionTitle {
      margin: 0 0 10px 0;
      color: #11243a;
      font-size: 13.5px;
      font-weight: 800;
      line-height: 1.2;
    }

    .darkCard .sectionTitle {
      color: #ffffff;
    }

    .reportInfoGrid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .smallLabel {
      color: #6b7d95;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }

    .strongValue {
      margin-top: 4px;
      color: var(--text-color);
      font-size: 13px;
      font-weight: 800;
      line-height: 1.2;
    }

    .blockSpacing {
      margin-top: 10px;
    }

    .pillWrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 7px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 4px 9px;
      border-radius: 999px;
      background: #e8f0f8;
      color: #15344d;
      font-size: 10.2px;
      font-weight: 800;
      line-height: 1.1;
    }

    .sourcePill {
      background: #eef2ff;
      color: #3730a3;
    }

    .scoreWrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .donut {
      width: 124px;
      height: 124px;
      position: relative;
      flex: none;
    }

    .donut svg {
      width: 124px;
      height: 124px;
      transform: rotate(-90deg);
    }

    .donutCenter {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    .scoreNumber {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.45px;
    }

    .scoreLabel {
      color: rgba(255,255,255,0.68);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .statusBadge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      border-radius: 999px;
      color: #ffffff;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      box-shadow: 0 10px 18px rgba(0,0,0,0.12);
    }

    .statusBadge--saludable { background: #22c55e; }
    .statusBadge--atencion { background: #22c55e; }
    .statusBadge--critico { background: #ef4444; }

    .statusDot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #ffffff;
    }

    .subtitle {
      margin-top: 11px;
      color: rgba(255,255,255,0.8);
      font-size: 11px;
      line-height: 1.35;
    }

    .kpiGrid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 9px;
    }

    .kpiCard {
      min-height: 88px;
      padding: 11px 9px;
      border-radius: 15px;
      background: rgba(255,255,255,0.92);
      border: 1px solid #e4eaf2;
      text-align: center;
    }

    .kpiIcon {
      width: 28px;
      height: 28px;
      margin: 0 auto 6px auto;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e8f0f8;
      color: var(--primary-color);
      font-weight: 900;
      font-size: 9px;
    }

    .kpiValue {
      font-size: 18px;
      font-weight: 900;
      color: #182236;
      line-height: 1;
    }

    .kpiLabel {
      margin-top: 6px;
      color: #34445a;
      font-size: 10.3px;
      font-weight: 800;
      line-height: 1.2;
    }

    .kpiSub {
      margin-top: 5px;
      color: #65748b;
      font-size: 9.5px;
      font-weight: 700;
      line-height: 1.2;
    }

    .compactFocus {
      margin-top: 10px;
      padding: 10px 14px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(242, 251, 246, 0.9) 100%);
      border: 1px solid rgba(34, 197, 94, 0.25);
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.03);
    }

    .compactFocusTitle {
      color: #11243a;
      font-size: 11px;
      font-weight: 900;
      margin-bottom: 6px;
    }

    .compactFocusList {
      margin: 0;
      padding-left: 18px;
      color: #243549;
      font-size: 11px;
      line-height: 1.35;
    }

    .compactFocusList li {
      margin: 4px 0;
    }

    .bulletList {
      margin: 0;
      padding-left: 18px;
      color: inherit;
    }

    .bulletList li {
      margin: 6px 0;
      line-height: 1.4;
    }

    .compactList li {
      margin: 4px 0;
      font-size: 10.5px;
    }

    .metricLine {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #e7eef5;
      color: #324257;
      font-size: 11px;
      font-weight: 700;
    }

    .metricLine:last-child {
      border-bottom: none;
    }

    .metricLine strong {
      color: var(--primary-color);
      font-size: 13px;
      font-weight: 900;
      white-space: nowrap;
    }

    .distribution {
      display: grid;
      grid-template-columns: 132px 1fr;
      gap: 14px;
      align-items: center;
    }

    .distributionCircle {
      width: 124px;
      height: 124px;
      border-radius: 50%;
      position: relative;
      background: #e8eef5;
    }

    .distributionCircle::after {
      content: '';
      position: absolute;
      inset: 32px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px #e8eef5;
    }

    .distributionCenter {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    .distributionTotal {
      font-size: 22px;
      font-weight: 900;
      color: var(--text-color);
    }

    .distributionText {
      color: var(--muted-color);
      font-size: 10px;
      font-weight: 700;
    }

    .distributionLegend {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .legendItem {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: #36495e;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.35;
    }

    .legendDot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-top: 3px;
      flex: none;
    }

    .greenDot { background: var(--secondary-color); }
    .yellowDot { background: #f59e0b; }
    .redDot { background: #ef4444; }

    .barRow {
      display: grid;
      grid-template-columns: 95px 1fr 46px;
      gap: 8px;
      align-items: center;
      margin: 8px 0;
    }

    .barLabel {
      color: #33455b;
      font-size: 9.7px;
      font-weight: 800;
      line-height: 1.15;
      word-break: break-word;
    }

    .barTrack {
      height: 11px;
      border-radius: 999px;
      background: #e8eef5;
      overflow: hidden;
    }

    .barFill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
    }

    .barValue {
      text-align: right;
      color: #14253b;
      font-size: 10px;
      font-weight: 900;
    }

    .insightGrid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .insightCard {
      padding: 11px 12px;
      border-radius: 14px;
      background: rgba(255,255,255,0.95);
      border: 1px solid #e8eef5;
    }

    .insightTitle {
      color: #0f172a;
      font-size: 11px;
      font-weight: 900;
      margin-bottom: 4px;
    }

    .insightSubtitle {
      color: #64748b;
      font-size: 9.2px;
      font-weight: 700;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .insightBody {
      color: #334155;
      font-size: 10.3px;
      line-height: 1.45;
    }

    .miniTitle {
      color: #10253b;
      font-size: 9.6px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }

    .findingInsightGrid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .findingInsightCard {
      padding: 12px;
      border-radius: 14px;
      background: rgba(255,255,255,0.95);
      border: 1px solid #e8eef5;
    }

    .findingInsightTop {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .findingInsightTitle {
      color: #0f172a;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.3;
    }

    .findingPriority {
      white-space: nowrap;
      border-radius: 999px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 8.8px;
      font-weight: 900;
      padding: 4px 8px;
      text-transform: uppercase;
    }

    .findingInsightBody {
      color: #334155;
      font-size: 10.1px;
      line-height: 1.45;
      margin-top: 6px;
    }

    .tableWrap {
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid #e7edf4;
      background: rgba(255,255,255,0.95);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.2px;
    }

    th {
      background: #eef3f8;
      color: #334155;
      text-align: left;
      padding: 7px 8px;
      font-size: 8.4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    td {
      padding: 7px 8px;
      border-bottom: 1px solid #eef2f7;
      color: #273548;
      vertical-align: top;
      line-height: 1.35;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .codeCell {
      font-weight: 900;
      color: #0f172a;
      width: 74px;
    }

    .badgeDanger {
      display: inline-flex;
      border-radius: 999px;
      background: #fee2e2;
      color: #b91c1c;
      padding: 4px 8px;
      font-size: 8.8px;
      font-weight: 900;
      white-space: nowrap;
    }

    .recommendation {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 8px;
      margin: 8px 0;
      color: #273548;
      font-size: 10.8px;
      font-weight: 600;
      line-height: 1.4;
    }

    .recommendationIcon {
      width: 20px;
      height: 20px;
      border-radius: 7px;
      background: #e8f0f8;
      color: var(--primary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 10px;
      margin-top: 1px;
    }

    .emptyBox {
      padding: 12px 13px;
      border-radius: 12px;
      background: rgba(248,250,252,0.95);
      border: 1px dashed #cbd5e1;
      color: #64748b;
      font-size: 10.8px;
      line-height: 1.4;
    }
  </style>
</head>

<body>
  ${pages.join('\n')}
</body>
</html>
  `;
}

module.exports = {
  renderExecutivePremiumTemplate,
};
