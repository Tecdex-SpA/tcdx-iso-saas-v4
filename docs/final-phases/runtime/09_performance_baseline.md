# Baseline de rendimiento local de 5-C1

Esta es una medición smoke, no una prueba de carga ni una garantía de producción. Se usó el dataset sintético y la ejecución serial de Chromium de 5-C1.

| Flujo | Duración observada |
| --- | ---: |
| Login y Portal GRC | 1.881 s |
| Accesibilidad de rutas críticas | 3.723 s |
| Métrica end-to-end | 2.183 s |
| Encuesta y scoring | 2.860 s |
| Assurance | 1.217 s |
| Pérdidas | 1.275 s |
| Dashboard y snapshot | 1.533 s |
| Reportes y tres formatos | 1.505 s |
| Consistencia cross-view | 1.183 s |
| RBAC y tenant isolation | 1.515 s |
| Suite completa | 19.654 s |

Las consultas PostgreSQL, payloads, memoria bajo volumen y generación de artefactos se ejecutaron dentro de esos flujos. No se ejecutaron pruebas de carga, stress, VM ni producción; quedan `NO_VERIFICADO_RUNTIME` para el plan QA de 5-C11.
