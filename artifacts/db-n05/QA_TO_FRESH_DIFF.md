# Current row-level reference authority — 2026-09-08

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

The old aggregate-only decision below is historical. Reviewed iso_controls and iso_evidence_expectations now materialize through manifest v2. Legacy catalog/mappings are evidence only and are not imported.

## Historical aggregate analysis (superseded for current gate)

# DB-N05 QA To Fresh Diff

No live `db-v4` read or write was performed by Codex for DB-N05. This comparison is based on repo inventories, DB-N04 legacy matrix, and the DB-N05 production allowlist.

| QA/current object or data class | fresh production object/class | classification | decision |
| --- | --- | --- | --- |
| `tenants`, real customer tenants | `tenants` | MIGRATE DATA | Migrate only approved real customers through a controlled plan. |
| QA/demo tenants | none | QA ONLY | DROP FROM PROD BASELINE / DO_NOT_MIGRATE |
| `users` for real customers | `users` | MIGRATE DATA | Migrate only approved real users after identity/role mapping. |
| QA/demo/personal users | none | QA ONLY | DO_NOT_MIGRATE |
| `iso_standards`, `iso_standard_versions`, `iso_controls`, global catalog/mappings | versioned repo references -> fresh standards/controls | MIGRATE_FROM_QA_REFERENCE_DATA after review | Shapes differ; no direct dump/import or invented code/title. See QA_TO_FRESH_CATALOG_DIFF.md. |
| `tenant_standards`, `tenant_controls` | same | MIGRATE DATA | Recreate per real tenant with DB-N01 canonical IDs. |
| `controls` | `controls` compatibility | LEGACY DEFERRED | Retain temporarily because DB-N04 found runtime readers. |
| `evidences`, `findings`, `action_plans`, `assets`, `risks`, `audits`, `documents` | same canonical tables | MIGRATE DATA | Migrate only approved real customer operational data. |
| `control_health_scores` | same compatibility/drill-down table | RECREATE | Recalculate where possible; do not copy stale backup state. |
| formula/run/output/snapshot tables | same governed metrics tables | KEEP / RECREATE | Seed global formulas; recreate tenant outputs from governed runs. |
| `v_latest_health_kpi_snapshots` | same view | KEEP | Keep compatibility latest-snapshot API path. |
| `qa_audit.*` | none | QA ONLY | DROP FROM PROD BASELINE |
| `*_backup_before_*` | none | HISTORICAL_BACKUP | DROP FROM PROD BASELINE |
| `*_cleanup_backup_*` | none | HISTORICAL_BACKUP | DROP FROM PROD BASELINE |
| pure `*_backup_history` | none | HISTORICAL_BACKUP | DROP FROM PROD BASELINE unless explicit retention policy requires archive outside app DB. |
| `*_v2_preview` | none | LEGACY DEFERRED | DROP FROM PROD BASELINE when runtime readers remain zero. |
| demonstration SQL data under `database/demo` | none | QA ONLY | DO_NOT_MIGRATE |
| knowledge reference seed | `knowledge_documents` / AI read metadata | RECREATE | Load only approved reference corpora, not QA conversation/history. |

## Follow-Up Preflight

If real customer data is selected for production, run `scripts/normalization/db-n05-readonly-qa-preflight.sql` manually against the source database first and attach its output to the migration ticket. Codex did not execute it against `db-v4`.

## Current reference preparation

Status: `DB_N05_PARTIAL` — `REQUIRES_ADDITIONAL_READONLY_EXPORT`.

Current scope: ISO 9001:2015, ISO 9001:2026, ISO/IEC 27001, ISO/IEC 42001.
ISO 27701/27017/27018 are historical compatibility, not current blockers; compatibility is preserved.

The aggregate audit is candidate evidence, not importable row-level content. Totals: controls_catalog=3310, controls_catalog_standards=3604, iso_controls=61, iso_standards=3; iso_standard_versions=4 from the 2+1+1 per-standard counts. Scope counts (catalog/mappings/iso_controls/version rows): ISO9001=81/81/24/2, ISO27001=77/79/21/1, ISO42001=16/16/16/1. These catalog counts are not a proof of global eligibility or completeness.

The 81 ISO9001 catalog rows cannot be assigned to both versions. Exported iso_controls.standard_version_id/standard_code/version_code/control_code and iso_standard_versions publication_status/source_policy provide version authority. Catalog/mappings lack version identity and are complementary only. Missing, draft, placeholder or incomplete 2026 remains a specific blocker after review; do not clone 2015 or invent 2026 content.
