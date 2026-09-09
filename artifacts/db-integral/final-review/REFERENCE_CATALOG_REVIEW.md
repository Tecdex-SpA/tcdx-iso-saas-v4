# Reference Catalog Review

Status: PASS.

Manifest/source verification:

- Manifest schema: `tcdx.iso_reference_manifest`, version `2`.
- Source audit: `artifacts/db-n05/qa-catalog-audit/DB-N05_REFERENCE_EXPORT_RESULT.txt`.
- Source SHA-256: `5ebe8c04225bbe19a0f5b4a56b648af8fc43019f0195b8854384a4bbbf9c3ab0`.

Approved sources:

| Standard | Version | Controls | Evidence | Publication | Certifiable | Loader status |
| --- | --- | ---: | ---: | --- | --- | --- |
| ISO9001 | 2015 | 16 | 13 | published | true | approved_for_loader |
| ISO27001 | 2022 | 21 | 19 | published | true | approved_for_loader |
| ISO42001 | 2023 | 16 | 14 | published | true | approved_for_loader |
| ISO9001 | 2026_FDIS | 8 | 8 | transition_prep | false | transition_only |

Assertions reproduced:

- `VERSIONED_ISO_SOURCES PASS controls=61 evidence=54 approved=3 TRANSITION_ONLY=ISO9001:2026_FDIS`.
- `PRODUCTION_REFERENCE_CATALOGS PASS`.
- Natural keys are unique.
- Same-version evidence FK rejects cross-version references.
- Loader double-run is idempotent.
- Only the three approved/certifiable published versions project into product standards/control catalog.
- `ISO9001:2026_FDIS` has no product standard code and is not declared final or certifiable.
- ISO27701/27017/27018 are not product mandatory scope in this manifest.
