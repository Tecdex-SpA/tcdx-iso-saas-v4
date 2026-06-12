# Cleanup B.7 final frontend quarantine

Fecha: 2026-06-12
Rama: `chore/cleanup-b7-final-frontend-quarantine`
Commit base: `4953ce2`

## Resumen ejecutivo

B.7 revalido las dos rutas candidatas y aplico el criterio de no mover ante
referencias vivas o funcionalidad no cubierta. `/dashboard-v2` conserva
contratos QA/demo vigentes y `/ia` mantiene una interfaz funcional sobre un
contrato distinto de IA Compliance. `/ejecucion-iso` y `/documentos`
permanecen activas de acuerdo con la decision B.6.

No se movieron ni borraron paginas. El guard oficial ahora exige de forma
explicita que las cuatro rutas retenidas sigan presentes y controladas fuera de
la superficie cliente MVP.

| Ruta | Estado B.6 | Accion B.7 | Ubicacion final | Motivo | Rollback |
| ---- | ---------- | ---------- | --------------- | ------ | -------- |
| `/dashboard-v2` | `ready_for_b7_quarantine` | `kept_temporarily` | `frontend/src/app/dashboard-v2/page.tsx` | Validadores y docs QA/demo vigentes aun esperan el redirect. | No aplica; no hubo movimiento. |
| `/ia` | `merge_into_mvp_then_quarantine` | `blocked_pending_mvp_merge` | `frontend/src/app/ia/page.tsx` | La UI y `GET /api/ai/recommendations/:tenantId` no tienen paridad demostrada en IA Compliance. | No aplica; no hubo movimiento. |
| `/ejecucion-iso` | `keep_enterprise_post_mvp` | `kept_enterprise_post_mvp` | `frontend/src/app/ejecucion-iso/page.tsx` | Superficie enterprise funcional con generacion y aprobacion humana. | No aplica; no hubo movimiento. |
| `/documentos` | `requires_backend_contract_review` | `blocked_by_backend_contract_review` | `frontend/src/app/documentos/page.tsx` | Conserva deep links y contratos persistentes backend/frontend. | No aplica; no hubo movimiento. |

## Cambios realizados

- Se reemplazo la lectura del manifest basada en Node por `awk`, de modo que el
  guard funcione con el `PATH` minimo sin `rg` solicitado.
- Se agrego validacion de existencia para los cinco bloques de permisos usados
  por el guard antes de evaluar rutas.
- Se agrego al guard una verificacion explicita de presencia y control para las
  cuatro rutas retenidas.
- Se documentaron referencias, cobertura MVP y decisiones B.7.
- Se mantuvo `frontend/legacy-pages-archive` sin exclusiones de TypeScript o
  ESLint por ausencia de impacto demostrado.

## Cambios no realizados

- No se movieron `/dashboard-v2`, `/ia`, `/ejecucion-iso` ni `/documentos`.
- No se modificaron paginas, backend, base de datos, AI Engine, agent, OAuth,
  Zoho, Sync Agent, traces, external lookup ni configuracion del toolchain.

## Validaciones

| Comando | Resultado | Observacion |
| ------- | --------- | ----------- |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Las 10 rutas MVP y las cuatro rutas retenidas quedaron verificadas. |
| `PATH="/usr/bin:/bin:/usr/sbin:/sbin" bash scripts/qa/qa-official-surface.sh` | PASS | Fallback sin `rg` ni Node externo; todos los checks se ejecutaron. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | `qa-results` ausente, cero `token.txt` y cero `.DS_Store`. |
| `cd frontend && npm run lint` | PASS | 0 errores y 636 warnings preexistentes. |
| `cd frontend && npm run check` | PASS | Next genero 42 paginas; se mantienen `/dashboard-v2` y `/ia` por los bloqueos documentados. |
| `cd frontend && npx tsc --noEmit --pretty false` | PASS | Sin salida de error. |
| `cd backend && npm test` | PASS | Check de sintaxis de `src/app.js`. |
| `python3 -m compileall -q ai-engine` | PASS | Sin salida de error. |
| `bash scripts/env-check.sh` | WARN aceptable | 46 WARN, 0 FAIL; variables locales no cargadas. |
| `git diff --check` | PASS | Sin errores de whitespace. |

## Rollback

Como no hubo movimientos de paginas, el rollback consiste en revertir los
cambios documentales y el check B.7 agregado a
`scripts/qa/qa-official-surface.sh`, o revertir el commit B.7 completo.
