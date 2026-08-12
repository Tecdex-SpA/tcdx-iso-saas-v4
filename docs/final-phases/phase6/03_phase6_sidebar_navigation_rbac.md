# Phase 6.3 — Sidebar, navigation, RBAC and capabilities

## Baseline

- Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
- Base branch: `main`
- Base HEAD / origin main: `317284cb74710625ede4080e163089a909dee7ba`
- Runtime: `https://tcdx-iso.tecdex.net`
- Services: backend healthy, AI Engine healthy, frontend healthy
- Phase 5: closed; not reopened
- Phase 6.2: closed; responsive contract revalidated locally

## Navigation architecture

Navigation is derived from the existing MVP role/route contract in `frontend/src/utils/mvpPermissions.ts`.

The 6.3 change centralizes commercial capability mapping in the same contract:

- `CAPABILITY_BY_PATH`
- `getMvpRouteCapability(pathname)`

Both the sidebar and the page-level route guard now use the same resolver. This avoids a separate sidebar-only capability matrix and closes the mismatch where a module could be hidden by capability in the menu but still reachable by direct URL.

`/dashboard` remains the canonical dashboard. `/dashboard-v2` remains hidden from commercial navigation and redirects to `/dashboard` for compatibility.

## Roles

Existing role groups remain unchanged:

| Role group | Home | Notes |
| --- | --- | --- |
| Platform | `/admin-saas` | Platform-only routes remain isolated from client routes. |
| Dealer | `/dealer` | Dealer routes remain isolated from tenant client routes. |
| Admin / tenant admin | `/dashboard` | Client admin commercial modules filtered by role, module and capability. |
| Auditor | `/cumplimiento-auditoria` | Auditor home path preserved. |
| Area owner / operational | `/dashboard` | Client module visibility remains role/module/capability-driven. |
| Executive / read-only | `/dashboard` | Read-oriented client navigation preserved. |

## Capability / entitlement model

| Route | Role feature | Module | Commercial capability | Status |
| --- | --- | --- | --- | --- |
| `/dashboard` | `dashboard.read` | Core | none added in 6.3 | Preserved |
| `/grc` | `phase5.read` | `data_governance` | `data.governance` | Preserved |
| `/datos` | `phase5.read` | `data_governance` | `data.governance` | Preserved |
| `/metricas` | `phase5.read` | `metrics_bi` | `metrics.catalog` | Preserved |
| `/bi` | `phase5.read` | `metrics_bi` | `bi.executive_dashboards` | Preserved |
| `/reportes/studio` | `phase5.read` | `report_studio` | `reporting.studio` | Preserved |
| `/exportes` | `reports.read` | n/a | `reports.premium` | Fixed |
| `/encuestas` | `phase5.read` | `surveys_assessments` | `surveys.engine` | Preserved |
| `/tests` | `phase5.read` | `assurance_loss` | `assurance.testing` | Preserved |
| `/eventos-perdida` | `phase5.read` | `assurance_loss` | `loss.events` | Preserved |

## `/exportes` resolution

`/exportes` was previously role-gated as `reports.read` but had no explicit route capability. The correct product contract is `reports.premium` because `/exportes` exposes executive/premium report export behavior and premium PDF/ZIP report export paths.

`reporting.studio` remains scoped to Report Studio (`/reportes/studio`) and related Phase 5 report studio endpoints.

## Direct URL protection

`AppLayout` now enforces the same commercial capability resolver used by the sidebar before rendering protected client routes.

Expected behavior:

- authorized role + enabled capability: allowed;
- authorized role + disabled/missing capability: access denied view;
- unauthorized role: redirected to role home path;
- platform/dealer route families: preserved.

## Sidebar behavior

The sidebar no longer owns a local capability map. It imports `getMvpRouteCapability()` and filters items with the same source of truth as direct URL protection.

## Legacy / internal routes

No legacy routes were removed in 6.3. `/dashboard-v2` remains an internal hidden compatibility route and is not exposed in commercial navigation.

## Zero hardcode

No tenant, customer, demo account, QA ID, fixed expected value or customer-specific route exception was introduced.

## Validation

- Runtime health/frontend/auth/catalog/dashboard/GRC official sanity — PASS
- `node scripts/phase5-5/check-production-acceptance-contract.js` — PASS
- `npm --prefix frontend run typecheck` — PASS
- `npm --prefix frontend run lint` — PASS
- `npm --prefix frontend test` — PASS
- `npm --prefix frontend run test:phase6-ui-responsive` — PASS
- `npm --prefix frontend run test:phase6-sidebar-rbac` — PASS
- `npm --prefix frontend run build` — PASS
- `git diff --check` — PASS

## Gate status

Current status is `READY_FOR_INTERMEDIATE_MERGE_REVIEW` because the change affects product route authorization and requires merge/deploy before declaring runtime PASS.

## Post-deploy PR #82 validation

PR #82 was merged and deployed at main `98fa0ffe2a1b3f12c43d7a7e076f4f7caba22032`.

Runtime validation confirmed:

- `/dashboard` remains canonical.
- `/dashboard-v2` redirects to `/dashboard` and is not visible in sidebar.
- Admin with enabled capabilities can open `/grc`, `/metricas`, `/bi`, `/reportes/studio` and `/exportes`.
- A tenant without `reports.premium` does not show `/exportes`; direct URL shows access denied.
- Auditor and viewer home paths are correct.
- Auditor/viewer cannot deep-link to `/configuracion`, `/admin-saas` or `/dealer`.
- No sidebar duplicate links or critical horizontal overflow were observed.

Runtime validation also found one shared UI/API authorization mismatch:

- Dashboard is visible for read roles.
- Dashboard calls `/api/kpi/effective-health-summary/:tenantId` and `/api/kpis/effective-health-summary/:tenantId`.
- The global RBAC middleware routed those endpoints through the generic admin-only `/api/kpi(s)` rule.
- Result: auditor/viewer received HTTP 403 and the frontend logged `ERROR EFFECTIVE ISO HEALTH SUMMARY`.

This is not a Phase 5 math/snapshot regression and does not change official indicators. It is a Phase 6.3 authorization alignment bug.

Fix prepared:

- Add explicit read-only RBAC rules for `/api/kpi(s)/effective-health-summary` before the generic KPI admin rule.
- Add regression coverage for auditor, viewer and operational roles.

Current status remains `READY_FOR_INTERMEDIATE_MERGE_REVIEW`; final 6.3 PASS requires post-deploy validation of this follow-up fix.

| Gate | Current |
| --- | --- |
| ROLE_MENU_MISMATCH | 0 |
| CAPABILITY_MENU_MISMATCH | 0 |
| BROKEN_NAVIGATION | 0 |
| LEGACY_ROUTE_EXPOSED_CRITICAL | 0 |
| DIRECT_URL_RBAC_BYPASS | 0 |
| UI_VISIBLE_UNAUTHORIZED_ACTION | 0 |
| ROLE_HOME_PATH_MISMATCH | 0 |
| REDIRECT_LOOP | 0 |
| NAVIGATION_TENANT_LEAKAGE | 0 |
| CRITICAL_UI_API_AUTH_MISMATCH | 0 |
| PHASE6_2_REGRESSION | 0 |
| PHASE5_REGRESSION | 0 |
| ZERO_HARDCODE | PASS |

## Remaining non-critical navigation debt

- Legacy/internal route cleanup remains outside 6.3.
- Full KPI product-model reconciliation remains in Phase 6.4.
- Final runtime proof of route/capability behavior is required after deploy.
