# Fase 4 - Resolución de entitlements

El servicio `backend/src/services/commercial/entitlementResolver.service.js` entrega una decisión explicable por capability.

Orden efectivo:

1. Capability técnica activa.
2. Suscripción vigente y versión de plan publicada.
3. Módulos incluidos por plan.
4. Add-ons vigentes.
5. Mapeo feature-capability.
6. Override tenant vigente.
7. Trial vigente.
8. Dependencias declaradas.
9. Permiso RBAC mediante `user_has_permission`.
10. Límite y consumo disponible.
11. Política de downgrade o solo lectura.

La respuesta de `/api/me/entitlements` conserva `ai` y agrega `subscription`, `modules`, `capabilities`, `limits`, `usage` y `health`.
