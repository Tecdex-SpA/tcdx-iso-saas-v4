# Fase 0 — E2E crítico

## Alcance

La suite `frontend/tests/e2e/phase0-critical.spec.ts` usa Playwright/Chromium y cubre login válido e inválido, persistencia y expiración de sesión, ruta privada sin sesión, permiso positivo y negativo, aislamiento Tenant A/B, archivos cross-tenant, reportes y las 40 rutas registradas en el catálogo.

El manifiesto `config/phase0/e2e-capability-coverage.json` relaciona cada capacidad productiva con un escenario ejecutable. `scripts/phase0/check-e2e-contract.js` falla si falta una capacidad, archivo o escenario.

## Variables obligatorias

```text
WEB_BASE_URL
API_BASE_URL
E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
E2E_RESTRICTED_EMAIL
E2E_RESTRICTED_PASSWORD
E2E_RESTRICTED_API_PATH
E2E_TENANT_A_EMAIL
E2E_TENANT_A_PASSWORD
E2E_TENANT_A_ID
E2E_TENANT_B_EMAIL
E2E_TENANT_B_PASSWORD
E2E_TENANT_B_ID
E2E_TENANT_A_FILE_PATH
E2E_TENANT_B_FILE_PATH
```

Los usuarios y recursos deben ser fixtures QA sintéticos. No se aceptan usuarios productivos, secretos versionados ni IDs inventados que solo produzcan 404.

## Ejecución

```bash
npm run phase0:e2e-contract
npm run phase0:e2e
```

La evidencia queda en `artifacts/fase-0/e2e-results.json`. Cualquier test omitido, variable ausente, error de consola, HTTP 5xx o fuga tenant produce exit code 1.
