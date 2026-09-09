# DB-N02 HEALTH METRICS LINEAGE NORMALIZATION

Fecha: 2026-09-07

## Status

`DB_N02_READY_FOR_REVIEW`

## Git

- Branch: `codex/db-n01-control-identity-normalization`
- HEAD inicial/base: `11003dd92385dcca1caf5365fa437be3aee1f648`
- HEAD actual: `11003dd92385dcca1caf5365fa437be3aee1f648`
- Working tree: dirty esperado con DB-N01 + DB-N02, sin commit/push/merge/deploy.
- Retomado desde: PostgreSQL aislado DB-N02 H01-H13 PASS; pendiente era matriz, manifest, inventario, tests, handoff y docs de continuidad.

## DB-N02 Files

DB-N02 only:

- `artifacts/db-n02/initial-git-state.txt`
- `artifacts/db-n02/DB-N02_FILES.txt`
- `artifacts/db-n02/HEALTH_LINEAGE_MATRIX.md`
- `backend/src/services/math-governance/canonicalHealthProjection.service.js`
- `backend/src/services/math-governance/canonicalHealthProjection.service.test.js`
- `database/migrations/20260904_dbn02_health_metrics_lineage_normalization.sql`
- `scripts/normalization/apply-db-n02-health-metrics-lineage-migration.test.js`
- `scripts/normalization/db-n02-health-metrics-lineage.postgres.test.js`
- `docs/handoffs/DB-N02_HEALTH_METRICS_LINEAGE_NORMALIZATION.md`

Shared DB-N01/DB-N02:

