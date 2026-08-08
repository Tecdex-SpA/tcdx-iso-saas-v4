# Jobs y observabilidad

Los tipos persistidos son `metric.calculate`, `metric.snapshot`, `metric.compare`, `metric.freshness`, `metric.alert`, `metric.reconcile` y `metric.retention`. Usan `tcdx_async_jobs`, política versionada, tenant, período, correlation/request ID, idempotency key, timeout, máximo de intentos, backoff declarado, estado y resultado/error sanitizado.

La creación verifica el límite concurrente. La ejecución reanuda jobs queued/failed, no repite completed, registra intentos y no publica parcialmente. Alertas solo generan propuestas gobernadas; retention informa históricos publicados preservados. Eventos de cálculo, snapshot, comparación y acción quedan en el ledger comercial con actor y request ID.

## Contrato operativo

Cada payload identifica período, metric code, idempotency key y correlation ID. `metric_job_policies` versiona timeout, intentos y backoff. El dispatcher es una allowlist cerrada; errores se sanitizan antes de persistir y nunca incluyen una URL de base de datos.

Calculate y snapshot usan la misma cadena síncrona autoritativa; compare acepta período previo, baseline, target o ventana; freshness reevalúa evidencia; alert crea como máximo una propuesta idempotente; reconcile informa brechas; retention nunca borra snapshots publicados. El timeout limpia su timer al finalizar y los retries guardan intento y próxima demora.

La observabilidad combina estado de `tcdx_async_jobs`, correlation/request ID y `commercial_events` con actor, tenant, entidad y resultado. No existe scheduler en memoria como fuente única: un scheduler externo autorizado puede crear/ejecutar jobs persistidos y reanudables.
