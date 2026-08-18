'use strict';

const crypto = require('crypto');

const GAP_MODEL_VERSION = 'grc-canonical-gap-model-v1';
const DEFAULT_GAP_RULE_CODE = 'observation.data_trust_attention_gap';
const DEFAULT_GAP_RULE_VERSION = 1;

const GAP_STATUSES = new Set(['open', 'acknowledged', 'in_treatment', 'verified', 'closed']);
const GAP_SEVERITIES = new Set(['informational', 'low', 'medium', 'high', 'critical']);
const NON_MATERIAL_DATA_STATES = new Set([
  'INSUFFICIENT_DATA',
  'UNTRUSTED',
  'SOURCE_SCHEMA_INCOMPATIBLE',
  'SOURCE_DATA_INSUFFICIENT',
  'FORMULA_DEPENDENCY_PENDING',
  'FORMULA_VARIABLE_REQUIRED',
  'FORMULA_ZERO_WEIGHTS',
  'source_unavailable',
  'source_incompatible',
  'not_calculable',
  'unmeasured',
]);

const STATUS_TRANSITIONS = Object.freeze({
  open: new Set(['acknowledged', 'in_treatment', 'verified', 'closed']),
  acknowledged: new Set(['in_treatment', 'verified', 'closed']),
  in_treatment: new Set(['verified', 'closed', 'open']),
  verified: new Set(['closed', 'in_treatment', 'open']),
  closed: new Set(['open']),
});

function asText(value, max = 255) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
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

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function publicError(GrcError, status, code, message, details = null) {
  return new GrcError(code, message, status, details);
}

function parseTimestamp(value, field, GrcError) {
  const text = asText(value, 120);
  if (!text) throw publicError(GrcError, 400, 'GAP_TIMESTAMP_REQUIRED', `${field} es obligatorio.`);
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) throw publicError(GrcError, 400, 'GAP_TIMESTAMP_INVALID', `${field} inválido.`);
  return date.toISOString();
}

function parseOptionalTimestamp(value, field, GrcError) {
  return value ? parseTimestamp(value, field, GrcError) : null;
}

function rulePayload(rule = {}) {
  return {
    rule_code: rule.rule_code,
    rule_version: Number(rule.rule_version),
    rule_type: rule.rule_type,
    input_observation_type: rule.input_observation_type,
    gap_type: rule.gap_type,
  };
}

function observationTrustState(observation = {}) {
  const metadata = asObject(observation.metadata);
  return asText(metadata.data_trust?.state || metadata.grc_facade?.data_trust?.state || metadata.source_status || metadata.machine_reason, 120);
}

function isObservationEligibleForRule(observation = {}, rule = {}) {
  if (observation.is_current !== true) return { eligible: false, reason: 'observation_not_current' };
  if (observation.observation_type !== rule.input_observation_type) return { eligible: false, reason: 'observation_type_not_matched' };
  if (observation.quality_status === 'failed') return { eligible: false, reason: 'observation_quality_failed' };
  const state = observationTrustState(observation);
  if (state && NON_MATERIAL_DATA_STATES.has(state)) return { eligible: false, reason: state };
  const metadata = asObject(observation.metadata);
  const dataTrustState = asText(metadata.data_trust?.state, 80);
  if (!['TRUSTED_WITH_WARNINGS', 'LOW_CONFIDENCE'].includes(dataTrustState)) {
    return { eligible: false, reason: dataTrustState === 'TRUSTED' ? 'trusted_no_gap_condition' : 'data_trust_not_material' };
  }
  const severity = asText(observation.severity_value, 80);
  if (!GAP_SEVERITIES.has(severity) || severity === 'informational') return { eligible: false, reason: 'severity_not_material' };
  return { eligible: true };
}

function gapIdentity({ tenantId, rule, observation }) {
  return {
    tenant_id: tenantId,
    rule_code: rule.rule_code,
    rule_version: Number(rule.rule_version),
    gap_type: rule.gap_type,
    source_identity_hash: observation.source_identity_hash,
    affected_entity_type: observation.entity_type,
    affected_entity_id: observation.entity_id || null,
  };
}

function projectGap(row = {}) {
  return {
    ...row,
    model_version: GAP_MODEL_VERSION,
    deterministic: true,
    ai_created: false,
  };
}

