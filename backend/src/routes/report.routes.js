const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');

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

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=auditoria.pdf');

    doc.pipe(res);

    // HEADER
    doc.fontSize(18).text('Informe de Auditoría IA Compliance', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Empresa: ${tenantName}`);
    doc.text(`Fecha: ${new Date().toLocaleString('es-CL')}`);
    doc.moveDown();

    // RESUMEN GENERAL
    doc.fontSize(14).text('Resumen general');
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Controles totales: ${total}`);
    doc.text(`Cumple: ${cumple}`);
    doc.text(`Parcial: ${parcial}`);
    doc.text(`No cumple: ${noCumple}`);
    doc.text(`Pendiente: ${pendiente}`);
    doc.moveDown();

    // RESUMEN POR NORMA
    doc.fontSize(14).text('Resumen por norma');
    doc.moveDown(0.5);

    Object.keys(grouped).forEach((iso) => {
      const list = grouped[iso];
      const ok = list.filter(r => r.status === 'cumple').length;
      const part = list.filter(r => r.status === 'parcial').length;
      const fail = list.filter(r => r.status === 'no cumple').length;
      const pend = list.filter(r => r.status === 'pendiente' || r.status === '-').length;

      doc.fontSize(11).text(`${iso}: total ${list.length} | cumple ${ok} | parcial ${part} | no cumple ${fail} | pendiente ${pend}`);
    });

    doc.moveDown();

    // DETALLE
    Object.keys(grouped).forEach((iso, index) => {
      if (index > 0) doc.addPage();

      doc.fontSize(16).text(`Norma: ${iso}`);
      doc.moveDown();

      grouped[iso].forEach((r) => {
        doc.fontSize(11).text(`Cláusula: ${r.clause}`);
        doc.text(`Categoría: ${r.category || 'General'}`);
        doc.text(`Control: ${r.description}`);
        doc.text(`Estado: ${r.status}`);
        doc.moveDown(0.7);
      });
    });

    doc.end();

  } catch (err) {
    console.error('ERROR REPORT PDF:', err);
    res.status(500).json({ error: 'Error PDF' });
  }
});

module.exports = router;
