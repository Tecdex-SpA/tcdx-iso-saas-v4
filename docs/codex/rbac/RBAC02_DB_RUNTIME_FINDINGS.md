# RBAC-02 DB Runtime Findings

Status: `ANALYZED_RUNTIME`

Source artifacts:

- `artifacts/rbac02-commercial-gating-audit/*.csv`
- `artifacts/rbac02-commercial-gating-audit/rbac02_summary.txt`

## Read-Only Evidence

The audit SQL is guarded by:

```sql
BEGIN;
SET TRANSACTION READ ONLY;
ROLLBACK;
```

The generated artifacts are from a read-only PostgreSQL audit. Production data was not modified by Codex.

## Runtime Counts

| Artifact | Rows |
|---|---:|
| tenants | 14 |
| users_roles | 50 |
| roles_catalog | 12 |
| role_permissions | 600 |
| subscriptions | 16 |
| tenant_modules | 59 |
| tenant_capabilities | 188 |
| dealer_assignments | 3 |
| dashboard_access_matrix | 48 |
| route_access_matrix | 8 |
| module_key_mismatches | 188 |
| expired_entitlements | 1 |
| legacy_role_anomalies | 4 |

Summary file confirms:

```text
tenants=14
users=50
roles=12
active_subscriptions=6
tenant_modules=59
tenant_capabilities=188
dashboard_module_mismatches=0
unknown_roles=0
```

## Dashboard Findings

`dashboard_access_matrix.csv` classifications:

| Classification | Rows | Interpretation |
|---|---:|---|
| `NO_FAILURE` | 22 | Expected allow under current DB matrix |
| `RBAC_PERMISSION_MISSING` | 7 | Expected deny because `dashboards.read` is absent |
| `SUBSCRIPTION_INACTIVE` | 19 | Expected deny because no active commercial subscription |

False DENY: `0` confirmed by runtime audit.

Confirmed false ALLOW risk before RBAC-02 correction: `1`.

Evidence: every persisted `core.dashboard` capability in `tenant_capabilities.csv` had `required_permission=commercial.entitlement.read` instead of the Dashboard contract permission `dashboards.read`. One active deprecated legacy `superadmin` user had `commercial.entitlement.read` without `dashboards.read`, creating a potential Dashboard allow when a guard trusted the persisted capability permission.

RBAC-02 closes this with:

- runtime resolver override: `core.dashboard -> dashboards.read`;
- frontend mirror requiring `rbac_allowed !== false`;
- forward-only catalog migration to normalize persisted `commercial_technical_capabilities.required_permission`.

## Module Findings

`module_key_mismatches.csv`:

```text
OK=186
NO_MODULE_REQUIRED=2
MODULE_KEY_MISMATCH=0
MODULE_NOT_ACTIVE=0
```

There is no current runtime module mismatch for `core.dashboard`; production currently has active `core` module rows for active subscriptions. The code exception remains necessary for historical/partial tenant compatibility and is constrained to `core.dashboard` only.

## Expired Entitlements

`expired_entitlements.csv` contains one active subscription row whose `ended_at` is in the past:

```text
source_table=tenant_subscriptions
key=legacy
status=active
expires_at=2026-07-21 00:00:00+00
```

This is an operational data hygiene anomaly. RBAC-02 does not auto-normalize subscription lifecycle states because that would alter commercial data semantics beyond the Dashboard permission defect.

## Roles

Runtime users:

```text
CANONICAL_ROLE=16
DEPRECATED_LEGACY_ROLE=34
UNKNOWN_REQUIRES_DECISION=0
```

Runtime user roles:

```text
admin=19
auditor=13
dealer=3
operativo=7
superadmin=2
viewer=6
```

Legacy anomalies:

```text
admin=19 users / 12 tenants
operativo=7 users / 6 tenants
superadmin=2 users / 1 tenant
viewer=6 users / 6 tenants
```

No unknown roles were found. RBAC-02 does not reassign users or escalate aliases.

## Dealer Assignments

`dealer_assignments.csv` contains `3` active assignments for one dealer user across three tenants. RBAC-02 did not change dealer assignment logic; dealer access remains assignment-scoped.

## Migration Decision

`DB_MIGRATION_REQUIRED: YES`

Reason: persisted catalog data requires normalization for `core.dashboard.required_permission`.

Migration created but not executed:

```text
database/migrations/20260827_rbac02_commercial_gating_normalization.sql
```

The migration updates only `commercial_technical_capabilities` for `capability_key='core.dashboard'`; it does not update users, tenants, roles, assignments, modules, entitlements or subscriptions.
