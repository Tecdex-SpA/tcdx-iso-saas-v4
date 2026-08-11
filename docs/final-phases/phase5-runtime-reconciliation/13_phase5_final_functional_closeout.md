# Phase 5 final functional closeout — intermediate runtime evidence

## 2026-08-11 v7 — RISK-INHERENT multi-risk official contract

Environment: `https://tcdx-iso.tecdex.net`
Runtime base SHA deployed: `b8d2088580d239de86965f34d463330a656cadfe`
Branch: `fix/phase5-final-functional-closeout`
Status: `READY_FOR_INTERMEDIATE_MERGE_REVIEW` once PR CI is green.

This is not a final Phase 5 closeout and must not be validated against production until the fix is merged and deployed.

### Root cause

Runtime proved `RISK-INHERENT` was blocked for SaaS use even after the UI visibility fix:

- Source contract cardinality was `one_to_many`.
- The resolver returned multiple risk rows from `risk_register_controls`.
- The mapper used the first usable row only for `F5_5_INHERENT_RISK`.
- The query had no contractual ordering.
- Therefore the official KPI depended on `rows[0]`, which was not a valid commercial methodology.

Classification before this fix:

- `NON_DETERMINISTIC_SOURCE_SELECTION`
- `SEMANTIC_CONTRACT_UNDEFINED`

### Official product contract

Code: `RISK-INHERENT`

Description: inherent exposure average of the tenant usable risk portfolio.

Individual row formula:

```text
inherent_risk_score = probability_or_likelihood × impact
```

Valid scale:

- `probability` / `likelihood`: integer `1..5`
- `impact`: integer `1..5`

Official aggregate:

```text
RISK-INHERENT = SUM(inherent_risk_score) / COUNT(usable risks)
```

Aggregation method: `arithmetic_mean`

Inclusion:

- same tenant;
- source rows returned by the governed `risk_register_controls` contract;
- inside the requested period when a period is provided;
- valid `probability` or `likelihood`;
- valid `impact`.

Exclusion:

- rows outside the tenant;
- rows outside the requested period;
- rows failing generic source validation;
- rows with missing/invalid `probability` / `likelihood`;
- rows with missing/invalid `impact`.

No deduplication is applied by title, asset or display label. Distinct source records contribute once by source row identity.

Sample/population:

- `population_size`: rows that pass the generic source contract validation for the tenant/period.
- `sample_size`: rows from that population with valid probability/likelihood and impact.
- `coverage`: remains derived by official consumers from sample/population.

Sufficiency:

- calculated when at least one usable risk exists and the common calculation policy is satisfied;
- `insufficient_data` when zero usable risks exist.

No missing data is converted to zero.

Precision:

- formula precision remains the platform formula precision for score outputs.
- consumers may format values for display, but all consumers must start from the same measurement/snapshot value.

### Implementation

Changed locally:

- `backend/src/services/math-governance/riskCalculation.service.js`
  - validates individual axes as integers `1..5`;
  - supports portfolio input `risks[]`;
  - computes arithmetic mean;
  - rejects zero usable risks instead of returning `0`.
- `backend/src/services/math-governance/formulaRegistry.service.js`
  - publishes `F5_5_INHERENT_RISK` as formula version `2`;
  - expression `mean(P_i*I_i)`;
  - methodology `arithmetic mean of usable tenant portfolio inherent risk scores`;
  - formula details include aggregation method, sample, population, scores and risk lineage details.
- `backend/src/services/math-governance/sourceContracts.service.js`
  - publishes `risk_register_controls` as source contract version `3`;
  - declares portfolio `risks[]` mapping and `arithmetic_mean`.
- `backend/src/services/math-governance/sourceResolver.service.js`
  - removes the `rows[0]` mapping for `F5_5_INHERENT_RISK`;
  - builds formula input from every valid risk row;
  - excludes invalid P/I rows with explicit reason;
  - adjusts counts and lineage to the rows actually included in the official formula.
- `frontend/src/app/matriz-riesgo/page.tsx`
  - adds short row identifiers (`risk_code`, short item ID, short run ID) to distinguish visually duplicated risk titles.

### Run selection

No current/published run selector was added in this iteration because no governed field currently defines that semantics for this KPI. The implemented contract treats every valid source row returned by the tenant/period source contract as one risk portfolio row.

If the product later defines “latest/current/published run only”, that must be a separate source-contract version, not an implicit `ORDER BY` or title deduplication.

