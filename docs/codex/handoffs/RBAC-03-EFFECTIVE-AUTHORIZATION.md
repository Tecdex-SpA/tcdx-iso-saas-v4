# RBAC-03 Effective Authorization Handoff

Status: `RBAC03_NOT_REQUIRED` for role/permission reconciliation; `COMMERCIAL_PLAN_SYNC_REQUIRED`; `COMMERCIAL_PLAN_MODEL_ADJUSTED`; `COMMERCIAL_PLAN_MATRIX_APPROVED`; `COMMERCIAL_PLAN_MIGRATION_RUNNER_READY`; ready for human review.

Branch/base:

```text
branch: main
base HEAD: 29fe3fb7a57854e637205e84aa15281181e1267f
production modified by Codex: NO
commit/push/deploy by Codex: NO
```

## New Fact

Admin Credex recovered Dashboard access after refreshing the contract from the superadmin account.

## Revised Diagnosis

The symptom was not caused by missing `admin`/`tenant_admin` RBAC permission. The real correction path was commercial contract refresh, which means the failure was in synchronization/freshness across:

```text
tenant_contracts
-> tenant_subscriptions
-> v_commercial_tenant_subscription
-> v_commercial_tenant_modules
-> v_commercial_tenant_capabilities
-> /api/me/entitlements
-> frontend capability cache
```

RBAC persisted evidence:

- `admin` effective role already has `dashboards.read`.
- Active Credex SPA admins show `NO_FAILURE`.
- Tecdex admins show `NO_FAILURE`.
- Credex test admins fail `SUBSCRIPTION_INACTIVE`, which is an intentional commercial deny.

## Changes

- Added `backend/src/services/commercial/contractSubscriptionSync.service.js`.
- Added `backend/src/services/commercial/commercialPlanModel.service.js`.
- Admin SaaS contract save, service suspend and service reactivate now sync the saved `tenant_contracts` row to `tenant_subscriptions` in the same transaction.
- `/api/me/entitlements` now uses central tenant resolution and fails closed on selected-tenant mismatch.
- Frontend auth/tenant changes now invalidate entitlements, access bootstrap and single-flight request caches.
- Admin SaaS contract UI and Phase 4 commercial panel show only standard commercial plans for new standard selection: ISO, ISO + Riesgo Operativo, GRC.
- Backend catalog responses include `standard_plans` with modules/capabilities derived from `v_commercial_plan_capabilities`; frontend does not build a second technical matrix.
- Manual module controls remain as an advanced exception surface for add-ons, pilots, legacy compatibility or commercial exceptions.
- No RBAC migration, no role grant reconciliation and no user/tenant-specific exception.

## Standard Commercial Model

Aliases:

```text
iso -> pyme -> ISO
iso_operational_risk -> empresa -> ISO + Riesgo Operativo
grc -> enterprise -> GRC
```

Historic internal compatibility plans:

```text
demo
legacy
```

Definitive capability rule:

```text
ISO = ONLY_ISO
ISO_RISK = ISO + OPERATIONAL_RISK_ONLY
GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES
```

Capability verification:

- `backend/src/services/commercial/commercialPlanMatrix.service.js` classifies 45 tenant commercial capabilities by function, not module proxy.
- `database/migrations/20260828_commercial_standard_plan_matrix.sql` materializes missing ISO semantic capabilities and derives standard plan modules from exact plan capabilities.
- `docs/codex/commercial/COMMERCIAL_PLAN_CAPABILITY_MATRIX.md` records capability-by-capability functional validation.
- `artifacts/rbac02-route-audit/route_access_matrix.csv` maps `routes=97`, `mapped=97`, `missing=0`.
- Result: `OVEREXPOSED=0`, `UNDEREXPOSED=0`, `MISCLASSIFIED=0` locally.

## Database

```text
DB_MIGRATION_REQUIRED: YES
migration file: database/migrations/20260828_commercial_standard_plan_matrix.sql
production modified: NO
```

