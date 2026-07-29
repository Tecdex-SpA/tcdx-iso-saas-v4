'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PDFDocument = require('pdfkit');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const pool = require('../../config/db');
const asyncJobs = require('../asyncJob.service');
const { evaluate, validateExpression, FormulaError } = require('./formulaEngine');
const { calculateTrustScore, assessFreshness, TrustScoreError } = require('./dataTrustScore');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Phase5Error extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'Phase5Error';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function sanitizeError(error) {
  return String(error?.message || 'phase5 error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

function assertUuid(value, label = 'id') {
  const id = String(value || '').trim();
  if (!UUID_RE.test(id)) throw new Phase5Error('PHASE5_INVALID_UUID', `${label} debe ser UUID valido.`, 422);
  return id;
}

function text(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function json(value, fallback = {}) {
  if (value === undefined || value === null) return JSON.stringify(fallback);
  return JSON.stringify(value);
}

function userId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function tenantIdFrom(reqOrScope) {
  const tenantId = reqOrScope?.tenant_id || reqOrScope?.tenantId || reqOrScope?.tenant || null;
  if (!tenantId) throw new Phase5Error('PHASE5_TENANT_REQUIRED', 'Tenant requerido para operar Fase 5.', 403);
  return assertUuid(tenantId, 'tenant_id');
}

function isPlatform(user) {
  return ['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(String(user?.role || user?.user_role || '').toLowerCase());
}

function periodKeyFromDates(start, end) {
  return `${String(start).slice(0, 10)}_${String(end).slice(0, 10)}`;
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function normalizeLimit(value, fallback = 100) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 250)) : fallback;
}

async function queryRows(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function assertTenantRecord(table, tenantId, id, columns = '*') {
  const rows = await queryRows(`SELECT ${columns} FROM ${table} WHERE tenant_id=$1::uuid AND id=$2::uuid LIMIT 1`, [tenantId, assertUuid(id)]);
  if (!rows[0]) throw new Phase5Error('PHASE5_NOT_FOUND', 'Registro no encontrado.', 404);
  return rows[0];
}

async function auditEvent(client, { tenantId, userId: actor, action, entityType, entityId, requestId, result = 'success', metadata = {} }) {
  const payload = {
    phase: 'phase5',
    action,
    entity_type: entityType,
    entity_id: entityId,
    result,
    request_id: requestId || null,
    metadata,
  };
  if (await tableExists(client, 'commercial_events')) {
    await client.query(
      `INSERT INTO commercial_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, after_state, reason, request_id)
       VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb,$7,$8)`,
      [tenantId, actor, action, entityType, entityId || null, json(payload), 'phase5_audit', requestId || null]
    ).catch(() => null);
  }
}

async function tableExists(client, tableName) {
  const result = await client.query(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.regclass);
}

async function listDataDomains(scope, filters = {}) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(
    `SELECT * FROM data_domains
     WHERE (tenant_id=$1::uuid OR tenant_id IS NULL)
       AND ($2::text IS NULL OR status=$2)
     ORDER BY tenant_id NULLS FIRST, display_name
     LIMIT $3`,
    [tenantId, text(filters.status), normalizeLimit(filters.limit)]
  );
}

async function createDataDomain(scope, body = {}, requestId = null) {
  const tenantId = body.global === true && isPlatform(scope.user) ? null : tenantIdFrom(scope);
  const actor = userId(scope.user);
  const result = await pool.query(
    `INSERT INTO data_domains (tenant_id, domain_key, display_name, description, owner_user_id, status, created_by, metadata)
     VALUES ($1::uuid,$2,$3,$4,$5::uuid,$6,$7::uuid,$8::jsonb)
     ON CONFLICT (tenant_id, domain_key) DO UPDATE
     SET display_name=EXCLUDED.display_name, description=EXCLUDED.description, owner_user_id=EXCLUDED.owner_user_id,
         status=EXCLUDED.status, updated_at=now(), metadata=data_domains.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, text(body.domain_key || body.key), text(body.display_name || body.name), text(body.description), body.owner_user_id || null, text(body.status, 'active'), actor, json(body.metadata)]
  );
  await auditEvent(pool, { tenantId: tenantId || tenantIdFrom(scope), userId: actor, action: 'data.domain.upserted', entityType: 'data_domain', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function listDataElements(scope, filters = {}) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(
    `SELECT e.*, d.display_name AS domain_name
     FROM data_elements e
     LEFT JOIN data_domains d ON d.id=e.domain_id
     WHERE e.tenant_id=$1::uuid
       AND ($2::text IS NULL OR e.status=$2)
       AND ($3::text IS NULL OR e.element_key ILIKE '%' || $3 || '%' OR e.display_name ILIKE '%' || $3 || '%')
     ORDER BY e.updated_at DESC
     LIMIT $4`,
    [tenantId, text(filters.status), text(filters.search), normalizeLimit(filters.limit)]
  );
}

async function getDataElement(scope, id) {
  return assertTenantRecord('data_elements', tenantIdFrom(scope), id, '*');
}

async function createDataElement(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const actor = userId(scope.user);
  const result = await pool.query(
    `INSERT INTO data_elements (
       tenant_id, domain_id, element_key, display_name, business_definition, technical_definition,
       data_type, classification, source_type, source_reference, owner_user_id, steward_user_id,
       status, valid_from, valid_until, created_by, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12::uuid,$13,COALESCE($14::timestamptz,now()),$15::timestamptz,$16::uuid,$17::jsonb)
     ON CONFLICT (tenant_id, element_key) DO UPDATE
     SET display_name=EXCLUDED.display_name, business_definition=EXCLUDED.business_definition,
         technical_definition=EXCLUDED.technical_definition, data_type=EXCLUDED.data_type,
         classification=EXCLUDED.classification, source_type=EXCLUDED.source_type,
         source_reference=EXCLUDED.source_reference, owner_user_id=EXCLUDED.owner_user_id,
         steward_user_id=EXCLUDED.steward_user_id, status=EXCLUDED.status, updated_at=now(),
         metadata=data_elements.metadata || EXCLUDED.metadata
     RETURNING *`,
    [
      tenantId, body.domain_id || null, text(body.element_key || body.key), text(body.display_name || body.name),
      text(body.business_definition), text(body.technical_definition), text(body.data_type, 'text'),
      text(body.classification, 'internal'), text(body.source_type, 'manual'), text(body.source_reference, 'manual'),
      body.owner_user_id || null, body.steward_user_id || null, text(body.status, 'active'),
      body.valid_from || null, body.valid_until || null, actor, json(body.metadata),
    ]
  );
  await auditEvent(pool, { tenantId, userId: actor, action: 'data.element.upserted', entityType: 'data_element', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function updateDataElement(scope, id, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('data_elements', tenantId, id, 'id');
  const result = await pool.query(
    `UPDATE data_elements
     SET display_name=COALESCE($3,display_name),
         business_definition=COALESCE($4,business_definition),
         technical_definition=COALESCE($5,technical_definition),
         classification=COALESCE($6,classification),
         source_reference=COALESCE($7,source_reference),
         status=COALESCE($8,status),
         updated_at=now(),
         metadata=metadata || $9::jsonb
     WHERE tenant_id=$1::uuid AND id=$2::uuid
     RETURNING *`,
    [tenantId, id, text(body.display_name), text(body.business_definition), text(body.technical_definition), text(body.classification), text(body.source_reference), text(body.status), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'data.element.updated', entityType: 'data_element', entityId: id, requestId });
  return result.rows[0];
}

async function listDataQuality(scope, filters = {}) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(
    `SELECT a.*, e.display_name AS data_element_name, r.display_name AS rule_name
     FROM data_quality_assessments a
     LEFT JOIN data_elements e ON e.id=a.data_element_id
     LEFT JOIN data_quality_rules r ON r.id=a.quality_rule_id
     WHERE a.tenant_id=$1::uuid
       AND ($2::text IS NULL OR a.assessment_status=$2)
     ORDER BY a.assessed_at DESC
     LIMIT $3`,
    [tenantId, text(filters.status), normalizeLimit(filters.limit)]
  );
}

async function assessDataQuality(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const actor = userId(scope.user);
  const result = await pool.query(
    `INSERT INTO data_quality_assessments (
       tenant_id, data_element_id, quality_rule_id, assessed_entity_type, assessed_entity_id,
       assessment_status, score, findings, assessed_by, correlation_id, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6,$7,$8::jsonb,$9::uuid,$10,$11::jsonb)
     RETURNING *`,
    [
      tenantId, body.data_element_id || null, body.quality_rule_id || null,
      text(body.assessed_entity_type, 'manual'), body.assessed_entity_id || null,
      text(body.assessment_status, 'unknown'), body.score ?? null, json(body.findings, []),
      actor, text(body.correlation_id, requestId), json(body.metadata),
    ]
  );
  await auditEvent(pool, { tenantId, userId: actor, action: 'data.quality.assessed', entityType: 'data_quality_assessment', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function graph(scope, entityType, entityId, direction = 'lineage') {
  const tenantId = tenantIdFrom(scope);
  const type = text(entityType);
  const id = assertUuid(entityId);
  const rows = await queryRows(
    `WITH RECURSIVE edges AS (
       SELECT 1 AS depth, e.*
       FROM data_lineage_edges e
       WHERE e.tenant_id=$1::uuid
         AND (($4::text='lineage' AND e.from_type=$2 AND e.from_id=$3::uuid)
           OR ($4::text='impact' AND e.to_type=$2 AND e.to_id=$3::uuid))
       UNION ALL
       SELECT edges.depth + 1, e.*
       FROM data_lineage_edges e
       JOIN edges ON edges.tenant_id=e.tenant_id
        AND (($4::text='lineage' AND e.from_type=edges.to_type AND e.from_id=edges.to_id)
          OR ($4::text='impact' AND e.to_type=edges.from_type AND e.to_id=edges.from_id))
       WHERE edges.depth < 5
     )
     SELECT DISTINCT ON (from_type, from_id, to_type, to_id, relation_type)
       depth, from_type, from_id, to_type, to_id, relation_type, transformation, created_at, correlation_id, metadata
     FROM edges
     ORDER BY from_type, from_id, to_type, to_id, relation_type, depth`,
    [tenantId, type, id, direction]
  );
  return { root: { entity_type: type, entity_id: id }, max_depth: 5, edges: rows };
}

async function listMetrics(scope, filters = {}) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(
    `SELECT m.*,
       (SELECT row_to_json(f) FROM metric_formula_versions f WHERE f.metric_definition_id=m.id ORDER BY f.version_number DESC LIMIT 1) AS latest_formula,
       (SELECT row_to_json(mm) FROM metric_measurements mm WHERE mm.tenant_id=$1::uuid AND mm.metric_definition_id=m.id ORDER BY mm.period_end DESC, mm.created_at DESC LIMIT 1) AS latest_measurement
     FROM metric_definitions m
     WHERE (m.tenant_id=$1::uuid OR m.tenant_id IS NULL)
       AND ($2::text IS NULL OR m.metric_type=$2)
       AND ($3::text IS NULL OR m.status=$3)
       AND ($4::text IS NULL OR m.metric_code ILIKE '%' || $4 || '%' OR m.display_name ILIKE '%' || $4 || '%')
     ORDER BY m.tenant_id NULLS FIRST, m.metric_code
     LIMIT $5`,
    [tenantId, text(filters.metric_type), text(filters.status), text(filters.search), normalizeLimit(filters.limit, 150)]
  );
}

async function getMetric(scope, id) {
  const tenantId = tenantIdFrom(scope);
  const rows = await queryRows(
    `SELECT m.*,
       COALESCE(jsonb_agg(DISTINCT f.*) FILTER (WHERE f.id IS NOT NULL), '[]'::jsonb) AS formulas,
       COALESCE(jsonb_agg(DISTINCT s.*) FILTER (WHERE s.id IS NOT NULL), '[]'::jsonb) AS sources,
       COALESCE(jsonb_agg(DISTINCT t.*) FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS thresholds
     FROM metric_definitions m
     LEFT JOIN metric_formula_versions f ON f.metric_definition_id=m.id
     LEFT JOIN metric_sources s ON s.metric_definition_id=m.id
     LEFT JOIN metric_thresholds t ON t.metric_definition_id=m.id
     WHERE (m.tenant_id=$1::uuid OR m.tenant_id IS NULL) AND m.id=$2::uuid
     GROUP BY m.id
     LIMIT 1`,
    [tenantId, assertUuid(id)]
  );
  if (!rows[0]) throw new Phase5Error('PHASE5_METRIC_NOT_FOUND', 'Metrica no encontrada.', 404);
  return rows[0];
}

async function createMetric(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const actor = userId(scope.user);
  const required = ['metric_code', 'display_name', 'business_definition', 'technical_definition', 'metric_type', 'unit', 'direction', 'aggregation', 'frequency'];
  for (const key of required) if (!text(body[key])) throw new Phase5Error('PHASE5_METRIC_REQUIRED_FIELD', `Campo requerido: ${key}`, 422);
  const result = await pool.query(
    `INSERT INTO metric_definitions (
       tenant_id, metric_code, display_name, business_definition, technical_definition, metric_type,
       unit, direction, aggregation, frequency, owner_user_id, reviewer_user_id, status,
       valid_from, valid_until, created_by, metadata
     )
     VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12::uuid,$13,COALESCE($14::timestamptz,now()),$15::timestamptz,$16::uuid,$17::jsonb)
     ON CONFLICT (metric_code) DO UPDATE
     SET display_name=EXCLUDED.display_name, business_definition=EXCLUDED.business_definition,
         technical_definition=EXCLUDED.technical_definition, metric_type=EXCLUDED.metric_type, unit=EXCLUDED.unit,
         direction=EXCLUDED.direction, aggregation=EXCLUDED.aggregation, frequency=EXCLUDED.frequency,
         owner_user_id=EXCLUDED.owner_user_id, reviewer_user_id=EXCLUDED.reviewer_user_id,
         status=EXCLUDED.status, updated_at=now(), metadata=metric_definitions.metadata || EXCLUDED.metadata
     RETURNING *`,
    [
      tenantId, text(body.metric_code), text(body.display_name), text(body.business_definition), text(body.technical_definition),
      text(body.metric_type), text(body.unit), text(body.direction), text(body.aggregation), text(body.frequency),
      body.owner_user_id || null, body.reviewer_user_id || null, text(body.status, 'draft'),
      body.valid_from || null, body.valid_until || null, actor, json(body.metadata),
    ]
  );
  await auditEvent(pool, { tenantId, userId: actor, action: 'metric.definition.upserted', entityType: 'metric_definition', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function updateMetric(scope, id, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const metric = await getMetric(scope, id);
  if (metric.tenant_id === null && !isPlatform(scope.user)) throw new Phase5Error('PHASE5_GLOBAL_METRIC_READ_ONLY', 'Solo plataforma administra metricas globales.', 403);
  const result = await pool.query(
    `UPDATE metric_definitions
     SET display_name=COALESCE($3,display_name),
         business_definition=COALESCE($4,business_definition),
         technical_definition=COALESCE($5,technical_definition),
         owner_user_id=COALESCE($6::uuid,owner_user_id),
         reviewer_user_id=COALESCE($7::uuid,reviewer_user_id),
         status=COALESCE($8,status),
         updated_at=now(),
         metadata=metadata || $9::jsonb
     WHERE id=$2::uuid AND (tenant_id=$1::uuid OR (tenant_id IS NULL AND $10::boolean))
     RETURNING *`,
    [tenantId, id, text(body.display_name), text(body.business_definition), text(body.technical_definition), body.owner_user_id || null, body.reviewer_user_id || null, text(body.status), json(body.metadata), isPlatform(scope.user)]
  );
  if (!result.rows[0]) throw new Phase5Error('PHASE5_METRIC_NOT_FOUND', 'Metrica no encontrada.', 404);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'metric.definition.updated', entityType: 'metric_definition', entityId: id, requestId });
  return result.rows[0];
}

async function addFormula(scope, metricId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const metric = await getMetric(scope, metricId);
  validateExpression(body.expression);
  const versionRows = await queryRows('SELECT COALESCE(MAX(version_number),0)+1 AS next_version FROM metric_formula_versions WHERE metric_definition_id=$1::uuid', [metric.id]);
  const result = await pool.query(
    `INSERT INTO metric_formula_versions (
       metric_definition_id, version_number, expression, inputs, status, effective_from, created_by, metadata
     )
     VALUES ($1::uuid,$2,$3::jsonb,$4::jsonb,$5,$6::timestamptz,$7::uuid,$8::jsonb)
     RETURNING *`,
    [metric.id, Number(versionRows[0].next_version), json(body.expression), json(body.inputs, []), text(body.status, 'draft'), body.effective_from || null, userId(scope.user), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'metric.formula.created', entityType: 'metric_formula_version', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function publishMetric(scope, metricId, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const metric = await getMetric(scope, metricId);
  const formulas = await queryRows(
    `SELECT * FROM metric_formula_versions WHERE metric_definition_id=$1::uuid ORDER BY version_number DESC LIMIT 1`,
    [metric.id]
  );
  if (!formulas[0]) throw new Phase5Error('PHASE5_METRIC_FORMULA_REQUIRED', 'No se puede publicar una metrica sin formula.', 409);
  if (!metric.business_definition || !metric.technical_definition || !metric.owner_user_id && metric.tenant_id !== null) {
    throw new Phase5Error('PHASE5_METRIC_GOVERNANCE_INCOMPLETE', 'La metrica requiere definicion, propietario y formula antes de publicar.', 409);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE metric_formula_versions SET status='published', approved_by=$2::uuid, approved_at=now(), effective_from=COALESCE(effective_from,now()) WHERE id=$1::uuid`, [formulas[0].id, userId(scope.user)]);
    const result = await client.query(`UPDATE metric_definitions SET status='published', updated_at=now() WHERE id=$1::uuid RETURNING *`, [metric.id]);
    await auditEvent(client, { tenantId, userId: userId(scope.user), action: 'metric.definition.published', entityType: 'metric_definition', entityId: metric.id, requestId });
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

function trustInputForMeasurement({ qualityStatus, freshnessStatus, hasLineage = false, validationStatus = 'pending' }) {
  const valid = qualityStatus === 'valid';
  const rejected = qualityStatus === 'rejected' || validationStatus === 'rejected';
  const freshnessMap = {
    current: { score: 100, status: 'trusted', reason: 'Medicion vigente.' },
    aging: { score: 75, status: 'acceptable', reason: 'Medicion envejeciendo.' },
    stale: { score: 45, status: 'untrusted', reason: 'Medicion stale.' },
    expired: { score: 20, status: 'untrusted', reason: 'Medicion expirada.' },
    unavailable: { score: 0, status: 'untrusted', reason: 'Fuente no disponible.' },
    unknown: { score: 0, status: 'unknown', reason: 'Freshness no determinado.' },
  };
  return {
    completeness: { score: valid ? 100 : qualityStatus === 'estimated' ? 75 : 40, status: valid ? 'trusted' : 'attention', reason: 'Completitud determinada por estado de calidad.' },
    accuracy: { score: rejected ? 0 : valid ? 90 : 60, status: rejected ? 'untrusted' : 'acceptable', reason: 'Exactitud basada en validacion disponible.' },
    consistency: { score: rejected ? 0 : qualityStatus === 'inconsistent' ? 30 : 80, status: qualityStatus === 'inconsistent' ? 'untrusted' : 'acceptable', reason: 'Consistencia derivada del estado de calidad.' },
    freshness: freshnessMap[freshnessStatus] || freshnessMap.unknown,
    lineage: { score: hasLineage ? 100 : 70, status: hasLineage ? 'trusted' : 'acceptable', reason: hasLineage ? 'Lineage registrado.' : 'Lineage incompleto; no puede obtener score maximo.' },
    validation: { score: rejected ? 0 : validationStatus === 'approved' || validationStatus === 'valid' ? 100 : 60, status: rejected ? 'untrusted' : 'acceptable', reason: 'Estado de validacion de medicion.' },
    stability: { score: 80, status: 'acceptable', reason: 'Sin volatilidad historica suficiente; se usa baseline conservador.' },
    coverage: { score: valid ? 90 : 60, status: valid ? 'trusted' : 'attention', reason: 'Cobertura conservadora segun datos disponibles.' },
  };
}

async function recordMeasurement(scope, metricId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const metric = await getMetric(scope, metricId);
  const periodStart = text(body.period_start);
  const periodEnd = text(body.period_end);
  if (!periodStart || !periodEnd) throw new Phase5Error('PHASE5_PERIOD_REQUIRED', 'period_start y period_end son obligatorios.', 422);
  const periodKey = text(body.period_key, periodKeyFromDates(periodStart, periodEnd));
  const qualityStatus = text(body.quality_status, body.estimated === true ? 'estimated' : 'valid');
  const freshness = body.freshness_status || assessFreshness({ observedAt: body.source_timestamp || new Date(), frequency: metric.frequency }).status;
  const trust = calculateTrustScore(trustInputForMeasurement({ qualityStatus, freshnessStatus: freshness, validationStatus: body.validation_status || 'pending', hasLineage: Boolean(body.source_reference || body.evidence_id) }));
  const result = await pool.query(
    `INSERT INTO metric_measurements (
       tenant_id, metric_definition_id, formula_version_id, period_key, period_start, period_end,
       value_numeric, value_text, unit, source_timestamp, calculated_at, quality_status, freshness_status,
       trust_score, trust_status, validation_status, evidence_id, correlation_id, created_by, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::timestamptz,$6::timestamptz,$7,$8,$9,$10::timestamptz,$11::timestamptz,$12,$13,$14,$15,$16,$17::uuid,$18,$19::uuid,$20::jsonb)
     ON CONFLICT (tenant_id, metric_definition_id, period_key, COALESCE(correlation_id, 'manual')) DO UPDATE
     SET value_numeric=EXCLUDED.value_numeric, value_text=EXCLUDED.value_text, source_timestamp=EXCLUDED.source_timestamp,
         calculated_at=EXCLUDED.calculated_at, quality_status=EXCLUDED.quality_status, freshness_status=EXCLUDED.freshness_status,
         trust_score=EXCLUDED.trust_score, trust_status=EXCLUDED.trust_status, validation_status=EXCLUDED.validation_status,
         metadata=metric_measurements.metadata || EXCLUDED.metadata
     RETURNING *`,
    [
      tenantId, metric.id, body.formula_version_id || null, periodKey, periodStart, periodEnd,
      body.value_numeric ?? null, body.value_text ?? null, text(body.unit, metric.unit), body.source_timestamp || null,
      body.calculated_at || null, qualityStatus, freshness, trust.score, trust.status, text(body.validation_status, 'pending'),
      body.evidence_id || null, text(body.correlation_id, requestId || 'manual'), userId(scope.user), json({ ...(body.metadata || {}), trust_components: trust.components }),
    ]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'metric.measurement.recorded', entityType: 'metric_measurement', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function calculateMetric(scope, metricId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const metric = await getMetric(scope, metricId);
  const formula = (await queryRows(
    `SELECT * FROM metric_formula_versions WHERE metric_definition_id=$1::uuid AND status='published' ORDER BY version_number DESC LIMIT 1`,
    [metric.id]
  ))[0];
  if (!formula) throw new Phase5Error('PHASE5_FORMULA_NOT_PUBLISHED', 'La metrica no tiene formula publicada.', 409);
  let value = null;
  try {
    value = evaluate(formula.expression, { inputs: body.inputs || {} });
  } catch (error) {
    if (error instanceof FormulaError) throw error;
    throw new Phase5Error('PHASE5_FORMULA_FAILED', 'No fue posible calcular la formula.', 422);
  }
  const job = await asyncJobs.createJob({
    tenant_id: tenantId,
    user_id: userId(scope.user),
    job_type: body.recalculate ? 'metric.recalculate' : 'metric.calculate',
    source_module: 'phase5',
    payload: { metric_id: metric.id, period_start: body.period_start, period_end: body.period_end },
    request_id: requestId,
  }).catch(() => null);
  const measurement = await recordMeasurement(scope, metric.id, {
    ...body,
    value_numeric: typeof value === 'number' ? value : null,
    value_text: typeof value === 'number' ? null : value === null ? 'sin_medicion' : String(value),
    formula_version_id: formula.id,
    calculated_at: new Date().toISOString(),
    quality_status: value === null ? 'unknown' : 'valid',
    correlation_id: body.correlation_id || requestId,
    metadata: { ...(body.metadata || {}), formula_snapshot: formula.expression, job_id: job?.id || null },
  }, requestId);
  if (job) await asyncJobs.markCompleted(job.id, { result_json: { measurement_id: measurement.id } }).catch(() => null);
  return { measurement, formula_version: formula.version_number, job };
}

async function listMeasurements(scope, metricId, filters = {}) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(
    `SELECT * FROM metric_measurements
     WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid
     ORDER BY period_end DESC, created_at DESC
     LIMIT $3`,
    [tenantId, assertUuid(metricId), normalizeLimit(filters.limit)]
  );
}

async function validateMeasurement(scope, measurementId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const measurement = await assertTenantRecord('metric_measurements', tenantId, measurementId, '*');
  const status = text(body.validation_status, 'valid');
  const result = await pool.query(
    `INSERT INTO metric_validations (tenant_id, measurement_id, validation_status, comment, validated_by, metadata)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb)
     RETURNING *`,
    [tenantId, measurement.id, status, text(body.comment), userId(scope.user), json(body.metadata)]
  );
  await pool.query(`UPDATE metric_measurements SET validation_status=$3, metadata=metadata || $4::jsonb WHERE tenant_id=$1::uuid AND id=$2::uuid`, [tenantId, measurement.id, status, json({ last_validation_id: result.rows[0].id })]);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'metric.measurement.validated', entityType: 'metric_measurement', entityId: measurement.id, requestId });
  return result.rows[0];
}

async function metricTrend(scope, metricId) {
  const rows = await listMeasurements(scope, metricId, { limit: 24 });
  return rows.reverse().map((row) => ({
    period_key: row.period_key,
    period_start: row.period_start,
    period_end: row.period_end,
    value_numeric: row.value_numeric === null ? null : Number(row.value_numeric),
    value_text: row.value_text,
    quality_status: row.quality_status,
    freshness_status: row.freshness_status,
    trust_score: row.trust_score === null ? null : Number(row.trust_score),
    warning: ['stale', 'expired', 'unavailable', 'unknown'].includes(row.freshness_status) || ['rejected', 'unknown'].includes(row.quality_status),
  }));
}

async function metricTrust(scope, metricId) {
  const tenantId = tenantIdFrom(scope);
  const latest = (await queryRows(
    `SELECT * FROM metric_measurements WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid ORDER BY period_end DESC, created_at DESC LIMIT 1`,
    [tenantId, assertUuid(metricId)]
  ))[0];
  if (!latest) return { score: 0, status: 'unknown', reason: 'Metrica sin mediciones. No se inventan valores.', components: {} };
  return { score: Number(latest.trust_score || 0), status: latest.trust_status, components: latest.metadata?.trust_components || {}, measurement_id: latest.id };
}

async function listSurveys(scope, filters = {}) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(`SELECT * FROM survey_definitions WHERE tenant_id=$1::uuid ORDER BY updated_at DESC LIMIT $2`, [tenantId, normalizeLimit(filters.limit)]);
}

async function createSurvey(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(
    `INSERT INTO survey_definitions (tenant_id, survey_key, display_name, survey_type, description, owner_user_id, status, created_by, metadata)
     VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,$7,$8::uuid,$9::jsonb)
     ON CONFLICT (tenant_id, survey_key) DO UPDATE
     SET display_name=EXCLUDED.display_name, survey_type=EXCLUDED.survey_type, description=EXCLUDED.description,
         owner_user_id=EXCLUDED.owner_user_id, status=EXCLUDED.status, updated_at=now(), metadata=survey_definitions.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, text(body.survey_key || body.key), text(body.display_name || body.name), text(body.survey_type, 'survey'), text(body.description), body.owner_user_id || null, text(body.status, 'draft'), userId(scope.user), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'survey.definition.upserted', entityType: 'survey_definition', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function getSurvey(scope, id) {
  const tenantId = tenantIdFrom(scope);
  const rows = await queryRows(
    `SELECT s.*,
       COALESCE(jsonb_agg(DISTINCT v.*) FILTER (WHERE v.id IS NOT NULL), '[]'::jsonb) AS versions
     FROM survey_definitions s
     LEFT JOIN survey_versions v ON v.survey_definition_id=s.id
     WHERE s.tenant_id=$1::uuid AND s.id=$2::uuid
     GROUP BY s.id LIMIT 1`,
    [tenantId, assertUuid(id)]
  );
  if (!rows[0]) throw new Phase5Error('PHASE5_SURVEY_NOT_FOUND', 'Encuesta no encontrada.', 404);
  return rows[0];
}

async function createSurveyVersion(scope, surveyId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('survey_definitions', tenantId, surveyId, 'id');
  const next = (await queryRows('SELECT COALESCE(MAX(version_number),0)+1 AS next_version FROM survey_versions WHERE survey_definition_id=$1::uuid', [surveyId]))[0];
  const result = await pool.query(
    `INSERT INTO survey_versions (survey_definition_id, version_number, status, scoring_definition, branching_definition, created_by, metadata)
     VALUES ($1::uuid,$2,$3,$4::jsonb,$5::jsonb,$6::uuid,$7::jsonb) RETURNING *`,
    [surveyId, Number(next.next_version), text(body.status, 'draft'), json(body.scoring_definition), json(body.branching_definition), userId(scope.user), json(body.metadata)]
  );
  const version = result.rows[0];
  for (const [sectionIndex, section] of (body.sections || []).entries()) {
    const sectionRow = (await pool.query(
      `INSERT INTO survey_sections (survey_version_id, section_key, title, description, sort_order, metadata)
       VALUES ($1::uuid,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
      [version.id, text(section.section_key || `section_${sectionIndex + 1}`), text(section.title), text(section.description), section.sort_order || (sectionIndex + 1) * 100, json(section.metadata)]
    )).rows[0];
    for (const [questionIndex, question] of (section.questions || []).entries()) {
      const questionRow = (await pool.query(
        `INSERT INTO survey_questions (
           survey_version_id, section_id, question_key, question_text, question_type, help_text,
           required, allow_not_applicable, validation_definition, scoring_definition, weight,
           branching_definition, visibility_condition, sort_order, metadata
         )
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13::jsonb,$14,$15::jsonb)
         RETURNING *`,
        [
          version.id, sectionRow.id, text(question.question_key || `q_${questionIndex + 1}`), text(question.question_text),
          text(question.question_type, 'text'), text(question.help_text), question.required === true,
          question.allow_not_applicable !== false, json(question.validation_definition), json(question.scoring_definition),
          question.weight ?? 1, json(question.branching_definition), json(question.visibility_condition),
          question.sort_order || (questionIndex + 1) * 100, json(question.metadata),
        ]
      )).rows[0];
      for (const [optionIndex, option] of (question.options || []).entries()) {
        await pool.query(
          `INSERT INTO survey_question_options (question_id, option_key, label, score, sort_order, metadata)
           VALUES ($1::uuid,$2,$3,$4,$5,$6::jsonb)`,
          [questionRow.id, text(option.option_key || `option_${optionIndex + 1}`), text(option.label), option.score ?? null, option.sort_order || (optionIndex + 1) * 100, json(option.metadata)]
        );
      }
    }
  }
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'survey.version.created', entityType: 'survey_version', entityId: version.id, requestId });
  return version;
}

