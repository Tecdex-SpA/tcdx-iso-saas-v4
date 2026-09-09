# Zero Legacy Review

Status: PASS.

Static review:

- `ACTIVE_RUNTIME_LEGACY=0`.
- Historical/migration/test hits are classified by path and do not count as active runtime consumers.
- No active runtime fallback to `controls`, `control_health_scores`, `v_latest_health_kpi_snapshots`, `KPI-HLT-*`, `legacy_control_id`, `controls_id_legacy` or `evidences.control_id` was accepted.

PostgreSQL fresh review:

- `LEGACY_OBJECT_COUNT=0`.
- `ZERO_LEGACY_POSTGRES PASS`.
- Fresh schema does not recreate legacy Health/KPI authorities, QA/backup/preview objects or the legacy `controls` table.

Authority retained:

- Operational control identity: `tenant_controls.id`.
- Catalog control identity: `controls_catalog.id`.
- Per-control Health: `public.v_iso_control_effective_health` over `metric_snapshots` with `metric_code='F5_5_CONTROL_EFFECTIVENESS'` and explicit `tenant_control_id`.
- Global Health: `F5_5_GRC_HEALTH` through official formula lineage.
