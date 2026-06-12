# Frontend legacy removal readiness B.1/B.2

Fecha: 2026-06-12
Ultima revision: `chore/cleanup-b2-frontend-redirects`

No se borraron paginas frontend. Se revisaron archivos `frontend/src/app/**/page.tsx`, imports, componentes compartidos y endpoints llamados desde las paginas legacy solicitadas.

| Ruta | Archivo | Clasificación actual | Componentes compartidos | Endpoints usados | Riesgo de eliminar | Decisión B.1 | Candidato B.2 |
| ---- | ------- | -------------------- | ----------------------- | ---------------- | ------------------ | ------------ | ------------- |
| `/dashboard-v2` | `frontend/src/app/dashboard-v2/page.tsx` | duplicate_candidate | Ninguno en pagina; redirect server a `/dashboard`. Componentes `dashboard-v2/*` siguen usados por `/dashboard`. | Ninguno desde pagina; backend `/api/dashboard-v2` usado por componentes compartidos y scripts QA. | Bajo para pagina redirect; medio para componentes/API por compatibilidad. | requires_dependency_review | candidate_for_b2_delete solo pagina redirect; merge/review para componentes/API. |
| `/dashboard-kpi` | `frontend/src/app/dashboard-kpi/page.tsx` | duplicate_candidate | Ninguno en pagina; redirect server a `/dashboard?view=kpi`. | Ninguno desde pagina. | Bajo para pagina redirect; medio si docs/scripts aun esperan URL legacy. | candidate_for_b2_delete | Si, eliminar pagina redirect cuando producto confirme que `/dashboard?view=kpi` es unico acceso. |
| `/ia` | `frontend/src/app/ia/page.tsx` | legacy_candidate | `AppLayout`, `TcdxIcon`, `useTenantEntitlements`, `getUserFromToken`. | `GET /api/ai/recommendations/:tenantId`. | Medio: superficie IA legacy distinta de `/ia-compliance`; puede tener dependencia comercial historica. | requires_product_review | candidate_for_b2_merge_then_delete hacia `/ia-compliance`. |
| `/auditor-iso` | `frontend/src/app/auditor-iso/page.tsx` | legacy_candidate | `AppLayout`; redirect client a `/auditorias?view=preauditoria`. | Ninguno desde pagina. | Bajo/medio: redirect legacy puede ser usado por enlaces externos. | candidate_for_b2_delete | Si, si no hay enlaces externos vivos. |
| `/centro-control-iso` | `frontend/src/app/centro-control-iso/page.tsx` | legacy_candidate | Ninguno en pagina; redirect server a `/dashboard?view=iso`. | Ninguno desde pagina. | Bajo: redirect legacy. | candidate_for_b2_delete | Si, tras confirmar que `/dashboard?view=iso` reemplaza enlaces legacy. |
| `/command-center-iso` | `frontend/src/app/command-center-iso/page.tsx` | legacy_candidate | Ninguno en pagina; redirect server a `/dashboard?view=iso`. | Ninguno desde pagina. | Bajo: redirect legacy. | candidate_for_b2_delete | Si, tras confirmar que `/dashboard?view=iso` reemplaza enlaces legacy. |
| `/ejecucion-iso` | `frontend/src/app/ejecucion-iso/page.tsx` | enterprise_post_mvp / legacy_candidate | `AppLayout`, `getUserFromToken`. | `/api/iso-operational-execution/summary`, `/suggestions`, `/generate`, `/:id/approve`, `/:id/reject`. | Alto: pagina puede generar/aprobar/rechazar sugerencias; no eliminar sin decidir reemplazo enterprise. | requires_product_review | candidate_for_b2_merge_then_delete o keep_enterprise. |
| `/documentos` | `frontend/src/app/documentos/page.tsx` | enterprise_post_mvp / legacy_candidate | `AppLayout`, `TcdxIcon`, `useTenantEntitlements`, auth helpers. | `/api/iso-document-generator/:tenant/documents`, `/options`, `/templates`, `/generate`, `/documents/:id`, `/documents/:id/archive`. | Alto: generador documental con historial y acciones; solapa con evidencias pero no es redirect. | requires_product_review | keep_enterprise o candidate_for_b2_merge_then_delete con Evidence Library/reportes. |

## Lectura B.1

Las paginas redirect (`/dashboard-v2`, `/dashboard-kpi`, `/auditor-iso`, `/centro-control-iso`, `/command-center-iso`) son candidatas mas seguras para B.2. Las paginas con escritura o generacion (`/ejecucion-iso`, `/documentos`) requieren decision de producto y revision de dependencias antes de cualquier eliminacion.

## Resultado B.2

| Ruta | Decision B.2 | Evidencia que impide mover | Siguiente condicion |
| ---- | ------------ | -------------------------- | ------------------- |
| `/dashboard-kpi` | kept_requires_review | `scripts/qa-bilingual-full.sh` prueba la ruta; `scripts/qa-i18n-db-display.sh` referencia el archivo; docs demo/QA vigentes describen el redirect. | Actualizar QA y confirmar retiro de compatibilidad URL en una etapa coordinada. |
| `/centro-control-iso` | kept_requires_review | `scripts/validate-iso-unified-command-center.sh` prueba la URL; docs demo/QA vigentes describen el redirect. | Retirar o adaptar el validador y confirmar ausencia de enlaces externos. |
| `/command-center-iso` | kept_requires_review | `scripts/validate-iso-command-center.sh` prueba la URL; docs demo/QA vigentes describen el redirect. | Retirar o adaptar el validador y confirmar ausencia de enlaces externos. |
| `/auditor-iso` | kept_requires_review | `backend/src/services/isoCommandCenter.service.js` emite la ruta; `scripts/validate-iso-auditor.sh` la prueba; docs de consolidacion la documentan. | Cambiar el enlace runtime a `/auditorias?view=preauditoria` y actualizar QA antes de mover la pagina. |

