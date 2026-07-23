# Fase 1R - Runbook GRC

## Activación

1. Verificar migraciones y backup.
2. Activar `grc_phase1_core` únicamente para el tenant desde Administración SaaS.
3. Refrescar entitlements/reingresar.
4. En Configuración, confirmar e inicializar GRC.
5. Revalidar hasta estado `Listo`.

El bootstrap no habilita el módulo, no crea auditorías/evidencias ficticias y puede repetirse sin duplicar.

## Scheduler

El runner está activo salvo `GRC_PHASE1_SCHEDULER_ENABLED=false`. La ejecución manual requiere `grc.scheduler.run`. Ante fallo, revisar `grc_scheduler_runs`, correlation ID, intento, `next_retry_at` y logs `GRC_PHASE1_OPERATION`. No modificar ventanas o filas manualmente.

## Diagnóstico

- 403 de módulo: comprobar `/api/me/modules` y setting tenant.
- 403 de permiso: revisar permiso efectivo, no ocultarlo en frontend.
- bootstrap degradado: `GET /api/grc/bootstrap/status`, corregir faltantes y revalidar.
- scheduler locked: esperar la ventana activa; no forzar borrado del lock.
- export fallido: usar export ID/correlation ID; no registrar contenido del archivo.

## Rollback operacional

Deshabilitar el módulo para el tenant. Conservar tablas e historia. Cualquier reversión de esquema debe ser una migración compensatoria revisada; se prohíben `DROP`, `TRUNCATE` y limpieza manual de tenants.
