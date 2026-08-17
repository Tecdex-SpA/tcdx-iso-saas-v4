# HANDOFF PUI-07

Owner: CODEX A
Account: codex
Status: DONE
Branch: fix/pui-07-data-trust
Base SHA: 955a5877bd1f199def844a94d3c173be6b94dc04
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:

Data Trust is now deterministic, versioned and attached to Math Governance source resolution, source snapshots and official calculation output context. It consumes structured evidence from PUI-01..PUI-06 without recalculating those semantics and without using AI.

PUI-06 base verification:

- `main` contains `bff2b8b fix(data): govern legacy fallback semantics`.
- `docs/codex/handoffs/PUI-06.md` records `Status: DONE`, `FOCAL_TEST: PASS`, manual deploy PASS and post-deploy backend/AI/frontend PASS.
- Focal code verification found `PRIMARY_STATES`, `LEGACY_FALLBACK_POLICY_BY_SOURCE`, `canUseLegacyFallback` and `fallback_summary` in `sourceResolver.service.js`.

Existing Data Trust foundation found:

- `indicator_data_trust_assessments` source contract and `F5_C3_DATA_TRUST` formula already model persisted trust-assessment data.
- `calculationSnapshot.service.js` and `calculationLineage.service.js` are compatibility re-exports of existing validation/resolver paths.
- PUI-07 adds calculated trust assessment for the source resolution itself; it does not create a recursive replacement for the operational Data Trust dataset.

Canonical trust model:

- Deterministic evaluator in `backend/src/services/math-governance/dataTrust.service.js`.
- Resolver computes `data_trust` from source contract, counts, validation issues, temporal/status summaries, fallback summary and provenance.
- Trust state is independent from metric value.

Trust model version:

- `data-trust-model-v1`

Trust dimensions:

- `source_validity`
- `completeness`
- `population_sufficiency`
- `field_validity`
- `temporal_validity`
- `status_validity`
- `scale_unit_validity`
- `consistency`
- `fallback_dependency`
- `provenance_completeness`

Trust states:

- `TRUSTED`
- `TRUSTED_WITH_WARNINGS`
- `LOW_CONFIDENCE`
- `INSUFFICIENT_DATA`
- `UNTRUSTED`
- `UNMEASURED`

Trust reasons:

- `source_unavailable`
- `source_incompatible`
- `source_contract_invalid`
- `no_received_rows`
- `insufficient_population`
- `high_exclusion_ratio`
- `validation_warnings`
- `fallback_used`
- `status_unmapped`
- `status_not_eligible`
- `temporal_invalid`
- `scale_unit_invalid`
- `missing_required_fields`
- `provenance_incomplete`
- `consistency_issues`

Sufficiency vs trust decision:

- `usable < minimum_sample_size` produces `INSUFFICIENT_DATA`.
- Sufficient usable population with high exclusion ratio produces `LOW_CONFIDENCE`.
- A poor metric value does not reduce trust by itself.

Fallback impact:

- Governed legacy fallback adds reason `fallback_used` and a warning dimension.
- Fallback can yield `TRUSTED_WITH_WARNINGS`; it is not automatically `UNTRUSTED`.

Provenance integration:

- `data_trust` is exposed on resolver results and `source_snapshot.data_trust`.
- It records source code, formula code, contract checksum presence, physical sources, counts, fallback state/reason and issue codes.

Snapshot integration:

- Existing source snapshot payload contains `data_trust`.
- Persisted snapshot metadata includes `data_trust` alongside source code, physical sources and exclusions.
- PUI-08 still owns full reproducibility/lineage closure.

Tenant isolation:

- Trust assessment uses tenant-scoped resolver outputs only.
- Focal test covers two tenant-scoped datasets producing distinct trust states without tenant-specific logic.

Source contracts changed:

- NONE

Source contract version bumps:

- NONE

Formula changes:
NONE

Files changed:

- `backend/src/services/math-governance/dataTrust.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/handoffs/PUI-07.md`

Codex validation performed:

- `node -c backend/src/services/math-governance/dataTrust.service.js`
- `node -c backend/src/services/math-governance/sourceResolver.service.js`
- `node -c backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
- `node -c backend/src/services/math-governance/sourceResolver.test.js`
- `cd backend && node src/services/math-governance/sourceResolver.test.js`
- `git diff --check`

FOCAL_TEST:
PASS - `PHASE5_5_SOURCE_RESOLVER_TESTS_OK`

FULL_CI:
NOT_RUN_BY_DESIGN

FULL_REGRESSION:
NOT_RUN_BY_DESIGN

PUSH:
NOT_RUN_BY_DESIGN

MERGE:
NOT_RUN_BY_DESIGN

DEPLOY:
NOT_RUN_BY_DESIGN

MANUAL_VALIDATION_PENDING:
YES

Gates:

- PUI_07_DATA_TRUST = PASS
- DATA_TRUST_DETERMINISTIC = PASS
- DATA_TRUST_MODEL_VERSIONED = PASS
- TRUST_REASONS_AUDITABLE = PASS
- TRUST_VALUE_SEPARATED_FROM_METRIC_VALUE = PASS
- SUFFICIENCY_DISTINGUISHED_FROM_LOW_TRUST = PASS
- FALLBACK_SIGNAL_IN_TRUST = PASS
- SOURCE_VALIDITY_SIGNAL = PASS
- SCALE_UNIT_VALIDITY_SIGNAL = PASS
- TEMPORAL_VALIDITY_SIGNAL = PASS
- STATUS_VALIDITY_SIGNAL = PASS
- COUNT_POPULATION_SIGNAL = PASS
- PROVENANCE_SIGNAL = PASS
- TENANT_SCOPE_PRESERVED = PASS
- SELLABLE_MULTI_TENANT = PASS
- ZERO_HARDCODE = PASS
- NULL_TO_ZERO_INTRODUCED = NO
- SOURCE_OWNERSHIP_REOPENED = NO
- SCALE_UNIT_REOPENED = NO
- COUNT_SEMANTICS_REOPENED = NO
- TEMPORAL_SEMANTICS_REOPENED = NO
- STATUS_SEMANTICS_REOPENED = NO
- FALLBACK_GOVERNANCE_REOPENED = NO
- FORMULA_EXPRESSION_CHANGED = NO
- FORMULA_WEIGHTS_CHANGED = NO
- FORMULA_UNITS_CHANGED = NO
- FORMULA_PRECISION_CHANGED = NO
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
- DEPLOY = NOT_RUN_BY_DESIGN
- MANUAL_VALIDATION_PENDING = YES

Known failures:

- None in the single focal test executed.

Remaining debt:

- None for PUI-07. PUI-08 owns full source snapshot/lineage reproducibility closure.

## Do not rediscover

- PUI-01 source ownership remains closed.
- PUI-02 scale/unit remains closed.
- PUI-03 counts remain closed.
- PUI-04 temporal semantics remains closed.
- PUI-05 status normalization remains closed.
- PUI-06 fallback governance remains closed.
- PUI-07 Data Trust model lives in `dataTrust.service.js`.
- Data Trust model version is `data-trust-model-v1`.
- Trust state does not depend on metric value.
- `INSUFFICIENT_DATA` and `LOW_CONFIDENCE` are distinct.
- Fallback usage is a warning signal, not automatic untrusted state.
- No source contract or formula payload changed in PUI-07.

Do not touch:

- Formula expressions, weights, units, precision.
- PUI-01..PUI-06 semantics unless new objective evidence requires it.
- UI, AI, RAG, Regulatory.

Next exact action:

- User pushes branch / opens PR / runs CI and full regression manually. If accepted, begin PUI-08 in a new session from the updated base.

Files next account should inspect first:

- `docs/codex/handoffs/PUI-07.md`
- `backend/src/services/math-governance/dataTrust.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`

Files next account should NOT inspect unless evidence/test requires it:

- `frontend/`
- `ai-engine/`
- `backend/src/services/knowledge-base/`
- `backend/src/services/intelligence/`
- Regulatory services