- `backend/src/services/soaIntelligence.service.js`: DB-N02 delta normaliza join Health; `tenant_control_id` es identidad operacional y `catalog_control_id` fallback solo aplica cuando `tenant_control_id IS NULL`.
- `backend/src/services/soaIntelligence.service.test.js`: regression assertion para impedir OR ambiguo.
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`

## Health Authorities Before

- Health DB V1: `control_health_scores` / `refresh_control_health_scores_v2_1`.
- Operational formula: `backend/src/services/health.service.js`.
- Official governed formula: `F5_5_GRC_HEALTH` v2.
- Projection: `canonicalHealthProjection.service.js`.
- Compatibility: KPI-HLT objects, `v_latest_health_kpi_snapshots`, `v_latest_health_kpi_snapshots_applicable`.

## Health Authorities After

- EXECUTIVE AUTHORITY: `F5_5_GRC_HEALTH` v2 through `official_formula_versions`, `calculation_runs`, `calculation_outputs`, `metric_snapshots` and `metric_source_bindings`.
- OPERATIONAL AUTHORITY: `health.service.js` / operational control health detail.
- COMPATIBILITY: `control_health_scores`, `v_latest_health_kpi_snapshots`, `KPI-HLT-*`.
- PROJECTION: `canonicalHealthProjection.service.js` is `READ_NORMALIZE_EXPLAIN_PRESENT_ONLY`; no executive formula is duplicated there.

## GRC Health Executive Authority

- Formula: `F5_5_GRC_HEALTH`.
- Version: `2`.
- Policy: dynamic denominator over `AVAILABLE` applicable components; only `NOT_APPLICABLE` leaves the applicable denominator.
- Publication: executive score is publicable only when `coverage >= minimum_coverage`.
- Source chain: official formula -> source binding -> source contract -> run -> output -> snapshot -> canonical projection.

## Operational Health Role

- `health.service.js` continues to expose operational detail by norm/process/control and compatibility KPIs.
- Operational detail cannot override `F5_5_GRC_HEALTH` as executive score.
- KPI-HLT appears only as compatibility/detail through `LEGACY_KPI_HLT_ROLE`.

## Canonical Projection Role

- `canonicalHealthProjection.service.js` reads runs/snapshots, attaches stale policy, normalizes states, explains gaps and presents Health.
- It does not persist official truth and does not compute a parallel executive Health formula.
- `MISSING`/`UNKNOWN` with numeric value remain non-available; they do not promote to `AVAILABLE`.

## Standard Code Lineage

Canonical reconstruction:

```text
control_health_scores.tenant_control_id
-> tenant_controls.id
-> tenant_controls.control_id
-> controls_catalog_standards.standard_code / controls_catalog.iso
-> tenant_standards active for same tenant
```

`refresh_control_health_scores_v2_1(uuid)` no longer depends on stored `control_health_scores.standard_code`, removing the circular dependency.

## 2001 Missing Standard Code Strategy

- QA audit before DB-N02: `2455 control_health_scores`, `2001 missing_standard_code`.
- DB-N02 was not applied to QA and does not claim those rows are resolved.
- After authorized apply, `v_control_health_scores_dbn02_lineage` classifies each row as:
  - `RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE`
  - `MISSING_CANONICAL_STANDARD_MAPPING`
  - `INACTIVE_STANDARD_BLOCKED`
  - `AMBIGUOUS`
- Refresh updates only unique resolved rows; missing/inactive/ambiguous rows remain reviewable.

## Ambiguity Policy

- The model can legitimately represent one catalog control under multiple standards through `controls_catalog_standards`.
- DB-N02 treats multiple tenant-active standard candidates for the same `tenant_control` as `AMBIGUOUS`.
- Ambiguous rows are not updated by `refresh_control_health_scores_v2_1`.
- No `ORDER BY ... LIMIT 1`, `min()` or `max()` is used to pick a winner for ambiguous standard lineage.

## Component States

- `AVAILABLE`: official component has available/calculated state and a numeric value, and is not stale.
- `MISSING`: source unavailable, not calculable, insufficient data/coverage or dependency pending.
- `NOT_CONFIGURED`: configuration/source binding is absent; Data Trust accuracy missing maps here.
- `STALE`: source or snapshot exceeds stale policy.
- `INVALID`: technical/source/schema/validation failure.
- `NOT_APPLICABLE`: explicitly excluded/not applicable; removed from applicable denominator.
- `UNKNOWN`: unmapped state; never promoted only because a numeric value exists.

## Stale Policy

- `loadComponentPolicies()` reads `metric_calculation_policies`.
- Tenant-specific policy has priority over global policy by SQL ordering.
- PostgreSQL interval objects are interpreted by `intervalToMs`.
- Stale policy is attached to both runs and snapshots before component classification.
- Focal test covers tenant override and global fallback behavior.

## KPI-HLT Role

- `KPI-HLT-*`, `v_latest_health_kpi_snapshots` and `v_latest_health_kpi_snapshots_applicable` are `COMPATIBILITY_ONLY`.
- Current consumers found: `canonicalHealthProjection.service.js`, `health.service.js`, `soaIntelligence.service.js`, `health.js`, `kpi.controller.js`, dashboard/Admin KPI/i18n/frontend fixtures/report helpers.
- No executive consumer should use KPI-HLT as Health authority.

## Evidence Freshness / Coverage

- `EVIDENCE-FRESH` = freshness.
- `COVERAGE` = compliance coverage or official component coverage depending consumer context.
- `EVIDENCE-COVERAGE` = compatibility alias only; DB-N02 does not create an official duplicate metric.

## Data Trust

- `DATA-TRUST` without a measurable accuracy source remains `NOT_CONFIGURED`.
- Unmeasured/missing Data Trust does not become numeric zero and reduces Health coverage.

## Source Contracts / Bindings

- Official chain remains `official formula -> source binding -> source contract -> run -> output -> snapshot`.
- Known QA audit before DB-N02: `0` published bindings without `source_contract_id`, `0` invalid bindings.
- DB-N02 does not reform source contracts when existing pipeline is correct.

## Migration

- File: `database/migrations/20260904_dbn02_health_metrics_lineage_normalization.sql`
- Transactional: `BEGIN`/`COMMIT`.
- Lock: `pg_try_advisory_xact_lock(844332, 2026090402)`.
- Preflight columns: yes.
- Objects:
  - `dbn02_normalize_health_component_state`
  - `dbn02_grc_health_publication_state`
  - `dbn02_resolve_control_standard_code`
  - `v_control_health_scores_dbn02_lineage`
  - `refresh_control_health_scores_v2_1(uuid)`
- Safe re-run: covered by PostgreSQL isolated H13.
- Executed on `db-v4`: NO.

## PostgreSQL Isolated Tests

- Command: `node scripts/normalization/db-n02-health-metrics-lineage.postgres.test.js`
- Result: PASS.
- Scenarios: H01-H14 PASS.
- PostgreSQL version: `16.14 (Homebrew)`.
- Isolation: `ISOLATED_FROM_DB_V4 YES`.
- H14 added after continuity resume to prove active multi-standard ambiguity is guarded.

## Runtime / Targeted Tests

PASS:

- `node backend/src/services/math-governance/canonicalHealthProjection.service.test.js`
- `node backend/src/services/math-governance/grcHealthCalculation.service.test.js`
- `node backend/src/services/soaIntelligence.service.test.js`
- `node scripts/normalization/apply-db-n02-health-metrics-lineage-migration.test.js`
- `node scripts/normalization/db-n02-health-metrics-lineage.postgres.test.js`
- `node backend/src/services/math-governance/officialFormulas.test.js`
- `node backend/src/services/math-governance/sourceResolver.test.js`
- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js`
- `node backend/src/services/phase5/phase5CalculationReadIsolation.test.js`
- `node backend/src/services/indicators/indicatorCatalogSnapshotIsolation.test.js`
- `node --check backend/src/services/math-governance/canonicalHealthProjection.service.js`
- `node --check backend/src/services/soaIntelligence.service.js`
- `node --check backend/src/services/math-governance/canonicalHealthProjection.service.test.js`
- `node --check backend/src/services/soaIntelligence.service.test.js`
- `node --check scripts/normalization/apply-db-n02-health-metrics-lineage-migration.test.js`
- `node --check scripts/normalization/db-n02-health-metrics-lineage.postgres.test.js`

