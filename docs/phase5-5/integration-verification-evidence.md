# Integration Verification Evidence

Estado global: NOT_READY.

## Paquete 0

- Inventario de calculos y consumidores: completed.
- Matriz de disponibilidad inicial: completed.

## Paquete 1

- Registro oficial de 50 formulas: completed.
- Motor matematico y estadistico: completed.
- Pruebas numericas unitarias: completed.

## Paquete 2

- Migracion aditiva `database/migrations/20260730_phase5_5_official_math_governance.sql`: completed.
- Registro en runner oficial `scripts/phase5/apply-phase5-migration.js`: completed; deploy no ejecutado.
- Contratos fuente declarativos y versionados: completed en `backend/src/services/math-governance/sourceContracts.service.js`.
- Source resolver tenant-scoped: completed en `backend/src/services/math-governance/sourceResolver.service.js`.
- Dataset validation: completed en `backend/src/services/math-governance/datasetValidation.service.js`.
- Bootstrap DB del registro oficial: completed en `backend/src/services/math-governance/formulaBootstrap.service.js`.
- Lineage source record -> source contract -> dataset snapshot -> formula version -> calculation run: completed como contrato runtime.

## Paquete 3

- Cumplimiento y cobertura oficiales: completed en `complianceCalculation.service.js`.
- Readiness oficial: completed en `readinessCalculation.service.js`.
- Riesgo inherente, residual, expected loss, matrices y clasificacion: completed en `riskCalculation.service.js`.
- Efectividad de controles individual/combinada, frecuencia, fallos y controles sin evidencia vigente: completed en `controlCalculation.service.js`.
- Hallazgos y acciones: completed en `actionCalculation.service.js`.
- Health score registry y GRC/ISO Health: completed en `grcHealthCalculation.service.js`.
- Operational Excellence backend: completed en `operationalExcellence.service.js`.
- Consumidor real migrado: `GET /api/grc/overview` agrega `official_calculations` preservando contrato legacy y persiste calculation runs cuando las tablas oficiales estan disponibles.
- API oficial focalizada: `POST /api/grc/official/:metricKey`, `GET /api/grc/official/health/definitions`, `GET /api/grc/official/calculations/:runId/explanation` y `GET /api/grc/official/calculations/:runId/lineage`.
- Validacion PostgreSQL efimera: `npm run phase5-5:postgres-integration` aplica migraciones, bootstrap, idempotencia, checksum e inmutabilidad sin tocar produccion.

## Evidencia de comandos

- `npm run phase5-5:formula-registry-check` valida 50 formulas publicadas, inmutables y con contrato fuente.
- `npm run phase5-5:source-binding-check` valida bindings, contratos, resolver y dataset validation.
- `npm run phase5-5:package3-tests` valida servicios oficiales del Paquete 3.
- `npm run phase5-5:postgres-integration` valida aplicacion fisica en PostgreSQL efimero.

## Pendiente por diseno

- Encuestas, assurance, perdidas, continuidad, activos y proveedores: Paquete 4.
- BI, reportes y explicabilidad: completed en Paquete 5 con catalogo oficial, contrato BI y consumidores dashboard/report/export.
- UX operativa y constructores frontend: Paquete 6.
- Validacion integral end-to-end: Paquete 7.

## Paquete 4 completed (2026-07-29T21:20:57Z)

Dominios integrados: encuestas, campanas, assurance, muestreo, perdidas, continuidad, activos y proveedores. Los servicios oficiales viven en `backend/src/services/math-governance/*Calculation.service.js`; `phase5Package4Jobs.service.js` define jobs tenant-scoped e idempotentes.

Validacion: `npm run phase5-5:package4-check` ejecuta integraciones por dominio, PostgreSQL efimero con runs/snapshots/lineage Tenant A/B, aislamiento conceptual y E2E tecnico basado en servicios.

## Paquete 6 completed

Frontend operativo integrado: Sidebar agrupado, Portal GRC oficial, Phase5Workspace con formula/version/trust/lineage, panel oficial de resultados y constructores operacionales. Validacion: `npm run phase5-5:package6-check`.

## Paquete 7 completed

Cierre integral local: final check, artifact validation, security/performance source checks, docs de cierre y review independiente. Validacion: `npm run phase5-5:final-check`. No merge, deploy ni produccion.
