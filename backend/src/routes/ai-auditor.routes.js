const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { errorDetail } = require('../utils/errorResponse');

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
      (SELECT COUNT(*)::int FROM action_plans WHERE tenant_id = $1::uuid AND COALESCE(status, '') NOT IN ('cerrado','closed','completado')) AS open_actions_count,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', f.id,
            'title', f.title,
            'description', f.description,
            'finding_type', f.finding_type,
            'severity', f.severity,
            'status', f.status,
            'tenant_control_id', f.tenant_control_id,
            'created_at', f.created_at
          )
          ORDER BY f.created_at DESC NULLS LAST
        )
        FROM findings f
        WHERE f.tenant_id = $1::uuid
          AND f.audit_id = $2::uuid
        LIMIT 30
      ), '[]'::jsonb) AS audit_findings,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ap.id,
            'title', ap.title,
            'description', ap.description,
            'priority', ap.priority,
            'status', ap.status,
            'tenant_control_id', ap.tenant_control_id,
            'created_at', ap.created_at
          )
          ORDER BY ap.created_at DESC NULLS LAST
        )
        FROM action_plans ap
        WHERE ap.tenant_id = $1::uuid
          AND ap.audit_id = $2::uuid
        LIMIT 30
      ), '[]'::jsonb) AS audit_actions
    `,
    [audit.tenant_id, audit.id]
  );

  return result.rows[0] || {};
}

function normalizeResult(value) {
  return String(value || 'pendiente').toLowerCase().trim();
}

function visibleControlName(item) {
  return (
    safeText(item.control_title) ||
    safeText(item.control_code) ||
    (safeText(item.clause) ? `Cláusula ${safeText(item.clause)}` : '') ||
    'Control sin nombre'
  );
}

function isOpenStatus(status) {
  const normalized = String(status || '').toLowerCase().trim();
  return !['cerrado', 'closed', 'completado', 'completada', 'resuelto', 'resolved'].includes(normalized);
}

function buildDuplicatedOrUnresolvedFindings(auditFindings = []) {
  const open = auditFindings.filter((item) => isOpenStatus(item.status));
  const seen = new Map();
  const duplicates = [];

  for (const item of auditFindings) {
    const key = `${String(item.title || '').trim().toLowerCase()}|${String(
      item.tenant_control_id || ''
    )}`;

    if (!key.trim()) continue;

    if (seen.has(key)) {
      duplicates.push({
        id: item.id,
        duplicated_with: seen.get(key),
        title: item.title,
        status: item.status,
        tenant_control_id: item.tenant_control_id,
      });
    } else {
      seen.set(key, item.id);
    }
  }

  return {
    unresolved_count: open.length,
    duplicates_count: duplicates.length,
    unresolved: open.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title,
      finding_type: item.finding_type,
      severity: item.severity,
      status: item.status,
      tenant_control_id: item.tenant_control_id,
    })),
    duplicates: duplicates.slice(0, 6),
  };
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
  const conformes = checklist.filter((item) => normalizeResult(item.result) === 'conforme').length;
  const noConformes = checklist.filter((item) => normalizeResult(item.result) === 'no_conforme').length;
  const observaciones = checklist.filter((item) => normalizeResult(item.result) === 'observacion').length;
  const sinEvidencia = checklist.filter((item) => normalizeResult(item.result) === 'sin_evidencia').length;
  const pendientes = checklist.filter((item) => normalizeResult(item.result) === 'pendiente').length;
  const noAplica = checklist.filter((item) => normalizeResult(item.result) === 'no_aplica').length;

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
        initial_status: item.initial_status,
        initial_health_status: item.initial_health_status,
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

  const recommendedFindings = [];
  const recommendedActions = [];
  const recommendedEvidenceRequests = [];
  const governanceWarnings = [];

  criticalControls.forEach((item) => {
    const controlName = visibleControlName(item);

    if (normalizeResult(item.result) === 'no_conforme') {
      recommendedFindings.push({
        type: 'hallazgo',
        priority: 'alta',
        title: `Formalizar no conformidad en ${controlName}`,
        why: `El control presenta resultado no conforme y riesgo ${item.risk_level}.`,
        recommended_record: 'finding',
        recommended_next_step:
          'Crear hallazgo/no conformidad, definir causa raíz, responsable y plan correctivo.',
        control_review_id: item.control_review_id,
        tenant_control_id: item.tenant_control_id,
        standard_code: audit.iso,
      });
    } else if (normalizeResult(item.result) === 'sin_evidencia') {
      recommendedEvidenceRequests.push({
        type: 'evidencia',
        priority: 'alta',
        title: `Regularizar evidencia en ${controlName}`,
        why: 'El control no cuenta con evidencia suficiente para sostener conformidad.',
        recommended_record: 'evidence_or_action',
        recommended_next_step:
          'Cargar evidencia objetiva o crear plan de acción para regularizar respaldo documental.',
        control_review_id: item.control_review_id,
        tenant_control_id: item.tenant_control_id,
        standard_code: audit.iso,
      });
    } else if (normalizeResult(item.result) === 'observacion') {
      recommendedActions.push({
        type: 'mejora',
        priority: 'media',
        title: `Gestionar observación en ${controlName}`,
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

  const evidenceGaps = checklist
    .map((item) => {
      const evidenceCount = evidenceStats.by_control?.[String(item.tenant_control_id)] || 0;
      const result = normalizeResult(item.result);

      return {
        control_review_id: item.id,
        tenant_control_id: item.tenant_control_id,
        control_code: item.control_code,
        control_title: item.control_title,
        clause: item.clause,
        result,
        evidence_count: evidenceCount,
        reason:
          result === 'sin_evidencia'
            ? 'Resultado marcado sin evidencia'
            : 'Sin evidencia vinculada al control',
      };
    })
    .filter((item) => {
      if (item.result === 'no_aplica') return false;
      if (item.result === 'sin_evidencia') return true;
      return Number(item.evidence_count || 0) === 0 && ['pendiente', 'observacion', 'no_conforme'].includes(item.result);
    })
    .slice(0, 15);

  if (pendientes > 0) {
    governanceWarnings.push({
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

  if (noConformes > 0 && Number(relations.findings_count || 0) === 0) {
    governanceWarnings.push({
      type: 'gobierno',
      priority: 'alta',
      title: 'No conformidades sin hallazgo formal asociado',
      why: 'El checklist contiene resultados no conformes, pero esta auditoría aún no registra hallazgos vinculados.',
      recommended_record: 'finding',
      recommended_next_step: 'Revisar con el auditor responsable qué resultados deben formalizarse como hallazgo o no conformidad.',
      standard_code: audit.iso,
    });
  }

  if ((noConformes + sinEvidencia + observaciones) > 0 && Number(relations.actions_count || 0) === 0) {
    governanceWarnings.push({
      type: 'gobierno',
      priority: 'media',
      title: 'Brechas detectadas sin plan de acción asociado',
      why: 'Existen resultados que requieren tratamiento y aún no hay acciones vinculadas a la auditoría.',
      recommended_record: 'action_plan',
      recommended_next_step: 'Definir acciones correctivas o preventivas para las brechas priorizadas.',
      standard_code: audit.iso,
    });
  }

  const duplicatedOrUnresolvedFindings = buildDuplicatedOrUnresolvedFindings(
    Array.isArray(relations.audit_findings) ? relations.audit_findings : []
  );

  if (duplicatedOrUnresolvedFindings.duplicates_count > 0) {
    governanceWarnings.push({
      type: 'gobierno',
      priority: 'media',
      title: 'Posibles hallazgos duplicados',
      why: `Se detectaron ${duplicatedOrUnresolvedFindings.duplicates_count} coincidencias por título/control dentro de la auditoría.`,
      recommended_record: 'finding_review',
      recommended_next_step: 'Consolidar duplicados antes de emitir conclusiones ejecutivas.',
      standard_code: audit.iso,
    });
  }

  const suggestedNextSteps = [
    pendientes > 0 ? `Completar ${pendientes} controles pendientes antes del cierre.` : null,
    evidenceGaps.length > 0 ? `Solicitar o cargar evidencia para ${evidenceGaps.length} controles priorizados.` : null,
    noConformes > 0 ? 'Formalizar las no conformidades confirmadas con aprobación humana.' : null,
    governanceWarnings.length > 0 ? 'Resolver advertencias de gobierno antes de cerrar o presentar el informe.' : null,
    Number(relations.actions_count || 0) > 0 ? 'Revisar avance de acciones asociadas a esta auditoría.' : null,
  ].filter(Boolean);

  const executiveSummary = [
    `La auditoría ${audit.iso} presenta un score de preparación de ${readinessScore}%.`,
    `Se han revisado ${reviewed} de ${total} controles (${reviewedPct}%).`,
    `El nivel de conformidad observado es ${conformityPct}%, con ${noConformes} no conformidades, ${observaciones} observaciones y ${sinEvidencia} controles sin evidencia suficiente.`,
    criticalControls.length
      ? `La recomendación principal es priorizar ${criticalControls.length} controles críticos antes del cierre formal de la auditoría.`
      : 'No se detectan controles críticos con la información actualmente registrada.',
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

  const suggestions = [
    ...recommendedFindings,
    ...recommendedActions,
    ...recommendedEvidenceRequests,
    ...governanceWarnings,
  ];

  return {
    version: 'ai-auditor-v2-contextual',
    executive_summary: executiveSummary,
    readiness_score: readinessScore,
    reviewed_percent: reviewedPct,
    conformity_percent: conformityPct,
    diagnosis,
    critical_controls: criticalControls,
    evidence_gaps: evidenceGaps,
    duplicated_or_unresolved_findings: duplicatedOrUnresolvedFindings,
    recommended_findings: recommendedFindings.slice(0, 8),
    recommended_actions: recommendedActions.slice(0, 8),
    recommended_evidence_requests: recommendedEvidenceRequests.slice(0, 8),
    governance_warnings: governanceWarnings.slice(0, 8),
    suggested_next_steps: suggestedNextSteps.length
      ? suggestedNextSteps
      : ['Mantener evidencia actualizada y programar seguimiento periódico.'],
    suggestions: suggestions.length
      ? suggestions.slice(0, 18)
      : [
          {
            type: 'positivo',
            priority: 'baja',
            title: 'Auditoría sin brechas críticas detectadas',
            why: 'No se detectaron no conformidades ni brechas relevantes en el checklist actual.',
            recommended_record: 'monitoring',
            recommended_next_step:
              'Mantener evidencia actualizada y programar seguimiento periódico.',
            standard_code: audit.iso,
          },
        ],
    human_approval_required: true,
    recommended_use:
      'Usar este análisis como apoyo del auditor humano. No crea hallazgos ni planes automáticamente.',
    human_approval_note:
      'IA Auditor no reemplaza al auditor humano; sus sugerencias requieren aprobación antes de convertirse en hallazgos, acciones o solicitudes formales.',
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
      ...errorDetail(error),
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
      ...errorDetail(error),
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
      ...errorDetail(error),
    });
  }
});

module.exports = router;
