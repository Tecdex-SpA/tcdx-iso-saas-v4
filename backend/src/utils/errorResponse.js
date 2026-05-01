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

function serverError(res, error, publicMessage = 'Error procesando solicitud') {
  return res.status(500).json({
    ok: false,
    error: publicMessage,
    ...errorDetail(error),
  });
}

module.exports = {
  errorDetail,
  serverError,
};
