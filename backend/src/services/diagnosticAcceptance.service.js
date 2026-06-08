'use strict';

const pool = require('../config/db');
const diagnosticService = require('./diagnostic.service');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const GAP_ACCEPT_ROLES = new Set([
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'auditor',
]);

const ACTION_ACCEPT_ROLES = new Set([
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'operativo',
  'responsable_area',
  'area_owner',
]);

const PRIORITY_MAP = {
  high: 'alta',
  alta: 'alta',
  medium: 'media',
  media: 'media',
  low: 'baja',
  baja: 'baja',
};

function publicError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function normalizeRole(user = {}) {
  return String(user.role || user.user_role || user.userRole || '').toLowerCase().trim();
}

function getUserId(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(String(role || '').toLowerCase().trim());
}

function assertAcceptRole(user, action) {
  const role = normalizeRole(user);
  if (!role) {
    throw publicError(403, 'DIAGNOSTIC_ACCEPT_ROLE_REQUIRED', 'Usuario sin rol valido para aceptar sugerencias.');
  }

  if (isPlatformRole(role)) {
    return { role, userId: getUserId(user) };
  }

  const allowed = action === 'gap' ? GAP_ACCEPT_ROLES : ACTION_ACCEPT_ROLES;
  if (!allowed.has(role)) {
    throw publicError(403, 'DIAGNOSTIC_ACCEPT_RBAC_DENIED', 'No tiene permiso para ejecutar esta accion.');
  }

  return { role, userId: getUserId(user) };
}

function text(value, fallback = '', max = 1200) {
  const normalized = String(value || '').trim();
  return (normalized || fallback).slice(0, max);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function priority(value, fallback = 'media') {
  const normalized = String(value || '').toLowerCase().trim();
  return PRIORITY_MAP[normalized] || fallback;
}

function dueDateFromDays(days) {
  const parsed = Number(days);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + Math.min(Math.round(parsed), 365));
  return date.toISOString().slice(0, 10);
}

function firstRecommendedEvidence(payload = {}) {
  const evidence = array(payload.recommended_evidence || payload.recommendedEvidence);
  return evidence[0] || {};
}

function firstSuggestedAction(payload = {}) {
  const actions = array(payload.suggested_actions || payload.suggestedActions);
  return actions[0] || {};
}

function buildDiagnosticFilters(payload = {}) {
  return {
    process_id: payload.process_id || payload.processId || null,
    operation_id: payload.operation_id || payload.operationId || null,
  };
}

function requestedControlId(payload = {}) {
  return payload.control_id || payload.controlId || payload.tenant_control_id || payload.tenantControlId || null;
}

async function resolveControlFromDiagnostic({ user, payload }) {
  const diagnostic = await diagnosticService.buildDiagnostic({
    user,
    tenantId: payload.tenant_id || payload.tenantId || null,
    standardId: payload.standard_id || payload.standardId || payload.standard_code || payload.standardCode,
    standardCode: payload.standard_code || payload.standardCode,
    filters: buildDiagnosticFilters(payload),
  });

  const controlId = requestedControlId(payload);
  if (!controlId) {
    throw publicError(400, 'CONTROL_REQUIRED', 'control_id es obligatorio para aceptar la sugerencia.');
  }

  const control = diagnostic.controls.find((item) => (
    String(item.tenant_control_id) === String(controlId) ||
    String(item.catalog_control_id) === String(controlId)
  ));

  if (!control) {
    throw publicError(404, 'CONTROL_NOT_FOUND', 'Control no encontrado en el diagnostico visible para el usuario.');
  }

  return { diagnostic, control };
}

async function resolveLegacyFindingControlId(client, catalogControlId) {
  if (!catalogControlId) return null;

  const result = await client.query(
    `
    SELECT id
    FROM controls
    WHERE catalog_control_id = $1::uuid
    ORDER BY id ASC
    LIMIT 1
    `,
    [catalogControlId]
  );

  return result.rows[0]?.id || null;
}

