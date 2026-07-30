# Endpoint Consumer Verification - Phase 5.5

Status: completed.

| Endpoint | Method | Consumer | User action | Request validation | Response validation | Test | Status |
|---|---|---|---|---|---|---|---|
| `/api/grc/overview` | GET | Portal GRC | load portal | tenant header + token | 200 overview blocks | browser E2E scenario 1 | consumed |
| `/api/grc/official/analytics/catalog` | GET | OperationalBuilder | load builder | tenant context | catalog options | package6 + browser E2E | consumed |
| `/api/grc/official/analytics/:resultCode` | POST | OperationalBuilder | preview | period/result code | value/status/formula/trust | browser E2E scenarios 2-7 | consumed |
| `/api/metrics` | POST/GET | MetricBuilder | save/list | metric payload + owner UUID | persisted id/history | browser E2E scenario 2 | consumed |
| `/api/metrics/:id/formulas` | POST | MetricBuilder | save formula | declarative expression | persisted formula version | browser E2E scenario 2 | consumed |
| `/api/metrics/:id/publish` | POST | MetricBuilder | publish | persisted id | published metric | browser E2E scenario 2 | consumed |
| `/api/metrics/:id/calculate` | POST | MetricBuilder | execute | period/input/unit | measurement output | browser E2E scenario 2 | consumed |
| `/api/surveys` | POST/GET | SurveyScoringBuilder | save/list | survey payload | persisted survey | browser E2E scenario 3 | consumed |
| `/api/surveys/:id/versions` | POST | SurveyScoringBuilder | create version | `question_type=number` | version rows | browser E2E scenario 3 | consumed |
| `/api/survey-campaigns` | POST | SurveyScoringBuilder | execute campaign | survey id/population | campaign id | browser E2E scenario 3 | consumed |
| `/api/assurance-tests` | POST/GET | AssuranceScoringBuilder | save/list | owner/reviewer UUID | persisted test | browser E2E scenario 4 | consumed |
| `/api/assurance-tests/:id/execute` | POST | AssuranceScoringBuilder | execute | execution code/sample | execution id | browser E2E scenario 4 | consumed |
| `/api/loss-events` | POST/GET | LossAnalyticsPanel | save/list | gross/recovery/net rule | persisted event | browser E2E scenario 5 | consumed |
| `/api/loss-events/:id/confirm` | POST | LossAnalyticsPanel | confirm | persisted id | confirmed event | browser E2E scenario 5 | consumed |
| `/api/dashboards` | POST/GET | DashboardBuilder | save/list | `dashboard_type=custom`, widget source type valid | dashboard id | browser E2E scenario 6 | consumed |
| `/api/dashboards/:id/publish` | POST | DashboardBuilder | publish | persisted id | published status | browser E2E scenario 6 | consumed |
| `/api/dashboards/:id/snapshot` | POST | DashboardBuilder | snapshot | published dashboard | snapshot id | browser E2E scenario 6 | consumed |
| `/api/reports` | POST/GET | Report Studio | save/list | `report_type=custom` | report id | browser E2E scenario 7 | consumed |
| `/api/reports/:id/generate` | POST | Report Studio | generate | format/result/period | generation id | browser E2E scenario 7 | consumed |
| `/api/report-generations/:id/approve` | POST | Report Studio | approve | generation id/status | approved generation | browser E2E scenario 7 | consumed |
| `/api/report-generations/:id/download` | GET | Report Studio | download | authorized generation | PDF/DOCX/XLSX bytes | browser E2E scenario 7 | consumed |

Technical endpoints without direct routed UI: formula registry bootstrap and package validation scripts. They are operational tooling, not end-user surfaces.
