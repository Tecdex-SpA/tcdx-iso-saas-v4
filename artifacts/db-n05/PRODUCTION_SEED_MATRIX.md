# DB-N05 Production Seed Matrix

Status: `DB_N05_READY_FOR_REVIEW`. Local gates only; production creation remains prohibited until integral Human Review DB-N01 -> DB-N05.

| Version | Controls | Evidence expectations | Publication | Certifiable | Status |
| --- | ---: | ---: | --- | --- | --- |
| ISO9001:2015 | 16 | 13 | published | true | approved_for_loader |
| ISO27001:2022 | 21 | 19 | published | true | approved_for_loader |
| ISO42001:2023 | 16 | 14 | published | true | approved_for_loader |
| ISO9001:2026_FDIS | 8 | 8 | transition_prep | false | transition_only |

| Source / target | Decision |
| --- | --- |
| production_seed_v1.sql | Existing system/RBAC/workflow behavior retained; no tenant data |
| Versioned ISO JSONL + metadata | 61 controls and 54 evidence rows via the existing loader |
| Three published product versions | 53 controls projected into controls_catalog + mappings |
| ISO9001:2026_FDIS | 8 transition controls and 8 evidence rows only in versioned tables |
| KB v2 | Existing 1000 items and 30 derived ISO27001 compatibility codes preserved |
| Commercial/math/semantic/indicator registries | Existing official bootstraps retained |
| QA controls_catalog/mappings | Complementary evidence only; not copied |
| Tenant/customer/demo/QA/backup/preview data | Not seeded |

The sole orchestrator remains `scripts/normalization/load-production-reference-catalogs.js`. Manifest v2 stores raw standard_code/version_code, explicit product compatibility code, publication/certification status, loader_status, controls/evidence/metadata paths, exact counts and SHA-256 for each file. Three entries are approved_for_loader; FDIS is transition_only. Every file and same-version evidence mapping is validated before any reference write, and before the main orchestrator connects. Pending/unapproved states, checksum or count mismatches, missing titles, duplicate controls/evidence and cross-version references fail closed.

Fresh baseline adds `iso_standards`, `iso_standard_versions`, `iso_controls`, `iso_evidence_expectations`, with natural-key uniqueness and composite same-version FKs. New surrogate IDs come from PostgreSQL, not QA. Runtime backend/platform/support have SELECT only on these four tables; ai_reader has no access; migration admin loads references. No schema-wide grants or new functions were added.

All four sources load into versioned tables. Only the three approved published versions project to existing product standards/controls/mappings. Existing 30 KB-derived ISO27001 codes and their compatibility behavior remain; metadata marks them compatibility_only. They are not counted as approved versioned controls and no semantic equivalence to QA ISMS codes is invented. Fresh controls_catalog/mappings=83: 53 approved projected controls + 30 preserved KB codes. QA controls_catalog's 118 exported rows and 118 mappings are not imported.
