# Clean Tenant Bootstrap

Status: PASS in isolated PostgreSQL formula E2E.

Synthetic tenants were created from the fresh baseline with no QA IDs, no legacy rows and no manual remediation:

tenant -> tenant_standards -> tenant_operations -> tenant_controls -> control_soa_assessments -> evidences -> action_plans/action_plan_updates -> risks/risk_control_relations -> official formula calculation -> calculation_runs -> calculation_outputs -> calculation_snapshots -> metric_snapshots -> Health projection/API source.

Tenant A inputs:

- SoA assessment: `compliant`.
- Evidence: approved, validated, fresh in September 2026 period.
- Action progress: `80%` through `action_plan_updates`.
- Risk: likelihood `2`, impact `3`, control effectiveness `70%` from `risks.metadata` + `risk_control_relations`.

Tenant B inputs:

- SoA assessment: `non_compliant`.
- Evidence: approved/validated but expired outside September 2026 period.
- Action progress: `20%`.
- Risk: likelihood `4`, impact `5`, control effectiveness `10%`.

Result:

- Tenant outputs differ without artificial offsets.
- `FORMULA_CROSS_TENANT_LEAKAGE=0`.
- Tenant A GRC Health calculated and publishable.
- Tenant B GRC Health unmeasured with `FORMULA_INSUFFICIENT_COVERAGE`.
