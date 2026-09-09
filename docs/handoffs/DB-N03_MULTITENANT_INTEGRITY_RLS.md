# DB-N03 — Multi-Tenant Integrity, Constraints and RLS

Date: 2026-09-07

## Status

`DB_N03_READY_FOR_REVIEW`

Local branch: `codex/db-n01-control-identity-normalization`

HEAD: `11003dd92385dcca1caf5365fa437be3aee1f648`

Working tree: `UNCOMMITTED_WORKTREE` with DB-N01, DB-N02 and DB-N03 local changes. No reset, clean, branch switch, commit, push, merge or deploy was performed.

Execution order remains:

```text
DB-N01
-> DB-N02
-> DB-N03
```

`db-v4` was not modified. DB-N01, DB-N02 and DB-N03 migrations were not applied by Codex.

## Scope

DB-N03 hardens database-level tenant ownership without changing DB-N01 canonical control identity or DB-N02 Health authority semantics.

Implemented scope:

- Tenant table inventory and classification: `artifacts/db-n03/TENANT_TABLE_MATRIX.md`
- Migration: `database/migrations/20260907_dbn03_multitenant_integrity_rls.sql`
- Read-only production preflight script: `scripts/normalization/db-n03-readonly-preflight.sql`
- Isolated PostgreSQL integrity test: `scripts/normalization/db-n03-multitenant-integrity.postgres.test.js`
- Static migration/preflight test: `scripts/normalization/apply-db-n03-multitenant-integrity-migration.test.js`
- Runtime tenant DB context helper and focused test: `backend/src/utils/dbTenantContext.js`, `backend/src/utils/dbTenantContext.test.js`

## Tenant Table Inventory

Inventory path: `artifacts/db-n03/TENANT_TABLE_MATRIX.md`

Classification counts from focused migration/backend/ai-engine/scripts scan:

- `TENANT_REQUIRED`: 226
- `TENANT_OPTIONAL_BY_DESIGN`: 33
- `PLATFORM_SCOPE`: 2
- `LEGACY_AMBIGUOUS`: 1

Important classifications:

- `tenant_controls`, `findings`, `evidences`, `action_plans`, `control_health_scores`, `calculation_runs`, `calculation_outputs`, workflow runtime tables, observations and most operational GRC tables are tenant required.
- `knowledge_documents` is mixed by design because `GLOBAL` and `REGULATORY` documents intentionally have `tenant_id IS NULL`, while `TENANT` documents require a tenant.
- `commercial_events` and `regulatory_governance_audit` are platform scope.
- `grc_tenant_configurations` remains legacy ambiguous because migration history shows mixed lifecycle/shape.

## Composite FK Decisions

Added in DB-N03 migration where both sides are tenant scoped:

- `findings(tenant_id, tenant_control_id)` -> `tenant_controls(tenant_id, id)`
- `evidences(tenant_id, tenant_control_id)` -> `tenant_controls(tenant_id, id)`
- `action_plans(tenant_id, tenant_control_id)` -> `tenant_controls(tenant_id, id)`
- `control_health_scores(tenant_id, tenant_control_id)` -> `tenant_controls(tenant_id, id)`
- `action_plans(tenant_id, finding_id)` -> `findings(tenant_id, id)`
- Conditional same-tenant hardening for audits, assets, tenant nonconformities, GRC readiness findings and calculation run child tables when matching columns/tables exist.

The migration first checks existing data for cross-tenant rows. If any candidate relation already violates ownership, it raises an exception before adding constraints.

Deferred:

- Full exhaustive FK hardening for all 226 tenant-required tables.
- Mixed global/tenant tables such as `knowledge_documents`.
- Tables with legacy/null tenant semantics until their global behavior is formally decided.

## Tenant Nullability

Required:

- Critical operational tables use non-null tenant ownership or are treated as tenant required in the matrix.

Optional/global by design:

- Formula/catalog/reference/global knowledge/regulatory structures where global rows are intentional.