### Regression coverage added

Required examples now covered in code/tests:

| Case | Dataset | Expected |
|---|---|---:|
| Single risk | `4×5` | `20` |
| Single risk changed | `3×5` | `15` |
| Multi-risk | `20, 10, 15` | `15` |
| Reordered multi-risk | `15, 20, 10` | `15` |
| Causal multi-risk | `15, 10, 15` | `13.3333` |
| Tenant A | `20, 10, 15` | `15` |
| Tenant B | `5, 10` | `7.5` |
| Tenant A changed | `15, 10, 15` | `13.3333` |
| Tenant B after Tenant A change | `5, 10` | `7.5` |
| Zero usable risks | no valid P/I | error/insufficient, not `0` |

Runtime validation pending after deploy:

- Tenant 1 UI smoke `4×5 → 20`;
- Tenant 1 UI smoke `3×5 → 15`;
- official recalculate;
- measurement;
- published source snapshot;
- Dashboard / Métricas / BI / GRC / Export cross-view;
- RBAC and tenant isolation re-check.

## 2026-08-10 v3 — Snapshot publication checksum fix after PR #68 deploy

Environment: `https://tcdx-iso.tecdex.net`
Branch: `fix/phase5-final-functional-closeout`
Runtime base SHA deployed: `97e801595c95bae44d34931c7bd0d6e70f357020`
Status: `READY_FOR_INTERMEDIATE_MERGE_REVIEW`

This is not a final Phase 5 closeout. PR #68 is deployed and Portal GRC SQL/schema P0 is closed in runtime:

- `/grc`: HTTP 200
- `GET /api/grc/overview`: HTTP 200
- Portal GRC SQL/schema alerts: 0

The next Tenant 1 runtime pass found a new P0 in the official indicator publication chain. The bug is not a Portal GRC schema regression.

### Runtime evidence created — v3

Tenant 1 artifacts:

- `artifacts/phase5-human-runtime/tenant-1/40_runtime_admin_kpis_current.png`
- `artifacts/phase5-human-runtime/tenant-1/40_runtime_admin_kpis_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/41_runtime_dashboard_kpi_current.png`
- `artifacts/phase5-human-runtime/tenant-1/41_runtime_dashboard_kpi_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/42_runtime_metricas_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/43_runtime_bi_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/47_runtime_grc_current.png`
- `artifacts/phase5-human-runtime/tenant-1/47_runtime_grc_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/50_tenant1_focus_api_snapshot.json`

### Dashboard KPI vs Administrar KPI — v3 observed state

| Concept | Administrar KPI | Dashboard KPI | Métricas | GRC | Endpoint / source | Consistent |
|---|---|---|---|---|---|---|
| KPI universe | 24 administrative KPIs | 22 official Phase 5 indicators | 22 official Phase 5 indicators | Official analytics + GRC overview | Admin: `/api/kpis/admin/:tenantId`; official: `/api/metrics/official/dashboard`, `/api/metrics/official/catalog` | Partially |
| Enabled | 4 enabled admin KPIs | 22 enabled official indicators | Official catalog | GRC analytics blocks | Different product universes | Yes, if explicitly named |
| Measured | 3 admin KPIs with latest value | 2/22 official measured | Same official snapshots | Depends on published snapshots | Official consumers use `metric_snapshots` | Yes for official consumers |
| Coverage | Admin-specific score/availability | `45.47%` official data coverage | Same official catalog data | Analytics/data alerts | Official dashboard summary | Yes |
| Critical | Admin health fallback from ISO effective health | 1 red official KPI | Same official state where snapshot exists | GRC alerts | Different semantics | Needs UX clarity |
| Health | Effective ISO health/admin view | `health_kpis: 2` official dashboard summary | Official indicator health | GRC analytics | Admin health is not the official score | Needs UX clarity |
| Score global | Admin score present in admin universe | `official_score: null` / “Sin medición” | Official catalog has no calculated GRC-HEALTH | GRC health incomplete | `GRC-HEALTH` latest snapshot drives official score | Yes, but UI must explain missing dependency |

Product decision remains:

- `Administrar KPIs` is an administrative KPI management universe.
- `Dashboard > Vista KPI`, `Métricas`, `BI`, `GRC`, `Report` and `Export` must converge on the official Phase 5 snapshot universe.
- Values from the two universes are not directly equivalent and must not be presented as the same “KPI score/health” without labels and dependency explanation.

