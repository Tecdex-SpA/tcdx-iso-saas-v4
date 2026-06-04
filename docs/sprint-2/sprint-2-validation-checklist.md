# Sprint 2 Validation Checklist

Date: 2026-06-04

## Backend checks

Available scripts in `backend/package.json`:

```bash
cd backend
npm run check
npm test
```

No backend `lint` script exists.

## Frontend checks

Available scripts in `frontend/package.json`:

```bash
cd frontend
npm run lint
npm run build
```

## Manual browser checks by role

### Administrador / Admin cumplimiento

- Sidebar still shows only the Sprint 1 consolidated MVP views.
- `/configuracion` loads.
- `Procesos y operaciones` is visible.
- Can create/edit/activate/deactivate processes.
- Can create/edit/activate/deactivate operations inside a selected process.

### Superadmin

- Superadmin remains in the separated internal/platform flow.
- Superadmin is not mixed into the normal client MVP demo navigation.

### Ejecutivo

- Does not see process/operation management in `Configuracion`.
- Cannot mutate process/operation data.

### Operativo / Responsable area

- Does not receive broad process/operation administration in Sprint 2.

### Dealer

- Remains in channel/commercial console if configured.
- Cannot access internal client operation endpoints.

### Auditor

- Can keep Sprint 1 Compliance/Audit behavior.
- Cannot manage process/operation administration in Sprint 2.

## Cross-tenant checks

- Tenant A admin cannot read Tenant B process.
- Tenant A admin cannot update Tenant B process.
- Tenant A admin cannot list operations of Tenant B process.
- Tenant A admin cannot move an operation to Tenant B process.
- Auditor cannot create/update process.
- Ejecutivo cannot access process management endpoints.
- Dealer cannot access client operation endpoints.

## Non-regression checks

- Dashboard still loads.
- Cumplimiento y Auditoria still loads.
- Ciclo de Vida ISO is still inside the consolidated view.
- Evidencias still loads.
- Riesgos still loads.
- Planes de Accion still loads.
- Reportes still loads.
- IA Compliance still loads for authorized roles.
- Configuracion still respects matrix visibility.

## Database checks

Before applying migration:

```sql
SELECT to_regclass('public.tenant_processes');
```

After applying migration in local/staging:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenant_operations'
  AND column_name IN ('process_id', 'owner_user_id', 'frequency');
```

Codex did not execute the migration.
