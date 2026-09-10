# TCDX SaaSv2 Runtime Contract Closeout V2

Status: `TCDX_SAASV2_RUNTIME_CONTRACT_V2_READY_FOR_CLONE_VALIDATION`

Date: 2026-09-09
Owner: CODEX A / codex
Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `fix/tcdx-saasv2-runtime-schema-closeout`
HEAD verified before work: `f688249a64dcfabd1b17aec260a56fbf3da1a986`

## Scope

Local-only structural V2 closeout for active backend runtime contracts after V1 was installed externally in `tcdx_saasv2`.

No SQL was executed against `tcdx_saasv2`. No deploy, commit, push, merge, production runtime start, tenant synthesis in real DB, db-v4 write, frontend change or V1 rewrite was performed.

## Root Cause

V1 closed the first backend cutover blockers for auth lifecycle, commercial/runtime views, risk objects and grants. Remaining active backend paths still required DB contracts absent from the fresh baseline/V1 surface:

- `tenant_standards` lifecycle/catalog mode fields.
- `tenant_nonconformities` active insert shape without `title`, using catalog `control_id`.
- `evidences` active upload/review/AI shape without `title`, using both `control_id` and `catalog_control_id`.
- Evidence AI extract/assessment/job/chunk runtime tables and current views.
- Standard lifecycle status/snapshot/stage request/AI feed tables.

## Changed Files

- `database/baseline/production_schema_v1.sql`
- `database/baseline/production_seed_v1.sql`
- `database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql`
- `scripts/normalization/apply-tcdx-saasv2-runtime-contract-closeout-v2.test.js`
- `docs/codex/handoffs/TCDX-SAASV2-RUNTIME-CONTRACT-CLOSEOUT-V2.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`

## Contract Decisions

- `tenant_standards.catalog_mode` supports `generic`, `personalized`, `mixed`; existing `activated_at` remains.
- `tenant_nonconformities.control_id` is catalog identity (`controls_catalog.id`), while `tenant_control_id` is operational identity (`tenant_controls.id`).
- `evidences.control_id` and `evidences.catalog_control_id` are compatibility aliases for catalog identity and are reconciled to the same value.
- Inserts without `title` are valid. Triggers populate compatibility `title` from `description`, `control_description` or `file_name` without requiring callers to fabricate titles.
- Triggers block divergence when `tenant_control_id` implies a different catalog control than `control_id`/`catalog_control_id`.
- `tenant_control_id` is auto-filled only when DB constraints make the catalog-to-tenant-control mapping unambiguous for that tenant.
- Evidence AI runtime uses `evidence_document_extracts`, `evidence_ai_assessments`, `evidence_ai_jobs`, `evidence_knowledge_chunks`, `vw_evidence_current_extracts`, `vw_evidence_current_ai_assessments` and `enqueue_evidence_ai_job(uuid, uuid, text, jsonb, smallint, timestamp, uuid)`.
- Lifecycle runtime uses the canonical stage catalog plus `standard_lifecycle_status`, `standard_lifecycle_snapshots`, `standard_lifecycle_stage_requests` and `standard_lifecycle_ai_feed`.

## Migration

New forward-only migration:

`database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql`

Properties:

- transactional with advisory lock `844332, 2026090902`;
- idempotent and re-executable;
- additive over fresh baseline and V1-upgraded databases;
- no data deletion;
- no tenant, UUID, customer, email, period or demo seed hardcoding;
- no schema-wide grants and no `EXECUTE ON ALL FUNCTIONS`;
- grants only required tables/views/function to `tcdx_backend_runtime`.

## Validation

PASS:

- `node --check scripts/normalization/apply-tcdx-saasv2-runtime-contract-closeout-v2.test.js`
- `node scripts/normalization/apply-tcdx-saasv2-runtime-contract-closeout-v2.test.js`

The PostgreSQL isolated test validated:

- baseline fresh creates V2 objects;
- V1 + V2 apply on fresh baseline;
- V2 second application is idempotent;
- required columns for `tenant_standards`, `tenant_nonconformities`, `evidences`;
- current extract and AI assessment views;
- `enqueue_evidence_ai_job` signature;
- tenant-aware FKs for Evidence AI and lifecycle tables;
- effective `tcdx_backend_runtime` grants;
- no runtime superuser/createdb/createrole/bypassrls/schema create or trigger-function execute excess;
- real insert reconciliation for titleless nonconformities/evidences;
- divergence blocker for evidence catalog/control identity;
- final fixture cleanup to zero tenants.

Pending:

- `git diff --check` final run after documentation updates.
- Human clone validation. This is not production readiness.

## Do Not Rediscover

- V1 was already validated externally and installed in `tcdx_saasv2`; do not rewrite it.
- Do not run Codex SQL against `tcdx_saasv2`.
- Do not treat `control_id` in `tenant_nonconformities`/`evidences` as `tenant_controls.id`; it is catalog identity.
- Do not make `title` mandatory again for active runtime inserts.
- Do not infer production PASS from local isolated PostgreSQL.

## Next Action

Human review, then clone validation using the authorized DB clone path. If clone validation passes, the user handles commit, push, PR, CI, merge, deploy, migration application and runtime validation manually.
