# TCDX SaaSv2 Backend Cutover Review

Status: `TCDX_SAASV2_BACKEND_CUTOVER_BLOCKED`

Date: 2026-09-09
Branch: `main`
HEAD: `f688249a64dcfabd1b17aec260a56fbf3da1a986`
origin/main: `f688249a64dcfabd1b17aec260a56fbf3da1a986`

## Result

The inherited `RUNTIME_CREDENTIAL_ENV_MISSING` blocker is resolved for this run. `PG*`, `DB_*` and `JWT_SECRET` were present without printing secret values. Direct `psql` returned `tcdx_saasv2|tcdx_backend_app|t`, and the real backend pool returned `tcdx_saasv2|tcdx_backend_app|tcdx_backend_app|true`.

The review remains blocked by real runtime compatibility defects in `tcdx_saasv2`.

## Blocking Evidence

- `AUTH_RBAC=FAIL_REAL_RUNTIME_SCHEMA_DEFECT`: tenant users can log in, but authenticated tenant requests fail before RBAC because `backend/src/middleware/auth.js` queries `tenants.suspended_at`, `tenants.deleted_at`, `tenants.suspension_reason` and `tenants.deletion_reason`; those columns are absent in the target.
- `RUNTIME_ROLE_COMPATIBILITY=FAIL_REAL_RUNTIME_PRIVILEGE_DEFECT`: `tcdx_backend_app` lacks effective privileges on `public.assets`, `public.risks`, `public.risk_control_relations` and `public.tenant_operations`.
- `CRITICAL_API_SMOKE=FAIL_REAL_RUNTIME_SCHEMA_AND_PRIVILEGE_DEFECTS`: the temporary backend recorded 6 HTTP 500 responses.
- Missing or incompatible runtime objects included `tenant_standard_operations`, `asset_risks`, `v_iso_risk_matrix_summary`, `v_iso_effective_kpi_summary`, `v_commercial_tenant_subscription`, `v_commercial_tenant_modules` and `v_commercial_tenant_capabilities`.
- Runtime query shape defects included `assets.iso`, `op1.is_default` and `operation_id` in the active backend paths probed.

## What Passed

- `GIT_PRECHECK=PASS`.
- `DATABASE_IDENTITY_GUARD=PASS`.
- `BACKEND_TEMPORARY_STARTUP=PASS`: local isolated port `43117`, `/live=200`, `/ready=200`, `/health=200`.
- Schedulers were controlled: `GRC_PHASE1_SCHEDULER_ENABLED=false`, `DISABLE_PHASE2_SCHEDULER=1`, and metrics showed `tcdx_grc_phase1_scheduler_runs_total=0`.
- `ZERO_LEGACY_RUNTIME=PASS_FOR_EXPLICIT_PROHIBITED_OBJECTS`: no exact active backend references to the prohibited legacy authorities and the named legacy/backup/QA objects were absent from `tcdx_saasv2`.
- `CLEANUP=PASS`: final synthetic tenants/users/runtime rows are all 0.

## Runtime Metrics

```text
HTTP_5XX=6
SQL_ERRORS=>0
CROSS_TENANT_LEAKAGE=NOT_MEASURED_BLOCKED_BY_AUTH_SCHEMA
UNHANDLED_RUNTIME_ERRORS=>0
SYNTHETIC_TENANTS=0
SYNTHETIC_USERS=0
SYNTHETIC_RUNTIME_ROWS=0
```

## Decision

`TCDX_SAASV2_BACKEND_CUTOVER_BLOCKED`

Do not retry with `postgres` or grants applied manually to make the gate pass. Reconcile the fresh baseline/forward migration set with the active backend runtime contract, add explicit least-privilege grants for confirmed active dependencies, recreate or migrate `tcdx_saasv2` through the reviewed path, then rerun from identity guard.
