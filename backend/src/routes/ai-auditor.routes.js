const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || null;
}

function isPlatform(user) {
  return ['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(normalizeRole(user));
}

function ensureTenantAccess(req, tenantId) {
  if (isPlatform(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
}

function canRead(user) {
  return ['admin', 'tenant_admin', 'auditor', 'operativo', 'viewer'].includes(normalizeRole(user)) || isPlatform(user);
}

function canAnalyze(user) {
  return ['admin', 'tenant_admin', 'auditor'].includes(normalizeRole(user)) || isPlatform(user);
}

async function getAudit(auditId) {
  const result = await pool.query(
    `SELECT * FROM audits WHERE id = $1::uuid LIMIT 1`,
    [auditId]
  );

  return result.rows[0] || null;
}

async function getChecklist(auditId) {
  const result = await pool.query(
    `
    SELECT *
    FROM audit_control_reviews
    WHERE audit_id = $1::uuid
    ORDER BY clause NULLS LAST, control_code NULLS LAST
    `,
    [auditId]
  );

  return result.rows;
}

function buildSuggestions(audit, checklist) {
  const suggestions = [];

  const noConformes = checklist.filter((item) => item.result === 'no_conforme');
  const observaciones = checklist.filter((item) => item.result === 'observacion');
  const sinEvidencia = checklist.filter((item) => item.result === 'sin_evidencia');
  const pendientes = checklist.filter((item) => item.result === 'pendiente');

  for (const item of noConformes.slice(0, 8)) {
    suggestions.push({
      type: 'finding',
      severity: 'alta',
      title: `No conformidad potencial en ${item.control_code || 'control'}`,
      description: `El control "${item.control_title || item.control_code}" fue marcado como no conforme durante la auditoría ${audit.iso}. Revisar evidencia, causa raíz y acción correctiva.`,
      control_review_id: item.id,
      tenant_control_id: item.tenant_control_id,
      standard_code: audit.iso,
    });
  }

  for (const item of sinEvidencia.slice(0, 8)) {
    suggestions.push({
      type: 'action',
      priority: 'alta',
      title: `Regularizar evidencia para ${item.control_code || 'control'}`,
      description: `El control "${item.control_title || item.control_code}" no cuenta con evidencia suficiente. Se recomienda cargar evidencia objetiva, responsable y fecha de control.`,
      control_review_id: item.id,
      tenant_control_id: item.tenant_control_id,
      standard_code: audit.iso,
    });
  }

  for (const item of observaciones.slice(0, 6)) {
    suggestions.push({
      type: 'improvement',
      priority: 'media',
      title: `Mejora recomendada en ${item.control_code || 'control'}`,
      description: `El control "${item.control_title || item.control_code}" presenta observaciones. Se recomienda revisar madurez, actualización documental o frecuencia de revisión.`,
      control_review_id: item.id,
      tenant_control_id: item.tenant_control_id,
      standard_code: audit.iso,
    });
  }

  if (pendientes.length > 0) {
    suggestions.push({
      type: 'governance',
      priority: 'media',
      title: 'Completar revisión de controles pendientes',
      description: `Existen ${pendientes.length} controles pendientes de evaluación. La IA recomienda completar el checklist antes de cerrar la auditoría.`,
      standard_code: audit.iso,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: 'positive',
      priority: 'baja',
      title: 'Auditoría sin brechas críticas detectadas',
      description: 'No se detectaron no conformidades, observaciones ni falta de evidencia en los controles revisados. Mantener seguimiento y evidencia actualizada.',
      standard_code: audit.iso,
    });
  }

  return suggestions;
}

function buildSummary(audit, checklist, suggestions) {
  const total = checklist.length;
  const conformes = checklist.filter((item) => item.result === 'conforme').length;
  const noConformes = checklist.filter((item) => item.result === 'no_conforme').length;
  const observaciones = checklist.filter((item) => item.result === 'observacion').length;
  const sinEvidencia = checklist.filter((item) => item.result === 'sin_evidencia').length;
  const pendientes = checklist.filter((item) => item.result === 'pendiente').length;

  return [
    `Análisis IA Auditor para ${audit.iso}.`,
    `Controles revisados: ${total}.`,
    `Conformes: ${conformes}.`,
    `No conformes: ${noConformes}.`,
    `Observaciones: ${observaciones}.`,
    `Sin evidencia: ${sinEvidencia}.`,
    `Pendientes: ${pendientes}.`,
    `Sugerencias generadas: ${suggestions.length}.`,
    'Las sugerencias requieren aprobación humana antes de convertirse en hallazgos o planes de acción.',
  ].join(' ');
}

router.get('/context/:audit_id', auth, async (req, res) => {
  try {
    if (!canRead(req.user)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado' });
    }

    const audit = await getAudit(req.params.audit_id);

    if (!audit) {
      return res.status(404).json({ ok: false, error: 'Auditoría no encontrada' });
    }

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para este tenant' });
    }

    const checklist = await getChecklist(audit.id);

    const relations = await pool.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM findings WHERE tenant_id = $1::uuid AND audit_id = $2::uuid) AS findings_count,
        (SELECT COUNT(*)::int FROM action_plans WHERE tenant_id = $1::uuid AND audit_id = $2::uuid) AS actions_count,
        (SELECT COUNT(*)::int FROM evidences WHERE tenant_id = $1::uuid) AS evidences_count
      `,
      [audit.tenant_id, audit.id]
    );

    return res.json({
      ok: true,
      audit,
      checklist,
      relations: relations.rows[0] || {},
    });
  } catch (error) {
    console.error('ERROR AI AUDITOR CONTEXT:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo contexto IA Auditor',
      detail: error.message,
    });
  }
});

router.post('/analyze/:audit_id', auth, async (req, res) => {
  try {
    if (!canAnalyze(req.user)) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para ejecutar IA Auditor',
      });
    }

    const audit = await getAudit(req.params.audit_id);

    if (!audit) {
      return res.status(404).json({ ok: false, error: 'Auditoría no encontrada' });
    }

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para este tenant' });
    }

    const checklist = await getChecklist(audit.id);
    const suggestions = buildSuggestions(audit, checklist);
    const summary = buildSummary(audit, checklist, suggestions);

    const inserted = await pool.query(
      `
      INSERT INTO ai_auditor_runs (
        tenant_id,
        audit_id,
        standard_code,
        requested_by,
        status,
        summary,
        suggestions_json,
        source_trace_json
      )
      VALUES ($1,$2,$3,$4,'completed',$5,$6::jsonb,$7::jsonb)
      RETURNING *
      `,
      [
        audit.tenant_id,
        audit.id,
        audit.iso,
        getUserId(req.user),
        summary,
        JSON.stringify(suggestions),
        JSON.stringify({
          source: 'ai-auditor-v1-rules-engine',
          checklist_total: checklist.length,
          generated_at: new Date().toISOString(),
        }),
      ]
    );

    return res.json({
      ok: true,
      data: inserted.rows[0],
      summary,
      suggestions,
      note: 'IA Auditor v1 entrega sugerencias. La creación formal de hallazgos o acciones debe ser aprobada por un usuario autorizado.',
    });
  } catch (error) {
    console.error('ERROR AI AUDITOR ANALYZE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error ejecutando IA Auditor',
      detail: error.message,
    });
  }
});

router.get('/runs/:tenant_id', auth, async (req, res) => {
  try {
    if (!canRead(req.user)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado' });
    }

    const { tenant_id } = req.params;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      SELECT
        r.*,
        a.iso,
        a.start_date,
        a.end_date,
        a.auditor_name
      FROM ai_auditor_runs r
      LEFT JOIN audits a ON a.id = r.audit_id
      WHERE r.tenant_id = $1::uuid
      ORDER BY r.created_at DESC
      LIMIT 30
      `,
      [tenant_id]
    );

    return res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET AI AUDITOR RUNS:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo historial IA Auditor',
      detail: error.message,
    });
  }
});

module.exports = router;
