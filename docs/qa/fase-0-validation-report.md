# Fase 0 — Validation report

## Estado

FASE 0 NO CERRADA

## Ciclo

- Fecha UTC: 2026-07-22T17:10:52Z
- Rama: `codex/fase-0-verdad-operacional-linea-base`
- SHA: `29d2247d1555dd1c858b2a5b5406cc42dd5f16d4`

## Validaciones ejecutadas

Ver:

- `docs/qa/fase-0-baseline.md`
- `artifacts/fase-0/baseline/results.csv`
- `artifacts/fase-0/final/phase0-rerun-results.csv`

## Check Fase 0

`npm --prefix backend run phase0:inventory`: OK.  
`npm --prefix backend run phase0:contracts:check`: FAILED con 328 hallazgos bloqueantes.

Evidencia: `artifacts/fase-0/phase0-contracts-check.json`.

## Resumen estático

- Rutas inventariadas: 40
- Endpoints backend detectados: 497
- Capacidades sin endpoint asociado por heurística: 31
- Endpoints sin señal auth cercana: 176
- Endpoints sin señal tenant/data-scope cercana: 111

## Motivo de no cierre

No existen E2E Playwright críticos, no hay validación cross-tenant dinámica, el check de contratos falla, no se verificó observabilidad completa y no se ejecutó restore aislado con RPO/RTO medidos.
