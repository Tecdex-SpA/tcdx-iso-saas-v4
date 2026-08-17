# HANDOFF PUI-03

Owner: CODEX A
Account: codex
Status: DONE
Branch: fix/pui-03-count-population-semantics
Base SHA: d9800d9d38926bf92b0fd08b0f1e528616e2e5bf
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:

Canonical count and population semantics are closed for the focused Math Governance source resolver and dataset validation paths. PUI-04 was not executed.

PUI-02 base verification:

`git merge-base --is-ancestor 2ec20c5a28c09f833bd0d017cd8bc4054200f367 HEAD` returned non-zero because PUI-02 is integrated in this base with a different SHA. Focal verification passed:

- `docs/codex/handoffs/PUI-02.md` exists.
- Source contracts include `scale_metadata`.
- `maturity_assessments` is v3.
- Removed PUI-02 magnitude heuristics were not present in focused resolver/source-contract paths.

Count ambiguities found:

- Dataset validation exposed `excludedCount` as rows but `exclusionIssueCount` as total issue instances, which did not match the canonical PUI-03 issue-category semantics.
- Resolver counts had `received`, `usable` and `excluded`, but no explicit `eligible`, `ineligible`, `eligible_unusable`, `population_size` or issue-instance/category split.
- Source snapshots used ambiguous count names and did not carry the full count contract.
- A source with physical rows but zero usable formula rows could be reported as `empty_dataset`, which obscured all-rows-excluded from zero physical rows.

Canonical count decisions:

| Metric/Family | Contract | Physical Received | Eligibility Rule | Usable Rule | Excluded Semantics | Issue Count | population_size | Status | Evidence |
|---|---:|---|---|---|---|---|---|---|---|
| Dataset validation / all source contracts | contract-specific source | `rows.length` after tenant/source scope | rows passing dataset/contract validation | same as eligible at validation stage | unique invalid rows | distinct issue codes; instances retained | eligible rows | CANONICAL | `datasetValidation.service.js`, `sourceResolver.test.js` |
| RISK-INHERENT | `risk_register_controls` v3 | normalized resolver rows | `validation.usable_rows.length` | rows with valid probability/likelihood and impact | received rows not used by formula | distinct issue codes; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`, `sourceResolver.test.js` |
| MATURITY | `maturity_assessments` v3 | normalized resolver rows | `validation.usable_rows.length` | rows with valid declared maturity level/score | received rows not used by formula | distinct issue codes; instances retained | eligible rows | CANONICAL | same files |
| Severity index | `audit_findings_actions` | normalized resolver rows | `validation.usable_rows.length` | rows with valid severity | received rows not used by formula | distinct issue codes; instances retained | eligible rows | CANONICAL | same files |
| Generic mappings | formula source contract | normalized resolver rows | `validation.usable_rows.length` | same as eligible unless formula-specific mapper applies | received rows not used by formula | distinct issue codes; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js` |

Population reconciliation:

- `received = ineligible + eligible`.
- `eligible = usable + eligible_unusable`.
- `excluded = received - usable`.
- `exclusionIssueCount` is distinct issue categories/codes, not excluded rows.
- `exclusionIssueInstanceCount` preserves multiple issue instances per row for audit.
- `population_size = eligible`.

Files changed:

- `backend/src/services/math-governance/countSemantics.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/handoffs/PUI-03.md`

Contracts changed:

- Added `count_semantics` to source contracts.
- Resolver `counts` now include `received`, `eligible`, `usable`, `excluded`, `ineligible`, `eligible_unusable`, `exclusionIssueCount`, `exclusionIssueInstanceCount` and `population_size`.
- Source snapshots now include canonical `counts`, count semantics, explicit row count fields and auditable exclusion details.

Migrations:

NONE.

Codex validation performed:

- Required continuity files read.
- PUI-02 base verified by fallback focal evidence.
- Focused count paths inspected.
- Syntax checks:
  - `node -c backend/src/services/math-governance/countSemantics.service.js` PASS
  - `node -c backend/src/services/math-governance/datasetValidation.service.js` PASS
  - `node -c backend/src/services/math-governance/sourceContracts.service.js` PASS
  - `node -c backend/src/services/math-governance/sourceResolver.service.js` PASS
  - `node -c backend/src/services/math-governance/sourceResolver.test.js` PASS
- Focal test executed once:
  - `cd backend && node src/services/math-governance/sourceResolver.test.js`
  - PASS: `{"status":"PHASE5_5_SOURCE_RESOLVER_TESTS_OK","formulas":53,"contracts":20,"unresolved_internal":0,"fallback_assertions":3,"equivalence_assertions":9,"formula_execution_assertions":8}`

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

- PUI_03_COUNT_SEMANTICS = PASS
- RECEIVED_SEMANTICS = PASS
- ELIGIBLE_SEMANTICS = PASS
- USABLE_SEMANTICS = PASS
- EXCLUDED_ROWS_SEMANTICS = PASS
- EXCLUSION_ISSUE_COUNT_SEMANTICS = PASS
- POPULATION_SIZE_SEMANTICS = PASS
- COUNT_RECONCILIATION = PASS
- FALSE_RECEIVED_ZERO_INTRODUCED = NO
- NULL_TO_ZERO_INTRODUCED = NO
- SOURCE_OWNERSHIP_REOPENED = NO
- SCALE_UNIT_REOPENED = NO
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
- Full CI and full regression were not run by design.

Remaining debt:

NONE for PUI-03. Temporal semantics, status semantics, fallback governance, provenance/Data Trust and full indicator matrix remain separate PUI-04+ work packages.

## Do not rediscover

- PUI-01 ownership remains closed for CONTROL-EFFECT, RISK-INHERENT and MATURITY.
- PUI-02 scale/unit remains closed through `scale_metadata`.
- `received` = physical rows after tenant/source scope.
- `eligible` = rows after dataset/contract validation and before formula-specific input validation.
- `usable` = eligible rows with valid formula inputs.
- `excluded` = unique physical rows not used by formula; it is not issue count.
- `exclusionIssueCount` = distinct issue categories/codes.
- `exclusionIssueInstanceCount` = total issue instances.
- `population_size` = eligible population.
- Count helper audited: `backend/src/services/math-governance/countSemantics.service.js`.
- Paths audited: `datasetValidation.service.js`, `sourceResolver.service.js`, `sourceContracts.service.js`, `sourceResolver.test.js`, direct count consumers in `officialCalculation.service.js` and `officialCalculationOrchestrator.service.js`.

Do not touch:

- Frontend/UI.
- AI Engine, RAG, Regulatory, Knowledge Base.
- Source ownership closed by PUI-01.
- Scale/unit closed by PUI-02.
- Formula weights.
- Migrations/schema.
- Parallel source resolver or Math Governance duplicate.

Next exact action:

User runs manual push/PR/CI/full regression/manual validation for PUI-03. If no contradiction appears, start PUI-04 from this handoff.

Files next account should inspect first:

- `docs/codex/handoffs/PUI-03.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`

Files next account should NOT inspect unless evidence/test requires it:

- `frontend/src`
- `ai-engine/app`
- `backend/src/services/knowledge-base`
- `backend/src/services/intelligence`
- source ownership or scale/unit paths already closed by PUI-01/PUI-02 unless a PUI-04 temporal test proves contradiction
