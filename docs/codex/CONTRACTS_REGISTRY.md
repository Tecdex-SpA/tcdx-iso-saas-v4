# CONTRACTS_REGISTRY — TCDX ISO SaaS V4

| Contrato | Estado | Owner | Nota |
|---|---|---|---|
| Source contracts | CURRENT/PUI-09 | CODEX A | PUI cerró ownership, escala/unidad, conteos, temporalidad, status, fallback, Data Trust y matriz oficial. |
| Metric/data semantics | CURRENT/PUI-09 | CODEX A | PRE-UI Data Truth Gate cerrado; 53 fórmulas oficiales cubiertas y validadas en runtime. |
| Count semantics | CURRENT/PUI-03 | CODEX A | PUI-03 cerró received/eligible/usable/excluded/exclusionIssueCount/population_size para source resolver y dataset validation focales. |
| Temporal semantics | CURRENT/PUI-04 | CODEX A | `temporal_semantics` contractual agregado a los 20 source contracts; validación focal/deploy confirmada externamente sobre `7a9df18`. |
| Status semantics | CURRENT/PUI-05 | CODEX A | `status_semantics` contractual agregado a los 20 source contracts; normalización versionada por dominio y unknown visible en Math Governance. |
| Legacy fallback policy | CURRENT/PUI-06 | CODEX A | Política central implementada en resolver; cierre focal/manual/deploy confirmado en handoff PUI-06. |
| Scale/unit semantics | CURRENT/PUI-02 | CODEX A | PUI-02 cerró escala/unidad para CONTROL-EFFECT, RISK-INHERENT, MATURITY y normalización explícita auditada; otros dominios quedan para su paquete específico sólo con evidencia. |
| Data Trust | CURRENT/PUI-07 | CODEX A | Modelo determinístico `data-trust-model-v1` expuesto por resolver, snapshots y cálculo oficial; PUI-08 cierra reproducibilidad integral. |
| Official calculation pipeline | CURRENT/PUI-07-HF1 | CODEX A | `officialCalculationOrchestrator` es la única fuente de verdad para fórmulas oficiales; Package3 queda como compatibilidad sin cálculo/persistencia paralela. |
| Measurement | CURRENT/PUI-09 | CODEX A | Runtime PUI-09 confirmó cálculos oficiales persistidos sin null-to-zero ni fuentes incompatibles calculadas. |
| Snapshot | CURRENT/PUI-09 | CODEX A | Runtime PUI-09 confirmó snapshots para 16/16 calculated runs. |
| Lineage | CURRENT/PUI-09 | CODEX A | Runtime PUI-09 confirmó lineage para cálculos con dataset poblado. |
| Observation contract | CURRENT/6.8-01-HF1 | CODEX A | Modelo canónico en `grc_observations` + `grc_observation_relations`; owner/runtime `semanticLayer.service.js`; fachada GRC sin persistencia paralela. |
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

## 6.8-01-HF1 Canonical GRC Observation Model

Status: DONE_LOCAL on branch `fix/f6-8-01-hf1-observation-architecture-reconciliation`.

| Contract Area | Canonical Decision |
|---|---|
| Entity | `grc_observations` is the transversal GRC Observation system of record; existing `findings`, readiness findings, action plans, risks, controls, evidences, incidents and `grc_metric_observations` remain domain-specific sources/consumers/producers. |
| Canonical owner/runtime | `backend/src/services/semantic/semanticLayer.service.js`. |
| GRC API role | `backend/src/services/grc/grcObservation.service.js` is a facade that validates API/RBAC/source tenant scope and delegates canonical persistence. |
| Tenant scope | Every observation and relation carries `tenant_id`; sources and relation targets are validated by tenant before write. |
| Identity/idempotency | Canonical identity is `source_identity_hash` under `(tenant_id, contract_version_id)` with `is_current`; no GRC runtime dependency on parallel key/hash/code columns. |
| Type/domain | Governed standard sets with `custom` type support for extension; no client-specific enum or tenant-specific branch. |
| Status lifecycle | API `PUT` and transitions create controlled supersession: previous row becomes `is_current=false` with `superseded_by_id`, new row carries `supersedes_observation_id`. |
| Severity/status | Use canonical `status_value` and `severity_value`; no duplicate `status`/`severity` columns in the canonical table. |
| Provenance | Preserve `contract_id`, `contract_version_id`, `source_table`, `source_record_id`, `source_identity_hash`, `source_snapshot_id`, `correlation_id`, `metadata` and `data_lineage_edges`. Manual API observations use the global semantic contract `grc.manual_observations` and `data_snapshots` provenance. |
| Relations | `grc_observation_relations` is the only canonical relation table. HTTP `/links` may keep its API name but persists to canonical relations. |
| RBAC | Permissions `observation.read`, `observation.manage`, `observation.transition`, `observation.link` integrated into the existing GRC permission group. |
| Auditability | Creation, updates, transitions and links emit existing `audit_event_log` entries; no second audit log. |
| Source/formula governance | No Math Governance source contract payload changed; no formula payload changed; `SOURCE_CONTRACTS_VERSIONED=[]`, `FORMULAS_VERSIONED=[]`. |

