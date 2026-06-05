# Zoho WorkDrive tenant integration

## Model

Zoho WorkDrive uses the standard SaaS-managed OAuth model for Sprint 3.5.

TCDX owns one Zoho OAuth application. Tenants do not enter Zoho Client ID or Client Secret. Each tenant only:

1. Opens `/evidencias`.
2. Clicks `Conectar Zoho WorkDrive`.
3. Authorizes its own Zoho account.
4. Selects a tenant-specific WorkDrive folder.
5. Syncs the selected folder into the evidence library.

Tenant-specific data is stored in:

- `tenant_document_provider_credentials` for encrypted Zoho tokens.
- `tenant_document_sources` for the tenant-owned source and selected folder.
- `document_index` for indexed Zoho files and folders.

`document_sources` is not used.

## Environment

Required backend variables:

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REDIRECT_URI`
- `ZOHO_ACCOUNTS_BASE_URL`
- `ZOHO_API_BASE_URL`

Optional:

- `ZOHO_SCOPES`
- `ZOHO_WORKDRIVE_SCOPES`

Production redirect URI:

```text
https://tcdx.dedyn.io:8443/api/document-integrations/zoho/oauth/callback
```

If required config is missing, `/api/evidence-library/sources` returns Zoho as `configuration_required` and disables the connect action with:

```text
Zoho WorkDrive no está configurado por la plataforma.
```

Backend endpoints return `ZOHO_PLATFORM_CONFIG_MISSING`.

## Source Status

`tenant_document_sources.status` only stores values allowed by the DB constraint:

- `active`
- `paused`
- `disconnected`
- `pending_agent`
- `error`

OAuth connected but folder pending is represented as:

- `status = active`
- `folder_id = NULL`
- `folder_display_name = NULL`
- `folder_path = NULL`
- `last_sync_status = folder_required`
- `metadata_json.folder_required = true`

The Evidence Library API derives UI status `folder_required`.

## Endpoints

- `GET|POST /api/document-integrations/zoho/oauth/start`
- `GET /api/document-integrations/zoho/oauth/callback`
- `GET /api/document-integrations/zoho/folders?source_id=<uuid>&parentId=<folder_id>`
- `POST /api/document-integrations/zoho/select-folder`
- `POST /api/document-integrations/zoho/sync`

All non-callback endpoints require auth and tenant-scoped RBAC.

### Folder browsing

The folder browser treats these values as logical WorkDrive root aliases:

- empty `parentId`
- `root`
- `my_drive`
- `mi_unidad`

The backend must not call Zoho with `fileId=root`. For root browsing it resolves tenant credentials and tries the WorkDrive root/team-folder listing endpoints, then normalizes the response to:

```json
{
  "ok": true,
  "data": {
    "source_id": "tenant_document_sources.id",
    "current": {
      "id": "root",
      "name": "Mi unidad",
      "path": "Mi unidad",
      "parent_id": null,
      "type": "root"
    },
    "folders": [],
    "breadcrumbs": [{ "id": "root", "name": "Mi unidad" }]
  }
}
```

If Zoho returns no folders, the endpoint returns `ok: true` with `folders: []`.

Zoho API failures return safe diagnostics only:

```json
{
  "ok": false,
  "code": "ZOHO_API_ERROR",
  "error": "Error consultando Zoho WorkDrive",
  "details": {
    "stage": "list_root",
    "provider_status": 403,
    "provider_code": "scope_error",
    "provider_message": "safe provider message",
    "hint": "Permisos insuficientes de Zoho WorkDrive. Reconecte Zoho autorizando los scopes requeridos."
  }
}
```

Tokens, auth headers, tenant secrets and OAuth codes must never be logged or returned.

## Multi-DC

Zoho token responses may include `api_domain`, `accounts_server`, or `location`. These values are stored in credential/source metadata when available. WorkDrive API calls use the tenant-stored `api_domain` first and `ZOHO_API_BASE_URL` as fallback.

## Known Limitations

- BYO tenant OAuth app is future enterprise scope, not Sprint 3.5 default.
- Folder recursion is MVP-limited and bounded.
- If Zoho does not provide extractable binary content through the indexed metadata, semantic analysis falls back to metadata-based context or controlled unsupported extraction behavior.
- Zoho WorkDrive root/team-folder API shape may vary by data center and account type; the backend keeps fallback endpoints and structured diagnostics for production tuning.

## Browser Validation

1. Remove Zoho env vars in a non-production test environment and confirm `/evidencias` shows configuration required.
2. Configure Zoho env vars.
3. Login as tenant admin.
4. Open `/evidencias`.
5. Connect Zoho WorkDrive.
6. Confirm redirect back to `/evidencias?zoho=connected&drive_status=folder_required`.
7. Select a folder.
8. Sync.
9. Confirm Zoho files/folders appear in Biblioteca documental.
10. Analyze a Zoho file if the file type is supported.
11. Associate a Zoho file to an existing target.
12. Login as another tenant and confirm no cross-tenant Zoho source or document is visible.