function createGrcGapService(pool, {
  GrcError,
  assertUuid,
  observe = () => null,
  audit = null,
  json = JSON.stringify,
} = {}) {
  function uuid(value, field = 'GAP_ID_INVALID') {
    return assertUuid ? assertUuid(value, field) : asText(value, 80);
  }

  async function getRule(client, tenantId, ruleCode = DEFAULT_GAP_RULE_CODE, ruleVersion = DEFAULT_GAP_RULE_VERSION) {
    const result = await client.query(
      `SELECT *
         FROM grc_gap_rules
        WHERE (tenant_id=$1::uuid OR tenant_id IS NULL)
          AND rule_code=$2
          AND rule_version=$3
          AND status='published'
          AND enabled=TRUE
        ORDER BY tenant_id NULLS LAST
        LIMIT 1`,
      [tenantId, ruleCode, Number(ruleVersion)]
    );
    if (!result.rowCount) throw publicError(GrcError, 404, 'GAP_RULE_NOT_FOUND', 'Regla de brecha no encontrada.');
    return result.rows[0];
  }

  async function getObservation(client, tenantId, observationId) {
    const result = await client.query(
      `SELECT *
         FROM grc_observations
        WHERE tenant_id=$1::uuid
          AND id=$2::uuid
        LIMIT 1`,
      [tenantId, uuid(observationId, 'OBSERVATION_ID_INVALID')]
    );
    if (!result.rowCount) throw publicError(GrcError, 404, 'GAP_SOURCE_OBSERVATION_NOT_FOUND', 'Observation fuente no encontrada para el tenant.');
    return result.rows[0];
  }

  async function insertHistory(client, { tenantId, gapId, fromStatus, toStatus, transitionType, userId, observationId, rule, reason, correlationId, metadata = {} }) {
    await client.query(
      `INSERT INTO grc_gap_status_history (
         tenant_id,gap_id,from_status,to_status,transition_type,actor_id,
         source_observation_id,rule_code,rule_version,reason,correlation_id,metadata
       ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7::uuid,$8,$9,$10,$11,$12::jsonb)`,
      [
        tenantId, gapId, fromStatus || null, toStatus, transitionType, userId || null,
        observationId || null, rule.rule_code, Number(rule.rule_version), reason || null,
        correlationId || null, json(metadata),
      ]
    );
  }

  async function relateObservationToGap(client, { tenantId, userId, observationId, gap, observedAt, correlationId }) {
    await client.query(
      `INSERT INTO grc_observation_relations (
         tenant_id,observation_id,related_entity_type,related_entity_id,
         relation_type,confidence,valid_from,valid_until,created_by,metadata
       ) VALUES ($1::uuid,$2::uuid,'grc_gap',$3::uuid,'supports',1,$4::timestamptz,NULL,$5::uuid,$6::jsonb)
       ON CONFLICT (tenant_id,observation_id,related_entity_type,related_entity_id,relation_type)
       DO UPDATE SET
         confidence=EXCLUDED.confidence,
         valid_until=NULL,
         metadata=grc_observation_relations.metadata || EXCLUDED.metadata
       RETURNING *`,
      [
        tenantId,
        observationId,
        gap.id,
        observedAt,
        userId || null,
        json({
          model_version: GAP_MODEL_VERSION,
          relation_owner: 'grc_gap_service',
          rule_code: gap.rule_code,
          rule_version: Number(gap.rule_version),
          correlation_id: correlationId || null,
        }),
      ]
    );
  }

  async function evaluateObservation({ tenantId, userId, observationId, ruleCode = DEFAULT_GAP_RULE_CODE, ruleVersion = DEFAULT_GAP_RULE_VERSION, correlationId = null }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const observation = await getObservation(client, tenantId, observationId);
      const rule = await getRule(client, tenantId, ruleCode, ruleVersion);
      const eligibility = isObservationEligibleForRule(observation, rule);
      if (!eligibility.eligible) {
        await client.query('COMMIT');
        return { status: 'ignored', reason: eligibility.reason, gap: null, rule: rulePayload(rule) };
      }

      const observedAt = parseTimestamp(observation.observed_at, 'observation.observed_at', GrcError);
      const identity = gapIdentity({ tenantId, rule, observation });
      const gapKey = sha256(identity);
      const existing = await client.query(
        `SELECT *
           FROM grc_gaps
          WHERE tenant_id=$1::uuid
            AND gap_key=$2
          FOR UPDATE`,
        [tenantId, gapKey]
      );
      const metadata = {
        model_version: GAP_MODEL_VERSION,
        identity,
        source_observation: {
          id: observation.id,
          observation_type: observation.observation_type,
          source_identity_hash: observation.source_identity_hash,
          source_snapshot_id: observation.source_snapshot_id || null,
          observed_at: observedAt,
        },
        rule: rulePayload(rule),
        data_trust: asObject(observation.metadata).data_trust || null,
        hypothesis: false,
      };

      let gap;
      let transitionType = 'evaluation_confirmed';
      if (!existing.rowCount) {
        const inserted = await client.query(
          `INSERT INTO grc_gaps (
             tenant_id,gap_key,gap_type,rule_id,rule_code,rule_version,
             source_observation_id,latest_source_observation_id,affected_entity_type,affected_entity_id,
             severity,status,first_seen,last_seen,last_evaluated_at,correlation_id,created_by,updated_by,metadata
           ) VALUES (
             $1::uuid,$2,$3,$4::uuid,$5,$6,$7::uuid,$7::uuid,$8,$9::uuid,
             $10,'open',$11::timestamptz,$11::timestamptz,now(),$12,$13::uuid,$13::uuid,$14::jsonb
           )
           RETURNING *`,
          [
            tenantId, gapKey, rule.gap_type, rule.id, rule.rule_code, Number(rule.rule_version),
            observation.id, observation.entity_type, observation.entity_id || null, observation.severity_value,
            observedAt, correlationId, userId || null, json(metadata),
          ]
        );
        gap = inserted.rows[0];
        transitionType = 'evaluation_created';
      } else {
        const current = existing.rows[0];
        const nextStatus = current.status === 'closed' || current.status === 'verified' ? 'open' : current.status;
        const updated = await client.query(
          `UPDATE grc_gaps
              SET latest_source_observation_id=$3::uuid,
                  severity=$4,
                  status=$5,
                  last_seen=GREATEST(last_seen,$6::timestamptz),
                  last_evaluated_at=now(),
                  resolved_at=CASE WHEN $5='open' THEN NULL ELSE resolved_at END,
                  verified_at=CASE WHEN $5='open' THEN NULL ELSE verified_at END,
                  correlation_id=COALESCE($7, correlation_id),
                  updated_by=$8::uuid,
                  metadata=metadata || $9::jsonb
            WHERE tenant_id=$1::uuid
              AND id=$2::uuid
            RETURNING *`,
          [tenantId, current.id, observation.id, observation.severity_value, nextStatus, observedAt, correlationId, userId || null, json(metadata)]
        );
        gap = updated.rows[0];
        transitionType = nextStatus === 'open' && current.status !== 'open' ? 'reopened' : 'evaluation_confirmed';
      }

      await insertHistory(client, {
        tenantId,
        gapId: gap.id,
        fromStatus: existing.rows[0]?.status || null,
        toStatus: gap.status,
        transitionType,
        userId,
        observationId: observation.id,
        rule,
        reason: transitionType,
        correlationId,
        metadata,
      });
      if (audit) {
        await audit(client, {
          tenantId,
          userId,
          action: transitionType === 'evaluation_created' ? 'grc.gap.created' : 'grc.gap.evaluated',
          tableName: 'grc_gaps',
          recordId: gap.id,
          oldData: existing.rows[0] || null,
          newData: gap,
          metadata: { correlation_id: correlationId, source_observation_id: observation.id, rule_code: rule.rule_code, rule_version: rule.rule_version },
        });
      }
      await relateObservationToGap(client, { tenantId, userId, observationId: observation.id, gap, observedAt, correlationId });
      await client.query('COMMIT');
      observe('gap_evaluated', { tenantId, correlationId, gapId: gap.id, ruleCode: rule.rule_code, status: gap.status });
      return { status: transitionType === 'evaluation_created' ? 'created' : 'updated', gap: projectGap(gap), rule: rulePayload(rule) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function listGaps({ tenantId, filters = {} }) {
    const result = await pool.query(
      `SELECT *
         FROM grc_gaps
        WHERE tenant_id=$1::uuid
          AND ($2::text IS NULL OR status=$2)
          AND ($3::text IS NULL OR gap_type=$3)
          AND ($4::text IS NULL OR severity=$4)
        ORDER BY last_seen DESC, created_at DESC
        LIMIT $5`,
      [tenantId, asText(filters.status, 80), asText(filters.gap_type, 120), asText(filters.severity, 80), Math.max(1, Math.min(Number(filters.limit) || 50, 100))]
    );
    return { data: result.rows.map(projectGap), model_version: GAP_MODEL_VERSION };
  }

  async function getGap(tenantId, gapId) {
    const result = await pool.query(
      `SELECT *
         FROM grc_gaps
        WHERE tenant_id=$1::uuid
          AND id=$2::uuid
        LIMIT 1`,
      [tenantId, uuid(gapId, 'GAP_ID_INVALID')]
    );
    if (!result.rowCount) throw publicError(GrcError, 404, 'GAP_NOT_FOUND', 'Gap no encontrado para el tenant autenticado.');
    return projectGap(result.rows[0]);
  }

  async function transitionGap({ tenantId, userId, gapId, body = {}, correlationId = null }) {
    const nextStatus = asText(body.status, 80);
    if (!GAP_STATUSES.has(nextStatus)) throw publicError(GrcError, 400, 'GAP_STATUS_INVALID', 'Estado de gap inválido.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT *
           FROM grc_gaps
          WHERE tenant_id=$1::uuid
            AND id=$2::uuid
          FOR UPDATE`,
        [tenantId, uuid(gapId, 'GAP_ID_INVALID')]
      );
      if (!current.rowCount) throw publicError(GrcError, 404, 'GAP_NOT_FOUND', 'Gap no encontrado para el tenant autenticado.');
      const gap = current.rows[0];
      if (nextStatus !== gap.status && !STATUS_TRANSITIONS[gap.status]?.has(nextStatus)) {
        throw publicError(GrcError, 409, 'GAP_TRANSITION_INVALID', 'Transición de Gap no permitida.');
      }
      const rule = { rule_code: gap.rule_code, rule_version: gap.rule_version };
      const updated = await client.query(
        `UPDATE grc_gaps
            SET status=$3,
                resolved_at=CASE WHEN $3='closed' THEN COALESCE(resolved_at, now()) WHEN $3='open' THEN NULL ELSE resolved_at END,
                verified_at=CASE WHEN $3='verified' THEN COALESCE(verified_at, now()) WHEN $3='open' THEN NULL ELSE verified_at END,
                correlation_id=COALESCE($4, correlation_id),
                updated_by=$5::uuid,
                metadata=metadata || $6::jsonb
          WHERE tenant_id=$1::uuid
            AND id=$2::uuid
          RETURNING *`,
        [tenantId, gap.id, nextStatus, correlationId, userId || null, json({
          last_manual_transition: {
            from: gap.status,
            to: nextStatus,
            reason: asText(body.reason, 1000),
          },
        })]
      );
      await insertHistory(client, {
        tenantId,
        gapId: gap.id,
        fromStatus: gap.status,
        toStatus: nextStatus,
        transitionType: 'manual_transition',
        userId,
        observationId: gap.latest_source_observation_id,
        rule,
        reason: asText(body.reason, 1000),
        correlationId,
        metadata: asObject(body.metadata),
      });
      if (audit) {
        await audit(client, {
          tenantId,
          userId,
          action: 'grc.gap.transitioned',
          tableName: 'grc_gaps',
          recordId: gap.id,
          oldData: gap,
          newData: updated.rows[0],
          metadata: { correlation_id: correlationId },
        });
      }
      await client.query('COMMIT');
      observe('gap_transitioned', { tenantId, correlationId, gapId: gap.id, status: nextStatus });
      return projectGap(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function recordHypothesis({ tenantId, userId, body = {} }) {
    const title = asText(body.title, 300);
    const statement = asText(body.statement || body.description, 4000);
    if (!title || !statement) throw publicError(GrcError, 400, 'GAP_HYPOTHESIS_REQUIRED', 'title y statement son obligatorios.');
    const sourceType = asText(body.source_type || 'ai_hypothesis', 120);
    const sourceId = body.source_id ? uuid(body.source_id, 'GAP_HYPOTHESIS_SOURCE_ID_INVALID') : null;
    const hypothesisKey = sha256({ tenant_id: tenantId, source_type: sourceType, source_id: sourceId, title, statement });
    const result = await pool.query(
      `INSERT INTO grc_gap_hypotheses (
         tenant_id,hypothesis_key,source_type,source_id,title,statement,confidence,status,created_by,metadata
       ) VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,$7,$8,$9::uuid,$10::jsonb)
       ON CONFLICT (tenant_id,hypothesis_key) DO UPDATE SET metadata=grc_gap_hypotheses.metadata || EXCLUDED.metadata
       RETURNING *`,
      [
        tenantId, hypothesisKey, sourceType, sourceId, title, statement,
        body.confidence === undefined || body.confidence === null ? null : Number(body.confidence),
        asText(body.status, 80) || 'candidate', userId || null,
        json({ ...asObject(body.metadata), model_version: GAP_MODEL_VERSION, deterministic_gap: false }),
      ]
    );
    return { ...result.rows[0], model_version: GAP_MODEL_VERSION, deterministic_gap: false };
  }

  return {
    DEFAULT_GAP_RULE_CODE,
    DEFAULT_GAP_RULE_VERSION,
    GAP_MODEL_VERSION,
    evaluateObservation,
    getGap,
    listGaps,
    recordHypothesis,
    transitionGap,
  };
}

module.exports = {
  DEFAULT_GAP_RULE_CODE,
  DEFAULT_GAP_RULE_VERSION,
  GAP_MODEL_VERSION,
  GAP_STATUSES,
  NON_MATERIAL_DATA_STATES,
  createGrcGapService,
};
