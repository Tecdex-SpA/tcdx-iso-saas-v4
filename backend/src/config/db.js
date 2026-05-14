const { Pool } = require('pg');

function parseOptionalInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildSslConfig() {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') {
    return undefined;
  }

  return {
    rejectUnauthorized:
      String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false',
  };
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  ssl: buildSslConfig(),
  application_name: process.env.DB_APPLICATION_NAME || 'TCDX ISO SAAS backend',
  statement_timeout: parseOptionalInt(process.env.DB_STATEMENT_TIMEOUT_MS),
  query_timeout: parseOptionalInt(process.env.DB_QUERY_TIMEOUT_MS),
});

module.exports = pool;
