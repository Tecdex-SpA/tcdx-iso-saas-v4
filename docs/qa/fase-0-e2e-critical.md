# Fase 0 — E2E crítico

## Alcance

La suite `frontend/tests/e2e/phase0-critical.spec.ts` usa Playwright/Chromium y cubre login válido e inválido, persistencia y expiración de sesión, ruta privada sin sesión, permiso positivo y negativo, aislamiento Tenant A/B, archivos cross-tenant, reportes y las 40 rutas registradas en el catálogo.

El manifiesto `config/phase0/e2e-capability-coverage.json` relaciona cada capacidad productiva con un escenario ejecutable. `scripts/phase0/check-e2e-contract.js` falla si falta una capacidad, archivo o escenario.

## Arquitectura de validación

La validación está separada en dos gates que no se sustituyen entre sí:

1. `.github/workflows/ci.yml` es bloqueante para pull requests. Instala dependencias, ejecuta los controles locales y usa `npx playwright test --list --reporter=line` para verificar que Playwright descubre la suite sin conectarse a QA.
2. `.github/workflows/phase0-runtime-qa.yml` se ejecuta manualmente con `workflow_dispatch` después del merge y de `./scripts/deploy-vms.sh`. Usa el Environment `qa` restringido a `main`, exige el SHA completo desplegado y ejecuta `npm run phase0:vm-check` contra la infraestructura real.

El discovery de PR no usa URLs, credenciales ficticias, mocks ni servicios locales. La validación de variables se ejecuta al comenzar el runtime real, antes de crear sesiones o requests.

## Secrets obligatorios del Environment qa

`phase0-runtime-qa.yml` lee exclusivamente GitHub Environment secrets o repository secrets:

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
E2E_TENANT_A_JOB_PATH
E2E_TENANT_B_JOB_PATH
```

Los usuarios y recursos deben ser fixtures QA sintéticos. No se aceptan usuarios productivos, secretos versionados ni IDs inventados que solo produzcan 404. El workflow falla e informa únicamente los nombres ausentes; nunca imprime sus valores.

## Ejecución

Validación local o de PR:

```bash
npm run phase0:e2e-contract
cd frontend
npx playwright test --list --reporter=line
cd ..
```

Después de merge y deploy, desde un checkout de `main` actualizado:

```bash
DEPLOYED_SHA="$(git rev-parse HEAD)"
./scripts/deploy-vms.sh
gh workflow run phase0-runtime-qa.yml --ref main -f deployed_sha="$DEPLOYED_SHA"
gh run watch
```

El workflow solo acepta ejecuciones despachadas desde `main` y comprueba que `deployed_sha`, `github.sha` y el checkout sean idénticos. El Environment `qa` debe limitar despliegues a `main` y exigir revisores. La evidencia se publica incluso cuando las pruebas fallan:

- `artifacts/fase-0/e2e-results.json`
- `artifacts/fase-0/cross-tenant-*.json`
- `artifacts/fase-0/cross-tenant-results.json`
- `artifacts/fase-0/observability-runtime.json`
- `frontend/test-results/`
- `frontend/playwright-report/`

Fase 0 permanece abierta hasta que runtime QA y restore QA terminen correctamente.
