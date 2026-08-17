# HANDOFF PUI-07-HF1

Owner: CODEX A
Account: codex
Status: DONE_LOCAL
Branch: hotfix/pui-07-hf1-official-pipeline-consolidation
Base SHA: 17975ded33956a103e31c26b036b2b4ccae876ea
Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Root cause confirmed:

- Production evidence showed `phase5_5_package3` persisted official-looking runs from overview-derived inputs independently from `officialCalculationOrchestrator`.
- The parallel path could produce ambiguous states such as `calculated + source_unavailable` and not-calculable rows with explanation text but without machine-readable snapshot/provenance.
- Frontend recalculation sent a universal `America/Santiago` timezone instead of relying on backend/tenant policy.

Parallel Package3 paths:

- `backend/src/services/phase5/phase5.service.js`: `calculateOfficialGrcMetric`, `persistOfficialCalculation`, explanation/lineage fallback metadata and `getGrcOverview`.
- `backend/src/services/math-governance/phase5Package3.service.js`: former overview-derived official calculations.
- `frontend/src/components/math-governance/FormulaCatalog.tsx`: former fixed timezone in recalculation payload.

Consumers consolidated:

- `/api/grc/official/recalculate` already used `officialCalculationOrchestrator`.
- `getGrcOverview` now calls `officialCalculationOrchestrator.recalculateOfficialAnalytics` for Package3-compatible formula codes and projects those canonical results into `official_calculations`.
- `calculateOfficialGrcMetric` now maps metric keys to formula codes and delegates to `officialCalculationOrchestrator.recalculateOfficialAnalytics`.
- `phase5Package3.service.js` is now compatibility-only and throws `PACKAGE3_CANONICAL_ORCHESTRATOR_REQUIRED` for direct calculation.

Canonical pipeline:

```text
consumer
-> officialCalculationOrchestrator
-> sourceResolver
-> source contracts / validation
-> PUI-01..PUI-07
-> official result
-> calculation_run / output / explanation / source snapshot
```

Not-calculable provenance:

- Functional failures now include `machine_reason`, `human_explanation`, `data_requirements`, `source_status`, `source_counts` when available and canonical `data_trust`.
- `persistOfficialCalculation` maps non-calculable functional statuses to `run_status=not_calculable` instead of treating them as calculated.
- `calculation_inputs`, `calculation_outputs` and `calculation_explanations` metadata carry machine reason, source status and Data Trust.

Snapshot behavior:

- `officialCalculationOrchestrator` builds a minimum source snapshot for functional failures that do not already have one.
- Calculated results still require the existing source snapshot.
- No rows or metric values are fabricated; unavailable counts remain absent in the snapshot payload.

Data Trust unification:

- Canonical truth remains `data_trust` / `data-trust-model-v1`.
- Legacy `trust_score` and `trust_status` are compatibility projections derived from `data_trust` when present.
- Package3 no longer owns trust as a primary signal.

Weighted progress contradiction:

- `F5_5_WEIGHTED_PROGRESS` can no longer be calculated by overview trust score while carrying `source_unavailable`.
- If the canonical source is unavailable, the orchestrator returns/persists `not_calculable` with `SOURCE_UNAVAILABLE`, Data Trust and snapshot/provenance.

Timezone hardcode resolution:

- `FormulaCatalog.tsx` no longer sends `timezone:'America/Santiago'`.
- `officialCalculationOrchestrator.normalizePeriod` no longer defaults to `America/Santiago`.
- Focal official-calculation persistence no longer writes `UTC` as a replacement universal timezone when the period has no explicit timezone.

Resolution per formula:

| Formula | HF1 decision |
|---|---|
| `F5_5_COMPLIANCE_WEIGHTED` | Uses canonical source `compliance_requirements_assessments` through orchestrator/resolver; no overview compliance score synthesis. |
| `F5_5_CONTROL_EFFECTIVENESS` | Uses canonical `control_assurance_evidence` through orchestrator/resolver; no D/I/O/E fabrication from overview/control aggregate score. |
| `F5_5_RESIDUAL_RISK` | Uses canonical `risk_register_controls` and dependency enrichment inside orchestrator; no overview-only residual risk. |
| `F5_5_READINESS` | Missing upstream components are represented as `dependency_pending`/not-calculable with structured requirements. |
| `F5_5_GRC_HEALTH` | Missing upstream components are represented as dependency/not-calculable state with machine-readable reason and Data Trust. |
| `F5_5_WEIGHTED_PROGRESS` | Uses canonical `audit_findings_actions`; source unavailable cannot remain calculated. |

Files changed:

