# Phase 6.4 Hotfix - Official vs Admin Recalculate Trace

| SURFACE | BUTTON | FRONTEND_HANDLER | ENDPOINT | BACKEND_CONTROLLER | SERVICE/ENGINE | DATA_UNIVERSE | COUNTER_SOURCE | PERSISTS_TO | REFRESH_SOURCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard KPI | Recalcular indicadores oficiales | `handleRecalculateKpis` in `frontend/src/app/dashboard/page.tsx` | `POST /api/metrics/official/dashboard/recalculate` | `backend/src/routes/phase5.routes.js` `indicatorService.recalculateCatalog(scope, body, requestId)` | `indicatorGovernance.service.js` -> `calculateIndicator` -> official analytics orchestrator | Official governed metrics | `body.data.recalculated`, `body.data.failed`, `body.data.snapshots_created`, `body.data.results[].result.measurement.official_state` | `metric_measurements`, `metric_snapshots`, `calculation_runs` through the official Phase 5 pipeline | `GET /api/metrics/official/dashboard` |
| Administrar KPI | Recalcular KPI administrativos | `recalculateKpis` in `frontend/src/app/administrar-kpis/page.tsx` | `POST /api/kpis/recalculate/:tenantId` | `backend/src/controllers/kpi.controller.js` `recalculateTenantKpis` | `backend/src/services/kpi.engine.js` `calculateAllKPIs` plus administrative Health refresh | Admin configurable KPI | top-level `snapshots_created`, top-level `health_recalculated` or `health_kpi_refresh[]` | `kpi_snapshots` and administrative health-derived records | `/api/kpis/admin/:tenantId` plus administrative Health summary |

## Root Cause

Admin returned a flat JSON response and the Admin page parsed it correctly, so the observed administrative alert could show `8/6`.

Official returned the governed Phase 5 response wrapped as `{ ok, data, request_id }`, but the Dashboard read `json.snapshots_created ?? json.recalculated ?? 0` at the top level and hardcoded `healthRecalculated = 0`. The endpoint executed correctly, but the frontend converted real official counters under `data` into an artificial `0/0` and reused Admin/Health wording.

## Runtime Confirmation

`official-recalculate-runtime.json` captured a real deployed official run:

- HTTP 200.
- `wrapper_keys`: `ok`, `data`, `request_id`.
- `data_keys`: `recalculated`, `failed`, `snapshots_created`, `snapshots_failed`, `results`.
- Official response: `recalculated=22`, `failed=0`, `snapshots_created=22`, `results_count=22`.
- Official states: `calculated=6`, `insufficient_data=15`, `dependency_pending=1`.

No Admin KPI endpoint or value was used by the official recalculate flow.
