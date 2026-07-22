# Fase 0 — Closeout

## Estado

FASE 0 IMPLEMENTADA SIN DEUDA INTERNA — PENDIENTE SOLO VALIDACIÓN EXTERNA EN VM

## Línea base contractual

- Hallazgos originales: 328.
- Hallazgos removidos con evidencia: 328.
- Hallazgos actuales: 0.
- Baseline máxima: 0.
- Críticos nuevos: 0.
- Gate: `VERIFIED`.
- Phase status contractual: `CLOSED`.

## Cierre interno

- Las 35 capacidades visibles quedaron asociadas a contratos API reales y escenarios E2E.
- Las cinco capacidades productivas sin E2E quedaron incluidas en la suite Playwright.
- La asociación faltante se resolvió mediante análisis de imports y familias API.
- Existe suite Playwright de 45 tests y discovery bloqueante en CI de PR.
- Existen validadores dinámicos bidireccionales para tenant, archivos, búsqueda, exportes, IA y jobs.
- Existen `/live`, `/ready`, `/health` y `/metrics`, con logs JSON sanitizados.
- Existe restore QA seguro con checksum y medición de RPO/RTO.
- `npm run phase0:full-check` pasa.

## Gates de cierre

| Gate | Momento | Alcance | Requisito |
|---|---|---|---|
| CI de PR | Antes del merge | Código, contratos, permisos, scripts, backend, frontend y discovery Playwright | Bloqueante y sin infraestructura QA |
| Runtime QA | Después de merge y deploy | E2E, aislamiento tenant, archivos, búsqueda, exportes, IA, jobs y observabilidad | Workflow manual, Environment `qa`, SHA desplegado |
| Restore QA | Después de runtime QA | Backup, restore aislado, smoke, RPO y RTO | Ejecución explícita protegida |

`.github/workflows/ci.yml` no ejecuta `phase0:vm-check`. El runtime está en `.github/workflows/phase0-runtime-qa.yml` y solo puede iniciarse manualmente con el SHA ya desplegado. Esta separación corrige el contexto de ejecución; no elimina, omite ni debilita ningún control.

## Validación externa requerida

Fase 0 no se cierra hasta que `phase0-runtime-qa.yml` y `npm run phase0:restore-check` produzcan evidencia satisfactoria para el mismo SHA desplegado. Solo entonces el ledger puede cambiar a `verified_vm` y habilitar Fase 1.
