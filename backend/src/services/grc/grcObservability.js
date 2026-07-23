const counters = new Map();

function observe(event, context = {}) {
  const status = context.status || 'success';
  const key = `${event}:${status}`;
  counters.set(key, (counters.get(key) || 0) + 1);
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
  return snapshot().map(item => `tcdx_grc_phase1_operations_total{operation="${item.operation}",status="${item.status}"} ${item.count}`);
}

function resetForTests() {
  counters.clear();
}

module.exports = { observe, prometheusLines, resetForTests, snapshot };
