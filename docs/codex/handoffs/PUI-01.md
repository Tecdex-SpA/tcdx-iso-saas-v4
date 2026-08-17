# HANDOFF PUI-01

Owner: CODEX A
Account: codex
Status: DONE
Branch: fix/pui-01-source-contract-ownership
Base SHA: 033236f11a140530316c02ad81676a226efc15cb
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:

PUI-01 source ownership inventory and CONTROL-EFFECT contract ambiguity closed for the current local checkout. No PUI-02+ work was executed.

Problem addressed:

The current checkout already passed `sourceResolver.test.js`, so the PR #91 failure described in CONT-00 was not reproducible locally. A remaining contract ambiguity was confirmed: `control_assurance_evidence` described `score/100` as if it could feed CONTROL-EFFECT dimensions, while the resolver and tests correctly rejected dimension fabrication.

Root cause / ambiguity found:

`control_assurance_evidence.variable_map` mixed aggregate assurance score semantics with explicit D/I/O/E dimension semantics. The formula requires `design`, `implementation`, `operation` and `evidence`; an aggregate score is valid only for aggregate/composite calculations and must not be expanded into missing dimensions.

Canonical source decisions:

| Metric/Family | Contract | Canonical Source | Producer | Fields | Tenant Scope | Resolver/Adapter | Fallback | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CONTROL-EFFECT dimensions / `F5_5_CONTROL_EFFECTIVENESS` | `control_assurance_evidence` v3 | Explicit D/I/O/E fields only | `grc_control_assurance` and governed control assurance rows | `design_score`/`design_effectiveness`, `implementation_score`/`implementation_effectiveness`, `operation_score`/`operation_effectiveness`/`operating_effectiveness`, `evidence_score`/`evidence_effectiveness` | `tenant_id` required and adapter filters tenant | `queryControls` + `mapFormulaInput` | Legacy rows can be read, but aggregate `score` is not valid for dimensions | CANONICAL | `sourceContracts.service.js`, `sourceResolver.service.js`, `sourceResolver.test.js` |
| Control aggregate/composite score | `control_assurance_evidence` v3 | Aggregate assurance `score` as aggregate only | `grc_control_assurance` | `score` -> `effectivenesses`/composite use | `tenant_id` required | `queryControls` + aggregate formulas | Explicit legacy fallback with warning; no dimension expansion | CANONICAL | same files |
| RISK-INHERENT / `F5_5_INHERENT_RISK` | `risk_register_controls` v3 | Latest completed/reviewed ISO risk matrix items, else operational risk rows | `iso_risk_matrix_runs` + `iso_risk_matrix_items`; operational risk fallback tables | `probability`/`likelihood`, `impact`, computed `inherent_risk_score` | Tenant filtered in primary and fallback queries | `queryRisk` + `riskInherentPortfolio` | `grc_quantitative_risk_assessments`, `asset_risks`, `privacy_dpia_risks` explicit legacy fallback | CANONICAL | same files |
| MATURITY / `F5_5_MATURITY` | `maturity_assessments` v2 | Maturity evaluations; metric measurements only when explicitly bound to maturity | `survey_evaluations`; `metric_measurements` with maturity definition/binding | `level`/`maturity_level`/`score`/`total_score`, `weight` | Tenant filtered in every candidate | `queryMaturity` + `maturityPortfolio` | `metric_measurements`/`grc_metric_measurements` only under maturity predicate | CANONICAL | same files |

Files changed:

- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/formulaRegistry.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/handoffs/PUI-01.md`

Contracts changed:

- `control_assurance_evidence` updated from v2 to v3.
- Aggregate `score` remains valid for aggregate/composite effectiveness.
- Aggregate `score` is explicitly invalid as a source for D/I/O/E dimensions in `F5_5_CONTROL_EFFECTIVENESS`.
- No formula weights changed.

Migrations:

NONE.

Codex validation performed:

- Required continuity files read.
- Focused code paths inspected only.
- Pre-edit focal test executed: `cd backend && node src/services/math-governance/sourceResolver.test.js`
  - Result: PASS, `{"status":"PHASE5_5_SOURCE_RESOLVER_TESTS_OK","formulas":53,"contracts":20,"unresolved_internal":0,"fallback_assertions":3,"equivalence_assertions":9,"formula_execution_assertions":8}`
- Post-edit focal test executed: `cd backend && node src/services/math-governance/sourceResolver.test.js`
  - Result: PASS, `{"status":"PHASE5_5_SOURCE_RESOLVER_TESTS_OK","formulas":53,"contracts":20,"unresolved_internal":0,"fallback_assertions":3,"equivalence_assertions":9,"formula_execution_assertions":8}`
- Post-edit syntax checks:
  - `node -c backend/src/services/math-governance/sourceContracts.service.js` PASS
  - `node -c backend/src/services/math-governance/formulaRegistry.service.js` PASS
  - `node -c backend/src/services/math-governance/sourceResolver.test.js` PASS
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

- PUI_01_SOURCE_OWNERSHIP = PASS
- SOURCE_CONTRACTS_CANONICAL = PASS
- AMBIGUOUS_SOURCE_FALLBACKS = 0
- TENANT_SCOPE_PRESERVED = PASS
- FORMULA_WEIGHTS_CHANGED = NO
- NULL_TO_ZERO_INTRODUCED = NO
- DUPLICATE_RESOLVER_CREATED = NO
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

- No local focused failure remains.
- Full CI and full regression are not run by Codex under FOCUSED_MINIMAL.

Remaining debt:

NONE for PUI-01. PUI-02+ work remains as next work packages, not PUI-01 debt.

## Do not rediscover

- `sourceResolver.test.js` passed locally before PUI-01 edits on branch `fix/pui-01-source-contract-ownership`.
- `control_assurance_evidence` is the source contract for CONTROL-EFFECT/control aggregate family.
- `F5_5_CONTROL_EFFECTIVENESS` requires explicit D/I/O/E fields; aggregate `score` must not be copied into missing dimensions.
- Aggregate assurance `score` remains legitimate for aggregate/composite effectiveness semantics only.
- `risk_register_controls` is the source contract for `F5_5_INHERENT_RISK`; it maps `probability|likelihood` and `impact` to per-row inherent risk and aggregates usable tenant portfolio rows arithmetically.
- `maturity_assessments` is the source contract for `F5_5_MATURITY`; metric measurement fallback is restricted to explicit maturity predicates/bindings.
- `queryControls`, `queryRisk`, `queryMaturity`, `riskInherentPortfolio`, `maturityPortfolio` and `mapFormulaInput` are the audited PUI-01 runtime paths.
- PUI-02 must focus on scale/unit metadata. It must not reopen source ownership for CONTROL-EFFECT, RISK-INHERENT or MATURITY without new failing evidence.
- PUI-03 must own received/eligible/usable/excluded count semantics beyond the PUI-01 rows.
- PUI-04 must own temporal classification beyond the existing tenant-scoped filters.

Do not touch:

- Frontend/UI.
- AI Engine, RAG, Regulatory, Knowledge Base.
- Formula weights.
- Migrations/schema.
- Parallel source resolver or Math Governance duplicate.

Next exact action:

User runs manual push/PR/CI/full regression/manual validation for PUI-01. If no contradiction appears, start PUI-02 from this handoff.

Files next account should inspect first:

- `docs/codex/handoffs/PUI-01.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`

Files next account should NOT inspect unless evidence/test requires it:

- `frontend/src`
- `ai-engine/app`
- `backend/src/services/knowledge-base`
- `backend/src/services/intelligence`
- repo-wide backend trees outside focused Math Governance paths
