# Backend route quarantine - cleanup stage 2

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-2-controlled-cleanup`

| Ruta | Accion | Motivo | Referencias encontradas | Rollback |
| ---- | ------ | ------ | ----------------------- | -------- |
| `backend/src/routes/2evidences.routes.js` | Movida a `backend/src/routes/_legacy/2evidences.routes.js` | No esta montada por `backend/src/app.js`; no se encontraron imports/requires vivos en backend/frontend/scripts. | Referencias documentales e indices generados: `docs/sprint-0/*`, `docs/api/api-contract-current.md`, `docs/repo-cleanup-candidates.md`, `docs/cleanup/*`, `REPO_FILE_SIZES.txt`, `REPO_INDEX_COMPLETO.txt`. | `git mv backend/src/routes/_legacy/2evidences.routes.js backend/src/routes/2evidences.routes.js` |
| `backend/src/routes/report.routes.js` | `mantener_por_duda_operativa` | No esta montada por `backend/src/app.js`, pero documentacion vigente la marca explicitamente como no modificada/no borrar sin revision; reportes son core MVP y el riesgo de confusion con `reports.routes.js` amerita una etapa separada. | Referencias documentales a `report.routes.js`; referencias runtime/frontend/scripts apuntan a `/api/reports` y `reports.routes.js`. | No aplica; no fue movida. |

## Comandos de scan ejecutados

```bash
rg "2evidences\.routes|2evidences|routes/2evidences|require\(.+2evidences|from .+2evidences" backend frontend scripts docs package.json backend/package.json frontend/package.json || true
rg "2evidences" . --glob '!node_modules/**' --glob '!frontend/.next/**' --glob '!backend/node_modules/**' --glob '!frontend/node_modules/**' || true
rg "report\.routes|routes/report|require\(.+report\.routes|from .+report\.routes" backend frontend scripts docs backend/package.json frontend/package.json || true
rg "/api/report[^s]|api/report[^s]|report.routes|reports.routes|/api/reports" backend frontend scripts docs --glob '!node_modules/**' --glob '!frontend/.next/**' || true
```

## Decision

- Se aplico cuarentena reversible solo a `2evidences.routes.js`.
- `report.routes.js` permanece en su ubicacion original hasta resolver la duda operativa con producto/arquitectura y pruebas de reportes.
