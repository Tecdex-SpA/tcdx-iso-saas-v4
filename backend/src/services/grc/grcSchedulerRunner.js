const crypto = require('crypto');
const pool = require('../../config/db');
const asyncJobs = require('../asyncJob.service');
const { createGrcService } = require('./grc.service');
const { observe } = require('./grcObservability');

async function enabledTenantIds(database) {
  return (await database.query(
    `SELECT tms.tenant_id
     FROM tenant_module_settings tms
     JOIN saas_modules sm ON sm.module_key = tms.module_key
     WHERE tms.module_key = 'grc_phase1_core' AND tms.is_enabled = TRUE AND sm.is_active = TRUE
     ORDER BY tms.tenant_id`
  )).rows.map(row => row.tenant_id);
}

async function runEnabledTenants({ database = pool, service = createGrcService(pool, asyncJobs), workerId = `backend-${process.pid}` } = {}) {
  const tenantIds = await enabledTenantIds(database);
  const results = [];
  for (const tenantId of tenantIds) {
    const correlationId = `grc-scheduler-${crypto.randomUUID()}`;
    try {
      const result = await service.runScheduler({
        tenantId,
        userId: null,
        correlationId,
        body: { run_type: 'scheduled', worker_id: workerId, retry: true },
      });
      results.push({ tenant_id: tenantId, status: result.run.status, reused: result.reused });
    } catch (error) {
      observe('scheduler_runner', { tenantId, correlationId, status: 'failed', errorCode: error.code || 'GRC_SCHEDULER_RUNNER_FAILED' });
      results.push({ tenant_id: tenantId, status: 'failed', error_code: error.code || 'GRC_SCHEDULER_RUNNER_FAILED' });
    }
  }
  return results;
}

function startSchedulerRunner({ database = pool, service, intervalMs } = {}) {
  const enabled = String(process.env.GRC_PHASE1_SCHEDULER_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return { enabled: false, stop() {} };
  const period = Math.max(60_000, Number(intervalMs || process.env.GRC_PHASE1_SCHEDULER_INTERVAL_MS) || 300_000);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runEnabledTenants({ database, service: service || createGrcService(pool, asyncJobs) });
    } catch (error) {
      observe('scheduler_runner', { status: 'failed', errorCode: error.code || 'GRC_SCHEDULER_DISCOVERY_FAILED' });
    } finally {
      running = false;
    }
  };
  const initial = setTimeout(() => void tick(), Math.min(10_000, period));
  const timer = setInterval(() => void tick(), period);
  initial.unref?.();
  timer.unref?.();
  return {
    enabled: true,
    intervalMs: period,
    stop() { clearTimeout(initial); clearInterval(timer); },
    tick,
  };
}

module.exports = { enabledTenantIds, runEnabledTenants, startSchedulerRunner };
