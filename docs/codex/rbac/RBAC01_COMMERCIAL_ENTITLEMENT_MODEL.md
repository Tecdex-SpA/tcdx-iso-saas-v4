# RBAC-01 Commercial Entitlement Model

Status: `COMPLETE_LOCAL`

## Authorization Formula

Effective authorization is:

```text
ALLOW =
  USER_PERMISSION_GRANTED
  && COMMERCIAL_ENTITLEMENT_GRANTED
  && MODULE_ACTIVE
  && RESOURCE_SCOPE_ALLOWED_WHEN_APPLICABLE
```

For capabilities without resource-level scope, omit only the final scope term.

## Implemented Authority Layer

`backend/src/services/commercial/entitlementResolver.service.js` now keeps module activity in each capability decision:

- `module_key`
- `module_active`
- `reason_code=MODULE_NOT_ACTIVE` when an entitled capability belongs to an inactive/missing module

`backend/src/middleware/commercialEntitlement.middleware.js` treats `MODULE_NOT_ACTIVE` as a commercial denial.

## Product Taxonomy

| Product concept | Included scope | Excluded unless separately entitled |
|---|---|---|
| ISO | ISO compliance, controls, evidence, audits, findings/nonconformities, actions, ISO reports/metrics, ISO risk and ISO risk matrix. | Advanced operational risk, BIA, advanced privacy, data governance. |
| ISO + Riesgo Operativo | ISO plus operational-risk capabilities actually entitled and active. | Other GRC domains not entitled. |
| GRC | Integrated GRC capabilities that are entitled and module-active. | Any module/capability outside entitlement or inactive module state. |

## ISO Risk Boundary

`ISO Risk` is not the same product surface as advanced operational risk. ISO risk and risk matrix remain available through ISO/risk permissions and active ISO modules. Advanced operational risk, BIA and resilience capabilities require separate entitlement and active module state.