- `backend/src/services/phase5/phase5.service.js`
- `backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
- `backend/src/services/math-governance/phase5Package3.service.js`
- `backend/src/services/math-governance/officialCalculationOrchestrator.test.js`
- `backend/src/services/math-governance/phase5Package3.test.js`
- `frontend/src/components/math-governance/FormulaCatalog.tsx`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/handoffs/PUI-07-HF1.md`

Source contracts changed:
NONE

Formula changes:
NONE

SOURCE_CONTRACTS_VERSIONED:
[]

FORMULAS_VERSIONED:
[]

UNNECESSARY_VERSION_BUMPS:
0

FOCAL_TEST:
PASS - `cd backend && node src/services/math-governance/officialCalculationOrchestrator.test.js` -> `OFFICIAL_CALCULATION_ORCHESTRATOR_TESTS_OK`

FULL_CI:
NOT_RUN_BY_DESIGN

FULL_REGRESSION:
NOT_RUN_BY_DESIGN

PUSH:
NOT_RUN_BY_DESIGN

MERGE:
NOT_RUN_BY_DESIGN

DEPLOY:
NOT_RUN_BY_DESIGN

MANUAL_VALIDATION_PENDING:
YES

Gates:

- OFFICIAL_CALCULATION_SINGLE_SOURCE_OF_TRUTH = PASS
- PACKAGE3_PARALLEL_TRUTH = 0
- PACKAGE3_USES_CANONICAL_ORCHESTRATOR = PASS
- NOT_CALCULABLE_PROVENANCE = PASS
- NOT_CALCULABLE_SNAPSHOT = PASS
- MACHINE_READABLE_REASON = PASS
- DATA_TRUST_CANONICAL = PASS
- LEGACY_TRUST_AS_PRIMARY = 0
- COMPLIANCE_WEIGHTED_CANONICAL_PATH = PASS
- CONTROL_EFFECTIVENESS_CANONICAL_PATH = PASS
- RESIDUAL_RISK_CANONICAL_PATH = PASS
- READINESS_DEPENDENCY_EXPLAINED = PASS
- GRC_HEALTH_DEPENDENCY_EXPLAINED = PASS
- WEIGHTED_PROGRESS_STATUS_COHERENT = PASS
- HARDCODED_TIMEZONE = 0
- SOURCE_OWNERSHIP_REOPENED = NO
- SCALE_UNIT_REOPENED = NO
- COUNT_SEMANTICS_REOPENED = NO
- TEMPORAL_SEMANTICS_REOPENED = NO
- STATUS_SEMANTICS_REOPENED = NO
- FALLBACK_GOVERNANCE_REOPENED = NO
- DATA_TRUST_REOPENED = NO
- FORMULA_EXPRESSION_CHANGED = NO
- FORMULA_WEIGHTS_CHANGED = NO
- FORMULA_UNITS_CHANGED = NO
- FORMULA_PRECISION_CHANGED = NO
- TENANT_SCOPE_PRESERVED = PASS
- SELLABLE_MULTI_TENANT = PASS
- ZERO_HARDCODE = PASS
- PUBLISHED_CONTRACT_IMMUTABILITY = PASS
- PUBLISHED_FORMULA_IMMUTABILITY = PASS
- UNNECESSARY_VERSION_BUMPS = 0
- PRODUCT_CODE_SCOPE = FOCUSED
- CODEX_VALIDATION_MODE = FOCUSED_MINIMAL
- FOCAL_TEST = PASS
- FULL_CI = NOT_RUN_BY_DESIGN
- FULL_REGRESSION = NOT_RUN_BY_DESIGN
- PUSH = NOT_RUN_BY_DESIGN
- MERGE = NOT_RUN_BY_DESIGN
- DEPLOY = NOT_RUN_BY_DESIGN
- MANUAL_VALIDATION_PENDING = YES

Remaining debt:

- None in Codex-local HF1 scope.
- Manual CI/full regression/deploy/runtime validation remains pending by design.
- PUI-08 remains blocked until manual production verification passes.

## Do not rediscover

- Package3 was parallel before HF1.
- `officialCalculationOrchestrator -> sourceResolver` is canonical for official formulas.
- `phase5Package3.service.js` is compatibility-only and must not calculate from overview.
- `not_calculable` requires machine-readable reason, Data Trust and source snapshot/provenance when persistence is available.
- `data-trust-model-v1` is canonical; `trust_score`/`trust_status` are legacy projections only.
- No universal `America/Santiago` timezone in official recalculation.
- PUI-01 source ownership, PUI-02 scale/unit, PUI-03 counts, PUI-04 temporal, PUI-05 status, PUI-06 fallback and PUI-07 Data Trust remain closed.
- PUI-08 remains blocked until manual production verification passes.

Next exact action:

- User pushes branch, opens PR, runs CI/full regression/deploy and validates production DB evidence for HF1.

PUI-08:
BLOCKED until manual HF1 production validation passes.