### New P0 — measurement exists but snapshot publication fails

Runtime action:

- `POST /api/metrics/official/dashboard/recalculate`

Runtime result after PR #68 deploy:

- `recalculated: 22`
- `failed: 0`
- `snapshots_created: 6`
- `snapshots_failed: 16`

All 16 snapshot failures had:

- SQLSTATE: `23505`
- Constraint: `metric_interpretations_tenant_id_checksum_key`
- Message: `duplicate key value violates unique constraint "metric_interpretations_tenant_id_checksum_key"`

Root cause:

- `backend/src/services/indicators/indicatorGovernance.service.js#createSnapshot()` inserted `metric_interpretations.checksum` as `checksum(interpretation)`.
- The database enforces `UNIQUE (tenant_id, checksum)` on `metric_interpretations`.
- Multiple different metric snapshots can legitimately share the same interpretation payload, especially unmeasured states such as `minimum_sample_size` or `insufficient_data`.
- The checksum was tenant-global but did not include the snapshot identity, so cross-indicator duplicate interpretations collided.
- The insert ran in the snapshot transaction, so the metric measurement could exist while the published snapshot failed.

Local fix:

- Added snapshot-scoped interpretation checksum:
  - `metricInterpretationChecksum(snapshot.id, interpretation)`
- `metric_interpretations.checksum` is now stable/idempotent per snapshot and no longer collides across different indicators with identical interpretation text.
- No schema change.
- No fake columns.
- No null-to-zero conversion.
- No manual production DB edit.

Regression added:

- `scripts/phase5/check-phase5-functional-closure.js`
  - asserts interpretation checksum is scoped by `snapshot.id`
  - asserts the old global `checksum(interpretation)` pattern is not used

### 22 official indicators — v3 runtime state before local fix deploy

Source: `artifacts/phase5-human-runtime/tenant-1/50_tenant1_focus_api_snapshot.json`

| Code | State | Value | Sample/Population | Snapshot publication | Classification |
|---|---:|---:|---:|---|---|
| ACTIONS | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed; data still needs UI smoke |
| REMEDIATION | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| AUDIT-ASSURANCE | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| COVERAGE | insufficient_coverage | — | 51/373 | Published | EXPECTED_UNMEASURED_MIN_COVERAGE |
| COMPLIANCE | insufficient_data | — | 51/373 | Published | EXPECTED_UNMEASURED_MIN_COVERAGE; Tenant 1 smoke pending |
| SLA-COMPLIANCE | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| CONTINUITY | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| CONTROL-COVERAGE | insufficient_data | — | 0/51 | Published | EXPECTED_UNMEASURED |
| CONTROL-EFFECT | insufficient_data | — | 0/51 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| DATA-TRUST | insufficient_data | — | 155/155 | Failed `23505` | BROKEN_CHAIN until fix deployed; formula/input review pending |
| EVIDENCE-FRESH | source_incompatible | — | 0/0 | Published | SOURCE_INCOMPATIBLE pending investigation |
| FINDINGS | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| GRC-HEALTH | insufficient_data | — | 0/0 | Failed `23505` | Blocks official score |
| INCIDENTS | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| LOSSES | calculated | 150000 | 2/2 | Published | PARTIAL PASS; requested isolated 75000 smoke pending |
| MATURITY | insufficient_data | — | 155/155 | Failed `23505` | BROKEN_CHAIN until fix deployed; dependency review pending |
| OP-PERFORMANCE | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| ISO-READINESS | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| RISK-INHERENT | calculated | 25 | 77/77 | Published | PARTIAL PASS; requested 4x5→20 and 3x5→15 smoke pending |
| RISK-RESIDUAL | insufficient_data | — | 77/77 | Failed `23505` | BROKEN_CHAIN until fix deployed; dependency/formula review pending |
| SUPPLIER-RISK | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |
| SUPPLIER-HEALTH | insufficient_data | — | 0/0 | Failed `23505` | BROKEN_CHAIN until fix deployed |

### Score KPI Global — v3

Contract observed in `backend/src/services/indicators/indicatorGovernance.service.js#dashboard()`:

