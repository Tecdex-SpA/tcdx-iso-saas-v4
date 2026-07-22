# Fase 0 — Execution Ledger

- Ciclo: 2026-07-22T17:08:44Z
- SHA: `29d2247d1555dd1c858b2a5b5406cc42dd5f16d4`
- Rama: `codex/fase-0-verdad-operacional-linea-base`
- Responsable: Codex

| ID | Épica | Entregable o criterio | Estado | Evidencia | Bloqueo | Próxima acción | Punto de reanudación |
|---|---|---|---|---|---|---|---|
| F0-PRE-001 | Preflight | Ruta, remoto, rama base y SHA verificados | verified_local | preflight shell output |  | Continuar en rama creada | git status --short --branch |
| F0-BAS-001 | Baseline | Backend check/test y frontend lint/check/build | verified_local | docs/qa/fase-0-baseline.md; artifacts/fase-0/baseline/results.csv |  | Mantener como baseline inicial | npm --prefix backend test && npm --prefix frontend run build |
| F0-E2E-001 | E2E | Playwright configurado con 12 recorridos críticos | verified_local | artifacts/fase-0/baseline/playwright_test.log | No hay tests: No tests found | Crear fixtures QA y tests E2E-01..E2E-12 | docs/qa/fase-0-e2e-test-plan.md |
| F0-CAP-001 | Inventario | Catálogo único de capacidades y matriz inicial | verified_local | config/capabilities/catalog.json; artifacts/fase-0/capability-matrix.csv | 31 capacidades sin endpoint asociado por heurística | Refinar enlaces ruta-endpoint y completar acciones/permisos/auditoría | scripts/phase0/generate-phase0-inventory.js |
| F0-AUTH-001 | Autorización | Matriz rol-ruta-acción-endpoint-dato | verified_local | config/security/authorization-matrix.json; artifacts/fase-0/authorization-matrix.csv | 176 endpoints sin señal auth y 111 sin tenant signal por análisis estático | Validar dinámicamente middleware/guards y corregir endpoints reales | scripts/phase0/check-phase0-contracts.js |
| F0-TENANT-001 | Aislamiento | Pruebas cross-tenant lectura/escritura/búsqueda/export/files/IA | verified_local | docs/security/fase-0-tenant-isolation-report.md | No hay fixtures ni E2E cross-tenant | Crear seed QA Tenant A/B y suite tenant-isolation | docs/security/fase-0-tenant-isolation-report.md |
| F0-CI-001 | CI | Checks Fase 0 integrados como bloqueantes | verified_local | .github/workflows/ci.yml; backend/package.json | El check integrado falla por brechas reales | Resolver hallazgos antes de habilitar cierre | npm --prefix backend run phase0:check |
| F0-OBS-001 | Observabilidad | Correlation ID/logs/métricas/alertas/dashboard | verified_local | docs/operations/fase-0-observability-runbook.md | No se verificó implementación completa | Auditar backend/AI y agregar observabilidad mínima | docs/operations/fase-0-observability-runbook.md |
| F0-REST-001 | Restore | Backup QA, restore aislado, RPO/RTO medidos | blocked_external | docs/operations/fase-0-restore-test-report.md | No hay DB QA aislada confirmada en este ciclo | Ejecutar restore con DB QA temporal y registrar evidencia | scripts/ops/restore-postgres-smoke-test.sh |

## Ciclo 2026-07-22T17:28:28Z — Baseline decreciente phase0 contracts

- SHA analizado: `730f5da2c237f402dc357e8d4d3703b2964b6335`
- Objetivo: convertir `phase0:contracts:check` en gate de regresión sin cerrar Fase 0.

| ID | Épica | Entregable o criterio | Estado | Evidencia | Bloqueo | Próxima acción | Punto de reanudación |
|---|---|---|---|---|---|---|---|
| F0-CONTRACT-GATE-001 | Contratos | Baseline decreciente de hallazgos contractuales | verified_local | `config/phase0/contract-findings-baseline.json`; `docs/qa/fase-0-contracts-check.md` | Fase 0 sigue abierta con 328 hallazgos baseline | Reducir hallazgos de forma incremental sin aumentar baseline | `npm --prefix backend run phase0:contracts:check` |


