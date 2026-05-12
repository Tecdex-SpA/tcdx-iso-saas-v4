const pool = require('../config/db')
const { decryptToken, encryptToken } = require('../utils/cryptoTokens')
const {
  buildOAuthClientFromTokens,
  listDriveFiles
} = require('./providers/googleDrive.provider')

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

async function syncGoogleDriveSource({ tenantId, sourceId }) {
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
      [tenantId, sourceRow.id, integrationRow.id, JSON.stringify({ folder_id: sourceRow.folder_id || 'root' })]
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

  try {
    const oauthClient = buildOAuthClientFromTokens(buildTokens(integrationRow))
    let nextPageToken = null

    do {
      const page = await listDriveFiles({
        oauthClient,
        folderId: sourceRow.folder_id || 'root',
        pageToken: nextPageToken
      })

      for (const file of page.files) {
        filesSeen += 1

        if (!file?.id || !file?.name) {
          filesSkipped += 1
          continue
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
            JSON.stringify({
              google: {
                parents: file.parents || [],
                icon_link: file.iconLink || null,
                owners: file.owners || []
              },
              synced_at: new Date().toISOString()
            })
          ]
        )

        if (upsert.rows[0]?.inserted) filesIndexed += 1
        else filesUpdated += 1
      }

      nextPageToken = page.nextPageToken
    } while (nextPageToken)

    await pool.query(
      `
      UPDATE document_sync_logs
      SET
        status = 'completed',
        finished_at = NOW(),
        files_seen = $2,
        files_indexed = $3,
        files_updated = $4,
        files_skipped = $5,
        details_json = COALESCE(details_json, '{}'::jsonb) || $6::jsonb
      WHERE id = $1
      `,
      [syncLogId, filesSeen, filesIndexed, filesUpdated, filesSkipped, JSON.stringify({ folder_id: sourceRow.folder_id || 'root' })]
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
      files_seen: filesSeen,
      files_indexed: filesIndexed,
      files_updated: filesUpdated,
      files_skipped: filesSkipped
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
        JSON.stringify({ safe_error: err.message, token_logged: false })
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
