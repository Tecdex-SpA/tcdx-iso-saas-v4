# Fase 1R - Matriz rol, acción y endpoint

El backend es autoritativo. Todos los endpoints bajo `/api/grc` requieren autenticación, módulo tenant habilitado y scope resuelto; `/meta` solo revela el estado del módulo del tenant autenticado.

| Rol | Ruta/acción | Endpoint | Permiso | Tabla principal | Resultado |
|---|---|---|---|---|---|
| superadmin/platform_admin | administrar módulo | `PUT /api/admin-saas/tenants/:tenant/modules/:key` | admin SaaS manage | `tenant_module_settings` | 200 auditado |
| admin/tenant_admin/admin_cumplimiento/compliance_admin | bootstrap | `POST /api/grc/bootstrap` | `workflow.manage` | `grc_tenant_configurations`, `grc_bootstrap_runs` | 200/403 |
| admin/tenant_admin/compliance_admin | crear/publicar workflow | `/api/grc/workflows*` | `workflow.manage` | workflow definitions/versions | 200/403 |
| auditor/operativo/responsable_area/area_owner | leer/transicionar | workflow endpoints | `workflow.read`/`workflow.transition` | instances/history/approvals | 200/403 |
| admin/tenant_admin/compliance_admin | solicitar evidencia | `/api/grc/evidence/requests` | `evidence.request.manage` | evidence requests/schedules | 200/403 |
| auditor/admin/compliance_admin | revisar evidencia | evidence review/quality | `evidence.review` | reviews/quality | 200/403 |
| auditor/admin/compliance_admin | readiness | readiness endpoints | `readiness.read/generate` | snapshots/results | 200/403 |
| auditor/admin/compliance_admin | frameworks/mappings | framework endpoints | `framework.read/manage` | requirements/mappings | 200/403 |
| auditor/admin/compliance_admin | plan/workpaper | audit endpoints | `audit.plan.*`, `audit.workpaper.manage` | audit plans/workpapers | 200/403 |
| auditor supervisor/admin | revisión | workpaper reviews | `audit.review` | supervisor reviews | 200/403 |
| admin/tenant_admin | scheduler | `/api/grc/scheduler/run` | `grc.scheduler.run` | scheduler runs | 200/403 |
| admin/tenant_admin | escalamiento | escalation endpoints | `grc.escalation.manage` | policies/events | 200/403 |
| roles con concesión explícita | exportar | `/api/grc/exports/:domain` | `grc.export.generate` | exports | 200/403 |

Los tests de seguridad verifican los 18 permisos, predicados tenant en adaptadores, denegación de módulo y acceso cross-tenant sin inferencia de recursos.
