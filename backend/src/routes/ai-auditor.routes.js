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
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalizeRole(user));
}

function ensureTenantAccess(req, tenantId) {
  if (isPlatform(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
}

function canRead(user) {
  return (
    ['admin', 'tenant_admin', 'auditor', 'operativo', 'viewer'].includes(normalizeRole(user)) ||
    isPlatform(user)
  );
}

function canAnalyze(user) {
  return ['admin', 'tenant_admin', 'auditor'].includes(normalizeRole(user)) || isPlatform(user);
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((Number(part || 0) / Number(total || 1)) * 1000) / 10;
}

function safeText(value, fallback = '') {
  return String(value || fallback || '').trim();
}

async function tableHasColumn(tableName, columnName) {
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [tableName, columnName]
  );

  return result.rowCount > 0;
}

async function getAudit(auditId) {
  const result = await pool.query(
    `
    SELECT *
    FROM audits
    WHERE id = $1::uuid
    LIMIT 1
    `,
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
    ORDER BY clause NULLS LAST, control_code NULLS LAST, control_title NULLS LAST
    `,
    [auditId]
  );

  return result.rows;
}

async function getEvidenceStats(tenantId, auditId, checklist) {
  try {
    const hasTenantControlId = await tableHasColumn('evidences', 'tenant_control_id');
    const hasControlId = await tableHasColumn('evidences', 'control_id');

    const ids = checklist
      .map((item) => item.tenant_control_id)
      .filter(Boolean)
      .map(String);

    if (!ids.length) {
      return {
        total: 0,
        by_control: {},
      };
    }

    const conditions = [];

    if (hasTenantControlId) {
      conditions.push(`e.tenant_control_id::text = ANY($2::text[])`);
    }

    if (hasControlId) {
      conditions.push(`e.control_id::text = ANY($2::text[])`);
    }

    if (!conditions.length) {
      const totalOnly = await pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM evidences
        WHERE tenant_id = $1::uuid
        `,
        [tenantId]
      );

      return {
        total: Number(totalOnly.rows[0]?.total || 0),
        by_control: {},
      };
    }

    const result = await pool.query(
      `
      SELECT
        COALESCE(e.tenant_control_id::text, e.control_id::text) AS control_ref,
        COUNT(*)::int AS total
      FROM evidences e
      WHERE e.tenant_id = $1::uuid
        AND (${conditions.join(' OR ')})
        AND COALESCE(e.status, '') <> 'deleted'
      GROUP BY COALESCE(e.tenant_control_id::text, e.control_id::text)
      `,
      [tenantId, ids]
    );

    const byControl = {};

    result.rows.forEach((row) => {
      byControl[String(row.control_ref)] = Number(row.total || 0);
    });

    const total = Object.values(byControl).reduce((acc, value) => acc + Number(value || 0), 0);

    return {
      total,
      by_control: byControl,
    };
  } catch (error) {
    console.error('AI AUDITOR EVIDENCE STATS ERROR:', error.message);
    return {
      total: 0,
      by_control: {},
    };
  }
}

