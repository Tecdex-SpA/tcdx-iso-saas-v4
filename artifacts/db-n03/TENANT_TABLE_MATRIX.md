# DB-N03 Tenant Table Matrix

Date: 2026-09-07
Scope scanned: `database/migrations`, `backend`, `ai-engine`, `scripts`
Mode: `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`

This inventory is migration-derived and focused on tables with `tenant_id`,
`company_id`, `organization_id`, `workspace_id`, or equivalent tenant scope.
It does not claim db-v4 runtime state; db-v4 was not queried or modified.

## Counts

| Classification | Count | Decision |
|---|---:|---|
| `TENANT_REQUIRED` | 226 | Tenant-owned operational/runtime rows. Candidate for composite FK hardening and later RLS when runtime context is guaranteed. |
| `TENANT_OPTIONAL_BY_DESIGN` | 33 | Mixed global/tenant catalogs or policy/binding objects where `tenant_id=NULL` is valid. Do not `SET NOT NULL`; use scope-specific constraints/policies. |
| `PLATFORM_SCOPE` | 2 | Platform audit/commercial events with optional tenant context. RLS must use explicit platform model, not tenant-only policy. |
| `LEGACY_AMBIGUOUS` | 1 | Requires separate model decision before constraints/RLS. |
| `GLOBAL_REFERENCE` | not included in 262 tenant-aware count | Tables without tenant column by design, e.g. role/permission/commercial catalog/global KB v2 source rows. |

## Critical Matrix

