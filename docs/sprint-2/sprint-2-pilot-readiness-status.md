# Sprint 2 - Pilot Readiness Status

Fecha: 2026-06-11
Sprint: P1 de control de rutas, permisos y demo/piloto
Rama: `feature/pilot-readiness-p1`
Base: `c1463e0`

## Objetivo

Estabilizar la plataforma para una demo comercial repetible y un piloto con
usuarios reales controlados, con rutas gobernadas, permisos trazables,
aislamiento tenant verificable y configuracion de entorno fail-fast.

## Estado actual

- Diagnostico Sprint 2 completado.
- Documentacion contractual S2-01 a S2-06 completada.
- Bloque 2 de RBAC reportes implementado en backend.
- Bloque 3 de tenant path implementado.
- Bloque 4 de E2E minima API-based implementado.
- Bloque 5 de env fail-fast implementado.
- Gating de navegacion frontend implementado en Bloque 6.
- Sin migraciones ejecutadas.
- Cuatro commits de implementacion creados; este documento se prepara para el
  commit contractual final.
- Working tree estaba limpio al iniciar el bloque.

## Estado por item

| Item | Objetivo | Estado | Evidencia o siguiente gate |
|---|---|---|---|
| S2-01 | Separar permisos de reportes | Completado | Enforcement backend y QA runtime PASS; viewer/export real quedan SKIP aceptados por falta de datos opcionales. |
| S2-02 | Inventario contractual API | Completado | 70 mounts, 65 route files unicos y aproximadamente 470 declaraciones clasificados en `docs/api/api-contract-current.md`. |
| S2-03 | Validar endpoints `/:tenant_id` | Completado | Tenant path P1 PASS 16, FAIL 0, SKIP 4 contra endpoint final. |
| S2-04 | E2E minima | Completado | E2E API-based PASS 8, FAIL 0, SKIP 6 contra endpoint final. |
| S2-05 | Rutas oficiales demo/piloto | Completado en codigo | Sidebar, AppLayout y permisos MVP alineados; smoke visual por rol queda como riesgo residual. |
| S2-06 | Env fail-fast | Completado en codigo | Gate por perfil/capa y contratos `.env.example` implementados; falta adopcion en deploy real. |

## Entregables del Bloque 1

- `docs/api/api-contract-current.md`
- `docs/security/rbac-route-matrix.md`
- `docs/demo/official-demo-routes.md`
- `docs/sprint-2/sprint-2-pilot-readiness-status.md`

Estos documentos fijan el contrato vigente y registran la implementacion y las
validaciones ejecutadas durante Sprint 2.

## Riesgos abiertos

### Actualizacion remota

`git pull origin main` fallo por autenticacion SSH. No bloquea el Bloque 1
mientras `main` y `origin/main` locales coincidan en `c1463e0`, pero queda como
pendiente operativo antes de publicar o integrar cambios.

### Viewer puede superar el gate POST de reportes

Mitigado en backend: viewer recibe `403` para generacion y administracion de
reportes. La navegacion fue alineada en Bloque 6; queda pendiente un smoke
visual con `VIEWER_TOKEN` para confirmar los controles internos de `/exportes`.

### Descarga por `requested_by`

Mitigado en backend: para usuarios tenant se exige coincidencia entre el tenant
JWT y `report_exports.tenant_id`. `requested_by` ya no funciona como bypass.

### Objectives fuera de cobertura tenant path central

`GET /api/objectives/:tenant_id` conserva su validacion local y desde Bloque 3
tambien aparece en los patrones centrales de `tenantScope.middleware.js`.
La prueba cross-tenant automatizada paso contra el endpoint final.

### Env check fail-fast

Mitigado en Bloque 5: el script distingue perfiles/capas, no imprime valores y
bloquea pilot/production ante faltantes criticos, secretos inseguros y URLs
publicas locales. Queda pendiente integrarlo al procedimiento de arranque/deploy.

## Validaciones

