# GRC Relationship Inventory

Work package: `6.9-01`
Date: 2026-08-18
Owner: CODEX A / `codex`
Status: DONE_LOCAL inventory

## Executive Summary

6.9-01 is an inventory and architectural foundation package. It does not create a graph engine, a traversal runtime, a new edge table or any replacement relation model.

Discovery found 38 graph-relevant relationship families:

| Count | Value |
|---|---:|
| Total relationship families inventoried | 38 |
| Persisted relationship families | 32 |
| Derived relationship families | 6 |
| Canonical relationship families | 8 |
| Domain-specific relationship families | 25 |
| Compatibility / adapter relationship families | 3 |
| Duplicate candidates | 0 |
| Unsafe or unproven tenant scopes | 2 |

Conclusion for `6.9-02`: build Impact Graph 2.0 as a projection/adapter layer over existing authoritative tables. Do not copy all relationships into a second truth table. A minimal edge interface may be implemented in 6.9-02 for traversal, but 6.9-01 found no requirement to persist `grc_graph_edges` or any equivalent table now.

## Canonical Entity Map

| Entity | Canonical owner | Physical storage | Notes |
|---|---|---|---|
| Observation | Semantic Layer | `grc_observations` | System of record for canonical GRC Observations. Append-only except controlled supersession. |
| Observation relation | Semantic Layer | `grc_observation_relations` | Canonical relation table for Observation to related GRC entity, including Observation -> Gap. |
| Observation emission event | GRC emitter | `grc_observation_emission_outbox` | Outbox/result link, not a generic graph edge. |
| Gap | GRC Gap service | `grc_gaps` | Deterministic, tenant-scoped, derived from canonical Observation and published rule. |
| Gap rule | GRC Gap service | `grc_gap_rules` | Published rule versions are immutable. |
| Gap lifecycle | GRC Gap service | `grc_gap_status_history` | Status history for deterministic Gap lifecycle. |
| Gap hypothesis | GRC Gap service | `grc_gap_hypotheses` | AI/non-deterministic hypothesis, separated from Gap truth. |
| Framework / requirement | GRC Phase 1 core | `grc_frameworks`, `grc_framework_versions`, `grc_framework_requirements` | Global or tenant-scoped framework references and interpretations. |
| Requirement-control mapping | GRC Phase 1 core | `grc_requirement_control_mappings`, `grc_mapping_reviews` | Authoritative requirement -> tenant/catalog control mapping. |
| Evidence | Existing GRC/evidence domain | `evidences`, `grc_evidence_*`, `grc_evidence_links` | Evidence links remain domain-specific persisted truth. |
| Audit workspace | GRC Phase 1 core | `grc_audit_*`, `audits` | Audit-specific relationship tables are authoritative for audit workspace. |
| Supplier / TPRM | GRC Phase 2 | `grc_suppliers`, `grc_supplier_*`, `privacy_processors` | Supplier relationships are domain-specific persisted truth. |
| Incident / privacy | GRC Phase 2 | `grc_incidents`, `grc_incident_*`, `privacy_*` | Incident/privacy relations are domain-specific persisted truth. |
| Operational process/service/dependency | GRC Phase 3 | `tenant_processes`, `grc_operational_*`, `tenant_process_entity_links` | Operational dependencies are authoritative for process/service graph input. |
| Metric / source / trust | Math Governance / metrics | `metric_*`, `grc_metric_*`, `data_source_*`, `data_lineage_edges` | Official formula semantics are protected; Impact Graph consumes projections only. |
| Risk matrix | ISO risk domain | `iso_risk_matrix_*` | Risk/control/asset/action suggestions are domain-specific; not the canonical graph. |
| Generic Phase 2 relation | GRC Phase 2/3 services | `grc_phase2_relations` | Controlled polymorphic relation with service-level tenant validation; adapter input, not replacement for specific sources. |

## Relationship Inventory