| schema | table | tenant column | nullable? | PK | FKs | unique constraints | writes | reads | platform/global use | RLS candidate | composite FK candidate | risk | decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| public | tenant_controls | tenant_id | no | id | tenants, controls_catalog via control_id | id, DB-N03 adds `(tenant_id,id)` | controls/admin SaaS/diagnostic/onboarding | controls, findings, evidences, action plans, Health, SoA | tenant operational only | yes, pilot policy staged but disabled | parent key | HIGH | DB-N03 adds `uq_dbn03_tenant_controls_tenant_id_id`; no RLS enable until transaction context rollout. |
| public | findings | tenant_id | no | id | tenant_controls, audits/assets/NC optional | id, DB-N03 adds `(tenant_id,id)` | findings routes, controls quick finding, diagnostic, ISO conversion | dashboards, reports, AI Compliance, audits, GRC | tenant operational only | yes, policy staged but disabled | `(tenant_id,tenant_control_id) -> tenant_controls(tenant_id,id)` | CRITICAL | DB-N03 adds validated composite FK. |
| public | evidences | tenant_id | no | id | tenant_controls, legacy `control_id`, document links | id, DB-N03 adds `(tenant_id,id)` | upload, document integrations, NC evidence | evidence library, reports, AI, GRC workflows | tenant operational only | yes, policy staged but disabled | `(tenant_id,tenant_control_id) -> tenant_controls(tenant_id,id)` | CRITICAL | DB-N03 adds validated composite FK. `control_id` remains catalog/legacy. |
| public | action_plans | tenant_id | no | id | tenant_controls, findings, audits/assets/NC optional | id, DB-N03 adds `(tenant_id,id)` | action plan routes, AI drafts, diagnostics, health, ISO conversion | actions, reports, GRC, AI Compliance | tenant operational only | yes, policy staged but disabled | `(tenant_id,tenant_control_id)`, `(tenant_id,finding_id)` | CRITICAL | DB-N03 adds validated composite FK to controls and findings when columns exist. |
| public | control_health_scores | tenant_id | no | id | tenant_controls | id, DB-N03 adds `(tenant_id,id)` | Health refresh/projection compatibility | Health drill-down, SoA, AI stats | tenant operational drill-down | yes, policy staged but disabled | `(tenant_id,tenant_control_id) -> tenant_controls(tenant_id,id)` | HIGH | DB-N03 hardens ownership without changing DB-N02 Health semantics. |
| public | calculation_runs | tenant_id | no | id | tenants, formula/source/user refs | id, DB-N03 adds `(tenant_id,id)` | official calculation orchestrator | canonical Health projection, analytics | tenant calculation truth | later | parent key for calculation children | HIGH | DB-N03 adds parent key and same-tenant children where present. |
| public | calculation_outputs | tenant_id | no | id | calculation_runs | `(run_id,output_name)` | official calculation orchestrator | canonical Health projection | tenant calculation truth | later | `(tenant_id,run_id) -> calculation_runs(tenant_id,id)` | HIGH | DB-N03 adds validated composite FK where present. |
| public | calculation_inputs | tenant_id | no | id | calculation_runs | `(run_id,variable_name)` | official calculation orchestrator | source/debug/explain | tenant calculation truth | later | `(tenant_id,run_id) -> calculation_runs(tenant_id,id)` | MEDIUM | DB-N03 adds validated composite FK where present. |
| public | metric_snapshots | tenant_id | no | id | metric definitions/measurements/formula versions | `(tenant_id,metric_definition_id,period_key,content_hash)` | indicator governance | dashboard/Health | tenant official snapshot | later | deferred due mixed metric_definition global/tenant model | HIGH | No FK change in DB-N03; preflight and docs only. |
| public | grc_workflow_definitions | tenant_id | no | id | active_version_id, users | `(tenant_id,code)` | GRC bootstrap/manage | workflows | tenant workflow config | later | workflow family candidate | HIGH | Deferred; needs full workflow same-tenant pass in DB-N04. |
| public | grc_workflow_instances | tenant_id | no | id | definitions, versions, states | `(tenant_id,entity_type,entity_id,definition_id)` | GRC workflow runtime | workflow UX, GRC | tenant workflow runtime | later | workflow family candidate | HIGH | Deferred except documented; dynamic entity targets require broader design. |
| public | grc_workflow_history | tenant_id | no | id | instances, transitions, states | none | workflow transitions | workflow audit | tenant workflow runtime | later | workflow family candidate | HIGH | Deferred; same-tenant FK design must cover transition/state/version closure. |
| public | grc_readiness_findings | tenant_id | no | id | snapshots, results | `(tenant_id,snapshot_id,finding_code,source_id)` | readiness generator | source resolver/Severity | tenant readiness | later | snapshot/result composite FKs | MEDIUM | DB-N03 adds validated snapshot/result same-tenant FKs where present. |
| public | assets | tenant_id | nullable in fixture/legacy | id | tenants | id, DB-N03 adds `(tenant_id,id)` only if table exists | assets routes/imports/demo | risks, findings/actions, reports | tenant asset inventory, legacy nullable | later | parent for findings/actions | MEDIUM | DB-N03 adds parent key and optional composite links where columns exist; nullability remains legacy. |
| public | asset_risks | semantic via `assets.tenant_id` | n/a | id | asset_id | unknown | risk matrix/asset risk | risk, reports, source resolver | tenant through asset | no until tenant_id materialized | candidate after tenant_id materialization | HIGH | Deferred; read-only preflight includes asset ownership indirectly through findings/actions only. |
| public | knowledge_documents | tenant_id | yes | id | self | scope/key/version unique with null-normalized tenant | knowledge ingestion/regulatory | KB/RAG/regulatory | GLOBAL/REGULATORY/TENANT | scope-specific later | composite tenant FK only for TENANT rows | HIGH | Defer RLS; existing CHECK permits global/regulatory null. |
| public | knowledge_document_chunks | tenant_id | no | id | knowledge_documents | `(tenant_id,knowledge_document_id,document_version,chunk_ordinal)` | knowledge ingestion | hybrid retrieval/RAG | tenant chunks | later | already partially tenant-indexed; parent mixed scope | MEDIUM | Defer; avoid breaking regulatory/global document scope until reconciled. |
| public | knowledge_chunk_embeddings | tenant_id | no | id | knowledge_documents, knowledge_document_chunks | input checksum unique | embedding service | vector search | tenant embeddings | later | already has composite `(tenant_id,chunk_id)` FK | LOW | No DB-N03 change. |
| public | regulatory_authoritative_sources | tenant_id | yes | id | none | scope unique | regulatory ingestion | regulatory/RAG | global/jurisdiction/tenant private | scope-specific later | no for global/jurisdiction | MEDIUM | Optional tenant by design. |
| public | regulatory_pack_tenant_activations | tenant_id | no | id | regulatory_packs | activation uniqueness | regulatory packs | regulatory applicability | tenant activation | later | pack global/tenant private mixed | MEDIUM | Deferred. |
| public | grc_observations | tenant_id | no | id | contracts/snapshots/users | identity hash current index | semantic layer | gaps/impact/intelligence | tenant canonical observation | later | relation targets polymorphic | HIGH | Defer; must not duplicate Observation contract. |
| public | grc_observation_relations | tenant_id | no | composite natural | observations/polymorphic | `(tenant_id,observation_id,related_entity_type,related_entity_id,relation_type)` | semantic/GRC | impact graph/gaps | tenant canonical relations | later | polymorphic candidate via triggers | HIGH | Deferred; needs per-target trigger or type registry. |
| ai_core | ai output/action tables | tenant_id if present | unknown | varies | varies | varies | AI Engine/backend AI services | AI/RAG/intelligence | tenant AI outputs when present | later | candidate | HIGH | No permission expansion; must use same transaction context design before RLS. |
| qa_audit | audit tables | tenant_id if present | unknown | varies | varies | varies | QA audit only | QA audit only | QA schema retained | no | no | LOW | DB-N03 does not remove `qa_audit`. |

