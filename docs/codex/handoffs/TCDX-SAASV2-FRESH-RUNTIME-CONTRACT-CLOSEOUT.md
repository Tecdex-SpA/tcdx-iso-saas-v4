# TCDX-SAASV2-FRESH-RUNTIME-CONTRACT-CLOSEOUT

Status: `READY_FOR_HUMAN_REVIEW`

Owner: CODEX A / Data-Backend-GRC  
Branch: `main`  
Base HEAD verified in this continuation: `c6a340d5d14571259457983350225d751c3af316`  
Head after closeout: uncommitted working tree on same HEAD  
Commit/push/merge/deploy by Codex: `NO`

## Root Cause

The fresh SaaSv2 database had baseline plus V1/V2/V3 runtime objects, but active backend routes still required additional physical runtime contract pieces. Confirmed runtime blockers included missing RBAC SQL functions, missing dealer/commercial views and missing profile/tenant columns:

- `get_user_effective_permissions(uuid)`
- `user_has_permission(uuid, text)`
- `v_dealer_tenants`
- `users.phone`, plus related profile fields
- active Admin SaaS, tenant module, tenant contract, commercial, prebilling, external lookup and audit surfaces

This closeout is a forward-only runtime contract patch. It is not a fresh bootstrap replay, not a historical migration replay and not proof of production readiness.

## Scope

In scope:

- Additive DB objects/columns/functions/views required by active runtime.
- Explicit grants to `tcdx_backend_runtime` for the new active surfaces.
- Fresh deploy registration of this single forward-only runner.
- Frontend Admin SaaS platform gate correction from hardcoded false to canonical governance context.
- Focused static and isolated PostgreSQL tests.
- Continuity documentation.

Out of scope:

- No commit, push, merge or deploy.
- No SQL against `tcdx_saasv2`, DB-V4, QA remote or any real database.
- No `.env` changes.
- No production data, tenant-specific seed, user-specific workaround or customer-specific branch.

## Files Modified

