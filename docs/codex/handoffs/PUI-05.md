# HANDOFF PUI-05

Owner: CODEX A
Account: codex
Status: DONE
Branch: fix/pui-05-status-normalization
Base SHA: 7a9df185f06be031757d0d79f25aa59b27a53bbf
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:
Canonical, versioned, domain-specific status normalization is implemented for Math Governance source contracts/resolver/validation without changing formulas, weights, units, precision or UI/AI paths.

PUI-04 base verification:
HEAD/base contains `7a9df185f06be031757d0d79f25aa59b27a53bbf`. User-provided external validation confirms PUI-04 focal test `PHASE5_5_SOURCE_RESOLVER_TESTS_OK` and deploy `DEPLOY V4 FINALIZADO OK`; PUI-04 is treated as DONE.

Status ambiguities found:
- `queryCompliance` used `ELSE pending`, hiding unmapped compliance statuses.
- `queryAuditActions` severity fallback used `status || open`, hiding missing status as a valid open action.
- `queryRisk`, `queryLossEvents`, `queryContinuity` and `querySupplier` applied status eligibility in SQL filters before dataset validation, so ineligible rows could disappear from count/exclusion provenance.
- `mapFormulaInput` and adapters had formula-local status sets without a domain mapping version.
- `official_formula_source_contracts.metadata` did not persist status semantics.

Domain mappings audited:
- compliance, readiness, risk, control, audit, incident, evidence, loss, continuity, asset, supplier, survey, assurance, data_quality, data_lineage, statistics, data_trust, health, maturity and currency_conversion.
- Same source string can carry different domain reasons, e.g. `closed` in audit/action vs incident.

Canonical status decisions:
- `backend/src/services/math-governance/statusSemantics.service.js` owns the domain-aware dictionaries.
- Each source contract declares `status_semantics.domain`, `source_field`, `canonical_field`, `mapping_version`, `unknown_policy=exclude_visible` and `required` when status/result is mandatory.
- Known statuses map to canonical statuses with an auditable reason.
- Optional missing status remains visible as `status_not_provided_optional` and does not fabricate a valid status.

Unknown/unmapped policy:
- Unknown/unmapped statuses become `canonical_status='unknown'`, `mapped=false`, `eligible=false`, `reason='status_unmapped'`.
- They are excluded by dataset validation and carried in `status_summary`; they are not converted to `pending`, `compliant`, `active`, `open`, false or zero.

Eligibility integration:
- `sourceResolver.service.js` normalizes statuses before `validateDataset`.
- `datasetValidation.service.js` emits `status_not_eligible` or `status_unmapped` issues and includes status classifications in `status_summary`.

Count reconciliation:
- Status ineligible/unmapped rows remain received rows, then dataset validation excludes them; `excluded`, `ineligible`, `exclusionIssueCount` and `exclusionIssueInstanceCount` remain governed by PUI-03 count semantics.

Temporal semantics preserved:
- PUI-04 `temporal_semantics` and temporal validation remain intact.
- PUI-05 does not infer temporal state from status.

Source contracts changed:
- All 20 source contracts now include governed `status_semantics`.

Version bumps:
- `compliance_requirements_assessments`: v4 -> v5
- `grc_readiness_operational_snapshot`: v4 -> v5
- `risk_register_controls`: v5 -> v6
- `control_assurance_evidence`: v5 -> v6
- `audit_findings_actions`: v5 -> v6
- `incident_operational_events`: v3 -> v4
- `evidence_freshness_records`: v3 -> v4
- `loss_events_operational`: v4 -> v5
- `continuity_resilience_tests`: v3 -> v4
- `asset_inventory_security`: v3 -> v4
- `supplier_tprm_assessments`: v3 -> v4
- `survey_response_scoring`: v3 -> v4
- `assurance_test_results`: v3 -> v4
- `data_quality_observations`: v3 -> v4
- `data_lineage_observations`: v3 -> v4
- `statistical_metric_measurements`: v3 -> v4
- `indicator_data_trust_assessments`: v3 -> v4
- `grc_health_components`: v4 -> v5
- `maturity_assessments`: v5 -> v6
- `external_fx_rates`: v3 -> v4