function buildGapDescription({ control, payload, evidence }) {
  const assessment = payload.ai_assessment || payload.aiAssessment || {};
  const sourceReason = array(payload.sources)[0]?.reason || control.traceability?.fragment || '';
  const fields = array(evidence.minimum_fields || evidence.minimumFields)
    .slice(0, 16)
    .map((item) => `- ${item}`)
    .join('\n');

  return [
    text(assessment.gap_statement || payload.gap_statement || payload.gapStatement, 'Brecha sugerida por diagnostico fortalecido.', 1200),
    '',
    `Evidencia faltante/recomendada: ${text(evidence.name || payload.evidence_missing, 'Evidencia objetiva suficiente para el control.', 260)}`,
    `Justificacion: ${text(assessment.confidence_reason || sourceReason, 'El diagnostico no encontro cobertura documental suficiente.', 900)}`,
    `Como presentar: ${text(evidence.how_to_present || evidence.howToPresent, 'Cargar evidencia vigente con responsable, periodo y fuente.', 900)}`,
    fields ? `Campos minimos:\n${fields}` : '',
    `Origen: diagnostic_recommendation`,
    `Revision humana requerida: si`,
  ].filter(Boolean).join('\n');
}

function buildActionDescription({ control, payload, evidence, action }) {
  const assessment = payload.ai_assessment || payload.aiAssessment || {};
  return [
    text(action.description, evidence.how_to_present || evidence.purpose || 'Ejecutar accion operativa para cerrar la brecha documental.', 1200),
    '',
    `Control: ${text(control.clause || control.category || control.tenant_control_id, '', 180)}`,
    `Evidencia recomendada: ${text(evidence.name, 'Evidencia objetiva del control.', 260)}`,
    `Valor ISO: ${array(evidence.iso_use).join(', ') || text(assessment.audit_relevance, 'Demostrar control operacional y mejora continua.', 600)}`,
    `Origen: diagnostic_recommendation`,
    `Revision humana requerida: si`,
  ].filter(Boolean).join('\n');
}

