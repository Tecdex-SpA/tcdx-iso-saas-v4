#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

function applyDatabaseUrl() {
  if (!process.env.DATABASE_URL) return;
  try {
    const url = new URL(process.env.DATABASE_URL);
    process.env.DB_HOST = process.env.DB_HOST || url.hostname;
    process.env.DB_PORT = process.env.DB_PORT || url.port || '5432';
    process.env.DB_USER = process.env.DB_USER || decodeURIComponent(url.username || '');
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || decodeURIComponent(url.password || '');
    process.env.DB_NAME = process.env.DB_NAME || decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (url.searchParams.get('sslmode')) {
      process.env.DB_SSL = process.env.DB_SSL || String(url.searchParams.get('sslmode') !== 'disable');
    }
  } catch {
    // Keep pg's normal error path; never print database credentials.
  }
}

applyDatabaseUrl();

const pool = require('../src/config/db');
const zoho = require('../src/services/zohoWorkdriveClient.service');

const SOURCE_ID = String(process.env.SOURCE_ID || '').trim();
const KNOWN_FOLDER_ID = String(process.env.KNOWN_FOLDER_ID || '').trim();
const WORKSPACE_ID = String(process.env.WORKSPACE_ID || '').trim();
const ZOHO_PROVIDER = 'zoho_workdrive';

function topKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).slice(0, 20);
}

function dataLength(value) {
  if (Array.isArray(value?.data)) return value.data.length;
  if (Array.isArray(value?.files)) return value.files.length;
  if (Array.isArray(value?.folders)) return value.folders.length;
  if (Array.isArray(value?.items)) return value.items.length;
  return 0;
}

function firstItems(value) {
  const rows = Array.isArray(value?.data)
    ? value.data
    : Array.isArray(value?.files)
      ? value.files
      : Array.isArray(value?.folders)
        ? value.folders
        : Array.isArray(value?.items)
          ? value.items
          : [];
  return rows.slice(0, 5).map((item) => {
    const normalized = zoho.normalizeZohoItem(item);
    return {
      id: normalized.id,
      name: normalized.name,
      item_type: normalized.item_type,
      mime_type: normalized.mime_type,
      parent_id: normalized.parent_id,
    };
  });
}

async function loadCredential(sourceId) {
  const sourceResult = await pool.query(
    `
    SELECT *
    FROM tenant_document_sources
    WHERE id = $1::uuid
      AND provider = $2
    LIMIT 1
    `,
    [sourceId, ZOHO_PROVIDER]
  );
  const source = sourceResult.rows[0];
  if (!source) {
    throw new Error('No existe fuente Zoho para SOURCE_ID.');
  }

  const credentialResult = await pool.query(
    `
    SELECT *
    FROM tenant_document_provider_credentials
    WHERE source_id = $1::uuid
      AND tenant_id = $2::uuid
      AND provider = $3
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1
    `,
    [source.id, source.tenant_id, ZOHO_PROVIDER]
  );
  const credential = credentialResult.rows[0];
  if (!credential) {
    throw new Error('No existe credencial Zoho para SOURCE_ID.');
  }
  return { source, credential };
}

async function main() {
  if (!SOURCE_ID) {
    throw new Error('SOURCE_ID es obligatorio. Ejemplo: SOURCE_ID=<uuid> node backend/scripts/probe-zoho-workdrive.js');
  }
  const { source, credential } = await loadCredential(SOURCE_ID);
  const tokens = zoho.decryptZohoCredential(credential);
  const apiBaseUrl = source.metadata_json?.api_domain || credential.metadata_json?.api_domain || process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.com';
  const paths = ['/workdrive/api/v1/files'];
  if (KNOWN_FOLDER_ID) {
    paths.push(`/workdrive/api/v1/files/${encodeURIComponent(KNOWN_FOLDER_ID)}`);
    paths.push(`/workdrive/api/v1/files/${encodeURIComponent(KNOWN_FOLDER_ID)}/files`);
  }

  console.log(JSON.stringify({
    source_id: source.id,
    tenant_id: `${String(source.tenant_id).slice(0, 8)}...${String(source.tenant_id).slice(-4)}`,
    provider: source.provider,
    account_email: source.provider_account_email || null,
    scopes: credential.scopes || credential.metadata_json?.scopes || credential.metadata_json?.granted_scopes || null,
    token_expires_at: credential.token_expires_at || null,
    api_domain: apiBaseUrl,
    workspace_id: WORKSPACE_ID || source.metadata_json?.workspace_id || source.metadata_json?.zoho_workspace_id || null,
    folder_id: KNOWN_FOLDER_ID || source.folder_id || null,
    known_folder_id_present: Boolean(KNOWN_FOLDER_ID),
  }, null, 2));

  for (const path of paths) {
    const result = await zoho.callZohoWorkdriveApi({
      accessToken: tokens.access_token,
      apiBaseUrl,
      path,
      stage: 'script_probe',
      allowFailure: true,
    });
    console.log(JSON.stringify({
      path: result.path,
      method: 'GET',
      status: result.status,
      provider_code: result.provider_code,
      provider_message: result.provider_message,
      accept: result.accept,
      top_keys: topKeys(result.json),
      data_len: dataLength(result.json),
      first_items: firstItems(result.json),
      raw_snippet: result.raw_snippet || null,
      attempts: (result.diagnostics || []).map((attempt) => ({
        accept: attempt.accept,
        status: attempt.status,
        provider_code: attempt.provider_code,
        provider_message: attempt.provider_message,
        top_keys: attempt.response_keys,
      })),
    }, null, 2));
  }

  if (KNOWN_FOLDER_ID) {
    const contents = await zoho.listZohoFolderContents({
      accessToken: tokens.access_token,
      apiBaseUrl,
      folderId: KNOWN_FOLDER_ID,
      workspaceId: WORKSPACE_ID || source.metadata_json?.workspace_id || source.metadata_json?.zoho_workspace_id || null,
      spaceType: source.metadata_json?.zoho_space_type || null,
      preferredEndpoint: source.metadata_json?.zoho_working_list_endpoint || null,
      stage: 'script_folder_contents_probe',
    }).catch((error) => ({
      ok: false,
      code: error.code || 'ZOHO_FOLDER_CONTENTS_FAILED',
      message: error.message,
      diagnostics: error.diagnostics || [],
    }));
    console.log(JSON.stringify({
      matrix_probe: true,
      ok: contents.ok !== false,
      code: contents.code || null,
      message: contents.message || null,
      working_endpoint: contents.working_endpoint || null,
      files_count: contents.files?.length || 0,
      folders_count: contents.folders?.length || 0,
      first_items: [...(contents.folders || []), ...(contents.files || [])].slice(0, 5).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        is_folder: item.item_type === 'folder',
        mime_type: item.mime_type,
        parent_id: item.parent_id,
      })),
      diagnostics: (contents.diagnostics || []).map((attempt) => ({
        path: attempt.path,
        method: 'GET',
        status: attempt.status,
        provider_code: attempt.provider_code,
        provider_message: attempt.provider_message,
        response_keys: attempt.response_keys,
        data_len: attempt.data_len,
        raw_snippet: attempt.raw_snippet || null,
      })),
    }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      code: error.code || 'ZOHO_PROBE_SCRIPT_FAILED',
      message: error.message,
      provider_status: error.provider_status || null,
      provider_code: error.provider_code || null,
      endpoint: error.endpoint || null,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => null);
  });
