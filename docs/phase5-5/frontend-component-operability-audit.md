# Frontend Component Operability Audit - Phase 5.5

Status: completed after real browser E2E.

| Component | Route | Entity | Create | Preview | Publish | Execute | History | Explanation/lineage | Permission/capability | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MetricBuilder | `/metricas` | metric_definition | `POST /api/metrics` | `POST /api/grc/official/analytics/:resultCode` | `POST /api/metrics/:id/publish` | `POST /api/metrics/:id/calculate` | `GET /api/metrics` | official calculation links | backend RBAC + `metrics.catalog/engine` | Playwright scenario 2 | operational |
| SurveyScoringBuilder | `/encuestas` | survey_definition | `POST /api/surveys` | official analytics | `POST /api/surveys/:id/publish` | `POST /api/survey-campaigns` | `GET /api/surveys` | scoring API | backend RBAC + `surveys.engine` | Playwright scenario 3 | operational |
| AssuranceScoringBuilder | `/tests` | assurance_test_definition | `POST /api/assurance-tests` | official analytics | review workflow | `POST /api/assurance-tests/:id/execute` | `GET /api/assurance-tests` | sample/score APIs | backend RBAC + `assurance.testing` | Playwright scenario 4 | operational |
| SampleSizeCalculator | `/tests` | assurance_test_definition | same endpoint | official analytics | review workflow | same endpoint | same endpoint | sample size API | backend RBAC + `assurance.testing` | package6 + browser page | operational |
| LossAnalyticsPanel | `/eventos-perdida` | loss_event | `POST /api/loss-events` | official analytics | confirm workflow | `POST /api/loss-events/:id/confirm` | `GET /api/loss-events` | loss APIs | backend RBAC + `loss.events` | Playwright scenario 5 | operational |
| DashboardBuilder | `/bi` | dashboard_definition/widget | `POST /api/dashboards` | official analytics | `POST /api/dashboards/:id/publish` | `POST /api/dashboards/:id/snapshot` | `GET /api/dashboards` | render/lineage via widget | backend RBAC + `bi.dashboard_builder` | Playwright scenario 6 | operational |
| ReportStudioWorkspace | `/reportes/studio` | report_definition/generation | `POST /api/reports` | official analytics | approval workflow | `POST /api/reports/:id/generate` | `GET /api/reports` | artifact metadata | backend RBAC + reporting capabilities | Playwright scenario 7 | operational |

Notes:

- `BuilderSurface` remains only presentational; it is not the implementation path for these routed builders.
- Duplicate assurance test ids were removed by adding per-instance `testId` support to `OperationalBuilder`.
- Metric and assurance payloads require a valid UUID from the authenticated token for owner/reviewer fields.
