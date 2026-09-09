# Formula Authority Matrix

Generated from `FORMULAS`, `sourceContracts.service.js` and `functionalIndicatorCatalog.js` during DB integral review.

Total formulas inventoried: 53
ACTIVE_OFFICIAL: 53
Source contracts declared: 20

| formula_code | status | source_contract | binding | version | runtime consumer | legacy dependency | golden test | runtime E2E result |
|---|---:|---|---|---:|---|---|---|---|
| F5_5_COMPLIANCE_WEIGHTED | ACTIVE_OFFICIAL | compliance_requirements_assessments | VALID | 1 | COMPLIANCE | NO | PASS | PASS |
| F5_5_COVERAGE | ACTIVE_OFFICIAL | compliance_requirements_assessments | VALID | 1 | COVERAGE | NO | PASS | PASS |
| F5_5_READINESS | ACTIVE_OFFICIAL | grc_readiness_operational_snapshot | VALID | 1 | ISO-READINESS | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_INHERENT_RISK | ACTIVE_OFFICIAL | risk_register_controls | VALID | 2 | RISK-INHERENT | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_RESIDUAL_RISK | ACTIVE_OFFICIAL | risk_register_controls | VALID | 1 | RISK-RESIDUAL | NO | PASS | PASS |
| F5_5_COMBINED_EFFECTIVENESS | ACTIVE_OFFICIAL | control_assurance_evidence | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_CONTROL_EFFECTIVENESS | ACTIVE_OFFICIAL | control_assurance_evidence | VALID | 2 | CONTROL-EFFECT | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_CONTROL_COVERAGE | ACTIVE_OFFICIAL | control_assurance_evidence | VALID | 1 | CONTROL-COVERAGE | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_FREQUENCY_COMPLIANCE | ACTIVE_OFFICIAL | control_assurance_evidence | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_FAILURE_RATE | ACTIVE_OFFICIAL | assurance_test_results | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_SEVERITY_INDEX | ACTIVE_OFFICIAL | audit_findings_actions | VALID | 1 | FINDINGS, INCIDENTS | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_CLOSURE_RATE | ACTIVE_OFFICIAL | audit_findings_actions | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_MTTC | ACTIVE_OFFICIAL | audit_findings_actions | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_AGE | ACTIVE_OFFICIAL | audit_findings_actions | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_WEIGHTED_PROGRESS | ACTIVE_OFFICIAL | audit_findings_actions | VALID | 1 | REMEDIATION, ACTIONS | NO | PASS | PASS |
| F5_5_OVERDUE_RATE | ACTIVE_OFFICIAL | audit_findings_actions | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_EXPECTED_LOSS | ACTIVE_OFFICIAL | loss_events_operational | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_NET_LOSS | ACTIVE_OFFICIAL | loss_events_operational | VALID | 1 | LOSSES | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_LOSS_SEVERITY | ACTIVE_OFFICIAL | loss_events_operational | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_PARAMETRIC_VAR | ACTIVE_OFFICIAL | loss_events_operational | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_MONTE_CARLO | ACTIVE_OFFICIAL | loss_events_operational | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_FMEA_RPN | ACTIVE_OFFICIAL | risk_register_controls | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_AVAILABILITY | ACTIVE_OFFICIAL | continuity_resilience_tests | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_MTBF | ACTIVE_OFFICIAL | continuity_resilience_tests | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_MTTR | ACTIVE_OFFICIAL | continuity_resilience_tests | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_SLA_COMPLIANCE | ACTIVE_OFFICIAL | continuity_resilience_tests | VALID | 1 | CONTINUITY, SLA-COMPLIANCE | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_RTO_GAP | ACTIVE_OFFICIAL | continuity_resilience_tests | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_RPO_GAP | ACTIVE_OFFICIAL | continuity_resilience_tests | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_ASSET_CRITICALITY | ACTIVE_OFFICIAL | asset_inventory_security | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_SUPPLIER_RISK | ACTIVE_OFFICIAL | supplier_tprm_assessments | VALID | 1 | SUPPLIER-RISK | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_SURVEY_SCORE | ACTIVE_OFFICIAL | survey_response_scoring | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_CRONBACH_ALPHA | ACTIVE_OFFICIAL | survey_response_scoring | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_RESPONSE_RATE | ACTIVE_OFFICIAL | survey_response_scoring | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_DROPOUT_RATE | ACTIVE_OFFICIAL | survey_response_scoring | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_ASSURANCE_SCORE | ACTIVE_OFFICIAL | assurance_test_results | VALID | 1 | AUDIT-ASSURANCE | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_SAMPLE_SIZE | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_COMPLETENESS | ACTIVE_OFFICIAL | data_quality_observations | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_ACCURACY | ACTIVE_OFFICIAL | data_quality_observations | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_CONSISTENCY | ACTIVE_OFFICIAL | data_quality_observations | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_FRESHNESS_CONTINUOUS | ACTIVE_OFFICIAL | data_quality_observations | VALID | 1 | EVIDENCE-FRESH | NO | PASS | PASS |
| F5_5_LINEAGE_SCORE | ACTIVE_OFFICIAL | data_lineage_observations | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_Z_SCORE | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_ROBUST_Z_SCORE | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_LINEAR_TREND | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_PERCENT_VARIATION | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_MOVING_AVERAGE | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_EMA | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_CONFIDENCE_INTERVAL | ACTIVE_OFFICIAL | statistical_metric_measurements | VALID | 1 | officialCalculationOrchestrator/direct registry only | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_5_GRC_HEALTH | ACTIVE_OFFICIAL | grc_health_components | VALID | 2 | GRC-HEALTH | NO | PASS | PASS |
| F5_5_MATURITY | ACTIVE_OFFICIAL | maturity_assessments | VALID | 1 | MATURITY | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_C3_DATA_TRUST | ACTIVE_OFFICIAL | indicator_data_trust_assessments | VALID | 1 | DATA-TRUST | NO | PASS | PASS |
| F5_C3_OPERATIONAL_PERFORMANCE | ACTIVE_OFFICIAL | grc_health_components | VALID | 1 | OP-PERFORMANCE | NO | PASS | REGISTRY_GOLDEN_ONLY |
| F5_C3_SUPPLIER_HEALTH | ACTIVE_OFFICIAL | supplier_tprm_assessments | VALID | 1 | SUPPLIER-HEALTH | NO | PASS | REGISTRY_GOLDEN_ONLY |

Classification: all 53 published registry formulas are treated as ACTIVE_OFFICIAL for numeric golden integrity. Runtime E2E was executed for the clean-tenant chain needed to publish Health: compliance, coverage, residual risk, weighted progress, evidence freshness, Data Trust, and GRC Health.
