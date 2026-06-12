# Legacy routes B.6 consolidation review

Fecha: 2026-06-12
Rama: `chore/cleanup-b6-legacy-consolidation`

La revision fue estatica. No se ejecutaron endpoints, SQL ni scripts QA con
efectos.

| Ruta | Estado actual | Duplicidad con MVP | Endpoints usados | Componentes compartidos | Referencias vivas | Riesgo de eliminar | Decisión recomendada B.7 |
| ---- | ------------- | ------------------ | ---------------- | ----------------------- | ----------------- | ------------------ | ------------------------ |
| `/dashboard-v2` | Redirect server puro a `/dashboard`; oculto para cliente. | Total en pagina; `/dashboard` es entrada oficial. | Ninguno desde la pagina. Componentes historicos consumen `/api/dashboard-v2/*`, pero no son importados por la pagina oficial. | La carpeta `components/dashboard-v2` contiene paneles y tipos; no se detectaron imports vivos fuera de esa carpeta. | Validadores dashboard prueban la URL legacy y APIs V2; docs demo/QA mantienen compatibilidad. | Bajo para la pagina; medio para componentes/API y contratos QA. | ready_for_b7_quarantine |
| `/ia` | Pagina funcional legacy de recomendaciones; ocultada y con entitlement IA. | Parcial con `/ia-compliance`; usa un contrato anterior y una UI separada. | `GET /api/ai/recommendations/:tenantId`. | `AppLayout`, `TcdxIcon`, `useTenantEntitlements`, auth. | `AppLayout`, hidden routes, manifests y pagina. No se detectaron enlaces de navegacion runtime hacia `/ia`. | Medio: perderia recomendaciones legacy basadas en controles si no se verifica paridad en IA Compliance. | merge_into_mvp_then_quarantine |
| `/ejecucion-iso` | Superficie operacional funcional con lectura, generacion y decision humana; oculta para cliente MVP. | Se relaciona con `/planes-accion` y cumplimiento, pero no es duplicado simple. | `/api/iso-operational-execution/summary`, `/suggestions`, `/generate`, `/:id/approve`, `/:id/reject`. | `AppLayout`, auth; logica principal reside en la pagina. | Documentacion operativa vigente indica revision en esta ruta; demo la clasifica beta/interna. | Alto: genera, aprueba y rechaza sugerencias que pueden crear registros. | keep_enterprise_post_mvp |
| `/documentos` | Generador documental funcional con historial, detalle, generacion y archivo; oculto para cliente MVP. | Solapa con Evidencias, pero aporta generacion documental premium propia. | `/api/iso-document-generator/:tenantId/options`, `/templates`, `/documents`, `/generate`, detalle y `/archive`. | `AppLayout`, `TcdxIcon`, entitlement IA y auth. | Dos deep links backend, util de acciones recomendadas, QA master y docs demo/API. | Alto: rompería deep links y un flujo enterprise con persistencia. | requires_backend_contract_review |

## RBAC y tenant

- Las cuatro rutas frontend pasan por `AppLayout`; las no MVP permanecen en
  `INTERNAL_CLIENT_HIDDEN_ROUTES`.
- `/api/dashboard-v2`, `/api/iso-operational-execution` y
  `/api/iso-document-generator` estan montados despues de JWT, RBAC y tenant
  scope global.
- Los servicios de ejecucion y documentos resuelven o validan tenant y filtran
  consultas por `tenant_id`.
- `/api/ai/recommendations/:tenantId` aplica auth local y compara el tenant del
  usuario antes de consultar.

## Preparacion B.7

- `/dashboard-v2`: desacoplar checks frontend legacy de los validadores antes de
  mover solo la pagina. No tocar componentes ni API en la misma etapa.
- `/ia`: comparar explicitamente la informacion mostrada con
  `/ia-compliance`; migrar valor faltante antes de cuarentena.
- `/ejecucion-iso`: mantener como enterprise/post-MVP hasta que producto defina
  su acceso y encaje con planes de accion.
- `/documentos`: resolver deep links y contrato backend antes de cualquier
  movimiento.
