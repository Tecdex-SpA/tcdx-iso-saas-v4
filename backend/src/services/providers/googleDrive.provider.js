const { google } = require('googleapis');

function getScopes() {
  return String(
    process.env.GOOGLE_DRIVE_SCOPES ||
      'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.email'
  )
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Credenciales Google OAuth incompletas');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function buildGoogleOAuthUrl({ state }) {
  const oauthClient = getGoogleOAuthClient();

  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: getScopes(),
    state,
  });
}

async function exchangeCodeForTokens({ code }) {
  const oauthClient = getGoogleOAuthClient();
  const { tokens } = await oauthClient.getToken(code);
  oauthClient.setCredentials(tokens);

  return { oauthClient, tokens };
}

async function getAccountEmail({ oauthClient }) {
  const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
  const result = await oauth2.userinfo.get();

  return result?.data?.email || null;
}

function buildOAuthClientFromTokens(tokens) {
  const oauthClient = getGoogleOAuthClient();
  oauthClient.setCredentials(tokens);

  return oauthClient;
}

function escapeDriveQueryValue(value) {
  return String(value || '').replace(/'/g, "\\'");
}

async function listDriveFiles({ oauthClient, folderId, pageToken = null }) {
  const drive = google.drive({ version: 'v3', auth: oauthClient });

  const q = folderId
    ? `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`
    : 'trashed = false';

  const result = await drive.files.list({
    q,
    pageToken: pageToken || undefined,
    pageSize: 100,
    fields:
      'nextPageToken, files(id, name, mimeType, webViewLink, size, md5Checksum, modifiedTime, version, parents, iconLink, owners(emailAddress,displayName))',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return {
    files: result?.data?.files || [],
    nextPageToken: result?.data?.nextPageToken || null,
  };
}

async function listDriveFolders({ oauthClient, parentId = 'root', pageToken = null }) {
  const drive = google.drive({ version: 'v3', auth: oauthClient });

  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
    parentId ? `'${escapeDriveQueryValue(parentId)}' in parents` : null,
  ]
    .filter(Boolean)
    .join(' and ');

  const result = await drive.files.list({
    q,
    pageToken: pageToken || undefined,
    pageSize: 100,
    orderBy: 'name',
    fields:
      'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, parents, iconLink, owners(emailAddress,displayName))',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return {
    folders: result?.data?.files || [],
    nextPageToken: result?.data?.nextPageToken || null,
  };
}

module.exports = {
  getScopes,
  getGoogleOAuthClient,
  buildGoogleOAuthUrl,
  exchangeCodeForTokens,
  getAccountEmail,
  buildOAuthClientFromTokens,
  listDriveFiles,
  listDriveFolders,
};
