# Fase 4 - RBAC y aislamiento tenant

Las rutas comerciales se registran de forma explícita en `backend/src/middleware/rbac.middleware.js`.

Permisos agregados: `commercial.catalog.read`, `commercial.catalog.manage`, `commercial.plan.read`, `commercial.plan.manage`, `commercial.subscription.read`, `commercial.subscription.manage`, `commercial.entitlement.read`, `commercial.entitlement.override`, `commercial.usage.read`, `commercial.health.read`, `commercial.trial.manage`, `commercial.pack.read`, `commercial.pack.manage`, `commercial.pack.install`, `commercial.methodology.read`, `commercial.methodology.manage`, `commercial.workpaper.read`, `commercial.workpaper.manage`.

Reglas:

- Platform admin administra catálogo global.
- Tenant admin consulta su plan, capabilities, uso y salud permitidos.
- Dealer conserva visibilidad solo por cartera existente.
- Todas las consultas tenant usan `tenant_id` explícito y rutas protegidas por RBAC global.
- Capability y RBAC son controles complementarios.
