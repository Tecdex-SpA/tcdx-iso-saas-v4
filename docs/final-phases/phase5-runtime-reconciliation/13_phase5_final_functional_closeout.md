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

---

# 2026-08-11 — Tenant 1 final 22-indicator closeout batch after PR #74

## Runtime base

- Runtime: `https://tcdx-iso.tecdex.net`
- Branch used for fixes: `fix/phase5-final-functional-closeout`
- Base main HEAD: `ca18192977e0fab34c1165f32006cf6f643ca215`
- Tenant: Tenant 1 (`70000000-0000-0000-0000-000000000701`)
- Official catalog discovered dynamically: 22 indicators
- Official dashboard summary: 22 total, 6 measured, 16 without calculated value, `official_score = null`
- Services observed:
  - Frontend: HTTP 200
  - AI Engine: HTTP 200
  - Backend authenticated APIs: HTTP 200

Artifacts:

- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/runtime/summary.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/indicators/matrix.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/evidence-fresh/calculate-current.json`

## Current runtime 22/22 matrix before intermediate deploy

| Code | Formula | Sample/Population | State | Value | Snapshot | Dashboard | Métricas | BI | GRC | Report | Export | Status |
|---|---|---:|---|---:|---|---|---|---|---|---|---|---|
| ACTIONS | F5_5_WEIGHTED_PROGRESS | 2/2 | calculated | 62.5 | 653f555b-804b-4f8-accc-a0c686ea345a | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | BROKEN_CHAIN |
| AUDIT-ASSURANCE | F5_5_ASSURANCE_SCORE | 0/0 | insufficient_data | — | 7fd275ad-70c0-4958-a55b-9302aaee64d7 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| COMPLIANCE | F5_5_COMPLIANCE_WEIGHTED | 4/4 | calculated | 83.33 | 54376945-07ed-401d-8cb1-1648219de606 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | BROKEN_CHAIN |
| CONTINUITY | F5_5_SLA_COMPLIANCE | 0/1 | insufficient_data | — | cc690bba-cb2f-4c41-a698-abfc6dc766b0 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| CONTROL-COVERAGE | F5_5_CONTROL_COVERAGE | 0/51 | insufficient_data | — | 6ec239e4-7cc9-415b-b0c4-f2270589decf | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| CONTROL-EFFECT | F5_5_CONTROL_EFFECTIVENESS | 0/51 | insufficient_data | — | 90dc94b2-8f5f-4fcd-984e-91b64ff949bc | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| COVERAGE | F5_5_COVERAGE | 4/4 | calculated | 75 | 0c757d93-ea1d-4b01-bfc5-4a074f0f9d8e | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | BROKEN_CHAIN |
| DATA-TRUST | F5_C3_DATA_TRUST | 555/555 | insufficient_data | — | 036fcd3c-d113-4460-b985-131e5aa18a00 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| EVIDENCE-FRESH | F5_5_FRESHNESS_CONTINUOUS | 0/0 | source_incompatible | — | 01a382d7-bf82-45ba-a90f-cb1c32e05052 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | SOURCE_INCOMPATIBLE |
| FINDINGS | F5_5_SEVERITY_INDEX | 2/2 | insufficient_data | — | a6673432-8f06-425a-9ef0-260b28ff8724 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| GRC-HEALTH | F5_5_GRC_HEALTH | 0/0 | insufficient_data | — | 7ff429b8-c0e1-4803-bd10-4309bd8be4ef | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |
| INCIDENTS | F5_5_SEVERITY_INDEX | 0/0 | insufficient_data | — | 3669ea59-b601-4837-9a63-3a91fb51beaa | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |
| ISO-READINESS | F5_5_READINESS | 0/0 | insufficient_data | — | c9c6574b-c905-4932-9ae5-498a53fd8cc8 | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |
| LOSSES | F5_5_NET_LOSS | 3/3 | calculated | 225000 | 98919712-4c7b-4420-82ac-8b0cf2a526d8 | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN |
| MATURITY | F5_5_MATURITY | 555/555 | insufficient_data | — | 68e1a42b-5f4d-4c6a-bccf-29776e8349de | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |
| OP-PERFORMANCE | F5_C3_OPERATIONAL_PERFORMANCE | 0/0 | insufficient_data | — | 69ad38a1-28d3-4150-928f-652b538cc9d1 | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |
| REMEDIATION | F5_5_WEIGHTED_PROGRESS | 2/2 | calculated | 62.5 | 52cb1abd-bf13-4c22-ace9-4964be89d099 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | BROKEN_CHAIN |
| RISK-INHERENT | F5_5_INHERENT_RISK | 77/77 | calculated | 19.9091 | 8e8b799c-1069-40fd-bc09-db0a6df00b51 | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN |
| RISK-RESIDUAL | F5_5_RESIDUAL_RISK | 77/77 | insufficient_data | — | 585e2a7f-3a0e-4913-bb86-30c6d193bd8a | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |
| SLA-COMPLIANCE | F5_5_SLA_COMPLIANCE | 0/1 | insufficient_data | — | 546a8cd3-bc62-495b-9547-7eb18c7540a5 | PASS | PASS | BROKEN_CHAIN | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| SUPPLIER-HEALTH | F5_C3_SUPPLIER_HEALTH | 0/0 | insufficient_data | — | d802b91b-39a8-409b-b94d-15e277b78305 | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |
| SUPPLIER-RISK | F5_5_SUPPLIER_RISK | 0/0 | insufficient_data | — | f984e2fc-87b2-4f0d-b1f5-69ec9fa47b82 | PASS | PASS | BROKEN_CHAIN | PASS | BROKEN_CHAIN | PASS | EXPECTED_UNMEASURED |

## Root causes found and fixed locally

1. BI decision center applied a silent first-N catalog limit.
   - Root cause: `GrcDecisionCenter` defaulted to a fixed limit and `/bi` passed `limit={18}`.
   - Fix: `GrcDecisionCenter` now consumes the full official catalog, exposes an indicator link per decision card, and `/bi` no longer passes a limit.

2. Report Studio hid official indicators by position.
   - Root cause: Report Studio mounted `OfficialAnalyticsPanel` with `limit={12}`.
   - Fix: Report Studio now renders the complete official catalog panel without a fixed limit.

3. Reusable official panel still supported silent catalog slicing.
   - Root cause: `OfficialAnalyticsPanel` accepted `limit` and used `slice(0, limit)`.
   - Fix: the panel now filters only by explicit domain and never hides indicators by position.

4. Portal GRC emitted a frontend 404.
   - Root cause: module navigation linked Auditorías to `/auditor`, which is not a valid route.
   - Fix: link changed to `/auditorias`.

5. `EVIDENCE-FRESH` resolved the formula-level data-quality source instead of the indicator-level evidence source.
   - Runtime symptom: `POST /api/metrics/official/EVIDENCE-FRESH/calculate` returned `official_state = source_incompatible`, `sample_size = 0`, `population_size = 0`, no `calculation_run_id`, no source snapshot.
   - Root cause: `calculateIndicator()` only honored `binding_metadata.source_code`; the published binding did not expose metadata in the runtime result, so the orchestrator fell back from `EVIDENCE-FRESH` to `F5_5_FRESHNESS_CONTINUOUS -> data_quality_observations`.
   - Fix: `calculateIndicator()` derives the governed source with `getSourceCodeForIndicator(indicator.functional_code, indicator.formula_code)` when metadata is absent. This preserves formula reuse while respecting indicator-specific contracts such as `EVIDENCE-FRESH -> evidence_freshness_records`.

## GRC-HEALTH and Score Global current state

- `GRC-HEALTH`: `insufficient_data`, sample/population `0/0`, snapshot `7ff429b8-c0e1-4803-bd10-4309bd8be4ef`.
- Official Score Global: `null`.
- Contract observed in code: official dashboard derives `official_score` only from latest `GRC-HEALTH` when that snapshot state is `calculated`; it does not convert missing score to zero.
- Blocking dependency: EVIDENCE-FRESH currently fails source resolution in deployed runtime. After this fix is deployed, rerun official recalculate to determine whether GRC-HEALTH becomes calculated or remains legitimately insufficient due other missing dependencies.

## Admin KPI vs Official KPI

- Admin universe: 24 administrative/legacy KPIs from `GET /api/kpis/admin/:tenantId`.
- Official universe: 22 functional indicators from `GET /api/metrics/official/catalog`.
- Current conclusion: different counts are expected and not automatically a bug. However, official consumers must not be blocked by Admin KPI semantics, and equivalent concepts must not show conflicting official values.
- No code was changed to force equality between universes.

## Zero-hardcode audit

- Product business-data hardcodes introduced: 0.
- Tenant-specific hardcodes introduced: 0.
- QA-specific hardcodes introduced: 0.
- Fixed runtime expected values introduced: 0.
- Null-to-zero official KPI fixes introduced: 0.
- Fake fallback values introduced: 0.
- Silent official-catalog first-N: fixed locally.
- Parallel frontend official calculations: 0 in modified official consumers.

Remaining literal/preview findings are not official catalog visibility:

- `overview.alerts.slice(0, 8)` in GRC is an alerts preview, not an official indicator catalog.
- history/comparison limits such as `limit=24` are explicit API history windows, not indicator visibility.
- lineage/history/log previews cap technical evidence volume, not business KPI values.

## Local validation for this intermediate fix

PASS:

- `node backend/src/services/math-governance/sourceResolver.test.js`
- `npm run phase5:functional-closure`
- `node frontend/scripts/check-metrics-operational-contract.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run lint`
- `git diff --check`

## Deployment requirement

This batch changes production code. Runtime cannot be finally closed until the fix is merged and deployed, then Tenant 1 recalculate/cross-view is rerun.

Next exact action:

MERGE AND DEPLOY THIS INTERMEDIATE TENANT-1 22/22 CLOSEOUT FIX, THEN RERUN TENANT 1 FINAL 22/22 RUNTIME CLOSEOUT FROM OFFICIAL RECALCULATE.

# 2026-08-11 — Post-deploy PR #75 primary platform reconciliation

## Runtime base

- Runtime: `https://tcdx-iso.tecdex.net`
- Base main/deployed SHA observed: `b7be7afe9341ab9353d8dad95d1b486e1c4f0374`
- PR #75: merged and deployed
- Tenant used as primary validation dataset: Tenant 1 (`70000000-0000-0000-0000-000000000701`)
- Official period resolved by runtime recalculate: `2026-08`
- Official catalog discovered dynamically: 22 indicators
- Official recalculate result: `recalculated = 22`, `failed = 0`, `snapshots_created = 22`, `snapshots_failed = 0`
- Runtime errors observed during post-PR75 collector: 0 HTTP 5xx, 0 SQL errors, 0 constraint errors, 0 frontend exceptions, 0 snapshot failures.

