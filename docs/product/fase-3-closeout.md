# Fase 3 - Closeout de implementación

## Estado

`READY_FOR_MANUAL_DEPLOY_AND_WEB_VALIDATION`

La implementación incluye modelo, rutas, reglas, vistas, seguridad y documentación.
No constituye cierre funcional hasta aplicar la migración, desplegar y aprobar el
checklist web.

## Entregables

- Migración `20260728_phase3_operational_grc.sql`.
- Forward-fix `20260729_phase3_operational_onboarding.sql` para importaciones
  tenant-scoped, permiso y reversión segura por lote.
- Aplicador idempotente `scripts/phase3/apply-phase3-migration.js`.
- API tenant-scoped bajo `/api/grc/phase3`.
- Rutas web de unidades, procesos, servicios, BIA, continuidad, crisis, indicadores y
  riesgo cuantitativo.
- Vistas 360 con relaciones, alertas, readiness, eventos e historial.
- App Shell oficial, asistente de activación e importación por códigos/correos.
- Conectores no certificados gobernados como “No disponible”.
- Capability y permisos de mínimo privilegio.
- Runbooks de deploy y validación web.
- Runner DDL con `MIGRATION_DATABASE_URL` separada del usuario runtime.
- Ledger `schema_migrations`, checksum SHA-256, advisory lock y postcondiciones.
- Deploy fail-fast que no continúa a servicios cuando la migración falla.
- Runbook de credencial administrativa temporal, rotación y eliminación.

## Controles estáticos

- Revisión de esquema, FKs, checks, índices e idempotencia.
- Revisión de rutas, permisos, capability y tenant scope.
- Revisión de imports, navegación y contratos frontend/backend.
- `git diff --check`.
- Selección de conexión administrativa sin fallback a `DATABASE_URL`.
- Revisión de ledger, checksum, advisory lock y transacción externa.
- Revisión de sanitización de errores y ausencia de secretos.
- Búsqueda focalizada de marcadores de deuda y dobles productivos.

## Pendiente externo

1. Deploy manual.
2. Aplicación de la migración.
3. Validación funcional web sobre `tcdx.local`.
4. Aprobación del usuario.
