# Phase 6.4 — KPI Product Reconciliation

## Platform base

- Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
- Branch: `phase6/kpi-product-reconciliation`
- Base main/origin main: `aeb923953b31c3899611afc205fcec5fa2dfc388`
- Runtime: `https://tcdx-iso.tecdex.net`
- Services: backend healthy, AI Engine healthy, frontend HTTP 200
- Phase 5: closed; not reopened
- Phase 6.1/6.2/6.3: closed; not reopened

## Admin KPI definition

`/administrar-kpis` is the administrative KPI configuration and operational tracking universe.

Evidence:

- Frontend: `frontend/src/app/administrar-kpis/page.tsx`
- API: `/api/kpis/admin/:tenantId`, `/api/kpis/custom`, `/api/kpis/tenant-setting`, `/api/kpis/manual-value`, `/api/kpis/recalculate/:tenantId`
- Backend: `backend/src/routes/kpi.routes.js`, `backend/src/controllers/kpi.controller.js`, `backend/src/services/kpi.engine.js`
- Tables: `kpi_definitions`, `tenant_kpi_settings`, `kpi_thresholds`, `kpi_standard_mappings`, `kpi_snapshots`, `kpi_manual_values`

Admin KPI can configure tenant tracking, targets, thresholds, custom KPIs and manual administrative values. It is not the official Phase 5 source of truth.

## Official KPI definition

`/metricas`, Dashboard KPI, BI, GRC, Report and Export consume the governed Phase 5 official indicator universe.

Evidence:

- Frontend: `frontend/src/app/metricas/page.tsx`, `frontend/src/components/indicators/FunctionalIndicatorCatalog.tsx`, Dashboard KPI view
- API: `/api/metrics/official/catalog`, `/api/metrics/official/dashboard`, `/api/metrics/official/export`, `/api/metrics/official/:metricCode`
- Backend: `backend/src/routes/phase5.routes.js`, `backend/src/services/indicators/indicatorGovernance.service.js`
- Tables: `metric_definitions`, `metric_definition_versions`, `metric_source_bindings`, `metric_measurements`, `metric_snapshots`, `calculation_runs`

Official KPI values come from governed contracts, formula execution, measurements and published snapshots. Official state preserves `calculated`, `insufficient_data`, `dependency_pending` and no-snapshot/null semantics.

## Relationship

| Concept | Admin source | Official source | Classification | Action |
| --- | --- | --- | --- | --- |
| Catalog count | `/api/kpis/admin/:tenantId` | `/api/metrics/official/catalog` | RELATED_BUT_DIFFERENT | Do not force equal counts. |
| Dashboard KPI | none | `/api/metrics/official/dashboard` | OFFICIAL_GOVERNED_OUTPUT | Keep official source. |
| Métricas | none | `/api/metrics/official/catalog` | OFFICIAL_GOVERNED_OUTPUT | Present as governed official indicators. |
| Health summary | `/api/kpi(s)/effective-health-summary/:tenantId` | Official Dashboard summary | RELATED_BUT_DIFFERENT | Label as administrative/Health ISO operational view where used. |
| Score Global | admin operational score | `official_score` | OFFICIAL_GOVERNED_OUTPUT | Preserve official null; no admin fallback. |
| Custom KPI | `/api/kpis/custom` | none | ADMIN_ONLY | Clarify it does not create official indicators. |

## UX changes

- `/administrar-kpis` is now titled as administrative KPI configuration.
- The page explicitly states that Admin KPI does not modify official governed indicators or snapshots.
- The page provides a role/capability-aware CTA to `/metricas` only when the user can access official metrics.
- Administrative score and values are labeled as administrative.
- Read-only users no longer see create/edit/delete/disable/recalculate/manual-value actions.
- `/metricas` explicitly states that official results are governed by official sources, formulas and snapshots, not by administrative KPI configuration.
- Dashboard KPI copy now refers to official indicators and official recalculation.

## Score Global

The official Dashboard still reads `official_score` from `/api/metrics/official/dashboard`.

Runtime read-only evidence for Tenant 1:

- official dashboard HTTP 200
- `official_score = null`
- total official KPIs = 22
- measured official KPIs = 6

No admin score fallback, null-to-zero, fake 100 or alternate average was introduced.

## Multi-tenant validation

Read-only runtime comparison:

| Dataset | Admin count | Admin enabled | Official count | Official calculated | Equal counts |
| --- | ---: | ---: | ---: | ---: | --- |
| Tenant 1 validation dataset | 24 | 4 | 22 | 6 | No |
| Tenant 2 generalization dataset | 36 | 21 | 22 | 5 | No |

This confirms that Admin and Official universes vary independently by tenant and must not be synchronized artificially.

## RBAC and capabilities

The change preserves Phase 6.3. Cross-linking from Admin KPI to official indicators uses existing role/capability context:

- role feature: `phase5.read`
- capability: `metrics.catalog`

Administrative actions are gated by the existing `health.refresh` permission used by the module, and hidden for read-only users.

## Legacy classification

- Admin standard/custom KPI: `ADMIN_CONFIGURATION`
- Health ISO administrative KPI: `RELATED_BUT_DIFFERENT` / `LEGACY_COMPATIBILITY`
- Official Phase 5 indicators: `OFFICIAL_GOVERNED_OUTPUT`
- Dashboard V2: unchanged compatibility route; not reopened in 6.4

No legacy deletion was performed.

## Validation

- `npm --prefix frontend run test:phase6-kpi-product-reconciliation` — PASS
- `npm --prefix frontend run typecheck` — PASS
- `npm --prefix frontend run lint` — PASS
- `npm --prefix frontend run test` — PASS
- `npm --prefix frontend run test:phase6-ui-responsive` — PASS
- `npm --prefix frontend run test:phase6-sidebar-rbac` — PASS
- `node scripts/phase5-5/check-production-acceptance-contract.js` — PASS
- `npm --prefix frontend run build` — PASS
- `git diff --check` — PASS

## Gate status

Current status is `READY_FOR_INTERMEDIATE_MERGE_REVIEW` because product code changed. Final `PHASE_6_4_KPI_PRODUCT_RECONCILIATION_PASS` requires PR review, CI, merge, deploy and post-deploy runtime validation.
