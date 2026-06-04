# ADR-0001 - Sprint 2 Current State and Operational Model Decision

## Metadata

| Field | Value |
|---|---|
| Project | TCDX Compliance / ISOS-SAAS-TECDEX |
| Sprint | Sprint 2 |
| ADR ID | ADR-0001 |
| Title | Company Profile, Processes, and Operations operational model |
| Status | Accepted for Sprint 2 prompt; Codex must verify against the live repository before editing code |
| Date | 2026-06-04 |
| Owner | Mario Caceres / TECDEX |
| Intended consumer | Codex implementation prompt |
| Repository | `baruj77/tcdx-iso-saas` |

## Purpose

This ADR documents the current project state and the product/architecture decision for Sprint 2 so Codex does not spend usage drafting the initial ADR. Codex must use this ADR as the baseline decision and focus on verifying the repository, implementing the smallest safe changes, documenting deviations, and preserving Sprint 1.

## Source basis

This ADR is based on the project documentation package available in the ISOS-SAAS-TECDEX project, especially:

- `Reporte_Actualizado_TCDX_Compliance_MVP_Matriz_Roles_Sprints.pdf`
- `Matriz_Vistas_Caracteristicas_Roles_TCDX_Compliance.pdf`
- `process-operations-readiness.md`
- `process-operations-fit.md`
- `database-map-summary.md`
- `rls-policies.md`
- `rbac-matrix.md`
- `mvp-scope.md`
- Sprint 1 completion notes provided by the project owner

Codex must still verify actual files, migrations, and code paths in the repository before applying changes.

## Current state summary

### Documented facts

1. Sprint 0 was an inventory and MVP alignment assessment, not a product implementation sprint.
2. Sprint 1 has reportedly been implemented and visually validated by the project owner. It aligned the platform to the v3 MVP matrix.
3. Sprint 1 changed the product direction before operational modelling: the client-facing MVP must remain organized into eight consolidated views:
   - Dashboard
   - Cumplimiento y Auditoria
   - Evidencias
   - Riesgos
   - Planes de Accion
   - Reportes
   - IA Compliance
   - Configuracion
4. `Cumplimiento y Auditoria` is one consolidated view. ISO Lifecycle lives inside that view. Admin Cumplimiento operates/moves lifecycle stages; Auditor reviews and approves/rejects when applicable.
5. Superadmin TCDX and Partner/Dealer flows must remain separated from the client demo experience.
6. Sprint 2 is now the sprint for Company Profile + Processes/Operations. It must not create a ninth main view.
7. Existing database signals show `tenant_company_profiles`, `tenant_operations`, and `tenant_standard_operations` exist.
8. Current process/operation readiness is partial: there are operation-related columns and views, but no clearly mature transversal process model for business processes.
9. RLS is not enabled in visible application tables. Tenant isolation depends on backend auth, RBAC, grants, and tenant-scoped SQL filters.
10. Existing tables such as `tenant_operations` and `tenant_standard_operations` have primary keys according to the DB documentation.

### Inferences

1. `tenant_standard_operations` should not be repurposed as the business process model because its semantic role is tied to standards and operational scope.
2. A transversal `tenant_processes` layer is needed so later sprints can link controls, evidences, risks, actions, KPIs, reports, and AI context to real business processes.
3. `tenant_operations` should remain the tenant-owned operation/activity catalog and should be linked to processes in a non-destructive way.
4. Sprint 2 should deliver a safe administration foundation under `Configuracion`, not operational intelligence, process-level compliance, or AI reasoning.

### Assumptions to verify in repository

1. Whether `tenant_processes` already exists in migrations or schema references.
2. Whether `tenant_operations` already has `process_id` or a compatible parent relationship.
3. Whether there is an existing tenant-scope middleware/helper created or updated in Sprint 1, such as `tenantScope.middleware.js`.
4. Whether current permission utilities can express action-level permissions for process/operation CRUD.
5. Whether `frontend/src/app/configuracion/page.tsx` can host the new section without a major refactor.

## Problem statement

Sprint 2 needs to formalize Company Profile + Processes/Operations without duplicating existing structures and without breaking the Sprint 1 consolidated MVP experience.

The project needs a clear decision about how these concepts coexist:

- `tenant_company_profiles`
- `tenant_processes`
- `tenant_operations`
- `tenant_standard_operations`

The decision must prevent these risks:

- Mixing process semantics with ISO standard scope.
- Duplicating `tenant_standard_operations`.
- Breaking health/KPI/lifecycle views that already depend on `operation_id`.
- Adding a new client-facing main view outside the v3 matrix.
- Creating cross-tenant exposure because RLS is not enabled.
- Expanding Sprint 2 into Sprint 3+ linking work.

