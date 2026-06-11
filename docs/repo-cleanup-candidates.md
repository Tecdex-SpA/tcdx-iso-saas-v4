# Repo Cleanup Candidates

Fecha: 2026-06-11
Sprint: Sprint 3 - Gobernanza, documentacion y limpieza controlada
Estado: candidatos P3 documentados; sin remocion.

## Objetivo

Documentar candidatos de limpieza P3 del repositorio sin ejecutar cambios
destructivos: dependencias duplicadas, outputs IA versionados, artefactos de
apoyo, rutas legacy/no montadas, scripts repair/rollback y temporales.

## Alcance

Este documento es inventario y criterio de decision. No autoriza borrar,
mover, desinstalar, actualizar paquetes, ejecutar scripts ni modificar rutas.

Regla principal: **no remover sin pruebas y aprobacion**.

## Metodologia de clasificacion

- Revisar manifests, rutas, scripts y docs con inspeccion estatica.
- Usar evidencia de uso por `package.json`, `require/import`, mounts en
  `backend/src/app.js`, docs vigentes y nombres/rutas.
- Cuando el proposito no sea comprobable, marcar como inferido por ruta o
  requiere revision manual.
- Separar decision documental de accion tecnica.
- Definir pruebas requeridas antes de cualquier limpieza real.
- Mantener compatibilidad multi-tenant, demo/piloto y trazabilidad.

## Resumen de decisiones

| Categoria | Decision inicial |
|---|---|
| Dependencias duplicadas | Mantener; revisar unificacion post-Sprint 3 con pruebas. |
| Moderate advisories | Mantener sin `npm audit fix --force`; revisar upgrades por separado. |
| Outputs IA versionados | Mantener hasta confirmar si son fixtures, evidencia o regresion. |
| Rutas legacy/no montadas | Mantener; no borrar sin dependency scan backend/frontend/docs/scripts. |
| Scripts repair/rollback/qa-fixes | Mantener; no ejecutar sin aprobacion y backup cuando aplique. |
| Temporales ignorados | No versionar; limpieza local opcional fuera de este bloque. |
| Binarios/vendor en `node_modules` | No tocar; no son candidatos de repo mientras sean dependencias instaladas. |

## Matriz de candidatos

