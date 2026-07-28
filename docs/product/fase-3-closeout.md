# Fase 3 - Closeout de implementación

## Estado

`READY_FOR_MANUAL_DEPLOY_AND_WEB_VALIDATION`

La implementación incluye modelo, rutas, reglas, vistas, seguridad y documentación.
No constituye cierre funcional hasta aplicar la migración, desplegar y aprobar el
checklist web.

## Entregables

- Migración `20260728_phase3_operational_grc.sql`.
- Aplicador idempotente `scripts/phase3/apply-phase3-migration.js`.
- API tenant-scoped bajo `/api/grc/phase3`.
- Rutas web de unidades, procesos, servicios, BIA, continuidad, crisis, indicadores y
  riesgo cuantitativo.
- Vistas 360 con relaciones, alertas, readiness, eventos e historial.
- Capability y permisos de mínimo privilegio.
- Runbooks de deploy y validación web.

## Controles estáticos

- Revisión de esquema, FKs, checks, índices e idempotencia.
- Revisión de rutas, permisos, capability y tenant scope.
- Revisión de imports, navegación y contratos frontend/backend.
- `git diff --check`.
- Búsqueda focalizada de marcadores de deuda y dobles productivos.

## Pendiente externo

1. Deploy manual.
2. Aplicación de la migración.
3. Validación funcional web sobre `tcdx.local`.
4. Aprobación del usuario.