## Decision

### 1. Use Company Profile as the tenant context container

Use the existing `tenant_company_profiles` model as the business context container for the tenant.

Sprint 2 should expose this context through `Configuracion` only. It should not create a new main menu entry.

### 2. Introduce or standardize `tenant_processes` as the transversal business process layer

If `tenant_processes` does not exist, create it through a non-destructive migration.

Recommended conceptual fields:

| Field | Purpose |
|---|---|
| `id` | Primary key, preferably UUID following repo conventions |
| `tenant_id` | Mandatory tenant scope |
| `code` | Optional stable tenant-local code or slug |
| `name` | Process name |
| `description` | Process description |
| `area` | Functional area or department |
| `owner_user_id` | Optional FK to tenant user responsible for the process |
| `criticality` | `low`, `medium`, `high`, or project-equivalent values |
| `is_active` or `status` | Use repo convention; prefer soft activation/deactivation over hard delete |
| `sort_order` | Optional display ordering |
| `metadata` | JSONB for future non-breaking extension |
| `created_at`, `updated_at` | Audit timestamps |

Codex must match existing naming conventions from the repository. If existing tables use `is_active`, prefer `is_active`. If existing patterns use `status`, use the existing enum/check style.

### 3. Keep `tenant_operations` as tenant-owned operations/activities

Do not replace or remove `tenant_operations`.

If `tenant_operations` lacks a process parent reference, add a nullable `process_id` FK to `tenant_processes(id)` in a non-destructive migration. This keeps current operation records valid while allowing Sprint 2 UI to group operations under a process.

If adding a column is unsafe because of existing code assumptions, create a bridge table such as `tenant_process_operations` instead. The preferred path is `tenant_operations.process_id` only if repository inspection confirms it is safe.

Recommended operation fields for the UI and API:

| Field | Purpose |
|---|---|
| `id` | Existing operation primary key |
| `tenant_id` | Mandatory tenant scope |
| `process_id` | Parent process, nullable only for backward compatibility |
| `code` | Existing operation code if present |
| `name` | Operation name |
| `description` | Operation description |
| `operation_type` | Existing classification if present |
| `frequency` | Optional operational frequency if supported |
| `owner_user_id` | Optional responsible user |
| `is_active` or `status` | Soft activation/deactivation |
| `sort_order` | Optional display ordering |
| `metadata` | JSONB for future context |
| `created_at`, `updated_at` | Audit timestamps |

### 4. Preserve `tenant_standard_operations` as standard-scope mapping

Do not use `tenant_standard_operations` as the business process table.

`tenant_standard_operations` remains the mapping between tenant operations and ISO standards or standard-specific operational scope. It may be read for compatibility, but Sprint 2 must not change its semantics unless repository inspection proves that this is the established model and the change is strictly non-destructive.

### 5. UI location

Place the Sprint 2 functionality under:

```text
Configuracion -> Company Profile -> Processes and Operations
```

Equivalent Spanish labels are acceptable if the current UI is Spanish:

```text
Configuracion -> Perfil Empresa -> Procesos y Operaciones
```

Do not add a ninth main view.

### 6. Backend architecture

Implement or reuse a tenant-scoped backend module. Recommended route if no existing route exists:

```text
/api/tenant-processes
/api/tenant-operations
```

