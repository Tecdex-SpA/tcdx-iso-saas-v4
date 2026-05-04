const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { errorDetail } = require('../utils/errorResponse');
const { resolveLocale } = require('../utils/locale');

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


async function safeRows(name, query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows || [];
  } catch (error) {
    console.warn(`AI AUDITOR SAFE QUERY WARN [${name}]:`, error.message);
    return [];
  }
}

async function safeCount(name, query, params = []) {
  try {
    const result = await pool.query(query, params);
    return Number(result.rows[0]?.total || 0);
  } catch (error) {
    console.warn(`AI AUDITOR SAFE COUNT WARN [${name}]:`, error.message);
    return 0;
  }
}

function resolveAiAuditorTenantId(req) {
  const tokenTenantId = getUserTenantId(req.user);
  const requestedTenantId = req.body?.tenant_id || req.query?.tenant_id || tokenTenantId;

  if (isPlatform(req.user)) {
    return requestedTenantId || tokenTenantId;
  }

  return tokenTenantId;
}

function normalizeAiAuditorLocale(req) {
  return resolveLocale(req);
}

function translateAiAuditor(locale) {
  const en = locale === 'en';

  return {
    executiveSummary: en
      ? 'Senior AI Auditor reviewed available tenant compliance data and produced a non-destructive audit-oriented assessment.'
      : 'IA Auditor Senior revisó los datos disponibles del tenant y generó una evaluación orientada a auditoría sin modificar registros.',
    auditorOpinionHigh: en
      ? 'The compliance posture is acceptable based on the available evidence, but human auditor review is still required.'
      : 'La postura de cumplimiento es aceptable según la evidencia disponible, pero requiere revisión del auditor humano.',
    auditorOpinionMedium: en
      ? 'The compliance posture requires management attention before considering audit readiness.'
      : 'La postura de cumplimiento requiere atención de gestión antes de considerarse lista para auditoría.',
    auditorOpinionLow: en
      ? 'The compliance posture shows relevant gaps that should be remediated before audit closure.'
      : 'La postura de cumplimiento presenta brechas relevantes que deberían corregirse antes del cierre de auditoría.',
    noCriticalGaps: en
      ? 'No critical structural gaps were detected with the available data.'
      : 'No se detectaron brechas estructurales críticas con los datos disponibles.',
    humanReview: en
      ? 'This assessment is advisory. AI does not approve, close, or create critical records without human validation.'
      : 'Esta evaluación es consultiva. La IA no aprueba, cierra ni crea registros críticos sin validación humana.',
    evidenceGap: en ? 'Evidence coverage gap' : 'Brecha de cobertura de evidencias',
    openFindings: en ? 'Open findings require review' : 'Hallazgos abiertos requieren revisión',
    overdueActions: en ? 'Overdue action plans require treatment' : 'Planes de acción vencidos requieren tratamiento',
    deterioratedHealth: en ? 'Deteriorated controls require prioritization' : 'Controles deteriorados requieren priorización',
    assignOwners: en ? 'Assign owners and due dates to critical actions.' : 'Asignar responsables y vencimientos a acciones críticas.',
    reviewEvidence: en ? 'Review evidence sufficiency and traceability.' : 'Revisar suficiencia y trazabilidad de evidencias.',
    prioritizeRisks: en ? 'Prioritize high exposure risks and related controls.' : 'Priorizar riesgos de alta exposición y controles relacionados.',
    prepareFindings: en ? 'Prepare findings only after human auditor validation.' : 'Preparar hallazgos solo después de validación del auditor humano.',
  };
}

