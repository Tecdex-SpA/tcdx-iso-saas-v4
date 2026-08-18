'use strict';

const crypto = require('crypto');
const semanticLayer = require('../semantic/semanticLayer.service');

const OBSERVATION_MODEL_VERSION = 'grc-canonical-observation-facade-v1';

const OBSERVATION_TYPES = new Set([
  'observation',
  'finding',
  'nonconformity',
  'deviation',
  'control_weakness',
  'gap',
  'exception',
  'improvement_opportunity',
  'evidence_issue',
  'compliance_issue',
  'risk_condition',
  'general',
  'custom',
]);

const OBSERVATION_DOMAINS = new Set([
  'audit',
  'risk',
  'control',
  'compliance',
  'evidence',
  'incident',
  'readiness',
  'assessment',
  'action',
  'data_quality',
  'general',
]);

const OBSERVATION_STATUSES = new Set([
  'open',
  'under_review',
  'accepted',
  'in_treatment',
  'resolved',
  'closed',
  'cancelled',
]);

const OBSERVATION_SEVERITIES = new Set([
  'informational',
  'low',
  'medium',
  'high',
  'critical',
]);

const SOURCE_TYPES = new Set([
  'manual',
  'finding',
  'action',
  'audit',
  'control',
  'risk',
  'evidence',
  'document',
  'incident',
  'readiness_snapshot',
  'readiness_finding',
  'nonconformity',
  'metric_measurement',
  'assessment',
]);

const API_RELATION_TYPES = new Set([
  'relates_to',
  'evidence_for',
  'impacts',
  'caused_by',
  'mitigated_by',
  'duplicates',
  'remediated_by',
  'blocks',
]);

const RELATION_TO_CANONICAL = Object.freeze({
  relates_to: 'related_to',
  evidence_for: 'evidences',
  impacts: 'affects',
  caused_by: 'derived_from',
  mitigated_by: 'related_to',
  duplicates: 'related_to',
  remediated_by: 'related_to',
  blocks: 'related_to',
});

const UUID_RE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const STATUS_TRANSITIONS = Object.freeze({
  open: new Set(['under_review', 'accepted', 'in_treatment', 'cancelled']),
  under_review: new Set(['open', 'accepted', 'cancelled']),
  accepted: new Set(['in_treatment', 'resolved', 'cancelled']),
  in_treatment: new Set(['resolved', 'cancelled']),
  resolved: new Set(['closed', 'in_treatment']),
  closed: new Set(['under_review']),
  cancelled: new Set(['under_review']),
});

