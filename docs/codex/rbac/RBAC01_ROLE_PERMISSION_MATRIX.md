# RBAC-01 Role Permission Matrix

Status: `COMPLETE_LOCAL`

Current repository evidence:

| Area | Current source | Notes |
|---|---|---|
| Backend route RBAC | `backend/src/middleware/rbac.middleware.js` | Direct route/prefix rules by legacy role arrays. Backend remains final authority. |
| Permission catalog | `permissions`, `role_permissions`, `app_roles` in migrations/services | Effective DB mappings must be audited before aliasing legacy roles. |
| User context | JWT + `users.role` | Auth validates tenant service status for non-platform/non-dealer roles. |
| Tenant scope | `backend/src/middleware/tenantScope.middleware.js` | Blocks tenant mismatch for non-platform/non-dealer requests. |
| Frontend UX permissions | `frontend/src/utils/mvpPermissions.ts` | Role groups exist but do not enforce backend security. |
| Commercial entitlements | `backend/src/middleware/commercialEntitlement.middleware.js` + `entitlementResolver.service.js` | Capability gate uses entitlement plus optional required permission. |

Initial inconsistency to resolve after DB audit:

| Case | Frontend | Backend | Risk |
|---|---|---|---|
| `auditor + dashboard.read` | `dashboard.read` not granted to `auditor` in `FEATURE_ACCESS`; prompt requires allow. | `TENANT_DASHBOARD_ROLES` also excludes `auditor`. | Acceptance case fails unless corrected after canonical design. |
| `executive` role | Frontend maps `viewer/cliente/client/read_only/readonly/solo_lectura/ejecutivo` to `executive`. | Backend has same legacy list in `EXECUTIVE_ROLES`, but service-level lists vary. | Needs parity test and central resolver. |
| Tenant admins | Frontend groups `admin/tenant_admin/admin_cumplimiento/compliance_admin`. | Backend lists vary by route and service. | Need no privilege escalation from nominal aliasing. |

Required final authorization rule:

```text
ALLOW =
    has_permission(user, action)
    AND tenant_has_entitlement(tenant, module)
    AND module_is_active(tenant, module)
    AND scope_allows(user, resource)
```

No data migration or canonical alias map is approved before real DB audit results.
