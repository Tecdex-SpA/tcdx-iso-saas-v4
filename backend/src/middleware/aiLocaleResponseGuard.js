
'use strict';

const { normalizeLocale, translatePayload } = require('../utils/aiLocaleText');

const AI_LOCALE_PATHS = [
  '/api/ai-compliance',
  '/api/ai-auditor',
  '/api/evidences',
  '/api/action-plans',
  '/api/reports'
];

function resolveRequestLocale(req) {
  return normalizeLocale(
    req.headers['x-tcdx-locale']
    || req.headers['x-locale']
    || req.query?.locale
    || req.body?.locale
    || 'es'
  );
}

function shouldGuardPath(pathname) {
  const raw = String(pathname || '');
  return AI_LOCALE_PATHS.some((prefix) => raw.startsWith(prefix));
}

function aiLocaleResponseGuard(req, res, next) {
  const locale = resolveRequestLocale(req);

  if (locale !== 'en' || !shouldGuardPath(req.path || req.originalUrl)) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function jsonWithLocaleGuard(payload) {
    try {
      return originalJson(translatePayload(payload, locale));
    } catch (error) {
      return originalJson(payload);
    }
  };

  return next();
}

module.exports = {
  aiLocaleResponseGuard,
  resolveRequestLocale
};