## PUI-01 Source Ownership Inventory

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-01-source-contract-ownership`.

| Metric/Family | Contract | Canonical Source | Producer | Fields | Tenant Scope | Resolver/Adapter | Fallback | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CONTROL-EFFECT / `F5_5_CONTROL_EFFECTIVENESS` dimensions | `control_assurance_evidence` v3 | Explicit control dimension fields only | `grc_control_assurance` and governed control assurance rows | `design_score`/`design_effectiveness`, `implementation_score`/`implementation_effectiveness`, `operation_score`/`operation_effectiveness`/`operating_effectiveness`, `evidence_score`/`evidence_effectiveness` | `tenant_id` required; adapter filters `a.tenant_id=$1::uuid` | `queryControls` + `mapFormulaInput('F5_5_CONTROL_EFFECTIVENESS')` | Legacy tables may provide rows, but aggregate `score` is not valid for D/I/O/E dimensions | CANONICAL | `backend/src/services/math-governance/sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| Control aggregate effectiveness / composite assurance score | `control_assurance_evidence` v3 | Aggregate assurance score as aggregate only | `grc_control_assurance` or explicit legacy adapter row with `score` | `score` mapped to `effectivenesses`/aggregate use; not to D/I/O/E | `tenant_id` required through resolver and adapter | `queryControls`; `mapFormulaInput('F5_5_COMBINED_EFFECTIVENESS')`; residual risk control effectiveness mapping where present | Explicit first-populated legacy fallback with warning; no semantic expansion | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js` |
| RISK-INHERENT / `F5_5_INHERENT_RISK` | `risk_register_controls` v3 | Latest completed/reviewed ISO risk matrix items, else operational risk rows | `iso_risk_matrix_runs` + `iso_risk_matrix_items`; fallback operational risk tables | `probability`/`likelihood`, `impact`, computed `inherent_risk_score=probability*impact` | `tenant_id` required; primary query filters run and item tenant; fallback uses tenant filter | `queryRisk`; `riskInherentPortfolio`; `mapFormulaInput('F5_5_INHERENT_RISK')` | `grc_quantitative_risk_assessments`, `asset_risks`, `privacy_dpia_risks` are explicit legacy fallbacks | CANONICAL | `sourceContracts.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |
| MATURITY / `F5_5_MATURITY` | `maturity_assessments` v7 | Published/effective maturity evaluations; metric measurements only when bound to maturity | `survey_evaluations`; scoped metric measurement definitions/bindings | `level`/`maturity_level`/`score`/`total_score`; `weight`; `evaluation_status`/`quality_status`/`official_state`; metric fallback restricted by `MATURITY` or `F5_5_MATURITY` binding | `tenant_id` required; every candidate query filters tenant | `queryMaturity`; `maturityPortfolio`; `mapFormulaInput('F5_5_MATURITY')` | `metric_measurements` and `grc_metric_measurements` only with explicit maturity predicate; invalid/non-0..5 levels excluded; producer-known non-final statuses are `status_not_eligible` | CANONICAL | `sourceContracts.service.js`; `statusSemantics.service.js`; `sourceResolver.service.js`; `sourceResolver.test.js` |

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
| MATURITY level | `maturity_assessments` v7 | `level`, `maturity_level`, `numeric_value`, `value_numeric` | `SCORE_0_5` | `level` | `SCORE_0_5` | `level` | `identity`; values outside 0..5 invalid | CANONICAL | same files |
| MATURITY score fallback | `maturity_assessments` v7 | `score`, `total_score` or row `__scale_level_source=PERCENT_0_100` | `PERCENT_0_100` | `percent` | `SCORE_0_5` | `level` | `percent_to_score_0_5`; only when scale is declared | CANONICAL | same files |
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
| MATURITY | `maturity_assessments` v7 | normalized resolver rows | `validation.usable_rows.length` | rows with a declared valid maturity level/score after PUI-02 normalization and eligible maturity status | received rows not in formula rows | `status_not_eligible`, `status_unmapped`, `maturity_level_scale_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| Severity index / audit findings | `audit_findings_actions` v9 | normalized resolver rows | `validation.usable_rows.length` | rows with severity low/medium/high/critical | received rows not in formula rows; severity `info` is known but not weighted | `severity_not_eligible` / `severity_missing_or_invalid` category count; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js`; `sourceResolver.test.js` |
| Generic source resolver mappings | formula source contract | normalized resolver rows | `validation.usable_rows.length` | same as eligible unless a formula-specific mapper applies | received rows not used by formula | distinct issue codes; instances retained | eligible rows | CANONICAL | `sourceResolver.service.js` |

PUI-03 decision: `source_snapshot.counts` and resolver `counts` carry the canonical population contract. `source_snapshot.exclusions` carries auditable issue detail; row counts live in `excluded_rows`, `ineligible_rows`, `eligible_unusable_rows` and `counts`. A source with `received > 0` and `usable = 0` is no longer represented as `empty_dataset`; it remains distinguishable as validated-with-warnings/insufficient-data for downstream state handling.