async function publishSurvey(scope, surveyId, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('survey_definitions', tenantId, surveyId, 'id');
  const version = (await queryRows(`SELECT * FROM survey_versions WHERE survey_definition_id=$1::uuid ORDER BY version_number DESC LIMIT 1`, [surveyId]))[0];
  if (!version) throw new Phase5Error('PHASE5_SURVEY_VERSION_REQUIRED', 'La encuesta requiere version antes de publicar.', 409);
  await pool.query(`UPDATE survey_versions SET status='published', approved_by=$2::uuid, published_at=now() WHERE id=$1::uuid`, [version.id, userId(scope.user)]);
  const result = await pool.query(`UPDATE survey_definitions SET status='published', updated_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`, [tenantId, surveyId]);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'survey.definition.published', entityType: 'survey_definition', entityId: surveyId, requestId });
  return result.rows[0];
}

async function createCampaign(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const survey = await assertTenantRecord('survey_definitions', tenantId, body.survey_definition_id, 'id');
  const version = body.survey_version_id
    ? await queryRows(`SELECT * FROM survey_versions WHERE id=$1::uuid AND survey_definition_id=$2::uuid`, [body.survey_version_id, survey.id]).then((r) => r[0])
    : await queryRows(`SELECT * FROM survey_versions WHERE survey_definition_id=$1::uuid AND status IN ('published','active') ORDER BY version_number DESC LIMIT 1`, [survey.id]).then((r) => r[0]);
  if (!version) throw new Phase5Error('PHASE5_SURVEY_PUBLISHED_VERSION_REQUIRED', 'La campaña requiere una version publicada.', 409);
  const result = await pool.query(
    `INSERT INTO assessment_campaigns (
       tenant_id, survey_definition_id, survey_version_id, campaign_key, display_name,
       target_population, starts_at, ends_at, recurrence_rule, reminder_policy, anonymous,
       status, created_by, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::jsonb,$7::timestamptz,$8::timestamptz,$9,$10::jsonb,$11,$12,$13::uuid,$14::jsonb)
     ON CONFLICT (tenant_id, campaign_key) DO UPDATE
     SET display_name=EXCLUDED.display_name, target_population=EXCLUDED.target_population,
         starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, recurrence_rule=EXCLUDED.recurrence_rule,
         reminder_policy=EXCLUDED.reminder_policy, anonymous=EXCLUDED.anonymous, status=EXCLUDED.status,
         updated_at=now(), metadata=assessment_campaigns.metadata || EXCLUDED.metadata
     RETURNING *`,
    [
      tenantId, survey.id, version.id, text(body.campaign_key || body.key), text(body.display_name || body.name),
      json(body.target_population), body.starts_at || null, body.ends_at || null, text(body.recurrence_rule),
      json(body.reminder_policy), body.anonymous === true, text(body.status, 'draft'), userId(scope.user), json(body.metadata),
    ]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'survey.campaign.upserted', entityType: 'assessment_campaign', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function listCampaigns(scope, filters = {}) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(`SELECT * FROM assessment_campaigns WHERE tenant_id=$1::uuid ORDER BY updated_at DESC LIMIT $2`, [tenantId, normalizeLimit(filters.limit)]);
}

async function getCampaign(scope, id) {
  const tenantId = tenantIdFrom(scope);
  return assertTenantRecord('assessment_campaigns', tenantId, id, '*');
}

async function transitionCampaign(scope, id, status, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(`UPDATE assessment_campaigns SET status=$3, updated_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`, [tenantId, assertUuid(id), status]);
  if (!result.rows[0]) throw new Phase5Error('PHASE5_CAMPAIGN_NOT_FOUND', 'Campaña no encontrada.', 404);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: `survey.campaign.${status}`, entityType: 'assessment_campaign', entityId: id, requestId });
  return result.rows[0];
}

