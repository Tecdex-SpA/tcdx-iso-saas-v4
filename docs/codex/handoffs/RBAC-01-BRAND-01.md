# Handoff RBAC-01-BRAND-01

Owner: CODEX A+C (RBAC/backend/frontend/product)
Branch: `main`
Base HEAD: `31ce8ffa95eede2d9986692dcc1c7eed18acac88`
Status: `RBAC01_MIGRATION_RUNNER_READY_FOR_REVIEW`
Validation mode: `FOCUSED_MINIMAL`
RBAC-01/BRAND-01 commit: `31ce8ffa95eede2d9986692dcc1c7eed18acac88` (`feat(auth): normalize RBAC commercial gating and product branding`)
Runner commit: `NOT_DONE`
Push/merge/deploy: `NOT_DONE`

## Objective Completed

RBAC-01 Stage 2 + BRAND-01 is already approved and versioned in `main` at `31ce8ffa95eede2d9986692dcc1c7eed18acac88`.

Continuity work added the official operational migration runner for `database/migrations/20260827_rbac01_canonical_roles_brand01.sql` and registered it in `scripts/deploy-vms.sh`.

## DB Audit Consumed

Files consumed:

- `artifacts/rbac01-db-audit/roles.csv`
- `artifacts/rbac01-db-audit/users_by_role.csv`
- `artifacts/rbac01-db-audit/role_permissions.csv`
- `artifacts/rbac01-db-audit/tenant_plans.csv`
- `artifacts/rbac01-db-audit/tenant_modules.csv`
- `artifacts/rbac01-db-audit/entitlements.csv`
- `artifacts/rbac01-db-audit/dealer_assignments.csv`

Codex did not reconnect to production PostgreSQL and did not modify production data.

## Key Decisions

- Canonical new-customer roles: `platform_admin`, `tenant_admin`, `auditor`, `area_owner`, `executive`, `dealer`.
- Compatibility maps semantic family only; it preserves `effective_role` for legacy privilege behavior.
- Final review correction: legacy/deprecated roles no longer satisfy canonical-only role gates by family match; matching is raw/effective role plus exact aliases only.
- `admin != tenant_admin`: DB audit showed distinct permissions.
- `superadmin != platform_admin`: DB audit showed `superadmin` has `settings.manage`.
- `operativo` exists in persisted users and is kept as deprecated legacy compatibility for `area_owner`.
- `auditor` must read dashboard; app-side dashboard role lists now include `auditor`.
- Commercial allow requires permission, entitlement, module-active state and scope when applicable.
- AI Engine did not require code changes because backend auth/RBAC remains the boundary: `AI_ENGINE_NO_RBAC_CHANGE_REQUIRED`.

## Files Changed

Backend:

- `backend/src/services/auth/roleCompatibility.service.js`
- `backend/src/services/auth/rbac01Authorization.service.js`
- `backend/src/services/auth/rbac01Authorization.service.test.js`
- `backend/src/middleware/rbac.middleware.js`
- `backend/src/middleware/commercialEntitlement.middleware.js`
- `backend/src/services/commercial/entitlementResolver.service.js`
- `backend/src/services/commercial/commercial.service.test.js`

Frontend:

- `frontend/src/utils/mvpPermissions.ts`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/config/enterpriseNavigation.ts`
- focal BRAND-01 visible-copy files under `frontend/src/app` and `frontend/src/components`
- `frontend/scripts/check-ui02-stage2-2-localization-contract.mjs`
- `frontend/scripts/check-phase6-commercial-multitenant-contract.mjs`

Database:

- `database/migrations/20260827_rbac01_canonical_roles_brand01.sql`

Migration runner:

- `scripts/rbac01/apply-rbac01-migration.js`
- `scripts/deploy-vms.sh`

Docs:

- `docs/codex/rbac/RBAC01_DB_ASIS_ANALYSIS.md`
- `docs/codex/rbac/RBAC01_CANONICAL_ROLE_MODEL.md`
- `docs/codex/rbac/RBAC01_ROLE_MIGRATION_MATRIX.md`
- `docs/codex/rbac/RBAC01_COMMERCIAL_ENTITLEMENT_MODEL.md`
- `docs/codex/rbac/RBAC01_REPORTING_CONSOLIDATION_ANALYSIS.md`
- `docs/codex/rbac/RBAC01_AUTHORIZATION_ARCHITECTURE.md`
- existing RBAC-01 docs normalized from pending to complete
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`

