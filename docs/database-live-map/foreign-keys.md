# Foreign Keys

| Schema | Tabla origen | Columna origen | Constraint | Tabla destino | Columna destino | Update rule | Delete rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ai_core | clause_control_domain_map | domain_code | fk_clause_domain_domain | ai_core.domains_catalog | domain_code | CASCADE | RESTRICT |
| ai_core | clause_control_domain_map | standard_code | fk_clause_domain_standard | ai_core.standards_catalog | standard_code | CASCADE | RESTRICT |
| ai_core | closure_criteria | problem_type_code | fk_closure_criteria_problem_type | ai_core.problem_types | code | CASCADE | RESTRICT |
| ai_core | domain_closure_criteria | domain_code | fk_domain_closure_domain | ai_core.domains_catalog | domain_code | CASCADE | RESTRICT |
| ai_core | domain_closure_criteria | problem_type_code | fk_domain_closure_problem | ai_core.problem_types | code | CASCADE | SET NULL |
| ai_core | domain_evidence_expectations | domain_code | fk_domain_evidence_domain | ai_core.domains_catalog | domain_code | CASCADE | RESTRICT |
| ai_core | domain_evidence_expectations | problem_type_code | fk_domain_evidence_problem | ai_core.problem_types | code | CASCADE | SET NULL |
| ai_core | domain_problem_type_map | domain_code | fk_domain_problem_type_domain | ai_core.domains_catalog | domain_code | CASCADE | RESTRICT |
| ai_core | domain_problem_type_map | problem_type_code | fk_domain_problem_type_problem | ai_core.problem_types | code | CASCADE | RESTRICT |
| ai_core | domain_solution_playbooks | domain_code | fk_domain_playbook_domain | ai_core.domains_catalog | domain_code | CASCADE | RESTRICT |
| ai_core | domain_solution_playbooks | problem_type_code | fk_domain_playbook_problem | ai_core.problem_types | code | CASCADE | SET NULL |
| ai_core | evidence_expectations | problem_type_code | fk_evidence_expectations_problem_type | ai_core.problem_types | code | CASCADE | RESTRICT |
| ai_core | solution_playbooks | problem_type_code | fk_solution_playbooks_problem_type | ai_core.problem_types | code | CASCADE | RESTRICT |
| ai_core | standard_domain_map | domain_code | fk_standard_domain_map_domain | ai_core.domains_catalog | domain_code | CASCADE | RESTRICT |
| ai_core | standard_domain_map | standard_code | fk_standard_domain_map_standard | ai_core.standards_catalog | standard_code | CASCADE | RESTRICT |
| ai_core | standard_specific_overrides | domain_code | fk_standard_override_domain | ai_core.domains_catalog | domain_code | CASCADE | SET NULL |
| ai_core | standard_specific_overrides | problem_type_code | fk_standard_override_problem | ai_core.problem_types | code | CASCADE | SET NULL |
| ai_core | standard_specific_overrides | standard_code | fk_standard_override_standard | ai_core.standards_catalog | standard_code | CASCADE | RESTRICT |
| public | action_plan_updates | action_plan_id | action_plan_updates_action_plan_id_fkey | public.action_plans | id | NO ACTION | CASCADE |
| public | action_plan_updates | tenant_id | action_plan_updates_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | action_plans | iso_code | action_plans_iso_code_fkey | public.standards | code | CASCADE | RESTRICT |
| public | action_plans | tenant_id | action_plans_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | action_plans | asset_id | fk_action_plans_asset | public.assets | id | NO ACTION | SET NULL |
| public | action_plans | audit_id | fk_action_plans_audit | public.audits | id | NO ACTION | SET NULL |
| public | action_plans | finding_id | fk_action_plans_finding | public.findings | id | NO ACTION | SET NULL |
| public | action_plans | nonconformity_id | fk_action_plans_nonconformity | public.tenant_nonconformities | id | NO ACTION | SET NULL |
| public | action_plans | tenant_control_id | fk_action_plans_tenant_control | public.tenant_controls | id | NO ACTION | SET NULL |
| public | admin_audit_log | actor_user_id | admin_audit_log_actor_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | admin_audit_log | tenant_id | admin_audit_log_tenant_id_fkey | public.tenants | id | NO ACTION | SET NULL |
| public | ai_bootstrap_knowledge_items | run_id | ai_bootstrap_knowledge_items_run_id_fkey | public.ai_bootstrap_knowledge_runs | id | NO ACTION | SET NULL |
| public | ai_bootstrap_knowledge_items | source_id | ai_bootstrap_knowledge_items_source_id_fkey | public.ai_bootstrap_knowledge_sources | id | NO ACTION | SET NULL |
| public | ai_bootstrap_knowledge_items | topic_id | ai_bootstrap_knowledge_items_topic_id_fkey | public.ai_bootstrap_knowledge_topics | id | NO ACTION | SET NULL |
| public | ai_knowledge_records | dataset_id | ai_knowledge_records_dataset_id_fkey | public.ai_knowledge_datasets | id | NO ACTION | CASCADE |
| public | ai_knowledge_standards | dataset_id | ai_knowledge_standards_dataset_id_fkey | public.ai_knowledge_datasets | id | NO ACTION | CASCADE |
| public | assessments | standard_id | assessments_standard_id_fkey | public.standards | id | NO ACTION | NO ACTION |
| public | assessments | tenant_id | assessments_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | asset_standards | asset_id | asset_standards_asset_id_fkey | public.assets | id | NO ACTION | CASCADE |
| public | asset_standards | standard_code | asset_standards_standard_code_fkey | public.standards | code | CASCADE | RESTRICT |
| public | audit_document_generation_runs | audit_id | audit_document_generation_runs_audit_id_fkey | public.audits | id | NO ACTION | NO ACTION |
| public | audit_document_generation_runs | created_by | audit_document_generation_runs_created_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | audit_document_generation_runs | package_id | audit_document_generation_runs_package_id_fkey | public.audit_preparation_packages | id | NO ACTION | CASCADE |
| public | audit_document_generation_runs | tenant_id | audit_document_generation_runs_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | audit_evidence_index | audit_id | audit_evidence_index_audit_id_fkey | public.audits | id | NO ACTION | NO ACTION |
| public | audit_evidence_index | package_id | audit_evidence_index_package_id_fkey | public.audit_preparation_packages | id | NO ACTION | CASCADE |
| public | audit_evidence_index | related_document_id | audit_evidence_index_related_document_id_fkey | public.audit_package_documents | id | NO ACTION | SET NULL |
| public | audit_evidence_index | tenant_id | audit_evidence_index_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | audit_package_documents | approved_by | audit_package_documents_approved_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | audit_package_documents | audit_id | audit_package_documents_audit_id_fkey | public.audits | id | NO ACTION | NO ACTION |
| public | audit_package_documents | created_by | audit_package_documents_created_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | audit_package_documents | package_id | audit_package_documents_package_id_fkey | public.audit_preparation_packages | id | NO ACTION | CASCADE |
| public | audit_package_documents | prepared_by | audit_package_documents_prepared_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | audit_package_documents | reviewed_by | audit_package_documents_reviewed_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | audit_package_documents | source_document_id | audit_package_documents_source_document_id_fkey | public.audit_package_documents | id | NO ACTION | SET NULL |
| public | audit_package_documents | supersedes_document_id | audit_package_documents_supersedes_document_id_fkey | public.audit_package_documents | id | NO ACTION | SET NULL |
| public | audit_package_documents | template_id | audit_package_documents_template_id_fkey | public.audit_document_templates | id | NO ACTION | NO ACTION |
| public | audit_package_documents | tenant_id | audit_package_documents_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | audit_preparation_packages | audit_id | audit_preparation_packages_audit_id_fkey | public.audits | id | NO ACTION | NO ACTION |
| public | audit_preparation_packages | generated_by | audit_preparation_packages_generated_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | audit_preparation_packages | tenant_id | audit_preparation_packages_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | audit_uploaded_zip_files | audit_id | audit_uploaded_zip_files_audit_id_fkey | public.audits | id | NO ACTION | NO ACTION |
| public | audit_uploaded_zip_files | created_by | audit_uploaded_zip_files_created_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | audit_uploaded_zip_files | package_id | audit_uploaded_zip_files_package_id_fkey | public.audit_preparation_packages | id | NO ACTION | SET NULL |
| public | audit_uploaded_zip_files | tenant_id | audit_uploaded_zip_files_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | clauses | standard_id | clauses_standard_id_fkey | public.standards | id | NO ACTION | CASCADE |
| public | control_health_scores | tenant_id | fk_control_health_scores_tenant | public.tenants | id | NO ACTION | CASCADE |
| public | control_health_scores | tenant_control_id | fk_control_health_scores_tenant_control | public.tenant_controls | id | NO ACTION | CASCADE |
| public | control_soa | tenant_control_id | control_soa_tenant_control_id_fkey | public.controls | id | NO ACTION | CASCADE |
| public | controls | catalog_control_id | fk_controls_catalog_control | public.controls_catalog | id | NO ACTION | SET NULL |
| public | controls_catalog | base_control_id | fk_controls_catalog_base_control | public.controls_catalog | id | NO ACTION | SET NULL |
| public | controls_catalog | tenant_id | fk_controls_catalog_tenant | public.tenants | id | NO ACTION | CASCADE |
| public | controls_catalog_standards | control_id | controls_catalog_standards_control_id_fkey | public.controls_catalog | id | NO ACTION | CASCADE |
| public | dealer_requests | dealer_user_id | dealer_requests_dealer_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | dealer_requests | reviewed_by | dealer_requests_reviewed_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | dealer_requests | tenant_id | dealer_requests_tenant_id_fkey | public.tenants | id | NO ACTION | SET NULL |
| public | dealer_tenants | assigned_by | dealer_tenants_assigned_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | dealer_tenants | dealer_user_id | dealer_tenants_dealer_user_id_fkey | public.users | id | NO ACTION | CASCADE |
| public | dealer_tenants | revoked_by | dealer_tenants_revoked_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | dealer_tenants | tenant_id | dealer_tenants_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | document_ai_analysis | document_id | document_ai_analysis_document_id_fkey | public.document_index | id | NO ACTION | CASCADE |
| public | document_association_suggestions | document_id | document_association_suggestions_document_id_fkey | public.document_index | id | NO ACTION | CASCADE |
| public | document_index | integration_id | document_index_integration_id_fkey | public.tenant_integrations | id | NO ACTION | SET NULL |
| public | document_index | source_id | document_index_source_id_fkey | public.tenant_document_sources | id | NO ACTION | CASCADE |
| public | document_sync_logs | integration_id | document_sync_logs_integration_id_fkey | public.tenant_integrations | id | NO ACTION | SET NULL |
| public | document_sync_logs | source_id | document_sync_logs_source_id_fkey | public.tenant_document_sources | id | NO ACTION | SET NULL |
| public | evidence_ai_assessments | duplicate_of_evidence_id | evidence_ai_assessments_duplicate_of_evidence_id_fkey | public.evidences | id | NO ACTION | SET NULL |
| public | evidence_ai_assessments | evidence_id | evidence_ai_assessments_evidence_id_fkey | public.evidences | id | NO ACTION | CASCADE |
| public | evidence_ai_assessments | extract_id | evidence_ai_assessments_extract_id_fkey | public.evidence_document_extracts | id | NO ACTION | SET NULL |
| public | evidence_ai_assessments | recommended_control_id | evidence_ai_assessments_recommended_control_id_fkey | public.controls_catalog | id | NO ACTION | SET NULL |
| public | evidence_ai_assessments | recommended_operation_id | evidence_ai_assessments_recommended_operation_id_fkey | public.tenant_operations | id | NO ACTION | SET NULL |
| public | evidence_ai_assessments | tenant_id | evidence_ai_assessments_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | evidence_ai_jobs | created_by | evidence_ai_jobs_created_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | evidence_ai_jobs | evidence_id | evidence_ai_jobs_evidence_id_fkey | public.evidences | id | NO ACTION | CASCADE |
| public | evidence_ai_jobs | tenant_id | evidence_ai_jobs_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | evidence_document_extracts | evidence_id | evidence_document_extracts_evidence_id_fkey | public.evidences | id | NO ACTION | CASCADE |
| public | evidence_document_extracts | tenant_id | evidence_document_extracts_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | evidence_document_links | document_id | evidence_document_links_document_id_fkey | public.document_index | id | NO ACTION | CASCADE |
| public | evidence_document_links | evidence_id | evidence_document_links_evidence_id_fkey | public.evidences | id | NO ACTION | CASCADE |
| public | evidence_knowledge_chunks | assessment_id | evidence_knowledge_chunks_assessment_id_fkey | public.evidence_ai_assessments | id | NO ACTION | SET NULL |
| public | evidence_knowledge_chunks | control_id | evidence_knowledge_chunks_control_id_fkey | public.controls_catalog | id | NO ACTION | SET NULL |
| public | evidence_knowledge_chunks | evidence_id | evidence_knowledge_chunks_evidence_id_fkey | public.evidences | id | NO ACTION | CASCADE |
| public | evidence_knowledge_chunks | extract_id | evidence_knowledge_chunks_extract_id_fkey | public.evidence_document_extracts | id | NO ACTION | SET NULL |
| public | evidence_knowledge_chunks | operation_id | evidence_knowledge_chunks_operation_id_fkey | public.tenant_operations | id | NO ACTION | SET NULL |
| public | evidence_knowledge_chunks | tenant_control_id | evidence_knowledge_chunks_tenant_control_id_fkey | public.tenant_controls | id | NO ACTION | SET NULL |
| public | evidence_knowledge_chunks | tenant_id | evidence_knowledge_chunks_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | evidences | tenant_control_id | fk_evidences_tenant_control | public.tenant_controls | id | NO ACTION | CASCADE |
| public | findings | iso_code | findings_iso_code_fkey | public.standards | code | CASCADE | RESTRICT |
| public | findings | tenant_id | findings_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | findings | asset_id | fk_findings_asset | public.assets | id | NO ACTION | SET NULL |
| public | findings | audit_id | fk_findings_audit | public.audits | id | NO ACTION | SET NULL |
| public | findings | nonconformity_id | fk_findings_nonconformity | public.tenant_nonconformities | id | NO ACTION | SET NULL |
| public | findings | tenant_control_id | fk_findings_tenant_control | public.controls | id | NO ACTION | SET NULL |
| public | iso_ai_guidance | standard_version_id | iso_ai_guidance_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_audit_questions | clause_id | iso_audit_questions_clause_id_fkey | public.iso_clauses | id | NO ACTION | NO ACTION |
| public | iso_audit_questions | control_id | iso_audit_questions_control_id_fkey | public.iso_controls | id | NO ACTION | NO ACTION |
| public | iso_audit_questions | standard_version_id | iso_audit_questions_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_clauses | standard_version_id | iso_clauses_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_control_catalog_links | catalog_control_id | iso_control_catalog_links_catalog_control_id_fkey | public.controls_catalog | id | NO ACTION | NO ACTION |
| public | iso_control_catalog_links | iso_control_id | iso_control_catalog_links_iso_control_id_fkey | public.iso_controls | id | NO ACTION | NO ACTION |
| public | iso_controls | clause_id | iso_controls_clause_id_fkey | public.iso_clauses | id | NO ACTION | NO ACTION |
| public | iso_controls | standard_version_id | iso_controls_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_document_audit_log | document_id | iso_document_audit_log_document_id_fkey | public.iso_generated_documents | id | NO ACTION | NO ACTION |
| public | iso_document_generation_runs | requested_by | iso_document_generation_runs_requested_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_document_generation_runs | tenant_id | iso_document_generation_runs_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | iso_evidence_expectations | control_id | iso_evidence_expectations_control_id_fkey | public.iso_controls | id | NO ACTION | NO ACTION |
| public | iso_evidence_expectations | standard_version_id | iso_evidence_expectations_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_express_assessment_answers | assessment_id | iso_express_assessment_answers_assessment_id_fkey | public.iso_express_assessments | id | NO ACTION | CASCADE |
| public | iso_express_assessment_gaps | assessment_id | iso_express_assessment_gaps_assessment_id_fkey | public.iso_express_assessments | id | NO ACTION | CASCADE |
| public | iso_express_assessment_gaps | iso_control_id | iso_express_assessment_gaps_iso_control_id_fkey | public.iso_controls | id | NO ACTION | NO ACTION |
| public | iso_express_assessment_items | assessment_id | iso_express_assessment_items_assessment_id_fkey | public.iso_express_assessments | id | NO ACTION | CASCADE |
| public | iso_express_assessment_items | iso_control_id | iso_express_assessment_items_iso_control_id_fkey | public.iso_controls | id | NO ACTION | NO ACTION |
| public | iso_express_assessments | requested_by | iso_express_assessments_requested_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_express_assessments | tenant_id | iso_express_assessments_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | iso_gap_rules | standard_version_id | iso_gap_rules_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_generated_document_sections | document_id | iso_generated_document_sections_document_id_fkey | public.iso_generated_documents | id | NO ACTION | CASCADE |
| public | iso_generated_documents | approved_by | iso_generated_documents_approved_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_generated_documents | archived_by | iso_generated_documents_archived_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_generated_documents | generated_by | iso_generated_documents_generated_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_generated_documents | source_assessment_id | iso_generated_documents_source_assessment_id_fkey | public.iso_express_assessments | id | NO ACTION | NO ACTION |
| public | iso_generated_documents | tenant_id | iso_generated_documents_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | iso_maturity_rules | standard_version_id | iso_maturity_rules_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_operational_suggestion_audit_log | actor_user_id | iso_operational_suggestion_audit_log_actor_user_id_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_operational_suggestion_audit_log | suggestion_id | iso_operational_suggestion_audit_log_suggestion_id_fkey | public.iso_operational_suggestions | id | NO ACTION | NO ACTION |
| public | iso_operational_suggestions | approved_by | iso_operational_suggestions_approved_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_operational_suggestions | created_by | iso_operational_suggestions_created_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_operational_suggestions | rejected_by | iso_operational_suggestions_rejected_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_operational_suggestions | tenant_control_id | iso_operational_suggestions_tenant_control_id_fkey | public.tenant_controls | id | NO ACTION | NO ACTION |
| public | iso_operational_suggestions | tenant_id | iso_operational_suggestions_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | iso_policy_templates | standard_version_id | iso_policy_templates_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_procedure_templates | standard_version_id | iso_procedure_templates_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_recommended_action_conversions | converted_by | iso_recommended_action_conversions_converted_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_recommended_action_conversions | recommendation_id | iso_recommended_action_conversions_recommendation_id_fkey | public.iso_operational_suggestions | id | NO ACTION | NO ACTION |
| public | iso_recommended_action_conversions | tenant_id | iso_recommended_action_conversions_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_actions | risk_item_id | iso_risk_matrix_actions_risk_item_id_fkey | public.iso_risk_matrix_items | id | NO ACTION | CASCADE |
| public | iso_risk_matrix_actions | run_id | iso_risk_matrix_actions_run_id_fkey | public.iso_risk_matrix_runs | id | NO ACTION | CASCADE |
| public | iso_risk_matrix_audit_log | actor_user_id | iso_risk_matrix_audit_log_actor_user_id_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_audit_log | risk_item_id | iso_risk_matrix_audit_log_risk_item_id_fkey | public.iso_risk_matrix_items | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_audit_log | run_id | iso_risk_matrix_audit_log_run_id_fkey | public.iso_risk_matrix_runs | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | asset_id | iso_risk_matrix_items_asset_id_fkey | public.assets | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | catalog_control_id | iso_risk_matrix_items_catalog_control_id_fkey | public.controls_catalog | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | iso_control_id | iso_risk_matrix_items_iso_control_id_fkey | public.iso_controls | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | reviewer_user_id | iso_risk_matrix_items_reviewer_user_id_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | risk_template_id | iso_risk_matrix_items_risk_template_id_fkey | public.iso_risk_templates | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | run_id | iso_risk_matrix_items_run_id_fkey | public.iso_risk_matrix_runs | id | NO ACTION | CASCADE |
| public | iso_risk_matrix_items | source_assessment_id | iso_risk_matrix_items_source_assessment_id_fkey | public.iso_express_assessments | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | source_gap_id | iso_risk_matrix_items_source_gap_id_fkey | public.iso_express_assessment_gaps | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_items | tenant_control_id | iso_risk_matrix_items_tenant_control_id_fkey | public.tenant_controls | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_runs | requested_by | iso_risk_matrix_runs_requested_by_fkey | public.users | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_runs | source_assessment_id | iso_risk_matrix_runs_source_assessment_id_fkey | public.iso_express_assessments | id | NO ACTION | NO ACTION |
| public | iso_risk_matrix_runs | tenant_id | iso_risk_matrix_runs_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | iso_risk_templates | standard_version_id | iso_risk_templates_standard_version_id_fkey | public.iso_standard_versions | id | NO ACTION | NO ACTION |
| public | iso_standard_versions | standard_id | iso_standard_versions_standard_id_fkey | public.iso_standards | id | NO ACTION | NO ACTION |
| public | kpi_calculation_jobs | requested_by | kpi_calculation_jobs_requested_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | kpi_calculation_jobs | tenant_id | kpi_calculation_jobs_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | kpi_calculation_rules | applies_to_standard_code | kpi_calculation_rules_applies_to_standard_code_fkey | public.standards | code | NO ACTION | CASCADE |
| public | kpi_calculation_rules | kpi_id | kpi_calculation_rules_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | kpi_custom_inputs | kpi_id | kpi_custom_inputs_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | kpi_data_sources | kpi_id | kpi_data_sources_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | kpi_definitions | created_by | kpi_definitions_created_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | kpi_definitions | tenant_id | kpi_definitions_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | kpi_dimensions_catalog | kpi_id | kpi_dimensions_catalog_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | kpi_event_queue | tenant_id | kpi_event_queue_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | kpi_manual_values | entered_by | kpi_manual_values_entered_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | kpi_manual_values | kpi_id | kpi_manual_values_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | kpi_manual_values | standard_code | kpi_manual_values_standard_code_fkey | public.standards | code | NO ACTION | SET NULL |
| public | kpi_manual_values | tenant_id | kpi_manual_values_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | kpi_snapshot_dimensions | snapshot_id | kpi_snapshot_dimensions_snapshot_id_fkey | public.kpi_snapshots | id | NO ACTION | CASCADE |
| public | kpi_snapshots | calculation_rule_id | kpi_snapshots_calculation_rule_id_fkey | public.kpi_calculation_rules | id | NO ACTION | SET NULL |
| public | kpi_snapshots | kpi_id | kpi_snapshots_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | kpi_snapshots | standard_code | kpi_snapshots_standard_code_fkey | public.standards | code | NO ACTION | SET NULL |
| public | kpi_snapshots | tenant_id | kpi_snapshots_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | kpi_standard_mappings | kpi_id | kpi_standard_mappings_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | kpi_standard_mappings | standard_code | kpi_standard_mappings_standard_code_fkey | public.standards | code | NO ACTION | CASCADE |
| public | kpi_thresholds | kpi_id | kpi_thresholds_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | management_objectives | tenant_id | management_objectives_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | notifications | tenant_id | notifications_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | report_access_rules | report_type_code | report_access_rules_report_type_code_fkey | public.report_types | code | NO ACTION | CASCADE |
| public | report_exports | report_type_code | report_exports_report_type_code_fkey | public.report_types | code | NO ACTION | NO ACTION |
| public | report_schedules | report_type_code | report_schedules_report_type_code_fkey | public.report_types | code | NO ACTION | NO ACTION |
| public | responses | assessment_id | responses_assessment_id_fkey | public.assessments | id | NO ACTION | CASCADE |
| public | responses | clause_id | responses_clause_id_fkey | public.clauses | id | NO ACTION | NO ACTION |
| public | role_permissions | permission_key | role_permissions_permission_key_fkey | public.permissions | permission_key | CASCADE | CASCADE |
| public | role_permissions | role_key | role_permissions_role_key_fkey | public.app_roles | role_key | CASCADE | CASCADE |
| public | saas_monthly_prebilling | reviewed_by_user_id | saas_monthly_prebilling_reviewed_by_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | saas_monthly_prebilling | tenant_id | saas_monthly_prebilling_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | saas_monthly_prebilling_lines | prebilling_id | saas_monthly_prebilling_lines_prebilling_id_fkey | public.saas_monthly_prebilling | id | NO ACTION | CASCADE |
| public | saas_monthly_prebilling_lines | tenant_id | saas_monthly_prebilling_lines_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | saas_quote_lines | quote_id | saas_quote_lines_quote_id_fkey | public.saas_quotes | id | NO ACTION | CASCADE |
| public | saas_quotes | created_by_user_id | saas_quotes_created_by_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | saas_quotes | dealer_user_id | saas_quotes_dealer_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | saas_quotes | tenant_id | saas_quotes_tenant_id_fkey | public.tenants | id | NO ACTION | SET NULL |
| public | search_history | tenant_id | search_history_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | search_history | user_id | search_history_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | standard_lifecycle_ai_feed | operation_id | fk_standard_lifecycle_ai_feed_operation | public.tenant_operations | id | NO ACTION | CASCADE |
| public | standard_lifecycle_ai_feed | tenant_id | fk_standard_lifecycle_ai_feed_tenant | public.tenants | id | NO ACTION | CASCADE |
| public | standard_lifecycle_snapshots | operation_id | fk_standard_lifecycle_snapshots_operation | public.tenant_operations | id | NO ACTION | CASCADE |
| public | standard_lifecycle_snapshots | tenant_id | fk_standard_lifecycle_snapshots_tenant | public.tenants | id | NO ACTION | CASCADE |
| public | standard_lifecycle_stage_requests | operation_id | fk_lifecycle_request_operation | public.tenant_operations | id | NO ACTION | CASCADE |
| public | standard_lifecycle_stage_requests | tenant_id | fk_lifecycle_request_tenant | public.tenants | id | NO ACTION | CASCADE |
| public | standard_lifecycle_status | operation_id | fk_standard_lifecycle_status_operation | public.tenant_operations | id | NO ACTION | CASCADE |
| public | standard_lifecycle_status | tenant_id | fk_standard_lifecycle_status_tenant | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_applicability_exclusions | tenant_id | tenant_applicability_exclusions_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_applicability_profiles | tenant_id | tenant_applicability_profiles_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_applicability_runs | created_by | tenant_applicability_runs_created_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | tenant_applicability_runs | tenant_id | tenant_applicability_runs_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_applicable_controls | tenant_id | tenant_applicable_controls_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_applicable_evidence_requirements | tenant_id | tenant_applicable_evidence_requirements_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_applicable_kpis | tenant_id | tenant_applicable_kpis_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_company_profiles | created_by_user_id | tenant_company_profiles_created_by_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | tenant_company_profiles | tenant_id | tenant_company_profiles_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_company_profiles | updated_by_user_id | tenant_company_profiles_updated_by_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | tenant_contracts | commercial_owner_user_id | tenant_contracts_commercial_owner_user_id_fkey | public.users | id | NO ACTION | SET NULL |
| public | tenant_contracts | tenant_id | tenant_contracts_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_controls | control_id | fk_tenant_controls_catalog | public.controls_catalog | id | NO ACTION | CASCADE |
| public | tenant_controls | tenant_id | fk_tenant_controls_tenant | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_controls | operation_id | tenant_controls_operation_id_fkey | public.tenant_operations | id | NO ACTION | CASCADE |
| public | tenant_document_provider_credentials | source_id | tenant_document_provider_credentials_source_id_fkey | public.tenant_document_sources | id | NO ACTION | CASCADE |
| public | tenant_document_sources | integration_id | tenant_document_sources_integration_id_fkey | public.tenant_integrations | id | NO ACTION | CASCADE |
| public | tenant_kpi_settings | kpi_id | tenant_kpi_settings_kpi_id_fkey | public.kpi_definitions | id | NO ACTION | CASCADE |
| public | tenant_kpi_settings | tenant_id | tenant_kpi_settings_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_module_settings | disabled_by | tenant_module_settings_disabled_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | tenant_module_settings | enabled_by | tenant_module_settings_enabled_by_fkey | public.users | id | NO ACTION | SET NULL |
| public | tenant_module_settings | module_key | tenant_module_settings_module_key_fkey | public.saas_modules | module_key | CASCADE | RESTRICT |
| public | tenant_module_settings | tenant_id | tenant_module_settings_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_operations | tenant_id | tenant_operations_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_standard_operations | operation_id | tenant_standard_operations_operation_fkey | public.tenant_operations | id | NO ACTION | CASCADE |
| public | tenant_standard_operations | standard_code | tenant_standard_operations_standard_fkey | public.standards | code | NO ACTION | CASCADE |
| public | tenant_standard_operations | tenant_id | tenant_standard_operations_tenant_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_standards | standard_code | tenant_standards_standard_code_fkey | public.standards | code | CASCADE | RESTRICT |
| public | tenant_standards | tenant_id | tenant_standards_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |
| public | tenant_sync_agent_pairing_codes | source_id | tenant_sync_agent_pairing_codes_source_id_fkey | public.tenant_document_sources | id | NO ACTION | CASCADE |
| public | tenant_sync_agents | source_id | tenant_sync_agents_source_id_fkey | public.tenant_document_sources | id | NO ACTION | CASCADE |
| public | user_dashboard_preferences | tenant_id | user_dashboard_preferences_tenant_id_fkey | public.tenants | id | NO ACTION | NO ACTION |
| public | user_dashboard_preferences | user_id | user_dashboard_preferences_user_id_fkey | public.users | id | NO ACTION | NO ACTION |
| public | user_roles | role_id | user_roles_role_id_fkey | public.roles | id | NO ACTION | NO ACTION |
| public | user_roles | user_id | user_roles_user_id_fkey | public.users | id | NO ACTION | CASCADE |
| public | users | tenant_id | users_tenant_id_fkey | public.tenants | id | NO ACTION | CASCADE |

