# MARKET READINESS PART 2 — Scheduler Phase 2 + Politicas de Avisos y Escalamiento

## Estado

```text
BASE_COMMIT=3e0fdfc609d6ca67cedfe86614110452b2044bdc
CURRENT_HEAD=3e0fdfc609d6ca67cedfe86614110452b2044bdc
WORKTREE=dirty_expected
COMMIT=NO
PUSH=NO
MERGE=NO
DEPLOY=NO
```

## Continuidad Parte 1

- Parte 1 preservada sobre el mismo worktree sin reset, stash ni cambio de rama.
- Handoff Parte 1 leido: `docs/codex/handoffs/MARKET-READINESS-PART-1-UX-WORKFLOWS.md`.
- Se preservan los cambios Parte 1 en:
  - `backend/src/routes/grc.routes.js`
  - `backend/src/services/grc/grc.service.js`
  - `backend/src/services/grc/grc.service.test.js`
  - `frontend/src/components/grc/GrcPhase1Panel.tsx`
  - `frontend/src/components/risk-control/RiskRegisterWorkspace.tsx`
  - `frontend/scripts/check-market-readiness-part1-ux-workflows-contract.mjs`
  - `docs/codex/handoffs/MARKET-READINESS-PART-1-UX-WORKFLOWS.md`
  - `docs/codex/CURRENT_STATE.md`
  - `docs/codex/WORK_QUEUE.md`
  - `docs/codex/CONTRACTS_REGISTRY.md`
  - `docs/codex/ARCHITECTURE_MAP.md`

## Root Cause Phase 2

El runner programado ejecutaba conectores tenant-scoped sin rol interno de plataforma, mientras `runConnector` exige disponibilidad segun rol/feature; eso convertia conectores no disponibles en `CONNECTOR_NOT_AVAILABLE` repetitivo y error global.

## Clasificacion

```text
tenant_specific / feature_gated / internal_worker_authorized
```

- Los conectores siguen siendo tenant-scoped por `grc_connector_instances.tenant_id`.
- La disponibilidad tenant/user-facing sigue feature-gated por la autoridad de `runConnector`.
- El scheduler corre como worker interno autorizado con rol `platform_admin`.
- `CONNECTOR_NOT_AVAILABLE` en este contexto se clasifica como `disabled`, se observa por conector y se reprograma a 1440 minutos.

## Solucion

- `backend/src/services/grc/phase2SchedulerRunner.js` ejecuta conectores vencidos con `role: 'platform_admin'`.
- El ciclo global conserva locking por proceso con `running` y libera el lock en `finally`.
- Cada conector se ejecuta y clasifica de forma independiente:
  - `success`
  - `disabled`
  - `misconfiguration`
  - `dependency_unavailable`
  - `failure`
- `CONNECTOR_NOT_AVAILABLE` ya no derriba el ciclo global ni emite spam `PHASE2_SCHEDULER_ERROR`.
- Errores reales quedan visibles como `partial_failure` cuando hay `misconfiguration`, `dependency_unavailable` o `failure`.
- `scheduleNext` reprograma cada conector con intervalo normal, retry provider si existe, o backoff de 24h para `disabled`.
- La observabilidad usa `phase2_scheduler_connector` por tenant/conector con `status` y `errorCode`.
- La busqueda de conectores vencidos mantiene `tenant_module_settings` y `tenant_id` en la seleccion; las actualizaciones son por `tenant_id` + `id`.
- La idempotencia usa worker id normalizado, connector id y bucket minuto.
- `42P01`/`42703` se reportan como `dependency_unavailable` del scheduler sin spam global.

## UX Politicas

- La UI muestra `Politica de avisos y escalamiento`.
- El usuario configura nombre funcional, aplicacion, aviso previo y reescalamiento.
- La UI no pide ni envia codigo tecnico de politica.
- Backend genera codigo interno por `entity_type` y persiste el nombre visible en `recipient_config.display_name`.
- `listEscalationPolicies` expone `display_name` funcional sin requerir `evidence-default`.
- `entity_type` permitido queda acotado a `evidence_request`, `action`, `audit_followup` y `audit`.
- Horas validas: `0..8760`; `0` es valido, valores vacios no son validos en UI.
- RBAC preservado:
  - lectura de politicas: `workflow.read`;
  - creacion de politicas: `grc.escalation.manage`;
  - ejecucion manual: `grc.scheduler.run`.
- `Ejecutar ahora` exige confirmacion y envia tareas explicitas: `evidence_requests`, `reminders_expirations`, `escalations`, `action_followup`.

## Tests

- `node -c backend/src/services/grc/phase2SchedulerRunner.js`: PASS
- `node -c backend/src/services/grc/grc.service.js`: PASS
- `node -c backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js`: PASS
- `node backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js`: PASS (`MARKET_READINESS_PART2_SCHEDULER_POLICIES_TEST=PASS`)
- `node scripts/check-market-readiness-part1-ux-workflows-contract.mjs` desde `frontend/`: PASS (`MARKET_READINESS_PART1_UX_WORKFLOWS_CONTRACT_PASS`)
- `npm --prefix backend run check`: PASS
- `npm --prefix frontend run typecheck`: PASS
- `npm --prefix frontend run lint`: PASS
- `git diff --check`: PASS

## Archivos

Archivos Parte 1 preservados:

- `backend/src/routes/grc.routes.js`
- `backend/src/services/grc/grc.service.js`
- `backend/src/services/grc/grc.service.test.js`
- `frontend/src/components/grc/GrcPhase1Panel.tsx`
- `frontend/src/components/risk-control/RiskRegisterWorkspace.tsx`
- `frontend/scripts/check-market-readiness-part1-ux-workflows-contract.mjs`
- `docs/codex/handoffs/MARKET-READINESS-PART-1-UX-WORKFLOWS.md`

Archivos modificados/agregados Parte 2:

- `backend/src/services/grc/phase2SchedulerRunner.js`
- `backend/src/services/grc/grc.service.js`
- `frontend/src/components/grc/GrcPhase1Panel.tsx`
- `backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js`
- `docs/codex/handoffs/MARKET-READINESS-PART-2-SCHEDULER.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`

## Deuda

```text
NONE
```

## Continuidad Parte 3

- Estado: `READY_FOR_PART_3`.
- Siguiente gate: `CODEX_MARKET_READINESS_PART_3`.
- No se ejecuto validacion manual/browser real; por instruccion del paquete, la validacion humana se hara despues de Parte 3.
- No se hizo commit, push, merge ni deploy.
