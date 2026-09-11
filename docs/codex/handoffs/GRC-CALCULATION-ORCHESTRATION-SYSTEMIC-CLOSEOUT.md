# GRC-CALCULATION-ORCHESTRATION-SYSTEMIC-CLOSEOUT

Fecha: 2026-09-11
Owner: CODEX A+C / codex
Branch: `main`
Base HEAD: `d889fa915ccc46ff932c51fbc69b292f81772974`
Head: `UNCOMMITTED_WORKTREE`
Status: `TCDX_GRC_CALCULATION_ORCHESTRATION_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW`

## Alcance

Revision humana final pre-commit del working tree actual. No hubo repo-wide rediscovery, reset, restore destructivo, stash, commit, push, merge, deploy, edicion de `.env`, escritura productiva ni conexion a `tcdx_saasv2`.

Cadena cerrada localmente:

hecho GRC -> source contract oficial -> `officialCalculationOrchestrator` -> `calculation_runs` / `calculation_outputs` / `calculation_snapshots` -> `metric_snapshots` -> consumidores.

## Base y estado Git

- `pwd`: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
- Git root: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
- HEAD: `d889fa915ccc46ff932c51fbc69b292f81772974`
- Branch/status: `## main...origin/main`
- `git diff --stat`: 18 tracked files changed, 544 insertions, 40 deletions, plus untracked service/test/handoff/prompt files.
- Untracked preservados: `backend/src/services/grcCalculationOrchestration.service.js`, `backend/src/services/grcCalculationOrchestration.service.test.js`, this handoff, and the two GRC prompt files.
- `artifacts/release-rbac/RESIDUAL_ROLE_AUTHORITY_CLASSIFICATION.md` changed only because the RBAC gate regenerated line numbers after route imports; gate remains `RESIDUAL_AUTHORIZATION_AUTHORITY=0`.

## Correcciones por revision humana

- Post-COMMIT semantics: `publishAffectedOfficialIndicators()` is now fail-observable and does not throw post-commit publication failures to route handlers. A durable GRC mutation is not reported as failed solely because analytics publication failed afterward. Failures return in `official_recalculation` as `completed_with_failures`, with serialized per-metric errors.
- Assurance projection: `recordMappedControlAssurance()` no longer invents `implementado -> 100`, `parcial -> 50`, `no implementado -> 0`, and no longer writes unsupported `conform/partial/non_conform` statuses to `grc_control_assurance`. No governed conversion contract was found; the adapter returns `ASSURANCE_STATUS_SCORE_CONVERSION_UNGOVERNED` and preserves the canonical SoA fact for the official source/fallback path.
- ISO identity: `recordControlSoAAssessment()` continues to use canonical `normalizeIsoCode()`. Tests prove convergence for `ISO_27001_2022`, `ISO27001`, `ISO/IEC 27701`, and `iso/iec27017`.
- SoA history: PostgreSQL E2E now inserts conflicting historical `control_soa_assessments` rows and proves that the resolver selects the latest row by `(tenant_id, tenant_control_id, iso_code)`, does not treat `status='applied'` as compliance, uses `suggested_implementation_status` / `suggested_applicable`, and preserves Tenant A/B isolation.
- KPI recalculate: remains on explicit metric codes, not `factType='scope'`; it does not revive `refresh_kpi_health_snapshots`, `control_health_scores`, `KPI-HLT`, or `canonical_health_projection_read_only`.

## Contratos y arquitectura

- No source contracts or formulas were versioned.
- Adapter boundary: GRC writers request affected functional metric codes from `FUNCTIONAL_INDICATORS`; calculation remains `indicatorGovernance -> officialCalculationOrchestrator`.
- Publication order is base metrics first, then `DATA-TRUST`, then `GRC-HEALTH`.
- `DATA-TRUST` and `GRC-HEALTH` are included because the existing indicator/formula/catalog dependency graph requires them, not by route intuition.
- `F5_5_COMPLIANCE_WEIGHTED` continues to consume `compliance_requirements_assessments`; source order remains `grc_requirement_control_mappings` primary, `control_soa_assessments` governed fallback, `tenant_controls` final fallback.
- `control_soa_assessments.status` is workflow. Math signal is `suggested_implementation_status` and `suggested_applicable`.
- Absence of measurement remains not measured / insufficient, not zero.

## Legacy scan

Bounded scan over active code/scripts found no active writer authority using:

- `refresh_kpi_health_snapshots`
- `control_health_scores`
- `KPI-HLT`
- `controls_catalog_standards.clause`
- `canonical_health_projection_read_only`

