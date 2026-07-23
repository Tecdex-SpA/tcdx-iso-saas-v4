# Fase 1 - Execution ledger

| Entregable | Estado | Evidencia |
|---|---|---|
| Preflight y estado heredado | verified_local | rama `codex/fase-1-nucleo-grc-automatizacion`, HEAD/base `4dae48c...`, worktree preservado |
| Inventario y consolidación visual | verified_local | current-state + matriz; cero rutas o módulos paralelos |
| Migración GRC | verified_local | gate portable macOS/GitHub Actions, fixture contractual versionado, PostgreSQL 16 efímero y doble aplicación: 47 tablas, 20 índices, 305 constraints, 157 FKs válidas |
| Feature flag | verified_local | `grc_phase1_core`, default `false`, backend/API/UI/jobs/exports tenant-scoped |
| Workflow y aprobaciones múltiples | verified_local | simple/secuencial/paralela/quorum/unanimidad, rechazo/devolución/reapertura/delegación/sustitución, unit + integration tests |
| Evidencia continua/readiness/frameworks | verified_local | recurrencia idempotente, calidad, ocho dimensiones, nueve marcos y exports |
| Scheduler recurrente | verified_local | runner interno + ejecución manual; lock, ventana, savepoints, retry/backoff, estado y cola |
| Escalamiento | verified_local | políticas tenant y seis etapas idempotentes, SLA/criticidad/responsable/supervisor/rol |
| Revisión supervisora | verified_local | asignación, independencia/conflicto, historial/versiones, evidencia y bloqueo de cierre |
| Exportaciones avanzadas | verified_local | siete dominios; PDF/DOCX/XLSX/CSV; snapshot, filtros, fecha, versión, bytes y hashes persistidos |
| Seis adaptadores runtime | verified_local | Documentos, Evidencias, Controles, Riesgos, Auditorías y Hallazgos/NC/Acciones |
| Permisos y tenant | verified_local | `phase1:permissions-check` y `phase1:tenant-check`, ambos con cero hallazgos |
| Observabilidad | verified_local | eventos auditados, logs JSON, correlation ID y métricas `tcdx_grc_phase1_operations_total` |
| Backend check/tests | verified_local | ejecución final OK, incluidas pruebas GRC nuevas |
| Frontend lint/check/build | verified_local | tres comandos finales OK; 43 rutas compiladas |
| Contratos y scripts | verified_local | `VERIFIED_LOCAL_CONTRACTS`, cero hallazgos; scripts-check OK |
| E2E discovery | verified_local | 21 pruebas Playwright descubiertas |
| CI pull request | verified_local | checks Fase 1 completos; sin Runtime QA ni suites históricas Fase 0 |
| Runtime QA del SHA desplegado | blocked_external | requiere commit/merge, migración/deploy oficial y Environment `qa` |
| Evidencia runtime/VM | blocked_external | `.github/workflows/phase1-runtime-qa.yml` listo; no se ejecuta antes del deploy |

Estados permitidos: `pending`, `in_progress`, `verified_local`, `verified_runtime`, `blocked_external`, `failed`.
