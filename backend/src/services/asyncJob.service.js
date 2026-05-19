const pool = require('../config/db');

const VALID_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancelled', 'expired']);

function asJson(value, fallback = {}) {
  if (value === undefined || value === null) return fallback;
  return value;
}

function normalizeStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return VALID_STATUSES.has(normalized) ? normalized : 'queued';
}

function serializeJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    job_id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    job_type: row.job_type,
    status: row.status,
    priority: row.priority,
    model_mode: row.model_mode,
    source_module: row.source_module,
    request_payload_json: row.request_payload_json || {},
    result_json: row.result_json || null,
    result_file_id: row.result_file_id || null,
    result_file_url: row.result_file_url || null,
    result_download_url: row.result_download_url || null,
    error_json: row.error_json || null,
    request_id: row.request_id || null,
    started_at: row.started_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createJob({
  tenant_id,
  user_id = null,
  job_type,
  source_module = null,
  model_mode = null,
  priority = null,
  payload = {},
  request_id = null,
  expires_at = null,
}) {
  const result = await pool.query(
    `
    INSERT INTO tcdx_async_jobs (
      tenant_id,
      user_id,
      job_type,
      status,
      priority,
      model_mode,
      source_module,
      request_payload_json,
      request_id,
      expires_at
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      'queued',
      $4,
      $5,
      $6,
      $7::jsonb,
      $8,
      $9::timestamptz
    )
    RETURNING *
    `,
    [
      tenant_id,
      user_id,
      job_type,
      priority,
      model_mode,
      source_module,
      JSON.stringify(asJson(payload)),
      request_id,
      expires_at,
    ]
  );

  return serializeJob(result.rows[0]);
}

async function markRunning(jobId) {
  const result = await pool.query(
    `
    UPDATE tcdx_async_jobs
    SET status = 'running',
        started_at = COALESCE(started_at, now()),
        updated_at = now()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [jobId]
  );

  return serializeJob(result.rows[0]);
}

async function markCompleted(jobId, {
  result_json = null,
  result_file_id = null,
  result_file_url = null,
  result_download_url = null,
} = {}) {
  const result = await pool.query(
    `
    UPDATE tcdx_async_jobs
    SET status = 'completed',
        result_json = $2::jsonb,
        result_file_id = $3::uuid,
        result_file_url = $4,
        result_download_url = $5,
        completed_at = now(),
        updated_at = now()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [
      jobId,
      JSON.stringify(asJson(result_json, null)),
      result_file_id,
      result_file_url,
      result_download_url,
    ]
  );

  return serializeJob(result.rows[0]);
}

async function markFailed(jobId, { error_json = null } = {}) {
  const result = await pool.query(
    `
    UPDATE tcdx_async_jobs
    SET status = 'failed',
        error_json = $2::jsonb,
        completed_at = now(),
        updated_at = now()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [jobId, JSON.stringify(asJson(error_json))]
  );

  return serializeJob(result.rows[0]);
}

function buildScopeWhere(scope = {}) {
  const values = [];
  const clauses = [];

  if (!scope.is_platform) {
    values.push(scope.tenant_id);
    clauses.push(`tenant_id = $${values.length}::uuid`);
  }

  return { values, clauses };
}

async function getJobScoped(jobId, scope = {}) {
  const { values, clauses } = buildScopeWhere(scope);
  values.push(jobId);
  const where = [`id = $${values.length}::uuid`, ...clauses].join(' AND ');

  const result = await pool.query(
    `
    SELECT *
    FROM tcdx_async_jobs
    WHERE ${where}
    LIMIT 1
    `,
    values
  );

  return serializeJob(result.rows[0]);
}

async function listJobsScoped(scope = {}, filters = {}) {
  const { values, clauses } = buildScopeWhere(scope);
  if (filters.job_type) {
    values.push(filters.job_type);
    clauses.push(`job_type = $${values.length}`);
  }
  if (filters.status) {
    values.push(normalizeStatus(filters.status));
    clauses.push(`status = $${values.length}`);
  }

  const limit = Math.max(1, Math.min(Number(filters.limit || 25), 100));
  values.push(limit);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(
    `
    SELECT *
    FROM tcdx_async_jobs
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length}
    `,
    values
  );

  return result.rows.map(serializeJob);
}

module.exports = {
  createJob,
  markRunning,
  markCompleted,
  markFailed,
  getJobScoped,
  listJobsScoped,
};
