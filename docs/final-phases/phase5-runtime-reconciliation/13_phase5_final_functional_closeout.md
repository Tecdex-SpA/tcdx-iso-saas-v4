# Phase 5 final functional closeout — intermediate runtime evidence

Date: 2026-08-10
Environment: `https://tcdx-iso.tecdex.net`
Branch: `fix/phase5-final-functional-closeout`
Base SHA observed: `f052e205dd218289f8128b34c56ec6ceabdc9fc6`

Status: `READY_FOR_INTERMEDIATE_MERGE_REVIEW`

This is not a final Phase 5 closeout. Runtime evidence found a P0 cross-view bug that requires merge and deploy before the full Tenant 1 → Tenant 2 → Credex validation can be completed.

No deploy was executed from Codex.

## Runtime evidence created

Tenant 1 artifacts:

- `artifacts/phase5-human-runtime/tenant-1/40_runtime_admin_kpis_current.png`
- `artifacts/phase5-human-runtime/tenant-1/40_runtime_admin_kpis_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/41_runtime_dashboard_kpi_current.png`
- `artifacts/phase5-human-runtime/tenant-1/41_runtime_dashboard_kpi_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/42_runtime_metricas_current.png`
- `artifacts/phase5-human-runtime/tenant-1/42_runtime_metricas_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/43_runtime_bi_current.png`
- `artifacts/phase5-human-runtime/tenant-1/43_runtime_bi_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/44_runtime_dashboard_recalculate_response.json`
- `artifacts/phase5-human-runtime/tenant-1/45_runtime_dashboard_kpi_after_recalculate.png`
- `artifacts/phase5-human-runtime/tenant-1/45_runtime_dashboard_kpi_after_recalculate_network.json`
- `artifacts/phase5-human-runtime/tenant-1/46_runtime_metricas_after_recalculate.png`
- `artifacts/phase5-human-runtime/tenant-1/46_runtime_metricas_after_recalculate_network.json`

Cross-view summary:

- `artifacts/phase5-human-runtime/final-crossview/40_runtime_crossview_audit_summary.json`

## Administrar KPIs vs Dashboard KPI

Runtime Tenant 1 before local fix:

| Surface | Endpoint | Runtime result |
|---|---|---|
| Administrar KPIs | `GET /api/kpis/admin/:tenantId` | 24 administrative KPIs, score 60%, 7/24 with available value, Health fallback from effective ISO health. |
| Dashboard KPI | `GET /api/metrics/official/dashboard` | 22 official indicators, 22 enabled, 0 measured, 22 without data. |
| Métricas | `GET /api/metrics/official/catalog` | 22 official indicators, no published latest snapshots. |
| BI | `GET /api/metrics/official/catalog` | Same official snapshot universe as Métricas. |

Product decision:

- `Administrar KPIs` is an administrative/legacy KPI management universe.
- `Dashboard > Vista KPI`, `Métricas`, `BI`, `Report` and `Export` are the official Phase 5 indicator universe.
- They must not present incompatible values without explanation.
- The Dashboard “Recalcular KPIs” action must update the official snapshots consumed by Dashboard/Métricas/BI, not only create invisible measurements.

Root cause:

`POST /api/metrics/official/dashboard/recalculate` called `calculateIndicator()` for the 22 official indicators and persisted `metric_measurements`, but did not create and publish `metric_snapshots`. The official consumers read only published snapshots:

- `listCatalog()`
- `dashboard()`
- `/metricas`
- `/bi`
- official export

Therefore the system could return `recalculated=22, failed=0` while all user-facing official surfaces still showed `Sin medición`.

Local fix:

- `recalculateCatalog()` now creates and publishes official snapshots for generated measurements unless `publish_snapshots=false`.
- The response now reports `snapshots_created` and `snapshots_failed`.
- A regression check prevents returning to “calculated but invisible”.

Additional local contract fix:

- If the official formula fails due missing formula input, the persisted indicator sufficiency can no longer remain `sufficient`.
- Missing variables from the formula registry are propagated into data requirements.

## Runtime official indicator inventory — Tenant 1

This table is based on the deployed pre-fix runtime response in `44_runtime_dashboard_recalculate_response.json`.

| Code | Runtime post-recalc state | Value | Sufficiency | Sample/Population | Calculation run | Intermediate status |
|---|---:|---:|---|---:|---|---|
| ACTIONS | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| REMEDIATION | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| AUDIT-ASSURANCE | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| COVERAGE | insufficient_coverage | — | insufficient/minimum_coverage | 51/373 | yes | EXPECTED_UNMEASURED_MIN_COVERAGE |
| COMPLIANCE | insufficient_data | — | insufficient/minimum_coverage | 51/373 | no | EXPECTED_UNMEASURED_MIN_COVERAGE |
| SLA-COMPLIANCE | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| CONTINUITY | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| CONTROL-COVERAGE | insufficient_data | — | insufficient/minimum_sample_size | 0/51 | no | EXPECTED_UNMEASURED |
| CONTROL-EFFECT | insufficient_data | — | insufficient/minimum_sample_size | 0/51 | no | EXPECTED_UNMEASURED |
| DATA-TRUST | insufficient_data | — | sufficient | 111/111 | no | SUFFICIENCY_CONTRADICTION_FIXED_LOCAL |
| EVIDENCE-FRESH | source_incompatible | — | invalid/source_incompatible | 0/0 | no | SOURCE_INCOMPATIBLE |
| FINDINGS | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| GRC-HEALTH | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| INCIDENTS | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| LOSSES | calculated | 150000 | sufficient | 2/2 | yes | MEASUREMENT_OK_SNAPSHOT_MISSING_PRE_FIX |
| MATURITY | insufficient_data | — | sufficient | 111/111 | no | SUFFICIENCY_CONTRADICTION_FIXED_LOCAL |
| OP-PERFORMANCE | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| ISO-READINESS | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| RISK-INHERENT | calculated | 25 | sufficient | 77/77 | yes | MEASUREMENT_OK_SNAPSHOT_MISSING_PRE_FIX |
| RISK-RESIDUAL | insufficient_data | — | sufficient | 77/77 | no | SUFFICIENCY_CONTRADICTION_FIXED_LOCAL |
| SUPPLIER-RISK | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |
| SUPPLIER-HEALTH | insufficient_data | — | insufficient/minimum_sample_size | 0/0 | no | EXPECTED_UNMEASURED |

