const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { errorDetail } = require('../utils/errorResponse');
const { resolveLocale } = require('../utils/locale');
const { renderHtmlToPdf } = require('../reports/services/htmlPdfRenderer.service');
const { renderIaAuditorHistoricTemplate } = require('../reports/templates/iaAuditorHistoric.template');
const aiContextBuilder = require('../services/aiContextBuilder.service');
const aiEngineClient = require('../services/aiEngineClient.service');
const asyncJobs = require('../services/asyncJob.service');

const aiAuditorRuntimeJobs = new Map();
const AI_AUDITOR_JOB_TTL_MS = Number(process.env.AI_AUDITOR_JOB_TTL_MS || 1000 * 60 * 60 * 6);

function buildAiAuditorJobId() {
  return `iaaud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneAiAuditorJobs() {
  const now = Date.now();
  for (const [jobId, job] of aiAuditorRuntimeJobs.entries()) {
    if (now - Number(job.created_at_ms || 0) > AI_AUDITOR_JOB_TTL_MS) {
      aiAuditorRuntimeJobs.delete(jobId);
    }
  }
}

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
    if (String(error?.code || '') === '42P01') {
      console.info('AI AUDITOR SOURCE SKIPPED:', {
        source: name,
        reason: 'table_not_found',
        message: String(error.message || '').slice(0, 160),
      });
      return [];
    }
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
  const warnings = [];

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

  const healthByStandard = await safeRows(
    'health_by_standard',
    `
    SELECT
      iso AS standard_code,
      SUM(COALESCE(active_scope_controls, 0))::int AS controls,
      ROUND(
        (
          SUM(COALESCE(avg_effective_health_score, 0) * GREATEST(COALESCE(active_scope_controls, 0), 1)) /
          NULLIF(SUM(GREATEST(COALESCE(active_scope_controls, 0), 1)), 0)
        )::numeric,
        2
      )::float AS avg_health_score,
      SUM(COALESCE(deteriorated_controls, 0))::int AS deteriorated,
      SUM(COALESCE(attention_controls, 0))::int AS attention,
      SUM(COALESCE(healthy_controls, 0))::int AS healthy,
      SUM(COALESCE(controls_without_evidence, 0))::int AS controls_without_evidence,
      SUM(COALESCE(overdue_action_plans_count, 0))::int AS overdue_action_plans_count,
      AVG(COALESCE(compliance_percentage, 0))::float AS compliance_percentage,
      AVG(COALESCE(official_evidence_percentage, 0))::float AS official_evidence_percentage
    FROM public.v_iso_effective_kpi_summary
    WHERE tenant_id = $1::uuid
      AND COALESCE(active_scope_controls, 0) > 0
      AND ($2::text IS NULL OR iso = $2::text)
    GROUP BY iso
    ORDER BY iso
    `,
    [tenantId, standardCode]
  );

  const effectiveControlContext = await safeRows(
    'effective_control_context',
    `
    SELECT
      tenant_control_id,
      iso,
      clause,
      operation_name,
      control_description,
      effective_health_score,
      effective_health_status,
      compliance_bucket,
      evidence_quality_status,
      official_evidence_count,
      open_findings_count,
      open_nonconformities_count,
      open_action_plans_count,
      overdue_action_plans_count
    FROM public.v_iso_control_effective_health
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_in_active_operational_scope, false) = true
      AND ($2::text IS NULL OR iso = $2::text)
    ORDER BY
      CASE
        WHEN effective_health_status = 'critico' THEN 1
        WHEN effective_health_status = 'deteriorado' THEN 2
        WHEN effective_health_status = 'atencion' THEN 3
        WHEN effective_health_status = 'saludable' THEN 4
        ELSE 5
      END ASC,
      COALESCE(overdue_action_plans_count, 0) DESC,
      COALESCE(official_evidence_count, 0) ASC,
      COALESCE(effective_health_score, 0) ASC
    LIMIT 40
    `,
    [tenantId, standardCode]
  );

  let controlsSource = 'public.v_iso_effective_kpi_summary';
  let controlsByStandard = (healthByStandard || [])
    .filter((row) => row?.standard_code)
    .map((row) => ({
      standard_code: row.standard_code,
      controls: Number(row.controls || 0),
      source: 'public.v_iso_effective_kpi_summary',
    }))
    .filter((row) => row.controls > 0);

  let controlsTotal = controlsByStandard.reduce(
    (acc, item) => acc + Number(item.controls || 0),
    0
  );

  if (controlsTotal <= 0) {
    const hasTenantControlsStandardCode = await tableHasColumn('tenant_controls', 'standard_code');
    const hasTenantControlsIsoCode = await tableHasColumn('tenant_controls', 'iso_code');
    const hasTenantControlsIso = await tableHasColumn('tenant_controls', 'iso');

    if (hasTenantControlsStandardCode || hasTenantControlsIsoCode || hasTenantControlsIso) {
      const standardExpression = hasTenantControlsStandardCode
        ? 'standard_code'
        : hasTenantControlsIsoCode
          ? 'iso_code'
          : 'iso';

      controlsByStandard = await safeRows(
        'controls_by_standard_tenant_controls',
        `
        SELECT
          ${standardExpression} AS standard_code,
          COUNT(*)::int AS controls
        FROM tenant_controls
        WHERE tenant_id = $1::uuid
          AND ($2::text IS NULL OR ${standardExpression} = $2::text)
        GROUP BY ${standardExpression}
        ORDER BY ${standardExpression}
        `,
        [tenantId, standardCode]
      );

      controlsByStandard = controlsByStandard
        .filter((row) => row?.standard_code)
        .map((row) => ({
          standard_code: row.standard_code,
          controls: Number(row.controls || 0),
          source: 'tenant_controls',
        }))
        .filter((row) => row.controls > 0);

      controlsTotal = controlsByStandard.reduce(
        (acc, item) => acc + Number(item.controls || 0),
        0
      );
      controlsSource = 'tenant_controls';
    } else {
      warnings.push('tenant_controls has no standard_code/iso_code/iso column usable for scope counts');
    }
  }

  if (controlsTotal <= 0) {
    warnings.push('controls_total could not be resolved from public.v_iso_effective_kpi_summary or tenant_controls');
    controlsSource = 'unresolved';
  }

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

  const resolvedStandards = standards.map((row) => row.standard_code).filter(Boolean);
  const standardsFromControls = controlsByStandard.map((row) => row.standard_code).filter(Boolean);
  const mergedStandards = Array.from(new Set([...resolvedStandards, ...standardsFromControls]));

  return {
    tenant_id: tenantId,
    standard_code: standardCode,
    standards: mergedStandards,
    controls_by_standard: controlsByStandard,
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
    sources: {
      controls_source: controlsSource,
      warnings,
    },
    health_by_standard: healthByStandard,
    effective_control_context: effectiveControlContext,
    findings_open: findingsOpen,
    action_plans_open: actionPlansOpen,
    action_plans_overdue: overdueActions,
    audits_recent: auditsRecent,
    lifecycle_recent: lifecycleRecent,
  };
}

function buildGlobalSeniorAuditAnalysis(scope, locale, options = {}) {
  const t = translateAiAuditor(locale);
  const counts = { ...(scope.counts || {}) };
  const controlsFromStandards = Array.isArray(scope.controls_by_standard)
    ? scope.controls_by_standard.reduce((acc, item) => acc + Number(item.controls || 0), 0)
    : 0;
  const controlsFromHealth = Array.isArray(scope.health_by_standard)
    ? scope.health_by_standard.reduce((acc, item) => acc + Number(item.controls || 0), 0)
    : 0;

  if (!Number(counts.controls_total || 0)) {
    counts.controls_total = controlsFromStandards || controlsFromHealth || 0;
  }
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


function getAiAuditorEngineBaseUrl() {
  return String(
    process.env.AI_ENGINE_URL ||
    process.env.AI_ENGINE_BASE_URL ||
    'http://localhost:8001'
  ).replace(/\/+$/, '');
}

function getAiAuditorEngineToken() {
  return process.env.AI_INTERNAL_TOKEN || process.env.AI_ENGINE_TOKEN || process.env.AI_TOKEN || '';
}

function compactAiAuditorScope(scope) {
  const safe = scope && typeof scope === 'object' ? scope : {};

  return {
    tenant_id: safe.tenant_id,
    standard_code: safe.standard_code,
    standards: Array.isArray(safe.standards) ? safe.standards.slice(0, 12) : [],
    counts: safe.counts || {},
    controls_by_standard: Array.isArray(safe.controls_by_standard)
      ? safe.controls_by_standard.slice(0, 20)
      : [],
    sources: safe.sources || {},
    health_by_standard: Array.isArray(safe.health_by_standard)
      ? safe.health_by_standard.slice(0, 20)
      : [],
    effective_control_context: Array.isArray(safe.effective_control_context)
      ? safe.effective_control_context.slice(0, 20)
      : [],
    findings_open: Array.isArray(safe.findings_open)
      ? safe.findings_open.slice(0, 20)
      : [],
    action_plans_open: Array.isArray(safe.action_plans_open)
      ? safe.action_plans_open.slice(0, 20)
      : [],
    action_plans_overdue: Array.isArray(safe.action_plans_overdue)
      ? safe.action_plans_overdue.slice(0, 20)
      : [],
    audits_recent: Array.isArray(safe.audits_recent)
      ? safe.audits_recent.slice(0, 10)
      : [],
    lifecycle_recent: Array.isArray(safe.lifecycle_recent)
      ? safe.lifecycle_recent.slice(0, 10)
      : [],
  };
}

function buildAiAuditorEnginePayload({ tenantId, standardCode, locale, scope, fallback, body }) {
  return {
    locale,
    language: locale,
    response_language: locale,
    tenant_context: {
      tenant_id: tenantId,
    },
    standard_code: standardCode || null,
    audit_focus: body?.audit_focus || 'general',
    depth: body?.depth || 'executive',
    scope: compactAiAuditorScope(scope),
    fallback_summary: fallback?.summary || {},
    safety_rules: {
      human_review_required: true,
      can_create_records: false,
      no_auto_approval: true,
      no_auto_close: true,
      no_db_write: true,
      do_not_translate_customer_data: true,
    },
  };
}

function compactAiEngineErrorMessage(error) {
  if (error?.name === 'AbortError') return 'ai-engine timeout';
  return String(error?.message || error || 'ai-engine unavailable').slice(0, 260);
}

function nowMs() {
  return Date.now();
}

function elapsedMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

function getAiAuditorRequestId(req) {
  return String(req.requestId || req.body?.request_id || req.headers?.['x-request-id'] || '').trim();
}

function normalizeAiAuditorDepth(body = {}) {
  return ['executive', 'standard', 'deep'].includes(body?.depth) ? body.depth : 'executive';
}

function normalizeAiAuditorModelMode(body = {}) {
  const value = String(body?.model_mode || body?.modelMode || process.env.AI_AUDITOR_MODEL_MODE || 'fast')
    .trim()
    .toLowerCase();
  if (['fast', 'balanced', 'deep'].includes(value)) return value;
  return 'fast';
}

function wantsAiAuditorLlm(body = {}, modelMode = 'fast') {
  if (body?.use_llm === true || body?.use_llm_in_fast_mode === true) return true;
  return modelMode !== 'fast' && body?.use_llm !== false;
}

function getAiAuditorEstimatedModeCost(modelMode = 'fast') {
  if (modelMode === 'deep') return 'high';
  if (modelMode === 'balanced') return 'moderate';
  return 'fast';
}

function requiresAiAuditorAsync(body = {}) {
  const modelMode = normalizeAiAuditorModelMode(body);
  if (body?.async === true || body?.async_mode === true) return true;
  if (modelMode === 'balanced' && wantsAiAuditorLlm(body, modelMode)) return true;
  if (modelMode === 'deep' && process.env.AI_AUDITOR_DEEP_ASYNC_REQUIRED !== 'false') return true;
  return false;
}

async function callAiAuditorEngine(payload, locale, requestId = null) {
  const baseUrl = getAiAuditorEngineBaseUrl();
  const token = getAiAuditorEngineToken();

  if (!baseUrl) {
    throw new Error('AI_ENGINE_URL no configurado');
  }

  if (!token) {
    throw new Error('AI_INTERNAL_TOKEN no configurado');
  }

  const controller = new AbortController();
  const modelMode = String(payload?.model_mode || payload?.options?.model_mode || '').toLowerCase();
  const requestedTimeoutMs = Number.parseInt(
    String(
      modelMode === 'deep'
        ? (process.env.REPORT_DEEP_JOB_TIMEOUT_MS || process.env.AI_AUDITOR_DEEP_TIMEOUT_MS || process.env.AI_ENGINE_REQUEST_TIMEOUT_MS || '600000')
        : (process.env.AI_AUDITOR_ENGINE_TIMEOUT_MS || process.env.AI_ENGINE_REQUEST_TIMEOUT_MS || '25000')
    ),
    10
  ) || 25000;
  const timeoutMs = modelMode === 'deep' ? Math.max(requestedTimeoutMs, 600000) : requestedTimeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/ai/auditor/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-token': token,
        'X-AI-Token': token,
        'x-tcdx-locale': locale,
        ...(requestId ? { 'x-request-id': requestId } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : {};
    } catch (parseError) {
      throw new Error(`ai-engine JSON inválido o respuesta intermedia no JSON: ${String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)}`);
    }

    if (!response.ok) {
      const detail = json?.detail || json?.error || response.statusText;
      throw new Error(`ai-engine HTTP ${response.status}: ${detail}`);
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function clampAiAuditorScore(value, fallbackValue = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number(fallbackValue || 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeAiAuditorReadiness(value, fallbackValue = 'medium') {
  const normalized = String(value || '').trim().toLowerCase();

  if (['critical', 'critico', 'crítico'].includes(normalized)) return 'critical';
  if (['low', 'bajo', 'baja'].includes(normalized)) return 'low';
  if (['medium', 'medio', 'media'].includes(normalized)) return 'medium';
  if (['high', 'alto', 'alta'].includes(normalized)) return 'high';

  return fallbackValue || 'medium';
}

function safeAiAuditorArray(value, fallbackValue = []) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(fallbackValue)) return fallbackValue;
  return [];
}

function sanitizeAiAuditorEngineResponse(engineJson, fallback, locale, scope) {
  const source =
    engineJson?.answer && typeof engineJson.answer === 'object'
      ? engineJson.answer
      : engineJson && typeof engineJson === 'object'
        ? engineJson
        : {};

  const sourceSummary =
    source.summary && typeof source.summary === 'object'
      ? source.summary
      : {};

  const fallbackSummary = fallback?.summary || {};

  const score = clampAiAuditorScore(
    sourceSummary.score ?? source.readiness_score ?? fallbackSummary.score,
    fallbackSummary.score
  );

  const readinessLevel = normalizeAiAuditorReadiness(
    sourceSummary.readiness_level ?? source.readiness_level,
    fallbackSummary.readiness_level || 'medium'
  );

  const executiveSummary =
    sourceSummary.executive_summary ||
    source.executive_summary ||
    fallbackSummary.executive_summary;

  const auditorOpinion =
    sourceSummary.auditor_opinion ||
    source.auditor_opinion ||
    source.human_approval_note ||
    fallbackSummary.auditor_opinion;

  const mainGaps = safeAiAuditorArray(
    sourceSummary.main_gaps,
    safeAiAuditorArray(source.evidence_gaps, fallbackSummary.main_gaps)
  );

  const mainRisks = safeAiAuditorArray(
    sourceSummary.main_risks,
    safeAiAuditorArray(source.critical_controls, fallbackSummary.main_risks)
  );

  const recommendedFocus = safeAiAuditorArray(
    sourceSummary.recommended_focus,
    safeAiAuditorArray(source.suggested_next_steps, fallbackSummary.recommended_focus)
  );

  const coverage = {
    ...(fallback?.coverage || {}),
    ...(source.coverage && typeof source.coverage === 'object' ? source.coverage : {}),
  };

  const trace = {
    ...(fallback?.trace || {}),
    ...(source.trace && typeof source.trace === 'object' ? source.trace : {}),
    source: 'ai_engine_senior_auditor',
    endpoint: '/api/ai/auditor/analyze',
    ai_engine_used: true,
    generated_at: new Date().toISOString(),
    db_write: false,
  };

  return {
    ...fallback,
    ok: true,
    locale,
    tenant_id: fallback?.tenant_id || scope?.tenant_id,
    summary: {
      ...fallbackSummary,
      score,
      readiness_level: readinessLevel,
      executive_summary: executiveSummary,
      auditor_opinion: auditorOpinion,
      main_risks: mainRisks,
      main_gaps: mainGaps,
      recommended_focus: recommendedFocus,
    },
    coverage,
    findings_suggestions: safeAiAuditorArray(
      source.findings_suggestions,
      safeAiAuditorArray(source.recommended_findings, fallback?.findings_suggestions)
    ),
    nonconformity_suggestions: safeAiAuditorArray(
      source.nonconformity_suggestions,
      fallback?.nonconformity_suggestions
    ),
    evidence_requests: safeAiAuditorArray(
      source.evidence_requests,
      safeAiAuditorArray(source.recommended_evidence_requests, fallback?.evidence_requests)
    ),
    action_plan_suggestions: safeAiAuditorArray(
      source.action_plan_suggestions,
      safeAiAuditorArray(source.recommended_actions, fallback?.action_plan_suggestions)
    ),
    control_recommendations: safeAiAuditorArray(
      source.control_recommendations,
      fallback?.control_recommendations
    ),
    risk_recommendations: safeAiAuditorArray(
      source.risk_recommendations,
      fallback?.risk_recommendations
    ),
    next_steps: safeAiAuditorArray(
      source.next_steps,
      safeAiAuditorArray(source.suggested_next_steps, fallback?.next_steps)
    ),
    human_review_required: true,
    can_create_records: false,
    scope: fallback?.scope || scope,
    disclaimer:
      source.disclaimer ||
      source.recommended_use ||
      fallback?.disclaimer,
    trace,
  };
}

function markAiAuditorFallback(fallback, error) {
  const message = compactAiEngineErrorMessage(error);

  return {
    ...fallback,
    human_review_required: true,
    can_create_records: false,
    trace: {
      ...(fallback?.trace || {}),
      ai_engine_used: false,
      ai_engine_error: message,
      generated_at: new Date().toISOString(),
      db_write: false,
    },
  };
}

function normalizeSeniorAuditorTask(body = {}) {
  if (body.tenant_control_id) return 'control_analysis';
  if (body.evidence_id) return 'evidence_review';
  if (body.action_plan_id) return 'action_plan_review';
  if (body.question) return 'free_question';
  return 'audit_analysis';
}

async function buildSeniorAuditorContext({ tenantId, body }) {
  const standardCode = body?.standard_code ? String(body.standard_code) : null;
  const operationId = body?.operation_id ? String(body.operation_id) : null;

  if (body?.tenant_control_id) {
    return aiContextBuilder.buildAiControlContext({
      tenantId,
      tenantControlId: String(body.tenant_control_id),
      standardCode,
      operationId,
    });
  }

  if (body?.evidence_id) {
    return aiContextBuilder.buildAiEvidenceContext({
      tenantId,
      evidenceId: String(body.evidence_id),
    });
  }

  if (body?.audit_id) {
    return aiContextBuilder.buildAiAuditContext({
      tenantId,
      auditId: String(body.audit_id),
    });
  }

  if (standardCode || operationId) {
    return aiContextBuilder.buildAiStandardContext({
      tenantId,
      standardCode,
      operationId,
    });
  }

  return aiContextBuilder.buildAiTenantContext({ tenantId });
}

function buildSeniorAuditorPayload({ tenantId, locale, context, body, requestId = null }) {
  const depth = normalizeAiAuditorDepth(body);
  const executiveMode = depth === 'executive';
  const modelMode = normalizeAiAuditorModelMode(body);
  const useLlm = wantsAiAuditorLlm(body, modelMode);
  const explicitDrive = body?.force_drive === true || body?.use_drive === true;
  const explicitWeb = body?.force_web === true || body?.use_web === true;
  const forceFast = modelMode === 'fast' && !useLlm;

  return {
    task_type: normalizeSeniorAuditorTask(body),
    tenant_id: tenantId,
    module_origin: 'ia-auditor',
    question: safeText(body?.question || body?.prompt || ''),
    locale: 'es',
    context,
    options: {
      local_compact: body?.local_compact !== false,
      use_rag: body?.use_rag !== false,
      use_drive: executiveMode ? body?.force_drive === true : (body?.use_drive === undefined ? 'auto' : body.use_drive !== false),
      use_web: executiveMode ? body?.force_web === true : explicitWeb,
      force_web: body?.force_web === true,
      fast_mode: body?.fast_mode === undefined ? forceFast : body.fast_mode === true,
      use_llm_in_fast_mode: useLlm,
      use_llm: useLlm,
      model_mode: modelMode,
      async_mode: body?.async_mode === true || body?.async === true,
      estimated_mode_cost: getAiAuditorEstimatedModeCost(modelMode),
      depth,
      max_controls: executiveMode ? 8 : undefined,
      max_evidences: executiveMode ? 6 : undefined,
      max_findings: executiveMode ? 5 : undefined,
      max_actions: executiveMode ? 5 : undefined,
      return_structured_result: true,
    },
    request_metadata: {
      requested_locale: locale || 'es',
      audit_focus: body?.audit_focus || 'general',
      request_id: requestId || body?.request_id || null,
      executive_compact: executiveMode,
      requested_drive: explicitDrive,
      requested_web: explicitWeb,
      model_mode: modelMode,
      use_llm: useLlm,
    },
  };
}

function readinessToLegacyLevel(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'listo') return 'high';
  if (value === 'parcial') return 'medium';
  if (value === 'no_listo') return 'critical';
  return 'low';
}

function adaptSeniorAuditorV2Response(engineJson, fallback, locale, scope, context) {
  const structured = engineJson?.structured_result && typeof engineJson.structured_result === 'object'
    ? engineJson.structured_result
    : {};
  const engine = engineJson?.engine && typeof engineJson.engine === 'object' ? engineJson.engine : {};
  const metrics = engineJson?.metrics && typeof engineJson.metrics === 'object' ? engineJson.metrics : {};
  const confidence = Number(engineJson?.confidence ?? structured?.confidence ?? 0);
  const score = clampAiAuditorScore(confidence * 100, fallback?.summary?.score || 0);
  const readinessStatus = structured?.audit_readiness?.status || 'sin_datos';
  const recommendedActions = safeAiAuditorArray(structured?.recommended_actions);
  const engineDurationMs = engine.duration_ms || metrics.duration_ms || engineJson?.duration_ms || null;
  const selectedModel = engine.model || engine.selected_model || metrics.model || metrics.selected_model || null;
  const usedLlm = engine.used_llm === true || metrics.used_llm === true || engineJson?.used_llm === true;
  const usedRag = engine.used_rag === true || metrics.used_rag === true || engineJson?.used_rag === true;
  const usedWeb = engine.used_web === true || metrics.used_web === true || engineJson?.used_web === true;
  const usedDrive = engine.used_drive === true || metrics.used_drive === true || engineJson?.used_drive === true;

  return {
    ...fallback,
    ok: engineJson?.ok !== false,
    locale,
    tenant_id: fallback?.tenant_id || scope?.tenant_id,
    answer: engineJson?.answer || structured?.diagnosis || fallback?.summary?.auditor_opinion || '',
    structured_result: structured,
    source_trace: safeAiAuditorArray(engineJson?.source_trace, safeAiAuditorArray(structured?.source_trace)),
    confidence,
    limitations: safeAiAuditorArray(engineJson?.limitations, safeAiAuditorArray(structured?.limitations)),
    engine,
    summary: {
      ...(fallback?.summary || {}),
      score,
      readiness_level: readinessToLegacyLevel(readinessStatus),
      executive_summary: structured?.executive_summary || fallback?.summary?.executive_summary,
      auditor_opinion: structured?.diagnosis || engineJson?.answer || fallback?.summary?.auditor_opinion,
      main_risks: safeAiAuditorArray(structured?.gaps, fallback?.summary?.main_risks),
      main_gaps: safeAiAuditorArray(structured?.gaps, fallback?.summary?.main_gaps),
      recommended_focus: recommendedActions.map((item) => item.title || item.description).filter(Boolean),
    },
    coverage: {
      ...(fallback?.coverage || {}),
      controls_reviewed: Array.isArray(context?.priority_controls)
        ? context.priority_controls.length
        : fallback?.coverage?.controls_reviewed,
      evidences_reviewed: Array.isArray(context?.recent_evidences)
        ? context.recent_evidences.length
        : fallback?.coverage?.evidences_reviewed,
      findings_reviewed: Array.isArray(context?.recent_findings)
        ? context.recent_findings.length
        : fallback?.coverage?.findings_reviewed,
      actions_reviewed: Array.isArray(context?.recent_action_plans)
        ? context.recent_action_plans.length
        : fallback?.coverage?.actions_reviewed,
    },
    evidence_requests: safeAiAuditorArray(structured?.documents_to_request).map((item) => ({
      title: item,
      reason: 'Solicitud generada desde structured_result del Auditor ISO Senior.',
      priority: 'high',
    })),
    action_plan_suggestions: recommendedActions.map((item) => ({
      ...item,
      title: item.title,
      priority: item.priority,
      recommended_action: item.description,
      deep_link: item.target_module === 'evidencias' ? '/evidencias' : '/plan-accion',
    })),
    findings_suggestions: safeAiAuditorArray(structured?.gaps).map((item) => ({
      title: item.title,
      severity: item.severity,
      recommended_action: item.description,
      source_clause: item.clause,
    })),
    next_steps: recommendedActions.map((item) => item.description).filter(Boolean),
    human_review_required: true,
    can_create_records: false,
    scope: fallback?.scope || scope,
    context_v2: context,
    trace: {
      ...(fallback?.trace || {}),
      source: 'ai_engine_senior_auditor_v2',
      endpoint: '/api/ai/senior-auditor/analyze',
      ai_engine_used: engineJson?.ok !== false,
      used_llm: usedLlm,
      llm_provider: engine.llm_provider || metrics.llm_provider || 'ollama',
      model_name: selectedModel,
      selected_model: selectedModel,
      used_rag: usedRag,
      used_web: usedWeb,
      used_drive: usedDrive,
      duration_ms: engineDurationMs,
      db_write: false,
      generated_at: new Date().toISOString(),
      engine,
      metrics,
    },
  };
}



// =========================================================
// Fase 3K - Historial persistente IA Auditor Senior
// =========================================================
function normalizeAiAuditorHistoryLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(parsed, 50);
}

function normalizeAiAuditorHistoryOffset(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function compactHistoryError(error) {
  const code = error?.code ? ` (${error.code})` : '';
  return String(error?.message || 'history_save_failed').slice(0, 220) + code;
}

function buildAiAuditorSuggestionsSnapshot(result) {
  return {
    findings_suggestions: Array.isArray(result?.findings_suggestions) ? result.findings_suggestions : [],
    nonconformity_suggestions: Array.isArray(result?.nonconformity_suggestions) ? result.nonconformity_suggestions : [],
    evidence_requests: Array.isArray(result?.evidence_requests) ? result.evidence_requests : [],
    action_plan_suggestions: Array.isArray(result?.action_plan_suggestions) ? result.action_plan_suggestions : [],
    control_recommendations: Array.isArray(result?.control_recommendations) ? result.control_recommendations : [],
    risk_recommendations: Array.isArray(result?.risk_recommendations) ? result.risk_recommendations : [],
    next_steps: Array.isArray(result?.next_steps) ? result.next_steps : [],
  };
}

async function saveAiAuditorRunHistory({ req, tenantId, locale, result }) {
  try {
    if (!tenantId || !result || result.ok === false) {
      return { saved: false, error: 'history_skipped_invalid_payload' };
    }

    const summary = result.summary || {};
    const coverage = result.coverage || {};
    const suggestions = buildAiAuditorSuggestionsSnapshot(result);
    const trace = { ...(result.trace || {}), db_write: false, history_saved: true };

    const insert = await pool.query(
      `
      INSERT INTO ai_auditor_runs (
        tenant_id, user_id, locale, standard_code, audit_focus, depth, score,
        readiness_level, ai_engine_used, human_review_required, can_create_records,
        db_write, history_saved, summary_json, coverage_json, suggestions_json,
        full_result_json, trace_json
      )
      VALUES (
        $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::numeric,
        $8::text, $9::boolean, true, false, false, true,
        $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb
      )
      RETURNING id
      `,
      [
        tenantId,
        getUserId(req.user),
        locale || 'es',
        req.body?.standard_code || result?.scope?.standard_code || null,
        req.body?.audit_focus || result?.trace?.audit_focus || null,
        req.body?.depth || result?.trace?.depth || null,
        Number.isFinite(Number(summary.score)) ? Number(summary.score) : null,
        summary.readiness_level || null,
        result?.trace?.ai_engine_used === true,
        JSON.stringify(summary || {}),
        JSON.stringify(coverage || {}),
        JSON.stringify(suggestions || {}),
        JSON.stringify(result || {}),
        JSON.stringify(trace || {}),
      ]
    );

    return { saved: true, id: insert.rows[0]?.id || null };
  } catch (error) {
    const message = compactHistoryError(error);
    console.warn('AI AUDITOR HISTORY SAVE WARN:', message);
    return { saved: false, error: error?.code === '42P01' ? 'history_table_missing' : message };
  }
}

function attachAiAuditorHistorySaveMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = async function patchedAiAuditorAnalyzeJson(payload) {
    try {
      if (payload && payload.ok !== false && payload.summary) {
        const locale = normalizeAiAuditorLocale(req);
        const tenantId = resolveAiAuditorTenantId(req);
        const history = await saveAiAuditorRunHistory({ req, tenantId, locale, result: payload });
        payload.trace = { ...(payload.trace || {}), db_write: false, history_saved: history.saved === true };
        if (history.saved && history.id) payload.trace.history_run_id = history.id;
        if (!history.saved && history.error) payload.trace.history_error = history.error;
      }
    } catch (error) {
      payload.trace = { ...(payload.trace || {}), db_write: false, history_saved: false, history_error: compactHistoryError(error) };
    }
    return originalJson(payload);
  };
  return next();
}

async function listAiAuditorHistory(req, res) {
  const locale = normalizeAiAuditorLocale(req);
  const tenantId = resolveAiAuditorTenantId(req);
  if (!tenantId || !ensureTenantAccess(req, tenantId)) {
    return res.status(403).json(errorDetail('AI_AUDITOR_FORBIDDEN', locale, { message: locale === 'en' ? 'Tenant access denied.' : 'Acceso al tenant denegado.' }));
  }

  const limit = normalizeAiAuditorHistoryLimit(req.query.limit);
  const offset = normalizeAiAuditorHistoryOffset(req.query.offset);
  const standardCode = safeText(req.query.standard_code || '');
  const auditFocus = safeText(req.query.audit_focus || '');

  try {
    const result = await pool.query(
      `
      SELECT id, tenant_id, user_id, locale, standard_code, audit_focus, depth,
        score, readiness_level, ai_engine_used, human_review_required,
        can_create_records, db_write, history_saved, summary_json, coverage_json,
        trace_json, created_at, COUNT(*) OVER()::int AS total_count
      FROM ai_auditor_runs
      WHERE tenant_id = $1::uuid
        AND deleted_at IS NULL
        AND ($2::text = '' OR standard_code = $2::text)
        AND ($3::text = '' OR audit_focus = $3::text)
      ORDER BY created_at DESC
      LIMIT $4::int OFFSET $5::int
      `,
      [tenantId, standardCode, auditFocus, limit, offset]
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
        human_review_status: row.human_review_status || 'pending',
        human_review_comment: row.human_review_comment || '',
        human_reviewed_by: row.human_reviewed_by || null,
        human_reviewed_at: row.human_reviewed_at || null,
        human_review_metadata: row.human_review_metadata || {},
      user_id: row.user_id,
      standard_code: row.standard_code,
      audit_focus: row.audit_focus,
      depth: row.depth,
      score: row.score === null ? null : Number(row.score),
      readiness_level: row.readiness_level,
      ai_engine_used: row.ai_engine_used === true,
      human_review_required: row.human_review_required === true,
      can_create_records: row.can_create_records === true,
      db_write: row.db_write === true,
      history_saved: row.history_saved === true,
      summary_preview: String(row.summary_json?.executive_summary || '').slice(0, 420),
      coverage: row.coverage_json || {},
      trace: row.trace_json || {},
    }));

    return res.json({ ok: true, locale, tenant_id: tenantId, items, pagination: { limit, offset, count: result.rows[0]?.total_count || 0 } });
  } catch (error) {
    if (error?.code === '42P01') {
      return res.json({ ok: true, locale, tenant_id: tenantId, items: [], pagination: { limit, offset, count: 0 }, warning: 'history_table_missing' });
    }
    console.error('AI AUDITOR HISTORY LIST ERROR:', error);
    return res.status(500).json(errorDetail('AI_AUDITOR_HISTORY_ERROR', locale, { message: locale === 'en' ? 'Could not load AI Auditor history.' : 'No fue posible cargar el historial de IA Auditor.' }));
  }
}

async function getAiAuditorHistoryDetail(req, res) {
  const locale = normalizeAiAuditorLocale(req);
  const tenantId = resolveAiAuditorTenantId(req);
  const runId = req.params.id;
  if (!tenantId || !ensureTenantAccess(req, tenantId)) {
    return res.status(403).json(errorDetail('AI_AUDITOR_FORBIDDEN', locale, { message: locale === 'en' ? 'Tenant access denied.' : 'Acceso al tenant denegado.' }));
  }

  try {
    const result = await pool.query(
      `SELECT * FROM ai_auditor_runs WHERE id = $1::uuid AND tenant_id = $2::uuid AND deleted_at IS NULL LIMIT 1`,
      [runId, tenantId]
    );
    if (!result.rows.length) {
      return res.status(404).json(errorDetail('AI_AUDITOR_HISTORY_NOT_FOUND', locale, { message: locale === 'en' ? 'History run was not found.' : 'No se encontró la ejecución histórica.' }));
    }
    const row = result.rows[0];
    return res.json({
      ok: true,
      locale,
      tenant_id: tenantId,
      item: {
        id: row.id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        locale: row.locale,
        standard_code: row.standard_code,
        audit_focus: row.audit_focus,
        depth: row.depth,
        score: row.score === null ? null : Number(row.score),
        readiness_level: row.readiness_level,
        ai_engine_used: row.ai_engine_used === true,
        human_review_required: row.human_review_required === true,
        can_create_records: row.can_create_records === true,
        db_write: row.db_write === true,
        history_saved: row.history_saved === true,
        summary_json: row.summary_json || {},
        coverage_json: row.coverage_json || {},
        suggestions_json: row.suggestions_json || {},
        full_result_json: row.full_result_json || {},
        trace_json: row.trace_json || {},
        created_at: row.created_at,
        human_review_status: row.human_review_status || 'pending',
        human_review_comment: row.human_review_comment || '',
        human_reviewed_by: row.human_reviewed_by || null,
        human_reviewed_at: row.human_reviewed_at || null,
        human_review_metadata: row.human_review_metadata || {},
      },
    });
  } catch (error) {
    if (error?.code === '42P01') {
      return res.status(404).json(errorDetail('AI_AUDITOR_HISTORY_NOT_AVAILABLE', locale, { message: locale === 'en' ? 'History table is not available.' : 'La tabla de historial no está disponible.' }));
    }
    console.error('AI AUDITOR HISTORY DETAIL ERROR:', error);
    return res.status(500).json(errorDetail('AI_AUDITOR_HISTORY_ERROR', locale, { message: locale === 'en' ? 'Could not load AI Auditor history detail.' : 'No fue posible cargar el detalle histórico de IA Auditor.' }));
  }
}

router.use('/analyze', auth, attachAiAuditorHistorySaveMiddleware);
router.get('/history', auth, listAiAuditorHistory);


// =========================================================
// Fase 3M - Revisión humana del historial IA Auditor Senior
// =========================================================

const AI_AUDITOR_HUMAN_REVIEW_STATUSES = new Set([
  'pending',
  'reviewed',
  'accepted',
  'rejected',
  'needs_more_evidence',
]);

function normalizeAiAuditorHumanReviewStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return AI_AUDITOR_HUMAN_REVIEW_STATUSES.has(normalized) ? normalized : 'reviewed';
}

function sanitizeAiAuditorHumanReviewComment(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, 2000);
}

function getAiAuditorReviewUserId(req) {
  return (
    req?.user?.id ||
    req?.user?.user_id ||
    req?.user?.sub ||
    req?.user?.uuid ||
    req?.auth?.user_id ||
    null
  );
}

function pickAiAuditorReviewFields(row) {
  return {
    human_review_status: row?.human_review_status || 'pending',
    human_review_comment: row?.human_review_comment || '',
    human_reviewed_by: row?.human_reviewed_by || null,
    human_reviewed_at: row?.human_reviewed_at || null,
    human_review_metadata: row?.human_review_metadata || {},
  };
}


// =========================================================
// Fase 3L - Reporte PDF ejecutivo IA Auditor Senior
// =========================================================

function aiAuditorPdfText(locale, key) {
  const en = String(locale || '').toLowerCase().startsWith('en');
  const dict = {
    title: en ? 'Senior AI Auditor Executive Report' : 'Informe Ejecutivo IA Auditor Senior',
    subtitle: en ? 'Non-destructive AI-assisted audit assessment' : 'Evaluación auditora asistida por IA no destructiva',
    tenant: en ? 'Tenant' : 'Empresa',
    emittedAt: en ? 'Issued at' : 'Fecha de emisión',
    standard: en ? 'Standard' : 'Norma',
    focus: en ? 'Audit focus' : 'Foco auditor',
    depth: en ? 'Depth' : 'Profundidad',
    score: en ? 'Score' : 'Score',
    readiness: en ? 'Readiness' : 'Preparación',
    executiveSummary: en ? 'Executive summary' : 'Resumen ejecutivo',
    auditorOpinion: en ? 'Auditor opinion' : 'Opinión auditora',
    scope: en ? 'Reviewed scope' : 'Alcance revisado',
    controls: en ? 'Controls reviewed' : 'Controles revisados',
    evidences: en ? 'Evidence reviewed' : 'Evidencias revisadas',
    findings: en ? 'Findings reviewed' : 'Hallazgos revisados',
    actions: en ? 'Actions reviewed' : 'Acciones revisadas',
    mainGaps: en ? 'Main gaps' : 'Brechas principales',
    evidenceRequests: en ? 'Evidence requests' : 'Solicitudes de evidencia',
    findingsSuggestions: en ? 'Suggested findings' : 'Hallazgos sugeridos',
    actionSuggestions: en ? 'Suggested action plans' : 'Planes de acción sugeridos',
    nextSteps: en ? 'Next steps' : 'Próximos pasos',
    traceability: en ? 'Traceability' : 'Trazabilidad',
    humanReview: en ? 'Human review required' : 'Revisión humana requerida',
    noAutoCreate: en ? 'No records were created automatically' : 'No se crearon registros automáticamente',
    noApproval: en ? 'AI Auditor does not approve, close, or modify records' : 'IA Auditor no aprueba, cierra ni modifica registros',
    empty: en ? 'No records in this section.' : 'Sin registros en esta sección.',
    confidential: en ? 'Confidential document generated by TCDX by Tecdex.' : 'Documento confidencial generado por TCDX by Tecdex.',
  };
  return dict[key] || key;
}

function normalizeAiAuditorPdfArray(value) {
  return Array.isArray(value) ? value : [];
}

function safePdfValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return String(value);
}

function getAiAuditorPdfSummary(result) {
  return result?.summary || result?.summary_json || {};
}

function getAiAuditorPdfCoverage(result) {
  return result?.coverage || result?.coverage_json || {};
}

function getAiAuditorPdfTrace(result) {
  return result?.trace || result?.trace_json || {};
}

function getAiAuditorPdfSuggestions(result) {
  return {
    findings_suggestions: normalizeAiAuditorPdfArray(result?.findings_suggestions || result?.suggestions_json?.findings_suggestions),
    nonconformity_suggestions: normalizeAiAuditorPdfArray(result?.nonconformity_suggestions || result?.suggestions_json?.nonconformity_suggestions),
    evidence_requests: normalizeAiAuditorPdfArray(result?.evidence_requests || result?.suggestions_json?.evidence_requests),
    action_plan_suggestions: normalizeAiAuditorPdfArray(result?.action_plan_suggestions || result?.suggestions_json?.action_plan_suggestions),
    next_steps: normalizeAiAuditorPdfArray(result?.next_steps || result?.suggestions_json?.next_steps),
  };
}

function sanitizeAiAuditorPdfFileName(value) {
  return String(value || 'tcdx-ai-auditor')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80) || 'tcdx-ai-auditor';
}

async function getAiAuditorTenantForPdf(tenantId) {
  try {
    const result = await pool.query(
      `SELECT id, name, logo_url FROM tenants WHERE id = $1::uuid LIMIT 1`,
      [tenantId]
    );
    return result.rows[0] || { id: tenantId, name: 'Tenant' };
  } catch {
    return { id: tenantId, name: 'Tenant' };
  }
}

function pickAiAuditorPdfAnalysisFromHistory(row) {
  return {
    ...(row?.full_result_json || {}),
    summary: row?.summary_json || {},
    coverage: row?.coverage_json || {},
    trace: row?.trace_json || {},
    suggestions_json: row?.suggestions_json || {},
    score: row?.score,
    readiness_level: row?.readiness_level,
    ai_engine_used: row?.ai_engine_used,
    db_write: row?.db_write,
    human_review_required: row?.human_review_required,
    can_create_records: row?.can_create_records,
    created_at: row?.created_at,
  };
}

function addAiAuditorPdfFooter(doc, locale) {
  const bottom = doc.page.height - 42;
  doc.fontSize(7).fillColor('#64748B').text(aiAuditorPdfText(locale, 'confidential'), 50, bottom, {
    width: doc.page.width - 100,
    align: 'center',
  });
}

function ensureAiAuditorPdfSpace(doc, locale, needed = 90) {
  if (doc.y + needed > doc.page.height - 70) {
    addAiAuditorPdfFooter(doc, locale);
    doc.addPage();
    doc.y = 54;
  }
}

function addAiAuditorPdfSectionTitle(doc, locale, title) {
  ensureAiAuditorPdfSpace(doc, locale, 60);
  doc.moveDown(0.8);
  doc.fontSize(14).fillColor('#0F172A').font('Helvetica-Bold').text(title);
  doc.moveTo(50, doc.y + 4).lineTo(doc.page.width - 50, doc.y + 4).strokeColor('#CBD5E1').lineWidth(1).stroke();
  doc.moveDown(0.8);
}

function addAiAuditorPdfKpi(doc, label, value, x, y, width) {
  doc.roundedRect(x, y, width, 58, 10).fillAndStroke('#F8FAFC', '#E2E8F0');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text(label, x + 10, y + 10, { width: width - 20 });
  doc.fontSize(17).font('Helvetica-Bold').fillColor('#0F172A').text(safePdfValue(value), x + 10, y + 27, { width: width - 20 });
}

function addAiAuditorPdfBullets(doc, locale, items, mapper) {
  const rows = normalizeAiAuditorPdfArray(items).slice(0, 12);
  if (!rows.length) {
    doc.fontSize(9).fillColor('#64748B').font('Helvetica').text(aiAuditorPdfText(locale, 'empty'));
    return;
  }
  rows.forEach((item) => {
    ensureAiAuditorPdfSpace(doc, locale, 56);
    const text = mapper ? mapper(item) : safePdfValue(item);
    doc.fontSize(9).fillColor('#334155').font('Helvetica').text(`• ${text}`, { width: doc.page.width - 110, lineGap: 2 });
    doc.moveDown(0.35);
  });
}


// =========================================================
// Fase 3N - PDF gobernanza y revisión humana
// =========================================================

function aiAuditorPdfGovernanceText(locale, key) {
  const en = String(locale || '').toLowerCase().startsWith('en');

  const dict = {
    humanReviewSection: en ? 'Human review status' : 'Estado de revisión humana',
    reviewStatus: en ? 'Review status' : 'Estado de revisión',
    reviewComment: en ? 'Review comment' : 'Comentario de revisión',
    reviewedBy: en ? 'Reviewed by' : 'Revisado por',
    reviewedAt: en ? 'Reviewed at' : 'Revisado el',
    pending: en ? 'Pending human review' : 'Pendiente de revisión humana',
    reviewed: en ? 'Reviewed' : 'Revisado',
    accepted: en ? 'Accepted by human reviewer' : 'Aceptado por revisor humano',
    rejected: en ? 'Rejected by human reviewer' : 'Rechazado por revisor humano',
    needsMoreEvidence: en ? 'Needs more evidence' : 'Requiere más evidencia',
    governance: en ? 'Governance and traceability' : 'Gobernanza y trazabilidad',
    criticalRecordsWrite: en ? 'Critical records write' : 'Escritura de registros críticos',
    historyReviewWrite: en ? 'History review write' : 'Escritura de revisión histórica',
    noFormalClosure: en
      ? 'Human review of this AI report does not imply formal audit closure or control approval.'
      : 'La revisión humana de este informe IA no implica cierre formal de auditoría ni aprobación de controles.',
    governanceText: en
      ? 'This report separates AI-generated recommendations from human governance. AI Auditor does not create findings, close action plans, approve controls, or modify evidence automatically.'
      : 'Este informe separa las recomendaciones generadas por IA de la gobernanza humana. IA Auditor no crea hallazgos, no cierra planes, no aprueba controles ni modifica evidencias automáticamente.',
    aiGeneratedHumanValidated: en
      ? 'AI-generated assessment, subject to human validation.'
      : 'Evaluación generada por IA, sujeta a validación humana.',
  };

  return dict[key] || key;
}

function aiAuditorReviewStatusLabel(locale, status) {
  const normalized = String(status || 'pending').trim().toLowerCase();

  if (normalized === 'accepted') return aiAuditorPdfGovernanceText(locale, 'accepted');
  if (normalized === 'rejected') return aiAuditorPdfGovernanceText(locale, 'rejected');
  if (normalized === 'needs_more_evidence') return aiAuditorPdfGovernanceText(locale, 'needsMoreEvidence');
  if (normalized === 'reviewed') return aiAuditorPdfGovernanceText(locale, 'reviewed');

  return aiAuditorPdfGovernanceText(locale, 'pending');
}

function formatAiAuditorPdfDate(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function getAiAuditorPdfReview(analysis = {}, historyRow = null, override = null) {
  const source = override || analysis?.__pdf_review || analysis || {};
  const metadata =
    source.human_review_metadata ||
    historyRow?.human_review_metadata ||
    {};

  const status =
    source.human_review_status ||
    historyRow?.human_review_status ||
    'pending';

  return {
    human_review_status: status,
    human_review_comment:
      source.human_review_comment ||
      historyRow?.human_review_comment ||
      '',
    human_reviewed_by:
      source.human_reviewed_by ||
      historyRow?.human_reviewed_by ||
      null,
    human_reviewed_at:
      source.human_reviewed_at ||
      historyRow?.human_reviewed_at ||
      null,
    human_review_metadata: metadata,
    history_review_write: Boolean(metadata?.history_review_write),
    critical_records_write: Boolean(metadata?.critical_records_write),
  };
}

function addAiAuditorHumanReviewPdfSection(doc, locale, review) {
  addAiAuditorPdfSectionTitle(doc, locale, aiAuditorPdfGovernanceText(locale, 'humanReviewSection'));

  addAiAuditorPdfBullets(doc, locale, [
    `${aiAuditorPdfGovernanceText(locale, 'reviewStatus')}: ${aiAuditorReviewStatusLabel(locale, review?.human_review_status)}`,
    `${aiAuditorPdfGovernanceText(locale, 'reviewComment')}: ${safePdfValue(review?.human_review_comment, '-')}`,
    `${aiAuditorPdfGovernanceText(locale, 'reviewedBy')}: ${safePdfValue(review?.human_reviewed_by, '-')}`,
    `${aiAuditorPdfGovernanceText(locale, 'reviewedAt')}: ${formatAiAuditorPdfDate(review?.human_reviewed_at)}`,
    aiAuditorPdfGovernanceText(locale, 'noFormalClosure'),
  ]);
}

function addAiAuditorGovernancePdfSection(doc, locale, analysis, review) {
  const trace = getAiAuditorPdfTrace(analysis);

  addAiAuditorPdfSectionTitle(doc, locale, aiAuditorPdfGovernanceText(locale, 'governance'));

  addAiAuditorPdfBullets(doc, locale, [
    aiAuditorPdfGovernanceText(locale, 'governanceText'),
    aiAuditorPdfGovernanceText(locale, 'aiGeneratedHumanValidated'),
    `${aiAuditorPdfText(locale, 'humanReview')}: ${safePdfValue(analysis?.human_review_required, true)}`,
    `${aiAuditorPdfText(locale, 'noAutoCreate')}: ${String(analysis?.can_create_records === false)}`,
    `${aiAuditorPdfGovernanceText(locale, 'criticalRecordsWrite')}: ${safePdfValue(trace?.db_write, false)}`,
    `${aiAuditorPdfGovernanceText(locale, 'historyReviewWrite')}: ${safePdfValue(review?.history_review_write, false)}`,
    aiAuditorPdfGovernanceText(locale, 'noFormalClosure'),
  ]);
}


function sanitizeAiAuditorCacheSegment(value, fallback = 'unknown') {
  return String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 90) || fallback;
}

function getAiAuditorPdfCachePath({ tenantId, historyId }) {
  return path.join(
    __dirname,
    '..',
    '..',
    'uploads',
    'reports',
    'ai-auditor',
    sanitizeAiAuditorCacheSegment(tenantId, 'tenant'),
    `${sanitizeAiAuditorCacheSegment(historyId, 'history')}.pdf`
  );
}

async function streamFileAsPdf({ res, filePath, fileName }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeAiAuditorPdfFileName(fileName)}.pdf"`);
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  });
}

