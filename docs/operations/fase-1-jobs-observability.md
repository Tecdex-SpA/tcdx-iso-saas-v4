# Fase 1 - Jobs y observabilidad

## Scheduler recurrente

`POST /api/grc/scheduler/run` ejecuta, por tenant y ventana, solicitudes recurrentes de evidencia, recordatorios/vencimientos, escalamiento, snapshots de readiness, jobs de auditoría y seguimiento de acciones. `grc_scheduler_runs` conserva estado, intento, worker, correlation ID, resultados por tarea, error y próximo retry.

`grcSchedulerRunner.js` arranca con el backend, enumera solo tenants cuyo módulo está habilitado y ejecuta una ventana cada cinco minutos (configurable con `GRC_PHASE1_SCHEDULER_INTERVAL_MS`, mínimo 60 segundos). Un guard local evita ticks solapados y los advisory locks cubren concurrencia entre procesos/VMs. Puede deshabilitarse operacionalmente con `GRC_PHASE1_SCHEDULER_ENABLED=false` sin cambiar el flag por tenant.

- `pg_try_advisory_xact_lock` impide ejecución concurrente por tenant/tipo.
- La clave `(tenant_id, run_type, window_key)` evita dobles ejecuciones.
- Cada tarea usa savepoint; un fallo parcial no duplica tareas exitosas.
- Backoff exponencial: 30 segundos hasta un máximo de 3.600.
- `schedule_id + occurrence_key` evita duplicar solicitudes recurrentes.
- La ejecución manual requiere `grc.scheduler.run` y el feature flag tenant.

`grc_workflow_automation_runs` y `tcdx_async_jobs` continúan siendo la cola para automatizaciones y jobs de auditoría.

## Escalamiento

`grc_escalation_policies` configura entidad, SLA, criticidad, aviso previo, primer/segundo escalamiento, responsable, supervisor, roles y destinatarios. `grc_escalation_events` registra de forma idempotente `prior_notice`, `overdue`, `escalation_1`, `escalation_2`, `resolved` y `cancelled`. No existen plazos ni destinatarios codificados en el servicio.

## Eventos, logs y métricas

`audit_event_log` registra transiciones, aprobaciones, delegaciones, scheduler, solicitudes/calidad de evidencia, snapshots, mappings, revisión supervisora, adaptadores y exportaciones. Los logs JSON `GRC_PHASE1_OPERATION`/`GRC_PHASE1_ERROR` incluyen tenant, correlación, operación, resultado, intento y error code; no incluyen Authorization, password ni cuerpos completos.

`/metrics` expone `tcdx_grc_phase1_operations_total{operation,status}` para transición, aprobación, scheduler, escalamiento, readiness, revisión, exportación y fallos/retries. `GET /api/grc/observability` entrega los mismos contadores a usuarios autorizados para QA.

## Verificación post-deploy

```bash
sudo journalctl -u tecdex-backend.service -n 500 --no-pager | grep -E 'GRC_PHASE1_OPERATION|GRC_PHASE1_ERROR'
curl -fsS https://qa.example/metrics | grep tcdx_grc_phase1_operations_total
```

El Runtime QA ejecuta scheduler, aprobación, revisión y exportación antes de validar que sus contadores estén presentes.
