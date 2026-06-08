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

Optional:

- `ZOHO_API_BASE_URL` defaults to `https://www.zohoapis.com`
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
  "can_select": false
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

For this Sprint 3.5 implementation, `zoho:privatespace:root` is a synthetic application root, not a physical Zoho folder ID. It is only a UI navigation container. It must not be stored as the final synchronizable folder.

When the WorkDrive folder browser cannot reliably list the user's visible folders, the supported fallback is selecting a real folder by URL from Zoho WorkDrive:

```text
POST /api/document-integrations/zoho/select-folder-url
```

Accepted examples:

```text
https://workdrive.zoho.com/folder/<folder_id>
https://workplace.zoho.com/#workdrive_app/<workspace_id>/privatespace/folders/<folder_id>
https://workplace.zoho.com/#workdrive_app/<workspace_id>/teamfolders/<folder_id>
```

The backend extracts `folder_id`, optional `workspace_id`, and `zoho_space_type`, strips query strings, validates that the URL belongs to Zoho, and stores the selected real folder in `tenant_document_sources`:

- `folder_id = <real Zoho folder id>`
- `folder_display_name`
- `folder_path`
- `metadata_json.workspace_id`
- `metadata_json.zoho_workspace_id`
- `metadata_json.zoho_space_type`
- `metadata_json.zoho_url_source`
- `metadata_json.zoho_root_kind = real_folder`
- `metadata_json.zoho_root_mode = folder`
- `metadata_json.selected_from_url = true`
- `metadata_json.zoho_working_list_endpoint` when a working endpoint is found

Sync rejects any selected `folder_id` that starts with `zoho:` and returns `ZOHO_SYNTHETIC_ROOT_NOT_SYNCABLE`. If a real folder returns zero elements after the controlled endpoint matrix, sync returns `ZOHO_FOLDER_EMPTY_OR_UNREADABLE` with tested endpoints instead of silently returning `completed_empty`.

GET requests to WorkDrive do not send `Content-Type: application/json`. The backend probes media headers in this order when Zoho returns `415`:

1. `Accept: application/vnd.api+json`
2. `Accept: application/json`
3. `Accept: */*`

Operational diagnostics can be run without exposing tokens:

```bash
cd backend
SOURCE_ID=<tenant_document_sources.id> WORKSPACE_ID=<optional_workspace_id> KNOWN_FOLDER_ID=<optional_zoho_folder_id> node scripts/probe-zoho-workdrive.js
```

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

## Indexing Semantics

Zoho WorkDrive sync indexes both folders and files into `document_index`.

Visible active items use:

```text
status = indexed
```

Sync operation results are stored in metadata, not in `document_index.status`:

```json
{
  "last_sync_operation": "created|updated|unchanged|excluded_preserved"
}
```

Zoho folder rows are indexed as navigable items:

```json
{
  "provider": "zoho_workdrive",
  "mime_type": "application/vnd.zoho.workdrive.folder",
  "file_extension": "folder",
  "metadata_json": {
    "zoho": {
      "is_folder": true,
      "item_type": "folder",
      "parent_folder_id": "<zoho_parent_folder_id>",
      "workspace_id": "<workspace_id_if_known>",
      "folder_path": "<relative_folder_path>"
    }
  }
}
```

Files use the same provider identity model with `metadata_json.zoho.parent_folder_id` so `/api/evidence-library/documents/:sourceType/:sourceId/children` can resolve indexed children by real Zoho parent folder id.

Existing legacy rows with `provider = zoho_workdrive` and `status = updated` are normalized by migration to `status = indexed` while preserving the old operation in `metadata_json.last_sync_operation = updated`.

## Logical Exclusions

Users can hide non-useful indexed files or folders without deleting source-provider files or evidence history.

The active exclusion registry is:

```text
tenant_document_index_exclusions
```

Actions:

```text
POST /api/evidence-library/index/exclusions
POST /api/evidence-library/index/restore
```

Exclusion states:

- `scope = item` hides only the selected indexed item.
- `scope = subtree` hides a folder and indexed descendants.
- `document_index.status = excluded` marks currently indexed rows as hidden from the default library.

Sync preserves active exclusions. If a provider item or one of its subtree ancestors is actively excluded, sync does not reactivate it as visible. Historical associations and semantic analysis rows remain intact.

## Multi-DC

Zoho token responses may include `api_domain`, `accounts_server`, or `location`. These values are stored in credential/source metadata when available. WorkDrive API calls use the tenant-stored `api_domain` first and `ZOHO_API_BASE_URL` as fallback.

## Disconnect

Tenants can disconnect Zoho WorkDrive from `/evidencias` without deleting historical evidence.

The disconnect action calls:

```text
POST /api/document-integrations/zoho/disconnect
```

The backend:

- derives `tenant_id` from auth context;
- validates the optional `source_id` against the authenticated tenant;
- attempts to revoke the refresh token first, then access token if needed;
- uses the tenant-stored `accounts_server` when available for multi-DC token revocation;
- deletes local rows in `tenant_document_provider_credentials` for the tenant/provider/source;
- updates `tenant_document_sources.status` to `disconnected`;
- sets `sync_enabled = false` and `last_sync_status = disconnected`;
- clears selected folder and provider account display fields;
- preserves `document_index`, semantic analysis, suggestions, evidence associations, and uploaded evidence history.

If Zoho returns an invalid-token or revoke failure response, local disconnect still succeeds. The safe revocation result is stored in `metadata_json.revocation`; tokens and secrets are never logged or returned.

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
