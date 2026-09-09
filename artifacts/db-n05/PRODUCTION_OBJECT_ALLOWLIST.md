# DB-N05 Production Object Allowlist

The allowlist is for a clean fresh production candidate. It is stricter than QA: objects needed only to preserve QA history, demonstration state, temporary cleanup, or preview work are not created by `production_schema_v1.sql`.

## Counts

- REQUIRED / PLATFORM / GLOBAL_REFERENCE relations in baseline: 121 relations observed in current isolated PostgreSQL across public/tcdx_security/ai_core.
- Observed functions including extensions: 193; observed indexes: 263.
- App-owned function execution is explicitly allowlisted: backend has security helpers plus DB-N02 Health helpers; platform has only security helpers; support and `ai_reader` have none.
- Compatibility-required objects retained: 1 table (`controls`) plus KPI/Health compatibility view (`v_latest_health_kpi_snapshots`).
- Latest bounded contract: 63 checks, zero missing entries; runtime parity beyond this static inventory remains pending.
- NOT_ALLOWED_IN_FRESH_PROD patterns: `qa_audit.*`, `*_backup_before_*`, `*_cleanup_backup_*`, pure `*_backup_history`, `*_v2_preview`.

| schema | object | type | classification | reason | fresh baseline decision |
| --- | --- | --- | --- | --- | --- |
| public | tenants | table | REQUIRED | Tenant root. | CREATE |
| public | users | table | REQUIRED | Auth/RBAC tenant users. | CREATE |
| public | app_roles | table | REQUIRED | Canonical RBAC roles. | CREATE |
| public | permissions | table | REQUIRED | Canonical permissions. | CREATE |
| public | role_permissions | table | REQUIRED | Role permission grants. | CREATE |
| public | commercial_plans | table | REQUIRED | Commercial plan authority. | CREATE |
| public | commercial_plan_versions | table | REQUIRED | Published plan versions. | CREATE |
| public | commercial_technical_capabilities | table | REQUIRED | Capability authority including AI_ADDON. | CREATE |
| public | plan_version_capabilities | table | REQUIRED | Plan/capability entitlement. | CREATE |
| public | tenant_subscriptions | table | REQUIRED | Tenant plan activation. | CREATE |
| public | tenant_subscription_addons | table | REQUIRED | AI add-on binary authority. | CREATE |
| public | saas_modules | table | REQUIRED | Runtime module catalog. | CREATE |
| public | tenant_module_settings | table | REQUIRED | Tenant module enablement. | CREATE |
| public | standards | table | GLOBAL_REFERENCE | Standards catalog. | CREATE |
| public | controls_catalog | table | GLOBAL_REFERENCE | Canonical control catalog identity. | CREATE |
| public | controls_catalog_standards | table | GLOBAL_REFERENCE | Standard lineage for catalog controls. | CREATE |
| public | tenant_standards | table | REQUIRED | Tenant standard activation. | CREATE |
| public | tenant_operations | table | REQUIRED | Operational scope for tenant controls. | CREATE |
| public | tenant_controls | table | REQUIRED | DB-N01 canonical operational control identity. | CREATE |
| public | controls | table | COMPATIBILITY_REQUIRED | DB-N04 still found runtime readers. | CREATE TEMPORARILY |
| public | evidences | table | REQUIRED | Evidence workflow. | CREATE |
| public | findings | table | REQUIRED | Findings workflow. | CREATE |
| public | tenant_nonconformities | table | REQUIRED | Nonconformity workflow. | CREATE |
| public | action_plans | table | REQUIRED | Remediation workflow. | CREATE |
| public | assets | table | REQUIRED | Asset linkage. | CREATE |
| public | risks | table | REQUIRED | Risk register. | CREATE |
| public | risk_control_relations | table | REQUIRED | Risk/control relation with composite FK. | CREATE |
| public | audits | table | REQUIRED | Audit planning/execution linkage. | CREATE |
| public | documents | table | REQUIRED | Document metadata. | CREATE |
| public | grc_workflow_definitions | table | REQUIRED | Workflow catalog. | CREATE |
| public | grc_workflow_versions | table | REQUIRED | Versioned workflow definitions. | CREATE |
| public | grc_workflow_instances | table | REQUIRED | Tenant workflow runtime. | CREATE |
| public | tcdx_async_jobs | table | REQUIRED | Backend readiness/job controller. | CREATE |
| public | official_formula_definitions | table | REQUIRED | F5_5 governed math authority. | CREATE |
| public | official_formula_versions | table | REQUIRED | Published formulas. | CREATE |
| public | official_formula_source_contracts | table | REQUIRED | Formula source contracts. | CREATE |
| public | metric_source_bindings | table | REQUIRED | Tenant metric/source binding. | CREATE |
| public | calculation_runs | table | REQUIRED | Governed calculation run. | CREATE |
| public | calculation_inputs | table | REQUIRED | Governed calculation inputs. | CREATE |
| public | calculation_outputs | table | REQUIRED | Governed calculation outputs. | CREATE |
| public | metric_snapshots | table | REQUIRED | Health/KPI publication. | CREATE |
| public | control_health_scores | table | COMPATIBILITY_REQUIRED | Operational/drill-down Health; not executive source of truth. | CREATE |
| public | grc_readiness_snapshots | table | REQUIRED | Readiness snapshot. | CREATE |
| public | grc_readiness_results | table | REQUIRED | Readiness result. | CREATE |
| public | grc_readiness_findings | table | REQUIRED | Readiness finding linkage. | CREATE |
| public | knowledge_documents | table | REQUIRED | AI/knowledge metadata without external service dependency. | CREATE |
| public | ai_query_audit | table | REQUIRED | Tenant-bearing AI audit metadata. | CREATE |
| public | dbn01_control_identity_audit | table | PLATFORM_REQUIRED | DB-N01 audit ledger compatibility. | CREATE |
| public | v_latest_health_kpi_snapshots | view | COMPATIBILITY_REQUIRED | DB-N02/KPI latest snapshot compatibility. | CREATE |
| tcdx_security | dbn04_rls_runtime_readiness | view | PLATFORM_REQUIRED | RLS readiness inspection. | CREATE |
| ai_core | v_tenant_health_context | view | DEFERRED_REMOVAL | Tenant-bearing AI view; no ai_reader SELECT grant while RLS/AI context is deferred. | CREATE WITHOUT AI_READER_GRANT |
| ai_core | v_control_context | view | DEFERRED_REMOVAL | Tenant-bearing AI view; no ai_reader SELECT grant while RLS/AI context is deferred. | CREATE WITHOUT AI_READER_GRANT |
| ai_core | v_finding_context | view | DEFERRED_REMOVAL | Tenant-bearing AI view; no ai_reader SELECT grant while RLS/AI context is deferred. | CREATE WITHOUT AI_READER_GRANT |
| ai_core | v_kpi_context | view | DEFERRED_REMOVAL | Tenant-bearing AI view; no ai_reader SELECT grant while RLS/AI context is deferred. | CREATE WITHOUT AI_READER_GRANT |
| public/tcdx_security | app-owned runtime functions | functions | REQUIRED_WITH_EXPLICIT_EXECUTE_ALLOWLIST | DB-N02 Health helpers and DB-N03/04 tenant context helpers. | CREATE; NO ON ALL FUNCTIONS GRANT |
| public | grc_connector_instances | table | REQUIRED | Phase 2 scheduler active runtime reads/writes connector instances. | PRESENT; VERIFY CONTRACT |
| public | grc_escalation_policies | table | REQUIRED | Market readiness escalation policy UX/runtime active. | PRESENT; VERIFY CONTRACT |
| public | audit_event_log | table | REQUIRED | GRC/services write audit events. | PRESENT; VERIFY CONTRACT |
| public | grc_observations | table | REQUIRED | Canonical Observation SOR active since F6.8. | PRESENT; VERIFY CONTRACT |
| public | grc_observation_relations | table | REQUIRED | Observation/GRC relation authority active. | PRESENT; VERIFY CONTRACT |
| public | grc_gaps | table | REQUIRED | Canonical Gap model active. | PRESENT; VERIFY CONTRACT |
| public | grc_gap_rules | table | REQUIRED | Deterministic Gap rule registry active. | PRESENT; VERIFY CONTRACT |
| public | data_source_contract_versions | table | REQUIRED | Semantic source contract versions active. | PRESENT; VERIFY CONTRACT |
| public | metric_definitions | table | REQUIRED | Indicator governance catalog active. | PRESENT; VERIFY CONTRACT |
| public | metric_definition_versions | table | REQUIRED | Indicator versioning active. | PRESENT; VERIFY CONTRACT |
| public | metric_measurements | table | REQUIRED | Indicator snapshot creation reads measurements. | PRESENT; VERIFY CONTRACT |
| public | metric_trust_assessments | table | REQUIRED | Indicator snapshot creation requires Data Trust. | PRESENT; VERIFY CONTRACT |
| public | knowledge_sources | table | REQUIRED | Knowledge Base v2 active. | PRESENT; VERIFY CONTRACT |
| public | knowledge_items | table | REQUIRED | Knowledge Base v2 active. | PRESENT; VERIFY CONTRACT |
| public | knowledge_document_ingestions | table | REQUIRED | Tenant knowledge ingestion active. | PRESENT; VERIFY CONTRACT |
| public | knowledge_document_chunks | table | REQUIRED | Chunks/retrieval/RAG active. | PRESENT; VERIFY CONTRACT |
| public | knowledge_chunk_embeddings | table | REQUIRED | Embedding table active when pgvector provisioned. | PRESENT; VERIFY CONTRACT |
| public | regulatory_authoritative_sources | table | REQUIRED | Regulatory foundation active. | PRESENT; VERIFY CONTRACT |
| public | regulations | table | REQUIRED | Regulation model active. | PRESENT; VERIFY CONTRACT |
| public | legal_obligations | table | REQUIRED | Legal obligation model active. | PRESENT; VERIFY CONTRACT |
| public | regulatory_packs | table | REQUIRED | Regulatory packs active. | PRESENT; VERIFY CONTRACT |
| public | recommendation_decision_ledger | table | REQUIRED | Operational learning active. | PRESENT; VERIFY CONTRACT |
| public | recommendation_effectiveness_evaluations | table | REQUIRED | Effectiveness feedback active. | PRESENT; VERIFY CONTRACT |
| public | operational_memory_cases | table | REQUIRED | Operational memory active. | PRESENT; VERIFY CONTRACT |
| public | ai_prompt_logs | table | REQUIRED | AI governance/audit trace sink active. | PRESENT; VERIFY CONTRACT |
| qa_audit | * | schema/table | NOT_ALLOWED_IN_FRESH_PROD | QA audit history only. | DO NOT CREATE |
| public | `*_backup_before_*` | table | NOT_ALLOWED_IN_FRESH_PROD | Historical safety backup. | DO NOT CREATE |
| public | `*_cleanup_backup_*` | table | NOT_ALLOWED_IN_FRESH_PROD | Temporary cleanup backup from history. | DO NOT CREATE |
| public | `*_backup_history` | table | NOT_ALLOWED_IN_FRESH_PROD | Historical backup table unless separately retained by policy. | DO NOT CREATE |
| public | `*_v2_preview` | table/view | NOT_ALLOWED_IN_FRESH_PROD | Preview-only object. | DO NOT CREATE |

## Contract verification pending

Expanded inventory is present. Regulatory definitions/constraints/indexes have full F6.11-A/B parity checks; other presence entries remain bounded. Required pgcrypto, pg_trgm and vector extensions loaded successfully. Current fresh inventory, function execute allowlist and functional gates PASS; see VALIDATION_RESULTS.md. Reviewed product reference source gate PASS; FDIS remains transition-only.

## Versioned global ISO references

| Object | Classification | Contract |
| --- | --- | --- |
| iso_standards | GLOBAL_REFERENCE | Raw standard identity |
| iso_standard_versions | GLOBAL_REFERENCE | Publication/certification/version policy |
| iso_controls | GLOBAL_REFERENCE | Unique standard/version/control |
| iso_evidence_expectations | GLOBAL_REFERENCE | Same-version control FK |
