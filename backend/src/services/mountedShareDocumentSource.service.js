const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'png', 'jpg', 'jpeg']);

function getLocalDocumentRoot() {
  const root = String(process.env.LOCAL_DOCUMENT_ROOT || '').trim();
  if (!root) {
    const err = new Error('LOCAL_DOCUMENT_ROOT no configurado');
    err.statusCode = 503;
    err.code = 'MOUNTED_SHARE_NOT_CONFIGURED';
    throw err;
  }
  return path.resolve(root);
}

function normalizeRelativePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

async function validateMountedSharePath(folderPath) {
  const root = getLocalDocumentRoot();
  const relative = normalizeRelativePath(folderPath);

  if (!relative || relative.includes('\0') || path.isAbsolute(relative)) {
    const err = new Error('folder_path inválido');
    err.statusCode = 400;
    err.code = 'INVALID_MOUNTED_SHARE_PATH';
    throw err;
  }

  const normalized = path.posix.normalize(relative);
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    const err = new Error('folder_path fuera del root permitido');
    err.statusCode = 400;
    err.code = 'PATH_TRAVERSAL_BLOCKED';
    throw err;
  }

  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    const err = new Error('folder_path fuera del root permitido');
    err.statusCode = 400;
    err.code = 'PATH_TRAVERSAL_BLOCKED';
    throw err;
  }

  const realRoot = await fs.promises.realpath(root).catch(() => null);
  if (!realRoot) {
    const err = new Error('LOCAL_DOCUMENT_ROOT no existe');
    err.statusCode = 503;
    err.code = 'MOUNTED_SHARE_ROOT_NOT_FOUND';
    throw err;
  }

  const realTarget = await fs.promises.realpath(target).catch(() => null);
  if (realTarget) {
    const rootWithSep = `${realRoot}${path.sep}`;
    if (realTarget !== realRoot && !realTarget.startsWith(rootWithSep)) {
      const err = new Error('folder_path resuelve fuera del root permitido');
      err.statusCode = 400;
      err.code = 'PATH_TRAVERSAL_BLOCKED';
      throw err;
    }
  }

  return {
    root,
    relative_path: normalized,
    absolute_path: target,
    real_path: realTarget,
  };
}

function extensionOf(fileName) {
  const ext = path.extname(String(fileName || '')).replace('.', '').toLowerCase();
  return ext || '';
}

function shouldIgnoreFile(fileName) {
  const name = path.basename(String(fileName || ''));
  return !name || name === '.DS_Store' || name === 'Thumbs.db' || name.startsWith('~$') || name.endsWith('.tmp');
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function listMountedShareFiles({
  folderPath,
  includeSubfolders = true,
  maxDepth = Number(process.env.LOCAL_DOCUMENT_MAX_DEPTH || 6),
  maxFiles = Number(process.env.LOCAL_DOCUMENT_MAX_FILES || 2000),
  maxFileSize = Number(process.env.LOCAL_DOCUMENT_MAX_FILE_SIZE_BYTES || 50 * 1024 * 1024),
}) {
  const safe = await validateMountedSharePath(folderPath);
  const files = [];
  const warnings = [];
  const realRoot = safe.real_path || safe.absolute_path;

  async function walk(dir, relativeBase, depth) {
    if (files.length >= maxFiles) return;
    if (depth > maxDepth) {
      warnings.push({ type: 'max_depth_reached', path: relativeBase });
      return;
    }

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.name.startsWith('.')) continue;

      const absolute = path.join(dir, entry.name);
      const relative = path.posix.join(relativeBase, entry.name);
      const stat = await fs.promises.lstat(absolute);

      if (stat.isSymbolicLink()) {
        warnings.push({ type: 'symlink_skipped', path: relative });
        continue;
      }

      if (stat.isDirectory()) {
        if (includeSubfolders) {
          const realDir = await fs.promises.realpath(absolute).catch(() => null);
          if (!realDir || (realDir !== realRoot && !realDir.startsWith(`${realRoot}${path.sep}`))) {
            warnings.push({ type: 'directory_outside_root_skipped', path: relative });
            continue;
          }
          await walk(absolute, relative, depth + 1);
        }
        continue;
      }

      if (!stat.isFile() || shouldIgnoreFile(entry.name)) continue;
      const ext = extensionOf(entry.name);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        warnings.push({ type: 'extension_skipped', path: relative, ext });
        continue;
      }
      if (stat.size > maxFileSize) {
        warnings.push({ type: 'max_size_skipped', path: relative, size: stat.size });
        continue;
      }

      files.push({
        file_name: entry.name,
        relative_path: relative,
        absolute_path: absolute,
        file_extension: ext,
        size_bytes: stat.size,
        modified_at: stat.mtime,
      });
    }
  }

  await walk(safe.absolute_path, '', 0);
  return { ...safe, files, warnings };
}

