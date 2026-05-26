const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const raw = String(process.env.DOCUMENT_INTEGRATION_ENCRYPTION_KEY || '').trim();

  if (!raw) {
    throw new Error('DOCUMENT_INTEGRATION_ENCRYPTION_KEY no configurado');
  }

  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  const base64 = Buffer.from(raw, 'base64');
  if (base64.length === 32) {
    return base64;
  }

  throw new Error('DOCUMENT_INTEGRATION_ENCRYPTION_KEY debe ser hex de 32 bytes o base64 de 32 bytes');
}

function getHashSecret() {
  return (
    process.env.AGENT_TOKEN_SIGNING_SECRET ||
    process.env.DOCUMENT_INTEGRATION_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    ''
  );
}

function encryptSecret(value) {
  if (value === null || value === undefined || value === '') return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  });
}

function decryptSecret(payload) {
  if (!payload) return null;
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

  if (!parsed || parsed.v !== 1 || parsed.alg !== ALGORITHM) {
    throw new Error('Formato de secreto cifrado no soportado');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(parsed.iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function hashSecret(secret) {
  const pepper = getHashSecret();
  if (!pepper) {
    throw new Error('AGENT_TOKEN_SIGNING_SECRET o secreto equivalente no configurado');
  }

  return crypto
    .createHmac('sha256', pepper)
    .update(String(secret || ''))
    .digest('hex');
}

function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = {
  encryptSecret,
  decryptSecret,
  hashSecret,
  randomSecret,
};
