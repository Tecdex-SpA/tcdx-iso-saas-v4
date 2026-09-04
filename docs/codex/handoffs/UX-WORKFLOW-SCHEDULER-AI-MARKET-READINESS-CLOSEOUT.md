# UX Workflow Scheduler AI Market Readiness Closeout

## Base

```text
BASE_COMMIT=3e0fdfc609d6ca67cedfe86614110452b2044bdc
CURRENT_HEAD=3e0fdfc609d6ca67cedfe86614110452b2044bdc
BRANCH=main
WORKTREE=dirty_expected
COMMIT=NO
PUSH=NO
MERGE=NO
DEPLOY=NO
```

## Parte 1 - UX Riesgos y Procesos Automatizados

Root cause: las superficies de Riesgos y procesos automatizados exponian detalle tecnico y flujo de trabajo con IDs internos, lo que obligaba al usuario a operar con conocimiento del sistema.

Solucion:

- `/riesgos` conserva el contexto con drawer lateral, backdrop sutil, cierre por Esc/clic exterior y foco accesible.
- El detalle de riesgo mantiene contexto funcional y evita ruido tecnico.
- "Instancias y transiciones" usa selector tenant-scoped de entidades compatibles.
- Backend expone `GET /api/grc/workflow-entity-options` y `GET /api/grc/workflow-instances` como proyecciones de lectura.
- Creacion, transiciones e historial preservan los contratos reales de workflow.
- RBAC se mantiene con `workflow.read`, `workflow.manage` y `workflow.transition`.

Archivos:

- `frontend/src/components/risk-control/RiskRegisterWorkspace.tsx`
- `frontend/src/components/grc/GrcPhase1Panel.tsx`
- `backend/src/routes/grc.routes.js`
- `backend/src/services/grc/grc.service.js`
- `backend/src/services/grc/grc.service.test.js`
- `frontend/scripts/check-market-readiness-part1-ux-workflows-contract.mjs`
- `docs/codex/handoffs/MARKET-READINESS-PART-1-UX-WORKFLOWS.md`

Tests PASS:

- `node backend/src/services/grc/grc.service.test.js`
- `node backend/src/services/grc/grcPhase1Core.test.js`
- `node scripts/check-market-readiness-part1-ux-workflows-contract.mjs` desde `frontend/`

## Parte 2 - Scheduler Phase 2 y Politicas

Root cause: el runner programado ejecutaba conectores tenant-scoped sin rol interno de plataforma, mientras `runConnector` exige disponibilidad segun rol/feature; eso convertia conectores no disponibles en `CONNECTOR_NOT_AVAILABLE` repetitivo y error global.

Solucion:

- Scheduler Phase 2 corre como worker interno con rol `platform_admin`.
- Cada conector se procesa y clasifica individualmente como `success`, `disabled`, `misconfiguration`, `dependency_unavailable` o `failure`.
- `CONNECTOR_NOT_AVAILABLE` esperado por feature gate queda como conector `disabled` y no como `PHASE2_SCHEDULER_ERROR` global repetitivo.
- Los fallos reales siguen visibles por estado, `last_error_code`, reprogramacion y observabilidad.
- Lock global `running` e idempotency key por worker/conector/minute bucket se preservan.
- El ciclo continua con otros tenants/conectores ante fallos parciales.
- Politicas de avisos y escalamiento no piden codigo tecnico; backend genera codigo interno tenant-scoped.
- Nombre funcional persiste en `recipient_config.display_name`.
- UI muestra nombre, aplicacion funcional, horas validas, politicas guardadas y confirmacion antes de ejecutar.
- RBAC se mantiene con `workflow.read`, `grc.escalation.manage` y `grc.scheduler.run`.

Archivos:

- `backend/src/services/grc/phase2SchedulerRunner.js`
- `backend/src/services/grc/grc.service.js`
- `frontend/src/components/grc/GrcPhase1Panel.tsx`
- `backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js`
- `docs/codex/handoffs/MARKET-READINESS-PART-2-SCHEDULER.md`

Tests PASS:

- `node -c backend/src/services/grc/phase2SchedulerRunner.js`
- `node -c backend/src/services/grc/grc.service.js`
- `node -c backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js`
- `node backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js`
- `node backend/src/services/grc/phase2Core.test.js`

## Parte 3 - AI Engine e Intelligence Brief

Root cause AI: `buildTenantIntelligenceBrief` construia un brief deterministico util, pero despues esperaba sincronicamente `generateNarratives(...)`; el cliente del AI Engine usa timeout de 12000 ms para `/api/ai/intelligence/narrative`, por lo que un timeout demoraba toda la respuesta aunque el fallback deterministico ya existia.

Solucion:

- La ruta de Intelligence Brief devuelve contenido base deterministico sin esperar el timeout del AI Engine.
- La narrativa asistida se ejecuta como refresh en background y actualiza la cache tenant-scoped cuando termina.
- Requests duplicados para el mismo tenant/locale/modo AI se deduplican con una promesa en memoria por cache key.
- La cache existente se reutiliza; no se agrega Redis, store nuevo ni segundo orquestador.
- Si AI responde correctamente, el siguiente refresh/cache hit entrega narrativa enriquecida con `ai_used=true`.
- Si AI timeout/unavailable/output invalido, el brief conserva fallback util con `fallback_used=true`, `ai_used=false` y razon interna.
- El frontend mantiene contenido base visible y hace polling discreto limitado cuando `ai_pending=true`.
- La UI no muestra `AI_ENGINE_TIMEOUT`, proveedor, modelo, stack, retry tecnico ni 504.

Arquitectura:

