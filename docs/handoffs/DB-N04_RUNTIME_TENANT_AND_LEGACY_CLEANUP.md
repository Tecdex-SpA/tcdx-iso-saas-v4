# DB-N04 — Runtime Tenant Context And Legacy Cleanup Readiness

Date: 2026-09-07
Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `codex/db-n01-control-identity-normalization`
HEAD: `11003dd92385dcca1caf5365fa437be3aee1f648`

Status: `DB_N04_READY_FOR_REVIEW`

No reset, clean, branch switch, commit, push, merge, deploy or migration apply was performed. `db-v4` was not modified.

## Tenant Runtime Helper

DB-N04 extends `backend/src/utils/dbTenantContext.js` into the canonical backend runtime helper:

- `withTenantTransaction(pool, context, callback)` validates a tenant UUID, starts `BEGIN`, sets transaction-local context with `set_config(..., true)`, runs the callback, commits, rolls back on error and always releases the client.
- `withPlatformTransaction(pool, context, callback)` is the explicit platform path. It requires a platform role and forbids `tenant_id`.
- `runWithDbTenantContext` and `runWithPlatformDbContext` use AsyncLocalStorage to make request/job scope visible to the pooled DB wrapper.
- `createTenantAwarePool(pool)` wraps direct `pool.query` inside short context transactions when a tenant/platform context exists, and patches `pool.connect()` clients so manual transactions set context immediately after `BEGIN`.

The mechanism is transaction-local:

```sql
SELECT
  set_config('app.tenant_id', $1, true),
  set_config('app.platform_scope', $2, true),
  set_config('app.runtime_role', $3, true)
```

No persistent session context is used for tenant runtime.

## Pool Safety

The isolated PostgreSQL test enables RLS on a pilot table and verifies:

- Tenant A reads only Tenant A.
- Tenant B after Tenant A reads only Tenant B.
- A direct no-context query after tenant transactions reads zero rows.
- Callback error rolls back.
- Client returns to the pool after rollback.
- `app.tenant_id` does not persist after rollback.

Result: pool leakage test PASS in PostgreSQL 16.14 Homebrew, isolated from `db-v4`.

## Platform Path

Platform scope is explicit and server-side only:

- Allowed roles are defined in `PLATFORM_ROLES`.
- `assertTenantContext({ platformScope: true })` fails closed.
- `assertPlatformContext` requires a platform role and forbids tenant IDs.
- Platform scope sets `app.platform_scope=true` transaction-locally and is intended for read/controller operations.
- `tcdx_security.tenant_write_allowed(uuid)` still requires tenant match; platform scope is not a tenant write bypass.

Normal tenant requests cannot escalate to platform scope from client input.

## AI Reader

`ai-engine/app/services/ai_core_db.py` uses a separate psycopg2 connection path. DB-N04 did not broaden `ai_reader` permissions and did not add BYPASSRLS.

Decision: `AI_READER_RLS_DEFERRED`.

Reason: the Python AI Engine path has no proven transaction-local `app.tenant_id`/`app.platform_scope` wiring, and tenant-safe/security-invoker view behavior under future RLS has not been proven. RLS for AI-readable tenant data must wait for either:

- AI Engine tenant-context transactions; or
- proven tenant-safe/security-invoker views with read-only grants.

## Jobs / Scheduler / Workers

Reviewed background paths:

- `backend/src/services/grc/grcSchedulerRunner.js`
- `backend/src/services/grc/phase2SchedulerRunner.js`
- `backend/src/services/evidence-ai.service.js`

Model implemented:

```text
global controller / claim
-> enumerate or claim tenant work under explicit platform context
-> execute each tenant unit under tenant-scoped context
```

The GRC scheduler and Phase 2 scheduler now use explicit platform context for discovery and tenant AsyncLocalStorage context for per-tenant/connector execution. Evidence AI claims work under platform context and processes job body under the job `tenant_id`.

## RLS Runtime Readiness

Classification: `RLS_RUNTIME_PARTIAL`.

Pilot tables:

- `tenant_controls`
- `findings`
- `evidences`
- `action_plans`
- `control_health_scores`

Backend Node runtime is wired for transaction-local tenant context and passes isolated RLS behavior tests. DB-N04 still does not enable or force RLS in `db-v4`.

Remaining blockers before broad RLS enablement:

