# Sprint 3 API Contracts

Date: 2026-06-04

## Common rules

- All endpoints require JWT authentication.
- Backend derives `tenant_id` from authenticated context.
- `tenant_id` from request body is not used.
- Reads are available to tenant read roles through RBAC.
- Mutations are limited to `admin` and `tenant_admin`.
- No hard delete endpoint exists.

## `GET /api/tenant-process-links`

Lists process/entity links for the authenticated tenant.

Optional filters:

- `process_id`
- `operation_id`
- `target_type=control|evidence|risk|action`
- `is_active=true|false`

Response:

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "process_id": "uuid",
      "process_name": "Gestion comercial",
      "operation_id": "uuid",
      "operation_name": "Revision de oportunidad",
      "target_type": "control",
      "target_label": "Control documentado",
      "relation_type": "associated",
      "source": "manual",
      "is_active": true
    }
  ],
  "grouped": {
    "control": { "count": 1, "active_count": 1, "items": [] },
    "evidence": { "count": 0, "active_count": 0, "items": [] },
    "risk": { "count": 0, "active_count": 0, "items": [] },
    "action": { "count": 0, "active_count": 0, "items": [] }
  }
}
```

## `GET /api/tenant-process-links/by-process/:processId`

Lists links for one tenant-owned process.

## `GET /api/tenant-process-links/by-operation/:operationId`

Lists links for one tenant-owned operation.

## `GET /api/tenant-process-links/candidates/:targetType`

Searches readable candidates for association.

Allowed `targetType`:

- `control`
- `evidence`
- `risk`
- `action`

Optional query:

- `search`

Response:

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "target_type": "evidence",
      "label": "politica-calidad.pdf",
      "subtitle": "aprobada"
    }
  ]
}
```

## `POST /api/tenant-process-links`

Creates an active link.

Payload:

```json
{
  "process_id": "uuid",
  "operation_id": "uuid",
  "target_type": "control",
  "target_id": "uuid",
  "relation_type": "associated",
  "source": "manual",
  "notes": "Contexto operativo inicial"
}
```

## `PATCH /api/tenant-process-links/:id/deactivate`

Soft-deactivates a link.

## `PATCH /api/tenant-process-links/:id/reactivate`

Reactivates a link.

## Error examples

```json
{
  "ok": false,
  "code": "TARGET_NOT_FOUND",
  "error": "Elemento asociado no encontrado para el tenant autenticado."
}
```

Common codes:

- `PROCESS_LINK_RBAC_DENIED`
- `TENANT_REQUIRED`
- `INVALID_PROCESS_ID`
- `PROCESS_NOT_FOUND`
- `INVALID_OPERATION_ID`
- `OPERATION_NOT_FOUND`
- `OPERATION_PROCESS_MISMATCH`
- `INVALID_TARGET_TYPE`
- `TARGET_NOT_FOUND`
- `PROCESS_LINK_ALREADY_EXISTS`
- `SPRINT3_MIGRATION_REQUIRED`