const SOURCE_ADAPTERS = Object.freeze({
  finding: [{
    table: 'findings',
    query: `SELECT id, tenant_id, COALESCE(title, finding_type, 'Finding') AS label FROM findings WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  action: [{
    table: 'action_plans',
    query: `SELECT id, tenant_id, COALESCE(title, description, 'Action plan') AS label FROM action_plans WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  audit: [{
    table: 'audits',
    query: `SELECT id, tenant_id, COALESCE(iso, status, 'Audit') AS label FROM audits WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  control: [{
    table: 'tenant_controls',
    query: `SELECT tc.id, tc.tenant_id, COALESCE(cc.description, 'Control') AS label FROM tenant_controls tc LEFT JOIN controls_catalog cc ON cc.id = tc.control_id WHERE tc.tenant_id = $1::uuid AND tc.id = $2::uuid LIMIT 1`,
  }],
  risk: [{
    table: 'iso_risk_matrix_items',
    query: `SELECT id, tenant_id, COALESCE(risk_title, risk_code, risk_description, 'Risk') AS label FROM iso_risk_matrix_items WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }, {
    table: 'asset_risks',
    query: `SELECT ar.id, a.tenant_id, COALESCE(ar.risk::text, ar.impact::text, ar.level::text, 'Asset risk') AS label FROM asset_risks ar JOIN assets a ON a.id = ar.asset_id WHERE a.tenant_id = $1::uuid AND ar.id = $2::uuid LIMIT 1`,
  }],
  evidence: [{
    table: 'evidences',
    query: `SELECT id, tenant_id, COALESCE(file_name, description, evidence_type, 'Evidence') AS label FROM evidences WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  document: [{
    table: 'document_index',
    query: `SELECT id, tenant_id, COALESCE(file_name, relative_path, provider_file_id, 'Document') AS label FROM document_index WHERE tenant_id = $1::uuid AND id = $2::uuid AND COALESCE(status, 'indexed') NOT IN ('deleted', 'error', 'ignored', 'missing') LIMIT 1`,
  }],
  incident: [{
    table: 'grc_incidents',
    query: `SELECT id, tenant_id, COALESCE(title, incident_number, 'Incident') AS label FROM grc_incidents WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  readiness_snapshot: [{
    table: 'grc_readiness_snapshots',
    query: `SELECT id, tenant_id, COALESCE(formula_version, input_hash, 'Readiness snapshot') AS label FROM grc_readiness_snapshots WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  readiness_finding: [{
    table: 'grc_readiness_findings',
    query: `SELECT id, tenant_id, COALESCE(finding_code, severity, 'Readiness finding') AS label FROM grc_readiness_findings WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  nonconformity: [{
    table: 'tenant_nonconformities',
    query: `SELECT id, tenant_id, COALESCE(control_description, status, 'Nonconformity') AS label FROM tenant_nonconformities WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  metric_measurement: [{
    table: 'metric_measurements',
    query: `SELECT id, tenant_id, COALESCE(period_key, unit, 'Metric measurement') AS label FROM metric_measurements WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
  assessment: [{
    table: 'survey_evaluations',
    query: `SELECT id, tenant_id, COALESCE(evaluation_status, 'Assessment') AS label FROM survey_evaluations WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
  }],
});

function publicError(GrcError, status, code, message, details = null) {
  return new GrcError(code, message, status, details);
}

function asText(value, max = 255) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function asObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return value;
}

function parseTimestamp(value, field, GrcError) {
  const text = asText(value, 80);
  if (!text) throw publicError(GrcError, 400, 'OBSERVATION_TIME_REQUIRED', `${field} es obligatorio.`);
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) throw publicError(GrcError, 400, 'OBSERVATION_TIME_INVALID', `${field} inválido.`);
  return date.toISOString();
}

function parseOptionalTimestamp(value, field, GrcError) {
  if (!value) return null;
  return parseTimestamp(value, field, GrcError);
}

function optionalUuid(value, field, GrcError) {
  const text = asText(value, 80);
  if (!text) return null;
  if (!UUID_RE.test(text)) throw publicError(GrcError, 400, 'OBSERVATION_UUID_INVALID', `${field} inválido.`);
  return text;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function semanticScope(tenantId, userId) {
  return { tenant_id: tenantId, user: { id: userId, tenant_id: tenantId } };
}

function normalizePayload(payload = {}, tenantId, userId, GrcError) {
  const observationType = asText(payload.observation_type, 80) || 'observation';
  const domain = asText(payload.domain, 80) || 'general';
  const status = asText(payload.status_value ?? payload.status, 80) || 'open';
  const severity = asText(payload.severity_value ?? payload.severity, 80);
  const sourceType = asText(payload.source_type, 80) || 'manual';
  const title = asText(payload.title ?? payload.text_value, 300);
  const description = asText(payload.description, 4000);
  const metadata = asObject(payload.metadata, {});

  if (!OBSERVATION_TYPES.has(observationType)) throw publicError(GrcError, 400, 'OBSERVATION_TYPE_INVALID', 'observation_type inválido.');
  if (observationType === 'custom' && !asText(metadata.custom_type, 120)) throw publicError(GrcError, 400, 'OBSERVATION_CUSTOM_TYPE_REQUIRED', 'metadata.custom_type es obligatorio para observation_type=custom.');
  if (!OBSERVATION_DOMAINS.has(domain)) throw publicError(GrcError, 400, 'OBSERVATION_DOMAIN_INVALID', 'domain inválido.');
  if (!OBSERVATION_STATUSES.has(status)) throw publicError(GrcError, 400, 'OBSERVATION_STATUS_INVALID', 'status inválido.');
  if (!severity || !OBSERVATION_SEVERITIES.has(severity)) throw publicError(GrcError, 400, 'OBSERVATION_SEVERITY_INVALID', 'severity inválida.');
  if (!SOURCE_TYPES.has(sourceType)) throw publicError(GrcError, 400, 'OBSERVATION_SOURCE_TYPE_INVALID', 'source_type inválido.');
  if (!title) throw publicError(GrcError, 400, 'OBSERVATION_TITLE_REQUIRED', 'title es obligatorio.');

  const sourceId = asText(payload.source_id, 80);
  if (sourceType === 'manual' && sourceId) throw publicError(GrcError, 400, 'OBSERVATION_MANUAL_SOURCE_ID_FORBIDDEN', 'manual no acepta source_id.');
  if (sourceType !== 'manual' && !sourceId) throw publicError(GrcError, 400, 'OBSERVATION_SOURCE_ID_REQUIRED', 'source_id es obligatorio para fuentes no manuales.');

  const observedAt = parseTimestamp(payload.observed_at, 'observed_at', GrcError);
  const periodStart = parseOptionalTimestamp(payload.period_start ?? payload.effective_from, 'period_start', GrcError);
  const periodEnd = parseOptionalTimestamp(payload.period_end ?? payload.effective_to, 'period_end', GrcError);
  if (periodStart && periodEnd && new Date(periodStart).getTime() > new Date(periodEnd).getTime()) {
    throw publicError(GrcError, 400, 'OBSERVATION_EFFECTIVE_INTERVAL_INVALID', 'period_start debe ser menor o igual a period_end.');
  }

  return {
    tenant_id: tenantId,
    observation_type: observationType,
    domain,
    entity_type: asText(payload.entity_type, 120) || domain,
    entity_id: optionalUuid(payload.entity_id, 'entity_id', GrcError),
    title,
    description,
    status,
    severity,
    source_type: sourceType,
    source_id: sourceId || null,
    source_reference: asObject(payload.source_reference, {}),
    observed_at: observedAt,
    period_start: periodStart,
    period_end: periodEnd,
    owner_user_id: optionalUuid(payload.owner_user_id, 'owner_user_id', GrcError),
    created_by: userId || null,
    metadata,
    correlation_id: asText(payload.correlation_id, 160),
    idempotency_id: asText(payload.idempotency_id || payload.idempotency_key, 240),
  };
}

function projectObservation(row = {}) {
  const grc = row.metadata?.grc_facade || {};
  return {
    ...row,
    status: row.status_value || grc.status || null,
    severity: row.severity_value || grc.severity || null,
    domain: grc.domain || row.entity_type || 'general',
    title: grc.title || row.text_value || null,
    description: grc.description || null,
    source_type: grc.source_type || null,
    source_id: grc.source_id || null,
    source_reference: grc.source_reference || {},
    effective_from: row.period_start || null,
    effective_to: row.period_end || null,
    model_version: OBSERVATION_MODEL_VERSION,
  };
}

function createGrcObservationService(pool, { GrcError, assertUuid, observe, audit, json, semantic = semanticLayer }) {
  const tableCache = new Map();

  async function tableExists(tableName) {
    if (tableCache.has(tableName)) return tableCache.get(tableName);
    const result = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    const exists = result.rowCount > 0;
    tableCache.set(tableName, exists);
    return exists;
  }

  async function validateSource(tenantId, sourceType, sourceId) {
    if (sourceType === 'manual') {
      return { source_type: 'manual', source_id: null, source_table: 'data_snapshots', source_label: 'Manual observation' };
    }
    assertUuid(sourceId, 'OBSERVATION_SOURCE_ID_INVALID');
    const adapters = SOURCE_ADAPTERS[sourceType] || [];
    let available = false;
    for (const adapter of adapters) {
      if (!(await tableExists(adapter.table))) continue;
      available = true;
      const result = await pool.query(adapter.query, [tenantId, sourceId]);
      if (result.rowCount > 0) {
        return { source_type: sourceType, source_id: sourceId, source_table: adapter.table, source_label: result.rows[0].label || null };
      }
    }
    if (!available) throw publicError(GrcError, 400, 'OBSERVATION_SOURCE_UNAVAILABLE', 'La fuente indicada no está disponible en el schema actual.');
    throw publicError(GrcError, 404, 'OBSERVATION_SOURCE_NOT_FOUND', 'Fuente no encontrada para el tenant autenticado.');
  }

  async function listObservations({ tenantId, filters = {} }) {
    const rows = await semantic.listObservations(semanticScope(tenantId), {
      observation_type: filters.observation_type,
      current: filters.current,
      limit: filters.limit,
    });
    const data = rows.map(projectObservation).filter((row) => {
      if (filters.status && row.status !== asText(filters.status, 80)) return false;
      if (filters.domain && row.domain !== asText(filters.domain, 80)) return false;
      if (filters.source_type && row.source_type !== asText(filters.source_type, 80)) return false;
      return true;
    });
    return { data, model_version: OBSERVATION_MODEL_VERSION };
  }

  async function getObservation(tenantId, observationId) {
    try {
      return projectObservation(await semantic.getObservation(semanticScope(tenantId), observationId));
    } catch (error) {
      if (error?.code === 'SEMANTIC_OBSERVATION_NOT_FOUND') {
        throw publicError(GrcError, 404, 'OBSERVATION_NOT_FOUND', 'Observation no encontrada para el tenant autenticado.');
      }
      throw error;
    }
  }

  async function createObservation({ tenantId, userId, body, correlationId }) {
    const normalized = normalizePayload({ ...body, correlation_id: body?.correlation_id || correlationId }, tenantId, userId, GrcError);
    const source = await validateSource(tenantId, normalized.source_type, normalized.source_id);
    const sourceIdentity = normalized.idempotency_id || {
      source_type: normalized.source_type,
      source_id: normalized.source_id,
      observation_type: normalized.observation_type,
      domain: normalized.domain,
      title: normalized.title,
      observed_at: normalized.observed_at,
    };
    const row = await semantic.createManualObservation(semanticScope(tenantId, userId), {
      observation_type: normalized.observation_type,
      entity_type: normalized.entity_type,
      entity_id: normalized.entity_id || normalized.source_id,
      status_value: normalized.status,
      severity_value: normalized.severity,
      text_value: normalized.title,
      observed_at: normalized.observed_at,
      period_start: normalized.period_start,
      period_end: normalized.period_end,
      owner_user_id: normalized.owner_user_id,
      correlation_id: normalized.correlation_id,
      source_table: source.source_table,
      source_record_id: normalized.source_id,
      source_identity: sourceIdentity,
      metadata: {
        ...normalized.metadata,
        grc_facade: {
          domain: normalized.domain,
          title: normalized.title,
          description: normalized.description,
          status: normalized.status,
          severity: normalized.severity,
          source_type: normalized.source_type,
          source_id: normalized.source_id,
          source_reference: { ...normalized.source_reference, ...source },
          model_version: OBSERVATION_MODEL_VERSION,
          source_identity_fingerprint: sha256(sourceIdentity),
        },
      },
    }, correlationId);
    const projected = projectObservation(row);
    observe('observation_created', { tenantId, correlationId, entityType: projected.domain, entityId: projected.id });
    return projected;
  }

  async function updateObservation({ tenantId, userId, observationId, body, correlationId }) {
    const current = await getObservation(tenantId, observationId);
    const severity = body.severity === undefined && body.severity_value === undefined ? current.severity : asText(body.severity_value ?? body.severity, 80);
    if (!OBSERVATION_SEVERITIES.has(severity)) throw publicError(GrcError, 400, 'OBSERVATION_SEVERITY_INVALID', 'severity inválida.');
    const nextTitle = body.title === undefined && body.text_value === undefined ? current.title : asText(body.text_value ?? body.title, 300);
    const nextDescription = body.description === undefined ? current.description : asText(body.description, 4000);
    const row = await semantic.supersedeObservation(semanticScope(tenantId, userId), observationId, {
      severity_value: severity,
      text_value: nextTitle,
      owner_user_id: body.owner_user_id === undefined ? current.owner_user_id : optionalUuid(body.owner_user_id, 'owner_user_id', GrcError),
      correlation_id: correlationId,
      metadata: {
        grc_facade: {
          ...(current.metadata?.grc_facade || {}),
          title: nextTitle,
          description: nextDescription,
          severity,
          model_version: OBSERVATION_MODEL_VERSION,
        },
      },
    }, correlationId);
    await audit(pool, {
      tenantId,
      userId,
      action: 'grc.observation.superseded',
      tableName: 'grc_observations',
      recordId: row.id,
      oldData: { id: current.id },
      newData: { id: row.id },
      metadata: { correlation_id: correlationId },
    });
    return projectObservation(row);
  }

  async function transitionObservation({ tenantId, userId, observationId, body, correlationId }) {
    const current = await getObservation(tenantId, observationId);
    const nextStatus = asText(body.status_value ?? body.status, 80);
    if (!OBSERVATION_STATUSES.has(nextStatus)) throw publicError(GrcError, 400, 'OBSERVATION_STATUS_INVALID', 'status inválido.');
    if (nextStatus !== current.status && !STATUS_TRANSITIONS[current.status]?.has(nextStatus)) {
      throw publicError(GrcError, 409, 'OBSERVATION_TRANSITION_INVALID', 'Transición de estado no permitida.');
    }
    const row = await semantic.supersedeObservation(semanticScope(tenantId, userId), observationId, {
      status_value: nextStatus,
      correlation_id: correlationId,
      metadata: {
        grc_facade: {
          ...(current.metadata?.grc_facade || {}),
          status: nextStatus,
          last_transition: {
            from: current.status,
            to: nextStatus,
            reason: asText(body.reason, 1000),
            at: new Date().toISOString(),
          },
          model_version: OBSERVATION_MODEL_VERSION,
        },
      },
    }, correlationId);
    const projected = projectObservation(row);
    observe('observation_transitioned', { tenantId, correlationId, entityType: projected.domain, entityId: projected.id });
    return projected;
  }

  async function linkObservation({ tenantId, userId, observationId, body, correlationId }) {
    await getObservation(tenantId, observationId);
    const targetType = asText(body.target_type ?? body.related_entity_type, 80);
    const targetId = asText(body.target_id ?? body.related_entity_id, 80);
    const requestedRelation = asText(body.relation_type, 80) || 'relates_to';
    if (!SOURCE_TYPES.has(targetType) || targetType === 'manual') throw publicError(GrcError, 400, 'OBSERVATION_LINK_TARGET_TYPE_INVALID', 'target_type inválido.');
    if (!API_RELATION_TYPES.has(requestedRelation)) throw publicError(GrcError, 400, 'OBSERVATION_LINK_RELATION_INVALID', 'relation_type inválido.');
    const target = await validateSource(tenantId, targetType, targetId);
    const relation = await semantic.createObservationRelation(semanticScope(tenantId, userId), observationId, {
      related_entity_type: targetType,
      related_entity_id: targetId,
      relation_type: RELATION_TO_CANONICAL[requestedRelation],
      confidence: Number(body.confidence ?? 1),
      metadata: {
        ...asObject(body.metadata, {}),
        requested_relation_type: requestedRelation,
        target,
        api_name: 'links',
      },
    }, correlationId);
    await audit(pool, {
      tenantId,
      userId,
      action: 'grc.observation.relation_created',
      tableName: 'grc_observation_relations',
      recordId: relation.id,
      newData: relation,
      metadata: { correlation_id: correlationId, observation_id: observationId },
    });
    return {
      ...relation,
      target_type: relation.related_entity_type,
      target_id: relation.related_entity_id,
      requested_relation_type: requestedRelation,
    };
  }

  return {
    createObservation,
    getObservation,
    listObservations,
    linkObservation,
    transitionObservation,
    updateObservation,
    validateSource,
  };
}

module.exports = {
  OBSERVATION_DOMAINS,
  OBSERVATION_MODEL_VERSION,
  OBSERVATION_SEVERITIES,
  OBSERVATION_STATUSES,
  OBSERVATION_TYPES,
  SOURCE_TYPES,
  createGrcObservationService,
};
