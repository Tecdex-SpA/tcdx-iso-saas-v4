# Source Availability Matrix

Estado final del hotfix de equivalencias: las fuentes operacionales internas tienen adaptador ejecutable, tenant scope, validación, snapshot, hash, lineage y mapeo explícito a variables de fórmula. No se inventan ceros para fuentes vacías o incompletas.

| Fuente | Dominio | Tablas operacionales | Estado | Normalización principal | Limitación controlada |
|---|---|---|---|---|---|
| `compliance_requirements_assessments` | Cumplimiento y cobertura | `grc_framework_requirements`, `grc_requirement_control_mappings`, `grc_control_assurance` | available | mapping/status/coverage/assurance -> assessment status, weight y applicability | Requisitos sin mapping permanecen pendientes/unmeasured. |
| `grc_readiness_operational_snapshot` | Readiness | `grc_readiness_snapshots`, `grc_readiness_results`, `grc_readiness_findings` | available | dimensiones y pesos del último snapshot -> compliance/evidence/health/actions | Dimensión ausente no se imputa. |
| `risk_register_controls` | Riesgo y FMEA | `grc_quantitative_risk_assessments` o fallback `iso_risk_matrix_items`; assurance asociado | available | probability/likelihood, impact/severity, exposure e indicadores FMEA | No se inventan escalas ausentes. |
| `control_assurance_evidence` | Controles | `grc_control_assurance` y evidencia relacionada | available | score/dimensiones -> design, implementation, operation, evidence y effectivenesses | Score compuesto se declara cuando no hay dimensiones separadas. |
| `audit_findings_actions` | Hallazgos y acciones | `grc_readiness_findings`, `action_plans`, `grc_effectiveness_verifications` | available | severidad, estados, fechas, progreso, peso y vencimiento -> variables de cierre/edad/avance | Campos ausentes se excluyen con warning. |
| `loss_events_operational` | Pérdidas | `loss_events`, `loss_recoveries` | available | pérdida bruta, recuperaciones, pérdida neta y moneda | Monedas se mantienen separadas. |
| `continuity_resilience_tests` | Continuidad | `grc_bia_assessments`, `grc_continuity_plans`, `grc_continuity_tests` | available | RTO/RPO, recovery, data loss, resultados y tiempos | Unidad horas obligatoria. |
| `asset_inventory_security` | Activos | `data_elements` | available | clasificación y metadata CIA/legal -> criticidad | Se conserva el binding actual hasta inventario dedicado. |
| `supplier_tprm_assessments` | Proveedores | `grc_suppliers`, `grc_supplier_assessments`, `grc_supplier_answers`, `grc_supplier_contracts` | available | criticidad, dependencia, seguridad, resiliencia y privacidad | Sin limitación interna pendiente. |
| `survey_response_scoring` | Encuestas | tablas de definiciones, campañas, respuestas e ítems | available | score, máximo, peso y no-aplica -> scoring/cobertura/fiabilidad | Cronbach exige muestra y dimensión compatibles. |
| `assurance_test_results` | Assurance | definiciones, ejecuciones, muestras, resultados y excepciones | available | resultado y peso -> assurance/failure rate | Inconclusive no se convierte en pass. |
| `data_quality_observations` | Calidad de datos | reglas, assessments y validaciones | available | expected/valid/invalid/coverage/timestamps -> quality formulas | Sin ceros ficticios. |
| `data_lineage_observations` | Lineage | `data_lineage_edges`, `data_sources`, `data_elements` | available | relaciones válidas -> lineage score | Profundidad y tenant controlados. |
| `statistical_metric_measurements` | Estadística | `metric_measurements`, `metric_definitions`, `metric_dimensions` | available | serie temporal y dimensiones -> tendencia, anomalías e intervalos | Historia insuficiente retorna estado explícito. |
| `grc_health_components` | GRC Health | `calculation_runs`, `calculation_outputs`, `data_trust_scores` | available | últimos outputs oficiales -> risk/compliance/actions/evidence/dataTrust | Health queda unmeasured si falta un componente obligatorio. |
| `maturity_assessments` | Madurez | `survey_evaluations` o fallback `metric_measurements` | available | level/score/numeric value y weight -> maturity items | No infiere nivel sin evaluación. |
| `external_fx_rates` | Conversión monetaria | proveedor externo futuro | source_unavailable | no aplica | Única fuente no disponible: no hay proveedor tenant-safe aprobado; el sistema no mezcla monedas ni inventa tasas. |

## Criterios de cierre

- 50 fórmulas con source binding.
- 16 contratos internos `available`.
- 0 contratos internos `legacy_adapter_required`.
- 0 contratos internos `partially_available`.
- Solo `external_fx_rates` permanece `source_unavailable`.
- `phase5-5:source-binding-check` falla ante cualquier regresión de esos estados.
- La matriz detallada dato -> variable -> fórmula está en `formula-data-equivalence-matrix.md`.
