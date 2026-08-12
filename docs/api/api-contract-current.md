# Contrato API actual

Fecha de inventario: 2026-06-11
Rama: `feature/pilot-readiness-p1`
Base: `c1463e0`

## Objetivo

Este documento fija el contrato observable de rutas montadas para Sprint 2 antes
de modificar backend o frontend. No sustituye la especificacion detallada de
payloads y respuestas de cada modulo.

El inventario estatico detecto:

- 70 mounts de archivos route en `backend/src/app.js`, incluyendo aliases.
- 65 archivos route montados unicos.
- Aproximadamente 470 declaraciones `router.get/post/put/patch/delete` en esos
  archivos unicos.

Las cifras son una fotografia del codigo en la base indicada. Deben regenerarse
si cambia `backend/src/app.js` o la estructura de `backend/src/routes`.

## Middleware y fuentes de tenant

Salvo las excepciones pre-auth, las rutas `/api/**` pasan por:

1. `auth`: validacion JWT y estado del tenant.
2. `enforceApiAccess`: RBAC por prefijo y metodo de lectura/escritura.
3. `enforceTenantRequestScope`: comparacion del tenant JWT con hints conocidos
   en path, query o body.

Convenciones usadas en las tablas:

- `JWT`: tenant derivado del token.
- `path`, `query`, `body`: tenant recibido en esa parte de la solicitud.
- `mixto`: combina JWT con una o mas fuentes de la solicitud.
- `lookup`: el tenant se valida consultando la entidad identificada por un ID.
- `no aplica`: ruta publica, catalogo global o contexto sin tenant directo.

## Resumen de mounts por grupo

| Grupo funcional | Mounts principales | Clasificacion dominante |
|---|---|---|
| Autenticacion y agentes | `/api/auth`, `/api/agent` | MVP obligatorio / interno |
| Integraciones OAuth pre-auth | `/api/document-integrations/google`, `/api/document-integrations/zoho` | Demo-piloto / interna |
| Usuario y tenant | `/api/user`, `/api/users`, `/api/tenants`, `/api/me`, `/api/company-profile` | MVP obligatorio / administrativo |
| Dashboard y KPI | `/api/dashboard`, `/api/dashboard-controls`, `/api/kpi`, `/api/kpis` | MVP obligatorio / alias |
| Cumplimiento | `/api/controls`, `/api/diagnostic`, `/api/diagnostics`, `/api/policy`, `/api/soa` | MVP obligatorio / alias |
| Auditoria y hallazgos | `/api/audits`, `/api/audit-execution`, `/api/audit-preparation`, `/api/findings`, `/api/nonconformities` | Demo-piloto |
| Evidencias y documentos | `/api/evidences`, `/api/evidence-library`, `/api/document-integrations`, `/api/files/tenant` | MVP obligatorio / demo-piloto |
| Reportes | `/api/reports` | MVP obligatorio |
| Procesos y normas tenant | `/api/tenant-processes`, `/api/tenant-operations`, `/api/tenant-process-links`, `/api/tenant-standards` | Demo-piloto / administrativo |
| Gestion operativa | `/api/assets`, `/api/action-plans`, `/api/objectives`, `/api/lifecycle` | Demo-piloto |
| Salud | `/health`, `/api/health` | Demo-piloto / alias |
| IA | `/api/ai`, `/api/ai-auditor`, `/api/ai-compliance/*`, `/api/ai-feedback`, `/api/ai-external-lookup`, `/api/ai-traces` | Demo-piloto / interna |
| ISO avanzado | `/api/iso-*` | Demo-piloto / post-MVP |
| Plataforma y dealer | `/api/admin-saas`, `/api/quotes`, `/api/billing` | Administrativo/interno |
| Busqueda y notificaciones | `/api/search`, `/api/notifications` | Demo-piloto |

## Contrato de rutas criticas

