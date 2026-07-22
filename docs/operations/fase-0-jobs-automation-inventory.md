# Fase 0 — Jobs y automatizaciones

## Fuente inicial

- `backend/src/services/asyncJob.service.js`
- `backend/src/services/operationalRiskAiJobs.service.js`
- `backend/src/workers/evidence-ai.worker.js`
- `scripts/` y `deploy/wrappers/`

## Estado

`in_progress`

## Brecha bloqueante

El inventario todavía no contiene para cada job: trigger, frecuencia, idempotencia, reintentos, timeout, dead-letter, métrica, alerta y auditoría. No se declara cierre.
