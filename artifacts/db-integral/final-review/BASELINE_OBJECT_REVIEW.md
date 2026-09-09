# Baseline Object Review

Status: PASS.

Reviewed baseline:

- `database/baseline/production_schema_v1.sql`.
- `database/baseline/production_seed_v1.sql`.
- `scripts/normalization/load-production-reference-catalogs.js`.
- `database/reference/iso/manifest.json`.

Included productive objects:

- `tenant_controls` with `tenant_controls.id` as operational control identity.
- `control_soa`, `control_soa_assessments`, `control_soa_change_log`.
- `findings`, `evidences`, `action_plans`, `action_plan_updates`.
- `risks`, `risk_control_relations`.
- Official formula, source contract, calculation run/input/output/validation/snapshot lineage.
- Indicator governance, `metric_snapshots` and publication fields.
- `calculation_validations` and `calculation_snapshots` are retained because runtime services persist validation/source dataset lineage and fresh E2E reconstructs source contract -> binding -> formula version -> run -> output -> snapshot.
- Regulatory, Knowledge/RAG, GRC Observation/Gap and Operational Learning tables required by protected runtime contracts.

Excluded legacy/non-product objects:

- No `controls`.
- No `control_health_scores`.
- No `v_latest_health_kpi_snapshots*`.
- No `KPI-HLT-*`.
- No QA/demo/backup/preview/history objects in fresh PostgreSQL.
- No tenant/customer/demo seed rows.

Baseline hashes:

- `production_schema_v1.sql`: `67de1d8eedab0d86e51ca3f477355a41cef8a8798bf66f46b1ed28ca2d0bd818`.
- `production_seed_v1.sql`: `630326bfa6676e7617807ec022b8d0a95dc5fbe6249ec3e52e4c7e308e53876a`.

Limit:

- This is a local fresh-bootstrap review. It is not authorization to create or cut over a real production database.
