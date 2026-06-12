# Cleanup stage 1 inventory

Fecha: 2026-06-12  
Rama: `chore/cleanup-stage-1-inventory`  
Tipo: inventario no destructivo.

## Resumen ejecutivo

Se ejecuto un inventario estatico y no destructivo del repositorio para clasificar basura tecnica, funcional, documental, QA y superficies legacy. No se eliminaron archivos, no se movieron rutas, no se ejecuto SQL, no se leyeron `.env` reales, no se imprimieron secretos y no se reiniciaron servicios.

Los hallazgos principales son:

- `qa-results/` acumula 44 directorios, 718 archivos y 40M de evidencia historica. Es util como referencia, pero no deberia permanecer como carga permanente del repo salvo resumenes vigentes.
- Hay 2 rutas backend no montadas: `backend/src/routes/2evidences.routes.js` y `backend/src/routes/report.routes.js`.
- Hay varias duplicidades funcionales: `/api/kpi` + `/api/kpis`, `/api/diagnostic` + `/api/diagnostics`, `/dashboard` + `/dashboard-v2` + `/dashboard-kpi`, y multiples superficies IA.
- Existen rutas externas montadas antes del middleware global que dependen de auth local: Google OAuth, Zoho OAuth, Sync Agent y Auth. No son basura por si mismas, pero son P0 de revision de seguridad.
- Frontend ya oculta rutas internas cliente mediante `INTERNAL_CLIENT_HIDDEN_ROUTES`, pero esas paginas siguen existiendo y deben clasificarse como legacy/enterprise antes de eliminar.
- Se detectaron tres `.DS_Store` como candidatos de eliminacion.
- En SQL hay `DROP`/`DELETE FROM` en migraciones, seeds y `database/qa-fixes`. No se ejecutaron; los QA fixes deben revisarse por DBA antes de cualquier limpieza.

## Comandos ejecutados

| Comando | Resultado | Nota |
| ------- | --------- | ---- |
| `git status --short --branch` | PASS | Working tree limpio antes de iniciar. |
| `git checkout main && git pull --ff-only` | WARN | `pull` fallo por SSH `Permission denied (publickey)`; `main` local indicaba up-to-date con `origin/main`. |
| `git checkout -b chore/cleanup-stage-1-inventory` | PASS | Rama creada desde `main` local. |
| `find qa-results -type f` | PASS | Solo rutas; no contenido sensible. |
| `find . -name token.txt ...` | PASS | 0 `token.txt` detectados; no se leyo contenido. |
| `find backend/src/routes -name '*.js'` | PASS | 67 rutas backend detectadas. |
| `find frontend/src/app -path '*/page.tsx'` | PASS | 43 paginas frontend detectadas. |
| `rg ... Sidebar/AppLayout/mvpPermissions` | PASS | Confirmo rutas visibles y ocultas. |
| `rg '\b(DROP\|DELETE FROM\|TRUNCATE)\b' database --glob '*.sql'` | PASS | Hallazgos documentados; no se ejecuto SQL. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Script no destructivo creado y ejecutado. |

## Totales inspeccionados por categoria

| Categoria | Total | Evidencia |
| --------- | ----: | --------- |
| Archivos detectados por carpeta `backend` | 12961 | Incluye `node_modules`; conteo del script reproducible. |
| Archivos detectados por carpeta `frontend` | 26344 | Incluye `.next`/`node_modules`; conteo del script reproducible. |
| Archivos detectados por carpeta `ai-engine` | 101 | Codigo, knowledge y reportes IA. |
| Archivos detectados por carpeta `agent` | 3 | Agente sync local. |
| Archivos detectados por carpeta `database` | 68 | Migraciones, seeds, qa-fixes. |
| Archivos detectados por carpeta `docs` | 209 | Docs vigentes e historicos; incluye documentos de esta etapa tras crear `docs/cleanup`. |
| Archivos detectados por carpeta `scripts` | 85 | Incluye nuevo script de inventario. |
| Archivos detectados por carpeta `qa-results` | 718 | QA historico. |
| Rutas backend | 67 | `backend/src/routes/*.js`. |
| Rutas backend no montadas | 2 | `2evidences.routes.js`, `report.routes.js`. |
| Paginas frontend | 43 | `frontend/src/app/**/page.tsx`. |
| `.DS_Store` | 3 | Raiz, `database`, `docs`. |
| `token.txt` | 0 | Busqueda por metadata solamente. |
| ZIPs historicos | 0 | Fuera de `node_modules`/`.next`. |

