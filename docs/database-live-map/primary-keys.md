# Primary Keys

| Schema | Tabla | PK Name | Columnas |
| --- | --- | --- | --- |
| ai_core | ai_core_migrations | ai_core_migrations_pkey | id |
| ai_core | ai_feedback | ai_feedback_pkey | id |
| ai_core | ai_response_feedback | ai_response_feedback_pkey | id |
| ai_core | ai_response_traces | ai_response_traces_pkey | id |
| ai_core | clause_control_domain_map | clause_control_domain_map_pkey | id |
| ai_core | closure_criteria | closure_criteria_pkey | id |
| ai_core | domain_closure_criteria | domain_closure_criteria_pkey | id |
| ai_core | domain_evidence_expectations | domain_evidence_expectations_pkey | id |
| ai_core | domain_problem_type_map | domain_problem_type_map_pkey | id |
| ai_core | domain_solution_playbooks | domain_solution_playbooks_pkey | id |
| ai_core | domains_catalog | domains_catalog_pkey | id |
| ai_core | evidence_expectations | evidence_expectations_pkey | id |
| ai_core | external_lookup_extra_charges | external_lookup_extra_charges_pkey | id |
| ai_core | external_lookup_logs | external_lookup_logs_pkey | id |
| ai_core | external_lookup_quota_audit | external_lookup_quota_audit_pkey | id |
| ai_core | external_lookup_quotas | external_lookup_quotas_pkey | id |
| ai_core | finding_scenarios | finding_scenarios_pkey | id |
| ai_core | invalid_evidence_patterns | invalid_evidence_patterns_pkey | id |
| ai_core | priority_rules | priority_rules_pkey | id |
| ai_core | problem_types | problem_types_pkey | id |
| ai_core | response_templates | response_templates_pkey | id |
| ai_core | solution_playbooks | solution_playbooks_pkey | id |
| ai_core | standard_domain_map | standard_domain_map_pkey | id |
| ai_core | standard_specific_overrides | standard_specific_overrides_pkey | id |
| ai_core | standards_catalog | standards_catalog_pkey | id |
| ai_core | trusted_external_sources | trusted_external_sources_pkey | id |
| ai_core | view_definition_backups | view_definition_backups_pkey | id |
| public | action_plan_updates | action_plan_updates_pkey | id |
| public | action_plans | action_plans_pkey | id |
| public | action_plans_backup_history | action_plans_backup_history_pkey | backup_id |
| public | admin_audit_log | admin_audit_log_pkey | id |
| public | ai_auditor_runs | ai_auditor_runs_pkey | id |
| public | ai_bootstrap_knowledge_items | ai_bootstrap_knowledge_items_pkey | id |
| public | ai_bootstrap_knowledge_runs | ai_bootstrap_knowledge_runs_pkey | id |
| public | ai_bootstrap_knowledge_sources | ai_bootstrap_knowledge_sources_pkey | id |
| public | ai_bootstrap_knowledge_topics | ai_bootstrap_knowledge_topics_pkey | id |
| public | ai_knowledge_datasets | ai_knowledge_datasets_pkey | id |
| public | ai_knowledge_records | ai_knowledge_records_pkey | id |
| public | ai_knowledge_standards | ai_knowledge_standards_pkey | id |
| public | ai_prompt_logs | ai_prompt_logs_pkey | id |
| public | ai_suggestions | ai_suggestions_pkey | id |
| public | app_roles | app_roles_pkey | role_key |
| public | assessments | assessments_pkey | id |
| public | asset_risks | asset_risks_pkey | id |
| public | asset_standards | asset_standards_pkey | asset_id, standard_code |
| public | assets | assets_pkey | id |
| public | audit_control_reviews | audit_control_reviews_pkey | id |
| public | audit_document_generation_runs | audit_document_generation_runs_pkey | id |
| public | audit_document_templates | audit_document_templates_pkey | id |
| public | audit_documentary_sources | audit_documentary_sources_pkey | id |
| public | audit_event_log | audit_event_log_pkey | id |
| public | audit_evidence_index | audit_evidence_index_pkey | id |
| public | audit_package_documents | audit_package_documents_pkey | id |
| public | audit_preparation_packages | audit_preparation_packages_pkey | id |
| public | audit_uploaded_zip_files | audit_uploaded_zip_files_pkey | id |
| public | audits | audits_pkey | id |
| public | clauses | clauses_pkey | id |
| public | control_health_scores | control_health_scores_pkey | id |
| public | control_health_scores_v2_preview | control_health_scores_v2_preview_pkey | id |
| public | control_soa | control_soa_pkey | tenant_control_id |
| public | controls | controls_pkey | id |
| public | controls_catalog | controls_catalog_pkey | id |
| public | controls_catalog_standards | controls_catalog_standards_pkey | id |
| public | dealer_requests | dealer_requests_pkey | id |
| public | dealer_tenant_access | dealer_tenant_access_pkey | id |
| public | dealer_tenants | dealer_tenants_pkey | id |
| public | document_ai_analysis | document_ai_analysis_pkey | id |
| public | document_association_suggestions | document_association_suggestions_pkey | id |
| public | document_index | document_index_pkey | id |
| public | document_sync_logs | document_sync_logs_pkey | id |
| public | evidence_ai_assessments | evidence_ai_assessments_pkey | id |
| public | evidence_ai_jobs | evidence_ai_jobs_pkey | id |
| public | evidence_document_extracts | evidence_document_extracts_pkey | id |
| public | evidence_document_links | evidence_document_links_pkey | id |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_pkey | id |
| public | evidence_tenant_control_migration_log | evidence_tenant_control_migration_log_pkey | id |
| public | evidences | evidences_pkey | id |
| public | evidences_backup_history | evidences_backup_history_pkey | backup_id |
| public | findings | findings_pkey | id |
| public | iso_ai_guidance | iso_ai_guidance_pkey | id |
| public | iso_audit_questions | iso_audit_questions_pkey | id |
| public | iso_catalog_sync_status | iso_catalog_sync_status_pkey | id |
| public | iso_clause_guides | iso_clause_guides_pkey | id |
| public | iso_clauses | iso_clauses_pkey | id |
| public | iso_control_catalog_links | iso_control_catalog_links_pkey | id |
| public | iso_control_mapping_apply_log | iso_control_mapping_apply_log_pkey | id |
| public | iso_control_mappings | iso_control_mappings_pkey | id |
| public | iso_controls | iso_controls_pkey | id |
| public | iso_document_audit_log | iso_document_audit_log_pkey | id |
| public | iso_document_generation_runs | iso_document_generation_runs_pkey | id |
| public | iso_evidence_expectations | iso_evidence_expectations_pkey | id |
| public | iso_express_assessment_answers | iso_express_assessment_answers_pkey | id |
| public | iso_express_assessment_audit_log | iso_express_assessment_audit_log_pkey | id |
| public | iso_express_assessment_gaps | iso_express_assessment_gaps_pkey | id |
| public | iso_express_assessment_items | iso_express_assessment_items_pkey | id |
| public | iso_express_assessments | iso_express_assessments_pkey | id |
| public | iso_gap_rules | iso_gap_rules_pkey | id |
| public | iso_generated_document_sections | iso_generated_document_sections_pkey | id |
| public | iso_generated_documents | iso_generated_documents_pkey | id |
| public | iso_maturity_rules | iso_maturity_rules_pkey | id |
| public | iso_operational_suggestion_audit_log | iso_operational_suggestion_audit_log_pkey | id |
| public | iso_operational_suggestions | iso_operational_suggestions_pkey | id |
| public | iso_policy_templates | iso_policy_templates_pkey | id |
| public | iso_procedure_templates | iso_procedure_templates_pkey | id |
| public | iso_recommended_action_conversions | iso_recommended_action_conversions_pkey | id |
| public | iso_recommended_action_workflow_events | iso_recommended_action_workflow_events_pkey | id |
| public | iso_risk_matrix_actions | iso_risk_matrix_actions_pkey | id |
| public | iso_risk_matrix_audit_log | iso_risk_matrix_audit_log_pkey | id |
| public | iso_risk_matrix_items | iso_risk_matrix_items_pkey | id |
| public | iso_risk_matrix_runs | iso_risk_matrix_runs_pkey | id |
| public | iso_risk_templates | iso_risk_templates_pkey | id |
| public | iso_standard_versions | iso_standard_versions_pkey | id |
| public | iso_standards | iso_standards_pkey | id |
| public | iso_transition_guidance | iso_transition_guidance_pkey | id |
| public | kpi_calculation_jobs | kpi_calculation_jobs_pkey | id |
| public | kpi_calculation_rules | kpi_calculation_rules_pkey | id |
| public | kpi_custom_inputs | kpi_custom_inputs_pkey | id |
| public | kpi_data_sources | kpi_data_sources_pkey | id |
| public | kpi_definitions | kpi_definitions_pkey | id |
| public | kpi_dimensions_catalog | kpi_dimensions_catalog_pkey | id |
| public | kpi_event_queue | kpi_event_queue_pkey | id |
| public | kpi_manual_values | kpi_manual_values_pkey | id |
| public | kpi_snapshot_dimensions | kpi_snapshot_dimensions_pkey | id |
| public | kpi_snapshots | kpi_snapshots_pkey | id |
| public | kpi_staging_import | kpi_staging_import_pkey | id |
| public | kpi_standard_mappings | kpi_standard_mappings_pkey | id |
| public | kpi_thresholds | kpi_thresholds_pkey | id |
| public | lifecycle_stage_catalog | lifecycle_stage_catalog_pkey | stage_code |
| public | management_objectives | management_objectives_pkey | id |
| public | nonconformities_catalog | nonconformities_catalog_pkey | id |
| public | notifications | notifications_pkey | id |
| public | permissions | permissions_pkey | permission_key |
| public | report_access_rules | report_access_rules_pkey | id |
| public | report_exports | report_exports_pkey | id |
| public | report_schedules | report_schedules_pkey | id |
| public | report_types | report_types_pkey | id |
| public | responses | responses_pkey | id |
| public | role_permissions | role_permissions_pkey | role_key, permission_key |
| public | roles | roles_pkey | id |
| public | saas_modules | saas_modules_pkey | module_key |
| public | saas_monthly_prebilling | saas_monthly_prebilling_pkey | id |
| public | saas_monthly_prebilling_lines | saas_monthly_prebilling_lines_pkey | id |
| public | saas_price_catalog | saas_price_catalog_pkey | id |
| public | saas_quote_lines | saas_quote_lines_pkey | id |
| public | saas_quotes | saas_quotes_pkey | id |
| public | search_history | search_history_pkey | id |
| public | standard_lifecycle_ai_feed | standard_lifecycle_ai_feed_pkey | id |
| public | standard_lifecycle_snapshots | standard_lifecycle_snapshots_pkey | id |
| public | standard_lifecycle_stage_requests | standard_lifecycle_stage_requests_pkey | id |
| public | standard_lifecycle_status | standard_lifecycle_status_pkey | id |
| public | standards | standards_pkey | id |
| public | tcdx_async_jobs | tcdx_async_jobs_pkey | id |
| public | tenant_applicability_exclusions | tenant_applicability_exclusions_pkey | id |
| public | tenant_applicability_profiles | tenant_applicability_profiles_pkey | id |
| public | tenant_applicability_runs | tenant_applicability_runs_pkey | id |
| public | tenant_applicable_controls | tenant_applicable_controls_pkey | id |
| public | tenant_applicable_evidence_requirements | tenant_applicable_evidence_requirements_pkey | id |
| public | tenant_applicable_kpis | tenant_applicable_kpis_pkey | id |
| public | tenant_billing_settings | tenant_billing_settings_pkey | id |
| public | tenant_company_profiles | tenant_company_profiles_pkey | id |
| public | tenant_contracts | tenant_contracts_pkey | id |
| public | tenant_controls | tenant_controls_pkey | id |
| public | tenant_document_provider_credentials | tenant_document_provider_credentials_pkey | id |
| public | tenant_document_sources | tenant_document_sources_pkey | id |
| public | tenant_integrations | tenant_integrations_pkey | id |
| public | tenant_kpi_settings | tenant_kpi_settings_pkey | id |
| public | tenant_module_settings | tenant_module_settings_pkey | id |
| public | tenant_monthly_preinvoices | tenant_monthly_preinvoices_pkey | id |
| public | tenant_nonconformities | tenant_nonconformities_pkey | id |
| public | tenant_operations | tenant_operations_pkey | id |
| public | tenant_standard_audit | tenant_standard_audit_pkey | id |
| public | tenant_standard_operations | tenant_standard_operations_pkey | id |
| public | tenant_standards | tenant_standards_pkey | id |
| public | tenant_sync_agent_pairing_codes | tenant_sync_agent_pairing_codes_pkey | id |
| public | tenant_sync_agents | tenant_sync_agents_pkey | id |
| public | tenants | tenants_pkey | id |
| public | user_dashboard_preferences | user_dashboard_preferences_pkey | id |
| public | user_roles | user_roles_pkey | user_id, role_id |
| public | users | users_pkey | id |

