# Fase 5 - Reconciliacion de 22 indicadores

## Resultado de reconciliacion local

- Indicadores en catalogo funcional: 22/22.
- Indicadores con formula oficial asociada: 22/22.
- Indicadores con ruta de consulta oficial: 22/22 mediante `/api/metrics/official/catalog`, `/api/metrics/official/:metricCode`, `/api/grc/official/analytics/:resultCode`.
- Indicadores con export oficial JSON: 22/22 mediante `/api/metrics/official/export`.
- Indicadores con data requirements accionables cuando no calculan: implementado en el orquestador oficial para `source_unavailable`, `unmeasured`, `dependency_pending` y `source_incompatible`.

## Politicas cerradas en esta ejecucion

- Un resultado no calculado no lleva valor numerico.
- Un fallback legacy se reporta como warning de fuente primaria sin filas utilizables.
- Una fuente ausente devuelve `data_requirements` con ruta, capability, poblacion requerida, poblacion actual y razon funcional.
- Una dependencia pendiente devuelve campos faltantes.
- Una equivalencia fuente-formula ausente devuelve `formula_input_mapping`.

## Indicadores que requieren E2E numerico posterior antes de declarar cierre productivo

Aunque el backend ahora entrega requisitos accionables y la cadena oficial existe, los siguientes requieren prueba end-to-end de dato cambiante contra UI/report/export antes de afirmar `PHASE5_FUNCTIONALLY_CLOSED`:

- `ISO-READINESS`
- `RISK-RESIDUAL`
- `CONTROL-EFFECT`
- `AUDIT-ASSURANCE`
- `SUPPLIER-RISK`
- `CONTINUITY`
- `LOSSES`
- `MATURITY`
- `CONTROL-COVERAGE`
- `SLA-COMPLIANCE`
- `SUPPLIER-HEALTH`

## Estado

Estado de cierre funcional estricto: `NOT_CLOSED` hasta ejecutar la suite numerica completa sobre fixtures y consumidores reales.
