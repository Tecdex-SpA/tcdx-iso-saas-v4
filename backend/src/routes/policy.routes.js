const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.get('/:tenant_id/:iso', auth, async (req, res) => {
  try {
    const { tenant_id, iso } = req.params;

    const tenantResult = await pool.query(
      `
      SELECT id, name
      FROM tenants
      WHERE id = $1
      LIMIT 1
      `,
      [tenant_id]
    );

    const standardResult = await pool.query(
      `
      SELECT code, name
      FROM standards
      WHERE code = $1
      LIMIT 1
      `,
      [iso]
    );

    const controlsResult = await pool.query(
      `
      SELECT clause, description
      FROM controls_catalog
      WHERE iso = $1
      ORDER BY clause, id
      `,
      [iso]
    );

    if (standardResult.rowCount === 0) {
      return res.status(404).json({ error: 'Norma no encontrada' });
    }

    const tenantName = tenantResult.rowCount > 0
      ? tenantResult.rows[0].name
      : 'La organización';

    const standardName = standardResult.rows[0].name || iso;
    const controls = controlsResult.rows || [];

    const groupedByClause = {};
    controls.forEach((c) => {
      if (!groupedByClause[c.clause]) {
        groupedByClause[c.clause] = [];
      }
      groupedByClause[c.clause].push(c.description);
    });

    let contenido = '';
    contenido += `POLÍTICA DE ${standardName.toUpperCase()}\n\n`;
    contenido += `Organización: ${tenantName}\n`;
    contenido += `Norma: ${iso}\n`;
    contenido += `Fecha de emisión: ${new Date().toLocaleDateString('es-CL')}\n\n`;

    contenido += `1. OBJETIVO\n`;
    contenido += `Establecer los lineamientos generales para implementar, mantener y mejorar continuamente el sistema de gestión asociado a la norma ${iso}, asegurando su integración con los procesos de ${tenantName}.\n\n`;

    contenido += `2. ALCANCE\n`;
    contenido += `Esta política aplica a todos los procesos, activos, colaboradores, servicios, proveedores y actividades de ${tenantName} que estén relacionados con el cumplimiento de ${iso}.\n\n`;

    contenido += `3. PRINCIPIOS GENERALES\n`;
    contenido += `- Cumplir los requisitos legales, regulatorios, contractuales y normativos aplicables.\n`;
    contenido += `- Mantener un enfoque preventivo y basado en riesgos.\n`;
    contenido += `- Promover la mejora continua del sistema de gestión.\n`;
    contenido += `- Mantener evidencia documentada del cumplimiento.\n`;
    contenido += `- Asignar responsabilidades claras para la implementación y seguimiento.\n\n`;

    contenido += `4. DIRECTRICES CLAVE DEL SISTEMA\n`;

    Object.keys(groupedByClause).forEach((clause) => {
      contenido += `\nCláusula ${clause}\n`;
      groupedByClause[clause].slice(0, 8).forEach((desc) => {
        contenido += `- ${desc}\n`;
      });
    });

    contenido += `\n5. RESPONSABILIDADES\n`;
    contenido += `La dirección de ${tenantName} es responsable de promover esta política, asignar recursos, asegurar la capacitación del personal y supervisar el cumplimiento efectivo del sistema.\n\n`;

    contenido += `6. MEJORA CONTINUA\n`;
    contenido += `La organización se compromete a revisar periódicamente esta política, evaluar su eficacia y actualizarla cuando existan cambios relevantes en el contexto, en los riesgos o en los requisitos de ${iso}.\n\n`;

    contenido += `7. CUMPLIMIENTO\n`;
    contenido += `Todo el personal, proveedores y partes interesadas relevantes deberán actuar conforme a esta política y apoyar la implementación y sostenibilidad del sistema de gestión alineado con ${iso}.\n`;

    res.json({ policy: contenido });

  } catch (err) {
    console.error('ERROR GENERATING POLICY:', err);
    res.status(500).json({ error: 'Error generating policy' });
  }
});

module.exports = router;