async function acceptGap({ user, payload = {} } = {}) {
  assertAcceptRole(user, 'gap');
  const { diagnostic, control } = await resolveControlFromDiagnostic({ user, payload });
  const evidence = firstRecommendedEvidence(payload);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const legacyControlId = await resolveLegacyFindingControlId(client, control.catalog_control_id);
    const title = text(
      payload.title || `Brecha diagnostica: ${evidence.name || control.category || control.clause || 'control sin evidencia'}`,
      '',
      240
    );
    const description = buildGapDescription({ control, payload, evidence });
    const suggestedSeverity =
      payload.severity ||
      payload.priority ||
      (payload.ai_assessment?.confidence === 'high' ? 'alta' : 'media');
    const severity = priority(suggestedSeverity, control.status === 'missing_evidence' ? 'alta' : 'media');

    const duplicate = await client.query(
      `
      SELECT id
      FROM findings
      WHERE tenant_id = $1::uuid
        AND source_type = 'diagnostic'
        AND source_id = $2::uuid
        AND status IN ('abierto', 'en revision', 'accion definida')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [diagnostic.tenant_id, control.tenant_control_id]
    );

    if (duplicate.rowCount > 0) {
      await client.query('COMMIT');
      return {
        id: duplicate.rows[0].id,
        duplicate_prevented: true,
        source_type: 'diagnostic',
        origin: 'diagnostic_recommendation',
      };
    }

    const result = await client.query(
      `
      INSERT INTO findings (
        tenant_id,
        iso_code,
        title,
        description,
        finding_type,
        severity,
        status,
        source_type,
        source_id,
        owner,
        detected_by,
        created_by,
        tenant_control_id
      )
      VALUES ($1,$2,$3,$4,'observacion',$5,'abierto','diagnostic',$6,$7,$8,$9,$10)
      RETURNING id, tenant_id, iso_code, title, status, severity, source_type, source_id, created_at
      `,
      [
        diagnostic.tenant_id,
        diagnostic.standard.standard_code,
        title,
        description,
        severity,
        control.tenant_control_id,
        text(evidence.owner_role || payload.owner_role, '', 220) || null,
        text(payload.detected_by || 'diagnostic_recommendation', '', 120),
        getUserId(user),
        legacyControlId,
      ]
    );

    await client.query('COMMIT');
    return {
      ...result.rows[0],
      duplicate_prevented: false,
      origin: 'diagnostic_recommendation',
      human_review_required: true,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function acceptAction({ user, payload = {} } = {}) {
  assertAcceptRole(user, 'action');
  const { diagnostic, control } = await resolveControlFromDiagnostic({ user, payload });
  const evidence = firstRecommendedEvidence(payload);
  const action = firstSuggestedAction(payload);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const title = text(action.title || payload.title || `Accion diagnostica: ${evidence.name || control.category || control.clause || 'control'}`, '', 240);
    const description = buildActionDescription({ control, payload, evidence, action });
    const finalPriority = priority(action.priority || payload.priority, control.status === 'missing_evidence' ? 'alta' : 'media');
    const dueDate = payload.due_date || payload.dueDate || dueDateFromDays(action.suggested_due_days || payload.suggested_due_days);

    const duplicate = await client.query(
      `
      SELECT id
      FROM action_plans
      WHERE tenant_id = $1::uuid
        AND source_type = 'ia'
        AND source_id = $2::uuid
        AND status IN ('abierto', 'en progreso', 'bloqueado')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [diagnostic.tenant_id, control.tenant_control_id]
    );

    if (duplicate.rowCount > 0) {
      await client.query('COMMIT');
      return {
        id: duplicate.rows[0].id,
        duplicate_prevented: true,
        source_type: 'ia',
        origin: 'diagnostic_recommendation',
      };
    }

    const orchestration = {
      origin: 'diagnostic_recommendation',
      standard_id: diagnostic.standard.id,
      process_id: control.process?.id || null,
      operation_id: control.operation?.id || null,
      control_id: control.tenant_control_id,
      catalog_control_id: control.catalog_control_id,
      human_review_required: true,
    };

    const result = await client.query(
      `
      INSERT INTO action_plans (
        tenant_id,
        iso_code,
        title,
        description,
        source_type,
        source_id,
        priority,
        status,
        owner,
        due_date,
        created_by,
        tenant_control_id,
        approval_status,
        ai_source_level,
        ai_source_label,
        ai_confidence,
        ai_orchestration_json
      )
      VALUES ($1,$2,$3,$4,'ia',$5,$6,'abierto',$7,$8,$9,$10,'no_requerida','suggested','diagnostic_recommendation',$11,$12::jsonb)
      RETURNING id, tenant_id, iso_code, title, status, priority, source_type, source_id, created_at
      `,
      [
        diagnostic.tenant_id,
        diagnostic.standard.standard_code,
        title,
        description,
        control.tenant_control_id,
        finalPriority,
        text(action.suggested_owner || evidence.owner_role || payload.owner, '', 220) || null,
        dueDate || null,
        getUserId(user),
        control.tenant_control_id,
        text(payload.ai_assessment?.confidence || control.confidence, 'medium', 40),
        JSON.stringify(orchestration),
      ]
    );

    await client.query(
      `
      INSERT INTO action_plan_updates (
        action_plan_id,
        tenant_id,
        comment,
        progress_percent,
        status_after,
        created_by
      )
      VALUES ($1,$2,$3,0,'abierto',$4)
      `,
      [
        result.rows[0].id,
        diagnostic.tenant_id,
        'Plan creado por aceptacion humana de una recomendacion diagnostica. Origen: diagnostic_recommendation.',
        getUserId(user),
      ]
    );

    await client.query('COMMIT');
    return {
      ...result.rows[0],
      duplicate_prevented: false,
      origin: 'diagnostic_recommendation',
      human_review_required: true,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  acceptGap,
  acceptAction,
};
