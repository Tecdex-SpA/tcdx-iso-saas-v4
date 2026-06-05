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

OAuth success alone is not treated as a functional WorkDrive connection. After code exchange, backend runs a real WorkDrive API probe. If the probe fails with Zoho `401` / `R008 Unauthorized access`, the source is stored as:

- `status = error`
- `last_sync_status = zoho_oauth_unauthorized`
- `last_sync_error = Zoho OAuth conectado, pero el token no tiene acceso efectivo a WorkDrive API.`
- `metadata_json.zoho_probe` with safe provider diagnostics

The UI shows only reconnect actions and must not open the folder selector for this state.

## WorkDrive Endpoint Diagnostics

Zoho OAuth can complete successfully while the resulting token still cannot access the WorkDrive API. The platform must validate real WorkDrive access instead of treating OAuth as sufficient.

For root folder browsing, the backend probes these WorkDrive endpoints without stopping at the first `401`, `404`, or `400`:

- `GET /workdrive/api/v1/teams`
- `GET /workdrive/api/v1/teamfolders`
- `GET /workdrive/api/v1/privatespace/folders/files`
- `GET /workdrive/api/v1/files`

Each probe result is logged safely as `ZOHO_WORKDRIVE_ENDPOINT_PROBE` with endpoint, HTTP status, provider code and provider message. Tokens, Authorization headers, OAuth codes and refresh tokens are never logged or returned.

If any endpoint returns a usable `200`, the folder browser uses the authorized result path to build navigable WorkDrive nodes. If all endpoints return Zoho `401` with `R008 Unauthorized access`, `/api/document-integrations/zoho/folders?parentId=root` returns `ZOHO_UNAUTHORIZED` with safe diagnostics. This tells the operator that OAuth is connected but the token has no effective WorkDrive API access, usually because scopes, Zoho API Console configuration, account permissions, or WorkDrive availability need correction.

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

The backend must not call Zoho with `fileId=root`. For root browsing it resolves tenant credentials and performs container discovery for:

- `Mis carpetas` / private space;
- `Carpetas del equipo` / team folders;
- `Compartido conmigo` when the WorkDrive API exposes it for the connected account.

Root discovery may return navigable synthetic nodes before a real provider folder is selected:

```json
{
  "id": "zoho:privatespace:root",
  "name": "Mis carpetas",
  "type": "private_space",
  "can_open": true,
  "can_select": true
}
```

```json
{
  "id": "zoho:teamfolders:root",
  "name": "Carpetas del equipo",
  "type": "team_folder_root",
  "can_open": true,
  "can_select": false
}
```

Opening `zoho:privatespace:root` lists folders in private space. Opening `zoho:teamfolders:root` lists team folders such as `General` or project-specific team folders if the user has access.

The normalized response shape is:

```json
{
  "ok": true,
  "data": {
    "source_id": "tenant_document_sources.id",
    "current": {
      "id": "root",
      "name": "Zoho WorkDrive",
      "path": "Zoho WorkDrive",
      "parent_id": null,
      "type": "root"
    },
    "folders": [],
    "breadcrumbs": [{ "id": "root", "name": "Zoho WorkDrive" }],
    "details": {
      "reason": null,
      "stage": "root_discovery_completed"
    }
  }
}
```

If Zoho returns no folders inside an opened container, the endpoint returns `ok: true` with `folders: []` and a safe `details.reason`, for example `empty_private_space`, `no_workdrive_team`, or `no_visible_folders`.

Zoho API failures return safe diagnostics only:

```json
{
  "ok": false,
  "code": "ZOHO_UNAUTHORIZED",
  "error": "Zoho conectado, pero sin permisos efectivos para WorkDrive.",
  "details": {
    "stage": "probe_workdrive_access",
    "provider_status": 401,
    "provider_code": "R008",
    "provider_message": "Unauthorized access",
    "hint": "Reconecte Zoho WorkDrive aceptando permisos o revise API Console/scopes."
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
