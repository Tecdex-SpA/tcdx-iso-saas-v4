# TCDX SaaSv2 Fresh Deploy Architecture

Date: 2026-09-10

Status: `TCDX_SAASV2_FRESH_DEPLOY_ARCHITECTURE_READY_FOR_PRODUCTION`

Owner: CODEX A / codex
Branch: `main`
Base HEAD: `e2e8af2ed75b3c04303d20726a4fd308ce07c15b`
Commit: none; no git add/commit/push/merge/deploy.

## Objective

Correct the deploy architecture so `tcdx_saasv2`, a DB-N05 fresh production database, cannot receive the historical Phase 3/4/5/5-C2/5-C3/F6/RBAC/commercial/normalization/hotfix migration chain during normal application deploy.

No production DB was touched. No protected env file was modified or printed.

## Root Cause

`scripts/deploy-vms.sh` had a single unconditional `MIGRATION_RUNNERS` list and always executed every registered historical runner with `--preflight` and `--apply` before deploying services. That violates DB-N05, where fresh production is built from:

`production_schema_v1.sql -> production_seed_v1.sql -> load-production-reference-catalogs.js`

Historical migrations are preserved only for upgrades of existing databases.

Continuation note: the resumed guard run initially failed after `BACKEND_DOTENV_PARSER_SPACES=PASS`; the later `SECRETS_NOT_PRINTED`, `NO_BOOTSTRAP_ON_NORMAL_DEPLOY`, `NO_HISTORICAL_PHASE_RUNNER_ON_FRESH_DEPLOY` and `DEPLOY_CONTINUES_WITH_ZERO_PENDING_FORWARD_MIGRATIONS` markers were not reached. Root cause was the self-test capturing negative-path helper functions that call `exit` directly inside command substitution under `set -e`. The deploy logic was preserved; the self-test now executes those failing paths inside subshells so their output is inspected without aborting the whole self-test.

## Changes

- `scripts/deploy-vms.sh` now has explicit DB strategies:
  - `fresh-baseline`
  - `historical-upgrade`
- Fresh deploy uses `FRESH_PRODUCTION_MIGRATION_RUNNERS=()` and therefore runs no DDL when no post-baseline forward-only migrations are registered.
- Historical deploy uses `HISTORICAL_MIGRATION_RUNNERS`, preserving the existing chain for non-fresh databases.
- `MIGRATION_DATABASE_URL` identity is validated with:
  `current_database(), current_user, inet_server_addr(), inet_server_port()`.
- Backend runtime DB is validated from backend `.env` before service deploy and again after backend deploy using `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`, without printing password.
- Guard rules:
  - `fresh-baseline` requires `current_database=tcdx_saasv2`.
  - `historical-upgrade` rejects `tcdx_saasv2`.
  - backend runtime DB must match the selected strategy.
  - deploy does not modify env files.
- Added `scripts/deploy-vms-strategy.test.js` and local self-test mode `TCDX_DEPLOY_GUARD_SELF_TEST=1`.
- Hardened the local guard self-test so failure-output redaction checks evaluate real guard output without `set -e` aborting before the redaction/runners gates.
- Updated `scripts/deploy-vms-strategy.test.js` to require the quiet dotenv parser shape used by the deploy guard.
- Preserved the DB-N05 seed contract by adding the explicit `AI_ADDON` classification marker to the existing global `commercial_addons.ai` seed metadata.
- Updated the DB-N05 fresh harness to stop classifying `evidences.control_id` as a forbidden legacy column, because ADR-062/V2 define it as valid catalog identity.

## Ledger Analysis

- V1 `20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql` writes `schema_migrations`.
- V1 uses literal `repeat('0', 64)` as checksum, so the observed 64-zero checksum is intentional in the SQL, not a computed SHA-256.
- V2 `20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql` does not write `schema_migrations`.
- V3 `20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql` does not write `schema_migrations`.
- Therefore the single V1 ledger row is explained by implementation, not by failed V2/V3 commits.
- This is an observability gap for forward-only tracking. Do not patch production ledger manually; future fresh post-baseline migrations should be registered via explicit runner/ledger with computed checksum.

## V1/V2/V3 Treatment

V1/V2/V3 were already manually applied to `tcdx_saasv2`. They are treated as baseline/post-baseline material already present and are not placed in the recurrent fresh deploy runner list. A later reviewed task may introduce non-destructive ledger reconciliation for V2/V3 if desired, but this task does not create artificial production rows.

## Tests

PASS:

- `bash -n scripts/deploy-vms.sh`
- `node scripts/deploy-vms-strategy.test.js`
- `TCDX_DEPLOY_GUARD_SELF_TEST=1 TCDX_DB_DEPLOY_STRATEGY=fresh-baseline bash scripts/deploy-vms.sh`
- `env -u TCDX_DB_DEPLOY_STRATEGY bash scripts/deploy-vms.sh` fails closed before remote operations

The strategy test proves these markers:

- `STRATEGY_MISSING_ABORTS=PASS`
- `FRESH_MODE_ACCEPTS_TCDX_SAASV2=PASS`
- `HISTORICAL_MODE_ACCEPTS_LEGACY_DB=PASS`
- `FRESH_DB_DOES_NOT_RUN_HISTORICAL_MIGRATIONS=PASS`
- `TCDX_SAASV2_REJECTS_HISTORICAL_UPGRADE=PASS`
- `FRESH_MODE_REQUIRES_TCDX_SAASV2=PASS`
- `WRONG_MIGRATION_DATABASE_ABORTS=PASS`
- `WRONG_BACKEND_RUNTIME_DATABASE_ABORTS=PASS`
- `BACKEND_DOTENV_PARSER_SPACES=PASS`
- `SECRETS_NOT_PRINTED=PASS`
- `NO_BOOTSTRAP_ON_NORMAL_DEPLOY=PASS`
- `NO_HISTORICAL_PHASE_RUNNER_ON_FRESH_DEPLOY=PASS`
- `DEPLOY_CONTINUES_WITH_ZERO_PENDING_FORWARD_MIGRATIONS=PASS`

Additional DB-N05 tests were executed per prompt and recorded in final response.

## Do Not Rediscover

- DB-N05 fresh bootstrap is not the historical migration chain.
- `database/migrations/*.sql` are migration-only upgrade history unless explicitly registered as future fresh post-baseline migrations.
- `tcdx_saasv2` must never use `historical-upgrade`.
- Normal application deploy must not replay `production_schema_v1.sql`, `production_seed_v1.sql` or `load-production-reference-catalogs.js`.
- The V1 64-zero checksum comes from literal SQL; do not assume it is the file hash.

## Next Action

Human review, then commit/push by owner. For go-live deploy, set/verify protected env files manually and run:

`TCDX_DB_DEPLOY_STRATEGY=fresh-baseline ./scripts/deploy-vms.sh`

Codex did not run deploy.
