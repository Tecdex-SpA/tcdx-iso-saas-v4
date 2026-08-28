# Standard Commercial Plan Model

Status: `COMMERCIAL_PLAN_MODEL_ADJUSTED` local; human review and production migration pending.

## Root Cause

The confirmed access symptom was commercial drift, not RBAC drift. Admin Credex recovered Dashboard after the superadmin contract refresh because the refresh aligned:

```text
tenant_contracts
-> tenant_subscriptions
-> v_commercial_tenant_subscription
-> v_commercial_tenant_modules
-> v_commercial_tenant_capabilities
-> /api/me/entitlements
```

No role grant, permission reconciliation or administrative bypass is required.

## Authority

The commercial source of truth remains backend/PostgreSQL:

- `commercial_plans`
- `commercial_plan_versions`
- `plan_version_modules`
- `commercial_modules`
- `commercial_technical_capabilities`
- `v_commercial_plan_capabilities`
- `tenant_subscriptions`
- `v_commercial_tenant_*`

Frontend may display standard plan labels and read-only included modules returned by the backend. Frontend must not duplicate plan-to-capability rules.

## Standard Aliases

| Standard plan | Persisted `plan_key` | Display |
|---|---|---|
| `iso` | `pyme` | ISO |
| `iso_operational_risk` | `empresa` | ISO + Riesgo Operativo |
| `grc` | `enterprise` | GRC |

Historic plans remain internal compatibility values:

- `demo`
- `legacy`

They are not shown as standard options for new Admin SaaS contracts.

## Definitive Rule

```text
ISO = ONLY_ISO
ISO_RISK = ISO + OPERATIONAL_RISK_ONLY
GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES
```

The plan matrix is capability-based. Modules are derived from the capabilities included in each plan; a module is not a sufficient commercial proxy when it mixes domains.

## Definitive Matrix

| Standard plan | Included capability classes | Excluded classes |
|---|---|---|
| ISO | `ISO_ONLY` | `OPERATIONAL_RISK_EXTENSION`, `GRC_ADVANCED`, internal |
| ISO + Riesgo Operativo | `ISO_ONLY`, `OPERATIONAL_RISK_EXTENSION` | `GRC_ADVANCED`, internal |
| GRC | `ISO_ONLY`, `OPERATIONAL_RISK_EXTENSION`, `GRC_ADVANCED` | internal |

Current local counts:

- `ISO_ONLY`: 7 capabilities.
- `OPERATIONAL_RISK_EXTENSION`: 5 capabilities.
- `GRC_ADVANCED`: 33 capabilities.
- Tenant commercial total for GRC: 45 capabilities.
- Route matrix: `routes=97`, `mapped=97`, `missing=0`.

## Capability Authority

Primary code authority:

- `backend/src/services/commercial/commercialPlanMatrix.service.js`
- `database/migrations/20260828_commercial_standard_plan_matrix.sql`
- `backend/src/services/commercial/commercialPlanMatrix.contract.test.js`
- `artifacts/rbac02-route-audit/route_access_matrix.csv`

The migration materializes missing ISO semantic capabilities when absent:

- `iso.compliance`
- `iso.risk`
- `iso.actions`
- `evidence.library`
- `iso.health`

It does not touch users, roles, role permissions, tenant contracts, tenant rows, subscriptions already active outside normal plan-version module rows, or customer operational data.

## Automatic Sync

Admin SaaS contract save, service suspension and service reactivation synchronize the latest `tenant_contracts` row into `tenant_subscriptions` in the same transaction. The superadmin refresh button remains a manual reconciliation path, but it is not required for normal contract changes.

Plan changes through Phase 4 commercial administration already replace the active subscription idempotently and preserve historical data by marking previous subscriptions `replaced`.
