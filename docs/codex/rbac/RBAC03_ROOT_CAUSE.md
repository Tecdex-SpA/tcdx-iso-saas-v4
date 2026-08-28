# RBAC-03 Root Cause Re-evaluation

Status: `RBAC03_NOT_REQUIRED` for role/permission reconciliation.

New confirmed fact on 2026-08-28:

```text
Admin Credex recovered Dashboard access after refreshing the contract from the superadmin account.
```

## Conclusion

The incident is not explained by a missing RBAC role/permission grant. The access recovery after superadmin contract refresh points to commercial contract synchronization and frontend/backend entitlement context freshness.

RBAC-01 and RBAC-02 remain valid for this symptom:

- Effective `admin` has `dashboards.read` in `role_permissions.csv`.
- Tecdex admins show `NO_FAILURE` in `dashboard_access_matrix.csv`.
- Active Credex SPA admins show `NO_FAILURE` in `dashboard_access_matrix.csv`.
- The Credex test admins `admin@credex.cl` and `admind2@credex.cl` fail for `SUBSCRIPTION_INACTIVE`, not RBAC permission.

## First Failed Gate

For the affected Credex state before superadmin refresh, the first divergent gate is commercial entitlement synchronization:

```text
tenant_contracts / superadmin contract state
-> tenant_subscriptions / v_commercial_tenant_subscription
-> v_commercial_tenant_modules
-> v_commercial_tenant_capabilities
-> /api/me/entitlements
-> AppLayout / Dashboard capability check
```

The refresh corrected the commercial state consumed by entitlements. It did not require role reassignment, user-specific exception, tenant-specific bypass, or new RBAC permission reconciliation.

## Why Refresh Fixed Dashboard

The repository has two commercial surfaces:

- Legacy/Admin SaaS contract surface: `tenant_contracts`, `tenant_module_settings`, `v_tenant_modules`, `/api/me/modules`, and Admin SaaS contract UI.
- Phase 4 commercial entitlement surface: `tenant_subscriptions`, `commercial_plan_versions`, `plan_version_modules`, `v_commercial_tenant_*`, and `/api/me/entitlements`.

Phase 4 initially seeded `tenant_subscriptions` from `tenant_contracts`, but saving a contract later updated `tenant_contracts` only. If the two surfaces drifted, `/api/me/modules` and `/api/me/entitlements` could disagree. Dashboard uses the entitlement surface for `core.dashboard`, so a stale or missing `tenant_subscriptions` row can block Dashboard even when RBAC is correct.

## RBAC-03 Code Scope

No RBAC role/permission migration is included.

RBAC-03 limits code changes to:

- Automatic sync from Admin SaaS contract save/service suspend/service reactivate to `tenant_subscriptions`.
- Fail-closed tenant-context validation in `/api/me/entitlements`.
- Frontend entitlement/access-bootstrap cache invalidation on token/user/tenant changes.
- Standard commercial plan aliases and backend-derived display for ISO, ISO + Riesgo Operativo and GRC, without duplicating the plan matrix in frontend.

## Commercial Plan Model

The standard commercial plan model is adjusted locally:

```text
iso -> pyme -> ISO
iso_operational_risk -> empresa -> ISO + Riesgo Operativo
grc -> enterprise -> GRC
```

The required commercial matrix migration is:

```text
database/migrations/20260828_commercial_standard_plan_matrix.sql
```

It is not an RBAC migration and was not executed by Codex. It normalizes published plan-version modules only and validates that referenced modules/capabilities exist before applying changes.

## DB_MIGRATION_REQUIRED

`DB_MIGRATION_REQUIRED: NO` for RBAC role/permission reconciliation.

No RBAC migration should be run for this incident unless a separate, objective defect is demonstrated.

`DB_MIGRATION_REQUIRED: YES` for commercial plan matrix normalization if the human review accepts the standard ISO / ISO + Riesgo Operativo / GRC model.
