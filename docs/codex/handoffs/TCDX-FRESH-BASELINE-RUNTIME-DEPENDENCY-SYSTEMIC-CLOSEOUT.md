# TCDX Fresh Baseline Runtime Dependency Systemic Closeout

Date: 2026-09-11

Status: `FRESH_BASELINE_RUNTIME_DEPENDENCY_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW`

Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`

Branch: `main`

Verified base/HEAD at start of continuation: `30d280a6e0e4853d9b6cfb013d9606571a8d8621`

Production DB policy: Codex did not connect to, write, migrate, preflight or deploy against real `tcdx_saasv2`.

## Root Cause

The previous fresh runtime closeouts aligned large parts of the baseline, RBAC and commercial runtime contract, but active backend SQL still had reachable dependencies not represented by the fresh production path:

- Admin SaaS controls initialization and tenant standards query shape.
- Runtime tables/views for notifications, document index/exclusions, report catalog/access/exports, ISO Express and ISO Operational Suggestions.
- Explicit grants needed by `tcdx_backend_runtime`.
- Legacy physical columns on `iso_operational_suggestions` that remained `NOT NULL` although current services write the newer runtime shape.

The defect was systemic drift between active backend SQL, fresh baseline, forward fresh migrations and runtime role grants. It was not only the duplicate `initialize-controls` endpoint.

## Dependency Classification

Schema contracts created or extended:

- `notifications`
- `document_index`
- `tenant_document_index_exclusions`
- `report_types`
- `report_access_rules`
- `report_exports`
- `iso_catalog_sync_status`
- `iso_express_assessments`
- `iso_express_assessment_items`
- `iso_express_assessment_gaps`
- `iso_express_assessment_answers`
- `iso_express_assessment_audit_log`
- `iso_operational_suggestion_audit_log`
- `iso_operational_suggestions` runtime columns and nullable legacy compatibility columns
- `iso_recommended_action_conversions` runtime columns
- `v_iso_control_effective_health`
- `v_iso_control_catalog_coverage`
- `v_iso_express_tenant_standard_readiness`
- `v_health_root_causes_by_tenant`
- `v_iso_operational_suggestions_queue`
- `v_iso_operational_suggestions_summary`

Code contracts corrected:

- `backend/src/routes/admin-saas.routes.js`: one executable `initialize-controls` handler remains; duplicate handler removed.
- `backend/src/routes/admin-saas.routes.js`: handler no longer writes `tenant_controls.notes`, no longer creates `score=0`/`deteriorado`, inserts `tenant_standard_id`, and does not choose an arbitrary operation when multiple active operations exist without a unique default.
- `backend/src/routes/tenant-standards.routes.js`: `created_at` projection uses `COALESCE(contracted_at, activated_at, updated_at)` because fresh `tenant_standards` has no `created_at`.

Optional/degraded dependencies:

- `tenant_controls.notes`: not a fresh runtime contract. The only active textual consumer found treats it dynamically as optional column availability; migration intentionally does not add it.
- `search_history`: remains optional from commercial runtime closeout and is not recreated by this package.
- `document_index` source/integration same-tenant FKs are added only when parent `tenant_document_sources`/`tenant_integrations` contracts exist.

Contracts rejected as legacy authority:

- `control_health_scores`
- KPI-HLT as per-control Health authority
- SQL function `normalize_status_for_audits(text)`
- Arbitrary tenant control operation selection via `ORDER BY ... LIMIT 1`

## Migration

File:

- `database/migrations/20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout.sql`

Checksum:

- `f3f8a24a7dd3cdb194f4751bdc80345094bb408bd698ab0e4af971ff15f7e13e`

Properties:

- Forward-only and transactional.
- Idempotent with `IF NOT EXISTS`, upserted product catalog rows and guarded constraints.
- No `GRANT ALL`.
- No schema-wide grants.
- No tenant/user/subscription seed data.
- No hardcoded tenant/customer/email.
- No `.env` dependency.
- Does not make `tcdx_backend_runtime` LOGIN.
- Does not enable universal RLS.
- Does not add `tenant_controls.notes`.

## Runner

File:

- `scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js`

Modes:

- `--checksum`
- `--preflight`
- `--apply`

Safety:

- Uses ledger table `schema_migrations`.
- `already_applied` requires exact checksum.
- Applied checksum mismatch fails closed.
- `running` ledger state fails closed.
- Failed ledger state is retryable as pending.
- Uses advisory lock `(844332, 2026091007)`.
- Sanitizes DB URLs/passwords from output.
- Verifies base schema, runtime role, postconditions, explicit grants, no tenant_controls notes, no Health legacy authority and no runtime LOGIN on `tcdx_backend_runtime`.

Fresh deploy registration:

- Appended to `FRESH_PRODUCTION_MIGRATION_RUNNERS` in `scripts/deploy-vms.sh`.
- Order is:
  1. Fresh runtime contract closeout.
  2. Release RBAC capability systemic closeout.
  3. Commercial runtime integral closeout.
  4. Fresh baseline runtime dependency systemic closeout.

Historical strategy remains separate and must not run this chain against `tcdx_saasv2`.

## Checker

File:

- `scripts/normalization/check-fresh-baseline-runtime-dependencies.js`

Coverage:

- Bounded runtime SQL inventory across `backend/src/routes`, `backend/src/controllers`, `backend/src/services`, `backend/src/utils`.
- Explicit required relation/function/column/grant manifest.
- Surface probes for Health, ISO Express, operational suggestions, reports, documents, notifications, controls initialization and policies.
- Static veto for `normalize_status_for_audits`.
- Migration veto for `control_health_scores`, KPI-HLT and `tenant_controls.notes`.
- Optional `--mutation-probes` validates real INSERT/UPDATE shapes under `SET LOCAL ROLE tcdx_backend_runtime` inside a rolled-back transaction and verifies same-tenant FK failure for ISO Express child rows.

Important limitation:

- The scanner is a regex inventory, not a SQL parser. The PASS gate comes from scanner plus explicit contract manifest plus SQL probes.

## Tenant Isolation / Integrity

Implemented/validated:

- Tenant-scoped tables have tenant FKs.
- ISO Express child rows have composite `(tenant_id, assessment_id)` FKs to parent assessment.
- `document_index` can add same-tenant FKs to document source/integration when those parents exist, with parent `(tenant_id, id)` uniqueness.
- Operational suggestion audit log references suggestions by `(tenant_id, suggestion_id)`.
- Recommended action conversions reference suggestions by `(tenant_id, recommendation_id)`.
- Runtime grants are explicit and scoped to needed DML/SELECT.
- `tcdx_backend_runtime` remains `NOLOGIN`.

RLS:

- No universal RLS was added. DB-N03/DB-N04 staged RLS decisions remain unchanged.

## Health / Control View

`public.v_iso_control_effective_health` remains the per-control Health projection authority and uses only:

- `metric_snapshots.metric_code = 'F5_5_CONTROL_EFFECTIVENESS'`
- explicit `tenant_control_id` from snapshot `metadata` or `snapshot_payload`

The view does not read or reintroduce:

- `control_health_scores`
- KPI-HLT
- global `F5_5_GRC_HEALTH` as per-control Health

`category` comes from real `controls_catalog.category`.

Missing or not-measured snapshots preserve `NULL` score and explicit non-measured status.

## Local Validation

Executed on 2026-09-11:

| Gate | Result |
|---|---|
| `git diff --check` | PASS |
| `bash -n scripts/deploy-vms.sh` | PASS |
| `node scripts/deploy-vms-strategy.test.js` | PASS, `DEPLOY_VM_STRATEGY_TEST_PASS` |
| `node scripts/normalization/check-fresh-baseline-runtime-dependencies.js --scan-only` | PASS, `RUNTIME_SQL_FILES_SCANNED=266`, `RUNTIME_SQL_REQUIRED_RELATIONS=26`, `RUNTIME_SQL_REQUIRED_FUNCTIONS=3` |
| `node scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js --checksum` | PASS, checksum `f3f8a24a7dd3cdb194f4751bdc80345094bb408bd698ab0e4af971ff15f7e13e` |
| `node scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.test.js` | PASS on isolated Docker PostgreSQL `pgvector/pgvector:pg16`; first apply, reapply, checksum mismatch fail closed, relation/column/grant/Health/same-tenant/checker probes PASS |
| `npm --prefix backend test` | PASS |
| `npm --prefix frontend run typecheck` | PASS |
| `node scripts/release-rbac/check-release-rbac-contract.js` | PASS, `RESIDUAL_AUTHORIZATION_AUTHORITY=0`, `RELEASE_RBAC_CONTRACT_PASS permissions=175 roles=7` |
| `node scripts/release-rbac/check-residual-role-authority.js` | PASS, `RESIDUAL_AUTHORIZATION_AUTHORITY=0` |
| `node scripts/release-rbac/check-role-alias-equivalence.js` | PASS |
| `node scripts/release-rbac/check-frontend-backend-authorization-consistency.js` | PASS |
| `node scripts/release-rbac/release-rbac-isolated-postgres.test.js` | PASS on isolated Docker PostgreSQL |

The isolated runtime dependency PostgreSQL test applied:

1. `database/baseline/production_schema_v1.sql`
2. `database/baseline/production_seed_v1.sql`
3. `database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql`
4. `database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql`
5. `database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql`
6. `database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql`
7. `database/migrations/20260910_release_rbac_capability_systemic_closeout.sql`
8. `database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql`
9. new runner/migration.

## Residual Risks

- This is local isolated evidence, not production runtime proof.
- The checker scanner is intentionally bounded and regex-based; it is useful as inventory but not a full SQL parser.
- Product runtime should still be validated with real application traffic in an authorized clone/staging context after human review.
- Report access seed rows are product catalog defaults based on current normalized report roles; future report templates/roles need explicit catalog updates.
- `document_index` same-tenant FKs are conditional when parent document integration/source contracts exist.

## Human Preflight Instructions

Only after human review and owner-controlled commit/push/CI/deploy approval:

1. Verify target DB identity before any migration: expected strategy `fresh-baseline`, expected DB `tcdx_saasv2`, expected runtime role member of `tcdx_backend_runtime`.
2. In an authorized clone/staging DB first, run:
   - `node scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js --checksum`
   - `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js --preflight`
   - `MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/check-fresh-baseline-runtime-dependencies.js --mutation-probes`
3. Only after clone/staging PASS, the owner may decide whether to commit/push/CI/deploy.
4. Do not run historical migration runners against `tcdx_saasv2`.
5. Do not claim production PASS until post-deploy runtime API checks prove it.

## Git State at Handoff

Expected changed files:

- `backend/src/routes/admin-saas.routes.js`
- `backend/src/routes/tenant-standards.routes.js`
- `scripts/deploy-vms.sh`
- `database/migrations/20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout.sql`
- `scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.js`
- `scripts/normalization/apply-tcdx-fresh-baseline-runtime-dependency-systemic-closeout.test.js`
- `scripts/normalization/check-fresh-baseline-runtime-dependencies.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/REGRESSION_COMMANDS.md`
- `docs/codex/handoffs/TCDX-FRESH-BASELINE-RUNTIME-DEPENDENCY-SYSTEMIC-CLOSEOUT.md`

No files were staged. No commit, push, merge or deploy was performed.
