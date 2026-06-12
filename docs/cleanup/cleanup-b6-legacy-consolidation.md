# Cleanup B.6 legacy consolidation

Fecha: 2026-06-12
Rama: `chore/cleanup-b6-legacy-consolidation`
Commit base: `f01f35c chore: archive legacy frontend redirects outside src`

## Resumen ejecutivo

B.6 endurece el guard de superficie para funcionar con `rg` o `grep` sin
ocultar errores de busqueda. Tambien documenta el alcance real del toolchain
sobre `frontend/legacy-pages-archive` y clasifica cuatro rutas legacy activas
para una etapa B.7.

No se borraron ni movieron paginas. No se modificaron backend, base de datos,
AI Engine, agent, integraciones ni configuraciones del toolchain.

## Cambios realizados

- `qa-official-surface.sh` incorpora deteccion de comandos y fallback de
  busqueda fija con `grep -F`.
- La busqueda distingue coincidencia, ausencia y error; un error ya no produce
  PASS.
- Se creo `frontend-legacy-archive-toolchain-review.md`.
- Se creo `legacy-routes-b6-consolidation-review.md`.
- Se actualizaron readiness y superficie oficial con decisiones B.7.

## Guard sin rg

El guard se valida en dos modos:

1. entorno normal con `rg`;
2. `PATH` controlado sin `rg`, usando `grep`.

En ambos casos debe conservar los mismos PASS y terminar con codigo 0. No debe
imprimir `rg: command not found`.

## Archive y toolchain

Decision B.6: `keep_in_frontend_archive`.

El archive:

- es incluido por TypeScript debido a `**/*.ts` y `**/*.tsx`;
- es procesado por ESLint porque no existe ignore especifico;
- no genera rutas Next por estar fuera de `src/app`;
- es verificado intencionalmente por el guard.

No se excluye ni mueve en B.6 porque lint, TypeScript y build pasan.

## Decisiones recomendadas B.7

| Ruta | Decisión | Motivo |
| ---- | -------- | ------ |
| `/dashboard-v2` | ready_for_b7_quarantine | Pagina redirect pura; desacoplar primero checks frontend legacy sin tocar API/componentes. |
| `/ia` | merge_into_mvp_then_quarantine | Tiene UI y contrato de recomendaciones que deben compararse con IA Compliance. |
| `/ejecucion-iso` | keep_enterprise_post_mvp | Flujo funcional con operaciones de generar, aprobar y rechazar. |
| `/documentos` | requires_backend_contract_review | Generador persistente con deep links y contratos runtime vivos. |

## Rollback

El cambio de guard puede revertirse restaurando
`scripts/qa/qa-official-surface.sh` desde `f01f35c`. Los documentos nuevos
pueden retirarse y los manifests restaurarse desde el mismo commit.

No existe rollback de paginas porque B.6 no mueve ni elimina ninguna.

## Validaciones

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Solo guard y documentacion B.6 antes del commit. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Modo normal con `rg`; superficie oficial intacta. |
| Guard con `PATH` sin `rg` | PASS | `rg` ausente confirmado; fallback `grep` completo sin `command not found`. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Inventario no destructivo; 42 paginas activas, sin `qa-results` ni `.DS_Store`. |
| `cd frontend && npm run lint` | PASS con warnings | 0 errores y 636 warnings existentes. |
| `cd frontend && npm run check` | PASS | Next mantiene 42 paginas. |
| `cd frontend && npx tsc --noEmit --pretty false` | PASS | Sin errores TypeScript. |
| `cd backend && npm test` | PASS | `node -c src/app.js`; sin cambios backend. |
| `python3 -m compileall -q ai-engine` | PASS | Sin errores; no hubo cambios AI Engine. |
| `bash scripts/env-check.sh` | WARN aceptado | Codigo 3; 46 WARN y 0 FAIL por variables locales no cargadas. |
| `bash -n scripts/qa/qa-official-surface.sh` | PASS | Sintaxis shell valida. |
| `git diff --check` | PASS | Sin errores de whitespace. |
