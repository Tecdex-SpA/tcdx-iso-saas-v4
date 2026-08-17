# CONTRACTS_REGISTRY — TCDX ISO SaaS V4

| Contrato | Estado | Owner | Nota |
|---|---|---|---|
| Source contracts | PARTIAL | CODEX A | Existen; PRE-UI fortalece semántica, escala, unidad, temporalidad y elegibilidad. |
| Metric/data semantics | PARTIAL | CODEX A | Debe quedar canónico al cerrar PRE-UI. |
| Count semantics | CURRENT/PUI-03 | CODEX A | PUI-03 cerró received/eligible/usable/excluded/exclusionIssueCount/population_size para source resolver y dataset validation focales. |
| Temporal semantics | PARTIAL | CODEX A | event/state/validity/latest-effective-state. |
| Scale/unit semantics | CURRENT/PUI-02 | CODEX A | PUI-02 cerró escala/unidad para CONTROL-EFFECT, RISK-INHERENT, MATURITY y normalización explícita auditada; otros dominios quedan para su paquete específico sólo con evidencia. |
| Data Trust | PARTIAL | CODEX A | Foundation existente; reproducibilidad a cerrar. |
| Measurement | CURRENT/PARTIAL | CODEX A | Official calculation existe; Data Truth aún no cerrado. |
| Snapshot | CURRENT/PARTIAL | CODEX A | Foundation existente. |
| Lineage | CURRENT/PARTIAL | CODEX A | Foundation existente. |
| Observation contract | PLANNED | CODEX A | 6.8-01. |
| Gap contract | PLANNED | CODEX A | 6.8-03. |
| Graph Edge contract | PLANNED | CODEX A | 6.9-02. |
| Priority contract | PLANNED | CODEX B | 6.9-03; score determinístico/versionado. |
| IntelligenceContext | PARTIAL | CODEX B | Backend + AI Engine deben reconciliar ownership. |
| Knowledge Document | PLANNED/PARTIAL | CODEX B | KB v2 existe; modelo documental universal pendiente. |
| Knowledge Chunk | PLANNED | CODEX B | 6.10. |
| RAG Citation | PLANNED | CODEX B | 6.10-05. |
| Regulation | PLANNED | CODEX B | 6.11. |
| RegulationVersion | PLANNED | CODEX B | 6.11. |
| LegalObligation | PLANNED | CODEX B | 6.11. |
| Regulatory Mapping | PLANNED | CODEX B | 6.11. |
| Capability/RBAC | CURRENT/PROTECTED | A+C | Reutilizar sistema existente; backend autoriza. |

Regla: si un work package cambia un contrato, actualizar este archivo en el mismo commit.

## PUI-01 Source Ownership Inventory

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-01-source-contract-ownership`.

| Metric/Family | Contract | Canonical Source | Producer | Fields | Tenant Scope | Resolver/Adapter | Fallback | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CONTROL-EFFECT / `F5_5_CONTROL_EFFECTIVENESS` dimensions | `control_assurance_evidence` v3 | Explicit control dimension fields only | `grc_control_assurance` and governed control assurance rows | `design_score`/`design_effectiveness`, `implementation_score`/`implementation_effectiveness`, `operation_score`/`operation_effectiveness`/`operating_effectiveness`, `evidence_score`/`evidence_effectiveness` | `tenant_id` required; adapter filters `a.tenant_id=$1::uuid` | `queryControls` + `mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS')` | Legacy tables may provide rows, but aggregate `score` is not valid for D/I/O/E dimensions | CANONICAL | `backend/src/services/math-governance/sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| Control aggregate effectiveness / composite assurance score | `control_assurance_evidence` v3 | Aggregate assurance score as aggregate only | `grc_control_assurance` or explicit legacy adapter row with `score` | `score` mapped to `effectivenesses`/aggregate use; not to D/I/O/E | `tenant_id` required through resolver and adapter | `queryControls`; `mapFormulaInput('F5_5_COMBINED_EFFECTIVENESS')`; residual risk control effectiveness mapping where present | Explicit first-populated legacy fallback with warning; no semantic expansion | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js` |
| RISK-INHERENT / `F5_5_INHERENT_RISK` | `risk_register_controls` v3 | Latest completed/reviewed ISO risk matrix items, else operational risk rows | `iso_risk_matrix_runs` + `iso_risk_matrix_items`; fallback operational risk tables | `probability`/`likelihood`, `impact`, computed `inherent_risk_score=probability*impact` | `tenant_id` required; primary query filters run and item tenant; fallback uses tenant filter | `queryRisk`; `riskInherentPortfolio`; `mapFormulaInput('F5_5_INHERENT_RISK')` | `grc_quantitative_risk_assessments`, `asset_risks`, `privacy_dpia_risks` are explicit legacy fallbacks | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| MATURITY / `F5_5_MATURITY` | `maturity_assessments` v2 | Published/effective maturity evaluations; metric measurements only when bound to maturity | `survey_evaluations`; scoped metric measurement definitions/bindings | `level`/`maturity_level`/`score`/`total_score`; `weight`; metric fallback restricted by `MATURITY` or `F5_5_MATURITY` binding | `tenant_id` required; every candidate query filters tenant | `queryMaturity`; `maturityPortfolio`; `mapFormulaInput('F5_5_MATURITY')` | `metric_measurements` and `grc_metric_measurements` only with explicit maturity predicate; invalid/non-0..5 levels excluded | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |

PUI-01 decision: an aggregate/composite score can be a valid source only for aggregate/composite calculations. It is never a valid substitute for missing formula dimensions. Missing source, missing dimension, no-data, insufficient-data and excluded rows remain distinct from numeric zero.

PUI-02+ boundary: scale/unit metadata, temporal classification, count semantics and broader 22+ indicator matrix remain for their own work packages; PUI-01 closes source ownership for the rows above only.

## PUI-02 Scale And Unit Contract Inventory

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-02-scale-unit-contract`.

| Variable/Metric | Contract | Source Field | Source Scale | Source Unit | Canonical Scale | Canonical Unit | Strategy | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CONTROL-EFFECT D/I/O/E | `control_assurance_evidence` v3 | `design_score`, `implementation_score`, `operation_score`, `evidence_score` and explicit effectiveness aliases | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio`; no `0.8 == 80%` inference | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| Control aggregate effectiveness | `control_assurance_evidence` v3 | `score` | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio`; aggregate remains aggregate only | CANONICAL | same files |
| RISK-INHERENT axes | `risk_register_controls` v3 | `probability`/`likelihood`, `impact` | `SCORE_1_5` | `score` | `SCORE_1_5` | `score` | `identity_integer`; 0 and non-integers invalid | CANONICAL | same files |
| Residual risk control effectiveness input | `risk_register_controls` v3 | `assurance_score`, `control_effectiveness*`, `control_score`, `effectiveness_score` | `PERCENT_0_100` | `percent` | `RATIO_0_1` | `ratio` | `percent_to_ratio`; missing remains null | CANONICAL | same files |
| MATURITY level | `maturity_assessments` v3 | `level`, `maturity_level`, `numeric_value`, `value_numeric` | `SCORE_0_5` | `level` | `SCORE_0_5` | `level` | `identity`; values outside 0..5 invalid | CANONICAL | same files |
| MATURITY score fallback | `maturity_assessments` v3 | `score`, `total_score` or row `__scale_level_source=PERCENT_0_100` | `PERCENT_0_100` | `percent` | `SCORE_0_5` | `level` | `percent_to_score_0_5`; only when scale is declared | CANONICAL | same files |
| Supplier risk health support | `supplier_tprm_assessments` | supplier risk dimension scores | `SCORE_0_5` | `score` | `PERCENT_0_100` | `percent` | `score_0_5_to_percent`; removed `<=5 ? *20 : value` inference | CANONICAL | same files |

PUI-02 decision: numeric normalization is driven by `scale_metadata` in the source contract. `source_scale`, `source_unit`, source range, canonical range, canonical unit and `normalization_strategy` are explicit for the PUI-02 variables above. Out-of-range values return invalid/excluded/null according to the existing resolver path; they are not clamped and are not converted to zero.

## PUI-03 Count And Population Semantics

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-03-count-population-semantics`.

Canonical count terms:

| Term | Canonical Semantics |
|---|---|
| `received` | Physical rows after tenant/source scoping and row normalization, before contract/dataset eligibility. |
| `eligible` | Rows that pass contract/dataset eligibility validation and belong to the official population before formula-specific input validation. |
| `usable` | Eligible rows with sufficient valid formula inputs. |
| `excluded` | Unique physical rows received but not used by the formula. It is a row count, not an issue count. |
| `ineligible` | Received rows excluded by contract/dataset validation. |
| `eligible_unusable` | Eligible rows excluded by formula-specific input validation. |
| `exclusionIssueCount` | Distinct exclusion issue categories/codes. |
| `exclusionIssueInstanceCount` | Total exclusion issue instances, preserving multiple issues per row for audit. |
| `population_size` | Official eligible population size: the population the formula operates over before formula-specific usability exclusions. |

PUI-03 inventory:

| Metric/Family | Contract | Physical Received | Eligibility Rule | Usable Rule | Excluded Semantics | Issue Count | population_size | Status | Evidence |
|---|---:|---|---|---|---|---|---|---|---|
| Dataset validation / all source contracts | contract-specific source | `rows.length` after tenant/source scope | rows passing tenant, required field, range, scale, state, reference and current period validation | same as eligible at dataset-validation stage | unique invalid rows; `excluded = received - usable` | distinct issue codes; instances also tracked | eligible rows | CANONICAL | `datasetValidation.service.js`; `sourceResolver.test.js` |
| RISK-INHERENT | `risk_register_controls` v3 | normalized resolver rows | `validation.usable_rows.length` | rows with valid probability/likelihood and impact under PUI-02 scale rules | received rows not in formula rows | `risk_axis_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| MATURITY | `maturity_assessments` v3 | normalized resolver rows | `validation.usable_rows.length` | rows with a declared valid maturity level/score after PUI-02 normalization | received rows not in formula rows | `maturity_level_scale_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| Severity index / audit findings | `audit_findings_actions` | normalized resolver rows | `validation.usable_rows.length` | rows with severity low/medium/high/critical | received rows not in formula rows | `severity_missing_or_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| Generic source resolver mappings | formula source contract | normalized resolver rows | `validation.usable_rows.length` | same as eligible unless a formula-specific mapper applies | received rows not used by formula | distinct issue codes; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js` |

PUI-03 decision: `source_snapshot.counts` and resolver `counts` carry the canonical population contract. `source_snapshot.exclusions` carries auditable issue detail; row counts live in `excluded_rows`, `ineligible_rows`, `eligible_unusable_rows` and `counts`. A source with `received > 0` and `usable = 0` is no longer represented as `empty_dataset`; it remains distinguishable as validated-with-warnings/insufficient-data for downstream state handling.
