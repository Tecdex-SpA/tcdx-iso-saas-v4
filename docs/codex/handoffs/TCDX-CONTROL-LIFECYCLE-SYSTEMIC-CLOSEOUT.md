# TCDX Control Lifecycle Systemic Closeout

Date: 2026-09-11

Status: `TCDX_CONTROL_LIFECYCLE_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW`

Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`

Branch: `main`

Base HEAD verified at start: `137ab0c19156636b9c9126affb72471cb2dcd115`

Commit/push/merge/deploy by Codex: `NO`

Production DB policy: Codex did not connect to, write, migrate, preflight or deploy against real `tcdx_saasv2`.

## Root Cause

The runtime lifecycle drift was systemic:

- `controls_catalog` stores real global catalog rows as `tenant_id IS NULL` with provenance values such as `knowledge_base_seed_v2` and `migrated_reference_from_qa`.
- Several consumers treated generic catalog as `source_type='generic' AND tenant_id IS NULL`.
- `initialize-controls` materialized `tenant_controls` but did not reconcile default-visible `tenant_applicable_controls`.
- Diagnosis and dashboard consumers therefore saw an active standard and tenant controls, but no effective/applicable controls.

Additionally, `backend/src/routes/diagnostic.routes.js` had an accidental recursive local `isPlatformRole` helper that could surface as `Error diagnóstico`.

## Canonical Catalog Contract

Canonical effective catalog semantics:

- Global catalog: `controls_catalog.tenant_id IS NULL`.
- Tenant catalog: `controls_catalog.tenant_id = current tenant`.
- `catalog_mode='generic'`: active global controls only.
- `catalog_mode='personalized'`: active same-tenant controls only.
- `catalog_mode='mixed'`: active global plus same-tenant controls.
- Provenance remains in `source_type`; it is not the functional generic/global flag.
- Standard membership uses normalized `controls_catalog.iso` or `controls_catalog_standards.standard_code`, tolerating case/whitespace without rewriting persisted codes.
- Duplicate equivalents are deduped only by declared catalog identity, `COALESCE(base_control_id, id)`; no semantic equivalence is invented.

Shared implementation:

- Backend SQL helper: `backend/src/services/controlCatalogLifecycle.service.js`.
- PostgreSQL fresh/backfill helper: `public.tcdx_effective_control_catalog(uuid,text,text)`.

## Initialize Contract

`POST /api/admin-saas/tenants/:tenant_id/standards/:standard_code/initialize-controls` now:

- Resolves effective catalog with the canonical contract.
- Inserts only missing `tenant_controls`.
- Keeps `(tenant_id, control_id)` idempotency.
- Links `tenant_standard_id`.
- Assigns operation only when a single active operation or single default active operation is available.
- Keeps `score=NULL` and `health_status='sin_datos'`.
- Reconciles default applicability in the same transaction.
- Stores the requested standard context in `tenant_applicable_controls.standard_code` even when the control's primary `controls_catalog.iso` belongs to another standard and membership comes from `controls_catalog_standards`.

## Applicability Contract

Bootstrap/reconciliation creates `tenant_applicable_controls` only when no row already exists for the tenant-control/standard relationship.

It preserves:

- Human exclusions/reviews.
- Profile/applicability engine decisions.
- Existing inactive/hidden applicability rows.

It does not create scores and does not overwrite user decisions.

## Backfill

Forward-only migration:

- `database/migrations/20260911_tcdx_control_lifecycle_systemic_closeout.sql`

Runner:

- `scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js`

Checksum:

- `e3912a97fb9e57177b5e94e9946169c3bd055d2fb3fa194619644f7c64ba147b`

Backfill behavior:

- Multi-tenant.
- Idempotent.
- Requires active `tenant_standards`.
- Reconciles only existing `tenant_controls` tied to the active `tenant_standard_id`.
- Skips existing applicability, including human exclusions.
- No tenant/customer/email/UUID production hardcode.
- No scores, no `control_health_scores`, no KPI-HLT.

Fresh deploy order now appends:

1. Fresh runtime contract closeout.
2. Release RBAC capability systemic closeout.
3. Commercial runtime integral closeout.
4. Fresh baseline runtime dependency systemic closeout.
5. Control lifecycle systemic closeout.

## Consumers Aligned

CANONICAL:

- Admin SaaS `initialize-controls`.
- Dashboard control source predicate.
- Dashboard Controls via `tenant_applicable_controls` + `v_iso_control_effective_health`.
- `/controles` catalog/workbench predicates and global/tenant response grouping.
- Tenant standards catalog counts.
- `diagnostic.routes.js`.
- `diagnostic.service.js`.
- `/controles` initial Health presentation: `sin_datos` with `effective_health_score=NULL`.
- SoA, Auditorías, Evidencias, Hallazgos, No conformidades, acciones recomendadas, reports and AI context consumers that read `tenant_controls`/`tenant_applicable_controls` after canonical materialization.

COMPATIBILITY:

- Consumers that project `tenant_controls` identity into legacy/read-model screens.
- Report templates using `tenant_controls_count`.
- Existing source/provenance display of `source_type`.

OPTIONAL:

- Profile/applicability engine can still recalculate richer applicability from company profile inputs.

STALE / REMOVE:

- Functional predicates equivalent to `cc.source_type='generic' AND cc.tenant_id IS NULL` in the corrected critical consumers were removed.

## Tests

Isolated PostgreSQL lifecycle test:

- `node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.test.js`

Covered:

- Generic catalog with 51 heterogeneous global controls.
- Backfill from broken state: `tenant_controls=51`, `tenant_applicable_controls=0`.
- Idempotent initialize/reconciliation.
- Cross-standard membership where `cc.iso` differs from the requested standard but `controls_catalog_standards` links it; applicability stores the requested standard, not the primary `cc.iso`.
- Personalized mode excludes global catalog.
- Mixed mode unions global + tenant controls and dedupes declared replacement.
- Human exclusion preservation.
- Cross-tenant personalized/applicability isolation.
- No bootstrap score creation.
- Health rows 51, scored 0, without score 51.
- Checksum mismatch fail-closed.

Key output:

```text
GENERIC_CATALOG_CONTROLS=51
GENERIC_DIAGNOSTIC_EFFECTIVE_CATALOG=51
GENERIC_TENANT_CONTROLS=51
GENERIC_APPLICABLE_VISIBLE=51
GENERIC_HEALTH_ROWS=51
GENERIC_HEALTH_SCORED=0
GENERIC_HEALTH_WITHOUT_SCORE=51
GENERIC_SECOND_RUN_TENANT_CONTROLS=51
GENERIC_SECOND_RUN_APPLICABLE_VISIBLE=51
GENERIC_SECOND_RUN_DUPLICATE_TENANT_CONTROLS=0
GENERIC_SECOND_RUN_DUPLICATE_APPLICABILITY=0
PERSONALIZED_GLOBAL_LEAKAGE=0
CROSS_TENANT_PERSONALIZED_ISOLATION=0
CROSS_TENANT_APPLICABILITY_ISOLATION=0
APPLICABILITY_NO_SCORES_INVENTED=0
```

## Local Gates

Executed PASS on 2026-09-11:

- `node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js --checksum`
- `node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.test.js`
- `git diff --check`
- `bash -n scripts/deploy-vms.sh`
- `node scripts/deploy-vms-strategy.test.js`
- `npm --prefix backend test`
- `npm --prefix frontend run typecheck`
- `node scripts/release-rbac/check-release-rbac-contract.js`
- `node scripts/release-rbac/check-residual-role-authority.js`
- `node scripts/release-rbac/check-role-alias-equivalence.js`
- `node scripts/release-rbac/check-frontend-backend-authorization-consistency.js`

RBAC remained:

```text
RESIDUAL_AUTHORIZATION_AUTHORITY=0
UNCLASSIFIED_ROLE_CHECKS=0
```

## Residual Risks

- Local isolated PostgreSQL evidence is not production runtime proof.
- The SQL helper and Node helper intentionally duplicate the same small predicate contract for fresh DB backfill and runtime compatibility; future changes must update both and the isolated test.
- Existing profile-engine recalculation can still deactivate applicability by profile logic; this closeout preserves that capability rather than replacing it.
- Human validation must run read-only/preflight against authorized clone/staging before any production apply.

## Human Review Commands

```bash
node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js --checksum
MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.js --preflight
node scripts/normalization/apply-tcdx-control-lifecycle-systemic-closeout.test.js
```

Do not run `--apply` against `tcdx_saasv2` until owner review and authorization.

## Do Not Rediscover

- Generic/global catalog is `tenant_id IS NULL`, not `source_type='generic'`.
- `source_type` is provenance/classification and remains visible; it is not overwritten to satisfy filters.
- Initial Health without measurement is `sin_datos` with `NULL` score.
- `tenant_applicable_controls` is required for runtime visibility and must be reconciled idempotently.
- Do not reintroduce `control_health_scores`, KPI-HLT, manual tenant patches, production UUIDs, tenant names, emails or demo seeds.

## Git State

No files were staged. No commit, push, merge or deploy was performed.
