# Cobertura Sprint 1 tenant scope path-aware

Fecha: 2026-06-10

## Objetivo

Documentar la cobertura agregada al middleware central `backend/src/middleware/tenantScope.middleware.js` para bloquear accesos cross-tenant cuando un usuario tenant normal intenta usar `tenant_id`, `tenantId`, `company_id` o equivalentes de otro tenant en path, query o body.

Platform/superadmin conserva bypass central. Dealer conserva bypass central porque su autorizacion depende de asignaciones comerciales que no viajan en el JWT y se valida en rutas especificas.

## Cobertura central agregada

El middleware ahora combina hints de tenant desde:

- Path conocido.
- `req.params.tenant_id`, `req.params.tenantId`, `req.params.company_id`, `req.params.companyId` cuando el middleware se use a nivel de ruta.
- Query: `tenant_id`, `tenantId`, `company_id`, `companyId`, `context_tenant_id`, `filters.tenant_id`.
- Body: `tenant_id`, `tenantId`, `company_id`, `companyId`, `context.tenant_id`, `payload.tenant_id`, `filters.tenant_id`, `tenant.id`.

Si cualquier hint no coincide con el tenant del JWT para usuarios tenant normales, responde:

```json
{
  "ok": false,
  "code": "TENANT_SCOPE_MISMATCH"
}
```

## Endpoints path-aware cubiertos

- Dashboard: `/api/dashboard/:tenant_id`
- Dashboard controls: `/api/dashboard-controls/:tenant_id`
- Controles: `/api/controls/:tenant_id`, `/api/controls/workbench/:tenant_id/:iso`, `/api/controls/catalog/:tenant_id/:iso`, `/api/controls/catalog-mode/:tenant_id/:iso`
- Riesgos: `/api/iso-risk-matrix/:tenantId/*`
- Evidencias: `/api/evidences/:tenant_id`, `/api/evidences/jobs/:tenant_id`
- Auditorias: `/api/audits/:tenant_id`, `/api/audits/summary/:tenant_id`, `/api/audits/next/:tenant_id`, `/api/audits/next-all/:tenant_id`
- Hallazgos: `/api/findings/:tenant_id`, `/api/findings/controls/:tenant_id`
- No conformidades: `/api/nonconformities/:tenant_id`
- Planes de accion: `/api/action-plans/:tenant_id`
- IA Auditor: `/api/ai-auditor/runs/:tenant_id`
- Activos: `/api/assets/:tenant_id`, `/api/assets/risk-summary/:tenant_id`
- Tenant standards: `/api/tenant-standards/:tenant_id`, `/api/tenant-standards/operations/:tenant_id`, `/api/tenant-standards/scope/:tenant_id`
- Politica/SoA: `/api/policy/:tenant_id/:iso`, `/api/soa/:tenant_id`
- KPI: `/api/kpi|kpis/(recalculate|dashboard|effective-health-summary|catalog|admin)/:tenantId`
- Busqueda: `/api/search/global/:tenantId`, `/api/search/history/:tenantId`
- Archivos tenant: `/api/files/tenant/:tenantId/*`
- Billing preinvoice: `/api/billing/preinvoice/:tenant_id`
- Lifecycle: `/api/lifecycle/(rebuild|board|summary|insights|ai-context|ai-feed|history)/:tenant_id`

## Endpoints cubiertos por query/body

Los siguientes modulos quedan cubiertos por hints query/body cuando usan `tenant_id` o equivalentes:

- Reportes y exportes.
- Document integrations bajo `/api/document-integrations`.
- IA Compliance.
- IA Auditor scope/history/report/analyze.
- Health bajo `/api/health`.
- Assets, findings, nonconformities, action plans, audits y evidences para operaciones que reciben tenant en body/query.

## Pendientes y brechas

- Rutas Google/Zoho montadas antes del middleware global dependen de validaciones internas por ruta porque incluyen callbacks OAuth publicos. No se cambio el orden para no romper OAuth.
- Operaciones por ID de entidad, por ejemplo `PUT /api/findings/:id`, `DELETE /api/action-plans/:id` o descargas por ID, siguen necesitando validacion por lookup de entidad y `tenant_id` en la ruta especifica. El middleware central no puede inferir tenant desde un ID opaco sin consultar DB.
- Dealer requiere matriz de asignaciones tenant-dealer y pruebas especificas. El bypass central se mantiene para no romper prefacturacion/reportes autorizados.
- La defensa DB sigue pendiente de la decision ADR; backend middleware no reemplaza RLS, roles minimos o vistas seguras.

## QA relacionado

Suite agregada:

```bash
bash scripts/qa-cross-tenant-core.sh
```

Variables obligatorias:

```bash
API_BASE_URL=
TENANT_A_ID=
TENANT_B_ID=
TENANT_A_TOKEN=
TENANT_B_TOKEN=
```

Variables opcionales:

```bash
PLATFORM_TOKEN=
RUN_WRITE_CHECKS=true
REPORT_EXPORT_ID=
EVIDENCE_ID=
```
