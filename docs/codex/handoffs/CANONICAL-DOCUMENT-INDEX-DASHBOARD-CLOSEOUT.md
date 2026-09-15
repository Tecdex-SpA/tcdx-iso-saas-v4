# Canonical Document Index / Dashboard Closeout

Date: 2026-09-15

Status: `CANONICAL_BACKEND_DATAFLOW_READY_FOR_REVIEW`

Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`

Branch: `main`

Base HEAD: `8ba51fec476fd7bb99c81d16d8a9e54a34a37a62`

Head/commit: `UNCOMMITTED_WORKTREE`

Commit/push/merge/deploy by Codex: `NO`

QA/production DB writes by Codex: `NO`

## Scope

Continuation from an interrupted backend closeout. Objective: validate inherited edits, repair incomplete pieces, and close evidence for canonical control/dashboard propagation and evidence-library manual upload against the current `tcdx_saasv2` schema. No schema changes, migrations, `.env`, DGX/LiteLLM, credentials, deploy, commit, push or merge were performed.

Previous related handoff preserved for traceability: `docs/codex/handoffs/ISO9001-DATA-EVIDENCE-SYSTEMIC-CLOSEOUT.md`.

## State Reconstructed

- Branch: `main`.
- HEAD: `8ba51fec476fd7bb99c81d16d8a9e54a34a37a62`.
- Inherited dirty worktree included backend route/service repairs, continuity docs, and new untracked PostgreSQL test.
- Initial `git diff --check`: PASS.
- No migrations/baseline/deploy scripts were present in the changed file set.

## Canonical Decisions

- Manual upload canonical persistence = `document_index`.
- Manual upload `provider='manual_upload'`.
- Manual upload `source_id = NULL`.
- Manual upload `integration_id = NULL`.
- `tenant_document_sources` is not required by manual upload and must not be created for manual uploads.
- Manual source card `Carga manual` is a virtual projection from `document_index`, not a persisted source row.
- No schema changes.
- No migrations.
- No legacy fallback in `PUT /api/controls/:id`.
- Health is optional enrichment, not control existence.
- Missing/no-data Health remains `NULL/sin_datos`; it is not derived from declared status.

## Implementation Validated

- `backend/src/services/evidenceLibrary.service.js`
  - `EVIDENCE_LIBRARY_UPLOAD_ROOT` optional.
  - `pathInside()`.
  - `cleanupWrittenManualUploadFile()`.
  - `manualUploadFiles()` and `manualUploadZip()` no longer call `ensureManualUploadSource()` or `touchDocumentSourceSync()`.
  - Manual upload rows pass `sourceId: null`.
  - `upsertManualDocumentIndex()` inserts/updates `integration_id=NULL`.
  - File cleanup runs when DB persistence fails after a file write.
  - Reads tolerate absent `tenant_document_sources` and absent `tenant_integrations` where used by evidence-library flows.
- `backend/src/routes/document-integrations.routes.js`
  - Download works when `tenant_document_sources` is absent.
  - Manual upload download is tenant-scoped by `document_index.tenant_id`.
  - Manual upload local path must be under `EVIDENCE_LIBRARY_UPLOAD_ROOT/<tenant>/manual`.
  - Path is resolved before `stat` and `res.download`.
- `backend/src/routes/controls.routes.js`
  - `PUT /api/controls/:id` updates `tenant_controls` only for authenticated tenant.
  - Records `control_soa_assessments` in the same transaction.
  - Commits before official post-mutation propagation.
  - Removed legacy `UPDATE controls` fallback and legacy compatibility metadata from that endpoint.
- `backend/src/routes/dashboard-controls.routes.js`
  - Row universe comes from active tenant standards + `tenant_applicable_controls + tenant_controls`.
  - `v_iso_control_effective_health` is left-joined as optional measurement.
  - Operational status comes from `tenant_controls.status`.
- `backend/src/services/isoOperationalExecution.service.js`
  - Additional focused correction: joins from ISO Express, risk matrix and Health suggestions back to `tenant_controls` now include tenant scope.

## PostgreSQL Evidence

Command:

```bash
node scripts/normalization/canonical-document-index-dashboard.postgres.test.js
```

First sandbox run failed with local PostgreSQL shared memory `shmget Operation not permitted`; rerun outside sandbox was approved and passed using isolated Docker PostgreSQL on localhost only.

Observed PASS markers:

```text
MANUAL_UPLOAD_WITHOUT_SOURCE_TABLE=PASS
NO_LEGACY_CONTROL_FALLBACK=PASS
NO_SCHEMA_CHANGES=PASS
NO_MIGRATIONS_ADDED=PASS
MANUAL_UPLOAD_DOCUMENT_INDEX_ONLY=PASS
MANUAL_UPLOAD_PHYSICAL_FILE_CREATED=PASS
MANUAL_UPLOAD_DB_ROW_CREATED=PASS
MULTITENANT_DOCUMENT_ISOLATION=PASS
MANUAL_UPLOAD_DOWNLOAD=PASS
ORPHAN_FILE_ROLLBACK_CLEANUP=PASS
DASHBOARD_CONTROL_WITHOUT_HEALTH_VISIBLE=PASS
CONTROL_CANONICAL_UPDATE=PASS
CONTROL_STATUS_PROPAGATES_TO_DASHBOARD=PASS
NO_FAKE_HEALTH_FROM_DECLARED_STATUS=PASS
MULTITENANT_CONTROL_ISOLATION=PASS
ISOLATED_POSTGRES_CLEANUP PASS
```

The test creates only the minimum isolated tables required for the contract and does not create `tenant_document_sources`.

## Syntax And Focused Tests

PASS:

```bash
node -c backend/src/routes/controls.routes.js
node -c backend/src/routes/dashboard-controls.routes.js
node -c backend/src/routes/evidences.routes.js
node -c backend/src/routes/evidence-library.routes.js
node -c backend/src/routes/document-integrations.routes.js
node -c backend/src/services/evidenceLibrary.service.js
node -c backend/src/routes/grcRuntimeRepair.contract.test.js
node -c scripts/normalization/canonical-document-index-dashboard.postgres.test.js
node -c backend/src/services/isoOperationalExecution.service.js
node -c backend/src/routes/controlIdentityRoutes.test.js
node backend/src/routes/grcRuntimeRepair.contract.test.js
node backend/src/utils/soaValidation.test.js
node backend/src/services/grcCalculationOrchestration.service.test.js
node backend/src/routes/controlIdentityRoutes.test.js
node scripts/normalization/canonical-document-index-dashboard.postgres.test.js
```

## Do Not Rediscover

- Do not adapt the database to historical backend assumptions for this closure.
- Do not recreate `tenant_document_sources`, `tenant_integrations`, `document_sync_logs`, `document_ai_analysis`, `document_association_suggestions`, `evidence_document_links`, provider credentials or sync-agent tables for manual upload.
- Do not replay historical migrations.
- Do not reintroduce `UPDATE controls` fallback in `PUT /api/controls/:id`.
- Do not make Health snapshots the control row universe.
- Do not invent ISO9001:2015 controls; governed source still has 16 controls / 13 evidence expectations.

## Residual Backlog

- Authorized runtime validation through deployed reverse proxy/storage for multipart upload and manual download.
- VM filesystem ownership, mount and backup checks for `backend/uploads/evidence-library`.
- Governed ISO9001:2015 expanded catalog source remains absent if a ~50-control product universe is required.
- Known out-of-scope runtime errors remain separate backlog: `ai_suggestions`, `ai_knowledge_records`, `unaccent(text)`, `s.score`.

## Next Exact Action

Human review the uncommitted diff, then owner performs commit/push/CI/deploy and authorized runtime validation. Codex must not commit, push, merge or deploy this package.