| # | relationship_name | from_entity | to_entity | physical_storage | columns / FK | cardinality | tenant_scope | source_of_truth | owner_service | persisted_or_derived | temporal_semantics | confidence / lifecycle | consumers | producers | classification | keep/reuse/retire decision | notes |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | framework_versioning | `grc_frameworks` | `grc_framework_versions` | `grc_framework_versions` | `framework_id -> grc_frameworks.id`, unique tenant/framework/version | 1:N | MIXED_SCOPE | Framework registry | `grc.service.js` | persisted | VERSIONED + effective dates | draft/published/superseded/archived | framework APIs, mappings | framework bootstrap/API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Global references use `tenant_id IS NULL`; tenant interpretations remain tenant-scoped. |
| 2 | framework_requirement | `grc_framework_versions` | `grc_framework_requirements` | `grc_framework_requirements` | `version_id -> grc_framework_versions.id`, unique tenant/version/reference | 1:N | MIXED_SCOPE | Framework registry | `grc.service.js` | persisted | VERSIONED via parent | content classification | mappings, source resolver | framework bootstrap/API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Requirements are not graph edges by themselves; they are authoritative nodes and join sources. |
| 3 | requirement_control_mapping | requirement | tenant/catalog control | `grc_requirement_control_mappings` | `requirement_id`, `tenant_control_id`, `catalog_control_id`, unique tenant/requirement/control | N:N | MIXED_SCOPE | Requirement-control mapping | `grc.service.js`, `grcBootstrap.service.js` | persisted | CREATED_AT_ONLY + status | mapping_type, coverage, status | Math Governance, GRC API, graph future | GRC mapping APIs/bootstrap | DOMAIN_SPECIFIC_PERSISTED | REUSE | This is the source of truth for requirement -> control; do not duplicate. |
| 4 | mapping_review | requirement-control mapping | reviewer decision | `grc_mapping_reviews` | `mapping_id -> grc_requirement_control_mappings.id` | 1:N | TENANT_SCOPED_VIA_PARENT | Mapping review history | `grc.service.js` | persisted | CREATED_AT_ONLY | approved/rejected/changes_requested | auditability | mapping review API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Lifecycle evidence for mappings, not graph traversal by default. |
| 5 | evidence_request_requirement | evidence request | control/requirement/framework/audit/risk | `grc_evidence_requirements` | `request_id -> grc_evidence_requests.id`, polymorphic `requirement_type`, `requirement_id`, unique tenant/request/type/id | N:N polymorphic | TENANT_SCOPED_DIRECT | Evidence request scope | `grc.service.js` | persisted | CREATED_AT_ONLY via request | mandatory flag | evidence workspace | evidence request API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Target FK is polymorphic; graph adapter must validate target by type. |
| 6 | evidence_submission | evidence request | evidence | `grc_evidence_submissions` | `request_id -> grc_evidence_requests.id`, `evidence_id -> evidences.id`, unique tenant/request/evidence | N:N through submission | TENANT_SCOPED_DIRECT | Evidence submission | `grc.service.js` | persisted | submitted_at | submitted/review/approved/rejected | evidence workspace | evidence submit API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Ties formal evidence to request lifecycle. |
| 7 | evidence_version_review | evidence submission | evidence version/review | `grc_evidence_versions`, `grc_evidence_reviews` | `submission_id -> grc_evidence_submissions.id` | 1:N | TENANT_SCOPED_VIA_PARENT | Evidence lifecycle | `grc.service.js` | persisted | CREATED_AT_ONLY/submitted_at | review decision, version | evidence auditability | evidence API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Version/review are history, not independent graph edges. |
| 8 | evidence_entity_link | evidence | GRC entity | `grc_evidence_links` | `evidence_id -> evidences.id`, polymorphic `entity_type/entity_id`, unique tenant/evidence/type/id | N:N polymorphic | TENANT_SCOPED_DIRECT | Evidence link | `grc.service.js` + `grcRuntimeAdapters.js` | persisted | CREATED_AT_ONLY | active by row | evidence, source contracts, graph input | `linkEvidence` | DOMAIN_SPECIFIC_PERSISTED | REUSE | Service validates runtime target in tenant before insert. |
| 9 | evidence_document_link | evidence | document | `evidence_document_links` | `evidence_id -> evidences.id`, `document_id -> document_index.id`, unique evidence/document | N:N | TENANT_SCOPED_DIRECT | Evidence-document bridge | document/evidence services | persisted | CREATED_AT_ONLY | relation_type | evidence/document views | document evidence flows | DOMAIN_SPECIFIC_PERSISTED | REUSE | Formal bridge between evidence library and external document index. |
| 10 | document_object_link | document/evidence | GRC object | `tenant_document_object_links` | `source_type/source_id`, polymorphic `target_type/target_id`, unique active tenant/source/target/usage | N:N polymorphic | TENANT_SCOPED_DIRECT | Human-reviewed document object link | evidence/document services | persisted | CURRENT_HISTORICAL via `is_active` | status, evidence_usage, relation_type | document workspace, future graph | reviewed user flow | DOMAIN_SPECIFIC_PERSISTED | REUSE | Reviewed association; not the same as AI suggestion. |
| 11 | document_association_suggestion | document | suggested target | `document_association_suggestions`, `tenant_evidence_applicability_suggestions` | document/source refs, target type/id, status | N:N suggested | UNSAFE_OR_UNPROVEN | AI/manual suggestion queue | intelligence/evidence services | persisted | CREATED_AT_ONLY + review status | pending/approved/rejected | human review | AI/manual suggestion | DOMAIN_SPECIFIC_PERSISTED | ADAPT | AI-suggested relation is not canonical graph truth until accepted into reviewed link tables. |
| 12 | audit_plan_item | audit annual plan | universe entity/audit | `grc_audit_plan_items` | `annual_plan_id`, `universe_entity_id`, optional `audit_id` | N:N via plan item | TENANT_SCOPED_DIRECT | Audit planning | `grc.service.js` | persisted | planned_start/planned_end | planned/scheduled/in_progress/completed | audit workspace | audit planning API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Universe entity may be polymorphic by `entity_type/entity_id`. |
| 13 | audit_workspace_artifacts | audit | program/workpaper/interview/report | `grc_audit_programs`, `grc_audit_workpapers`, `grc_audit_interviews`, `grc_audit_reports` | `audit_id -> audits.id` | 1:N | TENANT_SCOPED_DIRECT | Audit workspace | `grc.service.js` | persisted | CREATED_AT_ONLY/versioned artifacts | artifact statuses | audit workspace | audit API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Artifact relations are audit-domain truth, not generic graph edges. |
| 14 | audit_sample | audit sample plan | sample item | `grc_audit_sample_plans`, `grc_audit_sample_items` | sample plan `audit_id`, item `sample_plan_id` | 1:N | TENANT_SCOPED_DIRECT | Audit sampling | `grc.service.js` | persisted | CREATED_AT_ONLY | result/exception | audit workspace | audit API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Useful evidence of audit coverage. |
| 15 | audit_evidence_link | audit/workpaper | evidence | `grc_audit_evidence_links` | `audit_id`, `evidence_id`, nullable `workpaper_id`, PK tenant/audit/evidence/workpaper | N:N | TENANT_SCOPED_DIRECT | Audit evidence link | `grc.service.js` | persisted | linked_at | active row | audit close readiness, graph future | `linkAuditEvidence` | DOMAIN_SPECIFIC_PERSISTED | REUSE | Source of truth for audit-specific evidence relation. |
| 16 | audit_followup | audit/finding | action plan | `grc_audit_followups` | `audit_id -> audits.id`, `finding_id -> findings.id`, `action_plan_id -> action_plans.id` | N:N through followup | TENANT_SCOPED_DIRECT | Audit follow-up | `grc.service.js` | persisted | due_at/created_at | open/verified/closed etc. | audit close readiness | `createAuditFollowup` | DOMAIN_SPECIFIC_PERSISTED | REUSE | Finding-action relation source for audit follow-up; not equivalent to Gap. |
| 17 | generic_phase2_relation | GRC entity | GRC entity | `grc_phase2_relations` | source/target type/id, relation_type, unique tenant/source/target/type/version | N:N polymorphic | TENANT_SCOPED_DIRECT | Controlled cross-domain relation | `phase2.service.js`, `phase3.service.js` | persisted | VALID_FROM_TO + version | status, confidence, provenance | entity360, phase2/3 APIs | createRelation APIs | COMPATIBILITY_ADAPTER | ADAPT | Broad adapter source for 6.9-02; service validates both endpoints in tenant. |
| 18 | supplier_service_dependency | supplier | process/operation/asset | `grc_supplier_services` | `supplier_id`, optional `process_id`, `operation_id`, `asset_id` | 1:N | TENANT_SCOPED_DIRECT | Supplier service catalog | `phase2.service.js` | persisted | CREATED_AT_ONLY + active | service criticality/dependency_type | supplier 360, graph future | supplier service API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Domain-specific supplier dependency; do not replace with generic edge. |
| 19 | supplier_contract_assessment | supplier | contract/assessment/portal/evidence/exit | `grc_supplier_contracts`, `grc_supplier_assessments`, `grc_supplier_answers`, `grc_supplier_portal_*`, `grc_supplier_exit_checks` | `supplier_id`, `assessment_id`, `question_id`, invitation/session/evidence FKs | 1:N | TENANT_SCOPED_DIRECT | TPRM lifecycle | `phase2.service.js` | persisted | status dates, due/expires/uploaded/reviewed | assessment statuses, evidence status | supplier workspace | supplier/portal APIs | DOMAIN_SPECIFIC_PERSISTED | REUSE | Evidence IDs arrays in answers/checks should be adapter-resolved carefully. |
| 20 | privacy_processor | processing activity | supplier/contract/assessment | `privacy_processors` | `processing_activity_id`, `supplier_id`, `contract_id`, `tprm_assessment_id` | N:N | TENANT_SCOPED_DIRECT | Privacy processor registry | `phase2.service.js` | persisted | VALID_FROM_TO | active/suspended/ended | privacy workspace, graph future | privacy APIs | DOMAIN_SPECIFIC_PERSISTED | REUSE | Strong source for supplier/privacy dependency. |
| 21 | dpia_risk_control | DPIA | risk/control | `privacy_dpia_risks` | `dpia_id -> privacy_dpias.id`, `tenant_control_id -> tenant_controls.id` | 1:N risk, N:1 control | TENANT_SCOPED_DIRECT | Privacy DPIA risk | `phase2.service.js` | persisted | CURRENT by status | open/treated/accepted/closed | privacy/risk source resolver | DPIA API | DOMAIN_SPECIFIC_PERSISTED | REUSE | Risk object is local to DPIA, not global risk graph node unless adapted. |
| 22 | privacy_breach_incident | privacy breach | incident | `privacy_breaches` | `incident_id -> grc_incidents.id` | N:1 | TENANT_SCOPED_DIRECT | Privacy breach registry | `phase2.service.js` | persisted | occurred/detected/closed | breach status | privacy/incident workspace | privacy APIs | DOMAIN_SPECIFIC_PERSISTED | REUSE | Direct bridge between privacy and incident domains. |
| 23 | incident_operational_context | incident | process/operation/asset/supplier | `grc_incidents` | optional `process_id`, `operation_id`, `asset_id`, `supplier_id` | N:1 | TENANT_SCOPED_DIRECT | Incident record | `phase2.service.js` | persisted | reported/detected/contained/recovered/resolved/closed | incident status/severity | incident workspace, source resolver | incident APIs | DOMAIN_SPECIFIC_PERSISTED | REUSE | Incident is not Severity Index canonical source after PUI; still domain relationship source. |
| 24 | incident_lifecycle_relations | incident | history/timeline/impact/notification/root cause/postmortem | `grc_incident_*` | `incident_id`, plus optional obligation/evidence/action arrays | 1:N | MIXED_SCOPE | Incident lifecycle | `phase2.service.js` | persisted | EVENT_DERIVED + status times | lifecycle/status | incident workspace | incident APIs | DOMAIN_SPECIFIC_PERSISTED | REUSE | `grc_incident_postmortems.action_plan_ids` is uuid array, no FK; graph adapter must validate. |
| 25 | process_hierarchy_org | organization/process | child process | `grc_organizational_units`, `tenant_processes` | parent FKs, `organizational_unit_id`, `parent_process_id` | 1:N hierarchy | TENANT_SCOPED_DIRECT | Operational model | `phase3.service.js` | persisted | VALID_FROM_TO on units/process | lifecycle_status/status | entity360, operations | phase3 APIs | DOMAIN_SPECIFIC_PERSISTED | REUSE | Operational hierarchy input for impact traversal. |
| 26 | operational_dependency | organization/process/service | process/service/asset/system/location/supplier/control/requirement | `grc_operational_dependencies` | polymorphic source/target, dependency_type, unique tenant/source/target/type | N:N polymorphic | TENANT_SCOPED_DIRECT | Operational dependency model | `phase3.service.js` | persisted | VALID_FROM_TO | criticality/mandatory/provenance | entity360, graph future | `createDependency` | DOMAIN_SPECIFIC_PERSISTED | REUSE | Primary source for process/service dependency edges. |
| 27 | process_entity_link | process/operation | control/evidence/risk/action | `tenant_process_entity_links` | `process_id`, optional `operation_id`, `target_type/target_id`, active unique index | N:N polymorphic | TENANT_SCOPED_DIRECT | Sprint 3 process entity links | process services | persisted | CURRENT_HISTORICAL via `is_active` | relation_type/source | process workspace, graph future | process link flows | COMPATIBILITY_ADAPTER | ADAPT | Older process link model remains useful; do not merge silently into phase2 relation. |
| 28 | continuity_bia_plan | process/service/BIA | plan/test/crisis/impact | `grc_bia_assessments`, `grc_bia_impacts`, `grc_continuity_plans`, `grc_continuity_tests`, `grc_crisis_*` | process/service/bia/plan/crisis FKs | 1:N | TENANT_SCOPED_DIRECT | Operational resilience | `phase3.service.js` | persisted | VERSIONED, scheduled/completed/activated/closed | status/recovery_status | entity360 | phase3 APIs | DOMAIN_SPECIFIC_PERSISTED | REUSE | Useful for impact but not centrality/traversal implementation yet. |
| 29 | metric_entity | metric definition | target entity | `grc_metric_definitions`, `metric_definitions` | `entity_type`, `entity_id` in GRC metrics; global/tenant definitions in Math Governance | N:1 polymorphic | MIXED_SCOPE | Metric definition registry | `phase3.service.js`, math-governance services | persisted | VALID_FROM_TO/versioned | status | source resolver, entity360 | metric APIs/bootstrap | DOMAIN_SPECIFIC_PERSISTED | REUSE | Separate `grc_metric_definitions` and `metric_definitions` are domain-specific, not canonical Observation. |
| 30 | metric_source_binding | metric definition | source/formula/semantic contract/mapping | `metric_source_bindings`, `metric_definition_versions`, `data_source_field_mappings` | metric/source/formula/contract/mapping FKs | N:N/versioned | MIXED_SCOPE | Math Governance metric source contract | math-governance services | persisted | VERSIONED/effective | published immutable | official calculations, source resolver | Math Governance bootstrap | CANONICAL_PERSISTED | REUSE | Protected Math Governance source truth; 6.9-02 consumes, does not alter. |
| 31 | metric_measurement_snapshot_trust | metric | measurement/snapshot/trust/interpretation/proposal | `metric_measurements`, `metric_snapshots`, `metric_trust_assessments`, `metric_interpretations`, `metric_action_proposals` | metric/snapshot/trust/interpretation FKs | 1:N | TENANT_SCOPED_DIRECT | Official metric runtime | math-governance services | persisted | PERIOD + published snapshots | Data Trust/status/immutability | calculations, dashboard, graph future | official orchestrator | CANONICAL_PERSISTED | REUSE | Action proposals are suggestions, not human decision truth. |
| 32 | metric_observation_domain | metric observation | requirement/entity/source | `grc_metric_observations` | `requirement_id -> grc_framework_requirements.id`, `entity_type/entity_id`, source_type/id | N:1 + polymorphic | TENANT_SCOPED_DIRECT | Phase 2 metric observation domain | Phase 2 services | persisted | observed_at/valid_until | confidence/provenance | source resolver | Phase 2 producers | DOMAIN_SPECIFIC_PERSISTED | KEEP | Domain metric producer; not canonical Observation SOR. |
| 33 | canonical_observation_entity | observation | entity/source | `grc_observations` | `entity_type/entity_id`, `source_table/source_record_id`, source snapshot/version FKs | N:1 polymorphic | TENANT_SCOPED_DIRECT | Semantic Layer | `semanticLayer.service.js` | persisted | observed/period + current/history | quality/freshness/trust/current | GRC facade, Gap, graph future | semantic ingest/manual API | CANONICAL_PERSISTED | REUSE | Observation SOR; no direct writes outside Semantic Layer. |
| 34 | canonical_observation_relation | observation | related entity | `grc_observation_relations` | `observation_id -> grc_observations.id`, related type/id, relation_type, unique tenant/observation/type/id/type | N:N polymorphic | TENANT_SCOPED_DIRECT | Semantic Layer relation model | `semanticLayer.service.js`, `grcGap.service.js` for Observation->Gap | persisted | VALID_FROM_TO | confidence, metadata | lineage, Gap, graph future | Semantic Layer/GRC Gap | CANONICAL_PERSISTED | REUSE | This replaces any old `grc_observation_links`; do not recreate links. |
| 35 | observation_gap | observation | gap | `grc_observation_relations`, `grc_gaps` | relation `related_entity_type='grc_gap'`, `relation_type='supports'`; gap source observation FKs | N:N via relation, N:1 source/latest | TENANT_SCOPED_DIRECT | GRC Gap service + Semantic relation | `grcGap.service.js` | persisted | observed_at -> first/last_seen; relation valid_from | deterministic gap lifecycle | Gap APIs, graph future | Gap evaluation | CANONICAL_PERSISTED | REUSE | Canonical Observation -> Gap link for 6.9 graph input. |
| 36 | gap_lifecycle_hypothesis | gap | rule/history/hypothesis | `grc_gap_rules`, `grc_gap_status_history`, `grc_gap_hypotheses` | rule_id/source observation/history FKs; hypothesis separate key | 1:N history, N:1 rule | TENANT_SCOPED_DIRECT + GLOBAL_TEMPLATE rules | Gap service | `grcGap.service.js` | persisted | VERSIONED rules + lifecycle times | status transitions; hypotheses candidate/accepted/rejected | Gap APIs, graph future | Gap evaluation/manual transition | CANONICAL_PERSISTED | REUSE | Hypotheses are not deterministic Gap truth. |
| 37 | observation_emission_result | outbox event | observation | `grc_observation_emission_outbox` | `observation_id -> grc_observations.id`, unique tenant/idempotency_key | N:1 result | TENANT_SCOPED_DIRECT | Governed Observation emitter | `grcObservationEmitter.service.js` | persisted | observed/period + processed/retry times | pending/ignored/completed/failed/dead_letter | emitter ops, provenance | official orchestrator | CANONICAL_PERSISTED | REUSE_AS_PROVENANCE | Outbox is provenance/control plane, not generic graph edge. |
| 38 | semantic_lineage_edge | source/snapshot/observation | observation/data target | `data_lineage_edges`, `data_snapshots` | polymorphic from/to, unique tenant/from/to/type/correlation | N:N polymorphic | TENANT_SCOPED_DIRECT | Semantic/Data lineage | `semanticLayer.service.js`, Math Governance | persisted | CREATED_AT_ONLY + snapshot period | relation_type/correlation | observation lineage, graph future | semantic ingest/manual/snapshot | CANONICAL_PERSISTED | REUSE | Primary lineage source; not a GRC semantic relationship replacement. |