| Validacion | Estado |
|---|---|
| Inspeccion de branch y base | PASS |
| Diagnostico estatico de mounts, rutas y permisos | PASS |
| Mount real `/api/reports` | PASS: `reports.routes.js` |
| Enforcement backend S2-01 | PASS local y runtime |
| Migraciones | No ejecutadas |
| Backend `npm test` | PASS |
| Backend `npm run check` | PASS |
| Backend `npm audit --omit=dev` | WARN: 0 critical, 0 high, 5 moderate |
| `bash -n scripts/qa-reports-rbac-p1.sh` | PASS |
| Matriz simulada del middleware RBAC de reportes | PASS |
| Mount real `/api/objectives` | PASS: `objectives.routes.js` |
| Cobertura central `/api/objectives/:tenant_id` | PASS local y runtime; cross-tenant `403/404` |
| Matriz aislada tenant scope de objectives | PASS |
| `bash -n scripts/qa-tenant-path-p1.sh` | PASS |
| Frontend `npm run build` | PASS; 46 rutas compiladas, incluidas legacy/ocultas |
| Frontend `npm run lint` | PASS con 636 warnings y 0 errores |
| Frontend `npm audit --omit=dev` | WARN: 0 critical, 0 high, 2 moderate |
| AI Engine `python3 -m py_compile main.py` | PASS con cache temporal |
| AI Engine `python3 -m compileall app` | PASS con cache temporal |
| `bash -n scripts/qa-e2e-minimal.sh` | PASS |
| Endpoint runtime final | `https://tcdx-iso.tecdex.net` |
| QA reports RBAC runtime | PASS 3, FAIL 0, SKIP 3 |
| QA tenant path runtime | PASS 16, FAIL 0, SKIP 4 |
| QA E2E runtime | PASS 8, FAIL 0, SKIP 6 |
| QA cross-tenant core runtime | PASS 44, FAIL 0, SKIP 2 |
| `bash -n scripts/env-check.sh` | PASS |
| `bash scripts/env-check.sh --help` | PASS; exit `0` |
| Env check demo local incompleto | PASS del contrato WARN; exit `3` |
| Env check production local incompleto | PASS del fail-fast; exit `2` |
| Env check production sintetico valido | PASS; exit `0` |
| Env check production con localhost/secret trivial | PASS del fail-fast; exit `2` |
| Escaneo candidatos: JWT/Bearer/private keys | PASS: sin hallazgos |
| `.env` reales o `qa-results` versionados | PASS: ninguno |
| Artefactos temporales versionables | PASS; tres `.DS_Store` locales ignorados |
| `git diff --check` | PASS |

## Pendientes antes de piloto real

- Proveer `VIEWER_TOKEN` para evitar SKIP del bloqueo de generacion.
- Proveer `REPORT_EXPORT_ID` de Tenant A para evitar SKIP de descargas.
- Proveer `EVIDENCE_ID` y `EXPIRED_TOKEN` para completar checks opcionales.
- Confirmar visualmente S2-05 con roles plataforma, dealer, admin, operativo y viewer.
- Integrar `scripts/env-check.sh` en el procedimiento de deploy antes de piloto/production.
- Resolver o verificar el acceso SSH al remoto antes de push o PR.

## Archivos Bloque 2

- `backend/src/middleware/rbac.middleware.js`
- `backend/src/routes/reports.routes.js`
- `scripts/qa-reports-rbac-p1.sh`
- `docs/security/rbac-route-matrix.md`
- `docs/sprint-2/sprint-2-pilot-readiness-status.md`

## Riesgos residuales Bloque 2

- QA runtime base cerrada con FAIL 0; los checks opcionales sin datos quedan
  como SKIP aceptados.
- Sin `VIEWER_TOKEN`, el bloqueo runtime real de viewer queda `SKIP`.
- Sin `REPORT_EXPORT_ID`, aislamiento runtime de descarga queda `SKIP`.
- Los controles internos de `/exportes` requieren smoke visual por rol, aunque
  el backend ya bloquee operaciones no autorizadas.
- `report_access_rules` sigue sin columnas independientes para download/admin;
  el enforcement vive en codigo.

