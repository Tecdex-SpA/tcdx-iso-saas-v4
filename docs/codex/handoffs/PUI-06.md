# HANDOFF PUI-06

Owner: CODEX A
Account: codex
Status: DONE
Branch: fix/pui-06-governed-legacy-fallback
Base SHA: 90d75b60603fccfc3b4ab0b7f75a9a3e3ef4c1cc
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:

- Implemented governed legacy fallback policy in the existing Math Governance source resolver.
- Kept PUI-01 source ownership, PUI-02 scale/unit, PUI-03 count semantics, PUI-04 temporal semantics and PUI-05 status semantics intact.
- Manual closure promoted PUI-06 to DONE after focal rerun PASS and deploy/post-deploy PASS.

PUI-05 base/manual validation verification:

- `main` base contains `90d75b6 fix(data): canonicalize domain status semantics`.
- User provided PUI-05 integrated, validated and deployed OK as precondition.

Fallback paths found:

- `firstPopulatedTables` and `firstPopulated` are the real table-candidate fallback paths in Math Governance.
- Runtime adapters using governed fallback paths: compliance, risk, control assurance, audit findings/actions, evidence freshness and maturity.
- Generic source-contract table candidate resolution no longer implies fallback unless the source code is explicitly authorized.

Legacy sources found:

- `compliance_requirements_assessments`: `control_soa_assessments`, `tenant_controls`.
- `risk_register_controls`: `grc_quantitative_risk_assessments`, `asset_risks`, `privacy_dpia_risks`.
- `control_assurance_evidence`: `control_soa_assessments`, `control_health_scores`, `tenant_controls`.
- `audit_findings_actions`: formula-dependent legacy alternatives among findings/actions tables.
- `evidence_freshness_records`: `grc_evidence_versions`.
- `maturity_assessments`: `metric_measurements`, `grc_metric_measurements`.

Canonical fallback policy:

- Fallback is resolver-governed and contract-code allowlisted.
- Fallback is allowed only when the primary source is truly absent or returns no physical rows under tenant scope.
- Fallback is not allowed merely because there is no usable output.

Primary states:

- `primary_available`
- `primary_absent`
- `primary_no_rows`
- `primary_source_incompatible`
- `primary_rows_excluded`
- `primary_validation_failed`
- `primary_unmeasured`

Allowed fallback triggers:

- `primary_absent`
- `primary_no_rows`

Forbidden fallback triggers:

- `primary_contract_invalid`
- `primary_source_incompatible`
- `primary_rows_excluded`
- `primary_validation_failed`
- `status_unmapped`
- temporal invalid or missing required time
- scale/unit invalid
- normalization failure
- unknown reason

Fallback provenance:

- Resolver output and `source_snapshot` expose `fallback_used`, `fallback_reason`, `primary_state` and `fallback_summary`.
- Fallback rows carry `__fallback_used`, `__fallback_reason`, `__primary_state`, `__primary_source`, `__fallback_source` and a visible warning.

Fallback observability:

- Structured resolver metadata is sufficient to identify source code, primary state, fallback reason, primary source and physical fallback source.
- No new metrics/logging infrastructure was added in PUI-06.

Count semantics preserved:

- Primary rows excluded by validation remain visible as `primary_rows_excluded`; fallback does not overwrite `received`, `eligible`, `usable`, `excluded` semantics.

Temporal semantics preserved:

- Temporal rejection remains a validation/exclusion reason and does not activate fallback.

Status semantics preserved:

- Unknown/unmapped status remains visible and does not activate fallback.

Source contracts changed:

- NONE. Fallback policy was implemented as resolver execution policy, not source-contract governed payload.

Version bumps:

- NONE.

CONTRACTS_VERSIONED:

- []

UNNECESSARY_VERSION_BUMPS:

- 0

Formula changes:
NONE

Files changed:

- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/handoffs/PUI-06.md`

Codex validation performed:

- `node -c backend/src/services/math-governance/sourceResolver.service.js`
- `node -c backend/src/services/math-governance/sourceResolver.test.js`
- `git diff --check`
- `cd backend && node src/services/math-governance/sourceResolver.test.js` once under Codex and later manual rerun.

FOCAL_TEST:
PASS

FULL_CI:
NOT_RUN_BY_DESIGN

FULL_REGRESSION:
NOT_RUN_BY_DESIGN

PUSH:
NOT_RUN_BY_DESIGN

MERGE:
NOT_RUN_BY_DESIGN

DEPLOY:
PASS_MANUAL

MANUAL_VALIDATION_PENDING:
NO

Gates:

- LEGACY_FALLBACK_POLICY = PASS
- FALLBACK_MASKING_BUG = 0
- FALLBACK_OBSERVABILITY = PASS
- PRIMARY_ABSENCE_DISTINGUISHED_FROM_INVALID = PASS
- PRIMARY_ROWS_EXCLUDED_DO_NOT_TRIGGER_FALLBACK = PASS
- CONTRACT_INVALID_DOES_NOT_TRIGGER_FALLBACK = PASS
- SOURCE_INCOMPATIBLE_DOES_NOT_TRIGGER_FALLBACK = PASS
- STATUS_UNMAPPED_DOES_NOT_TRIGGER_FALLBACK = PASS
- TEMPORAL_INVALID_DOES_NOT_TRIGGER_FALLBACK = PASS
- FALLBACK_PROVENANCE = PASS
- COUNT_RECONCILIATION_PRESERVED = PASS
- TEMPORAL_SEMANTICS_PRESERVED = PASS
- STATUS_SEMANTICS_PRESERVED = PASS
- SOURCE_OWNERSHIP_REOPENED = NO
- SCALE_UNIT_REOPENED = NO
- COUNT_SEMANTICS_REOPENED = NO
- TEMPORAL_SEMANTICS_REOPENED = NO
- STATUS_SEMANTICS_REOPENED = NO
- FORMULA_EXPRESSION_CHANGED = NO
- FORMULA_WEIGHTS_CHANGED = NO
- FORMULA_UNITS_CHANGED = NO
- FORMULA_PRECISION_CHANGED = NO
- NULL_TO_ZERO_INTRODUCED = NO
- TENANT_SCOPE_PRESERVED = PASS
- SELLABLE_MULTI_TENANT = PASS
- ZERO_HARDCODE = PASS
- PUBLISHED_CONTRACT_IMMUTABILITY = PASS
- PUBLISHED_FORMULA_IMMUTABILITY = PASS
- UNNECESSARY_VERSION_BUMPS = 0
- PRODUCT_CODE_SCOPE = FOCUSED
- CODEX_VALIDATION_MODE = FOCUSED_MINIMAL
- FOCAL_TEST = PASS
- FULL_CI = NOT_RUN_BY_DESIGN
- FULL_REGRESSION = NOT_RUN_BY_DESIGN
- PUSH = NOT_RUN_BY_DESIGN
- MERGE = NOT_RUN_BY_DESIGN
- DEPLOY = PASS_MANUAL
- MANUAL_VALIDATION_PENDING = NO

Known failures:

- None after manual closure.

Remaining debt:

- None for PUI-06.

## Do not rediscover

- PUI-01 source ownership remains closed.
- PUI-02 scale/unit semantics remains closed.
- PUI-03 count/population semantics remains closed.
- PUI-04 temporal semantics remains closed.
- PUI-05 status normalization remains closed.
- Published source/formula checksum immutability remains closed.
- PUI-06 fallback policy lives in `sourceResolver.service.js`.
- Allowed fallback triggers are only `primary_absent` and `primary_no_rows`.
- Forbidden fallback triggers include invalid/incompatible primary, all rows excluded, status unmapped, temporal invalid, scale/unit invalid and unknown reasons.
- Source contracts were not versioned by PUI-06 because governed source-contract payload did not change.

Do not touch:

- Formula expressions, weights, units, precision, formulas versioning.
- PUI-01..PUI-05 contracts unless new objective evidence requires it.
- UI, AI, RAG, Regulatory, deploy scripts.

Next exact action:

- Begin PUI-07 from updated `main`.

Files next account should inspect first:

- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/handoffs/PUI-06.md`

Files next account should NOT inspect unless evidence/test requires it:

- `frontend/`
- `ai-engine/`
- `backend/src/services/knowledge-base/`
- `backend/src/services/intelligence/`
- Regulatory services

Manual validation closure:

- sourceResolver.test.js rerun manually after Codex correction: PASS
- deployment executed manually with ./scripts/deploy-vms.sh: PASS
- backend post-deploy: PASS
- AI Engine post-deploy: PASS
- frontend post-deploy: PASS
- no source contract checksum mismatch
- no formula checksum mismatch

PUI-06 promoted from REVIEW to DONE.
