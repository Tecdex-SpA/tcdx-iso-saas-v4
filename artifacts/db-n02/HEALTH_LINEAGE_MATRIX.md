# DB-N02 Health Lineage Matrix

Fecha: 2026-09-07
Branch: `codex/db-n01-control-identity-normalization`
HEAD base: `11003dd92385dcca1caf5365fa437be3aee1f648`

## Authority Model

BEFORE:

- Health DB V1: `control_health_scores` / `refresh_control_health_scores_v2_1` alimentaba drill-down legacy con `standard_code` circular.
- Operational Health: `backend/src/services/health.service.js` tenia formula operacional de normas/procesos/controles y KPI mixtos.
- Executive Health: `F5_5_GRC_HEALTH` v2 ya existia en Math Governance, pero consumidores Health/KPI podian mezclarlo con KPI-HLT legacy.
- Projection: `canonicalHealthProjection.service.js` proyectaba Health, pero necesitaba cerrar MISSING/UNKNOWN numeric, stale policy y rol explicito.
- KPI-HLT: `v_latest_health_kpi_snapshots` / `KPI-HLT-*` seguia como fuente historica visible.

AFTER:

- EXECUTIVE AUTHORITY: `F5_5_GRC_HEALTH` v2 through `official_formula_versions -> calculation_runs -> calculation_outputs -> metric_snapshots -> metric_source_bindings`.
- OPERATIONAL AUTHORITY: `health.service.js` / operational control health drill-down.
- COMPATIBILITY: `control_health_scores`, `v_latest_health_kpi_snapshots`, `KPI-HLT-*`.
- PROJECTION: `canonicalHealthProjection.service.js` is `READ_NORMALIZE_EXPLAIN_PRESENT_ONLY`; it does not create an executive formula.

## Component Matrix

| component | metric_code | formula_code | formula_version | source entity | source contract | metric source binding | calculation run | calculation output | metric snapshot | state | stale policy | coverage role | API consumer | UI consumer | legacy equivalent | authority classification |
|---|---|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|
| risk | `RISK-RESIDUAL` | `F5_5_RESIDUAL_RISK` | 2 | `risk_register_controls` via official source resolver | `risk_register_controls` | required published binding for `RISK-RESIDUAL` / formula binding | `calculation_runs.formula_code='F5_5_RESIDUAL_RISK'` | `calculation_outputs.output_value` | `metric_snapshots` for `RISK-RESIDUAL` | `AVAILABLE/MISSING/STALE/INVALID/UNKNOWN` | `metric_calculation_policies.stale_after`; tenant policy wins over global | weighted component; missing reduces coverage | `/api/health/*`, `/api/grc/overview` through canonical projection | `/dashboard`, `/health`, `/iso-health` | operational risk/control health detail | `OFFICIAL` |
| compliance | `COMPLIANCE` | `F5_5_COMPLIANCE_WEIGHTED` | 2 | `compliance_requirements_assessments` | `compliance_requirements_assessments` | required published binding for `COMPLIANCE` / formula binding | `calculation_runs.formula_code='F5_5_COMPLIANCE_WEIGHTED'` | `calculation_outputs.output_value` | `metric_snapshots` for `COMPLIANCE` | `AVAILABLE/MISSING/STALE/INVALID/UNKNOWN` | `metric_calculation_policies.stale_after`; tenant policy wins over global | weighted component; missing reduces coverage | `/api/health/*`, `/api/grc/overview` through canonical projection | `/dashboard`, `/health`, `/iso-health` | old compliance coverage blocks | `OFFICIAL` |
| actions | `ACTIONS` | `F5_5_WEIGHTED_PROGRESS` | 2 | `audit_findings_actions` | `audit_findings_actions` | required published binding for `ACTIONS` / formula binding | `calculation_runs.formula_code='F5_5_WEIGHTED_PROGRESS'` | `calculation_outputs.output_value` | `metric_snapshots` for `ACTIONS` | `AVAILABLE/MISSING/STALE/INVALID/UNKNOWN` | `metric_calculation_policies.stale_after`; tenant policy wins over global | weighted component; missing reduces coverage | `/api/health/*`, `/api/grc/overview` through canonical projection | `/dashboard`, `/health`, `/iso-health` | operational action-plan progress | `OFFICIAL` |
| evidence | `EVIDENCE-FRESH` | `F5_5_FRESHNESS_CONTINUOUS` | 2 | `data_quality_observations` / evidence freshness projection | `data_quality_observations`; functional indicator maps `EVIDENCE-FRESH` to `evidence_freshness_records` | required published binding for `EVIDENCE-FRESH` / formula binding | `calculation_runs.formula_code='F5_5_FRESHNESS_CONTINUOUS'` | `calculation_outputs.output_value` | `metric_snapshots` for `EVIDENCE-FRESH` | `AVAILABLE/MISSING/STALE/INVALID/UNKNOWN` | `metric_calculation_policies.stale_after`; tenant policy wins over global | weighted freshness component; not compliance coverage | `/api/health/*`, `/api/grc/overview` through canonical projection | `/dashboard`, `/health`, `/iso-health` | `EVIDENCE-COVERAGE` alias only | `OFFICIAL` |
| dataTrust | `DATA-TRUST` | `F5_C3_DATA_TRUST` | 2 | `indicator_data_trust_assessments` | `indicator_data_trust_assessments` | required published binding for `DATA-TRUST` / formula binding | `calculation_runs.formula_code='F5_C3_DATA_TRUST'` | `calculation_outputs.output_value` | `metric_snapshots` for `DATA-TRUST` | `AVAILABLE/NOT_CONFIGURED/MISSING/STALE/INVALID/UNKNOWN` | `metric_calculation_policies.stale_after`; tenant policy wins over global | weighted component; `NOT_CONFIGURED` reduces coverage | `/api/health/*`, `/api/grc/overview` through canonical projection | `/dashboard`, `/health`, `/iso-health` | legacy data-quality/data-trust blocks | `NOT_CONFIGURED` until measurable accuracy source exists |
| GRC-HEALTH global | `GRC-HEALTH` | `F5_5_GRC_HEALTH` | 2 | official component outputs and/or published global snapshot | `grc_health_components` | required published binding for `GRC-HEALTH` / formula binding | `calculation_runs.formula_code='F5_5_GRC_HEALTH'` | `calculation_outputs.output_value` with coverage details | `metric_snapshots` for `GRC-HEALTH` | `measured/insufficient_coverage/not_calculable` | global policy `stale_after` applied to runs/snapshots when present | executive publication only when `coverage >= minimum_coverage` | `/api/health/summary`, `/api/health/dashboard`, `/api/health/kpis`, `/api/grc/overview` | `/dashboard`, `/health`, `/iso-health` | `KPI-HLT-*` retained as compatibility detail only | `OFFICIAL` |

