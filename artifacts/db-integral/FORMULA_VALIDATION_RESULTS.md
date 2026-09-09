# Formula Validation Results

Status: PASS for numeric golden and runtime E2E.

## Golden numeric gate

- `ACTIVE_FORMULAS=53`
- `FORMULA_NUMERIC_MISMATCH=0`
- `SNAPSHOT_MISMATCH=0`
- `PROJECTION_MISMATCH=0`
- `UNRECONSTRUCTABLE_OUTPUTS=0`
- `REGISTRY_NUMERIC_GOLDEN PASS`

## F5_5_SEVERITY_INDEX

- Input: `{ low: 2, medium: 2, high: 1, critical: 1 }`.
- Registry expected raw value: `54.1667`.
- Runtime actual value: `54.17`.
- Root cause: `FORMULA_METADATA_SEMANTICS_MISMATCH`; the active formula publishes precision `2`, so `executeFormula` returns rounded official value.
- Correction: the gate now compares expected values after applying active formula/output precision. No expected fixture constant or formula expression was changed.

## Runtime orchestrator E2E

- Entrypoint: `officialCalculationOrchestrator.service.js -> recalculateOfficialAnalytics`.
- Publication phase: `indicatorGovernance.calculateIndicator -> createSnapshot -> publishSnapshot`.
- Formulas executed in runtime E2E: `F5_5_COMPLIANCE_WEIGHTED`, `F5_5_COVERAGE`, `F5_5_RESIDUAL_RISK`, `F5_5_WEIGHTED_PROGRESS`, `F5_5_FRESHNESS_CONTINUOUS`, `F5_5_GRC_HEALTH`.
- `RUNTIME_ORCHESTRATOR_RUNS=18`.
- `RUNTIME_ORCHESTRATOR_OUTPUTS=18`.
- `RUNTIME_ORCHESTRATOR_SOURCE_SNAPSHOTS=18`.
- `RUNTIME_ORCHESTRATOR_METRIC_SNAPSHOTS=6`.
- `RUNTIME_INDICATOR_SNAPSHOTS=6`.
- `FORMULA_CROSS_TENANT_LEAKAGE=0`.
- `RUNTIME_ORCHESTRATOR_END_TO_END PASS`.

Tenant A used compliant SoA, fresh evidence, residual risk from `risks + risk_control_relations`, and action progress from `action_plan_updates`. Tenant B used non-compliant SoA, expired evidence, weaker risk mitigation, and lower action progress; outputs differed and GRC Health remained unmeasured due insufficient coverage.