## Nullable Tenant Decisions

| classification | tables | decision |
|---|---|---|
| `VALID_GLOBAL_SCOPE` | `grc_frameworks`, `grc_framework_versions`, `grc_framework_requirements`, `grc_requirement_control_mappings`, `grc_mapping_reviews`, `grc_readiness_rules`, `grc_questionnaire_*`, `data_domains`, `metric_definitions`, `official_formula_*`, `metric_source_bindings`, `metric_calculation_policies`, `metric_definition_versions`, `metric_trust_policies`, `metric_sufficiency_rules`, `knowledge_documents`, `regulatory_authoritative_sources`, `regulatory_ingestions`, `regulations`, `regulatory_packs` | Keep nullable; null is global/catalog/jurisdictional scope. |
| `PLATFORM_SCOPE` | `commercial_events`, `regulatory_governance_audit` | Keep nullable; platform events may not belong to one tenant. |
| `LEGACY` | `assets.tenant_id` as observed in local fixtures, `grc_tenant_configurations` | Do not `SET NOT NULL` in DB-N03; needs runtime schema confirmation and separate migration. |
| `BUG` | none proven from local-only evidence | No change without db-v4 preflight. |
| `MIGRATION_TRANSITION` | DB-N01 legacy control identity columns | Covered by DB-N01 before DB-N03. |

## Tenant Unique Constraint Decisions

| key family | examples | classification | DB-N03 decision |
|---|---|---|---|
| `(tenant_id,id)` parent keys | tenant_controls, findings, evidences, action_plans, audits, assets, tenant_nonconformities, control_health_scores, calculation_runs | `TENANT_UNIQUE_REQUIRED` for composite FKs | Added when table exists. |
| tenant workflow codes | `grc_workflow_definitions(tenant_id,code)` | `TENANT_UNIQUE_REQUIRED` | Already present; no DB-N03 duplicate. |
| metric/global catalog keys | `official_formula_*`, `metric_definitions`, `knowledge_documents(scope,tenant,document_key,version)` | `GLOBAL_UNIQUE_CORRECT` / mixed scope | Deferred; existing scope-aware unique constraints preserved. |
| polymorphic source IDs | `source_id`, `entity_id`, `target_id`, `operation_id + control_id` | `LEGACY_UNCERTAIN` | Deferred; needs per-domain target registry or trigger design. |

## Composite FK Decisions

Added by DB-N03 migration when source tables/columns exist:

- `findings(tenant_id, tenant_control_id) -> tenant_controls(tenant_id, id)`
- `evidences(tenant_id, tenant_control_id) -> tenant_controls(tenant_id, id)`
- `action_plans(tenant_id, tenant_control_id) -> tenant_controls(tenant_id, id)`
- `control_health_scores(tenant_id, tenant_control_id) -> tenant_controls(tenant_id, id)`
- `action_plans(tenant_id, finding_id) -> findings(tenant_id, id)`
- optional same-tenant links for `audits`, `assets`, `tenant_nonconformities`, `grc_readiness_findings` and `calculation_* -> calculation_runs`

Deferred:

- `asset_risks -> assets`: current local schema evidence has tenant through `assets`, not a direct `asset_risks.tenant_id`.
- workflow closure: requires a complete state/version/transition invariant pass.
- polymorphic relations: `entity_type/entity_id`, `source_type/source_id`, `target_type/target_id` need typed triggers or registry.
- mixed global/tenant catalogs: require scope-specific policies, not generic tenant-only FKs.

## RLS Decision

RLS is architecturally prepared but not enabled in DB-N03.

