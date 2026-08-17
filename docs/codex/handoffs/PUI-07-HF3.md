# HANDOFF PUI-07-HF3

Owner: CODEX A
Account: codex
Status: DONE_LOCAL
Branch: fix/pui-07-hf3-final-contract-closure
Base SHA: 2dc4820cd8c7967eb051e2c1b4dcbbe5f19e13b6
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:
Closed residual source contract drift for `F5_5_SEVERITY_INDEX`, `F5_5_MATURITY` and `grc_health_components` without starting PUI-08.

Root cause - F5_5_SEVERITY_INDEX:
- Source: `audit_findings_actions`, physical source `grc_readiness_findings`.
- Raw statuses: no row-local status in `grc_readiness_findings`; status semantics was forced to unknown/not mapped.
- Temporal fields: row-local table has no action lifecycle timestamp; parent `grc_readiness_snapshots` has `source_as_of`, `period_start`, `period_end`, `generated_at`.
- Root cause: resolver treated snapshot findings as action rows and did not join snapshot temporal context.
- Fix: severity query joins `grc_readiness_snapshots`, emits `status=not_applicable`, preserves snapshot temporal fields, and classifies severity `info` as known non-weighted exclusion `severity_not_eligible`.

Root cause - F5_5_MATURITY:
- Source: `maturity_assessments`, physical sources `survey_evaluations` and `metric_measurements`.
- Raw statuses: `survey_evaluations.evaluation_status` supports `draft`, `previewed`, `confirmed`, `applied`, `rejected`; `metric_measurements.quality_status` supports `valid`, `estimated`, `incomplete`, `inconsistent`, `unknown`, with official unmeasured/error states possible.
- Temporal fields: survey producer has `confirmed_at` and `created_at`; metric measurements have source/calculation/period fields.
- Root cause: `maturity-status-map-v1` did not cover producer-known maturity statuses and the survey adapter expected generic evaluated fields not produced by the schema.
- Fix: `maturity-status-map-v2` maps producer-known eligible and ineligible states distinctly; survey adapter exposes `evaluated_at` from `confirmed_at`/`created_at` without synthetic timestamps.

Root cause - grc_health_components:
- Producer: official calculation persistence (`calculation_runs` + `calculation_outputs`).
- Consumer: `queryHealth` in `sourceResolver.service.js`.
- Temporal semantics: validity interval over official calculation period/run timestamps.
- H1/H2 selected: H2 - contract/adapter drift. `calculation_runs.period_start` is nullable by schema and the query already uses `started_at`/`completed_at` for overlap, but the adapter did not project those fields into rows validated by Data Trust.
- Fix: source contract and query projection include `started_at` and `completed_at`; missing `period_start` no longer causes `temporal_missing_required_time` when official run timestamps prove the interval.

Source contracts changed:
- `audit_findings_actions` v7 -> v8.
- `maturity_assessments` v6 -> v7.
- `grc_health_components` v5 -> v6.

SOURCE_CONTRACTS_VERSIONED:
[`audit_findings_actions`, `maturity_assessments`, `grc_health_components`]

Formula changes:
NONE

FORMULAS_VERSIONED:
[]

Files changed:
- `backend/src/services/math-governance/statusSemantics.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/handoffs/PUI-07-HF3.md`

Codex validation performed:
- `node -c` on modified Math Governance JS files.
- `cd backend && node src/services/math-governance/sourceResolver.test.js`

FOCAL_TEST:
PASS - `PHASE5_5_SOURCE_RESOLVER_TESTS_OK`

Runtime validation:
BLOCKED_RUNTIME by design. Codex did not deploy, recalculate production, or query PostgreSQL runtime.

Required manual runtime validation:
1. Cherry-pick/merge this commit to the runtime base.
2. Push/CI according to project process.
3. Deploy with `./scripts/deploy-vms.sh`.
4. Run official recalculation.
5. Verify PostgreSQL for `F5_5_SEVERITY_INDEX`, `F5_5_MATURITY`, and `F5_5_GRC_HEALTH`:
   - recent `calculation_runs` by `formula_code`, `tenant_id`, `status`, `completed_at`;
   - `calculation_snapshots` metadata/source evidence;
   - `metadata.data_trust.model_version`, state and reasons;
   - `received`, `eligible`, `usable`, `excluded`;
   - issue codes grouped by physical source and raw status.

