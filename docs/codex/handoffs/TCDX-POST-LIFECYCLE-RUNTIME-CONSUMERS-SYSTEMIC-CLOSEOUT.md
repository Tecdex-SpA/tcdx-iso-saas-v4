# TCDX Post-Lifecycle Runtime Consumers Systemic Closeout

Status: `TCDX_POST_LIFECYCLE_RUNTIME_CONSUMERS_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW`

Date: 2026-09-11
Branch: `main`
Base HEAD: `dd5e2bba153367dea452db545a3c3a55c0dd097e`
Runtime target: fresh v4, human-reviewed only

Codex did not commit, push, merge, deploy, edit `.env`, connect to `tcdx_saasv2`, or write to any real database.

## Root Causes

1. Runtime consumers still treated `controls_catalog_standards.clause` and `display_clause` as physical contracts. Fresh v4 keeps clause/control identity on `controls_catalog.clause`; `controls_catalog_standards` is only a standard-control relation.
2. Diagnostico detail selected optional legacy columns such as `findings.description` and `action_plans.description/priority/owner` without checking the physical fresh contract.
3. Control status updates still called legacy `refresh_kpi_health_snapshots(uuid)`, which is not a fresh-runtime contract.
4. Health ISO routes referenced read-model views that were not materialized in fresh v4.
5. Applicability failure handling attempted to write failure metadata while the same transaction was already aborted.
6. Configuracion surfaced an optional process-contract absence as 500 instead of an empty process list.
7. Quantitative risk and AI Compliance disabled-capability states were surfaced as technical failures in user-facing consumers.

## Runtime Changes

- `backend/src/routes/controls.routes.js`, `backend/src/routes/document-integrations.routes.js`, `backend/src/services/documentAiAnalysis.service.js`, and `backend/src/services/evidenceLibrary.service.js` no longer read `ccs.clause` or `display_clause`.
- `backend/src/services/companyProfileApplicabilityEngine.service.js` records failed runs only after rollback, using an independent `pool.query`, and preserves the original error.
- `backend/src/routes/diagnostic.routes.js` and `backend/src/services/diagnostic.service.js` use effective standard membership instead of direct `cc.iso` authority and explicitly project nullable optional columns.
- `backend/src/routes/health.js`, `backend/src/routes/evidences.routes.js`, and `backend/src/controllers/kpi.controller.js` no longer call `refresh_kpi_health_snapshots(uuid)`.
- `backend/src/services/tenantProcesses.service.js` returns `[]` for missing optional process schema, preserving `/configuracion` empty-state behavior.
- `backend/src/app.js` and `backend/src/routes/ai-compliance.routes.js` allow `/api/ai-compliance/engine-health` to report contractual states instead of being blocked by the outer capability middleware.
- `frontend/src/app/matriz-riesgo/page.tsx` renders capability-disabled quantitative risk states as business-disabled messages, not generic technical errors.

## Schema Changes

Migration: `database/migrations/20260911_tcdx_post_lifecycle_runtime_consumers_systemic_closeout.sql`

Runner: `scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js`

Test: `scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.test.js`

Deploy registration: `scripts/deploy-vms.sh`, after `Control lifecycle systemic closeout`.

Checksum: `1d9e00b12bc1d05b580b3002b07ff9db318e24ef578301d439d6cbaad85cdebe`

Runner contract:

- `--checksum`
- `--preflight`
- `--apply`
- `schema_migrations` ledger
- checksum mismatch protection
- advisory lock `2026091102`
- idempotent reapply
- postconditions for required views/grants
- migration SQL sanitization
- runtime role `tcdx_backend_runtime` must be `NOLOGIN`
- no hardcoded database, tenant, user, email, or ISO product tenant data
- `--preflight` with `migration_state=pending` checks only connection, base schema, runtime role, ledger safety, checksum and applicability readiness; it does not require target views or grants that this migration creates
- `--preflight` with `migration_state=already_applied` checks full postconditions: target views, grants and runtime role `NOLOGIN`

## Health View Decisions

All requested missing views were classified as `MATERIALIZE_CANONICAL_VIEW`; none were replaced with dummy empty views.

