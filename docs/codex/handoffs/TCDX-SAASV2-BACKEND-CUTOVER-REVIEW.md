# TCDX SaaSv2 Backend Cutover Review

Status: `TCDX_SAASV2_BACKEND_CUTOVER_BLOCKED`

Date: 2026-09-09
Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `main`
HEAD: `f688249a64dcfabd1b17aec260a56fbf3da1a986`
origin/main: `f688249a64dcfabd1b17aec260a56fbf3da1a986`

## Scope

Continuation of the real, non-destructive backend cutover review against `tcdx_saasv2`. No deploy, permanent cutover, commit, push, merge, persistent `.env` edit, database create/drop, baseline reload, seed reload, `tecdex_saas` write, or real tenant/customer data was used.

This continuation resumed from the inherited blocker `RUNTIME_CREDENTIAL_ENV_MISSING`, then advanced through the real backend pool identity guard, temporary local backend startup, synthetic auth/API probes, zero-legacy runtime checks and cleanup.

## Continuation Result

The previous `RUNTIME_CREDENTIAL_ENV_MISSING` blocker is resolved in the Codex shell used for this run.

Both direct `psql` and the real backend pool configured by `backend/src/config/db.js` connected as:

```text
database=tcdx_saasv2
current_user=tcdx_backend_app
session_user=tcdx_backend_app
member_of_tcdx_backend_runtime=true
```

The cutover remains blocked by real runtime compatibility defects found after temporary backend startup:

- `REAL_RUNTIME_SCHEMA_DEFECT`: tenant auth validation expects tenant lifecycle columns not present in the fresh `tcdx_saasv2` schema.
- `REAL_RUNTIME_SCHEMA_DEFECT`: active backend routes expect runtime objects/views absent from the fresh schema.
- `REAL_RUNTIME_SCHEMA_DEFECT`: active backend queries expect columns not present in runtime objects/views.
- `REAL_RUNTIME_PRIVILEGE_DEFECT`: `tcdx_backend_app`/`tcdx_backend_runtime` lacks effective privileges on active runtime tables/views.

These are not credential or superuser problems, and they were not bypassed with `postgres`.

## Git Precheck

```text
git branch --show-current -> main
git rev-parse HEAD -> f688249a64dcfabd1b17aec260a56fbf3da1a986
git rev-parse origin/main -> f688249a64dcfabd1b17aec260a56fbf3da1a986
git diff --check -> PASS
```

Dirty worktree was expected and preserved:

- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/handoffs/TCDX-SAASV2-BACKEND-CUTOVER-REVIEW.md`
- `artifacts/db-integral/tcdx-saasv2-backend-cutover-review/`

## Credential Environment Check

Presence-only check, with no secret values printed or written:

```text
PGHOST=127.0.0.1
PGPORT=55432
PGUSER=tcdx_backend_app
PGDATABASE=tcdx_saasv2
PGPASSWORD=SET
DB_HOST=127.0.0.1
DB_PORT=55432
DB_USER=tcdx_backend_app
DB_NAME=tcdx_saasv2
DB_PASSWORD=SET
JWT_SECRET=SET
```

## Identity Guards

Direct `psql` guard:

```text
tcdx_saasv2|tcdx_backend_app|t
```

Backend pool guard through `backend/src/config/db.js`:

```text
BACKEND_POOL_IDENTITY=tcdx_saasv2|tcdx_backend_app|tcdx_backend_app|true
```

## Temporary Backend Startup

Started one local, temporary backend instance on isolated port `43117` with dangerous/background schedulers disabled:

```text
PORT=43117
GRC_PHASE1_SCHEDULER_ENABLED=false
DISABLE_PHASE2_SCHEDULER=1
DB_APPLICATION_NAME=tcdx_backend_cutover_review
```

Startup probes:

```text
/live -> 200
/ready -> 200
/health -> 200
tcdx_grc_phase1_scheduler_runs_total=0
tcdx_grc_phase1_scheduler_retries_total=0
```

The backend was shut down cleanly. Post-shutdown probe returned no listener:

```text
AFTER_STOP_HTTP=000
```

`BACKEND_TEMPORARY_STARTUP=PASS`, but this does not imply API/runtime readiness.

## Runtime Defects

### REAL_RUNTIME_SCHEMA_DEFECT

Tenant-user login succeeded, but authenticated tenant API calls failed auth validation before RBAC/tenant isolation could be proven:

```text
AUTH ERROR: column "suspended_at" does not exist
```

The active auth middleware also expects tenant lifecycle fields absent from the target schema:

```text
suspended_at
deleted_at
suspension_reason
deletion_reason
```

Active route/platform probes also exposed missing runtime objects/views:

```text
tenant_standard_operations
asset_risks
v_iso_risk_matrix_summary
v_iso_effective_kpi_summary
v_commercial_tenant_subscription
v_commercial_tenant_modules
v_commercial_tenant_capabilities
```

Observed query-shape mismatches:

```text
column a.iso does not exist
column op1.is_default does not exist
column operation_id does not exist
```

### REAL_RUNTIME_PRIVILEGE_DEFECT

The app principal is a non-superuser runtime role, but lacks effective access for active runtime paths:

```text
SELECT assets -> permission denied
SELECT risks -> permission denied
SELECT risk_control_relations -> permission denied
SELECT tenant_operations -> permission denied
```

Minimum observed privilege delta before retest:

- At least `SELECT` on `public.assets`, `public.risks`, `public.risk_control_relations` and `public.tenant_operations` if those remain active backend runtime sources.
- DML requirements were not broadened or inferred.
- No grants were changed by Codex.

## API/Auth Evidence

Synthetic fixtures were created only for this run and removed during cleanup:

```text
RUN_ID=cutover-1788977868634-ecba6d6b
TENANT_A=6f4e8a0b-94ec-4e8c-a258-bc452a75de65
TENANT_B=322f38e2-8f5b-474e-a465-36d88f55ae16
```

Login probes:

```text
tenant A admin login -> 200
tenant A auditor login -> 200
tenant A viewer login -> 200
tenant B admin login -> 200
bad password -> 401 AUTH_INVALID_CREDENTIALS
```

Tenant-authenticated API probes after login all returned `401 INVALID_TOKEN` because auth validation hit the tenant schema defect. Therefore:

```text
AUTH_RBAC=FAIL_REAL_RUNTIME_SCHEMA_DEFECT
CROSS_TENANT_LEAKAGE=NOT_MEASURED_BLOCKED_BY_AUTH_SCHEMA
```

Platform probes were useful for runtime route discovery but are not accepted as tenant isolation proof.

## Runtime Metrics

Observed after focused smoke:

```text
tcdx_http_requests_total=53
tcdx_http_errors_total=6
HTTP_5XX=6
SQL_ERRORS=>0
UNHANDLED_RUNTIME_ERRORS=>0
```

Because `HTTP_5XX`, SQL errors and auth schema defects are non-zero, READY is blocked.

## Formula, Health, Risk and Knowledge

Canonical authorities remain unchanged:

```text
executive Health: F5_5_GRC_HEALTH
control effectiveness: F5_5_CONTROL_EFFECTIVENESS
canonical output: calculation_outputs.output_value.value
```

No Health/formula pass was inferred. Tenant-authenticated runtime formula and Health routes were blocked by auth/schema failures and existing HTTP 5xx. Risk canonical probing failed due to missing runtime view `v_iso_risk_matrix_summary`. Knowledge runtime had only partial platform-level probes:

```text
/api/knowledge-base/standards -> 200
/api/knowledge-base/search?q=ISO -> 200
/api/intelligence/brief/:tenant_id -> 200, ai_used=false
```

The intelligence brief logged source skips for missing/unauthorized runtime sources, so this is not a full `KNOWLEDGE_RUNTIME=PASS`.

## Zero Legacy Runtime

Focused explicit prohibited-object checks passed:

```text
LEGACY_RUNTIME_REFERENCES=0
ZERO_LEGACY_RUNTIME=PASS_FOR_EXPLICIT_PROHIBITED_OBJECTS
```

No active backend source reference was found for the explicit banned runtime authorities:

```text
public.controls
control_health_scores
KPI-HLT
refresh_control_health_scores_v2_1
v_latest_health_kpi_snapshots
tecdex_saas
```

The corresponding banned DB objects were absent in `tcdx_saasv2`.

## Cleanup

Cleanup ran after the failed gate and removed all synthetic tenant-scoped rows created by this review:

```text
SYNTHETIC_TENANTS=0
SYNTHETIC_USERS=0
SYNTHETIC_RUNTIME_ROWS=0
CLEANUP=PASS
```

The temporary password scratch file under `/tmp` was removed. No catalog/formula/knowledge reference data was deleted.

## Gates

```text
GIT_PRECHECK=PASS
DATABASE_IDENTITY_GUARD=PASS
DATABASE_PREFLIGHT=FAIL_REAL_RUNTIME_SCHEMA_COMPATIBILITY
CREDENTIAL_ENV_CHECK=PASS
RUNTIME_ROLE_COMPATIBILITY=FAIL_REAL_RUNTIME_PRIVILEGE_DEFECT
BACKEND_TEMPORARY_STARTUP=PASS
BACKEND_DB_CONNECTION=tcdx_saasv2
AUTH_RBAC=FAIL_REAL_RUNTIME_SCHEMA_DEFECT
CRITICAL_API_SMOKE=FAIL_REAL_RUNTIME_SCHEMA_AND_PRIVILEGE_DEFECTS
HTTP_5XX=6
SQL_ERRORS=>0
CROSS_TENANT_LEAKAGE=NOT_MEASURED_BLOCKED_BY_AUTH_SCHEMA
FORMULA_RUNTIME=NOT_EXECUTED_BLOCKED_BY_AUTH_SCHEMA_AND_HTTP_5XX
GRC_HEALTH_CANONICAL=NOT_EXECUTED_BLOCKED_BY_AUTH_SCHEMA_AND_HTTP_5XX
RISK_CANONICAL=FAIL_MISSING_RUNTIME_VIEW
KNOWLEDGE_RUNTIME=PARTIAL_PLATFORM_PROBE_ONLY
ZERO_LEGACY_RUNTIME=PASS_FOR_EXPLICIT_PROHIBITED_OBJECTS
LEGACY_RUNTIME_REFERENCES=0
UNHANDLED_RUNTIME_ERRORS=>0
CLEANUP=PASS
SYNTHETIC_TENANTS=0
SYNTHETIC_USERS=0
SYNTHETIC_RUNTIME_ROWS=0
git diff --check=PASS
```

## Do Not Rediscover

- Do not rerun DB-N01..DB-N05 or the real smoke structural package.
- Do not use `postgres` to make runtime gates pass.
- Do not convert missing schema columns/objects into zero/no-op behavior.
- Do not use broad/global grants, superuser, ownership transfer or `BYPASSRLS`.
- Do not mark platform probes as tenant isolation.
- Do not mark partial knowledge probes as full runtime pass.
- Do not rerun cutover until the runtime schema/privilege contract is reconciled.

## Next Exact Action

Human/backend owner review should reconcile the fresh baseline or forward-only correction set with the active backend runtime contract before reattempting this cutover:

1. Add the missing tenant lifecycle columns required by `backend/src/middleware/auth.js`, or change auth to use only columns guaranteed by the fresh baseline.
2. Add or intentionally replace the missing active runtime objects/views: `tenant_standard_operations`, `asset_risks`, `v_iso_risk_matrix_summary`, `v_iso_effective_kpi_summary` and `v_commercial_tenant_*`.
3. Reconcile active route queries expecting `a.iso`, `op1.is_default` and `operation_id` with the fresh schema.
4. Add explicit least-privilege grants only for confirmed active runtime tables/views needed by `tcdx_backend_runtime`.
5. Recreate `tcdx_saasv2` from the corrected baseline or apply the reviewed forward-only correction, then rerun this review from `DATABASE_IDENTITY_GUARD`.

## Decision

`TCDX_SAASV2_BACKEND_CUTOVER_BLOCKED`
