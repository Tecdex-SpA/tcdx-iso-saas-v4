const counters = new Map();
const totals = {
  errors: 0,
  schedulerRuns: 0,
  schedulerRetries: 0,
  escalations: 0,
  exports: 0,
  bootstraps: 0,
};

function observe(event, context = {}) {
  const status = context.status || 'success';
  const key = `${event}:${status}`;
  counters.set(key, (counters.get(key) || 0) + 1);
  if (status === 'failed') totals.errors += 1;
  if (event === 'scheduler') {
    totals.schedulerRuns += 1;
    if (Number(context.attempt || 0) > 1) totals.schedulerRetries += 1;
  }
  if (event === 'escalation') totals.escalations += 1;
  if (event === 'export') totals.exports += 1;
  if (event === 'bootstrap') totals.bootstraps += 1;
  const payload = {
    event: 'GRC_PHASE1_OPERATION',
    operation: event,
    status,
    tenant_id: context.tenantId || null,
    correlation_id: context.correlationId || null,
    entity_type: context.entityType || null,
    entity_id: context.entityId || null,
    attempt: context.attempt || null,
    error_code: context.errorCode || null,
    duration_ms: context.durationMs || null,
  };
  const logger = status === 'failed' ? console.error : console.info;
  logger(JSON.stringify(payload));
  return payload;
}

function snapshot() {
  return [...counters.entries()].map(([key, value]) => {
    const [operation, status] = key.split(':');
    return { operation, status, count: value };
  });
}

function prometheusLines() {
  return [
    ...snapshot().map(item => `tcdx_grc_phase1_operations_total{operation="${item.operation}",status="${item.status}"} ${item.count}`),
    `tcdx_grc_phase1_operation_errors_total ${totals.errors}`,
    `tcdx_grc_phase1_scheduler_runs_total ${totals.schedulerRuns}`,
    `tcdx_grc_phase1_scheduler_retries_total ${totals.schedulerRetries}`,
    `tcdx_grc_phase1_escalations_total ${totals.escalations}`,
    `tcdx_grc_phase1_exports_total ${totals.exports}`,
    `tcdx_grc_phase1_bootstrap_total ${totals.bootstraps}`,
  ];
}

function resetForTests() {
  counters.clear();
  for (const key of Object.keys(totals)) totals[key] = 0;
}

module.exports = { observe, prometheusLines, resetForTests, snapshot };