| Candidato | Ubicacion | Evidencia de uso | Riesgo de remover | Decision inicial | Pruebas requeridas | Prioridad |
|---|---|---|---|---|---|---|
| `bcrypt` / `bcryptjs` | `backend/package.json`; `backend/src/services/auth.service.js`; `backend/src/routes/user.routes.js`; `backend/src/routes/users.routes.js` | `auth.service.js` usa `bcrypt`; rutas de usuarios usan `bcryptjs`. | Alto: login, hash verification, creacion de usuarios y compatibilidad nativa pueden romperse. | Mantener; unificar luego solo con pruebas de auth completas. | `cd backend && npm test`; `npm run check`; login; cambio/creacion de usuario; smoke auth; validacion deploy en host. | P3 |
| `puppeteer` / `puppeteer-core` | `backend/package.json`; `backend/src/reports/services/htmlPdfRenderer.service.js`; docs de PDF/Chrome externo | Runtime de render usa `puppeteer-core`; docs citan Chrome externo. | Alto: render PDF/reportes puede fallar por binario Chrome, sandbox o path. | Mantener; revisar despues si `puppeteer` completo es redundante. | Generacion PDF de reportes; smoke report exports; verificacion Chrome path; backend test/check. | P3 |
| `googleapis` / `googleapis-common` / `gaxios` / `uuid` | `backend/package.json`; integraciones Google; audit Sprint 2 | `googleapis` esta declarado y docs Sprint 2 registran moderate advisories en cadena `googleapis`/`uuid`. | Medio/alto: OAuth, Drive/Sheets, evidence library y document integrations pueden romperse. | Mantener; upgrade controlado posterior, sin force fix. | OAuth/connect; sync Google; evidence library; backend test/check; audit; QA document-source. | Post-Sprint 3 |
| `next` / `postcss` | `frontend/package.json`; audit Sprint 2 | Docs Sprint 2 registran moderate advisories `next`/`postcss` sin critical/high. | Medio: upgrade puede afectar build, App Router, middleware, CSS y navegacion demo. | Mantener; revisar upgrade en bloque frontend dedicado. | `cd frontend && npm run build`; `npm run lint`; E2E demo; smoke rutas oficiales. | Post-Sprint 3 |
| Dependencias PDF/Office auxiliares | `backend/package.json`; servicios de reportes/uploads | Uso inferido por rutas de reportes, documentos y uploads; requiere dependency scan. | Medio: remover puede romper conversion, parsing o exportaciones. | Mantener; documentar revision posterior. | `rg` de imports; report exports; upload parsing; backend test/check. | P3 |
| Outputs IA regression | `ai-engine/reports/*.json` | 18 JSON versionados con nombre `ai_regression_multinorma_*`. | Medio: pueden ser fixtures, evidencia de regresion o baseline de QA. | Mantener hasta clasificar origen, consumidor y politica de retencion. | `rg "ai_regression_multinorma|ai-engine/reports"`; pruebas IA; comparacion de baseline; aprobacion owner IA. | P3 |
| Prompts/knowledge IA | `ai-engine/prompts`; `ai-engine/knowledge`; rutas relacionadas | 33 archivos knowledge/prompts detectados en diagnostico. | Alto: mover o borrar altera respuestas IA y gobernanza. | No accion; no tratar como limpieza sin plan IA. | Regression prompts; revision humana; trazabilidad de fuente; AI governance. | No accion |
| `2evidences.routes.js` | `backend/src/routes/2evidences.routes.js` | Existe en repo; no montado en `backend/src/app.js`; ya documentado en contrato API Sprint 2. | Medio/alto: puede ser referencia legacy o rollback informal. | Mantener; no borrar sin dependency scan. | `rg "2evidences|evidences.routes"` en backend/frontend/scripts/docs; smoke evidencias; revision rollback. | P3 |
| `report.routes.js` | `backend/src/routes/report.routes.js` | Existe en repo; no montado para `/api/reports`; `reports.routes.js` es el route real. | Medio/alto: posible legado de reportes, referencia docs o fallback. | Mantener; no borrar sin dependency scan. | `rg "report.routes|reports.routes"`; QA reports RBAC; E2E exportes; revision frontend consumidores. | P3 |
| Rollback SQL operacional | `database/qa-fixes/20260513_rollback_iso_operational_links.sql` | Nombre/ruta indican rollback; manifest DB/QA lo marca como no ejecutar sin aprobacion. | Critico: puede revertir datos operacionales o relaciones ISO. | Mantener; no ejecutar. | Backup previo; ambiente controlado; dry-run si aplica; aprobacion DBA/owner. | No accion |
| QA-fixes SQL | `database/qa-fixes/*.sql` | Archivos fix/refresh bajo `database/qa-fixes`. | Alto/critico: pueden alterar DB, KPIs, enlaces, salud ISO o datos tenant. | Mantener; no ejecutar sin aprobacion. | Backup; revision SQL; entorno lab/demo; validaciones post-ejecucion; rollback probado. | No accion |
| Repair scripts Python | `scripts/patch_*.py` | Nombres indican patch de evidencias, controles, workbench y scope operacional. | Alto: pueden modificar archivos o datos; requiere entender entradas. | Mantener; no ejecutar sin aprobacion. | Revision de codigo; entorno controlado; backup; smoke funcional del modulo afectado. | No accion |
| Backup/restore test | `scripts/restore-test.sh` | Nombre indica restore test; cubierto por runbook/manifest. | Alto: operaciones de restore pueden pisar datos si se ejecutan mal. | Mantener; ejecutar solo bajo gate backup/restore aprobado. | Runbook; ambiente aislado; backup identificado; validacion restore; aprobacion operativa. | No accion |
| Temporales `.DS_Store` | `.DS_Store`; `database/.DS_Store`; `docs/.DS_Store` | Detectados localmente e ignorados; no versionados. | Bajo si no se versionan; ruido operacional. | No versionar; limpieza local opcional fuera de este bloque. | `git status --short`; escaneo de artefactos antes de commit. | No accion |
| Temporales editor | `*.swp`; `*~` | No deben versionarse; buscar antes de commits. | Bajo/medio: pueden filtrar contenido local o ensuciar diffs. | No versionar; limpiar solo con aprobacion si aparecen. | `find . -name "*.swp" -o -name "*~"`; `git status --short`. | No accion |
| QA results | `qa-results/` | Directorio generado por suites QA Sprint 1/2. | Medio: puede contener endpoints, IDs, trazas o evidencia runtime. | No versionar; mantener ignorado. | `git ls-files qa-results`; escaneo secretos/artefactos antes de commit. | No accion |
| Backups, dumps, llaves, certificados | `*.sql`, `*.dump`, `*.backup`, `*.pem`, `*.key`, `*.p12`, `*.pfx` fuera de rutas permitidas | No deben versionarse salvo SQL de repo ya clasificado. | Critico: fuga de datos o secretos. | No versionar; reportar ruta/tipo sin valor si aparece. | Escaneo antes de commit; secret hygiene; aprobacion si requiere excepcion. | No accion |
| ZIP/vendor fixtures en dependencias instaladas | `backend/node_modules/mammoth/test/test-data/*.zip`; `backend/node_modules/pdfkit/.yarn/install-state.gz` | Detectados bajo `node_modules`, no como fuente del repo. | Bajo para repo; tocar `node_modules` no limpia la fuente y puede romper instalacion local. | No accion; no versionar `node_modules`. | `git status --short`; confirmar `node_modules` no staged. | No accion |

