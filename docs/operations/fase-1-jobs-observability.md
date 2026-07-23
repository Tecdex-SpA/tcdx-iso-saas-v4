# Fase 1R - Jobs y observabilidad

El runner `grcSchedulerRunner.js` inicia con backend, enumera solo tenants habilitados y usa guard local, advisory lock distribuido y ventana única `(tenant_id, run_type, window_key)`. Las tareas usan savepoints, retry/backoff y `schedule_id + occurrence_key`; la ejecución manual requiere `grc.scheduler.run`.

Los eventos incluyen tenant y correlation ID sin tokens, cookies, contraseñas ni payloads completos. `/metrics` expone:

- `tcdx_grc_phase1_operations_total`
- `tcdx_grc_phase1_operation_errors_total`
- `tcdx_grc_phase1_scheduler_runs_total`
- `tcdx_grc_phase1_scheduler_retries_total`
- `tcdx_grc_phase1_escalations_total`
- `tcdx_grc_phase1_exports_total`
- `tcdx_grc_phase1_bootstrap_total`

Los labels son operación/resultado; no usan IDs de entidad o usuario. `GET /api/grc/observability` requiere flag y permiso. El runbook operacional detallado está en `docs/operations/fase-1-grc-runbook.md`.