Formula changes:
NONE

Files changed:
- `backend/src/services/math-governance/statusSemantics.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`
- `backend/src/services/math-governance/formulaBootstrap.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/handoffs/PUI-05.md`

Codex validation performed:
- `node -c` on modified Math Governance JS files.
- `cd backend && node src/services/math-governance/sourceResolver.test.js`
- `git diff --check`
- focused diff review.

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
- STATUS_NORMALIZATION=PASS
- DOMAIN_SPECIFIC_STATUS_MAPPING=PASS
- STATUS_VERSIONING=PASS
- UNKNOWN_STATUS_SILENT_MAPPING=0
- UNKNOWN_STATUS_VISIBLE=PASS
- STATUS_REASON_AUDITABLE=PASS
- STATUS_ELIGIBILITY_CENTRALIZED=PASS
- COUNT_RECONCILIATION_PRESERVED=PASS
- TEMPORAL_SEMANTICS_PRESERVED=PASS
- SOURCE_OWNERSHIP_REOPENED=NO
- SCALE_UNIT_REOPENED=NO
- COUNT_SEMANTICS_REOPENED=NO
- TEMPORAL_SEMANTICS_REOPENED=NO
- FORMULA_EXPRESSION_CHANGED=NO
- FORMULA_WEIGHTS_CHANGED=NO
- FORMULA_UNITS_CHANGED=NO
- FORMULA_PRECISION_CHANGED=NO
- NULL_TO_ZERO_INTRODUCED=NO
- TENANT_SCOPE_PRESERVED=PASS
- SELLABLE_MULTI_TENANT=PASS
- ZERO_HARDCODE=PASS
- PUBLISHED_CONTRACT_IMMUTABILITY=PASS
- PUBLISHED_FORMULA_IMMUTABILITY=PASS
- PRODUCT_CODE_SCOPE=FOCUSED
- CODEX_VALIDATION_MODE=FOCUSED_MINIMAL
- FOCAL_TEST=PASS
- FULL_CI=NOT_RUN_BY_DESIGN
- FULL_REGRESSION=NOT_RUN_BY_DESIGN
- PUSH=NOT_RUN_BY_DESIGN
- MERGE=NOT_RUN_BY_DESIGN
- DEPLOY=NOT_RUN_BY_DESIGN
- MANUAL_VALIDATION_PENDING=YES

Known failures:
None in the single focal test executed.

Remaining debt:
None for PUI-05. Full CI/regression/deploy validation remains manual by design.

## Do not rediscover

- PUI-01 ownership remains closed: CONTROL-EFFECT, RISK-INHERENT, MATURITY and no aggregate score fabrication for D/I/O/E.
- PUI-02 scale/unit remains closed: use `scale_metadata`, no magnitude inference and no silent clamp.
- PUI-03 counts remain closed: received/eligible/usable/excluded/ineligible/eligible_unusable/exclusionIssueCount/exclusionIssueInstanceCount/population_size semantics are preserved.
- PUI-04 temporal semantics remains closed: do not infer temporal state from status and do not use created/updated timestamps as universal event time.
- Source/formula version governance remains closed: changing governed source contract payload requires version bump; formulas did not change in PUI-05.
- PUI-05 status dictionaries live in `statusSemantics.service.js`; do not rebuild a universal status dictionary.
- Unknown/unmapped statuses are visible and excluded via `status_unmapped`; do not map them to pending/compliant/active/open.
- Domain mapping versions are persisted through source contract metadata and source snapshots.

Do not touch:
- Formula expressions, weights, units, precision, official checksum protection, UI, AI, RAG, Regulatory, tenant-specific SQL or demo data.

Next exact action:
User pushes branch / opens PR / runs CI and full regression manually. If accepted, begin PUI-06 in a new session from the updated base.

Files next account should inspect first:
- `docs/codex/handoffs/PUI-05.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `backend/src/services/math-governance/statusSemantics.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`

Files next account should NOT inspect unless evidence/test requires it:
- `frontend/`
- `ai-engine/`
- `backend/src/services/knowledge-base/`
- `backend/src/services/intelligence/`
- `backend/src/services/regulatory/`
