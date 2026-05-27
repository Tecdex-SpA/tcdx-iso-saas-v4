const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../config/db');
const { hashSecret, randomSecret } = require('../utils/cryptoSecret.util');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.AGENT_UPLOAD_MAX_BYTES || 50 * 1024 * 1024) },
});

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'png', 'jpg', 'jpeg']);
const AGENT_STORAGE_ROOT = path.resolve(__dirname, '..', '..', 'uploads', 'document-sources');

function getBearerToken(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function safeRelativePath(value) {
  const raw = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized.includes('\0') || normalized.startsWith('../') || normalized.includes('/../')) {
    return null;
  }
  return normalized;
}

function extensionOf(fileName) {
  return path.extname(String(fileName || '')).replace('.', '').toLowerCase();
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeSizeBytes(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildAgentProviderFileId(sourceId, relativePath) {
  const raw = `${sourceId}:${relativePath}`;
  if (raw.length <= 500) return raw;
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  const prefixLength = Math.max(0, 500 - String(sourceId).length - digest.length - 2);
  return `${sourceId}:${relativePath.slice(0, prefixLength)}:${digest}`;
}

async function authenticateAgent(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, code: 'AGENT_TOKEN_REQUIRED', error: 'Token de agente requerido' });
    }

    const tokenHash = hashSecret(token);
    const result = await pool.query(
      `
      SELECT a.*, s.sync_enabled, s.include_subfolders, s.status AS source_status
      FROM tenant_sync_agents a
      JOIN tenant_document_sources s
        ON s.id = a.source_id
       AND s.tenant_id = a.tenant_id
      WHERE a.agent_token_hash = $1
        AND a.status = 'active'
        AND s.provider = 'local_agent'
        AND s.status <> 'disconnected'
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, code: 'INVALID_AGENT_TOKEN', error: 'Token de agente inválido' });
    }

    req.agent = result.rows[0];
    return next();
  } catch (error) {
    return res.status(500).json({ ok: false, code: 'AGENT_AUTH_ERROR', error: 'Error autenticando agente' });
  }
}

router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const pairingCode = String(req.body?.pairing_code || '').trim();
    const deviceName = String(req.body?.device_name || '').trim().slice(0, 180) || 'TCDX Sync Agent';
    const version = String(req.body?.agent_version || req.body?.version || '').trim().slice(0, 40) || null;
    const fingerprint = String(req.body?.device_fingerprint || '').trim().slice(0, 255) || null;

    if (!pairingCode) {
      return res.status(400).json({ ok: false, code: 'PAIRING_CODE_REQUIRED', error: 'Código de vinculación requerido' });
    }

    await client.query('BEGIN');
    const codeHash = hashSecret(pairingCode);
    const codeResult = await client.query(
      `
      SELECT pc.*, s.status AS source_status
      FROM tenant_sync_agent_pairing_codes pc
      JOIN tenant_document_sources s
        ON s.id = pc.source_id
       AND s.tenant_id = pc.tenant_id
      WHERE pc.code_hash = $1
        AND pc.used_at IS NULL
        AND pc.expires_at > NOW()
        AND s.provider = 'local_agent'
      ORDER BY pc.created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [codeHash]
    );

    if (codeResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, code: 'PAIRING_CODE_INVALID_OR_EXPIRED', error: 'Código inválido o expirado' });
    }

    const pairing = codeResult.rows[0];
    const agentToken = `tcdx_agent_${randomSecret(36)}`;
    const agentTokenHash = hashSecret(agentToken);

    const agent = await client.query(
      `
      INSERT INTO tenant_sync_agents (
        tenant_id, source_id, agent_name, device_name, device_fingerprint,
        status, agent_token_hash, last_seen_at, version, metadata_json, created_by
      )
      VALUES ($1,$2,$3,$3,$4,'active',$5,NOW(),$6,$7::jsonb,$8)
      RETURNING id, tenant_id, source_id, device_name, status, last_seen_at, version
      `,
      [
        pairing.tenant_id,
        pairing.source_id,
        deviceName,
        fingerprint,
        agentTokenHash,
        version,
        JSON.stringify({ registered_from: 'agent_register' }),
        pairing.created_by || null,
      ]
    );

    await client.query(
      `UPDATE tenant_sync_agent_pairing_codes SET used_at = NOW() WHERE id = $1`,
      [pairing.id]
    );
    await client.query(
      `
      UPDATE tenant_document_sources
      SET status = 'active',
          sync_enabled = true,
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb,
          updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
      `,
      [
        pairing.source_id,
        pairing.tenant_id,
        JSON.stringify({ agent_registered_at: new Date().toISOString(), device_name: deviceName }),
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      ok: true,
      agent: agent.rows[0],
      agent_token: agentToken,
      token_visible_once: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ ok: false, code: 'AGENT_REGISTER_ERROR', error: 'Error registrando agente' });
  } finally {
    client.release();
  }
});

router.post('/heartbeat', authenticateAgent, async (req, res) => {
  await pool.query(
    `UPDATE tenant_sync_agents SET last_seen_at = NOW(), version = COALESCE($2, version), updated_at = NOW() WHERE id = $1`,
    [req.agent.id, req.body?.version || req.body?.agent_version || null]
  );
  return res.json({ ok: true, status: 'active', last_seen_at: new Date().toISOString() });
});

router.get('/config', authenticateAgent, async (req, res) => {
  return res.json({
    ok: true,
    source_id: req.agent.source_id,
    sync_enabled: req.agent.sync_enabled === true,
    include_subfolders: req.agent.include_subfolders !== false,
    max_file_size: Number(process.env.AGENT_UPLOAD_MAX_BYTES || 50 * 1024 * 1024),
    allowed_extensions: Array.from(ALLOWED_EXTENSIONS),
  });
});

