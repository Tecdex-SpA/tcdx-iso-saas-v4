# RBAC-01 Reporting Consolidation Analysis

Status: `COMPLETE_LOCAL`

## Focal Routes

| Route | Current meaning | Classification |
|---|---|---|
| `/exportes` | User-facing report generation/download/history for premium executive exports via `/api/reports/*`. | Distinct reporting subflow: `Reportes > Exportes`. |
| `/bi` | Dashboard/analytics cockpit over `/api/dashboards`, with builder behavior for admin/platform users. | Distinct analytics subflow under reporting/data analytics. |
| `/reportes/studio` | Definition/template workspace over report APIs. | Distinct reporting subflow: `Reportes > Diseñador`. |
| `/reportes/generaciones` | Generation history over `/api/report-generations`. | Distinct reporting subflow: `Reportes > Generaciones`. |

## Recommendation

Keep all routes and APIs for RBAC-01. Do not delete routes or merge backend APIs in this package.

Target information architecture:

```text
Reportes
  - Exportes
  - Datos y Analítica
  - Diseñador de reportes
  - Generaciones
```

Future consolidation can group these under one user-facing `Reportes` domain while preserving deep links and endpoint ownership.