## Derived Relation Map

| derived relationship | Source query/rule | Owner | Persisted source(s) | Tenant scope | Classification | Decision |
|---|---|---|---|---|---|---|
| latest ISO risk matrix run -> risk items | `v_iso_risk_matrix_latest_runs`, `v_iso_risk_matrix_summary`, joins run/item | ISO risk matrix services | `iso_risk_matrix_runs`, `iso_risk_matrix_items` | TENANT_SCOPED_DIRECT | DOMAIN_SPECIFIC_DERIVED | REUSE as projection |
| ISO risk item -> suggested action | `iso_risk_matrix_actions.risk_item_id` and `suggested_actions` JSON on item | ISO risk matrix | `iso_risk_matrix_items`, `iso_risk_matrix_actions` | TENANT_SCOPED_DIRECT | DOMAIN_SPECIFIC_PERSISTED | REUSE; suggestions are not action_plan truth |
| readiness score sources -> readiness finding | `calculateReadiness` over requirements/controls/evidence/risks/actions/audits/documents/objectives | `grc.service.js` | `grc_readiness_*` plus source tables | TENANT_SCOPED_DIRECT | DOMAIN_SPECIFIC_DERIVED | REUSE as source signal only |
| source resolver official inputs | deterministic adapters in `sourceResolver.service.js` | Math Governance | source contracts + physical tables | TENANT_SCOPED_DIRECT/MIXED | CANONICAL_DERIVED | REUSE; do not alter formulas/source contracts |
| entity360 linked context | `phase3.service.js#getEntity360` joins phase2 relations, dependencies, metrics, risks, plans | GRC Phase 3 | multiple domain tables | TENANT_SCOPED_DIRECT | DOMAIN_SPECIFIC_DERIVED | REUSE as read projection, not source of truth |
| Gap derivation | `Observation + grc_gap_rules -> grc_gaps` | `grcGap.service.js` | `grc_observations`, `grc_gap_rules`, `grc_gaps` | TENANT_SCOPED_DIRECT | CANONICAL_DERIVED | REUSE; persisted Gap remains canonical output |

