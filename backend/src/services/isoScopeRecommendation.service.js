'use strict';

const crypto = require('crypto');
const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const diagnosticService = require('./diagnostic.service');
const healthService = require('./health.service');
const reportSources = require('./reportSources.service');
const reportTemplates = require('./reportTemplates.service');

const DISCLAIMER = 'Esta recomendación no define automáticamente el alcance de certificación. Debe ser revisada por la organización y el auditor.';
const CERTIFICATION_SCOPE_NOTE = 'La certificación aplica al sistema de gestión definido en un alcance. Según el contexto disponible, estos procesos, operaciones o áreas se recomiendan para evaluar su inclusión en el alcance.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_ROLES = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);
const EXECUTIVE_ROLES = new Set(['ejecutivo_cliente', 'viewer', 'cliente', 'client', 'read_only', 'readonly', 'solo_lectura', 'ejecutivo']);
const AREA_ROLES = new Set(['responsable_area', 'operativo', 'area_owner']);
const ALLOWED_ROLES = new Set([
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'auditor',
  'responsable_area',
  'operativo',
  'area_owner',
  'ejecutivo_cliente',
  'viewer',
  'cliente',
  'client',
  'read_only',
  'readonly',
  'solo_lectura',
  'ejecutivo',
  ...PLATFORM_ROLES,
]);

const HIGH_RISK = new Set(['alto', 'alta', 'high', 'critico', 'crítico', 'critica', 'crítica', 'critical']);
const CLOSED = new Set(['closed', 'cerrado', 'cerrada', 'completado', 'completada', 'done', 'resolved', 'resuelto', 'resuelta']);
const EXCLUDED_DOCUMENT_STATUSES = new Set(['excluded', 'ignored', 'missing', 'deleted', 'error']);
const SENSITIVE_KEY_RE = /(token|secret|password|authorization|cookie|api_key|apikey|credential|prompt|trace|embedding|chunk|raw_text|full_text|content_text|download_url|provider_file_id)/i;
const INTERNAL_URL_RE = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|[^/\s]+\.int)(?:[^\s]*)?/gi;

const STANDARD_PROFILES = {
  ISO9001: {
    code: 'ISO9001',
    name: 'ISO 9001',
    focus: 'Sistema de gestión de la calidad',
    recommendation: 'Evaluar inclusión dentro del alcance ISO 9001.',
    keywordBoost: 12,
    keywords: [
      'cliente', 'atencion', 'atención', 'soporte', 'reclamo', 'queja', 'calidad',
      'proveedor', 'compra', 'abastecimiento', 'operacion', 'operación', 'produccion',
      'producción', 'servicio', 'proyecto', 'implementacion', 'implementación',
      'capacitacion', 'capacitación', 'competencia', 'documento', 'no conformidad',
      'accion correctiva', 'acción correctiva', 'satisfaccion', 'satisfacción',
      'objetivo', 'indicador', 'mejora', 'entrega', 'postventa',
    ],
    antiCoreKeywords: ['soa', 'vulnerabilidad', 'firewall', 'antivirus'],
    evidenceNeeded: [
      'Mapa de procesos y responsabilidades',
      'Indicadores de proceso y objetivos de calidad',
      'Registros de reclamos o satisfacción del cliente',
      'Registros de no conformidades y acciones correctivas',
      'Evidencia de control documental y cambios',
      'Evaluación de proveedores cuando aplique',
    ],
    recommendedProcesses: [
      'Gestión de reclamos y satisfacción del cliente',
      'Control de calidad del servicio o producto',
      'Gestión de proveedores y compras',
      'Gestión de no conformidades y acciones correctivas',
      'Control documental y mejora continua',
    ],
    exclusionRisk: 'El alcance podría omitir procesos que afectan requisitos del cliente, calidad del servicio, no conformidades o mejora continua.',
  },
  ISO27001: {
    code: 'ISO27001',
    name: 'ISO/IEC 27001',
    focus: 'Sistema de gestión de seguridad de la información',
    recommendation: 'Evaluar inclusión dentro del alcance ISO 27001.',
    keywordBoost: 12,
    keywords: [
      'ti', 'tecnologia', 'tecnología', 'seguridad', 'infraestructura', 'acceso',
      'activo', 'backup', 'respaldo', 'continuidad', 'desarrollo', 'software',
      'cloud', 'nube', 'proveedor tecnologico', 'proveedor tecnológico', 'incidente',
      'vulnerabilidad', 'monitoreo', 'log', 'datos', 'dato', 'informacion',
      'información', 'soporte', 'sistema', 'servidor', 'red', 'aplicacion',
      'aplicación', 'privilegio', 'usuario', 'identidad', 'cambio ti',
    ],
    antiCoreKeywords: ['satisfaccion cliente', 'satisfacción cliente', 'reclamo comercial'],
    evidenceNeeded: [
      'Inventario de activos de información',
      'Matriz de riesgos de seguridad de la información',
      'Registro de accesos, altas, bajas y privilegios',
      'Registro de incidentes de seguridad',
      'Evidencia de respaldos y pruebas de restauración',
      'Gestión de cambios TI y vulnerabilidades',
    ],
    recommendedProcesses: [
      'Gestión de activos de información',
      'Gestión de accesos e identidades',
      'Gestión de incidentes de seguridad',
      'Continuidad operacional y respaldos',
      'Gestión de riesgos y controles de seguridad',
    ],
    exclusionRisk: 'El alcance podría omitir activos, accesos, servicios críticos o riesgos que afectan confidencialidad, integridad y disponibilidad.',
  },
};