## PUI-04 Temporal Semantics

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-04-temporal-semantics`. Manual focal/deploy validation later confirmed externally on `main/deploy` commit `7a9df185f06be031757d0d79f25aa59b27a53bbf`.

Canonical temporal terms:

| Term | Canonical Semantics |
|---|---|
| `canonical_time_field` | Contract-declared field used by dataset validation; resolver-normalized rows use `__event_time` when available. |
| `source_time_fields` | Explicit ordered physical/normalized fields allowed to produce canonical time in adapters. No implicit repo-wide `created_at` fallback. |
| `time_meaning` | Domain meaning of the timestamp, e.g. occurrence time, assessment time, state effective time or calculation period end. |
| `period_policy` | Requested period is interpreted as `start_inclusive_end_exclusive`. |
| `as_of_policy` | Records after explicit `as_of` are excluded with `temporal_after_as_of`; no future data is consumed silently. |
| `missing_time_policy` | Missing required temporal data is excluded with `temporal_missing_required_time`; it is not imputed to current time, epoch or `created_at`. |
| `validity_interval` | Contracts with interval semantics use declared `valid_from_fields`/`valid_to_fields` and period overlap, so records created before a period can remain eligible when still valid. |

PUI-04 source contract inventory:

| Source Contract | Version | Class | Canonical temporal field | Time meaning | Existing filter after PUI-04 | Decision | Status |
|---|---:|---|---|---|---|---|---|
| `compliance_requirements_assessments` | v4 | latest_effective_state | `__event_time` / `assessed_at` | compliance mapping assessment state time | tenant scope only before validation | explicit state time; no generic `created_at` period default | CANONICAL |
| `grc_readiness_operational_snapshot` | v4 | state_snapshot | `__event_time` | readiness snapshot as-of time | tenant scope only before validation | snapshot as-of governs period classification | CANONICAL |
| `risk_register_controls` | v5 | latest_effective_state | `__event_time` | risk assessment effective time | latest completed/reviewed run constrained by `as_of`/period end; fallback tenant scope only | latest-effective risk state is explicit | CANONICAL |
| `control_assurance_evidence` | v5 | state_snapshot | `__event_time` | control assurance calculation time | tenant scope only before validation | calculated assurance time is canonical | CANONICAL |
| `audit_findings_actions` | v9 | validity_interval | `__event_time`; interval `opened_at`/`created_at` or snapshot `period_start`/`generated_at` to `closed_at`/`completed_at`/`period_end` | action lifecycle or readiness snapshot finding time | tenant scope; latest update limited by `as_of` when provided; readiness findings join snapshot parent | period eligibility uses lifecycle/snapshot overlap without synthetic timestamps; `grc_readiness_snapshots.source_as_of` is not a physical field | CANONICAL |
| `incident_operational_events` | v3 | event_stream | `__event_time` | incident report/detection time | tenant scope only before validation | event time governs inclusion | CANONICAL |
| `evidence_freshness_records` | v3 | validity_interval | `__event_time`; interval review/submission to `expires_at` | evidence review/submission time | tenant scope only before validation | freshness validity is explicit | CANONICAL |
| `loss_events_operational` | v4 | event_stream | `__event_time` | loss occurrence time | tenant scope/status only before validation | `occurred_at`/`event_date` only; no fallback to `created_at` for future/missing occurrence | CANONICAL |
| `continuity_resilience_tests` | v3 | event_stream | `__event_time` | resilience test completion time | tenant scope/status/completed only before validation | completed test time governs inclusion | CANONICAL |
| `asset_inventory_security` | v3 | latest_effective_state | `__event_time` | asset inventory state time | tenant scope only before validation | inventory state time explicit | CANONICAL |
| `supplier_tprm_assessments` | v3 | state_snapshot | `__event_time` | supplier assessment decision time | tenant scope/status only before validation | approved/submitted assessment time explicit | CANONICAL |
| `survey_response_scoring` | v3 | event_stream | `__event_time` | survey response submission time | tenant scope only before validation | submitted response time explicit | CANONICAL |
| `assurance_test_results` | v3 | event_stream | `__event_time` | assurance test execution time | tenant scope only before validation | executed/tested time explicit | CANONICAL |
| `data_quality_observations` | v3 | event_stream | `__event_time` | data quality assessment time | tenant scope only before validation | assessed time explicit | CANONICAL |
| `data_lineage_observations` | v3 | event_stream | `__event_time` | lineage relation observation time | tenant scope only before validation | `created_at` is allowed only as declared relation observation time | CANONICAL |
| `statistical_metric_measurements` | v3 | event_stream | `__event_time` | metric measurement time | tenant scope only before validation | measured/calculated/period_end fields explicit | CANONICAL |
| `indicator_data_trust_assessments` | v3 | event_stream | `__event_time` | data trust assessment time | tenant scope only before validation | assessed time explicit | CANONICAL |
| `grc_health_components` | v6 | validity_interval | `__event_time`; interval `period_start`/`started_at` to `period_end`/`completed_at` | official calculation period end/completion time | tenant + formula + interval overlap | health components use official calculation interval; `period_start` is nullable and `started_at` is contractual fallback | CANONICAL |
| `maturity_assessments` | v7 | event_stream | `__event_time` | maturity evaluation/measurement time | tenant + maturity binding only before validation | survey evaluations use `confirmed_at`/`created_at`; metric measurements use declared measurement/calculation period fields | CANONICAL |
| `external_fx_rates` | v3 | latest_effective_state | `__event_time` | FX rate effective time | source unavailable | contract metadata explicit; source remains unavailable | CANONICAL |

PUI-04 decision: `official_formula_source_contracts.metadata` persists `temporal_semantics` alongside `scale_metadata` and `count_semantics`. Published source contract immutability is preserved by incrementing all 20 source contract versions because their governed payload now includes temporal metadata and no longer inherits a generic `created_at` period policy. Formula payloads, weights, expressions, units and precision were not changed.

## PUI-05 Status Semantics

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-05-status-normalization`.

Canonical status terms:

