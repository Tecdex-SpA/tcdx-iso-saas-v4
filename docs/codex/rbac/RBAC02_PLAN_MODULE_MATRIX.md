# RBAC-02 Plan Module Matrix

Status: `READY_FOR_HUMAN_REVIEW`

## Commercial Plans

| Plan | Included baseline | Excluded unless explicitly entitled and active |
|---|---|---|
| ISO | dashboard, ISO compliance, controls, evidences, audits, findings, NC, action plans, ISO reports, ISO risks and ISO risk matrix | BIA, advanced privacy, advanced operational risk, data governance, advanced BI |
| ISO + Riesgo Operativo | ISO plus operational risk, BIA, continuity, loss events and quantitative risk when entitled | Other GRC domains not contracted |
| GRC | Contracted GRC domains and active modules | Any inactive or non-entitled module/capability |

## RBAC-02 Exception

`core.dashboard` is a base capability for active commercial tenants because dashboard access is the entry point for every commercial plan.

This exception does not activate:

- `core.unknown`
- `core.reports`
- `tenant.admin`
- `risk.operational`
- BIA
- privacy
- data governance
- BI
- AI
- dealer console
- platform admin

Those capabilities continue to require explicit entitlement, active module state and permission/scope.

## Database Migration

`DB_MIGRATION_REQUIRED: YES`

Reason: persisted `core.dashboard` catalog rows used `commercial.entitlement.read`; Dashboard must require `dashboards.read`.

Migration created but not executed:

```text
database/migrations/20260827_rbac02_commercial_gating_normalization.sql
```
