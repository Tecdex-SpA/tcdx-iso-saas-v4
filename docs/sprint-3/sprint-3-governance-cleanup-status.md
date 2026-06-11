# Sprint 3 - Governance Cleanup Status

Fecha: 2026-06-11
Sprint: Gobernanza, documentacion y limpieza controlada
Rama: `chore/operational-governance-cleanup`
Base: `13b5721`

## Objetivo

Reducir deuda operacional y documental sin refactors destructivos, sin
eliminacion riesgosa de legacy y sin incorporar nuevas funcionalidades
comerciales.

Resultado esperado: menos deuda operativa, documentacion confiable para
equipo/Codex, gobernanza IA formalizada, politica de uploads documentada,
scripts DB/QA clasificados y limpieza P3 segura con evidencia.

## Estado inicial

- Rama creada desde `main` local en `13b5721`.
- `13b5721` corresponde al merge de Sprint 2.
- `main` local y `origin/main` local coinciden en `13b5721`.
- `git pull origin main` fallo por autenticacion SSH; queda pendiente operativo.
- Working tree limpio antes de iniciar Bloque 1.
- Diagnostico Fase 0/Fase 1 aprobado.

## Estado por bloque

| Bloque | Item | Estado | Evidencia |
|---|---|---|---|
| Bloque 1 | S3-01 Clasificar scripts DB/QA | Completado en documentacion | `docs/database/database-scripts-manifest.md` creado. |
| Bloque 2 | S3-02 Unificar error format | Completado documentalmente | `docs/engineering/error-response-standard.md` creado; sin cambio runtime. |
| Bloque 3 | S3-03 Politica de uploads | Completado documentalmente | `docs/security/upload-governance-policy.md` creado; sin cambio runtime. |
| Bloque 4 | S3-04 Indice docs vigente/historico | Completado documentalmente | `docs/docs-index.md` creado; no se movio ni borro documentacion. |
| Bloque 5 | S3-05 AI governance | Completado documentalmente | `docs/ai/ai-governance-policy.md` creado; sin cambio runtime. |
| Bloque 6 | S3-06 Limpieza P3 segura | Completado documentalmente | `docs/repo-cleanup-candidates.md` creado; no se removio nada. |

## Resultado diagnostico inicial

| Area | Resultado |
|---|---|
| Scripts SQL migrations | 36 detectados. |
| Scripts SQL seeds | 15 detectados. |
| Scripts SQL demo | 2 detectados. |
| Scripts SQL qa-fixes | 12 detectados. |
| Scripts shell nivel `scripts/` | 75 detectados. |
| Scripts Python nivel `scripts/` | 4 detectados. |
| Scripts bajo `scripts/qa/` | 4 detectados. |
| Archivos docs `.md/.txt` | 195 detectados. |
| Outputs IA versionados `ai-engine/reports/*.json` | 18 detectados. |
| Knowledge/prompts IA versionados | 33 detectados. |
| Dependencias duplicadas candidatas | `bcrypt`/`bcryptjs`, `puppeteer`/`puppeteer-core`. |
| Artefactos temporales locales | Tres `.DS_Store` ignorados; no versionados. |

## Archivos creados en Bloque 1

- `docs/database/database-scripts-manifest.md`
- `docs/sprint-3/sprint-3-governance-cleanup-status.md`

## Archivos creados/modificados en Bloque 2

- `docs/engineering/error-response-standard.md`
- `docs/sprint-3/sprint-3-governance-cleanup-status.md`

## Archivos creados/modificados en Bloque 3

- `docs/security/upload-governance-policy.md`
- `docs/sprint-3/sprint-3-governance-cleanup-status.md`

## Archivos creados/modificados en Bloque 4

- `docs/docs-index.md`
- `docs/sprint-3/sprint-3-governance-cleanup-status.md`

## Archivos creados/modificados en Bloque 5

- `docs/ai/ai-governance-policy.md`
- `docs/sprint-3/sprint-3-governance-cleanup-status.md`

## Archivos creados/modificados en Bloque 6

- `docs/repo-cleanup-candidates.md`
- `docs/sprint-3/sprint-3-governance-cleanup-status.md`

## Decisiones Bloque 1

