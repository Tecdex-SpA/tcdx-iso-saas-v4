# HANDOFF PUI-02

Owner: CODEX A
Account: codex
Status: DONE
Branch: fix/pui-02-scale-unit-contract
Base SHA: 57e8264cfbc94a7895cf21252b85665deea731d0
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:

Canonical scale/unit/range/normalization contract closed for the PUI-02 focal source contracts and resolver paths. PUI-03 was not executed.

PUI-01 base verification:

`git merge-base --is-ancestor 810b6c42e8d06572283a243da102b38adca1a5b1 HEAD` returned non-zero because PUI-01 is integrated in this base with a different SHA. Focal verification passed:

- `control_assurance_evidence` exists as v3.
- Aggregate `score` does not feed CONTROL-EFFECT D/I/O/E.
- `docs/codex/handoffs/PUI-01.md` exists.

Scale/unit ambiguities found:

- `ratio(value)` inferred semantics by magnitude with `n > 1 ? n / 100 : n` and silently clamped to 0..1.
- CONTROL-EFFECT D/I/O/E were normalized through that heuristic instead of contract metadata.
- MATURITY accepted/rejected values by 0..5 range without a source scale declaration for percent-score inputs.
- Supplier risk health had `<=5 ? *20 : value` magnitude inference in the focused resolver file.

Canonical scale decisions:

| Variable/Metric | Contract | Source Field | Source Scale | Source Unit | Canonical Scale | Canonical Unit | Strategy | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CONTROL-EFFECT D/I/O/E | `control_assurance_evidence` v3 | explicit dimension score/effectiveness fields | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio` | CANONICAL | `sourceContracts.service.js`, `sourceResolver.service.js`, `sourceResolver.test.js` |
| Control aggregate effectiveness | `control_assurance_evidence` v3 | `score` | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio` | CANONICAL | same files |
| RISK-INHERENT axes | `risk_register_controls` v3 | `probability`/`likelihood`, `impact` | `SCORE_1_5` | `score` | `SCORE_1_5` | `score` | `identity_integer` | CANONICAL | same files |
| Residual control effectiveness | `risk_register_controls` v3 | assurance/effectiveness score fields | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio` | CANONICAL | same files |
| MATURITY level | `maturity_assessments` v3 | `level`, `maturity_level`, `numeric_value`, `value_numeric` | `SCORE_0_5` | `level` | `SCORE_0_5` | `level` | `identity` | CANONICAL | same files |
| MATURITY score fallback | `maturity_assessments` v3 | `score`, `total_score` or declared row scale | `PERCENT_0_100` | `percent` | `SCORE_0_5` | `level` | `percent_to_score_0_5` | CANONICAL | same files |
| Supplier risk health support | `supplier_tprm_assessments` | supplier risk dimension scores | `SCORE_0_5` | `score` | `PERCENT_0_100` | `percent` | `score_0_5_to_percent` | CANONICAL | same files |

Canonical unit decisions:

- Percent source values use `source_unit=percent`.
- Formula ratio inputs use `canonical_unit=ratio`.
- Risk axes use `source_unit=score` and `canonical_unit=score`.
- Maturity uses `source_unit=level|percent` and `canonical_unit=level`.

Normalization decisions:

- Normalization is explicit through `sourceContracts.service.js` `scale_metadata`.
- `sourceResolver.service.js` validates source and canonical ranges before returning a normalized value.
- Unsupported conversions or out-of-range values return `null` and are excluded/rejected by existing formula/resolver behavior.
- Source snapshots now include `scale_metadata` for provenance.

Heuristics removed:

- Removed `ratio(value)` magnitude inference and silent clamp.
- Removed CONTROL-EFFECT D/I/O/E normalization by magnitude.
- Removed MATURITY percentage handling by implicit range.
- Removed supplier risk health `<=5 ? *20 : value` magnitude inference.

Files changed:

- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/handoffs/PUI-02.md`

Contracts changed:

