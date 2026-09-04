const pool = require('../../config/db');
const { observe } = require('./grcObservability');
const { createPhase2Service } = require('./phase2.service');

const defaultService = createPhase2Service(pool);
let running = false;

const SCHEDULER_ROLE = 'platform_admin';
const DEFAULT_SYNC_INTERVAL_MINUTES = 60;
const DISABLED_RECHECK_MINUTES = 24 * 60;
const HEALTHY_STATUS = 'healthy';

function classifyConnectorError(error) {
  const code = String(error?.code || '').trim();
  if (code === 'CONNECTOR_NOT_AVAILABLE') return 'disabled';
  if (
    code === 'CONNECTOR_ACCESS_TOKEN_REQUIRED'
    || code === 'CONNECTOR_BASE_URL_HTTPS_REQUIRED'
    || code === 'CONNECTOR_CREDENTIALS_REQUIRED'
    || code === 'CONNECTOR_OAUTH_TOKEN_EXCHANGE_FAILED'
  ) return 'misconfiguration';
  if (/^CONNECTOR_HTTP_(429|5\d\d)$/.test(code)) return 'dependency_unavailable';
  if (code === 'CONNECTOR_PROVIDER_UNSUPPORTED') return 'misconfiguration';
  return 'failure';
}

function classifyConnectorRun(result) {
  const status = String(result?.run?.status || '').trim();
  if (result?.reused === true) return 'success';
  if (status === 'completed' || status === 'completed_with_warnings') return 'success';
  if (status === 'failed' || status === 'dead_lettered') {
    return classifyConnectorError({ code: result?.run?.error_code });
  }
  return 'failure';
}

function nextIntervalMinutes(status, result, now = Date.now()) {
  if (status === 'disabled') return DISABLED_RECHECK_MINUTES;
  const retryAt = result?.run?.next_retry_at ? new Date(result.run.next_retry_at).getTime() : NaN;
  if (Number.isFinite(retryAt) && retryAt > now) {
    return Math.max(5, Math.ceil((retryAt - now) / 60000));
  }
  return Math.max(5, Number(result?.run?.metrics?.interval_minutes) || DEFAULT_SYNC_INTERVAL_MINUTES);
}

async function scheduleNext(database, connector, minutes, status, errorCode = null) {
  const healthStatus = status === 'success'
    ? HEALTHY_STATUS
    : status === 'disabled'
      ? 'disabled'
      : 'failed';
  await database.query(
    `UPDATE grc_connector_instances
     SET health_status=$3,last_error_code=$4,next_sync_at=now()+make_interval(mins=>$5),updated_at=now()
     WHERE tenant_id=$1::uuid AND id=$2::uuid`,
    [connector.tenant_id, connector.id, healthStatus, status === 'success' ? null : errorCode, minutes]
  );
}

async function runDueConnectors({
  database = pool,
  connectorService = defaultService,
  workerId = 'phase2-scheduler',
  workerRole = SCHEDULER_ROLE,
  clock = Date.now,
  limit = 10,
} = {}) {
  if (running) return { status: 'skipped', reason: 'runner_busy', processed: 0, results: [] };
  running = true;
  try {
    const normalizedWorkerId = String(workerId || 'phase2-scheduler').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 80) || 'phase2-scheduler';
    const due = await database.query(
      `SELECT i.id,i.tenant_id
       FROM grc_connector_instances i
       JOIN tenant_module_settings ms
         ON ms.tenant_id=i.tenant_id AND ms.module_key='grc_phase2_integrated' AND ms.is_enabled=TRUE
       WHERE i.status='connected'
         AND COALESCE((i.schedule->>'enabled')::boolean,FALSE)=TRUE
         AND i.next_sync_at IS NOT NULL AND i.next_sync_at<=now()
       ORDER BY i.next_sync_at
       LIMIT $1`,
      [Math.max(1, Math.min(Number(limit) || 10, 50))]
    );
    if (!due.rows.length) return { status: 'skipped', reason: 'no_due_connectors', processed: 0, results: [] };
    const results = [];
    for (const connector of due.rows) {
      const bucket = new Date(clock()).toISOString().slice(0, 16);
      const idempotencyKey = `${normalizedWorkerId}:${connector.id}:${bucket}`;
      try {
        const result = await connectorService.runConnector({
          tenantId: connector.tenant_id,
          userId: null,
          role: workerRole,
          correlationId: idempotencyKey,
          id: connector.id,
          idempotencyKey,
        });
        const status = classifyConnectorRun(result);
        const errorCode = result?.run?.error_code || null;
        await scheduleNext(database, connector, nextIntervalMinutes(status, result, clock()), status, errorCode);
        observe('phase2_scheduler_connector', {
          tenantId: connector.tenant_id,
          correlationId: idempotencyKey,
          status,
          entityType: 'connector',
          entityId: connector.id,
          errorCode,
        });
        results.push({ connector_id: connector.id, tenant_id: connector.tenant_id, status, error_code: errorCode });
      } catch (error) {
        const status = classifyConnectorError(error);
        const errorCode = error?.code || 'PHASE2_CONNECTOR_RUN_FAILED';
        await scheduleNext(database, connector, nextIntervalMinutes(status, null, clock()), status, errorCode);
        observe('phase2_scheduler_connector', {
          tenantId: connector.tenant_id,
          correlationId: idempotencyKey,
          status,
          entityType: 'connector',
          entityId: connector.id,
          errorCode,
        });
        results.push({ connector_id: connector.id, tenant_id: connector.tenant_id, status, error_code: errorCode });
      }
    }
    const hasFailure = results.some(result => ['misconfiguration', 'dependency_unavailable', 'failure'].includes(result.status));
    return { status: hasFailure ? 'partial_failure' : 'success', processed: results.length, results };
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') {
      observe('phase2_scheduler', { status: 'dependency_unavailable', errorCode: error.code });
      return { status: 'dependency_unavailable', processed: 0, results: [], error_code: error.code };
    }
    observe('phase2_scheduler', { status: 'failed', errorCode: error?.code || 'PHASE2_SCHEDULER_DISCOVERY_FAILED' });
    if (error?.code !== '42P01' && error?.code !== '42703') {
      console.error(JSON.stringify({
        event: 'PHASE2_SCHEDULER_ERROR',
        error_code: error?.code || 'PHASE2_SCHEDULER_ERROR',
      }));
    }
    return { status: 'failure', processed: 0, results: [], error_code: error?.code || 'PHASE2_SCHEDULER_DISCOVERY_FAILED' };
  } finally {
    running = false;
  }
}

function startPhase2Scheduler() {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_PHASE2_SCHEDULER === '1') return null;
  const intervalMs = Math.max(30000, Number(process.env.PHASE2_SCHEDULER_INTERVAL_MS) || 60000);
  const timer = setInterval(runDueConnectors, intervalMs);
  timer.unref?.();
  setTimeout(runDueConnectors, 5000).unref?.();
  return timer;
}

module.exports = {
  classifyConnectorError,
  classifyConnectorRun,
  runDueConnectors,
  startPhase2Scheduler,
};
