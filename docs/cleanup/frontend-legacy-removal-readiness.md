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
