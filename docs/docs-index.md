# Documentation Index

Fecha: 2026-06-11
Rama: `chore/operational-governance-cleanup`
Base: `13b5721`

## Objetivo

Este indice clasifica la documentacion del repo entre vigente, vigente con
revision, historica, legacy, borrador, reemplazada o pendiente de revisar. Su
objetivo es que el equipo y Codex sepan que fuente usar para decisiones actuales
sin depender de documentos antiguos o contradictorios.

El inventario de Sprint 3 detecto aproximadamente 195 documentos `.md/.txt`, de
los cuales 67 estan bajo carpetas `docs/sprint-*`.

## Regla de uso para equipo y Codex

1. Usar primero este `docs/docs-index.md` para ubicar la fuente vigente.
2. No tomar decisiones desde documentos historicos sin verificar contra fuentes
   vigentes.
3. No ejecutar scripts DB solo porque un documento historico lo indique.
4. No borrar legacy sin dependency scan backend/frontend/scripts/docs y plan de
   rollback.
5. No inferir estado actual desde sprint docs antiguos.
6. Si dos documentos se contradicen, prevalece la fuente primaria vigente mas
   reciente y el codigo actual verificado.
7. Si una decision afecta runtime, validar contra codigo, QA y ambiente seguro;
   la documentacion sola no autoriza cambios.

## Jerarquia de fuentes

| Prioridad | Fuente | Uso |
|---:|---|---|
| 1 | Codigo actual y tests/QA ejecutados | Verdad runtime. |
| 2 | Este indice | Seleccionar documento correcto. |
| 3 | Contratos vigentes Sprint 2/3 | API, RBAC, demo, uploads, errores, scripts. |
| 4 | Runbooks operativos vigentes | Deploy, backup/restore, env, continuidad. |
| 5 | ADRs y database-live-map | Decisiones estructurales y mapa DB con revision. |
| 6 | Sprint docs historicos | Contexto y trazabilidad, no decision actual directa. |
| 7 | FASE/phase/CIERRE docs legacy | Referencia historica solamente salvo validacion. |

## Fuentes primarias actuales

| Ruta | Proposito | Estado | Reemplaza o complementa | Riesgo de contradiccion | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/docs-index.md` | Indice rector de documentacion. | vigente | Nuevo en Sprint 3. | bajo | Primera parada para ubicar fuentes. | Engineering |
| `docs/api/api-contract-current.md` | Contrato API montado y clasificado. | vigente | Reemplaza inventarios parciales para decisiones API actuales. | medio si cambia `app.js` | Usar para rutas/mounts Sprint 2+. | Backend |
| `docs/security/rbac-route-matrix.md` | Matriz RBAC de reportes y rutas. | vigente | Complementa RBAC historico. | medio si cambia middleware | Usar para permisos reportes actuales. | Security/Backend |
| `docs/demo/official-demo-routes.md` | Rutas oficiales demo/piloto. | vigente | Reemplaza listas legacy de navegacion demo. | bajo | Usar para sidebar/demo/piloto. | Producto/Frontend |
| `docs/security/upload-governance-policy.md` | Politica upload por modulo. | vigente | Nuevo S3-03. | medio por limites runtime inferidos | Usar antes de tocar uploads. | Security/Backend |
| `docs/engineering/error-response-standard.md` | Formato de errores y plan gradual. | vigente | Nuevo S3-02. | bajo, no aplicado runtime aun | Usar para endpoints nuevos/hardening. | Engineering/Backend |
| `docs/database/database-scripts-manifest.md` | Manifest DB/QA scripts. | vigente | Nuevo S3-01. | medio si se agregan scripts | Usar antes de ejecutar scripts DB/QA. | DB/DevOps/QA |
| `docs/sprint-3/sprint-3-governance-cleanup-status.md` | Estado Sprint 3 actual. | vigente | Reemplaza interpretaciones de Sprint 3 anterior. | bajo | Usar para avance Sprint 3 actual. | Engineering |
| `docs/runbooks/pre-customer-backup-restore-gate.md` | Gate backup/restore pre-cliente. | vigente con revision | Complementa backup runbooks. | medio por ambiente | Usar antes de piloto/cliente real. | DevOps/DB |
| `docs/adr/ADR-db-tenant-isolation.md` | Decision tenant isolation DB. | vigente con revision | ADR estructural. | bajo si no cambia arquitectura | Usar para decisiones multi-tenant. | Architecture/DB |

## Documentacion vigente operativa

| Ruta o patron | Proposito | Estado | Fuente reemplazante si aplica | Riesgo | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/backup-restore-runbook.md` | Backup/restore runtime. | vigente con revision | Complementado por pre-customer gate. | medio | Operacion, validar comandos antes de production. | DevOps |
| `docs/continuity-operations-runbook.md` | Continuidad operacional. | vigente con revision | Ninguna. | medio | Incidentes, no ejecutar acciones destructivas sin aprobacion. | DevOps |
| `docs/observability-runbook.md` | Observabilidad. | vigente con revision | Ninguna. | bajo | Monitoreo y diagnostico. | DevOps |
| `docs/pilot-deployment-runbook.md` | Despliegue piloto. | vigente con revision | Sprint 2 deploy real puede contener decisiones mas recientes. | medio | Usar con verificacion runtime. | DevOps |
| `docs/vmware-esxi-deployment-runbook.md` | Deploy ESXi. | vigente con revision | Complementado por env-check Sprint 2. | medio | Deploy ESXi, no usar PM2 backend. | DevOps |
| `docs/environment-configuration.md` | Variables/configuracion. | vigente con revision | `.env.example` y `scripts/env-check.sh`. | medio | Revisar junto a env-check. | DevOps |
| `docs/production-readiness-checklist-esxi.md` | Checklist prod ESXi. | vigente con revision | Sprint 1/2 status para cierre real. | medio | Pre-produccion, verificar fecha. | DevOps/Security |
| `docs/go-live-checklist.md` | Go-live. | vigente con revision | Sprint 1/2 gates mas recientes. | medio | Checklist general, no fuente unica. | Producto/DevOps |
| `docs/oracle-cloud-*.md` | Runbooks Oracle Cloud. | vigente con revision | ESXi puede ser entorno actual; verificar objetivo. | medio | Solo si se opera Oracle Cloud. | DevOps |
| `docs/frontend-nginx-proxy.md`, `docs/frontend-port-8080.md` | Config frontend/Nginx. | vigente con revision | Runbook deploy actual. | bajo | Config puntual. | Frontend/DevOps |
| `docs/runbooks-index.md` | Indice runbooks anterior. | pendiente revisar | Este indice. | medio | Referencia historica hasta reconciliar. | DevOps |