## Physical Storage Map

| relationship area | tables | FK / columns | unique constraints | tenant mechanism | temporal columns |
|---|---|---|---|---|---|
| Requirements and controls | `grc_frameworks`, `grc_framework_versions`, `grc_framework_requirements`, `grc_requirement_control_mappings`, `grc_mapping_reviews` | framework/version/requirement/mapping FKs | framework code/version/reference; mapping tenant/requirement/control/catalog | direct or global template with `tenant_id IS NULL` | effective dates, created/updated, review created |
| Evidence | `grc_evidence_requests`, `grc_evidence_requirements`, `grc_evidence_submissions`, `grc_evidence_versions`, `grc_evidence_reviews`, `grc_evidence_links`, `evidence_document_links` | request/evidence/submission FKs; polymorphic entity links | tenant/request/evidence; tenant/evidence/entity | direct tenant + service validation | due, valid_until, submitted, created |
| Documents | `document_index`, `document_association_suggestions`, `tenant_document_object_links`, `tenant_evidence_applicability_suggestions` | document/source/target polymorphic | active source/target/usage for reviewed links | direct tenant; some target validation is service-level | indexed/modified/reviewed/created |
| Audit | `grc_audit_*`, `audits`, `findings`, `action_plans` | audit/workpaper/evidence/finding/action FKs | audit code/version and composite PKs | direct tenant | planned, scheduled, linked, due, reviewed |
| Phase 2 generic relations | `grc_phase2_relations` | source/target type/id | tenant/source/target/relation/version | direct tenant with service-level endpoint validation | valid_from/valid_to |
| Suppliers/privacy/incidents | `grc_supplier_*`, `privacy_*`, `grc_incident_*` | supplier/assessment/contract/processing/dpia/incident FKs | supplier code, contract, answers, exit checks, incident number | direct tenant | due/submitted/approved/expires/reported/resolved/closed |
| Operational/process | `tenant_processes`, `grc_operational_*`, `tenant_process_entity_links`, `grc_bia_*`, `grc_continuity_*`, `grc_crisis_*` | process/service/org/BIA/plan FKs and polymorphic dependencies | dependency and active link unique keys | direct tenant | valid_from/valid_to, scheduled/completed/activated |
| Metrics/source contracts | `metric_*`, `grc_metric_*`, `data_source_*` | metric/source/formula/contract/mapping/trust FKs | version/checksum/idempotency unique keys | tenant/global templates | effective, period, published |
| Observation/Gap | `grc_observations`, `grc_observation_relations`, `grc_observation_emission_outbox`, `grc_gaps`, `grc_gap_*` | observation/gap/rule/outbox FKs | current source identity, observation relation, outbox idempotency, gap key | direct tenant | observed/period/valid_from/first_seen/last_seen/status history |
| Lineage | `data_lineage_edges`, `data_snapshots` | polymorphic from/to and snapshot entity | tenant/from/to/type/correlation; unique snapshot source | direct tenant | created_at, period_key |

