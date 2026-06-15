# IA.2 - Decision para IA.3

Fecha: 2026-06-15
Rama: `chore/ia2-backend-contract-traceability`

## 1. Mapa de valor util de `/ia`

| Valor en `/ia` | Migrar a `/ia-compliance` | Migrar a `/ia-compliance/sugerencias` | Descartar | Motivo |
|---|---:|---:|---:|---|
| Accion recomendada | Si | Si, si se persiste como sugerencia revisable | No | `accion` aporta valor comercial, pero debe mostrarse como recomendacion pendiente, no como cierre automatico. |
| Evidencia sugerida | Si | Si | No | `evidencia` es util para orientar evidencia esperada; debe etiquetarse como sugerencia y no como evidencia aceptada. |
| Prioridad por estado | Si | No necesariamente | No | `prioridad` es deterministica y puede alimentar ordenamiento de controles en atencion. |
| Explicacion auditor | Si | No necesariamente | No | `auditor_explicacion` puede servir como texto auxiliar si se declara deterministico. |
| Resumen ejecutivo | No desde `/ia` | No | Si como valor legacy | El backend legacy no devuelve `summary`; `/ia-compliance` ya cubre resumen ejecutivo. |
| Riesgos principales | No desde `/ia` | No | Si como valor legacy | El backend legacy no devuelve `topRisks`; `/ia-compliance/health-summary` ya cubre controles y hallazgos criticos. |
| Recomendaciones por control | Si | Si, si se guardan como sugerencias por control | No | Es el valor principal no paritario, pero requiere contrato nuevo y trazabilidad/fuente. |
| Aplicacion directa de recomendacion | No | No | Si | `PUT /api/ai/apply/:tenant_control_id` debe reemplazarse por borrador revisable de plan de accion. |

## 2. Recomendacion unica IA.3

Recomendacion priorizada: **Opcion IA.3-C - Reemplazar aplicacion directa por borrador de plan de accion**.

Esta opcion debe ejecutarse antes de archivar `/ia` porque el mayor riesgo de la
superficie legacy no es la pantalla, sino el contrato `PUT /api/ai/apply` dentro
de la misma familia `/api/ai`.

Orden recomendado para IA.3:

1. Bloquear la migracion de `PUT /api/ai/apply/:tenant_control_id` hacia
   `/ia-compliance`.
2. Definir un contrato seguro para convertir recomendaciones por control en
   borradores revisables, preferentemente usando `ai_suggestions` y/o plan de
   accion draft.
3. Mapear solo lectura de `accion`, `evidencia`, `prioridad`,
   `auditor_explicacion`, `tenant_control_id`, `status`, `iso` y `clause`.
4. Etiquetar el origen como deterministico desde DB interna o agregar trace si
   se reimplementa con IA Compliance v2.
5. Cuando el valor util quede cubierto o descartado, archivar `/ia` en una fase
   posterior con guard actualizado.

## 3. Opciones descartadas

| Opcion | Estado IA.2 | Motivo |
|---|---|---|
| IA.3-A - Migracion minima de contrato | No recomendada como primera accion | Hay drift de shape y no existe trazabilidad/entitlement backend uniforme en `/api/ai`. |
| IA.3-B - Bloquear `/ia` y archivar despues | Prematura | Hay valor util por control no paritario: accion, evidencia, prioridad y explicacion. |
| IA.3-D - Mantener `/ia` temporalmente | Solo como estado transitorio | Puede mantenerse oculta mientras IA.3 reemplaza apply directo y decide contrato de lectura. |

## 4. Decision operativa

IA.2 no cierra `/ia`. IA.2 deja preparado el cierre futuro con estas reglas:

- no mover ni borrar `/ia` hasta que IA.3 resuelva el flujo de aplicacion;
- no usar `PUT /api/ai/apply/:tenant_control_id` como camino MVP;
- si se conserva valor de `/ia`, hacerlo mediante contrato trazable o
  deterministico explicito;
- si se descarta valor de `/ia`, documentar paridad funcional con
  `/ia-compliance` antes de archivar.

## 5. Validaciones ejecutadas

| Validacion | Resultado | Evidencia |
|---|---|---|
| `git status --short --branch` inicial | PASS | Rama `chore/ia2-backend-contract-traceability`; solo cambios docs IA.2 antes de commit. |
| `git pull --ff-only origin main` | WARN | Fallo por `Permission denied (publickey)` incluso con ejecucion escalada. Se continuo desde `main` local, que reporto estar alineada con `origin/main` local al checkout. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Guard oficial con `rg`; `/ia` sigue fuera de MVP y controlada por rutas ocultas. |
| `PATH="/usr/bin:/bin:/usr/sbin:/sbin" bash scripts/qa/qa-official-surface.sh` | PASS | Guard oficial con fallback sin `rg`. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Inventario cleanup completo; sin SQL, sin borrados, sin tokens. |
| `cd frontend && npm run lint` | PASS | 0 errores, 636 warnings existentes. |
| `cd frontend && npm run check` | PASS | Next build OK; 42 paginas generadas. |
| `cd frontend && npx tsc --noEmit --pretty false` | PASS | TypeScript sin salida de error. |
| `cd backend && npm test` | PASS | Ejecuta `npm run check`; `node -c src/app.js` OK. |
| `python3 -m compileall -q ai-engine` | PASS | Compileall sin salida de error. |
| `bash scripts/env-check.sh` | WARN esperado | 46 WARN, 0 FAIL; exit code 3 por resultado WARN local sin variables cargadas. |
| `git diff --check` | PASS | Sin errores de whitespace. |
