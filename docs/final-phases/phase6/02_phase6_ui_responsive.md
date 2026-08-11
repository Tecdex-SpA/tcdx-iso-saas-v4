# Phase 6.2 — UX/UI and Responsive Hardening

Captured: 2026-08-11

## Status

`READY_FOR_INTERMEDIATE_MERGE_REVIEW`

Phase 6.2 introduced generic UX/responsive hardening code. Because product code changed, final runtime closure requires PR review, merge, deploy, and post-deploy browser validation. Phase 5 was not reopened.

Post-deploy validation of PR #80 confirmed the responsive/chart fix was deployed, but surfaced one additional 6.2 information-architecture defect in `/dashboard`: the extended GRC decision center made the executive dashboard too long and mixed Dashboard responsibilities with GRC Integrated responsibilities. This was handled as part of the same 6.2 UX scope, without reopening Phase 5 and without changing calculations, formulas, source contracts, snapshots, measurements, RBAC, or tenant isolation.

## Platform base

| Item | Evidence |
| --- | --- |
| Branch | `phase6/ui-responsive` |
| Base HEAD | `812e6a2f56dd8578aa1da1a9d4a8d2562edaa911` |
| Runtime | `https://tcdx-iso.tecdex.net` |
| Runtime health | `/health` HTTP 200 |
| Backend | healthy |
| AI Engine | healthy |
| Frontend | healthy |

## Routes inspected

6.2 worked from the 6.1 route inventory and prioritized dense commercial surfaces:

- `/dashboard`
- `/dashboard-v2`
- `/metricas`
- `/administrar-kpis`
- `/bi`
- `/grc`
- `/grc-global`
- `/reportes/studio`
- `/riesgos`
- `/matriz-riesgo`
- `/cumplimiento-auditoria`
- `/evidencias`
- `/planes-accion`
- `/acciones-recomendadas`
- `/auditorias`
- `/hallazgos`
- `/proveedores`
- `/incidentes`
- `/continuidad`
- `/datos`
- `/perfil-empresa`
- `/configuracion`

Not every route required code changes. The implemented fix targets the shared chart/header/action-wrapper patterns used by the densest dashboard/commercial screens.

## Issues found

| Area | Finding | Severity |
| --- | --- | --- |
| Charts | Direct Recharts `ResponsiveContainer` instances could render before parent dimensions stabilized, producing chart width/height warnings during route transitions/resizes. | Non-critical but product-visible debt |
| Page headers | Enterprise page headers used non-wrapping flex alignment that could pressure action groups on notebook widths. | Responsive hardening |
| Card/table action placement | Enterprise card/table headers used non-wrapping action containers. | Responsive hardening |
| Tables | Existing table wrappers generally use internal overflow; no critical body overflow was found in 6.1. | No critical defect |
| Forms/modals | No broken modal/form gate failure was found in 6.1. | No critical defect |

## Shared root causes

1. Chart rendering depended on parent layout being measurable immediately.
2. Shared enterprise headers and action containers did not always wrap action groups.
3. Dense dashboard surfaces reused the same direct chart pattern in multiple places.

## Fixes implemented

| Fix | Files |
| --- | --- |
| Added `ResponsiveChartFrame`, a generic measured chart wrapper using `ResizeObserver`, minimum render dimensions, debounce, and stable structural marker. | `frontend/src/components/ui/enterprise/ResponsiveChartFrame.tsx` |
| Replaced direct Recharts `ResponsiveContainer` usage in Dashboard and Dashboard v2 surfaces. | `frontend/src/app/dashboard/page.tsx`, `frontend/src/components/dashboard-v2/DashboardV2Panel.tsx`, `frontend/src/components/dashboard-v2/DashboardV2HealthSection.tsx` |
| Added reusable chart frame CSS. | `frontend/src/app/globals.css` |
| Hardened enterprise page/card/table headers so actions wrap instead of forcing horizontal pressure. | `EnterprisePageHeader.tsx`, `EnterpriseCard.tsx`, `EnterpriseTableShell.tsx`, `globals.css` |
| Added structural regression test for the responsive chart/header contract. | `frontend/scripts/check-phase6-ui-responsive-contract.mjs`, `frontend/package.json` |
| Replaced the extended GRC decision section in `/dashboard` with a compact executive GRC summary and CTA to `/grc`. | `frontend/src/app/dashboard/layout.tsx`, `frontend/src/components/math-governance/GrcDecisionCenter.tsx` |
| Mounted the detailed decisions/priorities/interpretation experience in GRC Integrated, reusing the existing official-catalog-driven decision component. | `frontend/src/components/grc/GrcPortal.tsx` |

## Dashboard GRC information architecture

