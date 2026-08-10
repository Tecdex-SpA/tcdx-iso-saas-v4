# Fase 5 - Comprension funcional del producto

Fecha de generacion: 2026-08-10
Rama: `phase5-functional-closure`
Baseline: `5656a7568745721e82c75a5454ed102485d7978f`
Alcance: cierre funcional de datos, metricas y verdad operacional sin deploy ni produccion.

## Contrato funcional

La cadena oficial de Fase 5 debe ser:

`UI -> BD -> source contract -> mapping -> formula oficial -> medicion -> suficiencia/freshness -> Data Trust -> snapshot -> Dashboard/BI/Metricas/Reporte/Export`

Un resultado funcional solo se considera cerrado cuando:

- el dato entra por una UI o fixture operativo documentado;
- el backend valida tenant, permiso, capability y limites;
- el valor se persiste en columnas operacionales reales;
- la capa semantica resuelve contrato y mapping sin SQL o JS arbitrario;
- la formula oficial consume el input normalizado;
- la medicion distingue cero real, ausencia, insuficiencia, stale e incompatibilidad;
- el Data Trust deriva de evidencia real, no de constantes;
- el snapshot publicado es inmutable y reproducible;
- Dashboard, BI, Metricas, Reportes y Exportes leen la misma verdad.

## Arquitectura actual observada

### Backend autoritativo

- `backend/src/services/indicators/functionalIndicatorCatalog.js` define los 22 indicadores funcionales oficiales.
- `backend/src/services/indicators/indicatorGovernance.service.js` gobierna catalogo, mediciones, snapshots, comparaciones, metodologia, jobs y export oficial.
- `backend/src/services/math-governance/officialCalculationOrchestrator.service.js` coordina formula oficial, source resolver, persistencia de run y source snapshot.
- `backend/src/services/math-governance/sourceResolver.service.js` resuelve datasets operacionales para formulas oficiales.
- `backend/src/services/semantic/semanticLayer.service.js` administra source contracts, versions, mappings, observations, quality, freshness, sufficiency, snapshots y lineage canonico.
- `backend/src/routes/phase5.routes.js` expone `/api/metrics/official/*`, `/api/grc/official/analytics/*`, `/api/data/semantic/*` y rutas legacy de metricas.

### Persistencia versionada

Las migraciones versionadas existentes agregan:

- Phase 5 base de datos/metricas/BI/reporting: `20260729_phase5_data_metrics_bi_reporting`.
- Integracion tenant shell GRC: `20260730_phase5_tenant_shell_grc_data_integration`.
- Math governance oficial 5.5.
- Semantic layer 5-C2.
- Indicadores, trust y snapshots 5-C3.

Los scripts de verificacion existentes cubren checksum, ledger, idempotencia, retry desde failed y PostgreSQL efimero para Fase 5, 5-C2 y 5-C3.

### Consumidores funcionales

- `/metricas` y `/metricas/[id]` consumen el catalogo oficial de indicadores.
- `/dashboard` consume `/api/metrics/official/dashboard`, pero conserva secciones legacy para otros bloques operacionales.
- `OfficialAnalyticsPanel` consume `/api/metrics/official/catalog`.
- `GrcDecisionCenter` y componentes math governance consumen resultados oficiales.
- `Report Studio` y exportes tienen rutas Fase 5, pero requieren reconciliacion final de igualdad `API value = snapshot value = UI value = export value`.

## Principio UX

Las formulas, source contracts, mappings, tablas, columnas y adaptadores son internos. Las superficies de negocio deben mostrar:

`concepto -> resultado -> tendencia -> cobertura -> confianza -> interpretacion -> causa -> impacto -> recomendacion -> accion`

El detalle tecnico solo corresponde a usuarios autorizados mediante permisos tecnicos (`data.lineage.read`, `metrics.indicators.technical`, `semantic.*`).

## Dominios operacionales que alimentan calculos

| Dominio | UI operativa esperada | Persistencia operacional | Uso esperado en Fase 5 |
|---|---|---|---|
| Cumplimiento | cumplimiento, SoA, diagnostico | requisitos, evaluaciones, estados, aplicabilidad | COMPLIANCE, COVERAGE, ISO-READINESS |
| Riesgos | riesgos, riesgo cuantitativo | probabilidad, impacto, controles, tratamientos | RISK-INHERENT, RISK-RESIDUAL |
| Controles | controles, SoA | diseno, implementacion, operacion, evidencia | CONTROL-EFFECT, CONTROL-COVERAGE |
| Evidencias | evidencias, biblioteca | vigencia, aprobacion, relaciones | EVIDENCE-FRESH, DATA-TRUST |
| Acciones | planes de accion, hallazgos | progreso, vencimiento, estado, cierre | REMEDIATION, ACTIONS |
| Auditoria | auditorias, ejecucion, hallazgos | muestras, pruebas, findings, acciones | AUDIT-ASSURANCE, FINDINGS |
| Proveedores | proveedores, evaluaciones TPRM | criticidad, evaluaciones, incidentes, continuidad | SUPPLIER-RISK, SUPPLIER-HEALTH |
| Continuidad | BIA, planes, pruebas, crisis | RTO, RPO, SLA, incidentes, pruebas | CONTINUITY, SLA-COMPLIANCE |
| Incidentes | incidentes | severidad, estado, timeline, acciones | INCIDENTS |
| Perdidas | eventos de perdida | gross, recoveries, net, moneda, relacion | LOSSES |
| Datos | datos, calidad, lineage, semantica | data_quality, snapshots, observations | DATA-TRUST |
| Madurez | evaluaciones, encuestas, assurance | respuestas, dimensiones, evidencia | MATURITY, OP-PERFORMANCE |

## Hallazgos iniciales antes de cambios funcionales

- El catalogo oficial de 22 indicadores existe y esta publicado como concepto funcional.
- La cadena `formula oficial -> medicion -> snapshot -> catalogo/dashboard oficial` existe en backend.
- El source resolver todavia debe verificarse indicador por indicador contra UI/payload/tabla para descartar `first populated table wins` o fallback ambiguo.
- Hay superficies legacy en `/dashboard`, `/diagnostico`, `/soa`, `/auditorias`, `/exportes` y algunos modulos operacionales que usan `|| 0`, `?? 0` o agregados directos. No todos son indicadores oficiales, pero deben clasificarse.
- La igualdad report/export/dashboard/BI para cada indicador requiere pruebas numericas end-to-end adicionales.
- La demo enterprise visual existe para tenant demo, pero no se debe insertar snapshots artificiales para cerrar Fase 5.

## Gate de implementacion

El inventario `02_broken_chain_inventory.md` ya fue completado y reconciliado. Las correcciones posteriores de esta rama se limitaron a cadenas funcionales que afectaban exactitud, trazabilidad, UX, reporting o comercializacion.
