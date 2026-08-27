const { resolveCapability } = require('../services/commercial/entitlementResolver.service');
const { TenantResolutionError, resolveEffectiveTenant } = require('../utils/effectiveTenant');

function responseForDecision(decision, req, res) {
  const code = decision.reason_code === 'RBAC_PERMISSION_REQUIRED'
    ? 'PERMISSION_DENIED'
    : ['CAPABILITY_NOT_ENTITLED', 'CAPABILITY_DISABLED', 'OVERRIDE_DISABLED', 'MODULE_NOT_ACTIVE'].includes(decision.reason_code)
      ? 'CAPABILITY_NOT_INCLUDED'
      : decision.reason_code || 'CAPABILITY_DENIED';
  const payload = {
    ok: false,
    code,
    reason_code: decision.reason_code || 'CAPABILITY_DENIED',
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
      const explicitTenantId = options.tenantIdFromParams
        ? req.params?.[options.tenantIdFromParams]
        : null;
      const tenantId = await resolveEffectiveTenant(req, {
        tenantId: explicitTenantId,
        required: options.tenantRequired !== false,
      });
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
      if (error instanceof TenantResolutionError) {
        res.locals.errorCode = error.code;
        return res.status(error.status || 403).json({
          ok: false,
          code: error.code,
          error: error.message,
          details: error.details || undefined,
          request_id: req.requestId || null,
        });
      }
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