- `official_score` is derived from the latest official `GRC-HEALTH` snapshot only when that snapshot state is `calculated`.
- Current runtime `GRC-HEALTH` is `insufficient_data` and its snapshot publication also failed with `23505` during recalculate.
- Therefore `official_score: null` is contractually expected in the current runtime state, but the UI must explain the missing dependency instead of leaving users with unexplained “Sin medición”.

No arbitrary average was introduced.

### Tenant 1 priority smoke status — v3

| Smoke | Expected | Runtime actual | Measurement | Snapshot | Consumers | Result |
|---|---:|---:|---|---|---|---|
| LOSSES | Isolated QA expected `100000 - 25000 = 75000` | Existing runtime value `150000` from two loss events | Calculated | Published | Visible in official consumers where latest snapshot is used | PARTIAL; isolated causal smoke pending |
| ACTIONS | A1 progress 25→50→100, A2 overdue | Runtime source sample `0/0` | Not calculated | Snapshot failed `23505` | Not reliable until publication fix deploy | FAIL pending deploy + data smoke |
| RISK-INHERENT | Formula `P*I`; 4x5→20, 3x5→15 | Existing runtime value `25` from current risk data | Calculated | Published | Visible in official consumers | PARTIAL; requested causal smoke pending |
| COMPLIANCE | 4 applicable requirements, conceptual coverage `3/4 = 75%`; partial weight per official method | Runtime `51/373`, below minimum coverage | Not calculated | Published insufficient state | Visible as insufficient | FAIL pending focused UI smoke |

Official formula/method references:

- `F5_5_NET_LOSS`: `gross - recoveries`
- `F5_5_INHERENT_RISK`: `P * I`
- `F5_5_WEIGHTED_PROGRESS`: `sum(w*p)/sum(w)*100`
- Compliance partial default: `0.5` in the official compliance calculation service, not assumed as full compliance.

### HTTP/SQL — v3

- HTTP 5xx observed in Tenant 1 focused runtime snapshot: 0
- Portal GRC SQL/schema errors: 0
- SQL constraint errors in official recalculate snapshot publication: 16
- SQL constraint class fixed locally: `metric_interpretations_tenant_id_checksum_key`

### Tests executed — v3

Passed:

- `node -c backend/src/services/indicators/indicatorGovernance.service.js`
- `npm run phase5:functional-closure`
- `npm --prefix backend test`
- `npm run phase5-c3:contracts-check`
- `npm run phase5-c3:security-check`
- `npm run phase5-c3:unit`
- `npm run phase5-c3:postgres`
- `npm run phase5-c2:contracts-check`
- `npm run phase5-c2:security-check`
- `npm run phase5-c2:unit`
- `npm run phase5-c2:postgres`
- `npm run phase5-5:source-binding-check`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- `git diff --check`

### Remaining gate after v3 fix is deployed

Critical debt remains non-zero until runtime proves:

1. `POST /api/metrics/official/dashboard/recalculate` returns `snapshots_failed: 0`.
2. Dashboard KPI = Métricas = BI = GRC = Export for same official snapshot/period.
3. LOSSES isolated smoke proves `100000 - 25000 = 75000`.
4. ACTIONS causal smoke proves progress/overdue/remediation changes.
5. RISK-INHERENT causal smoke proves 4x5→20 and 3x5→15.
6. COMPLIANCE focused smoke proves coverage/compliance/sufficiency using official partial methodology.
7. `EVIDENCE-FRESH` `SOURCE_INCOMPATIBLE` is resolved or classified with exact source-contract cause.
8. Tenant 2, Credex read-only, RBAC, tenant isolation, Report and Export are completed.

### Handoff técnico — v3

- Repo: `Tecdex-SpA/tcdx-iso-saas-v4`
- Runtime URL tested: `https://tcdx-iso.tecdex.net`
- Runtime base SHA deployed: `97e801595c95bae44d34931c7bd0d6e70f357020`
- Branch: `fix/phase5-final-functional-closeout`
- Deploy: not executed
- Merge: not executed
- Tenant tested: Tenant 1 admin
- Tenant 2: not executed in v3
- Credex: not executed in v3
- Main endpoints implicated:
  - `GET /api/kpis/admin/:tenantId`
  - `GET /api/kpi/effective-health-summary/:tenantId`
  - `GET /api/metrics/official/dashboard`
  - `POST /api/metrics/official/dashboard/recalculate`
  - `GET /api/metrics/official/catalog`
  - `GET /api/metrics/official/export`
  - `GET /api/grc/overview`
