const pool = require('../../config/db');
const { createPhase2Service } = require('./phase2.service');

const service = createPhase2Service(pool);
let running = false;

async function runDueConnectors() {
  if (running) return;
  running = true;
  try {
    const due = await pool.query(
      `SELECT i.id,i.tenant_id
       FROM tenant_integrations i
       JOIN tenant_module_settings ms
         ON ms.tenant_id=i.tenant_id AND ms.module_key='grc_phase2_integrated' AND ms.is_enabled=TRUE
       WHERE i.status='connected'
         AND COALESCE((i.schedule->>'enabled')::boolean,FALSE)=TRUE
         AND i.next_sync_at IS NOT NULL AND i.next_sync_at<=now()
       ORDER BY i.next_sync_at
       LIMIT 10`
    );
    for (const connector of due.rows) {
      const bucket = new Date().toISOString().slice(0, 16);
      const idempotencyKey = `scheduler:${connector.id}:${bucket}`;
      const result = await service.runConnector({
        tenantId: connector.tenant_id,
        userId: null,
        correlationId: idempotencyKey,
        id: connector.id,
        idempotencyKey,
      });
      const intervalMinutes = Math.max(5, Number(result.run?.metrics?.interval_minutes) || 60);
      await pool.query(
        `UPDATE tenant_integrations SET next_sync_at=now()+make_interval(mins=>$3),updated_at=now()
         WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [connector.tenant_id, connector.id, intervalMinutes]
      );
    }
  } catch (error) {
    if (error?.code !== '42P01' && error?.code !== '42703') {
      console.error(JSON.stringify({
        event: 'PHASE2_SCHEDULER_ERROR',
        error_code: error?.code || 'PHASE2_SCHEDULER_ERROR',
      }));
    }
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

module.exports = { runDueConnectors, startPhase2Scheduler };
