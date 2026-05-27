const pool = require('../config/db')
const { decryptToken, encryptToken } = require('../utils/cryptoTokens')
const {
  buildOAuthClientFromTokens,
  listDriveFiles,
  hasGoogleDriveReadScope,
  buildGoogleReconnectRequiredError
} = require('./providers/googleDrive.provider')

const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder'

function extractExtension(fileName) {
  const name = String(fileName || '')
  const idx = name.lastIndexOf('.')
  return idx > -1 ? name.slice(idx + 1).toLowerCase().slice(0, 40) : null
}

function buildTokens(integration) {
  const tokenSet = {}
  const access = decryptToken(integration.encrypted_access_token)
  const refresh = decryptToken(integration.encrypted_refresh_token)

  if (access) tokenSet.access_token = access
  if (refresh) tokenSet.refresh_token = refresh
  if (integration.token_expires_at) {
    tokenSet.expiry_date = new Date(integration.token_expires_at).getTime()
  }

  return tokenSet
}

function clampInt(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function isFolder(file) {
  return file?.mimeType === GOOGLE_FOLDER_MIME
}

function normalizeFolderPath(...parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' / ')
}

function normalizeRelativePath(...parts) {
  return parts
    .map((part) => String(part || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

function googleVersionId(file) {
  return file?.headRevisionId ? String(file.headRevisionId) : (file?.version ? String(file.version) : (file?.modifiedTime || null))
}

function sameNullable(left, right) {
  if (left === null || left === undefined || left === '') return right === null || right === undefined || right === ''
  if (right === null || right === undefined || right === '') return false
  return String(left) === String(right)
}

function sameTimestamp(left, right) {
  if (!left && !right) return true
  if (!left || !right) return false
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime
}

async function persistRefreshedCredentials({ integrationId, tenantId, oauthClient }) {
  const credentials = oauthClient.credentials || {}
  const encryptedAccess = credentials.access_token ? encryptToken(credentials.access_token) : null
  const encryptedRefresh = credentials.refresh_token ? encryptToken(credentials.refresh_token) : null
  const expiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : null

  if (!encryptedAccess && !encryptedRefresh && !expiresAt) return

  await pool.query(
    `
    UPDATE tenant_integrations
    SET
      encrypted_access_token = COALESCE($3, encrypted_access_token),
      encrypted_refresh_token = COALESCE($4, encrypted_refresh_token),
      token_expires_at = COALESCE($5, token_expires_at),
      status = 'connected',
      updated_at = NOW()
    WHERE id = $1
      AND tenant_id = $2
    `,
    [integrationId, tenantId, encryptedAccess, encryptedRefresh, expiresAt]
  )
}

async function markDuplicateDocuments({ tenantId, sourceId }) {
  const result = await pool.query(
    `
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY tenant_id, provider, provider_file_id
          ORDER BY last_seen_at DESC NULLS LAST, indexed_at DESC NULLS LAST, modified_at DESC NULLS LAST, id DESC
        ) AS canonical_id,
        ROW_NUMBER() OVER (
          PARTITION BY tenant_id, provider, provider_file_id
          ORDER BY last_seen_at DESC NULLS LAST, indexed_at DESC NULLS LAST, modified_at DESC NULLS LAST, id DESC
        ) AS rn
      FROM document_index
      WHERE tenant_id = $1::uuid
        AND source_id = $2::uuid
        AND provider = 'google_drive'
        AND provider_file_id IS NOT NULL
    )
    UPDATE document_index d
    SET status = 'ignored',
        metadata_json = COALESCE(d.metadata_json, '{}'::jsonb) || jsonb_build_object(
          'duplicate_of', ranked.canonical_id,
          'duplicate_detected_at', NOW(),
          'duplicate_preserved_due_to_relations', true
        )
    FROM ranked
    WHERE d.id = ranked.id
      AND ranked.rn > 1
    RETURNING d.id
    `,
    [tenantId, sourceId]
  )
  return result.rowCount || 0
}

async function upsertDocument({ tenantId, sourceRow, integrationRow, file, folderPath, parentFolderId }) {
  const relativePath = normalizeRelativePath(folderPath, file.name)
  const providerVersionId = googleVersionId(file)
  const modifiedAt = file.modifiedTime ? new Date(file.modifiedTime) : null
  const sizeBytes = file.size ? Number(file.size) : null
  const metadata = {
    google: {
      parents: file.parents || [],
      parent_folder_id: parentFolderId || null,
      folder_path: folderPath || sourceRow.folder_path || sourceRow.source_name || null,
      relative_path: relativePath,
      is_folder: false,
      icon_link: file.iconLink || null,
      owners: file.owners || []
    },
    folder_path: folderPath || sourceRow.folder_path || sourceRow.source_name || null,
    relative_path: relativePath,
    synced_at: new Date().toISOString()
  }

  const existing = await pool.query(
    `
    SELECT id, provider_version_id, file_name, mime_type, file_extension, size_bytes, checksum, modified_at, relative_path, status
    FROM document_index
    WHERE tenant_id = $1::uuid
      AND provider = 'google_drive'
      AND provider_file_id = $2::varchar
    ORDER BY last_seen_at DESC NULLS LAST, indexed_at DESC NULLS LAST
    LIMIT 1
    `,
    [tenantId, file.id]
  )

  if (existing.rowCount === 0) {
    await pool.query(
      `
      INSERT INTO document_index (
        tenant_id, source_id, integration_id, provider, provider_file_id, provider_version_id,
        file_name, mime_type, file_extension, file_url, web_view_url, size_bytes, checksum,
        modified_at, indexed_at, last_seen_at, status, relative_path, metadata_json
      )
      VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'google_drive', $4::varchar, $5::varchar,
        $6::varchar, $7::varchar, $8::varchar, $9::text, $10::text, $11::bigint, $12::varchar,
        $13::timestamp, NOW(), NOW(), 'indexed', $14::text, $15::jsonb
      )
      `,
      [
        tenantId,
        sourceRow.id,
        integrationRow.id,
        file.id,
        providerVersionId,
        file.name,
        file.mimeType || null,
        extractExtension(file.name),
        file.webViewLink || null,
        file.webViewLink || null,
        sizeBytes,
        file.md5Checksum || null,
        modifiedAt,
        relativePath,
        JSON.stringify(metadata)
      ]
    )
    return 'created'
  }

  const current = existing.rows[0]
  const changed = (
    !sameNullable(current.provider_version_id, providerVersionId) ||
    !sameNullable(current.file_name, file.name) ||
    !sameNullable(current.mime_type, file.mimeType || null) ||
    !sameNullable(current.file_extension, extractExtension(file.name)) ||
    !sameNullable(current.size_bytes, sizeBytes) ||
    !sameNullable(current.checksum, file.md5Checksum || null) ||
    !sameTimestamp(current.modified_at, modifiedAt) ||
    !sameNullable(current.relative_path, relativePath) ||
    ['missing', 'ignored', 'error'].includes(String(current.status || '').toLowerCase())
  )

  await pool.query(
    `
    UPDATE document_index
    SET source_id = $2::uuid,
        integration_id = $3::uuid,
        provider_version_id = $4::varchar,
        file_name = $5::varchar,
        mime_type = $6::varchar,
        file_extension = $7::varchar,
        file_url = $8::text,
        web_view_url = $9::text,
        size_bytes = $10::bigint,
        checksum = $11::varchar,
        modified_at = $12::timestamp,
        relative_path = $13::text,
        last_seen_at = NOW(),
        status = $14::varchar,
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $15::jsonb
    WHERE id = $1::uuid
      AND tenant_id = $16::uuid
    `,
    [
      current.id,
      sourceRow.id,
      integrationRow.id,
      providerVersionId,
      file.name,
      file.mimeType || null,
      extractExtension(file.name),
      file.webViewLink || null,
      file.webViewLink || null,
      sizeBytes,
      file.md5Checksum || null,
      modifiedAt,
      relativePath,
      changed ? 'updated' : (current.status || 'indexed'),
      JSON.stringify({
        ...metadata,
        previous_version_id: sameNullable(current.provider_version_id, providerVersionId) ? null : current.provider_version_id || null
      }),
      tenantId
    ]
  )

  return changed ? 'updated' : 'unchanged'
}

async function listAllPages({ oauthClient, folderId, warnings }) {
  const files = []
  let nextPageToken = null

  do {
    try {
      const page = await listDriveFiles({
        oauthClient,
        folderId,
        pageToken: nextPageToken
      })

      files.push(...(page.files || []))
      nextPageToken = page.nextPageToken || null
    } catch (err) {
      warnings.push({
        type: 'list_folder_failed',
        folder_id: folderId,
        message: err.message
      })
      nextPageToken = null
    }
  } while (nextPageToken)

  return files
}

async function syncGoogleDriveSource({
  tenantId,
  sourceId,
  maxDepth = 5,
  maxFiles = 1000,
  allowRoot = false
}) {
  const safeMaxDepth = clampInt(maxDepth, 5, 1, 10)
  const safeMaxFiles = clampInt(maxFiles, 1000, 1, 5000)

  const setupClient = await pool.connect()
  let sourceRow = null
  let integrationRow = null
  let syncLogId = null

  try {
    await setupClient.query('BEGIN')

    const source = await setupClient.query(
      `
      SELECT *
      FROM tenant_document_sources
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [sourceId, tenantId]
    )

    if (source.rowCount === 0) {
      throw new Error('Fuente documental no encontrada')
    }

    sourceRow = source.rows[0]

    if (sourceRow.provider !== 'google_drive') {
      throw new Error('La fuente no corresponde a Google Drive')
    }

    if (!sourceRow.folder_id) {
      throw new Error('La fuente no tiene folder_id configurado')
    }

    if (String(sourceRow.folder_id) === 'root' && allowRoot !== true) {
      throw new Error('No se permite sincronizar root. Selecciona una carpeta específica.')
    }

    const integration = await setupClient.query(
      `
      SELECT *
      FROM tenant_integrations
      WHERE id = $1
        AND tenant_id = $2
        AND provider = 'google_drive'
      LIMIT 1
      `,
      [sourceRow.integration_id, tenantId]
    )

    if (integration.rowCount === 0) {
      throw new Error('Integración Google Drive no encontrada')
    }

    integrationRow = integration.rows[0]

    if (integrationRow.status !== 'connected') {
      throw new Error('Integración Google Drive no conectada')
    }

    if (sourceRow.status === 'disconnected') {
      const err = new Error('Fuente documental desconectada')
      err.statusCode = 409
      err.code = 'DOCUMENT_SOURCE_DISCONNECTED'
      throw err
    }

    if (sourceRow.sync_enabled === false || sourceRow.status === 'paused') {
      const err = new Error('Sincronización deshabilitada para esta fuente')
      err.statusCode = 409
      err.code = 'DOCUMENT_SOURCE_SYNC_DISABLED'
      throw err
    }

    if (!hasGoogleDriveReadScope(integrationRow.scopes)) {
      throw buildGoogleReconnectRequiredError()
    }

    const log = await setupClient.query(
      `
      INSERT INTO document_sync_logs (
        tenant_id, source_id, integration_id, provider, status, started_at, details_json
      )
      VALUES ($1,$2,$3,'google_drive','started',NOW(),$4::jsonb)
      RETURNING id
      `,
      [
        tenantId,
        sourceRow.id,
        integrationRow.id,
        JSON.stringify({
          folder_id: sourceRow.folder_id,
          folder_path: sourceRow.folder_path || sourceRow.source_name,
          recursive: sourceRow.include_subfolders !== false,
          max_depth: safeMaxDepth,
          max_files: safeMaxFiles
        })
      ]
    )

    syncLogId = log.rows[0].id
    await setupClient.query('COMMIT')
  } catch (err) {
    await setupClient.query('ROLLBACK')
    throw err
  } finally {
    setupClient.release()
  }

  let filesSeen = 0
  let filesCreated = 0
  let filesUpdated = 0
  let filesUnchanged = 0
  let filesSkipped = 0
  let filesMissing = 0
  let filesErrors = 0
  let duplicatesIgnored = 0
  let foldersSeen = 0
  let maxDepthReached = false
  const warnings = []
  const visitedFolderIds = new Set()
  const seenProviderFileIds = new Set()

  try {
    const oauthClient = buildOAuthClientFromTokens(buildTokens(integrationRow))
    const rootFolderId = String(sourceRow.folder_id)
    const rootPath = sourceRow.folder_path || sourceRow.source_name || 'Google Drive'
    const includeSubfolders = sourceRow.include_subfolders !== false

    duplicatesIgnored = await markDuplicateDocuments({ tenantId, sourceId: sourceRow.id })

    const walkFolder = async ({ folderId, folderPath, depth }) => {
      if (visitedFolderIds.has(folderId)) {
        warnings.push({
          type: 'folder_loop_skipped',
          folder_id: folderId,
          folder_path: folderPath
        })
        return
      }

      visitedFolderIds.add(folderId)
      foldersSeen += 1

      if (depth > safeMaxDepth) {
        maxDepthReached = true
        warnings.push({
          type: 'max_depth_reached',
          folder_id: folderId,
          folder_path: folderPath,
          depth
        })
        return
      }

      const files = await listAllPages({ oauthClient, folderId, warnings })

      for (const file of files) {
        if (!file?.id || !file?.name) {
          filesSkipped += 1
          warnings.push({
            type: 'invalid_file_skipped',
            folder_id: folderId,
            folder_path: folderPath
          })
          continue
        }

        if (isFolder(file)) {
          if (!includeSubfolders) {
            filesSkipped += 1
            continue
          }
          const childPath = normalizeFolderPath(folderPath, file.name)
          await walkFolder({
            folderId: file.id,
            folderPath: childPath,
            depth: depth + 1
          })
          continue
        }

        if (filesSeen >= safeMaxFiles) {
          filesSkipped += 1
          warnings.push({
            type: 'max_files_reached',
            max_files: safeMaxFiles,
            skipped_file: file.name,
            folder_path: folderPath
          })
          continue
        }

        filesSeen += 1
        seenProviderFileIds.add(file.id)

        try {
          const changeType = await upsertDocument({
            tenantId,
            sourceRow,
            integrationRow,
            file,
            folderPath,
            parentFolderId: folderId
          })

          if (changeType === 'created') filesCreated += 1
          else if (changeType === 'updated') filesUpdated += 1
          else filesUnchanged += 1
        } catch (err) {
          filesErrors += 1
          warnings.push({
            type: 'file_upsert_failed',
            file_id: file.id,
            file_name: file.name,
            folder_path: folderPath,
            message: err.message
          })
        }
      }
    }

    await walkFolder({
      folderId: rootFolderId,
      folderPath: rootPath,
      depth: 0
    })

    const seenIds = Array.from(seenProviderFileIds)
    const missingResult = await pool.query(
      `
      UPDATE document_index
      SET status = 'missing',
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object('last_missing_detected_at', NOW())
      WHERE tenant_id = $1::uuid
        AND source_id = $2::uuid
        AND provider = 'google_drive'
        AND status NOT IN ('missing', 'ignored')
        AND (
          cardinality($3::text[]) = 0
          OR NOT (provider_file_id = ANY($3::text[]))
        )
      RETURNING id
      `,
      [tenantId, sourceRow.id, seenIds]
    )
    filesMissing = missingResult.rowCount || 0

    const finalStatus = warnings.length > 0 ? 'completed_with_warnings' : 'completed'

    await pool.query(
      `
      UPDATE document_sync_logs
      SET
        status = $2,
        finished_at = NOW(),
        files_seen = $3,
        files_indexed = $4,
        files_updated = $5,
        files_skipped = $6,
        details_json = COALESCE(details_json, '{}'::jsonb) || $7::jsonb
      WHERE id = $1
      `,
      [
        syncLogId,
        finalStatus,
        filesSeen,
        filesCreated,
        filesUpdated,
        filesSkipped + filesErrors,
        JSON.stringify({
          folder_id: rootFolderId,
          folder_path: rootPath,
          recursive: includeSubfolders,
          max_depth: safeMaxDepth,
          max_files: safeMaxFiles,
          folders_seen: foldersSeen,
          files_created: filesCreated,
          files_updated: filesUpdated,
          files_unchanged: filesUnchanged,
          files_missing: filesMissing,
          files_ignored: duplicatesIgnored,
          files_errors: filesErrors,
          warnings_count: warnings.length,
          max_depth_reached: maxDepthReached,
          warnings: warnings.slice(0, 50)
        })
      ]
    )

    await pool.query(
      `
      UPDATE tenant_document_sources
      SET last_sync_at = NOW(),
          last_sync_status = $3,
          last_sync_error = NULL,
          updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
      `,
      [sourceRow.id, tenantId, finalStatus]
    )

    await pool.query(
      `UPDATE tenant_integrations SET last_sync_at = NOW(), status = 'connected', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [integrationRow.id, tenantId]
    )

    await persistRefreshedCredentials({ integrationId: integrationRow.id, tenantId, oauthClient })

    return {
      ok: true,
      provider: 'google_drive',
      sync_log_id: syncLogId,
      status: finalStatus,
      recursive: includeSubfolders,
      max_depth: safeMaxDepth,
      max_files: safeMaxFiles,
      folders_seen: foldersSeen,
      files_seen: filesSeen,
      files_indexed: filesCreated,
      files_created: filesCreated,
      files_updated: filesUpdated,
      files_unchanged: filesUnchanged,
      files_missing: filesMissing,
      files_ignored: duplicatesIgnored,
      files_errors: filesErrors,
      files_skipped: filesSkipped + filesErrors,
      warnings_count: warnings.length,
      max_depth_reached: maxDepthReached
    }
  } catch (err) {
    await pool.query(
      `
      UPDATE document_sync_logs
      SET
        status = 'failed',
        finished_at = NOW(),
        files_seen = $2,
        files_indexed = $3,
        files_updated = $4,
        files_skipped = $5,
        error_message = $6,
        details_json = COALESCE(details_json, '{}'::jsonb) || $7::jsonb
      WHERE id = $1
      `,
      [
        syncLogId,
        filesSeen,
        filesCreated,
        filesUpdated,
        filesSkipped + filesErrors,
        'Error sincronizando Google Drive',
        JSON.stringify({
          safe_error: err.message,
          token_logged: false,
          recursive: sourceRow?.include_subfolders !== false,
          folders_seen: foldersSeen,
          files_created: filesCreated,
          files_updated: filesUpdated,
          files_unchanged: filesUnchanged,
          files_missing: filesMissing,
          files_ignored: duplicatesIgnored,
          files_errors: filesErrors,
          warnings_count: warnings.length,
          warnings: warnings.slice(0, 50)
        })
      ]
    )

    if (integrationRow?.id) {
      await pool.query(
        `UPDATE tenant_integrations SET status = 'error', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [integrationRow.id, tenantId]
      )
    }

    if (sourceRow?.id) {
      await pool.query(
        `
        UPDATE tenant_document_sources
        SET last_sync_status = 'failed',
            last_sync_error = $3,
            updated_at = NOW()
        WHERE id = $1
          AND tenant_id = $2
        `,
        [sourceRow.id, tenantId, String(err.message || 'Error sincronizando Google Drive').slice(0, 500)]
      )
    }

    throw err
  }
}

module.exports = {
  syncGoogleDriveSource
}
