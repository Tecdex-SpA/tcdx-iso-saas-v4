# TCDX SaaSv2 GRC Runtime Contract Closeout V3

Status: `TCDX_SAASV2_GRC_RUNTIME_CONTRACT_V3_READY_FOR_CLONE_VALIDATION`

Date: 2026-09-10

Branch: `fix/tcdx-saasv2-runtime-schema-closeout`

HEAD at implementation start: `f688249a64dcfabd1b17aec260a56fbf3da1a986`

## Scope

Local-only V3 closeout for the GRC runtime contract required by the active backend after V1/V2. This work did not connect to or write `tcdx_saasv2`.

New migration:

`database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql`

## Diagnosis Preserved

V2 validated on clone and backend startup reached `/health=healthy`, but GRC scheduler runtime still failed with PostgreSQL `42703` due to missing backend-consumed DB contract. V3 closes the confirmed gap for:

- `saas_modules`
- `tenant_module_settings`
- GRC Phase 1 runtime
- GRC Phase 2 runtime and connector scheduler contract
- GRC Phase 3 operational runtime
- effective grants for `tcdx_backend_runtime`

## Objects Incorporated

V3 validation covers:

- Phase 1: 49 objects.
- Phase 2: 44 objects.
- Phase 3: 16 objects.

The detailed consumer matrix is:

`artifacts/db-integral/tcdx-saasv2-grc-runtime-closeout-v3/GRC_RUNTIME_CONTRACT_MATRIX.md`

## Compatibility Decisions

`tenant_module_settings.is_enabled` is the canonical runtime field because all active GRC scheduler/service paths query it directly.

Legacy `enabled` remains for compatibility. V3 adds a trigger that:

- syncs legacy `enabled` -> canonical `is_enabled`;
- syncs canonical `is_enabled` -> legacy `enabled`;
- rejects divergent writes when both values are explicitly different;
- updates `enabled_at`, `disabled_at`, and `updated_at` deterministically.

`saas_modules` now includes `default_enabled`, `is_system`, and `updated_at`. GRC module catalog rows are global and deny-by-default; no tenant-specific enablement is seeded.

## Tenant Isolation

Critical connector child relations enforce tenant-aware composite FKs:

- `grc_connector_runs(tenant_id, integration_id)` -> `grc_connector_instances(tenant_id, id)`
- `grc_external_records(tenant_id, integration_id)` -> `grc_connector_instances(tenant_id, id)`
- `grc_connector_dead_letters(tenant_id, integration_id)` -> `grc_connector_instances(tenant_id, id)`

Negative cross-tenant insert test: PASS.

## Privileges

V3 uses explicit grants to `tcdx_backend_runtime`.

- `saas_modules`: `SELECT`
- `tenant_module_settings`: `SELECT, INSERT, UPDATE`
- GRC runtime tenant tables: `SELECT, INSERT, UPDATE, DELETE` where backend service paths read/write/delete
- `grc_connector_definitions`: `SELECT`

No `GRANT ON ALL TABLES`.

No `GRANT EXECUTE ON ALL FUNCTIONS`.

`reconcile_tenant_module_settings_enabled()` is not executable by `tcdx_backend_runtime`.

## Tests

Command:

```bash
node scripts/normalization/apply-tcdx-saasv2-grc-runtime-contract-closeout-v3.test.js
```

Result: PASS.

Covered gates:

- `BASELINE_FRESH_GRC_RUNTIME_CONTRACT PASS`
- `SAAS_MODULES_RUNTIME_COLUMNS PASS`
- `TENANT_MODULE_SETTINGS_RUNTIME_COLUMNS PASS`
- `TENANT_MODULE_SETTINGS_COMPATIBILITY PASS`
- `GRC_PHASE1_REQUIRED_OBJECTS PASS`
- `GRC_PHASE2_REQUIRED_OBJECTS PASS`
- `GRC_PHASE3_REQUIRED_OBJECTS PASS`
- `GRC_CONNECTOR_RUNTIME_COLUMNS PASS`
- `GRC_SCHEDULER_RUNTIME_COLUMNS PASS`
- `GRC_PHASE1_SCHEDULER_DISCOVERY PASS`
- `GRC_PHASE2_SCHEDULER_DISCOVERY PASS`
- `GRC_RUNTIME_GRANTS PASS`
- `GRC_RUNTIME_NO_EXCESSIVE_PRIVILEGES PASS`
- `GRC_CRITICAL_TENANT_AWARE_FKS PASS`
- `GRC_CROSS_TENANT_RELATION_BLOCK PASS`
- `GRC_ZERO_FIXED_TENANT_SEED PASS`
- `GRC_ZERO_DEMO_DATA PASS`
- `V3_APPLY_1 PASS`
- `V3_APPLY_2_IDEMPOTENT PASS`
- `FRESH_AND_UPGRADE_RUNTIME_CONVERGENCE PASS`
- `FINAL_TENANTS_ZERO PASS`
- `TCDX_SAASV2_GRC_RUNTIME_CONTRACT_CLOSEOUT_V3_TEST PASS`

## Not Tested

- No SQL was executed against `tcdx_saasv2`.
- No clone validation was executed against `tcdx_saasv2_v2clone_20260909` in this Codex pass.
- No backend was started against any production or clone DB in this Codex pass.
- No deploy, commit, push, merge or VM migration was executed.

## Clone Validation Next Steps

1. From authorized operator context only, clone/refresh validation target as needed.
2. Apply V3 after V1 and V2 on the clone.
3. Reapply V3 once to prove idempotence.
4. Start backend against clone only.
5. Validate `/health`.
6. Validate Phase 1 scheduler discovery query.
7. Validate Phase 2 scheduler discovery query.
8. Confirm no `42703`, `phase2_scheduler dependency_unavailable`, or `scheduler_runner failed` noise from missing DB columns.
9. Do not declare production readiness from this local closeout alone.

## Confirmations

`REAL_DB_NOT_TOUCHED`

`SOURCE_TCDX_SAASV2_NOT_TOUCHED`

`NO_COMMIT`

`NO_PUSH`

`NO_MERGE`

`NO_DEPLOY`
