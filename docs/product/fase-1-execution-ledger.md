# Fase 1/1R - Execution ledger

| Entregable | Estado | Evidencia |
|---|---|---|
| Preflight Fase 1R | verified_local | Base `main` limpia; `HEAD=origin/main=29d59a2cd610ed31348790b05db6a3c9eaed8354`; rama `codex/fase-1r-cierre-operacional-grc` |
| Migración original | verified_local | `20260722_phase1_grc_core.sql`, doble aplicación PostgreSQL 16 |
| Migración operacional | verified_local | `20260723_phase1r_operational_closeout.sql`, doble aplicación, aditiva y no destructiva |
| Bootstrap tenant | verified_local | endpoint/status/revalidación, confirmación, permiso, flag, transacción, advisory lock, idempotencia y auditoría |
| Feature flag y administración SaaS | verified_local | default false; activación tenant por endpoint canónico; catálogo expone estado global/tenant, bloqueo y actor; respuestas `no-store` |
| Workflows y aprobaciones | verified_local | siete definiciones base publicadas; simple, secuencial, paralelo, quorum y unanimidad; pruebas unitarias/integración |
| Evidencia y recurrencia | verified_local | recurrencia con índice parcial/`occurrence_key`, scheduler real e idempotencia PostgreSQL |
| Readiness y frameworks | verified_local | ocho reglas tenant y nueve raíces de referencia sin texto licenciado |
| Scheduler y escalamiento | verified_local | runner activo, advisory lock, retry/backoff, ventanas idempotentes, ejecución manual autorizada |
| Exportaciones | verified_local | PDF auditado y CSV reales en PostgreSQL; PDF/DOCX/XLSX/CSV validados por formato, bytes/hash/tenant persistidos y descarga cross-tenant denegada |
| Observabilidad | verified_local | métricas específicas de errores, scheduler, retries, escalamiento, exports y bootstrap |
| PostgreSQL integración | verified_local | bootstrap/replay, versión publicada inmutable, evidencia/versiones/rechazo, mapping/revisión, auditoría/cierre, Tenant A/B, scheduler/reintento, no duplicación y exports contra PostgreSQL 16 |
| Frontend consolidado | verified_local | bootstrap, workflows/instancias, evidencia, mappings y auditoría operables en vistas existentes; feedback accesible, permisos y cache SaaS |
| E2E contract/discovery | verified_local | 30 casos ejecutables; no `skip`/`fixme`; ejecución real reservada al SHA desplegado |
| Gate consolidado | verified_local | `npm run phase1:check` exitoso con PostgreSQL 16, backend, frontend, contratos UI/E2E y `git diff --check` |
| Runtime QA del SHA desplegado | blocked_external | requiere PR/CI/merge/migración/deploy y Environment `qa`; workflow prepara, ejecuta, deriva evidencia y limpia sus seeds |

Estados válidos: `pending`, `in_progress`, `verified_local`, `verified_runtime`, `blocked_external`, `failed`.