- `database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql`
- `scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js`
- `scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.test.js`
- `scripts/normalization/backend-fresh-runtime-contract.test.js`
- `scripts/deploy-vms.sh`
- `scripts/deploy-vms-strategy.test.js`
- `frontend/src/app/admin-saas/page.tsx`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/handoffs/TCDX-SAASV2-FRESH-RUNTIME-CONTRACT-CLOSEOUT.md`

## Migration

Migration id: `20260910_tcdx_saasv2_fresh_runtime_contract_closeout`  
File: `database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql`  
Final SHA-256: `09201f0233cbad14cdc071f150b52ef80b6a1f847fef02b75631fc621b847ca5`

Properties:

- Transactional with outer `BEGIN`/`COMMIT`.
- Uses advisory transaction lock `pg_try_advisory_xact_lock(844332, 2026091004)`.
- Idempotent DDL via `IF NOT EXISTS`, conflict-safe inserts for permissions/mappings and `CREATE OR REPLACE` for functions/views.
- No tenant/user/email/UUID/customer hardcode.
- No `DROP TABLE`, `DROP SCHEMA`, `GRANT ON ALL TABLES` or `GRANT EXECUTE ON ALL FUNCTIONS`.

## CASCADE Audit

The previous local SQL used `DROP VIEW ... CASCADE` for:

- `v_saas_prebilling_tenant_context`
- `v_commercial_tenant_health`
- `v_tenant_commercial_entitlements`
- `v_commercial_tenant_capabilities`
- `v_commercial_tenant_modules`
- `v_commercial_tenant_subscription`
- `v_commercial_plan_capabilities`

Those views depend on each other and are recreated by the migration, but `CASCADE` could also drop any unlisted dependent view/object present in a target database. The isolated test could not prove absence of those external dependencies. This continuation removed `CASCADE`; the migration now drops only the listed views with default `RESTRICT` behavior. If an unlisted dependency exists, the migration fails closed instead of deleting it implicitly.

## Commercial Scope

The migration creates/extends commercial tables and views required by active backend code in `admin-saas.routes.js`, `commercialAdmin.service.js` and `entitlementResolver.service.js`, including catalog administration, modules/features/capabilities, pack administration, trials, overrides, usage measurements, tenant subscriptions and entitlement projections.

Important correction in this continuation:

- Removed invented `saas_price_catalog` seed rows for `demo`, `pyme`, `empresa`, `enterprise`, standards, premium modules and usage overage.
- Removed default `ai_core.external_lookup_quotas` seed row.

The tables remain available for explicit platform administration. Backend structural fallbacks remain in code where they already existed; this migration does not introduce product pricing or default quota configuration as database truth.

## Runtime Contract

Profile:

- Adds `users.phone`, `users.job_title`, `users.avatar`.

Tenant/Admin SaaS:

- Adds tenant company/admin fields used by current routes.
- Adds `tenant_contracts`, `dealer_tenants`, `admin_audit_log`, SaaS prebilling tables and views.
- Adds external lookup quota/log/audit/charge tables in `ai_core`.

RBAC:

- Adds `get_user_effective_permissions(uuid)`.
- Adds `user_has_permission(uuid,text)`.
- Adds `log_admin_audit_event(uuid,text,uuid,text,uuid,jsonb)`.
- `platform_admin` receives active permissions by permission catalog.
- `tenant_admin` receives only selected read-oriented commercial/metrics permissions.
- `viewer` and unknown users remain deny-by-default.
- Legacy aliases such as `superadmin` map to `platform_admin` only inside permission resolution.
- No user role rewrites and no email/tenant/UUID bypass.

Tenant slug:

- Adds deterministic slug helper/trigger for inserts/updates with missing slug.
- `tenants.slug` remains `UNIQUE`; concurrent same-name inserts cannot create silent collisions. A race may fail explicitly on the unique constraint, which is safer than silently selecting a conflicting slug.

Privileges:

- Explicit `USAGE` on `public` and `ai_core`.
- Explicit SELECT on new/commercial runtime views and RBAC catalog tables.
- Explicit DML only on the runtime tables needed by current backend routes.
- Explicit EXECUTE only on the three new functions.
- Least-privilege smoke verified `tcdx_backend_runtime` can use required surfaces and cannot `CREATE TABLE`.

## Runner Design

Runner: `scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js`

Modes:

- `--checksum`: reads SQL, validates static safety tokens and prints migration id + SHA-256 only.
- `--preflight`: validates base schema, ledger state and postconditions if already applied; no writes.
- `--apply`: creates/uses `schema_migrations`, takes session advisory lock, writes `running`, runs SQL inside a transaction, checks postconditions and writes `applied`.

Ledger behavior:

- `pending`: apply may proceed.
- `already_applied`: apply exits idempotently after postcondition check.
- `running`: fails closed and preserves ledger.
- `checksum_mismatch`: fails closed and preserves valid applied ledger row.
- `failed`: treated as pending for retry; a new failed row is written only after rollback when apply fails.

No fixed DB name, host, credential, tenant, email or customer identifier is embedded in the runner. `MIGRATION_DATABASE_URL` is required for DB modes and sanitized from error output.

## Deploy Strategy

`scripts/deploy-vms.sh` now registers:

- `Fresh runtime contract closeout|scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js`

only in `FRESH_PRODUCTION_MIGRATION_RUNNERS`.

Preserved deploy contract:

- `fresh-baseline` remains distinct from `historical-upgrade`.
- Fresh deploy does not run historical Phase 3/4/5/F6/RBAC/commercial/normalization/hotfix chains.
- Fresh deploy does not run `production_schema_v1.sql`, `production_seed_v1.sql` or `load-production-reference-catalogs.js`.
- Fresh deploy may run only explicitly registered forward-only runners.
- `historical-upgrade` remains blocked for `tcdx_saasv2`.
- Official command remains `./scripts/deploy-vms.sh`.

No deploy was executed by Codex.

## Frontend

`frontend/src/app/admin-saas/page.tsx` no longer hardcodes:

```ts
const [isSuperadminUi] = useState(false);
```

It now derives platform UI capability from backend governance:

```ts
const isPlatform = governance?.data?.scope?.is_platform === true;
const isSuperadminUi = isPlatform;
```

This enables canonical `platform_admin` platform actions without relying on legacy `superadmin`, while backend authorization remains the authority.

## Validation

Executed in this continuation:

```text
pwd -> /Users/andresbarouh/repos/tcdx-iso-saas-v4
git branch --show-current -> main
git rev-parse HEAD -> c6a340d5d14571259457983350225d751c3af316
git diff --check -> PASS
bash -n scripts/deploy-vms.sh -> PASS
node scripts/deploy-vms-strategy.test.js -> DEPLOY_VM_STRATEGY_TEST_PASS
node scripts/normalization/backend-fresh-runtime-contract.test.js -> PASS
node scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.js --checksum -> checksum=09201f0233cbad14cdc071f150b52ef80b6a1f847fef02b75631fc621b847ca5
node scripts/normalization/apply-tcdx-saasv2-fresh-runtime-contract-closeout.test.js -> PASS
```

The PostgreSQL test first failed inside the managed sandbox because local `initdb` could not create a shared memory segment. It was rerun outside the sandbox with the same isolated local test path. It used a localhost-only isolated PostgreSQL/Docker instance and did not connect to `tcdx_saasv2`, DB-V4 or any remote environment.

Important PASS markers from isolated PostgreSQL:

```text
FRESH_BASELINE_SEED_V1_V2_V3=PASS
FRESH_MIGRATION_LEDGER_CHECKSUM=PASS
FRESH_MIGRATION_PREFLIGHT_PENDING=PASS
FRESH_MIGRATION_APPLY_1=PASS
FRESH_MIGRATION_IDEMPOTENCY=PASS
FRESH_RUNTIME_USERS_CONTRACT=PASS
FRESH_RUNTIME_TENANTS_CONTRACT=PASS
FRESH_RUNTIME_ADMIN_SAAS_CONTRACT=PASS
FRESH_RUNTIME_COMMERCIAL_CONTRACT=PASS
FRESH_RUNTIME_DEALER_CONTRACT=PASS
FRESH_RUNTIME_MODULES_CONTRACT=PASS
FRESH_RUNTIME_AUDIT_CONTRACT=PASS
FRESH_RUNTIME_EXTERNAL_LOOKUP_CONTRACT=PASS
FRESH_RUNTIME_RBAC_FUNCTIONS=PASS
PLATFORM_ADMIN_CANONICAL_ROLE=PASS
FRESH_RUNTIME_GOVERNANCE_CONTRACT=PASS
ADMIN_SAAS_TENANTS_QUERY_COMPILES=PASS
FRESH_RUNTIME_METRICS_TENANT_DISCOVERY=PASS
FRESH_RUNTIME_PREBILLING_CONTRACT=PASS
FRESH_RUNTIME_PRICE_CATALOG_NOT_SEEDED=PASS
FRESH_RUNTIME_EXTERNAL_LOOKUP_DEFAULT_NOT_SEEDED=PASS
FRESH_RUNTIME_AUDIT_FUNCTION=PASS
FRESH_RUNTIME_PRIVILEGES=PASS
FRESH_RUNTIME_PRIVILEGES_DENY_CREATE=PASS
FRESH_MIGRATION_CHECKSUM_MISMATCH_ABORTS=PASS
NO_TENANT_SPECIFIC_FIX=PASS
NO_SECRET_OUTPUT=PASS
NO_BOOTSTRAP_REPLAY_ON_DEPLOY=PASS
FRESH_REJECTS_HISTORICAL_CHAIN=PASS
ISOLATED_POSTGRES_CLEANUP PASS
```

## Residual Risks

- Local isolated PostgreSQL proves contract behavior over baseline+seed+V1+V2+V3, but not production/clone runtime behavior.
- No real `tcdx_saasv2` preflight/apply was executed by Codex.
- Runtime backend/API smoke against deployed services was not executed by Codex.
- The migration grants broad DML across active Admin SaaS/commercial runtime tables because current backend routes use those tables; human review should validate this against the final app-role deployment posture before production apply.
- Existing backend pricing/prebilling code still contains structural fallback/hardcoded amounts outside this migration; this closeout only avoids adding new DB price/quota truth.

## Manual Next Actions

1. Human review this diff, especially SQL object scope, grants and deploy registry.
2. Optionally run authorized clone/staging `--preflight` with `MIGRATION_DATABASE_URL` outside Codex.
3. Owner performs commit/push/PR/CI/merge/deploy only after review.
4. Owner runs official deploy with the intended strategy and validates runtime endpoints manually.

Explicit prohibition for Codex in this closeout: no commit, push, merge, deploy, `.env` edit, DB-V4 access, `tcdx_saasv2` access or production SQL.

