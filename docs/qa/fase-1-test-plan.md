# Fase 1R - Plan de pruebas

## Gate local

`npm run phase1:check` ejecuta contratos, doble migración PostgreSQL 16, integración PostgreSQL, permisos, tenant, scripts, backend, frontend lint/type/build/test, discovery E2E, contrato de 30 casos y `git diff --check`. No ejecuta Fase 0.

La integración real cubre bootstrap/replay/reuso, flag deshabilitado, Tenant A/B, recurrencia, scheduler idempotente, escalamiento, exportación con bytes/hash, denegación cross-tenant y auditoría.

## Runtime

`npm run phase1:runtime-local` requiere servicios locales/QA aislados y no admite producción. El cierre oficial se inicia en el Mac con `npm run phase1:closeout` después de `./scripts/deploy-vms.sh`; el runner valida el SHA y ejecuta en `bk-v4`.

La suite crítica exige exactamente 13 casos antes de habilitar la completa. La suite final exige exactamente 30 casos, un intento por test, cero retry, cero skip y cero `did-not-run`.

Artifacts: `phase1-runtime-summary.json`, `phase1-api-results.json`, `phase1-playwright-report/`, `phase1-export-validation.json`, `phase1-tenant-isolation.json`, `phase1-observability.txt`, `phase1-scheduler-results.json` y `phase1-closeout-evidence.md`.

La discovery local no sustituye ejecución real. El resultado válido queda fuera del worktree en `/tmp/tcdx-phase1-evidence/<run_id>` después de limpiar el manifest y verificar los triggers.