function publicError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function asString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value = '') {
  return asString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeRole(user = {}) {
  return reportTemplates.normalizeRole(user.role || user.user_role || user.userRole || '');
}

function getUserTenantId(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function getUserId(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function isUuid(value) {
  return UUID_RE.test(asString(value));
}

function normalizeStandardCode(value) {
  const compact = asString(value)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('ISO/IEC', 'ISO')
    .replace('ISO-', 'ISO')
    .replace('ISO_', 'ISO')
    .replace('/', '');
  if (compact === 'ISO9001') return 'ISO9001';
  if (compact === 'ISO27001') return 'ISO27001';
  return compact;
}

function boolOption(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'si', 'sí'].includes(String(value).trim().toLowerCase());
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function normalizePriority(score) {
  if (score >= 70) return 'high';
  if (score >= 38) return 'medium';
  return 'low';
}

function normalizeConfidence(score, sourceCount = 0) {
  if (score >= 72 && sourceCount >= 2) return 'high';
  if (score >= 34 || sourceCount > 0) return 'medium';
  return 'low';
}

function redactText(value, maxLength = 900) {
  const text = asString(value)
    .replace(INTERNAL_URL_RE, '[url_interna_redactada]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function safeValue(value, depth = 0) {
  if (depth > 5) return '[redactado]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => safeValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (SENSITIVE_KEY_RE.test(key)) return acc;
      acc[key] = safeValue(item, depth + 1);
      return acc;
    }, {});
  }
  return null;
}

function assertAccess({ user, requestedTenantId = null }) {
  const role = normalizeRole(user);
  const userId = getUserId(user);
  const userTenantId = getUserTenantId(user);

  if (!userId) {
    throw publicError(401, 'ISO_SCOPE_USER_REQUIRED', 'Usuario no identificado en token.');
  }
  if (!role || role === 'partner' || role === 'dealer' || !ALLOWED_ROLES.has(role)) {
    throw publicError(403, 'ISO_SCOPE_RBAC_DENIED', 'Rol no autorizado para recomendaciones de alcance ISO.');
  }

  const tenantId = PLATFORM_ROLES.has(role) && requestedTenantId ? requestedTenantId : userTenantId;
  if (!tenantId) {
    throw publicError(403, 'ISO_SCOPE_TENANT_REQUIRED', 'Tenant no identificado para recomendaciones de alcance ISO.');
  }

  return { role, userId, tenantId, executive: EXECUTIVE_ROLES.has(role), areaRole: AREA_ROLES.has(role) };
}

async function safeQuery(sql, params = [], fallback = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows || fallback;
  } catch {
    return fallback;
  }
}

async function relationExists(name) {
  return reportSources.relationExists(name);
}

async function columnExists(table, column) {
  return reportSources.columnExists(table, column);
}

async function getTenant(tenantId) {
  const rows = await safeQuery(
    'SELECT id, name FROM tenants WHERE id = $1::uuid LIMIT 1',
    [tenantId],
    []
  );
  return rows[0] || { id: tenantId, name: 'Tenant' };
}

async function resolveStandard({ tenantId, standardCode, standardId, warnings }) {
  if (standardId && !isUuid(standardId)) {
    throw publicError(400, 'ISO_SCOPE_INVALID_STANDARD_ID', 'standard_id debe ser un UUID interno válido.');
  }

  let requestedCode = normalizeStandardCode(standardCode || '');
  let standardById = null;
  if (standardId && await relationExists('tenant_standards')) {
    const rows = await safeQuery(
      `
      SELECT id, standard_code, lifecycle_status, is_active
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      LIMIT 1
      `,
      [tenantId, standardId],
      []
    );
    if (!rows.length) {
      throw publicError(404, 'ISO_SCOPE_STANDARD_NOT_FOUND', 'standard_id no pertenece al tenant autenticado.');
    }
    standardById = rows[0];
    requestedCode = normalizeStandardCode(standardById.standard_code);
  }

  if (!requestedCode) {
    throw publicError(400, 'ISO_SCOPE_STANDARD_REQUIRED', 'standard_code o standard_id es obligatorio.');
  }
  if (!STANDARD_PROFILES[requestedCode]) {
    throw publicError(400, 'ISO_SCOPE_STANDARD_UNSUPPORTED', 'standard_code soportado inicialmente: ISO9001 o ISO27001.');
  }

  let activeStandard = null;
  if (await relationExists('tenant_standards')) {
    const rows = await safeQuery(
      `
      SELECT id, standard_code, lifecycle_status, is_active
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND standard_code = $2
        AND is_active IS DISTINCT FROM false
        AND lifecycle_status IS DISTINCT FROM 'permanently_deactivated'
      LIMIT 1
      `,
      [tenantId, requestedCode],
      []
    );
    activeStandard = rows[0] || null;
    if (!activeStandard && !standardId) {
      warnings.push('La norma solicitada no aparece activa para el tenant; se genera recomendación preliminar sin modificar alcance contratado.');
    } else if (!activeStandard && standardById) {
      warnings.push('standard_id pertenece al tenant, pero la norma no aparece activa; se genera recomendación preliminar sin modificar alcance contratado.');
    }
  } else {
    warnings.push('No se encontró tabla tenant_standards; no fue posible confirmar norma activa/contratada.');
  }

  const profile = STANDARD_PROFILES[requestedCode];
  return {
    id: activeStandard?.id || standardId || null,
    code: profile.code,
    name: profile.name,
    focus: profile.focus,
    lifecycle_status: activeStandard?.lifecycle_status || null,
    active: activeStandard ? activeStandard.is_active !== false : null,
  };
}