Legacy:

- `assets.tenant_id` appears nullable in local migration history but is operationally tenant scoped in the DB-N03 critical path.
- `grc_tenant_configurations` remains legacy ambiguous.

No DB-N03 `SET NOT NULL` was added without a proven safe semantic contract.

## Unique Constraints

Added:

- Candidate parent uniqueness for composite FKs, primarily `UNIQUE (tenant_id, id)` on critical parent tables, guarded by existence checks and duplicate preflight.

Deferred:

- Global unique keys on `code`, `name`, `slug`, `external_id`, workflow codes and document codes. These require endpoint/domain review because some are intentionally catalog-wide or platform-wide.

## RLS Architecture

Finding: prior state had `0` tables with RLS enabled and `0` with FORCE RLS.

DB-N03 prepares RLS prerequisites but does not enable RLS. Reason: backend currently uses `pg.Pool` without a global transaction-scoped tenant context wrapper around all tenant reads/writes, so enabling broad RLS now would risk runtime regressions or unsafe bypass pressure.

Prepared:

- Schema `tcdx_security`
- `tcdx_security.current_tenant_id()`
- `tcdx_security.platform_scope_enabled()`
- `tcdx_security.tenant_visible(uuid)`
- `tcdx_security.tenant_write_allowed(uuid)`
- Staged pilot policies for `tenant_controls`, `findings`, `evidences`, `action_plans` and `control_health_scores`

Pilot tables:

- `tenant_controls`
- `findings`
- `evidences`
- `action_plans`
- `control_health_scores`

`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` are deliberately deferred. Full status: `FULL_RLS_ROLLOUT_DEFERRED_WITH_JUSTIFICATION`.

## Runtime DB Roles

Runtime tenant role:

- Should use transaction-scoped `SET LOCAL` / `set_config(..., true)` before tenant-scoped queries once call sites are wired.

Platform admin:

- Should not make the normal tenant runtime role `BYPASSRLS`.
- Supported model is explicit platform context via `app.platform_scope=true` inside an administrative transaction, or a separate administrative connection for audited platform workflows.

`ai_reader`:

- Existing `ai-engine/app/services/ai_core_db.py` references a read-only AI DB user pattern.
- DB-N03 does not broaden AI permissions.
- RLS impact is deferred until AI reads can reliably set tenant context or consume tenant-safe views.

Migration/admin:

- Migration owner/admin may apply constraints and staged policies in an authorized migration context.
- No `BYPASSRLS` is added by DB-N03.

## Connection Pool Strategy

DB-N03 adds `backend/src/utils/dbTenantContext.js`:

- Validates tenant UUIDs for normal tenant scope.
- Allows explicit platform scope without tenant UUID only when `platformScope=true`.
- Runs `BEGIN`, transaction-local `set_config`, user callback, `COMMIT`.
- Rolls back and releases pooled clients safely.

Focused leakage simulation confirms reused pool clients set tenant A and tenant B context independently in separate transactions.

## Views and Functions

Views:

- DB-N03 does not alter critical views.
- Risk remains for definer-owned views if future RLS rollout assumes invoker behavior. DB-N04 should inventory `security_invoker` / `security_barrier` needs before enabling broad RLS.

Functions:

- Focused scan found no existing `SECURITY DEFINER` in `database/migrations`, `backend`, `ai-engine` or `scripts`.
- DB-N03 does not create new `SECURITY DEFINER` functions.

## Migration

File: `database/migrations/20260907_dbn03_multitenant_integrity_rls.sql`

Properties:

- Transactional `BEGIN` / `COMMIT`
- Advisory transaction lock
- DB-N01/DB-N02 order documented
- Preflight before constraints
- Safe re-run guards
- No `DROP` legacy tables
- No `TRUNCATE`
- No destructive cleanup
- Composite FK constraints are added as `NOT VALID` and then validated
- RLS prerequisites and staged policies are created without enabling RLS

Executed on `db-v4`: `NO`

