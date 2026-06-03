# Sprint 1 Risks and Rollback

Date: 2026-06-03

## Risks

- Backend RBAC is app-level, not PostgreSQL RLS. Backend tests and manual cross-tenant QA remain mandatory controls.
- Area Owner assigned-scope enforcement is not fully centralized. Existing routes may need deeper per-record ownership checks in Sprint 2.
- Dealer assigned-tenant rules are not inferable from JWT in the global tenant-scope middleware. Dealer-specific endpoints must continue validating assignment.
- Lifecycle `devolver` uses the existing lifecycle request table without a migration. If production has a strict DB check constraint that rejects `devuelto`, use reject with an observation until a reviewed migration is approved.
- Some legacy pages remain accessible to allowed roles as subfeatures. Sprint 1 hides and guards them; it does not delete them.

## Rollback Plan

1. Revert the Sprint 1 branch or the commit that introduced:
   - `frontend/src/utils/mvpPermissions.ts`
   - MVP shell pages under `frontend/src/app/*`
   - `frontend/src/components/mvp/MvpViewShell.tsx`
   - AppLayout/Sidebar permission changes
   - backend RBAC and tenant-scope middleware changes
2. Restart only authorized non-production services if needed.
3. No database rollback is required because Sprint 1 introduced no migrations.

## Deployment Notes

Frontend:

```bash
cd /home/tecdex/frontend
npm install
npm run build
npm start
```

Backend:

```bash
cd /home/tecdex/backend
npm install
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
sudo journalctl -u tecdex-backend -n 100 --no-pager
```

Database:

No database migration is required for this Sprint 1 change set.
