# Fase 5.5 - Mapa de consumidores de calculo

Base: `131ed6ae6870e50ba9f41c339144c080c5f2da1d`.

| Consumidor | Ruta / endpoint | Calculos consumidos hoy | Riesgo actual | Contrato objetivo | Paquete |
| --- | --- | --- | --- | --- | --- |
| Dashboard principal | `/dashboard`, `backend/src/services/dashboardV2.service.js` | KPIs, health, tendencias, estados | puede mezclar agregados legacy y presentacion local | consumir `calculation_outputs` publicados con explicacion | 5 |
| Portal GRC | `/grc`, `backend/src/routes/phase5.routes.js` | overview GRC, impact graph, Data Trust | Fase 5 parcial | mediciones oficiales GRC Health, readiness, risk, actions, suppliers | 3/5 |
| Riesgos | `/matriz-riesgo`, `operational-risks.routes.js` | inherente, residual, simulacion, matriz | Monte Carlo y matriz no homologados al registry | riskCalculation + statisticalEngine | 3/4 |
| Controles | `/controles`, `controls.routes.js` | control health, coverage, evidence impact | pesos dispersos y SQL legacy | controlCalculation oficial | 3 |
| Cumplimiento y auditoria | `/cumplimiento-auditoria`, `/soa`, `/auditorias` | compliance, coverage, readiness, findings | readiness incompleto y no siempre con cobertura | compliance/readiness/assurance oficiales | 3/4 |
| Evidencias | `/evidencias`, `evidences.routes.js` | quality score, AI confidence, evidence impact | formula ponderada embebida | evidenceCalculation + Data Trust | 3 |
| Proveedores | `/proveedores`, supplier portal | supplier risk y estado TPRM | Fase 2/4 sin scoring universal | supplierCalculation oficial | 4 |
| Continuidad | Phase 3 workspace | BIA, RTO/RPO, tests, availability | calculos por modulo | continuityCalculation oficial | 4 |
| Encuestas | Phase 5 surveys | score encuestas/campañas | sumas simples o no homologadas | surveyCalculation oficial | 4 |
| Assurance | Phase 5 assurance | resultados y fallos | no ponderado universal | assuranceCalculation oficial | 4 |
| Perdidas | Phase 5 loss events | net loss, expected loss | net loss parcial/test-only | lossCalculation + statisticalEngine | 4 |
| BI dashboards | Phase 5 dashboard builder | widgets y snapshots | migrated_package_5 | widgets solo desde outputs oficiales y calculation_consumers dashboard | 5 |
| Report Studio | Reportes | report metrics, coverage, summaries | reportes calculan fuera de registry | Report Studio dentro de Reportes, fuentes oficiales | 5/6 |
| IA Compliance | `ai-compliance.routes.js` | health/confidence/risk narrative | fallback confidence y scores heuristicos | explicaciones consumen lineage y outputs oficiales | 5 |

## Regla de migracion

Todo consumidor debe pasar de `calcula o agrega por su cuenta` a `solicita calculo oficial o lee snapshot/measurement publicado`. El frontend puede formatear y explicar; no recalcular resultados oficiales.

## Paquete 4 completed (2026-07-29T21:20:57Z)

Dominios integrados: encuestas, campanas, assurance, muestreo, perdidas, continuidad, activos y proveedores. Los servicios oficiales viven en `backend/src/services/math-governance/*Calculation.service.js`; `phase5Package4Jobs.service.js` define jobs tenant-scoped e idempotentes.

Validacion: `npm run phase5-5:package4-check` ejecuta integraciones por dominio, PostgreSQL efimero con runs/snapshots/lineage Tenant A/B, aislamiento conceptual y E2E tecnico basado en servicios.
