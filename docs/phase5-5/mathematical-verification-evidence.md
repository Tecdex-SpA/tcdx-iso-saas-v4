# Fase 5.5 - Evidencia de verificacion matematica

Estado global: `NOT_READY`.
Estado Paquete 1: `COMPLETED`.

## Resumen Paquete 1

- Registro oficial: 50 formulas publicadas en memoria, version 1, checksum SHA-256 e inmutabilidad de versiones publicadas.
- Motor matematico: operadores declarativos seguros sin eval/Function/SQL arbitrario.
- Motor estadistico: funciones descriptivas, tendencias, correlaciones, intervalos, alfa de Cronbach, muestra y simulacion.
- Distribuciones: PERT, Poisson, Lognormal y Monte Carlo con semilla.
- Pruebas: `officialFormulas.test.js` reporta 50 formulas y 848 aserciones; `statisticalEngine.test.js` valida metodos estadisticos y reproducibilidad.

## Evidencia por formula

| # | formula_code | Version | Dataset / inputs | Esperado | Obtenido | Tolerancia | Unidad | Redondeo | Estado | Limitaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `F5_5_COMPLIANCE_WEIGHTED` | v1 | `{"assessments":[{"status":"conform","weight":2},{"status":"partial","weight":1},{"status":"not_applicable","weight":1},{"status":"non_conform","weight":1}]}` | 62.5 | 62.5 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 2 | `F5_5_COVERAGE` | v1 | `{"evaluated":8,"applicable":10}` | 80 | 80 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 3 | `F5_5_READINESS` | v1 | `{"compliance":0.8,"evidence":0.7,"health":0.9,"actions":0.6}` | 77 | 77 | 0.01 | score | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 4 | `F5_5_INHERENT_RISK` | v1 | `{"probability":4,"impact":5}` | 20 | 20 | 0.01 | score | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 5 | `F5_5_RESIDUAL_RISK` | v1 | `{"inherentRisk":20,"controlEffectiveness":0.65}` | 7 | 7 | 0.01 | score | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 6 | `F5_5_COMBINED_EFFECTIVENESS` | v1 | `{"effectivenesses":[0.4,0.5],"dependencyFactor":0.9}` | 0.63 | 0.63 | 0.01 | ratio | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 7 | `F5_5_CONTROL_EFFECTIVENESS` | v1 | `{"design":0.8,"implementation":0.7,"operation":0.9,"evidence":0.6}` | 0.75 | 0.75 | 0.01 | ratio | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 8 | `F5_5_CONTROL_COVERAGE` | v1 | `{"risksWithControl":7,"relevantRisks":10}` | 70 | 70 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 9 | `F5_5_FREQUENCY_COMPLIANCE` | v1 | `{"onTimeExecutions":18,"scheduledExecutions":20}` | 90 | 90 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 10 | `F5_5_FAILURE_RATE` | v1 | `{"failedTests":3,"executedTests":20}` | 15 | 15 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 11 | `F5_5_SEVERITY_INDEX` | v1 | `{"low":2,"medium":2,"high":1,"critical":1}` | 54.1667 | 54.17 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 12 | `F5_5_CLOSURE_RATE` | v1 | `{"closed":6,"openAtStart":5,"created":7}` | 50 | 50 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 13 | `F5_5_MTTC` | v1 | `{"items":[{"openedAt":"2026-01-01","closedAt":"2026-01-06"},{"openedAt":"2026-01-01","closedAt":"2026-01-11"}]}` | 7.5 | 7.5 | 0.01 | days | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 14 | `F5_5_AGE` | v1 | `{"now":"2026-01-11","items":[{"createdAt":"2026-01-01"},{"createdAt":"2026-01-06"}]}` | 7.5 | 7.5 | 0.01 | days | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 15 | `F5_5_WEIGHTED_PROGRESS` | v1 | `{"items":[{"progress":0.5,"weight":1},{"progress":1,"weight":3}]}` | 87.5 | 87.5 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 16 | `F5_5_OVERDUE_RATE` | v1 | `{"overdueOpen":3,"openActions":12,"items":[{"overdue":1,"weight":2},{"overdue":0,"weight":2}]}` | 25 | 25 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 17 | `F5_5_EXPECTED_LOSS` | v1 | `{"probability":0.2,"impact":10000}` | 2000 | 2000 | 0.01 | currency | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 18 | `F5_5_NET_LOSS` | v1 | `{"grossLoss":1000,"recoveries":250}` | 750 | 750 | 0.01 | currency | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 19 | `F5_5_LOSS_SEVERITY` | v1 | `{"netLosses":[100,200,300,400]}` | 250 | 250 | 0.01 | currency | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 20 | `F5_5_PARAMETRIC_VAR` | v1 | `{"mean":1000,"z":1.65,"sigma":200}` | 1330 | 1330 | 0.01 | currency | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 21 | `F5_5_MONTE_CARLO` | v1 | `{"iterations":1000,"seed":42,"frequency":{"type":"poisson","lambda":1},"severity":{"type":"fixed","value":100},"threshold":200}` | 101.2 | 101.2 | 0.0001 | currency | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 22 | `F5_5_FMEA_RPN` | v1 | `{"severity":4,"occurrence":5,"detection":3}` | 60 | 60 | 0.01 | score | half_up/0 | passed | Operational source binding is implemented in package 2. |
| 23 | `F5_5_AVAILABILITY` | v1 | `{"totalTime":1000,"downtime":10}` | 99 | 99 | 0.01 | % | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 24 | `F5_5_MTBF` | v1 | `{"operatingTime":1000,"failures":4}` | 250 | 250 | 0.01 | hours | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 25 | `F5_5_MTTR` | v1 | `{"repairTimes":[2,4,6]}` | 4 | 4 | 0.01 | hours | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 26 | `F5_5_SLA_COMPLIANCE` | v1 | `{"withinSla":45,"applicableCases":50}` | 90 | 90 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 27 | `F5_5_RTO_GAP` | v1 | `{"recoveryActual":6,"rtoObjective":4}` | 2 | 2 | 0.01 | hours | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 28 | `F5_5_RPO_GAP` | v1 | `{"dataLossActual":3,"rpoObjective":1}` | 2 | 2 | 0.01 | hours | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 29 | `F5_5_ASSET_CRITICALITY` | v1 | `{"confidentiality":4,"integrity":5,"availability":3,"legal":2}` | 3.5 | 3.5 | 0.01 | score | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 30 | `F5_5_SUPPLIER_RISK` | v1 | `{"compliance":3,"security":4,"dependency":5,"privacy":2,"resilience":1}` | 3 | 3 | 0.01 | score | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 31 | `F5_5_SURVEY_SCORE` | v1 | `{"items":[{"score":4,"maxScore":5,"weight":2},{"score":3,"maxScore":5,"weight":1},{"score":1,"maxScore":5,"weight":1,"notApplicable":true}]}` | 73.3333 | 73.33 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 32 | `F5_5_CRONBACH_ALPHA` | v1 | `{"matrix":[[1,2,3],[2,3,4],[3,4,5],[4,5,6]]}` | 1 | 1 | 0.01 | ratio | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 33 | `F5_5_RESPONSE_RATE` | v1 | `{"completedResponses":80,"validInvitations":100}` | 80 | 80 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 34 | `F5_5_DROPOUT_RATE` | v1 | `{"started":100,"completed":80}` | 20 | 20 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 35 | `F5_5_ASSURANCE_SCORE` | v1 | `{"results":[{"result":"pass","weight":2},{"result":"pass_with_observations","weight":1},{"result":"fail","weight":1},{"result":"inconclusive","weight":1}]}` | 68.75 | 68.75 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 36 | `F5_5_SAMPLE_SIZE` | v1 | `{"z":1.96,"p":0.5,"e":0.05,"population":1000}` | 277.7445 | 277.74 | 0.01 | count | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 37 | `F5_5_COMPLETENESS` | v1 | `{"validRequired":18,"expectedRequired":20}` | 90 | 90 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 38 | `F5_5_ACCURACY` | v1 | `{"verifiedCorrect":45,"verified":50}` | 90 | 90 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 39 | `F5_5_CONSISTENCY` | v1 | `{"contradictory":2,"evaluated":20}` | 90 | 90 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 40 | `F5_5_FRESHNESS_CONTINUOUS` | v1 | `{"ageHours":24,"halfLifeHours":24}` | 50 | 50 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 41 | `F5_5_LINEAGE_SCORE` | v1 | `{"presentRelations":4,"requiredRelations":5}` | 80 | 80 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 42 | `F5_5_Z_SCORE` | v1 | `{"x":3,"values":[1,2,3,4,5]}` | 0 | 0 | 0.01 | z | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 43 | `F5_5_ROBUST_Z_SCORE` | v1 | `{"x":5,"values":[1,2,3,4,5]}` | 1.349 | 1.349 | 0.01 | z | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 44 | `F5_5_LINEAR_TREND` | v1 | `{"points":[{"x":1,"y":2},{"x":2,"y":4},{"x":3,"y":6}]}` | 2 | 2 | 0.01 | slope | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 45 | `F5_5_PERCENT_VARIATION` | v1 | `{"current":120,"previous":100}` | 20 | 20 | 0.01 | % | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 46 | `F5_5_MOVING_AVERAGE` | v1 | `{"values":[1,2,3,4,5],"windowSize":3}` | 4 | 4 | 0.01 | value | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 47 | `F5_5_EMA` | v1 | `{"values":[1,2,3],"windowSize":3}` | 2.25 | 2.25 | 0.01 | value | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 48 | `F5_5_CONFIDENCE_INTERVAL` | v1 | `{"successes":50,"sampleSize":100,"z":1.96}` | 50 | 50 | 0.01 | % | half_up/4 | passed | Operational source binding is implemented in package 2. |
| 49 | `F5_5_GRC_HEALTH` | v1 | `{"risk":0.8,"compliance":0.9,"actions":0.7,"evidence":0.6,"dataTrust":0.85}` | 78 | 78 | 0.01 | score | half_up/2 | passed | Operational source binding is implemented in package 2. |
| 50 | `F5_5_MATURITY` | v1 | `{"levels":[{"level":2,"weight":1},{"level":4,"weight":3}]}` | 3.5 | 3.5 | 0.01 | level | half_up/2 | passed | Operational source binding is implemented in package 2. |

## Casos cubiertos por formula

Cada formula incluye matriz minima de pruebas: normal, boundary, null, zero, invalid_unit y determinism. Los casos que dependen de fuentes operacionales permanecen con `source_contract=pending_package_2`; la vinculacion real corresponde al Paquete 2.

## Paquete 4 completed (2026-07-29T21:20:57Z)

Dominios integrados: encuestas, campanas, assurance, muestreo, perdidas, continuidad, activos y proveedores. Los servicios oficiales viven en `backend/src/services/math-governance/*Calculation.service.js`; `phase5Package4Jobs.service.js` define jobs tenant-scoped e idempotentes.

Validacion: `npm run phase5-5:package4-check` ejecuta integraciones por dominio, PostgreSQL efimero con runs/snapshots/lineage Tenant A/B, aislamiento conceptual y E2E tecnico basado en servicios.


## Paquete 5 completed (2026-07-29)

BI, dashboards, Report Studio, PDF/DOCX/XLSX, snapshots, trends, comparisons, alert eligibility, explanation URLs and lineage URLs consume the official analytics catalog and persisted calculation runs. Missing official runs are reported as source_unavailable; no BI/report formula fallback is allowed.