## Ciclo 2026-07-22 — Cierre de bloqueantes auth/tenant con baseline reducida

- Rama: `codex/fase-0-cierre-bloqueantes`
- SHA base de rama: `8344fb446a0ba1ad6626750da58fe37c4a28b5d0`
- Objetivo: corregir falsos positivos del detector contractual sin ocultar hallazgos reales ni cerrar Fase 0.

| ID | Epica | Entregable o criterio | Estado | Evidencia | Bloqueo | Proxima accion | Punto de reanudacion |
|---|---|---|---|---|---|---|---|
| F0-CONTRACT-GATE-002 | Contratos | Detector reconoce middleware global `/api` de auth/RBAC y tenant scope | verified_local | `scripts/phase0/generate-phase0-inventory.js`; `config/security/authorization-matrix.json`; `artifacts/fase-0/inventory-summary.json` |  | Mantener detector como gate de regresion | `npm --prefix backend run phase0:inventory` |
| F0-CONTRACT-GATE-003 | Contratos | Baseline reducida de 328 a 41 con trazabilidad de 287 removidos | verified_local | `config/phase0/contract-findings-baseline.json`; `artifacts/fase-0/finding-classification.json`; `docs/security/fase-0-finding-classification.md` | Fase 0 sigue abierta por 41 hallazgos restantes | Resolver los 41 hallazgos sin aumentar baseline | `npm --prefix backend run phase0:contracts:check` |
| F0-AUTH-002 | Autorizacion | Hallazgos estaticos de auth corregidos como falsos positivos del detector | verified_local | 176 endpoints reclasificados como `middleware_global_not_detected` | Requiere E2E/RBAC dinamico para cierre total | Ejecutar suite E2E con usuarios/roles QA | `docs/security/fase-0-auth-tenant-remediation.md` |
| F0-TENANT-002 | Aislamiento | Hallazgos estaticos tenant corregidos salvo excepcion exacta documentada | verified_local | 111 endpoints reclasificados como `repository_scope_not_detected`; `config/phase0/contract-exceptions.json` | Falta validacion cross-tenant dinamica | Ejecutar pruebas Tenant A/B | `docs/security/fase-0-tenant-isolation-report.md` |
| F0-CAP-002 | Capacidades | 41 hallazgos restantes clasificados | verified_local | 35 capacidades visibles no productivas sin feature flag; 5 productivas sin E2E; 1 asociacion endpoint/capability | No cerrar Fase 0 hasta resolverlos | Definir flags/disposicion y pruebas E2E | `docs/product/fase-0-capability-disposition.md` |
| F0-OBS-002 | Observabilidad | Runbook existe, validacion real sigue pendiente | verified_local | `docs/operations/fase-0-observability-runbook.md` | Falta evidencia runtime/logs/metricas/alertas | Ejecutar validacion en ambiente con acceso operacional | `scripts/qa-observability.sh` |
| F0-REST-002 | Restore | Procedimiento seguro existe, restore medido sigue pendiente | blocked_external | `scripts/ops/restore-postgres-smoke-test.sh`; `docs/operations/fase-0-restore-test-report.md` | Falta DB QA aislada y backup aprobado | Ejecutar restore smoke test con DB QA temporal | `docs/operations/fase-0-restore-test-report.md` |

## Ciclo 2026-07-22 — Cierre interno obligatorio

- Rama: `codex/fase-0-cierre-bloqueantes`
- SHA analizado: `8344fb446a0ba1ad6626750da58fe37c4a28b5d0`
- Estado: `FASE 0 IMPLEMENTADA SIN DEUDA INTERNA — PENDIENTE SOLO VALIDACIÓN EXTERNA EN VM`