async function submitResponse(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const campaign = body.campaign_id ? await assertTenantRecord('assessment_campaigns', tenantId, body.campaign_id, '*') : null;
  const versionId = body.survey_version_id || campaign?.survey_version_id;
  if (!versionId) throw new Phase5Error('PHASE5_SURVEY_VERSION_REQUIRED', 'survey_version_id requerido.', 422);
  const response = (await pool.query(
    `INSERT INTO survey_responses (tenant_id, campaign_id, survey_version_id, recipient_id, respondent_user_id, status, submitted_at, metadata)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7::timestamptz,$8::jsonb)
     RETURNING *`,
    [tenantId, campaign?.id || null, versionId, body.recipient_id || null, userId(scope.user), body.submit === true ? 'submitted' : 'draft', body.submit === true ? new Date().toISOString() : null, json(body.metadata)]
  )).rows[0];
  for (const item of body.items || []) {
    await pool.query(
      `INSERT INTO survey_response_items (
         tenant_id, response_id, question_id, answer_text, answer_numeric, answer_date, answer_json,
         not_applicable, score, evidence_id, metadata
       )
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::date,$7::jsonb,$8,$9,$10::uuid,$11::jsonb)
       ON CONFLICT (tenant_id, response_id, question_id) DO UPDATE
       SET answer_text=EXCLUDED.answer_text, answer_numeric=EXCLUDED.answer_numeric, answer_date=EXCLUDED.answer_date,
           answer_json=EXCLUDED.answer_json, not_applicable=EXCLUDED.not_applicable, score=EXCLUDED.score,
           evidence_id=EXCLUDED.evidence_id, metadata=survey_response_items.metadata || EXCLUDED.metadata`,
      [tenantId, response.id, assertUuid(item.question_id, 'question_id'), text(item.answer_text), item.answer_numeric ?? null, item.answer_date || null, json(item.answer_json), item.not_applicable === true, item.score ?? null, item.evidence_id || null, json(item.metadata)]
    );
  }
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: response.status === 'submitted' ? 'survey.response.submitted' : 'survey.response.saved', entityType: 'survey_response', entityId: response.id, requestId });
  return response;
}

