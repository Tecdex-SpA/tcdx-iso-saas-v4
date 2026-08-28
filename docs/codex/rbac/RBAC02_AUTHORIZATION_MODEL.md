# RBAC-02 Authorization Model

Status: `READY_FOR_HUMAN_REVIEW`

## Effective Formula

```text
ALLOW =
  TENANT_AND_SUBSCRIPTION_ACTIVE
  &&
  USER_PERMISSION_GRANTED
  && COMMERCIAL_ENTITLEMENT_GRANTED
  && MODULE_ACTIVE_OR_EXPLICIT_BASE_CAPABILITY
  && RESOURCE_SCOPE_ALLOWED_WHEN_APPLICABLE
```

The only `MODULE_ACTIVE_OR_EXPLICIT_BASE_CAPABILITY` exception is:

```text
capability_key=core.dashboard
module_key=core
required_permission=dashboards.read
source=rbac02_base_capability
module_active_source=rbac02_core_dashboard_base_capability
```

## Backend Authority

`backend/src/services/commercial/entitlementResolver.service.js` remains the commercial gate authority.

- Missing modules deny by default.
- `core.dashboard` can tolerate a missing technical `core` module row only for active commercial tenants with active/trialing/past_due subscription state.
- Tenant inactive, suspended or deleted does not receive the synthesized base capability.
- Explicit capability deny is not overwritten.
- `resolveCapability()` enforces `dashboards.read` for `core.dashboard`, even before the RBAC-02 migration is applied.
- Non-dashboard capabilities preserve their configured required permission.

## Runtime Finding Closed

Runtime audit found all persisted `core.dashboard` rows using `required_permission=commercial.entitlement.read`. That was a false ALLOW risk because commercial-entitlement read is not the Dashboard permission.

RBAC-02 closes the risk in code and creates a forward-only DB normalization migration.

## Frontend Mirror

`frontend/src/components/AppLayout.tsx` no longer exposes technical capability keys in user-facing denial copy. It displays the functional localized message `app.capabilityDisabled`.

`frontend/src/hooks/useTenantEntitlements.ts` now treats `rbac_allowed=false` as unavailable, so frontend availability mirrors backend RBAC denial instead of using `enabled` alone.

Frontend remains a mirror for availability and navigation. It is not an authorization source of truth.
