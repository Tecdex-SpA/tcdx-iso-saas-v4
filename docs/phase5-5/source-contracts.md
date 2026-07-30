# Source Contracts

Estado global: NOT_READY. Ultima actualizacion: 2026-07-29T21:01:13Z.

Los contratos fuente viven en `backend/src/services/math-governance/sourceContracts.service.js`. Cada contrato declara `source_code`, formula asociada, entidad, tablas, columnas, joins permitidos, filtro tenant, filtro de estado, periodo, timezone, unidad, cardinalidad, campos obligatorios, exclusiones, politica de nulos, disponibilidad, version y checksum.

## Reglas de seguridad

- No existe SQL arbitrario configurable.
- El tenant efectivo se resuelve antes de leer fuentes.
- Las fuentes ausentes devuelven `source_unavailable`; no se inventan ceros.
- Los adaptadores registran warnings, exclusiones, conteos, input hash y lineage.

## Estado Paquete 3

Los consumidores centrales de cumplimiento, cobertura, readiness, riesgo, controles, hallazgos, acciones, health y operational excellence consumen el runtime oficial mediante servicios backend. La migracion masiva de dominios de encuestas, assurance, perdidas, continuidad, activos y proveedores corresponde al Paquete 4.

## Paquete 4 completed (2026-07-29T21:20:57Z)

Dominios integrados: encuestas, campanas, assurance, muestreo, perdidas, continuidad, activos y proveedores. Los servicios oficiales viven en `backend/src/services/math-governance/*Calculation.service.js`; `phase5Package4Jobs.service.js` define jobs tenant-scoped e idempotentes.

Validacion: `npm run phase5-5:package4-check` ejecuta integraciones por dominio, PostgreSQL efimero con runs/snapshots/lineage Tenant A/B, aislamiento conceptual y E2E tecnico basado en servicios.