## QA, validacion y seguridad

| Ruta o patron | Proposito | Estado | Fuente reemplazante si aplica | Riesgo | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/security/demo-credentials-policy.md` | Politica credenciales demo. | vigente | Ninguna. | bajo | Usar para demos y prompts. | Security |
| `docs/security/tenant-scope-sprint-1-coverage.md` | Cobertura tenant scope Sprint 1. | historico/vigente parcial | QA Sprint 2 y scripts actuales. | medio | Contexto; validar con QA actual. | Security |
| `docs/security-hardening.md`, `docs/security-hardening-phase-4b.md` | Hardening historico. | historico | Sprint 1/2 status y docs security actuales. | medio | Referencia; no decidir sin verificar. | Security |
| `docs/security-and-code-quality-audit.md` | Auditoria seguridad/calidad. | pendiente revisar | Fuentes actuales por area. | medio | Revisar antes de usar. | Security/Engineering |
| `docs/qa-*.md`, `docs/phase-4-qa-matrix.md` | Evidencia QA historica. | historico | Scripts QA actuales y status Sprint 1/2/3. | medio | Contexto de pruebas previas. | QA |
| `docs/CHECKLIST_QA_PRIMERA_VENTA.md` | Checklist QA primera venta. | historico/vigente parcial | Sprint 1/2 post-deploy y demo routes. | medio | Validar antes de piloto. | QA/Producto |
| `docs/market-readiness-checklist.md`, `docs/commercial-pilot-scope.md`, `docs/pilot-demo-checklist.md` | Comercial/piloto. | vigente con revision | Demo official routes y status Sprint 2. | medio | Usar con rutas oficiales. | Producto |

## Database docs

| Ruta o patron | Proposito | Estado | Fuente reemplazante si aplica | Riesgo | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/database-live-map/README.md` | Entrada mapa DB vivo. | vigente con revision | Ninguna. | medio | Ubicar mapa DB. | DB |
| `docs/database-live-map/*.md` | Mapa estructural DB generado/curado. | vigente con revision | Codigo/schema actual si cambia. | medio | No usar para cambios sin validar contra DB actual. | DB |
| `docs/database/database-scripts-manifest.md` | Clasificacion scripts DB/QA. | vigente | Nuevo S3-01. | bajo | Usar antes de ejecutar scripts. | DB/DevOps |
| `docs/sprint-0/database-schema.md`, `docs/sprint-0/database-risks.md` | Mapa/riesgos Sprint 0. | historico | `database-live-map` y ADR. | alto | Referencia historica solamente. | DB |
| `docs/adr/ADR-db-tenant-isolation.md` | Decision aislamiento tenant. | vigente con revision | Ninguna. | bajo | Fuente primaria para tenant isolation. | Architecture/DB |