| Term | Canonical Semantics |
|---|---|
| `domain` | Explicit GRC domain used to interpret a source status; no universal status dictionary is used across domains. |
| `source_status` | Original source status value after row normalization. It remains visible in `__status_normalization`. |
| `canonical_status` | Domain-specific normalized status used by validation/formula inputs. Unknown values become `unknown`, not `pending`, `compliant`, `active` or `open`. |
| `mapping_version` | Versioned dictionary identifier, e.g. `supplier-status-map-v1`, persisted in `status_semantics` and status summary. |
| `reason` | Auditable reason for mapped, ineligible or unmapped status decisions. |
| `unknown_policy` | `exclude_visible`: unknown/unmapped statuses are preserved, reported as `status_unmapped` and excluded by dataset validation when status semantics applies. |

PUI-05 inventory:

| Domain | Source contract(s) | Source statuses observed/accepted | Current mapping location before PUI-05 | Canonical target | Ambiguity | Decision |
|---|---|---|---|---|---|---|
| compliance | `compliance_requirements_assessments` v5 | conform/compliant/effective/implemented/approved, partial/in_progress, non_conform/non_compliant/ineffective/rejected, not_applicable/na, pending/not_evaluated/draft/deleted/retired | SQL CASE in `queryCompliance`; formulas counted raw status strings | conform, partial, non_conform, not_applicable, pending, retired, unknown | `ELSE pending` hid unmapped states | `compliance-status-map-v1`; SQL unknown stays visible; draft/deleted/retired/rejected ineligible when applicable |
| readiness | `grc_readiness_operational_snapshot` v5 | ready/calculated/partial/draft when status exists | resolver rows had no domain status registry | ready, partial, draft, unknown | status optional but unversioned | `readiness-status-map-v1`; optional missing status is visible but not exclusionary |
| risk | `risk_register_controls` v6 | active/open/assessed/reviewed/completed/accepted/rejected/archived/retired | `queryRisk` filtered rejected/archived rows before validation | active, assessed, reviewed, completed, accepted, rejected, archived, unknown | status ineligibility could disappear from counts | `risk-status-map-v1`; item status exclusion moves to validation; run status selection remains source query semantics |
| control | `control_assurance_evidence` v6 | effective/partially_effective/ineffective/pass/fail/pending/draft/retired | raw assurance status and formula status sets | effective, partially_effective, ineffective, pending, draft, retired, unknown | status interpretation was not versioned | `control-status-map-v1`; optional status mapped when present |
| audit/action | `audit_findings_actions` v9 | open/pending/in_progress/active/closed/completed/resolved/overdue/cancelled/rejected/archived/not_applicable | `queryAuditActions` and `mapFormulaInput`; readiness findings have no operational status | open, in_progress, closed, completed, resolved, overdue, cancelled, rejected, archived, not_applicable, unknown | missing status previously could become open/unknown silently | `audit-status-map-v3`; readiness snapshot findings use `not_applicable`; missing/unknown remains visible elsewhere |
| incident | `incident_operational_events` v4 | open/active/investigating/contained/resolved/closed/cancelled/rejected | raw incident status | open, investigating, contained, resolved, closed, cancelled, rejected, unknown | `closed` could be confused with action closure semantics | `incident-status-map-v1`; same string may map to same canonical label but carries incident-specific reason/version |
| evidence | `evidence_freshness_records` v4 | approved/aprobada/accepted/valid/submitted/pending/pendiente/reviewed/reopened/rejected/expired | adapter defaults and freshness formula status list | approved, submitted, pending, reviewed, reopened, rejected, expired, unknown | Spanish/English approval aliases were formula-local | `evidence-status-map-v1`; approval aliases centralized |
| loss | `loss_events_operational` v5 | confirmed/approved/booked/draft/cancelled/rejected | `queryLossEvents` filtered cancelled/rejected before validation | confirmed, draft, cancelled, rejected, unknown | ineligible loss events were not reconciled as received | `loss-status-map-v1`; status filter removed from adapter; validation records ineligible rows |
| continuity | `continuity_resilience_tests` v4 | pass/passed/passed_with_observations/completed/successful/within_sla/failed/failure/planned/draft/scheduled/cancelled | SQL CASE and status filter | within_sla, failed, planned, draft, scheduled, cancelled, unknown | status filter hid ineligible test rows | `continuity-status-map-v1`; status filter removed while completed-time temporal rule remains PUI-04 |
| asset | `asset_inventory_security` v4 | active/current/retired/archived when status exists | raw row status | active, retired, archived, unknown | optional status unversioned | `asset-status-map-v1` |
| supplier | `supplier_tprm_assessments` v4 | approved/submitted/completed/active/current/qualified/draft/invited/in_progress/rejected/expired | `querySupplier` filtered ineligible statuses before validation | approved, submitted, completed, active, qualified, draft, invited, in_progress, rejected, expired, unknown | ineligible supplier assessments were not counted/explained | `supplier-status-map-v1`; filter removed and validation excludes with reason |
| survey | `survey_response_scoring` v4 | completed/submitted/approved/not_applicable/na/in_progress/draft/rejected | formulas used local completed/not-applicable sets | completed, submitted, approved, not_applicable, in_progress, draft, rejected, unknown | status sets were formula-local | `survey-status-map-v1` |
| assurance | `assurance_test_results` v4 | pass/passed/fail/failed/inconclusive/not_applicable/pending/draft | SQL CASE on result/status/outcome | pass, fail, inconclusive, not_applicable, pending, draft, unknown | result semantics were not persisted as status metadata | `assurance-status-map-v1`; source field `result` remains canonical field |
| data_quality | `data_quality_observations` v4 | valid/assessed/failed when status exists | no central status mapping | valid, assessed, failed, unknown | optional status unversioned | `data_quality-status-map-v1` |
| data_lineage | `data_lineage_observations` v4 | active/current/retired when status exists | no central status mapping | active, retired, unknown | optional status unversioned | `data_lineage-status-map-v1` |
| statistics | `statistical_metric_measurements` v4 | calculated/published/approved/draft/rejected when status exists | metric rows carried local states | calculated, published, approved, draft, rejected, unknown | optional status unversioned | `statistics-status-map-v1` |
| data_trust | `indicator_data_trust_assessments` v4 | assessed/calculated/approved/draft when `trust_status` exists | raw trust status | assessed, calculated, approved, draft, unknown | trust status had no mapping version | `data_trust-status-map-v1`; source field `trust_status` |
| health | `grc_health_components` v6 | calculated/completed/failed/cancelled in `run_status` | source query filtered calculated official runs | calculated, failed, cancelled, unknown | adapter did not project `started_at`/`completed_at` for temporal validation when `period_start` was null | `health-status-map-v1`; source field `run_status`; official run selection remains source query semantics |
| maturity | `maturity_assessments` v7 | evaluated/calculated/published/approved/confirmed/applied/valid/estimated/draft/previewed/rejected/incomplete/inconsistent/unknown and official unmeasured/error states | adapter defaults and producer statuses from `survey_evaluations`/`metric_measurements` | evaluated, calculated, published, draft, incomplete, inconsistent, unmeasured, source_unavailable, unknown | producer-known statuses could become `status_unmapped` | `maturity-status-map-v2`; confirmed/applied/valid/estimated eligible; draft/previewed/incomplete/inconsistent/unmeasured/error states visible but ineligible |
| currency_conversion | `external_fx_rates` v4 | published/active/draft when available | source unavailable | published, draft, unknown | unavailable contract still lacked governed status metadata | `currency_conversion-status-map-v1`; source remains unavailable |

