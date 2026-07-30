 'use strict';
const crypto = require('crypto');
const phase5Package3 = require('./phase5Package3.service');
const JOBS = Object.freeze({
  'survey.calculate': 'survey-score',
  'campaign.calculate': 'survey-response-rate',
  'assurance.calculate': 'assurance-score',
  'loss.calculate': 'loss-expected',
  'loss.simulate': 'loss-monte-carlo',
  'continuity.calculate': 'continuity-availability',
  'asset.calculate': 'asset-criticality',
  'supplier.calculate': 'supplier-risk',
  'supplier_health.calculate': 'supplier-risk',
});
function stable(value) { return JSON.stringify(value, Object.keys(value || {}).sort()); }
function idempotencyKey({ tenantId, jobKey, period = {}, input = {} }) { return crypto.createHash('sha256').update(stable({ tenantId, jobKey, period, input })).digest('hex'); }
function runPackage4Job({ tenantId, userId = null, jobKey, period = {}, input = {}, correlationId = null, attempt = 1 } = {}) {
  if (!tenantId) throw Object.assign(new Error('tenant_id requerido.'), { code: 'PACKAGE4_TENANT_REQUIRED', status: 403 });
  const metricKey = JOBS[jobKey];
  if (!metricKey) throw Object.assign(new Error('Job Paquete 4 no soportado.'), { code: 'PACKAGE4_JOB_NOT_FOUND', status: 404, details: { jobKey } });
  const key = idempotencyKey({ tenantId, jobKey, period, input });
  const startedAt = new Date().toISOString();
  const result = phase5Package3.calculateOfficialByKey(metricKey, { ...input, period, correlationId });
  return { job_key: jobKey, metric_key: metricKey, tenant_id: tenantId, user_id: userId, correlation_id: correlationId, period, idempotency_key: key, attempt, status: 'completed', started_at: startedAt, finished_at: new Date().toISOString(), timeout_ms: input.timeout_ms || 30000, retries: input.retries ?? 0, result, snapshot: { formula_code: result.formula_code, formula_version: result.formula_version, input_hash: result.input_hash, calculation_run_id: result.calculation_run_id }, error: null };
}
function listPackage4Jobs() { return Object.keys(JOBS).map((job_key) => ({ job_key, metric_key: JOBS[job_key], tenant_scoped: true, idempotent: true, calculation_run: true, snapshot: true, retries: 'caller_policy', timeout_ms: 30000 })); }
module.exports = { JOBS, listPackage4Jobs, runPackage4Job, idempotencyKey };