Regla DB: no ejecutar migraciones, seeds, qa-fixes ni scripts por indicacion de
docs historicos. Usar primero `docs/database/database-scripts-manifest.md` y
validar contra schema actual.

## AI docs

| Ruta o patron | Proposito | Estado | Fuente reemplazante si aplica | Riesgo | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/ai-auditor-human-review.md` | Revision humana IA auditor. | vigente con revision | Politica AI governance S3-05 cuando exista. | medio | Usar para IA supervisada. | AI/QA |
| `docs/ai-auditor-operations-runbook.md` | Operacion IA auditor. | vigente con revision | AI governance futuro. | medio | Operacion con revision humana. | AI/DevOps |
| `docs/ai-auditor-production-checklist.md` | Checklist IA auditor prod. | vigente con revision | AI governance futuro. | medio | Pre-produccion IA. | AI/Security |
| `docs/ai-engine-bootstrap-knowledge.md`, `docs/ai-engine-knowledge-base.md` | Knowledge AI Engine. | vigente con revision | AI governance futuro. | medio | Mantener conocimiento, no ejecutar seeds sin aprobacion. | AI/DB |
| `docs/ai-operational-endpoints.md` | Endpoints IA operativos. | vigente con revision | API contract actual. | medio | Verificar contra rutas actuales. | AI/Backend |
| `docs/ai-legacy-suggest-endpoints.md` | Endpoints suggest legacy. | legacy | AI operational endpoints/API contract. | alto | No usar para nuevas integraciones sin verificar. | AI |
| `docs/ai-v2-remaining-gaps-map.md`, `docs/ai-final-value-layer-map.md` | Roadmap/gaps IA. | historico/borrador | Sprint actual y AI governance futuro. | medio | Contexto roadmap. | AI/Producto |
| `docs/IA_AUDITOR_V1.md`, `docs/ai-auditor-phase-3-final-summary.md` | IA Auditor historico. | historico | AI Auditor actuales y S3-05 futuro. | medio | Referencia historica. | AI |
| `docs/ollama-local-llm-setup.md`, `docs/ai-local-compact-performance.md` | LLM local. | pendiente revisar | Config runtime actual. | medio | Usar solo si ambiente local aplica. | AI/DevOps |

Regla IA: la IA es asistente supervisado. No usar docs IA historicos para
autorizar hallazgos, NC, acciones, reportes o documentos sin aprobacion humana.

## Documentacion historica por sprint

| Ruta o patron | Proposito | Estado | Fuente reemplazante si aplica | Riesgo | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/sprint-0/*` | Inventario inicial, arquitectura, riesgos, rutas. | historico | Contratos Sprint 2/3 y codigo actual. | alto | Contexto; no decidir estado actual sin verificar. | Engineering |
| `docs/sprint-1/*` | Hardening P0 y cierre Sprint 1. | historico/vigente parcial | Estado Sprint 1 cerrado y QA actual. | medio | Evidencia cierre P0. | Security/QA |
| `docs/sprint-2/*` | Sprint 2 tecnico anterior y cierre P1. | historico/vigente parcial | `docs/api`, `docs/security`, `docs/demo`, status Sprint 2. | medio | Evidencia Sprint 2; verificar contra merge `13b5721`. | Engineering |
| `docs/sprint-3/*` existentes antes de este Sprint 3 | Sprint 3 historico del roadmap anterior. | historico/reemplazado parcial | `docs/sprint-3/sprint-3-governance-cleanup-status.md`. | alto | No inferir estado actual; referencia historica. | Engineering |
| `docs/sprint-3-5/*` | Evidence Library/Zoho/document index. | vigente parcial con revision | Codigo actual y docs futuras de evidencia. | medio | Usar para Evidence Library con verificacion. | Backend/Frontend |
| `docs/sprint-4/*` | Diagnostico fortalecido. | historico/vigente parcial | Codigo actual y contratos demo/API. | medio | Contexto funcional. | Producto/Backend |
| `docs/sprint-5/*` | Health KPIs. | historico/vigente parcial | Codigo actual/dashboard docs. | medio | Contexto, validar runtime. | Backend |
| `docs/sprint-6/*` | Reportes y alcance ISO. | vigente parcial con revision | RBAC route matrix y API contract. | medio | Reportes/IA, verificar contra Sprint 2. | Backend/AI |
| `docs/sprint-7/*` | Demo comercial seed/maturity. | historico/demo | Demo official routes y DB manifest. | alto | No ejecutar SQL demo sin aprobacion. | Producto/DB |

## Legacy e historicos de raiz

