const jwtFallbackVars = ['JWT_SECRET_KEY', 'SECRET_KEY', 'TOKEN_SECRET'];
let warnedFallback = false;

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  for (const key of jwtFallbackVars) {
    if (process.env[key]) {
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn(`SECURITY WARNING: usando ${key} como fallback temporal. Configura JWT_SECRET.`);
      }
      return process.env[key];
    }
  }

  return '';
}

function getJwtVerifyOptions() {
  const options = {
    algorithms: ['HS256'],
  };

  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;

  return options;
}

function getJwtSignOptions() {
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    algorithm: 'HS256',
  };

  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;

  return options;
}

module.exports = {
  getJwtSecret,
  getJwtVerifyOptions,
  getJwtSignOptions,
};
