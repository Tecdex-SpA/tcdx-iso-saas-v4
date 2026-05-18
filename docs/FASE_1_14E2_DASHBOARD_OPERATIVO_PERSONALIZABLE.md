# Fase 1.14E2 - Dashboard operativo personalizable

## Objetivo

Completar el nuevo Dashboard como reemplazo funcional evaluable de las vistas operativas consolidadas, sin eliminar rutas antiguas ni limpiar sidebar todavia.

Alcance implementado:

- Ciclo de Vida ISO operativo dentro de Dashboard v2.
- Riesgos ISO prioritarios y vista expandida interna.
- Acciones Recomendadas con detalle, dry-run y conversion segura.
- Trabajo pendiente conectado.
- Preferencias visuales por usuario, tenant y dashboard.
- Validacion post-deploy segura.

Queda fuera de esta fase:

- eliminar vistas antiguas;
- eliminar botones del sidebar;
- reemplazar definitivamente `/dashboard`;
- crear datos al abrir el Dashboard;
- evidencias o documentos como bloques operativos principales.

## Inventario de paridad funcional

| Vista origen | Funcionalidad existente | Archivo/componente origen | Endpoint usado | Migrado al nuevo Dashboard | Componente destino | Estado |
|---|---|---|---|---|---|---|
| Ciclo de Vida ISO | Board por etapas, tarjetas por norma/operacion, filtros, historial, solicitud de avance, revision auditor | `frontend/src/app/ciclo-vida/page.tsx` | `/api/lifecycle/board/:tenantId`, `/api/lifecycle/history/:tenantId`, `/api/lifecycle/request-move`, `/api/lifecycle/requests/:id/review` | Si | `frontend/src/components/dashboard-v2/DashboardV2LifecycleSection.tsx` | Operativo |
| Ciclo de Vida ISO | Drag/drop para solicitar cambio de etapa | `frontend/src/app/ciclo-vida/page.tsx` | `/api/lifecycle/request-move` | Si | `DashboardV2LifecycleSection.tsx` | Operativo con confirmacion |
| Matriz de Riesgos ISO | Riesgos ISO por tenant/norma, niveles, estado, tratamiento | `frontend/src/app/matriz-riesgo/page.tsx` | `/api/dashboard-v2/summary`, `/api/dashboard-v2/risks`, `/api/iso-risk-matrix/*` | Si, lectura consolidada | `frontend/src/components/dashboard-v2/DashboardV2Panel.tsx` | Compacto + expandido |
| Acciones Recomendadas ISO | Listado, detalle, dry-run, conversion, descarte | `frontend/src/components/acciones-recomendadas/*` | `/api/iso-operational-execution/*`, `/api/iso-recommended-actions/:id/dry-run-convert`, `/api/iso-recommended-actions/:id/convert` | Si | `DashboardV2Panel.tsx` + `RecommendedActionDetailModal` | Operativo |
| Trabajo pendiente | Planes, hallazgos, no conformidades abiertas | `backend/src/services/dashboardV2.service.js` | Lectura consolidada desde tablas operativas | Si | `DashboardV2Panel.tsx` | Resumen conectado |
| Preferencias Dashboard | Orden y colapso por usuario | `DashboardV2PersonalizedLayout.tsx`, `dashboardV2.service.js` | `/api/dashboard-v2/preferences` | Si | `DashboardV2.tsx` | Persistente por usuario |

## Ciclo de Vida integrado

La subvista `Ciclo de vida` mantiene:

- etapas existentes;
- tarjetas por norma contratada;
- filtros por norma y operacion;
- resumen operativo;
- historial y trazabilidad;
- detalle de tarjeta;
- enlaces a controles, planes y auditorias;
- solicitud de avance;
- confirmacion/rechazo de movimiento pendiente;
- drag/drop con confirmacion explicita.

El drag/drop no mueve directamente datos finales; usa el mismo endpoint gobernado de solicitud de movimiento.

## Riesgos ISO integrados

La subvista `Riesgos` mantiene:

- resumen compacto;
- riesgos prioritarios;
- modo `Ver todos los riesgos ISO`;
- filtros por norma contratada;
- filtro por nivel residual;
- filtro por estado;
- tabla con activo, nivel, tratamiento y estado.

No genera riesgos ni modifica matrices al abrir el Dashboard.

## Acciones recomendadas integradas

La subvista `Acciones` mantiene:

- resumen compacto;
- acciones recientes;
- vista expandible;
- detalle trazable;
- dry-run de conversion;
- preview de conversion;
- confirmacion explicita antes de convertir;
- descarte con comentario opcional.

No crea planes, hallazgos, no conformidades ni evidencias por consultar la vista.

## Preferencias por usuario

Tabla nueva:

```sql
user_dashboard_preferences
```

Clave unica:

```text
tenant_id + user_id + dashboard_key
```

La preferencia guarda:

- orden de bloques;
- bloques colapsados;
- `dashboard_key = dashboard_v2`;
- timestamp de actualizacion.

El backend toma `tenant_id` y `user_id` desde JWT. El frontend no puede consultar ni modificar preferencias de otro usuario.

## Seguridad multi-tenant

Reglas mantenidas:

- JWT obligatorio;
- RBAC existente bajo `/api/dashboard-v2`;
- normas visibles filtradas por `tenant_standards` y agregador ISO;
- ISO9001 `2026_FDIS` excluida de tarjetas operativas/certificables;
- no se aceptan `tenant_id` arbitrarios para preferencias;
- las escrituras operativas solo ocurren por accion explicita del usuario.

## Validacion

Script:

```bash
bash scripts/validate-dashboard-operational-replacement.sh
```

Variables:

```bash
API_URL="http://bk.tcdx.int:3000"
FRONTEND_URL="https://181.212.166.187:8443"
TEST_EMAIL="admin@rieltec.com"
TEST_PASSWORD="123456"
ALLOW_WRITE_TEST="false"
```

Por defecto no ejecuta cambios de etapa reales. `ALLOW_WRITE_TEST=true` habilita pruebas de escritura controlada si se decide validar manualmente.

## Pendientes posteriores

- Validacion visual con usuario antes de limpiar sidebar.
- Evaluar reemplazo progresivo de `/dashboard`.
- Reducir vistas antiguas a rutas de detalle.
- Consolidar documentos/evidencias en fases dedicadas, no dentro del Dashboard principal.