## Migration

Migration file: `database/migrations/20260827_rbac01_canonical_roles_brand01.sql`
Runner file: `scripts/rbac01/apply-rbac01-migration.js`
Deploy registration: `RBAC-01|scripts/rbac01/apply-rbac01-migration.js`

Behavior:

- adds missing canonical roles idempotently;
- adds `operativo` as deprecated legacy role for persisted compatibility;
- ensures `auditor -> dashboards.read`;
- adds bounded `area_owner`/`operativo` operational permissions;
- adds bounded read-only `executive` permissions;
- does not reassign users or touch production tenant/commercial/dealer data.

Production execution: `NOT_DONE`.
Deploy execution: `NOT_DONE`.
SQL modified by runner continuity: `NO`.

## Reporting IA

RBAC-01 does not delete routes or merge APIs.

- `/exportes`: `Reportes > Exportes`, generation/download/history.
- `/bi`: `Reportes > Datos y Analítica`, analytics/dashboard cockpit.
- `/reportes/studio`: `Reportes > Diseñador de reportes`, report definition workspace.
- `/reportes/generaciones`: `Reportes > Generaciones`, generated reports/history.

Future IA can consolidate navigation under `Reportes` while preserving deep links.

## Validation

PASS:

- `node backend/src/services/auth/rbac01Authorization.service.test.js`
- `node backend/src/services/commercial/commercial.service.test.js`
- `node backend/src/middleware/rbac.middleware.test.js`
- `npm run lint` in `frontend/`
- `npm run typecheck` in `frontend/`
- `npm run test:phase6-sidebar-rbac` in `frontend/`
- `npm run test:phase6-commercial-multitenant` in `frontend/`
- `npm run build` in `frontend/`
- route count: `97 -> 97`
- `git diff --check`
- `git diff -- frontend/tsconfig.json` final: no diff

Note: Next.js build auto-added `.next/dev/types/**/*.ts` and formatting to `frontend/tsconfig.json`; that generated change was inspected and restored because it was unrelated.

Final review addendum:

- Corrected MAJOR role-gate risk: `roleMatchesAny()` no longer lets `admin`, `superadmin` or `compliance_manager` pass canonical-only role lists through semantic compatibility.
- Corrected stale BRAND-01 localization contract fixtures that still referenced `TCDX`.

Runner continuity PASS:

- `node --check scripts/rbac01/apply-rbac01-migration.js`
- `node scripts/rbac01/apply-rbac01-migration.js --checksum`
- `bash -n scripts/deploy-vms.sh`
- `grep -n -E "RBAC|rbac01|apply-rbac01" scripts/deploy-vms.sh`
- `grep -n "20260827_rbac01_canonical_roles_brand01" scripts/rbac01/apply-rbac01-migration.js`

Not executed by Codex:

- `node scripts/rbac01/apply-rbac01-migration.js --preflight` because it requires a PostgreSQL connection.
- `node scripts/rbac01/apply-rbac01-migration.js --apply`.
- `./scripts/deploy-vms.sh`.

## Do Not Rediscover

- Do not rerun production DB audit unless a new DB state must be audited.
- Do not treat `admin` as a privilege alias for `tenant_admin`.
- Do not treat `superadmin` as a privilege alias for `platform_admin`.
- Do not remove `operativo` compatibility while real users carry that role.
- Do not expose advanced operational risk/BIA/privacy/data governance to ISO-only tenants without explicit entitlement and active module state.
- Do not use frontend navigation as authority; backend remains authority.
- Do not deploy or apply migration from Codex.

## Remaining Debt

NONE for RBAC-01/BRAND-01 local implementation or migration runner integration.

Compatibility is intentionally retained and documented; it is not classified as debt.

## Next Gate

Human review, Git closeout for the runner, official deploy, then RBAC runtime validation.

User decides commit, push, PR, CI, merge, deploy, migration application and runtime validation.
