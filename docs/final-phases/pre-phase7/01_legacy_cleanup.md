# Pre-Phase 7 Cleanup - Legacy Routes, Dashboard V2 and Recharts

Status: READY_FOR_INTERMEDIATE_MERGE_REVIEW

Base SHA: 081686dec05658735196a8a2804c722f646ae237

Branch: cleanup/pre-phase7-legacy

## Scope

Cleanup only. No Phase 5 or Phase 6 functional gate was reopened, and no Phase 7 work was started.

## Dashboard-v2

Final status: REMOVE_V2_AND_DEAD_CODE.

Removed:

- `frontend/src/app/dashboard-v2/`
- `frontend/src/components/dashboard-v2/`
- `backend/src/routes/dashboard-v2.routes.js`
- `backend/src/services/dashboardV2.service.js`
- `/api/dashboard-v2` mount in `backend/src/app.js`
- `/api/dashboard-v2` RBAC rules in `backend/src/middleware/rbac.middleware.js`
- `/dashboard-v2` hidden-route compatibility in `frontend/src/utils/mvpPermissions.ts`
- legacy dashboard-v2 validation scripts

Updated:

- Phase 6 sidebar/RBAC contract now asserts `/dashboard-v2` remains retired.
- `test:prephase7-cleanup` enforces no active DashboardV2 route, API, service, script dependency, sidebar entry, or direct Recharts usage outside the wrapper.
- Product/demo/API/cleanup docs were updated where they represented active surface or current manifests.

DB compatibility:

- `user_dashboard_preferences` remains as DATABASE_LEGACY_RETAINED.
- No destructive migration or DROP was performed.

## Legacy routes

Removed:

- `/dashboard-v2`
- `/api/dashboard-v2`

Retained:

- `/tests`: ACTIVE, required by `assurance.testing`, GRC portal links, Phase 5 and demo visual contracts.
- `frontend/legacy-pages-archive/*`: historical retention outside active App Router.
- `/ia`, `/documentos`, `/ejecucion-iso`: retained because they require separate enterprise/product decisions.

No test-only critical route was removed beyond dashboard-v2 because no other objective critical exposure was found in the targeted scope.

## Recharts

Root cause addressed:

- Historical non-critical first-measurement warnings were tied to zero-size initial chart containers and legacy chart surfaces.
- Productive direct `ResponsiveContainer` usage is now limited to `ResponsiveChartFrame`.
- Dashboard-v2 chart components were removed.

Runtime result:

- Local build `/dashboard` smoke: `warnings_count = 0`.
- Recharts warnings after cleanup: `0`.
- Page errors: `0`.

The local browser run also observed 404 console errors from running the frontend without a local backend/proxy. They were not Recharts warnings and did not produce page errors.

## Technical cleanup

- Removed unused imports and route mounts tied to dashboard-v2.
- Removed obsolete RBAC prefix rules for `/api/dashboard-v2`.
- Removed obsolete dashboard-v2 validation scripts and active manifests.
- Removed stale `.next/dev/types` from frontend typecheck scope; typecheck now uses source plus `.next/types`.

## Tests

PASS:

- `npm run test:prephase7-cleanup`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run lint`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- `npm --prefix frontend run test:phase6-ui-responsive`
- `npm --prefix frontend run test:phase6-sidebar-rbac`
- `npm --prefix frontend run test:phase6-kpi-product-reconciliation`
- `npm --prefix frontend run test:phase6-functional-flows`
- `npm --prefix frontend run test:phase6-commercial-multitenant`
- `npm --prefix backend test`
- `node scripts/phase5-5/check-production-acceptance-contract.js`
- `npm run phase5:functional-closure`
- `git diff --check`

Note:

- Initial frontend typecheck failed only because `.next/dev/types` still referenced the removed `/dashboard-v2` page. The TypeScript include was corrected and typecheck passed.

## Gate

- DASHBOARD_CANONICAL_ONLY = PASS
- DASHBOARD_V2_ACTIVE_PRODUCT_CODE = 0
- DASHBOARD_V2_DEAD_COMPONENTS = 0
- DASHBOARD_V2_UNUSED_API = 0
- LEGACY_ROUTE_EXPOSED_CRITICAL = 0
- TEST_ONLY_ROUTE_EXPOSED_CRITICAL = 0
- RECHARTS_RUNTIME_WARNING_CRITICAL = 0
- UNUSED_PRODUCT_CODE_CRITICAL = 0
- BROKEN_NAVIGATION = 0
- RBAC_REGRESSION = 0
- PHASE6_REGRESSION = 0
- PHASE5_REGRESSION = 0
- ZERO_HARDCODE = PASS
- SELLABLE_MULTI_TENANT = PASS

## Remaining non-critical debt

- Historical dashboard-v2 mentions remain in old phase/cleanup history docs.
- `user_dashboard_preferences` remains in DB until a dedicated non-destructive DB retirement plan exists.
- `/ia`, `/documentos`, and `/ejecucion-iso` remain future scoped enterprise/product cleanup decisions.

## Decision

READY_FOR_INTERMEDIATE_MERGE_REVIEW

STOP.

Do not start Phase 7 automatically.