## Objetos sin PK detectada

La lista puede incluir vistas y tablas de backup/legacy; las vistas no requieren PK, pero las tablas persistentes sí deben revisarse antes de escalar el SaaS.
- `ai_core.v_action_context`
- `ai_core.v_ai_useful_feedback_cases`
- `ai_core.v_control_context`
- `ai_core.v_evidence_context`
- `ai_core.v_external_lookup_usage_monthly`
- `ai_core.v_finding_context`
- `ai_core.v_finding_scenarios_active`
- `ai_core.v_kpi_context`
- `ai_core.v_tenant_health_context`
- `public.control_health_scores_backup_history`
- `public.report_access_rules_backup_20260430`
- `public.tenant_applicability_exclusions_cleanup_backup_20260525`
- `public.tenant_applicable_controls_cleanup_backup_20260525`
- `public.tenant_applicable_evidence_requirements_cleanup_backup_20260525`
- `public.tenant_applicable_kpis_cleanup_backup_20260525`
- `public.users_backup_before_role_governance_20260417`
- `public.users_backup_before_role_normalization_20260430`
- `public.v_audit_action_plan_timeline`
- `public.v_audit_control_recovery_timeline`
- `public.v_audit_event_log_enriched`
- `public.v_audit_evidence_timeline`
- `public.v_catalog_controls_without_iso_link`
- `public.v_control_health_base`
- `public.v_control_health_detail`
- `public.v_control_health_risks`
- `public.v_control_health_risks_applicable`
- `public.v_controls_recovered_by_remediation`
- `public.v_controls_without_evidence`
- `public.v_dealer_tenants`
- `public.v_evidence_approval_queue`
- `public.v_health_dashboard_by_standard`
- `public.v_health_dashboard_by_standard_applicable`
- `public.v_health_dashboard_summary`
- `public.v_health_dashboard_summary_applicable`
- `public.v_health_remediation_plan`
- `public.v_health_remediation_summary_by_standard`
- `public.v_health_remediation_summary_by_tenant`
- `public.v_health_root_causes_by_standard`
- `public.v_health_root_causes_by_tenant`
- `public.v_iso_catalog_sync_summary`
- `public.v_iso_control_catalog_coverage`
- `public.v_iso_control_effective_health`
- `public.v_iso_control_effective_health_applicable`
- `public.v_iso_controls_without_catalog_link`
- `public.v_iso_document_summary_by_tenant`
- `public.v_iso_effective_kpi_summary`
- `public.v_iso_effective_kpi_summary_applicable`
- `public.v_iso_express_gap_summary`
- `public.v_iso_express_latest_assessments`
- `public.v_iso_express_tenant_standard_readiness`
- `public.v_iso_generated_documents_latest`
- `public.v_iso_operational_suggestions_queue`
- `public.v_iso_operational_suggestions_summary`
- `public.v_iso_risk_matrix_actions_summary`
- `public.v_iso_risk_matrix_by_asset`
- `public.v_iso_risk_matrix_latest_runs`
- `public.v_iso_risk_matrix_summary`
- `public.v_latest_health_kpi_snapshots`
- `public.v_latest_health_kpi_snapshots_applicable`
- `public.v_remediation_executive_by_standard`
- `public.v_remediation_executive_by_tenant`
- `public.v_saas_prebilling_tenant_context`
- `public.v_standard_health_summary`
- `public.v_tenant_governance_summary`
- `public.v_tenant_health_summary`
- `public.v_tenant_modules`
- `public.v_user_permissions`
- `public.vw_evidence_ai_state`
- `public.vw_evidence_current_ai_assessments`
- `public.vw_evidence_current_extracts`

Fuente: `pg_catalog.pg_constraint`, `pg_catalog.pg_attribute`.