async function indexMountedShareSource({ tenantId, sourceId }) {
  const sourceResult = await pool.query(
    `
    SELECT *
    FROM tenant_document_sources
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
      AND provider = 'mounted_share'
      AND status <> 'disconnected'
    LIMIT 1
    `,
    [sourceId, tenantId]
  );

  if (sourceResult.rowCount === 0) {
    const err = new Error('Fuente mounted_share no encontrada');
    err.statusCode = 404;
    err.code = 'DOCUMENT_SOURCE_NOT_FOUND';
    throw err;
  }

  const source = sourceResult.rows[0];
  const log = await pool.query(
    `
    INSERT INTO document_sync_logs (tenant_id, source_id, provider, status, started_at, details_json)
    VALUES ($1::uuid, $2::uuid, 'mounted_share', 'started', NOW(), $3::jsonb)
    RETURNING id
    `,
    [tenantId, sourceId, JSON.stringify({ folder_path: source.folder_path })]
  );
  const logId = log.rows[0].id;

  let filesSeen = 0;
  let filesIndexed = 0;
  let filesUpdated = 0;
  let filesSkipped = 0;
  const warnings = [];

  try {
    const listing = await listMountedShareFiles({
      folderPath: source.folder_path,
      includeSubfolders: source.include_subfolders !== false,
    });
    warnings.push(...listing.warnings);

    for (const file of listing.files) {
      filesSeen += 1;
      try {
        const contentHash = await hashFile(file.absolute_path);
        const providerFileId = `${sourceId}:${file.relative_path}`;
        const metadata = {
          mounted_share: true,
          folder_path: source.folder_path,
          relative_path: file.relative_path,
          synced_at: new Date().toISOString(),
        };

        const upsert = await pool.query(
          `
          INSERT INTO document_index (
            tenant_id,
            source_id,
            provider,
            provider_file_id,
            file_name,
            mime_type,
            file_extension,
            size_bytes,
            checksum,
            content_hash,
            file_hash,
            relative_path,
            local_storage_path,
            modified_at,
            indexed_at,
            last_seen_at,
            status,
            metadata_json
          )
          VALUES ($1,$2,'mounted_share',$3,$4,$5,$6,$7,$8,$8,$8,$9,$10,$11,NOW(),NOW(),'indexed',$12::jsonb)
          ON CONFLICT (tenant_id, provider, provider_file_id)
          DO UPDATE SET
            source_id = EXCLUDED.source_id,
            file_name = EXCLUDED.file_name,
            mime_type = EXCLUDED.mime_type,
            file_extension = EXCLUDED.file_extension,
            size_bytes = EXCLUDED.size_bytes,
            checksum = EXCLUDED.checksum,
            content_hash = EXCLUDED.content_hash,
            file_hash = EXCLUDED.file_hash,
            relative_path = EXCLUDED.relative_path,
            local_storage_path = EXCLUDED.local_storage_path,
            modified_at = EXCLUDED.modified_at,
            last_seen_at = NOW(),
            status = 'updated',
            metadata_json = EXCLUDED.metadata_json
          RETURNING (xmax = 0) AS inserted
          `,
          [
            tenantId,
            sourceId,
            providerFileId,
            file.file_name,
            null,
            file.file_extension,
            file.size_bytes,
            contentHash,
            file.relative_path,
            file.absolute_path,
            file.modified_at,
            JSON.stringify(metadata),
          ]
        );

        if (upsert.rows[0]?.inserted) filesIndexed += 1;
        else filesUpdated += 1;
      } catch (error) {
        filesSkipped += 1;
        warnings.push({ type: 'file_index_failed', path: file.relative_path, message: error.message });
      }
    }

    const finalStatus = warnings.length ? 'completed_with_warnings' : 'completed';
    await pool.query(
      `
      UPDATE document_sync_logs
      SET status = $2,
          finished_at = NOW(),
          files_seen = $3,
          files_indexed = $4,
          files_updated = $5,
          files_skipped = $6,
          details_json = COALESCE(details_json, '{}'::jsonb) || $7::jsonb
      WHERE id = $1::uuid
      `,
      [
        logId,
        finalStatus,
        filesSeen,
        filesIndexed,
        filesUpdated,
        filesSkipped,
        JSON.stringify({ warnings: warnings.slice(0, 50), warnings_count: warnings.length }),
      ]
    );

    await pool.query(
      `
      UPDATE tenant_document_sources
      SET last_sync_at = NOW(),
          last_sync_status = $3,
          last_sync_error = NULL,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      `,
      [sourceId, tenantId, finalStatus]
    );

    return {
      ok: true,
      provider: 'mounted_share',
      status: finalStatus,
      sync_log_id: logId,
      files_seen: filesSeen,
      files_indexed: filesIndexed,
      files_updated: filesUpdated,
      files_skipped: filesSkipped,
      warnings_count: warnings.length,
    };
  } catch (error) {
    await pool.query(
      `
      UPDATE document_sync_logs
      SET status = 'failed',
          finished_at = NOW(),
          error_message = $2,
          files_seen = $3,
          files_indexed = $4,
          files_updated = $5,
          files_skipped = $6,
          details_json = COALESCE(details_json, '{}'::jsonb) || $7::jsonb
      WHERE id = $1::uuid
      `,
      [
        logId,
        error.code || 'MOUNTED_SHARE_SYNC_ERROR',
        filesSeen,
        filesIndexed,
        filesUpdated,
        filesSkipped,
        JSON.stringify({ safe_error: error.message, code: error.code || null }),
      ]
    );

    await pool.query(
      `
      UPDATE tenant_document_sources
      SET status = CASE WHEN status = 'disconnected' THEN status ELSE 'error' END,
          last_sync_status = 'failed',
          last_sync_error = $3,
          updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      `,
      [sourceId, tenantId, error.code || 'MOUNTED_SHARE_SYNC_ERROR']
    );
    throw error;
  }
}

module.exports = {
  validateMountedSharePath,
  listMountedShareFiles,
  indexMountedShareSource,
  ALLOWED_EXTENSIONS,
};