## Standard Code Lineage

Canonical source:

```text
control_health_scores.tenant_control_id
-> tenant_controls.id
-> tenant_controls.control_id
-> controls_catalog_standards.standard_code / controls_catalog.iso
-> tenant_standards active for the same tenant
```

DB-N02 does not derive `standard_code` from the previous `control_health_scores.standard_code`.

2001 QA rows strategy:

- QA audit found `2455 control_health_scores` and `2001 missing_standard_code`.
- DB-N02 was not applied to QA, so this matrix does not claim those 2001 rows are already resolved.
- After authorized apply, rows can be classified by `v_control_health_scores_dbn02_lineage` as `RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE`, `MISSING_CANONICAL_STANDARD_MAPPING`, `INACTIVE_STANDARD_BLOCKED` or `AMBIGUOUS`.
- `refresh_control_health_scores_v2_1(uuid)` updates only unique `RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE` rows and leaves missing/inactive/ambiguous rows untouched for review.

Ambiguity policy:

- The model permits multi-standard catalog mappings through `controls_catalog_standards`.
- If more than one mapped `standard_code` is active for the tenant, DB-N02 returns `AMBIGUOUS`.
- No `ORDER BY ... LIMIT 1`, `min()` or `max()` is used to choose a winning standard for ambiguous Health rows.

## Compatibility Inventory

KPI-HLT consumers:

- `canonicalHealthProjection.service.js`: `COMPATIBILITY_ONLY`, exposes `compatibility_components` with `LEGACY_KPI_HLT_ROLE`.
- `health.service.js`: `COMPATIBILITY_ONLY`, operational detail uses canonical role.
- `soaIntelligence.service.js`: `LEGACY`, SoA signal only; not executive Health authority.
- `backend/src/routes/health.js`: `LEGACY`, non-sprint `/health/kpis` fallback.
- `kpi.controller.js`, `administrar-kpis`, dashboard labels/i18n and release-closeout fixtures: `COMPATIBILITY_ONLY` / presentation.
- `v_latest_health_kpi_snapshots_applicable`: `COMPATIBILITY_ONLY`.

Evidence mapping:

- `EVIDENCE-FRESH` = freshness.
- `COVERAGE` = compliance coverage / official component coverage depending consumer context.
- `EVIDENCE-COVERAGE` = compatibility alias only; no official duplicate metric is created by DB-N02.

Data Trust:

- `DATA-TRUST` without measurable accuracy source remains `NOT_CONFIGURED`.
- Numeric score is not fabricated when source state is unmeasured or missing.

## Source Contract Chain

```text
official formula
-> metric_source_bindings
-> source contract
-> calculation_runs
-> calculation_outputs
-> calculation_snapshots / metric_snapshots
-> canonicalHealthProjection
```

Known QA audit before DB-N02: `0` published bindings without `source_contract_id`, `0` invalid bindings.
