# Cleanup B.4 remove legacy redirects from App Router

Fecha: 2026-06-12
Rama: `chore/cleanup-b4-remove-legacy-redirects`
Commit base: `8251aa5 chore: decouple live references from legacy redirects`

## Resumen ejecutivo

Las cuatro paginas redirect desacopladas en B.3 fueron movidas con `git mv`
desde `frontend/src/app` hacia `frontend/src/legacy-pages`. Los archivos se
preservan para rollback, pero dejan de generar rutas activas en Next.

No se modificaron paginas MVP, backend, base de datos, AI Engine, agent,
integraciones ni scripts fuera del guard oficial.

## Movimientos

| Ruta legacy | Ubicación original | Nueva ubicación | Motivo | Build antes | Build después | Rollback |
| ----------- | ------------------ | --------------- | ------ | ----------- | ------------- | -------- |
| `/dashboard-kpi` | `frontend/src/app/dashboard-kpi` | `frontend/src/legacy-pages/dashboard-kpi` | Redirect desacoplado; superficie oficial `/dashboard`. | 46 paginas | 42 paginas | `git mv frontend/src/legacy-pages/dashboard-kpi frontend/src/app/dashboard-kpi` |
| `/centro-control-iso` | `frontend/src/app/centro-control-iso` | `frontend/src/legacy-pages/centro-control-iso` | Redirect desacoplado; superficie oficial `/dashboard`. | 46 paginas | 42 paginas | `git mv frontend/src/legacy-pages/centro-control-iso frontend/src/app/centro-control-iso` |
| `/command-center-iso` | `frontend/src/app/command-center-iso` | `frontend/src/legacy-pages/command-center-iso` | Redirect desacoplado; superficie oficial `/dashboard`. | 46 paginas | 42 paginas | `git mv frontend/src/legacy-pages/command-center-iso frontend/src/app/command-center-iso` |
| `/auditor-iso` | `frontend/src/app/auditor-iso` | `frontend/src/legacy-pages/auditor-iso` | Redirect desacoplado; superficie oficial `/cumplimiento-auditoria`. | 46 paginas | 42 paginas | `git mv frontend/src/legacy-pages/auditor-iso frontend/src/app/auditor-iso` |

## Guard

`scripts/qa/qa-official-surface.sh` exige para estas cuatro rutas:

- ausencia de `frontend/src/app/<ruta>/page.tsx`;
- presencia de `frontend/src/legacy-pages/<ruta>/page.tsx`;
- ausencia en la navegacion cliente MVP;
- ausencia de referencias vivas B.3.

Las validaciones de las 10 rutas MVP, IA Compliance, cuarentena backend,
`qa-results` y `.DS_Store` se conservan.

## Rollback general

```bash
git mv frontend/src/legacy-pages/dashboard-kpi frontend/src/app/dashboard-kpi
git mv frontend/src/legacy-pages/centro-control-iso frontend/src/app/centro-control-iso
git mv frontend/src/legacy-pages/command-center-iso frontend/src/app/command-center-iso
git mv frontend/src/legacy-pages/auditor-iso frontend/src/app/auditor-iso
```

Tambien se puede revertir el commit B.4 completo con `git revert <commit_b4>`.

## Validaciones

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Solo movimientos, guard y documentacion B.4 antes del commit. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Las 10 rutas MVP pasan y las cuatro rutas reportan `quarantined outside app router`. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Lista 42 paginas activas; `qa-results` y `.DS_Store` ausentes. |
| `cd frontend && npm run lint` | PASS con warnings | 0 errores y 636 warnings existentes. |
| `cd frontend && npm run check` | PASS | Next genero 42 paginas, cuatro menos que el build B.3. |
| `cd backend && npm test` | PASS | `node -c src/app.js`; sin cambios backend. |
| `python3 -m compileall -q ai-engine` | PASS | Sin errores; no hubo cambios AI Engine. |
| `bash scripts/env-check.sh` | WARN aceptado | Codigo 3; 46 WARN y 0 FAIL por variables locales no cargadas. |
| `bash -n scripts/qa/qa-official-surface.sh` | PASS | Sintaxis shell valida. |
| `git diff --check` | PASS | Sin errores de whitespace. |