async function buildGlobalAiAuditorScope(tenantId, standardCode = null) {
  const standards = await safeRows(
    'active_standards',
    `
    SELECT standard_code
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_active, true) = true
    ORDER BY standard_code
    `,
    [tenantId]
  );

  const controlsTotal = await safeCount(
    'controls_total',
    `
    SELECT COUNT(*)::int AS total
    FROM tenant_controls
    WHERE tenant_id = $1::uuid
      AND ($2::text IS NULL OR standard_code = $2::text)
    `,
    [tenantId, standardCode]
  );

  const evidenceTotal = await safeCount(
    'evidence_total',
    `
    SELECT COUNT(*)::int AS total
    FROM evidences
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, '') <> 'deleted'
    `,
    [tenantId]
  );

  const findingsOpen = await safeRows(
    'findings_open',
    `
    SELECT id, title, severity, status, iso_code, tenant_control_id, created_at
    FROM findings
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, '') NOT IN ('cerrado','cerrada','closed','completado','completada','resolved')
      AND ($2::text IS NULL OR iso_code = $2::text)
    ORDER BY created_at DESC NULLS LAST
    LIMIT 20
    `,
    [tenantId, standardCode]
  );

  const actionPlansOpen = await safeRows(
    'action_plans_open',
    `
    SELECT id, title, priority, status, due_date, tenant_control_id, created_at
    FROM action_plans
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, '') NOT IN ('cerrado','cerrada','closed','completado','completada','resolved')
    ORDER BY due_date ASC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 20
    `,
    [tenantId]
  );

  const overdueActions = await safeRows(
    'action_plans_overdue',
    `
    SELECT id, title, priority, status, due_date, tenant_control_id
    FROM action_plans
    WHERE tenant_id = $1::uuid
      AND due_date IS NOT NULL
      AND due_date < CURRENT_DATE
      AND COALESCE(status, '') NOT IN ('cerrado','cerrada','closed','completado','completada','resolved')
    ORDER BY due_date ASC
    LIMIT 20
    `,
    [tenantId]
  );

  const healthByStandard = await safeRows(
    'health_by_standard',
    `
    SELECT
      standard_code,
      COUNT(*)::int AS controls,
      ROUND(AVG(COALESCE(health_score, 0))::numeric, 2)::float AS avg_health_score,
      SUM(CASE WHEN COALESCE(health_score, 0) < 50 THEN 1 ELSE 0 END)::int AS deteriorated,
      SUM(CASE WHEN COALESCE(health_score, 0) >= 50 AND COALESCE(health_score, 0) < 80 THEN 1 ELSE 0 END)::int AS attention,
      SUM(CASE WHEN COALESCE(health_score, 0) >= 80 THEN 1 ELSE 0 END)::int AS healthy
    FROM control_health_scores
    WHERE tenant_id = $1::uuid
      AND ($2::text IS NULL OR standard_code = $2::text)
    GROUP BY standard_code
    ORDER BY standard_code
    `,
    [tenantId, standardCode]
  );

  const auditsRecent = await safeRows(
    'audits_recent',
    `
    SELECT id, iso, status, auditor_name, start_date, end_date, created_at
    FROM audits
    WHERE tenant_id = $1::uuid
      AND ($2::text IS NULL OR iso = $2::text)
    ORDER BY created_at DESC NULLS LAST
    LIMIT 10
    `,
    [tenantId, standardCode]
  );

  const assetsTotal = await safeCount(
    'assets_total',
    `
    SELECT COUNT(*)::int AS total
    FROM assets
    WHERE tenant_id = $1::uuid
    `,
    [tenantId]
  );

  const lifecycleRecent = await safeRows(
    'lifecycle_recent',
    `
    SELECT id, standard_code, from_stage, to_stage, status, created_at
    FROM lifecycle_transitions
    WHERE tenant_id = $1::uuid
    ORDER BY created_at DESC NULLS LAST
    LIMIT 10
    `,
    [tenantId]
  );

  const healthAverage =
    healthByStandard.length > 0
      ? Math.round(
          healthByStandard.reduce(
            (acc, item) => acc + Number(item.avg_health_score || 0),
            0
          ) / healthByStandard.length
        )
      : 0;

  return {
    tenant_id: tenantId,
    standard_code: standardCode,
    standards: standards.map((row) => row.standard_code).filter(Boolean),
    counts: {
      controls_total: controlsTotal,
      evidence_total: evidenceTotal,
      findings_open: findingsOpen.length,
      action_plans_open: actionPlansOpen.length,
      action_plans_overdue: overdueActions.length,
      assets_total: assetsTotal,
      audits_recent: auditsRecent.length,
      lifecycle_recent: lifecycleRecent.length,
      health_average: healthAverage,
    },
    health_by_standard: healthByStandard,
    findings_open: findingsOpen,
    action_plans_open: actionPlansOpen,
    action_plans_overdue: overdueActions,
    audits_recent: auditsRecent,
    lifecycle_recent: lifecycleRecent,
  };
}