## Mapa relacional por módulo
| Módulo | FKs relacionadas | Observación |
| --- | --- | --- |
| Auth / usuarios | 47 | Relaciones detectadas por constraints. |
| Tenants / SaaS | 100 | Relaciones detectadas por constraints. |
| Normas ISO | 102 | Relaciones detectadas por constraints. |
| Controles | 5 | Relaciones detectadas por constraints. |
| Evidencias | 54 | Relaciones detectadas por constraints. |
| Riesgos | 0 | Sin FKs claras por módulo inferido. |
| Activos | 4 | Relaciones detectadas por constraints. |
| Auditorías | 15 | Relaciones detectadas por constraints. |
| Hallazgos | 7 | Relaciones detectadas por constraints. |
| No conformidades | 0 | Sin FKs claras por módulo inferido. |
| Planes de acción | 9 | Relaciones detectadas por constraints. |
| KPIs | 22 | Relaciones detectadas por constraints. |
| Health | 0 | Sin FKs claras por módulo inferido. |
| Reportes / exportes | 3 | Relaciones detectadas por constraints. |
| IA / conocimiento | 16 | Relaciones detectadas por constraints. |
| Google Drive / documentos | 0 | Sin FKs claras por módulo inferido. |
| Billing / prefacturación | 0 | Sin FKs claras por módulo inferido. |
| Configuración | 2 | Relaciones detectadas por constraints. |
| Sistema / logs | 2 | Relaciones detectadas por constraints. |
| Legacy / revisar | 0 | Sin FKs claras por módulo inferido. |
| No determinado | 4 | Relaciones detectadas por constraints. |

Fuente: `pg_catalog.pg_constraint`, `pg_catalog.pg_attribute`, `pg_catalog.pg_class`, `pg_catalog.pg_namespace`.