Artifacts:

- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr75/runtime/summary.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr75/runtime/official-recalculate.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr75/indicators/matrix.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr75/indicators/per-indicator-technical.json`

## PR #75 runtime verification

PASS:

- Source-selection fix deployed: `EVIDENCE-FRESH` now resolves through the indicator binding path; remaining failure is a physical adapter compatibility defect, not formula/source selection.
- BI catalog visibility: expected official codes minus accessible BI codes = `[]`.
- Report catalog visibility: expected official codes minus accessible Report codes = `[]`.
- GRC auditor link: no `/grc -> /auditor` 404 reproduced after deploy.

## Post-PR75 22/22 matrix

| Code | Formula | Sample/Population | Sufficiency | State | Value | Snapshot | Dashboard | Métricas | BI | GRC | Report | Export | Status |
|---|---|---:|---|---|---:|---|---|---|---|---|---|---|---|
| ACTIONS | F5_5_WEIGHTED_PROGRESS | 2/2 | sufficient | calculated | 62.5 | 1d1730aa-b71d-49fa-a2d3-1d409581fdee | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| AUDIT-ASSURANCE | F5_5_ASSURANCE_SCORE | 0/0 | insufficient | insufficient_data | — | 6cfc7d80-29f5-49d3-8489-0304a637d602 | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| COMPLIANCE | F5_5_COMPLIANCE_WEIGHTED | 4/4 | sufficient | calculated | 83.33 | 1b11cbe1-ca5c-404e-9b5a-88e863abcd84 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| CONTINUITY | F5_5_SLA_COMPLIANCE | 0/1 | insufficient | insufficient_data | — | fdeee28a-cec5-4136-ac70-76ce77c70b04 | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| CONTROL-COVERAGE | F5_5_CONTROL_COVERAGE | 0/51 | insufficient | insufficient_data | — | d2a5bb73-9687-4cd3-98d7-6bfe045c4be5 | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| CONTROL-EFFECT | F5_5_CONTROL_EFFECTIVENESS | 0/51 | insufficient | insufficient_data | — | e96277d9-5e98-4148-b962-993b59b3f82a | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| COVERAGE | F5_5_COVERAGE | 4/4 | sufficient | calculated | 75 | 0a88f5f6-27df-4238-be08-d3b382eb7c3c | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| DATA-TRUST | F5_C3_DATA_TRUST | 578/578 | insufficient | insufficient_data | — | d07fc251-c880-432d-a395-30395e7c9aa3 | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| EVIDENCE-FRESH | F5_5_FRESHNESS_CONTINUOUS | 0/0 | invalid | source_incompatible | — | cb04c70f-7807-469a-8f71-a08cf1c30382 | PASS | PASS | PASS | PASS | PASS | PASS | SOURCE_INCOMPATIBLE |
| FINDINGS | F5_5_SEVERITY_INDEX | 2/2 | insufficient | insufficient_data | — | 5ed53caf-2b93-41ae-a489-114b900bbf49 | PASS | PASS | PASS | PASS | PASS | PASS | MAPPING_ERROR |
| GRC-HEALTH | F5_5_GRC_HEALTH | 0/0 | insufficient | insufficient_data | — | aa841f56-60c9-4c3c-98d7-ed24f7601197 | PASS | PASS | PASS | PASS | PASS | PASS | DEPENDENCY_PENDING |
| INCIDENTS | F5_5_SEVERITY_INDEX | 0/0 | insufficient | insufficient_data | — | 3fea9452-98e4-40a7-813d-c8acfa48644d | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| ISO-READINESS | F5_5_READINESS | 0/0 | insufficient | insufficient_data | — | e3960b16-4aab-46de-bab5-abc07cca6d2f | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| LOSSES | F5_5_NET_LOSS | 3/3 | sufficient | calculated | 225000 | c2ce83e8-10af-4975-9562-f8a6a8375163 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| MATURITY | F5_5_MATURITY | 578/578 | insufficient | insufficient_data | — | 49b1e354-5e03-4cd0-8c91-95ca0988fc4b | PASS | PASS | PASS | PASS | PASS | PASS | MAPPING_ERROR |
| OP-PERFORMANCE | F5_C3_OPERATIONAL_PERFORMANCE | 0/0 | insufficient | insufficient_data | — | 293d5d84-f116-4435-945a-175b383e47e4 | PASS | PASS | PASS | PASS | PASS | PASS | DEPENDENCY_PENDING |
| REMEDIATION | F5_5_WEIGHTED_PROGRESS | 2/2 | sufficient | calculated | 62.5 | bf47141c-2887-4441-a99e-3925d4fa2880 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| RISK-INHERENT | F5_5_INHERENT_RISK | 77/77 | sufficient | calculated | 19.9091 | 16e69a8c-f885-48db-892f-cabcd3cfdd32 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| RISK-RESIDUAL | F5_5_RESIDUAL_RISK | 77/77 | insufficient | insufficient_data | — | 1b659eb1-94f7-40b3-9839-6ba999a89ac4 | PASS | PASS | PASS | PASS | PASS | PASS | MAPPING_ERROR |
| SLA-COMPLIANCE | F5_5_SLA_COMPLIANCE | 0/1 | insufficient | insufficient_data | — | ec53141d-daae-4e9c-8b39-2cb945b0a97d | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| SUPPLIER-HEALTH | F5_C3_SUPPLIER_HEALTH | 0/0 | insufficient | insufficient_data | — | 587f0c02-3c50-4f8d-9b40-4281eb5a74dc | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |
| SUPPLIER-RISK | F5_5_SUPPLIER_RISK | 0/0 | insufficient | insufficient_data | — | 04c2a69d-75ca-4472-946d-1c450f4da80f | PASS | PASS | PASS | PASS | PASS | PASS | EXPECTED_UNMEASURED |

Totals before the new local fix:

- PASS: 6
- EXPECTED_UNMEASURED: 11
- SOURCE_INCOMPATIBLE: 1
- MAPPING_ERROR: 4
- DEPENDENCY_PENDING: 2

## Suspicious insufficient-data audit

- `DATA-TRUST`: sample/population `578/578`, but formula `F5_C3_DATA_TRUST` requires all eight persisted trust dimensions. Runtime missing input: `accuracy`. Classification remains `EXPECTED_UNMEASURED` unless explicit accuracy validation is available; unknown dimensions are not renormalized.
- `MATURITY`: sample/population `578/578` came from a generic `metric_measurements` fallback that consumed all official measurements. This is `MAPPING_ERROR` / source population bug. Fix: dedicated maturity adapter filters only survey maturity rows or metric measurements bound to `MATURITY` / `F5_5_MATURITY`.
- `FINDINGS`: sample/population `2/2` had no recognized severity input for `F5_5_SEVERITY_INDEX`. Classification is `MAPPING_ERROR`; source rows without `low|medium|high|critical` must be excluded explicitly and must not be counted as usable formula rows.
- `RISK-RESIDUAL`: sample/population `77/77`, missing `inherentRisk` in runtime because mapper only checked `probability` and ignored `likelihood` even though `risk_register_controls@3` declares `probability|likelihood`. Fix: derive portfolio inherent risk from `exposure|inherent_risk_score|probability|likelihood × impact`; control effectiveness remains required and is not invented.

## Additional root causes fixed locally after PR #75

1. `EVIDENCE-FRESH` physical fallback adapter incompatible with real GRC evidence versions.
   - Symptom: `source_incompatible`, `sample_size = 0`, `population_size = 0`.
   - Root cause: `queryEvidenceFreshness()` selected `v.status` from `grc_evidence_versions`; runtime schema stores status on `grc_evidence_submissions` and review decision on `grc_evidence_reviews`.
   - Fix: derive status/validation from governed submission/review joins when available; no direct `v.status`, no fake status for calculated output.

2. `GRC-HEALTH` consumed raw `calculation_outputs`.
   - Symptom: `sample_size = 0`, `population_size = 0` for a dependency-based indicator.
   - Root cause: raw `calculation_outputs` does not expose `formula_code`; the contract requires components by official formula.
   - Fix: dedicated adapter joins `calculation_runs` and `calculation_outputs`, filters calculated dependency formulas, and emits rows with `formula_code` and official output value.

3. `GRC-HEALTH` dependency map referenced obsolete formula codes.
   - Root cause: evidence mapped to `F5_5_EVIDENCE_QUALITY` and data trust to `F5_5_COMPLETENESS`.
   - Fix: evidence maps to `F5_5_FRESHNESS_CONTINUOUS`; dataTrust maps to `F5_C3_DATA_TRUST`.

4. `MATURITY` source population was not scoped to maturity.
   - Root cause: generic fallback read all `metric_measurements`.
   - Fix: fallback reads only measurements whose metric definition/binding identifies `MATURITY` / `F5_5_MATURITY`.

5. `FINDINGS` counted rows with no severity as usable.
   - Root cause: dataset required `status`, while formula requires recognized severity buckets.
   - Fix: formula-specific source mapping excludes rows without `low|medium|high|critical` and records explicit exclusions.

6. `RISK-RESIDUAL` ignored `likelihood` from the risk matrix.
   - Root cause: mapper only read `probability`, despite the source contract declaring `probability|likelihood`.
   - Fix: mapper derives inherent risk from all usable rows using the published risk axes; missing control effectiveness remains insufficient data.

## Local validation for this grouped fix

PASS:

- `node backend/src/services/math-governance/sourceResolver.test.js`
- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js`
- `npm run phase5:functional-closure`
- `npm run phase5-5:source-binding-check`
- `bash scripts/phase5-5/check-source-adapters-postgres-ci.sh`
- `npm --prefix backend test`
- `git diff --check`