PUI-05 decision: `backend/src/services/math-governance/statusSemantics.service.js` owns versioned domain dictionaries. `sourceContracts.service.js` attaches `status_semantics` to every source contract, `sourceResolver.service.js` normalizes rows before dataset validation, `datasetValidation.service.js` emits `status_summary` and `status_unmapped`/`status_not_eligible` exclusions, and `formulaBootstrap.service.js` persists `status_semantics` in `official_formula_source_contracts.metadata`. Published source contract immutability is preserved by incrementing exactly one version on each contract whose governed payload now includes `status_semantics`; formula payloads, expressions, weights, units and precision were not changed.

## PUI-06 Governed Legacy Fallback

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-06-governed-legacy-fallback`. Manual closure recorded in handoff PUI-06: focal rerun PASS and deploy/post-deploy PASS.

Canonical fallback terms:

| Term | Canonical Semantics |
|---|---|
| `primary_state` | Machine-readable state of the primary source path: `primary_available`, `primary_absent`, `primary_no_rows`, `primary_source_incompatible`, `primary_rows_excluded`, `primary_validation_failed`, `primary_unmeasured`. |
| `fallback_used` | Boolean indicating that a legacy source produced the rows consumed by the resolver. |
| `fallback_reason` | Machine-readable reason for activation; PUI-06 permits only `primary_source_absent` and `primary_no_rows`. |
| `primary_source` | Physical source considered primary for the source contract path. |
| `fallback_source` | Physical legacy source used when fallback is allowed and produces rows. |
| `fallback_summary` | Snapshot/result metadata carrying fallback state, reason, primary/fallback source and warning for observability. |

PUI-06 fallback inventory:

| Source Contract | Primary Source | Legacy/Fallback Source | Current Trigger | Allowed? | Problem | Required Policy |
|---|---|---|---|---|---|---|
| `compliance_requirements_assessments` | `grc_requirement_control_mappings` | `control_soa_assessments`, `tenant_controls` | first populated candidate | YES for primary absent/no rows | previous warning lacked machine-readable state/reason | `ALLOWED_PRIMARY_ABSENT` / `ALLOWED_PRIMARY_NO_ROWS`; no fallback after validation defects |
| `risk_register_controls` | `iso_risk_matrix_items` via latest completed/reviewed run | `grc_quantitative_risk_assessments`, `asset_risks`, `privacy_dpia_risks` | primary ISO source absent/no rows | YES for primary absent/no rows | primary ISO state was lost when entering operational legacy list | preserve `primary_source=iso_risk_matrix_items`, `primary_state`, `fallback_reason` |
| `control_assurance_evidence` | `grc_control_assurance` | `control_soa_assessments`, `control_health_scores`, `tenant_controls` | primary absent/no rows | YES for primary absent/no rows | primary direct-source empty state was not observable | preserve `primary_state` and fallback provenance |
| `audit_findings_actions` | formula-dependent first candidate (`action_plans` or `grc_readiness_findings`) | `findings`, alternate action/readiness tables | first populated candidate | YES for primary absent/no rows | warning-only fallback | machine-readable fallback metadata |
| `evidence_freshness_records` | `evidences` | `grc_evidence_versions` with submission/review joins | primary absent/no rows | YES for primary absent/no rows | fallback source needed structured observability | `fallback_summary` plus existing physical source |
| `maturity_assessments` | `survey_evaluations` | `metric_measurements`, `grc_metric_measurements` with maturity predicates | primary absent/no rows | YES for primary absent/no rows | fallback must not hide invalid maturity rows | only source absence/no rows can trigger fallback; scale invalid remains exclusion |
| Other source contracts | first contract table or direct adapter source | none explicitly authorized | primary absent/no rows | NO | generic table lists are not treated as implicit fallback permission | `NOT_APPLICABLE`; no legacy query if policy not explicit |

PUI-06 decision: fallback policy is centralized in `sourceResolver.service.js` through `LEGACY_FALLBACK_POLICY_BY_SOURCE` and `canUseLegacyFallback`. It is resolver execution policy, not source contract payload, so no source contract version bump is required. Fallback is never activated after `contract_invalid`, `source_incompatible`, `primary_rows_excluded`, `status_unmapped`, temporal exclusions, scale/unit invalidity or formula input exclusions. `source_snapshot` and resolver result expose `fallback_summary`, `fallback_used`, `fallback_reason` and `primary_state`. Formula payloads, weights, expressions, units and precision were not changed.

CONTRACTS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF4 Severity Index Source Ownership Closure

Status: DONE_LOCAL on branch `fix/pui-07-hf4-severity-index-source-closure`; runtime validation pending by design.

Canonical source decision:

| Formula | Canonical source code | Canonical physical source | Allowed fallbacks | Legacy/non-canonical paths |
|---|---|---|---|---|
| `F5_5_SEVERITY_INDEX` | `audit_findings_actions` | `grc_readiness_findings` joined to parent `grc_readiness_snapshots` when present; otherwise governed audit/action physical sources under the same source contract | `NONE` for formula-to-source override; only existing `audit_findings_actions` contract fallback policy may apply for primary absent/no rows | `incident_operational_events` / `grc_incidents` are canonical for incident indicators, not for `F5_5_SEVERITY_INDEX`; request overrides to that source are ignored with warning and cannot displace the Severity Index contract |

Decision:

- `FORMULA_SOURCE_MAP` and formula registry already published `F5_5_SEVERITY_INDEX -> audit_findings_actions`; HF4 did not change source contract payload.
- The runtime inconsistency came from execution-time `source_overrides` / `body.source_code` being accepted before canonical formula-to-source ownership was enforced.
- For `F5_5_SEVERITY_INDEX`, `officialCalculationOrchestrator` and `sourceResolver` now constrain requested non-canonical source codes to the formula's canonical source code and expose `requested_source_code`, `canonical_source_code`, `source_override_ignored` and warning `source_override_ignored_non_canonical:<requested>-><canonical>` in result/snapshot provenance.
- `SOURCE_SCHEMA_INCOMPATIBLE` remains valid for genuinely incompatible canonical physical schema, but `incident_operational_events/grc_incidents` can no longer create a false positive for `F5_5_SEVERITY_INDEX`.

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-08 Official Indicator Matrix

Status: DONE_LOCAL under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-08-official-indicator-matrix-closure`.

