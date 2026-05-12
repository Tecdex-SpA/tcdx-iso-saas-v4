const pool = require('../config/db')
const { decryptToken, encryptToken } = require('../utils/cryptoTokens')
const {
  buildOAuthClientFromTokens,
  listDriveFiles
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

async function upsertDocument({ tenantId, sourceRow, integrationRow, file, folderPath, parentFolderId }) {
  const metadata = {
    google: {
      parents: file.parents || [],
      parent_folder_id: parentFolderId || null,
      folder_path: folderPath || sourceRow.folder_path || sourceRow.source_name || null,
      is_folder: false,
      icon_link: file.iconLink || null,
      owners: file.owners || []
    },
    folder_path: folderPath || sourceRow.folder_path || sourceRow.source_name || null,
    synced_at: new Date().toISOString()
  }

  const upsert = await pool.query(
    `
    INSERT INTO document_index (
      tenant_id,
      source_id,
      integration_id,
      provider,
      provider_file_id,
      provider_version_id,
      file_name,
      mime_type,
      file_extension,
      file_url,
      web_view_url,
      size_bytes,
      checksum,
      modified_at,
      indexed_at,
      last_seen_at,
      status,
      metadata_json
    )
    VALUES ($1,$2,$3,'google_drive',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW(),'indexed',$14::jsonb)
    ON CONFLICT (tenant_id, provider, provider_file_id)
    DO UPDATE SET
      source_id = EXCLUDED.source_id,
      integration_id = EXCLUDED.integration_id,
      provider_version_id = EXCLUDED.provider_version_id,
      file_name = EXCLUDED.file_name,
      mime_type = EXCLUDED.mime_type,
      file_extension = EXCLUDED.file_extension,
      file_url = EXCLUDED.file_url,
      web_view_url = EXCLUDED.web_view_url,
      size_bytes = EXCLUDED.size_bytes,
      checksum = EXCLUDED.checksum,
      modified_at = EXCLUDED.modified_at,
      last_seen_at = NOW(),
      status = 'updated',
      metadata_json = EXCLUDED.metadata_json
    RETURNING (xmax = 0) AS inserted
    `,
    [
      tenantId,
      sourceRow.id,
      integrationRow.id,
      file.id,
      file.version ? String(file.version) : null,
      file.name,
      file.mimeType || null,
      extractExtension(file.name),
      file.webViewLink || null,
      file.webViewLink || null,
      file.size ? Number(file.size) : null,
      file.md5Checksum || null,
      file.modifiedTime ? new Date(file.modifiedTime) : null,
      JSON.stringify(metadata)
    ]
  )

  return Boolean(upsert.rows[0]?.inserted)
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
          recursive: true,
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
  let filesIndexed = 0
  let filesUpdated = 0
  let filesSkipped = 0
  let foldersSeen = 0
  let maxDepthReached = false
  const warnings = []
  const visitedFolderIds = new Set()

  try {
    const oauthClient = buildOAuthClientFromTokens(buildTokens(integrationRow))
    const rootFolderId = String(sourceRow.folder_id)
    const rootPath = sourceRow.folder_path || sourceRow.source_name || 'Google Drive'

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

        try {
          const inserted = await upsertDocument({
            tenantId,
            sourceRow,
            integrationRow,
            file,
            folderPath,
            parentFolderId: folderId
          })

          if (inserted) filesIndexed += 1
          else filesUpdated += 1
        } catch (err) {
          filesSkipped += 1
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
        filesIndexed,
        filesUpdated,
        filesSkipped,
        JSON.stringify({
          folder_id: rootFolderId,
          folder_path: rootPath,
          recursive: true,
          max_depth: safeMaxDepth,
          max_files: safeMaxFiles,
          folders_seen: foldersSeen,
          warnings_count: warnings.length,
          max_depth_reached: maxDepthReached,
          warnings: warnings.slice(0, 50)
        })
      ]
    )

    await pool.query(
      `UPDATE tenant_document_sources SET last_sync_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [sourceRow.id, tenantId]
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
      recursive: true,
      max_depth: safeMaxDepth,
      max_files: safeMaxFiles,
      folders_seen: foldersSeen,
      files_seen: filesSeen,
      files_indexed: filesIndexed,
      files_updated: filesUpdated,
      files_skipped: filesSkipped,
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
        filesIndexed,
        filesUpdated,
        filesSkipped,
        'Error sincronizando Google Drive',
        JSON.stringify({
          safe_error: err.message,
          token_logged: false,
          recursive: true,
          folders_seen: foldersSeen,
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

    throw err
  }
}

module.exports = {
  syncGoogleDriveSource
}
