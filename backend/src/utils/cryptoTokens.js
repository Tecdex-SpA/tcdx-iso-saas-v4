const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey() {
  const raw = String(process.env.TOKEN_ENCRYPTION_KEY || '').trim()

  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY no configurado')
  }

  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }

  const b64 = Buffer.from(raw, 'base64')
  if (b64.length === 32) {
    return b64
  }

  throw new Error('TOKEN_ENCRYPTION_KEY debe ser hex de 32 bytes (64 caracteres) o base64 de 32 bytes')
}

function encryptToken(value) {
  if (value === null || value === undefined || value === '') return null

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    v: 1,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: encrypted.toString('base64')
  })
}

function decryptToken(payload) {
  if (!payload) return null

  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload

  if (!parsed || parsed.alg !== ALGORITHM || parsed.v !== 1) {
    throw new Error('Formato de token cifrado no soportado')
  }

  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(parsed.iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  )

  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

module.exports = {
  encryptToken,
  decryptToken
}
