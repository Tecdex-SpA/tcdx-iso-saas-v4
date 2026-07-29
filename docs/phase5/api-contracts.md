# Fase 5 — API contracts

Datos:

- `GET /api/data/domains`
- `POST /api/data/domains`
- `GET /api/data/elements`
- `POST /api/data/elements`
- `GET /api/data/elements/:id`
- `PUT /api/data/elements/:id`
- `GET /api/data/quality`
- `POST /api/data/quality/assess`
- `GET /api/data/lineage/:entityType/:entityId`
- `GET /api/data/impact/:entityType/:entityId`

Métricas:

- `GET /api/metrics`
- `POST /api/metrics`
- `GET /api/metrics/:id`
- `PUT /api/metrics/:id`
- `POST /api/metrics/:id/formulas`
- `POST /api/metrics/:id/publish`
- `GET /api/metrics/:id/measurements`
- `POST /api/metrics/:id/measurements`
- `POST /api/metrics/:id/calculate`
- `POST /api/metrics/:id/recalculate`
- `POST /api/metrics/measurements/:measurementId/validate`
- `GET /api/metrics/:id/trend`
- `GET /api/metrics/:id/trust`

Encuestas:

- `GET /api/surveys`
- `POST /api/surveys`
- `GET /api/surveys/:id`
- `PUT /api/surveys/:id`
- `POST /api/surveys/:id/versions`
- `POST /api/surveys/:id/publish`
- `POST /api/survey-campaigns`
- `GET /api/survey-campaigns`
- `GET /api/survey-campaigns/:id`
- `POST /api/survey-campaigns/:id/launch`
- `POST /api/survey-campaigns/:id/close`
- `POST /api/survey-responses`
- `POST /api/survey-responses/:id/submit`
- `POST /api/survey-responses/:id/evaluate`
- `POST /api/survey-responses/:id/approve`

Tests, pérdidas, BI y reporting:

- `GET /api/assurance-tests`
- `POST /api/assurance-tests`
- `POST /api/assurance-tests/:id/execute`
- `POST /api/assurance-tests/executions/:executionId/complete`
- `POST /api/assurance-tests/executions/:executionId/review`
- `GET /api/loss-events`
- `POST /api/loss-events`
- `GET /api/loss-events/:id`
- `PUT /api/loss-events/:id`
- `POST /api/loss-events/:id/confirm`
- `POST /api/loss-events/:id/recoveries`
- `POST /api/loss-events/:id/close`
- `GET /api/dashboards`
- `POST /api/dashboards`
- `GET /api/dashboards/:id`
- `PUT /api/dashboards/:id`
- `POST /api/dashboards/:id/publish`
- `POST /api/dashboards/:id/snapshot`
- `GET /api/dashboards/:id/render`
- `GET /api/reports`
- `POST /api/reports`
- `GET /api/reports/:id`
- `PUT /api/reports/:id`
- `POST /api/reports/:id/generate`
- `GET /api/report-generations`
- `GET /api/report-generations/:id`
- `GET /api/report-generations/:id/download`
- `POST /api/report-generations/:id/approve`
- `POST /api/report-schedules`
- `PUT /api/report-schedules/:id`
- `POST /api/report-schedules/:id/pause`
- `POST /api/report-schedules/:id/resume`
