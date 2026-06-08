# Document provider disconnect

Sprint 3.5 supports tenant-scoped disconnect for document providers used by the unified evidence library.

Supported providers:

- Google Drive
- Zoho WorkDrive

## What Disconnect Does

Disconnect cuts future provider access for the authenticated tenant. It does not delete historical evidence.

The backend:

- requires auth and the same source-management authorization used for connect/reconnect flows;
- derives `tenant_id` and `user_id` from the authenticated context;
- validates optional `source_id` against the authenticated tenant;
- attempts OAuth token revocation with the provider;
- deletes local encrypted provider credentials;
- updates `tenant_document_sources.status = disconnected`;
- sets `sync_enabled = false`;
- sets `last_sync_status = disconnected`;
- clears selected folder and provider-account display fields;
- records a safe disconnect audit payload in `metadata_json`.

## What Disconnect Does Not Delete

Disconnect does not delete:

- `document_index` rows;
- indexed folder/file history;
- semantic analysis rows;
- document chunks;
- document association suggestions;
- `tenant_document_object_links`;
- evidences already associated to controls, risks, actions, findings, nonconformities, processes, or operations.

This preserves audit traceability while preventing future provider sync.

## Google Drive

Endpoint:

```text
POST /api/document-integrations/google/disconnect
```

Optional body:

```json
{
  "source_id": "<tenant_document_sources.id>",
  "reason": "user_requested"
}
```

Revocation:

- preferred token: `refresh_token`;
- fallback token: `access_token`;
- endpoint: `POST https://oauth2.googleapis.com/revoke`;
- content type: `application/x-www-form-urlencoded`.

HTTP `200` is treated as confirmed provider revocation. HTTP `400` or network failure is treated as a revocation warning, but local disconnect still completes.

## Zoho WorkDrive

Endpoint:

```text
POST /api/document-integrations/zoho/disconnect
```

Optional body:

```json
{
  "source_id": "<tenant_document_sources.id>",
  "reason": "user_requested"
}
```

Revocation:

- preferred token: `refresh_token`;
- fallback token: `access_token`;
- endpoint: `{accountsServerUrl}/oauth/v2/token/revoke?token=<token>`.

`accountsServerUrl` is resolved in this order:

1. credential metadata `accounts_server`;
2. source metadata `accounts_server`;
3. `ZOHO_ACCOUNTS_BASE_URL`;
4. `https://accounts.zoho.com`.

Zoho `status=success` is treated as confirmed revocation. Invalid-token or provider errors are stored as warnings, but local disconnect still completes.

## Expected Source State

After disconnect, `tenant_document_sources` should show:

```text
status = disconnected
sync_enabled = false
folder_id = NULL
folder_display_name = NULL
provider_account_email = NULL
last_sync_status = disconnected
last_sync_error = NULL
```

The corresponding local credential rows in `tenant_document_provider_credentials` should be removed for the tenant/provider/source.

## CLI Checks

Use a valid tenant-admin token. Do not print token values.

List sources:

```bash
API="https://tcdx.dedyn.io:8443"

curl -sk -H "Authorization: Bearer $TOKEN" \
  "$API/api/evidence-library/sources" \
  | python3 -m json.tool
```

Disconnect Google Drive:

```bash
SOURCE_ID="<google_source_id>"

curl -sk -X POST "$API/api/document-integrations/google/disconnect" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"source_id\":\"$SOURCE_ID\",\"reason\":\"user_requested\"}" \
  | python3 -m json.tool
```

Disconnect Zoho WorkDrive:

```bash
SOURCE_ID="<zoho_source_id>"

curl -sk -X POST "$API/api/document-integrations/zoho/disconnect" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"source_id\":\"$SOURCE_ID\",\"reason\":\"user_requested\"}" \
  | python3 -m json.tool
```

Validate source state:

```sql
SELECT
  id,
  tenant_id,
  provider,
  status,
  sync_enabled,
  folder_id,
  folder_display_name,
  provider_account_email,
  last_sync_status,
  last_sync_error,
  metadata_json->>'disconnected_at' AS disconnected_at
FROM tenant_document_sources
WHERE id = '<source_id>';
```

Validate credentials were removed:

```sql
SELECT id, provider, source_id, account_email, token_expires_at
FROM tenant_document_provider_credentials
WHERE source_id = '<source_id>';
```

Expected result: zero rows.

## Rollback

No migration is required for disconnect.

If code rollback is needed after deployment:

1. Revert the merge commit.
2. Redeploy with `./scripts/deploy-vms.sh`.
3. Reconnect affected providers through `/evidencias`.

Do not restore deleted OAuth credentials from backups unless approved by the product owner and security owner. Reconnection is the safe recovery path.
