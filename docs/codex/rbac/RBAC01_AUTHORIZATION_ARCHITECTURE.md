# RBAC-01 Authorization Architecture

Status: `COMPLETE_LOCAL`

## Chain

```text
raw role
  -> canonical/compatibility interpretation
  -> effective permission
  -> commercial entitlement
  -> module active
  -> resource scope when applicable
  -> allow/deny
```

## Backend Authority

Backend remains the security authority.

- `backend/src/middleware/rbac.middleware.js` uses the centralized role compatibility resolver for coarse route gates and fixes auditor dashboard access.
- Legacy/deprecated compatibility does not satisfy canonical-only role gates; only the raw/effective role or exact aliases may match a role list. This preserves `admin != tenant_admin` and `superadmin != platform_admin`.
- `backend/src/services/commercial/entitlementResolver.service.js` enforces capability entitlement, required permission and module-active state.
- Dealer tenant assignment remains in dealer-specific route/service boundaries using `dealer_tenants`, `dealer_tenant_access` and `v_dealer_tenants`.
- Domain services continue to own resource-level scope. RBAC-01 did not invent client-side resource ownership.

## Frontend Mirror

Frontend mirrors availability only:

- `frontend/src/utils/mvpPermissions.ts` mirrors canonical role compatibility and grants `auditor` dashboard visibility.
- `AppLayout` and `Sidebar` consume the shared frontend utility and commercial capability state.
- Frontend denial improves navigation/deep-link UX but does not replace backend checks.

## AI Boundary

AI Engine does not receive broader authority than the calling user. RBAC-01 required no AI Engine code change because backend authorization and governed AI service contracts remain the boundary.

Result: `AI_ENGINE_NO_RBAC_CHANGE_REQUIRED`.