- Los scripts SQL bajo `database/migrations`, `database/seeds`,
  `database/demo` y `database/qa-fixes` quedan marcados como no ejecutables sin
  aprobacion explicita.
- Los scripts repair, rollback, deploy y runtime con posible impacto en DB,
  uploads, tenants, permisos o produccion requieren aprobacion previa.
- Cuando el proposito no es evidente se documenta como inferido por nombre/ruta
  o requiere revision manual.
- No se borro, movio ni modifico ningun script legacy.

## Decisiones Bloque 2

- Se define el formato recomendado `{ ok, code, message, request_id, details }`
  para errores.
- Se documenta el formato de exito recomendado `{ ok, data, request_id }` solo
  cuando pueda adoptarse sin romper consumidores.
- Se reconoce `requestId` central y `securityErrorHandler` existentes en
  `backend/src/app.js`.
- Se documentan formatos mixtos actuales: `{ ok:false, code, error }`,
  `{ ok:false, error_code, code, message, error, request_id }`,
  `{ error: "..." }`, `{ success:false }` y variantes legacy.
- No se aplica cambio runtime en Bloque 2.
- La adopcion backend queda como fase gradual posterior y requiere aprobacion
  explicita.

## Decisiones Bloque 3

- Se documenta politica de uploads por modulo, tenant y exposicion.
- Se inventarian evidencias, evidence library manual, audit reports, audit
  preparation ZIPs, documentos generados, tenant files, logos, avatars, agent
  uploads, reports/exportes, document integrations y temporales.
- No se modifican allowlists, limites, storage paths, rutas ni runtime.
- Los riesgos ZIP, Office/Excel, logos publicos, agent uploads, report exports y
  tenant files quedan marcados para hardening futuro.

## Decisiones Bloque 4

- Se crea `docs/docs-index.md` como indice rector de documentacion.
- Se definen fuentes primarias actuales para API, RBAC, demo, uploads, errores,
  scripts DB/QA, Sprint 3, backup/restore y tenant isolation.
- Se clasifican documentos por grupos: vigente, vigente con revision,
  historico, legacy, reemplazado parcial, borrador o pendiente revisar.
- Se marca que `docs/FASE_*`, `docs/CIERRE_*`, `docs/phase-*`,
  `docs/sprint-0/*` y Sprint docs antiguos no deben usarse para decisiones
  actuales sin verificacion.
- No se borra, mueve ni renombra documentacion.

## Decisiones Bloque 5

- Se formaliza que IA es asistente supervisado.
- IA no crea hallazgos, no conformidades, planes de accion, reportes ni
  documentos finales sin aprobacion humana.
- IA no reemplaza criterio de auditor, consultor ni responsable del sistema de
  gestion.
- Se inventarian superficies IA: AI Engine, backend IA, IA Auditor, IA
  Compliance, AI feedback, AI traces, external lookup, Evidence Library,
  reportes, prompts/knowledge y outputs versionados.
- Se definen datos prohibidos, controles de trazabilidad, retencion, fallback,
  prompt injection y backlog de hardening IA.
- No se modifica AI Engine, backend, frontend, prompts, knowledge ni outputs IA.

## Decisiones Bloque 6

- Se documentan candidatos P3 de limpieza sin remover archivos ni dependencias.
- `bcrypt`/`bcryptjs` quedan como unificacion futura con pruebas de auth.
- `puppeteer`/`puppeteer-core` quedan como revision futura con pruebas de
  reportes/PDF y Chrome externo.
- Moderate advisories `googleapis`/`uuid`, `next` y `postcss` quedan
  documentados; no se aplica upgrade ni `npm audit fix --force`.
- `ai-engine/reports/*.json` se mantiene hasta confirmar si son fixtures,
  evidencia o outputs de regresion.
- `2evidences.routes.js` y `report.routes.js` se mantienen; no borrar sin
  dependency scan, pruebas y rollback.
- Scripts repair, rollback y qa-fixes se mantienen y siguen bajo regla de no
  ejecutar sin aprobacion.
- Temporales locales ignorados no bloquean mientras no se versionen.
- La limpieza real queda post-Sprint 3 con pruebas y aprobacion explicita.

## Validaciones Bloque 1

