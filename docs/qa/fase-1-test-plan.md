# Fase 1 - Plan de pruebas

## Gate local bloqueante

```bash
npm run phase1:check
```

Incluye únicamente Fase 1 y checks generales necesarios: contratos, PostgreSQL efímero/doble migración, permisos, tenant, sintaxis de scripts, backend check/tests, frontend lint/check/build, discovery Playwright y `git diff --check`. No reejecuta inventario, restore, observabilidad ni suites históricas de Fase 0.

Pruebas unitarias/integración cubren modos múltiples de aprobación, secuencia/quorum/unanimidad, autoridad del permiso, scheduler primera ejecución/reejecución/fallo parcial/retry/backoff/concurrencia/Tenant A-B, etapas de escalamiento, revisión independiente/versionada, cuatro formatos de export, seis adaptadores, feature flag, tenant y observabilidad.

## Runtime QA post-deploy

```bash
WEB_BASE_URL=https://qa.example API_BASE_URL=https://qa.example \
E2E_ADMIN_EMAIL='<secret>' E2E_ADMIN_PASSWORD='<secret>' \
E2E_RESTRICTED_EMAIL='<secret>' E2E_RESTRICTED_PASSWORD='<secret>' \
E2E_REVIEWER_EMAIL='<secret>' E2E_REVIEWER_PASSWORD='<secret>' E2E_AUDIT_ID='<uuid>' \
E2E_TENANT_A_EMAIL='<secret>' E2E_TENANT_A_PASSWORD='<secret>' E2E_TENANT_A_ID='<uuid>' \
E2E_TENANT_B_EMAIL='<secret>' E2E_TENANT_B_PASSWORD='<secret>' E2E_TENANT_B_ID='<uuid>' \
npm run phase1:runtime-check
```

`.github/workflows/phase1-runtime-qa.yml` solo admite `workflow_dispatch` desde `main`, exige Environment `qa`, SHA desplegado igual al checkout y todas las variables. No despliega ni se ejecuta desde PR.

## E2E

Discovery local: 21 pruebas. Cobertura runtime: flag habilitado/deshabilitado y URL bloqueada, permiso denegado, workflow/version/precondición, quorum y rechazo, evidencia recurrente, readiness, nueve frameworks, plan/workspace, Tenant A/B, scheduler/escalamiento, revisión supervisora, exportación, observabilidad y las cinco vistas consolidadas sin 500/console errors.

## Evidencia

- `artifacts/fase-1/phase1-contracts-check.json`
- `artifacts/fase-1/phase1-migration-check.json`
- `artifacts/fase-1/phase1-permissions-check.json`
- `artifacts/fase-1/phase1-tenant-check.json`
- `artifacts/fase-1/e2e-results.json`
- `frontend/test-results/`
- `frontend/playwright-report-phase1/`

Runtime permanece `blocked_external` hasta ejecutar la suite contra el SHA desplegado.
