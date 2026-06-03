# Sprint 0 - Revisión multi-tenant

## Cómo se obtiene tenant_id
- Backend `auth.js`: lee `tenant_id`, `tenantId`, `tenant`, `company_id` o `companyId` desde JWT y valida estado del tenant contra tabla `tenants` para roles no platform/dealer.
- Frontend `auth.ts`: decodifica JWT desde `localStorage.token` y expone `getTenantIdFromToken` con los mismos aliases principales.
- Muchas rutas reciben `tenant_id` o `tenantId` por params/query para cargar recursos tenant.

## Validación contra usuario
- Hay helpers repetidos por ruta para comparar `req.user.tenant_id` con params y permitir platform/dealer en casos específicos.
- RBAC global valida rol por prefijo, pero no reemplaza validación de tenant dentro de cada query.
- `auth.js` permite seguir si el JWT no trae tenant para no romper rutas existentes; eso deja la validación final en cada endpoint.

## Riesgos de cross-tenant access
- Endpoints con `/:tenant_id` son sensibles si no llaman helper de acceso antes de consultar.
- `tenant-files.routes.js` sirve `/api/files/tenant/:tenantId/*filePath`; está montado bajo middleware global, pero el archivo no declara auth local. Revisar validación de tenant/file path.
- Integraciones OAuth y sync agent tienen montajes especiales antes del middleware global; deben mantener tokens/estados firmados y scope tenant estricto.
- Static uploads públicos deben limitarse a assets deliberadamente públicos; evidencias y reportes deben descargarse por rutas autenticadas.

## Buenas prácticas observadas
- Muchas queries usan `WHERE tenant_id = $1` y filtros por `standard_code`, `operation_id`.
- `search.controller.js` y `notifications.controller.js` implementan `ensureTenantAccess` con support dealer/platform.
- Vistas aplicables endurecidas cruzan `tenant_applicable_*` y estándares activos.

## Recomendaciones Sprint 1+
- Centralizar helper `resolveTenantContext(req, requestedTenantId)` y usarlo en módulos core.
- Preferir tenant desde JWT para cliente normal; aceptar param solo para platform/dealer con autorización explícita.
- Añadir pruebas negativas cross-tenant para evidencias, reportes, archivos tenant, dashboard, controls, findings, action-plans, health e IA.