async function renderAiAuditorHtmlPdfToFile({ locale, tenant, analysis, outputPath, requestId, templateName = 'iaAuditorHistoric' }) {
  const html = renderIaAuditorHistoricTemplate({ locale, tenant, analysis });
  return renderHtmlToPdf({
    html,
    outputPath,
    requestId,
    format: process.env.PDF_RENDER_FORMAT || 'A4',
    printBackground: process.env.PDF_RENDER_PRINT_BACKGROUND !== 'false',
    timeoutMs: Number(process.env.PDF_RENDER_TIMEOUT_MS || 120000),
    metadata: {
      templateName,
      ai_engine_used: analysis?.trace?.ai_engine_used ?? analysis?.ai_engine_used ?? null,
      used_llm: analysis?.trace?.used_llm ?? analysis?.trace?.llm_used ?? null,
      model_mode: analysis?.trace?.model_mode ?? null,
      selected_model: analysis?.trace?.selected_model || analysis?.trace?.model_name || null,
      fallback_used: analysis?.trace?.fallback_used ?? null,
    },
  });
}

async function streamAiAuditorPdfReport({ req, res, locale, tenant, analysis, fileName, cachePath = null }) {
  const outputPath = cachePath || path.join(
    '/tmp',
    `${sanitizeAiAuditorPdfFileName(fileName)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
  );
  await renderAiAuditorHtmlPdfToFile({
    locale,
    tenant,
    analysis,
    outputPath,
    requestId: getAiAuditorRequestId(req) || null,
  });
  await streamFileAsPdf({ res, filePath: outputPath, fileName });
  if (!cachePath) {
    fs.unlink(outputPath, () => {});
  }
}

router.post('/report', auth, async (req, res) => {
  const locale = normalizeAiAuditorLocale(req);
  const tenantId = resolveAiAuditorTenantId(req);
  try {
    if (!tenantId || !ensureTenantAccess(req, tenantId)) {
      return res.status(403).json(errorDetail('AI_AUDITOR_FORBIDDEN', locale, {
        message: locale === 'en' ? 'Tenant access denied.' : 'Acceso al tenant denegado.',
      }));
    }
    const tenant = await getAiAuditorTenantForPdf(tenantId);
    const analysis = req.body?.analysis || {};
    const safeAnalysis = { ...analysis, human_review_required: true, can_create_records: false, trace: { ...(analysis.trace || {}), db_write: false } };
    safeAnalysis.__pdf_review = getAiAuditorPdfReview(safeAnalysis, null);
    return streamAiAuditorPdfReport({
      req,
      res,
      locale,
      tenant,
      analysis: safeAnalysis,
      fileName: `tcdx-ai-auditor-${new Date().toISOString().slice(0, 10)}`,
    });
  } catch (error) {
    console.error('AI AUDITOR PDF REPORT ERROR:', error);
    return res.status(500).json(errorDetail('AI_AUDITOR_REPORT_ERROR', locale, {
      message: locale === 'en' ? 'Could not generate AI Auditor PDF report.' : 'No fue posible generar el PDF de IA Auditor.',
    }));
  }
});


router.patch('/history/:id/review', auth, async (req, res) => {
  const locale = normalizeAiAuditorLocale(req);
  const tenantId = resolveAiAuditorTenantId(req);
  const runId = req.params.id;
  const reviewStatus = normalizeAiAuditorHumanReviewStatus(req.body?.review_status || req.body?.human_review_status);
  const reviewComment = sanitizeAiAuditorHumanReviewComment(req.body?.comment || req.body?.human_review_comment);
  const userId = getAiAuditorReviewUserId(req);

  try {
    if (!tenantId || !ensureTenantAccess(req, tenantId)) {
      return res.status(403).json(errorDetail('AI_AUDITOR_FORBIDDEN', locale, {
        message: locale === 'en' ? 'Tenant access denied.' : 'Acceso al tenant denegado.',
      }));
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM ai_auditor_runs
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [runId, tenantId]
    );

    if (!existing.rows.length) {
      return res.status(404).json(errorDetail('AI_AUDITOR_HISTORY_NOT_FOUND', locale, {
        message: locale === 'en' ? 'History run was not found.' : 'No se encontró la ejecución histórica.',
      }));
    }

    const reviewedBySql = userId ? '$4::uuid' : 'NULL';

    const updated = await pool.query(
      `
      UPDATE ai_auditor_runs
      SET
        human_review_status = $1,
        human_review_comment = $2,
        human_reviewed_at = CASE WHEN $1 = 'pending' THEN NULL ELSE now() END,
        human_reviewed_by = CASE WHEN $1 = 'pending' THEN NULL ELSE ${reviewedBySql} END,
        human_review_metadata = COALESCE(human_review_metadata, '{}'::jsonb) || $3::jsonb
      WHERE id = $5::uuid
        AND tenant_id = $6::uuid
        AND deleted_at IS NULL
      RETURNING
        id,
        tenant_id,
        user_id,
        locale,
        standard_code,
        audit_focus,
        depth,
        score,
        readiness_level,
        ai_engine_used,
        human_review_required,
        can_create_records,
        db_write,
        history_saved,
        created_at,
        human_review_status,
        human_review_comment,
        human_reviewed_by,
        human_reviewed_at,
        human_review_metadata,
        summary_json,
        coverage_json,
        suggestions_json,
        trace_json,
        human_review_status,
        human_review_comment,
        human_reviewed_by,
        human_reviewed_at,
        human_review_metadata
      `,
      [
        reviewStatus,
        reviewComment,
        JSON.stringify({
          source: 'ai_auditor_human_review',
          updated_at: new Date().toISOString(),
          history_review_write: true,
          critical_records_write: false,
        }),
        userId,
        runId,
        tenantId,
      ]
    );

    const row = updated.rows[0];

    return res.json({
      ok: true,
      locale,
      tenant_id: tenantId,
      history_review_write: true,
      critical_records_write: false,
      item: {
        ...row,
        ...pickAiAuditorReviewFields(row),
      },
    });
  } catch (error) {
    console.error('AI AUDITOR HUMAN REVIEW ERROR:', error);
    return res.status(500).json(errorDetail('AI_AUDITOR_HISTORY_REVIEW_ERROR', locale, {
      message: locale === 'en' ? 'Could not save human review.' : 'No fue posible guardar la revisión humana.',
    }));
  }
});


router.get('/history/:id/report', auth, async (req, res) => {
  const locale = normalizeAiAuditorLocale(req);
  const tenantId = resolveAiAuditorTenantId(req);
  const runId = req.params.id;
  try {
    if (!tenantId || !ensureTenantAccess(req, tenantId)) {
      return res.status(403).json(errorDetail('AI_AUDITOR_FORBIDDEN', locale, {
        message: locale === 'en' ? 'Tenant access denied.' : 'Acceso al tenant denegado.',
      }));
    }
    const result = await pool.query(
      `SELECT * FROM ai_auditor_runs WHERE id = $1::uuid AND tenant_id = $2::uuid AND deleted_at IS NULL LIMIT 1`,
      [runId, tenantId]
    );
    if (!result.rows.length) {
      return res.status(404).json(errorDetail('AI_AUDITOR_HISTORY_NOT_FOUND', locale, {
        message: locale === 'en' ? 'History run was not found.' : 'No se encontró la ejecución histórica.',
      }));
    }
    const row = result.rows[0];
    const tenant = await getAiAuditorTenantForPdf(tenantId);
    const analysis = pickAiAuditorPdfAnalysisFromHistory(row);
    analysis.trace = { ...(analysis.trace || row.trace_json || {}), history_run_id: row.id, history_saved: true, db_write: false };
    analysis.__pdf_review = getAiAuditorPdfReview(analysis, row);
    const cacheRoot = path.join(__dirname, '..', '..', 'uploads', 'reports', 'ai-auditor');
    const storedCachePath = row.rendered_pdf_file_path ? path.resolve(String(row.rendered_pdf_file_path)) : null;
    const safeStoredCachePath = storedCachePath && storedCachePath.startsWith(path.resolve(cacheRoot)) ? storedCachePath : null;
    const pdfCacheHit = Boolean(safeStoredCachePath && fs.existsSync(safeStoredCachePath));
    console.info('AI AUDITOR HISTORY PDF REPORT:', {
      request_id: getAiAuditorRequestId(req) || null,
      history_id: row.id,
      tenant_id: tenantId,
      pdf_cache_hit: pdfCacheHit,
      regenerated_pdf_from_history: !pdfCacheHit,
      ai_engine_called: false,
      render_engine: pdfCacheHit ? (row.pdf_render_engine || 'puppeteer') : 'puppeteer',
    });
    const fileName = `tcdx-ai-auditor-${row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}-${row.id ? String(row.id).slice(0, 8) : 'history'}`;
    if (pdfCacheHit) {
      return streamFileAsPdf({ res, filePath: safeStoredCachePath, fileName });
    }
    const cachePath = getAiAuditorPdfCachePath({ tenantId, historyId: row.id });
    await streamAiAuditorPdfReport({
      req,
      res,
      locale,
      tenant,
      analysis,
      fileName,
      cachePath,
    });
    try {
      await pool.query(
        `
        UPDATE ai_auditor_runs
        SET rendered_pdf_file_path = $1,
            rendered_pdf_at = now(),
            pdf_render_engine = 'puppeteer',
            pdf_render_trace_json = $2::jsonb
        WHERE id = $3::uuid AND tenant_id = $4::uuid
        `,
        [
          cachePath,
          JSON.stringify({
            request_id: getAiAuditorRequestId(req) || null,
            render_engine: 'puppeteer',
            ai_engine_called: false,
            rendered_from_history: true,
          }),
          row.id,
          tenantId,
        ]
      );
    } catch (cacheError) {
      console.warn('AI AUDITOR HISTORY PDF CACHE UPDATE WARN:', {
        request_id: getAiAuditorRequestId(req) || null,
        history_id: row.id,
        error: cacheError.message,
      });
    }
    return null;
  } catch (error) {
    console.error('AI AUDITOR HISTORY PDF REPORT ERROR:', error);
    return res.status(500).json(errorDetail('AI_AUDITOR_REPORT_ERROR', locale, {
      message: locale === 'en' ? 'Could not generate historical AI Auditor PDF report.' : 'No fue posible generar el PDF histórico de IA Auditor.',
    }));
  }
});


router.get('/history/:id', auth, getAiAuditorHistoryDetail);


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

async function runAiAuditorAnalysis({ req, requestId = null }) {
  const totalStartedAt = nowMs();
  const timings = {};
  const locale = normalizeAiAuditorLocale(req);
  const tenantId = resolveAiAuditorTenantId(req);
  const standardCode = req.body?.standard_code ? String(req.body.standard_code) : null;
  const depth = normalizeAiAuditorDepth(req.body || {});
  const modelMode = normalizeAiAuditorModelMode(req.body || {});

  const scopeStartedAt = nowMs();
  const scope = await buildGlobalAiAuditorScope(tenantId, standardCode);
  timings.scope_ms = elapsedMs(scopeStartedAt);
  const fallback = buildGlobalSeniorAuditAnalysis(scope, locale, {
    audit_focus: req.body?.audit_focus,
    depth,
  });

  try {
    const contextStartedAt = nowMs();
    const context = await buildSeniorAuditorContext({ tenantId, body: req.body || {} });
    timings.context_ms = elapsedMs(contextStartedAt);
    const enginePayload = buildSeniorAuditorPayload({
      tenantId,
      locale,
      context,
      body: req.body || {},
      requestId,
    });

    const engineStartedAt = nowMs();
    const engineJson = await aiEngineClient.analyzeWithSeniorAuditor(enginePayload);
    timings.ai_engine_ms = elapsedMs(engineStartedAt);
    if (engineJson?.ok === false) {
      const controlledError = new Error(engineJson?.answer || engineJson?.message || 'ai-engine returned fallback');
      controlledError.code = engineJson?.code || 'AI_ENGINE_FALLBACK';
      throw controlledError;
    }
    const analysis = adaptSeniorAuditorV2Response(engineJson, fallback, locale, scope, context);
    timings.total_ms = elapsedMs(totalStartedAt);

    analysis.request_id = requestId || analysis.request_id || null;
    analysis.trace = {
      ...(analysis.trace || {}),
      request_id: requestId || null,
      depth,
      model_mode: modelMode,
      async_mode: false,
      estimated_mode_cost: getAiAuditorEstimatedModeCost(modelMode),
      selected_model: analysis?.engine?.model || analysis?.trace?.engine?.model || analysis?.trace?.selected_model || analysis?.trace?.model_name || null,
      model_name: analysis?.engine?.model || analysis?.trace?.engine?.model || analysis?.trace?.model_name || analysis?.trace?.selected_model || null,
      llm_provider: analysis?.engine?.llm_provider || analysis?.trace?.engine?.llm_provider || analysis?.trace?.llm_provider || 'ollama',
      used_llm: analysis?.engine?.used_llm === true || analysis?.trace?.engine?.used_llm === true || analysis?.trace?.used_llm === true,
      used_rag: analysis?.engine?.used_rag === true || analysis?.trace?.engine?.used_rag === true || analysis?.trace?.used_rag === true || req.body?.use_rag === true,
      used_web: analysis?.engine?.used_web === true || analysis?.trace?.engine?.used_web === true || analysis?.trace?.used_web === true || req.body?.use_web === true || req.body?.force_web === true,
      used_drive: analysis?.engine?.used_drive === true || analysis?.trace?.engine?.used_drive === true || analysis?.trace?.used_drive === true || req.body?.use_drive === true || req.body?.force_drive === true,
      duration_ms: timings.ai_engine_ms || timings.total_ms,
      ai_engine_used: true,
      timings_ms: timings,
    };

    console.info('AI AUDITOR ANALYZE TIMING:', {
      request_id: requestId || null,
      tenant_id: tenantId,
      standard_code: standardCode,
      depth,
      model_mode: modelMode,
      timings_ms: timings,
      engine_model: analysis?.engine?.model || analysis?.trace?.engine?.model || null,
    });

    return analysis;
  } catch (engineError) {
    timings.total_ms = elapsedMs(totalStartedAt);
    console.warn('AI AUDITOR ENGINE FALLBACK:', {
      request_id: requestId || null,
      tenant_id: tenantId,
      standard_code: standardCode,
      depth,
      model_mode: modelMode,
      timings_ms: timings,
      error: engineError.message,
    });
    const fallbackResult = markAiAuditorFallback(fallback, engineError);
    fallbackResult.request_id = requestId || null;
    fallbackResult.code = engineError?.name === 'AbortError' ? 'AI_AUDITOR_TIMEOUT' : 'AI_AUDITOR_ENGINE_FALLBACK';
    fallbackResult.message = locale === 'en'
      ? 'Senior AI Auditor returned a controlled fallback response.'
      : 'IA Auditor Senior devolvió una respuesta controlada de respaldo.';
    fallbackResult.trace = {
      ...(fallbackResult.trace || {}),
      request_id: requestId || null,
      depth,
      model_mode: modelMode,
      async_mode: false,
      estimated_mode_cost: getAiAuditorEstimatedModeCost(modelMode),
      ai_engine_used: false,
      used_llm: false,
      used_rag: req.body?.use_rag === true,
      used_web: req.body?.use_web === true || req.body?.force_web === true,
      used_drive: req.body?.use_drive === true || req.body?.force_drive === true,
      fallback_used: true,
      fallback_reason: compactAiEngineErrorMessage(engineError),
      duration_ms: timings.total_ms,
      timings_ms: timings,
    };
    return fallbackResult;
  }
}

function buildAiAuditorRequestSnapshot(req, requestId) {
  return {
    user: { ...(req.user || {}) },
    body: { ...(req.body || {}), request_id: requestId },
    headers: {
      'x-request-id': requestId,
      'x-tcdx-locale': req.headers?.['x-tcdx-locale'],
    },
    requestId,
  };
}

async function runAiAuditorJob(jobId) {
  const job = aiAuditorRuntimeJobs.get(jobId);
  if (!job) return;
  job.status = 'running';
  job.started_at = new Date().toISOString();
  job.updated_at = job.started_at;
  try {
    await asyncJobs.markRunning(jobId);
    const reqSnapshot = buildAiAuditorRequestSnapshot(job.req, job.request_id);
    const result = await runAiAuditorAnalysis({ req: reqSnapshot, requestId: job.request_id });
    result.trace = {
      ...(result.trace || {}),
      async_mode: true,
      job_id: jobId,
    };
    const history = await saveAiAuditorRunHistory({
      req: reqSnapshot,
      tenantId: job.tenant_id,
      locale: job.locale,
      result,
    });
    result.trace = {
      ...(result.trace || {}),
      db_write: false,
      history_saved: history.saved === true,
      ...(history.id ? { history_run_id: history.id } : {}),
      ...(history.error ? { history_error: history.error } : {}),
    };
    job.status = 'completed';
    job.result = result;
    job.completed_at = new Date().toISOString();
    job.updated_at = job.completed_at;
    await asyncJobs.markCompleted(jobId, { result_json: result });
    aiAuditorRuntimeJobs.delete(jobId);
  } catch (error) {
    job.status = 'failed';
    job.error = {
      code: error?.name === 'AbortError' ? 'AI_AUDITOR_TIMEOUT' : 'AI_AUDITOR_JOB_FAILED',
      message: 'No fue posible completar el análisis IA.',
      request_id: job.request_id,
    };
    job.failed_at = new Date().toISOString();
    job.updated_at = job.failed_at;
    try {
      await asyncJobs.markFailed(jobId, { error_json: job.error });
    } catch (dbError) {
      console.error('AI AUDITOR JOB DB ERROR:', {
        job_id: jobId,
        request_id: job.request_id,
        error: dbError.message,
      });
    }
    console.error('AI AUDITOR JOB ERROR:', {
      job_id: jobId,
      request_id: job.request_id,
      error: error.message,
    });
  }
}

function publicAiAuditorJob(job) {
  const jobId = job.job_id || job.id;
  const result = job.result || job.result_json || null;
  const error = job.error || job.error_json || null;
  return {
    ok: true,
    job_id: jobId,
    request_id: job.request_id,
    status: job.status,
    created_at: job.created_at,
    started_at: job.started_at || null,
    completed_at: job.completed_at || null,
    failed_at: job.failed_at || null,
    model_mode: job.model_mode,
    depth: job.depth || job.request_payload_json?.depth || null,
    estimated_mode_cost: job.estimated_mode_cost || job.request_payload_json?.estimated_mode_cost || null,
    job_type: job.job_type || 'ia_auditor_analysis',
    source_module: job.source_module || 'ia_auditor',
    result_available: job.status === 'completed' && Boolean(result),
    error,
  };
}

function buildAsyncJobScope(req) {
  return {
    tenant_id: getUserTenantId(req.user),
    user_id: getUserId(req.user),
    is_platform: isPlatform(req.user),
  };
}

async function getAiAuditorJobScoped(req, jobId) {
  try {
    return await asyncJobs.getJobScoped(jobId, buildAsyncJobScope(req));
  } catch (error) {
    const runtimeJob = aiAuditorRuntimeJobs.get(String(jobId || ''));
    if (runtimeJob && ensureTenantAccess(req, runtimeJob.tenant_id)) return runtimeJob;
    throw error;
  }
}

async function createPersistentAiAuditorJob({ req, validated, requestId, modelMode, depth }) {
  const payload = {
    ...(req.body || {}),
    depth,
    model_mode: modelMode,
    estimated_mode_cost: getAiAuditorEstimatedModeCost(modelMode),
  };
  const expiresAt = new Date(Date.now() + AI_AUDITOR_JOB_TTL_MS).toISOString();
  return asyncJobs.createJob({
    tenant_id: validated.tenantId,
    user_id: getUserId(req.user),
    job_type: 'ia_auditor_analysis',
    source_module: 'ia_auditor',
    model_mode: modelMode,
    payload,
    request_id: requestId,
    expires_at: expiresAt,
  });
}

function registerAiAuditorRuntimeJob({ job, req, validated, requestId, modelMode, depth }) {
  const createdAt = job.created_at || new Date().toISOString();
  const runtimeJob = {
    job_id: job.id || job.job_id,
    request_id: requestId,
    tenant_id: validated.tenantId,
    locale: validated.locale,
    model_mode: modelMode,
    depth,
    estimated_mode_cost: getAiAuditorEstimatedModeCost(modelMode),
    status: job.status || 'queued',
    created_at: createdAt,
    updated_at: createdAt,
    created_at_ms: Date.now(),
    req: buildAiAuditorRequestSnapshot(req, requestId),
  };
  aiAuditorRuntimeJobs.set(runtimeJob.job_id, runtimeJob);
  setImmediate(() => runAiAuditorJob(runtimeJob.job_id));
  return runtimeJob;
}

function validateAiAuditorAnalyzeRequest(req, res, requestId) {
  const locale = normalizeAiAuditorLocale(req);
  res.set('x-tcdx-locale', locale);
  if (requestId) res.set('x-request-id', requestId);

  if (!canAnalyze(req.user)) {
    res.status(403).json({
      ok: false,
      code: 'RBAC_DENIED',
      error: 'No autorizado para ejecutar IA Auditor',
      request_id: requestId || null,
      locale,
    });
    return null;
  }

  const tenantId = resolveAiAuditorTenantId(req);
  if (!tenantId) {
    res.status(400).json({
      ok: false,
      error_code: 'TENANT_REQUIRED',
      code: 'TENANT_REQUIRED',
      message: 'tenant_id requerido',
      error: 'tenant_id requerido',
      request_id: requestId || null,
      locale,
    });
    return null;
  }

  if (!ensureTenantAccess(req, tenantId)) {
    res.status(403).json({
      ok: false,
      code: 'RBAC_DENIED',
      error: 'No autorizado para este tenant',
      request_id: requestId || null,
      locale,
    });
    return null;
  }

  return { locale, tenantId };
}

router.post('/analyze/start', auth, async (req, res) => {
  const requestId = getAiAuditorRequestId(req) || buildAiAuditorJobId();
  try {
    pruneAiAuditorJobs();
    const validated = validateAiAuditorAnalyzeRequest(req, res, requestId);
    if (!validated) return;

    const modelMode = normalizeAiAuditorModelMode(req.body || {});
    const depth = normalizeAiAuditorDepth(req.body || {});
    const job = await createPersistentAiAuditorJob({ req, validated, requestId, modelMode, depth });
    registerAiAuditorRuntimeJob({ job, req, validated, requestId, modelMode, depth });

    return res.status(202).json({
      ...publicAiAuditorJob(job),
      async_mode: true,
      message: validated.locale === 'en'
        ? 'AI analysis is running. You can continue using the platform. We will notify you when it is available.'
        : 'Análisis IA en ejecución. Puedes seguir usando la plataforma. Te avisaremos cuando esté disponible.',
    });
  } catch (error) {
    console.error('AI AUDITOR JOB START ERROR:', {
      request_id: requestId,
      error: error.message,
    });
    return res.status(500).json({
      ok: false,
      code: 'AI_AUDITOR_JOB_START_FAILED',
      error: 'No fue posible iniciar el análisis IA asincrónico.',
      request_id: requestId,
    });
  }
});

router.get('/analyze/jobs/:job_id', auth, async (req, res) => {
  try {
    pruneAiAuditorJobs();
    const job = await getAiAuditorJobScoped(req, String(req.params.job_id || ''));
    if (!job) {
      return res.status(404).json({ ok: false, code: 'AI_AUDITOR_JOB_NOT_FOUND', error: 'Job no encontrado' });
    }
    return res.json(publicAiAuditorJob(job));
  } catch (error) {
    return res.status(500).json({ ok: false, code: 'AI_AUDITOR_JOB_STATUS_FAILED', error: 'No fue posible consultar el job IA.' });
  }
});

router.get('/analyze/jobs/:job_id/result', auth, async (req, res) => {
  try {
    pruneAiAuditorJobs();
    const job = await getAiAuditorJobScoped(req, String(req.params.job_id || ''));
    if (!job) {
      return res.status(404).json({ ok: false, code: 'AI_AUDITOR_JOB_NOT_FOUND', error: 'Job no encontrado' });
    }
    if (job.status !== 'completed') {
      return res.status(202).json(publicAiAuditorJob(job));
    }
    return res.json(job.result || job.result_json);
  } catch (error) {
    return res.status(500).json({ ok: false, code: 'AI_AUDITOR_JOB_RESULT_FAILED', error: 'No fue posible consultar el resultado IA.' });
  }
});

router.post('/analyze', auth, async (req, res) => {
  const requestId = getAiAuditorRequestId(req);

  try {
    const validated = validateAiAuditorAnalyzeRequest(req, res, requestId);
    if (!validated) return;

    if (requiresAiAuditorAsync(req.body || {})) {
      req.body = { ...(req.body || {}), async_mode: true };
      const modelMode = normalizeAiAuditorModelMode(req.body || {});
      const depth = normalizeAiAuditorDepth(req.body || {});
      const effectiveRequestId = requestId || buildAiAuditorJobId();
      const job = await createPersistentAiAuditorJob({
        req,
        validated,
        requestId: effectiveRequestId,
        modelMode,
        depth,
      });
      registerAiAuditorRuntimeJob({
        job,
        req,
        validated,
        requestId: effectiveRequestId,
        modelMode,
        depth,
      });
      return res.status(202).json({
        ...publicAiAuditorJob(job),
        async_mode: true,
        message: validated.locale === 'en'
          ? 'AI analysis is running. You can continue using the platform. We will notify you when it is available.'
          : 'Análisis IA en ejecución. Puedes seguir usando la plataforma. Te avisaremos cuando esté disponible.',
      });
    }

    return res.json(await runAiAuditorAnalysis({ req, requestId }));
  } catch (error) {
    console.error('ERROR AI AUDITOR GLOBAL ANALYZE:', {
      request_id: requestId || null,
      error: error.message,
    });
    return res.status(500).json({
      ok: false,
      code: error?.name === 'AbortError' ? 'AI_AUDITOR_TIMEOUT' : 'AI_AUDITOR_ANALYZE_FAILED',
      error: 'Error ejecutando IA Auditor global',
      request_id: requestId || null,
      ...errorDetail(error),
    });
  }
});


function sanitizeAiAuditorDraftText(value, maxLength = 1200) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeAiAuditorDraftPriority(value) {
  const raw = String(value || '').toLowerCase().trim();

  if (['critica', 'crítica', 'critical', 'alta', 'high'].includes(raw)) return raw.includes('crit') ? 'critical' : 'high';
  if (['media', 'medium', 'medio'].includes(raw)) return 'medium';
  if (['baja', 'low', 'minor'].includes(raw)) return 'low';

  return 'medium';
}

function buildAiAuditorDraftKey() {
  const random = Math.random().toString(36).slice(2, 10);
  return `tcdx_ai_auditor_draft_${Date.now()}_${random}`;
}

function buildAiAuditorDraftDeepLink(type, storageKey) {
  const base = {
    finding: '/hallazgos',
    nonconformity: '/no-conformidades',
    evidence: '/evidencias',
    action_plan: '/plan-accion',
  }[type];

  const params = new URLSearchParams({
    source: 'ai-auditor',
    draft: '1',
    draft_key: storageKey,
  });

  return `${base}?${params.toString()}`;
}

function buildAiAuditorPreparedPayload(type, suggestion, req) {
  const title =
    sanitizeAiAuditorDraftText(
      suggestion.title ||
      suggestion.name ||
      suggestion.control_title ||
      suggestion.standard_code ||
      'AI Auditor suggestion',
      240
    ) || 'AI Auditor suggestion';

  const description = sanitizeAiAuditorDraftText(
    suggestion.description ||
    suggestion.detail ||
    suggestion.reason ||
    suggestion.why ||
    suggestion.recommended_action ||
    suggestion.recommended_next_step ||
    '',
    2200
  );

  const recommendedAction = sanitizeAiAuditorDraftText(
    suggestion.recommended_action ||
    suggestion.recommended_next_step ||
    suggestion.action ||
    '',
    1600
  );

  const reason = sanitizeAiAuditorDraftText(
    suggestion.reason ||
    suggestion.why ||
    suggestion.detail ||
    '',
    1600
  );

  const standardCode = sanitizeAiAuditorDraftText(
    suggestion.standard_code ||
    suggestion.iso_code ||
    suggestion.iso ||
    req.body?.standard_code ||
    '',
    80
  );

  const tenantControlId = sanitizeAiAuditorDraftText(
    suggestion.tenant_control_id ||
    suggestion.control_id ||
    suggestion.control_ref ||
    '',
    120
  );

  const payload = {
    source: 'ai_auditor_senior',
    source_label: 'IA Auditor Senior',
    type,
    title,
    description,
    priority: normalizeAiAuditorDraftPriority(suggestion.priority || suggestion.severity),
    severity: sanitizeAiAuditorDraftText(suggestion.severity || suggestion.priority || 'medium', 80),
    standard_code: standardCode,
    control_ref: sanitizeAiAuditorDraftText(suggestion.control_ref || suggestion.control_code || '', 120),
    tenant_control_id: tenantControlId,
    source_id: sanitizeAiAuditorDraftText(suggestion.source_id || suggestion.id || '', 120),
    recommended_action: recommendedAction,
    reason,
    human_review_required: true,
    can_create_records: false,
    created_by: 'ai_auditor_prepare_endpoint',
    created_at: new Date().toISOString(),
  };

  if (type === 'evidence') {
    payload.evidence_request = true;
    payload.description = description || reason || recommendedAction || title;
  }

  if (type === 'action_plan') {
    payload.action_plan_request = true;
    payload.description = description || recommendedAction || reason || title;
  }

  if (type === 'nonconformity') {
    payload.nonconformity_request = true;
    payload.description = description || reason || recommendedAction || title;
  }

  if (type === 'finding') {
    payload.finding_request = true;
    payload.description = description || reason || recommendedAction || title;
  }

  return payload;
}


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
    const suggestion = req.body?.suggestion && typeof req.body.suggestion === 'object'
      ? req.body.suggestion
      : {};

    const aliases = {
      finding: 'finding',
      hallazgo: 'finding',
      nonconformity: 'nonconformity',
      non_conformity: 'nonconformity',
      no_conformidad: 'nonconformity',
      evidence: 'evidence',
      evidencia: 'evidence',
      action: 'action_plan',
      action_plan: 'action_plan',
      plan: 'action_plan',
    };

    const normalizedType = aliases[type] || type;
    const allowed = ['finding', 'nonconformity', 'evidence', 'action_plan'];

    if (!allowed.includes(normalizedType)) {
      return res.status(400).json({
        ok: false,
        error_code: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Tipo de sugerencia no soportado',
        error: 'Tipo de sugerencia no soportado',
        locale,
      });
    }

    const storageKey = buildAiAuditorDraftKey();
    const preparedPayload = buildAiAuditorPreparedPayload(normalizedType, suggestion, req);
    const deepLink = buildAiAuditorDraftDeepLink(normalizedType, storageKey);

    return res.json({
      ok: true,
      locale,
      type: normalizedType,
      can_create_records: false,
      human_review_required: true,
      deep_link: deepLink,
      storage_key: storageKey,
      prepared_payload: preparedPayload,
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
