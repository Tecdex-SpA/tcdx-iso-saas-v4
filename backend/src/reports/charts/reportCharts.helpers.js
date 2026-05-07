'use strict';

/**
 * Helpers visuales HTML/CSS para informes PDF TCDX.
 *
 * Objetivo:
 * - Generar gráficas livianas compatibles con Puppeteer.
 * - Evitar dependencias externas.
 * - Reutilizar componentes visuales en todos los informes premium.
 * - Mantener consistencia visual TCDX by Tecdex.
 */

function asString(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeHtml(value) {
  return asString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clamp(value, min = 0, max = 100) {
  const n = toNumber(value, 0);
  return Math.max(min, Math.min(max, n));
}

function percent(value, total) {
  const safeTotal = toNumber(total, 0);
  if (!safeTotal) return 0;
  return Math.round((toNumber(value, 0) / safeTotal) * 1000) / 10;
}

function normalizeKey(value) {
  return asString(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeStatus(value) {
  const key = normalizeKey(value);

  if (['saludable', 'healthy', 'ok', 'green', 'verde', 'cumple', 'conforme', 'aprobada', 'aprobado', 'approved', 'cerrado', 'closed', 'completado', 'completed'].includes(key)) {
    return 'success';
  }

  if (['atencion', 'attention', 'warning', 'yellow', 'amarillo', 'pendiente', 'pending', 'en_revision', 'en_progreso', 'progress', 'parcial'].includes(key)) {
    return 'warning';
  }

  if (['alto', 'alta', 'high', 'orange', 'naranja', 'vencido', 'overdue', 'rechazada', 'rechazado', 'rejected'].includes(key)) {
    return 'danger-soft';
  }

  if (['deteriorado', 'critical', 'critico', 'critica', 'red', 'rojo', 'no_conforme', 'nc_mayor', 'mayor'].includes(key)) {
    return 'danger';
  }

  if (['bajo', 'baja', 'low', 'gray', 'gris', 'no_aplica', 'na', 'sin_datos'].includes(key)) {
    return 'muted';
  }

  return 'neutral';
}

function statusColor(status) {
  const normalized = normalizeStatus(status);

  const colors = {
    success: {
      bg: '#ECFDF5',
      text: '#047857',
      border: '#A7F3D0',
      solid: '#10B981',
    },
    warning: {
      bg: '#FFFBEB',
      text: '#B45309',
      border: '#FDE68A',
      solid: '#F59E0B',
    },
    'danger-soft': {
      bg: '#FFF7ED',
      text: '#C2410C',
      border: '#FED7AA',
      solid: '#F97316',
    },
    danger: {
      bg: '#FEF2F2',
      text: '#B91C1C',
      border: '#FECACA',
      solid: '#EF4444',
    },
    muted: {
      bg: '#F8FAFC',
      text: '#64748B',
      border: '#E2E8F0',
      solid: '#94A3B8',
    },
    neutral: {
      bg: '#EFF6FF',
      text: '#1D4ED8',
      border: '#BFDBFE',
      solid: '#3B82F6',
    },
  };

  return colors[normalized] || colors.neutral;
}

function riskColorByScore(score) {
  const n = toNumber(score, 0);

  if (n >= 20) {
    return statusColor('critico');
  }

  if (n >= 12) {
    return statusColor('alto');
  }

  if (n >= 6) {
    return statusColor('medio');
  }

  return statusColor('bajo');
}

function riskColorByLevel(level) {
  const key = normalizeKey(level);

  if (['critico', 'critica', 'critical'].includes(key)) return statusColor('critico');
  if (['alto', 'alta', 'high'].includes(key)) return statusColor('alto');
  if (['medio', 'media', 'medium'].includes(key)) return statusColor('medio');
  if (['bajo', 'baja', 'low'].includes(key)) return statusColor('bajo');

  return statusColor('neutral');
}

function formatValue(value, unit = '') {
  if (value === null || value === undefined || value === '') return '-';

  const n = Number(value);

  if (Number.isFinite(n)) {
    const formatted = Math.abs(n) >= 1000
      ? new Intl.NumberFormat('es-CL').format(n)
      : String(Math.round(n * 10) / 10);

    return `${formatted}${unit ? ` ${unit}` : ''}`;
  }

  return escapeHtml(value);
}

function renderBadge(label, status = 'neutral') {
  const color = statusColor(status);

  return `
    <span class="tcdx-badge" style="background:${color.bg};color:${color.text};border-color:${color.border};">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderEmptyState(message = 'Información no disponible para este periodo.') {
  return `
    <div class="tcdx-empty-state">
      <div class="tcdx-empty-icon">—</div>
      <div>${escapeHtml(message)}</div>
    </div>
  `;
}

function renderKpiCards(items = [], options = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const columns = options.columns || 4;

  if (safeItems.length === 0) {
    return renderEmptyState('No existen KPIs disponibles para este informe.');
  }

  return `
    <div class="tcdx-kpi-grid tcdx-kpi-grid-${columns}">
      ${safeItems.map((item) => {
        const status = item.status || item.status_color || item.color || 'neutral';
        const color = statusColor(status);
        const value = item.value ?? item.amount ?? item.count ?? '-';
        const unit = item.unit || '';
        const label = item.label || item.name || item.title || 'Indicador';
        const helper = item.helper || item.description || item.caption || '';
        const trend = item.trend || item.delta || '';

        return `
          <div class="tcdx-kpi-card" style="border-top-color:${color.solid};">
            <div class="tcdx-kpi-label">${escapeHtml(label)}</div>
            <div class="tcdx-kpi-value" style="color:${color.text};">${formatValue(value, unit)}</div>
            ${helper ? `<div class="tcdx-kpi-helper">${escapeHtml(helper)}</div>` : ''}
            ${trend ? `<div class="tcdx-kpi-trend">${escapeHtml(trend)}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderProgressBars(items = [], options = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const title = options.title || '';

  if (safeItems.length === 0) {
    return renderEmptyState('No existen datos suficientes para graficar barras de avance.');
  }

  return `
    <div class="tcdx-chart-block">
      ${title ? `<div class="tcdx-chart-title">${escapeHtml(title)}</div>` : ''}
      <div class="tcdx-bars">
        ${safeItems.map((item) => {
          const label = item.label || item.name || item.code || 'Elemento';
          const value = clamp(item.value ?? item.percent ?? item.score ?? 0);
          const status = item.status || (value >= 80 ? 'success' : value >= 60 ? 'warning' : 'danger');
          const color = statusColor(status);

          return `
            <div class="tcdx-bar-row">
              <div class="tcdx-bar-label">${escapeHtml(label)}</div>
              <div class="tcdx-bar-track">
                <div class="tcdx-bar-fill" style="width:${value}%;background:${color.solid};"></div>
              </div>
              <div class="tcdx-bar-value">${value}%</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderStatusDistribution(items = [], options = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const title = options.title || '';
  const total = safeItems.reduce((sum, item) => sum + toNumber(item.value ?? item.count, 0), 0);

  if (safeItems.length === 0 || total === 0) {
    return renderEmptyState('No existen datos suficientes para graficar distribución de estados.');
  }

  return `
    <div class="tcdx-chart-block">
      ${title ? `<div class="tcdx-chart-title">${escapeHtml(title)}</div>` : ''}
      <div class="tcdx-distribution">
        ${safeItems.map((item) => {
          const label = item.label || item.name || item.status || 'Estado';
          const value = toNumber(item.value ?? item.count, 0);
          const pct = percent(value, total);
          const color = statusColor(item.status || label);

          return `
            <div class="tcdx-distribution-row">
              <div class="tcdx-distribution-label">
                <span class="tcdx-dot" style="background:${color.solid};"></span>
                ${escapeHtml(label)}
              </div>
              <div class="tcdx-distribution-track">
                <div class="tcdx-distribution-fill" style="width:${pct}%;background:${color.solid};"></div>
              </div>
              <div class="tcdx-distribution-value">${value} · ${pct}%</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderDonut(items = [], options = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const title = options.title || '';
  const centerLabel = options.centerLabel || 'Total';
  const total = safeItems.reduce((sum, item) => sum + toNumber(item.value ?? item.count, 0), 0);

  if (safeItems.length === 0 || total === 0) {
    return renderEmptyState('No existen datos suficientes para graficar distribución.');
  }

  let current = 0;
  const gradientParts = [];

  for (const item of safeItems) {
    const value = toNumber(item.value ?? item.count, 0);
    const pct = percent(value, total);
    const next = current + pct;
    const color = statusColor(item.status || item.label || item.name).solid;

    gradientParts.push(`${color} ${current}% ${next}%`);
    current = next;
  }

  if (current < 100) {
    gradientParts.push(`#E2E8F0 ${current}% 100%`);
  }

  return `
    <div class="tcdx-chart-block">
      ${title ? `<div class="tcdx-chart-title">${escapeHtml(title)}</div>` : ''}
      <div class="tcdx-donut-layout">
        <div class="tcdx-donut" style="background:conic-gradient(${gradientParts.join(', ')});">
          <div class="tcdx-donut-center">
            <strong>${formatValue(total)}</strong>
            <span>${escapeHtml(centerLabel)}</span>
          </div>
        </div>
        <div class="tcdx-donut-legend">
          ${safeItems.map((item) => {
            const label = item.label || item.name || item.status || 'Estado';
            const value = toNumber(item.value ?? item.count, 0);
            const pct = percent(value, total);
            const color = statusColor(item.status || label);

            return `
              <div class="tcdx-donut-legend-item">
                <span class="tcdx-dot" style="background:${color.solid};"></span>
                <span>${escapeHtml(label)}</span>
                <strong>${value} · ${pct}%</strong>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTopItems(items = [], options = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, options.limit || 5) : [];
  const title = options.title || '';
  const valueLabel = options.valueLabel || 'Valor';

  if (safeItems.length === 0) {
    return renderEmptyState(options.emptyMessage || 'No existen elementos destacados para este periodo.');
  }

  return `
    <div class="tcdx-chart-block">
      ${title ? `<div class="tcdx-chart-title">${escapeHtml(title)}</div>` : ''}
      <div class="tcdx-top-list">
        ${safeItems.map((item, index) => {
          const titleText = item.title || item.name || item.label || `Elemento ${index + 1}`;
          const description = item.description || item.helper || item.caption || '';
          const value = item.value ?? item.score ?? item.count ?? '';
          const status = item.status || item.severity || item.level || 'neutral';
          const color = statusColor(status);

          return `
            <div class="tcdx-top-item">
              <div class="tcdx-top-rank" style="background:${color.bg};color:${color.text};border-color:${color.border};">
                ${index + 1}
              </div>
              <div class="tcdx-top-content">
                <div class="tcdx-top-title">${escapeHtml(titleText)}</div>
                ${description ? `<div class="tcdx-top-description">${escapeHtml(description)}</div>` : ''}
              </div>
              ${value !== '' ? `<div class="tcdx-top-value"><span>${escapeHtml(valueLabel)}</span><strong>${formatValue(value, item.unit || '')}</strong></div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTimeline(items = [], options = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const title = options.title || '';

  if (safeItems.length === 0) {
    return renderEmptyState('No existe roadmap disponible para este informe.');
  }

  return `
    <div class="tcdx-chart-block">
      ${title ? `<div class="tcdx-chart-title">${escapeHtml(title)}</div>` : ''}
      <div class="tcdx-timeline">
        ${safeItems.map((item, index) => {
          const label = item.label || item.title || item.name || `Etapa ${index + 1}`;
          const helper = item.helper || item.description || '';
          const status = item.status || (index === 0 ? 'success' : 'neutral');
          const color = statusColor(status);

          return `
            <div class="tcdx-timeline-item">
              <div class="tcdx-timeline-dot" style="background:${color.solid};"></div>
              <div class="tcdx-timeline-card" style="border-color:${color.border};">
                <div class="tcdx-timeline-title">${escapeHtml(label)}</div>
                ${helper ? `<div class="tcdx-timeline-helper">${escapeHtml(helper)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderRoadmap306090({ plan30 = [], plan60 = [], plan90 = [] } = {}, options = {}) {
  const groups = [
    { label: '30 días', items: plan30, status: 'danger-soft' },
    { label: '60 días', items: plan60, status: 'warning' },
    { label: '90 días', items: plan90, status: 'success' },
  ];

  if (!plan30.length && !plan60.length && !plan90.length) {
    return renderEmptyState('No existe plan 30/60/90 disponible para este informe.');
  }

  return `
    <div class="tcdx-chart-block">
      ${options.title ? `<div class="tcdx-chart-title">${escapeHtml(options.title)}</div>` : ''}
      <div class="tcdx-roadmap">
        ${groups.map((group) => {
          const color = statusColor(group.status);

          return `
            <div class="tcdx-roadmap-column">
              <div class="tcdx-roadmap-header" style="background:${color.bg};color:${color.text};border-color:${color.border};">
                ${escapeHtml(group.label)}
              </div>
              <div class="tcdx-roadmap-items">
                ${(Array.isArray(group.items) ? group.items : []).slice(0, 5).map((item) => {
                  const title = typeof item === 'string' ? item : item.title || item.name || item.action || 'Acción sugerida';
                  const owner = typeof item === 'object' ? item.owner || item.responsible || item.suggested_owner_role || '' : '';

                  return `
                    <div class="tcdx-roadmap-item">
                      <div>${escapeHtml(title)}</div>
                      ${owner ? `<small>${escapeHtml(owner)}</small>` : ''}
                    </div>
                  `;
                }).join('') || '<div class="tcdx-roadmap-empty">Sin acciones</div>'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderRiskHeatmap(items = [], options = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const title = options.title || 'Mapa de calor de riesgos';

  const matrix = {};

  for (let impact = 1; impact <= 5; impact += 1) {
    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      matrix[`${impact}_${likelihood}`] = 0;
    }
  }

  for (const item of safeItems) {
    const impact = clamp(item.impact ?? item.residual_impact ?? 3, 1, 5);
    const likelihood = clamp(item.likelihood ?? item.probability ?? item.residual_likelihood ?? 3, 1, 5);
    const key = `${Math.round(impact)}_${Math.round(likelihood)}`;
    matrix[key] = (matrix[key] || 0) + 1;
  }

  if (safeItems.length === 0) {
    return renderEmptyState('No existen riesgos disponibles para generar mapa de calor.');
  }

  const rows = [];

  for (let impact = 5; impact >= 1; impact -= 1) {
    const cells = [];

    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      const count = matrix[`${impact}_${likelihood}`] || 0;
      const score = impact * likelihood;
      const color = riskColorByScore(score);

      cells.push(`
        <td style="background:${color.bg};color:${color.text};border-color:${color.border};">
          <strong>${count || ''}</strong>
          <span>${score}</span>
        </td>
      `);
    }

    rows.push(`
      <tr>
        <th>${impact}</th>
        ${cells.join('')}
      </tr>
    `);
  }

  return `
    <div class="tcdx-chart-block">
      <div class="tcdx-chart-title">${escapeHtml(title)}</div>
      <div class="tcdx-heatmap-wrap">
        <div class="tcdx-heatmap-y">Impacto</div>
        <table class="tcdx-heatmap">
          <tbody>
            ${rows.join('')}
            <tr class="tcdx-heatmap-x-row">
              <th></th>
              <th>1</th>
              <th>2</th>
              <th>3</th>
              <th>4</th>
              <th>5</th>
            </tr>
          </tbody>
        </table>
        <div class="tcdx-heatmap-x">Probabilidad</div>
      </div>
    </div>
  `;
}

function renderPremiumTable(columns = [], rows = [], options = {}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const title = options.title || '';

  if (safeColumns.length === 0 || safeRows.length === 0) {
    return renderEmptyState(options.emptyMessage || 'No existen registros para mostrar en esta tabla.');
  }

  return `
    <div class="tcdx-table-block">
      ${title ? `<div class="tcdx-chart-title">${escapeHtml(title)}</div>` : ''}
      <table class="tcdx-premium-table">
        <thead>
          <tr>
            ${safeColumns.map((column) => `<th>${escapeHtml(column.label || column.key)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${safeRows.map((row) => `
            <tr>
              ${safeColumns.map((column) => {
                const raw = row[column.key];
                const value = column.render ? column.render(raw, row) : escapeHtml(raw ?? '-');
                return `<td>${value}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getReportChartStyles() {
  return `
    <style>
      .tcdx-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }

      .tcdx-empty-state {
        border: 1px dashed #CBD5E1;
        background: #F8FAFC;
        border-radius: 18px;
        padding: 18px;
        color: #64748B;
        font-size: 12px;
        line-height: 1.5;
        text-align: center;
      }

      .tcdx-empty-icon {
        width: 28px;
        height: 28px;
        margin: 0 auto 8px;
        border-radius: 999px;
        background: #E2E8F0;
        color: #64748B;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
      }

      .tcdx-kpi-grid {
        display: grid;
        gap: 12px;
        margin: 12px 0;
      }

      .tcdx-kpi-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .tcdx-kpi-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .tcdx-kpi-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

      .tcdx-kpi-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-top: 4px solid #3B82F6;
        border-radius: 18px;
        padding: 14px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        min-height: 96px;
      }

      .tcdx-kpi-label {
        color: #64748B;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
      }

      .tcdx-kpi-value {
        color: #0F172A;
        font-size: 25px;
        font-weight: 900;
        line-height: 1.1;
      }

      .tcdx-kpi-helper,
      .tcdx-kpi-trend {
        color: #64748B;
        font-size: 11px;
        line-height: 1.4;
        margin-top: 6px;
      }

      .tcdx-chart-block,
      .tcdx-table-block {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 22px;
        padding: 16px;
        margin: 14px 0;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
        break-inside: avoid;
      }

      .tcdx-chart-title {
        color: #0F172A;
        font-size: 13px;
        font-weight: 900;
        margin-bottom: 12px;
      }

      .tcdx-bars,
      .tcdx-distribution {
        display: grid;
        gap: 10px;
      }

      .tcdx-bar-row,
      .tcdx-distribution-row {
        display: grid;
        grid-template-columns: 170px 1fr 70px;
        align-items: center;
        gap: 10px;
      }

      .tcdx-bar-label,
      .tcdx-distribution-label {
        color: #334155;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }

      .tcdx-bar-track,
      .tcdx-distribution-track {
        height: 10px;
        border-radius: 999px;
        background: #E2E8F0;
        overflow: hidden;
      }

      .tcdx-bar-fill,
      .tcdx-distribution-fill {
        height: 100%;
        border-radius: 999px;
      }

      .tcdx-bar-value,
      .tcdx-distribution-value {
        color: #475569;
        font-size: 11px;
        font-weight: 800;
        text-align: right;
      }

      .tcdx-dot {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 999px;
        flex: 0 0 auto;
      }

      .tcdx-donut-layout {
        display: grid;
        grid-template-columns: 150px 1fr;
        align-items: center;
        gap: 18px;
      }

      .tcdx-donut {
        width: 140px;
        height: 140px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .tcdx-donut-center {
        width: 86px;
        height: 86px;
        border-radius: 999px;
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .tcdx-donut-center strong {
        color: #0F172A;
        font-size: 22px;
        font-weight: 900;
        line-height: 1;
      }

      .tcdx-donut-center span {
        color: #64748B;
        font-size: 10px;
        font-weight: 700;
        margin-top: 5px;
      }

      .tcdx-donut-legend {
        display: grid;
        gap: 8px;
      }

      .tcdx-donut-legend-item {
        display: grid;
        grid-template-columns: 12px 1fr auto;
        align-items: center;
        gap: 8px;
        color: #334155;
        font-size: 11px;
      }

      .tcdx-donut-legend-item strong {
        color: #0F172A;
        font-weight: 900;
      }

      .tcdx-top-list {
        display: grid;
        gap: 10px;
      }

      .tcdx-top-item {
        display: grid;
        grid-template-columns: 34px 1fr auto;
        gap: 10px;
        align-items: center;
        border: 1px solid #E2E8F0;
        border-radius: 16px;
        padding: 10px;
        background: #F8FAFC;
      }

      .tcdx-top-rank {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 900;
      }

      .tcdx-top-title {
        color: #0F172A;
        font-size: 12px;
        font-weight: 900;
      }

      .tcdx-top-description {
        color: #64748B;
        font-size: 10.5px;
        line-height: 1.4;
        margin-top: 3px;
      }

      .tcdx-top-value {
        text-align: right;
        min-width: 70px;
      }

      .tcdx-top-value span {
        display: block;
        color: #94A3B8;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .tcdx-top-value strong {
        color: #0F172A;
        font-size: 13px;
        font-weight: 900;
      }

      .tcdx-timeline {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .tcdx-timeline-item {
        position: relative;
      }

      .tcdx-timeline-dot {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        margin-bottom: 8px;
      }

      .tcdx-timeline-card {
        border: 1px solid #E2E8F0;
        background: #F8FAFC;
        border-radius: 16px;
        padding: 11px;
        min-height: 72px;
      }

      .tcdx-timeline-title {
        color: #0F172A;
        font-size: 11px;
        font-weight: 900;
      }

      .tcdx-timeline-helper {
        color: #64748B;
        font-size: 10px;
        line-height: 1.4;
        margin-top: 5px;
      }

      .tcdx-roadmap {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .tcdx-roadmap-column {
        border: 1px solid #E2E8F0;
        border-radius: 18px;
        overflow: hidden;
        background: #FFFFFF;
      }

      .tcdx-roadmap-header {
        border-bottom: 1px solid;
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 900;
      }

      .tcdx-roadmap-items {
        padding: 10px;
        display: grid;
        gap: 8px;
      }

      .tcdx-roadmap-item {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 9px;
        color: #334155;
        font-size: 10.5px;
        line-height: 1.35;
        font-weight: 700;
      }

      .tcdx-roadmap-item small {
        display: block;
        color: #64748B;
        margin-top: 4px;
        font-weight: 600;
      }

      .tcdx-roadmap-empty {
        color: #94A3B8;
        font-size: 11px;
        padding: 8px;
        text-align: center;
      }

      .tcdx-heatmap-wrap {
        position: relative;
        padding: 8px 0 22px 24px;
      }

      .tcdx-heatmap-y {
        position: absolute;
        left: 0;
        top: 44%;
        transform: rotate(-90deg);
        transform-origin: left center;
        color: #64748B;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .tcdx-heatmap-x {
        color: #64748B;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        text-align: center;
        margin-top: 5px;
      }

      .tcdx-heatmap {
        width: 100%;
        border-collapse: separate;
        border-spacing: 6px;
      }

      .tcdx-heatmap th {
        color: #64748B;
        font-size: 10px;
        font-weight: 900;
        text-align: center;
      }

      .tcdx-heatmap td {
        height: 42px;
        border: 1px solid;
        border-radius: 12px;
        text-align: center;
        vertical-align: middle;
        font-size: 11px;
      }

      .tcdx-heatmap td strong {
        display: block;
        font-size: 15px;
        font-weight: 900;
        line-height: 1;
      }

      .tcdx-heatmap td span {
        display: block;
        font-size: 8px;
        opacity: 0.75;
        margin-top: 4px;
      }

      .tcdx-heatmap-x-row th {
        height: 14px;
      }

      .tcdx-premium-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10.5px;
      }

      .tcdx-premium-table th {
        background: #F8FAFC;
        color: #475569;
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-align: left;
        padding: 9px;
        border-bottom: 1px solid #E2E8F0;
      }

      .tcdx-premium-table td {
        color: #334155;
        padding: 9px;
        border-bottom: 1px solid #E2E8F0;
        vertical-align: top;
        line-height: 1.35;
      }

      .tcdx-premium-table tr:last-child td {
        border-bottom: 0;
      }

      @media print {
        .tcdx-chart-block,
        .tcdx-table-block,
        .tcdx-kpi-card {
          break-inside: avoid;
        }
      }
    </style>
  `;
}

function renderChartSection(title, content, options = {}) {
  return `
    <section class="tcdx-chart-section ${options.className || ''}">
      ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
      ${content || renderEmptyState()}
    </section>
  `;
}

module.exports = {
  asString,
  toNumber,
  escapeHtml,
  clamp,
  percent,
  normalizeKey,
  normalizeStatus,
  statusColor,
  riskColorByScore,
  riskColorByLevel,
  formatValue,

  renderBadge,
  renderEmptyState,
  renderKpiCards,
  renderProgressBars,
  renderStatusDistribution,
  renderDonut,
  renderTopItems,
  renderTimeline,
  renderRoadmap306090,
  renderRiskHeatmap,
  renderPremiumTable,
  renderChartSection,

  getReportChartStyles,
};