async function evaluateResponse(scope, responseId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('survey_responses', tenantId, responseId, 'id');
  const scoreRows = await queryRows(`SELECT COALESCE(SUM(score),0)::numeric AS score, COUNT(*)::int AS items FROM survey_response_items WHERE tenant_id=$1::uuid AND response_id=$2::uuid`, [tenantId, responseId]);
  const result = await pool.query(
    `INSERT INTO survey_evaluations (tenant_id, response_id, evaluation_status, score, findings_preview, consequences_preview, created_by, metadata)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5::jsonb,$6::jsonb,$7::uuid,$8::jsonb)
     RETURNING *`,
    [tenantId, responseId, body.confirm === true ? 'confirmed' : 'previewed', scoreRows[0].score, json(body.findings_preview, []), json(body.consequences_preview, []), userId(scope.user), json({ ...(body.metadata || {}), response_items: scoreRows[0].items })]
  );
  await pool.query(`UPDATE survey_responses SET status='evaluated', total_score=$3, updated_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid`, [tenantId, responseId, scoreRows[0].score]);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'survey.response.evaluated', entityType: 'survey_response', entityId: responseId, requestId });
  return result.rows[0];
}

async function approveResponse(scope, responseId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('survey_responses', tenantId, responseId, 'id');
  const result = await pool.query(
    `INSERT INTO survey_approvals (tenant_id, response_id, approval_status, comment, approved_by, metadata)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb) RETURNING *`,
    [tenantId, responseId, text(body.approval_status, 'approved'), text(body.comment), userId(scope.user), json(body.metadata)]
  );
  await pool.query(`UPDATE survey_responses SET status=$3, updated_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid`, [tenantId, responseId, body.approval_status === 'approved' ? 'approved' : 'rejected']);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'survey.response.approved', entityType: 'survey_response', entityId: responseId, requestId });
  return result.rows[0];
}

