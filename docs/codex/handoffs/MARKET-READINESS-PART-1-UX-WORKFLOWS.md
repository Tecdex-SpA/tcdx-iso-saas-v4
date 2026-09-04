# MARKET READINESS PART 1 — UX Riesgos + Procesos Automatizados

## Estado

- `BASE_COMMIT`: `3e0fdfc609d6ca67cedfe86614110452b2044bdc`
- Rama: `main`
- Estado de entrega: `READY_FOR_PART_2`
- Commit/push/merge/deploy: `NO`
- Worktree antes de iniciar: limpio.

## Alcance cerrado

- `/riesgos`: se mantiene el drawer lateral derecho y se corrige el backdrop dominante que destruia el contexto visual.
- `/configuracion` modo procesos automatizados: "Instancias y transiciones" deja de pedir UUID/ID de entidad al usuario.
- Se agrega selector tenant-scoped de entidades compatibles con la definicion activa del proceso.
- Se agrega consulta de instancias recientes/buscables por proceso o etiqueta humana, sin pedir ID de instancia.

## Root Causes

- Riesgos: el drawer usaba `bg-slate-950/35`, visualmente dominante para una vista contextual.
- Instancias: `startWorkflow` exige `definition_id`, `entity_type` y `entity_id` UUID real; la UI exponia `ID de entidad` y permitia texto libre, produciendo `GRC_ID_REQUIRED`.

## Autoridades y contratos reutilizados

- Workflow runtime canónico: `backend/src/services/grc/grc.service.js`.
- Adaptadores compatibles: `backend/src/services/grc/grcRuntimeAdapters.js` (`document`, `evidence`, `control`, `risk`, `audit`, `finding`, `nonconformity`, `action`).
- Definiciones, estados, transiciones, historial y aprobaciones siguen en las tablas `grc_workflow_*`.
- RBAC preservado:
  - lectura de definiciones/opciones/instancias: `workflow.read`;
  - creación/transiciones: `workflow.transition`;
  - gestión de definiciones/bootstrap: `workflow.manage`.
- Tenant scope preservado con `tenant_id = $1::uuid` en las nuevas lecturas y validación de definición activa del mismo tenant.

## Comportamiento nuevo

- Riesgos:
  - backdrop reducido a `bg-slate-950/5`;
  - drawer desktop en `min(540px, calc(100vw - 24px))`;
  - scroll interno y focus trap existentes conservados;
  - `Esc`, clic exterior y retorno de foco conservados;
  - se deja de mostrar `stableKey` en el encabezado del drawer;
  - la sección IA sólo se muestra para riesgo cuantitativo, donde ya existe deep link real.
- Procesos automatizados:
  - campo visible `Proceso`;
  - campo visible `Aplicar a` con busqueda y selector;
  - la busqueda no sustituye la entidad: la creación usa `selectedEntity.id`;
  - la etiqueta humana se guarda en `context.entity_label` como snapshot de presentación;
  - consulta de instancias recientes por proceso/entidad/estado sin UUID visible;
  - instancia compacta con proceso, entidad, estado actual, fecha y acciones disponibles;
  - historial persistido con fecha, transición/acción, usuario, comentario y estado resultante;
  - errores runtime con códigos técnicos se convierten en mensaje funcional.

## Archivos modificados

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

## Validaciones ejecutadas

- `node -c backend/src/services/grc/grc.service.js`: PASS
- `node -c backend/src/routes/grc.routes.js`: PASS
- `npm --prefix backend run check`: PASS
- `node backend/src/services/grc/grc.service.test.js`: PASS
- `node backend/src/services/grc/grcPhase1Core.test.js`: PASS
- `npm --prefix frontend run typecheck`: PASS
- `npm --prefix frontend run lint`: PASS
- `node scripts/check-market-readiness-part1-ux-workflows-contract.mjs` desde `frontend/`: PASS
- `git diff --check`: PASS

## Preservado

- No se modifican migraciones históricas.
- No se modifica schema.
- No se modifica RBAC.
- No se modifica Health.
- No se modifica autoridad comercial.
- No se modifica autoridad IA.
- No se toca Scheduler Phase 2 root cause ni performance de AI Engine.
- No se cambia semantica de evidencia ni de transiciones.

## Riesgos y deuda

- `EvidenceOperationsPanel` conserva campos de ID para vinculos de evidencia; queda fuera de Parte 1 porque el objetivo fue "Instancias y transiciones".
- No se ejecuto validación manual/browser real; por instrucción del paquete, las pruebas manuales se harán despues de Parte 3.
- Scheduler Phase 2 `CONNECTOR_NOT_AVAILABLE` y timeout de AI Engine quedan para partes posteriores.

## Continuidad Parte 2

- Preservar todos los cambios no commiteados de Parte 1.
- No reabrir el hotfix SQL alias scope salvo regresión objetiva.
- No reabrir formulas, Health, RBAC, autoridad comercial ni autoridad IA.
- Siguiente gate: `CODEX_MARKET_READINESS_PART_2`.
