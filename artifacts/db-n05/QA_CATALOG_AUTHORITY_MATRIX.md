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

# DB-N05 QA Catalog Authority Matrix

Source evidence: `artifacts/db-n05/qa-catalog-audit/DB-N05_CATALOG_AUDIT_RESULT.txt`.
The audit was PostgreSQL read-only evidence from `tecdex_saas` on PostgreSQL 16.15 and ended with `ROLLBACK`.

| schema | object | data role | standard/family | global or tenant | runtime readers | runtime writers | canonical candidate? | replacement | QA-only contamination risk | migration decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public | iso_standards | GLOBAL_REFERENCE | ISO9001, ISO27001, ISO42001 | Global | ISO GRC/reference runtime | Governed reference loader only | YES | Versioned repo manifest + exported rows | Low; no tenant_id; 3 exact rows | MIGRATE_FROM_QA_REFERENCE_DATA after reviewed row-level export |
| public | iso_standard_versions | GLOBAL_REFERENCE | ISO9001, ISO27001, ISO42001 | Global | ISO GRC/reference runtime | Governed reference loader only | YES | Versioned repo manifest + exported rows | Medium; ISO9001 has 2 versions and must split 2015 vs 2026 explicitly | MIGRATE_FROM_QA_REFERENCE_DATA after reviewed row-level export |
| public | iso_controls | GLOBAL_REFERENCE | ISO9001, ISO27001, ISO42001 | Global | ISO assessment/evidence runtime | Governed reference loader only | YES | Versioned repo controls files | Low to medium; audit proves 61 rows and unique control codes, but not row payload quality | MIGRATE_FROM_QA_REFERENCE_DATA after reviewed row-level export |
| public | iso_evidence_expectations | GLOBAL_REFERENCE | ISO9001, ISO27001, ISO42001 | Global | Evidence expectation runtime | Governed reference loader only | YES | Versioned repo evidence files | Medium; audit has counts only, no row-level review | MIGRATE_FROM_QA_REFERENCE_DATA after reviewed row-level export |
| public | controls_catalog | GLOBAL_REFERENCE + possible tenant overlay | ISO9001, ISO27001, ISO42001 plus historical families | Mixed; has `tenant_id` | Tenant control/evidence/search runtime | Governed loader and tenant workflows | CONDITIONAL | Export only `tenant_id IS NULL` rows and convert into fresh `controls_catalog` format | Medium; table allows tenant rows and lacks fresh `code`/`title` columns in QA | MIGRATE_FROM_QA_REFERENCE_DATA only for approved global rows |
| public | controls_catalog_standards | GLOBAL_REFERENCE_MAPPING | ISO9001, ISO27001, ISO42001 plus historical families | Global mapping table | Tenant control resolution runtime | Governed loader | CONDITIONAL | Export mappings joined to approved global catalog rows | Medium; mapping row counts can exceed catalog rows, duplicates require row-level review | MIGRATE_FROM_QA_REFERENCE_DATA after duplicate/orphan checks |
| public | standards | COMPATIBILITY | Mixed ISO/compliance codes | Global identity compatibility | Legacy and FK compatibility | Baseline seed/loader | NO | Recreate from fresh baseline + versioned references | Medium; minimal `code/name` shape differs from fresh canonical `standards` | RECREATE_FROM_REPO_SOURCE |
| public | controls | TENANT_OPERATIONAL / COMPATIBILITY | Tenant controls | Tenant scoped | Legacy tenant-control runtime | Tenant workflows | NO | Fresh tenant data migration, not global seed | High; 1005 operational rows | DO_NOT_MIGRATE as reference data |
| public | tenant_standards | TENANT_OPERATIONAL | Tenant subscriptions | Tenant scoped | Tenant runtime | Tenant workflows | NO | Per-tenant migration plan only | High; 31 tenant rows | DO_NOT_MIGRATE as reference data |
| public | tenant_controls | TENANT_OPERATIONAL | Tenant controls | Tenant scoped | Control health, SoA, evidence runtime | Tenant workflows | NO | Per-tenant migration plan only | High; 2982 tenant rows and duplicate control groups | DO_NOT_MIGRATE as reference data |
| public | tenant_applicable_controls | TENANT_OPERATIONAL | Applicability | Tenant scoped | Assessment/applicability runtime | Tenant workflows | NO | Per-tenant recompute/migration plan | High; 5680 tenant rows | DO_NOT_MIGRATE as reference data |
| public | tenant_applicable_evidence_requirements | TENANT_OPERATIONAL | Evidence applicability | Tenant scoped | Evidence runtime | Tenant workflows | NO | Per-tenant recompute/migration plan | High; 708 tenant rows | DO_NOT_MIGRATE as reference data |
| public | knowledge_sources / knowledge_documents / knowledge_items | KNOWLEDGE_REFERENCE | KB/RAG | Global-ish source catalog | Knowledge/RAG runtime | Existing KB loader | CONDITIONAL | Existing versioned KB seed remains authority | Medium; QA has 1000 items but repo already has versioned source | RECREATE_FROM_REPO_SOURCE |
| public | legal_obligations / regulations / regulatory_pack* | REGULATORY_REFERENCE_SCHEMA | Regulatory | Global | Regulatory runtime | Governed ingestion | NO for content | F6.11-A/B schema only until source content exists | Low; exact rows are 0 | COMPATIBILITY_ONLY / schema-ready |
| qa_audit | * | QA_ONLY | QA evidence/backups | QA-only | None for production | QA process | NO | None | Critical | QA_ONLY |
| public | *_backup*, *_backup_history, *_cleanup_backup_* | BACKUP_ONLY | Historical | Mixed | None for production | Historical only | NO | None | Critical | BACKUP_ONLY |
| public | *_preview* | PREVIEW_ONLY | Preview | Mixed | None for production baseline | Preview only | NO | None | Critical | PREVIEW_ONLY |

Decision: QA contains credible aggregate evidence for product catalog candidates, but the audit file is not row-level catalog data. DB-N05 must stop at `REQUIRES_ADDITIONAL_READONLY_EXPORT` until the approved rows are exported, reviewed, checksummed, and committed as versioned repository sources.

## Continuity verification — 2026-09-08

Status: `DB_N05_PARTIAL` — `REQUIRES_ADDITIONAL_READONLY_EXPORT`.

Current scope: ISO 9001:2015, ISO 9001:2026, ISO/IEC 27001, ISO/IEC 42001.
ISO 27701/27017/27018 are historical compatibility, not current blockers; compatibility is preserved.

Export contract and schema-column validation PASS; eight-query PostgreSQL parsing PASS without QA. Manifest remains pending with zero approved sources. ISO9001 has 24 iso_controls across its two versions; aggregate evidence does not assign those rows to either version. Export has version_coverage and preserves publication_status/source_policy. See QA_REFERENCE_EXPORT_PLAN.md for the exact manual command and acceptance checks. Prior fresh/privilege PASS results are inherited, not rerun in this continuation.
