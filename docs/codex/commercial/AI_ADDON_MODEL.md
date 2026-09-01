# AI Add-on Commercial Model

Status: `READY_FOR_HUMAN_REVIEW_LOCAL`

Production modified: `NO`

## Rule

AI is a transversal add-on over the base commercial plan.

```text
base plan entitlement
AND active AI add-on
AND AI runtime enabled
AND specific AI feature enabled
AND RBAC allowed
AND scope allowed
```

No base plan, legacy plan row, frontend visibility check or runtime flag can grant AI without the contractual add-on.

`tenants.ai_plan` is legacy compatibility only:

- It is not commercial authority.
- It does not grant access.
- It does not deny access.
- It is not visible/selectable as an AI commercial plan in Admin SaaS.

## Valid Commercial States

```text
ISO
ISO + AI
ISO + Riesgo Operativo
ISO + Riesgo Operativo + AI
GRC
GRC + AI
```

AI capabilities:

- `ai.compliance`
- `ai.auditor`

Canonical add-on key:

- `ai`

## Authority

Backend/PostgreSQL remains the commercial authority:

- `commercial_addons`
- `plan_version_addons`
- `tenant_subscription_addons.addon_key='ai'`
- `v_commercial_tenant_modules`
- `v_commercial_tenant_capabilities`
- `backend/src/services/commercial/entitlementResolver.service.js`
- `backend/src/services/commercial/commercialAdmin.service.js`

Admin SaaS may configure AI runtime only after the AI add-on is contracted. Runtime AI settings are subordinate to the commercial add-on.

## Migration

Forward-only migration:

```text
database/migrations/20260831_ai_addon_commercial_visibility.sql
```

Runner:

```text
scripts/ai-addon/apply-ai-addon-migration.js
```

The historical `20260828_commercial_standard_plan_matrix.sql` migration is not rewritten. It keeps its original historical classification, and this model corrects behavior forward.
