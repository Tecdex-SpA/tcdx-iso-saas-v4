# Handoff RBAC-02 Commercial Gating

Owner: CODEX A+C (RBAC/backend/frontend/product)
Branch: `main`
Base HEAD: `ad608a9eaa89b1668281d7162d1bf3ff6aee1f6c`
Status: `RBAC02_MIGRATION_RUNNER_READY_FOR_REVIEW`
Validation mode: `FOCUSED_MINIMAL`
Commit: `NOT_DONE`
Push/merge/deploy: `NOT_DONE`
Production modified by Codex: `NO`

## Objective

Resolve the confirmed false DENY for `/dashboard` caused by historical commercial tenants missing the technical `core` module row while the route requires capability `core.dashboard`.

## Root Cause

`/dashboard` requires:

```text
permission=dashboards.read
capability=core.dashboard
module_key=core
```

Historical tenants can have active commercial subscriptions and valid `dashboards.read`, but no row for module `core`. The generic module gate correctly fails closed for missing modules, but this produced a real false DENY for the baseline dashboard capability.

## Decision

Only `core.dashboard` is treated as a base capability for active commercial tenants.

- No generic missing-module fallback was added.
- RBAC remains mandatory through `dashboards.read`.
- Explicit capability deny is preserved.
- Unknown `core.*` capabilities still deny.
- Non-core missing modules still deny.
- Tenant inactive or subscription inactive does not receive the synthesized base capability.

## Files Changed

Backend:

- `backend/src/services/commercial/entitlementResolver.service.js`
- `backend/src/services/commercial/commercial.service.test.js`
- `backend/src/services/commercial/rbac02CommercialGating.service.test.js`

Frontend:

- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/phase2/Phase2Workspace.tsx`
- `frontend/src/hooks/useTenantEntitlements.ts`
- `frontend/src/i18n/dictionaries/es.json`
- `frontend/src/i18n/dictionaries/en.json`

Audit and route artifacts:

- `RBAC02_COMMERCIAL_GATING_READONLY_AUDIT.sql`
- `run-rbac02-commercial-gating-audit.sh`
- `scripts/rbac02/build-rbac02-route-matrix.js`
- `scripts/rbac02/apply-rbac02-migration.js`
- `artifacts/rbac02-route-audit/route_access_matrix.csv`
- `artifacts/rbac02-route-audit/rbac02_route_summary.txt`
- `.gitignore`

Deploy:

- `scripts/deploy-vms.sh`

Database:

- `database/migrations/20260827_rbac02_commercial_gating_normalization.sql`

Docs:

- `docs/codex/rbac/RBAC02_AUTHORIZATION_MODEL.md`
- `docs/codex/rbac/RBAC02_ROLE_NORMALIZATION.md`
- `docs/codex/rbac/RBAC02_PLAN_MODULE_MATRIX.md`
- `docs/codex/rbac/RBAC02_ROUTE_ACCESS_MATRIX.md`
- `docs/codex/rbac/RBAC02_DB_RUNTIME_FINDINGS.md`
- continuity files updated for RBAC-02 and RBAC-01 runtime contradiction correction.

## DB Runtime Audit

READ-ONLY audit files were created, syntax-checked and consumed after successful runtime execution.

- SQL read-only guard: `BEGIN; SET TRANSACTION READ ONLY; ROLLBACK;`
- Wrapper syntax: PASS
- Production modification: NO
- Runtime artifacts: `artifacts/rbac02-commercial-gating-audit/*.csv`

Runtime summary:

```text
tenants=14
users=50
roles=12
active_subscriptions=6
tenant_modules=59
tenant_capabilities=188
dashboard_module_mismatches=0
unknown_roles=0
```

Dashboard classifications:

```text
NO_FAILURE=22
RBAC_PERMISSION_MISSING=7
SUBSCRIPTION_INACTIVE=19
FALSE_DENY=0
FALSE_ALLOW_RISK_PRE_FIX=1
```

`DB_MIGRATION_REQUIRED`: `YES`

Migration created but not executed: `database/migrations/20260827_rbac02_commercial_gating_normalization.sql`.

Reason: persisted `core.dashboard` capability rows used `required_permission=commercial.entitlement.read`; Dashboard must require `dashboards.read`.

## Migration Runner

Operational runner added:

```text
path=scripts/rbac02/apply-rbac02-migration.js
migration_id=20260827_rbac02_commercial_gating_normalization
sql_path=database/migrations/20260827_rbac02_commercial_gating_normalization.sql
checksum=672bcb8b28210d98796e1f6da87142353e4f3bf949c2a7470ebdd25ebcf5bc64
```

Behavior:

- `--preflight` requires `MIGRATION_DATABASE_URL`, validates prerequisites, ledger state, checksum compatibility and `core.dashboard` catalog readiness, and does not apply the migration.
- `--apply` uses the official `schema_migrations` ledger, advisory lock and checksum guard, applies only the RBAC-02 SQL if pending, returns `already_applied` when the matching checksum is already applied, and fails if the same migration id was applied with a different checksum.
- Postcondition requires `core.dashboard.required_permission = dashboards.read`.
- No inline SQL inserts users, roles or permissions; no tenant ids, customer names, emails or passwords are hardcoded.

Deploy registration:

```text
scripts/deploy-vms.sh
RBAC-02|scripts/rbac02/apply-rbac02-migration.js
```

Execution order is after RBAC-01 and before backend, AI Engine and frontend deploy/restart. The deploy runner is fail-fast: if `PREFLIGHT RBAC-02` or `MIGRACION RBAC-02` fails, service deploy steps are not reached.

Production migration execution: `NOT_EXECUTED_BY_CODEX`.

Runtime preflight execution from Codex: `NOT_EXECUTED`.

Reason: `PRELIGHT_RUNTIME_REQUIRES_OFFICIAL_DEPLOY_CONTEXT` because `--preflight` requires `MIGRATION_DATABASE_URL` and would contact the production database from this phase.

## Route Audit

Generated with `node scripts/rbac02/build-rbac02-route-matrix.js`.

```text
routes=97
mapped=97
missing=0
expected_routes=97
route_count_status=PASS
missing_routes=NONE
```

Runtime/static contrast after generator correction:

```text
runtime_rows=8
static_rows=97
divergences=0
```

## Validation

PASS:

- `git diff --check`
- `bash -n run-rbac02-commercial-gating-audit.sh`
- `node --check scripts/rbac02/apply-rbac02-migration.js`
- `bash -n scripts/deploy-vms.sh`
- `node scripts/rbac02/apply-rbac02-migration.js --checksum`
- `node --check scripts/rbac02/build-rbac02-route-matrix.js`
- `node --check backend/src/services/commercial/rbac02CommercialGating.service.test.js`
- deploy registration grep: `RBAC-02|scripts/rbac02/apply-rbac02-migration.js`
- SQL reference grep: `20260827_rbac02_commercial_gating_normalization`
- runtime/static route matrix contrast: `divergences=0`
- `node backend/src/services/commercial/rbac02CommercialGating.service.test.js`
- `node backend/src/services/auth/rbac01Authorization.service.test.js`
- `node backend/src/services/commercial/commercial.service.test.js`
- `node backend/src/middleware/rbac.middleware.test.js`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:phase6-sidebar-rbac`
- `npm --prefix frontend run test:phase6-commercial-multitenant`
- `npm --prefix frontend run build`
- `git diff -- frontend/tsconfig.json` final: no diff

The Next.js build auto-modified `frontend/tsconfig.json`; the generated change was restored exactly as instructed.

## Localization And Brand

Focal grep found no remaining visible matches in RBAC-02 surfaces for:

- `Fase 1`, `Fase 2`, `Fase 3`, `Fase 5`
- `TCDX Compliance`
- known Phase2 English legacy labels
- visible `core.dashboard` capability key in AppLayout denial flow

Official visible brand remains `Tecdex GRC Compliance`.

## Gates

- `CORE_DASHBOARD_BASE_CAPABILITY=PASS_LOCAL`
- `GENERIC_MODULE_FALLBACK_CREATED=NO`
- `AUDITOR_DASHBOARD_WITH_DASHBOARDS_READ=PASS_LOCAL`
- `TENANT_ADMIN_CORE_DASHBOARD_FALSE_DENY_FIXED=PASS_LOCAL`
- `NON_CONTRACTED_MODULES_DENY=PASS_LOCAL`
- `EXECUTIVE_READ_ONLY=PASS_BY_EXISTING_RBAC01_TEST`
- `DEALER_TENANT_SCOPED=PASS_BY_EXISTING_RBAC01_CONTRACT`
- `AREA_OWNER_SCOPE_PRESERVED=PASS_BY_EXISTING_RBAC01_CONTRACT`
- `ROUTES_97_MISSING_0=PASS`
- `DB_RUNTIME_AUDIT=PASS_ANALYZED`
- `DB_MIGRATION_REQUIRED=YES_NOT_EXECUTED`
- `RBAC02_MIGRATION_RUNNER=PASS_STATIC`
- `RBAC02_DEPLOY_REGISTRATION=PASS_STATIC`

## Do Not Rediscover

- Do not replace the specific `core.dashboard` exception with a generic module fallback.
- Do not treat frontend navigation as the authority; backend remains the authority.
- Do not alias legacy roles into canonical privilege escalation.
- Do not convert absent modules to allow except for the explicit `core.dashboard` base capability.
- Do not create a DB migration unless the READ-ONLY runtime audit shows persistent normalization is required.
- Do not rerun full CI, deploy or migration from Codex.

## Remaining Debt

NONE for RBAC-02 local implementation.

Operational data hygiene outside the code fix: `expired_entitlements.csv` contains one active `legacy` subscription with `ended_at=2026-07-21 00:00:00+00`. RBAC-02 documents it but does not mutate subscription lifecycle state.

## Next Gate

Human review, Git closeout, official deploy, RBAC-02 migration application through the official deploy runner, CI and runtime validation.