| Grupo | Mount y archivo route | Metodo/path identificado | Middleware relevante | Tenant source | Consumidor conocido | Estado | Clasificacion | Brecha o accion |
|---|---|---|---|---|---|---|---|---|
| Auth | `/api/auth` - `auth.routes.js` | `POST /login`, `POST /register`, `GET /validate` | JSON limiter; auth local en validate; mount previo al RBAC global | no aplica / JWT | `/login`, guards de sesion | publica controlada | MVP obligatorio | Mantener registro publico deshabilitado salvo configuracion explicita. |
| Agente | `/api/agent` - `sync-agent.routes.js` | registro, heartbeat, config, index y upload | Token de agente propio; mount previo al RBAC global | JWT de agente / body | Agente de sincronizacion | interna | administrativo/interno | No exponer en demo ni tratar como API de usuario. |
| OAuth Google | `/api/document-integrations/google` - `document-integrations-google.routes.js` | OAuth start/callback y rutas asociadas | Auth propio por ruta; mount previo al RBAC global | JWT/query/estado OAuth | Evidencias | publica controlada | demo-piloto | Mantener callback compatible; ocultar no reemplaza validacion interna. |
| OAuth Zoho | `/api/document-integrations/zoho` - `document-integrations-zoho.routes.js` | OAuth start/callback, folders, sources y sync | Auth propio por ruta; mount previo al RBAC global | JWT/query/body/estado OAuth | Evidencias | publica controlada / interna | demo-piloto | Revisar ruta por ruta antes de cambiar orden de mounts. |
| Dashboard | `/api/dashboard` - `dashboard.routes.js` | `GET /:tenant_id` | JWT, RBAC, tenant scope central y auth local | JWT + path | `/dashboard` | interna autenticada | MVP obligatorio | Cubierto por tenant path central; conservar contrato. |
| Dashboard controls | `/api/dashboard-controls` - `dashboard-controls.routes.js` | `GET /:tenant_id` | JWT, RBAC, tenant scope central | JWT + path | `/dashboard` | interna autenticada | MVP obligatorio | Cubierto por tenant path central. |
| KPI | `/api/kpi`, `/api/kpis` - `kpi.routes.js` | dashboard, effective-health-summary, catalog, admin, recalculate y CRUD KPI | JWT, RBAC, tenant scope central en rutas tenant | JWT + path/body | `/dashboard`, `/administrar-kpis` | alias compatibles | demo-piloto / administrativo | Mantener ambos mounts; administracion KPI permanece oculta al cliente. |
| Controles | `/api/controls` - `controls.routes.js` | workbench, catalog, catalog-mode, CRUD y AI review | JWT, RBAC, tenant scope central en rutas conocidas; lookup en IDs | JWT + path/body/lookup | `/controles` | interna autenticada | MVP obligatorio | Probar path tenant y operaciones por ID por separado. |
| Diagnostico | `/api/diagnostic`, `/api/diagnostics` - `diagnostic.routes.js` | standards, summary, processes, recommendations, `GET /:tenant_id`, `PUT /:id` | JWT, RBAC; validacion local; alias doble | JWT + path/query/body/lookup | `/diagnostico`, `/cumplimiento-auditoria` | alias | MVP obligatorio | `/:tenant_id` no esta en el patron central actual; conservar validacion local y agregar QA. |
| SoA/policy | `/api/soa`, `/api/policy` - `soa.routes.js`, `policy.routes.js` | `GET /:tenant_id`, `GET /:tenant_id/:iso`, update por control | JWT, RBAC, tenant scope central y lookup | JWT + path/lookup | `/soa` | interna autenticada | demo-piloto | Cubrir lectura cross-tenant y updates por ID. |
| Auditorias | `/api/audits` - `audits.routes.js` | crear, iniciar, upload, completar, report, summary, next y `GET /:tenant_id` | JWT, RBAC, tenant scope central; lookup por audit ID | JWT + path/body/lookup | `/auditorias` | interna autenticada | demo-piloto | Rutas path principales cubiertas; operaciones por ID requieren QA especifica. |
| Ejecucion auditoria | `/api/audit-execution` - `audit-execution.routes.js` | checklist, review y summary | JWT, RBAC; tenant por entidad | JWT + lookup | `/auditorias/ejecucion` | interna autenticada | demo-piloto | Confirmar aislamiento por audit/review ID. |
| Preparacion auditoria | `/api/audit-preparation` - `auditPreparation.routes.js` | templates, sources, packages, documentos, evidencias y exports | JWT y RBAC global; upload donde aplica | JWT + body/query/lookup | Panel de preparacion en auditorias | beta/interna | ocultar temporalmente | Mantener fuera del recorrido oficial hasta E2E y matriz contractual detallada. |
| Hallazgos | `/api/findings` - `findings.routes.js` | controls, list tenant, CRUD, AI review y create-action | JWT, RBAC, tenant scope central en path; lookup en IDs | JWT + path/body/lookup | `/hallazgos` | interna autenticada | MVP obligatorio | Probar path tenant y mutaciones por ID. |
| No conformidades | `/api/nonconformities` - `nonconformities.routes.js` | AI review, `GET /:tenant_id`, `PUT /:id` | JWT, RBAC, tenant scope central en lectura; lookup en IDs | JWT + path/lookup | `/no-conformidades` | interna autenticada | MVP obligatorio | IA solo asiste; aprobacion y cierre siguen siendo humanos. |
| Evidencias | `/api/evidences` - `evidences.routes.js` | upload, validate, jobs, approve, file, mark-official, AI review y list tenant | JWT, RBAC, tenant scope central en path/query/body; lookup en IDs | JWT + path/query/body/lookup | `/evidencias`, `/controles` | interna autenticada | MVP obligatorio | Cubrir descarga por ID y nunca devolver 500 ante tenant ajeno. |
| Biblioteca de evidencias | `/api/evidence-library` - `evidence-library.routes.js` | catalogo, documentos, asociaciones y acciones de indice | JWT, RBAC, tenant por JWT/query/body/lookup | JWT + mixto | `/evidencias` | interna autenticada | demo-piloto | Mantener identidad interna por `document_index.id`; no exponer IDs de proveedor como contrato interno. |
| Integraciones documentales | `/api/document-integrations` - cuatro route files | providers, sources, documents, sync, analysis, folders y suggestions | JWT, RBAC, tenant scope central salvo mounts OAuth previos | JWT + query/body/lookup | `/evidencias` | interna / beta | demo-piloto | Documentar por endpoint en iteracion posterior; no borrar compatibilidad. |
| Reportes | `/api/reports` - `reports.routes.js` | templates, preview, narrative, export, types, clients, standards, exports, download, jobs, generate y schedules | JWT, permisos `reports:read/download/generate/admin`, tenant scope query/body y reglas internas | JWT + query/body/lookup | `/exportes` | interna autenticada | MVP obligatorio | Separacion aplicada: viewer no genera/administra y `requested_by` no evita la coincidencia tenant en descargas. QA runtime PASS 3, FAIL 0, SKIP 3. |
| Health | `/health`, `/api/health` - `health.js` | summary, dashboard, standards, KPIs, remediation, audit log y refresh | `/health` agrega JWT/RBAC explicito; `/api/health` hereda global | JWT + query/body | `/health`, `/dashboard`, `/controles`, `/evidencias` | alias compatibles | demo-piloto | Clasificar endpoint por endpoint en QA; no exponer escrituras a viewer. |
| Lifecycle | `/api/lifecycle` - `lifecycle.routes.js` | stages, rebuild, board, summary, insights, AI context/feed, requests e history | JWT, RBAC, tenant scope central en rutas tenant; lookup en requests | JWT + path/body/lookup | `/ciclo-vida` | interna autenticada | demo-piloto | Mantener aprobacion humana para progresos y revisiones. |
| Objetivos | `/api/objectives` - `objectives.routes.js` | `GET /:tenant_id`, create, update y delete | JWT, RBAC, tenant scope central y validacion local | JWT + path/body/lookup | Panel de objetivos en `/ciclo-vida` | interna autenticada | demo-piloto | `GET /:tenant_id` cubierto por tenant scope central; same-tenant `200` y cross-tenant `403/404` confirmados en QA runtime. |
| Tenant standards | `/api/tenant-standards` - `tenant-standards.routes.js` | operations, scope, list, initialize y deactivate | JWT, RBAC, tenant scope central en rutas tenant | JWT + path/body/lookup | Varias vistas oficiales | interna autenticada | MVP obligatorio | Cubrir scope y operations ante tenant ajeno. |
| Procesos tenant | `/api/tenant-processes`, `/api/tenant-operations`, `/api/tenant-process-links` | CRUD y links operacionales | JWT, RBAC; tenant derivado por servicio y lookup | JWT + lookup | `/configuracion` y paneles asociados | interna autenticada | demo-piloto | Conservar sin ampliar alcance comercial. |
| Riesgos | `/api/iso-risk-matrix` - `iso-risk-matrix.routes.js` | options, generate, runs, latest, summary, review y archive | JWT, RBAC, tenant scope central en path | JWT + path | `/matriz-riesgo`, `/riesgos` | interna autenticada | demo-piloto | Mantener revision humana de resultados IA. |
| Document generator | `/api/iso-document-generator` - `iso-document-generator.routes.js` | options, templates, documents, generate, regenerate y archive | JWT/RBAC global; path tenant no cubierto centralmente | JWT + path/lookup | `/documentos` | beta | post-MVP / ocultar temporalmente | No incluir en demo oficial hasta cerrar aislamiento path y E2E. |
| ISO express | `/api/iso-express-diagnostic` - `iso-express-diagnostic.routes.js` | options, calculate, latest, readiness, gaps, plan y archive | JWT/RBAC global; path tenant no cubierto centralmente | JWT + path/lookup | `/diagnostico` | beta | demo-piloto controlado | Requiere QA tenant path antes de declararlo estable. |
| IA Compliance | `/api/ai-compliance` y submounts | engine health, analyze, findings, suggestions, apply, answer, benchmark, knowledge y tenant search | JWT, RBAC; token interno en knowledge interno; tenant mixto | JWT + query/body/lookup | `/ia-compliance`, hallazgos y NC | interna / beta | demo-piloto | Mantener IA como asistente supervisado; no aplicar hallazgos o acciones sin usuario. |
| Admin SaaS | `/api/admin-saas` - `admin-saas.routes.js` | tenants, dealers, modulos, contratos, cuotas, prefacturacion y lifecycle comercial | JWT; platform bypass del RBAC tenant; controles internos | path/body/lookup | `/admin-saas`, `/dealer`, `/prefacturacion` | interna | administrativo/interno | Firmas duplicadas requieren analisis; no eliminar en Sprint 2. |
| Search/notifications | `/api/search`, `/api/notifications` | busqueda, historial, click, listado y read/read-all | JWT, RBAC; validacion local; search cubierto centralmente | JWT + path/body/lookup | Header persistente | interna autenticada | demo-piloto | Notifications tenant path depende de validacion local; agregar QA si entra en E2E. |