## Zero-hardcode audit

- Product business-data hardcodes introduced: 0.
- Tenant-specific hardcodes introduced: 0.
- QA-specific hardcodes introduced: 0.
- Fixed runtime expected values introduced: 0.
- Silent first-N introduced: 0.
- Null-to-zero introduced: 0.
- Fake fallback values introduced: 0.
- Parallel frontend calculations introduced: 0.

Constants added/used are methodology constants, not product data:

- GRC-HEALTH dependency formula codes.
- Severity buckets `low`, `medium`, `high`, `critical`.
- Data Trust dimension names already required by formula contract.

## Deployment requirement

This grouped backend fix must be deployed before final runtime validation can continue. Expected post-deploy checks:

1. Rerun official dashboard recalculate for Tenant 1 / runtime period.
2. Confirm `EVIDENCE-FRESH` no longer returns `source_incompatible`.
3. Reclassify `GRC-HEALTH`, `Score Global`, `MATURITY`, `FINDINGS`, and `RISK-RESIDUAL` from fresh runtime evidence.
4. Confirm Dashboard, Métricas, BI, GRC, Report and Export still consume the same official snapshots.

# 2026-08-11 — Post-deploy PR #76 primary platform reconciliation

## Runtime base

- Runtime: `https://tcdx-iso.tecdex.net`
- PR #76 merge SHA observed on `main`: `37412131c8dc946fed040273a2d665ad8209c8a2`
- Tenant used as primary validation dataset: Tenant 1 (`70000000-0000-0000-0000-000000000701`)
- Official period resolved by runtime recalculate: `2026-08`
- Official catalog discovered dynamically: 22 indicators
- Official recalculate result: `recalculated = 22`, `failed = 0`, `snapshots_created = 22`, `snapshots_failed = 0`
- Runtime errors observed during post-PR76 collector: 0 HTTP 5xx, 0 SQL errors, 0 constraint errors, 0 frontend exceptions, 0 snapshot failures.