## Dependencias duplicadas o candidatas

### `bcrypt` / `bcryptjs`

Estado actual inferido:

- `bcrypt` esta declarado en backend y es usado por `auth.service.js`.
- `bcryptjs` esta declarado en backend y es usado por rutas de usuarios.

Riesgo:

- Cambiar una libreria por otra puede alterar compatibilidad de hashes, tiempos,
  dependencias nativas y comportamiento de tests/auth.

Decision:

- Mantener ambos en Sprint 3.
- Unificacion futura solo con pruebas de login, registro/creacion de usuario,
  cambio de password, seeds/demo y validacion en el host objetivo.

### `puppeteer` / `puppeteer-core`

Estado actual inferido:

- `puppeteer-core` aparece en servicio de render HTML/PDF.
- `puppeteer` completo tambien esta en manifest backend.
- La documentacion operacional menciona Chrome externo/headless.

Riesgo:

- Remover el paquete equivocado puede romper exportes PDF o reportes de demo.

Decision:

- Mantener ambos hasta confirmar runtime de render, path de Chrome y empaquetado
  esperado en deploy.

### Moderate advisories

Estado:

- Backend mantiene advisories moderate asociados a cadena `googleapis`/`uuid`.
- Frontend mantiene advisories moderate asociados a `next`/`postcss`.
- No hay evidencia aceptada de critical/high en Sprint 2.

Decision:

- No aplicar `npm audit fix --force`.
- No hacer upgrades mayores dentro de limpieza P3.
- Abrir bloque posterior si el analisis demuestra exposicion directa o fix
  compatible.

## Outputs IA versionados

Los 18 JSON bajo `ai-engine/reports/*.json` se mantienen. Por nombre parecen
outputs de regresion multinorma, pero la decision de moverlos, excluirlos o
convertirlos en fixtures requiere confirmar:

- si algun test/script los consume;
- si son evidencia historica;
- si contienen datos reales o sinteticos;
- si deben vivir en repo, storage externo o artefacto CI;
- politica de retencion y sanitizacion.

No mover ni borrar en Sprint 3 sin aprobacion.

## Rutas legacy/no montadas

`backend/src/routes/2evidences.routes.js` y `backend/src/routes/report.routes.js`
existen pero no estan montadas como rutas activas segun el contrato Sprint 2.
Siguen siendo candidatos P3 de revision, no de borrado.

Antes de remover cualquier ruta legacy:

- buscar referencias en backend, frontend, scripts, docs y tests;
- confirmar mounts reales en `backend/src/app.js`;
- validar que no sea fallback operacional;
- definir rollback;
- ejecutar smoke y suites Sprint 2 afectadas.

## Scripts legacy, repair y rollback

Los scripts SQL bajo `database/qa-fixes`, los rollback y los scripts `patch_*`
se mantienen. La clasificacion operativa vive en
`docs/database/database-scripts-manifest.md`.

Reglas:

- No ejecutar sin aprobacion explicita.
- Backup previo obligatorio cuando alteren DB, uploads, tenants, permisos o
  produccion.
- No tratarlos como limpieza hasta confirmar dependencias y plan de rollback.

## Temporales y artefactos locales

`.DS_Store`, `.swp`, `*~`, `qa-results/`, dumps, backups, llaves y certificados
no deben versionarse. Si aparecen antes de commit, reportar ruta y tipo sin
imprimir contenido sensible.

Los `.DS_Store` locales detectados no bloquean mientras permanezcan ignorados y
fuera de staging.

## Criterios antes de cualquier remocion futura

1. Dependency scan backend/frontend/scripts/docs/tests.
2. Evidencia de no uso o reemplazo activo.
3. Plan de rollback.
4. Pruebas unitarias/build/lint correspondientes.
5. QA runtime si toca rutas demo/piloto, reportes, evidencias, tenant path o
   auth.
6. Escaneo de secretos y artefactos.
7. Aprobacion explicita del owner.

## Riesgos residuales

- Las dependencias duplicadas siguen instaladas hasta unificacion futura.
- Los advisories moderate quedan documentados, no corregidos.
- Los outputs IA requieren clasificacion de fixture/evidencia/regresion.
- Las rutas legacy/no montadas siguen presentes para compatibilidad y rollback.
- Los scripts repair/rollback siguen disponibles y requieren disciplina
  operativa para no ejecutarse fuera de gate.
- Los temporales locales deben revisarse antes de cada commit.
