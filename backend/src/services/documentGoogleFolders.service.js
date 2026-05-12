const pool = require('../config/db');
const { decryptToken } = require('../utils/cryptoTokens');
const {
  buildOAuthClientFromTokens,
  listDriveFolders,
} = require('./providers/googleDrive.provider');

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
  integrationId,
  parentId = 'root',
  pageToken = null,
}) {
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
    throw err;
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
    provider: 'google_drive',
    integration_id: integrationId,
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

module.exports = {
  browseGoogleDriveFolders,
};
