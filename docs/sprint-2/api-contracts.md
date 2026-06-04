# Sprint 2 API Contracts

Date: 2026-06-04

## Common rules

- All endpoints require JWT authentication.
- All endpoints require `admin` or `tenant_admin`.
- Tenant scope is derived from the authenticated user.
- `tenant_id` in request body is ignored by design and is not needed.
- Every query filters by the authenticated `tenant_id`.
- No hard delete endpoint is provided.
- If the Sprint 2 migration has not been applied, endpoints may return `SPRINT2_MIGRATION_REQUIRED`.

## Processes

### `GET /api/tenant-processes`

Lists processes for the authenticated tenant.

Optional query filters:

- `is_active=true|false`
- `search=<text>`
- `area=<text>`
- `criticality=baja|media|alta|low|medium|high`

Response:

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "code": "PROC-001",
      "name": "Gestion comercial",
      "area": "Comercial",
      "criticality": "media",
      "is_active": true,
      "operations_count": 2,
      "active_operations_count": 2
    }
  ]
}
```

### `POST /api/tenant-processes`

Creates a process for the authenticated tenant.

Payload:

```json
{
  "code": "PROC-001",
  "name": "Gestion comercial",
  "description": "Proceso comercial transversal.",
  "area": "Comercial",
  "owner_user_id": "uuid",
  "criticality": "media",
  "is_active": true
}
```

### `GET /api/tenant-processes/:id`

Reads one process only when `id` belongs to the authenticated tenant.

### `PUT /api/tenant-processes/:id`

Updates one process only when `id` belongs to the authenticated tenant.

`name` remains required when sent.

### `PATCH /api/tenant-processes/:id/status`

Activates or deactivates a process.

Payload:

```json
{ "is_active": false }
```

## Operations

### `GET /api/tenant-processes/:id/operations`

Lists operations under one tenant-owned process.

Optional query filter:

- `is_active=true|false`

### `POST /api/tenant-processes/:id/operations`

Creates an operation under a tenant-owned process.

Payload:

```json
{
  "code": "OP-001",
  "name": "Revision de oportunidad",
  "description": "Actividad operativa dentro del proceso.",
  "operation_type": "operacion",
  "frequency": "mensual",
  "owner_user_id": "uuid",
  "is_active": true
}
```

### `PUT /api/tenant-operations/:id`

Updates an operation scoped by authenticated tenant.

If `process_id` is provided, the destination process must belong to the same tenant.

### `PATCH /api/tenant-operations/:id/status`

Activates or deactivates an operation. Default seed operations are not deactivated by this Sprint 2 endpoint.

Payload:

```json
{ "is_active": true }
```

## Error responses

```json
{
  "ok": false,
  "code": "PROCESS_RBAC_DENIED",
  "error": "No autorizado para administrar procesos y operaciones"
}
```

Common codes:

- `RBAC_DENIED`
- `PROCESS_RBAC_DENIED`
- `TENANT_REQUIRED`
- `PROCESS_NAME_REQUIRED`
- `OPERATION_NAME_REQUIRED`
- `PROCESS_NOT_FOUND`
- `OPERATION_NOT_FOUND`
- `OWNER_NOT_IN_TENANT`
- `DUPLICATE_PROCESS_OR_OPERATION`
- `SPRINT2_MIGRATION_REQUIRED`

## Cross-tenant denial scenarios

- Tenant A admin cannot read Tenant B process because `WHERE tenant_id = jwt.tenant_id` is always present.
- Tenant A admin cannot update Tenant B process for the same reason.
- Tenant A admin cannot list operations under Tenant B process because the process lookup is tenant-scoped first.
- Tenant A admin cannot move an operation to Tenant B process because destination process lookup is tenant-scoped.
- Auditor, executive, area owner, dealer, and platform demo users cannot manage process/operation endpoints through Sprint 2 service checks.