## Read-Only Preflight

Path: `scripts/normalization/db-n03-readonly-preflight.sql`

Purpose:

- Detect cross-tenant FK candidates before DB-N03 apply.
- Detect missing tenant rows in critical tables.
- Detect duplicate `(tenant_id, id)` candidates.
- Report RLS/force-RLS state for `public`, `ai_core` and `qa_audit`.

Executed on `db-v4`: `NO`

## PostgreSQL Tests

Command:

```bash
node scripts/normalization/db-n03-multitenant-integrity.postgres.test.js
```

Result: `PASS`

Version: PostgreSQL 16.14 Homebrew

Isolation: `ISOLATED_FROM_DB_V4 YES`

Scenarios covered:

- I01 child tenant A -> parent tenant A PASS
- I02 child tenant A -> parent tenant B FAIL as expected
- I03 evidences same-tenant insert PASS
- I04 evidences tenant update breaks ownership FAIL as expected
- I05 action_plans same-tenant insert PASS
- I06 action_plans cross-tenant control update FAIL as expected
- I07 action_plans tenant update breaks finding/control link FAIL as expected
- I08 control_health_scores same-tenant insert PASS
- I09 control_health_scores cross-tenant update FAIL as expected
- I10 migration safe re-run PASS
- RLS01 policies staged but not enabled PASS

## Runtime Tests

Commands:

```bash
node scripts/normalization/apply-db-n03-multitenant-integrity-migration.test.js
node backend/src/utils/dbTenantContext.test.js
node backend/src/utils/tenantControlIdentity.test.js
node backend/src/routes/controlIdentityRoutes.test.js
node backend/src/services/math-governance/canonicalHealthProjection.service.test.js
node backend/src/services/soaIntelligence.service.test.js
node --check backend/src/utils/dbTenantContext.js
node --check backend/src/utils/dbTenantContext.test.js
node --check scripts/normalization/db-n03-multitenant-integrity.postgres.test.js
node --check scripts/normalization/apply-db-n03-multitenant-integrity-migration.test.js
```

Result: `PASS`

## Full Suite

Command:

```bash
cd backend
npm test
```

Result: `FAIL`

Observed:

- First suite failure: `commercial.service.test.js` reported test server bind failure.
- Direct focused rerun of `node backend/src/services/commercial/commercial.service.test.js` passed.
- Known prior failure reproduced separately: `node backend/src/services/math-governance/grcDecisionCenter.test.js` fails at line 51 (`true == false`).

Classification: `PREEXISTING_OR_UNRELATED` for DB-N03. DB-N03 did not modify commercial service or `grcDecisionCenter` behavior.

## Residual Risks

- Full RLS is not enabled yet; database read isolation still depends on backend query filters until runtime tenant context is wired into tenant-scoped request paths.
- Staged pilot RLS policies need authorized runtime validation before enabling.
- The tenant inventory is exhaustive by focused migration/backend/ai-engine/scripts scan, but only critical FK constraints were implemented in DB-N03.
- Mixed global/tenant tables require per-domain RLS policies before broad rollout.
- Unique key scope review is documented but mostly deferred because catalog/platform semantics vary by domain.
- `ai_reader` needs tenant context or tenant-safe views before RLS applies to AI-accessible tenant data.
- Definer-owned views need a dedicated DB-N04 review before broad RLS enablement.

## DB-N04 Dependencies

- Wire `withTenantTransaction` or equivalent transaction-scoped context into tenant-scoped backend paths.
- Add integration tests around real route/service paths under RLS-enabled pilot tables.
- Decide tenant-scoped unique keys per domain.
- Review views for `security_invoker` and `security_barrier`.
- Define and validate AI reader tenant-safe views/policies.
- Enable pilot RLS only after runtime context coverage is proven.

## Not Executed

- Commit
- Push
- Merge
- Deploy
- DB-N01 migration
- DB-N02 migration
- DB-N03 migration
- Any writes against `db-v4`