## Archivos Bloque 3

- `backend/src/middleware/tenantScope.middleware.js`
- `scripts/qa-tenant-path-p1.sh`
- `docs/api/api-contract-current.md`
- `docs/sprint-2/sprint-2-pilot-readiness-status.md`

`backend/src/routes/objectives.routes.js` fue revisado pero no modificado:
mantiene una validacion local suficiente como segunda barrera.

## Riesgos residuales Bloque 3

- La QA runtime Tenant A/Tenant B paso contra el endpoint final.
- Operations/scope de tenant standards, SoA y lifecycle board quedan `SKIP`
  porque sus GET ejecutan bootstrap o reconstrucciones con escritura implicita.
- Dealer conserva el bypass central existente y depende de la autorizacion
  especifica de cada ruta; objectives no agrega soporte dealer nuevo.

## Archivos Bloque 4

- `scripts/qa-e2e-minimal.sh`
- `docs/demo/official-demo-routes.md`
- `docs/sprint-2/sprint-2-pilot-readiness-status.md`

## Criterios E2E Bloque 4

- Flujo autorizado: session, dashboard, evidences, reports/exports y health
  deben responder `200`.
- Token expirado o invalido debe responder `401/403`.
- Viewer puede leer reportes same-tenant y no puede generar (`403/404`).
- Descargas quedan `SKIP` si no se entregan IDs funcionales.
- Logout queda `SKIP`: no existe endpoint backend identificado y no se invalida
  un token compartido.
- Todo `500` y todo `401/403` inesperado en el flujo autorizado cuentan como
  `FAIL`.
- El resumen se guarda sin tokens ni cuerpos de respuesta en
  `qa-results/e2e-minimal-<timestamp>/summary.md`.

## Riesgos residuales Bloque 4

- La suite valida el recorrido por API, no render ni persistencia visual de
  sidebar/header.
- Sin `VIEWER_TOKEN`, `EXPIRED_TOKEN`, `REPORT_EXPORT_ID` o `EVIDENCE_ID`, los
  checks correspondientes quedan `SKIP`.
- La ausencia de logout backend impide validar revocacion real de sesion.

## Archivos Bloque 5

- `scripts/env-check.sh`
- `.env.example`
- `backend/.env.example`
- `frontend/.env.example`
- `ai-engine/.env.example`
- `docs/sprint-2/sprint-2-pilot-readiness-status.md`

## Contrato env Bloque 5

- Perfiles: `lab`, `demo`, `pilot`, `production`; default controlado: `demo`.
- Capas: `all`, `backend`, `frontend`, `ai-engine`.
- Exit `0`: PASS sin WARN/FAIL.
- Exit `1`: uso invalido o error del script.
- Exit `2`: configuracion FAIL.
- Exit `3`: solo WARN, sin FAIL.
- Production bloquea faltantes criticos, secretos vacios/cortos/triviales,
  `DB_SSL=false` y URLs publicas loopback o HTTP.
- Pilot bloquea faltantes criticos y secretos inseguros.
- Lab/demo permiten configuracion incompleta solo como WARN.

Nombres oficiales:

- Frontend API: `NEXT_PUBLIC_API_URL`.
- AI Engine port: `APP_PORT`.
- AI provider: `LLM_PROVIDER`.
- Busqueda Brave: `BRAVE_SEARCH_API_KEY`.
- DB backend/AI actual: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
  `DB_PASSWORD`.

Aliases deprecados:

- `NEXT_PUBLIC_API_BASE_URL` y `NEXT_PUBLIC_BACKEND_URL`.
- `AI_ENGINE_PORT`.
- `AI_PROVIDER` y `MODEL_PROVIDER`.
- `BRAVE_API_KEY`.

## Riesgos residuales Bloque 5

- El gate debe incorporarse al deploy/systemd para impedir arranque production
  inseguro; en este bloque no se modificaron unidades ni runtime.