## Tabla de clasificacion de candidatos

| Superficie | Ruta / modulo | Clasificacion | Riesgo | Evidencia | Accion recomendada | Requiere aprobacion |
| ---------- | ------------- | ------------- | ------ | --------- | ------------------ | ------------------- |
| QA historico | `qa-results/` | mover_fuera_del_repo | Medio | 44 dirs, 718 archivos, 40M | Conservar resumenes vigentes y mover respuestas completas a artifact store | Si |
| Posibles respuestas sensibles | `qa-results/**/*.response` | revisar_seguridad | P0/Medio | 133 archivos | Revisar y mover fuera del repo | Si |
| QA JSON historico | `qa-results/**/*.json` | mover_fuera_del_repo | Medio | 541 archivos | Mover fuera del repo salvo snapshots vigentes | Si |
| Tokens QA | `qa-results/**/token.txt` | revisar_seguridad | P0 | 0 detectados | Si aparecen, reportar solo metadata/hash | Si |
| Artefactos SO | `.DS_Store` | eliminar_candidato | Bajo | 3 archivos | Eliminar en etapa aprobada | No, salvo confirmar limpieza |
| Ruta backend no montada | `backend/src/routes/2evidences.routes.js` | mover_a_legacy | Bajo/medio | No montada por `app.js` | Cuarentenar tras busqueda de referencias | Si |
| Ruta backend no montada | `backend/src/routes/report.routes.js` | mover_a_legacy | Bajo/medio | No montada por `app.js` | Cuarentenar tras busqueda de referencias | Si |
| OAuth Google | `backend/src/routes/document-integrations-google.routes.js` | revisar_seguridad | P0 | Montada antes de auth global | Auditar auth local/callback/state | Si |
| OAuth Zoho | `backend/src/routes/document-integrations-zoho.routes.js` | revisar_seguridad | P0 | Montada antes de auth global | Auditar auth local/callback/state | Si |
| Sync Agent | `backend/src/routes/sync-agent.routes.js` | revisar_seguridad | P0 | Montada antes de auth global; bearer propio | Auditar pairing, token, upload y rate limit | Si |
| IA traces | `backend/src/routes/ai-traces.routes.js` | revisar_seguridad | P0 | Montada, RBAC deny esperado | Confirmar no expone contexto sensible | Si |
| External lookup | `backend/src/routes/ai-external-lookup.routes.js` | revisar_seguridad | P0 | Montada en `/api` y alias sin `/api` | Revisar cuotas, logging y exposicion | Si |
| Dashboard duplicado | `/dashboard-v2`, `/dashboard-kpi` | ocultar / duplicada_probable | Medio | Ocultas a cliente por AppLayout | Confirmar producto; migrar valor a `/dashboard` | Si |
| IA legacy/enterprise | `/ia`, `/ia-auditor`, `/auditorias/ia`, `/auditor-iso` | ocultar / revisar_con_producto | Medio | Ocultas a cliente; multiples superficies IA | Confirmar alcance MVP vs enterprise | Si |
| Documentos legacy | `/documentos` | legacy_probable | Medio | Oculta a cliente; solape con evidencias | Confirmar reemplazo por Evidence Library | Si |
| Command center legacy | `/centro-control-iso`, `/command-center-iso`, `/ejecucion-iso` | legacy_probable | Medio | Ocultas a cliente | Mover a legacy tras confirmacion | Si |
| SQL QA fixes | `database/qa-fixes/*.sql` | revisar_dba | Alto si se ejecuta mal | Contiene `DROP VIEW/TABLE` | Separar de migraciones normales | Si |
| Seeds con delete | `database/seeds/20260515_seed_ai_knowledge_iso9001_audit_documents.sql` | revisar_dba | Medio | `DELETE FROM ai_knowledge_*` | Confirmar idempotencia y entorno | Si |
| AI regression reports | `ai-engine/reports/*.json` | mover_a_legacy | Bajo/medio | Reportes historicos abril 2026 | Mover a legacy/artifact store | Si |
| Docs historicas | `docs/FASE_*.md`, docs legacy indexadas | mover_a_legacy | Bajo/medio | `docs/docs-index.md` marca historicas/legacy | Mantener index; no borrar sin scan | Si |
| Scripts patch | `scripts/patch_*.py` | legacy_probable | Medio | Parches puntuales historicos | Confirmar uso; mover a legacy | Si |
| Scripts validate fase | `scripts/validate-*` | legacy_probable/qa_manual | Bajo/medio | Muchos scripts por fases | Clasificar en manifest QA | Si |