- Main tables implicated:
  - `metric_measurements`
  - `metric_snapshots`
  - `metric_interpretations`
  - `metric_trust_assessments`
  - `calculation_runs`
  - `calculation_outputs`
  - `calculation_snapshots`
  - `loss_events`
  - `action_plans`
  - risk/compliance source tables from official resolvers
- Files modified in v3:
  - `backend/src/services/indicators/indicatorGovernance.service.js`
  - `scripts/phase5/check-phase5-functional-closure.js`
  - `docs/final-phases/phase5-runtime-reconciliation/13_phase5_final_functional_closeout.md`
  - Tenant 1 runtime artifacts under `artifacts/phase5-human-runtime/tenant-1/`
- Migrations created/modified: none

### Próxima acción exacta — v3

MERGE AND DEPLOY THE INTERMEDIATE SNAPSHOT-CHECKSUM FIX, THEN RERUN TENANT 1 FULL RUNTIME CLOSEOUT FROM `POST /api/metrics/official/dashboard/recalculate`.

---

## 2026-08-10 v2 — Portal GRC schema-runtime fix

Environment: `https://tcdx-iso.tecdex.net`
Branch: `fix/phase5-final-functional-closeout`
Base SHA observed: `d16e55850a7a59b9cffff48623960997b4b51ba0`
Status: `READY_FOR_INTERMEDIATE_MERGE_REVIEW`

This is not a final Phase 5 closeout. Runtime still contains P0 SQL/schema errors in Portal GRC and therefore the Tenant 1 → Tenant 2 → Credex closeout gate cannot be completed until this fix is merged and deployed.

No deploy was executed from Codex.

### Runtime evidence created — v2

Tenant 1 artifacts:

- `artifacts/phase5-human-runtime/tenant-1/40_runtime_admin_kpis_current.png`
- `artifacts/phase5-human-runtime/tenant-1/40_runtime_admin_kpis_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/41_runtime_dashboard_kpi_current.png`
- `artifacts/phase5-human-runtime/tenant-1/41_runtime_dashboard_kpi_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/42_runtime_metricas_current.png`
- `artifacts/phase5-human-runtime/tenant-1/42_runtime_metricas_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/43_runtime_bi_current.png`
- `artifacts/phase5-human-runtime/tenant-1/43_runtime_bi_current_network.json`
- `artifacts/phase5-human-runtime/tenant-1/47_runtime_grc_current.png`
- `artifacts/phase5-human-runtime/tenant-1/47_runtime_grc_current_network.json`

Cross-view summary:

- `artifacts/phase5-human-runtime/final-crossview/40_runtime_crossview_audit_summary.json`

### Portal GRC P0

Runtime route:

- UI: `/grc`
- Endpoint: `GET /api/grc/overview`
- Route: `backend/src/routes/phase5.routes.js`
- Service: `backend/src/services/phase5/phase5.service.js#getGrcOverview`

Runtime response was HTTP 200, but `safeBlock()` converted SQL exceptions into visible Portal GRC alerts:

| Block | Runtime alert | Root cause | Local fix |
|---|---|---|---|
| `tenant` | `tenant: column "updated_at" does not exist` | `tenantBlock` selected `tenants.updated_at`; production table lacks that column. | Select `updated_at` via `to_jsonb(t)->>'updated_at'`, which safely returns null when absent, while preserving `created_at` fallback. |
| `reporting` | `reporting: column "status" does not exist` | Reporting overview assumed `status` exists on reporting tables. Production/runtime can contain reporting tables without that column. | Added column introspection and fallback to `generation_status`/`schedule_status`/`state`; if no state column exists, report counts without querying missing columns. |
| `data_trust` | `data_trust: column "trust_status" does not exist` | `data_trust_scores` schema defines `status`; overview queried `trust_status`. | Added column introspection and fallback from `trust_status` to `status`. |

Regression added:

- `backend/src/services/phase5/phase5OverviewSchema.test.js`
- Included in `npm --prefix backend test`

Local validation:

- `node -c backend/src/services/phase5/phase5.service.js`: PASS
- `node backend/src/services/phase5/phase5OverviewSchema.test.js`: PASS
- `npm --prefix backend test`: PASS
- `npm --prefix frontend run lint`: PASS
- `npm --prefix frontend run typecheck`: PASS
- `npm --prefix frontend test`: PASS
- `npm --prefix frontend run build`: PASS
- `npm run phase5:functional-closure`: PASS
- `npm run phase5-c3:contracts-check`: PASS
- `npm run phase5-c3:security-check`: PASS
- `npm run phase5-c3:unit`: PASS
- `npm run phase5-c3:postgres`: PASS
- `npm run phase5-c2:contracts-check`: PASS
- `npm run phase5-c2:security-check`: PASS
- `npm run phase5-c2:unit`: PASS
- `npm run phase5-c2:postgres`: PASS
- `npm run phase5-5:source-binding-check`: PASS
- `git diff --check`: PASS

### Dashboard KPI vs Administrar KPI — v2 observed state

Runtime after previous deploy improved the official dashboard, but does not close Phase 5:

| Surface | Endpoint | Observed state |
|---|---|---|
| Administrar KPIs | `GET /api/kpis/admin/:tenantId` | Administrative KPI universe remains separate. |
| Dashboard KPI | `GET /api/metrics/official/dashboard` | Official universe now shows 22 enabled and 2 measured, but Score KPI Global remains `Sin medición`. |
| Métricas | `GET /api/metrics/official/catalog` | Official catalog consumer; must match Dashboard for published snapshots. |
| BI | `GET /api/metrics/official/catalog` | Official catalog consumer; must not be empty when published snapshots exist. |
| Portal GRC | `GET /api/grc/overview` + official analytics catalog | Currently blocked by SQL/schema alerts above. |

Decision remains:

- Admin KPI is an administrative/legacy KPI management universe.
- Dashboard KPI, Métricas, BI, Portal GRC, Report and Export must converge on the official Phase 5 snapshot universe.
- The UI must not present contradictory “Health/KPI/Score” values without naming the universe and explaining the relationship.

### 22 official indicators — v2 status

The full 22-indicator closeout is blocked until Portal GRC is deployed without SQL errors and the official consumers can be compared in runtime. Current known state from runtime/user observation:

| Result | Count | Notes |
|---|---:|---|
| Measured | 2/22 | Dashboard KPI now has visible measurements after PR #67 deployment. |
| Unmeasured/no data | 20/22 | Must be classified as real missing input, dependency pending, or broken chain. |
| Critical | 1 | Requires post-deploy cross-view trace. |
| KPI Health | 2 | Some Health surfaces still show `Sin dato`; must be reconciled. |
| Score KPI Global | 0 / `Sin medición` | Requires contract/dependency explanation; no arbitrary averaging. |
| Portal GRC SQL/schema errors | 3 | Fixed locally, pending merge/deploy. |

### Remaining gate after this v2 fix is deployed

Critical debt remains non-zero until runtime proves:

1. `/grc` has zero SQL column alerts.
2. Dashboard KPI = Métricas = BI = Portal GRC for the same tenant/period/snapshot.
3. Score KPI Global is either calculated correctly or explicitly explains missing dependencies.
4. KPI Health is coherent across official and administrative surfaces.
5. Tenant 1 smoke datasets pass for LOSSES, ACTIONS, RISK-INHERENT, COMPLIANCE and EVIDENCE-FRESH.
6. Tenant 2 contrast scenario passes.
7. Credex read-only validation passes without writes.
8. RBAC and tenant isolation pass.
9. Report and Export match official snapshots.

### Handoff técnico — v2

- Repo: `Tecdex-SpA/tcdx-iso-saas-v4`
- Runtime URL tested: `https://tcdx-iso.tecdex.net`
- Branch: `fix/phase5-final-functional-closeout`
- Base SHA: `d16e55850a7a59b9cffff48623960997b4b51ba0`
- Deploy: not executed
- Merge: not executed
- Tenants tested in v2: Tenant 1 admin only
- Endpoint implicated: `GET /api/grc/overview`
- Files modified in v2:
  - `backend/src/services/phase5/phase5.service.js`
  - `backend/src/services/phase5/phase5OverviewSchema.test.js`
  - `backend/package.json`
  - `scripts/phase5/audit-phase5-runtime-crossview.js`
  - `docs/final-phases/phase5-runtime-reconciliation/13_phase5_final_functional_closeout.md`
- Migrations created/modified: none

### Próxima acción exacta — v2

MERGE AND DEPLOY THE INTERMEDIATE PORTAL GRC SCHEMA-RUNTIME FIX, THEN RERUN TENANT 1 FULL RUNTIME CLOSEOUT.

---

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
