# DB-N05 Fresh Production Database — current handoff

Owner: CODEX A / codex.
Branch: `codex/db-n01-control-identity-normalization`.
Base and HEAD: `11003dd92385dcca1caf5365fa437be3aee1f648`.
Commit: none; inherited dirty DB-N01..DB-N05 preserved.

Status: `DB_N05_READY_FOR_REVIEW`. Local gates only; production creation remains prohibited until integral Human Review DB-N01 -> DB-N05.

Immutable QA evidence: `artifacts/db-n05/qa-catalog-audit/DB-N05_REFERENCE_EXPORT_RESULT.txt`.
SHA-256: `5ebe8c04225bbe19a0f5b4a56b648af8fc43019f0195b8854384a4bbbf9c3ab0`.
Export metadata: PostgreSQL 16.15, `transaction_read_only=on`, final `ROLLBACK`, eight sections. Codex only read the supplied file; no QA connection or write.

| Version | Controls | Evidence expectations | Publication | Certifiable | Status |
| --- | ---: | ---: | --- | --- | --- |
| ISO9001:2015 | 16 | 13 | published | true | approved_for_loader |
| ISO27001:2022 | 21 | 19 | published | true | approved_for_loader |
| ISO42001:2023 | 16 | 14 | published | true | approved_for_loader |
| ISO9001:2026_FDIS | 8 | 8 | transition_prep | false | transition_only |

The reviewed authority is `iso_controls` plus same-version `iso_evidence_expectations` from this export. Coverage means faithful materialization of the approved product reference snapshot, whose source_policy is copyright_safe_summary; it does not assert reproduction of the full normative publications.

ISO9001:2026_FDIS is transition preparation only. It has no `product_standard_code`, no row in the selectable `standards` compatibility catalog and no projection into `controls_catalog`. It does not replace ISO9001:2015 and must not be sold or represented as final/certifiable ISO9001:2026. Absence of a final 2026 catalog is not a blocker for this review gate. Historical ISO27701/27017/27018 compatibility is preserved and outside current blockers.

The sole orchestrator remains `scripts/normalization/load-production-reference-catalogs.js`. Manifest v2 stores raw standard_code/version_code, explicit product compatibility code, publication/certification status, loader_status, controls/evidence/metadata paths, exact counts and SHA-256 for each file. Three entries are approved_for_loader; FDIS is transition_only. Every file and same-version evidence mapping is validated before any reference write, and before the main orchestrator connects. Pending/unapproved states, checksum or count mismatches, missing titles, duplicate controls/evidence and cross-version references fail closed.

Fresh baseline adds `iso_standards`, `iso_standard_versions`, `iso_controls`, `iso_evidence_expectations`, with natural-key uniqueness and composite same-version FKs. New surrogate IDs come from PostgreSQL, not QA. Runtime backend/platform/support have SELECT only on these four tables; ai_reader has no access; migration admin loads references. No schema-wide grants or new functions were added.

All four sources load into versioned tables. Only the three approved published versions project to existing product standards/controls/mappings. Existing 30 KB-derived ISO27001 codes and their compatibility behavior remain; metadata marks them compatibility_only. They are not counted as approved versioned controls and no semantic equivalence to QA ISMS codes is invented. Fresh controls_catalog/mappings=83: 53 approved projected controls + 30 preserved KB codes. QA controls_catalog's 118 exported rows and 118 mappings are not imported.

## Changed paths

- database/reference/iso/manifest.json and four version directories (controls.jsonl, evidence_expectations.jsonl, metadata.json).
- scripts/normalization/db-n05-materialize-qa-reference-catalogs.py; existing loader and focused reference/export/loader/runtime/baseline/privilege/fresh tests.
- database/baseline/production_schema_v1.sql: additive versioned ISO tables and narrow SELECT grants. Historical migration chain and system seed unchanged in this continuation.
- artifacts/db-n05 product/reference/seed/readiness/validation/duplicate analysis and associated scope/allowlist/privilege matrices; rowlevel-validation logs.
- production runbook; CURRENT_STATE, WORK_QUEUE, CONTRACTS_REGISTRY, ARCHITECTURE_MAP, DECISIONS and canonical handoff pointer.

## Duplicate decision

All 16 legacy clause groups have distinct payloads and are REQUIRES_MANUAL_REVIEW for a future legacy migration only. See CONTROLS_CATALOG_DUPLICATE_ANALYSIS.md for every group and row evidence. They do not affect the iso_controls authority, loader or fresh gate. No deduplication by arbitrary QA UUID and no QA write occurred.

