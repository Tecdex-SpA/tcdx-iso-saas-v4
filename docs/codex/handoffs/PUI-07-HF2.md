# HANDOFF PUI-07-HF2

Owner: CODEX A
Account: codex
Status: READY_FOR_RUNTIME_VALIDATION
Branch: fix/pui-07-hf2-runtime-source-semantics
Base SHA: 606d98eebf20cb5308776740672a2d2837e5fc76
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:
- Local implementation reconciles runtime producer vocabularies with Math Governance source contracts/status dictionaries for F5_5 source domains.
- PUI-08 remains blocked until deploy, official recalculation and PostgreSQL runtime verification pass.

Root causes found:
- status contract drift: producer-known statuses were missing from domain dictionaries (`risk.suggested`, `risk.needs_review`, action Spanish statuses, `control.degraded`, `assurance.pass_with_observations`, and related operational states).
- temporal contract drift: `validity_interval.valid_to` was treated as a future event, which incorrectly excluded persistent rows active during the requested period.
- eligibility: legitimate workflow statuses now remain visible and are either eligible or explicitly ineligible by domain semantics.
- resolver/Data Trust: no resolver or Data Trust rules were reopened; they consume updated validation/status/temporal evidence.

Status inventory and decisions:

| Domain | Physical source | Raw status | Producer evidence | Canonical status | Eligible? | Semantic meaning |
|---|---|---|---|---|---|---|
| risk | `iso_risk_matrix_items` | `suggested` | `isoRiskMatrix.service.js`; `20260506_iso_risk_matrix.sql` CHECK/default | `suggested` | NO | Proposed risk item not accepted into official risk population. |
| risk | `iso_risk_matrix_items` | `needs_review` | `isoRiskMatrix.service.js`; `20260506_iso_risk_matrix.sql` CHECK | `needs_review` | NO | Review-required risk item; visible but not official accepted risk population. |
| risk | `iso_risk_matrix_items` | `accepted` | `isoRiskMatrix.service.js`; schema CHECK | `accepted` | YES | Accepted risk item. |
| control | `grc_control_assurance` | `incomplete` | `20260727_phase2_integrated_grc.sql` CHECK | `incomplete` | YES | Control assurance row exists but is incomplete; no false status_unmapped. |
| control | `grc_control_assurance` | `degraded` | phase2/phase3 GRC rules; schema CHECK | `partially_effective` | YES | Degraded but measurable control assurance state. |
| control | `grc_control_assurance` | `unknown` | schema CHECK/default | `unknown` | NO | Visible unknown assurance state. |
| audit/action | `action_plans` | `abierto` | `action-plans.routes.js`; UI status normalizer | `open` | YES | Open action plan. |
| audit/action | `action_plans` | `en progreso` | `action-plans.routes.js`; UI status normalizer | `in_progress` | YES | Action plan in progress. |
| audit/action | `action_plans` | `bloqueado` | `action-plans.routes.js`; UI status normalizer | `blocked` | YES | Blocked action plan, still part of action population. |
| audit/action | `action_plans` | `completado` | `action-plans.routes.js`; UI status normalizer | `completed` | YES | Completed action plan. |
| audit/action | `action_plans` | `cancelado` | `action-plans.routes.js`; UI status normalizer | `cancelled` | NO | Cancelled action plan excluded with `status_not_eligible`. |
| incident | `grc_incidents` | `reported`, `triaged`, `classified`, `active`, `contained`, `recovering`, `resolved`, `post_incident_review`, `closed` | `20260727_phase2_integrated_grc.sql` CHECK | domain-specific incident statuses | YES | Incident lifecycle states used by incident severity population when fields are valid. |
| loss | `loss_events` | `under_review` | `20260729_phase5_data_metrics_bi_reporting.sql` CHECK | `under_review` | NO | Loss event under review, visible but not official loss population. |
| loss | `loss_events` | `confirmed`, `recovered_partial`, `closed` | `20260729_phase5_data_metrics_bi_reporting.sql` CHECK | matching loss status | YES | Official loss event states. |
| supplier | `grc_supplier_assessments` | `under_review`, `remediation_required` | phase2 supplier assessment workflow | matching supplier status | NO | Assessment workflow states before approved/submitted calculation semantics. |
| assurance | `assurance_test_executions` | `pass_with_observations` | `20260729_phase5_data_metrics_bi_reporting.sql`; formula registry weighting | `pass_with_observations` | YES | Passing test with observations, distinct from pure pass. |
| data_trust | `metric_trust_assessments` | `trusted`, `acceptable`, `attention`, `untrusted`, `unknown` | `20260729_phase5_data_metrics_bi_reporting.sql` CHECK | matching trust status | YES | Operational trust assessment source status. |

Temporal semantics reconciled:

