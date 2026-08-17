# CONTRACTS_REGISTRY — TCDX ISO SaaS V4

| Contrato | Estado | Owner | Nota |
|---|---|---|---|
| Source contracts | PARTIAL | CODEX A | Existen; PRE-UI fortalece semántica, escala, unidad, temporalidad y elegibilidad. |
| Metric/data semantics | PARTIAL | CODEX A | Debe quedar canónico al cerrar PRE-UI. |
| Count semantics | PARTIAL | CODEX A | received/eligible/usable/excluded/exclusionIssueCount a reconciliar transversalmente. |
| Temporal semantics | PARTIAL | CODEX A | event/state/validity/latest-effective-state. |
| Scale/unit semantics | PARTIAL | CODEX A | Evitar inferencia por magnitud. |
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