| Validacion | Estado |
|---|---|
| `git status --short` antes de editar | PASS: limpio. |
| Rama actual | PASS: `chore/operational-governance-cleanup`. |
| Base | PASS: `13b5721`. |
| Scripts destructivos ejecutados | PASS: ninguno. |
| SQL ejecutado | PASS: ninguno. |
| Runtime backend/frontend/AI modificado | PASS: no modificado. |
| Scripts/migraciones/seeds/qa-fixes modificados | PASS: no modificados. |

## Validaciones Bloque 2

| Validacion | Estado |
|---|---|
| Inventario estatico de formatos de error | PASS |
| Documento estandar de errores creado | PASS |
| Cambio runtime backend | SKIP: no permitido sin aprobacion posterior. |
| Backend/frontend/scripts/database/AI modificados | PASS: no modificados. |

## Validaciones Bloque 3

| Validacion | Estado |
|---|---|
| Inventario documental de uploads | PASS |
| Politica de gobernanza de uploads creada | PASS |
| Cambio runtime backend/frontend | SKIP: fuera de alcance. |
| Allowlists/storage/limites modificados | PASS: no modificados. |
| Scripts, SQL, repair, deploy ejecutados | PASS: ninguno. |

## Validaciones Bloque 4

| Validacion | Estado |
|---|---|
| Inventario docs `.md/.txt` | PASS: aproximadamente 195 documentos. |
| Documentos bajo `docs/sprint-*` | PASS: 67 documentos. |
| Indice documental creado | PASS |
| Documentacion movida/borrada/renombrada | PASS: ninguna. |
| Runtime modificado | PASS: no modificado. |

## Validaciones Bloque 5

| Validacion | Estado |
|---|---|
| Politica de gobernanza IA creada | PASS |
| Superficies IA inventariadas documentalmente | PASS |
| Revision humana obligatoria documentada | PASS |
| AI Engine/backend/frontend/prompts/knowledge modificados | PASS: no modificados. |
| Motor IA/scripts IA/migraciones/deploy ejecutados | PASS: ninguno. |

## Validaciones Bloque 6

| Validacion | Estado |
|---|---|
| Candidatos P3 inventariados documentalmente | PASS |
| Dependencias duplicadas documentadas | PASS: `bcrypt`/`bcryptjs`, `puppeteer`/`puppeteer-core`. |
| Moderate advisories documentados | PASS: `googleapis`/`uuid`, `next`, `postcss`. |
| Outputs IA versionados documentados | PASS: `ai-engine/reports/*.json`. |
| Rutas legacy/no montadas documentadas | PASS: `2evidences.routes.js`, `report.routes.js`. |
| Scripts repair/rollback/qa-fixes documentados | PASS |
| Archivos removidos | PASS: ninguno. |
| Package manifests modificados | PASS: no modificados. |
| Runtime backend/frontend/AI modificado | PASS: no modificado. |

## Validaciones integrales de cierre local

| Validacion | Resultado |
|---|---|
| Rama actual | PASS: `chore/operational-governance-cleanup`. |
| `git diff --check` | PASS |
| Artefactos temporales | PASS: tres `.DS_Store` locales ignorados; sin staged. |
| Backend `npm test` | PASS |
| Backend `npm run check` | PASS |
| Backend `npm audit --omit=dev` | PASS con advisories: 5 moderate, 0 high, 0 critical. |
| Frontend `npm run build` | PASS |
| Frontend `npm run lint` | PASS: 0 errors, warnings existentes. |
| Frontend `npm audit --omit=dev` | PASS con advisories: 2 moderate, 0 high, 0 critical. |
| AI Engine `python3 -m py_compile main.py` | PASS |
| AI Engine `python3 -m compileall app` | PASS |
| Scripts `bash -n` | PASS: `env-check`, `qa-cross-tenant-core`, `qa-reports-rbac-p1`, `qa-tenant-path-p1`, `qa-e2e-minimal`. |
| `env-check --help` | PASS |
| `env-check` demo | PASS esperado: exit 3 WARN-only, 0 FAIL. |
| `env-check` production | PASS esperado: exit 2 fail-fast por variables locales ausentes. |
| Runtime Reports RBAC | PASS: 3, FAIL: 0, SKIP: 3. |
| Runtime Tenant path P1 | PASS: 16, FAIL: 0, SKIP: 4. |
| Runtime E2E minima | PASS: 8, FAIL: 0, SKIP: 6. |
| Runtime Cross-tenant core | PASS: 44, FAIL: 0, SKIP: 2. |
| Secret hygiene candidatos a commit | PASS: sin `.env` reales, `qa-results`, JWT/Bearer/Authorization, llaves, certificados, dumps ni backups. |

