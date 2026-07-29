# Fase 5 — Motor de métricas

El motor implementado usa `tcdx_metric_dsl_v1`, un DSL JSON declarativo.

Operadores permitidos:

`literal`, `input`, `add`, `subtract`, `multiply`, `divide`, `ratio`, `percentage`, `count`, `count_distinct`, `sum`, `average`, `min`, `max`, `latest`, `coalesce`, `conditional`, `unmeasured`.

Filtros permitidos:

`equals`, `not_equals`, `in`, `not_in`, `greater_than`, `greater_or_equal`, `less_than`, `less_or_equal`, `is_null`, `is_not_null`, `between`, `date_range`.

Controles:

- `divide` rechaza división por cero.
- `ratio` y `percentage` devuelven `null` ante denominador cero.
- Tokens peligrosos como `eval`, `process`, `require`, `select`, `drop` son rechazados.
- El cálculo on-demand registra job en `tcdx_async_jobs` cuando está disponible.
- La medición queda en `metric_measurements` con quality, freshness, validation, trust score y correlation id.