async function getRelations(audit) {
  const result = await pool.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM findings WHERE tenant_id = $1::uuid AND audit_id = $2::uuid) AS findings_count,
      (SELECT COUNT(*)::int FROM action_plans WHERE tenant_id = $1::uuid AND audit_id = $2::uuid) AS actions_count,
      (SELECT COUNT(*)::int FROM evidences WHERE tenant_id = $1::uuid) AS tenant_evidences_count,
      (SELECT COUNT(*)::int FROM findings WHERE tenant_id = $1::uuid AND COALESCE(status, '') NOT IN ('cerrado','closed','completado')) AS open_findings_count,
      (SELECT COUNT(*)::int FROM action_plans WHERE tenant_id = $1::uuid AND COALESCE(status, '') NOT IN ('cerrado','closed','completado')) AS open_actions_count
    `,
    [audit.tenant_id, audit.id]
  );

  return result.rows[0] || {};
}

function classifyControlRisk(item, evidenceCount) {
  const result = String(item.result || 'pendiente').toLowerCase();
  const health = String(item.initial_health_status || '').toLowerCase();

  let score = 20;
  const reasons = [];

  if (result === 'no_conforme') {
    score += 55;
    reasons.push('resultado no conforme');
  }

  if (result === 'sin_evidencia') {
    score += 45;
    reasons.push('sin evidencia objetiva');
  }

  if (result === 'observacion') {
    score += 28;
    reasons.push('observación del auditor');
  }

  if (result === 'pendiente') {
    score += 18;
    reasons.push('pendiente de revisión');
  }

  if (health.includes('deterior') || health.includes('crit') || health.includes('rojo')) {
    score += 25;
    reasons.push('salud inicial deteriorada');
  }

  if (health.includes('atenc') || health.includes('warning') || health.includes('amarillo')) {
    score += 12;
    reasons.push('salud inicial en atención');
  }

  if (Number(evidenceCount || 0) === 0 && ['no_conforme', 'sin_evidencia', 'observacion'].includes(result)) {
    score += 15;
    reasons.push('sin respaldo documental asociado al control');
  }

  const finalScore = Math.min(100, Math.max(0, score));

  let level = 'bajo';
  if (finalScore >= 75) level = 'alto';
  else if (finalScore >= 50) level = 'medio';

  return {
    risk_score: finalScore,
    risk_level: level,
    reasons,
  };
}

function buildAnalysis({ audit, checklist, evidenceStats, relations }) {
  const total = checklist.length;
  const conformes = checklist.filter((item) => item.result === 'conforme').length;
  const noConformes = checklist.filter((item) => item.result === 'no_conforme').length;
  const observaciones = checklist.filter((item) => item.result === 'observacion').length;
  const sinEvidencia = checklist.filter((item) => item.result === 'sin_evidencia').length;
  const pendientes = checklist.filter((item) => !item.result || item.result === 'pendiente').length;
  const noAplica = checklist.filter((item) => item.result === 'no_aplica').length;

  const reviewed = total - pendientes;
  const reviewedPct = pct(reviewed, total);
  const conformityPct = pct(conformes, Math.max(1, total - noAplica));

  const criticalControls = checklist
    .map((item) => {
      const evidenceCount = evidenceStats.by_control?.[String(item.tenant_control_id)] || 0;
      const risk = classifyControlRisk(item, evidenceCount);

      return {
        control_review_id: item.id,
        tenant_control_id: item.tenant_control_id,
        control_code: item.control_code,
        control_title: item.control_title,
        clause: item.clause,
        result: item.result,
        notes: item.notes,
        evidence_count: evidenceCount,
        ...risk,
      };
    })
    .filter((item) => item.risk_level !== 'bajo')
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 12);

  const penalties =
    noConformes * 12 +
    sinEvidencia * 9 +
    observaciones * 5 +
    pendientes * 2;

  const readinessScore = Math.max(0, Math.min(100, Math.round(100 - penalties)));

  const suggestions = [];

  criticalControls.forEach((item) => {
    if (item.result === 'no_conforme') {
      suggestions.push({
        type: 'hallazgo',
        priority: 'alta',
        title: `Formalizar no conformidad en ${item.control_title || item.control_code || 'control'}`,
        why: `El control presenta resultado no conforme y riesgo ${item.risk_level}.`,
        recommended_record: 'finding',
        recommended_next_step:
          'Crear hallazgo/no conformidad, definir causa raíz, responsable y plan correctivo.',
        control_review_id: item.control_review_id,
        tenant_control_id: item.tenant_control_id,
        standard_code: audit.iso,
      });
    } else if (item.result === 'sin_evidencia') {
      suggestions.push({
        type: 'evidencia',
        priority: 'alta',
        title: `Regularizar evidencia en ${item.control_title || item.control_code || 'control'}`,
        why: 'El control no cuenta con evidencia suficiente para sostener conformidad.',
        recommended_record: 'evidence_or_action',
        recommended_next_step:
          'Cargar evidencia objetiva o crear plan de acción para regularizar respaldo documental.',
        control_review_id: item.control_review_id,
        tenant_control_id: item.tenant_control_id,
        standard_code: audit.iso,
      });
    } else if (item.result === 'observacion') {
      suggestions.push({
        type: 'mejora',
        priority: 'media',
        title: `Gestionar observación en ${item.control_title || item.control_code || 'control'}`,
        why: 'Existe observación que puede transformarse en brecha si no se trata.',
        recommended_record: 'action_plan',
        recommended_next_step:
          'Crear acción preventiva o de mejora, asignar responsable y fecha de revisión.',
        control_review_id: item.control_review_id,
        tenant_control_id: item.tenant_control_id,
        standard_code: audit.iso,
      });
    }
  });

  if (pendientes > 0) {
    suggestions.push({
      type: 'gobierno',
      priority: 'media',
      title: 'Completar checklist antes del cierre formal',
      why: `Hay ${pendientes} controles pendientes de revisión.`,
      recommended_record: 'audit_followup',
      recommended_next_step:
        'Completar evaluación de controles pendientes antes de cerrar auditoría.',
      standard_code: audit.iso,
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      type: 'positivo',
      priority: 'baja',
      title: 'Auditoría sin brechas críticas detectadas',
      why: 'No se detectaron no conformidades ni brechas relevantes en el checklist actual.',
      recommended_record: 'monitoring',
      recommended_next_step:
        'Mantener evidencia actualizada y programar seguimiento periódico.',
      standard_code: audit.iso,
    });
  }

  const executiveSummary = [
    `La auditoría ${audit.iso} presenta un score de preparación de ${readinessScore}%.`,
    `Se han revisado ${reviewed} de ${total} controles (${reviewedPct}%).`,
    `El nivel de conformidad observado es ${conformityPct}%, con ${noConformes} no conformidades, ${observaciones} observaciones y ${sinEvidencia} controles sin evidencia suficiente.`,
    `La recomendación principal es priorizar ${criticalControls.length} controles críticos antes del cierre formal de la auditoría.`,
  ].join(' ');

  const diagnosis = {
    readiness_score: readinessScore,
    reviewed_percent: reviewedPct,
    conformity_percent: conformityPct,
    total_controls: total,
    reviewed_controls: reviewed,
    conformes,
    no_conformes: noConformes,
    observaciones,
    sin_evidencia: sinEvidencia,
    pendientes,
    no_aplica: noAplica,
    audit_findings_count: Number(relations.findings_count || 0),
    audit_actions_count: Number(relations.actions_count || 0),
    evidence_count: Number(evidenceStats.total || 0),
    open_findings_count: Number(relations.open_findings_count || 0),
    open_actions_count: Number(relations.open_actions_count || 0),
  };

  return {
    version: 'ai-auditor-v2-contextual',
    executive_summary: executiveSummary,
    diagnosis,
    critical_controls: criticalControls,
    suggestions: suggestions.slice(0, 14),
    human_approval_required: true,
    recommended_use:
      'Usar este análisis como apoyo del auditor humano. No crea hallazgos ni planes automáticamente.',
  };
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
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para este tenant',
      });
    }

    const checklist = await getChecklist(audit.id);
    const evidenceStats = await getEvidenceStats(audit.tenant_id, audit.id, checklist);
    const relations = await getRelations(audit);

    return res.json({
      ok: true,
      audit,
      checklist,
      evidence_stats: evidenceStats,
      relations,
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
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para este tenant',
      });
    }

    const checklist = await getChecklist(audit.id);
    const evidenceStats = await getEvidenceStats(audit.tenant_id, audit.id, checklist);
    const relations = await getRelations(audit);

    const analysis = buildAnalysis({
      audit,
      checklist,
      evidenceStats,
      relations,
    });

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
        analysis.executive_summary,
        JSON.stringify(analysis),
        JSON.stringify({
          source: 'ai-auditor-v2-contextual',
          checklist_total: checklist.length,
          evidence_total: evidenceStats.total,
          relations,
          generated_at: new Date().toISOString(),
        }),
      ]
    );

    return res.json({
      ok: true,
      data: inserted.rows[0],
      analysis,
      summary: analysis.executive_summary,
      suggestions: analysis.suggestions,
      note:
        'IA Auditor entrega recomendaciones contextualizadas. La creación formal de hallazgos, acciones o evidencias debe ser aprobada por un usuario autorizado.',
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
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para este tenant',
      });
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