Suggested PostgreSQL checks:

```sql
SELECT id, tenant_id, formula_code, run_status, completed_at
FROM calculation_runs
WHERE formula_code IN ('F5_5_SEVERITY_INDEX','F5_5_MATURITY','F5_5_GRC_HEALTH')
ORDER BY completed_at DESC NULLS LAST
LIMIT 30;

SELECT cr.formula_code,
       cs.run_id,
       cs.row_count,
       cs.metadata->'source_snapshot'->'counts' AS counts,
       cs.metadata->'source_snapshot'->'physical_sources' AS physical_sources,
       cs.metadata->'source_snapshot'->'exclusions' AS exclusions,
       cs.metadata->'data_trust' AS data_trust
FROM calculation_snapshots cs
JOIN calculation_runs cr ON cr.id = cs.run_id
WHERE cr.formula_code IN ('F5_5_SEVERITY_INDEX','F5_5_MATURITY','F5_5_GRC_HEALTH')
ORDER BY cs.created_at DESC
LIMIT 30;
```

Gates:
- ROOT_CAUSE_SEVERITY_INDEX = PASS
- ROOT_CAUSE_MATURITY = PASS
- ROOT_CAUSE_GRC_HEALTH_TEMPORAL = PASS
- STATUS_CONTRACT_DRIFT = PASS
- TEMPORAL_CONTRACT_CLOSURE = PASS
- DATA_TRUST_REGRESSION = PASS
- SOURCE_RESOLVER_REGRESSION = PASS
- PROVENANCE_REGRESSION = PASS
- SELLABLE_MULTI_TENANT = PASS
- TENANT_SCOPE_PRESERVED = PASS
- ZERO_HARDCODE = PASS
- NO_FAKE_DATES = PASS
- NO_STATUS_BYPASS = PASS
- NO_LEGACY_FALLBACK = PASS
- NO_DEMO_DATA = PASS
- NO_TENANT_HARDCODE = PASS
- NO_MANUAL_SQL_DEPENDENCY = PASS
- NULL_TO_ZERO_INTRODUCED = NO
- FORMULA_EXPRESSION_CHANGED = NO
- FORMULA_WEIGHTS_CHANGED = NO
- FORMULA_UNITS_CHANGED = NO
- FORMULA_PRECISION_CHANGED = NO
- PUBLISHED_CONTRACT_IMMUTABILITY = PASS
- PUBLISHED_FORMULA_IMMUTABILITY = PASS
- UNNECESSARY_VERSION_BUMPS = 0
- SNAPSHOT_REGRESSION = BLOCKED_RUNTIME
- RUNTIME_RECALCULATION = BLOCKED_RUNTIME
- DEPLOY = NOT_RUN_BY_DESIGN

Known failures:
NONE in local focal validation.

Remaining debt:
Remaining HF3 implementation debt: NONE
Runtime validation: PENDING_MANUAL

## Do not rediscover

- PUI-01..PUI-07-HF2 remain closed unless new evidence directly contradicts them.
- Package3 is not a parallel source of truth.
- `data-trust-model-v1` remains canonical.
- `status_unmapped` and `status_not_eligible` are not equivalent.
- Do not invent timestamps, use `NOW()`, or copy `created_at` unless the source contract proves that semantic.
- `grc_readiness_findings` has no operational status; use `not_applicable` only for that snapshot-finding source.
- `maturity-status-map-v2` covers producer-known survey/measurement states; unknown maturity statuses must remain `status_unmapped`.
- `grc_health_components` can use `started_at`/`completed_at` when `period_start` is null because `calculation_runs.period_start` is nullable.
- Future source contract payload changes require version bumps.

Do not touch:
- Formula expressions, weights, units or precision.
- Data Trust v1 semantics.
- PUI-08 dashboard/snapshot/lineage work.
- AI/RAG/Regulatory/UI/infrastructure.

Next exact action:
User performs cherry-pick/push/deploy/runtime recalculation and PostgreSQL verification.

Files next account should inspect first:
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/statusSemantics.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/handoffs/PUI-07-HF3.md`

Files next account should NOT inspect unless evidence/test requires it:
- `frontend/`
- `ai-engine/`
- `backend/src/services/knowledge-base/`
- `backend/src/services/intelligence/`
- infrastructure/deploy scripts
