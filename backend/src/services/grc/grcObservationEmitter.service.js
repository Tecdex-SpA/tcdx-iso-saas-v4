'use strict';

const crypto = require('crypto');
const pool = require('../../config/db');
const semanticLayer = require('../semantic/semanticLayer.service');

const OUTBOX_SOURCE_MODULE = 'grc_observation_emitter';
const PRODUCER_OFFICIAL_CALCULATION = 'official_calculation';
const RULE_OFFICIAL_CALCULATION_DATA_TRUST = Object.freeze({
  rule_code: 'official_calculation.data_trust_attention',
  rule_version: 1,
  producer_type: PRODUCER_OFFICIAL_CALCULATION,
  observation_type: 'official_calculation.data_trust_attention',
  entity_type: 'official_formula',
});

const MATERIAL_DATA_TRUST_STATES = Object.freeze({
  TRUSTED_WITH_WARNINGS: 'low',
  LOW_CONFIDENCE: 'medium',
});

const NON_ELIGIBLE_SOURCE_STATUSES = new Set([
  'source_unavailable',
  'source_incompatible',
  'SOURCE_SCHEMA_INCOMPATIBLE',
  'FORMULA_DEPENDENCY_PENDING',
  'SOURCE_DATA_INSUFFICIENT',
  'FORMULA_VARIABLE_REQUIRED',
  'FORMULA_ZERO_WEIGHTS',
  'dependency_pending',
  'not_calculable',
  'unmeasured',
  'failed',
]);

const FINAL_STATUSES = new Set(['ignored', 'completed', 'dead_letter']);

class ObservationEmitterError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'ObservationEmitterError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function text(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
}

function uuid(value, field) {
  const normalized = text(value);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(normalized || ''))) {
    throw new ObservationEmitterError('OBSERVATION_EMITTER_UUID_INVALID', `${field} inválido.`, 422, { field });
  }
  return normalized;
}

function tenantId(scopeOrValue) {
  const value = typeof scopeOrValue === 'string' ? scopeOrValue : (scopeOrValue?.tenant_id || scopeOrValue?.tenantId || scopeOrValue?.tenant);
  if (!value) throw new ObservationEmitterError('OBSERVATION_EMITTER_TENANT_REQUIRED', 'La emisión de observaciones requiere tenant efectivo.', 403);
  return uuid(value, 'tenant_id');
}

function actorId(scopeOrValue) {
  const value = typeof scopeOrValue === 'string' ? scopeOrValue : (scopeOrValue?.user?.user_id || scopeOrValue?.user?.userId || scopeOrValue?.user?.id || scopeOrValue?.user_id || scopeOrValue?.userId);
  return value ? uuid(value, 'user_id') : null;
}

function json(value, fallback = {}) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function observedAtFor(result = {}) {
  return text(result.observed_at || result.completed_at || result.period?.as_of || result.period?.end || result.period?.period_end, null);
}

function periodStartFor(result = {}) {
  return text(result.period_start || result.period?.start || result.period?.period_start, null);
}

function periodEndFor(result = {}) {
  return text(result.period_end || result.period?.end || result.period?.period_end, null);
}

function dataTrustState(result = {}) {
  return text(result.data_trust?.state || result.details?.data_trust?.state || result.metadata?.data_trust?.state, null);
}