| View | Decision | Canonical source |
|---|---|---|
| `v_control_health_risks` | `MATERIALIZE_CANONICAL_VIEW` | `tenant_controls`, `tenant_applicable_controls`, `controls_catalog`, `tenant_standards`, `v_iso_control_effective_health` |
| `v_health_root_causes_by_standard` | `MATERIALIZE_CANONICAL_VIEW` | `v_control_health_risks` |
| `v_health_remediation_summary_by_tenant` | `MATERIALIZE_CANONICAL_VIEW` | `v_control_health_risks`, `action_plans` |
| `v_health_remediation_plan` | `MATERIALIZE_CANONICAL_VIEW` | `v_control_health_risks`, `action_plans` |
| `v_remediation_executive_by_tenant` | `MATERIALIZE_CANONICAL_VIEW` | `v_health_remediation_summary_by_tenant` |
| `v_remediation_executive_by_standard` | `MATERIALIZE_CANONICAL_VIEW` | `v_health_remediation_summary_by_standard` |
| `v_evidence_approval_queue` | `MATERIALIZE_CANONICAL_VIEW` | `evidences`, `tenant_controls`, `controls_catalog` |
| `v_audit_evidence_timeline` | `MATERIALIZE_CANONICAL_VIEW` | `evidences`, `tenant_controls`, `controls_catalog` |
| `v_audit_action_plan_timeline` | `MATERIALIZE_CANONICAL_VIEW` | `action_plans`, `tenant_controls`, `controls_catalog` |
| `v_audit_event_log_enriched` | `MATERIALIZE_CANONICAL_VIEW` | `audit_event_log` |
| `v_controls_recovered_by_remediation` | `MATERIALIZE_CANONICAL_VIEW` | `v_control_health_risks`, `action_plans` |

Additional active consumers also required real materialization:

- `v_control_health_risks_applicable`
- `v_health_remediation_summary_by_standard`
- `v_audit_control_recovery_timeline`

Empty tenants naturally return zero rows from these views. No score is fabricated.

## Legacy KPI Refresh Decision

`refresh_kpi_health_snapshots(uuid)` is `REMOVE_LEGACY_DEPENDENCY`.

Rationale:

- canonical per-control Health is `v_iso_control_effective_health`;
- official score lineage remains `F5_5_CONTROL_EFFECTIVENESS`;
- controls without evaluation remain no-data/sin_datos;
- `control_health_scores` and KPI-HLT are not fresh-runtime authorities;
- status updates should persist the status and read canonical Health projection, not invoke legacy KPI mutation.

## Diagnostic Correction

Diagnostico now:

- avoids `controls_catalog_standards.clause`;
- uses standard membership via `controls_catalog.iso` or `controls_catalog_standards.standard_code`;
- keeps optional process/operation joins as left joins for tenant-empty behavior;
- projects missing `findings.description`, `action_plans.description`, `action_plans.priority`, and `action_plans.owner` as explicit nullable text fields when absent;
- does not invent descriptions, owners, priorities, or scores.

## Catalog / Workbench Correction

Catalog consumers use the lifecycle contract already closed:

- global catalog = `controls_catalog.tenant_id IS NULL`;
- tenant catalog = same tenant;
- standard membership can come from `controls_catalog.iso` or `controls_catalog_standards.standard_code`;
- clause remains `controls_catalog.clause`;
- `source_type` remains provenance, not catalog mode authority.

## Configuracion

`tenantProcesses.service.js` treats missing optional process objects/columns as an empty-process contract for Configuracion:

- 0 processes;
- 0 operations by derivation;
- no selected process;
- HTTP 200 expected in runtime;
- no inserts or demo data.

The degradation is scoped to known optional process contracts only: `tenant_processes`, `tenant_operations`, and explicitly listed process/operation columns. Mandatory schema drift such as missing `users` or arbitrary SQL typos still propagates as an error.

## Risk / Capabilities

The frontend now distinguishes capability-disabled quantitative risk responses from technical failures. A 403 with `CAPABILITY_NOT_INCLUDED` or equivalent capability reason displays a business-disabled state. Backend RBAC/capabilities were not broadened.

## AI Compliance

`/api/ai-compliance/engine-health` can report:

- `healthy`
- `feature_disabled`
- `engine_unavailable`
- `db_unavailable`

Feature disabled is not converted into HTTP 500. The router still enforces authentication, tenant isolation, RBAC `ai.view`, and commercial capability `ai.compliance` for protected AI Compliance routes. `/engine-health` is the only route that bypasses the read gate so it can distinguish health state from entitlement state.

Final RBAC checks added:

- tenant admin with `ai.view` + capability: allowed;
- user without `ai.view` + capability: 403 `PERMISSION_DENIED` / `RBAC_PERMISSION_REQUIRED`;
- user with `ai.view` but no capability: 403 `CAPABILITY_NOT_INCLUDED`;
- `/engine-health` without capability: HTTP 200 payload `status='feature_disabled'`;
- cross-tenant request: 403 `TENANT_FORBIDDEN`.

## Demo Fixture Alignment