Artifacts:

- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr76/runtime/summary.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr76/runtime/official-recalculate.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr76/indicators/matrix.json`
- `artifacts/phase5-human-runtime/tenant-1/final-22-indicators/post-pr76/indicators/per-indicator-technical.json`

## PR #76 runtime verification

PASS:

- `EVIDENCE-FRESH` physical adapter no longer fails with schema incompatibility. Runtime state is now `insufficient_data` with `sample/population = 0/0`, not `source_incompatible`.
- `GRC-HEALTH` dependency adapter now reads official calculation outputs through `calculation_runs` formula codes. Runtime state is `dependency_pending` because `dataTrust` and `risk` are not calculated.
- Calculation outputs are associated by `formula_code`; no raw output rows are consumed without formula identity.
- `FINDINGS` excludes rows without valid severity; runtime `sample/population = 0/2`.
- `RISK-RESIDUAL` now maps risk likelihood/impact; runtime remains `insufficient_data` because `controlEffectiveness` is required and absent.
- BI and Report catalog visibility remained complete: missing codes = `[]`.

Remaining platform defect found:

- `MATURITY` still reports `sample/population = 28/28` with `state = insufficient_data`, but the formula has no valid `levels[]` input. Rows associated to maturity but missing a 0..5 maturity level were counted as usable formula rows.
- Classification: `MAPPING_ERROR`.
- Required fix: `F5_5_MATURITY` must use a formula-specific source mapping, excluding rows with missing/non-numeric/out-of-scale maturity level and reporting explicit exclusions. It must not treat percentage scores or generic measurement values as maturity levels.

## Post-PR76 22/22 summary

| Status | Count |
|---|---:|
| PASS | 6 |
| EXPECTED_UNMEASURED | 15 |
| DEPENDENCY_PENDING | 1 |
| MAPPING_ERROR | 1 |

The collector classifies `MATURITY` as `EXPECTED_UNMEASURED`, but the runtime evidence is not defensible until the source resolver stops counting rows without valid maturity level as usable formula sample. The effective platform classification for closeout is therefore `MAPPING_ERROR`.

## Local fix after PR #76

Changed locally:

- `backend/src/services/math-governance/sourceResolver.service.js`
  - adds `maturityPortfolio()` for `F5_5_MATURITY`;
  - accepts only maturity levels on the published 0..5 scale;
  - excludes missing/non-numeric levels with `maturity_level_missing_or_invalid`;
  - excludes percentage/out-of-scale values with `maturity_level_out_of_range`;
  - adjusts formula counts, formula input and lineage to usable maturity-level rows only.
- `backend/src/services/math-governance/sourceResolver.test.js`
  - verifies invalid maturity rows do not produce numeric output;
  - verifies resolver counts `received`, `usable` and exclusions correctly.

Local validation:

- `node backend/src/services/math-governance/sourceResolver.test.js`
- `npm run phase5:functional-closure`
- `npm run phase5-5:source-binding-check`
- `bash scripts/phase5-5/check-source-adapters-postgres-ci.sh`
- `npm --prefix backend test`

Zero-hardcode:

- Product business-data hardcodes introduced: 0.
- Tenant-specific hardcodes introduced: 0.
- QA-specific hardcodes introduced: 0.
- Fixed runtime expected values introduced: 0.
- Silent first-N introduced: 0.
- Null-to-zero introduced: 0.
- Fake fallback values introduced: 0.
- Parallel frontend calculations introduced: 0.

Next exact action:

OPEN INTERMEDIATE PR FOR THIS PLATFORM FIX, WAIT FOR CI, MERGE AND DEPLOY, THEN RERUN TENANT 1 FINAL 22/22 RUNTIME CLOSEOUT FROM OFFICIAL RECALCULATE.
