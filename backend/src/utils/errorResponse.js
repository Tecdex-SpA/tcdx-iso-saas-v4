const { normalizeLocale } = require('./locale');
const { ERROR_CODES, normalizeErrorCode } = require('./errorCodes');

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function errorDetail(error) {
  if (isProduction()) {
    return {};
  }

  return {
    detail: error?.message || String(error),
  };
}

function buildErrorResponse({
  code = ERROR_CODES.SERVER_ERROR,
  message,
  error,
  details,
  locale = 'es',
  fallbackMessage = 'Error procesando solicitud',
} = {}) {
  const errorCode = normalizeErrorCode(code);
  const normalizedLocale = normalizeLocale(locale);
  const publicMessage = message || error || fallbackMessage;

  const payload = {
    ok: false,
    error_code: errorCode,
    code: errorCode,
    message: publicMessage,
    error: publicMessage,
    locale: normalizedLocale,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return payload;
}

function sendError(res, {
  status = 500,
  code = ERROR_CODES.SERVER_ERROR,
  message,
  error,
  details,
  locale = 'es',
  fallbackMessage = 'Error procesando solicitud',
} = {}) {
  return res.status(status).json(buildErrorResponse({
    code,
    message,
    error,
    details,
    locale,
    fallbackMessage,
  }));
}

function serverError(res, error, publicMessage = 'Error procesando solicitud', locale = 'es') {
  return res.status(500).json({
    ...buildErrorResponse({
      code: ERROR_CODES.SERVER_ERROR,
      message: publicMessage,
      locale,
      fallbackMessage: publicMessage,
    }),
    ...errorDetail(error),
  });
}

module.exports = {
  errorDetail,
  serverError,
  buildErrorResponse,
  sendError,
};