Machine-readable artifact:

- `backend/src/services/math-governance/officialIndicatorMatrix.service.js`
- Validation: `backend/src/services/math-governance/officialIndicatorMatrix.test.js`
- Matrix version: `pui-08-official-indicator-matrix-v1`

Canonical decision:

| Area | Contract |
|---|---|
| Formula coverage | `OFFICIAL_FORMULA_COUNT=53`; every row derives from `FORMULAS` and retains formula version/unit. |
| Source ownership | Every formula row uses `FORMULA_SOURCE_MAP` and a published source contract with version/checksum. |
| Physical source coverage | Every row exposes physical sources from the source contract; `F5_5_SEVERITY_INDEX` is explicitly `grc_readiness_findings + grc_readiness_snapshots`. |
| Temporal/status/count semantics | Every row carries the source contract `temporal_semantics`, `status_semantics` and `count_semantics`; no PUI-01..PUI-07 contract is reopened. |
| Empty behavior | Empty/no applicable source remains `not_calculable` with `value=null`; no null/no-data/insufficient-data is converted to zero. |
| Partial behavior | Exclusions and count reconciliation are required; silent fallback is forbidden. |
| Sufficient behavior | Formula output must be deterministic, calculated through formula registry/orchestrator, with snapshot, lineage and Data Trust. |
| Tenant behavior | Two-tenant scenario requires isolated datasets and forbids cross-tenant lineage leaks. |
| Consumers | Consumers are official projections only: orchestrator/source resolver/persistence, analytics catalog, functional indicator catalog, Formula Catalog, dashboard official metrics and reports/exports via persisted official calculations. |
| Dependency graph | Dependencies are explicit for readiness, residual risk and GRC health; cycles are forbidden. |

PUI-08 does not change source contract payload, formula payload, formula expression, weights, units or precision.

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-09 Runtime Phase Closure

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `docs/pui-09-runtime-phase-closure`.

Runtime evidence accepted:

| Evidence | Result |
|---|---|
| Production commit | `2a526d6329f7abae0119a782f99cd64aeed01892` |
| Official formula matrix | `PUI_08_OFFICIAL_INDICATOR_MATRIX_OK`; 53 formulas, 20 source contracts, 9 consumers |
| Formula/source/orchestrator regressions | `PHASE5_5_FORMULA_TESTS_OK`, `PHASE5_5_SOURCE_RESOLVER_TESTS_OK`, `OFFICIAL_CALCULATION_ORCHESTRATOR_TESTS_OK`, `PHASE5_5_PACKAGE5_TESTS_OK`, `indicatorCore tests passed` |
| Source compatibility | 0 calculated runs with `source_unavailable` or `source_incompatible` |
| Snapshot coverage | 16 calculated runs, 16 snapshots, 0 missing snapshots |
| Lineage coverage | 0 empty lineage for populated calculation snapshots |
| Null/zero contract | 0 `not_calculable` outputs persisted as zero; 0 `not_calculable` outputs persisted as `completed` |
| Data Trust | `data-trust-model-v1` present in runtime snapshots/results |
| Severity Index | `F5_5_SEVERITY_INDEX` calculated with `source_code=audit_findings_actions`, physical source `grc_readiness_findings`, `trust_status=trusted`, value `42.5` |
| Multi-tenant | Runtime evidence shows different historical `F5_5_INHERENT_RISK` values across tenants, preserving tenant isolation |

PUI-09 does not change source contract payload, formula payload, formula expression, weights, units or precision.

PUI_PHASE: `CLOSED`

PRE_UI_DATA_TRUTH_GATE: `PASS`

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF5 Severity Index Snapshot Schema Compatibility

Status: DONE_LOCAL on branch `fix/pui-07-hf5-severity-index-schema-compatibility`; runtime validation pending by design.

Schema evidence:

```text
grc_readiness_snapshots:
  generated_at: YES
  period_start: YES
  period_end: YES
  source_as_of: NO
```

Canonical decision:

| Formula | Source contract | Version | Canonical physical source | Temporal fields | Non-canonical path |
|---|---|---:|---|---|---|
| `F5_5_SEVERITY_INDEX` | `audit_findings_actions` | v9 | `grc_readiness_findings` joined to parent `grc_readiness_snapshots` | `period_start`, `period_end`, `generated_at`; no `source_as_of` dependency | `incident_operational_events` / `grc_incidents` remain non-canonical and cannot displace ownership |

Notes:

- The Severity adapter no longer references `s.source_as_of`; this removes the false `SOURCE_SCHEMA_INCOMPATIBLE` caused by a non-existent physical column.
- `audit_findings_actions` v8->v9 removes `source_as_of` from governed `columns`, `temporal_semantics.source_time_fields` and `temporal_semantics.valid_from_fields`.
- Empty canonical readiness findings return empty/not-calculable source evidence, not a fabricated zero severity portfolio.
- Formula expression, weights, units and precision are unchanged.

Source contract versions changed: `audit_findings_actions` v8->v9.

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07 Data Trust

Status: DONE under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `fix/pui-07-data-trust`.

Existing foundation distinguished:

- `indicator_data_trust_assessments` and `F5_C3_DATA_TRUST` remain an operational dataset/formula for persisted trust assessments.
- PUI-07 adds deterministic trust assessment for each Math Governance source resolution; it does not replace or recursively consume the operational `indicator_data_trust_assessments` source contract.

Canonical Data Trust model:

| Contract Element | Decision |
|---|---|
| model version | `data-trust-model-v1` |
| owner | `backend/src/services/math-governance/dataTrust.service.js` |
| states | `TRUSTED`, `TRUSTED_WITH_WARNINGS`, `LOW_CONFIDENCE`, `INSUFFICIENT_DATA`, `UNTRUSTED`, `UNMEASURED` |
| dimensions | `source_validity`, `completeness`, `population_sufficiency`, `field_validity`, `temporal_validity`, `status_validity`, `scale_unit_validity`, `consistency`, `fallback_dependency`, `provenance_completeness` |
| reasons | `source_unavailable`, `source_incompatible`, `source_contract_invalid`, `no_received_rows`, `insufficient_population`, `high_exclusion_ratio`, `validation_warnings`, `fallback_used`, `status_unmapped`, `status_not_eligible`, `temporal_invalid`, `scale_unit_invalid`, `missing_required_fields`, `provenance_incomplete`, `consistency_issues` |
| source of truth | Existing resolver/validation signals from PUI-01..PUI-06; no metric-value based trust and no AI scoring. |

PUI-07 decision: Data Trust is deterministic, versioned and attached to `source_snapshot.data_trust`, resolver `data_trust`, official calculation result context and persisted snapshot metadata. It distinguishes insufficient population from low confidence: insufficient usable population yields `INSUFFICIENT_DATA`; sufficient population with high exclusion ratio yields `LOW_CONFIDENCE`. Fallback legacy yields an explicit warning/reason and can produce `TRUSTED_WITH_WARNINGS`, not automatic `UNTRUSTED`.

Source contracts changed: `NONE`

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF1 Official Calculation Pipeline Consolidation

Status: DONE_LOCAL under `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL` on branch `hotfix/pui-07-hf1-official-pipeline-consolidation`.

Canonical pipeline:

```text
consumer
-> officialCalculationOrchestrator
-> sourceResolver
-> source contracts / validation / Data Trust
-> official result
-> calculation_run + output + explanation + source snapshot
```

Decisions:

- `phase5Package3.service.js` no longer calculates from overview blocks and throws `PACKAGE3_CANONICAL_ORCHESTRATOR_REQUIRED` for direct calculation attempts.
- `phase5.service.js` redirects Package3-compatible overview and single-metric recalculation consumers to `officialCalculationOrchestrator.recalculateOfficialAnalytics`.
- `not_calculable` results are persisted with machine-readable reason, `data_trust`, source context and source snapshot/provenance when the persistence layer is available.
- Legacy `trust_score` and `trust_status` remain only as compatibility projections derived from canonical `data_trust` when present.
- Formula expressions, weights, units, precision, source contract payloads and formula payloads were not changed.