| Requirement | Result | Evidence |
| --- | --- | --- |
| `/dashboard` remains executive and compact | PASS pending deploy | Dashboard now renders `GrcDecisionCenter` with `variant="summary"` and title `Resumen ejecutivo GRC`. |
| Extended decisions/priorities experience moves out of Dashboard main flow | PASS pending deploy | Full decision center is mounted in `/grc` as `Decisiones, prioridades e interpretación GRC`. |
| Dashboard CTA is semantically GRC | PASS pending deploy | CTA label `Ver análisis GRC`, href `/grc`. |
| No duplicate source of truth | PASS | Both summary and detailed modes use the same component and existing `/api/metrics/official/catalog` data path. |
| No Phase 5 regression | PASS at code/test level | No calculation, formula, snapshot, measurement, source resolver, or tenant-isolation logic changed. |
| Zero hardcode | PASS | No tenant, user, dataset, KPI value, or customer-specific logic was introduced. |

Gate added to 6.2:

`DASHBOARD_GRC_INFORMATION_ARCHITECTURE = PASS` after merge/deploy validation.

## Responsive matrix

| Route group | 1440x900 | 1366x768 | 1280x720 | 1024x768 | Status |
| --- | --- | --- | --- | --- | --- |
| Dashboard / Dashboard v2 charts | STRUCTURAL PASS | STRUCTURAL PASS | STRUCTURAL PASS | STRUCTURAL PASS | Post-deploy browser validation required |
| Enterprise headers/actions | STRUCTURAL PASS | STRUCTURAL PASS | STRUCTURAL PASS | STRUCTURAL PASS | Post-deploy browser validation required |
| Tables | Baseline PASS | Baseline PASS | Baseline PASS | Baseline PASS | No critical 6.1 defect; deeper flow validation later |
| Forms/modals | Baseline PASS | Baseline PASS | Baseline PASS | Baseline PASS | No critical 6.1 defect; deeper flow validation later |

6.2 local browser note: a local dev proxy was used to validate the local bundle against runtime APIs, but the authenticated app shell remained in access-validation state in the proxy/dev setup. This was classified as a local validation limitation, not a product regression. Final browser evidence must be captured after PR deploy.

## Console/network

| Signal | Result |
| --- | --- |
| HTTP 5xx | 0 observed in runtime health/local validation |
| Critical frontend exception | 0 observed |
| Chart warning | Code-level fix implemented; runtime confirmation pending deploy |
| Failed asset request | 0 critical observed |
| Failed API request | Local proxy limitation only; not persisted, not production |

## Phase 5 regression

PASS at code level.

No Phase 5 formula, source contract, resolver, snapshot, measurement, calculation, tenant isolation, or official KPI semantics were modified.

## Zero-hardcode

PASS.

No tenant IDs, QA IDs, emails, fixed KPI values, dataset-specific dimensions, first-N behavior, null-to-zero conversion, or customer-specific text were introduced. Design constants are generic layout/breakpoint/chart minimums.

## Validation

| Check | Result |
| --- | --- |
| `npm --prefix frontend run test:phase6-ui-responsive` | PASS |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run lint` | PASS |
| `npm --prefix frontend test` | PASS |
| `npm --prefix frontend run build` | PASS |
| `git diff --check` | PASS |

## 6.2 gate

| Gate | Value |
| --- | --- |
| `OFFSCREEN_CRITICAL_UI` | 0 |
| `CRITICAL_HORIZONTAL_OVERFLOW` | 0 |
| `BROKEN_MODAL_OR_FORM` | 0 |
| `INACCESSIBLE_PRIMARY_ACTION` | 0 |
| `CRITICAL_CHART_LAYOUT_ERROR` | 0 local structural; runtime post-deploy required |
| `RAW_TECHNICAL_UI_LEAK` | 0 |
| `CRITICAL_RESPONSIVE_LAYOUT_DEFECT` | 0 |
| `CRITICAL_FRONTEND_EXCEPTION` | 0 |
| `PHASE5_REGRESSION` | 0 |
| `ZERO_HARDCODE` | PASS |
| `DASHBOARD_GRC_INFORMATION_ARCHITECTURE` | PASS at code/test level; runtime post-deploy required |

## Remaining non-critical UX debt

- Full route-by-route commercial browser pass must run after deploy.
- Sidebar/capability gaps remain intentionally scoped to 6.3.
- KPI Admin vs Official product semantics remain intentionally scoped to 6.4.
- End-to-end business flow polish remains intentionally scoped to 6.5.
- Dashboard v2 remains compatibility-only and redirects to `/dashboard`; legacy decommission stays out of 6.2.

## Artifacts

Artifact root:

`artifacts/phase6/6.2-ui-responsive/`

Groups:

- `before/`
- `after/`
- `responsive/`
- `charts/`
- `tables/`
- `forms/`
- `modals/`
- `console/`

No secrets, cookies, tokens, or private customer data were intentionally stored.

## Next action

Review, merge, deploy PR, then run focused post-deploy 6.2 browser validation. Do not start 6.3 until 6.2 is closed.
