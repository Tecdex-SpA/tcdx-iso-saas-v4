# DB-N05 Runtime To Baseline Coverage

Gate date: 2026-09-08

Source inventory was built from active runtime files in `backend/`, `ai-engine/`, `frontend/` and startup/runtime scripts, then checked against `database/baseline/production_schema_v1.sql` by `scripts/normalization/db-n05-runtime-schema-contract.test.js`.

## Summary

| metric | value |
| --- | ---: |
| Active runtime checks | 63 |
| Active covered | 63 |
| Active missing | 0 |
| Critical undetermined | 0 |
| Gate | `PASS_STATIC` |
| DB-N05 status impact | `DB_N05_READY_FOR_REVIEW` |

## Matrix

| runtime feature | runtime file | DB object | read/write | active route/service/job? | object exists in baseline? | replacement? | classification | decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth/RBAC tenant scoping | `backend/src/middleware/auth.js` | `users.tenant_id` | read | yes | yes | n/a | COVERED | Keep. |
| DB-N01 canonical control identity | `backend/src/utils/tenantControlIdentity.js` | `tenant_controls.control_id` | read | yes | yes | n/a | COVERED | Keep. |
| Findings runtime | `backend/src/routes/findings.routes.js` | `findings.tenant_control_id` | read/write | yes | yes | n/a | COVERED | Keep. |
| Evidence runtime | `backend/src/routes/evidences.routes.js` | `evidences.tenant_control_id` | read/write | yes | yes | n/a | COVERED | Keep. |
| Action plan runtime | `backend/src/routes/action-plans.routes.js` | `action_plans.tenant_control_id` | read/write | yes | yes | n/a | COVERED | Keep. |
| Health projection | `backend/src/services/math-governance/canonicalHealthProjection.service.js` | `v_latest_health_kpi_snapshots` | read | yes | yes | n/a | COVERED | Keep. |
| Metric source binding lineage | `backend/src/services/indicators/indicatorBootstrap.service.js` | `metric_source_bindings.source_contract_id` | read/write | yes | yes | n/a | COVERED | DB-N05 added compatibility column. |
| Official calculation source lineage | `backend/src/services/math-governance/officialCalculationOrchestrator.service.js` | `calculation_runs.source_contract_id` | read/write | yes | yes | n/a | COVERED | DB-N05 added compatibility column. |
| Official calculation outputs | `backend/src/services/phase5/phase5.service.js` | `calculation_outputs.output_name` | read/write | yes | yes | n/a | COVERED | DB-N05 added compatibility column. |
| Indicator snapshots | `backend/src/services/indicators/indicatorGovernance.service.js` | `metric_snapshots.snapshot_status` | read/write | yes | yes | n/a | COVERED | DB-N05 added compatibility column. |
| Async jobs/readiness | `backend/src/app.js` | `tcdx_async_jobs` | read/write | yes | yes | n/a | COVERED | Keep. |
| GRC workflow runtime | `backend/src/services/grc/grc.service.js` | `grc_workflow_instances` | read/write | yes | yes | n/a | COVERED | Keep. |
| Phase 2 connector scheduler | `backend/src/services/grc/phase2SchedulerRunner.js` | `grc_connector_instances` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Escalation policies | `backend/src/services/grc/grc.service.js` | `grc_escalation_policies` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| GRC/service audit trail | `backend/src/services/grc/grc.service.js` | `audit_event_log` | write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Canonical Observation | `backend/src/services/semantic/semanticLayer.service.js` | `grc_observations` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Canonical Observation relations | `backend/src/services/grc/grcGap.service.js` | `grc_observation_relations` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Canonical Gap model | `backend/src/services/grc/grcGap.service.js` | `grc_gaps` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Gap rules | `backend/src/services/grc/grcGap.service.js` | `grc_gap_rules` | read | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Semantic source contracts | `backend/src/services/semantic/semanticBootstrap.service.js` | `data_source_contract_versions` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Indicator catalog | `backend/src/services/indicators/indicatorGovernance.service.js` | `metric_definitions` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Indicator versioning | `backend/src/services/indicators/indicatorBootstrap.service.js` | `metric_definition_versions` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Indicator measurements | `backend/src/services/indicators/indicatorGovernance.service.js` | `metric_measurements` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Indicator Data Trust | `backend/src/services/indicators/indicatorGovernance.service.js` | `metric_trust_assessments` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Knowledge Base v2 | `backend/src/services/knowledge-base/knowledge.repository.js` | `knowledge_sources` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Knowledge Base v2 | `backend/src/services/knowledge-base/knowledge.repository.js` | `knowledge_items` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Tenant knowledge ingestion | `backend/src/services/knowledge-base/knowledgeIngestion.service.js` | `knowledge_document_ingestions` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Knowledge chunks/retrieval/RAG | `backend/src/services/knowledge-base/knowledgeHybridRetrieval.service.js` | `knowledge_document_chunks` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Knowledge embeddings | `backend/src/services/knowledge-base/knowledgeEmbedding.service.js` | `knowledge_chunk_embeddings` | read/write | yes when pgvector enabled | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Regulatory foundation | `backend/src/services/knowledge-base/regulatoryFoundation.service.js` | `regulatory_authoritative_sources` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Regulation model | `backend/src/services/knowledge-base/regulatoryFoundation.service.js` | `regulations` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Legal obligations | `backend/src/services/knowledge-base/regulatoryFoundation.service.js` | `legal_obligations` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Regulatory packs | `backend/src/services/knowledge-base/regulatoryDiffPacks.service.js` | `regulatory_packs` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Operational learning | `backend/src/services/intelligence/operationalLearning.service.js` | `recommendation_decision_ledger` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Effectiveness feedback | `backend/src/services/intelligence/operationalLearning.service.js` | `recommendation_effectiveness_evaluations` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| Operational memory | `backend/src/services/intelligence/operationalLearning.service.js` | `operational_memory_cases` | read/write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |
| AI governance audit traces | `backend/src/services/intelligence/intelligence.audit-log.js` | `ai_prompt_logs` | write | yes | yes | none | PRESENT_ONLY | Table present; column/constraint parity not established. |

## Gate

```text
ACTIVELY_USED_MISSING = 0
critical UNDETERMINED = 0
bounded static runtime DB object coverage = PASS
```

## Current final local result

`ACTIVE_MISSING=0`, 60 checks, critical_undetermined=0, runtime schema contract PASS. Additional regulatory gate compares 15 full canonical table definitions and their indexes/constraints: REGULATORY_SCHEMA_PARITY PASS. Fresh PostgreSQL 16.15 + pgvector baseline/rerun, function execute allowlist and functional gates PASS. See ACTIVE_MISSING_CLOSEOUT.md and VALIDATION_RESULTS.md. Presence-only entries in the inherited matrix remain bounded inventory, not full application certification.

Versioned reference additions: iso_standard_versions.certifiable, iso_controls.version_code, iso_evidence_expectations.control_code. All three are COVERED by the existing focused runtime contract test; whole-product runtime is not asserted.
