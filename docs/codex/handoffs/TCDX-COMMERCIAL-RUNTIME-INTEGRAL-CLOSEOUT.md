# TCDX-COMMERCIAL-RUNTIME-INTEGRAL-CLOSEOUT

Status: `TCDX_COMMERCIAL_RUNTIME_INTEGRAL_CLOSEOUT_READY_FOR_HUMAN_REVIEW`

Owner: CODEX A / Data-Backend-GRC with CODEX C commercial surface awareness
Branch: `main`
Base HEAD verified in this continuation: `6bf346ebe20dfb7d554c018f50e1a3dbb962338a`
Head after closeout: uncommitted working tree on same HEAD
Commit/push/merge/deploy by Codex: `NO`

## Objective

Close the pending commercial runtime integral work without rebuilding from scratch, preserving prior local fixes:

- diagnostic recursion fixed.
- `tenant_subscription_addons` writes include/preserve `tenant_id`.
- `normalize_status_for_audits(text)` no longer required at runtime.
- `search_history` treated as optional with safe degradation.
- forward-only migration and runner registered for fresh production deploy strategy.

## Root Cause

The remaining blocker was the harness in `backend/src/services/commercial/commercial.service.test.js`, not the commercial route contract. The test used `app.listen(0, '127.0.0.1')`, then immediately required `server.address()` to be a TCP address. In the managed backend cwd, local TCP bind can fail with `EPERM`; Node/Express exposed a null address and the custom harness error `Commercial test server did not bind to a TCP port` masked the underlying socket failure.

Fix: the test now invokes `admin-saas-commercial.routes.js` in memory with parsed JSON request objects and a minimal response object. It preserves route-level assertions and JSON wrapper checks without fixed ports, sleeps, skipped assertions or network binding.

## Files Changed

- `backend/src/controllers/search.controller.js`
- `backend/src/routes/audits.routes.js`
- `backend/src/routes/reports.routes.js`
- `backend/src/services/commercial/commercial.service.test.js`
- `backend/src/services/commercial/commercialAdmin.service.js`
- `backend/src/services/commercial/contractSubscriptionSync.service.js`
- `backend/src/services/commercial/contractSubscriptionSync.service.test.js`
- `backend/src/services/diagnostic.service.js`
- `database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql`
- `scripts/deploy-vms.sh`
- `scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js`
- `scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.test.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/REGRESSION_COMMANDS.md`
- `docs/codex/handoffs/TCDX-COMMERCIAL-RUNTIME-INTEGRAL-CLOSEOUT.md`

## Migration

Migration id: `20260910_tcdx_commercial_runtime_integral_closeout`
File: `database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql`
SHA-256: `4310372bbd795eef116b14110283d16e0ef7a247ee81d51b54de7d4a6debe51d`

Runner: `scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js`

Registered in `FRESH_PRODUCTION_MIGRATION_RUNNERS` as:

```text
Commercial runtime integral closeout|scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js
```

No SQL was executed against `tcdx_saasv2`, DB-V4, QA remote or any real database.

## Contract Classification

| Contract | Classification | Evidence |
|---|---|---|
| `tenant_standard_audit` | physical required and covered | active Admin SaaS standard contract routes insert audit rows; migration creates table and grants runtime access. |
| `tenant_subscription_addons` | physical required and covered | AI add-on authority remains active; writes now include/preserve `tenant_id`; migration/test cover non-null tenant contract. |
| `tenant_applicable_controls` | physical required and covered | applicability engine, reports, dashboard, controls and GRC bootstrap read/write tenant-scoped rows; migration creates table, FK and indexes. |
| `tenant_company_profiles` | physical required and covered | company profile services, AI context and diagnostic paths read/write tenant profile; migration creates table and unique tenant index. |
| `tenant_document_object_links` | physical required and covered | controls/action/evidence projections use document-object evidence links; migration creates table, constraints and indexes. |
| `findings.due_date` | physical required and covered | migration adds the active runtime column and tenant/date index. |
| `normalize_status_for_audits` | runtime dependency eliminated | audit and report routes use inline SQL CASE normalization; no active runtime function call remains except defensive error text. |
| `search_history` | optional safe degradation | reads return empty history and writes no-op on `42P01`/missing relation. |

## Validation

Executed PASS:

```text
node backend/src/services/commercial/commercial.service.test.js -> commercial.service.test: OK
node backend/src/services/commercial/contractSubscriptionSync.service.test.js -> CONTRACT_SUBSCRIPTION_SYNC_TEST_PASS
cd backend && node src/services/commercial/commercial.service.test.js -> commercial.service.test: OK
cd backend && node src/services/commercial/contractSubscriptionSync.service.test.js -> CONTRACT_SUBSCRIPTION_SYNC_TEST_PASS
npm --prefix backend test -> exit code 0
npm --prefix frontend run typecheck -> exit code 0
node scripts/release-rbac/check-role-alias-equivalence.js -> PASS
node scripts/release-rbac/check-residual-role-authority.js -> RESIDUAL_AUTHORIZATION_AUTHORITY=0, UNCLASSIFIED_ROLE_CHECKS=0
node scripts/release-rbac/check-frontend-backend-authorization-consistency.js -> PASS
node scripts/release-rbac/check-release-rbac-contract.js -> RELEASE_RBAC_CONTRACT_PASS permissions=175 roles=7
node scripts/deploy-vms-strategy.test.js -> DEPLOY_VM_STRATEGY_TEST_PASS
node scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.test.js -> TCDX_COMMERCIAL_RUNTIME_INTEGRAL_CLOSEOUT_POSTGRES_TEST=PASS
node scripts/normalization/apply-tcdx-commercial-runtime-integral-closeout.js --checksum -> checksum=4310372bbd795eef116b14110283d16e0ef7a247ee81d51b54de7d4a6debe51d
bash -n scripts/deploy-vms.sh -> PASS
git diff --check -> PASS
```

The isolated PostgreSQL test first failed inside the managed sandbox because local `initdb` could not create a shared memory segment. It was rerun outside the sandbox with approval, using an isolated localhost-only Docker/PostgreSQL path, and cleaned up successfully.

## Do Not Rediscover

- Do not reintroduce TCP binding into the commercial unit/route harness.
- Do not re-add runtime dependency on `normalize_status_for_audits(text)`.
- Do not treat absent `search_history` as fatal runtime schema drift.
- Do not remove `tenant_id` from `tenant_subscription_addons` writes/copy.
- Do not seed tenant/customer/user/email/UUID/demo commercial data.
- Do not replay historical migrations for fresh `tcdx_saasv2`; this runner belongs only to `FRESH_PRODUCTION_MIGRATION_RUNNERS`.

## Residual Risks

- Local isolated PostgreSQL proves baseline+V1+V2+V3+fresh RBAC+commercial migration behavior, not deployed production behavior.
- No real `tcdx_saasv2` preflight/apply/runtime smoke was executed by Codex.
- Human review should still validate runtime grants/object scope before production apply.

## Manual Next Action

Human review this diff. If accepted, the owner can commit/push/CI/merge/deploy manually and run authorized fresh deploy/runtime validation against the intended environment. Codex must not commit, push, merge, deploy, edit `.env`, or touch real databases for this closeout.
