# Phase 6.5 - Functional Flows + Actionable UX States

## Status

READY_FOR_INTERMEDIATE_MERGE_REVIEW

This phase is implemented as a focused branch for review. It does not start Phase 6.6 and does not change official formulas.

## Platform Base

- Branch base: `main`
- Main/origin/main at baseline: `b3c4dc9cbc0c1e2d05219447244209c2c7567016`
- PR #85: merged into main and observed in deployed frontend chunks
- Frontend runtime: HTTP 200
- Backend runtime: `/health` healthy
- AI Engine runtime: healthy through backend health dependency

## Score Global Dependency Analysis

The official Global Score is sourced only from the governed `GRC-HEALTH` snapshot when that official metric is `calculated`. No Admin KPI score, average fallback, null-to-zero conversion, or fake health score is used.

Official formula:

- Metric: `GRC-HEALTH`
- Formula: `F5_5_GRC_HEALTH`
- Expression: weighted risk, compliance, actions, evidence and data trust components
- Weights: risk `0.2`, compliance `0.25`, actions `0.15`, evidence `0.2`, dataTrust `0.2`

Blocking dependency:

- Component: `dataTrust`
- Official dependency metric: `DATA-TRUST`
- Formula: `F5_C3_DATA_TRUST`
- Source contract: `indicator_data_trust_assessments`
- Runtime state: `insufficient_data`
- Source table: `metric_trust_assessments`

Exact missing inputs observed in runtime Data Trust dimensions:

| Component | Missing evidence | Route | Capability |
| --- | --- | --- | --- |
| accuracy | explicit accuracy validation records | `/datos/calidad` | `metrics.data_trust` |
| lineage | source snapshot identifiers | `/datos/lineage` | `data.lineage` |
| validation | successful validation evidence for official run | `/datos/calidad` | `metrics.data_trust` |
| stability | six historical points for coefficient-of-variation stability | `/metricas` | `metrics.jobs.run` |

Expected result after completion:

1. Complete the missing Data Trust evidence in the corresponding governed sources.
2. Recalculate/publish `DATA-TRUST` through the official pipeline.
3. Recalculate/publish `GRC-HEALTH`.
4. `official_score` becomes available only after `GRC-HEALTH` is `calculated`.

## Corrections

- Official snapshots now carry `data_requirements`, `source_contract` and `actionable_state`.
- The backend derives missing components and resolution routes from governed metadata and trust dimensions.
- `/metricas` and metric detail views show state, reason, missing components, source route and required capability for non-calculated official metrics.
- Dashboard KPI explains why the Global Score is pending and what source/capability is needed next.
- Dashboard official recalculation now uses inline success/error feedback instead of browser alerts.

## P0 Workflow Matrix

| FLOW | READ | MUTATION | PERSISTENCE | UX STATES | RBAC | RESULT |
| --- | --- | --- | --- | --- | --- | --- |
| Cumplimiento / Auditoria | PASS | PASS delegated | PASS | PASS | PASS | PASS_WITH_DELEGATED_SUBFLOWS |
| Evidencias | PASS | PASS | PASS | PASS_WITH_LEGACY_ALERT_DEBT | PASS | PASS |
| Riesgos | PASS | PASS delegated | PASS | PASS | PASS | PASS_WITH_DELEGATED_SUBFLOWS |
| Planes de accion | PASS | PASS delegated | PASS | PASS | PASS | PASS_WITH_DELEGATED_SUBFLOWS |
| KPI / Metricas oficiales | PASS | PASS | PASS | PASS | PASS | PASS |
| GRC integrado | PASS | PASS delegated | PASS | PASS | PASS | PASS |
| Report / Export | PASS | PASS | PASS | PASS | PASS | PASS |

## Gates

- BROKEN_P0_FUNCTIONAL_FLOW = 0
- NON_ACTIONABLE_INSUFFICIENT_DATA = 0
- NON_ACTIONABLE_DEPENDENCY_PENDING = 0
- MUTATION_WITHOUT_USER_FEEDBACK = 0
- CRITICAL_STALE_UI_AFTER_MUTATION = 0
- CRITICAL_DOUBLE_SUBMIT = 0
- BROKEN_EMPTY_STATE = 0
- FAKE_EMPTY_STATE_DATA = 0
- RAW_TECHNICAL_UI_LEAK = 0
- READ_ONLY_MUTATION_EXPOSED = 0
- CRITICAL_UPLOAD_FLOW_ERROR = 0
- CRITICAL_REPORT_EXPORT_ERROR = 0
- NEW_TENANT_CRASH = 0
- CROSS_TENANT_LEAKAGE = 0
- OFFICIAL_NULL_TO_ZERO = 0
- ADMIN_OFFICIAL_CROSSOVER = 0
- PHASE6_4_REGRESSION = 0
- PHASE6_3_REGRESSION = 0
- PHASE6_2_REGRESSION = 0
- PHASE5_REGRESSION = 0
- ZERO_HARDCODE = PASS
- SELLABLE_MULTI_TENANT = PASS

## Artifacts

- `artifacts/phase6/6.5-functional-flows/baseline/platform-base.json`
- `artifacts/phase6/6.5-functional-flows/inventory/p0-surface-inventory.json`
- `artifacts/phase6/6.5-functional-flows/p0-flows/p0-workflow-matrix.md`
- `artifacts/phase6/6.5-functional-flows/score-dependencies/score-global-data-trust-analysis.json`
- `artifacts/phase6/6.5-functional-flows/ux-states/actionable-official-states.json`
- `artifacts/phase6/6.5-functional-flows/rbac/rbac-summary.json`
- `artifacts/phase6/6.5-functional-flows/multi-tenant/validation-summary.json`
- `artifacts/phase6/6.5-functional-flows/regression/validation-results.json`
- `artifacts/phase6/6.5-functional-flows/gate/phase6-5-gate.json`
