# TCDX SaaSv2 real smoke handoff

Status: `TCDX_SAASV2_REAL_SMOKE_READY_FOR_BACKEND_CUTOVER_REVIEW`.

Owner: CODEX A / codex. Branch: `main`. HEAD verified before work: `bb61949f50c6fc5f03a2cc1ebaa4eb8e70cd2e53`.

## Scope

Real smoke validation against `tcdx_saasv2` using local PostgreSQL 16.15 at `127.0.0.1:55432` as `postgres`. No deploy, commit, push, merge, baseline reload, database create/drop or write to `tecdex_saas` was executed.

## Root Cause And Classification

- First blocker: `PRODUCT_DEFECT`, resolved before this handoff. `persistFunctionalFailure` now preserves `formula.version` as `formula_version`, so unmeasured `F5_5_GRC_HEALTH` runs resolve a valid `formula_version_id`.
- Second blocker: `HARNESS_DEFECT`. The smoke Health assertion read `calculation_outputs.numeric_value`, but current official runtime persistence writes the canonical published payload to `calculation_outputs.output_value` as JSON with shape `{ "status", "value" }`.
- Product evidence: `phase5.persistOfficialCalculation` inserts `output_value`; `sourceResolver`, `canonicalHealthProjection` and Phase 5 read paths consume `co.output_value?.value`. The real schema keeps `numeric_value` nullable, so a null `numeric_value` column is not evidence of a missing product score.

## Changed Files

- `backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
- `backend/src/services/math-governance/officialCalculationOrchestrator.test.js`
- `scripts/normalization/tcdx-saasv2-real-smoke.test.js`
- `artifacts/db-integral/tcdx-saasv2-real-smoke/REAL_DB_SMOKE_RESULT.txt`
- `artifacts/db-integral/tcdx-saasv2-real-smoke/REAL_DB_SMOKE_SUMMARY.md`
- `docs/codex/handoffs/TCDX-SAASV2-REAL-SMOKE.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`

## Evidence

- `node --check backend/src/services/math-governance/officialCalculationOrchestrator.service.js`: PASS
- `node --check backend/src/services/math-governance/officialCalculationOrchestrator.test.js`: PASS
- `node --check scripts/normalization/tcdx-saasv2-real-smoke.test.js`: PASS
- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js`: `OFFICIAL_CALCULATION_ORCHESTRATOR_TESTS_OK`, assertions 48
- `git diff --check`: PASS
- `node scripts/normalization/tcdx-saasv2-real-smoke.test.js > artifacts/db-integral/tcdx-saasv2-real-smoke/REAL_DB_SMOKE_RESULT.txt 2>&1`: PASS

## Final Gates

- Preconditions: tenants 0, legacy objects 0, formula definitions 53, formula versions 53, valid formula-source links 53, source contracts 20, metric definitions 22, metric source bindings 22, ISO controls 61, evidence expectations 54, knowledge items 1000.
- Runtime formulas: `F5_5_COMPLIANCE_WEIGHTED`, `F5_5_COVERAGE`, `F5_5_RESIDUAL_RISK`, `F5_5_WEIGHTED_PROGRESS`, `F5_5_FRESHNESS_CONTINUOUS`, `F5_5_GRC_HEALTH`.
- Lineage: runs 18, outputs 18, source snapshots 18, metric snapshots 6, invalid lineage 0, tenant-inconsistent lineage 0.
- Multitenant: `FORMULA_CROSS_TENANT_LEAKAGE=0`.
- Health: Tenant A calculated and publicable with canonical `output_value.value=95.8`; Tenant B unmeasured with `FORMULA_INSUFFICIENT_COVERAGE`, canonical value null and no numeric zero published.
- Cleanup: final tenants 0 and synthetic user 0.
- Final global invariants: formula definitions 53, formula versions 53, valid formula-source links 53, source contracts 20, ISO controls 61, evidence expectations 54, knowledge items 1000.

## Do Not Rediscover

- Do not reopen the `formula_version_id` product fix without new objective evidence.
- Do not treat `calculation_outputs.numeric_value IS NULL` as a product failure for this runtime path. The canonic smoke assertion is `output_value.value`, with explicit null preservation for unmeasured Health.
- Do not convert unmeasured, missing, unknown, stale, not configured or insufficient coverage states to zero.

## Next Action

Human backend cutover review of `artifacts/db-integral/tcdx-saasv2-real-smoke/REAL_DB_SMOKE_RESULT.txt` and `artifacts/db-integral/tcdx-saasv2-real-smoke/REAL_DB_SMOKE_SUMMARY.md`. Codex stops with no commit, push or deploy.