- `DB_POOL_MIN`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ENABLE_DEMO_MODE` y
  `LOG_LEVEL` forman parte del contrato operativo, pero algunos consumidores
  runtime actuales aun no los usan directamente.
- AI Engine sigue teniendo defaults runtime heredados; el bloqueo depende de
  ejecutar el gate antes del arranque hasta que exista validacion interna.
- `frontend/.env.example` esta ignorado por `frontend/.gitignore` mediante
  `.env*` y nunca estuvo rastreado. Debe incorporarse de forma explicita al
  preparar commits o acordar una excepcion de ignore; no se hizo staging en
  este bloque.

## Archivos Bloque 6

- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/utils/mvpPermissions.ts`
- `docs/demo/official-demo-routes.md`
- `docs/sprint-2/sprint-2-pilot-readiness-status.md`

## Gating Bloque 6

- Cliente tenant usa exclusivamente `CLIENT_MVP_NAV_ITEMS`.
- Plataforma muestra administracion SaaS; no mezcla rutas dealer o cliente.
- Dealer muestra portal, cotizador y prefacturacion; no muestra reportes tenant.
- Operativo/area owner obtiene lectura de reportes, sin permiso
  `reports.export`.
- Viewer conserva lectura de reportes, pero `reports.export` queda reservado a
  admin/auditor.
- Perfil personal se separa de administracion tenant para no bloquear el link
  persistente del header.
- Rutas beta/internas/legacy permanecen en disco y sus aliases siguen
  redirigiendo.

## Riesgos residuales Bloque 6

- El build/lint valida compilacion, pero la matriz por rol requiere smoke visual
  con tokens reales.
- Ocultar o redirigir en frontend no reemplaza JWT, RBAC ni aislamiento tenant
  del backend.
- Los resultados de busqueda/notificaciones pueden enlazar rutas internas; el
  acceso directo sigue sujeto a `AppLayout`.

## Validacion integral Bloque 7

Las validaciones locales de codigo, build, sintaxis y configuracion pasaron.
Los audits runtime informan solo advisories moderate:

- Backend: 5 moderate (`qs` y cadena `googleapis`/`uuid`), 0 high, 0 critical.
- Frontend: 2 moderate (`next`/`postcss`), 0 high, 0 critical.
- No se aplico `npm audit fix` ni `--force`; las correcciones propuestas
  incluyen cambios potencialmente incompatibles.

El runtime final se valido contra `https://tcdx-iso.tecdex.net`. Las cuatro
suites finalizaron con `FAIL=0`, sin `500`, sin `401/403` inesperados, con
same-tenant autorizado en `200` y cross-tenant bloqueado en `403/404`. No se
imprimieron tokens ni cabeceras Authorization.

SKIP runtime esperados:

- `VIEWER_TOKEN` ausente.
- `EXPIRED_TOKEN` ausente.
- `REPORT_EXPORT_ID` ausente.
- `EVIDENCE_ID` ausente.
- Logout sin endpoint backend seguro.
- GET con escrituras implicitas en tenant standards, SoA y lifecycle board.

Higiene:

- `qa-results/` esta ignorado y no tiene archivos versionados.
- Solo `.env.example` estan versionados; no hay `.env` reales en Git.
- No hay JWT literales, Bearer literales ni cabeceras de clave privada en
  archivos modificados/no rastreados.
- Los `.sql` versionados son migraciones, seeds y demos preexistentes; ninguno
  fue modificado en Sprint 2.
- Tres `.DS_Store` locales estan ignorados y no son candidatos a commit.
- `frontend/.env.example` esta ignorado, contiene solo contrato/placeholders y
  es apto para `git add -f` en el commit de entorno.

## Decision

**Listo tecnicamente para PR y revision de piloto controlado.**

**Decision local para PR: listo para commits y revision.**

El codigo y los gates runtime pasan con FAIL 0. La activacion de un piloto con
cliente real queda condicionada a revision de commits, smoke visual final,
datos para checks opcionales y adopcion operativa de env-check. No se realizo
deploy, push, merge, migracion ni cierre operativo de Sprint 2.
