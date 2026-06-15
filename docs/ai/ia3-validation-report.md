# IA.3-C - Validation report

Fecha: 2026-06-15
Rama: `chore/ia3-replace-ai-apply-with-action-draft`

## 1. Validaciones de base

| Validacion | Resultado | Evidencia |
|---|---|---|
| `git status --short --branch` inicial | PASS | Rama inicial `main`, working tree limpio. |
| `git log --oneline --decorate -12` | PASS | `main` local contiene merge IA.2 `c139bf4`, commit IA.2 `cfb9ec2` y B.8 `05de4d4`. |
| `git branch --contains cfb9ec2` | PASS | `main` y `chore/ia2-backend-contract-traceability` contienen IA.2. |
| `git branch --contains 05de4d4` | PASS | `main`, B.8, IA.1 e IA.2 contienen B.8. |
| `git pull --ff-only origin main` | WARN | Fallo por `Permission denied (publickey)` en ejecucion normal y escalada. Se continuo desde `main` local con B.8 e IA.2 integrados. |

## 2. Validaciones de consumidores

| Validacion | Resultado | Evidencia |
|---|---|---|
| `grep -R --exclude-dir=node_modules --exclude-dir=.next "api/ai/apply" -n frontend backend docs scripts` | PASS | Consumidor runtime detectado: `frontend/src/app/matriz-riesgo/page.tsx`; referencias documentales historicas. |
| `grep -R --exclude-dir=node_modules --exclude-dir=.next "apply/:tenant_control_id" -n backend frontend docs scripts` | PASS | Definicion runtime detectada: `backend/src/routes/ai.routes.js`; referencias documentales. |
| `grep -R --exclude-dir=node_modules --exclude-dir=.next "auditor_explicacion" -n backend frontend docs scripts` | PASS | Campo runtime detectado en `backend/src/routes/ai.routes.js`; referencias IA.2. |
| `cd backend && node -c src/routes/ai.routes.js` | PASS | Sintaxis valida tras modificar backend. |

## 3. Validaciones obligatorias

| Validacion | Resultado | Evidencia |
|---|---|---|
| `git status --short --branch` | PASS | Rama `chore/ia3-replace-ai-apply-with-action-draft`; cambios esperados antes de commit. |
| `bash scripts/qa/qa-official-surface.sh` | PASS | Guard oficial con `rg`; `/ia` sigue controlada fuera de MVP. |
| `PATH="/usr/bin:/bin:/usr/sbin:/sbin" bash scripts/qa/qa-official-surface.sh` | PASS | Guard oficial sin `rg`. |
| `bash scripts/qa/qa-cleanup-stage-1-inventory.sh` | PASS | Inventario completo; no ejecuto SQL ni leyo secretos. |
| `cd frontend && npm run lint` | PASS | 0 errores, 636 warnings existentes. |
| `cd frontend && npm run check` | PASS | Next build OK; 42 paginas generadas. |
| `cd frontend && npx tsc --noEmit --pretty false` | PASS | TypeScript sin salida de error. |
| `cd backend && npm test` | PASS | Ejecuta `npm run check`; `node -c src/app.js` OK. |
| `cd backend && node -c src/routes/ai.routes.js` | PASS | Sintaxis directa del route modificado OK. |
| `python3 -m compileall -q ai-engine` | PASS | Compileall sin salida de error. |
| `bash scripts/env-check.sh` | WARN esperado | 46 WARN, 0 FAIL; exit code 3 por variables locales no cargadas. |
| `git diff --check` | PASS | Sin errores de whitespace antes de staging. |
| `git diff --check --staged` | PASS | Sin errores de whitespace en el staged set antes del commit. |

## 4. Resultado funcional esperado

| Caso | Resultado esperado |
|---|---|
| `PUT /api/ai/apply/:tenant_control_id` con rol permitido y control en alcance | Devuelve `AI_ACTION_DRAFT_CREATED` o `AI_ACTION_DRAFT_REUSED` con `action_plan_id`; no modifica control, NC ni evidencia. |
| `PUT /api/ai/apply/:tenant_control_id` con auditor | Devuelve `AI_ACTION_DRAFT_FORBIDDEN` o queda bloqueado por RBAC global. |
| Control fuera de alcance operativo | Devuelve `AI_ACTION_DRAFT_OUT_OF_SCOPE`. |
| `/matriz-riesgo` | El boton comunica "Crear borrador IA" y el exito muestra revision humana. |
| `/ia` | La pantalla mantiene layout y comunica que IA no aplica cambios directamente. |