Recommended minimal endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/tenant-processes` | List processes for authenticated tenant |
| `POST /api/tenant-processes` | Create process |
| `GET /api/tenant-processes/:id` | Read one process within tenant scope |
| `PUT /api/tenant-processes/:id` | Update process |
| `PATCH /api/tenant-processes/:id/status` | Activate/deactivate process |
| `GET /api/tenant-processes/:id/operations` | List operations under one tenant-owned process |
| `POST /api/tenant-processes/:id/operations` | Create operation under process |
| `PUT /api/tenant-operations/:id` | Update operation |
| `PATCH /api/tenant-operations/:id/status` | Activate/deactivate operation |

Rules:

- Every query must filter by `tenant_id`.
- Tenant users must use tenant from JWT/session context, not from request body.
- Platform roles must use explicit tenant resolution and authorization if support/impersonation flow exists.
- Dealer/Partner must not access internal tenant processes or operations.
- Do not rely on Sidebar hiding as protection.
- Register routes only behind the global auth/RBAC middleware unless the existing architecture requires a documented exception. No exception is expected for Sprint 2.

### 7. Role and permission decision

Sprint 2 process/operation administration is limited to tenant admin / Admin Cumplimiento.

| Role | Sprint 2 process/operation access |
|---|---|
| Admin Cumplimiento / `admin` / `tenant_admin` | Full CRUD except hard delete |
| Ejecutivo cliente / viewer / read-only roles | No management access |
| Auditor | No management access in Configuracion |
| Responsable area / operativo | No broad management access in Sprint 2 |
| Superadmin TCDX | Use existing separated platform console; do not mix into client demo flow |
| Partner / Dealer | No access to internal client operations |

### 8. No hard delete as default

Use activation/deactivation. Hard delete is out of scope unless a safe existing repo pattern already exists and is explicitly required.

### 9. Non-destructive database changes only

Allowed:

- `CREATE TABLE IF NOT EXISTS` for `tenant_processes` if absent.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for safe additive fields if required.
- New indexes for tenant-scoped access.
- New FK constraints only if compatible with existing data.
- Optional triggers/timestamps only if they follow existing repo conventions.

Not allowed:

- `DROP`
- `TRUNCATE`
- destructive `DELETE`
- renaming existing columns
- changing existing semantics of `tenant_standard_operations`
- migrating live data without explicit DBA approval
- enabling RLS as part of Sprint 2

### 10. Sprint 2 is not a linking sprint

Do not implement these links in Sprint 2:

- process -> control
- process -> evidence
- process -> risk
- process -> action plan
- process -> KPI/health
- process -> report
- process -> AI context
- process-level ISO diagnostic

Codex may document future linkage points, but must not implement them unless needed only to preserve existing behavior.

## Options considered

### Option A - Reuse `tenant_standard_operations` as the process model

Rejected.

Reason: It mixes business process semantics with ISO standard scope and increases the risk of breaking lifecycle/health/KPI behavior that already uses `operation_id`.

### Option B - Use only `tenant_operations` without a process parent

Rejected.

Reason: It does not provide a clear transversal business process layer and weakens future filtering by area, owner, criticality, process health, report slices, and AI operational context.

### Option C - Create or standardize `tenant_processes` and link `tenant_operations`

Accepted.

Reason: It separates business processes from operations and from standard-specific mappings while preserving existing tables and allowing future sprints to link controls, evidences, risks, actions, KPIs, reports, and AI in a controlled sequence.

### Option D - Delay process modeling to a later sprint

Rejected for Sprint 2.

Reason: Sprint 2 is explicitly defined as the Company Profile + Processes/Operations foundation after Sprint 1 closed the MVP navigation and role matrix.

## Consequences

### Positive consequences

- Clear process/operation semantics.
- Minimal UI footprint under `Configuracion`.
- No new main menu view.
- Lower risk of breaking Sprint 1.
- Future-ready for Sprint 3+ process links.
- Better tenant-scoped data model for future reports and AI context.

### Negative consequences / tradeoffs

- Adds a new entity if `tenant_processes` does not exist.
- Existing operation records may need optional classification under a process later.
- Future sprints will still need bridge tables or columns for controls, evidences, risks, actions, KPIs, reports, and AI.
- Without RLS, backend checks remain mandatory and must be tested aggressively.

## Required implementation notes for Codex

1. Do not spend time writing a new ADR from scratch. Use this ADR.
2. Add this ADR to the repository, recommended path:

```text
docs/sprint-2/ADR-0001-company-profile-processes-operations.md
```

3. If actual repository code contradicts this ADR, do not override blindly. Document the contradiction in:

```text
docs/sprint-2/implementation-notes.md
```

4. Keep Sprint 1 navigation and consolidated views untouched unless a tiny integration point is necessary for `Configuracion`.
5. Keep all validations non-destructive. The project owner will perform browser validation, commit, and deployment using local scripts.

## Acceptance criteria derived from this ADR

Sprint 2 satisfies this ADR when:

- `Configuracion` contains a Company Profile / Processes and Operations section.
- No ninth client-facing main view is introduced.
- Admin Cumplimiento / tenant admin can manage processes and operations for their own tenant.
- Unauthorized roles cannot manage processes/operations.
- Backend enforces tenant scope on every process/operation query and mutation.
- No endpoint trusts `tenant_id` from request body for normal tenant users.
- `tenant_standard_operations` is not repurposed as the process table.
- Changes are additive and reversible.
- No destructive SQL is introduced.
- Controls, evidences, risks, actions, KPIs, reports, and AI context are not linked to processes yet.
- Sprint 1 views and role behavior remain intact.

## Suggested implementation summary for Codex final response

Codex should report:

- Whether `tenant_processes` already existed.
- Whether `tenant_operations.process_id` already existed or was added.
- Which API routes/services were added or reused.
- Which permissions were added or reused.
- Which UI files changed under `Configuracion`.
- Which validations were executed and which were not.
- Known risks, especially RLS absence and cross-tenant validation.
- Rollback path.