Remaining hits are historical migrations/tests/checkers/demo artifacts, compatibility/read-only references, or frontend labels; they were not deleted just to satisfy grep.

## Validation

PASS:

- `git diff --check`
- `node -c backend/src/services/grcCalculationOrchestration.service.js`
- `node -c backend/src/services/grcCalculationOrchestration.service.test.js`
- `node -c scripts/normalization/db-integral-formula-lineage.postgres.test.js`
- `node backend/src/services/grcCalculationOrchestration.service.test.js`
- `node backend/src/services/math-governance/sourceResolver.test.js`
- `node backend/src/services/math-governance/officialIndicatorMatrix.test.js`
- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js`
- `node backend/src/services/math-governance/canonicalHealthProjection.service.test.js`
- `node backend/src/services/isoRiskMatrix.service.test.js`
- `npm --prefix backend test`
- `npm --prefix frontend run typecheck`
- `node scripts/deploy-vms-strategy.test.js`
- `node scripts/release-rbac/check-release-rbac-contract.js`
- `node scripts/release-rbac/check-residual-role-authority.js`
- `node scripts/release-rbac/check-role-alias-equivalence.js`
- `node scripts/release-rbac/check-frontend-backend-authorization-consistency.js`
- `node scripts/normalization/db-integral-formula-lineage.postgres.test.js`

PostgreSQL E2E evidence:

- `FORMULA_LINEAGE_POSTGRES PASS`
- `RUNTIME_ORCHESTRATOR_END_TO_END PASS`
- `ACTIVE_FORMULAS=53`
- `SOURCE_CONTRACTS=20`
- `FORMULA_NUMERIC_MISMATCH=0`
- `SNAPSHOT_MISMATCH=0`
- `PROJECTION_MISMATCH=0`
- `UNRECONSTRUCTABLE_OUTPUTS=0`
- Tenant A: `F5_5_COMPLIANCE_WEIGHTED=100`, `F5_5_COVERAGE=100`, `F5_5_GRC_HEALTH=calculated`
- Tenant B: `F5_5_COMPLIANCE_WEIGHTED=0`, stale/expired evidence produced `SOURCE_DATA_INSUFFICIENT`, `F5_5_GRC_HEALTH` stayed `unmeasured` / `FORMULA_INSUFFICIENT_COVERAGE`
- `RUNTIME_ORCHESTRATOR_RUNS=18`
- `RUNTIME_ORCHESTRATOR_OUTPUTS=18`
- `RUNTIME_ORCHESTRATOR_SOURCE_SNAPSHOTS=18`
- `RUNTIME_ORCHESTRATOR_METRIC_SNAPSHOTS=6`
- `RUNTIME_INDICATOR_SNAPSHOTS=6`
- `FORMULA_CROSS_TENANT_LEAKAGE=0`
- `ISOLATED_POSTGRES_CLEANUP PASS`

RBAC evidence:

- `RELEASE_RBAC_CONTRACT_PASS permissions=175 roles=7`
- `RESIDUAL_AUTHORIZATION_AUTHORITY=0`
- `UNCLASSIFIED_ROLE_CHECKS=0`
- `ROLE_ALIAS_*_EQUIVALENCE=PASS`
- `FRONTEND_BACKEND_AUTHORIZATION_CONSISTENCY=PASS`
- `FRONTEND_IS_MIRROR_ONLY=PASS`
- `BACKEND_IS_AUTHORITY=PASS`

## Do Not Rediscover

- Diagnostico/SoA must not create `grc_requirement_control_mappings`.
- Do not treat `control_soa_assessments.status='applied'` as compliance.
- Do not invent `grc_control_assurance` scores or statuses from implementation status without a governed conversion contract.
- Do not use `factType='scope'` for explicit KPI recalculation.
- Do not revive `refresh_kpi_health_snapshots`, `control_health_scores`, `KPI-HLT`, or `canonical_health_projection_read_only` as active authority.
- Do not interpret missing/no-data/insufficient coverage as zero.

## Residual risk

- Real production/staging runtime validation was NOT_EXECUTED by explicit prohibition: no deploy and no productive DB writes from Codex.
- Human owner still controls commit, push, PR, CI, merge, deploy, and post-deploy runtime validation.
- Post-deploy focal validation should exercise at least one Diagnostico/SoA mutation, one action mutation, one evidence mutation, and one risk mutation against published snapshots and Health/KPI consumers.

TCDX_GRC_CALCULATION_ORCHESTRATION_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW

NO commit / NO push / NO merge / NO deploy / NO .env / NO escritura productiva
