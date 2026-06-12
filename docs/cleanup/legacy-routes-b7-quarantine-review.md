# Legacy routes B.7 quarantine review

Fecha: 2026-06-12
Rama: `chore/cleanup-b7-final-frontend-quarantine`
Base: `4953ce2`

La revision fue estatica y se limito a referencias, paginas frontend y
contratos ya documentados. No se movieron paginas porque las dos candidatas
mantienen bloqueos verificables.

| Ruta | Referencias vivas | Cobertura MVP | Accion B.7 | Motivo |
| ---- | ----------------- | ------------- | ---------- | ------ |
| `/dashboard-v2` | Siete validadores dashboard prueban la URL frontend; `docs/qa-effective-health-sources.md` y `docs/demo/official-demo-routes.md` mantienen el redirect como contrato vigente. | `/dashboard` cubre la pagina, pero no se ha retirado el contrato de compatibilidad QA/demo. | `kept_temporarily` | La regla B.7 prohibe mover mientras exista QA vigente no actualizado o documentacion demo vigente. |
| `/ia` | La pagina, el guard, `AppLayout` y manifests. No se detecto navegacion cliente viva hacia esta ruta. | Parcial. `/ia` consume `GET /api/ai/recommendations/:tenantId` y presenta riesgo, puntaje, riesgos y recomendaciones que no estan confirmados en `/ia-compliance`. | `blocked_pending_mvp_merge` | No es wrapper ni redirect; moverla sin migrar o retirar explicitamente su valor funcional puede causar perdida comercial. |
| `/ejecucion-iso` | Pagina funcional, endpoints de ejecucion y documentacion beta/interna. | No es duplicado simple del MVP; genera y somete sugerencias a aprobacion humana. | `kept_enterprise_post_mvp` | Se conserva activa y oculta como superficie enterprise/post-MVP. |
| `/documentos` | Deep links runtime backend, utilidad frontend, QA master, endpoints de generacion/archivo y documentacion demo. | No es equivalente a Evidencias; mantiene generacion documental persistente. | `blocked_by_backend_contract_review` | Requiere resolver enlaces y contrato de integraciones/documentos antes de cualquier cuarentena. |

## Archivo legacy

`frontend/legacy-pages-archive` se conserva sin cambios. Next no genera rutas
desde esa ubicacion y las validaciones TypeScript/ESLint no muestran errores ni
warnings atribuibles al archivo; no existe evidencia para excluirlo del
toolchain en B.7.
