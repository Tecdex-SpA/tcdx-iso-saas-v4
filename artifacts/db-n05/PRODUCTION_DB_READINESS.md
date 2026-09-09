# DB-N05 Production DB Readiness

Status: `DB_N05_READY_FOR_REVIEW`. Local gates only; production creation remains prohibited until integral Human Review DB-N01 -> DB-N05.

| Version | Controls | Evidence expectations | Publication | Certifiable | Status |
| --- | ---: | ---: | --- | --- | --- |
| ISO9001:2015 | 16 | 13 | published | true | approved_for_loader |
| ISO27001:2022 | 21 | 19 | published | true | approved_for_loader |
| ISO42001:2023 | 16 | 14 | published | true | approved_for_loader |
| ISO9001:2026_FDIS | 8 | 8 | transition_prep | false | transition_only |

The reviewed authority is `iso_controls` plus same-version `iso_evidence_expectations` from this export. Coverage means faithful materialization of the approved product reference snapshot, whose source_policy is copyright_safe_summary; it does not assert reproduction of the full normative publications.

ISO9001:2026_FDIS is transition preparation only. It has no `product_standard_code`, no row in the selectable `standards` compatibility catalog and no projection into `controls_catalog`. It does not replace ISO9001:2015 and must not be sold or represented as final/certifiable ISO9001:2026. Absence of a final 2026 catalog is not a blocker for this review gate. Historical ISO27701/27017/27018 compatibility is preserved and outside current blockers.

## Executed gates — 2026-09-08 row-level continuation

| Command | Result |
| --- | --- |
| `python3 scripts/normalization/db-n05-materialize-qa-reference-catalogs.py` | PASS; 61 controls, 54 evidence expectations, 4 metadata files, no external content |
| `python3 scripts/normalization/db-n05-materialize-qa-reference-catalogs.py --check` | PASS; byte-for-byte source derivation, no writes |
| `node scripts/normalization/db-n05-reference-catalogs.test.js` | PASS; 3 approved sources and FDIS TRANSITION_ONLY; no REQUIRES_ADDITIONAL_READONLY_EXPORT |
| `node scripts/normalization/db-n05-reference-loader-gating.test.js` | PASS; invalid-input rejection before writes, version isolation and deterministic upserts |
| `node scripts/normalization/db-n05-qa-reference-export-contract.test.js` | PASS; read-only/schema-column export contract retained |
| `node scripts/normalization/apply-db-n05-production-baseline.test.js` | PASS |
| `node scripts/normalization/db-n05-runtime-schema-contract.test.js` | PASS; 63 checks, ACTIVE_MISSING=0, critical_undetermined=0; regulatory parity=15 tables |
| `node scripts/normalization/db-n05-production-role-privileges.postgres.test.js` | PASS; effective SET ROLE, reference SELECT/INSERT/UPDATE/DELETE permissions, ai_reader deny |
| `node scripts/normalization/db-n05-fresh-production.postgres.test.js` | PASS; full requested isolated fresh gate |

Fresh PostgreSQL 16.15, Docker pgvector image `sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b`, localhost-only ephemeral cluster, cleanup PASS.

Gates: BOOTSTRAP_RERUN, REFERENCE_CATALOG_LOADER, CATALOG_LOAD_1, CATALOG_LOAD_2, IDEMPOTENT, CATALOG_LOADER_RERUN, PGVECTOR_VALIDATION, FUNCTIONAL_VALIDATION, MULTITENANT_VALIDATION, INTEGRITY_VALIDATION, LEGACY_ABSENCE, BACKEND_STARTUP, FRESH_DB_FROM_ZERO: all PASS. Snapshot comparison covers IDs/counts/stable content of all four versioned tables across two real loads. Same-version evidence FK rejects a 2015 -> FDIS control link. Fresh inventory=121 relations / 193 functions / 263 indexes.

Logs: `artifacts/db-n05/rowlevel-validation/fresh.log`, `privileges.log`, `regressions.json`.

## DB-N01..DB-N04 established focal regressions

- `node scripts/normalization/apply-db-n01-control-identity-migration.test.js`: PASS
- `node scripts/normalization/apply-db-n02-health-metrics-lineage-migration.test.js`: PASS
- `node scripts/normalization/apply-db-n03-multitenant-integrity-migration.test.js`: PASS
- `node scripts/normalization/apply-db-n04-runtime-tenant-cleanup-migration.test.js`: PASS
- `node backend/src/utils/tenantControlIdentity.test.js`: PASS
- `node backend/src/utils/dbTenantContext.test.js`: PASS
- `node backend/src/routes/controlIdentityRoutes.test.js`: PASS
- `node backend/src/services/math-governance/canonicalHealthProjection.service.test.js`: PASS
- `node backend/src/services/math-governance/grcHealthCalculation.service.test.js`: PASS
- `node backend/src/services/soaIntelligence.service.test.js`: PASS

## Final gate / limits

DB_N05_READY_FOR_REVIEW: versioned sources, checksums, mappings, transition separation, loader idempotence, fresh DB, runtime schema, privileges, pgvector and ten established focal regressions PASS. Git whitespace/hygiene reviewed; inherited dirty DB-N01..DB-N04 preserved. No git add, commit, push, merge, deploy, QA connection/write, production creation or DB-N06. No full backend suite or CI claim.

Next: STOP for integral Human Review DB-N01 -> DB-N05. Do not create `tcdx_saasv2` yet. Broad RLS and ai_reader remain under the previously accepted safe-defer posture; review readiness is not production/runtime authorization.