async function validateProcessFilter({ tenantId, processId }) {
  if (!processId) return null;
  if (!isUuid(processId)) {
    throw publicError(400, 'ISO_SCOPE_INVALID_PROCESS_ID', 'process_id debe ser un UUID interno válido.');
  }
  if (!(await relationExists('tenant_processes'))) {
    throw publicError(404, 'ISO_SCOPE_PROCESS_TABLE_UNAVAILABLE', 'No existe tabla de procesos para validar process_id.');
  }
  const rows = await safeQuery(
    `
    SELECT id, name, area
    FROM tenant_processes
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, processId],
    []
  );
  if (!rows.length) {
    throw publicError(404, 'ISO_SCOPE_PROCESS_NOT_FOUND', 'process_id no pertenece al tenant autenticado.');
  }
  return rows[0];
}

function scopedUser(user, tenantId) {
  return {
    ...user,
    tenant_id: tenantId,
    tenantId: tenantId,
  };
}

async function buildDiagnosticContext({ user, standard, processId, warnings }) {
  try {
    return await diagnosticService.buildDiagnostic({
      user,
      standardId: standard.id || standard.code,
      standardCode: standard.code,
      filters: { process_id: processId || null },
    });
  } catch (error) {
    warnings.push(error?.message || 'No fue posible construir diagnóstico para recomendación de alcance.');
    return {
      tenant_id: getUserTenantId(user),
      standard: { id: standard.id, standard_code: standard.code },
      controls: [],
      summary: {},
      metadata: {},
    };
  }
}

async function buildHealthContext({ user, standard, processId, warnings }) {
  try {
    const [summary, processes] = await Promise.all([
      healthService.getSummary({ user, standardId: standard.id, standardCode: standard.code }),
      healthService.getProcessesHealth({ user, standardId: standard.id, standardCode: standard.code, processId: processId || null }),
    ]);
    warnings.push(...asArray(summary.data_quality_warnings), ...asArray(processes.data_quality_warnings));
    return { summary, processes: asArray(processes.processes) };
  } catch (error) {
    warnings.push(error?.message || 'No fue posible calcular Health/KPIs para recomendación de alcance.');
    return { summary: null, processes: [] };
  }
}

async function loadProcesses({ tenantId, processId = null }) {
  if (!(await relationExists('tenant_processes'))) return [];
  const params = [tenantId];
  const where = ['tenant_id = $1::uuid'];
  if (processId) {
    params.push(processId);
    where.push(`id = $${params.length}::uuid`);
  }
  const hasOwner = await columnExists('tenant_processes', 'owner_user_id');
  const hasCriticality = await columnExists('tenant_processes', 'criticality');
  const hasArea = await columnExists('tenant_processes', 'area');
  const rows = await safeQuery(
    `
    SELECT
      id,
      name,
      code,
      description,
      ${hasArea ? 'area' : 'NULL::text'} AS area,
      ${hasCriticality ? 'criticality' : 'NULL::text'} AS criticality,
      ${hasOwner ? 'owner_user_id' : 'NULL::uuid'} AS owner_user_id,
      is_active,
      metadata
    FROM tenant_processes
    WHERE ${where.join(' AND ')}
      AND is_active IS DISTINCT FROM false
    ORDER BY name
    LIMIT 120
    `,
    params,
    []
  );
  return rows.map((row) => ({ ...row, scope_item_type: 'process' }));
}

async function loadOperations({ tenantId, processId = null }) {
  if (!(await relationExists('tenant_operations'))) return [];
  const hasProcess = await columnExists('tenant_operations', 'process_id');
  const hasType = await columnExists('tenant_operations', 'operation_type');
  const hasOwner = await columnExists('tenant_operations', 'owner_user_id');
  const hasDescription = await columnExists('tenant_operations', 'description');
  const hasFrequency = await columnExists('tenant_operations', 'frequency');
  const params = [tenantId];
  const where = ['op.tenant_id = $1::uuid'];
  if (processId && hasProcess) {
    params.push(processId);
    where.push(`op.process_id = $${params.length}::uuid`);
  }
  const rows = await safeQuery(
    `
    SELECT
      op.id,
      op.name,
      op.code,
      ${hasDescription ? 'op.description' : 'NULL::text'} AS description,
      ${hasProcess ? 'op.process_id' : 'NULL::uuid'} AS process_id,
      ${hasType ? 'op.operation_type' : 'NULL::text'} AS operation_type,
      ${hasFrequency ? 'op.frequency' : 'NULL::text'} AS frequency,
      ${hasOwner ? 'op.owner_user_id' : 'NULL::uuid'} AS owner_user_id,
      op.is_active,
      op.metadata,
      p.name AS process_name,
      p.area AS area,
      p.criticality AS process_criticality
    FROM tenant_operations op
    LEFT JOIN tenant_processes p
      ON p.tenant_id = op.tenant_id
     AND p.id = ${hasProcess ? 'op.process_id' : 'NULL::uuid'}
    WHERE ${where.join(' AND ')}
      AND op.is_active IS DISTINCT FROM false
    ORDER BY COALESCE(p.name, ''), op.name
    LIMIT 180
    `,
    params,
    []
  );
  return rows.map((row) => ({ ...row, scope_item_type: 'operation' }));
}

async function loadAssets({ tenantId, standardCode }) {
  if (!(await relationExists('assets'))) return [];
  const hasIso = await columnExists('assets', 'iso');
  const hasCriticality = await columnExists('assets', 'criticality');
  const hasOwner = await columnExists('assets', 'owner');
  const rows = await safeQuery(
    `
    SELECT
      a.id,
      a.name,
      a.type,
      ${hasIso ? 'a.iso' : 'NULL::text'} AS iso,
      ${hasCriticality ? 'a.criticality' : 'NULL::text'} AS criticality,
      ${hasOwner ? 'a.owner' : 'NULL::text'} AS owner
    FROM assets a
    WHERE a.tenant_id = $1::uuid
      AND (
        $2 <> 'ISO27001'
        OR ${hasIso ? "(a.iso IS NULL OR a.iso IN ('ISO27001', 'ISO/IEC27001', 'ISO_27001'))" : 'TRUE'}
      )
    ORDER BY
      CASE WHEN LOWER(COALESCE(${hasCriticality ? 'a.criticality' : 'NULL'}, '')) IN ('alta', 'alto', 'high', 'critico', 'critical') THEN 0 ELSE 1 END,
      a.name
    LIMIT 100
    `,
    [tenantId, standardCode],
    []
  );
  return rows;
}

async function loadRiskRows({ tenantId, standardCode }) {
  const output = [];
  if (await relationExists('iso_risk_matrix_items')) {
    const rows = await safeQuery(
      `
      SELECT id, tenant_control_id, asset_id, risk_title, risk_description, risk_category,
             asset_name, asset_type, asset_criticality, residual_risk_level, inherent_risk_level,
             treatment_strategy, status
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
        AND standard_code = $2
      ORDER BY
        CASE WHEN LOWER(COALESCE(residual_risk_level, inherent_risk_level, '')) IN ('critico', 'critical', 'alto', 'alta', 'high') THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST
      LIMIT 100
      `,
      [tenantId, standardCode],
      []
    );
    output.push(...rows.map((row) => ({ ...row, source_table: 'iso_risk_matrix_items' })));
  }

  if (await relationExists('asset_risks') && await relationExists('assets')) {
    const rows = await safeQuery(
      `
      SELECT ar.id, ar.asset_id, ar.risk AS risk_title, ar.impact AS risk_description,
             ar.level AS residual_risk_level, a.name AS asset_name, a.type AS asset_type,
             a.criticality AS asset_criticality, a.iso
      FROM asset_risks ar
      JOIN assets a ON a.id = ar.asset_id
      WHERE a.tenant_id = $1::uuid
        AND ($2 = 'ISO27001' OR a.iso = $2 OR a.iso IS NULL)
      ORDER BY
        CASE WHEN LOWER(COALESCE(ar.level, '')) IN ('critico', 'critical', 'alto', 'alta', 'high') THEN 0 ELSE 1 END
      LIMIT 80
      `,
      [tenantId, standardCode],
      []
    );
    output.push(...rows.map((row) => ({ ...row, source_table: 'asset_risks' })));
  }

  return output;
}

async function loadIncidents({ tenantId }) {
  const table = await relationExists('security_incidents')
    ? 'security_incidents'
    : await relationExists('incidents')
      ? 'incidents'
      : null;
  if (!table || !(await columnExists(table, 'tenant_id'))) return [];
  const hasTitle = await columnExists(table, 'title');
  const hasName = await columnExists(table, 'name');
  const hasDescription = await columnExists(table, 'description');
  const hasSeverity = await columnExists(table, 'severity');
  const hasStatus = await columnExists(table, 'status');
  const titleExpr = hasTitle ? 'title' : hasName ? 'name' : "'Incidente'";
  const rows = await safeQuery(
    `
    SELECT id, ${titleExpr} AS title, ${hasDescription ? 'description' : 'NULL::text'} AS description,
           ${hasSeverity ? 'severity' : 'NULL::text'} AS severity,
           ${hasStatus ? 'status' : 'NULL::text'} AS status
    FROM ${table}
    WHERE tenant_id = $1::uuid
    ORDER BY id DESC
    LIMIT 60
    `,
    [tenantId],
    []
  );
  return rows.map((row) => ({ ...row, source_table: table }));
}

function controlProcessId(control = {}) {
  return control.process?.id || null;
}

function controlOperationId(control = {}) {
  return control.operation?.id || null;
}

function summarizeControls(diagnostic = {}) {
  const processMap = new Map();
  const operationMap = new Map();
  const areaMap = new Map();

  for (const control of asArray(diagnostic.controls)) {
    const processId = controlProcessId(control);
    const operationId = controlOperationId(control);
    const area = asString(control.process?.area);
    const payload = {
      control,
      missing_evidence: control.status === 'missing_evidence' ? 1 : 0,
      open_gaps: Number(control.gaps?.open_count || 0),
      open_actions: Number(control.actions?.open_count || 0),
      overdue_actions: asArray(control.actions?.existing).filter((action) => action.open === true && action.due_date && new Date(action.due_date).getTime() < Date.now()).length,
      high_risks: asArray(control.risks?.existing).filter((risk) => HIGH_RISK.has(normalizeText(risk.residual_risk_level || risk.inherent_risk_level))).length,
      evidence_active_count: Number(control.evidence?.active_count || 0),
      recommended_evidence: asArray(control.evidence?.recommended),
      findings: [...asArray(control.gaps?.findings), ...asArray(control.gaps?.nonconformities)],
      risks: asArray(control.risks?.existing),
      evidences: asArray(control.evidence?.existing),
    };
    if (processId) appendControlSummary(processMap, processId, payload);
    if (operationId) appendControlSummary(operationMap, operationId, payload);
    if (area) appendControlSummary(areaMap, normalizeText(area), payload);
  }

  return { processMap, operationMap, areaMap };
}

function appendControlSummary(map, key, payload) {
  if (!map.has(key)) {
    map.set(key, {
      controls: 0,
      missing_evidence: 0,
      open_gaps: 0,
      open_actions: 0,
      overdue_actions: 0,
      high_risks: 0,
      evidence_active_count: 0,
      recommended_evidence: [],
      findings: [],
      risks: [],
      evidences: [],
    });
  }
  const item = map.get(key);
  item.controls += 1;
  item.missing_evidence += payload.missing_evidence;
  item.open_gaps += payload.open_gaps;
  item.open_actions += payload.open_actions;
  item.overdue_actions += payload.overdue_actions;
  item.high_risks += payload.high_risks;
  item.evidence_active_count += payload.evidence_active_count;
  item.recommended_evidence.push(...payload.recommended_evidence);
  item.findings.push(...payload.findings);
  item.risks.push(...payload.risks);
  item.evidences.push(...payload.evidences);
}

function buildAreaCandidates(processes = [], operations = []) {
  const areas = new Map();
  for (const item of [...processes, ...operations]) {
    const area = asString(item.area);
    if (!area) continue;
    const key = normalizeText(area);
    if (!areas.has(key)) {
      areas.set(key, {
        id: null,
        name: area,
        area,
        description: `Área inferida desde procesos/operaciones: ${area}`,
        scope_item_type: 'area',
        process_ids: [],
        operation_ids: [],
      });
    }
    const target = areas.get(key);
    if (item.scope_item_type === 'process') target.process_ids.push(item.id);
    if (item.scope_item_type === 'operation') target.operation_ids.push(item.id);
  }
  return Array.from(areas.values());
}

function makeSourceKey(source = {}) {
  return `${source.source_type || 'internal'}:${source.source_id || source.title || ''}:${source.used_for || 'context'}`;
}

function buildSources({ context, includeSources }) {
  if (!includeSources) return { sources: [], sourceMap: {}, sourceRefsByKey: new Map() };

  const raw = [];
  for (const process of context.processes) {
    raw.push({
      source_id: process.id,
      source_type: 'process',
      title: process.name,
      status: process.is_active === false ? 'inactive' : 'active',
      used_for: 'scope_candidate',
      visibility: 'operational',
      reference: { table: 'tenant_processes', id: process.id },
    });
  }
  for (const operation of context.operations) {
    raw.push({
      source_id: operation.id,
      source_type: 'operation',
      title: operation.name,
      status: operation.is_active === false ? 'inactive' : 'active',
      used_for: 'scope_candidate',
      visibility: 'operational',
      related_process_id: operation.process_id || null,
      reference: { table: 'tenant_operations', id: operation.id },
    });
  }
  for (const asset of context.assets) {
    raw.push({
      source_id: asset.id,
      source_type: 'asset',
      title: asset.name,
      status: 'active',
      used_for: 'asset_context',
      visibility: 'operational',
      evidence_strength: HIGH_RISK.has(normalizeText(asset.criticality)) ? 'primary' : 'contextual',
      reference: { table: 'assets', id: asset.id },
    });
  }
  for (const risk of context.risks) {
    raw.push({
      source_id: risk.id,
      source_type: 'risk',
      title: risk.risk_title || risk.asset_name || 'Riesgo',
      status: risk.status || 'active',
      used_for: 'risk',
      visibility: 'operational',
      evidence_strength: HIGH_RISK.has(normalizeText(risk.residual_risk_level || risk.inherent_risk_level)) ? 'primary' : 'contextual',
      related_control_id: risk.tenant_control_id || null,
      reference: { table: risk.source_table || 'risk', id: risk.id },
    });
  }
  for (const incident of context.incidents) {
    raw.push({
      source_id: incident.id,
      source_type: 'incident',
      title: incident.title || 'Incidente',
      status: incident.status || 'active',
      used_for: 'incident',
      visibility: 'operational',
      reference: { table: incident.source_table || 'incidents', id: incident.id },
    });
  }
  for (const health of context.health.processes) {
    raw.push({
      source_id: health.process_id || health.operation_id || health.id || health.name,
      source_type: 'health',
      title: `Health ${health.name || 'proceso'}`,
      status: health.status || 'active',
      used_for: 'health',
      visibility: 'operational',
      reference: { table: 'health_runtime', id: health.process_id || health.operation_id || null },
    });
  }
  raw.push(...asArray(context.reportSources));

  const sources = [];
  const sourceRefsByKey = new Map();
  const seen = new Set();
  for (const source of raw) {
    const normalized = reportSources.normalizeSource({
      ...source,
      title: redactText(source.title || source.name || 'Fuente interna', 220),
    });
    if (!normalized) continue;
    const status = normalizeText(normalized.status);
    if (EXCLUDED_DOCUMENT_STATUSES.has(status) && normalized.used_for === 'coverage') {
      normalized.used_for = 'excluded_reference';
    }
    const key = makeSourceKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      ref_id: `source_${sources.length + 1}`,
      source_id: normalized.source_id,
      source_type: normalized.source_type,
      title: normalized.title,
      provider: normalized.provider || 'internal',
      status: normalized.status,
      related_standard_id: normalized.related_standard_id || null,
      related_process_id: normalized.related_process_id || null,
      related_control_id: normalized.related_control_id || null,
      evidence_strength: normalized.evidence_strength || 'contextual',
      used_for: normalized.used_for || 'context',
      visibility: normalized.visibility || 'operational',
      reference: safeValue(normalized.reference || null),
    });
    sourceRefsByKey.set(`${normalized.source_type}:${normalized.source_id}`, sources[sources.length - 1].ref_id);
  }

  const sourceMap = sources.reduce((acc, source) => {
    acc[source.ref_id] = source;
    return acc;
  }, {});
  return { sources, sourceMap, sourceRefsByKey };
}

function sourceRefsForItem(item, type, sourceRefsByKey, extraRefs = []) {
  const refs = [];
  if (item?.id) refs.push(sourceRefsByKey.get(`${type}:${item.id}`));
  if (type === 'process' && item?.process_ids) {
    for (const id of item.process_ids) refs.push(sourceRefsByKey.get(`process:${id}`));
  }
  if (type === 'area' && item?.operation_ids) {
    for (const id of item.operation_ids) refs.push(sourceRefsByKey.get(`operation:${id}`));
  }
  refs.push(...extraRefs);
  return Array.from(new Set(refs.filter(Boolean))).slice(0, 6);
}

function matchKeywords(text, keywords) {
  const normalized = normalizeText(text);
  return keywords.filter((keyword) => normalized.includes(normalizeText(keyword)));
}

function relevantAssetsForItem(item, assets, standardCode) {
  const itemText = normalizeText(`${item.name} ${item.description} ${item.area} ${item.process_name}`);
  if (standardCode !== 'ISO27001') return [];
  return assets.filter((asset) => {
    const assetText = normalizeText(`${asset.name} ${asset.type} ${asset.owner}`);
    return (
      itemText.includes('ti') ||
      itemText.includes('seguridad') ||
      itemText.includes('infraestructura') ||
      itemText.includes('software') ||
      assetText.includes(itemText) ||
      itemText.split(/\s+/).some((word) => word.length > 4 && assetText.includes(word))
    );
  }).slice(0, 8);
}

function relevantRisksForItem(item, risks, standardCode) {
  const text = normalizeText(`${item.name} ${item.description} ${item.area} ${item.process_name}`);
  return risks.filter((risk) => {
    const riskText = normalizeText(`${risk.risk_title} ${risk.risk_description} ${risk.asset_name} ${risk.asset_type} ${risk.risk_category}`);
    if (standardCode === 'ISO27001' && risk.asset_name) return true;
    return text.split(/\s+/).some((word) => word.length > 4 && riskText.includes(word));
  }).slice(0, 8);
}

function healthForItem(item, type, healthProcesses) {
  if (type === 'process') {
    return healthProcesses.find((health) => String(health.process_id || health.id) === String(item.id)) || null;
  }
  if (type === 'operation') {
    return healthProcesses.find((health) => String(health.operation_id || health.id) === String(item.id)) || null;
  }
  if (type === 'area') {
    const rows = healthProcesses.filter((health) => normalizeText(health.area) === normalizeText(item.area || item.name));
    if (!rows.length) return null;
    const score = rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length;
    return {
      score,
      status: score < 50 ? 'low' : score < 70 ? 'medium' : 'acceptable',
      gaps_open: rows.reduce((sum, row) => sum + Number(row.gaps_open || 0), 0),
      missing_evidence: rows.reduce((sum, row) => sum + Number(row.missing_evidence || 0), 0),
      actions_overdue: rows.reduce((sum, row) => sum + Number(row.actions_overdue || 0), 0),
      risks_high: rows.reduce((sum, row) => sum + Number(row.risks_high || 0), 0),
      drivers: rows.flatMap((row) => asArray(row.drivers)).slice(0, 5),
    };
  }
  return null;
}

function controlSummaryForItem(item, type, summaries) {
  if (type === 'process') return summaries.processMap.get(item.id) || null;
  if (type === 'operation') return summaries.operationMap.get(item.id) || null;
  if (type === 'area') return summaries.areaMap.get(normalizeText(item.area || item.name)) || null;
  return null;
}

function scoreCandidate({ item, type, profile, standardCode, context, summaries }) {
  const text = `${item.name} ${item.code || ''} ${item.description || ''} ${item.area || ''} ${item.operation_type || ''} ${item.process_name || ''} ${JSON.stringify(item.metadata || {})}`;
  const keywordMatches = matchKeywords(text, profile.keywords);
  const antiMatches = matchKeywords(text, profile.antiCoreKeywords);
  const controlSummary = controlSummaryForItem(item, type, summaries);
  const health = healthForItem(item, type, context.health.processes);
  const assets = relevantAssetsForItem(item, context.assets, standardCode);
  const risks = relevantRisksForItem(item, context.risks, standardCode);
  const incidents = standardCode === 'ISO27001' ? context.incidents.slice(0, 6) : [];

  let score = 10;
  score += keywordMatches.length * profile.keywordBoost;
  score -= antiMatches.length * 8;
  if (['alta', 'alto', 'high', 'critico', 'critical'].includes(normalizeText(item.criticality || item.process_criticality))) score += 12;
  if (type === 'area') score += 8;
  if (type === 'operation') score += 6;
  if (controlSummary) {
    score += Math.min(24, controlSummary.controls * 2);
    score += Math.min(18, controlSummary.missing_evidence * 5);
    score += Math.min(20, controlSummary.open_gaps * 4);
    score += Math.min(16, controlSummary.open_actions * 3);
    score += Math.min(18, controlSummary.overdue_actions * 7);
    score += Math.min(22, controlSummary.high_risks * 6);
  }
  if (health) {
    if (Number(health.score) < 50) score += 18;
    else if (Number(health.score) < 70) score += 10;
  }
  if (standardCode === 'ISO27001') {
    score += Math.min(24, assets.length * 5);
    score += Math.min(26, risks.filter((risk) => HIGH_RISK.has(normalizeText(risk.residual_risk_level || risk.inherent_risk_level))).length * 8);
    score += Math.min(18, incidents.filter((incident) => !CLOSED.has(normalizeText(incident.status))).length * 4);
  }
  if (standardCode === 'ISO9001') {
    score += Math.min(18, asArray(controlSummary?.findings).length * 4);
    score += Math.min(12, asArray(controlSummary?.recommended_evidence).length * 3);
  }

  const reasons = [];
  if (keywordMatches.length) reasons.push(`Coincide con señales de ${profile.name}: ${keywordMatches.slice(0, 5).join(', ')}.`);
  if (controlSummary?.missing_evidence) reasons.push(`Tiene ${controlSummary.missing_evidence} control(es) con evidencia faltante.`);
  if (controlSummary?.open_gaps) reasons.push(`Presenta ${controlSummary.open_gaps} brecha(s), hallazgo(s) o no conformidad(es) abierta(s).`);
  if (controlSummary?.overdue_actions) reasons.push(`Tiene ${controlSummary.overdue_actions} acción(es) vencida(s).`);
  if (health?.score !== undefined && health.score !== null) reasons.push(`Health operativo asociado: ${Math.round(Number(health.score))}.`);
  if (assets.length) reasons.push(`Se relaciona con ${assets.length} activo(s) de información o tecnológico(s).`);
  if (risks.length) reasons.push(`Se relaciona con ${risks.length} riesgo(s) registrado(s).`);
  if (!reasons.length) reasons.push('No se observaron señales fuertes; mantener como evaluación de baja prioridad si el alcance formal lo requiere.');

  return {
    score: clamp(score, 0, 100),
    keywordMatches,
    antiMatches,
    controlSummary,
    health,
    assets,
    risks,
    incidents,
    reasons,
  };
}

function evidenceNeeded({ profile, score, controlSummary, assets, risks, standardCode }) {
  const evidence = [...profile.evidenceNeeded];
  for (const recommendation of asArray(controlSummary?.recommended_evidence).slice(0, 4)) {
    const name = recommendation.name || recommendation.title || recommendation.purpose;
    if (name) evidence.push(name);
  }
  if (standardCode === 'ISO27001' && assets.length) evidence.push('Relación activo-proceso y propietario del activo');
  if (risks.length) evidence.push('Tratamiento de riesgos y decisión de aceptación/reducción');
  if (score < 38) evidence.push('Justificación documentada de exclusión o baja criticidad');
  return Array.from(new Set(evidence.map((item) => redactText(item, 180)))).slice(0, 8);
}

function relatedEvidence(controlSummary) {
  return asArray(controlSummary?.evidences).slice(0, 6).map((evidence) => ({
    id: evidence.source_id || evidence.id || null,
    name: redactText(evidence.name || evidence.file_name || evidence.description || 'Evidencia', 160),
    status: evidence.status || (evidence.active === false ? 'excluded' : 'active'),
    source_type: evidence.source_type || 'evidence',
  }));
}

function relatedRisks(risks, controlSummary) {
  const all = [...asArray(risks), ...asArray(controlSummary?.risks)];
  const seen = new Set();
  return all.filter((risk) => {
    const key = risk.id || risk.risk_title || risk.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6).map((risk) => ({
    id: risk.id || null,
    title: redactText(risk.risk_title || risk.title || risk.risk_description || 'Riesgo', 180),
    level: risk.residual_risk_level || risk.inherent_risk_level || risk.level || null,
    status: risk.status || null,
  }));
}

function buildRecommendation({ item, type, profile, standardCode, context, summaries, sourceRefsByKey }) {
  const analysis = scoreCandidate({ item, type, profile, standardCode, context, summaries });
  const extraRefs = [];
  for (const risk of analysis.risks.slice(0, 3)) extraRefs.push(sourceRefsByKey.get(`risk:${risk.id}`));
  for (const asset of analysis.assets.slice(0, 3)) extraRefs.push(sourceRefsByKey.get(`asset:${asset.id}`));
  if (analysis.health) extraRefs.push(sourceRefsByKey.get(`health:${analysis.health.process_id || analysis.health.operation_id || analysis.health.id || analysis.health.name}`));
  const refs = sourceRefsForItem(item, type, sourceRefsByKey, extraRefs);

  return {
    scope_item_type: type,
    scope_item_id: item.id || null,
    name: redactText(item.name || item.area || 'Elemento de alcance', 180),
    priority: normalizePriority(analysis.score),
    confidence: normalizeConfidence(analysis.score, refs.length),
    recommendation: profile.recommendation,
    reason: redactText(analysis.reasons.join(' '), 900),
    recommended_processes: profile.recommendedProcesses.slice(0, 6),
    evidence_needed: evidenceNeeded({
      profile,
      score: analysis.score,
      controlSummary: analysis.controlSummary,
      assets: analysis.assets,
      risks: analysis.risks,
      standardCode,
    }),
    risk_if_excluded: analysis.score >= 38
      ? profile.exclusionRisk
      : 'La exclusión podría ser aceptable si la organización documenta la baja criticidad, interfaces e impactos indirectos.',
    related_risks: relatedRisks(analysis.risks, analysis.controlSummary),
    related_evidence: relatedEvidence(analysis.controlSummary),
    source_refs: refs,
    score: Math.round(analysis.score),
  };
}

function lowPriorityItem(recommendation) {
  return {
    scope_item_type: recommendation.scope_item_type,
    scope_item_id: recommendation.scope_item_id,
    name: recommendation.name,
    reason: recommendation.reason || 'No se observaron activos críticos, riesgos relevantes o impacto directo en la norma evaluada.',
    confidence: recommendation.confidence,
  };
}

function buildDeterministicRecommendations({ standard, context, sourceRefsByKey }) {
  const profile = STANDARD_PROFILES[standard.code];
  const summaries = summarizeControls(context.diagnostic);
  const candidates = [
    ...context.areas.map((item) => ({ item, type: 'area' })),
    ...context.processes.map((item) => ({ item, type: 'process' })),
    ...context.operations.map((item) => ({ item, type: 'operation' })),
  ];

  const scored = candidates.map(({ item, type }) => buildRecommendation({
    item,
    type,
    profile,
    standardCode: standard.code,
    context,
    summaries,
    sourceRefsByKey,
  }));

  const ordered = scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const recommendations = ordered.filter((item) => item.priority !== 'low').slice(0, 12);
  const lowPriority = ordered.filter((item) => item.priority === 'low').slice(0, 8).map(lowPriorityItem);

  if (!recommendations.length && ordered.length) {
    recommendations.push(ordered[0]);
    return {
      recommendations,
      not_recommended_or_low_priority: ordered.slice(1, 9).map(lowPriorityItem),
    };
  }

  if (!recommendations.length) {
    return {
      recommendations: [{
        scope_item_type: 'area',
        scope_item_id: null,
        name: standard.code === 'ISO27001' ? 'Alcance SGSI por definir' : 'Alcance SGC por definir',
        priority: 'medium',
        confidence: 'low',
        recommendation: profile.recommendation,
        reason: 'No se encontraron procesos, operaciones o áreas suficientes en el contexto del tenant. Se recomienda levantar mapa de procesos/activos antes de definir alcance.',
        recommended_processes: profile.recommendedProcesses.slice(0, 5),
        evidence_needed: profile.evidenceNeeded.slice(0, 6),
        risk_if_excluded: profile.exclusionRisk,
        related_risks: [],
        related_evidence: [],
        source_refs: [],
        score: 38,
      }],
      not_recommended_or_low_priority: [],
    };
  }

  return {
    recommendations,
    not_recommended_or_low_priority: lowPriority,
  };
}

function buildSafeAiPayload({ standard, context, deterministic, sourceMap, requestId }) {
  return {
    task_type: 'iso_scope_recommendation',
    module_origin: 'iso-scope',
    tenant_id: context.tenant.id,
    standard_code: standard.code,
    use_web: false,
    use_drive: false,
    use_rag: false,
    allow_web_research: false,
    allow_document_context: false,
    question: [
      'Actúa como auditor líder ISO y arquitecto SaaS B2B.',
      'Ajusta la redacción de recomendaciones de alcance usando solo el JSON entregado.',
      'No certifiques, no apruebes, no decidas alcance final y no inventes procesos, áreas, operaciones, activos ni documentos.',
      'Cada recomendación debe conservar source_refs válidos del source_map.',
      'Distingue evaluación de inclusión en alcance del sistema de gestión versus certificar un proceso aislado.',
      'Si faltan datos, decláralo como limitación. Toda recomendación requiere revisión humana.',
    ].join(' '),
    context: {
      standard,
      tenant: { id: context.tenant.id, name: context.tenant.name },
      health: safeValue(context.health),
      organizational_context: {
        processes: context.processes.slice(0, 60).map((item) => safeValue(item)),
        operations: context.operations.slice(0, 80).map((item) => safeValue(item)),
        areas: context.areas.slice(0, 40).map((item) => safeValue(item)),
        assets: context.assets.slice(0, 40).map((item) => safeValue(item)),
        risks: context.risks.slice(0, 40).map((item) => safeValue(item)),
        incidents: context.incidents.slice(0, 30).map((item) => safeValue(item)),
      },
      deterministic_recommendations: deterministic.recommendations,
      not_recommended_or_low_priority: deterministic.not_recommended_or_low_priority,
      source_map: sourceMap,
      required_output: {
        recommendations: deterministic.recommendations,
        not_recommended_or_low_priority: deterministic.not_recommended_or_low_priority,
        warnings: [],
        limitations: [],
      },
    },
    options: {
      model_mode: 'fast',
      return_structured_result: true,
      local_compact: true,
      fast_mode: true,
      use_llm: true,
      use_web: false,
      use_drive: false,
      use_rag: false,
    },
    request_metadata: {
      request_id: requestId,
      standard_code: standard.code,
      mode: 'scope_recommendation',
    },
  };
}

function validSourceRefs(refs, sourceMap) {
  const allowed = new Set(Object.keys(sourceMap || {}));
  return asArray(refs).map((ref) => asString(ref)).filter((ref) => allowed.has(ref)).slice(0, 8);
}

function normalizeAiRecommendation(item, fallback, sourceMap) {
  const sourceRefs = validSourceRefs(item?.source_refs || item?.sources || item?.sourceRefs, sourceMap);
  return {
    ...fallback,
    scope_item_type: ['area', 'process', 'operation'].includes(asString(item?.scope_item_type)) ? item.scope_item_type : fallback.scope_item_type,
    scope_item_id: fallback.scope_item_id,
    name: redactText(item?.name || fallback.name, 180),
    priority: ['high', 'medium', 'low'].includes(asString(item?.priority)) ? item.priority : fallback.priority,
    confidence: ['high', 'medium', 'low'].includes(asString(item?.confidence)) ? item.confidence : fallback.confidence,
    recommendation: redactText(item?.recommendation || fallback.recommendation, 260),
    reason: redactText(item?.reason || item?.description || fallback.reason, 900),
    recommended_processes: asArray(item?.recommended_processes).length
      ? asArray(item.recommended_processes).map((entry) => redactText(entry, 160)).slice(0, 8)
      : fallback.recommended_processes,
    evidence_needed: asArray(item?.evidence_needed).length
      ? asArray(item.evidence_needed).map((entry) => redactText(entry, 180)).slice(0, 8)
      : fallback.evidence_needed,
    risk_if_excluded: redactText(item?.risk_if_excluded || fallback.risk_if_excluded, 700),
    related_risks: fallback.related_risks,
    related_evidence: fallback.related_evidence,
    source_refs: sourceRefs.length ? sourceRefs : fallback.source_refs,
    score: fallback.score,
  };
}

function aiResultIsUsable(aiResult) {
  if (!aiResult || aiResult.ok === false || aiResult.fallback_used === true || aiResult.ai_enrichment_failed === true) return false;
  const structured = aiResult.structured_result && typeof aiResult.structured_result === 'object' ? aiResult.structured_result : {};
  return Array.isArray(structured.recommendations) && structured.recommendations.length > 0;
}

function normalizeAiOutput(aiResult, deterministic, sourceMap) {
  const structured = aiResult.structured_result || {};
  const fallbackByName = new Map(deterministic.recommendations.map((item) => [normalizeText(item.name), item]));
  const recommendations = asArray(structured.recommendations).slice(0, deterministic.recommendations.length || 12).map((item, index) => {
    const fallback = fallbackByName.get(normalizeText(item?.name)) || deterministic.recommendations[index] || deterministic.recommendations[0];
    return normalizeAiRecommendation(item, fallback, sourceMap);
  });
  return {
    recommendations: recommendations.length ? recommendations : deterministic.recommendations,
    not_recommended_or_low_priority: deterministic.not_recommended_or_low_priority,
    warnings: asArray(structured.warnings).map((item) => redactText(item, 260)).slice(0, 8),
    limitations: asArray(structured.limitations).map((item) => redactText(item, 260)).slice(0, 8),
  };
}

async function buildContext({ user, tenantId, standard, processId, includeSources, warnings }) {
  const tenant = await getTenant(tenantId);
  const scoped = scopedUser(user, tenantId);
  const [processes, operations, assets, risks, incidents, diagnostic, health] = await Promise.all([
    loadProcesses({ tenantId, processId }),
    loadOperations({ tenantId, processId }),
    loadAssets({ tenantId, standardCode: standard.code }),
    loadRiskRows({ tenantId, standardCode: standard.code }),
    loadIncidents({ tenantId }),
    buildDiagnosticContext({ user: scoped, standard, processId, warnings }),
    buildHealthContext({ user: scoped, standard, processId, warnings }),
  ]);
  const areas = buildAreaCandidates(processes, operations);
  const reportSourceRows = includeSources
    ? await reportSources.buildSources({
      tenantId,
      diagnostics: [diagnostic],
      filters: { standard_code: standard.code, process_id: processId || null },
      includeExcludedDocuments: false,
    })
    : [];

  return {
    tenant,
    standard,
    processes,
    operations,
    areas,
    assets,
    risks,
    incidents,
    diagnostic,
    health,
    reportSources: reportSourceRows,
  };
}

async function buildRecommendations({ user, payload = {}, requestedTenantId = null } = {}) {
  if (payload?.tenant_id || payload?.tenantId || payload?.company_id || payload?.companyId) {
    throw publicError(400, 'ISO_SCOPE_BODY_TENANT_NOT_ALLOWED', 'tenant_id no debe enviarse en el body; se resuelve desde el token.');
  }

  const access = assertAccess({ user, requestedTenantId });
  const warnings = [];
  const mode = asString(payload.mode || 'scope_recommendation');
  if (mode && mode !== 'scope_recommendation') {
    warnings.push('mode distinto de scope_recommendation; se generó recomendación de alcance estándar.');
  }

  const standard = await resolveStandard({
    tenantId: access.tenantId,
    standardCode: payload.standard_code,
    standardId: payload.standard_id,
    warnings,
  });
  const processFilter = await validateProcessFilter({ tenantId: access.tenantId, processId: payload.process_id || null });
  if (access.areaRole && !processFilter) {
    warnings.push('Alcance granular por responsable de área depende de asignaciones existentes; revisar visibilidad antes de usar como decisión formal.');
  }
  if (access.executive) {
    warnings.push('Rol ejecutivo: salida orientativa y no apta para aprobar alcance sin revisión de cumplimiento/auditoría.');
  }

  const includeSources = payload.include_sources !== false;
  const includeAi = boolOption(payload.include_ai, false);
  const context = await buildContext({
    user,
    tenantId: access.tenantId,
    standard,
    processId: processFilter?.id || null,
    includeSources,
    warnings,
  });
  if (!context.processes.length && !context.operations.length && !context.areas.length) {
    warnings.push('No se encontraron procesos, operaciones o áreas activas suficientes para recomendar alcance con alta confianza.');
  }
  if (includeSources && !context.reportSources.length && !context.processes.length && !context.operations.length) {
    warnings.push('No hay fuentes suficientes; las recomendaciones se basan en reglas determinísticas y contexto mínimo.');
  }

  const { sources, sourceMap, sourceRefsByKey } = buildSources({ context, includeSources });
  const deterministic = buildDeterministicRecommendations({ standard, context, sourceRefsByKey });
  let finalOutput = {
    recommendations: deterministic.recommendations,
    not_recommended_or_low_priority: deterministic.not_recommended_or_low_priority,
    warnings: [],
    limitations: [],
  };
  let aiUsed = false;
  let fallbackUsed = false;

  if (includeAi) {
    try {
      const aiResult = await aiEngineClient.analyzeReport(buildSafeAiPayload({
        standard,
        context,
        deterministic,
        sourceMap,
        requestId: crypto.randomUUID(),
      }), {
        timeoutMs: Number.parseInt(process.env.AI_SCOPE_RECOMMENDATION_TIMEOUT_MS || process.env.AI_REPORT_ENRICHMENT_TIMEOUT_MS || '45000', 10),
      });
      if (aiResultIsUsable(aiResult)) {
        finalOutput = normalizeAiOutput(aiResult, deterministic, sourceMap);
        aiUsed = true;
      } else {
        fallbackUsed = true;
        warnings.push('IA no disponible o sin salida utilizable; se usó recomendación determinística.');
      }
    } catch {
      fallbackUsed = true;
      warnings.push('IA no disponible; se usó recomendación determinística.');
    }
  }

  return {
    standard: {
      code: standard.code,
      name: standard.name,
      focus: standard.focus,
    },
    status: 'scope_recommendation_preview',
    requires_human_review: true,
    decision_ready: false,
    generated_at: new Date().toISOString(),
    generated_by: access.userId,
    tenant: {
      id: context.tenant.id,
      name: context.tenant.name,
    },
    filters: {
      standard_id: standard.id || null,
      standard_code: standard.code,
      process_id: processFilter?.id || null,
      include_ai: includeAi,
      include_sources: includeSources,
      mode: 'scope_recommendation',
    },
    guidance: CERTIFICATION_SCOPE_NOTE,
    recommendations: finalOutput.recommendations.map((item) => {
      const { score, ...publicItem } = item;
      return publicItem;
    }),
    not_recommended_or_low_priority: finalOutput.not_recommended_or_low_priority,
    sources,
    source_map: sourceMap,
    warnings: Array.from(new Set([...warnings, ...finalOutput.warnings])).slice(0, 20),
    limitations: Array.from(new Set(finalOutput.limitations)).slice(0, 10),
    fallback_used: fallbackUsed,
    ai_used: aiUsed,
    disclaimer: DISCLAIMER,
  };
}

module.exports = {
  DISCLAIMER,
  CERTIFICATION_SCOPE_NOTE,
  normalizeStandardCode,
  buildRecommendations,
};