function dataTrustScore(result = {}) {
  const value = result.data_trust?.score ?? result.details?.data_trust?.score ?? result.trust_score ?? null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function numericValue(result = {}) {
  const value = result.value ?? result.numeric_value ?? result.output_value?.value ?? null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sourceStatusFor(result = {}) {
  return text(result.source_status || result.source_contract_status || result.status || result.run_status, null);
}

function machineReasonFor(result = {}) {
  return text(result.machine_reason || result.code || result.failure_type || result.metadata?.machine_reason, null);
}

function ruleRegistry() {
  return [RULE_OFFICIAL_CALCULATION_DATA_TRUST];
}

function materialityForOfficialCalculation(result = {}) {
  const sourceStatus = sourceStatusFor(result);
  const machineReason = machineReasonFor(result);
  if (sourceStatus && NON_ELIGIBLE_SOURCE_STATUSES.has(sourceStatus)) {
    return { eligible: false, reason: sourceStatus };
  }
  if (machineReason && NON_ELIGIBLE_SOURCE_STATUSES.has(machineReason)) {
    return { eligible: false, reason: machineReason };
  }
  if (text(result.status || result.run_status) !== 'calculated') {
    return { eligible: false, reason: 'not_calculated' };
  }
  const observedAt = observedAtFor(result);
  if (!observedAt) return { eligible: false, reason: 'observed_at_missing' };
  if (!result.calculation_run_id && !result.producer_id) return { eligible: false, reason: 'producer_id_missing' };
  const state = dataTrustState(result);
  if (!Object.prototype.hasOwnProperty.call(MATERIAL_DATA_TRUST_STATES, state)) {
    return { eligible: false, reason: state === 'TRUSTED' ? 'trusted_no_material_signal' : 'data_trust_not_material' };
  }
  return { eligible: true, severity_value: MATERIAL_DATA_TRUST_STATES[state], observed_at: observedAt };
}

function officialCalculationIdentity({ tenant, result, rule }) {
  return {
    tenant_id: tenant,
    producer_type: rule.producer_type,
    rule_code: rule.rule_code,
    rule_version: rule.rule_version,
    formula_code: text(result.formula_code),
    formula_version: Number(result.formula_version || 1),
    period_start: periodStartFor(result),
    period_end: periodEndFor(result),
    source_contract: text(result.source_contract || result.source_code),
  };
}

function buildOfficialCalculationEvent(scope, result = {}, correlationId = null, sourceSnapshotId = null) {
  const tenant = tenantId(scope);
  const user = actorId(scope);
  const rule = RULE_OFFICIAL_CALCULATION_DATA_TRUST;
  const producerId = uuid(result.calculation_run_id || result.producer_id, 'calculation_run_id');
  const eligibility = materialityForOfficialCalculation({ ...result, calculation_run_id: producerId });
  const identity = officialCalculationIdentity({ tenant, result, rule });
  const idempotencyKey = stableHash({
    ...identity,
    producer_id: producerId,
    source_snapshot_id: sourceSnapshotId || result.snapshot_id || result.source_snapshot_id || null,
  });
  const observedAt = eligibility.observed_at || observedAtFor(result);
  const eventPayload = {
    tenant_id: tenant,
    producer_type: rule.producer_type,
    producer_id: producerId,
    event_type: 'observation.emit.official_calculation',
    aggregate_type: 'calculation_run',
    aggregate_id: producerId,
    source_table: 'calculation_runs',
    source_record_id: producerId,
    source_snapshot_id: sourceSnapshotId || result.snapshot_id || result.source_snapshot_id || null,
    rule_code: rule.rule_code,
    rule_version: rule.rule_version,
    idempotency_key: idempotencyKey,
    observation_identity: identity,
    observed_at: observedAt,
    period_start: periodStartFor(result),
    period_end: periodEndFor(result),
    correlation_id: text(correlationId || result.correlation_id, null),
    created_by: user,
    eligible: eligibility.eligible,
    non_eligibility_reason: eligibility.reason || null,
    payload: {
      formula_code: text(result.formula_code),
      formula_version: Number(result.formula_version || 1),
      display_name: text(result.display_name),
      domain: text(result.domain),
      value: numericValue(result),
      unit: text(result.unit),
      status: text(result.status),
      source_status: sourceStatusFor(result),
      machine_reason: machineReasonFor(result),
      data_trust: result.data_trust || null,
      decision: result.decision || null,
      source_code: text(result.source_code),
      source_contract: text(result.source_contract || result.source_code),
      physical_sources: result.physical_sources || [],
      source_counts: result.source_counts || null,
      warnings: result.warnings || [],
    },
  };
  return eventPayload;
}

function observationBodyFromEvent(event) {
  const payload = event.payload || {};
  const trustScore = dataTrustScore(payload);
  const trustState = dataTrustState(payload);
  return {
    observation_type: RULE_OFFICIAL_CALCULATION_DATA_TRUST.observation_type,
    entity_type: RULE_OFFICIAL_CALCULATION_DATA_TRUST.entity_type,
    observed_at: event.observed_at,
    period_start: event.period_start,
    period_end: event.period_end,
    status_value: 'open',
    severity_value: MATERIAL_DATA_TRUST_STATES[trustState] || 'medium',
    numeric_value: payload.value,
    unit: payload.unit,
    source_table: event.source_table,
    source_record_id: event.source_record_id,
    source_identity: event.observation_identity,
    correlation_id: event.correlation_id,
    trust_score: trustScore,
    metadata: {
      producer_type: event.producer_type,
      producer_id: event.producer_id,
      source_snapshot_id: event.source_snapshot_id,
      rule_code: event.rule_code,
      rule_version: event.rule_version,
      formula_code: payload.formula_code,
      formula_version: payload.formula_version,
      source_status: payload.source_status,
      machine_reason: payload.machine_reason,
      data_trust: payload.data_trust,
      decision: payload.decision,
      physical_sources: payload.physical_sources,
      source_counts: payload.source_counts,
      warnings: payload.warnings,
      outbox_event_id: event.id,
      outbox_source_module: OUTBOX_SOURCE_MODULE,
    },
  };
}

function publicEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    event_type: row.event_type,
    producer_type: row.producer_type,
    producer_id: row.producer_id,
    source_table: row.source_table,
    source_record_id: row.source_record_id,
    source_snapshot_id: row.source_snapshot_id,
    rule_code: row.rule_code,
    rule_version: row.rule_version,
    idempotency_key: row.idempotency_key,
    status: row.status,
    attempts: row.attempts,
    observed_at: row.observed_at,
    period_start: row.period_start,
    period_end: row.period_end,
    correlation_id: row.correlation_id,
    observation_id: row.observation_id || null,
    result: row.result || {},
    metadata: row.metadata || {},
  };
}

