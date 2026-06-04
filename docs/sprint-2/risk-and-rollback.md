# Sprint 2 Risk and Rollback

Date: 2026-06-04

## Risks

### Database migration risk

The migration is additive and idempotent, but it must be applied before the new endpoints can work. If it is not applied, the backend returns `SPRINT2_MIGRATION_REQUIRED`.

### Tenant isolation risk

RLS is not enabled in the documented application tables. Backend JWT tenant scope remains the mandatory control. The new service filters all queries by authenticated tenant id and never requires `tenant_id` from normal tenant users.

### Permission mismatch risk

Frontend and backend both restrict Sprint 2 management to `admin` and `tenant_admin`. If future role aliases are added, they must be added to both `mvpPermissions.ts` and backend RBAC/service role checks.

### Duplicate operations risk

`tenant_operations` remains the operation catalog. `tenant_standard_operations` remains the standard mapping table. Sprint 2 does not duplicate or repurpose standard operations.

### Sprint 3 scope creep risk

Processes are not linked to controls, evidences, risks, action plans, KPIs, reports, or AI. Those links are deferred intentionally.

## Rollback plan

### Frontend

Revert:

- `frontend/src/app/configuracion/page.tsx`
- `frontend/src/components/configuracion/ProcessesOperationsPanel.tsx`
- Sprint 2 additions in `frontend/src/utils/mvpPermissions.ts`

This removes the visible process/operation section while preserving Sprint 1 navigation.

### Backend

Revert:

- `backend/src/routes/tenant-processes.routes.js`
- `backend/src/routes/tenant-operations.routes.js`
- `backend/src/services/tenantProcesses.service.js`
- Route registrations in `backend/src/app.js`
- Sprint 2 RBAC rules in `backend/src/middleware/rbac.middleware.js`

### Database

The migration was not executed by Codex.

If it is applied and must be rolled back, take a backup first. A destructive rollback would remove:

- `tenant_operations.process_id`
- `tenant_operations.owner_user_id`
- `tenant_operations.frequency`
- `tenant_processes`

Because those changes can hold tenant data after use, do not run destructive rollback without DBA/product approval.

### Documentation

Revert `docs/sprint-2/` files if the sprint is canceled.

## Manual validation steps

1. Apply the migration in a safe local or staging database.
2. Log in as `admin` or `tenant_admin`.
3. Open `/configuracion`.
4. Create a process.
5. Edit the process.
6. Deactivate and reactivate the process.
7. Create an operation under the process.
8. Edit the operation.
9. Deactivate and reactivate the operation.
10. Confirm auditor, executive, operativo, superadmin demo, and dealer roles do not see or cannot call the management flow.