| Source | Classification | Canonical timestamp | Period policy | As-of policy |
|---|---|---|---|---|
| `audit_findings_actions` | `validity_interval` | interval `opened_at` to `closed_at`/`completed_at` | lifecycle overlap; open before period and closing after period is in-period | start after `as_of` is excluded; future `valid_to` is allowed as end of lifecycle. |
| `loss_events_operational` | `event_stream` | `occurred_at` / `event_date` | event time in requested period | future occurrence remains invalid. |
| `assurance_test_results` | `event_stream` | `executed_at` / `tested_at` | execution time in requested period | future execution remains invalid. |

F5_5 matrix:

| Formula family | Source(s) | Contract | Domain | Status normalization | Temporal semantics | Snapshot | Data Trust |
|---|---|---|---|---|---|---|---|
| Compliance | compliance requirements/control assurance | `compliance_requirements_assessments` | compliance | unchanged v1 | latest effective state | canonical HF1 snapshot path | canonical HF1/PUI-07 |
| Risk / residual risk / FMEA | ISO risk matrix and risk fallback sources | `risk_register_controls` v7 | risk | v2 covers producer statuses | latest effective state | canonical HF1 snapshot path | canonical HF1/PUI-07 |
| Controls / coverage / assurance score | control assurance/evidence/test results | `control_assurance_evidence` v7, `assurance_test_results` v5 | control/assurance | v2 covers degraded/incomplete/pass_with_observations | state snapshot / event stream | canonical HF1 snapshot path | canonical HF1/PUI-07 |
| Actions / findings | action plans/readiness findings | `audit_findings_actions` v7 | audit/action | v2 covers Spanish workflow statuses | validity interval overlap | canonical HF1 snapshot path | canonical HF1/PUI-07 |
| Incidents/loss | incidents/loss events | `incident_operational_events` v5, `loss_events_operational` v6 | incident/loss | v2 covers schema statuses | event stream | canonical HF1 snapshot path | canonical HF1/PUI-07 |
| Supplier/trust/health | supplier assessments, trust assessments, official outputs | `supplier_tprm_assessments` v5, `indicator_data_trust_assessments` v5, `grc_health_components` | supplier/data_trust/health | v2 for supplier/data_trust | snapshot/event/official interval | canonical HF1 snapshot path | canonical HF1/PUI-07 |

Files changed:
- `backend/src/services/math-governance/statusSemantics.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/handoffs/PUI-07-HF2.md`

Source contracts changed:
- `risk_register_controls` v6 -> v7
- `control_assurance_evidence` v6 -> v7
- `audit_findings_actions` v6 -> v7
- `incident_operational_events` v4 -> v5
- `loss_events_operational` v5 -> v6
- `supplier_tprm_assessments` v4 -> v5
- `assurance_test_results` v4 -> v5
- `indicator_data_trust_assessments` v4 -> v5

Formula changes:
NONE

SOURCE_CONTRACTS_VERSIONED:
- `risk_register_controls`
- `control_assurance_evidence`
- `audit_findings_actions`
- `incident_operational_events`
- `loss_events_operational`
- `supplier_tprm_assessments`
- `assurance_test_results`
- `indicator_data_trust_assessments`

FORMULAS_VERSIONED:
[]

UNNECESSARY_VERSION_BUMPS:
0

Codex validation performed:
- `node -c backend/src/services/math-governance/statusSemantics.service.js`
- `node -c backend/src/services/math-governance/datasetValidation.service.js`
- `node -c backend/src/services/math-governance/sourceContracts.service.js`
- `node -c backend/src/services/math-governance/sourceResolver.test.js`
- `git diff --check`
- `cd backend && node src/services/math-governance/sourceResolver.test.js`

FOCAL_TEST:
PASS (`cd backend && node src/services/math-governance/sourceResolver.test.js` -> `PHASE5_5_SOURCE_RESOLVER_TESTS_OK`)

Runtime:
- NOT_RUN_BY_CODEX. Runtime deploy/recalculation/PostgreSQL inspection must be executed by the operator after push/merge/deploy.

Runtime validation queries:

```sql
-- A. Recent official runs
select cr.id, cr.formula_code, cr.tenant_id, cr.status, cr.completed_at
from calculation_runs cr
where cr.created_at >= now() - interval '24 hours'
  and cr.formula_code like 'F5_5_%'
order by cr.created_at desc;

-- B. Snapshot presence and metadata
select cs.run_id, cs.row_count, cs.metadata
from calculation_snapshots cs
join calculation_runs cr on cr.id = cs.run_id
where cr.created_at >= now() - interval '24 hours'
  and cr.formula_code like 'F5_5_%'
order by cs.created_at desc;

-- C. Data Trust persisted in snapshots
select cr.formula_code,
       cs.metadata #>> '{data_trust,model_version}' as model_version,
       cs.metadata #>> '{data_trust,state}' as trust_state,
       cs.metadata #> '{data_trust,reasons}' as trust_reasons
from calculation_runs cr
join calculation_snapshots cs on cs.run_id = cr.id
where cr.created_at >= now() - interval '24 hours'
  and cr.formula_code like 'F5_5_%'
order by cr.created_at desc;

-- D. Source evidence counts/status
select cr.formula_code,
       cs.metadata #>> '{source_status}' as source_status,
       cs.metadata #>> '{counts,received}' as received,
       cs.metadata #>> '{counts,eligible}' as eligible,
       cs.metadata #>> '{counts,usable}' as usable,
       cs.metadata #>> '{counts,excluded}' as excluded
from calculation_runs cr
join calculation_snapshots cs on cs.run_id = cr.id
where cr.created_at >= now() - interval '24 hours'
  and cr.formula_code like 'F5_5_%'
order by cr.created_at desc;

-- E. Issue codes grouped by physical source
select coalesce(ex.value #>> '{physical_source}', cs.metadata #>> '{physical_source}') as physical_source,
       ex.value #>> '{code}' as issue_code,
       ex.value #>> '{value}' as raw_value,
       count(*) as occurrences
from calculation_runs cr
join calculation_snapshots cs on cs.run_id = cr.id
cross join lateral jsonb_array_elements(coalesce(cs.metadata #> '{exclusions}', '[]'::jsonb)) ex(value)
where cr.created_at >= now() - interval '24 hours'
  and cr.formula_code like 'F5_5_%'
group by 1,2,3
order by occurrences desc;

-- F. Any recent status_unmapped
select cr.formula_code, cr.tenant_id, cs.run_id, ex.value
from calculation_runs cr
join calculation_snapshots cs on cs.run_id = cr.id
cross join lateral jsonb_array_elements(coalesce(cs.metadata #> '{exclusions}', '[]'::jsonb)) ex(value)
where cr.created_at >= now() - interval '24 hours'
  and ex.value #>> '{code}' = 'status_unmapped'
order by cr.created_at desc;
```

Gates:
- PUI_07_HF2_IMPLEMENTATION: PASS
- PRODUCER_STATUS_INVENTORY: PASS
- DOMAIN_STATUS_NORMALIZATION: PASS
- STATUS_CONTRACT_DRIFT: PASS
- TEMPORAL_SEMANTICS: PASS
- TEMPORAL_CONTRACT: PASS
- SOURCE_ELIGIBILITY: PASS
- DATA_TRUST: PASS
- COUNT_INVARIANTS: PASS
- SNAPSHOT_PERSISTENCE: BLOCKED
- SINGLE_SOURCE_OF_TRUTH: PASS
- PACKAGE3_PARITY: PASS
- RBAC: PASS
- TENANT_ISOLATION: PASS
- MULTI_TENANT_ISOLATION: PASS
- NEW_TENANT_ONBOARDING: PASS
- SELLABLE_MULTI_TENANT: PASS
- RUNTIME_RECALCULATION: BLOCKED
- REGRESSION_TESTS: BLOCKED
- PUI_08_READINESS: FAIL

Known failures:
- Runtime recalculation not executed from Codex by design.
- Full regression not executed from Codex by design.

Remaining debt:
- Runtime validation pending. No known local implementation debt inside HF2.

## Do not rediscover

- PUI-01 source ownership remains closed.
- PUI-02 scale/unit remains closed.
- PUI-03 counts/population remains closed.
- PUI-04 temporal semantics remains closed except the HF2 clarification that future `valid_to` is not a future event.
- PUI-05 status normalization remains domain-aware; HF2 adds producer-known v2 mappings for affected domains.
- PUI-06 fallback governance remains closed.
- PUI-07 Data Trust model v1 remains closed.
- PUI-07-HF1 official orchestrator/sourceResolver remains canonical; Package3 is not a parallel truth.
- Legitimate producer-known statuses are covered by `PRODUCER_STATUS_CONTRACTS` and sourceResolver drift assertions.
- Unknown statuses must still produce visible `status_unmapped`.

Do not touch:
- Formula expressions, weights, units, precision.
- UI/AI/RAG/Regulatory.
- Production data/manual SQL fixes.
- PUI-08.

Next exact action:
- Operator pushes/merges/deploys this hotfix, runs official recalculation, then executes the PostgreSQL validation queries above and updates continuity with runtime evidence.

Files next account should inspect first:
- `backend/src/services/math-governance/statusSemantics.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/handoffs/PUI-07-HF2.md`

Files next account should NOT inspect unless evidence/test requires it:
- `frontend/`
- `ai-engine/`
- `backend/src/services/knowledge-base/`
- `backend/src/services/intelligence/`
- infra/Nginx/CORS/ports/SSL config
