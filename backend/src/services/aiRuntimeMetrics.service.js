function createAiTimer({ endpoint, mode, tenantId, operationId, standardCode } = {}) {
  const startedAt = Date.now();

  return {
    finish(extra = {}) {
      return {
        duration_ms: Date.now() - startedAt,
        endpoint: endpoint || '',
        mode: mode || resolveAiMode({}, extra.engine || {}),
        tenant_id: tenantId || null,
        operation_id: operationId || null,
        standard_code: standardCode || null,
        ...extra,
      };
    },
  };
}

function resolveAiMode(options = {}, engine = {}) {
  if (options.fast_mode || engine.fast_mode) return 'fast_mode';
  if (engine.used_llm) return 'llm';
  if (options.local_compact || engine.local_compact) return 'local_compact';
  return 'deterministic';
}

module.exports = {
  createAiTimer,
  resolveAiMode,
};
