# Cleanup stage 3A.1 surface QA complete

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a1-surface-qa-complete`
Commit base: `0e195e1 docs: define official mvp surface and legacy manifests`

## Objetivo

Completar el control automatizado de superficie oficial para que `scripts/qa/qa-official-surface.sh` valide explicitamente las 10 rutas MVP cliente finales, incluyendo `/perfil-empresa` y `/usuarios`.

## Cambios realizados

- Se actualizo `scripts/qa/qa-official-surface.sh` para validar las 10 rutas oficiales de cliente MVP.
- El script ahora acepta como superficie oficial `CLIENT_MVP_NAV_ITEMS` o `MVP_ROUTE_RULES`, porque `/perfil-empresa` y `/usuarios` pertenecen al MVP bajo Configuracion aunque no sean items principales del Sidebar.
- Cada ruta MVP oficial se valida contra ausencia en `INTERNAL_CLIENT_HIDDEN_ROUTES`, `PLATFORM_ROUTES` y `DEALER_ROUTES`.
- Se reviso `frontend/src/utils/mvpPermissions.ts`; `/perfil-empresa` y `/usuarios` ya estaban en `MVP_ROUTE_RULES` y no requirieron cambios.
- Se reviso `docs/adr/ADR-cleanup-stage-3a-official-surface.md`; la ADR ya enumera las 10 rutas y no requirio cambios.

## Rutas MVP verificadas

| Ruta | Mecanismo esperado | Resultado |
| ---- | ------------------ | --------- |
| `/dashboard` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/cumplimiento-auditoria` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/evidencias` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/riesgos` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/planes-accion` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/exportes` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/ia-compliance` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/configuracion` | `CLIENT_MVP_NAV_ITEMS` / `MVP_ROUTE_RULES` | PASS |
| `/perfil-empresa` | `MVP_ROUTE_RULES` | PASS |
| `/usuarios` | `MVP_ROUTE_RULES` | PASS |

## Resultado de `qa-official-surface.sh`

PASS. La salida incluye checks explicitos para `/perfil-empresa` y `/usuarios`:

- `PASS: /perfil-empresa is allowed by client MVP surface`
- `PASS: /perfil-empresa is not in INTERNAL_CLIENT_HIDDEN_ROUTES`
- `PASS: /perfil-empresa is not in PLATFORM_ROUTES`
- `PASS: /perfil-empresa is not in DEALER_ROUTES`
- `PASS: /usuarios is allowed by client MVP surface`
- `PASS: /usuarios is not in INTERNAL_CLIENT_HIDDEN_ROUTES`
- `PASS: /usuarios is not in PLATFORM_ROUTES`
- `PASS: /usuarios is not in DEALER_ROUTES`

## Validaciones ejecutadas

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Rama correcta; solo cambios esperados en script QA y reporte 3A.1. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Valida las 10 rutas MVP cliente. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Tolera ausencia de `qa-results`. |
| `cd backend && npm test` | PASS | Ejecuta `node -c src/app.js`. |
| `cd frontend && npm run lint` | PASS con warnings | 636 warnings existentes, 0 errores. |
| `cd frontend && npm run check` | PASS | Build Next completo; 46 paginas generadas. |
| `python3 -m compileall -q ai-engine` | PASS | Sintaxis Python valida. |
| `bash scripts/env-check.sh` | WARN aceptado | Exit 3; 46 WARN, 0 FAIL por variables locales no cargadas. |
| `git diff --check` | PASS | Sin whitespace errors. |

## Confirmacion de alcance

No se eliminaron ni movieron archivos productivos. No se tocaron backend, DB, AI Engine, OAuth Google/Zoho, Sync Agent, IA traces, external lookup, `database/qa-fixes`, `report.routes.js` ni la ruta legacy cuarentenada `2evidences.routes.js`.
