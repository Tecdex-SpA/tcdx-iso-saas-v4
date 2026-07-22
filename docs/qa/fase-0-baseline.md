# Fase 0 — Baseline técnico

- Fecha UTC: 2026-07-22T17:08:44Z
- Rama: `codex/fase-0-verdad-operacional-linea-base`
- SHA: `29d2247d1555dd1c858b2a5b5406cc42dd5f16d4`
- Node.js: registrado en `artifacts/fase-0/baseline/` durante preflight
- Observación: AI Engine declara Python >=3.10 en `ai-engine/requirements.txt`; el Python local detectado fue 3.9.6, por lo que validaciones Python completas requieren entorno compatible.

| Componente | Comando | Resultado inicial | Evidencia |
|---|---|---|---|
| git_status | `git_status` | OK | `artifacts/fase-0/baseline/git_status.log` |
| backend_check | `npm --prefix backend run check` | OK | `artifacts/fase-0/baseline/backend_check.log` |
| backend_test | `npm --prefix backend test` | OK | `artifacts/fase-0/baseline/backend_test.log` |
| frontend_lint | `npm --prefix frontend run lint` | OK | `artifacts/fase-0/baseline/frontend_lint.log` |
| frontend_check | `npm --prefix frontend run check` | OK | `artifacts/fase-0/baseline/frontend_check.log` |
| frontend_build | `npm --prefix frontend run build` | OK | `artifacts/fase-0/baseline/frontend_build.log` |
| playwright_version | `playwright_version` | OK | `artifacts/fase-0/baseline/playwright_version.log` |
| playwright_test | `npx playwright test` | FAILED | `artifacts/fase-0/baseline/playwright_test.log` |
| git_diff_check | `git_diff_check` | OK | `artifacts/fase-0/baseline/git_diff_check.log` |

## Resultado

Baseline backend/frontend: OK para lint/check/test/build existentes.  
Playwright: FAILED porque no existen tests configurados (`No tests found`). Esto bloquea Fase 0 por los 12 recorridos E2E obligatorios.
