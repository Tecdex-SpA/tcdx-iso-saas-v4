# Cleanup B.2 frontend redirects

Fecha: 2026-06-12
Rama: `chore/cleanup-b2-frontend-redirects`
Commit base: `2e668f7 chore: quarantine legacy scripts and document removal readiness`

## Resumen ejecutivo

Se inspeccionaron las cuatro rutas objetivo y se confirmo que son redirects o wrappers de redirect sin llamadas API ni logica de negocio. El dependency scan encontro referencias vivas fuera de `docs/cleanup` y manifests para las cuatro rutas. De acuerdo con la regla de B.2, no se movio ninguna carpeta fuera del App Router.

Se actualizo `scripts/qa/qa-official-surface.sh` para soportar ambos estados controlados:

- ruta ausente: PASS `removed from app router`;
- ruta presente: debe continuar fuera de navegacion MVP y controlada por hidden/platform/dealer.

## Clasificacion y decision

| Ruta | Archivo original | Tipo detectado | Referencias vivas | Acción | Nueva ubicación | Rollback |
| ---- | ---------------- | -------------- | ----------------- | ------ | --------------- | -------- |
| `/dashboard-kpi` | `frontend/src/app/dashboard-kpi/page.tsx` | Redirect server puro a `/dashboard?view=kpi`; sin fetch, metadata ni componentes productivos. | `scripts/qa-bilingual-full.sh`, `scripts/qa-i18n-db-display.sh`, `docs/demo/official-demo-routes.md`, `docs/qa-effective-health-sources.md`. | kept_requires_review | Sin cambio. | No aplica. |
| `/centro-control-iso` | `frontend/src/app/centro-control-iso/page.tsx` | Redirect server puro a `/dashboard?view=iso`; sin fetch, metadata ni componentes productivos. | `scripts/validate-iso-unified-command-center.sh`, `docs/demo/official-demo-routes.md`, `docs/qa-effective-health-sources.md`. | kept_requires_review | Sin cambio. | No aplica. |
| `/command-center-iso` | `frontend/src/app/command-center-iso/page.tsx` | Redirect server puro a `/dashboard?view=iso`; sin fetch, metadata ni componentes productivos. | `scripts/validate-iso-command-center.sh`, `docs/demo/official-demo-routes.md`, `docs/qa-effective-health-sources.md`. | kept_requires_review | Sin cambio. | No aplica. |
| `/auditor-iso` | `frontend/src/app/auditor-iso/page.tsx` | Wrapper cliente de `router.replace('/auditorias?view=preauditoria')`; solo usa `AppLayout`. | `backend/src/services/isoCommandCenter.service.js`, `scripts/validate-iso-auditor.sh`, `docs/audit-views-consolidation.md`, `docs/demo/official-demo-routes.md`. | kept_requires_review | Sin cambio. | No aplica. |

## Superficie MVP

Las cuatro rutas siguen fuera de `CLIENT_MVP_NAV_ITEMS`, permanecen en `INTERNAL_CLIENT_HIDDEN_ROUTES` y estan protegidas por `qa-official-surface.sh`. Las 10 rutas MVP oficiales no cambiaron.

## Archivos modificados

- `scripts/qa/qa-official-surface.sh`
- `docs/cleanup/frontend-legacy-removal-readiness.md`
- `docs/cleanup/cleanup-b2-frontend-redirects.md`

No se modificaron paginas frontend, backend, DB, AI Engine, agent, OAuth/Zoho, Sync Agent, IA traces, external lookup ni `report.routes.js`.

## Validaciones

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Rama correcta; solo guard y documentos B.2 modificados. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Las cuatro rutas B.2 se reportan presentes y controladas; las 10 MVP pasan. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Inventario no destructivo; `qa-results` ausente. |
| `cd frontend && npm run lint` | PASS con warnings | 636 warnings existentes, 0 errores. |
| `cd frontend && npm run check` | PASS | Build completo; se mantienen 46 paginas porque no se movieron rutas. |
| `cd backend && npm test` | PASS | Ejecuta `node -c src/app.js`. |
| `python3 -m compileall -q ai-engine` | PASS | Sintaxis Python valida. |
| `bash scripts/env-check.sh` | WARN aceptado | Exit 3; 46 WARN, 0 FAIL por variables locales no cargadas. |
| `git diff --check` | PASS | Sin whitespace errors. |

## Rollback

No hay movimientos de paginas que revertir. Para revertir el cambio de guard y documentos:

```bash
git checkout 2e668f7 -- scripts/qa/qa-official-surface.sh docs/cleanup/frontend-legacy-removal-readiness.md
rm -f docs/cleanup/cleanup-b2-frontend-redirects.md
```
