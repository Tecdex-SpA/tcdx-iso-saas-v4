# Formula Review

Status: PASS.

Reproduced results:

- `ACTIVE_FORMULAS=53`.
- `SOURCE_CONTRACTS=20`.
- `BINDINGS=53`.
- `FORMULA_NUMERIC_MISMATCH=0`.
- `SNAPSHOT_MISMATCH=0`.
- `PROJECTION_MISMATCH=0`.
- `UNRECONSTRUCTABLE_OUTPUTS=0`.
- `REGISTRY_NUMERIC_GOLDEN PASS`.
- `FORMULA_CROSS_TENANT_LEAKAGE=0`.
- `RUNTIME_ORCHESTRATOR_END_TO_END PASS`.

Specific formulas reviewed:

- `F5_5_SEVERITY_INDEX`: formula remains `(1Nb+2Nm+3Na+4Nc)/(4N)*100`; fixture raw expected `54.1667`; official active precision is `2`, so runtime output is `54.17`. The assertion uses official precision metadata, without changing formula expression or fixture authority.
- `F5_5_SURVEY_SCORE`: active precision `2`; fixture raw expected `73.3333`; precision-normalized comparison is applied.
- `F5_5_SAMPLE_SIZE`: active precision `2`; fixture raw expected `277.7445`; precision-normalized comparison is applied.

Lineage and publication:

- The exhaustive 53-formula section reconstructs registry/binding/run/output/snapshot lineage for every active formula and verifies values against the active registry.
- The productive E2E section uses `officialCalculationOrchestrator.service.js -> recalculateOfficialAnalytics` for calculation runs, outputs and source snapshots, then `indicatorGovernance.calculateIndicator -> createSnapshot -> publishSnapshot` for official metric snapshots.
- Runtime E2E published 6 indicator snapshots and persisted 18 runs, 18 outputs and 18 source snapshots.

Tenant isolation:

- Tenant A and Tenant B use different SoA/evidence/action/risk inputs.
- Tenant B keeps `F5_5_GRC_HEALTH` unmeasured due `FORMULA_INSUFFICIENT_COVERAGE`.
- Cross-tenant equal-output leakage check for compliance returns `0`.