router.post('/documents/index', authenticateAgent, async (req, res) => {
  try {
    if (!Array.isArray(req.body?.files)) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_AGENT_MANIFEST',
        error: 'Manifest de archivos inválido',
      });
    }

    const manifest = req.body.files;
    const tenantId = req.agent.tenant_id;
    const sourceId = req.agent.source_id;
    let indexed = 0;
    let skipped = 0;

    for (const item of manifest.slice(0, 2000)) {
      const relativePath = safeRelativePath(item?.relative_path || item?.path || item?.file_name);
      const fileName = truncate(path.basename(relativePath || String(item?.file_name || '')), 500);
      const ext = truncate(extensionOf(fileName), 40);
      if (!relativePath || !fileName || !ALLOWED_EXTENSIONS.has(ext)) {
        skipped += 1;
        continue;
      }

      const hash = truncate(item?.hash || item?.file_hash || item?.content_hash || '', 255) || null;
      const providerFileId = buildAgentProviderFileId(sourceId, relativePath);
      const mimeType = truncate(item?.mime_type || '', 255) || null;
      const sizeBytes = normalizeSizeBytes(item?.size_bytes);
      const modifiedAt = normalizeTimestamp(item?.modified_at);
      const metadataJson = JSON.stringify({ local_agent: true, device_name: req.agent.device_name || null });

      const existing = await pool.query(
        `
        SELECT id
        FROM document_index
        WHERE tenant_id = $1::uuid
          AND provider = 'local_agent'
          AND provider_file_id = $2::varchar
        LIMIT 1
        `,
        [tenantId, providerFileId]
      );

      if (existing.rowCount > 0) {
        await pool.query(
          `
          UPDATE document_index
          SET source_id = $2::uuid,
              file_name = $3::varchar,
              mime_type = $4::varchar,
              file_extension = $5::varchar,
              size_bytes = $6::bigint,
              checksum = $7::varchar,
              content_hash = $8::text,
              file_hash = $9::text,
              relative_path = $10::text,
              modified_at = $11::timestamp,
              last_seen_at = NOW(),
              status = 'updated',
              metadata_json = $12::jsonb
          WHERE id = $1::uuid
            AND tenant_id = $13::uuid
          `,
          [
            existing.rows[0].id,
            sourceId,
            fileName,
            mimeType,
            ext,
            sizeBytes,
            hash,
            hash,
            hash,
            relativePath,
            modifiedAt,
            metadataJson,
            tenantId,
          ]
        );
      } else {
        await pool.query(
          `
          INSERT INTO document_index (
            tenant_id, source_id, provider, provider_file_id, file_name, mime_type,
            file_extension, size_bytes, checksum, content_hash, file_hash,
            relative_path, modified_at, indexed_at, last_seen_at, status, metadata_json
          )
          VALUES (
            $1::uuid, $2::uuid, 'local_agent', $3::varchar, $4::varchar, $5::varchar,
            $6::varchar, $7::bigint, $8::varchar, $9::text, $10::text,
            $11::text, $12::timestamp, NOW(), NOW(), 'indexed', $13::jsonb
          )
          `,
          [
            tenantId,
            sourceId,
            providerFileId,
            fileName,
            mimeType,
            ext,
            sizeBytes,
            hash,
            hash,
            hash,
            relativePath,
            modifiedAt,
            metadataJson,
          ]
        );
      }
      indexed += 1;
    }

    await pool.query(
      `UPDATE tenant_sync_agents SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
      [req.agent.id]
    );

    return res.json({ ok: true, tenant_filter_enforced: true, indexed, skipped });
  } catch (error) {
    console.error('ERROR AGENT DOCUMENT INDEX:', {
      code: error.code || null,
      message: error.message,
      detail: error.detail || null,
      constraint: error.constraint || null,
      column: error.column || null,
      table: error.table || null,
    });
    return res.status(500).json({
      ok: false,
      code: 'AGENT_DOCUMENT_INDEX_ERROR',
      error: 'Error indexando documentos del agente',
    });
  }
});

router.post('/documents/upload', authenticateAgent, upload.single('file'), async (req, res) => {
  const relativePath = safeRelativePath(req.body?.relative_path || req.file?.originalname);
  if (!req.file || !relativePath) {
    return res.status(400).json({ ok: false, code: 'INVALID_AGENT_UPLOAD', error: 'Archivo o ruta relativa inválida' });
  }

  const ext = extensionOf(relativePath);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ ok: false, code: 'UNSUPPORTED_FILE_EXTENSION', error: 'Tipo de archivo no soportado' });
  }

  const targetRoot = path.resolve(AGENT_STORAGE_ROOT, String(req.agent.tenant_id), String(req.agent.source_id));
  const targetPath = path.resolve(targetRoot, relativePath);
  if (!targetPath.startsWith(`${targetRoot}${path.sep}`)) {
    return res.status(400).json({ ok: false, code: 'PATH_TRAVERSAL_BLOCKED', error: 'Ruta relativa inválida' });
  }

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, req.file.buffer);
  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  await pool.query(
    `
    UPDATE document_index
    SET local_storage_path = $4,
        checksum = $5,
        content_hash = $5,
        file_hash = $5,
        size_bytes = $6,
        last_seen_at = NOW(),
        status = 'updated'
    WHERE tenant_id = $1::uuid
      AND source_id = $2::uuid
      AND provider_file_id = $3
    `,
    [
      req.agent.tenant_id,
      req.agent.source_id,
      `${req.agent.source_id}:${relativePath}`,
      targetPath,
      fileHash,
      req.file.size,
    ]
  );

  return res.json({ ok: true, uploaded: true, relative_path: relativePath });
});

module.exports = router;