## Do not rediscover

- The supplied export is immutable. Never run an export command that overwrites it.
- 61 controls / 54 expectations are the approved product snapshot; no external ISO text or row fabrication.
- 2026_FDIS is transition-only, non-certifiable, separated from 2015, absent from sellable standards/control projection.
- Existing canonical loader, commercial/math/KB registries, operational identity and Health lineage are retained.
- Preserve explicit function grants, mandatory vector, app_roles, plan_version_capabilities, RLS safe defer and no direct ai_reader SELECT.
- Do not repeat DB-N01..DB-N04 implementation or broad scans. First review manifest, materializer, loader, four schema tables, duplicate analysis and validation logs.
- Only next step is integral Human Review. No staging/commit, production creation or DB-N06.

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

## DB integral human review — 2026-09-09

Status: `DB_INTEGRAL_READY_FOR_TCDX_SAASV2_CREATION` locally. This supersedes the previous stop-for-integral-review state but does not authorize creating `tcdx_saasv2`.

Evidence added under `artifacts/db-integral/`:

- `ZERO_LEGACY_INVENTORY.md`: active runtime legacy refs `0`, PostgreSQL legacy objects `0`.
- `FORMULA_AUTHORITY_MATRIX.md`: 53 `ACTIVE_OFFICIAL` formulas, 20 source contracts and 53 valid bindings inventoried.
- `FORMULA_VALIDATION_RESULTS.md`: `FORMULA_NUMERIC_MISMATCH=0`, registry golden PASS, runtime orchestrator E2E PASS, metric snapshot publication PASS, tenant leakage `0`.
- `PRODUCTION_BASELINE_FINAL_OBJECTS.md`: final baseline object/grant justification, including calculation lineage, indicator governance and metric snapshot publication columns.
- `CLEAN_TENANT_BOOTSTRAP.md`: synthetic clean tenant bootstrap through standards, tenant controls, SoA, evidence, action, risk, formula calculation, snapshots and Health projection.
- `HUMAN_REVIEW_DB_N01_N05.md`: closeout summary.

The exact continuation failure `F5_5_SEVERITY_INDEX golden mismatch` was not fixed by changing the formula or expected fixture. The active formula precision is 2, so raw `54.1667` is officially persisted/published as `54.17`. The golden gate now applies active precision metadata before comparison.

Runtime E2E uses `officialCalculationOrchestrator.service.js -> recalculateOfficialAnalytics` for source contracts, formula versions, calculation runs, outputs and source snapshots, then `indicatorGovernance.calculateIndicator/createSnapshot/publishSnapshot` for official metric snapshots. No manual insert path is used to claim runtime E2E.

## Final Human Review package — 2026-09-09

Status: `DB_INTEGRAL_HUMAN_REVIEW_PACKAGE_READY`.

Final independent review reproduced the prior DB integral ready claim and packaged evidence under `artifacts/db-integral/final-review/`.

Reproduced:

- Branch/HEAD exact match: `codex/db-n01-control-identity-normalization` / `11003dd92385dcca1caf5365fa437be3aee1f648`.
- Inventory, SHA256SUMS and working-tree patch captured without staging.
- Zero legacy static/postgres PASS: `ACTIVE_RUNTIME_LEGACY=0`, `LEGACY_OBJECT_COUNT=0`.
- Formula lineage PASS: 53 `ACTIVE_OFFICIAL`, 20 source contracts, 53 bindings, numeric mismatch 0, unreconstructable outputs 0, cross-tenant leakage 0, runtime orchestrator E2E PASS and indicator snapshot publication PASS.
- DB-N05 fresh gates PASS: baseline static, runtime schema `ACTIVE_MISSING=0`, reference catalogs, effective privileges, pgvector, fresh DB, backend startup.
- Clean tenant bootstrap PASS through tenant -> plan/capabilities -> standards -> tenant controls -> SoA/evidence/finding/action/risk -> formulas -> outputs/snapshots -> metric snapshots -> Health projection/API source.
- Backend `npm test` PASS outside sandbox.
- Frontend lint/build PASS; lint warnings limited to three unused helpers in `frontend/src/app/administrar-kpis/page.tsx`.

Review notes:

- PostgreSQL isolated gates and backend TCP-bind suite require running outside the managed sandbox; sandbox failures were reproduced as environment restrictions and passed outside sandbox.
- No material contradiction found.
- No git add, commit, push, merge, deploy, DB-V4 write or `tcdx_saasv2` creation.
