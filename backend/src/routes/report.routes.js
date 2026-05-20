const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { renderHtmlToPdf } = require('../reports/services/htmlPdfRenderer.service');
const { renderBaseTemplate } = require('../reports/templates/common/baseTemplate');
const { escapeHtml } = require('../reports/templates/common/sanitize');

router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    const tenantResult = await pool.query(
      `
      SELECT id, name
      FROM tenants
      WHERE id = $1
      LIMIT 1
      `,
      [tenant_id]
    );

    const tenantName = tenantResult.rowCount > 0
      ? tenantResult.rows[0].name
      : 'Empresa';

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.iso_code AS iso,
        c.clause,
        COALESCE(cc.category, 'General') AS category,
        COALESCE(cc.description, 'Control ' || c.clause) AS description,
        COALESCE(NULLIF(c.status, ''), 'pendiente') AS status
      FROM controls c
      LEFT JOIN LATERAL (
        SELECT cc2.*
        FROM controls_catalog cc2
        WHERE cc2.id = c.catalog_control_id
           OR (
             c.catalog_control_id IS NULL
             AND cc2.iso = c.iso_code
             AND cc2.clause = c.clause
           )
        ORDER BY
          CASE WHEN cc2.id = c.catalog_control_id THEN 0 ELSE 1 END,
          cc2.id
        LIMIT 1
      ) cc ON TRUE
      WHERE c.tenant_id = $1
      ORDER BY c.iso_code, c.clause, c.created_at
      `,
      [tenant_id]
    );

    const rows = result.rows || [];

    const total = rows.length;
    const cumple = rows.filter(r => r.status === 'cumple').length;
    const parcial = rows.filter(r => r.status === 'parcial').length;
    const noCumple = rows.filter(r => r.status === 'no cumple').length;
    const pendiente = rows.filter(r => r.status === 'pendiente' || r.status === '-').length;

    const grouped = rows.reduce((acc, row) => {
      if (!acc[row.iso]) acc[row.iso] = [];
      acc[row.iso].push(row);
      return acc;
    }, {});

    const html = renderBaseTemplate({
      title: 'Informe de Auditoría IA Compliance',
      body: `
        <main class="page">
          <section class="hero keep-together">
            <div class="brand">TCDX by Tecdex</div>
            <h1>Informe de Auditoría IA Compliance</h1>
            <p class="subtitle">Empresa: ${escapeHtml(tenantName)} · Fecha: ${escapeHtml(new Date().toLocaleString('es-CL'))}</p>
          </section>
          <section class="section grid-4">
            ${[
              ['Controles totales', total],
              ['Cumple', cumple],
              ['Parcial', parcial],
              ['No cumple', noCumple],
              ['Pendiente', pendiente],
            ].map(([label, value]) => `<div class="kpi-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
          </section>
          <section class="section card">
            <h2>Resumen por norma</h2>
            <table><tbody>${Object.keys(grouped).map((iso) => {
              const list = grouped[iso];
              const ok = list.filter(r => r.status === 'cumple').length;
              const part = list.filter(r => r.status === 'parcial').length;
              const fail = list.filter(r => r.status === 'no cumple').length;
              const pend = list.filter(r => r.status === 'pendiente' || r.status === '-').length;
              return `<tr><td><strong>${escapeHtml(iso)}</strong></td><td>Total ${list.length}</td><td>Cumple ${ok}</td><td>Parcial ${part}</td><td>No cumple ${fail}</td><td>Pendiente ${pend}</td></tr>`;
            }).join('')}</tbody></table>
          </section>
          ${Object.keys(grouped).map((iso) => `
            <section class="section card">
              <h2>Norma: ${escapeHtml(iso)}</h2>
              <table>
                <thead><tr><th>Clausula</th><th>Categoria</th><th>Control</th><th>Estado</th></tr></thead>
                <tbody>${grouped[iso].map((r) => `<tr class="table-row"><td>${escapeHtml(r.clause)}</td><td>${escapeHtml(r.category || 'General')}</td><td>${escapeHtml(r.description)}</td><td>${escapeHtml(r.status)}</td></tr>`).join('')}</tbody>
              </table>
            </section>
          `).join('')}
        </main>
      `,
    });
    const outputPath = path.join('/tmp', `tcdx-legacy-report-${crypto.randomUUID()}.pdf`);
    await renderHtmlToPdf({
      html,
      outputPath,
      requestId: req.requestId || null,
      metadata: { templateName: 'legacy-ia-compliance-report' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=auditoria.pdf');
    fs.createReadStream(outputPath)
      .on('close', () => fs.unlink(outputPath, () => {}))
      .pipe(res);

  } catch (err) {
    console.error('ERROR REPORT PDF:', err);
    res.status(500).json({ error: 'Error PDF' });
  }
});

module.exports = router;
