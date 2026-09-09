# DB-N05 Reference Catalog Coverage

Status: `DB_N05_READY_FOR_REVIEW`. Local gates only; production creation remains prohibited until integral Human Review DB-N01 -> DB-N05.

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

All materialized controls have nonblank unique control_code/title within the same version. Every evidence expectation resolves a control in that version; all file SHA-256 checks pass.