function buildGlobalSeniorAuditAnalysis(scope, locale, options = {}) {
  const t = translateAiAuditor(locale);
  const counts = scope.counts || {};
  const healthAverage = Number(counts.health_average || 0);
  const deterioratedControls = (scope.health_by_standard || []).reduce(
    (acc, item) => acc + Number(item.deteriorated || 0),
    0
  );

  let score = 100;
  score -= Number(counts.findings_open || 0) * 4;
  score -= Number(counts.action_plans_overdue || 0) * 6;
  score -= deterioratedControls * 3;

  if (healthAverage > 0 && healthAverage < 80) {
    score -= Math.round((80 - healthAverage) / 2);
  }

  if (Number(counts.controls_total || 0) > 0 && Number(counts.evidence_total || 0) === 0) {
    score -= 20;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let readinessLevel = 'high';
  let auditorOpinion = t.auditorOpinionHigh;

  if (score < 50) {
    readinessLevel = 'critical';
    auditorOpinion = t.auditorOpinionLow;
  } else if (score < 65) {
    readinessLevel = 'low';
    auditorOpinion = t.auditorOpinionLow;
  } else if (score < 80) {
    readinessLevel = 'medium';
    auditorOpinion = t.auditorOpinionMedium;
  }

  const mainGaps = [];

  if (Number(counts.evidence_total || 0) === 0 && Number(counts.controls_total || 0) > 0) {
    mainGaps.push({
      type: 'evidence',
      severity: 'high',
      title: t.evidenceGap,
      detail: locale === 'en'
        ? 'Controls exist but no usable evidence was found in the current scope.'
        : 'Existen controles, pero no se encontró evidencia utilizable en el alcance actual.',
    });
  }

  if (Number(counts.findings_open || 0) > 0) {
    mainGaps.push({
      type: 'finding',
      severity: 'medium',
      title: t.openFindings,
      detail: locale === 'en'
        ? `${counts.findings_open} open findings should be reviewed before audit closure.`
        : `${counts.findings_open} hallazgos abiertos deberían revisarse antes del cierre de auditoría.`,
    });
  }

  if (Number(counts.action_plans_overdue || 0) > 0) {
    mainGaps.push({
      type: 'action_plan',
      severity: 'high',
      title: t.overdueActions,
      detail: locale === 'en'
        ? `${counts.action_plans_overdue} overdue action plans require treatment.`
        : `${counts.action_plans_overdue} planes vencidos requieren tratamiento.`,
    });
  }

  if (deterioratedControls > 0) {
    mainGaps.push({
      type: 'health',
      severity: 'high',
      title: t.deterioratedHealth,
      detail: locale === 'en'
        ? `${deterioratedControls} controls are deteriorated according to the health engine.`
        : `${deterioratedControls} controles están deteriorados según el motor Health.`,
    });
  }

  if (!mainGaps.length) {
    mainGaps.push({
      type: 'positive',
      severity: 'low',
      title: t.noCriticalGaps,
      detail: t.noCriticalGaps,
    });
  }

  const evidenceRequests = (scope.health_by_standard || [])
    .filter((item) => Number(item.deteriorated || 0) > 0 || Number(item.attention || 0) > 0)
    .slice(0, 6)
    .map((item) => ({
      standard_code: item.standard_code,
      priority: Number(item.deteriorated || 0) > 0 ? 'high' : 'medium',
      title: locale === 'en'
        ? `Request updated evidence for ${item.standard_code}`
        : `Solicitar evidencia actualizada para ${item.standard_code}`,
      reason: locale === 'en'
        ? 'Health engine shows controls requiring attention or remediation.'
        : 'El motor Health muestra controles que requieren atención o remediación.',
    }));

  const actionPlanSuggestions = (scope.action_plans_overdue || []).slice(0, 8).map((item) => ({
    source_id: item.id,
    priority: item.priority || 'high',
    title: item.title,
    recommended_action: locale === 'en'
      ? 'Review overdue status, assign accountable owner, and define a revised due date.'
      : 'Revisar estado vencido, asignar responsable y definir nueva fecha comprometida.',
    deep_link: `/plan-accion?id=${item.id}`,
  }));

  const findingsSuggestions = (scope.findings_open || []).slice(0, 8).map((item) => ({
    source_id: item.id,
    severity: item.severity || 'medium',
    title: item.title,
    recommended_action: locale === 'en'
      ? 'Review finding classification, evidence, root cause, and closure criteria.'
      : 'Revisar clasificación, evidencia, causa raíz y criterio de cierre del hallazgo.',
    deep_link: `/hallazgos?id=${item.id}`,
  }));

  const nextSteps = [
    t.reviewEvidence,
    t.prioritizeRisks,
    t.assignOwners,
    t.prepareFindings,
  ];

  return {
    ok: true,
    locale,
    tenant_id: scope.tenant_id,
    summary: {
      score,
      readiness_level: readinessLevel,
      executive_summary: t.executiveSummary,
      auditor_opinion: auditorOpinion,
      main_risks: mainGaps.filter((item) => ['high', 'critical'].includes(item.severity)),
      main_gaps: mainGaps,
      recommended_focus: nextSteps,
    },
    coverage: {
      standards: scope.standards || [],
      controls_reviewed: Number(counts.controls_total || 0),
      evidences_reviewed: Number(counts.evidence_total || 0),
      findings_reviewed: Number(counts.findings_open || 0),
      risks_reviewed: 0,
      actions_reviewed: Number(counts.action_plans_open || 0),
      audits_reviewed: Number(counts.audits_recent || 0),
      lifecycle_events_reviewed: Number(counts.lifecycle_recent || 0),
    },
    findings_suggestions: findingsSuggestions,
    nonconformity_suggestions: findingsSuggestions
      .filter((item) => String(item.severity || '').toLowerCase().includes('crit'))
      .map((item) => ({ ...item, recommended_record: 'nonconformity' })),
    evidence_requests: evidenceRequests,
    action_plan_suggestions: actionPlanSuggestions,
    control_recommendations: mainGaps,
    risk_recommendations: mainGaps.filter((item) => item.type === 'health'),
    next_steps: nextSteps,
    human_review_required: true,
    can_create_records: false,
    trace: {
      source: 'backend_ai_auditor_senior_safe_v1',
      generated_at: new Date().toISOString(),
      audit_focus: options.audit_focus || 'general',
      depth: options.depth || 'executive',
      include_internet: false,
      db_write: false,
    },
    scope,
    disclaimer: t.humanReview,
  };
}

router.get('/scope', auth, async (req, res) => {
  try {
    const locale = normalizeAiAuditorLocale(req);
    res.set('x-tcdx-locale', locale);

    if (!canRead(req.user)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado' });
    }

    const tenantId = resolveAiAuditorTenantId(req);
    const standardCode = req.query?.standard_code ? String(req.query.standard_code) : null;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error_code: 'TENANT_REQUIRED',
        code: 'TENANT_REQUIRED',
        message: 'tenant_id requerido',
        error: 'tenant_id requerido',
        locale,
      });
    }

    if (!ensureTenantAccess(req, tenantId)) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para este tenant',
        locale,
      });
    }

    const scope = await buildGlobalAiAuditorScope(tenantId, standardCode);

    return res.json({
      ok: true,
      locale,
      tenant_id: tenantId,
      scope,
    });
  } catch (error) {
    console.error('ERROR AI AUDITOR GLOBAL SCOPE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo scope IA Auditor',
      ...errorDetail(error),
    });
  }
});