## Riesgos criticos

- P0: cualquier `token.txt` futuro o respuesta QA con tokens debe salir del repo y tratarse como incidente de higiene.
- P0: rutas antes del middleware global deben tener pruebas explicitas de auth local y no depender solo de convencion.
- P0: trazas IA y lookup externo deben estar cerrados por RBAC/feature flags y sin secretos en logs.
- P1: rutas no montadas pueden eliminarse solo despues de confirmar que no se usan por imports externos, docs o scripts.
- P1: SQL en `qa-fixes` no debe mezclarse con migraciones normales.

## Quick wins de limpieza

1. Eliminar `.DS_Store` con aprobacion explicita.
2. Mover `qa-results` historico completo fuera del repo y conservar resumenes vigentes.
3. Cuarentenar `backend/src/routes/2evidences.routes.js` y `backend/src/routes/report.routes.js` tras dependency scan.
4. Clasificar scripts `patch_*.py` y `validate-*` en un manifest de vigencia.
5. Cerrar decision de producto sobre dashboard/IA legacy ocultos.

## Validaciones finales

| Comando | Resultado | Causa probable si no PASS | Bloquea etapa 1 |
| ------- | --------- | ------------------------- | --------------- |
| `git status --short --branch` | PASS | N/A | No |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | N/A | No |
| `cd backend && npm test` | PASS | N/A; el test actual solo compila `src/app.js` | No |
| `cd frontend && npm run lint` | PASS con 636 warnings | Deuda existente de `any`, hooks y variables no usadas | No |
| `cd frontend && npm run check` | PASS | N/A | No |
| `python3 -m compileall -q ai-engine` | PASS | N/A | No |
| `bash scripts/env-check.sh` | WARN, exit 3, 0 FAIL | Entorno local sin variables operativas cargadas; no se cargaron `.env` reales por seguridad | No |
| `git diff --check` | PASS | N/A | No |

## Acciones que NO se ejecutaron

- No se eliminaron archivos.
- No se movieron archivos.
- No se modifico logica de negocio.
- No se ejecutaron migraciones ni SQL.
- No se conecto a base de datos.
- No se leyeron `.env` reales.
- No se imprimieron secretos ni tokens.
- No se reiniciaron servicios.
- No se instalaron dependencias.

## Documentos relacionados

- `docs/cleanup/backend-route-surface.md`
- `docs/cleanup/frontend-route-surface.md`
- `docs/cleanup/qa-artifacts-and-sensitive-files.md`
- `docs/cleanup/cleanup-candidate-summary.md`
- `scripts/qa/qa-cleanup-stage-1-inventory.sh`
