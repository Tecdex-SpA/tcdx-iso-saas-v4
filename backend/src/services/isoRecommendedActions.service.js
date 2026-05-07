const pool = require('../config/db');
const isoOperationalExecution = require('./isoOperationalExecution.service');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const ALLOWED_TARGET_TYPES = new Set([
  'action_plan',
  'finding',
  'nonconformity',
  'evidence_request',
  'audit_task',
  'risk_mitigation',
  'control_review',
]);

const ACTION_PLAN_FALLBACK_TARGETS = new Set([
  'evidence_request',
  'audit_task',
  'risk_mitigation',
  'control_review',
]);

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(normalizeRole(role));
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function resolveTenantId(user, requestedTenantId) {
  const role = user?.role || user?.user_role || user?.userRole;
  if (requestedTenantId && isPlatformRole(role)) return requestedTenantId;
  return getUserTenantId(user);
}

function assertTenantAccess(user, tenantId) {
  if (isPlatformRole(user?.role || user?.user_role || user?.userRole)) return;
  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function normalizeTargetType(value, fallback = 'action_plan') {
  const target = String(value || fallback).trim().toLowerCase();
  if (!ALLOWED_TARGET_TYPES.has(target)) {
    throw publicError(400, 'INVALID_TARGET_TYPE', 'Tipo de conversion invalido');
  }
  return target;
}

function normalizePriority(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (['critica', 'critico', 'critical'].includes(normalized)) return 'critica';
  if (['alta', 'alto', 'high'].includes(normalized)) return 'alta';
  if (['baja', 'bajo', 'low'].includes(normalized)) return 'baja';
  return 'media';
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeDateOnly(value, fallback = null) {
  if (!value) return fallback;
  return String(value).slice(0, 10);
}

function routeForTarget(targetType, targetId) {
  if (!targetId) return null;
  const map = {
    action_plan: '/plan-accion',
    evidence_request: '/plan-accion',
    audit_task: '/plan-accion',
    risk_mitigation: '/plan-accion',
    control_review: '/plan-accion',
    finding: '/hallazgos',
    nonconformity: '/no-conformidades',
  };
  const path = map[targetType] || '/plan-accion';
  return `${path}?id=${encodeURIComponent(targetId)}`;
}

function targetTableForType(targetType) {
  if (targetType === 'finding') return 'findings';
  if (targetType === 'nonconformity') return 'tenant_nonconformities';
  return 'action_plans';
}

function operationalTargetForType(targetType) {
  if (targetType === 'finding') return 'finding';
  if (targetType === 'nonconformity') return 'nonconformity';
  return 'action_plan';
}

function targetLabel(targetType) {
  const map = {
    action_plan: 'plan de accion',
    finding: 'hallazgo',
    nonconformity: 'no conformidad',
    evidence_request: 'solicitud de evidencia via plan de accion',
    audit_task: 'tarea de auditoria via plan de accion',
    risk_mitigation: 'accion de mitigacion via plan de accion',
    control_review: 'revision de control via plan de accion',
  };
  return map[targetType] || targetType;
}

function mergeOptions(suggestion, options = {}) {
  return {
    title: safeText(options.title, suggestion.title),
    description: safeText(
      options.description || options.notes,
      suggestion.description || suggestion.rationale || suggestion.title
    ),
    priority: normalizePriority(options.priority || suggestion.priority),
    owner: options.owner || options.suggested_owner || suggestion.suggested_owner || null,
    responsible_user_id: options.responsible_user_id || null,
    due_date: normalizeDateOnly(options.due_date, suggestion.suggested_due_date || null),
    notes: options.notes || null,
  };
}

async function getTenantControlContext(tenantId, tenantControlId) {
  if (!tenantControlId) return null;

  const result = await pool.query(
    `
    SELECT
      tc.id AS tenant_control_id,
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      tc.status AS tenant_control_status,
      cc.iso,
      cc.clause,
      cc.category,
      cc.description AS control_description,
      c.id AS legacy_control_id
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    LEFT JOIN LATERAL (
      SELECT c1.id
      FROM controls c1
      WHERE c1.catalog_control_id = tc.control_id
      ORDER BY c1.id ASC
      LIMIT 1
    ) c ON TRUE
    WHERE tc.tenant_id = $1::uuid
      AND tc.id = $2::uuid
    LIMIT 1
    `,
    [tenantId, tenantControlId]
  );

  return result.rows[0] || null;
}

async function tenantStandardActive(tenantId, standardCode) {
  if (!standardCode) return true;

  const result = await pool.query(
    `
    SELECT 1
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND standard_code = $2
      AND is_active IS DISTINCT FROM false
    LIMIT 1
    `,
    [tenantId, standardCode]
  );

  return result.rowCount > 0;
}

function conversionWarnings(targetType) {
  const warnings = [];

  if (ACTION_PLAN_FALLBACK_TARGETS.has(targetType)) {
    warnings.push(
      `No se crea un objeto especializado para ${targetLabel(targetType)}; se generara un plan de accion trazado.`
    );
  }

  if (targetType === 'evidence_request') {
    warnings.push('No se crea evidencia real ni archivo; solo una tarea para solicitar o reunir evidencia.');
  }

  if (targetType === 'control_review') {
    warnings.push('No se modifica tenant_controls; solo se crea una tarea de revision del control.');
  }

  return warnings;
}

async function buildConversionPreview(user, recommendationId, payload = {}) {
  const tenantId = resolveTenantId(user, payload.tenant_id);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  assertTenantAccess(user, tenantId);

  const suggestion = await isoOperationalExecution.getSuggestion(user, recommendationId, tenantId);
  const targetType = normalizeTargetType(payload.target_type || suggestion.target_record_type);
  const options = mergeOptions(suggestion, payload.options || {});
  const tenantControl = await getTenantControlContext(
    tenantId,
    payload.options?.tenant_control_id || suggestion.tenant_control_id
  );

  const blockedReasons = [];
  const warnings = conversionWarnings(targetType);

  if (!['pending', 'error'].includes(String(suggestion.status || ''))) {
    blockedReasons.push('La recomendacion ya no esta pendiente de conversion.');
  }

  if (String(suggestion.standard_code || '').toUpperCase() === 'ISO9001' &&
      String(suggestion.payload_json?.version_code || suggestion.source_trace_json?.version_code || '').toUpperCase() === '2026_FDIS') {
    blockedReasons.push('ISO9001 2026_FDIS es transicion no certificable; no se convierte automaticamente.');
  }

  if (suggestion.standard_code) {
    const active = await tenantStandardActive(tenantId, suggestion.standard_code);
    if (!active) {
      blockedReasons.push('La norma no esta activa para este tenant.');
    }
  }

  if (targetType === 'finding') {
    if (!['critica', 'alta'].includes(normalizePriority(suggestion.priority)) &&
        !String(suggestion.suggestion_type || '').includes('finding')) {
      blockedReasons.push('Para crear hallazgo se requiere prioridad alta/critica o sugerencia orientada a hallazgo.');
    }
    if (!tenantControl?.legacy_control_id) {
      blockedReasons.push('Para crear hallazgo se requiere control operativo con equivalente legacy.');
    }
  }

  if (targetType === 'nonconformity') {
    const source = String(suggestion.source_module || '');
    const type = String(suggestion.suggestion_type || '');
    const severe = ['critica', 'alta'].includes(normalizePriority(suggestion.priority));
    const justified = severe || source.includes('audit') || source.includes('diagnostic') || type.includes('nonconformity');
    if (!justified) {
      blockedReasons.push('No hay severidad u origen suficiente para crear no conformidad automaticamente.');
    }
    if (!tenantControl?.catalog_control_id && !suggestion.payload_json?.catalog_control_id && !suggestion.payload_json?.control_id) {
      blockedReasons.push('Para crear no conformidad se requiere control de catalogo asociado.');
    }
  }

  const operationalTarget = operationalTargetForType(targetType);
  const targetTable = targetTableForType(targetType);
  const canConvert = blockedReasons.length === 0;

  return {
    mode: 'dry_run',
    can_convert: canConvert,
    target_type: targetType,
    operational_target_type: operationalTarget,
    preview: {
      table: targetTable,
      title: options.title,
      description: options.description,
      priority: options.priority,
      due_date: options.due_date,
      owner: options.owner,
      linked_entities: {
        recommendation_id: suggestion.id,
        tenant_id: tenantId,
        standard_code: suggestion.standard_code,
        tenant_control_id: suggestion.tenant_control_id,
        catalog_control_id: tenantControl?.catalog_control_id || suggestion.payload_json?.catalog_control_id || null,
        source_module: suggestion.source_module,
        source_entity_type: suggestion.source_entity_type,
        source_entity_id: suggestion.source_entity_id,
      },
    },
    warnings,
    blocked_reasons: blockedReasons,
    suggestion,
  };
}

async function getConversionOptions(user, recommendationId, query = {}) {
  const base = await buildConversionPreview(user, recommendationId, {
    tenant_id: query.tenant_id,
    target_type: 'action_plan',
  });

  const options = [];
  for (const targetType of ALLOWED_TARGET_TYPES) {
    const preview = await buildConversionPreview(user, recommendationId, {
      tenant_id: query.tenant_id,
      target_type: targetType,
    });
    options.push({
      target_type: targetType,
      label: targetLabel(targetType),
      can_convert: preview.can_convert,
      warnings: preview.warnings,
      blocked_reasons: preview.blocked_reasons,
      table: preview.preview.table,
      route_base: routeForTarget(targetType, 'PREVIEW')?.replace('PREVIEW', ':id') || null,
    });
  }

  return {
    recommendation_id: recommendationId,
    tenant_id: base.preview.linked_entities.tenant_id,
    current_status: base.suggestion.status,
    options,
  };
}

async function dryRunConvertRecommendation(user, recommendationId, payload = {}) {
  const preview = await buildConversionPreview(user, recommendationId, payload);

  return {
    mode: 'dry_run',
    can_convert: preview.can_convert,
    target_type: preview.target_type,
    operational_target_type: preview.operational_target_type,
    preview: preview.preview,
    warnings: preview.warnings,
    blocked_reasons: preview.blocked_reasons,
  };
}

async function convertRecommendation(user, recommendationId, payload = {}) {
  if (payload.confirmed !== true) {
    throw publicError(400, 'CONFIRMATION_REQUIRED', 'La conversion requiere confirmed=true');
  }

  const preview = await buildConversionPreview(user, recommendationId, payload);
  if (!preview.can_convert) {
    throw publicError(400, 'CONVERSION_BLOCKED', preview.blocked_reasons.join(' | ') || 'Conversion bloqueada');
  }

  const targetType = preview.target_type;
  const operationalTargetType = preview.operational_target_type;
  const approvePayload = {
    ...(payload.options || {}),
    tenant_id: preview.preview.linked_entities.tenant_id,
    target_record_type: operationalTargetType,
    dry_run: false,
    conversion_context: {
      target_type: targetType,
      target_table: preview.preview.table,
      preview: preview.preview,
      warnings: preview.warnings,
      requested_payload: {
        target_type: payload.target_type,
        options: payload.options || {},
      },
    },
  };

  const updatedSuggestion = await isoOperationalExecution.approveSuggestion(
    user,
    recommendationId,
    approvePayload
  );

  const createdId = updatedSuggestion.created_record_id || (
    operationalTargetType === 'evidence_request' ? updatedSuggestion.id : null
  );
  const targetTable = preview.preview.table;

  return {
    mode: 'converted',
    target_type: targetType,
    operational_target_type: operationalTargetType,
    created_object: {
      id: createdId,
      type: targetType,
      table: targetTable,
      title: updatedSuggestion.title || preview.preview.title,
      route: routeForTarget(targetType, createdId),
    },
    recommendation: {
      id: updatedSuggestion.id,
      status: 'converted',
      stored_status: updatedSuggestion.status,
      created_record_type: updatedSuggestion.created_record_type,
      created_record_id: updatedSuggestion.created_record_id,
    },
    warnings: preview.warnings,
  };
}

module.exports = {
  getConversionOptions,
  dryRunConvertRecommendation,
  convertRecommendation,
};
