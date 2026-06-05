# Sprint 3.5 Completion - Tenant Sources and Manual Upload

## Scope

This completion keeps the Sprint 3.5 evidence library as the single operational upload point.

Implemented scope:

- Tenant-scoped manual upload under `/api/evidence-library/manual-upload/*`.
- Manual upload source creation/reuse in `tenant_document_sources` per authenticated tenant.
- Uploaded files indexed into `document_index` with `provider = manual_upload`.
- ZIP upload with safe extraction and relative path preservation.
- Local extraction support for manually uploaded files through `local_storage_path`.
- `/evidencias` source card actions for `Subir archivos` and `Subir ZIP`.

Not implemented:

- Sprint 4 diagnosis.
- KPIs or health.
- Reports.
- AI Auditor.
- New sidebar views.
- Destructive deduplication or cleanup.

## Tenant Scope

The backend derives tenant scope from the authenticated request. Upload endpoints do not accept `tenant_id` from the frontend.

Manual upload rows use:

- `tenant_document_sources.tenant_id`
- `document_index.tenant_id`
- `document_index.source_id` pointing to the tenant-owned manual source.

Google Drive, Zoho, Sync Agent, and mounted folder cards continue to read tenant-owned source records through `tenant_document_sources` and tenant-filtered `document_index`.

## Manual Upload Data Model

Manual file uploads create or reuse:

```text
tenant_document_sources(provider = manual_upload, tenant_id = authenticated tenant)
```

Each file is stored under:

```text
backend/uploads/evidence-library/<tenant_id>/manual/<date>/
```

Each uploaded file is indexed as:

```text
document_index.provider = manual_upload
document_index.provider_file_id = manual:<checksum>:<relative_path>
document_index.source_id = <tenant manual source id>
document_index.local_storage_path = <safe backend path>
document_index.relative_path = <upload or ZIP relative path>
```

ZIP folders are indexed as non-analyzable folder rows using:

```text
document_index.provider_file_id = manual_folder:<relative_path>
document_index.file_extension = folder
```

## ZIP Safety

ZIP handling rejects or skips unsafe entries:

- absolute paths;
- `../` traversal;
- encrypted entries;
- unsupported compression methods;
- unsupported file extensions;
- files over configured limits.

No source files are hard-deleted by this flow.

## Rollback

Preferred rollback:

1. Revert code.
2. Redeploy.
3. Leave non-destructive `document_index` and `tenant_document_sources` rows unused.

Do not delete uploaded customer files or database rows without backup and product/DBA approval.