router.post('/analyze', auth, async (req, res) => {
  try {
    const locale = normalizeAiAuditorLocale(req);
    res.set('x-tcdx-locale', locale);

    if (!canAnalyze(req.user)) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para ejecutar IA Auditor',
        locale,
      });
    }

    const tenantId = resolveAiAuditorTenantId(req);
    const standardCode = req.body?.standard_code ? String(req.body.standard_code) : null;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error_code: 'TENANT_REQUIRED',
        code: 'TENANT_REQUIRED',
        message: 'tenant_id requerido',
        error: 'tenant_id requerido',
        locale,
      });
    }

    if (!ensureTenantAccess(req, tenantId)) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para este tenant',
        locale,
      });
    }

    const scope = await buildGlobalAiAuditorScope(tenantId, standardCode);
    const analysis = buildGlobalSeniorAuditAnalysis(scope, locale, {
      audit_focus: req.body?.audit_focus,
      depth: req.body?.depth,
    });

    return res.json(analysis);
  } catch (error) {
    console.error('ERROR AI AUDITOR GLOBAL ANALYZE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error ejecutando IA Auditor global',
      ...errorDetail(error),
    });
  }
});

router.post('/suggestions/:type/prepare', auth, async (req, res) => {
  try {
    const locale = normalizeAiAuditorLocale(req);
    res.set('x-tcdx-locale', locale);

    if (!canAnalyze(req.user)) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para preparar sugerencias',
        locale,
      });
    }

    const type = String(req.params.type || '').toLowerCase();
    const suggestion = req.body?.suggestion || {};
    const allowed = ['finding', 'nonconformity', 'evidence', 'action_plan'];

    if (!allowed.includes(type)) {
      return res.status(400).json({
        ok: false,
        error_code: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Tipo de sugerencia no soportado',
        error: 'Tipo de sugerencia no soportado',
        locale,
      });
    }

    const links = {
      finding: '/hallazgos',
      nonconformity: '/no-conformidades',
      evidence: '/evidencias',
      action_plan: '/plan-accion',
    };

    return res.json({
      ok: true,
      locale,
      type,
      can_create_records: false,
      human_review_required: true,
      deep_link: links[type],
      prepared_payload: {
        title: suggestion.title || '',
        description:
          suggestion.detail ||
          suggestion.reason ||
          suggestion.recommended_action ||
          '',
        priority: suggestion.priority || suggestion.severity || 'medium',
        source: 'ai_auditor_senior',
      },
    });
  } catch (error) {
    console.error('ERROR AI AUDITOR PREPARE SUGGESTION:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error preparando sugerencia IA Auditor',
      ...errorDetail(error),
    });
  }
});

router.get('/context/:audit_id', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
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
      locale,
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
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
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
          locale,
        }),
      ]
    );

    return res.json({
      ok: true,
      locale,
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
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
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
      locale,
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
