# Fase 1 - Permisos y aislamiento tenant

## Capas de control

1. `auth` valida la sesión.
2. `enforceApiAccess` permite `/api/grc` solo a roles tenant autorizados.
3. `enforceTenantRequestScope` rechaza tenant explícito distinto al JWT.
4. `user_has_permission` valida el permiso granular de cada operación.
5. El servicio filtra todas las lecturas y escrituras por `tenant_id`.
6. FKs y claves únicas incluyen tenant cuando corresponde.

## Permisos

Se agregan `workflow.*`, `evidence.request.*`, `evidence.review`, `readiness.*`, `framework.*`, `audit.plan.*`, `audit.workpaper.manage`, `audit.review`, `audit.report.generate`, `grc.scheduler.run`, `grc.escalation.manage` y `grc.export.generate`.

Los administradores tenant reciben administración. Auditor recibe operación/revisión. Responsables de área solo lectura y transición. Los roles de plataforma conservan su bypass auditado. El módulo `grc_phase1_core` queda deshabilitado por defecto y debe habilitarse explícitamente por tenant.

## Pruebas requeridas en QA

- Token Tenant A con `tenant_id` de B: 403/404.
- ID de workflow/evidence/snapshot/mapping/audit de B con token A: 403/404.
- Usuario sin `workflow.manage`: publicación 403.
- Usuario sin `audit.review`: revisión 403.
- Job, exportación y archivo: el resultado debe conservar el tenant de origen.

`npm run phase1:permissions-check` y `npm run phase1:tenant-check` bloquean contratos locales. La suite runtime de 21 casos cubre flag habilitado/deshabilitado, permiso denegado, scope explícito, Tenant A/B, scheduler, export y vistas. La verificación dinámica queda `blocked_external` hasta desplegar el SHA en QA.
