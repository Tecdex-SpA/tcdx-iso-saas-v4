# Sprint 2 Implementation Notes

Date: 2026-06-04

## Repository verification

- `tenant_processes` was not found in backend, frontend, database migrations, or live-map docs.
- `tenant_operations` exists and is heavily used by lifecycle, controls, evidences, findings, audits, reports, AI context, and tenant standard scope.
- `tenant_standard_operations` exists as the tenant/standard/operation mapping and has a unique constraint on `(tenant_id, standard_code, operation_id)`.
- Sprint 1 files are present: `Configuracion`, `mvpPermissions`, consolidated MVP routes, and `tenantScope.middleware.js`.

## Implementation decision

The ADR direction is compatible with the repository:

- Add `tenant_processes` as a new transversal business process table.
- Add nullable `process_id`, `owner_user_id`, and `frequency` to `tenant_operations`.
- Do not change `tenant_standard_operations` semantics.
- Do not link processes to controls, evidences, risks, actions, KPIs, reports, or AI in Sprint 2.

## Deviations

- No material deviation from ADR-0001.
- The new endpoints use `/api/tenant-processes` and `/api/tenant-operations`, while legacy operation scope endpoints under `/api/tenant-standards/operations` remain untouched for standard-scope administration.
