# Phase 5.5 Formula–Data Equivalence Matrix

Status: implemented for internal operational sources. `external_fx_rates` remains explicitly unavailable until an approved tenant-safe provider is configured.

## Operational flow

`tenant record -> source adapter -> validated dataset -> formula_input -> official formula version -> calculation run/output -> lineage -> consumer`

The resolver returns both `formula_input` and `equivalence`. Missing tables, missing required fields, insufficient samples or absent dimensions produce `source_unavailable`, `empty_dataset` or `unmeasured`; they are never converted to zero.

| Formula | Source contract | Operational columns / normalized input | Final source state |
|---|---|---|---|
| F5_5_COMPLIANCE_WEIGHTED | compliance_requirements_assessments | mapping status/type, coverage and assurance score -> `assessments[]` | available |
| F5_5_COVERAGE | compliance_requirements_assessments | evaluated/applicable mappings -> `evaluated`, `applicable` | available |
| F5_5_READINESS | grc_readiness_operational_snapshot | readiness result dimensions and weights -> `compliance`, `evidence`, `health`, `actions` | available |
| F5_5_INHERENT_RISK | risk_register_controls | probability/likelihood and impact/severity -> `probability`, `impact` | available |
| F5_5_RESIDUAL_RISK | risk_register_controls | exposure or P×I and assurance score -> `inherentRisk`, `controlEffectiveness` | available |
| F5_5_COMBINED_EFFECTIVENESS | control_assurance_evidence | assurance scores -> `effectivenesses[]` | available |
| F5_5_CONTROL_EFFECTIVENESS | control_assurance_evidence | control assurance dimensions or composite score -> `design`, `implementation`, `operation`, `evidence` | available |
| F5_5_CONTROL_COVERAGE | control_assurance_evidence | controls with positive assurance / relevant controls -> coverage counts | available |
| F5_5_FREQUENCY_COMPLIANCE | control_assurance_evidence | effective/completed executions / scheduled records | available |
| F5_5_FAILURE_RATE | assurance_test_results | failed and executed test results | available |
| F5_5_SEVERITY_INDEX | audit_findings_actions | severity counts -> `low`, `medium`, `high`, `critical` | available |
| F5_5_CLOSURE_RATE | audit_findings_actions | action states -> `closed`, `openAtStart`, `created` | available |
| F5_5_MTTC | audit_findings_actions | opened/closed timestamps -> `items[]` | available |
| F5_5_AGE | audit_findings_actions | created/opened timestamps -> `items[]`, `now` | available |
| F5_5_WEIGHTED_PROGRESS | audit_findings_actions | progress and weight -> `items[]` | available |
| F5_5_OVERDUE_RATE | audit_findings_actions | due date and open status -> overdue/open counts | available |
| F5_5_EXPECTED_LOSS | loss_events_operational | event probability/frequency and loss severity | available |
| F5_5_NET_LOSS | loss_events_operational | gross loss and recoveries -> `grossLoss`, `recoveries` | available |
| F5_5_LOSS_SEVERITY | loss_events_operational | net losses -> `netLosses[]` | available |
| F5_5_PARAMETRIC_VAR | loss_events_operational | mean, standard deviation and governed confidence value | available |
| F5_5_MONTE_CARLO | loss_events_operational | governed frequency/severity distribution and deterministic seed | available |
| F5_5_FMEA_RPN | risk_register_controls | severity/impact, occurrence/probability, detection | available |
| F5_5_AVAILABILITY | continuity_resilience_tests | total/downtime or MTBF/MTTR | available |
| F5_5_MTBF | continuity_resilience_tests | operating time and failure count | available |
| F5_5_MTTR | continuity_resilience_tests | repair durations | available |
| F5_5_SLA_COMPLIANCE | continuity_resilience_tests | cases within SLA / applicable cases | available |
| F5_5_RTO_GAP | continuity_resilience_tests | actual recovery and RTO objective | available |
| F5_5_RPO_GAP | continuity_resilience_tests | actual data loss and RPO objective | available |
| F5_5_ASSET_CRITICALITY | asset_inventory_security | classification/metadata CIA and legal impact | available |
| F5_5_SUPPLIER_RISK | supplier_tprm_assessments | criticality, dependency, security, resilience and privacy | available |
| F5_5_SURVEY_SCORE | survey_response_scoring | score, max score, weight and not-applicable state | available |
| F5_5_CRONBACH_ALPHA | survey_response_scoring | compatible item-response matrix by dimension | available |
| F5_5_RESPONSE_RATE | survey_response_scoring | submitted / invited recipients | available |
| F5_5_DROPOUT_RATE | survey_response_scoring | started-not-submitted / started | available |
| F5_5_ASSURANCE_SCORE | assurance_test_results | result state and weight | available |
| F5_5_SAMPLE_SIZE | statistical_metric_measurements | population, confidence, expected proportion and error | available |
| F5_5_COMPLETENESS | data_quality_observations | expected and valid/observed counts | available |
| F5_5_ACCURACY | data_quality_observations | validated correct / validated records | available |
| F5_5_CONSISTENCY | data_quality_observations | consistent / compared records | available |
| F5_5_FRESHNESS_CONTINUOUS | data_quality_observations | assessed/observed timestamp and freshness policy | available |
| F5_5_LINEAGE_SCORE | data_lineage_observations | lineage completeness/validity observations | available |
| F5_5_Z_SCORE | statistical_metric_measurements | value, mean and standard deviation | available |
| F5_5_ROBUST_Z_SCORE | statistical_metric_measurements | value, median and MAD | available |
| F5_5_LINEAR_TREND | statistical_metric_measurements | ordered measurement points | available |
| F5_5_PERCENT_VARIATION | statistical_metric_measurements | current and previous measurements | available |
| F5_5_MOVING_AVERAGE | statistical_metric_measurements | ordered values and governed window | available |
| F5_5_EMA | statistical_metric_measurements | ordered values and governed alpha/window | available |
| F5_5_CONFIDENCE_INTERVAL | statistical_metric_measurements | sample values/proportion and confidence | available |
| F5_5_GRC_HEALTH | grc_health_components | latest official risk, compliance, actions, evidence and Data Trust outputs | available |
| F5_5_MATURITY | maturity_assessments | published evaluation levels/scores and weights | available |

## External currency conversion

`external_fx_rates` remains `source_unavailable`. Loss calculations remain currency-specific, do not mix currencies and do not invent conversion rates. This is a controlled external dependency, not an internal implementation debt.

## Verification gates

- 50 formula bindings are mandatory.
- Internal `legacy_adapter_required` and `partially_available` states are rejected by `phase5-5:source-binding-check`.
- Only `external_fx_rates` may remain `source_unavailable`.
- Resolver tests verify representative compliance, coverage, risk, residual risk, control effectiveness and findings mappings.
- Every resolved dataset remains tenant-scoped, period-aware, hashed and lineage-enabled.