- AI Engine / `ai_reader` tenant context or tenant-safe view proof.
- Authorized runtime validation against real route/service traffic after DB-N01 -> DB-N02 -> DB-N03 apply.
- Dedicated review for definer-owned/security-invoker views before assuming RLS semantics.
- Mixed global/tenant tables need per-domain policy decisions beyond DB-N03 pilot scope.

## DB Access Matrix

Artifact: `artifacts/db-n04/DB_ACCESS_CONTEXT_MATRIX.md`

Counts:

- 233 files with DB access patterns across runtime/scripts/database.
- 81 files with controls/catalog identity references.
- 34 matrix rows reviewed for DB-N04 runtime decisions.
- `TENANT_CONTEXT_REQUIRED=16`
- `PLATFORM_CONTEXT_REQUIRED=5`
- `GLOBAL_SAFE=5`
- `MIGRATION_ONLY=5`
- `LEGACY=3`

## Legacy Object Matrix

Artifact: `artifacts/db-n04/LEGACY_OBJECT_MATRIX.md`

Outcome:

- `control_health_scores`: `KEEP_ACTIVE` / `COMPATIBILITY_REQUIRED`.
- `controls`: `COMPATIBILITY_REQUIRED`.
- KPI-HLT and `v_latest_health_kpi_snapshots*`: `COMPATIBILITY_REQUIRED`.
- backup/history/preview objects: `DROP_CANDIDATE_DEFERRED`, not dropped.
- `qa_audit.*`: `QA_ONLY`, not dropped by product migration.
- `ai_core.view_definition_backups`: `MIGRATION_HISTORY_ONLY` / `DROP_CANDIDATE_DEFERRED`.

No object was dropped by DB-N04.

## Controls Blockers

`controls` cannot be dropped. Remaining consumers include backend services/routes, frontend pages and AI compatibility references. DB-N01 establishes `tenant_controls.id` as operational identity but preserves `controls.id` compatibility until every reader/writer is retired or migrated with proof.

## KPI-HLT Blockers

KPI-HLT remains compatibility-only after DB-N02. Consumers still exist in health/report/frontend paths and i18n labels. DB-N04 does not remove KPI-HLT metrics or views.

## Control Health Legacy

- `control_health_scores`: operational/detail compatibility, keep.
- `control_health_scores_backup_history`: backup-only candidate, deferred.
- `control_health_scores_v2_preview`: replaced/dead legacy candidate, deferred.

## QA Audit

`qa_audit` is classified `QA_ONLY`. No product migration drop is safe by name alone. Cleanup requires a QA-owned package and explicit live dependency/retention proof.

## AI Core Backups

`ai_core.view_definition_backups` is classified `MIGRATION_HISTORY_ONLY` / deferred. AI reader RLS safety is unresolved, so DB-N04 only documents/comment-annotates if present.

## Duplicate Indexes

Candidate overlap was reviewed in local live-map docs. `control_health_scores(tenant_control_id)` has a unique/constraint-backed index and a nonunique same-key index; because the definitions/constraint ownership are not identical, DB-N04 does not mark it safe to drop.

`scripts/normalization/db-n04-readonly-preflight.sql` reports exact normalized `pg_get_indexdef` duplicates and constraint ownership for future authorized review.

## Legacy Functions / Views

- `refresh_control_health_scores_v2_1(uuid)`: `ACTIVE`; keep.
- `v_latest_health_kpi_snapshots*`: `COMPATIBILITY`; keep.
- `*_v2_preview`, `legacy_*`, older `refresh_*`: candidate classes only; no blanket drop.

## Migration

File: `database/migrations/20260907_dbn04_runtime_tenant_and_legacy_cleanup.sql`

Properties:

- `BEGIN` / `COMMIT`.
- Advisory lock `pg_try_advisory_xact_lock(844332, 2026090704)`.
- Preflights DB-N03 context functions.
- Creates `tcdx_security.dbn04_rls_runtime_readiness`.
- Comments/annotates selected legacy backup/preview tables if present.
- No `ENABLE ROW LEVEL SECURITY`.
- No `FORCE ROW LEVEL SECURITY`.
- No `DROP`, `DELETE` or `TRUNCATE`.
- Safe re-run through `CREATE OR REPLACE` and guarded comments.

Executed on `db-v4`: NO.

## Read-Only Preflight

File: `scripts/normalization/db-n04-readonly-preflight.sql`

Reports:

- legacy object presence, estimated rows and sizes;
- runtime dependency references in views/functions;
- exactly duplicated indexes;
- RLS readiness for pilot tables;
- tenant context prerequisites;
- AI reader grants and AI-core tenant-safe view posture.

