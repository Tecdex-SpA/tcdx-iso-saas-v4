# Fase 5 - Inventario inicial de cadenas rotas

Fecha de generacion: 2026-08-10
Baseline: `5656a7568745721e82c75a5454ed102485d7978f`
Estado global inicial: `NOT_CLOSED`

Estados usados:

- `PASS`: existe cadena oficial verificable por codigo y contrato local.
- `BROKEN_CHAIN`: falta al menos un enlace funcional obligatorio.
- `LEGACY_FALLBACK`: existe ruta legacy o calculo paralelo que debe migrarse, adaptar o documentarse.
- `NOT_APPLICABLE`: no corresponde a indicador oficial o es estadistica operacional distinta.

## Indicadores oficiales

| Indicador | UI field | DB column / fuente | Semantic variable | Formula input | Metric / snapshot | Consumers | Estado | Disposicion |
|---|---|---|---|---|---|---|---|---|
| GRC-HEALTH | componentes GRC oficiales | `metric_measurements`, `metric_snapshots` + dominios base | componentes normalizados | `compliance`, `actions`, `evidence`, `dataTrust`, `risk` | `GRC-HEALTH` | Metricas, Dashboard, BI | LEGACY_FALLBACK | Verificar que dashboard no combine score oficial con cards legacy como verdad equivalente. |
| ISO-READINESS | cumplimiento, evidencia, hallazgos, acciones | evaluaciones, evidencias, hallazgos, acciones | readiness components | `compliance`, `evidence`, `health`, `actions` | `ISO-READINESS` | Metricas, BI, reportes | BROKEN_CHAIN | Reconciliar diagnostico/readiness legacy para evitar readiness calculado en UI o endpoint paralelo. |
| COMPLIANCE | evaluacion requisito/control | evaluaciones de cumplimiento / SoA | requirement score, weight | `values`, `weights` | `COMPLIANCE` | Metricas, Dashboard, BI, Report | PASS | Mantener prueba numerica de cambio de dato y snapshot. |
| COVERAGE | universo aplicable evaluado | requisitos aplicables/evaluaciones | assessed/applicable | `numerator`, `denominator` | `COVERAGE` | Metricas, Dashboard, BI | PASS | Verificar no aplica excluido y no evaluado distinto de cero. |
| RISK-INHERENT | probabilidad e impacto | riesgos | probability, impact | `probability`, `impact` | `RISK-INHERENT` | Riesgos, Metricas, BI | LEGACY_FALLBACK | Riesgos puede mantener calculo operacional, pero indicador oficial debe prevalecer en consumers oficiales. |
| RISK-RESIDUAL | riesgo + controles | riesgos, controles, relaciones | inherentRisk, controlEffectiveness | `inherentRisk`, `controlEffectiveness` | `RISK-RESIDUAL` | Riesgos, Dashboard, BI | BROKEN_CHAIN | Verificar que residual use efectividad oficial y no matriz local sin normalizacion. |
| CONTROL-EFFECT | diseno/implementacion/operacion/evidencia | controles, evidencias, assurance | D, I, O, E | weighted control components | `CONTROL-EFFECT` | Controles, Dashboard, BI | BROKEN_CHAIN | Confirmar UI captura todos los componentes o devuelve data requirements accionables. |
| EVIDENCE-FRESH | vigencia/aprobacion evidencia | evidencias y relaciones | freshness, approval, coverage | freshness components | `EVIDENCE-FRESH` | Evidencias, Dashboard, BI | LEGACY_FALLBACK | Dashboard y evidencia legacy usan conteos directos; deben no presentarse como indicador oficial. |
| REMEDIATION | avance accion | planes de accion | weighted progress | `values`, `weights` | `REMEDIATION` | Acciones, reportes | PASS | Agregar prueba de cambio de progreso. |
| FINDINGS | severidad y estado | hallazgos/no conformidades | severity, status, age | severity index | `FINDINGS` | Hallazgos, auditoria | LEGACY_FALLBACK | Separar estadisticas operacionales de exposicion oficial por hallazgos. |
| ACTIONS | progreso, fecha, estado | planes de accion | progress, due date, status | weighted progress / closure | `ACTIONS` | Acciones, Dashboard, Report | PASS | Reforzar null != 0 en progreso ausente. |
| AUDIT-ASSURANCE | pruebas/muestras/resultados | auditorias, assurance executions | result, sample, evidence | assurance score | `AUDIT-ASSURANCE` | Auditoria, BI, Report | BROKEN_CHAIN | Confirmar que auditoria operacional alimenta assurance oficial, no solo resumen de auditoria. |
| SUPPLIER-RISK | evaluacion proveedor | proveedores, evaluaciones, incidentes | criticality, security, dependency, performance, resilience | supplier risk components | `SUPPLIER-RISK` | Proveedores, BI | BROKEN_CHAIN | Verificar fuente autoritativa TPRM y que tenant sin datos reciba requisitos accionables. |
| CONTINUITY | SLA/RTO/RPO/pruebas | servicios, planes, pruebas, incidentes | availability, SLA, gaps | continuity components | `CONTINUITY` | Continuidad, Dashboard | BROKEN_CHAIN | Confirmar unidades RTO/RPO y snapshots reales por periodo. |
| INCIDENTS | severidad/estado/timeline | incidentes | severity, status, age | severity index | `INCIDENTS` | Incidentes, BI | LEGACY_FALLBACK | Clasificar estadisticas operacionales vs indicador oficial. |
| LOSSES | gross/recovery/net/currency | eventos de perdida, recuperaciones | grossLoss, recoveries, currency | net loss | `LOSSES` | Perdidas, BI, Report | BROKEN_CHAIN | Verificar no mezcla monedas y cambio de dato recalcula. |
| DATA-TRUST | quality dimensions | data_quality, observations, snapshots | 8 dimensiones trust | data trust components | `DATA-TRUST` | Datos, Metricas, BI | PASS | Validar que business UI no expone detalle tecnico por defecto. |
| MATURITY | evaluacion madurez | assessments, encuestas | maturity answers/evidence | maturity components | `MATURITY` | BI, Report | BROKEN_CHAIN | Verificar UI/persistencia operacional que alimente formula. |
| OP-PERFORMANCE | eficacia/estabilidad/calidad/riesgo/cumplimiento | outputs oficiales | normalized components | operational performance components | `OP-PERFORMANCE` | BI, Dashboard | LEGACY_FALLBACK | Debe derivar solo de outputs oficiales compatibles. |
| CONTROL-COVERAGE | riesgos/requisitos con control | riesgos, requisitos, controles vinculados | covered/universe | coverage ratio | `CONTROL-COVERAGE` | Controles, Dashboard | BROKEN_CHAIN | Validar relaciones y universo, no conteo de controles aislado. |
| SLA-COMPLIANCE | casos dentro de SLA | continuidad/casos/incidentes | withinSLA/applicable | numerator/denominator | `SLA-COMPLIANCE` | Continuidad, Dashboard | BROKEN_CHAIN | Requiere timezone y periodos comparables. |
| SUPPLIER-HEALTH | riesgo/desempeno/assurance proveedor | proveedores y componentes oficiales | supplier components | supplier health components | `SUPPLIER-HEALTH` | Proveedores, BI | BROKEN_CHAIN | No debe producir health alto con datos desconocidos. |