function createObservationEmitterService(database = pool, { semantic = semanticLayer } = {}) {
  async function validateOfficialCalculationSource(client, event) {
    const result = await client.query(
      `SELECT cr.id, cr.tenant_id,
              CASE WHEN $3::uuid IS NULL THEN TRUE ELSE EXISTS (
                SELECT 1 FROM calculation_snapshots cs
                WHERE cs.tenant_id=cr.tenant_id AND cs.run_id=cr.id AND cs.id=$3::uuid
              ) END AS snapshot_matches
         FROM calculation_runs cr
        WHERE cr.tenant_id=$1::uuid AND cr.id=$2::uuid
        LIMIT 1`,
      [event.tenant_id, event.producer_id, event.source_snapshot_id || null]
    );
    if (!result.rowCount) {
      throw new ObservationEmitterError('OBSERVATION_EMITTER_SOURCE_NOT_FOUND', 'El cálculo oficial no pertenece al tenant de emisión.', 404, { producer_id: event.producer_id });
    }
    if (result.rows[0].snapshot_matches !== true) {
      throw new ObservationEmitterError('OBSERVATION_EMITTER_SNAPSHOT_TENANT_MISMATCH', 'El snapshot de fuente no pertenece al cálculo/tenant de emisión.', 409, { source_snapshot_id: event.source_snapshot_id });
    }
  }

  async function enqueueEvent(event) {
    const status = event.eligible ? 'pending' : 'ignored';
    const result = event.eligible ? {} : { ignored_reason: event.non_eligibility_reason };
    const inserted = await database.query(
      `INSERT INTO grc_observation_emission_outbox (
         tenant_id,event_type,producer_type,producer_id,aggregate_type,aggregate_id,source_table,source_record_id,
         source_snapshot_id,rule_code,rule_version,idempotency_key,observation_identity,observed_at,period_start,period_end,
         status,correlation_id,payload,result,created_by,metadata
       ) VALUES (
         $1::uuid,$2,$3,$4::uuid,$5,$6::uuid,$7,$8,$9::uuid,$10,$11,$12,$13::jsonb,$14::timestamptz,$15::timestamptz,$16::timestamptz,
         $17,$18,$19::jsonb,$20::jsonb,$21::uuid,$22::jsonb
       )
       ON CONFLICT (tenant_id,idempotency_key) DO NOTHING
       RETURNING *`,
      [
        event.tenant_id, event.event_type, event.producer_type, event.producer_id, event.aggregate_type, event.aggregate_id,
        event.source_table, event.source_record_id, event.source_snapshot_id, event.rule_code, event.rule_version,
        event.idempotency_key, json(event.observation_identity), event.observed_at, event.period_start, event.period_end,
        status, event.correlation_id, json(event.payload), json(result), event.created_by,
        json({ source_module: OUTBOX_SOURCE_MODULE, non_eligibility_reason: event.non_eligibility_reason }),
      ]
    );
    if (inserted.rowCount) return { event: inserted.rows[0], reused: false };
    const existing = await database.query(
      'SELECT * FROM grc_observation_emission_outbox WHERE tenant_id=$1::uuid AND idempotency_key=$2 LIMIT 1',
      [event.tenant_id, event.idempotency_key]
    );
    return { event: existing.rows[0], reused: true };
  }

  async function enqueueOfficialCalculationResult(scope, result = {}, correlationId = null, sourceSnapshotId = null) {
    const event = buildOfficialCalculationEvent(scope, result, correlationId, sourceSnapshotId);
    return enqueueEvent(event);
  }

  async function processOutboxEvent(scope, eventId) {
    const tenant = tenantId(scope);
    const user = actorId(scope);
    const client = await database.connect();
    let event;
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT * FROM grc_observation_emission_outbox
          WHERE id=$1::uuid AND tenant_id=$2::uuid
          FOR UPDATE`,
        [uuid(eventId, 'event_id'), tenant]
      );
      if (!locked.rowCount) throw new ObservationEmitterError('OBSERVATION_EMITTER_EVENT_NOT_FOUND', 'Evento de emisión no encontrado.', 404);
      event = locked.rows[0];
      if (FINAL_STATUSES.has(event.status)) {
        await client.query('COMMIT');
        return { event: publicEvent(event), reused: true, observation: null };
      }
      if (event.status === 'processing') {
        await client.query('COMMIT');
        return { event: publicEvent(event), reused: true, observation: null };
      }
      await validateOfficialCalculationSource(client, event);
      const attempts = Number(event.attempts || 0) + 1;
      const processing = await client.query(
        `UPDATE grc_observation_emission_outbox
            SET status='processing', attempts=$3, locked_at=now(), updated_at=now(), last_error=NULL
          WHERE id=$1::uuid AND tenant_id=$2::uuid
          RETURNING *`,
        [event.id, tenant, attempts]
      );
      event = processing.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      client.release();
      throw error;
    }
    client.release();

    try {
      const observation = await semantic.createManualObservation(
        { tenant_id: tenant, user: { id: user } },
        observationBodyFromEvent(event),
        event.correlation_id
      );
      const completed = await database.query(
        `UPDATE grc_observation_emission_outbox
            SET status='completed', observation_id=$3::uuid, processed_at=now(), updated_at=now(),
                result=$4::jsonb
          WHERE id=$1::uuid AND tenant_id=$2::uuid
          RETURNING *`,
        [event.id, tenant, observation.id, json({ observation_id: observation.id, idempotent_replay: observation.idempotent_replay === true })]
      );
      return { event: publicEvent(completed.rows[0]), observation };
    } catch (error) {
      const nextStatus = Number(event.attempts || 0) >= Number(event.max_attempts || 3) ? 'dead_letter' : 'failed';
      const failed = await database.query(
        `UPDATE grc_observation_emission_outbox
            SET status=$3, last_error=$4::jsonb, next_attempt_at=now() + make_interval(secs => LEAST(3600, POWER(2, attempts)::int * 60)), updated_at=now()
          WHERE id=$1::uuid AND tenant_id=$2::uuid
          RETURNING *`,
        [event.id, tenant, nextStatus, json({ code: error.code || 'OBSERVATION_EMISSION_FAILED', message: String(error.message || error).slice(0, 500) })]
      );
      return { event: publicEvent(failed.rows[0]), error };
    }
  }

  async function processNextPending(scope) {
    const tenant = tenantId(scope);
    const next = await database.query(
      `SELECT id FROM grc_observation_emission_outbox
        WHERE tenant_id=$1::uuid
          AND status IN ('pending','failed')
          AND next_attempt_at <= now()
        ORDER BY created_at ASC
        LIMIT 1`,
      [tenant]
    );
    if (!next.rowCount) return null;
    return processOutboxEvent(scope, next.rows[0].id);
  }

  async function emitOfficialCalculationResult(scope, result = {}, correlationId = null, sourceSnapshotId = null) {
    const queued = await enqueueOfficialCalculationResult(scope, result, correlationId, sourceSnapshotId);
    if (!queued.event || FINAL_STATUSES.has(queued.event.status)) {
      return { event: publicEvent(queued.event), reused: queued.reused, observation: null };
    }
    const processed = await processOutboxEvent(scope, queued.event.id);
    return { ...processed, reused: queued.reused || processed.reused === true };
  }

  return {
    buildOfficialCalculationEvent,
    enqueueOfficialCalculationResult,
    processOutboxEvent,
    processNextPending,
    emitOfficialCalculationResult,
    ruleRegistry,
  };
}

module.exports = {
  ObservationEmitterError,
  MATERIAL_DATA_TRUST_STATES,
  NON_ELIGIBLE_SOURCE_STATUSES,
  RULE_OFFICIAL_CALCULATION_DATA_TRUST,
  buildOfficialCalculationEvent,
  createObservationEmitterService,
  defaultService: createObservationEmitterService(),
};