Codex did not run this against `db-v4`.

## PostgreSQL Tests

File: `scripts/normalization/db-n04-runtime-tenant-cleanup.postgres.test.js`

Result:

- M01 DB-N04 migration safe re-run PASS
- M02 DB-N04 cleanup comments only PASS
- T01 tenant A SELECT solo A PASS
- T02 tenant A INSERT A PASS
- T03 tenant A INSERT B FAIL as expected PASS
- T04 tenant A UPDATE B blocked PASS
- T05 tenant A DELETE B blocked PASS
- T06 tenant B after A sees only B PASS
- T07 no leakage between transactions PASS
- T08 explicit platform operation PASS
- T09 tenant cannot escalate to platform PASS
- T10 callback error rolls back PASS
- T11 client release after error PASS
- T12 tenant context does not persist after rollback PASS
- PostgreSQL 16.14 Homebrew
- `ISOLATED_FROM_DB_V4 YES`

## Runtime Tests

Executed:

```bash
node --check backend/src/utils/dbTenantContext.js
node --check scripts/normalization/db-n04-runtime-tenant-cleanup.postgres.test.js
node --check scripts/normalization/apply-db-n04-runtime-tenant-cleanup-migration.test.js
node backend/src/utils/dbTenantContext.test.js
node scripts/normalization/apply-db-n04-runtime-tenant-cleanup-migration.test.js
node scripts/normalization/db-n04-runtime-tenant-cleanup.postgres.test.js
```

Results:

- Syntax checks PASS.
- `DB-N04 tenant DB context tests: OK`.
- `DB-N04 runtime tenant cleanup migration static checks: OK`.
- PostgreSQL isolated M01-M02 and T01-T12 PASS.

Full targeted/backend suite results are recorded in the final DB-N04 closeout response after execution.

Additional targeted regressions PASS:

```bash
node backend/src/utils/tenantControlIdentity.test.js
node backend/src/routes/controlIdentityRoutes.test.js
node scripts/normalization/apply-db-n01-control-identity-migration.test.js
node scripts/normalization/apply-db-n02-health-metrics-lineage-migration.test.js
node scripts/normalization/apply-db-n03-multitenant-integrity-migration.test.js
node scripts/normalization/db-n01-control-identity.postgres.test.js
node scripts/normalization/db-n02-health-metrics-lineage.postgres.test.js
node scripts/normalization/db-n03-multitenant-integrity.postgres.test.js
node backend/src/services/math-governance/canonicalHealthProjection.service.test.js
node backend/src/services/soaIntelligence.service.test.js
node backend/src/middleware/rbac.middleware.test.js
node backend/src/services/grc/grc.service.test.js
node backend/src/services/grc/grcPhase1Core.test.js
node backend/src/services/grc/phase2Core.test.js
node backend/src/services/grc/marketReadinessPart2SchedulerPolicies.test.js
node backend/src/services/operationalRiskAiJobs.service.test.js
node backend/src/services/grc/grcObservation.service.test.js
node backend/src/services/actionTraceabilitySystemic.contract.test.js
```

Full backend suite:

```bash
cd backend
npm test
```

Result: NOT PASS due only to known failure `backend/src/services/math-governance/grcDecisionCenter.test.js:51` (`true == false`). Classification: `PREEXISTING_OR_UNRELATED` for DB-N04.

Diff hygiene:

```bash
git diff --check
```

Result: PASS.

## Safe Drops

Safe destructive drops proven in DB-N04: NONE.

## Deferred Drops

All named backup/preview candidates remain deferred pending authorized preflight proof of:

- 0 runtime readers;
- 0 writers;
- 0 dependencies;
- replacement proven;
- retention/owner approval.

## DB-N05 Prerequisites

Before DB-N05 or any RLS enablement package:

- Review and apply DB-N01 -> DB-N02 -> DB-N03 -> DB-N04 in authorized order after human approval.
- Run DB-N04 read-only preflight in authorized DB context.
- Wire or replace AI Engine / `ai_reader` path for tenant context or tenant-safe views.
- Validate real route/service traffic under RLS-enabled pilot tables.
- Review security-invoker/security-definer posture of views.
- Decide explicit cleanup package for deferred backup/preview objects with evidence.

## Not Executed

- commit
- push
- merge
- deploy
- DB-N01 migration
- DB-N02 migration
- DB-N03 migration
- DB-N04 migration
- db-v4 writes
