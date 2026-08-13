# PRE-UI — Official metrics source reconciliation

## Estado

`READY_FOR_INTERMEDIATE_MERGE_REVIEW` una vez que el CI del commit documental finalice en verde.

Esta remediación se ejecuta antes de UI 1/4 y no modifica diseño visual, RBAC, infraestructura, fórmulas matemáticas oficiales ni separación Admin KPI / Official KPI.

## Objetivo

Corregir falsos estados de insuficiencia originados por la resolución y validación de fuentes operacionales, preservando estados de insuficiencia legítimos y evitando cualquier lógica específica por tenant o cliente.

## Root causes confirmados

| Área | Root cause | Corrección |
| --- | --- | --- |
| Validación temporal | El validador podía volver a evaluar múltiples timestamps auxiliares de una fila aunque el adapter ya hubiese definido un `__event_time` canónico. Un `created_at` histórico podía invalidar una observación cuyo evento efectivo sí pertenecía al período. | Si existe `__event_time`, éste gobierna la validación temporal. Los timestamps legacy sólo se usan cuando el adapter no entrega evento canónico. |
| Contabilidad de exclusiones | `excludedCount` contabilizaba problemas individuales y no filas excluidas. Una sola fila con varios defectos podía sumar múltiples exclusiones y producir `excluded > received`. | `excludedCount` representa filas inválidas. Se preserva `exclusionIssueCount` para observabilidad de causas individuales. |
| Riesgo vigente | El resolver genérico trataba el registro de riesgo como flujo de eventos del período. Riesgos vigentes creados en períodos anteriores podían desaparecer del universo. | `iso_risk_matrix_items` se resuelve desde el último run válido por norma/versión con fecha efectiva `<= period.end` y estados no rechazados/archivados. |
| Riesgo residual | El mapping no reconocía el campo canónico `control_effectiveness_score`. | Se incorpora como alias válido sin modificar la fórmula. |
| Control assurance | La selección explícita debía conservar las dimensiones reales usadas por `F5_5_CONTROL_EFFECTIVENESS`. | El adapter conserva `a.*`, normaliza `assurance_status` a `status` y usa `calculated_at` como evento efectivo. No fabrica dimensiones. |
| Continuidad | Faltaba adapter canónico para `grc_continuity_tests`. | Se usan tests completados; RTO/RPO se normalizan a horas y estados completados se mapean a `within_sla`/`failed` según resultado y cumplimiento de objetivos. Planned/draft/scheduled/cancelled no se consideran mediciones completadas. |
| Assurance | Se podía resolver sobre entidades que no representan resultado de prueba. | `assurance_test_results` se usa como fuente de resultados cuando existe, normalizando pass/fail sin sustituir resultados por counts de definiciones. |
| Proveedores | Un score agregado no puede representar simultáneamente todas las dimensiones exigidas por Supplier Risk/Health. | El adapter expone únicamente dimensiones explícitas presentes en la fuente. No se replica `score` para fabricar compliance/security/dependency/privacy/resilience. |
| Fallback legacy | El copy indicaba “sin filas utilizables” aun cuando el fallback se decide antes de la validación contractual. | Se aclara que el fallback corresponde a ausencia de filas de la fuente primaria en el período. No se usa para ocultar errores del adapter. |

## Semántica preservada

- No se cambian fórmulas `F5_5_*` ni sus pesos.
- No existe `null -> 0`.
- No existe fallback a Admin KPI.
- No se insertan `metric_measurements`, snapshots ni calculation runs manuales.
- No se introducen tenant IDs, nombres de clientes, emails, períodos fijos ni datos demo.
- El tenant continúa siendo parámetro obligatorio de todas las consultas operacionales agregadas/modificadas.
- Las fuentes con datos realmente insuficientes continúan pudiendo devolver `empty_dataset`, `insufficient_data` o `dependency_pending` según el pipeline existente.

## Data Trust

La remediación separa dos conceptos que antes podían confundirse:

- `excludedCount`: número de filas excluidas.
- `exclusionIssueCount`: número total de causas detectadas en dichas filas.

Para un mismo universo se mantiene la invariancia:

`0 <= usable <= received`

`0 <= excluded <= received`

Los detalles de causas continúan disponibles mediante `exclusions` e `invalid_rows`.

## Multi-tenant / zero-hardcode

La lógica utiliza únicamente:

- `tenantId` efectivo recibido por el resolver;
- período solicitado;
- tablas y campos detectados por contrato/adapters;
- estados y timestamps del dominio.

No existe tratamiento especial para un tenant, dataset, cliente, UUID o período conocido.

## Validación CI

En el commit productivo `6f4b8c2870f127e251efb76d9d8e25f6259b944a`, GitHub Actions run `31740855531` concluyó `success`.

Pasaron, entre otros:

- Backend tests.
- Backend syntax check.
- Demo tenant production contracts / disposable PostgreSQL.
- Phase 5 migration syntax/checksum.
- Phase 5.5 source bindings/equivalence.
- Phase 5.5 PostgreSQL source adapters.
- Phase 5.5 formula snapshot contract.
- Phase 5.5 production acceptance.
- Phase 5 functional closure.
- Phase 5-C2/C3 contracts e integración PostgreSQL.
- Phase 1 permissions e isolation contracts.
- Frontend lint, typecheck, build.
- Phase 5-C2/C3 browser E2E.
- Phase 5.5 browser E2E/cross-view consistency.
- Phase 5.5 report/export artifact validation.

El commit documental posterior debe volver a pasar el mismo CI antes de marcar el PR listo para review.

## Gates pre-merge

- `SOURCE_ADAPTER_GENERALIZATION = PASS`
- `SOURCE_PERIOD_FILTERING = PASS`
- `EXCLUSION_ACCOUNTING_INCONSISTENCY = 0`
- `ADMIN_OFFICIAL_CROSSOVER = 0` (sin cambio de arquitectura)
- `OFFICIAL_NULL_TO_ZERO = 0`
- `CROSS_TENANT_DATA_LEAKAGE = 0` (regresión de aislamiento en CI)
- `NEW_TENANT_CODE_CHANGE_REQUIRED = NO`
- `NEW_TENANT_SQL_PATCH_REQUIRED = NO`
- `PHASE5_REGRESSION = 0`
- `ZERO_HARDCODE = PASS`
- `SELLABLE_MULTI_TENANT = PASS` para la implementación pre-merge, sujeto a validación runtime post-deploy antes del cierre definitivo.

## Validación pendiente por diseño del workflow

La validación contra runtime productivo se ejecuta sólo después del merge/deploy. Por tanto esta etapa no declara cierre definitivo de producción. El estado correcto antes del merge es `READY_FOR_INTERMEDIATE_MERGE_REVIEW`.

## Próxima acción

Cuando el CI del commit documental quede verde: review/merge explícito del PR #90. Después del deploy ejecutar validación runtime de métricas oficiales y Data Trust antes de iniciar UI 1/4.
