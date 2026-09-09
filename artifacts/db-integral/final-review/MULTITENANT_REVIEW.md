# Multitenant Review

Status: PASS with RLS rollout still staged/partial by design.

Assertions reproduced:

- Cross-tenant insert into `findings(tenant_id, tenant_control_id)` fails when child and parent tenant differ.
- `MULTITENANT_VALIDATION PASS`.
- Tenant context is transaction-local: Tenant A context, Tenant B context and no-context query do not leak GUC state.
- `FORMULA_CROSS_TENANT_LEAKAGE=0`.
- Integrity check reports no invalid cross-tenant links for findings, evidences, action plans, tenant controls, risks or audits in the fresh scenario.

Scope reviewed:

- `tenant_controls`, `findings`, `evidences`, `action_plans`, `risks`, `risk_control_relations`, calculation runs/outputs/snapshots and metric snapshots are tenant-scoped in the fresh gates.
- Backend runtime tenant context uses `dbTenantContext.js` with transaction-local `set_config(..., true)`.
- Platform path is explicit and role-gated.

RLS status:

- Do not claim universal RLS.
- DB-N03/DB-N04 posture remains staged/partial: RLS policies are prepared, broad `ENABLE/FORCE RLS` is deferred until AI reader or tenant-safe views are proven and route/runtime validation is authorized.

Clean tenant:

- `CLEAN_TENANT_BOOTSTRAP PASS`.
- Synthetic tenants used deterministic local IDs, not QA/customer IDs.
- Bootstrap path verified: tenant -> plan/capabilities -> standards -> tenant_controls -> SoA -> evidence/finding/action/risk -> source config -> formulas -> outputs/snapshots -> metric snapshots -> Health projection/API source.
