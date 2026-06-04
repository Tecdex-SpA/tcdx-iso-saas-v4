# Sprint 3 Fix - Tenant evidence associations

## Purpose

Close the Sprint 3 gap where process/operation links worked for controls, risks, and action plans, but evidence candidates were incomplete in the client UX.

## Root Cause

`GET /api/tenant-process-links/candidates/evidence` only read formal rows from `evidences`. The platform also has a tenant document library in `document_index`, populated by document integrations and indexed uploads. As a result, real tenant-uploaded or indexed documents were not always available as evidence candidates under:

```text
/configuracion -> Procesos y operaciones -> Elementos asociados
```

`POST /api/tenant-process-links` also validated `target_type = evidence` only against `evidences`, so document-index candidates needed explicit tenant-scoped validation.

## Data Source Decision

Sprint 3 evidence candidates now use a combined tenant-scoped library:

- `evidences`: formal evidence records.
- `document_index`: tenant uploaded/indexed documents that are not deleted, ignored, missing, or errored.

The response is normalized with:

- `id`
- `target_type = evidence`
- `label`
- `filename`
- `title`
- `source_table`
- `source_type`
- `evidence_date`
- `metadata`

## Backend Scope

- Candidate search derives `tenant_id` from the authenticated user.
- `tenant_id` from the frontend is ignored for process-link operations.
- Evidence validation accepts only records that belong to the authenticated tenant.
- No hard delete was added.
- No NLP, semantic matching, KPI, Health, report, or AI Auditor behavior was added.

## Frontend Scope

### Configuracion

The process/operation panel now:

- Makes the active process visually explicit.
- Shows `Proceso seleccionado`.
- Shows `Operacion seleccionada` when an operation is selected for the link.
- Shows evidence/document labels from `evidences` and `document_index`.
- Uses the empty state: `No hay evidencias/documentos disponibles para asociar.`

### Evidencias

The evidence view now includes an admin-only association path for the tenant evidence/document library:

- Search tenant evidence/document candidates from `evidences` and `document_index`.
- Select process.
- Optionally select operation under the process.
- Associate the selected evidence/document to the process/operation through `POST /api/tenant-process-links`.

It also includes a row-level shortcut for formal evidence rows already listed in `/evidencias`:

- Select process.
- Optionally select operation under the process.
- Associate the evidence to the process/operation through `POST /api/tenant-process-links`.

The generalized UI to associate a document directly from `/evidencias` to controls, nonconformities, and findings remains deferred because those flows touch separate evidence/control/finding/nonconformity contracts and require a broader design pass.

## Deferred Scope

Deferred intentionally:

- Direct `/evidencias` association UI to nonconformities and findings.
- Direct `/evidencias` association UI to controls outside the existing evidence upload/control flow.
- Process links into KPIs, Health, reports, diagnostics, or AI context expansion beyond the existing Sprint 3 foundation.
- Semantic/NLP matching.

## Rollback

Code rollback is enough. No migration was created.

If rolled back after merge:

```bash
git revert -m 1 <MERGE_COMMIT_HASH>
```

If merged as a normal commit:

```bash
git revert <COMMIT_HASH>
```
