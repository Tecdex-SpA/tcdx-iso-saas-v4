# RBAC-01 Route Capability Matrix

Status: `COMPLETE_LOCAL`

Focal route audit:

| Route | Current frontend purpose | Endpoints observed | Current conceptual capability |
|---|---|---|---|
| `/exportes` | Premium report generation, download and history. | `/api/reports/types`, `/api/reports/clients`, `/api/reports/standards`, `/api/reports/exports`, `/api/reports/generate/start`, `/api/reports/generate`, `/api/reports/jobs/:id`, `/api/reports/jobs/:id/result`, `/api/reports/download/:id`. | `reports.read`, `reports.generate`, `reports.download`. |
| `/bi` | Executive BI cockpit over official results and dashboard builder for admin/platform roles. | `/api/dashboards`. | `reports.read`, future `reports.manage` or `dashboards.manage`. |
| `/reportes/studio` | Report definition/template workspace. | `/api/reports` through `Phase5Workspace`. | `reports.read`, `reports.manage`. Product name should become Report Designer/Constructor if implementation is truly a builder. |
| `/reportes/generaciones` | Report generation history. | `/api/report-generations` through `Phase5Workspace`; also shows calculation run history. | `reports.read`, `reports.download` if artifacts are exposed. |

Backend route authority:

- `/api/reports` has local report permission handling in `backend/src/middleware/rbac.middleware.js`.
- Report permissions are currently inferred as `read`, `download`, `generate` or `admin`.
- `/api/report-generations` and `/api/report-schedules` are handled by global RBAC prefix rules.
- GRC exports use `grc.export.generate` on `/api/grc/exports/:domain`.

RBAC-01 decision:

- Treat `/exportes`, `/bi`, `/reportes/studio` and `/reportes/generaciones` as distinct reporting subflows for now.
- Normalize user-facing IA under `Reportes`: Exportes, Datos y Analítica, Diseñador de reportes, Generaciones.
- Preserve routes and backend APIs in RBAC-01.
