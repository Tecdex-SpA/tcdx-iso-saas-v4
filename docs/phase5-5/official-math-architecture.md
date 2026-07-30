# Official Math Architecture

Estado global: NOT_READY. Ultima actualizacion: 2026-07-29T21:01:13Z.

## Alcance implementado

La arquitectura oficial queda concentrada en `backend/src/services/math-governance/` y evita calculos configurables por usuario. El registro oficial declara formulas versionadas, variables, unidades, precision, redondeo, politicas de nulos y cero, aplicabilidad, limitaciones, checksum e inmutabilidad de versiones publicadas.

## Capas

1. `formulaRegistry.service.js`: catalogo inmutable de 50 formulas oficiales y motor deterministico.
2. `officialCalculation.service.js`: DTO oficial, confianza del dato, hashing, explicacion y lineage URL.
3. `sourceContracts.service.js`: contratos fuente tipados, versionados y sin SQL arbitrario.
4. `sourceResolver.service.js`: resolucion tenant-scoped de datasets reales o estado `source_unavailable`.
5. `datasetValidation.service.js`: validacion de tenant, periodo, unidad, nulos, duplicados, rangos, referencias y cobertura.
6. Servicios Paquete 3: cumplimiento, readiness, riesgo, controles, acciones, health y operational excellence.
7. `analyticsCatalog.service.js`: catalogo oficial de resultados analiticos para BI, reportes, widgets, snapshots, trends, comparaciones, explicabilidad y lineage.

## Persistencia

La migracion aditiva `database/migrations/20260730_phase5_5_official_math_governance.sql` crea las tablas oficiales, indices, checks e inmutabilidad. La aplicacion productiva queda pendiente para Paquete 7/deploy controlado; la validacion local efimera se ejecuta con `npm run phase5-5:postgres-integration`. Los servicios del Paquete 3 persisten runs, inputs, outputs y explicaciones cuando estas tablas existen.

## Estado

- Paquete 0: completed.
- Paquete 1: completed.
- Paquete 2: completed.
- Paquete 3: completed.
- Paquetes 6-7: pending.

## Paquete 4 completed (2026-07-29T21:20:57Z)

Dominios integrados: encuestas, campanas, assurance, muestreo, perdidas, continuidad, activos y proveedores. Los servicios oficiales viven en `backend/src/services/math-governance/*Calculation.service.js`; `phase5Package4Jobs.service.js` define jobs tenant-scoped e idempotentes.

Validacion: `npm run phase5-5:package4-check` ejecuta integraciones por dominio, PostgreSQL efimero con runs/snapshots/lineage Tenant A/B, aislamiento conceptual y E2E tecnico basado en servicios.