async function listAssuranceTests(scope) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(`SELECT * FROM assurance_test_definitions WHERE tenant_id=$1::uuid ORDER BY updated_at DESC LIMIT 100`, [tenantId]);
}

async function createAssuranceTest(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(
    `INSERT INTO assurance_test_definitions (
       tenant_id, test_code, display_name, test_type, objective, procedure, target_entity_type,
       target_entity_id, owner_user_id, reviewer_user_id, status, created_by, metadata
     )
     VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::uuid,$9::uuid,$10::uuid,$11,$12::uuid,$13::jsonb)
     ON CONFLICT (tenant_id, test_code) DO UPDATE
     SET display_name=EXCLUDED.display_name, test_type=EXCLUDED.test_type, objective=EXCLUDED.objective,
         procedure=EXCLUDED.procedure, target_entity_type=EXCLUDED.target_entity_type, target_entity_id=EXCLUDED.target_entity_id,
         owner_user_id=EXCLUDED.owner_user_id, reviewer_user_id=EXCLUDED.reviewer_user_id, status=EXCLUDED.status,
         updated_at=now(), metadata=assurance_test_definitions.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, text(body.test_code || body.code), text(body.display_name || body.name), text(body.test_type, 'effectiveness_test'), text(body.objective), text(body.procedure), text(body.target_entity_type, 'control'), body.target_entity_id || null, body.owner_user_id || null, body.reviewer_user_id || null, text(body.status, 'active'), userId(scope.user), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'assurance.test.upserted', entityType: 'assurance_test_definition', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function executeAssuranceTest(scope, testId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('assurance_test_definitions', tenantId, testId, 'id');
  const result = await pool.query(
    `INSERT INTO assurance_test_executions (
       tenant_id, test_definition_id, execution_code, population_description, sample_method,
       executed_by, executed_at, status, evidence_id, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,now(),'in_progress',$7::uuid,$8::jsonb)
     RETURNING *`,
    [tenantId, testId, text(body.execution_code || `exec_${Date.now()}`), text(body.population_description, 'Poblacion definida por el ejecutor.'), text(body.sample_method, 'judgmental'), userId(scope.user), body.evidence_id || null, json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'assurance.test.executed', entityType: 'assurance_test_execution', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function completeAssuranceExecution(scope, executionId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('assurance_test_executions', tenantId, executionId, 'id');
  const result = await pool.query(
    `UPDATE assurance_test_executions
     SET result=$3, conclusion=$4, status='completed', updated_at=now(), metadata=metadata || $5::jsonb
     WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
    [tenantId, executionId, text(body.result, 'inconclusive'), text(body.conclusion), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'assurance.test.completed', entityType: 'assurance_test_execution', entityId: executionId, requestId });
  return result.rows[0];
}

