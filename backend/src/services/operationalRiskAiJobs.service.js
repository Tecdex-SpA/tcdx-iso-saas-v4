'use strict';

const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const monteCarlo = require('./operationalRiskMonteCarlo.service');
const operationalRiskAi = require('./operationalRiskAi.service');

const JOB_STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'timeout']);
const ASYNC_AI_TIMEOUT_MS = 420000;

function safeText(value, fallback = '', maxLength = 1000) {
  return String(value || fallback || '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function safeUuid(value) {
  const text = safeText(value, '', 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function normalizeLimit(value) {
  const limit = Number.parseInt(String(value || 10), 10);
  if (!Number.isFinite(limit)) return 10;
  return Math.max(1, Math.min(50, limit));
}

function normalizeJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    simulation_id: row.simulation_id,
    source_risk_id: row.source_risk_id,
    status: row.status,
    prompt_version: row.prompt_version,
    ai_model: row.ai_model,
    request_payload_json: row.request_payload_json || {},
    analysis_json: row.analysis_json || null,
    error_code: row.error_code,
    error_message: row.error_message,
    created_by: row.created_by,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

function mapAiError(error) {
  const rawCode = safeText(error?.code, '', 80);
  const status = Number(error?.status || 0);
  if (rawCode === 'ai_timeout' || rawCode === 'AI_ENGINE_TIMEOUT' || status === 504) {
    return {
      status: 'timeout',
      code: 'ai_timeout',
      message: 'AI Auditor excedio el tiempo del motor.',
    };
  }
  if (rawCode === 'ai_invalid_payload') {
    return {
      status: 'failed',
      code: 'ai_invalid_payload',
      message: 'No hay datos suficientes para generar analisis AI.',
    };
  }
  if (rawCode === 'ai_invalid_response' || rawCode === 'ai_domain_mismatch') {
    return {
      status: 'failed',
      code: rawCode,
      message: safeText(error?.message, 'AI Auditor devolvio una respuesta no utilizable.', 300),
    };
  }
  return {
    status: 'failed',
    code: rawCode || 'ai_unknown_error',
    message: 'No fue posible completar el analisis AI.',
  };
}

function createOperationalRiskAiJobsService({
  db = pool,
  engineClient = aiEngineClient,
  aiService = operationalRiskAi,
} = {}) {
  async function assertSimulationForTenant(simulationId, tenantId) {
    if (!simulationId) return null;
    const result = await db.query(
      `
      SELECT id, source_risk_id
      FROM operational_risk_simulations
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      LIMIT 1
      `,
      [simulationId, tenantId]
    );

    if (!result.rows[0]) {
      throw monteCarlo.publicError(404, 'SIMULATION_NOT_FOUND', 'Simulacion no encontrada');
    }

    return result.rows[0];
  }

  async function createJob({ tenantId, userId, simulationId = null, sourceRiskId = null, payload }) {
    if (!tenantId) {
      throw monteCarlo.publicError(400, 'TENANT_REQUIRED', 'tenant_id es obligatorio');
    }
    if (!payload || typeof payload !== 'object') {
      throw monteCarlo.publicError(400, 'ai_invalid_payload', 'Payload AI Beta-PERT requerido');
    }

    const normalizedSimulationId = safeUuid(simulationId);
    const simulation = await assertSimulationForTenant(normalizedSimulationId, tenantId);
    const resolvedSourceRiskId = safeUuid(sourceRiskId) || safeUuid(simulation?.source_risk_id);

    const result = await db.query(
      `
      INSERT INTO operational_risk_ai_analysis_jobs (
        tenant_id,
        simulation_id,
        source_risk_id,
        status,
        prompt_version,
        request_payload_json,
        created_by
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'pending', $4, $5::jsonb, $6::uuid)
      RETURNING *
      `,
      [
        tenantId,
        normalizedSimulationId,
        resolvedSourceRiskId,
        aiService.PROMPT_VERSION,
        JSON.stringify(payload),
        safeUuid(userId),
      ]
    );

    return normalizeJob(result.rows[0]);
  }

  async function getJobForTenant(jobId, tenantId) {
    const result = await db.query(
      `
      SELECT *
      FROM operational_risk_ai_analysis_jobs
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      LIMIT 1
      `,
      [jobId, tenantId]
    );

    return normalizeJob(result.rows[0]);
  }

  async function listJobsForTenant({ tenantId, simulationId = null, sourceRiskId = null, limit = 10 }) {
    const params = [tenantId];
    const where = ['tenant_id = $1::uuid'];
    const normalizedSimulationId = safeUuid(simulationId);
    const normalizedSourceRiskId = safeUuid(sourceRiskId);

    if (normalizedSimulationId) {
      params.push(normalizedSimulationId);
      where.push(`simulation_id = $${params.length}::uuid`);
    }
    if (normalizedSourceRiskId) {
      params.push(normalizedSourceRiskId);
      where.push(`source_risk_id = $${params.length}::uuid`);
    }

    params.push(normalizeLimit(limit));
    const result = await db.query(
      `
      SELECT *
      FROM operational_risk_ai_analysis_jobs
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length}
      `,
      params
    );

    return result.rows.map(normalizeJob);
  }

  async function markJob(jobId, status, updates = {}) {
    if (!JOB_STATUSES.has(status)) {
      throw monteCarlo.publicError(500, 'INVALID_JOB_STATUS', 'Estado de job invalido');
    }

    const result = await db.query(
      `
      UPDATE operational_risk_ai_analysis_jobs
      SET
        status = $2,
        ai_model = COALESCE($3, ai_model),
        analysis_json = COALESCE($4::jsonb, analysis_json),
        error_code = $5,
        error_message = $6,
        started_at = CASE WHEN $2 = 'running' THEN COALESCE(started_at, now()) ELSE started_at END,
        completed_at = CASE WHEN $2 IN ('completed', 'failed', 'timeout') THEN now() ELSE completed_at END
      WHERE id = $1::uuid
      RETURNING *
      `,
      [
        jobId,
        status,
        updates.aiModel || null,
        updates.analysis ? JSON.stringify(updates.analysis) : null,
        updates.errorCode || null,
        updates.errorMessage || null,
      ]
    );

    return normalizeJob(result.rows[0]);
  }

  async function runJob(jobId) {
    const job = await markJob(jobId, 'running');
    if (!job) {
      throw monteCarlo.publicError(404, 'AI_JOB_NOT_FOUND', 'Job AI no encontrado');
    }

    try {
      const requestId = aiService.buildRequestId();
      const aiPayload = aiService.buildAiEnginePayload({
        tenantId: job.tenant_id,
        requestId,
        payload: job.request_payload_json || {},
      });
      aiPayload.options = {
        ...(aiPayload.options || {}),
        execution_mode: 'async_job',
        allow_long_running: true,
      };
      aiPayload.request_metadata = {
        ...(aiPayload.request_metadata || {}),
        execution_mode: 'async_job',
      };

      console.info('OPERATIONAL RISK AI JOB START:', {
        job_id: jobId,
        request_id: requestId,
        execution_mode: aiPayload.options.execution_mode,
        allow_long_running: aiPayload.options.allow_long_running,
        timeout_ms: ASYNC_AI_TIMEOUT_MS,
      });

      const aiResult = await engineClient.analyzeOperationalBetaPert(aiPayload, {
        timeoutMs: ASYNC_AI_TIMEOUT_MS,
      });
      const unavailable = aiService.classifyAiEngineResult(aiResult);
      if (unavailable) {
        const mapped = mapAiError({ code: unavailable.code, status: unavailable.status, message: unavailable.message });
        console.info('OPERATIONAL RISK AI JOB END:', {
          job_id: jobId,
          request_id: requestId,
          status: mapped.status,
          error_code: mapped.code,
        });
        return markJob(jobId, mapped.status, {
          errorCode: mapped.code,
          errorMessage: mapped.message,
        });
      }

      const analysis = aiService.normalizeOperationalAiAnalysis(aiResult, job.request_payload_json || {});
      console.info('OPERATIONAL RISK AI JOB END:', {
        job_id: jobId,
        request_id: requestId,
        status: 'completed',
        ai_model: analysis.ai_model,
      });
      return markJob(jobId, 'completed', {
        analysis,
        aiModel: analysis.ai_model,
      });
    } catch (error) {
      const mapped = mapAiError(error);
      console.info('OPERATIONAL RISK AI JOB END:', {
        job_id: jobId,
        status: mapped.status,
        error_code: mapped.code,
      });
      return markJob(jobId, mapped.status, {
        errorCode: mapped.code,
        errorMessage: mapped.message,
      });
    }
  }

  function enqueueJob(jobId) {
    setImmediate(() => {
      runJob(jobId).catch((error) => {
        console.error('ERROR OPERATIONAL RISK AI JOB:', {
          job_id: jobId,
          code: error?.code || 'ai_job_background_error',
          message: safeText(error?.message, 'Error ejecutando job AI', 300),
        });
      });
    });
  }

  return {
    createJob,
    getJobForTenant,
    listJobsForTenant,
    runJob,
    enqueueJob,
    _internal: {
      normalizeJob,
      normalizeLimit,
      mapAiError,
      safeUuid,
    },
  };
}

module.exports = createOperationalRiskAiJobsService();
module.exports.createOperationalRiskAiJobsService = createOperationalRiskAiJobsService;
module.exports.ASYNC_AI_TIMEOUT_MS = ASYNC_AI_TIMEOUT_MS;
