# Frontend hidden routes - cleanup stage 2

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-2-controlled-cleanup`

| Ruta | Estado previo | Accion | Rol permitido esperado | Motivo |
| ---- | ------------- | ------ | ---------------------- | ------ |
| `/dashboard-v2` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Dashboard duplicado/post-MVP. |
| `/dashboard-kpi` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Dashboard KPI duplicado; valor debe consolidarse en `/dashboard`. |
| `/ia` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | IA legacy; `/ia-compliance` queda como IA cliente. |
| `/ia-auditor` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | IA Auditor enterprise/post-MVP. |
| `/auditorias/ia` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Auditoria IA fuera de MVP cliente. |
| `/auditor-iso` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Superficie legacy/enterprise. |
| `/centro-control-iso` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Command center legacy/no MVP. |
| `/command-center-iso` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Command center legacy/no MVP. |
| `/ejecucion-iso` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Flujo legacy/no MVP. |
| `/documentos` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Solape con Evidencias/Evidence Library. |
| `/administrar-kpis` | Ya incluida en `INTERNAL_CLIENT_HIDDEN_ROUTES` | Confirmada sin cambio | Platform/dealer pueden atravesar guard; cliente tenant no | Administracion KPI fuera de cliente MVP. |
| `/health` | Estaba en `MVP_ROUTE_RULES` como compliance read | Movida a `INTERNAL_CLIENT_HIDDEN_ROUTES` y retirada de `MVP_ROUTE_RULES` | Platform/dealer pueden atravesar guard; cliente tenant no | Evitar exposicion cliente MVP de ruta de salud/diagnostico operacional. |
| `/ia-compliance` | Visible cliente si feature/modulo IA esta habilitado | Sin cambio | Tenant autorizado por modulo IA y RBAC backend | IA Compliance cliente trazable basica aprobada como unica IA cliente. |
| `/admin-saas` | Platform route | Sin cambio | Platform | Consola plataforma. |
| `/dealer` | Dealer route | Sin cambio | Dealer | Consola dealer. |
| `/cotizador` | Dealer route | Sin cambio | Dealer | Flujo dealer. |
| `/prefacturacion` | Dealer route | Sin cambio | Dealer | Flujo dealer/billing. |

## Archivos revisados

- `frontend/src/utils/mvpPermissions.ts`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/Sidebar.tsx`

## Rollback

Para restaurar `/health` como ruta visible tenant, revertir el cambio en `frontend/src/utils/mvpPermissions.ts`: volver a incluir `/health` en la regla `compliance.read` y retirarla de `INTERNAL_CLIENT_HIDDEN_ROUTES`.
