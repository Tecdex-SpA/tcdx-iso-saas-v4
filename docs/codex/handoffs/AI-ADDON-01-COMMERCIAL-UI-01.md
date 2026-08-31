# AI-ADDON-01 + COMMERCIAL-UI-01 Handoff

Status: `AI_ADDON01_COMMERCIAL_UI01_READY_FOR_HUMAN_REVIEW`

Branch/base:

```text
branch: main
HEAD: 6dc752b
production modified by Codex: NO
commit/push/deploy by Codex: NO
```

## Scope

Close local validation for the forward-only AI add-on commercial model and commercial UI visibility.

AI is now a transversal commercial add-on, not a base-plan entitlement. Valid states:

```text
ISO
ISO + AI
ISO + Riesgo Operativo
ISO + Riesgo Operativo + AI
GRC
GRC + AI
```

Historical migration `database/migrations/20260828_commercial_standard_plan_matrix.sql` was not modified. Its historical GRC classification is preserved; `20260831_ai_addon_commercial_visibility` is the forward-only correction.

## Local Changes Confirmed

- `backend/src/services/commercial/entitlementResolver.service.js` enforces `ai.compliance` and `ai.auditor` fail-closed unless an active AI add-on exists.
- `backend/src/services/commercial/contractSubscriptionSync.service.js` preserves open add-ons with status `active` or `suspended` during plan replacement when not expired/cancelled.
- `backend/src/services/commercial/commercialAdmin.service.js` exposes `setTenantAddonStatus()` for active/suspended/cancelled add-on lifecycle.
- `backend/src/middleware/rbac.middleware.js` maps `PUT /api/admin-saas/tenants/:tenantId/addons/:addonKey` to `commercial.subscription.manage`.
- `backend/src/middleware/rbac.middleware.test.js` covers the add-on endpoint rule and denial for tenant admin without platform commercial-management permission.
- `frontend/src/components/Sidebar.tsx` and `frontend/src/components/AppLayout.tsx` use effective `canShowCapability()` for final visibility/direct-access protection.
- `frontend/src/app/dashboard/page.tsx` gates advanced/dashboard fetch and render blocks by effective commercial capability.
- `frontend/src/app/admin-saas/page.tsx` separates AI contract state from runtime AI settings and keeps general tenant fields independent from AI add-on state.
- `scripts/deploy-vms.sh` registers `AI Add-on|scripts/ai-addon/apply-ai-addon-migration.js` after Commercial Plan Matrix and before application deploy.

## Migration

```text
historical: database/migrations/20260828_commercial_standard_plan_matrix.sql
historical status: unchanged in this closure
forward-only: database/migrations/20260831_ai_addon_commercial_visibility.sql
runner: scripts/ai-addon/apply-ai-addon-migration.js
checksum: 9ef26317def63374887de4fe9147ab5c69f7c729c19ac42490cb72a5635865ad
production migration executed by Codex: NO
```

Static review:

- Uses `ON CONFLICT` for add-on/module/feature/capability/link rows.
- Updates only published standard plan-version module rows for `module_key='ai_compliance'` to `included=false`.
- Inserts legacy AI add-on rows only for existing active/trialing/past_due subscriptions where tenant AI was already enabled.
- Recreates commercial tenant module/capability views so AI surfaces only through active, non-expired add-on rows.
- Does not update users, app roles, role permissions, permissions, tenant contracts or operational data.

## Validation

Executed locally on 2026-08-31:

```text
git status --short --branch: PASS branch=main dirty=expected prior work
git diff --check: PASS
git diff -- database/migrations/20260828_commercial_standard_plan_matrix.sql: PASS no diff
node --check scripts/commercial-plan/apply-commercial-plan-matrix-migration.js: PASS
node --check scripts/ai-addon/apply-ai-addon-migration.js: PASS
node scripts/commercial-plan/apply-commercial-plan-matrix-migration.js --checksum: PASS d968b7aad261d3dc259ff0e86d34ca7d991fdc96b1a1e6add0daad668435e020
node scripts/ai-addon/apply-ai-addon-migration.js --checksum: PASS 9ef26317def63374887de4fe9147ab5c69f7c729c19ac42490cb72a5635865ad
node backend/src/services/commercial/aiAddonCommercial.contract.test.js: PASS
node backend/src/services/commercial/contractSubscriptionSync.service.test.js: PASS
node backend/src/services/commercial/commercialPlanMatrix.contract.test.js: PASS
node backend/src/services/commercial/rbac02CommercialGating.service.test.js: PASS
node backend/src/services/commercial/commercial.service.test.js: PASS
node backend/src/services/auth/rbac01Authorization.service.test.js: PASS
node backend/src/middleware/rbac.middleware.test.js: PASS
npm --prefix frontend run lint: PASS
npm --prefix frontend run typecheck: PASS
npm --prefix frontend run test:phase6-sidebar-rbac: PASS
npm --prefix frontend run test:phase6-commercial-multitenant: PASS
node scripts/rbac02/build-rbac02-route-matrix.js: PASS routes=97 missing=0 mapped=97 inferred
npm --prefix frontend run build: PASS
bash -n scripts/deploy-vms.sh: PASS
```

`frontend/tsconfig.json` was restored after the automatic Next build update.

## Runtime Gate

Human review must still perform push, PR, CI, merge, deploy, migration execution and runtime validation.

Minimum post-deploy checks:

- Apply `20260831_ai_addon_commercial_visibility` only through the approved migration runner.
- Confirm GRC without AI does not expose `ai.compliance` or `ai.auditor`.
- Confirm ISO + AI, ISO + Riesgo Operativo + AI and GRC + AI expose AI only when the add-on is active and runtime feature flags/RBAC/scope also allow it.
- Confirm suspended/cancelled add-on states cut effective AI entitlement as designed.
- Confirm Admin SaaS can contract/reactivate/suspend/cancel AI through the protected PUT route only for authorized platform/commercial admins.

## Do Not Rediscover

- Do not edit `20260828_commercial_standard_plan_matrix.sql`; it is historical and already applied.
- Do not weaken `aiAddonCommercial.contract.test.js`; it intentionally simulates legacy GRC still containing AI rows.
- Do not convert AI runtime flags into contractual entitlement.
- Do not grant roles or modify `role_permissions` for this package.
