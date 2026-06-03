# Sprint 0 - Inventario del repositorio

## Fuente y alcance
Inventario generado desde el working tree local en `/Users/andresbarouh/repos/tcdx-iso-saas`, rama `sprint-0-inventario-mvp`. No se eliminaron archivos ni se ejecutaron migraciones.

## Conteo por carpeta principal
| Carpeta | Archivos |
| --- | --- |
| agent | 3 |
| ai-engine | 101 |
| backend | 151 |
| database | 60 |
| deploy | 6 |
| docs | 96 |
| frontend | 126 |
| qa-results | 2146 |
| scripts | 79 |

## Carpetas críticas detectadas
- `backend/src/routes`: 62 archivos de rutas Express.
- `backend/src/services`: 39 servicios.
- `backend/src/controllers`: 4 controllers.
- `frontend/src/app`: 39 rutas App Router con `page.tsx`.
- `database/migrations`: 31 migraciones SQL.
- `database/seeds`: 15 seeds SQL.
- `database/qa-fixes`: 12 scripts SQL de QA/fix.
- `ai-engine`: FastAPI, knowledge base local, servicios RAG/LLM, rutas IA y scripts QA.
- `qa-results`: 2146 artefactos de pruebas versionados; alto volumen y posible exposición si contienen respuestas o tokens de QA.

## Módulos detectados
Dashboard, Dashboard V2, ciclo de vida, health, exportes/reportes, KPIs, diagnóstico, controles, evidencias, hallazgos, no conformidades, auditorías, IA Auditor, IA Compliance, riesgos/activos/SoA, perfil empresa, Admin SaaS, dealer/cotizador/prefacturación, Google/Zoho/document integrations, sync agent, base de conocimiento IA, trazas IA.

## Archivos potencialmente legacy o de limpieza
- `.DS_Store`
- `REPO_FILE_SIZES.txt`
- `REPO_INDEX_COMPLETO.txt`
- `docs/inventory-tcdx-20260526_1353.zip`
- `phase5b_atomic_apply.py`
- `qa-results/.DS_Store`
- `qa-results/ia-remote-deep-20260518_171742/token.txt`
- `qa-results/ia-remote-deep-fixed-20260518_173216/token.txt`
- `qa-results/ia-remote-deep-fixed-20260518_180022/token.txt`
- `qa-results/ia-remote-deep-fixed-20260518_191019/token.txt`
- `qa-results/tcdx-master-20260518_195847/token.txt`
- `qa-results/tcdx-master-20260519_121515/token.txt`
- `qa-results/tcdx-master-20260519_122603/token.txt`
- `qa-results/tcdx-master-20260519_134805/token.txt`
- `qa-results/tcdx-master-20260519_141431/token.txt`
- `qa-results/tcdx-master-20260519_142603/token.txt`
- `qa-results/tcdx-master-20260519_203131/token.txt`
- `qa-results/tcdx-master-20260519_203854/token.txt`
- `qa-results/tcdx-master-20260519_215928/token.txt`
- `qa-results/tcdx-master-20260520_090123/token.txt`
- `qa-results/tcdx-master-20260520_142448/token.txt`
- `qa-results/tcdx-master-20260520_170420/token.txt`
- `qa-results/tcdx-master-20260520_185034/token.txt`
- `qa-results/tcdx-master-20260522_115734/token.txt`
- `qa-results/tcdx-master-20260522_152824/token.txt`
- `qa-results/tcdx-master-20260525_102718/token.txt`
- `qa-results/tcdx-master-20260525_140558/token.txt`
- `qa-results/tcdx-master-20260525_184216/token.txt`
- `qa-results/tcdx-master-20260526_093515/token.txt`
- `qa-results/tcdx-master-20260526_093632/token.txt`
- `qa-results/tcdx-master-20260526_093643/token.txt`
- `qa-results/tcdx-master-20260526_103230/token.txt`
- `qa-results/tcdx-master-20260526_163123/token.txt`
- `qa-results/tcdx-master-20260526_173105/token.txt`
- `qa-results/tcdx-master-20260527_105518/token.txt`
- `qa-results/tcdx-master-20260527_111711/token.txt`

## Zips, dumps y artefactos pesados
- ZIP detectado: `docs/inventory-tcdx-20260526_1353.zip`.
- Dumps `.dump`, `.sql.gz`, `.tar.gz`: no detectados por patrón.
- PDFs/JSON/logs de QA: concentrados en `qa-results/**` y `ai-engine/reports/**`.
- Archivos `token.txt` en QA: 30; deben revisarse manualmente y no exponerse.

## Scripts de prueba y validación
Se detectaron 66 scripts de QA/validación/check bajo `scripts/`. Son útiles para regresión, pero algunos usan `eval` controlado para aserciones y varios dependen de variables de entorno reales.

## Duplicados potenciales
- `backend/src/routes/evidences.routes.js` y `backend/src/routes/2evidences.routes.js`: el segundo no aparece montado en `backend/src/app.js`.
- `backend/src/routes/reports.routes.js` y `backend/src/routes/report.routes.js`: `report.routes.js` no aparece montado.
- Frontend: `/dashboard`, `/dashboard-v2` y `/dashboard-kpi` conviven; `/dashboard-kpi` no aparece en navegación principal.
- Frontend: `/ia`, `/ia-compliance`, `/ia-auditor`, `/auditorias/ia`, `/auditor-iso` se superponen parcialmente en propuesta de valor IA.
- Frontend: `/centro-control-iso` y `/command-center-iso` parecen variantes de command center.

## Riesgos de limpieza
- Bajo: ZIP de inventario histórico en `docs/inventory-tcdx-20260526_1353.zip`, `.DS_Store`, reportes QA antiguos, tras validar que no son evidencia contractual.
- Medio: rutas/páginas huérfanas; requieren confirmar navegación, bookmarks y scripts QA.
- Alto: scripts SQL `database/qa-fixes` y migraciones con backups/drop de vistas; no eliminar ni ejecutar sin respaldo y revisión DBA.
