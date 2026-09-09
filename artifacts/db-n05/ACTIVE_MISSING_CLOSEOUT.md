# DB-N05 Active Missing Closeout

Final local result: ACTIVE_MISSING=0, checked=60, critical_undetermined=0; runtime schema contract PASS.

- Earlier embedding/chunk drift is reconciled to F6.10-02/F6.10-03 and F6.11-A scope rules. vector remains mandatory.
- This continuation reconciles all 15 requested regulatory tables to F6.11-A/B. The gate compares full table definitions and canonical indexes, not just names. Source-key/authority/provenance/lifecycle and pack/diff constraints now match the existing services.
- Fresh PostgreSQL exposed a data_snapshots index referencing nonexistent source_contract_id. Its identity now matches semanticLayer.service.js: tenant/type/entity/id/coalesced period/source hash.
- The stale commercial grant name was corrected to plan_version_capabilities.
- Broad `EXECUTE ON ALL FUNCTIONS` grants were removed. Runtime function execution is now explicit allowlist and covered by the effective role privilege test.
- Simplified Health formula/source seed rows were removed in favor of the real official registries. Formula name compatibility no longer blocks canonical display_name inserts; reviewed_by/approved_by match canonical text identities; version metadata/unique identity are preserved. Source binding lineage is tested through its official_formula_version_id and the canonical source code.

Regulatory schema parity: PASS for 15 tables and canonical constraints/indexes; fresh DDL/rerun PASS. No legal source data fabricated. This remains the explicitly scoped inventory; it does not promise every repository query is covered.

Residual gate is catalog completeness: MISSING_PRODUCTION_REFERENCE_SOURCE; see REFERENCE_CATALOG_COVERAGE.md. No DB-N06 or production creation.
