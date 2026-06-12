# Cleanup B.3 decouple legacy redirects

Fecha: 2026-06-12
Rama: `chore/cleanup-b3-decouple-legacy-redirects`
Commit base: `d77c713 test: prepare frontend redirect quarantine guard`

## Resumen ejecutivo

Se desacoplaron referencias vivas de QA, demo y backend hacia cuatro redirects legacy. No se borraron ni movieron paginas. Las entradas oficiales usadas ahora son `/dashboard` y `/cumplimiento-auditoria`.

## Referencias encontradas

El inventario detallado esta en `docs/cleanup/legacy-redirect-references-b3.md`. Se encontraron:

- checks HTTP y cobertura i18n en scripts QA;
- aliases en documentacion demo y QA vigente;
- un deep link backend de `Auditor ISO`;
- paginas redirect, hidden routes y guard;
- manifests cleanup y documentacion historica;
- imports de componentes cuyo nombre contiene la ruta, pero que no son URLs.

## Cambios realizados

### QA

- `scripts/qa-bilingual-full.sh`: retiro `/dashboard-kpi`; `/dashboard` ya esta cubierto.
- `scripts/qa-i18n-db-display.sh`: reemplazo archivo redirect por `frontend/src/app/dashboard/page.tsx`.
- `scripts/validate-iso-unified-command-center.sh`: check frontend usa `/dashboard`.
- `scripts/validate-iso-command-center.sh`: check frontend usa `/dashboard`.
- `scripts/validate-iso-auditor.sh`: check frontend usa `/cumplimiento-auditoria`.

Los validadores no fueron ejecutados porque requieren entorno/tokens/DB o pueden tener alcance mayor. Se valido sintaxis con `bash -n`.

### Documentacion

- `docs/demo/official-demo-routes.md`: retiro los cuatro aliases del contrato demo y declara entradas oficiales.
- `docs/qa-effective-health-sources.md`: QA vigente usa `/dashboard`.
- `docs/audit-views-consolidation.md`: agrega nota historica B.3.
- `docs/product/official-frontend-surface.md`: marca las cuatro rutas listas para B.4.
- `docs/cleanup/frontend-legacy-removal-readiness.md`: estado B.4 actualizado.

### Backend

- `backend/src/services/isoCommandCenter.service.js`: el quick link `Auditor ISO` cambia de `/auditor-iso` a `/cumplimiento-auditoria`.

El cambio afecta solo la URL recomendada. No modifica scoring, consultas, IA, permisos ni DB.

### Guard

`scripts/qa/qa-official-surface.sh` valida que las cuatro rutas no reaparezcan en los archivos vivos de QA/backend/demo controlados por B.3.

## Referencias no cambiadas

- Paginas redirect bajo `frontend/src/app`: se conservan por regla B.3.
- `frontend/src/utils/mvpPermissions.ts` y guard: siguen controlando las rutas hasta B.4.
- Manifests cleanup/product y ADR: conservan trazabilidad.
- Docs FASE/Sprint 0/Sprint 1: referencias historicas, no contratos actuales.
- Imports `frontend/src/components/command-center-iso`, `centro-control-iso` y `auditor-iso`: nombres internos de componentes reutilizados, no URLs.

## Estado para B.4

| Ruta | Estado |
| ---- | ------ |
| `/dashboard-kpi` | ready_for_quarantine |
| `/centro-control-iso` | ready_for_quarantine |
| `/command-center-iso` | ready_for_quarantine |
| `/auditor-iso` | ready_for_quarantine |

## Rollback

```bash
git checkout d77c713 -- \
  backend/src/services/isoCommandCenter.service.js \
  scripts/qa-bilingual-full.sh \
  scripts/qa-i18n-db-display.sh \
  scripts/validate-iso-unified-command-center.sh \
  scripts/validate-iso-command-center.sh \
  scripts/validate-iso-auditor.sh \
  scripts/qa/qa-official-surface.sh \
  docs/demo/official-demo-routes.md \
  docs/qa-effective-health-sources.md \
  docs/audit-views-consolidation.md \
  docs/product/official-frontend-surface.md \
  docs/cleanup/frontend-legacy-removal-readiness.md
rm -f docs/cleanup/legacy-redirect-references-b3.md
rm -f docs/cleanup/cleanup-b3-decouple-legacy-redirects.md
```

## Validaciones

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Rama B.3 confirmada; solo cambios esperados antes del commit. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Las 10 rutas MVP pasan; las cuatro rutas B.3 no tienen referencias vivas controladas. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Inventario no destructivo; `qa-results` y `.DS_Store` ausentes. |
| `cd frontend && npm run lint` | PASS con warnings | 0 errores y 636 warnings existentes. |
| `cd frontend && npm run check` | PASS | Next genero 46 paginas estaticas; las cuatro rutas permanecen porque B.3 no mueve paginas. |
| `cd backend && npm test` | PASS | `node -c src/app.js`. |
| `python3 -m compileall -q ai-engine` | PASS | Sin errores de sintaxis Python. |
| `bash scripts/env-check.sh` | WARN aceptado | Codigo 3; 46 WARN y 0 FAIL por variables locales no cargadas. |
| `bash -n` sobre scripts modificados | PASS | Sintaxis shell valida; no se ejecutaron validadores con dependencias runtime. |
| `node -c backend/src/services/isoCommandCenter.service.js` | PASS | Sintaxis valida para el cambio de deep link. |
| `git diff --check` | PASS | Sin errores de whitespace. |
