# Fase 5 - Reconciliacion funcional de indicadores

Fecha de actualizacion: 2026-08-10
Estado del PR: `phase5-functional-closure`
Gate local agregado: `npm run phase5:functional-closure`

## Resultado

- Indicadores funcionales gobernados: 22/22.
- Formulas oficiales con fuente registrada: 53/53.
- Contratos operacionales internos disponibles: 19.
- Fuente externa no disponible por diseno: `external_fx_rates`.
- Cadenas P0 reconciliadas en codigo: acciones/remediacion, incidentes, evidencia vigente, riesgo inherente, riesgo residual, efectividad de control, continuidad, perdidas y supplier health incompleto.
- Dashboard oficial: no sintetiza tendencias desde valor actual y no convierte `official_score` ausente en 0.
- Report/export oficial: consume catalogo/snapshot oficial e incluye `snapshot_id` y `checksum`.

## Indicadores

| Indicador | Formula | Fuente autoritativa | Estado |
|---|---|---|---|
| GRC-HEALTH | `F5_5_GRC_HEALTH` | `grc_health_components` | PASS |
| ISO-READINESS | `F5_5_READINESS` | `grc_readiness_operational_snapshot` | PASS con dependencia pendiente si faltan componentes |
| COMPLIANCE | `F5_5_COMPLIANCE_WEIGHTED` | `compliance_requirements_assessments` | PASS |
| COVERAGE | `F5_5_COVERAGE` | `compliance_requirements_assessments` | PASS |
| RISK-INHERENT | `F5_5_INHERENT_RISK` | `risk_register_controls` | PASS; `likelihood` se normaliza como `probability` |
| RISK-RESIDUAL | `F5_5_RESIDUAL_RISK` | `risk_register_controls` | PASS; requiere efectividad de control real |
| CONTROL-EFFECT | `F5_5_CONTROL_EFFECTIVENESS` | `control_assurance_evidence` | PASS; score global no se copia a D/I/O/E |
| EVIDENCE-FRESH | `F5_5_FRESHNESS_CONTINUOUS` | `evidence_freshness_records` | PASS; no usa data quality como sustituto |
| REMEDIATION | `F5_5_WEIGHTED_PROGRESS` | `audit_findings_actions` | PASS; usa progreso real o ultimo update |
| FINDINGS | `F5_5_SEVERITY_INDEX` | `audit_findings_actions` | PASS |
| ACTIONS | `F5_5_WEIGHTED_PROGRESS` | `audit_findings_actions` | PASS; progreso ausente se excluye |
| AUDIT-ASSURANCE | `F5_5_ASSURANCE_SCORE` | `assurance_test_results` | PASS |
| SUPPLIER-RISK | `F5_5_SUPPLIER_RISK` | `supplier_tprm_assessments` | PASS; componentes ausentes no se fabrican |
| CONTINUITY | `F5_5_SLA_COMPLIANCE` | `continuity_resilience_tests` | PASS |
| INCIDENTS | `F5_5_SEVERITY_INDEX` | `incident_operational_events` | PASS; no usa hallazgos como fuente |
| LOSSES | `F5_5_NET_LOSS` | `loss_events_operational` | PASS; FX externo queda `source_unavailable` |
| DATA-TRUST | `F5_C3_DATA_TRUST` | `indicator_data_trust_assessments` | PASS |
| MATURITY | `F5_5_MATURITY` | `maturity_assessments` | PASS |
| OP-PERFORMANCE | `F5_C3_OPERATIONAL_PERFORMANCE` | `grc_health_components` | PASS; solo outputs oficiales |
| CONTROL-COVERAGE | `F5_5_CONTROL_COVERAGE` | `control_assurance_evidence` | PASS |
| SLA-COMPLIANCE | `F5_5_SLA_COMPLIANCE` | `continuity_resilience_tests` | PASS |
| SUPPLIER-HEALTH | `F5_C3_SUPPLIER_HEALTH` | `supplier_tprm_assessments` | PASS; no calcula con componentes faltantes |

## Evidencia local

`npm run phase5:functional-closure` valida:

- 22 indicadores con contrato disponible;
- 53 formulas reconciliadas;
- `INCIDENTS` vinculado a incidentes reales;
- `EVIDENCE-FRESH` vinculado a evidencia real;
- `ACTIONS/REMEDIATION` con `progress_percent`, `latest_progress_percent`, estado y fechas normalizadas;
- `RISK-INHERENT` con `likelihood/probability`;
- `RISK-RESIDUAL` con efectividad real;
- `CONTROL-EFFECT` rechazando score global duplicado;
- `CONTINUITY`, `LOSSES` y `SUPPLIER-HEALTH` con casos numericos y ausencia controlada;
- dashboard sin tendencia sintetica oficial;
- report/export con contrato de snapshot y checksum.

## Gate CI

El cierre final del PR depende del workflow de GitHub Actions actualizado, que ahora ejecuta tambien:

- `npm run phase5:functional-closure`;
- `npm run phase5-5:browser-e2e`;
- `npm run phase5-5:full-e2e`;
- `npm run phase5-5:cross-view-consistency`;
- `npm run phase5-5:artifact-validation`.