Notes:

- `LOSSES` and `RISK-INHERENT` did calculate in the deployed runtime, but remained invisible because no published metric snapshots were created by the dashboard recalculate path.
- `DATA-TRUST`, `MATURITY` and `RISK-RESIDUAL` exposed a state contradiction: source counts looked sufficient, but formula inputs were missing and the official state was non-calculated. Local code now prevents reporting these as `sufficient`.
- `EVIDENCE-FRESH` remains a runtime `SOURCE_INCOMPATIBLE` to investigate after the snapshot-publication fix is deployed and visible states are reliable.

## Tenant 1 smoke status

| Smoke | Runtime status | Notes |
|---|---|---|
| LOSSES | PARTIAL | Official measurement calculated as `150000` from two existing loss events; expected QA single-event `75000` is not isolated yet. Snapshot visibility fixed locally, pending deploy. |
| ACTIONS | NOT PASS | Runtime source sample was 0 for the current official period. Needs UI data creation/retest after deploy. |
| RISK-INHERENT | PARTIAL | Official measurement calculated as `25` from existing runtime risks. Requested 4×5→20 and 3×5→15 scenario not executed yet. Snapshot visibility fixed locally, pending deploy. |
| COMPLIANCE | NOT PASS | Current coverage 51/373 below published minimum coverage. Requested 4-requirement scenario not executed yet. |

## Tests executed

Passed:

- `node backend/src/services/indicators/indicatorCore.test.js`
- `npm run phase5:functional-closure`
- `npm run phase5-c3:contracts-check`
- `npm --prefix backend test`
- `npm run phase5-c3:security-check`
- `npm run phase5-c3:unit`
- `npm run phase5-c2:contracts-check`
- `npm run phase5-c2:security-check`
- `npm run phase5-c2:unit`
- `npm run phase5-5:source-binding-check`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- `git diff --check`

Blocked locally:

- `npm run phase5-c3:postgres`
- `npm run phase5-c2:postgres`

Reason:

Docker daemon was not available locally:

`failed to connect to the docker API at unix:///Users/andresbarouh/.docker/run/docker.sock`

## Production/demo writes performed

No manual database edits were performed.

One authorized runtime action was executed for Tenant 1:

- `POST /api/metrics/official/dashboard/recalculate`

This may have persisted `metric_measurements` in the production/demo environment. It did not deploy code, modify infrastructure, or manually alter the database.

## Remaining critical debt before final Phase 5 closeout

Critical debt is not zero.

Remaining blockers:

1. Merge/deploy the local P0 fix so official dashboard recalculate publishes snapshots.
2. Retest Tenant 1 after deploy and confirm Dashboard = Métricas = BI = Export for the same published snapshots.
3. Re-run LOSSES with an isolated QA event or period so expected `100000 - 25000 = 75000` is demonstrable.
4. Create/validate required ACTIONS, RISK-INHERENT and COMPLIANCE smoke datasets via UI.
5. Investigate runtime `EVIDENCE-FRESH` `source_incompatible`.
6. Complete Tenant 2 contrast scenario.
7. Complete Credex read-only validation.
8. Complete RBAC and tenant-isolation runtime checks.
9. Complete Report/Export validation against official snapshots.
10. Run PostgreSQL gates in Docker or CI.

## Handoff técnico

- Repo: `Tecdex-SpA/tcdx-iso-saas-v4`
- Runtime URL tested: `https://tcdx-iso.tecdex.net`
- Branch: `fix/phase5-final-functional-closeout`
- Base SHA: `f052e205dd218289f8128b34c56ec6ceabdc9fc6`
- Deploy: not executed
- Merge: not executed
- Tenants tested: Tenant 1 admin only
- Tenant 2: not executed
- Credex: not executed
- Main endpoints implicated:
  - `GET /api/kpis/admin/:tenantId`
  - `GET /api/kpi/effective-health-summary/:tenantId`
  - `GET /api/metrics/official/dashboard`
  - `POST /api/metrics/official/dashboard/recalculate`
  - `GET /api/metrics/official/catalog`
- Main tables implicated:
  - `metric_measurements`
  - `metric_snapshots`
  - `metric_trust_assessments`
  - `calculation_runs`
  - `calculation_outputs`
  - `calculation_snapshots`
- Files modified:
  - `backend/src/services/indicators/indicatorGovernance.service.js`
  - `backend/src/services/indicators/indicatorCore.test.js`
  - `backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
  - `scripts/phase5/check-phase5-functional-closure.js`
  - `scripts/phase5-c3/check-phase5-c3-contracts.js`
  - `scripts/phase5/audit-phase5-runtime-crossview.js`
  - `docs/final-phases/phase5-runtime-reconciliation/13_phase5_final_functional_closeout.md`
- Migrations created/modified: none

## Próxima acción exacta

MERGE AND DEPLOY THE INTERMEDIATE SNAPSHOT-PUBLICATION FIX, THEN RERUN TENANT 1 FULL RUNTIME CLOSEOUT.
