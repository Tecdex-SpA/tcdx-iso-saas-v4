# RBAC-02 Role Normalization

Status: `READY_FOR_HUMAN_REVIEW`

## Canonical Roles

The canonical role set remains:

- `platform_admin`
- `tenant_admin`
- `auditor`
- `area_owner`
- `executive`
- `dealer`

RBAC-02 does not add roles, remove roles, reassign users, or widen legacy compatibility.

## Runtime Role Evidence

Runtime users:

```text
CANONICAL_ROLE=16
DEPRECATED_LEGACY_ROLE=34
UNKNOWN_REQUIRES_DECISION=0
```

Runtime raw roles:

```text
admin=19
auditor=13
dealer=3
operativo=7
superadmin=2
viewer=6
```

Runtime semantic role counts:

```text
platform_admin=2
tenant_admin=19
auditor=13
area_owner=7
executive=6
dealer=3
```

`roles_catalog.csv` contains 6 canonical roles and 6 deprecated legacy roles. No exact-alias or compatibility-mapping roles are present in the role catalog at runtime.

## Role Boundaries

- `platform_admin`: platform administration only; no silent inheritance from legacy `superadmin`.
- `tenant_admin`: tenant administration inside contracted and active modules.
- `auditor`: dashboard and audit/read workflows when explicit permissions exist; no tenant administration.
- `area_owner`: limited by resource ownership/scope in domain services.
- `executive`: read-only.
- `dealer`: only assigned tenants.

## Legacy Roles

RBAC-02 preserves RBAC-01 behavior:

- exact aliases do not grant broader canonical privilege than explicitly mapped.
- deprecated legacy roles preserve compatibility where documented.
- unknown roles require a decision and are not silently elevated.

Runtime legacy anomalies:

```text
admin=19 users / 12 tenants
operativo=7 users / 6 tenants
superadmin=2 users / 1 tenant
viewer=6 users / 6 tenants
```

The runtime false ALLOW risk involved one deprecated legacy `superadmin` user with `commercial.entitlement.read` but without `dashboards.read`; RBAC-02 closes it by requiring `dashboards.read` for `core.dashboard`.