`scripts/demo/check-demo-tenant-postgres.sh` no longer creates `controls_catalog_standards.clause`. Demo fixture clause data remains represented by `controls_catalog.clause`, matching the fresh contract.

## Transaction Correction

Applicability engine failure handling now follows:

1. transaction error occurs;
2. rollback is executed on the same client;
3. failed-run metadata is recorded using independent pool query;
4. recording failure is logged without hiding original error;
5. original error is rethrown;
6. client release happens after rollback, avoiding pool contamination.

## Tests And Evidence

Executed locally:

- `node scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js --checksum`
- `node -c backend/src/routes/diagnostic.routes.js`
- `node -c backend/src/services/diagnostic.service.js`
- `node -c backend/src/routes/health.js`
- `node -c backend/src/routes/ai-compliance.routes.js`
- `node -c backend/src/routes/ai-compliance.rbac.test.js`
- `node -c backend/src/routes/evidences.routes.js`
- `node -c backend/src/controllers/kpi.controller.js`
- `node -c backend/src/services/companyProfileApplicabilityEngine.service.js`
- `node -c backend/src/services/tenantProcesses.service.test.js`
- `node -c scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js`
- `node -c scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.test.js`
- `node backend/src/routes/ai-compliance.rbac.test.js`
- `node backend/src/services/tenantProcesses.service.test.js`
- `node scripts/normalization/apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.test.js`
- `git diff --check`
- `bash -n scripts/deploy-vms.sh`
- `node scripts/deploy-vms-strategy.test.js`
- `npm --prefix backend test`
- `npm --prefix frontend run typecheck`
- `node scripts/release-rbac/check-release-rbac-contract.js`
- `node scripts/release-rbac/check-residual-role-authority.js`
- `node scripts/release-rbac/check-role-alias-equivalence.js`
- `node scripts/release-rbac/check-frontend-backend-authorization-consistency.js`

Isolated PostgreSQL evidence:

- `POST_LIFECYCLE_RUNTIME_CONSUMERS_CHECKSUM=1d9e00b12bc1d05b580b3002b07ff9db318e24ef578301d439d6cbaad85cdebe`
- `POST_LIFECYCLE_PENDING_PREFLIGHT_INITIAL_VIEWS=0`
- `POST_LIFECYCLE_PENDING_PREFLIGHT_CREATED_VIEWS=0`
- `POST_LIFECYCLE_PENDING_PREFLIGHT_WITHOUT_VIEWS_PASS`
- `POST_LIFECYCLE_ALREADY_APPLIED_PREFLIGHT_POSTCONDITIONS_PASS`
- `POST_LIFECYCLE_REQUIRED_VIEWS_READY=t`
- `POST_LIFECYCLE_EMPTY_TENANT_HEALTH_200_ROWS=0`
- `POST_LIFECYCLE_EMPTY_TENANT_AUDIT_QUEUE_200_ROWS=0`
- `POST_LIFECYCLE_NO_SCORE_INVENTED=0`
- `POST_LIFECYCLE_CHECKSUM_MISMATCH_REJECTED=PASS`
- `POST_LIFECYCLE_RUNTIME_CONSUMERS_ISOLATED_POSTGRES_TEST_PASS`
- `ISOLATED_POSTGRES_CLEANUP PASS`

Release/RBAC gate highlights:

- `RELEASE_RBAC_CONTRACT_PASS permissions=175 roles=7`
- `RESIDUAL_AUTHORIZATION_AUTHORITY=0`
- `UNCLASSIFIED_ROLE_CHECKS=0`
- `FRONTEND_BACKEND_AUTHORIZATION_CONSISTENCY=PASS`

## Residual Risks

- No production PASS is claimed; productive validation is a later human-run deploy/runtime step.
- No `--apply` or `--preflight` was run against `tcdx_saasv2`.
- AI Engine connectivity and its database availability must still be validated in authorized runtime after deploy.
- Risk/capability behavior depends on tenant subscription/capability state in real runtime.
- Health route HTTP 200 for every endpoint must be validated post-deploy against the official backend host and tenant context.

## Human Preflight After Review

Recommended after human review and before production deploy:

1. Run runner `--preflight` against an authorized clone/staging fresh DB only.
2. Apply in authorized clone/staging and re-run `--preflight`.
3. Validate `/process-detail`, Diagnostico status change, Health ISO endpoints, `/configuracion`, quantitative risk disabled-capability UX, and AI Compliance engine-health.
4. Confirm no `current transaction is aborted` appears after forced applicability-engine failures.
5. Only then have the owner commit, push, run CI, merge, deploy, and perform runtime validation.
