# Knowledge Base Coverage

## Proposito

La cobertura KB mide cuanto del dataset operacional del tenant puede fundamentarse con `knowledge_basis`.

## Fuentes evaluadas

- controles
- SOA
- evidencias
- riesgos
- hallazgos
- planes de accion
- health signals
- KPIs

## Salida

`knowledge_context` contiene:

- `total_available_items`
- `sources_used`
- `standards_covered`
- `knowledge_items_used`
- `rules_used`
- `coverage_score`
- `license_warnings`
- `missing_coverage`

## Interpretacion

| coverage_score | Estado | Uso recomendado |
|---:|---|---|
| 75-100 | alta | conclusiones con confianza alta si data quality acompaña |
| 45-74 | media | conclusiones utiles con limitaciones visibles |
| 0-44 | baja | degradar confidence y pedir mayor mapeo/datos |

## Regla de seguridad

Una conclusion puede usar Knowledge Base como fundamento, pero no debe copiar texto protegido de normas ISO ni enviar la base completa al LLM.
