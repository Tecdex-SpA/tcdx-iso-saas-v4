# Commit And Creation Plan

Status: PLAN ONLY. Do not execute from Codex.

A. Commit/push/merge normalization:
Review package and DB-N01..DB-N05 diff, then human performs staging, atomic commit, push, PR, CI and merge if approved.

B. Backup/preflight db-v4:
Human/operator runs backup and the read-only DB-V4 preflight from an authorized environment. Codex did not run it.

C. Create empty `tcdx_saasv2`:
Only after approval and backup verification, create an empty database with the approved owner/encoding/collation. No creation was performed in this review.

D. Roles/extensions:
Provision required roles and extensions (`pgcrypto`, `pg_trgm`, `vector`) according to baseline and privilege allowlists.

E. Baseline:
Apply `database/baseline/production_schema_v1.sql` as migration/admin role. Re-run once to verify idempotence.

F. Reference loaders:
Apply `database/baseline/production_seed_v1.sql`, then run `scripts/normalization/load-production-reference-catalogs.js`. Verify ISO manifest counts/checksums and loader idempotence.

G. Tests:
Run DB-N05 runtime schema, reference catalogs, privileges and fresh production gates in the authorized environment. Run backend/frontend suites per release policy.

H. Synthetic tenant:
Create a synthetic non-customer tenant and validate tenant -> plan/capabilities -> standards -> tenant_controls -> SoA/evidence/finding/action/risk -> formulas -> snapshots -> Health/API.

I. Backend/AI connection:
Point backend to `tcdx_saasv2` with runtime roles. Keep AI reader deferred unless tenant-safe context/views are proven.

J. Post-cutover:
Run read-only smoke checks for auth, dashboard, Health, SoA, controls, evidences, findings, actions, reports, regulatory and Knowledge/RAG surfaces. Confirm no cross-tenant leakage and no null/no-data-to-zero.

K. Rollback:
If any gate fails, stop traffic migration, keep `tecdex_saas` as source of truth, preserve logs/artifacts, and revert connection/secret changes through the deployment system. Do not mutate `tecdex_saas` as part of rollback without explicit operator approval.