This migration is commercial catalog/matrix normalization, not RBAC. It does not touch tenants, users, roles, role permissions, tenant contracts, tenant subscriptions or operational data. It updates standard plan display metadata, upserts missing commercial capabilities/features/modules and toggles published `plan_version_modules.included`; module removal from a plan is availability change only.

Official runner:

```text
scripts/commercial-plan/apply-commercial-plan-matrix-migration.js
```

Deploy registration:

```text
Commercial Plan Matrix|scripts/commercial-plan/apply-commercial-plan-matrix-migration.js
```

Execution order is RBAC-01 preflight/apply, RBAC-02 preflight/apply, Commercial Plan Matrix preflight/apply, then backend/AI/frontend deploy. Production migration was not executed by Codex.

## Validation

Local validation targets:

```text
git diff --check
node backend/src/services/commercial/contractSubscriptionSync.service.test.js
node backend/src/services/commercial/rbac02CommercialGating.service.test.js
node backend/src/services/commercial/commercial.service.test.js
node backend/src/services/commercial/commercialPlanMatrix.contract.test.js
node backend/src/services/auth/rbac01Authorization.service.test.js
node backend/src/middleware/rbac.middleware.test.js
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test:phase6-sidebar-rbac
npm --prefix frontend run test:phase6-commercial-multitenant
node scripts/rbac02/build-rbac02-route-matrix.js
npm --prefix frontend run build
node --check scripts/commercial-plan/apply-commercial-plan-matrix-migration.js
bash -n scripts/deploy-vms.sh
```

`commercial.service.test.js` may require non-sandbox execution because it binds an ephemeral local TCP port.

Executed in this session:

```text
git diff --check: PASS
node --check scripts/commercial-plan/apply-commercial-plan-matrix-migration.js: PASS
bash -n scripts/deploy-vms.sh: PASS
node scripts/commercial-plan/apply-commercial-plan-matrix-migration.js --checksum: PASS (`d968b7aad261d3dc259ff0e86d34ca7d991fdc96b1a1e6add0daad668435e020`)
node backend/src/services/commercial/contractSubscriptionSync.service.test.js: PASS
node backend/src/services/commercial/rbac02CommercialGating.service.test.js: PASS
node backend/src/services/commercial/commercial.service.test.js: PASS
node backend/src/services/commercial/commercialPlanMatrix.contract.test.js: PASS
node backend/src/services/auth/rbac01Authorization.service.test.js: PASS
node backend/src/middleware/rbac.middleware.test.js: PASS
npm --prefix frontend run lint: PASS
npm --prefix frontend run typecheck: PASS
npm --prefix frontend run test:phase6-sidebar-rbac: PASS
npm --prefix frontend run test:phase6-commercial-multitenant: PASS
node scripts/rbac02/build-rbac02-route-matrix.js: PASS (`routes=97`, `missing=0`)
npm --prefix frontend run build: PASS
```

`frontend/tsconfig.json` was restored after the Next build auto-update.

`PREFLIGHT_RUNTIME_REQUIRES_OFFICIAL_DEPLOY_CONTEXT`: `--preflight` requires `MIGRATION_DATABASE_URL` from the protected official migration environment and was not executed against production.

## Human Runtime Gate

After review/deploy, validate:

- Save contract for a non-production test tenant in Admin SaaS.
- Confirm `tenant_subscriptions` reflects the latest contract status/plan.
- Confirm `/api/me/entitlements` and `/api/me/modules` agree for the same tenant.
- Confirm Admin Credex and Admin Tecdex Dashboard access with a fresh login.
- Apply the commercial migration through an approved runner/gate if review accepts the standard matrix.
- Validate plan changes ISO -> ISO + Riesgo Operativo, ISO + Riesgo Operativo -> GRC and GRC -> ISO without data deletion and without RBAC bypass.

## Do Not Rediscover

- RBAC-03 role/permission reconciliation is not required for the confirmed incident.
- RBAC-01 and RBAC-02 stay protected unless new objective evidence appears.
- Superadmin refresh fixed Credex by realigning commercial contract/subscription state, not by changing RBAC.
- Frontend must not own the plan-to-capability matrix.