## Rutas no montadas y firmas duplicadas

Los siguientes archivos existen bajo `backend/src/routes`, pero no se importan ni
montan en `backend/src/app.js`:

- `2evidences.routes.js`
- `report.routes.js`

Se clasifican como legacy o candidatos a compatibilidad pendiente. No deben
montarse, eliminarse ni renombrarse en Sprint 2 sin busqueda de referencias,
pruebas y plan de rollback.

Se detectaron firmas repetidas en:

- `admin-saas.routes.js`: dealer requests, initialize-controls y contract.
- `ai-compliance.routes.js`: `GET /engine-health`.
- `ai-external-lookup.routes.js`: `POST /search`.

La repeticion puede afectar precedencia Express o conservar compatibilidad
historica. Sprint 2 las documenta, pero no las elimina ni renombra sin analisis
adicional.

## Acciones contractuales pendientes

- Mantener los permisos de reportes sincronizados con consumidores frontend y
  reglas persistidas.
- Ampliar la cobertura opcional con `VIEWER_TOKEN`, `REPORT_EXPORT_ID`,
  `EVIDENCE_ID` y `EXPIRED_TOKEN` cuando existan datos seguros.
- Confirmar visualmente las rutas oficiales con la matriz completa de roles.
- Mantener aliases y rutas legacy mientras no exista plan de deprecacion.
- Actualizar este contrato cuando una ruta cambie de clasificacion o middleware.

## Cobertura QA tenant path P1

`scripts/qa-tenant-path-p1.sh` cubre por path, sin IDs internos:

- objectives, incluyendo comprobacion simetrica Tenant A/Tenant B;
- assets y resumen de riesgos de activos;
- tenant standards;
- policy con norma conocida;
- dashboard KPI;
- resumen de lifecycle.

El criterio cross-tenant es siempre `403/404`; un `500` falla la prueba. Quedan
como `SKIP` documentado los GET con escrituras implicitas: operations/scope de
tenant standards, SoA y lifecycle board.

La ejecucion runtime contra `https://tcdx-iso.tecdex.net` finalizo con
PASS 16, FAIL 0 y SKIP 4.
