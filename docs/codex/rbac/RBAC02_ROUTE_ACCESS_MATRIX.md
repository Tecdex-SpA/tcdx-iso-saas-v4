# RBAC-02 Route Access Matrix

Status: `PASS_RUNTIME_ALIGNED`

Generated artifact:

- `artifacts/rbac02-route-audit/route_access_matrix.csv`
- `artifacts/rbac02-route-audit/rbac02_route_summary.txt`

Summary:

```text
routes=97
mapped=97
missing=0
expected_routes=97
route_count_status=PASS
missing_routes=NONE
```

## Route Contract

Each route is classified with:

- required permission
- capability key
- module key
- plan requirement
- scope requirement
- canonical roles allowed
- backend guard
- frontend guard
- expected access

## Dashboard

`/dashboard` is mapped to:

```text
required_permission=dashboards.read
capability_key=core.dashboard
module_key=core
plan_requirement=ANY_ACTIVE_COMMERCIAL_TENANT
scope_requirement=tenant
canonical_roles_allowed=tenant_admin,auditor,area_owner,executive
```

## Runtime Contrast

The read-only DB audit generated a focused 8-route runtime matrix. The static App Router matrix was compared against that runtime matrix.

Initial divergences found and corrected in the static generator:

- `integrated_grc` was normalized from stale `grc_phase2_integrated`.
- `operations_grc` was normalized from stale `grc_phase3_operations`.
- `/privacidad` uses `privacy.read`.
- `/incidentes` uses `incidents.read`.
- `/bia` uses `bia.read`.
- `/riesgo-cuantitativo` uses `risk.quantitative`, `risk_manager` and `quantitative_risk.read`.

Post-correction comparison:

```text
runtime_rows=8
static_rows=97
divergences=0
```

Runtime dashboard classification:

```text
NO_FAILURE=22
RBAC_PERMISSION_MISSING=7
SUBSCRIPTION_INACTIVE=19
FALSE_DENY=0
FALSE_ALLOW_RISK_PRE_FIX=1
```
