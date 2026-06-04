# Sprint 3 Role, Feature and Action Matrix

Date: 2026-06-04

## Feature keys

| Feature/action | Admin / tenant_admin | Auditor | Responsable area / operativo | Ejecutivo cliente | Superadmin TCDX | Partner / Dealer |
|---|---:|---:|---:|---:|---:|---:|
| `tenant_process_links.read` | Yes | Yes | Yes, broad scope pending assignment model | Yes, read only if route exposed | No client demo | No |
| `tenant_process_links.create` | Yes | No | No | No | No client demo | No |
| `tenant_process_links.update` | Yes | No | No | No | No client demo | No |
| `tenant_process_links.deactivate` | Yes | No | No | No | No client demo | No |
| `tenant_process_links.reactivate` | Yes | No | No | No | No client demo | No |

## Backend RBAC

`/api/tenant-process-links`:

- Read: tenant read roles.
- Write: `admin`, `tenant_admin`.

Service-level controls also enforce role and tenant checks.

## Frontend

The management UI is inside `/configuracion`, which remains admin-only in the Sprint 1 route matrix.

The frontend keys are UX controls only. Backend remains authoritative.

## Dealer/platform separation

Dealer users cannot manage internal operational links.

Superadmin remains outside the client demo flow unless a separate platform support mode is explicitly designed later.