## Full Suite Result

- Command: `npm test` from `backend/`.
- Result: FAIL.
- Failure: `backend/src/services/math-governance/grcDecisionCenter.test.js:51`, `true == false`.
- Classification: `PREEXISTING_OR_UNRELATED`.
- Rationale: same known failure in DB-N01 continuity/prompt; DB-N02 did not modify `grcDecisionCenter`.

## Diff Hygiene

- `git diff --check`: PASS.
- Final `git diff --stat` and `git status --short` captured in final response.

## Residual Legacy

- `control_health_scores` remains legacy drill-down/diagnostic compatibility.
- `v_latest_health_kpi_snapshots` and `v_latest_health_kpi_snapshots_applicable` remain KPI-HLT compatibility sources.
- `soaIntelligence.service.js` still reads legacy SoA/Health signals as recommendation context, not executive Health.
- `controls` remains required by DB-N01 residual compatibility until separate DROP-readiness work.

## DB-N03 / DB-N04 Dependencies

- Do not start DB-N03 until DB-N01 and DB-N02 are reviewed and the authorized migration path is accepted.
- DB-N03/DB-N04 must consume DB-N01 `tenant_controls.id` identity and DB-N02 Health authority separation.
- Runtime validation remains manual by user after deploy/apply.

## db-v4 Untouched

- DB-N02 migration was not applied to QA or `db-v4`.
- No `psql` writes, no `MIGRATION_DATABASE_URL --apply`, no SSH DB writes.

## Not Executed

- `git add`
- `git commit`
- `git push`
- `git merge`
- deploy
- DB-N01 migration apply
- DB-N02 migration apply
- `db-v4` writes

## Gates

- GRC Health authority unique: PASS.
- Operational Health separated: PASS.
- canonical projection read-only role: PASS.
- MISSING/UNKNOWN numeric handling: PASS.
- STALE policy: PASS.
- standard_code canonical lineage: PASS.
- standard ambiguity resolved/guarded: PASS.
- circular dependency removed: PASS.
- ambiguous Health control-ID join fixed: PASS.
- KPI-HLT compatibility-only: PASS.
- Evidence freshness/coverage separation: PASS.
- Data Trust missing source behavior: PASS.
- PostgreSQL isolated tests: PASS.
- migration safe re-run: PASS.
- targeted tests: PASS.
- git diff --check: PASS.
- handoff: PASS.
- db-v4 untouched: PASS.
- no commit/push/merge/deploy: PASS.

## Do Not Rediscover

- `F5_5_GRC_HEALTH` v2 is the executive Health score.
- KPI-HLT is compatibility only.
- `canonicalHealthProjection.service.js` is projection only.
- `DATA-TRUST` with missing accuracy source is `NOT_CONFIGURED`.
- DB-N02 standard lineage must not derive from existing `control_health_scores.standard_code`.
- Active multi-standard ambiguity must remain blocked/reviewable.

## Final Recommendation

Human review of DB-N01 and DB-N02 together, then authorized migration preflight/apply sequence outside Codex. DB-N02 should not be applied before the DB-N01 control identity path is accepted.