| ID | Épica | Entregable o criterio | Estado | Evidencia | Bloqueo externo | Acción exacta |
|---|---|---|---|---|---|---|
| F0-CONTRACT-004 | Contratos | Baseline 0, sin críticos ni regresiones | verified_local | `artifacts/fase-0/phase0-contracts-check.json` |  | `npm run phase0:contracts:check` |
| F0-CAP-003 | Capacidades | 40 decisiones productivas con contrato/E2E | verified_local | `config/capabilities/catalog.json`; `docs/product/fase-0-capability-disposition.md` |  | `npm run phase0:capabilities-check` |
| F0-E2E-002 | E2E | Playwright, 45 tests descubiertos | verified_local | `frontend/tests/e2e/phase0-critical.spec.ts` | Ejecución requiere deploy y fixtures QA | `npm run phase0:e2e` |
| F0-TENANT-003 | Aislamiento | Validadores A↔B completos | verified_local | `scripts/phase0/check-tenant-isolation.js` | Credenciales y recursos QA A/B no disponibles localmente | `npm run phase0:tenant-runtime` |
| F0-OBS-003 | Observabilidad | Endpoints, métricas y logging implementados; smoke local OK | verified_local | `backend/src/app.js`; `docs/operations/fase-0-observability.md` | Requiere deploy para evidencia journal/VM | `npm run phase0:observability-check` |
| F0-REST-003 | Restore | Orquestador seguro y sintaxis verificada | verified_local | `scripts/phase0/backup-restore-qa.sh` | No hay QA_DATABASE_URL/RESTORE_DATABASE_URL | `npm run phase0:restore-check` |
| F0-CI-002 | CI | Jobs estático y runtime bloqueantes definidos | verified_local | `.github/workflows/ci.yml` | Requiere push y secrets environment `phase0-qa` | `gh pr checks --watch` |
| F0-VM-001 | VM | E2E, tenant, files, search, export, AI, jobs, observabilidad | blocked_external | `npm run phase0:vm-check` | Código aún no desplegado por restricción | Ejecutar después de merge/deploy |
| F0-RPO-RTO-001 | Continuidad | RPO/RTO medibles y artifact definido | blocked_external | `docs/operations/fase-0-backup-restore.md` | Base QA aislada no proporcionada | Ejecutar restore QA después del deploy |

## Ciclo 2026-07-22 — Separación CI de PR y runtime QA

- Rama: `codex/fase-0-cierre-bloqueantes`
- SHA de trabajo: `43cda699399ae63daaf575e5030d72f583166652`
- Causa raíz: `phase0:vm-check` estaba dentro del workflow de `pull_request` y recibía variables QA vacías antes del deploy.
- Estado: Fase 0 continúa pendiente de validación externa; no se redujo cobertura.

| ID | Épica | Entregable o criterio | Estado | Evidencia | Bloqueo externo | Acción exacta |
|---|---|---|---|---|---|---|
| F0-CI-003 | CI PR | Gate estático/local sin dependencia de QA | verified_local | `.github/workflows/ci.yml`; Playwright `--list` |  | Mantener como required check del PR |
| F0-RUNTIME-002 | Runtime QA | Workflow manual protegido por Environment `qa` y SHA desplegado | verified_local | `.github/workflows/phase0-runtime-qa.yml` | Requiere merge, deploy y secrets QA | `gh workflow run phase0-runtime-qa.yml --ref main -f deployed_sha=<SHA>` |
| F0-REST-004 | Restore QA | Restore separado del PR y runtime automatizado | blocked_external | `docs/operations/fase-0-backup-restore.md` | Requiere autorización y DB QA aislada | `npm run phase0:restore-check` |
| F0-CLOSE-001 | Cierre | Runtime QA y restore QA verdes para el mismo SHA | blocked_external | Artifacts runtime y `backup-restore-result.json` | Código aún no mergeado/desplegado | Cambiar a `verified_vm` solo con evidencia |