async function reviewAssuranceExecution(scope, executionId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(
    `UPDATE assurance_test_executions
     SET reviewed_by=$3::uuid, reviewed_at=now(), status=$4, updated_at=now(), metadata=metadata || $5::jsonb
     WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
    [tenantId, assertUuid(executionId), userId(scope.user), text(body.status, 'reviewed'), json(body.metadata)]
  );
  if (!result.rows[0]) throw new Phase5Error('PHASE5_TEST_EXECUTION_NOT_FOUND', 'Ejecucion no encontrada.', 404);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'assurance.test.reviewed', entityType: 'assurance_test_execution', entityId: executionId, requestId });
  return result.rows[0];
}

async function listLossEvents(scope) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(`SELECT * FROM loss_events WHERE tenant_id=$1::uuid ORDER BY occurred_at DESC LIMIT 100`, [tenantId]);
}

async function createLossEvent(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const gross = Number(body.gross_loss || 0);
  const recoveries = Number(body.recoveries || 0);
  if (recoveries > gross) throw new Phase5Error('PHASE5_LOSS_NEGATIVE_NET', 'Las recuperaciones no pueden superar la perdida bruta.', 422);
  const result = await pool.query(
    `INSERT INTO loss_events (
       tenant_id, event_code, event_type, occurred_at, detected_at, process_id, service_id,
       risk_id, cause, impact_description, gross_loss, recoveries, net_loss, currency,
       supplier_id, incident_id, failed_control_id, evidence_id, action_plan_id, status,
       created_by, metadata
     )
     VALUES ($1::uuid,$2,$3,$4::timestamptz,$5::timestamptz,$6::uuid,$7::uuid,$8::uuid,$9,$10,$11,$12,$13,$14,$15::uuid,$16::uuid,$17::uuid,$18::uuid,$19::uuid,$20,$21::uuid,$22::jsonb)
     ON CONFLICT (tenant_id, event_code) DO UPDATE
     SET event_type=EXCLUDED.event_type, detected_at=EXCLUDED.detected_at, cause=EXCLUDED.cause,
         impact_description=EXCLUDED.impact_description, gross_loss=EXCLUDED.gross_loss,
         recoveries=EXCLUDED.recoveries, net_loss=EXCLUDED.net_loss, status=EXCLUDED.status,
         updated_at=now(), metadata=loss_events.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, text(body.event_code || body.code), text(body.event_type, 'operational'), text(body.occurred_at, new Date().toISOString()), body.detected_at || null, body.process_id || null, body.service_id || null, body.risk_id || null, text(body.cause), text(body.impact_description), gross, recoveries, gross - recoveries, text(body.currency, 'CLP').slice(0, 3).toUpperCase(), body.supplier_id || null, body.incident_id || null, body.failed_control_id || null, body.evidence_id || null, body.action_plan_id || null, text(body.status, 'draft'), userId(scope.user), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'loss.event.upserted', entityType: 'loss_event', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function getLossEvent(scope, id) {
  const tenantId = tenantIdFrom(scope);
  return assertTenantRecord('loss_events', tenantId, id, '*');
}

async function updateLossEvent(scope, id, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const current = await getLossEvent(scope, id);
  if (current.status === 'closed') throw new Phase5Error('PHASE5_LOSS_CLOSED_REVIEW_REQUIRED', 'Eventos cerrados requieren revision versionada para modificarse.', 409);
  const gross = body.gross_loss === undefined ? current.gross_loss : Number(body.gross_loss);
  const recoveries = body.recoveries === undefined ? current.recoveries : Number(body.recoveries);
  if (recoveries > gross) throw new Phase5Error('PHASE5_LOSS_NEGATIVE_NET', 'Las recuperaciones no pueden superar la perdida bruta.', 422);
  const result = await pool.query(
    `UPDATE loss_events
     SET gross_loss=$3, recoveries=$4, net_loss=$5, cause=COALESCE($6,cause), impact_description=COALESCE($7,impact_description),
         status=COALESCE($8,status), updated_at=now(), metadata=metadata || $9::jsonb
     WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
    [tenantId, id, gross, recoveries, gross - recoveries, text(body.cause), text(body.impact_description), text(body.status), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'loss.event.updated', entityType: 'loss_event', entityId: id, requestId });
  return result.rows[0];
}

async function transitionLossEvent(scope, id, status, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(
    `UPDATE loss_events
     SET status=$3, approved_by=CASE WHEN $3 IN ('confirmed','closed') THEN $4::uuid ELSE approved_by END,
         approved_at=CASE WHEN $3 IN ('confirmed','closed') THEN now() ELSE approved_at END,
         updated_at=now()
     WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
    [tenantId, assertUuid(id), status, userId(scope.user)]
  );
  if (!result.rows[0]) throw new Phase5Error('PHASE5_LOSS_NOT_FOUND', 'Evento de perdida no encontrado.', 404);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: `loss.event.${status}`, entityType: 'loss_event', entityId: id, requestId });
  return result.rows[0];
}

