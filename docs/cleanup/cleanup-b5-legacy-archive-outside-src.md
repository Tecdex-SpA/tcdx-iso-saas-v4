# Cleanup B.5 legacy archive outside frontend src

Fecha: 2026-06-12
Rama: `chore/cleanup-b5-legacy-archive-outside-src`
Commit base: `fe83cdd chore: quarantine legacy frontend redirects outside app router`

## Resumen ejecutivo

Las cuatro paginas redirect preservadas en B.4 fueron movidas con `git mv`
fuera de `frontend/src`. Sus reglas obsoletas fueron retiradas de
`INTERNAL_CLIENT_HIDDEN_ROUTES`, mientras el guard oficial conserva control
explicito sobre su ausencia del App Router y su presencia en el archivo legacy.

No se borraron archivos ni se modificaron otras rutas, backend, base de datos,
AI Engine, agent o scripts fuera del guard permitido.

## Movimientos y rollback

| Ruta legacy | Ubicación B.4 | Ubicación B.5 | Motivo | Regla hidden retirada | Rollback |
| ----------- | ------------- | ------------- | ------ | --------------------- | -------- |
| `/dashboard-kpi` | `frontend/src/legacy-pages/dashboard-kpi` | `frontend/legacy-pages-archive/dashboard-kpi` | Evitar que legacy se confunda con codigo frontend activo. | Si | `git mv frontend/legacy-pages-archive/dashboard-kpi frontend/src/legacy-pages/dashboard-kpi` |
| `/centro-control-iso` | `frontend/src/legacy-pages/centro-control-iso` | `frontend/legacy-pages-archive/centro-control-iso` | Evitar que legacy se confunda con codigo frontend activo. | Si | `git mv frontend/legacy-pages-archive/centro-control-iso frontend/src/legacy-pages/centro-control-iso` |
| `/command-center-iso` | `frontend/src/legacy-pages/command-center-iso` | `frontend/legacy-pages-archive/command-center-iso` | Evitar que legacy se confunda con codigo frontend activo. | Si | `git mv frontend/legacy-pages-archive/command-center-iso frontend/src/legacy-pages/command-center-iso` |
| `/auditor-iso` | `frontend/src/legacy-pages/auditor-iso` | `frontend/legacy-pages-archive/auditor-iso` | Evitar que legacy se confunda con codigo frontend activo. | Si | `git mv frontend/legacy-pages-archive/auditor-iso frontend/src/legacy-pages/auditor-iso` |

Para rollback completo tambien se deben restaurar las cuatro entradas en
`INTERNAL_CLIENT_HIDDEN_ROUTES` desde el commit B.4, o ejecutar
`git revert <commit_b5>`.

## Guard

Para cada ruta B.5, `scripts/qa/qa-official-surface.sh` valida:

- ausencia de `frontend/src/app/<ruta>/page.tsx`;
- presencia de `frontend/legacy-pages-archive/<ruta>/page.tsx`;
- ausencia en `CLIENT_MVP_NAV_ITEMS`, `MVP_ROUTE_RULES`,
  `INTERNAL_CLIENT_HIDDEN_ROUTES`, `PLATFORM_ROUTES` y `DEALER_ROUTES`.

Los controles de las 10 rutas MVP, otras rutas no MVP activas, IA Compliance,
`qa-results`, `.DS_Store` y la ruta backend cuarentenada se mantienen.

## Riesgo residual de toolchain

Los archivos ya no estan bajo `frontend/src`, pero la configuracion actual usa
`**/*.ts` y `**/*.tsx` en `frontend/tsconfig.json`, y ESLint no ignora
`legacy-pages-archive`. Por tanto, la ubicacion separa codigo activo de archivo
historico y evita rutas Next, pero no garantiza por si sola exclusion de lint o
type-check.

No se modificaron `tsconfig.json` ni `eslint.config.mjs` porque quedan fuera del
alcance B.5. Evaluar una exclusion explicita en B.6 si se decide conservar el
archivo TypeScript dentro de `frontend`.

## Validaciones

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Solo movimientos, permisos, guard y documentacion B.5 antes del commit. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Valida archivo fuera de `frontend/src` y ausencia en todas las listas de rutas activas. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Mantiene 42 paginas activas; `qa-results` y `.DS_Store` ausentes. |
| `cd frontend && npm run lint` | PASS con warnings | 0 errores y 636 warnings; sin variacion porque los redirects no aportaban warnings. |
| `cd frontend && npm run check` | PASS | Next mantiene 42 paginas. |
| `cd backend && npm test` | PASS | `node -c src/app.js`; sin cambios backend. |
| `python3 -m compileall -q ai-engine` | PASS | Sin errores; no hubo cambios AI Engine. |
| `bash scripts/env-check.sh` | WARN aceptado | Codigo 3; 46 WARN y 0 FAIL por variables locales no cargadas. |
| `bash -n scripts/qa/qa-official-surface.sh` | PASS | Sintaxis shell valida. |
| `git diff --check` | PASS | Sin errores de whitespace. |
