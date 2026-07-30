# Fase 5.5 - Inventario actual de calculos

Estado: Paquete 0 en progreso.
Base: `131ed6ae6870e50ba9f41c339144c080c5f2da1d`.
Fecha de inventario: 2026-07-29.

## Alcance

Este inventario registra calculos visibles o persistentes detectados antes de crear la capa matematica oficial. No declara migracion completa ni autorizacion para cerrar Fase 5.5.

## Hallazgo ejecutivo

La plataforma ya contiene una base analitica importante en Fase 5, pero los calculos siguen distribuidos entre servicios backend, SQL, reportes y componentes frontend. El motor actual `backend/src/services/phase5/formulaEngine.js` es declarativo y seguro, pero limitado: no registra las 50 formulas oficiales, no incluye metodos estadisticos avanzados, no centraliza riesgo/readiness/health, y no obliga a dashboards/reportes a consumir solo mediciones oficiales publicadas.

## Inventario dirigido

| # | Nombre / dominio | Archivo | Funcion o ubicacion | Formula / regla detectada | Inputs | Outputs | Unidad | Tenant scope | Versionado | Lineage | Consumidores | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Formula DSL Fase 5 | `backend/src/services/phase5/formulaEngine.js` | `evaluate` | add/subtract/multiply/divide/ratio/percentage/count/sum/average/min/max/latest/coalesce/conditional | inputs declarativos | valor calculado | variable | por consumidor | no oficial 50 formulas | no persistente | metricas Fase 5 | official_reusable, must_extend |
| 2 | Data Trust Score v2 | `backend/src/services/phase5/dataTrustScore.js` | `calculateTrustScore` | suma ponderada de 12 componentes con caps por freshness/source/lineage/evidence/validation/assurance | componentes trust | score/status | score 0-100 | por consumidor | `data_trust_score_v2` string | parcial | Phase5 service, tests | must_migrate |
| 3 | Freshness discreto | `backend/src/services/phase5/dataTrustScore.js` | `assessFreshness` | umbrales por frecuencia | observedAt/frequency | status/score | score 0-100 | por fuente | no version publicada | no | Data Trust | heuristic, must_migrate |
| 4 | Metricas gobernadas | `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql` | `metric_definitions`, `metric_formula_versions`, `metric_measurements` | aggregation declarativa y expresion JSON | metric_sources/measurements | measurements/snapshots | configurable | tenant/global | si en tabla legacy F5 | parcial | dashboards/reportes F5 | official_reusable, must_extend |
| 5 | Inmutabilidad de formula publicada | `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql` | trigger `trg_metric_formula_versions_immutable` | reject update/delete published | metric_formula_versions | bloqueo DML | n/a | global/tenant | si | auditoria DB | administracion metricas | official_reusable |
| 6 | Catalogo metrico inicial | `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql` | inserts `metric_definitions` | metricas ISO/GRC basicas | datos operacionales | definiciones publicadas | varias | global | si | metadata parcial | frontend F5 | incomplete |
| 7 | Control conformance percentage | `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql` | seed `control_conformance_percentage` | controles conformes / evaluados | controles/evaluaciones | porcentaje | % | tenant al medir | formula versionada generica | parcial | metricas/reportes | must_migrate |
| 8 | Standard readiness score | `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql` | seed `standard_readiness_score` | latest snapshot readiness | readiness snapshots | score | score | tenant | formula generica | parcial | dashboards | incomplete |
| 9 | Control coverage | `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql` | seed `control_coverage` | controles cubiertos / aplicables | controles/requisitos | % | % | tenant | formula generica | parcial | dashboards | must_migrate |
| 10 | Data quality score | `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql` | seed `data_quality_score` | promedio assessments.score | data_quality_assessments | score | score | tenant | formula generica | parcial | Data/BI | must_migrate |
| 11 | Net loss test-only | `backend/src/services/phase5/phase5Core.test.js` | test de `netLoss` | gross_loss - recoveries | gross/recoveries | net loss | currency | n/a | no | no | test only | must_migrate |
| 12 | Readiness / health legacy SQL | `backend/src/services/health.service.js` | health service | SQL aggregates y estados | controles/kpis/evidencias | health summaries | score/status | tenant | no central | parcial | health pages | must_migrate |
| 13 | Dashboard V2 KPIs | `backend/src/services/dashboardV2.service.js` | dashboard service | aggregates tenant dashboard | controles/evidencias/riesgos | dashboard KPIs | varias | tenant | no central | parcial | `frontend/src/components/dashboard-v2` | must_migrate |
| 14 | Report Data aggregates | `backend/src/reports/services/reportData.service.js` | report data | conteos y promedios para reportes | modulos GRC | report metrics | varias | tenant | no central | parcial | premium reports | must_migrate |
| 15 | Report Coverage | `backend/src/reports/services/reportCoverage.service.js` | coverage helpers | cobertura de reportes | normas/requisitos/evidencias | coverage | % | tenant | no central | parcial | reportes | must_migrate |
| 16 | Risk matrix ISO | `backend/src/services/isoRiskMatrix.service.js` | risk matrix | probabilidad/impacto y matriz | riesgos | scores/matriz | score | tenant | no central | parcial | matriz riesgo | must_migrate |
| 17 | Monte Carlo operacional | `backend/src/services/operationalRiskMonteCarlo.service.js` | simulacion | perdidas simuladas/percentiles | eventos/riesgos | distribucion | currency/probability | tenant | no registry oficial | parcial | riesgo operacional | official_reusable, must_wrap |
| 18 | Applicability heuristic | `backend/src/services/companyProfileApplicabilityEngine.service.js` | `classifyControl`, `classifyKpi` | pesos fijos por perfil/madurez/estandares | perfil empresa/catalogos | applicability_score | 0-1 | tenant | no | trace parcial | aplicabilidad | heuristic, must_migrate |
| 19 | Evidence quality | `backend/src/routes/evidences.routes.js` | weighted SQL/JS | pertinence 0.15 + sufficiency 0.25 + freshness 0.10 + traceability 0.20 + consistency 0.10 + compliance impact 0.20 | AI evidence scores | quality score | score | tenant | no central | parcial | evidencias/reportes | must_migrate |
| 20 | AI answer confidence | `backend/src/routes/ai-answer.routes.js` | rank/confidence helpers | rank score thresholds y confidence_score 35/60/... | knowledge/search/AI | confidence | score | tenant/contextual | no | parcial | IA Compliance | heuristic, must_migrate |
| 21 | AI Compliance health summary | `backend/src/routes/ai-compliance.routes.js` | health-summary | SQL avg health_score y confidence fallbacks | control health/AI | health summary | score | tenant | no central | parcial | IA Compliance | must_migrate |
| 22 | Phase2 GRC service | `backend/src/services/grc/phase2.service.js` | multiples calculos GRC | estados, counts, derived risk | phase2 tables | panels | varias | tenant | no central | parcial | GRC integrado | must_migrate |
| 23 | Phase3 GRC service | `backend/src/services/grc/phase3.service.js` | resiliencia/operacion | continuidad/BIA/servicios/planes | phase3 tables | operational views | varias | tenant | no central | parcial | operacion GRC | must_migrate |
| 24 | Frontend dashboard local presentation | `frontend/src/app/dashboard/page.tsx` | cards/charts | visualiza valores y puede derivar estados | API payload | UI metrics | varias | tenant via API | no | no | dashboard | frontend_consumer_check |
| 25 | Risk simulation frontend | `frontend/src/components/riesgos/riskSimulationUtils.ts` | simulation utils | simulacion/estadistica local | user inputs | chart/simulation | score | UI | no | no | matriz riesgo | unsafe if official |
| 26 | KPI admin page | `frontend/src/app/administrar-kpis/page.tsx` | UI KPI | presenta/gestiona KPI | API payload | UI | varias | tenant | no | no | administracion KPI | frontend_consumer_check |
| 27 | ISO Health page | `frontend/src/components/health/IsoHealthPageClient.tsx` | UI health | presenta health y status | API payload | UI | score/status | tenant via API | no | no | health | frontend_consumer_check |