async function addLossRecovery(scope, id, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const loss = await getLossEvent(scope, id);
  const amount = Number(body.amount || 0);
  if (amount <= 0) throw new Phase5Error('PHASE5_RECOVERY_AMOUNT_INVALID', 'La recuperacion debe ser mayor a cero.', 422);
  const total = Number(loss.recoveries || 0) + amount;
  if (total > Number(loss.gross_loss || 0)) throw new Phase5Error('PHASE5_LOSS_NEGATIVE_NET', 'La recuperacion excede la perdida bruta.', 422);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recovery = await client.query(
      `INSERT INTO loss_recoveries (tenant_id, loss_event_id, recovery_code, recovered_at, amount, currency, source, evidence_id, created_by, metadata)
       VALUES ($1::uuid,$2::uuid,$3,$4::timestamptz,$5,$6,$7,$8::uuid,$9::uuid,$10::jsonb)
       RETURNING *`,
      [tenantId, id, text(body.recovery_code || `recovery_${Date.now()}`), body.recovered_at || new Date().toISOString(), amount, text(body.currency, loss.currency).slice(0, 3).toUpperCase(), text(body.source, 'manual'), body.evidence_id || null, userId(scope.user), json(body.metadata)]
    );
    const updated = await client.query(`UPDATE loss_events SET recoveries=$3, net_loss=gross_loss-$3, status='recovered_partial', updated_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`, [tenantId, id, total]);
    await auditEvent(client, { tenantId, userId: userId(scope.user), action: 'loss.recovery.created', entityType: 'loss_event', entityId: id, requestId });
    await client.query('COMMIT');
    return { recovery: recovery.rows[0], loss_event: updated.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function listDashboards(scope) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(`SELECT * FROM dashboard_definitions WHERE tenant_id=$1::uuid ORDER BY updated_at DESC LIMIT 100`, [tenantId]);
}

async function createDashboard(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(
    `INSERT INTO dashboard_definitions (
       tenant_id, dashboard_key, display_name, description, dashboard_type, layout_config,
       filter_config, status, created_by, updated_by, metadata
     )
     VALUES ($1::uuid,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::uuid,$9::uuid,$10::jsonb)
     ON CONFLICT (tenant_id, dashboard_key, version_number) DO UPDATE
     SET display_name=EXCLUDED.display_name, description=EXCLUDED.description, dashboard_type=EXCLUDED.dashboard_type,
         layout_config=EXCLUDED.layout_config, filter_config=EXCLUDED.filter_config, status=EXCLUDED.status,
         updated_by=EXCLUDED.updated_by, updated_at=now(), metadata=dashboard_definitions.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, text(body.dashboard_key || body.key), text(body.display_name || body.name), text(body.description), text(body.dashboard_type, 'custom'), json(body.layout_config), json(body.filter_config), text(body.status, 'draft'), userId(scope.user), json(body.metadata)]
  );
  for (const widget of body.widgets || []) {
    await pool.query(
      `INSERT INTO dashboard_widgets (
         tenant_id, dashboard_id, widget_key, display_name, widget_type, data_source_type,
         data_source_ref, position_row, position_col, width, height, config, status, metadata
       )
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb)
       ON CONFLICT (dashboard_id, widget_key) DO UPDATE
       SET display_name=EXCLUDED.display_name, widget_type=EXCLUDED.widget_type, data_source_type=EXCLUDED.data_source_type,
           data_source_ref=EXCLUDED.data_source_ref, position_row=EXCLUDED.position_row, position_col=EXCLUDED.position_col,
           width=EXCLUDED.width, height=EXCLUDED.height, config=EXCLUDED.config, status=EXCLUDED.status,
           updated_at=now(), metadata=dashboard_widgets.metadata || EXCLUDED.metadata`,
      [tenantId, result.rows[0].id, text(widget.widget_key || widget.key), text(widget.display_name || widget.name), text(widget.widget_type, 'kpi_card'), text(widget.data_source_type, 'metric'), text(widget.data_source_ref), widget.position_row || 1, widget.position_col || 1, widget.width || 4, widget.height || 2, json(widget.config), text(widget.status, 'active'), json(widget.metadata)]
    );
  }
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'dashboard.upserted', entityType: 'dashboard_definition', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function getDashboard(scope, id) {
  const tenantId = tenantIdFrom(scope);
  const dashboard = await assertTenantRecord('dashboard_definitions', tenantId, id, '*');
  const widgets = await queryRows(`SELECT * FROM dashboard_widgets WHERE tenant_id=$1::uuid AND dashboard_id=$2::uuid ORDER BY position_row, position_col`, [tenantId, id]);
  return { ...dashboard, widgets };
}

async function publishDashboard(scope, id, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(`UPDATE dashboard_definitions SET status='published', published_by=$3::uuid, published_at=now(), updated_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`, [tenantId, assertUuid(id), userId(scope.user)]);
  if (!result.rows[0]) throw new Phase5Error('PHASE5_DASHBOARD_NOT_FOUND', 'Dashboard no encontrado.', 404);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'dashboard.published', entityType: 'dashboard_definition', entityId: id, requestId });
  return result.rows[0];
}

async function createSnapshot(scope, entityType, entityId, payload, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const snapshotPayload = payload || { entity_type: entityType, entity_id: entityId, captured_at: new Date().toISOString() };
  const result = await pool.query(
    `INSERT INTO data_snapshots (tenant_id, snapshot_type, entity_type, entity_id, period_key, snapshot_payload, source_hash, created_by, correlation_id, metadata)
     VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6::jsonb,$7,$8::uuid,$9,$10::jsonb)
     ON CONFLICT (tenant_id, snapshot_type, entity_type, entity_id, COALESCE(period_key, ''), source_hash) DO UPDATE
     SET metadata=data_snapshots.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, text(payload?.snapshot_type, entityType === 'dashboard' ? 'dashboard' : 'data'), entityType, assertUuid(entityId), text(payload?.period_key), json(snapshotPayload), hashPayload(snapshotPayload), userId(scope.user), requestId, json(payload?.metadata)]
  );
  return result.rows[0];
}

async function snapshotDashboard(scope, id, requestId = null) {
  const dashboard = await getDashboard(scope, id);
  const snapshot = await createSnapshot(scope, 'dashboard', id, { snapshot_type: 'dashboard', dashboard, captured_at: new Date().toISOString() }, requestId);
  await auditEvent(pool, { tenantId: tenantIdFrom(scope), userId: userId(scope.user), action: 'dashboard.snapshot.created', entityType: 'dashboard_definition', entityId: id, requestId });
  return snapshot;
}

async function renderDashboard(scope, id) {
  const dashboard = await getDashboard(scope, id);
  const tenantId = tenantIdFrom(scope);
  const widgets = [];
  for (const widget of dashboard.widgets) {
    let data = null;
    if (widget.data_source_type === 'metric' && UUID_RE.test(String(widget.data_source_ref))) {
      data = (await queryRows(`SELECT * FROM metric_measurements WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid ORDER BY period_end DESC LIMIT 1`, [tenantId, widget.data_source_ref]))[0] || null;
    }
    widgets.push({ ...widget, data, warning: data ? ['stale', 'expired', 'unavailable', 'unknown'].includes(data.freshness_status) || ['rejected', 'unknown'].includes(data.quality_status) : true });
  }
  return { ...dashboard, widgets };
}

async function listReports(scope) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(`SELECT * FROM report_definitions WHERE tenant_id=$1::uuid ORDER BY updated_at DESC LIMIT 100`, [tenantId]);
}

async function createReport(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(
    `INSERT INTO report_definitions (
       tenant_id, report_key, display_name, report_type, classification, filter_config,
       section_config, recipient_config, approval_required, status, created_by, updated_by, metadata
     )
     VALUES ($1::uuid,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11::uuid,$11::uuid,$12::jsonb)
     ON CONFLICT (tenant_id, report_key) DO UPDATE
     SET display_name=EXCLUDED.display_name, report_type=EXCLUDED.report_type, classification=EXCLUDED.classification,
         filter_config=EXCLUDED.filter_config, section_config=EXCLUDED.section_config, recipient_config=EXCLUDED.recipient_config,
         approval_required=EXCLUDED.approval_required, status=EXCLUDED.status, updated_by=EXCLUDED.updated_by,
         updated_at=now(), metadata=report_definitions.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, text(body.report_key || body.key), text(body.display_name || body.name), text(body.report_type, 'custom'), text(body.classification, 'internal'), json(body.filter_config), json(body.section_config, []), json(body.recipient_config, []), body.approval_required !== false, text(body.status, 'draft'), userId(scope.user), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'report.definition.upserted', entityType: 'report_definition', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function getReport(scope, id) {
  return assertTenantRecord('report_definitions', tenantIdFrom(scope), id, '*');
}

function ensureArtifactDir() {
  const dir = path.resolve(__dirname, '../../../uploads/report-studio');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function escapeXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function buildDocxBuffer(lines) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`).join('')}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function buildPdfBuffer(lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, info: { Title: lines[0] || 'Reporte TCDX', Author: 'TCDX' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text(lines[0] || 'Reporte TCDX');
    doc.moveDown();
    lines.slice(1).forEach((line) => doc.fontSize(10).text(String(line)));
    doc.end();
  });
}

function buildXlsxBuffer(lines) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(lines.map((line) => [line]));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
}

async function generateReport(scope, reportId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const report = await getReport(scope, reportId);
  const format = text(body.format, 'pdf').toLowerCase();
  if (!['pdf', 'docx', 'xlsx'].includes(format)) throw new Phase5Error('PHASE5_REPORT_FORMAT_INVALID', 'Formato de reporte no soportado.', 422);
  const generationKey = text(body.generation_key, `${report.report_key}_${format}_${Date.now()}`);
  const snapshotPayload = {
    report_definition: report,
    filters: body.filters || report.filter_config || {},
    generated_at: new Date().toISOString(),
    request_id: requestId || null,
  };
  const snapshot = await createSnapshot(scope, 'report', report.id, { snapshot_type: 'report', ...snapshotPayload }, requestId);
  const generation = (await pool.query(
    `INSERT INTO report_generations (
       tenant_id, report_definition_id, generation_key, format, status, snapshot_id, requested_by, started_at, correlation_id, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3,$4,'generating',$5::uuid,$6::uuid,now(),$7,$8::jsonb)
     ON CONFLICT (tenant_id, generation_key, format) DO UPDATE
     SET status='generating', started_at=now(), metadata=report_generations.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, report.id, generationKey, format, snapshot.id, userId(scope.user), requestId, json(body.metadata)]
  )).rows[0];

  const lines = [
    report.display_name,
    `Tenant: ${tenantId}`,
    `Fecha: ${new Date().toISOString()}`,
    `Periodo: ${text(body.period_key, 'no especificado')}`,
    `Version: ${generation.generation_key}`,
    `Clasificacion: ${report.classification}`,
    `Identificador de emision: ${generation.id}`,
    `Fuentes: snapshot ${snapshot.id}`,
    `Confianza: calculada por Data Trust Score deterministico cuando existe medicion.`,
    `Freshness: datos stale/expired/rejected/unknown se reportan con advertencia en API/UI.`,
  ];

  let buffer;
  let mimeType;
  if (format === 'pdf') {
    buffer = await buildPdfBuffer(lines);
    mimeType = 'application/pdf';
  } else if (format === 'docx') {
    buffer = await buildDocxBuffer(lines);
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else {
    buffer = buildXlsxBuffer(lines);
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileName = `${generation.id}.${format}`;
  const storagePath = path.join(ensureArtifactDir(), fileName);
  fs.writeFileSync(storagePath, buffer, { mode: 0o600 });

  await pool.query(`UPDATE report_generations SET status='generated', finished_at=now(), checksum=$3 WHERE tenant_id=$1::uuid AND id=$2::uuid`, [tenantId, generation.id, checksum]);
  const artifact = (await pool.query(
    `INSERT INTO report_artifacts (
       tenant_id, report_generation_id, artifact_format, file_name, mime_type, file_size_bytes,
       checksum, storage_path, classification, metadata
     )
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (tenant_id, report_generation_id, artifact_format) DO UPDATE
     SET file_name=EXCLUDED.file_name, mime_type=EXCLUDED.mime_type, file_size_bytes=EXCLUDED.file_size_bytes,
         checksum=EXCLUDED.checksum, storage_path=EXCLUDED.storage_path, classification=EXCLUDED.classification,
         metadata=report_artifacts.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, generation.id, format, fileName, mimeType, buffer.length, checksum, storagePath, report.classification, json({ snapshot_id: snapshot.id })]
  )).rows[0];
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'report.generated', entityType: 'report_generation', entityId: generation.id, requestId, metadata: { format, checksum } });
  return { generation: { ...generation, status: 'generated', checksum }, artifact, snapshot };
}

