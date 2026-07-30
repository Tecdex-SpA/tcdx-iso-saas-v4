# Source Contracts

Estado global: APPROVED_FOR_REVIEW sujeto a CI remoto del commit final.

Los contratos viven en `backend/src/services/math-governance/sourceContracts.service.js`. Cada contrato declara fuente, entidad, tablas, columnas, joins, tenant scope, período, timezone, unidad, campos obligatorios, exclusiones, política de nulos, disponibilidad, versión, adaptador, equivalencia de variables y checksum.

## Reglas de seguridad y confiabilidad

- No existe SQL arbitrario configurable.
- El tenant efectivo y los permisos se validan antes de leer fuentes.
- Los períodos se parametrizan; no se concatenan valores de usuario en SQL.
- Las fuentes vacías, incompletas o ausentes devuelven estados explícitos; no se inventan ceros.
- Los datasets registran warnings, exclusiones, conteos, input hash, source snapshot y lineage.
- Las equivalencias se exponen como `variable_map` y se persisten en metadata del contrato oficial.
- Las fórmulas consumen `formula_input` normalizado, no nombres de columnas implícitos.

## Estado final de disponibilidad

- 16 contratos internos: `available`.
- 0 contratos internos: `legacy_adapter_required`.
- 0 contratos internos: `partially_available`.
- 1 contrato externo: `external_fx_rates = source_unavailable`.

La ausencia de FX es deliberada: no existe un proveedor tenant-safe aprobado. Los cálculos de pérdida conservan la moneda original, no mezclan monedas y no inventan tasas.

## Adaptadores cerrados por el hotfix

- Cumplimiento y cobertura: requirements + mappings + assurance.
- Readiness: último snapshot y resultados por dimensión.
- Riesgos y FMEA: evaluación cuantitativa o fallback de matriz ISO.
- Controles: assurance y evidencia.
- Hallazgos y acciones: findings + action plans.
- GRC Health: calculation runs y outputs oficiales.
- Madurez: evaluaciones publicadas o mediciones de madurez.

## Validación

- `npm run phase5-5:source-binding-check` exige 50 bindings, cero contratos internos pendientes y solo FX como fuente no disponible.
- `sourceResolver.test.js` verifica equivalencias representativas de cumplimiento, cobertura, riesgo, riesgo residual, controles, hallazgos y madurez.
- `formula-data-equivalence-matrix.md` documenta las 50 fórmulas.
- Los checks PostgreSQL y E2E de Fase 5.5 continúan siendo las puertas de aceptación antes de merge y deploy.
