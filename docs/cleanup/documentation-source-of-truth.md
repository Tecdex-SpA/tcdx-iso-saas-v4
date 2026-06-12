# Documentation source of truth

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a-official-surface`

| Documento/carpeta | Clasificacion | Uso actual | Riesgo si se usa mal | Accion futura |
| ----------------- | ------------- | ---------- | -------------------- | ------------- |
| `docs/docs-index.md` | source_of_truth | Indice rector para elegir documentacion vigente. | Bajo; alto si se ignora. | Mantener actualizado. |
| `docs/product/official-frontend-surface.md` | source_of_truth | Superficie frontend oficial MVP/interna/legacy. | Medio si queda obsoleto tras cambios de rutas. | Actualizar al cambiar App Router/Sidebar. |
| `docs/product/official-backend-surface.md` | source_of_truth | Superficie backend oficial y clasificada. | Medio si cambia `backend/src/app.js`. | Actualizar con mounts. |
| `docs/product/mvp-route-backend-map.md` | source_of_truth | Mapa frontend MVP a backend. | Medio si se usa sin verificar runtime. | Usar para QA y producto. |
| `docs/demo/official-demo-routes.md` | source_of_truth | Rutas demo/piloto vigentes. | Medio si contradice superficie 3A. | Reconciliar en etapa posterior. |
| `docs/api/api-contract-current.md` | source_of_truth | Contrato API actual. | Medio si cambia app.js. | Actualizar con cambios backend. |
| `docs/security/rbac-route-matrix.md` | source_of_truth | RBAC/reportes y rutas. | Alto si se ignora para permisos. | Mantener junto a middleware. |
| `docs/security/upload-governance-policy.md` | operational_current | Politica uploads. | Alto si se ignora en evidencias/docs. | Mantener. |
| `docs/engineering/error-response-standard.md` | operational_current | Contrato gradual de errores. | Medio. | Aplicar en hardening. |
| `docs/ai/ai-governance-policy.md` | operational_current | Gobernanza IA. | Alto si se ignora revision humana. | Usar para Etapa IA. |
| `docs/database/database-scripts-manifest.md` | operational_current | Clasificacion DB/scripts. | Alto si se ejecuta SQL historico. | Usar antes de DB work. |
| `docs/cleanup/**` | cleanup_record | Evidencia de etapas cleanup. | Medio si se toma como runtime truth sin verificar. | Mantener como historial de decisiones. |
| `docs/adr/**` | source_of_truth | Decisiones arquitectonicas. | Medio si se contradice codigo actual. | Mantener ADRs vigentes. |
| `docs/runbooks/**`, `docs/*runbook*.md` | operational_current | Operacion, backup, deploy, continuidad. | Alto si se ejecuta sin entorno correcto. | Usar con aprobacion operacional. |
| `docs/database-live-map/**` | operational_current | Mapa DB estructural con revision. | Alto si se asume actual sin verificar. | Revalidar antes de DB changes. |
| `docs/sprint-0/**` | historical_reference | Inventario inicial y contexto. | Alto si se usa para estado actual. | No usar para coding sin verificar. |
| `docs/sprint-1/**` | historical_reference | Evidencia hardening inicial. | Medio. | Contexto; verificar scripts actuales. |
| `docs/sprint-2/**` | historical_reference | Cierre tecnico/piloto anterior. | Medio. | Contexto; verificar contra codigo. |
| `docs/sprint-3/**` | historical_reference | Sprint docs previos y governance status. | Medio. | Usar solo status vigente con cuidado. |
| `docs/sprint-3-5/**` | operational_current | Evidence Library/Zoho/document index. | Alto si se cambia lifecycle sin validar. | Usar para evidence flows. |
| `docs/sprint-4/**` | historical_reference | Diagnostico fortalecido. | Medio. | Contexto. |
| `docs/sprint-5/**` | historical_reference | Health/KPI. | Medio. | Contexto dashboard/KPI. |
| `docs/sprint-6/**` | operational_current | Reportes/alcance ISO. | Medio. | Usar junto a API/RBAC actual. |
| `docs/sprint-7/**` | historical_reference | Demo comercial seed/maturity. | Alto si se ejecuta SQL demo. | No ejecutar sin DBA. |
| `docs/FASE_*.md` | legacy_do_not_use_for_coding | Fases historicas. | Alto. | Candidato a mover a legacy docs. |
| `docs/CIERRE_*.md` | historical_reference | Cierre funcional historico. | Medio/alto. | Mantener como historial. |
| `docs/phase-*.md` | historical_reference | Phase 4 historico. | Medio. | Mantener como contexto. |
| `docs/RBAC_FINAL.md`, `docs/rbac-matrix.md`, `docs/rbac-phase-4c.md` | legacy_do_not_use_for_coding | RBAC historico. | Alto. | Usar `docs/security/rbac-route-matrix.md`. |
| `docs/ai-legacy-suggest-endpoints.md` | legacy_do_not_use_for_coding | IA suggest legacy. | Alto. | No usar para nuevas integraciones. |
| `docs/repo-cleanup-candidates.md` | cleanup_record | Backlog limpieza. | Medio si se toma como aprobacion para borrar. | Usar con dependency scan y rollback. |
| `docs/frontend-lint-debt.md` | operational_current | Deuda frontend. | Bajo. | Usar para backlog, no en 3A. |
| `docs/known-limitations.md` | requires_review | Limitaciones conocidas. | Medio si esta desactualizado. | Revisar contra estado actual. |
| `docs/OPERACION_SECRETOS.md`, `docs/security/demo-credentials-policy.md` | operational_current | Secret hygiene. | Alto si se ignora. | Mantener. |

## Regla de uso

Para nuevas tareas, usar primero `docs/docs-index.md`, luego los manifiestos `docs/product/*`, y finalmente codigo/QA actual. Docs historicos no autorizan borrados, SQL, deploys ni cambios runtime.
