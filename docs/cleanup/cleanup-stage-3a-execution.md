# Cleanup stage 3A execution

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-3a-official-surface`
Commit base: `be10f25 chore: archive qa artifacts and hide non-mvp routes`

## Resumen ejecutivo

Se consolido la superficie oficial MVP cliente, se documentaron superficies backend/frontend, scripts y documentacion, y se agrego un QA no destructivo para impedir que rutas no MVP vuelvan a aparecer en navegacion cliente. No se eliminaron paginas ni rutas backend, no se ejecuto SQL, no se toco DB, OAuth, Zoho, Sync Agent ni IA runtime.

## Archivos creados

- `docs/product/official-frontend-surface.md`
- `docs/product/official-backend-surface.md`
- `docs/product/mvp-route-backend-map.md`
- `scripts/qa/qa-official-surface.sh`
- `docs/cleanup/scripts-manifest.md`
- `docs/cleanup/documentation-source-of-truth.md`
- `docs/adr/ADR-cleanup-stage-3a-official-surface.md`
- `docs/cleanup/cleanup-stage-3a-execution.md`

## Archivos modificados

- `frontend/src/utils/mvpPermissions.ts`

## Hallazgos

- `CLIENT_MVP_NAV_ITEMS` ya estaba limitado a rutas agregadoras.
- `MVP_ROUTE_RULES` todavia permitia rutas secundarias no MVP cliente; se corrigio para mantener solo rutas oficiales y perfil/configuracion.
- Rutas no MVP cliente ahora se controlan por `INTERNAL_CLIENT_HIDDEN_ROUTES`, `PLATFORM_ROUTES` o `DEALER_ROUTES`.
- `report.routes.js` sigue como unica ruta backend no montada fuera de `_legacy`; queda `requires_review`.
- `qa-results/` sigue fuera del repo y no versionado.

## Candidatos para Opcion B posterior

1. Eliminar o mover paginas legacy ocultas: `/ia`, `/auditor-iso`, `/centro-control-iso`, `/command-center-iso`, `/ejecucion-iso`, `/documentos`.
2. Resolver eliminacion/cuarentena de `backend/src/routes/report.routes.js`.
3. Consolidar `/dashboard-v2` y `/dashboard-kpi` en `/dashboard`.
4. Consolidar `/plan-accion` y `/acciones-recomendadas` en `/planes-accion`.
5. Consolidar `/matriz-riesgo` y `/activos` en `/riesgos`.
6. Clasificar scripts `validate-*` legacy.
7. Mover docs `FASE_*`/legacy a carpeta historica si producto lo aprueba.

## Riesgos pendientes

- OAuth Google/Zoho y Sync Agent siguen diferidos por seguridad.
- IA traces y external lookup siguen diferidos.
- `database/qa-fixes` y seeds con `DELETE FROM` requieren DBA.
- Frontend mantiene 636 warnings existentes.
- Runtime no fue probado con DB real por alcance de seguridad.

## Validaciones

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Rama correcta; cambios esperados de docs, script QA y permisos MVP. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Tolera ausencia de `qa-results` y no imprime secretos. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Superficie cliente MVP y ocultamiento no MVP verificados. |
| `cd backend && npm test` | PASS | Test actual ejecuta `node -c src/app.js`. |
| `cd frontend && npm run lint` | PASS con warnings | 636 warnings existentes, 0 errores. |
| `cd frontend && npm run check` | PASS | Next build completo, 46 paginas generadas. |
| `python3 -m compileall -q ai-engine` | PASS | Sintaxis Python valida. |
| `bash scripts/env-check.sh` | WARN aceptado | Exit 3; 46 WARN, 0 FAIL por variables locales no cargadas. |
| `git diff --check` | PASS | Sin whitespace errors. |

## Rollback

```bash
git checkout chore/cleanup-stage-2-controlled-cleanup -- frontend/src/utils/mvpPermissions.ts
rm -f scripts/qa/qa-official-surface.sh
rm -f docs/product/official-frontend-surface.md docs/product/official-backend-surface.md docs/product/mvp-route-backend-map.md
rm -f docs/cleanup/scripts-manifest.md docs/cleanup/documentation-source-of-truth.md docs/cleanup/cleanup-stage-3a-execution.md
rm -f docs/adr/ADR-cleanup-stage-3a-official-surface.md
```