## Superficies legacy identificadas

| Superficie | Evidencia | Riesgo | Accion Fase 5 |
|---|---|---|---|
| `/dashboard` | Consume `/api/metrics/official/dashboard`, pero conserva agregados legacy y helpers `Number(... ?? 0)` para secciones operacionales. | Mostrar cero donde corresponde ausencia o mezclar KPI legacy con snapshot oficial. | Revisar cards oficiales y aislar estadisticas operacionales con labels distintos. |
| `/diagnostico` | Usa readiness y coverage desde assessment legacy. | Readiness paralelo a ISO-READINESS. | Adaptar copy/endpoint para indicar diagnostico operacional o consumir snapshot oficial cuando se presente como readiness oficial. |
| `/soa` | Muestra conteos y sugerencias con defaults `|| 0`. | Confundir conteos operacionales con indicadores oficiales. | Mantener como estadistica operacional; no usar como source oficial sin mapping. |
| `/auditorias/ia` | Calcula readiness/conformity/evidence desde diagnosis. | Cifra de IA puede divergir de snapshots oficiales. | Etiquetar como diagnostico asistido o conectar a indicador oficial. |
| `/exportes` | Export panel usa conteos por tipo; la ruta oficial de indicadores exporta catalogo/snapshot. | Export legacy podria no reproducir snapshot oficial. | Validar y separar export operacional vs export oficial de indicadores. |
| Report Studio | Rutas de generacion existen. | Reportes pueden incluir estadisticas operacionales equivalentes a indicadores. | Reconciliar cada cifra como `OFFICIAL_INDICATOR`, `OPERATIONAL_STATISTIC` o `LEGACY_DUPLICATE`. |

## Cadenas rotas prioritarias

1. `ISO-READINESS`: diagnostico y readiness legacy deben quedar claramente separados o consumir el snapshot oficial.
2. `RISK-RESIDUAL`: asegurar que fuente de control effectiveness oficial alimenta residual.
3. `CONTROL-EFFECT`: comprobar captura real de diseno, implementacion, operacion y evidencia; si faltan campos, devolver data requirements.
4. `AUDIT-ASSURANCE`: conectar auditoria/assurance con score oficial y muestras.
5. `SUPPLIER-RISK` y `SUPPLIER-HEALTH`: validar cadena proveedor/evaluacion/incidente/continuidad hacia formula.
6. `CONTINUITY` y `SLA-COMPLIANCE`: validar unidades, timezone, periodo y pruebas.
7. `LOSSES`: validar moneda unica por resultado y cambio de dato.
8. `MATURITY`: confirmar source operacional real.
9. `CONTROL-COVERAGE`: confirmar universo correcto de riesgos/requisitos y controles vinculados.

## Reglas de correccion

- No convertir `null`, `undefined`, fuente ausente o denominador inexistente en cero.
- No sintetizar tendencias con deltas artificiales; usar snapshots publicados comparables.
- No insertar snapshots artificiales en demo enterprise.
- No exponer formula, tabla, columna, SQL o adapter a usuarios de negocio.
- No eliminar legacy sin prueba de equivalencia y consumidor.
- Todo estado no calculable debe incluir `missing_fields`, `missing_entities`, `route_to_fix` o razon funcional equivalente.