- Cache key: tenant-scoped por `tenantId`, `locale` y modo AI.
- Dedupe: `aiNarrativeRefreshes` por cache key, sin contaminacion cross-tenant.
- Refresh: background sobre el brief deterministico ya calculado.
- Fallback: deterministico y no etiquetado como IA.
- Observabilidad: `INTELLIGENCE_BRIEF_EVENT` conserva `ai_used`, `fallback_used`, `latency_ms`, `cache_status`, `confidence`, coverage y `error_code` para fallos reales.

Performance:

- La primera respuesta con AI habilitada ya no espera los 12000 ms del cliente AI.
- Test focal valida retorno base en menos de 250 ms con AI simulado lento.
- Timeouts de AI siguen ocurriendo en background, quedan observados y no bloquean contenido base.

Archivos:

- `backend/src/services/intelligence/intelligence.service.js`
- `backend/src/services/intelligence/intelligence.ai-orchestrator.js`
- `backend/src/services/intelligence/intelligence.service.test.js`
- `frontend/src/hooks/useIntelligenceBrief.ts`
- `frontend/src/components/intelligence/ExecutiveIntelligenceBrief.tsx`
- `frontend/src/components/intelligence/types.ts`

Tests PASS:

- `node -c backend/src/services/intelligence/intelligence.service.js`
- `node -c backend/src/services/intelligence/intelligence.ai-orchestrator.js`
- `node -c backend/src/services/intelligence/intelligence.service.test.js`
- `node backend/src/services/intelligence/intelligence.service.test.js`
- `node backend/src/services/intelligence/crossGrcIntelligence.service.test.js`
- `node backend/src/services/intelligence/aiGovernanceEvaluation.service.test.js`
- `node backend/src/services/knowledge-base/knowledgeRag.service.test.js`

## Seguridad y Arquitectura

- Multi-tenant preservado: GRC selectors, scheduler, escalation policies e Intelligence Brief mantienen filtros por tenant.
- RBAC preservado: no se debilitaron permisos de GRC, scheduler, escalation ni Intelligence.
- Schema: sin cambios DDL.
- Migrations: no se agregaron ni modificaron migraciones historicas.
- Health: formulas y autoridad canonica no modificadas.
- Autoridad comercial: no modificada.
- Autoridad IA: no modificada; fallback no se presenta como contenido generado por IA.
- No se introdujo source of truth paralelo para workflow, scheduler, KB, RAG, Intelligence ni AI.

## Validacion Consolidada

Comandos ejecutados con resultado PASS:

```text
pwd
git branch --show-current
git rev-parse HEAD
git status --short
node -c backend/src/services/intelligence/intelligence.service.js
node -c backend/src/services/intelligence/intelligence.ai-orchestrator.js
node -c backend/src/services/intelligence/intelligence.service.test.js
node backend/src/services/intelligence/intelligence.service.test.js
node backend/src/services/intelligence/crossGrcIntelligence.service.test.js
node backend/src/services/intelligence/aiGovernanceEvaluation.service.test.js
node backend/src/services/knowledge-base/knowledgeRag.service.test.js
node backend/src/services/grc/grc.service.test.js
node backend/src/services/grc/grcPhase1Core.test.js
node backend/src/services/grc/phase2Core.test.js
node backend/src/middleware/rbac.middleware.test.js
node backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js
node scripts/check-market-readiness-part1-ux-workflows-contract.mjs
npm --prefix backend run check
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
git diff --check
```

Build:

```text
FRONTEND_BUILD=PASS
```

## Human Review Micro-Closeout

Defecto scheduler stale health/error:

- Problema: `scheduleNext(...)` reprogramaba success sin limpiar `health_status` ni `last_error_code`; un conector recuperado podia seguir apareciendo como `failed` o `disabled`.
- Correccion: success ahora actualiza `health_status='healthy'`, limpia `last_error_code=NULL`, reprograma `next_sync_at` y actualiza `updated_at`.
- Estado saludable canonico usado: `healthy`, confirmado en `grc_connector_instances.health_status` y en `phase2.service.js`.
- Los estados `disabled`, `misconfiguration`, `dependency_unavailable` y `failure` mantienen semantica previa.

Defecto scheduler unknown status:

- Problema: `classifyConnectorRun(result)` clasificaba cualquier estado no reconocido como `success`.
- Correccion: solo `completed`, `completed_with_warnings` y `reused === true` son success; estados desconocidos caen en `failure`.

Defecto AI polling cross-context:

- Problema: `aiRefreshAttemptsRef` podia sobrevivir a cambio de tenant/contexto si el hook seguia montado.
- Correccion: `useIntelligenceBrief` registra contexto `tenantId:locale:ai`; al cambiar contexto cancela timer pendiente, aborta request anterior y resetea attempts a `0`.
- Limite preservado: maximo 5 intentos, sin aumentar frecuencia ni cambiar arquitectura AI.

Tests micro-closeout PASS:

```text
node -c backend/src/services/grc/phase2SchedulerRunner.js
node -c backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js
node backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js
node scripts/check-market-readiness-ai-polling-contract.mjs
```

Resultado final:

```text
HUMAN_REVIEW_MICRO_CLOSEOUT=READY
NEXT_GATE=HUMAN_REVIEW_FINAL_APPROVAL_FOR_COMMIT
```

## Deuda

```text
DEBT_WITHIN_SCOPE=NONE
```

## Riesgos Residuales

- Validacion runtime del AI Engine/proveedor real queda para el gate humano y deploy autorizado; no bloquea el cierre porque el contenido base ya no depende del timeout y la indisponibilidad queda observada.
- Los cambios estan sin commit por instruccion explicita.

## Proximo Gate

```text
HUMAN_REVIEW_MARKET_READINESS_BEFORE_COMMIT
```
