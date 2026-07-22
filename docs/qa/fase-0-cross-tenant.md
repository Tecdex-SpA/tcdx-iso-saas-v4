# Fase 0 — Validación cross-tenant

## Cobertura

`scripts/phase0/check-tenant-isolation.js` ejecuta ambas direcciones A→B y B→A para lectura, listado, escritura, edición, eliminación, relaciones, búsqueda, archivos, exportaciones, IA y jobs. Los requests usan usuarios QA reales y esperan 403 o 404 sin retornar datos del tenant opuesto.

## Fixtures

Además de las variables E2E base, se requieren:

```text
E2E_TENANT_A_FILE_PATH
E2E_TENANT_B_FILE_PATH
E2E_TENANT_A_JOB_PATH
E2E_TENANT_B_JOB_PATH
```

Cada path debe apuntar a un recurso sintético existente del tenant indicado. Un ID inexistente no constituye evidencia de aislamiento.

## Comandos

```bash
node scripts/phase0/check-tenant-isolation.js
node scripts/phase0/check-file-isolation.js
node scripts/phase0/check-search-isolation.js
node scripts/phase0/check-export-isolation.js
node scripts/phase0/check-ai-isolation.js
node scripts/phase0/check-job-isolation.js
```

El consolidado queda en `artifacts/fase-0/cross-tenant-results.json`. Cada script es idempotente: las mutaciones usan payloads de denegación y deben ser rechazadas por el guard antes de persistir.
