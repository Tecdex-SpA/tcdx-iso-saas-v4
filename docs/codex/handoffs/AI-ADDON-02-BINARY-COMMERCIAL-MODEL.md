# AI-ADDON-02 Binary Commercial Model Handoff

Status: `AI_ADDON02_BINARY_COMMERCIAL_MODEL_READY_FOR_HUMAN_REVIEW`

Branch/base:

```text
branch: main
HEAD: 1f54177
production modified by Codex: NO
commit/push/deploy by Codex: NO
```

## Scope

Close the residual legacy AI plan gates after AI-ADDON-01. Commercial AI authority is binary and tenant-scoped:

```text
AI_COMMERCIAL_AUTHORITY = tenant_subscription_addons.ai
AI_PLAN_AUTHORITY = NO
AI_PLAN_VISIBLE_IN_ADMIN_SAAS = NO
AI_ADDON_BINARY = YES
```

## Root Cause

The tenant AI runtime normalization still treated `ai_plan='none'` as disabled even when the contractual AI add-on was active. The frontend entitlement hook repeated the same `plan !== 'none'` guard, and Admin SaaS still exposed a legacy AI plan selector.

## Changes

- `backend/src/services/tenantAiSettings.service.js` no longer uses `ai_plan` to enable or deny AI runtime settings.
- `backend/src/routes/me.routes.js` no longer derives `/api/me/entitlements.ai.enabled` from `ai_plan`; enabled AI reports plan as `addon`.
- `frontend/src/hooks/useTenantEntitlements.ts` trusts backend `ai.enabled` and does not apply a legacy plan gate.
- `frontend/src/app/admin-saas/page.tsx` removes the visible AI plan badge/select and stops sending `ai_plan` from the runtime settings form.
- `backend/src/services/commercial/aiAddonCommercial.contract.test.js` covers six base-plan/add-on combinations, legacy `ai_plan='none'` with active add-on, legacy `ai_plan` with inactive add-on, and active -> cancelled -> active reactivation.
- `frontend/scripts/check-commercial-visibility-entitlement-contract.mjs` guards against reintroducing frontend `ai_plan` authority or Admin SaaS AI plan selection.

## Auditor Senior

`Auditor Senior` is an IA feature/surface, not a commercial plan. It is implemented through AI compliance/auditor flows and remains governed by `ai.auditor` or `ai.compliance` plus runtime flags/RBAC/scope. It cannot operate without active AI add-on entitlement.

## Migration

Migration required: `NO`.

Historical migrations modified: `NO`.

AI Add-on migration modified: `NO`.

## Validation

Local validation PASS:

```text
git diff --check
node backend/src/services/commercial/aiAddonCommercial.contract.test.js
node backend/src/services/commercial/contractSubscriptionSync.service.test.js
node backend/src/services/commercial/commercialPlanMatrix.contract.test.js
node backend/src/services/commercial/rbac02CommercialGating.service.test.js
node backend/src/services/commercial/commercial.service.test.js
node backend/src/services/auth/rbac01Authorization.service.test.js
node backend/src/middleware/rbac.middleware.test.js
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test:phase6-sidebar-rbac
npm --prefix frontend run test:phase6-commercial-multitenant
node scripts/rbac02/build-rbac02-route-matrix.js
npm --prefix frontend run build
git diff -- frontend/tsconfig.json
```

Route matrix:

```text
routes=97
missing=0
```

## Runtime Gate

Next gate remains human review, commit, push, official deploy and runtime validation. Codex did not deploy or apply production migrations.