- Context mechanism: `SET LOCAL app.tenant_id = '<uuid>'` or `set_config('app.tenant_id', ..., true)` inside a transaction.
- Platform scope: explicit `app.platform_scope=true` for read/admin views; normal tenant writes require `app.tenant_id`.
- Runtime prerequisite: every pooled backend DB path must run inside a transaction that sets local tenant context before RLS can be enabled.
- DB-N03 creates `tcdx_security.current_tenant_id()`, `platform_scope_enabled()`, `tenant_visible()` and `tenant_write_allowed()`.
- DB-N03 stages policies on `tenant_controls`, `findings`, `evidences`, `action_plans`, `control_health_scores`, but intentionally leaves `relrowsecurity=false` and `relforcerowsecurity=false`.
- `FORCE ROW LEVEL SECURITY` is deferred; owner/runtime role behavior is not yet fully proven.

## Exhaustive Tenant-Aware List

The 262 detected tenant-aware tables are grouped below. Detailed per-table
classification beyond the critical matrix should be revisited in DB-N04 before
global RLS rollout.

### TENANT_REQUIRED

`iso_generated_documents`, `iso_generated_document_sections`, `iso_document_generation_runs`, `iso_document_audit_log`, `iso_express_assessments`, `iso_express_assessment_items`, `iso_express_assessment_gaps`, `iso_express_assessment_answers`, `iso_express_assessment_audit_log`, `iso_operational_suggestions`, `iso_operational_suggestion_audit_log`, `iso_risk_matrix_runs`, `iso_risk_matrix_items`, `iso_risk_matrix_actions`, `iso_risk_matrix_audit_log`, `user_dashboard_preferences`, `iso_recommended_action_conversions`, `iso_recommended_action_workflow_events`, `tenant_integrations`, `tenant_document_sources`, `document_index`, `document_sync_logs`, `document_ai_analysis`, `document_association_suggestions`, `evidence_document_links`, `audit_documentary_sources`, `audit_preparation_packages`, `audit_package_documents`, `audit_evidence_index`, `audit_document_generation_runs`, `audit_uploaded_zip_files`, `tcdx_async_jobs`, `tenant_company_profiles`, `tenant_applicability_profiles`, `tenant_applicable_controls`, `tenant_applicable_kpis`, `tenant_applicable_evidence_requirements`, `tenant_applicability_exclusions`, `tenant_applicability_runs`, `tenant_document_provider_credentials`, `tenant_sync_agents`, `tenant_sync_agent_pairing_codes`, `tenant_document_object_links`, `tenant_evidence_semantic_profiles`, `tenant_evidence_chunks`, `tenant_evidence_applicability_suggestions`, `tenant_process_entity_links`, `tenant_document_index_exclusions`, `operational_risk_simulations`, `operational_risk_recommendations`, `operational_risk_ai_analysis_jobs`, `control_soa_assessments`, `control_soa_change_log`, `grc_workflow_definitions`, `grc_workflow_versions`, `grc_workflow_states`, `grc_workflow_transitions`, `grc_workflow_transition_roles`, `grc_workflow_instances`, `grc_workflow_history`, `grc_workflow_approvals`, `grc_workflow_comments`, `grc_workflow_attachments`, `grc_workflow_automation_rules`, `grc_workflow_automation_runs`, `grc_scheduler_runs`, `grc_escalation_policies`, `grc_escalation_events`, `grc_exports`, `grc_evidence_requests`, `grc_evidence_schedules`, `grc_evidence_requirements`, `grc_evidence_submissions`, `grc_evidence_versions`, `grc_evidence_reviews`, `grc_evidence_links`, `grc_evidence_quality_scores`, `grc_readiness_snapshots`, `grc_readiness_results`, `grc_readiness_findings`, `grc_audit_universe_entities`, `grc_audit_annual_plans`, `grc_audit_plan_items`, `grc_audit_programs`, `grc_audit_team_members`, `grc_audit_conflicts`, `grc_audit_sample_plans`, `grc_audit_sample_items`, `grc_audit_workpapers`, `grc_audit_interviews`, `grc_audit_evidence_links`, `grc_audit_supervisor_reviews`, `grc_audit_reports`, `grc_audit_followups`, `grc_bootstrap_runs`, `grc_phase2_relations`, `grc_domain_events`, `grc_rule_executions`, `grc_operational_alerts`, `grc_metric_observations`, `grc_obligations`, `grc_control_assurance`, `grc_effectiveness_verifications`, `grc_suppliers`, `grc_supplier_history`, `grc_supplier_services`, `grc_supplier_contracts`, `grc_supplier_assessments`, `grc_supplier_answers`, `grc_supplier_assessment_history`, `grc_supplier_portal_invitations`, `grc_supplier_portal_sessions`, `grc_supplier_portal_evidence`, `grc_supplier_exit_checks`, `privacy_processing_activities`, `privacy_processing_versions`, `privacy_processors`, `privacy_dpias`, `privacy_dpia_risks`, `privacy_data_subject_requests`, `privacy_consents`, `privacy_breaches`, `grc_incidents`, `grc_incident_history`, `grc_incident_timeline`, `grc_incident_impacts`, `grc_incident_notifications`, `grc_incident_root_causes`, `grc_incident_postmortems`, `grc_connector_instances`, `grc_connector_runs`, `grc_external_records`, `grc_connector_mappings`, `grc_connector_dead_letters`, `grc_organizational_units`, `grc_operational_services`, `grc_operational_dependencies`, `grc_bia_assessments`, `grc_bia_impacts`, `grc_continuity_plans`, `grc_continuity_tests`, `grc_crisis_activations`, `grc_crisis_log`, `grc_metric_definitions`, `grc_metric_measurements`, `grc_quantitative_risk_assessments`, `grc_phase3_state_history`, `grc_phase3_readiness_impacts`, `grc_phase3_import_batches`, `grc_phase3_import_rows`, `tenant_subscriptions`, `tenant_feature_overrides`, `tenant_usage_limits`, `usage_measurements`, `trials`, `tenant_pack_installations`, `tenant_entitlements`, `data_sources`, `data_elements`, `data_definitions`, `data_owners`, `data_quality_rules`, `data_quality_assessments`, `data_lineage_edges`, `data_snapshots`, `data_comparisons`, `metric_measurements`, `metric_validations`, `metric_snapshots`, `data_trust_scores`, `survey_definitions`, `assessment_campaigns`, `assessment_recipients`, `survey_responses`, `survey_response_items`, `survey_evaluations`, `survey_approvals`, `assurance_test_definitions`, `assurance_test_executions`, `assurance_test_samples`, `assurance_test_results`, `assurance_test_exceptions`, `loss_events`, `loss_recoveries`, `dashboard_definitions`, `dashboard_widgets`, `dashboard_permissions`, `report_definitions`, `report_schedules`, `report_generations`, `report_artifacts`, `report_approvals`, `calculation_runs`, `calculation_inputs`, `calculation_outputs`, `calculation_validations`, `calculation_snapshots`, `calculation_anomalies`, `calculation_comparisons`, `statistical_samples`, `statistical_results`, `grc_analytical_impact_events`, `grc_import_files`, `grc_import_cell_errors`, `grc_import_audit_events`, `data_source_field_mappings`, `grc_observations`, `grc_observation_relations`, `metric_trust_assessments`, `metric_interpretations`, `metric_action_proposals`, `grc_observation_emission_outbox`, `grc_gaps`, `grc_gap_status_history`, `grc_gap_hypotheses`, `knowledge_document_ingestions`, `knowledge_document_chunks`, `knowledge_document_ingestion_audit`, `knowledge_chunk_embeddings`, `regulatory_pack_tenant_activations`, `regulatory_pack_applicability_evaluations`, `recommendation_decision_ledger`, `recommendation_effectiveness_evaluations`, `operational_memory_cases`, `operational_memory_case_links`, `dbn01_control_identity_audit`

### TENANT_OPTIONAL_BY_DESIGN

`grc_readiness_rules`, `grc_frameworks`, `grc_framework_versions`, `grc_framework_requirements`, `grc_requirement_control_mappings`, `grc_mapping_reviews`, `grc_questionnaire_templates`, `grc_questionnaire_versions`, `grc_questionnaire_sections`, `grc_questionnaire_questions`, `data_domains`, `metric_definitions`, `metric_impact_rules`, `report_template_versions`, `official_formula_definitions`, `official_formula_versions`, `official_formula_source_contracts`, `calculation_consumers`, `metric_source_bindings`, `metric_calculation_policies`, `health_score_versions`, `data_trust_score_versions`, `grc_analytical_impact_rules`, `data_source_contracts`, `metric_sufficiency_rules`, `metric_definition_versions`, `metric_trust_policies`, `grc_gap_rules`, `knowledge_documents`, `regulatory_authoritative_sources`, `regulatory_ingestions`, `regulations`, `regulatory_packs`

### PLATFORM_SCOPE

`commercial_events`, `regulatory_governance_audit`

### LEGACY_AMBIGUOUS

`grc_tenant_configurations`
