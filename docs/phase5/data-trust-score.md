# Fase 5 — Data Trust Score

El Data Trust Score es determinista, 0 a 100, sin IA generativa.

Componentes:

- completeness
- accuracy
- consistency
- freshness
- lineage
- validation
- stability
- coverage

Pesos por defecto suman 1. Un dato stale/expired/unavailable/unknown reduce el score y nunca se muestra sin advertencia. Un dato sin lineage no obtiene score máximo. Una medición rechazada queda `untrusted`.

Estados:

- `trusted`
- `acceptable`
- `attention`
- `untrusted`
- `unknown`
