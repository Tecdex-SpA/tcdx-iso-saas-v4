# Fase 1R - Plan de pruebas

## Gate local

`npm run phase1:check` ejecuta contratos, doble migración PostgreSQL 16, integración PostgreSQL, permisos, tenant, scripts, backend, frontend lint/type/build/test, discovery E2E, contrato de 30 casos y `git diff --check`. No ejecuta Fase 0.

La integración real cubre bootstrap/replay/reuso, flag deshabilitado, Tenant A/B, recurrencia, scheduler idempotente, escalamiento, exportación con bytes/hash, denegación cross-tenant y auditoría.

## Runtime

`npm run phase1:runtime-local` requiere servicios locales/QA aislados y las mismas variables que Playwright. No admite producción. El workflow manual valida el SHA, activa el módulo mediante el endpoint administrativo, ejecuta bootstrap, seed controlado, 30 casos Playwright, evidencia derivada y limpieza del manifest.

Artifacts: `phase1-runtime-summary.json`, `phase1-api-results.json`, `phase1-playwright-report/`, `phase1-export-validation.json`, `phase1-tenant-isolation.json`, `phase1-observability.txt`, `phase1-scheduler-results.json` y `phase1-closeout-evidence.md`.

La discovery local no sustituye ejecución real. El estado runtime seguirá `blocked_external` hasta que los 30 casos pasen contra el SHA desplegado.
