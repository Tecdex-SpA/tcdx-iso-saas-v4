# Fase 5 — Baseline auditado

Base validada antes de modificar:

- Rama base: `main`.
- SHA base: `a1cc04e9ae96d0bfbc169c785d8e3491be7e5c50`.
- Remoto: `https://github.com/Tecdex-SpA/tcdx-iso-saas-v4.git`.
- Node: `v26.4.0`.
- npm: `11.17.0`.

Resultado de línea base:

- `npm install`: OK.
- `npm --prefix backend install`: OK.
- `npm --prefix frontend install`: OK, con 9 vulnerabilidades high preexistentes reportadas por npm.
- `npm --prefix backend test`: falló en sandbox por bloqueo de `listen(127.0.0.1)`; el test aislado `commercial.service.test.js` pasa fuera del sandbox. Se hizo cierre idempotente del servidor de test.
- `npm --prefix frontend run lint`: OK.
- `npm --prefix frontend run build`: OK, con warning preexistente de múltiples lockfiles.
- `git diff --check`: OK.

Inventario dirigido:

| Capacidad | Estado | Decisión |
| --- | --- | --- |
| Métricas KPI/KRI phase3 (`grc_metric_definitions`, `grc_metric_measurements`) | presente | `extend` con catálogo Fase 5 versionado y sin reemplazo destructivo |
| KPI legacy (`kpi.routes`, reportes health) | presente | `reuse` para reportes existentes; Fase 5 usa `/api/metrics` |
| Dashboards (`dashboard`, `dashboard-v2`) | presente | `extend`; Fase 5 agrega `dashboard_definitions/widgets` gobernados |
| Reportes premium PDF/ZIP | presente | `reuse`; Fase 5 agrega Report Studio y generaciones PDF/DOCX/XLSX |
| DOCX/XLSX | presente en generación documental y exportes GRC | `reuse` de librerías `jszip`, `xlsx`, `pdfkit` |
| Jobs (`tcdx_async_jobs`) | presente | `reuse` en cálculo de métricas |
| Scheduler phase1/phase2 | presente | `extend` con tipos de job Fase 5, sin broker nuevo |
| Encuestas/cuestionarios TPRM phase2 | presente | `extend` con motor genérico `survey_*` |
| Auditorías/workpapers | presente | `reuse` vía reportes, tests y lineage |
| Riesgos, controles, incidentes, proveedores, continuidad | presente Fases 1-3 | `reuse` por referencias y métricas; sin duplicar dominios operacionales |
| Evidencias/archivos | presente | `reuse` por referencias `evidence_id` y descargas controladas |
| RBAC | presente | `extend` en `rbac.middleware.js` |
| Entitlements/capabilities Fase 4 | presente | `extend` con capabilities Fase 5 |
| Límites de uso Fase 4 | presente | `extend` con límites Fase 5 |
| Migraciones con ledger | presente | `reuse` patrón Phase 4 runner |
| Deploy oficial | presente | `extend` con allowlist declarativa Fases 3-5 |
