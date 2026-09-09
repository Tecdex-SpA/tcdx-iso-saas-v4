# Production Baseline Final Objects

Status: PASS for DB-N05 fresh baseline validation.

Added/validated during formula integrity closure:

- `action_plan_updates`: active action plan progress history used by action routes and `F5_5_WEIGHTED_PROGRESS` source resolution.
- `usage_limit_definitions`, `tenant_usage_limits`, `commercial_events`: active commercial/runtime limit and audit tables consumed by indicator and commercial services.
- `metric_sufficiency_rules`: runtime sufficiency policy table; fallback defaults remain explicit when no row is configured.
- `metric_interpretations`, `metric_action_proposals`, `data_comparisons`, `metric_job_policies`: active indicator governance runtime tables.
- `calculation_validations`, `calculation_snapshots`: official run validation/source dataset snapshot lineage tables consumed by orchestrator and indicator Data Trust.
- `metric_snapshots.metric_code` and `publication_state`: required by runtime projections; `publication_state` defaults to `not_measured` and official publisher sets `measured` only for calculated measurements.
- Unique idempotency indexes for `metric_measurements` and `metric_snapshots` align with runtime `ON CONFLICT` clauses.

Fresh proof:

- `DB-N05 production baseline static checks: OK`.
- `DB-N05 runtime schema contract PASS`.
- `PRODUCTION_ROLE_PRIVILEGES PASS`.
- `FRESH_DB_FROM_ZERO PASS`.
- `BACKEND_STARTUP PASS`.
