# Zero Legacy Inventory

Status: PASS after DB integral review.

- Static active runtime legacy refs: `ACTIVE_RUNTIME_LEGACY=0`.
- PostgreSQL fresh legacy objects: `LEGACY_OBJECT_COUNT=0`.
- Legacy tables/views/functions reintroduced: `0`.
- Legacy KPI/Health authority: `0`.
- Canonical control identity: `tenant_controls.id` + `controls_catalog.id`.
- Canonical per-control Health: `public.v_iso_control_effective_health` over `metric_snapshots` with `metric_code = F5_5_CONTROL_EFFECTIVENESS` and explicit `tenant_control_id` in payload/metadata.

Validation commands:

```text
node scripts/normalization/db-integral-zero-legacy.test.js
node scripts/normalization/db-integral-zero-legacy.postgres.test.js
```
