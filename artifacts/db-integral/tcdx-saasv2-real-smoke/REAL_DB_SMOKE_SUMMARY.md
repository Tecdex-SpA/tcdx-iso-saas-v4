# TCDX SaaSv2 Real Smoke Summary

Status: `TCDX_SAASV2_REAL_SMOKE_READY_FOR_BACKEND_CUTOVER_REVIEW`

- `formula_version_id` PRODUCT_DEFECT: `RESOLVED` (`persistFunctionalFailure` preserves `formula.version` as `formula_version`)
- calculation_outputs blockage classification: `HARNESS_DEFECT`
- DB objetivo: `tcdx_saasv2`
- DB validada: `tcdx_saasv2`
- PostgreSQL: `16.15`
- Tenants sinteticos: `0875c4c4-0f79-45b3-a4bd-ea4b1be54b7f`, `c939191a-84d3-452e-8c73-e5d473f55f06`
- Formulas ejecutadas: `F5_5_COMPLIANCE_WEIGHTED`, `F5_5_COVERAGE`, `F5_5_RESIDUAL_RISK`, `F5_5_WEIGHTED_PROGRESS`, `F5_5_FRESHNESS_CONTINUOUS`, `F5_5_GRC_HEALTH`
- Indicadores publicados: `COMPLIANCE`, `RISK-RESIDUAL`, `REMEDIATION`, `EVIDENCE-FRESH`, `DATA-TRUST`, `GRC-HEALTH`
- Runtime counts: `{"runs":18,"outputs":18,"source_snapshots":18,"metric_snapshots":6}`
- Health A/B: `{"tenantA":{"status":"calculated","value":95.8,"canonical_output_value":95.8,"output_shape":["status","value"],"numeric_value_column":null},"tenantB":{"status":"unmeasured","value":null,"reason":"FORMULA_INSUFFICIENT_COVERAGE","canonical_output_value":null,"output_shape":["status","value"],"numeric_value_column":null}}`
- calculation_outputs contract: `{"classification":"HARNESS_DEFECT","canonical_numeric_value":"calculation_outputs.output_value.value","numeric_value_role":"nullable compatibility/projection column; not written by current official runtime persistence"}`
- Leakage: `0`
- Source contracts: `{"registered":20,"formula_sources":17}`
- Post-cleanup counts: `{"tenants":0,"iso_standards":3,"iso_standard_versions":4,"iso_controls":61,"iso_evidence_expectations":54,"controls_catalog":83,"formula_definitions":53,"formula_versions":53,"source_contracts":20,"metric_definitions":22,"metric_source_bindings":22,"knowledge_items":1000,"valid_formula_source_links":53,"distinct_formula_source_codes":17,"legacy_object_count":0}`
- Error: `none`
