# DB-N05 QA Reference Export — completed

Immutable QA evidence: `artifacts/db-n05/qa-catalog-audit/DB-N05_REFERENCE_EXPORT_RESULT.txt`.
SHA-256: `5ebe8c04225bbe19a0f5b4a56b648af8fc43019f0195b8854384a4bbbf9c3ab0`.
Export metadata: PostgreSQL 16.15, `transaction_read_only=on`, final `ROLLBACK`, eight sections. Codex only read the supplied file; no QA connection or write.

The manual export has already been supplied and reviewed. Do not overwrite or re-export this artifact. Materialization is reproducible with `python3 scripts/normalization/db-n05-materialize-qa-reference-catalogs.py`, which reads only this transcript and writes versioned reference files/duplicate analysis. No database connection is used.

| Version | Controls | Evidence expectations | Publication | Certifiable | Status |
| --- | ---: | ---: | --- | --- | --- |
| ISO9001:2015 | 16 | 13 | published | true | approved_for_loader |
| ISO27001:2022 | 21 | 19 | published | true | approved_for_loader |
| ISO42001:2023 | 16 | 14 | published | true | approved_for_loader |
| ISO9001:2026_FDIS | 8 | 8 | transition_prep | false | transition_only |

The reviewed authority is `iso_controls` plus same-version `iso_evidence_expectations` from this export. Coverage means faithful materialization of the approved product reference snapshot, whose source_policy is copyright_safe_summary; it does not assert reproduction of the full normative publications.

ISO9001:2026_FDIS is transition preparation only. It has no `product_standard_code`, no row in the selectable `standards` compatibility catalog and no projection into `controls_catalog`. It does not replace ISO9001:2015 and must not be sold or represented as final/certifiable ISO9001:2026. Absence of a final 2026 catalog is not a blocker for this review gate. Historical ISO27701/27017/27018 compatibility is preserved and outside current blockers.

Next: integral Human Review DB-N01 -> DB-N05.