## Decision local

Listo para PR localmente. Sprint 3 es documentacion pura; no requiere deploy
salvo decision posterior del equipo. No se hizo push, merge ni deploy.

## Riesgos residuales

- El acceso SSH para `git pull origin main` sigue pendiente.
- El manifiesto clasifica por nombre/ruta y revision estatica; algunos scripts
  requieren inspeccion manual de contenido antes de production.
- `database/qa-fixes` mezcla validaciones read-only aparentes con repair/rollback
  potencialmente destructivos.
- Varias suites QA pueden escribir datos demo o generar artefactos aunque su
  nombre sea de validacion; requieren entorno controlado.
- Los scripts runtime pueden recolectar logs o inventario con datos sensibles;
  toda salida debe sanitizarse antes de compartirse o versionarse.
- El backend conserva formatos de error mixtos hasta una adopcion gradual
  aprobada.
- Rutas legacy con `{ error: "..." }` pueden seguir requiriendo compatibilidad
  frontend antes de migrarse.
- El formato de exito `{ ok:true, data, request_id }` no debe imponerse a
  descargas, streams ni endpoints ya consumidos sin revision.
- ZIPs de audit preparation y evidence library requieren verificacion runtime
  de limites efectivos, escaneo y limpieza.
- Office/Excel siguen siendo inputs no confiables y requieren parser/hardening
  continuo.
- Logos publicos y avatars requieren allowlists estrictas y politica de purga.
- Agent uploads dependen de token agente, cuota y retencion por source.
- Report exports requieren TTL/cuota y descarga autenticada consistente.
- Tenant files requieren verificar el root efectivo antes de ampliar uso.
- Persisten documentos historicos y legacy que pueden contradecir docs
  vigentes; el indice reduce el riesgo pero no elimina deuda documental.
- `docs/sprint-3` contiene documentos de un Sprint 3 anterior y el status
  actual; requiere disciplina al citar.
- `docs/database-live-map` debe verificarse contra schema actual antes de
  cambios DB.
- Enforcement runtime central de `human_review_required` queda pendiente.
- Retencion configurable por tenant para prompts/respuestas queda pendiente.
- Prompt injection en documentos externos requiere hardening y pruebas
  adicionales.
- `ai-engine/reports/*.json` queda pendiente de clasificacion antes de mover o
  borrar.
- `bcrypt`/`bcryptjs` y `puppeteer`/`puppeteer-core` siguen duplicados hasta
  revision post-Sprint 3.
- Moderate advisories permanecen documentados y sin fix automatico.
- `2evidences.routes.js` y `report.routes.js` siguen presentes por
  compatibilidad/rollback hasta dependency scan futuro.
- `.DS_Store` locales siguen fuera de staging y deben revisarse antes de commit.

## Confirmaciones

- No se ejecutaron migraciones.
- No se ejecutaron seeds.
- No se ejecutaron rollback ni qa-fixes.
- No se ejecutaron repair scripts.
- No se ejecuto deploy.
- No se modificaron scripts, SQL, deploy, agent, backend, frontend, AI Engine ni
  package manifests.
- No se modifico runtime backend ni middleware de errores.
- No se modificaron allowlists, storage paths, limites runtime ni rutas de
  upload.
- No se movio, borro ni renombro documentacion.
- No se modificaron AI Engine, prompts, knowledge base ni outputs IA
  versionados.
- No se removieron dependencias, rutas legacy, outputs IA, binarios, temporales
  ni scripts.
- No se ejecuto `npm uninstall`, `npm audit fix`, migraciones, deploy ni scripts
  destructivos.
- No se modificaron package manifests ni `.gitignore`.
- No se hizo commit antes de completar validaciones integrales.

## Pendientes

- Crear commits documentales separados.
- Abrir PR cuando se autorice.
- Mantener escaneo de higiene antes de push/PR.
