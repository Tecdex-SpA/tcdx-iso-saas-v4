const crypto = require('crypto');

function keyFromEnvironment(environment = process.env) {
  const configured = String(
    environment.CONNECTOR_CREDENTIAL_ENCRYPTION_KEY
    || environment.DOCUMENT_INTEGRATION_ENCRYPTION_KEY
    || ''
  ).trim();
  if (!configured) {
    const error = new Error('CONNECTOR_CREDENTIAL_KEY_REQUIRED');
    error.code = 'CONNECTOR_CREDENTIAL_KEY_REQUIRED';
    throw error;
  }
  return crypto.createHash('sha256').update(configured).digest();
}

function encryptCredential(value, environment = process.env) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('CONNECTOR_CREDENTIAL_INVALID');
    error.code = 'CONNECTOR_CREDENTIAL_INVALID';
    throw error;
  }
  const key = keyFromEnvironment(environment);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decryptCredential(envelope, environment = process.env) {
  if (!envelope || envelope.algorithm !== 'aes-256-gcm' || envelope.version !== 1) {
    const error = new Error('CONNECTOR_CREDENTIAL_ENVELOPE_INVALID');
    error.code = 'CONNECTOR_CREDENTIAL_ENVELOPE_INVALID';
    throw error;
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyFromEnvironment(environment),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function redactIntegration(row = {}) {
  const safe = { ...row };
  delete safe.encrypted_access_token;
  delete safe.encrypted_refresh_token;
  delete safe.credential_envelope;
  delete safe.oauth_state_hash;
  return {
    ...safe,
    credentials_configured: Boolean(
      row.credential_envelope
      && typeof row.credential_envelope === 'object'
      && row.credential_envelope.ciphertext
    ),
  };
}

module.exports = {
  decryptCredential,
  encryptCredential,
  hashToken,
  randomToken,
  redactIntegration,
};