- Added `scale_metadata` to source contracts.
- `maturity_assessments` updated to v3.
- `supplier_tprm_assessments` now declares supplier risk scale metadata.
- `control_assurance_evidence` and `risk_register_controls` retain PUI-01 ownership but now include scale/unit/range metadata.

Migrations:

NONE.

Codex validation performed:

- Required continuity files read.
- PUI-01 base verified by fallback focal evidence.
- Focused scale/unit paths inspected.
- Final syntax checks after code edits:
  - `node -c backend/src/services/math-governance/sourceContracts.service.js` PASS
  - `node -c backend/src/services/math-governance/sourceResolver.service.js` PASS
  - `node -c backend/src/services/math-governance/sourceResolver.test.js` PASS
- Focal test executed once during implementation under FOCUSED_MINIMAL:
  - `cd backend && node src/services/math-governance/sourceResolver.test.js`
  - PASS: `{"status":"PHASE5_5_SOURCE_RESOLVER_TESTS_OK","formulas":53,"contracts":20,"unresolved_internal":0,"fallback_assertions":3,"equivalence_assertions":9,"formula_execution_assertions":8}`
- Diff reviewed.

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
NOT_RUN_BY_DESIGN

MANUAL_VALIDATION_PENDING:
YES

Gates:

- PUI_02_SCALE_UNIT_CONTRACT = PASS
- SCALE_METADATA_EXPLICIT = PASS
- UNIT_METADATA_EXPLICIT = PASS
- RANGE_METADATA_EXPLICIT = PASS
- MAGNITUDE_BASED_INFERENCE = 0
- SILENT_CLAMPING = 0
- NULL_TO_ZERO_INTRODUCED = NO
- SOURCE_OWNERSHIP_REOPENED = NO
- FORMULA_WEIGHTS_CHANGED = NO
- TENANT_SCOPE_PRESERVED = PASS
- SELLABLE_MULTI_TENANT = PASS
- ZERO_HARDCODE = PASS
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

- No focused local failures remain.
- Full CI and full regression are not run by Codex under FOCUSED_MINIMAL.

Remaining debt:

NONE for PUI-02. Count semantics, temporal semantics, status semantics, fallback governance, provenance/Data Trust and full matrix remain as separate PUI-03+ work packages.

## Do not rediscover

- PUI-01 ownership remains closed: do not reopen CONTROL-EFFECT, RISK-INHERENT or MATURITY source ownership without new failing evidence.
- `scale_metadata` in `sourceContracts.service.js` is the PUI-02 canonical scale/unit contract.
- `ratio(value)` no longer infers by magnitude; callers must provide an explicit source scale or use contract metadata.
- CONTROL-EFFECT D/I/O/E source fields are `PERCENT_0_100 -> RATIO_0_1`.
- A CONTROL aggregate `score` remains aggregate-only and is normalized `PERCENT_0_100 -> RATIO_0_1`.
- RISK-INHERENT probability/likelihood and impact are `SCORE_1_5` integer axes; zero is invalid.
- MATURITY level fields are `SCORE_0_5`; percent score fallback is `PERCENT_0_100 -> SCORE_0_5` only when declared.
- Supplier risk health conversion is `SCORE_0_5 -> PERCENT_0_100`; no magnitude branch remains.
- Source snapshots include `scale_metadata`; PUI-03 must not replace this while working on counts.

Do not touch:

- Frontend/UI.
- AI Engine, RAG, Regulatory, Knowledge Base.
- Formula weights.
- Source ownership closed by PUI-01.
- Migrations/schema.
- Parallel source resolver or Math Governance duplicate.

Next exact action:

User runs manual push/PR/CI/full regression/manual validation for PUI-02. If no contradiction appears, start PUI-03 from this handoff.

Files next account should inspect first:

- `docs/codex/handoffs/PUI-02.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`

Files next account should NOT inspect unless evidence/test requires it:

- `frontend/src`
- `ai-engine/app`
- `backend/src/services/knowledge-base`
- `backend/src/services/intelligence`
- source ownership paths already closed by PUI-01 except where a PUI-03 count test proves contradiction
