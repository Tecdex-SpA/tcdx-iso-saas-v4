# Cleanup stage 2 execution

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-2-controlled-cleanup`
Commit base: `4c35890 docs: inventory cleanup candidates and runtime surface`

## Resumen ejecutivo

Se ejecuto una limpieza controlada y reversible sobre basura segura, artefactos QA historicos, una ruta backend no montada y ocultamiento frontend no MVP. No se ejecutaron migraciones, no se conecto a DB, no se leyeron `.env`, no se imprimieron secretos, no se tocaron OAuth Google/Zoho ni Sync Agent, y no se eliminaron paginas frontend.

## Cambios realizados

| Area | Cambio | Resultado |
| ---- | ------ | --------- |
| Basura segura | Eliminados `./.DS_Store`, `./database/.DS_Store`, `./docs/.DS_Store` | Confirmado: no quedan `.DS_Store` fuera de rutas ignoradas. |
| `.gitignore` | Normalizada linea corrupta de `ai-engine/.env\\n...`; reglas requeridas ya estaban presentes | `.DS_Store`, `*.log`, `.env`, `.env.*`, `!.env.example`, `qa-results/` quedan cubiertas. |
| QA historico | Movido `qa-results/` fuera del repo | Archivado en `/Users/andresbarouh/repos/tcdx-iso-saas-archive/qa-results-archive/qa-results-20260612_103953`. |
| Backend | `backend/src/routes/2evidences.routes.js` movida a `_legacy` | Cuarentena reversible con `git mv`. |
| Backend | `backend/src/routes/report.routes.js` evaluada | No se movio por duda operativa documentada. |
| Frontend | `/health` retirada de `MVP_ROUTE_RULES` y agregada a `INTERNAL_CLIENT_HIDDEN_ROUTES` | Cliente tenant no platform/no dealer queda bloqueado por AppLayout como ruta interna. |
| Documentacion | Agregados docs de etapa 2, rollback y diferimientos | Completo. |

## Archivos eliminados

| Archivo | Motivo | Rollback |
| ------- | ------ | -------- |
| `./.DS_Store` | Basura de sistema operativo | Restaurar desde Git si estuviera versionado o regenerar desde backup local; no requerido para runtime. |
| `./database/.DS_Store` | Basura de sistema operativo | Igual anterior. |
| `./docs/.DS_Store` | Basura de sistema operativo | Igual anterior. |

## Archivos movidos fuera del repo

| Origen | Destino | Metadata | Rollback |
| ------ | ------- | -------- | -------- |
| `qa-results/` | `/Users/andresbarouh/repos/tcdx-iso-saas-archive/qa-results-archive/qa-results-20260612_103953` | 44 directorios, 718 archivos, 40M, 0 `token.txt` | `mv /Users/andresbarouh/repos/tcdx-iso-saas-archive/qa-results-archive/qa-results-20260612_103953 /Users/andresbarouh/repos/tcdx-iso-saas/qa-results` |

## Rutas cuarentenadas

| Ruta | Nueva ubicacion | Motivo | Rollback |
| ---- | --------------- | ------ | -------- |
| `backend/src/routes/2evidences.routes.js` | `backend/src/routes/_legacy/2evidences.routes.js` | No montada y sin referencias runtime vivas | `git mv backend/src/routes/_legacy/2evidences.routes.js backend/src/routes/2evidences.routes.js` |

## Rutas no cuarentenadas por duda

| Ruta | Motivo |
| ---- | ------ |
| `backend/src/routes/report.routes.js` | Aunque no esta montada, hay documentacion vigente que la menciona como no modificada/no borrar sin revision. Reportes son core MVP y `reports.routes.js` tiene muchos consumidores; se deja para decision separada. |

## Cambios no realizados

- No se movio `report.routes.js`.
- No se tocaron OAuth Google/Zoho.
- No se toco Sync Agent.
- No se tocaron IA traces ni external lookup.
- No se toco `database/qa-fixes`.
- No se editaron seeds SQL.
- No se eliminaron paginas frontend.
- No se instalaron dependencias.
- No se reiniciaron servicios.

## Validaciones

| Momento | Comando | Resultado | Observacion |
| ------- | ------- | --------- | ----------- |
| Antes | `git status --short --branch` | PASS | Rama limpia al iniciar. |
| Antes | `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Detectaba `qa-results`: 44 dirs, 718 archivos. |
| Antes | `cd backend && npm test` | PASS | Test actual compila `src/app.js`. |
| Antes | `cd frontend && npm run lint` | PASS con 636 warnings | Warnings existentes. |
| Antes | `cd frontend && npm run check` | PASS | Build Next exitoso. |
| Antes | `python3 -m compileall -q ai-engine` | PASS | Sintaxis Python valida. |
| Antes | `bash scripts/env-check.sh` | WARN, 0 FAIL | Variables locales no cargadas; aceptado para esta etapa. |
| Antes | `git diff --check` | PASS | Sin whitespace errors. |
| Despues | `git status --short --branch` | PASS | Solo cambios esperados de etapa 2. |
| Despues | `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Tolera ausencia de `qa-results`; reporta `qa-results not found`; solo queda `report.routes.js` como ruta no montada. |
| Despues | `cd backend && npm test` | PASS | Test actual compila `src/app.js`. |
| Despues | `cd frontend && npm run lint` | PASS con 636 warnings | Warnings existentes; sin errores. |
| Despues | `cd frontend && npm run check` | PASS | Build Next exitoso. |
| Despues | `python3 -m compileall -q ai-engine` | PASS | Sintaxis Python valida. |
| Despues | `bash scripts/env-check.sh` | WARN, 0 FAIL | Variables locales no cargadas; aceptado para esta etapa. |
| Despues | `git diff --check` | PASS | Sin whitespace errors. |

## Rollback general

```bash
git checkout chore/cleanup-stage-1-inventory -- .gitignore frontend/src/utils/mvpPermissions.ts
git mv backend/src/routes/_legacy/2evidences.routes.js backend/src/routes/2evidences.routes.js
mv /Users/andresbarouh/repos/tcdx-iso-saas-archive/qa-results-archive/qa-results-20260612_103953 /Users/andresbarouh/repos/tcdx-iso-saas/qa-results
```

Para revertir todo desde Git despues del commit:

```bash
git revert <commit-stage-2>
mv /Users/andresbarouh/repos/tcdx-iso-saas-archive/qa-results-archive/qa-results-20260612_103953 /Users/andresbarouh/repos/tcdx-iso-saas/qa-results
```