## Duplicate / Overlap Analysis

| overlap | Analysis | Decision |
|---|---|---|
| `grc_observation_relations` vs old `grc_observation_links` | `grc_observation_links` is deprecated and must not return. Runtime uses `grc_observation_relations`. | KEEP `grc_observation_relations`; DEPRECATE_LATER only historical references. |
| `grc_phase2_relations` vs specific relation tables | Phase 2 generic relations are controlled polymorphic relations. Specific tables such as `grc_evidence_links`, `grc_audit_evidence_links`, `privacy_processors` and `grc_operational_dependencies` remain domain source of truth. | ADAPT generic relation as one graph source; do not replace specific truth. |
| `tenant_process_entity_links` vs `grc_operational_dependencies` | Sprint 3 process-object association and Phase 3 operational dependency have different semantics. | KEEP both; adapter must preserve relation_type/source. |
| `tenant_document_object_links` vs `document_association_suggestions` | Reviewed object links are accepted relations; suggestions are reviewable candidate relations. | KEEP reviewed links; suggestions are not canonical graph truth. |
| `grc_metric_observations` vs `grc_observations` | Metric observations are domain metric producer rows; canonical Observation SOR is Semantic Layer. | KEEP_DOMAIN_SPECIFIC for metric observations; REUSE canonical Observations for graph truth. |
| findings/readiness/nonconformities vs Gap | Findings remain domain models. Gap is deterministic output from Observation + rule. | KEEP domain findings; REUSE `grc_gaps` for deterministic Gap truth. |
| ISO risk matrix suggestions vs action plans/risks | ISO risk matrix emits suggestions and calculated risk rows, not action plan truth. | REUSE as domain-specific input; adapt accepted actions only through action plan/follow-up truth. |

