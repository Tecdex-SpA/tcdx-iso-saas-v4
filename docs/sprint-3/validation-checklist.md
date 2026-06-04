# Sprint 3 Validation Checklist

Date: 2026-06-04

## Technical checks

Backend:

```bash
cd backend
npm run check
npm test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

General:

```bash
git diff --check
```

## Manual database migration

```bash
cd ~/repos/tcdx-iso-saas

scp database/migrations/20260604_sprint3_process_operational_links.sql tecdex@<DB_VM>:/tmp/

ssh tecdex@<DB_VM>

sudo -u postgres pg_dump -Fc <DB_NAME> -f /tmp/backup_pre_sprint3_$(date +%Y%m%d_%H%M%S).dump

sudo -u postgres psql -d <DB_NAME> -v ON_ERROR_STOP=1 -f /tmp/20260604_sprint3_process_operational_links.sql

exit
```

## Browser/platform validation

Entry point:

```text
https://181.212.166.187:8443/login
```

Validate as `admin` or `tenant_admin`:

1. Login successfully.
2. Open `/configuracion`.
3. Open Processes and Operations.
4. Select an existing process.
5. Confirm `Elementos asociados` appears.
6. Search and link a control.
7. Search and link evidence.
8. Search and link a risk.
9. Search and link an action/action plan.
10. Confirm each group shows count and active/inactive state.
11. Deactivate a link.
12. Reactivate a link.
13. Refresh the page and confirm links persist.

Validate process/operation context:

1. Select a process with linked elements.
2. Select an operation in the link form if available.
3. Confirm operation-level links show the operation name.
4. Confirm unrelated tenant data is not visible.

Validate RBAC visually:

- `admin` / `tenant_admin`: can create/deactivate/reactivate links.
- `auditor`: no management UI in `/configuracion`; API write must be denied.
- `ejecutivo`: no management UI; API write must be denied.
- `responsable_area`: no broad management UI in Sprint 3.
- `dealer`: no internal operational links.
- `superadmin demo`: not mixed into customer demo flow.

No regression:

- `/configuracion`
- `/cumplimiento-auditoria`
- `/evidencias`
- `/riesgos`
- `/planes-accion`
- `/ciclo-vida`
- `/ia-compliance`

Confirm sidebar/header load and no blank screen, 404, or 500.
