const { resolveCapability } = require('../services/commercial/entitlementResolver.service');

function responseForDecision(decision, req, res) {
  const payload = {
    ok: false,
    code: decision.reason_code || 'CAPABILITY_DENIED',
    error: decision.reason_code === 'RBAC_PERMISSION_REQUIRED'
      ? 'Permiso requerido para operar esta capacidad.'
      : 'La capacidad no esta habilitada para esta empresa.',
    capability_key: decision.capability_key,
    decision: decision.decision,
    source: decision.source,
    request_id: req.requestId || null,
  };

  if (decision.reason_code === 'LIMIT_EXHAUSTED') return res.status(429).json(payload);
  if (decision.decision === 'read_only' || decision.reason_code === 'DOWNGRADE_READ_ONLY') return res.status(409).json(payload);
  return res.status(decision.reason_code === 'RBAC_PERMISSION_REQUIRED' ? 403 : 403).json(payload);
}

function requireCommercialCapability(capabilityKey, options = {}) {
  return async function commercialCapabilityMiddleware(req, res, next) {
    try {
      const tenantId = options.tenantIdFromParams
        ? req.params?.[options.tenantIdFromParams]
        : (req.tenantId || req.user?.tenant_id || req.user?.tenantId || null);
      const decision = await resolveCapability({
        tenantId,
        user: req.user,
        capabilityKey,
        requiredPermission: options.requiredPermission || null,
        mode: options.mode || (['GET', 'HEAD', 'OPTIONS'].includes(String(req.method).toUpperCase()) ? 'read' : 'write'),
      });
      res.locals = res.locals || {};
      res.locals.commercialEntitlement = decision;
      if (decision.enabled === true && decision.decision === 'allowed') return next();
      return responseForDecision(decision, req, res);
    } catch (error) {
      res.locals = res.locals || {};
      res.locals.errorCode = 'COMMERCIAL_ENTITLEMENT_ERROR';
      return res.status(500).json({
        ok: false,
        code: 'COMMERCIAL_ENTITLEMENT_ERROR',
        error: 'No fue posible validar la capacidad comercial.',
        request_id: req.requestId || null,
      });
    }
  };
}

module.exports = { requireCommercialCapability };
