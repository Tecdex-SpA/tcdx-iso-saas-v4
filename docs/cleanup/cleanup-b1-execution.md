# Cleanup B.1 execution

Fecha: 2026-06-12
Rama: `chore/cleanup-b1-legacy-quarantine`
Commit base: `39bee2e test: complete official mvp surface guard`

## Resumen ejecutivo

Se ejecuto una cuarentena acotada de legacy no critico. No se movieron scripts ni documentos por referencias vigentes/duda operativa. Se movieron 18 reportes IA historicos versionados desde `ai-engine/reports/` a `ai-engine/reports/_legacy/` sin abrir contenido JSON. Se documento readiness de frontend legacy para B.2 sin borrar paginas.

No se toco backend, DB, OAuth Google/Zoho, Sync Agent, IA traces, external lookup, `report.routes.js`, `reports.routes.js` ni la ruta legacy cuarentenada `2evidences.routes.js`.

## Archivos movidos

- `ai-engine/reports/ai_regression_multinorma_20260426_214754.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_214754.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_214806.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_214806.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_215034.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_215034.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_215241.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_215241.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_220628.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_220628.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_222010.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_222010.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_230659.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_230659.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_230916.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_230916.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_231125.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_231125.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_231342.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_231342.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_231557.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_231557.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_231756.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_231756.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_232010.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_232010.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_232140.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_232140.json`
- `ai-engine/reports/ai_regression_multinorma_20260426_232325.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260426_232325.json`
- `ai-engine/reports/ai_regression_multinorma_20260427_001757.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260427_001757.json`
- `ai-engine/reports/ai_regression_multinorma_20260427_130930.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260427_130930.json`
- `ai-engine/reports/ai_regression_multinorma_20260427_134323.json` -> `ai-engine/reports/_legacy/ai_regression_multinorma_20260427_134323.json`

## Archivos no movidos por duda

- Scripts `patch_*.py`: no movidos porque `docs/database/database-scripts-manifest.md` los referencia como repair/alto y requieren DBA/Backend.
- Scripts `validate-*` legacy: no movidos porque mantienen referencias entre scripts, docs FASE o manifiestos; varios pueden escribir datos o invocar IA.
- `docs/FASE_*.md`: no movidos porque moverlos requiere actualizar `docs/docs-index.md`, protegido en B.1, y algunos contienen contexto util para B.2.
- `docs/ai-auditor-history.md`: no movido porque aparece en `docs/runbooks-index.md`.
- `docs/ai-legacy-suggest-endpoints.md`: no movido porque `docs/docs-index.md` y `docs/cleanup/documentation-source-of-truth.md` lo referencian explicitamente.

## Scripts cuarentenados

Ninguno.

## Docs cuarentenados

Ninguno.

## Reportes IA movidos o diferidos

- Movidos: 18 JSON historicos de regresion multinorma a `ai-engine/reports/_legacy/`.
- Diferido: decision de sacar `ai-engine/reports/` completo del repo mediante `.gitignore` y resumen versionado.

## Frontend legacy readiness

Documentado en `docs/cleanup/frontend-legacy-removal-readiness.md`. Las rutas redirect son candidatas mas seguras para B.2; `/ejecucion-iso` y `/documentos` requieren decision de producto por acciones/generacion.

## Validaciones ejecutadas

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `git status --short --branch` | PASS | Rama correcta; cambios esperados de docs y renames de reportes IA. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Superficie MVP y ocultamiento no MVP conservados. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Tolera ausencia de `qa-results`. |
| `cd backend && npm test` | PASS | Ejecuta `node -c src/app.js`. |
| `cd frontend && npm run lint` | PASS con warnings | 636 warnings existentes, 0 errores. |
| `cd frontend && npm run check` | PASS | Build Next completo; 46 paginas generadas. |
| `python3 -m compileall -q ai-engine` | PASS | Tolera `reports/_legacy`; sintaxis Python valida. |
| `bash scripts/env-check.sh` | WARN aceptado | Exit 3; 46 WARN, 0 FAIL por variables locales no cargadas. |
| `git diff --check` | PASS | Sin whitespace errors. |

## Rollback

Para revertir la cuarentena de reportes IA:

```bash
for f in ai-engine/reports/_legacy/*.json; do git mv "$f" ai-engine/reports/; done
```

Para revertir documentacion B.1:

```bash
rm -f docs/cleanup/cleanup-b1-execution.md
rm -f docs/cleanup/scripts-quarantine-b1.md
rm -f docs/cleanup/docs-quarantine-b1.md
rm -f docs/cleanup/ai-reports-quarantine-b1.md
rm -f docs/cleanup/frontend-legacy-removal-readiness.md
```