async function listReportGenerations(scope) {
  const tenantId = tenantIdFrom(scope);
  return queryRows(`SELECT * FROM report_generations WHERE tenant_id=$1::uuid ORDER BY requested_at DESC LIMIT 100`, [tenantId]);
}

async function getReportGeneration(scope, id) {
  const tenantId = tenantIdFrom(scope);
  const generation = await assertTenantRecord('report_generations', tenantId, id, '*');
  const artifacts = await queryRows(`SELECT id, artifact_format, file_name, mime_type, file_size_bytes, checksum, classification, created_at FROM report_artifacts WHERE tenant_id=$1::uuid AND report_generation_id=$2::uuid`, [tenantId, id]);
  return { ...generation, artifacts };
}

async function downloadArtifact(scope, generationId) {
  const tenantId = tenantIdFrom(scope);
  const row = (await queryRows(
    `SELECT a.* FROM report_artifacts a
     JOIN report_generations g ON g.id=a.report_generation_id AND g.tenant_id=a.tenant_id
     WHERE a.tenant_id=$1::uuid AND g.id=$2::uuid
     ORDER BY a.created_at DESC LIMIT 1`,
    [tenantId, assertUuid(generationId)]
  ))[0];
  if (!row) throw new Phase5Error('PHASE5_REPORT_ARTIFACT_NOT_FOUND', 'Artefacto no encontrado.', 404);
  const safePath = path.resolve(row.storage_path);
  const artifactRoot = ensureArtifactDir();
  if (!safePath.startsWith(`${artifactRoot}${path.sep}`) || !fs.existsSync(safePath)) {
    throw new Phase5Error('PHASE5_REPORT_FILE_NOT_FOUND', 'Archivo no encontrado.', 404);
  }
  const buffer = fs.readFileSync(safePath);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  if (checksum !== row.checksum) throw new Phase5Error('PHASE5_REPORT_CHECKSUM_MISMATCH', 'Checksum de artefacto invalido.', 409);
  return { ...row, buffer };
}

async function approveReportGeneration(scope, generationId, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('report_generations', tenantId, generationId, 'id');
  const approval = (await pool.query(
    `INSERT INTO report_approvals (tenant_id, report_generation_id, approval_status, comment, approved_by, metadata)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb) RETURNING *`,
    [tenantId, generationId, text(body.approval_status, 'approved'), text(body.comment), userId(scope.user), json(body.metadata)]
  )).rows[0];
  if (approval.approval_status === 'approved') {
    await pool.query(`UPDATE report_generations SET approved_by=$3::uuid, approved_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid`, [tenantId, generationId, userId(scope.user)]);
  }
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'report.generation.approved', entityType: 'report_generation', entityId: generationId, requestId });
  return approval;
}

async function createReportSchedule(scope, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  await assertTenantRecord('report_definitions', tenantId, body.report_definition_id, 'id');
  if (body.frequency === 'restricted_cron' && !/^(\d+|\*) (\d+|\*) (\d+|\*) (\d+|\*) (\d+|\*)$/.test(String(body.restricted_cron || ''))) {
    throw new Phase5Error('PHASE5_CRON_RESTRICTED_INVALID', 'Cron restringido invalido.', 422);
  }
  const result = await pool.query(
    `INSERT INTO report_schedules (tenant_id, report_definition_id, schedule_key, frequency, restricted_cron, timezone, next_run_at, status, created_by, metadata)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::timestamptz,$8,$9::uuid,$10::jsonb)
     ON CONFLICT (tenant_id, schedule_key) DO UPDATE
     SET frequency=EXCLUDED.frequency, restricted_cron=EXCLUDED.restricted_cron, timezone=EXCLUDED.timezone,
         next_run_at=EXCLUDED.next_run_at, status=EXCLUDED.status, updated_at=now(), metadata=report_schedules.metadata || EXCLUDED.metadata
     RETURNING *`,
    [tenantId, body.report_definition_id, text(body.schedule_key || body.key), text(body.frequency, 'monthly'), text(body.restricted_cron), text(body.timezone, 'America/Santiago'), body.next_run_at || null, text(body.status, 'active'), userId(scope.user), json(body.metadata)]
  );
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'report.schedule.upserted', entityType: 'report_schedule', entityId: result.rows[0].id, requestId });
  return result.rows[0];
}

async function updateReportSchedule(scope, id, body = {}, requestId = null) {
  const tenantId = tenantIdFrom(scope);
  const result = await pool.query(
    `UPDATE report_schedules
     SET frequency=COALESCE($3,frequency), restricted_cron=$4, timezone=COALESCE($5,timezone),
         next_run_at=COALESCE($6::timestamptz,next_run_at), status=COALESCE($7,status),
         updated_at=now(), metadata=metadata || $8::jsonb
     WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,
    [tenantId, assertUuid(id), text(body.frequency), text(body.restricted_cron), text(body.timezone), body.next_run_at || null, text(body.status), json(body.metadata)]
  );
  if (!result.rows[0]) throw new Phase5Error('PHASE5_SCHEDULE_NOT_FOUND', 'Programacion no encontrada.', 404);
  await auditEvent(pool, { tenantId, userId: userId(scope.user), action: 'report.schedule.updated', entityType: 'report_schedule', entityId: id, requestId });
  return result.rows[0];
}

module.exports = {
  Phase5Error,
  FormulaError,
  TrustScoreError,
  sanitizeError,
  listDataDomains,
  createDataDomain,
  listDataElements,
  getDataElement,
  createDataElement,
  updateDataElement,
  listDataQuality,
  assessDataQuality,
  graph,
  listMetrics,
  getMetric,
  createMetric,
  updateMetric,
  addFormula,
  publishMetric,
  listMeasurements,
  recordMeasurement,
  calculateMetric,
  validateMeasurement,
  metricTrend,
  metricTrust,
  listSurveys,
  createSurvey,
  getSurvey,
  createSurveyVersion,
  publishSurvey,
  createCampaign,
  listCampaigns,
  getCampaign,
  transitionCampaign,
  submitResponse,
  evaluateResponse,
  approveResponse,
  listAssuranceTests,
  createAssuranceTest,
  executeAssuranceTest,
  completeAssuranceExecution,
  reviewAssuranceExecution,
  listLossEvents,
  createLossEvent,
  getLossEvent,
  updateLossEvent,
  transitionLossEvent,
  addLossRecovery,
  listDashboards,
  createDashboard,
  getDashboard,
  publishDashboard,
  snapshotDashboard,
  renderDashboard,
  listReports,
  createReport,
  getReport,
  generateReport,
  listReportGenerations,
  getReportGeneration,
  downloadArtifact,
  approveReportGeneration,
  createReportSchedule,
  updateReportSchedule,
};
