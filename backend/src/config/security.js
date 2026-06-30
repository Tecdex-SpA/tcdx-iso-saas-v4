const jwtFallbackVars = ['JWT_SECRET_KEY', 'SECRET_KEY', 'TOKEN_SECRET'];
let warnedFallback = false;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getConfiguredJwtSecret() {
  if (process.env.JWT_SECRET) {
    return {
      value: process.env.JWT_SECRET,
      source: 'JWT_SECRET',
      legacy: false,
    };
  }

  for (const key of jwtFallbackVars) {
    if (process.env[key]) {
      return {
        value: process.env[key],
        source: key,
        legacy: true,
      };
    }
  }

  return null;
}

function isWeakJwtSecret(secret) {
  const value = String(secret || '');
  const weakValues = new Set([
    'secret',
    'changeme',
    'change-me',
    'jwt_secret',
    'jwt-secret',
    'default',
    'development',
    'dev-secret',
  ]);

  return value.length < 32 || weakValues.has(value.toLowerCase());
}

function validateJwtSecretConfig() {
  const configured = getConfiguredJwtSecret();

  if (!isProduction()) return configured;

  if (!configured?.value) {
    throw new Error('JWT_SECRET requerido en producción. Define JWT_SECRET o un alias legacy compatible.');
  }

  if (isWeakJwtSecret(configured.value)) {
    throw new Error('JWT_SECRET de producción debe tener al menos 32 caracteres y no usar valores por defecto.');
  }

  return configured;
}

function getJwtSecret() {
  const configured = validateJwtSecretConfig();

  if (configured?.value) {
    if (configured.legacy && !warnedFallback) {
      warnedFallback = true;
      console.warn(`SECURITY WARNING: ${configured.source} es alias legacy de JWT_SECRET. Configura JWT_SECRET.`);
    }
    return configured.value;
  }

  if (!warnedFallback) {
    warnedFallback = true;
    console.warn('SECURITY WARNING: usando JWT secret local solo para desarrollo/test. Configura JWT_SECRET.');
  }

  return 'local-development-jwt-secret-change-before-production';
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

validateJwtSecretConfig();

module.exports = {
  getJwtSecret,
  getJwtVerifyOptions,
  getJwtSignOptions,
  validateJwtSecretConfig,
};