## Resultado B.3

| Ruta | Estado B.2 | Referencias B.3 | Acción B.3 | Estado para B.4 |
| ---- | ---------- | --------------- | ---------- | --------------- |
| `/dashboard-kpi` | kept_requires_review | QA bilingue, QA i18n, demo y QA health actualizados a `/dashboard`; quedan pagina redirect, guard, hidden route y referencias historicas/cleanup. | Desacoplada de QA y documentacion vigente. | ready_for_quarantine |
| `/centro-control-iso` | kept_requires_review | Validador command center y docs vigentes actualizados a `/dashboard`; quedan pagina redirect, guard, hidden route, componentes por nombre y referencias historicas/cleanup. | Desacoplada de QA y documentacion vigente. | ready_for_quarantine |
| `/command-center-iso` | kept_requires_review | Validador command center y docs vigentes actualizados a `/dashboard`; quedan pagina redirect, guard, hidden route, componentes por nombre y referencias historicas/cleanup. | Desacoplada de QA y documentacion vigente. | ready_for_quarantine |
| `/auditor-iso` | kept_requires_review | Deep link backend y QA actualizados a `/cumplimiento-auditoria`; doc de consolidacion marcada historica. Quedan pagina redirect, guard, hidden route, componentes por nombre y referencias historicas/cleanup. | Desacoplada de runtime, QA y demo. | ready_for_quarantine |

## Resultado B.4

| Ruta | Estado B.3 | Acción B.4 | Ubicación preservada | Estado final |
| ---- | ---------- | ---------- | -------------------- | ------------ |
| `/dashboard-kpi` | ready_for_quarantine | Movida fuera de `frontend/src/app`. | `frontend/src/legacy-pages/dashboard-kpi/page.tsx` | quarantined_outside_app_router |
| `/centro-control-iso` | ready_for_quarantine | Movida fuera de `frontend/src/app`. | `frontend/src/legacy-pages/centro-control-iso/page.tsx` | quarantined_outside_app_router |
| `/command-center-iso` | ready_for_quarantine | Movida fuera de `frontend/src/app`. | `frontend/src/legacy-pages/command-center-iso/page.tsx` | quarantined_outside_app_router |
| `/auditor-iso` | ready_for_quarantine | Movida fuera de `frontend/src/app`. | `frontend/src/legacy-pages/auditor-iso/page.tsx` | quarantined_outside_app_router |

## Resultado B.5

| Ruta | Estado B.4 | Acción B.5 | Ubicación final | Regla hidden | Estado final |
| ---- | ---------- | ---------- | --------------- | ------------ | ------------ |
| `/dashboard-kpi` | quarantined_outside_app_router | Movida fuera de `frontend/src`. | `frontend/legacy-pages-archive/dashboard-kpi/page.tsx` | Retirada | archived_outside_frontend_src |
| `/centro-control-iso` | quarantined_outside_app_router | Movida fuera de `frontend/src`. | `frontend/legacy-pages-archive/centro-control-iso/page.tsx` | Retirada | archived_outside_frontend_src |
| `/command-center-iso` | quarantined_outside_app_router | Movida fuera de `frontend/src`. | `frontend/legacy-pages-archive/command-center-iso/page.tsx` | Retirada | archived_outside_frontend_src |
| `/auditor-iso` | quarantined_outside_app_router | Movida fuera de `frontend/src`. | `frontend/legacy-pages-archive/auditor-iso/page.tsx` | Retirada | archived_outside_frontend_src |

## Resultado B.6

| Ruta | Evidencia principal | Riesgo | Decisión recomendada B.7 |
| ---- | ------------------- | ------ | ------------------------ |
| `/dashboard-v2` | Redirect puro; validadores y APIs V2 siguen vivos. | Bajo para pagina, medio para contratos asociados. | ready_for_b7_quarantine |
| `/ia` | UI funcional sobre `/api/ai/recommendations/:tenantId`; no es redirect. | Medio por posible valor no migrado a IA Compliance. | merge_into_mvp_then_quarantine |
| `/ejecucion-iso` | Genera, aprueba y rechaza sugerencias tenant-scoped. | Alto por escritura y creacion de registros. | keep_enterprise_post_mvp |
| `/documentos` | Genera y archiva documentos; tiene deep links runtime. | Alto por persistencia y contratos backend/frontend vivos. | requires_backend_contract_review |

## Resultado B.7

| Ruta | Estado B.6 | Evidencia revalidada | Accion B.7 | Estado final |
| ---- | ---------- | -------------------- | ---------- | ------------ |
| `/dashboard-v2` | ready_for_b7_quarantine | Siete validadores y docs QA/demo vigentes mantienen la URL redirect. | No mover hasta desacoplar el contrato de compatibilidad. | kept_temporarily |
| `/ia` | merge_into_mvp_then_quarantine | La pagina consume un contrato de recomendaciones y presenta informacion sin paridad demostrada en IA Compliance. | No mover hasta completar o descartar la fusion MVP. | blocked_pending_mvp_merge |
| `/ejecucion-iso` | keep_enterprise_post_mvp | Mantiene generacion y decision humana sobre sugerencias. | Conservar activa y oculta. | kept_enterprise_post_mvp |
| `/documentos` | requires_backend_contract_review | Mantiene deep links y contratos backend/frontend persistentes. | Conservar activa y oculta hasta revision del contrato. | blocked_by_backend_contract_review |