| Ruta o patron | Proposito | Estado | Fuente reemplazante si aplica | Riesgo | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/FASE_*.md` | Fases antiguas de implementacion. | legacy/historico | Sprint status actual, API contract, codigo. | alto | Referencia historica solamente. | Engineering |
| `docs/CIERRE_*.md` | Cierres funcionales antiguos. | historico | Cierres Sprint 1/2 y status actual. | alto | Evidencia historica. | QA/Producto |
| `docs/phase-*.md` | Phase 4 historico. | historico | Security/QA actuales. | medio | Contexto. | QA/Security |
| `docs/RBAC_FINAL.md`, `docs/rbac-matrix.md`, `docs/rbac-phase-4c.md` | RBAC historico. | historico/reemplazado parcial | `docs/security/rbac-route-matrix.md` y middleware actual. | alto | No decidir permisos actuales sin verificar. | Security |
| `docs/PRODUCCION_PRIMERA_VENTA.md`, `docs/PLAN_PRIMERA_VENTA_1_A_5_CLIENTES.md` | Produccion/venta historica. | historico/vigente parcial | Sprint 1/2 status, runbooks, demo routes. | medio | Contexto comercial. | Producto |
| `docs/OPERACION_SECRETOS.md` | Operacion secretos. | vigente con revision | Secret hygiene Sprint 1/2 y env-check. | medio | Usar con verificacion actual. | Security/DevOps |
| `docs/recomendaciones_hardening_tcdx_iso_saas_codex.txt` | Recomendaciones hardening anteriores. | historico | Sprint 1/2/3 docs. | medio | Backlog de referencia. | Security |

## Modulos funcionales y docs de producto

| Ruta o patron | Proposito | Estado | Fuente reemplazante si aplica | Riesgo | Uso recomendado | Owner |
|---|---|---|---|---|---|---|
| `docs/document-sources-tenant-scoped.md` | Fuentes documentales tenant-scoped. | vigente con revision | Evidence Library docs y codigo actual. | medio | Integraciones documentales. | Backend/Integraciones |
| `docs/modulo-preparacion-*.md` | Preparacion documental/auditoria. | vigente parcial con revision | API contract y upload policy. | medio | Funcionalidad beta/interna, validar rutas. | Producto/Backend |
| `docs/pdf-rendering-html-puppeteer.md` | Renderer PDF HTML/Puppeteer. | vigente con revision | Package actual y reportes Sprint 6. | bajo | Reportes/PDF. | Backend |
| `docs/audit-views-consolidation.md` | Consolidacion vistas auditoria. | pendiente revisar | Codigo actual. | medio | Contexto antes de tocar auditorias. | Backend |
| `docs/frontend-lint-debt.md` | Deuda lint frontend. | vigente con revision | Lint actual. | bajo | Backlog tecnico. | Frontend |
| `docs/i18n-*.md` | i18n. | vigente parcial con revision | Codigo actual. | bajo | Cambios i18n. | Frontend/Producto |
| `docs/known-limitations.md` | Limitaciones conocidas. | pendiente revisar | Status Sprint actual. | medio | Revisar antes de citar. | Producto |

## Documentos que no deben usarse para decisiones actuales sin verificacion

- `docs/FASE_*.md`
- `docs/CIERRE_*.md`
- `docs/phase-*.md`
- `docs/sprint-0/*`
- `docs/sprint-3/*` historicos anteriores al status actual, excepto
  `docs/sprint-3/sprint-3-governance-cleanup-status.md`
- `docs/sprint-7/*.md` para ejecutar demo SQL
- `docs/RBAC_FINAL.md`, `docs/rbac-matrix.md`, `docs/rbac-phase-4c.md`
- `docs/ai-legacy-suggest-endpoints.md`
- cualquier doc que proponga ejecutar SQL, deploy o repair sin manifest y
  aprobacion actual.

## Procedimiento para agregar nueva documentacion

1. Crear el documento en el directorio tematico correcto.
2. Indicar fecha, rama/base si aplica y alcance.
3. Declarar si es vigente, historico, borrador o reemplaza otro documento.
4. Actualizar este indice en el mismo bloque o commit.
5. Si el doc menciona scripts, DB, deploy, uploads, IA o seguridad, referenciar
   la fuente primaria vigente correspondiente.
6. No incluir secretos, tokens, datos reales de clientes ni rutas internas
   sensibles.
7. No documentar una operacion destructiva sin precondiciones, aprobacion,
   backup y rollback.

## Pendientes de gobernanza documental

- Revisar `docs/runbooks-index.md` contra este indice.
- Separar docs historicos de Sprint 3 anterior de Sprint 3 actual en una futura
  reorganizacion aprobada.
- Revisar AI docs cuando se publique `docs/ai/ai-governance-policy.md`.
- Revisar database-live-map contra schema actual antes de cualquier cambio DB.
- Agregar owner formal por documento en una matriz posterior si el equipo lo
  requiere.
