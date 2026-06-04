# Sprint 2 Role, Feature and Action Matrix

Date: 2026-06-04

## Scope

Sprint 2 adds process and operation administration inside `Configuracion -> Perfil empresa -> Procesos y operaciones`.

It does not add a ninth client-facing view and does not grant process/operation management to roles outside Admin cumplimiento / tenant admin.

## Feature keys

| Feature/action | Admin cumplimiento / tenant admin | Ejecutivo cliente | Auditor | Responsable area / operativo | Superadmin TCDX | Partner / Dealer |
|---|---:|---:|---:|---:|---:|---:|
| `config.companyProfile.view` | Yes | No | No | No | No client demo | No |
| `config.companyProfile.update` | Yes | No | No | No | No client demo | No |
| `config.processes.view` | Yes | No | No | No | No client demo | No |
| `config.processes.create` | Yes | No | No | No | No client demo | No |
| `config.processes.update` | Yes | No | No | No | No client demo | No |
| `config.processes.toggleStatus` | Yes | No | No | No | No client demo | No |
| `config.operations.view` | Yes | No | No | No | No client demo | No |
| `config.operations.create` | Yes | No | No | No | No client demo | No |
| `config.operations.update` | Yes | No | No | No | No client demo | No |
| `config.operations.toggleStatus` | Yes | No | No | No | No client demo | No |

## Backend enforcement

The new endpoints are registered under `/api`, behind authentication and RBAC.

- `/api/tenant-processes`: read/write limited to `admin` and `tenant_admin`.
- `/api/tenant-operations`: read/write limited to `admin` and `tenant_admin`.
- Service-level checks require a tenant id from the authenticated JWT/session context.
- Normal tenant users cannot provide or override `tenant_id` from request body.
- Dealer and platform roles are not introduced as process managers in the client demo flow.

## Frontend enforcement

`frontend/src/utils/mvpPermissions.ts` includes Sprint 2 feature keys.

`frontend/src/components/configuracion/ProcessesOperationsPanel.tsx` checks `config.processes.view` and `config.operations.view` before loading data or showing management forms.

`AppLayout` still protects `/configuracion` through the Sprint 1 route matrix, so menu visibility and direct URL access remain aligned.

## Deferred

- Area owner assigned-process access.
- Auditor process context in Compliance/Audit.
- Executive process summaries in Dashboard/Reports.
- Superadmin support-mode management of tenant processes.
- Any process links to controls, evidences, risks, actions, KPIs, reports, or AI.
