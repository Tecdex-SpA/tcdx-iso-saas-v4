const pool = require('../config/db');
const { decryptToken } = require('../utils/cryptoTokens');
const {
  buildOAuthClientFromTokens,
  listDriveFolders,
  hasGoogleDriveReadScope,
  buildGoogleReconnectRequiredError,
  getDriveFileMetadata,
} = require('./providers/googleDrive.provider');

const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';

function buildTokensFromIntegration(integration) {
  const tokens = {};

  const accessToken = decryptToken(integration.encrypted_access_token);
  const refreshToken = decryptToken(integration.encrypted_refresh_token);

  if (accessToken) tokens.access_token = accessToken;
  if (refreshToken) tokens.refresh_token = refreshToken;

  if (integration.token_expires_at) {
    tokens.expiry_date = new Date(integration.token_expires_at).getTime();
  }

  return tokens;
}

async function browseGoogleDriveFolders({
  tenantId,
  integrationId = null,
  sourceId = null,
  parentId = 'root',
  pageToken = null,
}) {
  let source = null;
  if (sourceId) {
    const sourceResult = await pool.query(
      `
      SELECT *
      FROM tenant_document_sources
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND provider = 'google_drive'
        AND COALESCE(status, '') <> 'disconnected'
      LIMIT 1
      `,
      [sourceId, tenantId]
    );
    source = sourceResult.rows[0] || null;
    if (!source) {
      const err = new Error('Fuente Google Drive no encontrada para este tenant');
      err.statusCode = 404;
      err.code = 'GOOGLE_NOT_CONNECTED';
      throw err;
    }
    integrationId = source.integration_id;
  }

  const integrationResult = await pool.query(
    `
    SELECT *
    FROM tenant_integrations
    WHERE id = $1
      AND tenant_id = $2
      AND provider = 'google_drive'
      AND status = 'connected'
    LIMIT 1
    `,
    [integrationId, tenantId]
  );

  if (integrationResult.rowCount === 0) {
    const err = new Error('Integración Google Drive conectada no encontrada');
    err.statusCode = 404;
    err.code = 'GOOGLE_NOT_CONNECTED';
    throw err;
  }

  if (!hasGoogleDriveReadScope(integrationResult.rows[0].scopes)) {
    throw buildGoogleReconnectRequiredError();
  }

  const oauthClient = buildOAuthClientFromTokens(
    buildTokensFromIntegration(integrationResult.rows[0])
  );

  const result = await listDriveFolders({
    oauthClient,
    parentId,
    pageToken,
  });

  return {
    ok: true,
    provider: 'google_drive',
    integration_id: integrationId,
    source_id: source?.id || null,
    parent_id: parentId,
    folders: result.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      mime_type: folder.mimeType,
      web_view_url: folder.webViewLink,
      modified_at: folder.modifiedTime,
      parents: folder.parents || [],
      owners: folder.owners || [],
    })),
    next_page_token: result.nextPageToken,
  };
}

async function getGoogleDriveFolder({ tenantId, sourceId = null, integrationId = null, folderId }) {
  const parentResult = sourceId
    ? await browseGoogleDriveFolders({ tenantId, sourceId, parentId: 'root', pageToken: null }).catch((error) => {
        if (error.code === 'GOOGLE_RECONNECT_REQUIRED') throw error;
        return null;
      })
    : null;

  let resolvedIntegrationId = integrationId || parentResult?.integration_id || null;
  if (sourceId && !resolvedIntegrationId) {
    const source = await pool.query(
      `SELECT integration_id FROM tenant_document_sources WHERE id = $1::uuid AND tenant_id = $2::uuid AND provider = 'google_drive' LIMIT 1`,
      [sourceId, tenantId]
    );
    resolvedIntegrationId = source.rows[0]?.integration_id || null;
  }

  const integrationResult = await pool.query(
    `
    SELECT *
    FROM tenant_integrations
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
      AND provider = 'google_drive'
      AND status = 'connected'
    LIMIT 1
    `,
    [resolvedIntegrationId, tenantId]
  );

  if (integrationResult.rowCount === 0) {
    const err = new Error('Integración Google Drive conectada no encontrada');
    err.statusCode = 404;
    err.code = 'GOOGLE_NOT_CONNECTED';
    throw err;
  }
  if (!hasGoogleDriveReadScope(integrationResult.rows[0].scopes)) {
    throw buildGoogleReconnectRequiredError();
  }

  const oauthClient = buildOAuthClientFromTokens(buildTokensFromIntegration(integrationResult.rows[0]));
  const folder = await getDriveFileMetadata({ oauthClient, fileId: folderId });
  if (!folder || folder.mimeType !== GOOGLE_FOLDER_MIME) {
    const err = new Error('La carpeta seleccionada no existe o no es accesible.');
    err.statusCode = 404;
    err.code = 'GOOGLE_FOLDER_NOT_FOUND';
    throw err;
  }
  return folder;
}

module.exports = {
  browseGoogleDriveFolders,
  getGoogleDriveFolder,
};
