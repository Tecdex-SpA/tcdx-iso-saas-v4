'use strict';

const crypto = require('crypto');

const OBSERVATION_MODEL_VERSION = 'grc-observation-model-v1';

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

const RELATION_TYPES = new Set([
  'relates_to',
  'evidence_for',
  'impacts',
  'caused_by',
  'mitigated_by',
  'duplicates',
  'remediated_by',
  'blocks',
]);

const LINK_SOURCES = new Set(['manual', 'system', 'import', 'ai_suggested']);
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
  finding: [
    {
      table: 'findings',
      query: `
        SELECT id, tenant_id, COALESCE(title, finding_type, 'Finding') AS label
        FROM findings
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  action: [
    {
      table: 'action_plans',
      query: `
        SELECT id, tenant_id, COALESCE(title, description, 'Action plan') AS label
        FROM action_plans
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  audit: [
    {
      table: 'audits',
      query: `
        SELECT id, tenant_id, COALESCE(iso, status, 'Audit') AS label
        FROM audits
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  control: [
    {
      table: 'tenant_controls',
      query: `
        SELECT tc.id, tc.tenant_id, COALESCE(cc.description, 'Control') AS label
        FROM tenant_controls tc
        LEFT JOIN controls_catalog cc ON cc.id = tc.control_id
        WHERE tc.tenant_id = $1::uuid AND tc.id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  risk: [
    {
      table: 'iso_risk_matrix_items',
      query: `
        SELECT id, tenant_id, COALESCE(risk_title, risk_code, risk_description, 'Risk') AS label
        FROM iso_risk_matrix_items
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
    {
      table: 'asset_risks',
      query: `
        SELECT ar.id, a.tenant_id, COALESCE(ar.risk::text, ar.impact::text, ar.level::text, 'Asset risk') AS label
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        WHERE a.tenant_id = $1::uuid AND ar.id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  evidence: [
    {
      table: 'evidences',
      query: `
        SELECT id, tenant_id, COALESCE(file_name, description, evidence_type, 'Evidence') AS label
        FROM evidences
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  document: [
    {
      table: 'document_index',
      query: `
        SELECT id, tenant_id, COALESCE(file_name, relative_path, provider_file_id, 'Document') AS label
        FROM document_index
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
          AND COALESCE(status, 'indexed') NOT IN ('deleted', 'error', 'ignored', 'missing')
        LIMIT 1
      `,
    },
  ],
  incident: [
    {
      table: 'grc_incidents',
      query: `
        SELECT id, tenant_id, COALESCE(title, incident_number, 'Incident') AS label
        FROM grc_incidents
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  readiness_snapshot: [
    {
      table: 'grc_readiness_snapshots',
      query: `
        SELECT id, tenant_id, COALESCE(formula_version, input_hash, 'Readiness snapshot') AS label
        FROM grc_readiness_snapshots
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  readiness_finding: [
    {
      table: 'grc_readiness_findings',
      query: `
        SELECT id, tenant_id, COALESCE(finding_code, severity, 'Readiness finding') AS label
        FROM grc_readiness_findings
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  nonconformity: [
    {
      table: 'tenant_nonconformities',
      query: `
        SELECT id, tenant_id, COALESCE(control_description, status, 'Nonconformity') AS label
        FROM tenant_nonconformities
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  metric_measurement: [
    {
      table: 'metric_measurements',
      query: `
        SELECT id, tenant_id, COALESCE(period_key, unit, 'Metric measurement') AS label
        FROM metric_measurements
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
  assessment: [
    {
      table: 'survey_evaluations',
      query: `
        SELECT id, tenant_id, COALESCE(evaluation_status, 'Assessment') AS label
        FROM survey_evaluations
        WHERE tenant_id = $1::uuid AND id = $2::uuid
        LIMIT 1
      `,
    },
  ],
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
  if (!Number.isFinite(date.getTime())) {
    throw publicError(GrcError, 400, 'OBSERVATION_TIME_INVALID', `${field} inválido.`);
  }
  return date.toISOString();
}

function parseOptionalTimestamp(value, field, GrcError) {
  if (!value) return null;
  return parseTimestamp(value, field, GrcError);
}

function optionalUuid(value, field, GrcError) {
  const text = asText(value, 80);
  if (!text) return null;
  if (!UUID_RE.test(text)) {
    throw publicError(GrcError, 400, 'OBSERVATION_UUID_INVALID', `${field} inválido.`);
  }
  return text;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizePayload(payload = {}, tenantId, userId, GrcError) {
  const observationType = asText(payload.observation_type, 80) || 'observation';
  const domain = asText(payload.domain, 80) || 'general';
  const status = asText(payload.status, 80) || 'open';
  const severity = asText(payload.severity, 80);
  const sourceType = asText(payload.source_type, 80) || 'manual';
  const title = asText(payload.title, 300);
  const description = asText(payload.description, 4000);
  const metadata = asObject(payload.metadata, {});

  if (!OBSERVATION_TYPES.has(observationType)) {
    throw publicError(GrcError, 400, 'OBSERVATION_TYPE_INVALID', 'observation_type inválido.');
  }
  if (observationType === 'custom' && !asText(metadata.custom_type, 120)) {
    throw publicError(GrcError, 400, 'OBSERVATION_CUSTOM_TYPE_REQUIRED', 'metadata.custom_type es obligatorio para observation_type=custom.');
  }
  if (!OBSERVATION_DOMAINS.has(domain)) {
    throw publicError(GrcError, 400, 'OBSERVATION_DOMAIN_INVALID', 'domain inválido.');
  }
  if (!OBSERVATION_STATUSES.has(status)) {
    throw publicError(GrcError, 400, 'OBSERVATION_STATUS_INVALID', 'status inválido.');
  }
  if (!severity || !OBSERVATION_SEVERITIES.has(severity)) {
    throw publicError(GrcError, 400, 'OBSERVATION_SEVERITY_INVALID', 'severity inválida.');
  }
  if (!SOURCE_TYPES.has(sourceType)) {
    throw publicError(GrcError, 400, 'OBSERVATION_SOURCE_TYPE_INVALID', 'source_type inválido.');
  }
  if (!title) throw publicError(GrcError, 400, 'OBSERVATION_TITLE_REQUIRED', 'title es obligatorio.');

  const sourceId = asText(payload.source_id, 80);
  if (sourceType === 'manual' && sourceId) {
    throw publicError(GrcError, 400, 'OBSERVATION_MANUAL_SOURCE_ID_FORBIDDEN', 'manual no acepta source_id.');
  }
  if (sourceType !== 'manual' && !sourceId) {
    throw publicError(GrcError, 400, 'OBSERVATION_SOURCE_ID_REQUIRED', 'source_id es obligatorio para fuentes no manuales.');
  }

  const observedAt = parseTimestamp(payload.observed_at, 'observed_at', GrcError);
  const effectiveFrom = parseOptionalTimestamp(payload.effective_from, 'effective_from', GrcError);
  const effectiveTo = parseOptionalTimestamp(payload.effective_to, 'effective_to', GrcError);
  if (effectiveFrom && effectiveTo && new Date(effectiveFrom).getTime() > new Date(effectiveTo).getTime()) {
    throw publicError(GrcError, 400, 'OBSERVATION_EFFECTIVE_INTERVAL_INVALID', 'effective_from debe ser menor o igual a effective_to.');
  }

  const sourceReference = asObject(payload.source_reference, {});
  const baseForKey = {
    source_type: sourceType,
    source_id: sourceId || null,
    observation_type: observationType,
    domain,
    title,
    observed_at: observedAt,
  };
  const explicitKey = asText(payload.observation_key, 300);
  const observationKey = explicitKey || `${sourceType}:${sha256(stableJson(baseForKey)).slice(0, 48)}`;
  const hashPayload = {
    tenant_id: tenantId,
    observation_key: observationKey,
    observation_type: observationType,
    domain,
    title,
    description: description || null,
    severity,
    source_type: sourceType,
    source_id: sourceId || null,
    observed_at: observedAt,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    source_reference: sourceReference,
    model_version: OBSERVATION_MODEL_VERSION,
  };

  return {
    tenant_id: tenantId,
    observation_key: observationKey,
    observation_hash: sha256(stableJson(hashPayload)),
    observation_type: observationType,
    domain,
    title,
    description,
    status,
    severity,
    source_type: sourceType,
    source_id: sourceId || null,
    source_reference: sourceReference,
    observed_at: observedAt,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    owner_user_id: optionalUuid(payload.owner_user_id, 'owner_user_id', GrcError),
    responsible_user_id: optionalUuid(payload.responsible_user_id, 'responsible_user_id', GrcError),
    created_by: userId || null,
    metadata: {
      ...metadata,
      model_version: OBSERVATION_MODEL_VERSION,
    },
    correlation_id: asText(payload.correlation_id, 160),
  };
}

function createGrcObservationService(pool, { GrcError, assertUuid, observe, withTransaction, audit, json }) {
  const tableCache = new Map();

  async function tableExists(tableName) {
    if (tableCache.has(tableName)) return tableCache.get(tableName);
    const result = await pool.query(
      `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
      `,
      [tableName]
    );
    const exists = result.rowCount > 0;
    tableCache.set(tableName, exists);
    return exists;
  }

  async function validateSource(tenantId, sourceType, sourceId) {
    if (sourceType === 'manual') {
      return {
        source_type: 'manual',
        source_id: null,
        source_table: null,
        source_label: 'Manual observation',
      };
    }

    assertUuid(sourceId, 'OBSERVATION_SOURCE_ID_INVALID');
    const adapters = SOURCE_ADAPTERS[sourceType] || [];
    let available = false;
    for (const adapter of adapters) {
      if (!(await tableExists(adapter.table))) continue;
      available = true;
      const result = await pool.query(adapter.query, [tenantId, sourceId]);
      if (result.rowCount > 0) {
        return {
          source_type: sourceType,
          source_id: sourceId,
          source_table: adapter.table,
          source_label: result.rows[0].label || null,
        };
      }
    }

    if (!available) {
      throw publicError(GrcError, 400, 'OBSERVATION_SOURCE_UNAVAILABLE', 'La fuente indicada no está disponible en el schema actual.');
    }
    throw publicError(GrcError, 404, 'OBSERVATION_SOURCE_NOT_FOUND', 'Fuente no encontrada para el tenant autenticado.');
  }

  async function listObservations({ tenantId, filters = {} }) {
    const params = [tenantId];
    const where = ['tenant_id = $1::uuid'];
    const limit = Math.max(1, Math.min(Number(filters.limit) || 100, 200));

    for (const [field, allowed] of [
      ['status', OBSERVATION_STATUSES],
      ['domain', OBSERVATION_DOMAINS],
      ['observation_type', OBSERVATION_TYPES],
      ['source_type', SOURCE_TYPES],
    ]) {
      if (!filters[field]) continue;
      const value = asText(filters[field], 80);
      if (!allowed.has(value)) {
        throw publicError(GrcError, 400, `OBSERVATION_${field.toUpperCase()}_INVALID`, `${field} inválido.`);
      }
      params.push(value);
      where.push(`${field} = $${params.length}`);
    }

    params.push(limit);
    const result = await pool.query(
      `
      SELECT *
      FROM grc_observations
      WHERE ${where.join(' AND ')}
      ORDER BY observed_at DESC, created_at DESC
      LIMIT $${params.length}
      `,
      params
    );
    return { data: result.rows, model_version: OBSERVATION_MODEL_VERSION };
  }

  async function getObservation(tenantId, observationId) {
    const result = await pool.query(
      `
      SELECT *
      FROM grc_observations
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      LIMIT 1
      `,
      [tenantId, assertUuid(observationId, 'OBSERVATION_ID_INVALID')]
    );
    if (result.rowCount === 0) {
      throw publicError(GrcError, 404, 'OBSERVATION_NOT_FOUND', 'Observation no encontrada para el tenant autenticado.');
    }
    return result.rows[0];
  }

  async function createObservation({ tenantId, userId, body, correlationId }) {
    const normalized = normalizePayload({ ...body, correlation_id: body?.correlation_id || correlationId }, tenantId, userId, GrcError);
    const source = await validateSource(tenantId, normalized.source_type, normalized.source_id);

    return withTransaction(async (client) => {
      const inserted = await client.query(
        `
        INSERT INTO grc_observations (
          tenant_id, observation_key, observation_hash, observation_type, domain, title, description,
          status, severity, source_type, source_id, source_reference, observed_at, effective_from,
          effective_to, owner_user_id, responsible_user_id, created_by, metadata, correlation_id
        )
        VALUES (
          $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12::jsonb,$13::timestamptz,$14::timestamptz,
          $15::timestamptz,$16::uuid,$17::uuid,$18::uuid,$19::jsonb,$20
        )
        ON CONFLICT (tenant_id, observation_key) DO NOTHING
        RETURNING *
        `,
        [
          tenantId,
          normalized.observation_key,
          normalized.observation_hash,
          normalized.observation_type,
          normalized.domain,
          normalized.title,
          normalized.description,
          normalized.status,
          normalized.severity,
          normalized.source_type,
          normalized.source_id,
          json({ ...normalized.source_reference, ...source }),
          normalized.observed_at,
          normalized.effective_from,
          normalized.effective_to,
          normalized.owner_user_id,
          normalized.responsible_user_id,
          userId,
          json(normalized.metadata),
          normalized.correlation_id,
        ]
      );

      if (inserted.rowCount === 0) {
        const existing = await client.query(
          `
          SELECT *
          FROM grc_observations
          WHERE tenant_id = $1::uuid
            AND observation_key = $2
          LIMIT 1
          `,
          [tenantId, normalized.observation_key]
        );
        return { ...existing.rows[0], idempotent_replay: true };
      }

      const observation = inserted.rows[0];
      await audit(client, {
        tenantId,
        userId,
        action: 'grc.observation.created',
        tableName: 'grc_observations',
        recordId: observation.id,
        newData: observation,
        metadata: { correlation_id: correlationId, source },
      });
      observe('observation_created', { tenantId, correlationId, entityType: normalized.domain, entityId: observation.id });
      return observation;
    });
  }

  async function updateObservation({ tenantId, userId, observationId, body, correlationId }) {
    const current = await getObservation(tenantId, observationId);
    const severity = body.severity === undefined ? current.severity : asText(body.severity, 80);
    if (!OBSERVATION_SEVERITIES.has(severity)) {
      throw publicError(GrcError, 400, 'OBSERVATION_SEVERITY_INVALID', 'severity inválida.');
    }

    return withTransaction(async (client) => {
      const result = await client.query(
        `
        UPDATE grc_observations
        SET title = COALESCE($1, title),
            description = $2,
            severity = $3,
            owner_user_id = $4::uuid,
            responsible_user_id = $5::uuid,
            metadata = $6::jsonb,
            updated_at = now()
        WHERE tenant_id = $7::uuid
          AND id = $8::uuid
        RETURNING *
        `,
        [
          asText(body.title, 300),
          body.description === undefined ? current.description : asText(body.description, 4000),
          severity,
          body.owner_user_id === undefined ? current.owner_user_id : optionalUuid(body.owner_user_id, 'owner_user_id', GrcError),
          body.responsible_user_id === undefined ? current.responsible_user_id : optionalUuid(body.responsible_user_id, 'responsible_user_id', GrcError),
          json({ ...(current.metadata || {}), ...asObject(body.metadata, {}) }),
          tenantId,
          observationId,
        ]
      );
      const updated = result.rows[0];
      await audit(client, {
        tenantId,
        userId,
        action: 'grc.observation.updated',
        tableName: 'grc_observations',
        recordId: observationId,
        oldData: current,
        newData: updated,
        metadata: { correlation_id: correlationId },
      });
      return updated;
    });
  }

  async function transitionObservation({ tenantId, userId, observationId, body, correlationId }) {
    const current = await getObservation(tenantId, observationId);
    const nextStatus = asText(body.status, 80);
    if (!OBSERVATION_STATUSES.has(nextStatus)) {
      throw publicError(GrcError, 400, 'OBSERVATION_STATUS_INVALID', 'status inválido.');
    }
    if (nextStatus !== current.status && !STATUS_TRANSITIONS[current.status]?.has(nextStatus)) {
      throw publicError(GrcError, 409, 'OBSERVATION_TRANSITION_INVALID', 'Transición de estado no permitida.');
    }

    return withTransaction(async (client) => {
      const result = await client.query(
        `
        UPDATE grc_observations
        SET status = $1,
            metadata = metadata || $2::jsonb,
            updated_at = now()
        WHERE tenant_id = $3::uuid
          AND id = $4::uuid
        RETURNING *
        `,
        [
          nextStatus,
          json({
            last_transition: {
              from: current.status,
              to: nextStatus,
              reason: asText(body.reason, 1000),
              at: new Date().toISOString(),
            },
          }),
          tenantId,
          observationId,
        ]
      );
      const updated = result.rows[0];
      await audit(client, {
        tenantId,
        userId,
        action: 'grc.observation.transitioned',
        tableName: 'grc_observations',
        recordId: observationId,
        oldData: { status: current.status },
        newData: { status: nextStatus },
        metadata: { correlation_id: correlationId, reason: asText(body.reason, 1000) },
      });
      observe('observation_transitioned', { tenantId, correlationId, entityType: updated.domain, entityId: observationId });
      return updated;
    });
  }

  async function linkObservation({ tenantId, userId, observationId, body, correlationId }) {
    await getObservation(tenantId, observationId);
    const targetType = asText(body.target_type, 80);
    const targetId = asText(body.target_id, 80);
    const relationType = asText(body.relation_type, 80) || 'relates_to';
    const source = asText(body.source, 80) || 'manual';

    if (!SOURCE_TYPES.has(targetType) || targetType === 'manual') {
      throw publicError(GrcError, 400, 'OBSERVATION_LINK_TARGET_TYPE_INVALID', 'target_type inválido.');
    }
    if (!RELATION_TYPES.has(relationType)) {
      throw publicError(GrcError, 400, 'OBSERVATION_LINK_RELATION_INVALID', 'relation_type inválido.');
    }
    if (!LINK_SOURCES.has(source)) {
      throw publicError(GrcError, 400, 'OBSERVATION_LINK_SOURCE_INVALID', 'source inválido.');
    }
    const target = await validateSource(tenantId, targetType, targetId);

    return withTransaction(async (client) => {
      const result = await client.query(
        `
        INSERT INTO grc_observation_links (
          tenant_id, observation_id, target_type, target_id, relation_type, source, metadata, created_by
        )
        VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7::jsonb,$8::uuid)
        ON CONFLICT DO NOTHING
        RETURNING *
        `,
        [
          tenantId,
          observationId,
          targetType,
          targetId,
          relationType,
          source,
          json({ ...asObject(body.metadata, {}), target }),
          userId,
        ]
      );
      if (result.rowCount === 0) {
        throw publicError(GrcError, 409, 'OBSERVATION_LINK_ALREADY_EXISTS', 'La relación ya existe.');
      }
      const link = result.rows[0];
      await audit(client, {
        tenantId,
        userId,
        action: 'grc.observation.linked',
        tableName: 'grc_observation_links',
        recordId: link.id,
        newData: link,
        metadata: { correlation_id: correlationId, observation_id: observationId },
      });
      return link;
    });
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