## Clasificacion inicial

- `official_reusable`: motor declarativo Fase 5, inmutabilidad de formulas publicadas, tablas de metricas y mediciones.
- `must_migrate`: readiness, coverage, health, evidence quality, risk, dashboard/report aggregates, AI confidence, loss, supplier and assurance scoring.
- `heuristic`: applicability engine, AI confidence thresholds, freshness thresholds and fallback confidence values.
- `frontend_consumer_check`: vistas que deben dejar de derivar scores oficiales y consumir solo mediciones publicadas o explicaciones oficiales.

## Decision Paquete 0

No se debe avanzar a Paquete 1 sin crear el registro oficial de formulas, source contracts, evidencia de consumidores y pruebas que bloqueen duplicacion de calculos.


## Actualizacion Paquete 1

| Nombre / dominio | Archivo | Estado Paquete 1 | Compatibilidad |
| --- | --- | --- | --- |
| OfficialFormulaRegistry | `backend/src/services/math-governance/formulaRegistry.service.js` | implementado | nuevo runtime oficial; no migra consumidores aun |
| Motor matematico declarativo | `backend/src/services/math-governance/formulaExecution.service.js` | implementado | compatible conceptualmente con `phase5/formulaEngine.js`, con operadores ampliados |
| Motor estadistico | `backend/src/services/math-governance/statisticalEngine.service.js` | implementado | nueva base reutilizable para Monte Carlo, tendencias, intervalos y encuestas |
| Contratos de fuente | `backend/src/services/math-governance/sourceResolver.service.js` | preparado | no conecta fuentes reales hasta Paquete 2 |
| Validacion de dataset | `backend/src/services/math-governance/datasetValidation.service.js` | preparado | evita ceros silenciosos y registra hash |

No se eliminaron calculos legacy en Paquete 1. La migracion de consumidores queda documentada para Paquetes 3-5.

## Paquete 4 completed (2026-07-29T21:20:57Z)

Dominios integrados: encuestas, campanas, assurance, muestreo, perdidas, continuidad, activos y proveedores. Los servicios oficiales viven en `backend/src/services/math-governance/*Calculation.service.js`; `phase5Package4Jobs.service.js` define jobs tenant-scoped e idempotentes.

Validacion: `npm run phase5-5:package4-check` ejecuta integraciones por dominio, PostgreSQL efimero con runs/snapshots/lineage Tenant A/B, aislamiento conceptual y E2E tecnico basado en servicios.


## Paquete 5 completed (2026-07-29)

BI, dashboards, Report Studio, PDF/DOCX/XLSX, snapshots, trends, comparisons, alert eligibility, explanation URLs and lineage URLs consume the official analytics catalog and persisted calculation runs. Missing official runs are reported as source_unavailable; no BI/report formula fallback is allowed.