No duplicate relation model was introduced in 6.9-01.

## Impact Graph 2.0 Input Contract

6.9-02 should project existing truth into a traversal interface. The conceptual edge shape is:

```text
tenant_id
from_entity_type
from_entity_id
to_entity_type
to_entity_id
relationship_type
source
source_record_id
confidence
effective_from
effective_to
derivation_rule
is_derived
metadata
```

Implementation guidance for 6.9-02:

- Reuse persisted domain sources as authoritative inputs.
- Use adapters/projections over existing tables before adding persistence.
- Keep `grc_observation_relations` as the canonical Observation relation input.
- Keep `grc_gaps` and `grc_gap_status_history` as Gap truth/lifecycle.
- Keep findings/readiness/nonconformities/action plans as their own domains.
- Separate AI suggestions/hypotheses from deterministic graph edges.
- Preserve tenant scope directly or through a documented parent chain.
- Do not copy source payloads wholesale into graph storage.
- Do not implement centrality, shortest path or recursive traversal before 6.9-02.

## Do Not Rediscover

- F6.8 Observation architecture is closed: `grc_observations` and `grc_observation_relations` are canonical through Semantic Layer.
- F6.8 Governed Observation Emitter is closed: `grc_observation_emission_outbox` is an outbox/control-plane table, not a graph edge table.
- F6.8 Gap architecture is closed: `grc_gaps` is deterministic Gap truth, `grc_gap_hypotheses` is separate from truth.
- `grc_observation_links` must not return.
- `grc_metric_observations` remains domain-specific and must not replace canonical Observation.
- Math Governance formula/source contracts and Data Trust v1 are protected and were not modified by 6.9-01.
- 6.9-01 did not implement Impact Graph traversal or storage; 6.9-02 starts from this inventory.