SOURCE_CONTRACTS_VERSIONED: `[]`

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF2 Runtime Source Semantics Reconciliation

Status: READY_FOR_RUNTIME_VALIDATION local on branch `fix/pui-07-hf2-runtime-source-semantics`.

Canonical producer-consumer status reconciliation:

| Domain | Source contract | Producer-known statuses reconciled | Canonical/eligibility decision |
|---|---|---|---|
| risk | `risk_register_controls` v7 | `suggested`, `accepted`, `rejected`, `needs_review`, `archived` | `accepted` remains eligible; `suggested` and `needs_review` are legitimate workflow states but not official accepted/reviewed risk population; rejected/archived remain ineligible. |
| control | `control_assurance_evidence` v7 | `unknown`, `incomplete`, `degraded`, `effective`, `ineffective` | `degraded` maps to `partially_effective` and remains eligible with its score; `incomplete` remains visible/eligible; `unknown` is visible but ineligible. |
| audit/action | `audit_findings_actions` v7 | `abierto`, `en progreso`, `bloqueado`, `completado`, `cancelado` plus English/underscore aliases | open/in-progress/blocked/completed rows remain eligible; `cancelado` is ineligible with `status_not_eligible`; no global status dictionary. |
| incident | `incident_operational_events` v5 | `reported`, `triaged`, `classified`, `active`, `contained`, `recovering`, `resolved`, `post_incident_review`, `closed` | Workflow statuses are mapped in the incident domain and remain eligible for incident severity population when required fields are valid. |
| loss | `loss_events_operational` v6 | `draft`, `under_review`, `confirmed`, `recovered_partial`, `closed`, `cancelled` | confirmed/recovered/closed rows are eligible; draft/under_review/cancelled are visible and ineligible. |
| supplier | `supplier_tprm_assessments` v5 | `draft`, `invited`, `in_progress`, `submitted`, `under_review`, `remediation_required`, `approved`, `rejected`, `expired` | Existing approved/submitted semantics are preserved; under_review/remediation_required remain visible and ineligible. |
| assurance | `assurance_test_results` v5 | `pass`, `pass_with_observations`, `fail`, `not_applicable`, `inconclusive` | `pass_with_observations` is eligible and distinct from `pass`; formula weighting remains unchanged. |
| data_trust | `indicator_data_trust_assessments` v5 | `trusted`, `acceptable`, `attention`, `untrusted`, `unknown` | Operational trust assessment statuses map without `status_unmapped`; formula still requires its eight persisted dimensions. |

Temporal reconciliation:

| Source/Classification | Decision |
|---|---|
| `event_stream` | Canonical event/execution/occurrence timestamps in the future remain invalid for operational calculation (`date_in_future` / `temporal_after_as_of` as applicable). |
| `validity_interval` | `valid_from` in the future remains invalid for current/period overlap; `valid_to` in the future is allowed because it represents lifecycle end/expiry, not a future event occurrence. |
| `audit_findings_actions` | Actions opened before a period and not closed before `period_start` remain eligible for period overlap; actions closing after the period are still valid during the period. |

Drift guard: `backend/src/services/math-governance/statusSemantics.service.js` exports `PRODUCER_STATUS_CONTRACTS`; `sourceResolver.test.js` asserts every producer-known status maps domain-wise and that unknown statuses still produce `status_unmapped`.

Source contract versions changed: `risk_register_controls` v6→v7, `control_assurance_evidence` v6→v7, `audit_findings_actions` v6→v7, `incident_operational_events` v4→v5, `loss_events_operational` v5→v6, `supplier_tprm_assessments` v4→v5, `assurance_test_results` v4→v5, `indicator_data_trust_assessments` v4→v5.

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`

## PUI-07-HF3 Final Data Trust Contract Closure

Status: DONE_LOCAL on branch `fix/pui-07-hf3-final-contract-closure`; runtime validation pending by design.

Residual contract decisions:

| Source / KPI | Root cause | Canonical decision | Version |
|---|---|---|---|
| `audit_findings_actions` / `F5_5_SEVERITY_INDEX` | `grc_readiness_findings` has severity but no operational status or row-local timestamps; temporal context lives in `grc_readiness_snapshots`. | Resolver joins snapshot parent; readiness findings use `status=not_applicable`; HF5 supersedes the earlier `source_as_of` assumption because snapshots physically expose `period_start`/`period_end`/`generated_at` only; severity `info` is known but not weighted. | v9 |
| `maturity_assessments` / `F5_5_MATURITY` | Producer vocabularies from `survey_evaluations` and `metric_measurements` exceeded `maturity-status-map-v1`; survey temporal fields are `confirmed_at`/`created_at`, not generic `evaluated_at`. | `maturity-status-map-v2` maps confirmed/applied/valid/estimated as eligible and known non-final/error states as `status_not_eligible`; survey adapter exposes producer temporal fields. | v7 |
| `grc_health_components` / `F5_5_GRC_HEALTH` | `calculation_runs.period_start` is nullable by schema; adapter queried by `started_at`/`completed_at` but did not project those fields for validation. | Contract columns and adapter projection include `started_at`/`completed_at`; `period_start` absence does not exclude rows when official run timestamps prove the interval. | v6 |

Source contract versions changed: `audit_findings_actions` v7→v8, `maturity_assessments` v6→v7, `grc_health_components` v5→v6.

FORMULAS_VERSIONED: `[]`

UNNECESSARY_VERSION_BUMPS: `0`
