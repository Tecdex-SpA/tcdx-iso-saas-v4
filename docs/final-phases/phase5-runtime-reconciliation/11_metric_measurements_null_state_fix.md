# Fix metric_measurements para estados oficiales sin valor

Fecha: 2026-08-10

Estado: `READY_FOR_VALIDATION`

## Evidencia productiva

La validacion runtime de Fase 5 contra `https://tcdx-iso.tecdex.net` detecto el bloqueo P0:

- `/api/metrics/official/dashboard/recalculate` devolvia `0 recalculated / 22 failed`.
- PostgreSQL devolvia SQLSTATE `23514`.
- La constraint fallida era `metric_measurements_check1`.
- El catalogo oficial existia, pero los indicadores quedaban sin mediciones oficiales persistidas.

La tabla productiva conservaba estos contratos simultaneamente:

```text
metric_measurements_check1
CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)

metric_measurements_official_value_contract
CHECK (
  official_state IS NULL
  OR official_state = 'calculated' AND value_numeric IS NOT NULL
  OR official_state <> 'calculated'
     AND value_numeric IS NULL
     AND value_text IS NULL
)
```

## Causa raiz

El modelo inicial de Fase 5 asumio que toda medicion siempre llevaba `value_numeric` o `value_text`.

El modelo oficial C3 cambio correctamente el contrato:

- legacy measurement: `official_state IS NULL` requiere valor;
- official calculated: `official_state = calculated` requiere `value_numeric`;
- official non-calculated: `official_state <> calculated` requiere `value_numeric = NULL` y `value_text = NULL`.

La constraint legacy `metric_measurements_check1` contradice el tercer caso. Por eso un estado funcional valido como `source_unavailable` no podia persistirse sin fabricar un cero o un texto placeholder.

## Solucion

Se agrega la migracion aditiva:

```text
database/migrations/20260810_phase5_official_measurement_null_states.sql
```

La migracion:

- elimina solo `metric_measurements_check1`;
- conserva `metric_measurements_legacy_or_official_value_check`;
- conserva `metric_measurements_official_value_contract`;
- conserva `metric_measurements_official_state_check`;
- conserva `metric_measurements_coverage_ratio_check`;
- no toca datos existentes;
- no cambia tipos;
- no cambia nullability;
- no usa `CASCADE`;
- no crea valores falsos.

El runner oficial:

```text
scripts/phase5/apply-phase5-migration.js
```

registra la nueva migracion como ultima entrada y verifica como postcondicion que:

- `metric_measurements_check1` no exista cuando el contrato C3 esta presente;
- todos los contratos oficiales sigan existiendo.

## Compatibilidad

La compatibilidad queda asi:

| Caso | Resultado esperado |
|---|---|
| `official_state IS NULL` y `value_numeric/value_text NULL` | rechazado |
| `official_state IS NULL` con valor | aceptado |
| `official_state = calculated` con `value_numeric` | aceptado |
| `official_state = calculated` sin valor | rechazado |
| `official_state <> calculated` sin valor | aceptado |
| `official_state <> calculated` con valor | rechazado |
| `coverage_ratio` entre `0` y `1` | aceptado |
| `coverage_ratio > 1` | rechazado |
| `period_end <= period_start` | rechazado |

## Writer oficial

El writer oficial permanece semantico:

```text
calculated -> value_numeric = Number(value), value_text = NULL
non-calculated -> value_numeric = NULL, value_text = NULL
```

No se introducen ceros artificiales ni textos como `N/A`, `unmeasured` o placeholders.

## Writer legacy

El writer legacy de `backend/src/services/phase5/phase5.service.js` conserva `official_state IS NULL` y sigue escribiendo `value_numeric` o `value_text`. La eliminacion de `metric_measurements_check1` no permite legacy vacio porque `metric_measurements_legacy_or_official_value_check` conserva el contrato historico.

## Evidencia tests

La regresion PostgreSQL en:

```text
scripts/phase5-c3/check-phase5-c3-postgres.sh
```

reproduce el estado productivo agregando `metric_measurements_check1`, ejecuta el runner oficial y valida:

- calculated zero;
- `source_unavailable` con `NULL/NULL`;
- `unmeasured` con `NULL/NULL`;
- `insufficient_data` con `NULL/NULL`;
- rechazo de non-calculated con valor;
- rechazo de calculated sin valor;
- rechazo de legacy sin valor;
- legacy con valor;
- boundaries de `coverage_ratio`;
- rechazo de periodo invalido;
- idempotencia y ledger.

## Validacion runtime post-deploy

Despues del deploy oficial, el operador debe validar:

1. Calcular un indicador con datos y verificar medicion persistida.
2. Calcular un indicador sin datos suficientes y verificar estado oficial persistido con `value_numeric = NULL` y `value_text = NULL`.
3. Recalcular el catalogo de 22 indicadores y confirmar que no existen fallos tecnicos de persistencia.
4. Crear/publicar snapshots segun flujo oficial.
5. Verificar que Metricas, Dashboard, BI, Report y Export muestran estados y valores consistentes.

No se ejecuto deploy desde Codex.
