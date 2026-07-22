# Fase 0 — Contracts check regression gate

## Objetivo

`phase0:contracts:check` controla regresiones contra una baseline decreciente de hallazgos contractuales. No cierra Fase 0 ni acepta permanentemente las brechas existentes.

## Baseline

La baseline versionada está en:

```text
config/phase0/contract-findings-baseline.json
```

Valores actuales:

- `maximumAllowedFindings`: 0
- `targetFindings`: 0
- `phaseStatus`: `closed`
- `previousBaseline`: 41
- `removedFindings`: 328

La baseline inicial de 328 no fue aceptada permanentemente. Se redujo primero a 41 al corregir el detector de middleware global y finalmente a 0 al asociar dependencias frontend con familias API reales, resolver rutas frontend-only y mapear cada capacidad productiva a un escenario E2E ejecutable.

## Estados del check

| Estado | Exit code | Significado |
|---|---:|---|
| `REGRESSION` | 1 | Los hallazgos actuales superan la baseline o aparece un hallazgo crítico nuevo. |
| `BASELINE_ACCEPTED` | 0 | Los hallazgos actuales son iguales a la baseline. Fase 0 sigue abierta. |
| `IMPROVED` | 0 | Los hallazgos actuales bajaron, pero aún son mayores a cero. Fase 0 sigue abierta. |
| `VERIFIED` | 0 | Los hallazgos actuales son cero. Solo entonces puede evaluarse cierre de este criterio. |

## Reglas

- No se usa `continue-on-error`.
- No se silencian errores.
- No se eliminan hallazgos.
- No se cambia severidad sin evidencia.
- Un hallazgo crítico nuevo falla siempre, incluso si el total no supera la baseline.
- El reporte detallado queda en `artifacts/fase-0/phase0-contracts-check.json`. La clasificación histórica queda en `artifacts/fase-0/finding-classification.json`.

## Uso

```bash
npm --prefix backend run phase0:inventory
npm --prefix backend run phase0:classify
npm --prefix backend run phase0:contracts:check
```
