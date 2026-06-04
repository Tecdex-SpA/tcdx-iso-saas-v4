# Sprint 2 Route and View Map

Date: 2026-06-04

## Client MVP navigation

Sprint 2 preserves the Sprint 1 eight-view client navigation:

1. Dashboard
2. Cumplimiento y Auditoria
3. Evidencias
4. Riesgos
5. Planes de accion
6. Reportes
7. IA Compliance
8. Configuracion

No ninth main view was added.

## Sprint 2 UI placement

| MVP view | Route | Sprint 2 content |
|---|---|---|
| Configuracion | `/configuracion` | Links to Usuarios and Perfil empresa, plus `Procesos y operaciones` administration panel |

## Backend endpoints used

| UI action | Endpoint |
|---|---|
| List processes | `GET /api/tenant-processes` |
| Create process | `POST /api/tenant-processes` |
| Update process | `PUT /api/tenant-processes/:id` |
| Activate/deactivate process | `PATCH /api/tenant-processes/:id/status` |
| List process operations | `GET /api/tenant-processes/:id/operations` |
| Create process operation | `POST /api/tenant-processes/:id/operations` |
| Update operation | `PUT /api/tenant-operations/:id` |
| Activate/deactivate operation | `PATCH /api/tenant-operations/:id/status` |

## Existing routes left untouched

- `/dashboard`
- `/cumplimiento-auditoria`
- `/ciclo-vida`
- `/evidencias`
- `/riesgos`
- `/planes-accion`
- `/exportes`
- `/ia-compliance`
- `/usuarios`
- `/perfil-empresa`
- Internal platform/dealer routes from Sprint 1
- Legacy `/api/tenant-standards/operations` standard-scope routes

## Notes

`tenant_standard_operations` remains the standard-scope mapping table and is not repurposed as a business process model.

Sprint 2 does not connect processes to controls, evidences, risks, actions, KPIs, reports, or AI context.
