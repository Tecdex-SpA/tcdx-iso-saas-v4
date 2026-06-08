#!/usr/bin/env node

const pool = require('../src/config/db');
const zoho = require('../src/services/zohoWorkdriveClient.service');

const SOURCE_ID = String(process.env.SOURCE_ID || '').trim();
const KNOWN_FOLDER_ID = String(process.env.KNOWN_FOLDER_ID || '').trim();
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
    api_domain: apiBaseUrl,
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
      status: result.status,
      provider_code: result.provider_code,
      provider_message: result.provider_message,
      accept: result.accept,
      top_keys: topKeys(result.json),
      data_len: dataLength(result.json),
      first_items: firstItems(result.json),
      attempts: (result.diagnostics || []).map((attempt) => ({
        accept: attempt.accept,
        status: attempt.status,
        provider_code: attempt.provider_code,
        provider_message: attempt.provider_message,
        top_keys: attempt.response_keys,
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
