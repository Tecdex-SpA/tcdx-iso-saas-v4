# Constraints

## Constraints declaradas
| Schema | Tabla | Constraint | Tipo | Definición |
| --- | --- | --- | --- | --- |
| ai_core | ai_core_migrations | ai_core_migrations_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | ai_core_migrations | ai_core_migrations_migration_code_key | UNIQUE | UNIQUE (migration_code) |
| ai_core | ai_feedback | ai_feedback_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | ai_response_feedback | ai_response_feedback_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | ai_response_traces | ai_response_traces_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | clause_control_domain_map | fk_clause_domain_domain | FOREIGN KEY | FOREIGN KEY (domain_code) REFERENCES ai_core.domains_catalog(domain_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | clause_control_domain_map | fk_clause_domain_standard | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES ai_core.standards_catalog(standard_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | clause_control_domain_map | clause_control_domain_map_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | clause_control_domain_map | uq_clause_control_domain | UNIQUE | UNIQUE (standard_code, clause_or_control_code, domain_code) |
| ai_core | closure_criteria | fk_closure_criteria_problem_type | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | closure_criteria | closure_criteria_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | domain_closure_criteria | fk_domain_closure_domain | FOREIGN KEY | FOREIGN KEY (domain_code) REFERENCES ai_core.domains_catalog(domain_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | domain_closure_criteria | fk_domain_closure_problem | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE SET NULL |
| ai_core | domain_closure_criteria | domain_closure_criteria_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | domain_evidence_expectations | fk_domain_evidence_domain | FOREIGN KEY | FOREIGN KEY (domain_code) REFERENCES ai_core.domains_catalog(domain_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | domain_evidence_expectations | fk_domain_evidence_problem | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE SET NULL |
| ai_core | domain_evidence_expectations | domain_evidence_expectations_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | domain_problem_type_map | fk_domain_problem_type_domain | FOREIGN KEY | FOREIGN KEY (domain_code) REFERENCES ai_core.domains_catalog(domain_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | domain_problem_type_map | fk_domain_problem_type_problem | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | domain_problem_type_map | domain_problem_type_map_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | domain_problem_type_map | uq_domain_problem_type_map | UNIQUE | UNIQUE (domain_code, problem_type_code) |
| ai_core | domain_solution_playbooks | fk_domain_playbook_domain | FOREIGN KEY | FOREIGN KEY (domain_code) REFERENCES ai_core.domains_catalog(domain_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | domain_solution_playbooks | fk_domain_playbook_problem | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE SET NULL |
| ai_core | domain_solution_playbooks | domain_solution_playbooks_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | domains_catalog | domains_catalog_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | domains_catalog | domains_catalog_domain_code_key | UNIQUE | UNIQUE (domain_code) |
| ai_core | evidence_expectations | fk_evidence_expectations_problem_type | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | evidence_expectations | evidence_expectations_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | external_lookup_extra_charges | external_lookup_extra_charges_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | external_lookup_logs | external_lookup_logs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | external_lookup_quota_audit | external_lookup_quota_audit_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | external_lookup_quotas | external_lookup_quotas_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | finding_scenarios | finding_scenarios_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | finding_scenarios | finding_scenarios_scenario_code_key | UNIQUE | UNIQUE (scenario_code) |
| ai_core | invalid_evidence_patterns | invalid_evidence_patterns_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | invalid_evidence_patterns | invalid_evidence_patterns_code_key | UNIQUE | UNIQUE (code) |
| ai_core | priority_rules | priority_rules_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | priority_rules | priority_rules_code_key | UNIQUE | UNIQUE (code) |
| ai_core | problem_types | problem_types_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | problem_types | problem_types_code_key | UNIQUE | UNIQUE (code) |
| ai_core | response_templates | response_templates_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | response_templates | response_templates_code_key | UNIQUE | UNIQUE (code) |
| ai_core | solution_playbooks | fk_solution_playbooks_problem_type | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | solution_playbooks | solution_playbooks_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | standard_domain_map | fk_standard_domain_map_domain | FOREIGN KEY | FOREIGN KEY (domain_code) REFERENCES ai_core.domains_catalog(domain_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | standard_domain_map | fk_standard_domain_map_standard | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES ai_core.standards_catalog(standard_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | standard_domain_map | standard_domain_map_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | standard_domain_map | uq_standard_domain_map | UNIQUE | UNIQUE (standard_code, domain_code) |
| ai_core | standard_specific_overrides | fk_standard_override_domain | FOREIGN KEY | FOREIGN KEY (domain_code) REFERENCES ai_core.domains_catalog(domain_code) ON UPDATE CASCADE ON DELETE SET NULL |
| ai_core | standard_specific_overrides | fk_standard_override_problem | FOREIGN KEY | FOREIGN KEY (problem_type_code) REFERENCES ai_core.problem_types(code) ON UPDATE CASCADE ON DELETE SET NULL |
| ai_core | standard_specific_overrides | fk_standard_override_standard | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES ai_core.standards_catalog(standard_code) ON UPDATE CASCADE ON DELETE RESTRICT |
| ai_core | standard_specific_overrides | standard_specific_overrides_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | standards_catalog | standards_catalog_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | standards_catalog | standards_catalog_standard_code_key | UNIQUE | UNIQUE (standard_code) |
| ai_core | trusted_external_sources | trusted_external_sources_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| ai_core | trusted_external_sources | trusted_external_sources_source_code_key | UNIQUE | UNIQUE (source_code) |
| ai_core | view_definition_backups | view_definition_backups_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | action_plan_updates | chk_action_plan_updates_progress | CHECK | CHECK (progress_percent >= 0 AND progress_percent <= 100) |
| public | action_plan_updates | chk_action_plan_updates_status | CHECK | CHECK (status_after = ANY (ARRAY['abierto'::text, 'en progreso'::text, 'bloqueado'::text, 'completado'::text, 'cancelado'::text])) |
| public | action_plan_updates | action_plan_updates_action_plan_id_fkey | FOREIGN KEY | FOREIGN KEY (action_plan_id) REFERENCES action_plans(id) ON DELETE CASCADE |
| public | action_plan_updates | action_plan_updates_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | action_plan_updates | action_plan_updates_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | action_plans | chk_action_plans_approval_status | CHECK | CHECK (approval_status = ANY (ARRAY['no_requerida'::text, 'pendiente_aprobacion'::text, 'aprobada'::text, 'devuelta'::text])) |
| public | action_plans | chk_action_plans_priority | CHECK | CHECK (priority = ANY (ARRAY['alta'::text, 'media'::text, 'baja'::text])) |
| public | action_plans | chk_action_plans_source_type | CHECK | CHECK (source_type = ANY (ARRAY['manual'::text, 'nonconformity'::text, 'risk'::text, 'audit'::text, 'control'::text, 'ia'::text, 'finding'::text])) |
| public | action_plans | chk_action_plans_status | CHECK | CHECK (status = ANY (ARRAY['abierto'::text, 'en progreso'::text, 'bloqueado'::text, 'completado'::text, 'cancelado'::text])) |
| public | action_plans | action_plans_iso_code_fkey | FOREIGN KEY | FOREIGN KEY (iso_code) REFERENCES standards(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| public | action_plans | action_plans_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | action_plans | fk_action_plans_asset | FOREIGN KEY | FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL |
| public | action_plans | fk_action_plans_audit | FOREIGN KEY | FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE SET NULL |
| public | action_plans | fk_action_plans_finding | FOREIGN KEY | FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE SET NULL |
| public | action_plans | fk_action_plans_nonconformity | FOREIGN KEY | FOREIGN KEY (nonconformity_id) REFERENCES tenant_nonconformities(id) ON DELETE SET NULL |
| public | action_plans | fk_action_plans_tenant_control | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES tenant_controls(id) ON DELETE SET NULL |
| public | action_plans | action_plans_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | action_plans_backup_history | action_plans_backup_history_pkey | PRIMARY KEY | PRIMARY KEY (backup_id) |
| public | admin_audit_log | admin_audit_log_actor_user_id_fkey | FOREIGN KEY | FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | admin_audit_log | admin_audit_log_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL |
| public | admin_audit_log | admin_audit_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_auditor_runs | ai_auditor_runs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_bootstrap_knowledge_items | chk_ai_bootstrap_items_status | CHECK | CHECK (status = ANY (ARRAY['bootstrap_pending_review'::text, 'bootstrap_approved'::text, 'bootstrap_rejected'::text, 'bootstrap_archived'::text])) |
| public | ai_bootstrap_knowledge_items | ai_bootstrap_knowledge_items_run_id_fkey | FOREIGN KEY | FOREIGN KEY (run_id) REFERENCES ai_bootstrap_knowledge_runs(id) ON DELETE SET NULL |
| public | ai_bootstrap_knowledge_items | ai_bootstrap_knowledge_items_source_id_fkey | FOREIGN KEY | FOREIGN KEY (source_id) REFERENCES ai_bootstrap_knowledge_sources(id) ON DELETE SET NULL |
| public | ai_bootstrap_knowledge_items | ai_bootstrap_knowledge_items_topic_id_fkey | FOREIGN KEY | FOREIGN KEY (topic_id) REFERENCES ai_bootstrap_knowledge_topics(id) ON DELETE SET NULL |
| public | ai_bootstrap_knowledge_items | ai_bootstrap_knowledge_items_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_bootstrap_knowledge_runs | chk_ai_bootstrap_runs_mode | CHECK | CHECK (mode = ANY (ARRAY['seeds'::text, 'brave'::text, 'all'::text, 'dry_run'::text, 'reindex'::text])) |
| public | ai_bootstrap_knowledge_runs | chk_ai_bootstrap_runs_status | CHECK | CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])) |
| public | ai_bootstrap_knowledge_runs | ai_bootstrap_knowledge_runs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_bootstrap_knowledge_sources | ai_bootstrap_knowledge_sources_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_bootstrap_knowledge_topics | ai_bootstrap_knowledge_topics_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_bootstrap_knowledge_topics | ai_bootstrap_knowledge_topics_code_key | UNIQUE | UNIQUE (code) |
| public | ai_knowledge_datasets | ai_knowledge_datasets_scope_check | CHECK | CHECK (scope = ANY (ARRAY['global'::text, 'tenant'::text])) |
| public | ai_knowledge_datasets | ai_knowledge_datasets_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_knowledge_datasets | ai_knowledge_datasets_dataset_name_schema_version_generated_key | UNIQUE | UNIQUE (dataset_name, schema_version, generated_on, scope) |
| public | ai_knowledge_records | ai_knowledge_records_dataset_id_fkey | FOREIGN KEY | FOREIGN KEY (dataset_id) REFERENCES ai_knowledge_datasets(id) ON DELETE CASCADE |
| public | ai_knowledge_records | ai_knowledge_records_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_knowledge_records | ai_knowledge_records_dataset_id_record_id_key | UNIQUE | UNIQUE (dataset_id, record_id) |
| public | ai_knowledge_standards | ai_knowledge_standards_dataset_id_fkey | FOREIGN KEY | FOREIGN KEY (dataset_id) REFERENCES ai_knowledge_datasets(id) ON DELETE CASCADE |
| public | ai_knowledge_standards | ai_knowledge_standards_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_knowledge_standards | ai_knowledge_standards_dataset_id_norma_edicion_estado_key | UNIQUE | UNIQUE (dataset_id, norma, edicion_estado) |
| public | ai_prompt_logs | ai_prompt_logs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | ai_suggestions | ai_suggestions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | app_roles | app_roles_pkey | PRIMARY KEY | PRIMARY KEY (role_key) |
| public | assessments | assessments_standard_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_id) REFERENCES standards(id) |
| public | assessments | assessments_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | assessments | assessments_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | asset_risks | asset_risks_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | asset_standards | asset_standards_asset_id_fkey | FOREIGN KEY | FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE |
| public | asset_standards | asset_standards_standard_code_fkey | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES standards(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| public | asset_standards | asset_standards_pkey | PRIMARY KEY | PRIMARY KEY (asset_id, standard_code) |
| public | assets | assets_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_control_reviews | audit_control_reviews_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_document_generation_runs | chk_audit_document_generation_runs_status | CHECK | CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'running'::character varying::text, 'completed'::character varying::text, 'failed'::character varying::text])) |
| public | audit_document_generation_runs | chk_audit_document_generation_runs_type | CHECK | CHECK (run_type::text = ANY (ARRAY['package_generation'::character varying::text, 'document_generation'::character varying::text, 'zip_analysis'::character varying::text, 'zip_update'::character varying::text, 'evidence_index_generation'::character varying::text, 'gap_analysis'::character varying::text, 'management_review_generation'::character varying::text... |
| public | audit_document_generation_runs | audit_document_generation_runs_audit_id_fkey | FOREIGN KEY | FOREIGN KEY (audit_id) REFERENCES audits(id) |
| public | audit_document_generation_runs | audit_document_generation_runs_created_by_fkey | FOREIGN KEY | FOREIGN KEY (created_by) REFERENCES users(id) |
| public | audit_document_generation_runs | audit_document_generation_runs_package_id_fkey | FOREIGN KEY | FOREIGN KEY (package_id) REFERENCES audit_preparation_packages(id) ON DELETE CASCADE |
| public | audit_document_generation_runs | audit_document_generation_runs_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | audit_document_generation_runs | audit_document_generation_runs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_document_templates | chk_audit_document_templates_output | CHECK | CHECK (output_format::text = ANY (ARRAY['docx'::character varying::text, 'xlsx'::character varying::text, 'pptx'::character varying::text, 'pdf'::character varying::text, 'md'::character varying::text])) |
| public | audit_document_templates | chk_audit_document_templates_type | CHECK | CHECK (document_type::text = ANY (ARRAY['manual'::character varying::text, 'policy'::character varying::text, 'objective_plan'::character varying::text, 'context'::character varying::text, 'interested_parties'::character varying::text, 'process_map'::character varying::text, 'risk_matrix'::character varying::text, 'procedure'::character varying::text, 'recor... |
| public | audit_document_templates | audit_document_templates_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_document_templates | ux_audit_document_templates_standard_key | UNIQUE | UNIQUE (standard_code, template_key) |
| public | audit_documentary_sources | audit_documentary_sources_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_event_log | audit_event_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_evidence_index | chk_audit_evidence_index_status | CHECK | CHECK (status::text = ANY (ARRAY['complete'::character varying::text, 'partial'::character varying::text, 'pending'::character varying::text, 'requires_validation'::character varying::text])) |
| public | audit_evidence_index | audit_evidence_index_audit_id_fkey | FOREIGN KEY | FOREIGN KEY (audit_id) REFERENCES audits(id) |
| public | audit_evidence_index | audit_evidence_index_package_id_fkey | FOREIGN KEY | FOREIGN KEY (package_id) REFERENCES audit_preparation_packages(id) ON DELETE CASCADE |
| public | audit_evidence_index | audit_evidence_index_related_document_id_fkey | FOREIGN KEY | FOREIGN KEY (related_document_id) REFERENCES audit_package_documents(id) ON DELETE SET NULL |
| public | audit_evidence_index | audit_evidence_index_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | audit_evidence_index | audit_evidence_index_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_package_documents | chk_audit_package_documents_output | CHECK | CHECK (output_format IS NULL OR (output_format::text = ANY (ARRAY['docx'::character varying::text, 'xlsx'::character varying::text, 'pptx'::character varying::text, 'pdf'::character varying::text, 'md'::character varying::text]))) |
| public | audit_package_documents | chk_audit_package_documents_status | CHECK | CHECK (document_status::text = ANY (ARRAY['draft'::character varying::text, 'imported'::character varying::text, 'analyzed'::character varying::text, 'generated'::character varying::text, 'updated_from_platform'::character varying::text, 'requires_validation'::character varying::text, 'in_review'::character varying::text, 'approved'::character varying::text,... |
| public | audit_package_documents | audit_package_documents_approved_by_fkey | FOREIGN KEY | FOREIGN KEY (approved_by) REFERENCES users(id) |
| public | audit_package_documents | audit_package_documents_audit_id_fkey | FOREIGN KEY | FOREIGN KEY (audit_id) REFERENCES audits(id) |
| public | audit_package_documents | audit_package_documents_created_by_fkey | FOREIGN KEY | FOREIGN KEY (created_by) REFERENCES users(id) |
| public | audit_package_documents | audit_package_documents_package_id_fkey | FOREIGN KEY | FOREIGN KEY (package_id) REFERENCES audit_preparation_packages(id) ON DELETE CASCADE |
| public | audit_package_documents | audit_package_documents_prepared_by_fkey | FOREIGN KEY | FOREIGN KEY (prepared_by) REFERENCES users(id) |
| public | audit_package_documents | audit_package_documents_reviewed_by_fkey | FOREIGN KEY | FOREIGN KEY (reviewed_by) REFERENCES users(id) |
| public | audit_package_documents | audit_package_documents_source_document_id_fkey | FOREIGN KEY | FOREIGN KEY (source_document_id) REFERENCES audit_package_documents(id) ON DELETE SET NULL |
| public | audit_package_documents | audit_package_documents_supersedes_document_id_fkey | FOREIGN KEY | FOREIGN KEY (supersedes_document_id) REFERENCES audit_package_documents(id) ON DELETE SET NULL |
| public | audit_package_documents | audit_package_documents_template_id_fkey | FOREIGN KEY | FOREIGN KEY (template_id) REFERENCES audit_document_templates(id) |
| public | audit_package_documents | audit_package_documents_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | audit_package_documents | audit_package_documents_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_preparation_packages | chk_audit_preparation_packages_source | CHECK | CHECK (package_source::text = ANY (ARRAY['generated'::character varying::text, 'uploaded_zip'::character varying::text, 'uploaded_zip_updated'::character varying::text])) |
| public | audit_preparation_packages | chk_audit_preparation_packages_status | CHECK | CHECK (status::text = ANY (ARRAY['draft'::character varying::text, 'in_review'::character varying::text, 'approved'::character varying::text, 'exported'::character varying::text, 'archived'::character varying::text])) |
| public | audit_preparation_packages | chk_audit_preparation_packages_year | CHECK | CHECK (period_year >= 2000 AND period_year <= 2100) |
| public | audit_preparation_packages | audit_preparation_packages_audit_id_fkey | FOREIGN KEY | FOREIGN KEY (audit_id) REFERENCES audits(id) |
| public | audit_preparation_packages | audit_preparation_packages_generated_by_fkey | FOREIGN KEY | FOREIGN KEY (generated_by) REFERENCES users(id) |
| public | audit_preparation_packages | audit_preparation_packages_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | audit_preparation_packages | audit_preparation_packages_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audit_uploaded_zip_files | chk_audit_uploaded_zip_files_status | CHECK | CHECK (analysis_status::text = ANY (ARRAY['pending'::character varying::text, 'analyzed'::character varying::text, 'updated'::character varying::text, 'failed'::character varying::text])) |
| public | audit_uploaded_zip_files | chk_audit_uploaded_zip_files_year | CHECK | CHECK (period_year IS NULL OR period_year >= 2000 AND period_year <= 2100) |
| public | audit_uploaded_zip_files | audit_uploaded_zip_files_audit_id_fkey | FOREIGN KEY | FOREIGN KEY (audit_id) REFERENCES audits(id) |
| public | audit_uploaded_zip_files | audit_uploaded_zip_files_created_by_fkey | FOREIGN KEY | FOREIGN KEY (created_by) REFERENCES users(id) |
| public | audit_uploaded_zip_files | audit_uploaded_zip_files_package_id_fkey | FOREIGN KEY | FOREIGN KEY (package_id) REFERENCES audit_preparation_packages(id) ON DELETE SET NULL |
| public | audit_uploaded_zip_files | audit_uploaded_zip_files_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | audit_uploaded_zip_files | audit_uploaded_zip_files_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | audits | audits_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | clauses | clauses_standard_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_id) REFERENCES standards(id) ON DELETE CASCADE |
| public | clauses | clauses_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | control_health_scores | fk_control_health_scores_tenant | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | control_health_scores | fk_control_health_scores_tenant_control | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES tenant_controls(id) ON DELETE CASCADE |
| public | control_health_scores | control_health_scores_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | control_health_scores | control_health_scores_tenant_control_id_key | UNIQUE | UNIQUE (tenant_control_id) |
| public | control_health_scores_v2_preview | control_health_scores_v2_preview_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | control_health_scores_v2_preview | control_health_scores_v2_preview_tenant_control_id_key | UNIQUE | UNIQUE (tenant_control_id) |
| public | control_soa | chk_control_soa_status | CHECK | CHECK (implementation_status = ANY (ARRAY['pendiente'::text, 'implementado'::text, 'parcial'::text, 'no implementado'::text, 'no aplica'::text])) |
| public | control_soa | control_soa_tenant_control_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES controls(id) ON DELETE CASCADE |
| public | control_soa | control_soa_pkey | PRIMARY KEY | PRIMARY KEY (tenant_control_id) |
| public | controls | fk_controls_catalog_control | FOREIGN KEY | FOREIGN KEY (catalog_control_id) REFERENCES controls_catalog(id) ON DELETE SET NULL |
| public | controls | controls_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | controls_catalog | chk_controls_catalog_source_type | CHECK | CHECK (source_type = ANY (ARRAY['generic'::text, 'personalized'::text])) |
| public | controls_catalog | fk_controls_catalog_base_control | FOREIGN KEY | FOREIGN KEY (base_control_id) REFERENCES controls_catalog(id) ON DELETE SET NULL |
| public | controls_catalog | fk_controls_catalog_tenant | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | controls_catalog | controls_catalog_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | controls_catalog_standards | controls_catalog_standards_control_id_fkey | FOREIGN KEY | FOREIGN KEY (control_id) REFERENCES controls_catalog(id) ON DELETE CASCADE |
| public | controls_catalog_standards | controls_catalog_standards_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | controls_catalog_standards | controls_catalog_standards_control_standard_key | UNIQUE | UNIQUE (control_id, standard_code) |
| public | dealer_requests | chk_dealer_requests_status | CHECK | CHECK (request_status = ANY (ARRAY['open'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])) |
| public | dealer_requests | dealer_requests_dealer_user_id_fkey | FOREIGN KEY | FOREIGN KEY (dealer_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | dealer_requests | dealer_requests_reviewed_by_fkey | FOREIGN KEY | FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL |
| public | dealer_requests | dealer_requests_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL |
| public | dealer_requests | dealer_requests_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | dealer_tenant_access | dealer_tenant_access_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | dealer_tenant_access | dealer_tenant_access_dealer_user_id_tenant_id_key | UNIQUE | UNIQUE (dealer_user_id, tenant_id) |
| public | dealer_tenants | chk_dealer_tenants_status | CHECK | CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'revoked'::text])) |
| public | dealer_tenants | dealer_tenants_assigned_by_fkey | FOREIGN KEY | FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL |
| public | dealer_tenants | dealer_tenants_dealer_user_id_fkey | FOREIGN KEY | FOREIGN KEY (dealer_user_id) REFERENCES users(id) ON DELETE CASCADE |
| public | dealer_tenants | dealer_tenants_revoked_by_fkey | FOREIGN KEY | FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL |
| public | dealer_tenants | dealer_tenants_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | dealer_tenants | dealer_tenants_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | dealer_tenants | dealer_tenants_dealer_user_id_tenant_id_key | UNIQUE | UNIQUE (dealer_user_id, tenant_id) |
| public | document_ai_analysis | document_ai_analysis_document_id_fkey | FOREIGN KEY | FOREIGN KEY (document_id) REFERENCES document_index(id) ON DELETE CASCADE |
| public | document_ai_analysis | document_ai_analysis_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | document_association_suggestions | document_association_suggestions_status_check | CHECK | CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'approved'::character varying::text, 'rejected'::character varying::text, 'superseded'::character varying::text])) |
| public | document_association_suggestions | document_association_suggestions_target_type_check | CHECK | CHECK (target_type::text = ANY (ARRAY['control'::character varying::text, 'evidence'::character varying::text, 'risk'::character varying::text, 'finding'::character varying::text, 'nonconformity'::character varying::text, 'audit'::character varying::text, 'action_plan'::character varying::text, 'asset'::character varying::text, 'lifecycle'::character varying... |
| public | document_association_suggestions | document_association_suggestions_document_id_fkey | FOREIGN KEY | FOREIGN KEY (document_id) REFERENCES document_index(id) ON DELETE CASCADE |
| public | document_association_suggestions | document_association_suggestions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | document_index | document_index_provider_check | CHECK | CHECK (provider::text = ANY (ARRAY['google_drive'::character varying, 'zoho_workdrive'::character varying, 'microsoft_graph'::character varying, 'onedrive'::character varying, 'sharepoint'::character varying, 'local_agent'::character varying, 'mounted_share'::character varying, 'manual_upload'::character varying]::text[])) |
| public | document_index | document_index_status_check | CHECK | CHECK (status::text = ANY (ARRAY['indexed'::character varying::text, 'updated'::character varying::text, 'missing'::character varying::text, 'ignored'::character varying::text, 'error'::character varying::text, 'pending_analysis'::character varying::text, 'analyzed'::character varying::text])) |
| public | document_index | document_index_integration_id_fkey | FOREIGN KEY | FOREIGN KEY (integration_id) REFERENCES tenant_integrations(id) ON DELETE SET NULL |
| public | document_index | document_index_source_id_fkey | FOREIGN KEY | FOREIGN KEY (source_id) REFERENCES tenant_document_sources(id) ON DELETE CASCADE |
| public | document_index | document_index_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | document_index | document_index_unique_provider_file | UNIQUE | UNIQUE (tenant_id, provider, provider_file_id) |
| public | document_sync_logs | document_sync_logs_status_check | CHECK | CHECK (status::text = ANY (ARRAY['started'::character varying::text, 'completed'::character varying::text, 'completed_with_warnings'::character varying::text, 'failed'::character varying::text])) |
| public | document_sync_logs | document_sync_logs_integration_id_fkey | FOREIGN KEY | FOREIGN KEY (integration_id) REFERENCES tenant_integrations(id) ON DELETE SET NULL |
| public | document_sync_logs | document_sync_logs_source_id_fkey | FOREIGN KEY | FOREIGN KEY (source_id) REFERENCES tenant_document_sources(id) ON DELETE SET NULL |
| public | document_sync_logs | document_sync_logs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidence_ai_assessments | evidence_ai_assessments_analysis_status_check | CHECK | CHECK (analysis_status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'completed_with_warnings'::text, 'pending_retry'::text, 'failed'::text])) |
| public | evidence_ai_assessments | evidence_ai_assessments_contribution_level_check | CHECK | CHECK (contribution_level = ANY (ARRAY['alto'::text, 'medio'::text, 'bajo'::text, 'indeterminado'::text])) |
| public | evidence_ai_assessments | evidence_ai_assessments_validity_result_check | CHECK | CHECK (validity_result = ANY (ARRAY['valida'::text, 'parcial'::text, 'debil'::text, 'no_valida'::text, 'sin_determinar'::text])) |
| public | evidence_ai_assessments | evidence_ai_assessments_duplicate_of_evidence_id_fkey | FOREIGN KEY | FOREIGN KEY (duplicate_of_evidence_id) REFERENCES evidences(id) ON DELETE SET NULL |
| public | evidence_ai_assessments | evidence_ai_assessments_evidence_id_fkey | FOREIGN KEY | FOREIGN KEY (evidence_id) REFERENCES evidences(id) ON DELETE CASCADE |
| public | evidence_ai_assessments | evidence_ai_assessments_extract_id_fkey | FOREIGN KEY | FOREIGN KEY (extract_id) REFERENCES evidence_document_extracts(id) ON DELETE SET NULL |
| public | evidence_ai_assessments | evidence_ai_assessments_recommended_control_id_fkey | FOREIGN KEY | FOREIGN KEY (recommended_control_id) REFERENCES controls_catalog(id) ON DELETE SET NULL |
| public | evidence_ai_assessments | evidence_ai_assessments_recommended_operation_id_fkey | FOREIGN KEY | FOREIGN KEY (recommended_operation_id) REFERENCES tenant_operations(id) ON DELETE SET NULL |
| public | evidence_ai_assessments | evidence_ai_assessments_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | evidence_ai_assessments | evidence_ai_assessments_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidence_ai_jobs | evidence_ai_jobs_job_type_check | CHECK | CHECK (job_type = ANY (ARRAY['extract_document'::text, 'analyze_evidence'::text, 'build_chunks'::text, 'push_learning'::text])) |
| public | evidence_ai_jobs | evidence_ai_jobs_status_check | CHECK | CHECK (status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'retry'::text, 'completed'::text, 'completed_with_warnings'::text, 'failed'::text, 'cancelled'::text])) |
| public | evidence_ai_jobs | evidence_ai_jobs_created_by_fkey | FOREIGN KEY | FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL |
| public | evidence_ai_jobs | evidence_ai_jobs_evidence_id_fkey | FOREIGN KEY | FOREIGN KEY (evidence_id) REFERENCES evidences(id) ON DELETE CASCADE |
| public | evidence_ai_jobs | evidence_ai_jobs_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | evidence_ai_jobs | evidence_ai_jobs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidence_document_extracts | evidence_document_extracts_extraction_status_check | CHECK | CHECK (extraction_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'completed_with_ocr'::text, 'limited'::text, 'unsupported'::text, 'failed'::text])) |
| public | evidence_document_extracts | evidence_document_extracts_evidence_id_fkey | FOREIGN KEY | FOREIGN KEY (evidence_id) REFERENCES evidences(id) ON DELETE CASCADE |
| public | evidence_document_extracts | evidence_document_extracts_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | evidence_document_extracts | evidence_document_extracts_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidence_document_links | evidence_document_links_document_id_fkey | FOREIGN KEY | FOREIGN KEY (document_id) REFERENCES document_index(id) ON DELETE CASCADE |
| public | evidence_document_links | evidence_document_links_evidence_id_fkey | FOREIGN KEY | FOREIGN KEY (evidence_id) REFERENCES evidences(id) ON DELETE CASCADE |
| public | evidence_document_links | evidence_document_links_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidence_document_links | evidence_document_links_unique | UNIQUE | UNIQUE (evidence_id, document_id) |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_embedding_status_check | CHECK | CHECK (embedding_status = ANY (ARRAY['pending'::text, 'generated'::text, 'failed'::text, 'externalized'::text])) |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (assessment_id) REFERENCES evidence_ai_assessments(id) ON DELETE SET NULL |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_control_id_fkey | FOREIGN KEY | FOREIGN KEY (control_id) REFERENCES controls_catalog(id) ON DELETE SET NULL |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_evidence_id_fkey | FOREIGN KEY | FOREIGN KEY (evidence_id) REFERENCES evidences(id) ON DELETE CASCADE |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_extract_id_fkey | FOREIGN KEY | FOREIGN KEY (extract_id) REFERENCES evidence_document_extracts(id) ON DELETE SET NULL |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_operation_id_fkey | FOREIGN KEY | FOREIGN KEY (operation_id) REFERENCES tenant_operations(id) ON DELETE SET NULL |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_tenant_control_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES tenant_controls(id) ON DELETE SET NULL |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | evidence_knowledge_chunks | evidence_knowledge_chunks_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidence_tenant_control_migration_log | evidence_tenant_control_migration_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidences | fk_evidences_tenant_control | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES tenant_controls(id) ON DELETE CASCADE |
| public | evidences | evidences_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | evidences_backup_history | evidences_backup_history_pkey | PRIMARY KEY | PRIMARY KEY (backup_id) |
| public | findings | chk_findings_severity | CHECK | CHECK (severity = ANY (ARRAY['alta'::text, 'media'::text, 'baja'::text])) |
| public | findings | chk_findings_source_type | CHECK | CHECK (source_type = ANY (ARRAY['manual'::text, 'audit'::text, 'diagnostic'::text, 'risk'::text, 'soa'::text, 'ia'::text, 'evidence'::text])) |
| public | findings | chk_findings_status | CHECK | CHECK (status = ANY (ARRAY['abierto'::text, 'en revision'::text, 'accion definida'::text, 'cerrado'::text])) |
| public | findings | chk_findings_type | CHECK | CHECK (finding_type = ANY (ARRAY['no conformidad'::text, 'observacion'::text, 'oportunidad de mejora'::text, 'fortaleza'::text])) |
| public | findings | findings_iso_code_fkey | FOREIGN KEY | FOREIGN KEY (iso_code) REFERENCES standards(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| public | findings | findings_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | findings | fk_findings_asset | FOREIGN KEY | FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL |
| public | findings | fk_findings_audit | FOREIGN KEY | FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE SET NULL |
| public | findings | fk_findings_nonconformity | FOREIGN KEY | FOREIGN KEY (nonconformity_id) REFERENCES tenant_nonconformities(id) ON DELETE SET NULL |
| public | findings | fk_findings_tenant_control | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES controls(id) ON DELETE SET NULL |
| public | findings | findings_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_ai_guidance | iso_ai_guidance_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_ai_guidance | iso_ai_guidance_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_audit_questions | chk_iso_audit_questions_severity | CHECK | CHECK (severity_if_missing = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text, 'critica'::text])) |
| public | iso_audit_questions | iso_audit_questions_clause_id_fkey | FOREIGN KEY | FOREIGN KEY (clause_id) REFERENCES iso_clauses(id) |
| public | iso_audit_questions | iso_audit_questions_control_id_fkey | FOREIGN KEY | FOREIGN KEY (control_id) REFERENCES iso_controls(id) |
| public | iso_audit_questions | iso_audit_questions_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_audit_questions | iso_audit_questions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_catalog_sync_status | chk_iso_catalog_sync_status_status | CHECK | CHECK (sync_status = ANY (ARRAY['not_started'::text, 'partial'::text, 'complete'::text, 'needs_review'::text])) |
| public | iso_catalog_sync_status | iso_catalog_sync_status_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_catalog_sync_status | ux_iso_catalog_sync_status | UNIQUE | UNIQUE (standard_code, version_code, sync_target) |
| public | iso_clause_guides | iso_clause_guides_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_clause_guides | iso_clause_guides_iso_clause_key | UNIQUE | UNIQUE (iso, clause) |
| public | iso_clauses | iso_clauses_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_clauses | iso_clauses_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_clauses | ux_iso_clauses_code | UNIQUE | UNIQUE (standard_code, version_code, clause_code) |
| public | iso_control_catalog_links | chk_iso_control_catalog_links_confidence | CHECK | CHECK (confidence >= 0::numeric AND confidence <= 1::numeric) |
| public | iso_control_catalog_links | chk_iso_control_catalog_links_relationship | CHECK | CHECK (relationship_type = ANY (ARRAY['equivalent'::text, 'partial'::text, 'supports'::text, 'related'::text, 'transition'::text, 'legacy_catalog'::text])) |
| public | iso_control_catalog_links | iso_control_catalog_links_catalog_control_id_fkey | FOREIGN KEY | FOREIGN KEY (catalog_control_id) REFERENCES controls_catalog(id) |
| public | iso_control_catalog_links | iso_control_catalog_links_iso_control_id_fkey | FOREIGN KEY | FOREIGN KEY (iso_control_id) REFERENCES iso_controls(id) |
| public | iso_control_catalog_links | iso_control_catalog_links_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_control_catalog_links | ux_iso_control_catalog_links | UNIQUE | UNIQUE (iso_control_id, catalog_control_id) |
| public | iso_control_mapping_apply_log | iso_control_mapping_apply_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_control_mappings | iso_control_mappings_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_control_mappings | ux_iso_control_mappings | UNIQUE | UNIQUE (source_standard_code, source_version_code, source_control_code, target_standard_code, target_version_code, target_control_code) |
| public | iso_controls | chk_iso_controls_priority | CHECK | CHECK (default_priority = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text, 'critica'::text])) |
| public | iso_controls | iso_controls_clause_id_fkey | FOREIGN KEY | FOREIGN KEY (clause_id) REFERENCES iso_clauses(id) |
| public | iso_controls | iso_controls_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_controls | iso_controls_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_controls | ux_iso_controls_code | UNIQUE | UNIQUE (standard_code, version_code, control_code) |
| public | iso_document_audit_log | iso_document_audit_log_document_id_fkey | FOREIGN KEY | FOREIGN KEY (document_id) REFERENCES iso_generated_documents(id) |
| public | iso_document_audit_log | iso_document_audit_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_document_generation_runs | iso_document_generation_runs_requested_by_fkey | FOREIGN KEY | FOREIGN KEY (requested_by) REFERENCES users(id) |
| public | iso_document_generation_runs | iso_document_generation_runs_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | iso_document_generation_runs | iso_document_generation_runs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_evidence_expectations | chk_iso_evidence_expectations_required_level | CHECK | CHECK (required_level = ANY (ARRAY['mandatory'::text, 'recommended'::text, 'optional'::text])) |
| public | iso_evidence_expectations | iso_evidence_expectations_control_id_fkey | FOREIGN KEY | FOREIGN KEY (control_id) REFERENCES iso_controls(id) |
| public | iso_evidence_expectations | iso_evidence_expectations_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_evidence_expectations | iso_evidence_expectations_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_express_assessment_answers | iso_express_assessment_answers_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (assessment_id) REFERENCES iso_express_assessments(id) ON DELETE CASCADE |
| public | iso_express_assessment_answers | iso_express_assessment_answers_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_express_assessment_audit_log | iso_express_assessment_audit_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_express_assessment_gaps | iso_express_assessment_gaps_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (assessment_id) REFERENCES iso_express_assessments(id) ON DELETE CASCADE |
| public | iso_express_assessment_gaps | iso_express_assessment_gaps_iso_control_id_fkey | FOREIGN KEY | FOREIGN KEY (iso_control_id) REFERENCES iso_controls(id) |
| public | iso_express_assessment_gaps | iso_express_assessment_gaps_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_express_assessment_items | iso_express_assessment_items_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (assessment_id) REFERENCES iso_express_assessments(id) ON DELETE CASCADE |
| public | iso_express_assessment_items | iso_express_assessment_items_iso_control_id_fkey | FOREIGN KEY | FOREIGN KEY (iso_control_id) REFERENCES iso_controls(id) |
| public | iso_express_assessment_items | iso_express_assessment_items_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_express_assessments | chk_iso_express_assessment_status | CHECK | CHECK (assessment_status = ANY (ARRAY['draft'::text, 'calculated'::text, 'reviewed'::text, 'archived'::text, 'error'::text])) |
| public | iso_express_assessments | chk_iso_express_assessment_type | CHECK | CHECK (assessment_type = ANY (ARRAY['express'::text, 'transition_readiness'::text, 'certification_readiness'::text])) |
| public | iso_express_assessments | iso_express_assessments_requested_by_fkey | FOREIGN KEY | FOREIGN KEY (requested_by) REFERENCES users(id) |
| public | iso_express_assessments | iso_express_assessments_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | iso_express_assessments | iso_express_assessments_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_gap_rules | chk_iso_gap_rules_severity | CHECK | CHECK (severity = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text, 'critica'::text])) |
| public | iso_gap_rules | iso_gap_rules_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_gap_rules | iso_gap_rules_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_gap_rules | ux_iso_gap_rules | UNIQUE | UNIQUE (standard_code, version_code, rule_code) |
| public | iso_generated_document_sections | iso_generated_document_sections_document_id_fkey | FOREIGN KEY | FOREIGN KEY (document_id) REFERENCES iso_generated_documents(id) ON DELETE CASCADE |
| public | iso_generated_document_sections | iso_generated_document_sections_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_generated_documents | chk_iso_generated_document_status | CHECK | CHECK (document_status = ANY (ARRAY['draft'::text, 'generated'::text, 'reviewed'::text, 'approved'::text, 'archived'::text])) |
| public | iso_generated_documents | chk_iso_generated_document_type | CHECK | CHECK (document_type = ANY (ARRAY['policy'::text, 'procedure'::text, 'transition_guidance'::text, 'ai_governance_document'::text, 'security_document'::text, 'quality_document'::text])) |
| public | iso_generated_documents | iso_generated_documents_approved_by_fkey | FOREIGN KEY | FOREIGN KEY (approved_by) REFERENCES users(id) |
| public | iso_generated_documents | iso_generated_documents_archived_by_fkey | FOREIGN KEY | FOREIGN KEY (archived_by) REFERENCES users(id) |
| public | iso_generated_documents | iso_generated_documents_generated_by_fkey | FOREIGN KEY | FOREIGN KEY (generated_by) REFERENCES users(id) |
| public | iso_generated_documents | iso_generated_documents_source_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (source_assessment_id) REFERENCES iso_express_assessments(id) |
| public | iso_generated_documents | iso_generated_documents_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | iso_generated_documents | iso_generated_documents_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_maturity_rules | chk_iso_maturity_rules_level | CHECK | CHECK (maturity_level >= 1 AND maturity_level <= 5) |
| public | iso_maturity_rules | chk_iso_maturity_rules_score | CHECK | CHECK (min_score >= 0::numeric AND max_score <= 100::numeric AND min_score <= max_score) |
| public | iso_maturity_rules | iso_maturity_rules_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_maturity_rules | iso_maturity_rules_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_operational_suggestion_audit_log | iso_operational_suggestion_audit_log_actor_user_id_fkey | FOREIGN KEY | FOREIGN KEY (actor_user_id) REFERENCES users(id) |
| public | iso_operational_suggestion_audit_log | iso_operational_suggestion_audit_log_suggestion_id_fkey | FOREIGN KEY | FOREIGN KEY (suggestion_id) REFERENCES iso_operational_suggestions(id) |
| public | iso_operational_suggestion_audit_log | iso_operational_suggestion_audit_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_operational_suggestions | chk_iso_operational_suggestions_priority | CHECK | CHECK (priority = ANY (ARRAY['critica'::text, 'alta'::text, 'media'::text, 'baja'::text])) |
| public | iso_operational_suggestions | chk_iso_operational_suggestions_status | CHECK | CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'applied'::text, 'rejected'::text, 'archived'::text, 'error'::text])) |
| public | iso_operational_suggestions | chk_iso_operational_suggestions_target | CHECK | CHECK (target_record_type = ANY (ARRAY['action_plan'::text, 'finding'::text, 'nonconformity'::text, 'evidence_request'::text])) |
| public | iso_operational_suggestions | iso_operational_suggestions_approved_by_fkey | FOREIGN KEY | FOREIGN KEY (approved_by) REFERENCES users(id) |
| public | iso_operational_suggestions | iso_operational_suggestions_created_by_fkey | FOREIGN KEY | FOREIGN KEY (created_by) REFERENCES users(id) |
| public | iso_operational_suggestions | iso_operational_suggestions_rejected_by_fkey | FOREIGN KEY | FOREIGN KEY (rejected_by) REFERENCES users(id) |
| public | iso_operational_suggestions | iso_operational_suggestions_tenant_control_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES tenant_controls(id) |
| public | iso_operational_suggestions | iso_operational_suggestions_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | iso_operational_suggestions | iso_operational_suggestions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_policy_templates | iso_policy_templates_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_policy_templates | iso_policy_templates_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_policy_templates | ux_iso_policy_templates | UNIQUE | UNIQUE (standard_code, version_code, template_code) |
| public | iso_procedure_templates | iso_procedure_templates_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_procedure_templates | iso_procedure_templates_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_procedure_templates | ux_iso_procedure_templates | UNIQUE | UNIQUE (standard_code, version_code, template_code) |
| public | iso_recommended_action_conversions | chk_iso_recommended_action_conversions_status | CHECK | CHECK (conversion_status = ANY (ARRAY['dry_run'::text, 'converted'::text, 'blocked'::text, 'failed'::text])) |
| public | iso_recommended_action_conversions | chk_iso_recommended_action_conversions_target_type | CHECK | CHECK (target_type = ANY (ARRAY['action_plan'::text, 'finding'::text, 'nonconformity'::text, 'evidence_request'::text, 'audit_task'::text, 'risk_mitigation'::text, 'control_review'::text])) |
| public | iso_recommended_action_conversions | iso_recommended_action_conversions_converted_by_fkey | FOREIGN KEY | FOREIGN KEY (converted_by) REFERENCES users(id) |
| public | iso_recommended_action_conversions | iso_recommended_action_conversions_recommendation_id_fkey | FOREIGN KEY | FOREIGN KEY (recommendation_id) REFERENCES iso_operational_suggestions(id) |
| public | iso_recommended_action_conversions | iso_recommended_action_conversions_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | iso_recommended_action_conversions | iso_recommended_action_conversions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_recommended_action_workflow_events | iso_recommended_action_workflow_event_type_chk | CHECK | CHECK (event_type = ANY (ARRAY['transition'::text, 'comment'::text, 'system_note'::text])) |
| public | iso_recommended_action_workflow_events | iso_recommended_action_workflow_status_chk | CHECK | CHECK (new_status = ANY (ARRAY['suggested'::text, 'approved'::text, 'converted'::text, 'in_progress'::text, 'blocked'::text, 'done'::text, 'rejected'::text, 'needs_review'::text, 'pending'::text, 'applied'::text, 'archived'::text, 'error'::text])) |
| public | iso_recommended_action_workflow_events | iso_recommended_action_workflow_events_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_risk_matrix_actions | iso_risk_matrix_actions_risk_item_id_fkey | FOREIGN KEY | FOREIGN KEY (risk_item_id) REFERENCES iso_risk_matrix_items(id) ON DELETE CASCADE |
| public | iso_risk_matrix_actions | iso_risk_matrix_actions_run_id_fkey | FOREIGN KEY | FOREIGN KEY (run_id) REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE |
| public | iso_risk_matrix_actions | iso_risk_matrix_actions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_risk_matrix_audit_log | iso_risk_matrix_audit_log_actor_user_id_fkey | FOREIGN KEY | FOREIGN KEY (actor_user_id) REFERENCES users(id) |
| public | iso_risk_matrix_audit_log | iso_risk_matrix_audit_log_risk_item_id_fkey | FOREIGN KEY | FOREIGN KEY (risk_item_id) REFERENCES iso_risk_matrix_items(id) |
| public | iso_risk_matrix_audit_log | iso_risk_matrix_audit_log_run_id_fkey | FOREIGN KEY | FOREIGN KEY (run_id) REFERENCES iso_risk_matrix_runs(id) |
| public | iso_risk_matrix_audit_log | iso_risk_matrix_audit_log_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_confidence | CHECK | CHECK (confidence >= 0::numeric AND confidence <= 1::numeric) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_impact | CHECK | CHECK (impact >= 1 AND impact <= 5) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_inherent_level | CHECK | CHECK (inherent_risk_level = ANY (ARRAY['bajo'::text, 'medio'::text, 'alto'::text, 'critico'::text])) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_likelihood | CHECK | CHECK (likelihood >= 1 AND likelihood <= 5) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_residual_impact | CHECK | CHECK (residual_impact >= 1 AND residual_impact <= 5) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_residual_level | CHECK | CHECK (residual_risk_level = ANY (ARRAY['bajo'::text, 'medio'::text, 'alto'::text, 'critico'::text])) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_residual_likelihood | CHECK | CHECK (residual_likelihood >= 1 AND residual_likelihood <= 5) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_status | CHECK | CHECK (status = ANY (ARRAY['suggested'::text, 'accepted'::text, 'rejected'::text, 'needs_review'::text, 'archived'::text])) |
| public | iso_risk_matrix_items | chk_iso_risk_matrix_items_treatment | CHECK | CHECK (treatment_strategy = ANY (ARRAY['mitigar'::text, 'aceptar'::text, 'transferir'::text, 'evitar'::text, 'monitorear'::text])) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_asset_id_fkey | FOREIGN KEY | FOREIGN KEY (asset_id) REFERENCES assets(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_catalog_control_id_fkey | FOREIGN KEY | FOREIGN KEY (catalog_control_id) REFERENCES controls_catalog(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_iso_control_id_fkey | FOREIGN KEY | FOREIGN KEY (iso_control_id) REFERENCES iso_controls(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_reviewer_user_id_fkey | FOREIGN KEY | FOREIGN KEY (reviewer_user_id) REFERENCES users(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_risk_template_id_fkey | FOREIGN KEY | FOREIGN KEY (risk_template_id) REFERENCES iso_risk_templates(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_run_id_fkey | FOREIGN KEY | FOREIGN KEY (run_id) REFERENCES iso_risk_matrix_runs(id) ON DELETE CASCADE |
| public | iso_risk_matrix_items | iso_risk_matrix_items_source_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (source_assessment_id) REFERENCES iso_express_assessments(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_source_gap_id_fkey | FOREIGN KEY | FOREIGN KEY (source_gap_id) REFERENCES iso_express_assessment_gaps(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_tenant_control_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_control_id) REFERENCES tenant_controls(id) |
| public | iso_risk_matrix_items | iso_risk_matrix_items_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_risk_matrix_runs | chk_iso_risk_matrix_runs_status | CHECK | CHECK (run_status = ANY (ARRAY['draft'::text, 'completed'::text, 'reviewed'::text, 'archived'::text, 'error'::text])) |
| public | iso_risk_matrix_runs | chk_iso_risk_matrix_runs_type | CHECK | CHECK (run_type = ANY (ARRAY['automated'::text, 'manual_review'::text, 'transition_readiness'::text, 'asset_based'::text])) |
| public | iso_risk_matrix_runs | iso_risk_matrix_runs_requested_by_fkey | FOREIGN KEY | FOREIGN KEY (requested_by) REFERENCES users(id) |
| public | iso_risk_matrix_runs | iso_risk_matrix_runs_source_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (source_assessment_id) REFERENCES iso_express_assessments(id) |
| public | iso_risk_matrix_runs | iso_risk_matrix_runs_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | iso_risk_matrix_runs | iso_risk_matrix_runs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_risk_templates | chk_iso_risk_templates_impact | CHECK | CHECK (default_impact >= 1 AND default_impact <= 5) |
| public | iso_risk_templates | chk_iso_risk_templates_likelihood | CHECK | CHECK (default_likelihood >= 1 AND default_likelihood <= 5) |
| public | iso_risk_templates | iso_risk_templates_standard_version_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_version_id) REFERENCES iso_standard_versions(id) |
| public | iso_risk_templates | iso_risk_templates_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_risk_templates | ux_iso_risk_templates | UNIQUE | UNIQUE (standard_code, version_code, risk_code) |
| public | iso_standard_versions | chk_iso_standard_versions_publication_status | CHECK | CHECK (publication_status = ANY (ARRAY['published'::text, 'fdis'::text, 'draft'::text, 'transition_prep'::text, 'deprecated'::text])) |
| public | iso_standard_versions | iso_standard_versions_standard_id_fkey | FOREIGN KEY | FOREIGN KEY (standard_id) REFERENCES iso_standards(id) |
| public | iso_standard_versions | iso_standard_versions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_standard_versions | ux_iso_standard_versions_code_version | UNIQUE | UNIQUE (standard_code, version_code) |
| public | iso_standards | iso_standards_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_standards | iso_standards_standard_code_key | UNIQUE | UNIQUE (standard_code) |
| public | iso_transition_guidance | iso_transition_guidance_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | iso_transition_guidance | ux_iso_transition_guidance | UNIQUE | UNIQUE (source_standard_code, source_version_code, target_standard_code, target_version_code) |
| public | kpi_calculation_jobs | kpi_calculation_jobs_requested_by_fkey | FOREIGN KEY | FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL |
| public | kpi_calculation_jobs | kpi_calculation_jobs_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | kpi_calculation_jobs | kpi_calculation_jobs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_calculation_rules | kpi_calculation_rules_applies_to_standard_code_fkey | FOREIGN KEY | FOREIGN KEY (applies_to_standard_code) REFERENCES standards(code) ON DELETE CASCADE |
| public | kpi_calculation_rules | kpi_calculation_rules_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_calculation_rules | kpi_calculation_rules_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_custom_inputs | kpi_custom_inputs_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_custom_inputs | kpi_custom_inputs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_custom_inputs | uq_kpi_custom_input | UNIQUE | UNIQUE (kpi_id, input_key) |
| public | kpi_data_sources | kpi_data_sources_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_data_sources | kpi_data_sources_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_definitions | chk_kpi_standard_vs_tenant | CHECK | CHECK (is_standard = true AND tenant_id IS NULL OR is_standard = false) |
| public | kpi_definitions | kpi_definitions_created_by_fkey | FOREIGN KEY | FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL |
| public | kpi_definitions | kpi_definitions_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | kpi_definitions | kpi_definitions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_definitions | kpi_definitions_code_key | UNIQUE | UNIQUE (code) |
| public | kpi_dimensions_catalog | kpi_dimensions_catalog_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_dimensions_catalog | kpi_dimensions_catalog_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_dimensions_catalog | uq_kpi_dimension | UNIQUE | UNIQUE (kpi_id, dimension_type, dimension_key) |
| public | kpi_event_queue | kpi_event_queue_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | kpi_event_queue | kpi_event_queue_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_manual_values | kpi_manual_values_entered_by_fkey | FOREIGN KEY | FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL |
| public | kpi_manual_values | kpi_manual_values_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_manual_values | kpi_manual_values_standard_code_fkey | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES standards(code) ON DELETE SET NULL |
| public | kpi_manual_values | kpi_manual_values_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | kpi_manual_values | kpi_manual_values_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_snapshot_dimensions | kpi_snapshot_dimensions_snapshot_id_fkey | FOREIGN KEY | FOREIGN KEY (snapshot_id) REFERENCES kpi_snapshots(id) ON DELETE CASCADE |
| public | kpi_snapshot_dimensions | kpi_snapshot_dimensions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_snapshots | kpi_snapshots_calculation_rule_id_fkey | FOREIGN KEY | FOREIGN KEY (calculation_rule_id) REFERENCES kpi_calculation_rules(id) ON DELETE SET NULL |
| public | kpi_snapshots | kpi_snapshots_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_snapshots | kpi_snapshots_standard_code_fkey | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES standards(code) ON DELETE SET NULL |
| public | kpi_snapshots | kpi_snapshots_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | kpi_snapshots | kpi_snapshots_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_staging_import | kpi_staging_import_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_standard_mappings | kpi_standard_mappings_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_standard_mappings | kpi_standard_mappings_standard_code_fkey | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES standards(code) ON DELETE CASCADE |
| public | kpi_standard_mappings | kpi_standard_mappings_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_standard_mappings | uq_kpi_standard_mapping | UNIQUE | UNIQUE (kpi_id, standard_code) |
| public | kpi_thresholds | kpi_thresholds_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | kpi_thresholds | kpi_thresholds_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | kpi_thresholds | uq_kpi_thresholds_kpi | UNIQUE | UNIQUE (kpi_id) |
| public | lifecycle_stage_catalog | lifecycle_stage_catalog_pkey | PRIMARY KEY | PRIMARY KEY (stage_code) |
| public | management_objectives | management_objectives_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | management_objectives | management_objectives_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | nonconformities_catalog | nonconformities_catalog_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | notifications | notifications_level_check | CHECK | CHECK (level = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text])) |
| public | notifications | notifications_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | notifications | notifications_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | permissions | permissions_pkey | PRIMARY KEY | PRIMARY KEY (permission_key) |
| public | report_access_rules | report_access_rules_report_type_code_fkey | FOREIGN KEY | FOREIGN KEY (report_type_code) REFERENCES report_types(code) ON DELETE CASCADE |
| public | report_access_rules | report_access_rules_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | report_access_rules | report_access_rules_report_type_code_role_code_key | UNIQUE | UNIQUE (report_type_code, role_code) |
| public | report_exports | report_exports_report_type_code_fkey | FOREIGN KEY | FOREIGN KEY (report_type_code) REFERENCES report_types(code) |
| public | report_exports | report_exports_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | report_schedules | report_schedules_report_type_code_fkey | FOREIGN KEY | FOREIGN KEY (report_type_code) REFERENCES report_types(code) |
| public | report_schedules | report_schedules_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | report_types | report_types_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | report_types | report_types_code_key | UNIQUE | UNIQUE (code) |
| public | responses | responses_assessment_id_fkey | FOREIGN KEY | FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE |
| public | responses | responses_clause_id_fkey | FOREIGN KEY | FOREIGN KEY (clause_id) REFERENCES clauses(id) |
| public | responses | responses_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | role_permissions | role_permissions_permission_key_fkey | FOREIGN KEY | FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON UPDATE CASCADE ON DELETE CASCADE |
| public | role_permissions | role_permissions_role_key_fkey | FOREIGN KEY | FOREIGN KEY (role_key) REFERENCES app_roles(role_key) ON UPDATE CASCADE ON DELETE CASCADE |
| public | role_permissions | role_permissions_pkey | PRIMARY KEY | PRIMARY KEY (role_key, permission_key) |
| public | roles | roles_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | roles | roles_name_key | UNIQUE | UNIQUE (name) |
| public | saas_modules | saas_modules_pkey | PRIMARY KEY | PRIMARY KEY (module_key) |
| public | saas_monthly_prebilling | saas_monthly_prebilling_reviewed_by_user_id_fkey | FOREIGN KEY | FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | saas_monthly_prebilling | saas_monthly_prebilling_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | saas_monthly_prebilling | saas_monthly_prebilling_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | saas_monthly_prebilling | saas_monthly_prebilling_tenant_id_billing_month_key | UNIQUE | UNIQUE (tenant_id, billing_month) |
| public | saas_monthly_prebilling_lines | saas_monthly_prebilling_lines_prebilling_id_fkey | FOREIGN KEY | FOREIGN KEY (prebilling_id) REFERENCES saas_monthly_prebilling(id) ON DELETE CASCADE |
| public | saas_monthly_prebilling_lines | saas_monthly_prebilling_lines_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | saas_monthly_prebilling_lines | saas_monthly_prebilling_lines_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | saas_price_catalog | saas_price_catalog_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | saas_price_catalog | saas_price_catalog_item_type_item_key_key | UNIQUE | UNIQUE (item_type, item_key) |
| public | saas_quote_lines | saas_quote_lines_quote_id_fkey | FOREIGN KEY | FOREIGN KEY (quote_id) REFERENCES saas_quotes(id) ON DELETE CASCADE |
| public | saas_quote_lines | saas_quote_lines_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | saas_quotes | saas_quotes_created_by_user_id_fkey | FOREIGN KEY | FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | saas_quotes | saas_quotes_dealer_user_id_fkey | FOREIGN KEY | FOREIGN KEY (dealer_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | saas_quotes | saas_quotes_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL |
| public | saas_quotes | saas_quotes_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | saas_quotes | saas_quotes_quote_number_key | UNIQUE | UNIQUE (quote_number) |
| public | search_history | search_history_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | search_history | search_history_user_id_fkey | FOREIGN KEY | FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | search_history | search_history_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | standard_lifecycle_ai_feed | fk_standard_lifecycle_ai_feed_operation | FOREIGN KEY | FOREIGN KEY (operation_id) REFERENCES tenant_operations(id) ON DELETE CASCADE |
| public | standard_lifecycle_ai_feed | fk_standard_lifecycle_ai_feed_tenant | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | standard_lifecycle_ai_feed | standard_lifecycle_ai_feed_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | standard_lifecycle_snapshots | fk_standard_lifecycle_snapshots_operation | FOREIGN KEY | FOREIGN KEY (operation_id) REFERENCES tenant_operations(id) ON DELETE CASCADE |
| public | standard_lifecycle_snapshots | fk_standard_lifecycle_snapshots_tenant | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | standard_lifecycle_snapshots | standard_lifecycle_snapshots_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | standard_lifecycle_stage_requests | fk_lifecycle_request_operation | FOREIGN KEY | FOREIGN KEY (operation_id) REFERENCES tenant_operations(id) ON DELETE CASCADE |
| public | standard_lifecycle_stage_requests | fk_lifecycle_request_tenant | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | standard_lifecycle_stage_requests | standard_lifecycle_stage_requests_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | standard_lifecycle_status | fk_standard_lifecycle_status_operation | FOREIGN KEY | FOREIGN KEY (operation_id) REFERENCES tenant_operations(id) ON DELETE CASCADE |
| public | standard_lifecycle_status | fk_standard_lifecycle_status_tenant | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | standard_lifecycle_status | standard_lifecycle_status_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | standard_lifecycle_status | uq_standard_lifecycle_status | UNIQUE | UNIQUE (tenant_id, standard_code, operation_id) |
| public | standards | standards_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | standards | standards_code_key | UNIQUE | UNIQUE (code) |
| public | tcdx_async_jobs | tcdx_async_jobs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_applicability_exclusions | tenant_applicability_exclusions_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_applicability_exclusions | tenant_applicability_exclusions_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_applicability_profiles | tenant_applicability_profiles_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_applicability_profiles | tenant_applicability_profiles_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_applicability_runs | tenant_applicability_runs_created_by_fkey | FOREIGN KEY | FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL |
| public | tenant_applicability_runs | tenant_applicability_runs_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_applicability_runs | tenant_applicability_runs_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_applicable_controls | tenant_applicable_controls_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_applicable_controls | tenant_applicable_controls_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_applicable_evidence_requirements | tenant_applicable_evidence_requirements_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_applicable_evidence_requirements | tenant_applicable_evidence_requirements_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_applicable_kpis | tenant_applicable_kpis_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_applicable_kpis | tenant_applicable_kpis_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_billing_settings | tenant_billing_settings_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_billing_settings | tenant_billing_settings_tenant_id_key | UNIQUE | UNIQUE (tenant_id) |
| public | tenant_company_profiles | tenant_company_profiles_created_by_user_id_fkey | FOREIGN KEY | FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | tenant_company_profiles | tenant_company_profiles_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_company_profiles | tenant_company_profiles_updated_by_user_id_fkey | FOREIGN KEY | FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | tenant_company_profiles | tenant_company_profiles_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_contracts | chk_tenant_contract_status | CHECK | CHECK (contract_status IS NULL OR (contract_status = ANY (ARRAY['draft'::text, 'demo'::text, 'active'::text, 'paused'::text, 'suspended'::text, 'suspended_non_payment'::text, 'inactive'::text, 'expired'::text, 'cancelled'::text, 'canceled'::text, 'terminated'::text, 'decontracted'::text, 'demo_expired'::text]))) |
| public | tenant_contracts | tenant_contracts_commercial_owner_user_id_fkey | FOREIGN KEY | FOREIGN KEY (commercial_owner_user_id) REFERENCES users(id) ON DELETE SET NULL |
| public | tenant_contracts | tenant_contracts_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_contracts | tenant_contracts_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_controls | fk_tenant_controls_catalog | FOREIGN KEY | FOREIGN KEY (control_id) REFERENCES controls_catalog(id) ON DELETE CASCADE |
| public | tenant_controls | fk_tenant_controls_tenant | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_controls | tenant_controls_operation_id_fkey | FOREIGN KEY | FOREIGN KEY (operation_id) REFERENCES tenant_operations(id) ON DELETE CASCADE |
| public | tenant_controls | tenant_controls_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_document_provider_credentials | tenant_document_provider_credentials_provider_check | CHECK | CHECK (provider = ANY (ARRAY['google_drive'::text, 'zoho_workdrive'::text])) |
| public | tenant_document_provider_credentials | tenant_document_provider_credentials_source_id_fkey | FOREIGN KEY | FOREIGN KEY (source_id) REFERENCES tenant_document_sources(id) ON DELETE CASCADE |
| public | tenant_document_provider_credentials | tenant_document_provider_credentials_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_document_sources | tenant_document_sources_provider_check | CHECK | CHECK (provider::text = ANY (ARRAY['google_drive'::character varying, 'zoho_workdrive'::character varying, 'microsoft_graph'::character varying, 'onedrive'::character varying, 'sharepoint'::character varying, 'local_agent'::character varying, 'mounted_share'::character varying, 'manual_upload'::character varying]::text[])) |
| public | tenant_document_sources | tenant_document_sources_scan_frequency_check | CHECK | CHECK (scan_frequency::text = ANY (ARRAY['manual'::character varying::text, 'hourly'::character varying::text, 'daily'::character varying::text, 'weekly'::character varying::text])) |
| public | tenant_document_sources | tenant_document_sources_status_check | CHECK | CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'disconnected'::text, 'pending_agent'::text, 'error'::text])) |
| public | tenant_document_sources | tenant_document_sources_integration_id_fkey | FOREIGN KEY | FOREIGN KEY (integration_id) REFERENCES tenant_integrations(id) ON DELETE CASCADE |
| public | tenant_document_sources | tenant_document_sources_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_integrations | tenant_integrations_provider_check | CHECK | CHECK (provider::text = ANY (ARRAY['google_drive'::character varying, 'zoho_workdrive'::character varying, 'microsoft_graph'::character varying, 'onedrive'::character varying, 'sharepoint'::character varying, 'local_agent'::character varying, 'mounted_share'::character varying, 'manual_upload'::character varying]::text[])) |
| public | tenant_integrations | tenant_integrations_status_check | CHECK | CHECK (status::text = ANY (ARRAY['prepared'::character varying::text, 'connected'::character varying::text, 'error'::character varying::text, 'disabled'::character varying::text, 'disconnected'::character varying::text])) |
| public | tenant_integrations | tenant_integrations_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_kpi_settings | tenant_kpi_settings_kpi_id_fkey | FOREIGN KEY | FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE |
| public | tenant_kpi_settings | tenant_kpi_settings_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_kpi_settings | tenant_kpi_settings_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_kpi_settings | uq_tenant_kpi_settings | UNIQUE | UNIQUE (tenant_id, kpi_id) |
| public | tenant_module_settings | tenant_module_settings_disabled_by_fkey | FOREIGN KEY | FOREIGN KEY (disabled_by) REFERENCES users(id) ON DELETE SET NULL |
| public | tenant_module_settings | tenant_module_settings_enabled_by_fkey | FOREIGN KEY | FOREIGN KEY (enabled_by) REFERENCES users(id) ON DELETE SET NULL |
| public | tenant_module_settings | tenant_module_settings_module_key_fkey | FOREIGN KEY | FOREIGN KEY (module_key) REFERENCES saas_modules(module_key) ON UPDATE CASCADE ON DELETE RESTRICT |
| public | tenant_module_settings | tenant_module_settings_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_module_settings | tenant_module_settings_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_module_settings | tenant_module_settings_tenant_id_module_key_key | UNIQUE | UNIQUE (tenant_id, module_key) |
| public | tenant_monthly_preinvoices | tenant_monthly_preinvoices_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_nonconformities | tenant_nonconformities_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_operations | tenant_operations_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_operations | tenant_operations_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_standard_audit | tenant_standard_audit_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_standard_operations | tenant_standard_operations_operation_fkey | FOREIGN KEY | FOREIGN KEY (operation_id) REFERENCES tenant_operations(id) ON DELETE CASCADE |
| public | tenant_standard_operations | tenant_standard_operations_standard_fkey | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES standards(code) ON DELETE CASCADE |
| public | tenant_standard_operations | tenant_standard_operations_tenant_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_standard_operations | tenant_standard_operations_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_standard_operations | tenant_standard_operations_unique | UNIQUE | UNIQUE (tenant_id, standard_code, operation_id) |
| public | tenant_standards | chk_tenant_standards_catalog_mode | CHECK | CHECK (catalog_mode = ANY (ARRAY['generic'::text, 'personalized'::text, 'mixed'::text])) |
| public | tenant_standards | tenant_standards_standard_code_fkey | FOREIGN KEY | FOREIGN KEY (standard_code) REFERENCES standards(code) ON UPDATE CASCADE ON DELETE RESTRICT |
| public | tenant_standards | tenant_standards_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | tenant_standards | tenant_standards_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_standards | tenant_standards_tenant_id_standard_code_key | UNIQUE | UNIQUE (tenant_id, standard_code) |
| public | tenant_sync_agent_pairing_codes | tenant_sync_agent_pairing_codes_source_id_fkey | FOREIGN KEY | FOREIGN KEY (source_id) REFERENCES tenant_document_sources(id) ON DELETE CASCADE |
| public | tenant_sync_agent_pairing_codes | tenant_sync_agent_pairing_codes_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenant_sync_agents | tenant_sync_agents_status_check | CHECK | CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'revoked'::text, 'error'::text])) |
| public | tenant_sync_agents | tenant_sync_agents_source_id_fkey | FOREIGN KEY | FOREIGN KEY (source_id) REFERENCES tenant_document_sources(id) ON DELETE CASCADE |
| public | tenant_sync_agents | tenant_sync_agents_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | tenants | tenants_ai_enabled_plan_consistency_check | CHECK | CHECK (ai_enabled = false AND ai_plan = 'none'::text OR ai_enabled = true AND ai_plan <> 'none'::text) |
| public | tenants | tenants_ai_plan_check | CHECK | CHECK (ai_plan = ANY (ARRAY['none'::text, 'basic'::text, 'standard'::text, 'pro'::text, 'premium'::text, 'enterprise'::text])) |
| public | tenants | tenants_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | user_dashboard_preferences | chk_user_dashboard_preferences_key | CHECK | CHECK (dashboard_key = 'dashboard_v2'::text) |
| public | user_dashboard_preferences | chk_user_dashboard_preferences_layout_object | CHECK | CHECK (jsonb_typeof(layout_json) = 'object'::text) |
| public | user_dashboard_preferences | user_dashboard_preferences_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) |
| public | user_dashboard_preferences | user_dashboard_preferences_user_id_fkey | FOREIGN KEY | FOREIGN KEY (user_id) REFERENCES users(id) |
| public | user_dashboard_preferences | user_dashboard_preferences_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | user_roles | user_roles_role_id_fkey | FOREIGN KEY | FOREIGN KEY (role_id) REFERENCES roles(id) |
| public | user_roles | user_roles_user_id_fkey | FOREIGN KEY | FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE |
| public | user_roles | user_roles_pkey | PRIMARY KEY | PRIMARY KEY (user_id, role_id) |
| public | users | users_tenant_id_fkey | FOREIGN KEY | FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE |
| public | users | users_pkey | PRIMARY KEY | PRIMARY KEY (id) |
| public | users | users_email_key | UNIQUE | UNIQUE (email) |

## Not null/defaults estructurales relevantes
| Schema | Tabla | Constraint | Tipo | Definición |
| --- | --- | --- | --- | --- |
| ai_core | ai_core_migrations | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.ai_core_migrations_id_seq'::regclass) |
| ai_core | ai_core_migrations | migration_code_not_null | NOT NULL estructural | migration_code NOT NULL |
| ai_core | ai_core_migrations | description_not_null | NOT NULL estructural | description NOT NULL |
| ai_core | ai_core_migrations | applied_at_default | DEFAULT estructural | applied_at DEFAULT now() |
| ai_core | ai_feedback | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.ai_feedback_id_seq'::regclass) |
| ai_core | ai_feedback | suggestion_payload_default | DEFAULT estructural | suggestion_payload DEFAULT '{}'::jsonb |
| ai_core | ai_feedback | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | ai_response_feedback | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | ai_response_feedback | ai_response_not_null | NOT NULL estructural | ai_response NOT NULL DEFAULT '{}'::jsonb |
| ai_core | ai_response_feedback | user_corrected_response_not_null | NOT NULL estructural | user_corrected_response NOT NULL DEFAULT '{}'::jsonb |
| ai_core | ai_response_feedback | was_applied_not_null | NOT NULL estructural | was_applied NOT NULL DEFAULT false |
| ai_core | ai_response_feedback | was_corrected_not_null | NOT NULL estructural | was_corrected NOT NULL DEFAULT false |
| ai_core | ai_response_feedback | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | ai_response_feedback | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | ai_response_traces | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | ai_response_traces | question_not_null | NOT NULL estructural | question NOT NULL |
| ai_core | ai_response_traces | source_level_not_null | NOT NULL estructural | source_level NOT NULL DEFAULT 'best_effort'::text |
| ai_core | ai_response_traces | source_label_not_null | NOT NULL estructural | source_label NOT NULL DEFAULT 'Mejor esfuerzo controlado'::text |
| ai_core | ai_response_traces | confidence_not_null | NOT NULL estructural | confidence NOT NULL DEFAULT 'baja'::text |
| ai_core | ai_response_traces | tenant_hits_not_null | NOT NULL estructural | tenant_hits NOT NULL DEFAULT 0 |
| ai_core | ai_response_traces | knowledge_hits_not_null | NOT NULL estructural | knowledge_hits NOT NULL DEFAULT 0 |
| ai_core | ai_response_traces | benchmark_hits_not_null | NOT NULL estructural | benchmark_hits NOT NULL DEFAULT 0 |
| ai_core | ai_response_traces | external_hits_not_null | NOT NULL estructural | external_hits NOT NULL DEFAULT 0 |
| ai_core | ai_response_traces | used_tenant_internal_not_null | NOT NULL estructural | used_tenant_internal NOT NULL DEFAULT false |
| ai_core | ai_response_traces | used_tcdx_knowledge_not_null | NOT NULL estructural | used_tcdx_knowledge NOT NULL DEFAULT false |
| ai_core | ai_response_traces | used_anonymized_benchmark_not_null | NOT NULL estructural | used_anonymized_benchmark NOT NULL DEFAULT false |
| ai_core | ai_response_traces | used_external_lookup_not_null | NOT NULL estructural | used_external_lookup NOT NULL DEFAULT false |
| ai_core | ai_response_traces | must_review_by_human_not_null | NOT NULL estructural | must_review_by_human NOT NULL DEFAULT false |
| ai_core | ai_response_traces | answer_json_not_null | NOT NULL estructural | answer_json NOT NULL DEFAULT '{}'::jsonb |
| ai_core | ai_response_traces | sources_json_not_null | NOT NULL estructural | sources_json NOT NULL DEFAULT '[]'::jsonb |
| ai_core | ai_response_traces | trace_json_not_null | NOT NULL estructural | trace_json NOT NULL DEFAULT '{}'::jsonb |
| ai_core | ai_response_traces | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | ai_response_traces | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| ai_core | clause_control_domain_map | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.clause_control_domain_map_id_seq'::regclass) |
| ai_core | clause_control_domain_map | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| ai_core | clause_control_domain_map | clause_or_control_code_not_null | NOT NULL estructural | clause_or_control_code NOT NULL |
| ai_core | clause_control_domain_map | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | clause_control_domain_map | relevance_level_default | DEFAULT estructural | relevance_level DEFAULT 'media'::text |
| ai_core | clause_control_domain_map | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | clause_control_domain_map | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | clause_control_domain_map | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | clause_control_domain_map | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | closure_criteria | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.closure_criteria_id_seq'::regclass) |
| ai_core | closure_criteria | problem_type_code_not_null | NOT NULL estructural | problem_type_code NOT NULL |
| ai_core | closure_criteria | title_not_null | NOT NULL estructural | title NOT NULL |
| ai_core | closure_criteria | required_conditions_default | DEFAULT estructural | required_conditions DEFAULT '[]'::jsonb |
| ai_core | closure_criteria | validation_questions_default | DEFAULT estructural | validation_questions DEFAULT '[]'::jsonb |
| ai_core | closure_criteria | rejection_reasons_default | DEFAULT estructural | rejection_reasons DEFAULT '[]'::jsonb |
| ai_core | closure_criteria | requires_effectiveness_validation_default | DEFAULT estructural | requires_effectiveness_validation DEFAULT false |
| ai_core | closure_criteria | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | closure_criteria | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | closure_criteria | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | closure_criteria | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | domain_closure_criteria | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.domain_closure_criteria_id_seq'::regclass) |
| ai_core | domain_closure_criteria | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | domain_closure_criteria | title_not_null | NOT NULL estructural | title NOT NULL |
| ai_core | domain_closure_criteria | required_conditions_default | DEFAULT estructural | required_conditions DEFAULT '[]'::jsonb |
| ai_core | domain_closure_criteria | validation_questions_default | DEFAULT estructural | validation_questions DEFAULT '[]'::jsonb |
| ai_core | domain_closure_criteria | rejection_reasons_default | DEFAULT estructural | rejection_reasons DEFAULT '[]'::jsonb |
| ai_core | domain_closure_criteria | requires_effectiveness_validation_default | DEFAULT estructural | requires_effectiveness_validation DEFAULT false |
| ai_core | domain_closure_criteria | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | domain_closure_criteria | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | domain_closure_criteria | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | domain_closure_criteria | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | domain_evidence_expectations | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.domain_evidence_expectations_id_seq'::regclass) |
| ai_core | domain_evidence_expectations | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | domain_evidence_expectations | expected_deliverables_default | DEFAULT estructural | expected_deliverables DEFAULT '[]'::jsonb |
| ai_core | domain_evidence_expectations | minimum_content_default | DEFAULT estructural | minimum_content DEFAULT '[]'::jsonb |
| ai_core | domain_evidence_expectations | accepted_formats_default | DEFAULT estructural | accepted_formats DEFAULT '[]'::jsonb |
| ai_core | domain_evidence_expectations | invalid_evidence_default | DEFAULT estructural | invalid_evidence DEFAULT '[]'::jsonb |
| ai_core | domain_evidence_expectations | validation_criteria_default | DEFAULT estructural | validation_criteria DEFAULT '[]'::jsonb |
| ai_core | domain_evidence_expectations | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | domain_evidence_expectations | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | domain_evidence_expectations | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | domain_evidence_expectations | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | domain_problem_type_map | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.domain_problem_type_map_id_seq'::regclass) |
| ai_core | domain_problem_type_map | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | domain_problem_type_map | problem_type_code_not_null | NOT NULL estructural | problem_type_code NOT NULL |
| ai_core | domain_problem_type_map | relevance_level_default | DEFAULT estructural | relevance_level DEFAULT 'media'::text |
| ai_core | domain_problem_type_map | detection_keywords_default | DEFAULT estructural | detection_keywords DEFAULT '[]'::jsonb |
| ai_core | domain_problem_type_map | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | domain_problem_type_map | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | domain_problem_type_map | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | domain_problem_type_map | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | domain_solution_playbooks | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.domain_solution_playbooks_id_seq'::regclass) |
| ai_core | domain_solution_playbooks | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | domain_solution_playbooks | title_not_null | NOT NULL estructural | title NOT NULL |
| ai_core | domain_solution_playbooks | solution_steps_default | DEFAULT estructural | solution_steps DEFAULT '[]'::jsonb |
| ai_core | domain_solution_playbooks | corrective_actions_default | DEFAULT estructural | corrective_actions DEFAULT '[]'::jsonb |
| ai_core | domain_solution_playbooks | preventive_actions_default | DEFAULT estructural | preventive_actions DEFAULT '[]'::jsonb |
| ai_core | domain_solution_playbooks | closure_conditions_default | DEFAULT estructural | closure_conditions DEFAULT '[]'::jsonb |
| ai_core | domain_solution_playbooks | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | domain_solution_playbooks | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | domain_solution_playbooks | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | domain_solution_playbooks | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | domains_catalog | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.domains_catalog_id_seq'::regclass) |
| ai_core | domains_catalog | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | domains_catalog | domain_name_not_null | NOT NULL estructural | domain_name NOT NULL |
| ai_core | domains_catalog | is_transversal_default | DEFAULT estructural | is_transversal DEFAULT true |
| ai_core | domains_catalog | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | domains_catalog | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | domains_catalog | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | domains_catalog | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | evidence_expectations | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.evidence_expectations_id_seq'::regclass) |
| ai_core | evidence_expectations | problem_type_code_not_null | NOT NULL estructural | problem_type_code NOT NULL |
| ai_core | evidence_expectations | expected_deliverables_default | DEFAULT estructural | expected_deliverables DEFAULT '[]'::jsonb |
| ai_core | evidence_expectations | minimum_content_default | DEFAULT estructural | minimum_content DEFAULT '[]'::jsonb |
| ai_core | evidence_expectations | accepted_formats_default | DEFAULT estructural | accepted_formats DEFAULT '[]'::jsonb |
| ai_core | evidence_expectations | invalid_evidence_default | DEFAULT estructural | invalid_evidence DEFAULT '[]'::jsonb |
| ai_core | evidence_expectations | validation_criteria_default | DEFAULT estructural | validation_criteria DEFAULT '[]'::jsonb |
| ai_core | evidence_expectations | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | evidence_expectations | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | evidence_expectations | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | evidence_expectations | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | external_lookup_extra_charges | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | external_lookup_extra_charges | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| ai_core | external_lookup_extra_charges | billing_month_not_null | NOT NULL estructural | billing_month NOT NULL |
| ai_core | external_lookup_extra_charges | quantity_not_null | NOT NULL estructural | quantity NOT NULL DEFAULT 1 |
| ai_core | external_lookup_extra_charges | unit_price_not_null | NOT NULL estructural | unit_price NOT NULL DEFAULT 100 |
| ai_core | external_lookup_extra_charges | total_amount_not_null | NOT NULL estructural | total_amount NOT NULL DEFAULT 100 |
| ai_core | external_lookup_extra_charges | accepted_not_null | NOT NULL estructural | accepted NOT NULL DEFAULT true |
| ai_core | external_lookup_extra_charges | accepted_at_default | DEFAULT estructural | accepted_at DEFAULT now() |
| ai_core | external_lookup_extra_charges | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | external_lookup_extra_charges | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | external_lookup_logs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | external_lookup_logs | query_text_not_null | NOT NULL estructural | query_text NOT NULL |
| ai_core | external_lookup_logs | sources_requested_not_null | NOT NULL estructural | sources_requested NOT NULL DEFAULT '[]'::jsonb |
| ai_core | external_lookup_logs | sources_used_not_null | NOT NULL estructural | sources_used NOT NULL DEFAULT '[]'::jsonb |
| ai_core | external_lookup_logs | response_used_not_null | NOT NULL estructural | response_used NOT NULL DEFAULT false |
| ai_core | external_lookup_logs | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | external_lookup_logs | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | external_lookup_quota_audit | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | external_lookup_quota_audit | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| ai_core | external_lookup_quota_audit | new_monthly_limit_not_null | NOT NULL estructural | new_monthly_limit NOT NULL |
| ai_core | external_lookup_quota_audit | new_is_active_not_null | NOT NULL estructural | new_is_active NOT NULL DEFAULT true |
| ai_core | external_lookup_quota_audit | source_not_null | NOT NULL estructural | source NOT NULL DEFAULT 'admin_saas'::text |
| ai_core | external_lookup_quota_audit | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | external_lookup_quota_audit | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | external_lookup_quotas | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | external_lookup_quotas | monthly_limit_not_null | NOT NULL estructural | monthly_limit NOT NULL DEFAULT 100 |
| ai_core | external_lookup_quotas | is_default_not_null | NOT NULL estructural | is_default NOT NULL DEFAULT false |
| ai_core | external_lookup_quotas | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| ai_core | external_lookup_quotas | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | external_lookup_quotas | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | external_lookup_quotas | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | finding_scenarios | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | finding_scenarios | scenario_code_not_null | NOT NULL estructural | scenario_code NOT NULL |
| ai_core | finding_scenarios | scenario_name_not_null | NOT NULL estructural | scenario_name NOT NULL |
| ai_core | finding_scenarios | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | finding_scenarios | problem_type_code_not_null | NOT NULL estructural | problem_type_code NOT NULL |
| ai_core | finding_scenarios | detection_keywords_not_null | NOT NULL estructural | detection_keywords NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | negative_keywords_not_null | NOT NULL estructural | negative_keywords NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | example_titles_not_null | NOT NULL estructural | example_titles NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | example_descriptions_not_null | NOT NULL estructural | example_descriptions NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | solution_steps_not_null | NOT NULL estructural | solution_steps NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | expected_evidence_not_null | NOT NULL estructural | expected_evidence NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | minimum_evidence_content_not_null | NOT NULL estructural | minimum_evidence_content NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | invalid_evidence_not_null | NOT NULL estructural | invalid_evidence NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | closure_conditions_not_null | NOT NULL estructural | closure_conditions NOT NULL DEFAULT '[]'::jsonb |
| ai_core | finding_scenarios | requires_external_lookup_not_null | NOT NULL estructural | requires_external_lookup NOT NULL DEFAULT false |
| ai_core | finding_scenarios | priority_not_null | NOT NULL estructural | priority NOT NULL DEFAULT 50 |
| ai_core | finding_scenarios | confidence_boost_not_null | NOT NULL estructural | confidence_boost NOT NULL DEFAULT 0.15 |
| ai_core | finding_scenarios | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| ai_core | finding_scenarios | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | finding_scenarios | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | finding_scenarios | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | invalid_evidence_patterns | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.invalid_evidence_patterns_id_seq'::regclass) |
| ai_core | invalid_evidence_patterns | code_not_null | NOT NULL estructural | code NOT NULL |
| ai_core | invalid_evidence_patterns | name_not_null | NOT NULL estructural | name NOT NULL |
| ai_core | invalid_evidence_patterns | examples_default | DEFAULT estructural | examples DEFAULT '[]'::jsonb |
| ai_core | invalid_evidence_patterns | severity_default | DEFAULT estructural | severity DEFAULT 'media'::text |
| ai_core | invalid_evidence_patterns | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | invalid_evidence_patterns | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | invalid_evidence_patterns | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | invalid_evidence_patterns | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | priority_rules | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.priority_rules_id_seq'::regclass) |
| ai_core | priority_rules | code_not_null | NOT NULL estructural | code NOT NULL |
| ai_core | priority_rules | name_not_null | NOT NULL estructural | name NOT NULL |
| ai_core | priority_rules | weight_not_null | NOT NULL estructural | weight NOT NULL DEFAULT 10 |
| ai_core | priority_rules | applies_when_default | DEFAULT estructural | applies_when DEFAULT '{}'::jsonb |
| ai_core | priority_rules | priority_effect_default | DEFAULT estructural | priority_effect DEFAULT 'increase'::text |
| ai_core | priority_rules | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | priority_rules | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | priority_rules | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | priority_rules | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | problem_types | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.problem_types_id_seq'::regclass) |
| ai_core | problem_types | code_not_null | NOT NULL estructural | code NOT NULL |
| ai_core | problem_types | name_not_null | NOT NULL estructural | name NOT NULL |
| ai_core | problem_types | default_severity_default | DEFAULT estructural | default_severity DEFAULT 'media'::text |
| ai_core | problem_types | default_priority_weight_default | DEFAULT estructural | default_priority_weight DEFAULT 50 |
| ai_core | problem_types | applies_to_default | DEFAULT estructural | applies_to DEFAULT '{}'::text[] |
| ai_core | problem_types | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | problem_types | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | problem_types | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | problem_types | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | response_templates | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.response_templates_id_seq'::regclass) |
| ai_core | response_templates | code_not_null | NOT NULL estructural | code NOT NULL |
| ai_core | response_templates | name_not_null | NOT NULL estructural | name NOT NULL |
| ai_core | response_templates | response_type_not_null | NOT NULL estructural | response_type NOT NULL |
| ai_core | response_templates | template_text_not_null | NOT NULL estructural | template_text NOT NULL |
| ai_core | response_templates | required_sections_default | DEFAULT estructural | required_sections DEFAULT '[]'::jsonb |
| ai_core | response_templates | tone_default | DEFAULT estructural | tone DEFAULT 'claro_profesional'::text |
| ai_core | response_templates | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | response_templates | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | response_templates | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | response_templates | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | solution_playbooks | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.solution_playbooks_id_seq'::regclass) |
| ai_core | solution_playbooks | problem_type_code_not_null | NOT NULL estructural | problem_type_code NOT NULL |
| ai_core | solution_playbooks | title_not_null | NOT NULL estructural | title NOT NULL |
| ai_core | solution_playbooks | solution_steps_default | DEFAULT estructural | solution_steps DEFAULT '[]'::jsonb |
| ai_core | solution_playbooks | corrective_actions_default | DEFAULT estructural | corrective_actions DEFAULT '[]'::jsonb |
| ai_core | solution_playbooks | preventive_actions_default | DEFAULT estructural | preventive_actions DEFAULT '[]'::jsonb |
| ai_core | solution_playbooks | closure_conditions_default | DEFAULT estructural | closure_conditions DEFAULT '[]'::jsonb |
| ai_core | solution_playbooks | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | solution_playbooks | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | solution_playbooks | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | solution_playbooks | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | standard_domain_map | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.standard_domain_map_id_seq'::regclass) |
| ai_core | standard_domain_map | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| ai_core | standard_domain_map | domain_code_not_null | NOT NULL estructural | domain_code NOT NULL |
| ai_core | standard_domain_map | relevance_level_default | DEFAULT estructural | relevance_level DEFAULT 'media'::text |
| ai_core | standard_domain_map | expected_emphasis_default | DEFAULT estructural | expected_emphasis DEFAULT '[]'::jsonb |
| ai_core | standard_domain_map | typical_findings_default | DEFAULT estructural | typical_findings DEFAULT '[]'::jsonb |
| ai_core | standard_domain_map | typical_evidence_default | DEFAULT estructural | typical_evidence DEFAULT '[]'::jsonb |
| ai_core | standard_domain_map | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | standard_domain_map | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | standard_domain_map | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | standard_domain_map | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | standard_specific_overrides | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.standard_specific_overrides_id_seq'::regclass) |
| ai_core | standard_specific_overrides | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| ai_core | standard_specific_overrides | override_type_not_null | NOT NULL estructural | override_type NOT NULL |
| ai_core | standard_specific_overrides | content_default | DEFAULT estructural | content DEFAULT '{}'::jsonb |
| ai_core | standard_specific_overrides | priority_default | DEFAULT estructural | priority DEFAULT 50 |
| ai_core | standard_specific_overrides | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | standard_specific_overrides | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | standard_specific_overrides | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | standard_specific_overrides | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | standards_catalog | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.standards_catalog_id_seq'::regclass) |
| ai_core | standards_catalog | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| ai_core | standards_catalog | display_code_not_null | NOT NULL estructural | display_code NOT NULL |
| ai_core | standards_catalog | name_not_null | NOT NULL estructural | name NOT NULL |
| ai_core | standards_catalog | is_management_system_default | DEFAULT estructural | is_management_system DEFAULT true |
| ai_core | standards_catalog | is_active_default | DEFAULT estructural | is_active DEFAULT true |
| ai_core | standards_catalog | metadata_default | DEFAULT estructural | metadata DEFAULT '{}'::jsonb |
| ai_core | standards_catalog | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | standards_catalog | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | trusted_external_sources | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| ai_core | trusted_external_sources | source_code_not_null | NOT NULL estructural | source_code NOT NULL |
| ai_core | trusted_external_sources | source_name_not_null | NOT NULL estructural | source_name NOT NULL |
| ai_core | trusted_external_sources | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'documentation'::text |
| ai_core | trusted_external_sources | allowed_domains_not_null | NOT NULL estructural | allowed_domains NOT NULL DEFAULT '[]'::jsonb |
| ai_core | trusted_external_sources | applicable_domains_not_null | NOT NULL estructural | applicable_domains NOT NULL DEFAULT '[]'::jsonb |
| ai_core | trusted_external_sources | applicable_standards_not_null | NOT NULL estructural | applicable_standards NOT NULL DEFAULT '[]'::jsonb |
| ai_core | trusted_external_sources | trust_level_not_null | NOT NULL estructural | trust_level NOT NULL DEFAULT 'high'::text |
| ai_core | trusted_external_sources | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| ai_core | trusted_external_sources | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| ai_core | trusted_external_sources | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| ai_core | trusted_external_sources | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| ai_core | view_definition_backups | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('ai_core.view_definition_backups_id_seq'::regclass) |
| ai_core | view_definition_backups | backup_code_not_null | NOT NULL estructural | backup_code NOT NULL |
| ai_core | view_definition_backups | schemaname_not_null | NOT NULL estructural | schemaname NOT NULL |
| ai_core | view_definition_backups | viewname_not_null | NOT NULL estructural | viewname NOT NULL |
| ai_core | view_definition_backups | definition_not_null | NOT NULL estructural | definition NOT NULL |
| ai_core | view_definition_backups | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| public | action_plan_updates | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | action_plan_updates | action_plan_id_not_null | NOT NULL estructural | action_plan_id NOT NULL |
| public | action_plan_updates | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | action_plan_updates | comment_not_null | NOT NULL estructural | comment NOT NULL |
| public | action_plan_updates | progress_percent_not_null | NOT NULL estructural | progress_percent NOT NULL DEFAULT 0 |
| public | action_plan_updates | status_after_not_null | NOT NULL estructural | status_after NOT NULL DEFAULT 'abierto'::text |
| public | action_plan_updates | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | action_plan_updates | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | action_plans | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | action_plans | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | action_plans | iso_code_not_null | NOT NULL estructural | iso_code NOT NULL |
| public | action_plans | title_not_null | NOT NULL estructural | title NOT NULL |
| public | action_plans | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'manual'::text |
| public | action_plans | priority_not_null | NOT NULL estructural | priority NOT NULL DEFAULT 'media'::text |
| public | action_plans | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'abierto'::text |
| public | action_plans | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | action_plans | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | action_plans | approval_status_not_null | NOT NULL estructural | approval_status NOT NULL DEFAULT 'no_requerida'::text |
| public | action_plans | ai_orchestration_json_not_null | NOT NULL estructural | ai_orchestration_json NOT NULL DEFAULT '{}'::jsonb |
| public | action_plans | ai_enhanced_answer_json_not_null | NOT NULL estructural | ai_enhanced_answer_json NOT NULL DEFAULT '{}'::jsonb |
| public | action_plans_backup_history | backup_id_not_null | NOT NULL estructural | backup_id NOT NULL DEFAULT gen_random_uuid() |
| public | action_plans_backup_history | backup_reason_not_null | NOT NULL estructural | backup_reason NOT NULL |
| public | action_plans_backup_history | backup_created_at_not_null | NOT NULL estructural | backup_created_at NOT NULL DEFAULT now() |
| public | action_plans_backup_history | action_plan_snapshot_not_null | NOT NULL estructural | action_plan_snapshot NOT NULL |
| public | admin_audit_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | admin_audit_log | entity_type_not_null | NOT NULL estructural | entity_type NOT NULL |
| public | admin_audit_log | action_not_null | NOT NULL estructural | action NOT NULL |
| public | admin_audit_log | old_data_not_null | NOT NULL estructural | old_data NOT NULL DEFAULT '{}'::jsonb |
| public | admin_audit_log | new_data_not_null | NOT NULL estructural | new_data NOT NULL DEFAULT '{}'::jsonb |
| public | admin_audit_log | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | admin_audit_log | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | ai_auditor_runs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_auditor_runs | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | ai_auditor_runs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'completed'::text |
| public | ai_auditor_runs | suggestions_json_not_null | NOT NULL estructural | suggestions_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_auditor_runs | source_trace_json_not_null | NOT NULL estructural | source_trace_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_auditor_runs | created_at_default | DEFAULT estructural | created_at DEFAULT CURRENT_TIMESTAMP |
| public | ai_auditor_runs | locale_not_null | NOT NULL estructural | locale NOT NULL DEFAULT 'es'::text |
| public | ai_auditor_runs | ai_engine_used_not_null | NOT NULL estructural | ai_engine_used NOT NULL DEFAULT false |
| public | ai_auditor_runs | human_review_required_not_null | NOT NULL estructural | human_review_required NOT NULL DEFAULT true |
| public | ai_auditor_runs | can_create_records_not_null | NOT NULL estructural | can_create_records NOT NULL DEFAULT false |
| public | ai_auditor_runs | db_write_not_null | NOT NULL estructural | db_write NOT NULL DEFAULT false |
| public | ai_auditor_runs | history_saved_not_null | NOT NULL estructural | history_saved NOT NULL DEFAULT true |
| public | ai_auditor_runs | summary_json_not_null | NOT NULL estructural | summary_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_auditor_runs | coverage_json_not_null | NOT NULL estructural | coverage_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_auditor_runs | full_result_json_not_null | NOT NULL estructural | full_result_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_auditor_runs | trace_json_not_null | NOT NULL estructural | trace_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_auditor_runs | human_review_metadata_not_null | NOT NULL estructural | human_review_metadata NOT NULL DEFAULT '{}'::jsonb |
| public | ai_bootstrap_knowledge_items | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_bootstrap_knowledge_items | title_not_null | NOT NULL estructural | title NOT NULL |
| public | ai_bootstrap_knowledge_items | summary_not_null | NOT NULL estructural | summary NOT NULL |
| public | ai_bootstrap_knowledge_items | knowledge_type_not_null | NOT NULL estructural | knowledge_type NOT NULL |
| public | ai_bootstrap_knowledge_items | tags_json_not_null | NOT NULL estructural | tags_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_bootstrap_knowledge_items | trust_score_not_null | NOT NULL estructural | trust_score NOT NULL DEFAULT 90 |
| public | ai_bootstrap_knowledge_items | freshness_score_not_null | NOT NULL estructural | freshness_score NOT NULL DEFAULT 80 |
| public | ai_bootstrap_knowledge_items | usefulness_score_not_null | NOT NULL estructural | usefulness_score NOT NULL DEFAULT 90 |
| public | ai_bootstrap_knowledge_items | confidence_score_not_null | NOT NULL estructural | confidence_score NOT NULL DEFAULT 85 |
| public | ai_bootstrap_knowledge_items | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'internal_seed'::text |
| public | ai_bootstrap_knowledge_items | origin_not_null | NOT NULL estructural | origin NOT NULL DEFAULT 'bootstrap_seed'::text |
| public | ai_bootstrap_knowledge_items | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'bootstrap_pending_review'::text |
| public | ai_bootstrap_knowledge_items | source_provider_not_null | NOT NULL estructural | source_provider NOT NULL DEFAULT 'internal_seed'::text |
| public | ai_bootstrap_knowledge_items | fingerprint_not_null | NOT NULL estructural | fingerprint NOT NULL |
| public | ai_bootstrap_knowledge_items | raw_json_not_null | NOT NULL estructural | raw_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_bootstrap_knowledge_items | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | ai_bootstrap_knowledge_items | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_items | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_runs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_bootstrap_knowledge_runs | mode_not_null | NOT NULL estructural | mode NOT NULL |
| public | ai_bootstrap_knowledge_runs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'running'::text |
| public | ai_bootstrap_knowledge_runs | provider_not_null | NOT NULL estructural | provider NOT NULL DEFAULT 'internal_seed'::text |
| public | ai_bootstrap_knowledge_runs | dry_run_not_null | NOT NULL estructural | dry_run NOT NULL DEFAULT false |
| public | ai_bootstrap_knowledge_runs | require_review_not_null | NOT NULL estructural | require_review NOT NULL DEFAULT true |
| public | ai_bootstrap_knowledge_runs | topics_requested_json_not_null | NOT NULL estructural | topics_requested_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_bootstrap_knowledge_runs | topics_processed_not_null | NOT NULL estructural | topics_processed NOT NULL DEFAULT 0 |
| public | ai_bootstrap_knowledge_runs | items_created_not_null | NOT NULL estructural | items_created NOT NULL DEFAULT 0 |
| public | ai_bootstrap_knowledge_runs | items_pending_review_not_null | NOT NULL estructural | items_pending_review NOT NULL DEFAULT 0 |
| public | ai_bootstrap_knowledge_runs | items_approved_not_null | NOT NULL estructural | items_approved NOT NULL DEFAULT 0 |
| public | ai_bootstrap_knowledge_runs | items_rejected_not_null | NOT NULL estructural | items_rejected NOT NULL DEFAULT 0 |
| public | ai_bootstrap_knowledge_runs | duplicates_not_null | NOT NULL estructural | duplicates NOT NULL DEFAULT 0 |
| public | ai_bootstrap_knowledge_runs | config_json_not_null | NOT NULL estructural | config_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_bootstrap_knowledge_runs | log_json_not_null | NOT NULL estructural | log_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_bootstrap_knowledge_runs | started_at_not_null | NOT NULL estructural | started_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_runs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_runs | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_sources | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_bootstrap_knowledge_sources | source_provider_not_null | NOT NULL estructural | source_provider NOT NULL DEFAULT 'internal_seed'::text |
| public | ai_bootstrap_knowledge_sources | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'internal_seed'::text |
| public | ai_bootstrap_knowledge_sources | trust_score_not_null | NOT NULL estructural | trust_score NOT NULL DEFAULT 90 |
| public | ai_bootstrap_knowledge_sources | metadata_json_not_null | NOT NULL estructural | metadata_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_bootstrap_knowledge_sources | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_sources | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_topics | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_bootstrap_knowledge_topics | code_not_null | NOT NULL estructural | code NOT NULL |
| public | ai_bootstrap_knowledge_topics | title_not_null | NOT NULL estructural | title NOT NULL |
| public | ai_bootstrap_knowledge_topics | query_templates_json_not_null | NOT NULL estructural | query_templates_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_bootstrap_knowledge_topics | knowledge_types_json_not_null | NOT NULL estructural | knowledge_types_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_bootstrap_knowledge_topics | priority_not_null | NOT NULL estructural | priority NOT NULL DEFAULT 'medium'::text |
| public | ai_bootstrap_knowledge_topics | max_results_not_null | NOT NULL estructural | max_results NOT NULL DEFAULT 5 |
| public | ai_bootstrap_knowledge_topics | raw_json_not_null | NOT NULL estructural | raw_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_bootstrap_knowledge_topics | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | ai_bootstrap_knowledge_topics | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_bootstrap_knowledge_topics | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT CURRENT_TIMESTAMP |
| public | ai_knowledge_datasets | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_knowledge_datasets | dataset_name_not_null | NOT NULL estructural | dataset_name NOT NULL |
| public | ai_knowledge_datasets | scope_not_null | NOT NULL estructural | scope NOT NULL DEFAULT 'global'::text |
| public | ai_knowledge_datasets | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | ai_knowledge_datasets | metadata_json_not_null | NOT NULL estructural | metadata_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_knowledge_datasets | imported_at_not_null | NOT NULL estructural | imported_at NOT NULL DEFAULT now() |
| public | ai_knowledge_datasets | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | ai_knowledge_datasets | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | ai_knowledge_records | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_knowledge_records | dataset_id_not_null | NOT NULL estructural | dataset_id NOT NULL |
| public | ai_knowledge_records | record_id_not_null | NOT NULL estructural | record_id NOT NULL |
| public | ai_knowledge_records | norma_not_null | NOT NULL estructural | norma NOT NULL |
| public | ai_knowledge_records | norma_key_not_null | NOT NULL estructural | norma_key NOT NULL |
| public | ai_knowledge_records | ejemplos_evidencia_json_not_null | NOT NULL estructural | ejemplos_evidencia_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_records | hallazgos_tipicos_json_not_null | NOT NULL estructural | hallazgos_tipicos_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_records | acciones_correctivas_sugeridas_json_not_null | NOT NULL estructural | acciones_correctivas_sugeridas_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_records | palabras_clave_tags_json_not_null | NOT NULL estructural | palabras_clave_tags_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_records | related_norms_json_not_null | NOT NULL estructural | related_norms_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_records | source_refs_json_not_null | NOT NULL estructural | source_refs_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_records | verified_public_crosswalks_json_not_null | NOT NULL estructural | verified_public_crosswalks_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_records | search_text_not_null | NOT NULL estructural | search_text NOT NULL DEFAULT ''::text |
| public | ai_knowledge_records | is_draft_not_null | NOT NULL estructural | is_draft NOT NULL DEFAULT false |
| public | ai_knowledge_records | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | ai_knowledge_records | raw_json_not_null | NOT NULL estructural | raw_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_knowledge_records | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | ai_knowledge_records | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | ai_knowledge_standards | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_knowledge_standards | dataset_id_not_null | NOT NULL estructural | dataset_id NOT NULL |
| public | ai_knowledge_standards | norma_not_null | NOT NULL estructural | norma NOT NULL |
| public | ai_knowledge_standards | norma_key_not_null | NOT NULL estructural | norma_key NOT NULL |
| public | ai_knowledge_standards | principal_control_areas_json_not_null | NOT NULL estructural | principal_control_areas_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_standards | related_standards_json_not_null | NOT NULL estructural | related_standards_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_standards | verified_public_crosswalks_json_not_null | NOT NULL estructural | verified_public_crosswalks_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_standards | notes_json_not_null | NOT NULL estructural | notes_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_standards | source_refs_json_not_null | NOT NULL estructural | source_refs_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_standards | key_definitions_json_not_null | NOT NULL estructural | key_definitions_json NOT NULL DEFAULT '[]'::jsonb |
| public | ai_knowledge_standards | structure_profile_json_not_null | NOT NULL estructural | structure_profile_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_knowledge_standards | record_count_not_null | NOT NULL estructural | record_count NOT NULL DEFAULT 0 |
| public | ai_knowledge_standards | raw_json_not_null | NOT NULL estructural | raw_json NOT NULL DEFAULT '{}'::jsonb |
| public | ai_knowledge_standards | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | ai_knowledge_standards | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | ai_prompt_logs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_prompt_logs | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | ai_prompt_logs | prompt_type_not_null | NOT NULL estructural | prompt_type NOT NULL |
| public | ai_prompt_logs | source_module_not_null | NOT NULL estructural | source_module NOT NULL |
| public | ai_prompt_logs | request_payload_not_null | NOT NULL estructural | request_payload NOT NULL DEFAULT '{}'::jsonb |
| public | ai_prompt_logs | response_payload_not_null | NOT NULL estructural | response_payload NOT NULL DEFAULT '{}'::jsonb |
| public | ai_prompt_logs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'ok'::text |
| public | ai_prompt_logs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | ai_suggestions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | ai_suggestions | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | ai_suggestions | suggestion_type_not_null | NOT NULL estructural | suggestion_type NOT NULL |
| public | ai_suggestions | source_module_not_null | NOT NULL estructural | source_module NOT NULL |
| public | ai_suggestions | input_payload_not_null | NOT NULL estructural | input_payload NOT NULL DEFAULT '{}'::jsonb |
| public | ai_suggestions | output_payload_not_null | NOT NULL estructural | output_payload NOT NULL DEFAULT '{}'::jsonb |
| public | ai_suggestions | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'draft'::text |
| public | ai_suggestions | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | ai_suggestions | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | app_roles | role_key_not_null | NOT NULL estructural | role_key NOT NULL |
| public | app_roles | display_name_not_null | NOT NULL estructural | display_name NOT NULL |
| public | app_roles | role_level_not_null | NOT NULL estructural | role_level NOT NULL DEFAULT 100 |
| public | app_roles | is_system_not_null | NOT NULL estructural | is_system NOT NULL DEFAULT true |
| public | app_roles | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | app_roles | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | app_roles | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | assessments | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | assessments | created_at_default | DEFAULT estructural | created_at DEFAULT CURRENT_TIMESTAMP |
| public | asset_risks | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | asset_risks | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| public | asset_standards | asset_id_not_null | NOT NULL estructural | asset_id NOT NULL |
| public | asset_standards | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | asset_standards | source_not_null | NOT NULL estructural | source NOT NULL DEFAULT 'auto'::text |
| public | asset_standards | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | assets | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | assets | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| public | audit_control_reviews | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_control_reviews | audit_id_not_null | NOT NULL estructural | audit_id NOT NULL |
| public | audit_control_reviews | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | audit_control_reviews | result_not_null | NOT NULL estructural | result NOT NULL DEFAULT 'pendiente'::text |
| public | audit_control_reviews | created_at_default | DEFAULT estructural | created_at DEFAULT CURRENT_TIMESTAMP |
| public | audit_control_reviews | updated_at_default | DEFAULT estructural | updated_at DEFAULT CURRENT_TIMESTAMP |
| public | audit_document_generation_runs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_document_generation_runs | package_id_not_null | NOT NULL estructural | package_id NOT NULL |
| public | audit_document_generation_runs | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | audit_document_generation_runs | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | audit_document_generation_runs | run_type_not_null | NOT NULL estructural | run_type NOT NULL |
| public | audit_document_generation_runs | ai_engine_request_json_not_null | NOT NULL estructural | ai_engine_request_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_document_generation_runs | ai_engine_response_json_not_null | NOT NULL estructural | ai_engine_response_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_document_generation_runs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'completed'::character varying |
| public | audit_document_generation_runs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | audit_document_templates | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_document_templates | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | audit_document_templates | template_key_not_null | NOT NULL estructural | template_key NOT NULL |
| public | audit_document_templates | document_name_not_null | NOT NULL estructural | document_name NOT NULL |
| public | audit_document_templates | document_type_not_null | NOT NULL estructural | document_type NOT NULL |
| public | audit_document_templates | output_format_not_null | NOT NULL estructural | output_format NOT NULL DEFAULT 'docx'::character varying |
| public | audit_document_templates | folder_path_not_null | NOT NULL estructural | folder_path NOT NULL |
| public | audit_document_templates | version_not_null | NOT NULL estructural | version NOT NULL DEFAULT '1.0'::character varying |
| public | audit_document_templates | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | audit_document_templates | template_schema_json_not_null | NOT NULL estructural | template_schema_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_document_templates | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | audit_document_templates | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | audit_documentary_sources | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_documentary_sources | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | audit_documentary_sources | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | audit_documentary_sources | period_year_not_null | NOT NULL estructural | period_year NOT NULL |
| public | audit_documentary_sources | source_type_not_null | NOT NULL estructural | source_type NOT NULL |
| public | audit_documentary_sources | title_not_null | NOT NULL estructural | title NOT NULL |
| public | audit_documentary_sources | status_default | DEFAULT estructural | status DEFAULT 'requires_validation'::character varying |
| public | audit_documentary_sources | source_origin_default | DEFAULT estructural | source_origin DEFAULT 'manual'::character varying |
| public | audit_documentary_sources | metadata_json_default | DEFAULT estructural | metadata_json DEFAULT '{}'::jsonb |
| public | audit_documentary_sources | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| public | audit_documentary_sources | updated_at_default | DEFAULT estructural | updated_at DEFAULT now() |
| public | audit_event_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_event_log | table_name_not_null | NOT NULL estructural | table_name NOT NULL |
| public | audit_event_log | action_not_null | NOT NULL estructural | action NOT NULL |
| public | audit_event_log | changed_at_not_null | NOT NULL estructural | changed_at NOT NULL DEFAULT now() |
| public | audit_event_log | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | audit_evidence_index | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_evidence_index | package_id_not_null | NOT NULL estructural | package_id NOT NULL |
| public | audit_evidence_index | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | audit_evidence_index | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | audit_evidence_index | evidence_name_not_null | NOT NULL estructural | evidence_name NOT NULL |
| public | audit_evidence_index | folder_path_not_null | NOT NULL estructural | folder_path NOT NULL |
| public | audit_evidence_index | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'pending'::character varying |
| public | audit_evidence_index | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | audit_evidence_index | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | audit_package_documents | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_package_documents | package_id_not_null | NOT NULL estructural | package_id NOT NULL |
| public | audit_package_documents | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | audit_package_documents | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | audit_package_documents | document_name_not_null | NOT NULL estructural | document_name NOT NULL |
| public | audit_package_documents | folder_path_not_null | NOT NULL estructural | folder_path NOT NULL |
| public | audit_package_documents | document_status_not_null | NOT NULL estructural | document_status NOT NULL DEFAULT 'draft'::character varying |
| public | audit_package_documents | generated_json_not_null | NOT NULL estructural | generated_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_package_documents | pending_items_json_not_null | NOT NULL estructural | pending_items_json NOT NULL DEFAULT '[]'::jsonb |
| public | audit_package_documents | evidence_links_json_not_null | NOT NULL estructural | evidence_links_json NOT NULL DEFAULT '[]'::jsonb |
| public | audit_package_documents | source_trace_json_not_null | NOT NULL estructural | source_trace_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_package_documents | change_summary_json_not_null | NOT NULL estructural | change_summary_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_package_documents | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | audit_package_documents | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | audit_package_documents | version_not_null | NOT NULL estructural | version NOT NULL DEFAULT '1.0'::character varying |
| public | audit_package_documents | revision_number_not_null | NOT NULL estructural | revision_number NOT NULL DEFAULT 1 |
| public | audit_package_documents | is_current_not_null | NOT NULL estructural | is_current NOT NULL DEFAULT true |
| public | audit_preparation_packages | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_preparation_packages | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | audit_preparation_packages | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | audit_preparation_packages | period_year_not_null | NOT NULL estructural | period_year NOT NULL |
| public | audit_preparation_packages | package_name_not_null | NOT NULL estructural | package_name NOT NULL |
| public | audit_preparation_packages | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'draft'::character varying |
| public | audit_preparation_packages | package_source_not_null | NOT NULL estructural | package_source NOT NULL DEFAULT 'generated'::character varying |
| public | audit_preparation_packages | generated_at_not_null | NOT NULL estructural | generated_at NOT NULL DEFAULT now() |
| public | audit_preparation_packages | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | audit_preparation_packages | source_context_json_not_null | NOT NULL estructural | source_context_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_preparation_packages | summary_json_not_null | NOT NULL estructural | summary_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_uploaded_zip_files | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audit_uploaded_zip_files | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | audit_uploaded_zip_files | original_filename_not_null | NOT NULL estructural | original_filename NOT NULL |
| public | audit_uploaded_zip_files | file_url_not_null | NOT NULL estructural | file_url NOT NULL |
| public | audit_uploaded_zip_files | analysis_status_not_null | NOT NULL estructural | analysis_status NOT NULL DEFAULT 'pending'::character varying |
| public | audit_uploaded_zip_files | inventory_json_not_null | NOT NULL estructural | inventory_json NOT NULL DEFAULT '[]'::jsonb |
| public | audit_uploaded_zip_files | detected_structure_json_not_null | NOT NULL estructural | detected_structure_json NOT NULL DEFAULT '{}'::jsonb |
| public | audit_uploaded_zip_files | gaps_json_not_null | NOT NULL estructural | gaps_json NOT NULL DEFAULT '[]'::jsonb |
| public | audit_uploaded_zip_files | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | audit_uploaded_zip_files | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | audits | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | audits | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| public | audits | status_default | DEFAULT estructural | status DEFAULT 'pendiente'::text |
| public | clauses | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('clauses_id_seq'::regclass) |
| public | control_health_scores | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | control_health_scores | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | control_health_scores | tenant_control_id_not_null | NOT NULL estructural | tenant_control_id NOT NULL |
| public | control_health_scores | health_score_not_null | NOT NULL estructural | health_score NOT NULL DEFAULT 0 |
| public | control_health_scores | health_status_not_null | NOT NULL estructural | health_status NOT NULL DEFAULT 'sin_datos'::text |
| public | control_health_scores | evidence_score_not_null | NOT NULL estructural | evidence_score NOT NULL DEFAULT 0 |
| public | control_health_scores | compliance_score_not_null | NOT NULL estructural | compliance_score NOT NULL DEFAULT 0 |
| public | control_health_scores | findings_score_not_null | NOT NULL estructural | findings_score NOT NULL DEFAULT 0 |
| public | control_health_scores | risk_score_not_null | NOT NULL estructural | risk_score NOT NULL DEFAULT 0 |
| public | control_health_scores | action_score_not_null | NOT NULL estructural | action_score NOT NULL DEFAULT 0 |
| public | control_health_scores | review_score_not_null | NOT NULL estructural | review_score NOT NULL DEFAULT 0 |
| public | control_health_scores | evidence_count_not_null | NOT NULL estructural | evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores | approved_evidence_count_not_null | NOT NULL estructural | approved_evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores | pending_evidence_count_not_null | NOT NULL estructural | pending_evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores | rejected_evidence_count_not_null | NOT NULL estructural | rejected_evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores | open_findings_count_not_null | NOT NULL estructural | open_findings_count NOT NULL DEFAULT 0 |
| public | control_health_scores | open_actions_count_not_null | NOT NULL estructural | open_actions_count NOT NULL DEFAULT 0 |
| public | control_health_scores | overdue_actions_count_not_null | NOT NULL estructural | overdue_actions_count NOT NULL DEFAULT 0 |
| public | control_health_scores | high_risks_count_not_null | NOT NULL estructural | high_risks_count NOT NULL DEFAULT 0 |
| public | control_health_scores | calculated_at_not_null | NOT NULL estructural | calculated_at NOT NULL DEFAULT now() |
| public | control_health_scores | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | control_health_scores_v2_preview | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | control_health_scores_v2_preview | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | control_health_scores_v2_preview | tenant_control_id_not_null | NOT NULL estructural | tenant_control_id NOT NULL |
| public | control_health_scores_v2_preview | health_score_not_null | NOT NULL estructural | health_score NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | health_status_not_null | NOT NULL estructural | health_status NOT NULL DEFAULT 'sin_datos'::text |
| public | control_health_scores_v2_preview | evidence_score_not_null | NOT NULL estructural | evidence_score NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | compliance_score_not_null | NOT NULL estructural | compliance_score NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | findings_score_not_null | NOT NULL estructural | findings_score NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | risk_score_not_null | NOT NULL estructural | risk_score NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | action_score_not_null | NOT NULL estructural | action_score NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | review_score_not_null | NOT NULL estructural | review_score NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | evidence_count_not_null | NOT NULL estructural | evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | approved_evidence_count_not_null | NOT NULL estructural | approved_evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | pending_evidence_count_not_null | NOT NULL estructural | pending_evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | rejected_evidence_count_not_null | NOT NULL estructural | rejected_evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | expired_evidence_count_not_null | NOT NULL estructural | expired_evidence_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | open_findings_count_not_null | NOT NULL estructural | open_findings_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | high_open_findings_count_not_null | NOT NULL estructural | high_open_findings_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | open_nonconformities_count_not_null | NOT NULL estructural | open_nonconformities_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | open_actions_count_not_null | NOT NULL estructural | open_actions_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | overdue_actions_count_not_null | NOT NULL estructural | overdue_actions_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | high_risks_count_not_null | NOT NULL estructural | high_risks_count NOT NULL DEFAULT 0 |
| public | control_health_scores_v2_preview | calculated_at_not_null | NOT NULL estructural | calculated_at NOT NULL DEFAULT now() |
| public | control_health_scores_v2_preview | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | control_soa | tenant_control_id_not_null | NOT NULL estructural | tenant_control_id NOT NULL |
| public | control_soa | implementation_status_not_null | NOT NULL estructural | implementation_status NOT NULL DEFAULT 'pendiente'::text |
| public | control_soa | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | control_soa | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | controls | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | controls | score_default | DEFAULT estructural | score DEFAULT 0 |
| public | controls | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| public | controls_catalog | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | controls_catalog | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'generic'::text |
| public | controls_catalog | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | controls_catalog | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | controls_catalog | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | controls_catalog_standards | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | controls_catalog_standards | control_id_not_null | NOT NULL estructural | control_id NOT NULL |
| public | controls_catalog_standards | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | controls_catalog_standards | is_primary_not_null | NOT NULL estructural | is_primary NOT NULL DEFAULT false |
| public | controls_catalog_standards | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | controls_catalog_standards | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | dealer_requests | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | dealer_requests | request_type_not_null | NOT NULL estructural | request_type NOT NULL |
| public | dealer_requests | request_status_not_null | NOT NULL estructural | request_status NOT NULL DEFAULT 'open'::text |
| public | dealer_requests | title_not_null | NOT NULL estructural | title NOT NULL |
| public | dealer_requests | requested_payload_not_null | NOT NULL estructural | requested_payload NOT NULL DEFAULT '{}'::jsonb |
| public | dealer_requests | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | dealer_requests | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | dealer_tenant_access | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | dealer_tenant_access | dealer_user_id_not_null | NOT NULL estructural | dealer_user_id NOT NULL |
| public | dealer_tenant_access | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | dealer_tenant_access | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | dealer_tenant_access | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | dealer_tenants | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | dealer_tenants | dealer_user_id_not_null | NOT NULL estructural | dealer_user_id NOT NULL |
| public | dealer_tenants | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | dealer_tenants | relationship_type_not_null | NOT NULL estructural | relationship_type NOT NULL DEFAULT 'commercial_partner'::text |
| public | dealer_tenants | can_view_health_not_null | NOT NULL estructural | can_view_health NOT NULL DEFAULT true |
| public | dealer_tenants | can_view_contract_not_null | NOT NULL estructural | can_view_contract NOT NULL DEFAULT true |
| public | dealer_tenants | can_request_changes_not_null | NOT NULL estructural | can_request_changes NOT NULL DEFAULT true |
| public | dealer_tenants | can_view_sensitive_evidence_not_null | NOT NULL estructural | can_view_sensitive_evidence NOT NULL DEFAULT false |
| public | dealer_tenants | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'active'::text |
| public | dealer_tenants | assigned_at_not_null | NOT NULL estructural | assigned_at NOT NULL DEFAULT now() |
| public | dealer_tenants | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | dealer_tenants | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | dealer_tenants | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | document_ai_analysis | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT uuid_generate_v4() |
| public | document_ai_analysis | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | document_ai_analysis | document_id_not_null | NOT NULL estructural | document_id NOT NULL |
| public | document_ai_analysis | missing_elements_not_null | NOT NULL estructural | missing_elements NOT NULL DEFAULT '[]'::jsonb |
| public | document_ai_analysis | recommended_actions_not_null | NOT NULL estructural | recommended_actions NOT NULL DEFAULT '[]'::jsonb |
| public | document_ai_analysis | analysis_json_not_null | NOT NULL estructural | analysis_json NOT NULL DEFAULT '{}'::jsonb |
| public | document_ai_analysis | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | document_association_suggestions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT uuid_generate_v4() |
| public | document_association_suggestions | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | document_association_suggestions | document_id_not_null | NOT NULL estructural | document_id NOT NULL |
| public | document_association_suggestions | target_type_not_null | NOT NULL estructural | target_type NOT NULL |
| public | document_association_suggestions | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'pending'::character varying |
| public | document_association_suggestions | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | document_index | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT uuid_generate_v4() |
| public | document_index | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | document_index | provider_not_null | NOT NULL estructural | provider NOT NULL |
| public | document_index | provider_file_id_not_null | NOT NULL estructural | provider_file_id NOT NULL |
| public | document_index | file_name_not_null | NOT NULL estructural | file_name NOT NULL |
| public | document_index | indexed_at_not_null | NOT NULL estructural | indexed_at NOT NULL DEFAULT now() |
| public | document_index | last_seen_at_not_null | NOT NULL estructural | last_seen_at NOT NULL DEFAULT now() |
| public | document_index | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'indexed'::character varying |
| public | document_index | metadata_json_not_null | NOT NULL estructural | metadata_json NOT NULL DEFAULT '{}'::jsonb |
| public | document_sync_logs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT uuid_generate_v4() |
| public | document_sync_logs | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | document_sync_logs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'started'::character varying |
| public | document_sync_logs | started_at_not_null | NOT NULL estructural | started_at NOT NULL DEFAULT now() |
| public | document_sync_logs | files_seen_not_null | NOT NULL estructural | files_seen NOT NULL DEFAULT 0 |
| public | document_sync_logs | files_indexed_not_null | NOT NULL estructural | files_indexed NOT NULL DEFAULT 0 |
| public | document_sync_logs | files_updated_not_null | NOT NULL estructural | files_updated NOT NULL DEFAULT 0 |
| public | document_sync_logs | files_skipped_not_null | NOT NULL estructural | files_skipped NOT NULL DEFAULT 0 |
| public | document_sync_logs | details_json_not_null | NOT NULL estructural | details_json NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_ai_assessments | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | evidence_ai_assessments | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | evidence_ai_assessments | evidence_id_not_null | NOT NULL estructural | evidence_id NOT NULL |
| public | evidence_ai_assessments | is_current_not_null | NOT NULL estructural | is_current NOT NULL DEFAULT true |
| public | evidence_ai_assessments | analysis_status_not_null | NOT NULL estructural | analysis_status NOT NULL DEFAULT 'pending'::text |
| public | evidence_ai_assessments | validity_result_not_null | NOT NULL estructural | validity_result NOT NULL DEFAULT 'sin_determinar'::text |
| public | evidence_ai_assessments | contribution_level_not_null | NOT NULL estructural | contribution_level NOT NULL DEFAULT 'indeterminado'::text |
| public | evidence_ai_assessments | pertinence_score_not_null | NOT NULL estructural | pertinence_score NOT NULL DEFAULT 0 |
| public | evidence_ai_assessments | sufficiency_score_not_null | NOT NULL estructural | sufficiency_score NOT NULL DEFAULT 0 |
| public | evidence_ai_assessments | freshness_score_not_null | NOT NULL estructural | freshness_score NOT NULL DEFAULT 0 |
| public | evidence_ai_assessments | traceability_score_not_null | NOT NULL estructural | traceability_score NOT NULL DEFAULT 0 |
| public | evidence_ai_assessments | consistency_score_not_null | NOT NULL estructural | consistency_score NOT NULL DEFAULT 0 |
| public | evidence_ai_assessments | compliance_impact_score_not_null | NOT NULL estructural | compliance_impact_score NOT NULL DEFAULT 0 |
| public | evidence_ai_assessments | risks_json_not_null | NOT NULL estructural | risks_json NOT NULL DEFAULT '[]'::jsonb |
| public | evidence_ai_assessments | next_steps_json_not_null | NOT NULL estructural | next_steps_json NOT NULL DEFAULT '[]'::jsonb |
| public | evidence_ai_assessments | extracted_entities_json_not_null | NOT NULL estructural | extracted_entities_json NOT NULL DEFAULT '[]'::jsonb |
| public | evidence_ai_assessments | appears_expired_not_null | NOT NULL estructural | appears_expired NOT NULL DEFAULT false |
| public | evidence_ai_assessments | appears_complete_not_null | NOT NULL estructural | appears_complete NOT NULL DEFAULT false |
| public | evidence_ai_assessments | source_system_not_null | NOT NULL estructural | source_system NOT NULL DEFAULT 'own_ai_140'::text |
| public | evidence_ai_assessments | raw_response_json_not_null | NOT NULL estructural | raw_response_json NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_ai_assessments | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | evidence_ai_assessments | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | evidence_ai_assessments | ai_orchestration_json_not_null | NOT NULL estructural | ai_orchestration_json NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_ai_assessments | ai_enhanced_answer_json_not_null | NOT NULL estructural | ai_enhanced_answer_json NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_ai_jobs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | evidence_ai_jobs | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | evidence_ai_jobs | evidence_id_not_null | NOT NULL estructural | evidence_id NOT NULL |
| public | evidence_ai_jobs | job_type_not_null | NOT NULL estructural | job_type NOT NULL |
| public | evidence_ai_jobs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'pending'::text |
| public | evidence_ai_jobs | priority_not_null | NOT NULL estructural | priority NOT NULL DEFAULT 50 |
| public | evidence_ai_jobs | retry_count_not_null | NOT NULL estructural | retry_count NOT NULL DEFAULT 0 |
| public | evidence_ai_jobs | max_retries_not_null | NOT NULL estructural | max_retries NOT NULL DEFAULT 5 |
| public | evidence_ai_jobs | run_after_not_null | NOT NULL estructural | run_after NOT NULL DEFAULT now() |
| public | evidence_ai_jobs | payload_not_null | NOT NULL estructural | payload NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_ai_jobs | result_not_null | NOT NULL estructural | result NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_ai_jobs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | evidence_ai_jobs | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | evidence_document_extracts | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | evidence_document_extracts | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | evidence_document_extracts | evidence_id_not_null | NOT NULL estructural | evidence_id NOT NULL |
| public | evidence_document_extracts | is_current_not_null | NOT NULL estructural | is_current NOT NULL DEFAULT true |
| public | evidence_document_extracts | extraction_status_not_null | NOT NULL estructural | extraction_status NOT NULL DEFAULT 'pending'::text |
| public | evidence_document_extracts | structured_json_not_null | NOT NULL estructural | structured_json NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_document_extracts | text_char_count_not_null | NOT NULL estructural | text_char_count NOT NULL DEFAULT 0 |
| public | evidence_document_extracts | ocr_used_not_null | NOT NULL estructural | ocr_used NOT NULL DEFAULT false |
| public | evidence_document_extracts | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | evidence_document_extracts | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | evidence_document_links | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT uuid_generate_v4() |
| public | evidence_document_links | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | evidence_document_links | evidence_id_not_null | NOT NULL estructural | evidence_id NOT NULL |
| public | evidence_document_links | document_id_not_null | NOT NULL estructural | document_id NOT NULL |
| public | evidence_document_links | relation_type_not_null | NOT NULL estructural | relation_type NOT NULL DEFAULT 'source_document'::character varying |
| public | evidence_document_links | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | evidence_knowledge_chunks | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | evidence_knowledge_chunks | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | evidence_knowledge_chunks | evidence_id_not_null | NOT NULL estructural | evidence_id NOT NULL |
| public | evidence_knowledge_chunks | chunk_index_not_null | NOT NULL estructural | chunk_index NOT NULL |
| public | evidence_knowledge_chunks | chunk_type_not_null | NOT NULL estructural | chunk_type NOT NULL DEFAULT 'text'::text |
| public | evidence_knowledge_chunks | content_not_null | NOT NULL estructural | content NOT NULL |
| public | evidence_knowledge_chunks | embedding_status_not_null | NOT NULL estructural | embedding_status NOT NULL DEFAULT 'pending'::text |
| public | evidence_knowledge_chunks | metadata_json_not_null | NOT NULL estructural | metadata_json NOT NULL DEFAULT '{}'::jsonb |
| public | evidence_knowledge_chunks | is_approved_signal_not_null | NOT NULL estructural | is_approved_signal NOT NULL DEFAULT false |
| public | evidence_knowledge_chunks | is_negative_signal_not_null | NOT NULL estructural | is_negative_signal NOT NULL DEFAULT false |
| public | evidence_knowledge_chunks | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | evidence_knowledge_chunks | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | evidence_tenant_control_migration_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | evidence_tenant_control_migration_log | evidence_id_not_null | NOT NULL estructural | evidence_id NOT NULL |
| public | evidence_tenant_control_migration_log | strategy_not_null | NOT NULL estructural | strategy NOT NULL |
| public | evidence_tenant_control_migration_log | migrated_at_not_null | NOT NULL estructural | migrated_at NOT NULL DEFAULT now() |
| public | evidences | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | evidences | created_at_default | DEFAULT estructural | created_at DEFAULT now() |
| public | evidences | status_default | DEFAULT estructural | status DEFAULT 'pendiente'::text |
| public | evidences | validated_default | DEFAULT estructural | validated DEFAULT false |
| public | evidences | evidence_type_default | DEFAULT estructural | evidence_type DEFAULT 'documento'::text |
| public | evidences | version_default | DEFAULT estructural | version DEFAULT 1 |
| public | evidences | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | evidences | document_extraction_status_default | DEFAULT estructural | document_extraction_status DEFAULT 'pending'::text |
| public | evidences | ai_analysis_status_default | DEFAULT estructural | ai_analysis_status DEFAULT 'pending'::text |
| public | evidences_backup_history | backup_id_not_null | NOT NULL estructural | backup_id NOT NULL DEFAULT gen_random_uuid() |
| public | evidences_backup_history | backup_reason_not_null | NOT NULL estructural | backup_reason NOT NULL |
| public | evidences_backup_history | backup_created_at_not_null | NOT NULL estructural | backup_created_at NOT NULL DEFAULT now() |
| public | evidences_backup_history | evidence_snapshot_not_null | NOT NULL estructural | evidence_snapshot NOT NULL |
| public | findings | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | findings | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | findings | iso_code_not_null | NOT NULL estructural | iso_code NOT NULL |
| public | findings | title_not_null | NOT NULL estructural | title NOT NULL |
| public | findings | finding_type_not_null | NOT NULL estructural | finding_type NOT NULL DEFAULT 'observacion'::text |
| public | findings | severity_not_null | NOT NULL estructural | severity NOT NULL DEFAULT 'media'::text |
| public | findings | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'abierto'::text |
| public | findings | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'manual'::text |
| public | findings | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | findings | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_ai_guidance | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_ai_guidance | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_ai_guidance | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_ai_guidance | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_ai_guidance | guidance_type_not_null | NOT NULL estructural | guidance_type NOT NULL |
| public | iso_ai_guidance | system_instruction_not_null | NOT NULL estructural | system_instruction NOT NULL |
| public | iso_ai_guidance | evaluation_criteria_not_null | NOT NULL estructural | evaluation_criteria NOT NULL DEFAULT '{}'::jsonb |
| public | iso_ai_guidance | forbidden_claims_not_null | NOT NULL estructural | forbidden_claims NOT NULL DEFAULT '[]'::jsonb |
| public | iso_ai_guidance | preferred_output_schema_not_null | NOT NULL estructural | preferred_output_schema NOT NULL DEFAULT '{}'::jsonb |
| public | iso_ai_guidance | locale_not_null | NOT NULL estructural | locale NOT NULL DEFAULT 'es'::text |
| public | iso_ai_guidance | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_ai_guidance | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_audit_questions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_audit_questions | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_audit_questions | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_audit_questions | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_audit_questions | question_not_null | NOT NULL estructural | question NOT NULL |
| public | iso_audit_questions | severity_if_missing_not_null | NOT NULL estructural | severity_if_missing NOT NULL DEFAULT 'media'::text |
| public | iso_audit_questions | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_audit_questions | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_catalog_sync_status | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_catalog_sync_status | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_catalog_sync_status | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_catalog_sync_status | sync_target_not_null | NOT NULL estructural | sync_target NOT NULL |
| public | iso_catalog_sync_status | sync_status_not_null | NOT NULL estructural | sync_status NOT NULL DEFAULT 'not_started'::text |
| public | iso_catalog_sync_status | linked_controls_count_not_null | NOT NULL estructural | linked_controls_count NOT NULL DEFAULT 0 |
| public | iso_catalog_sync_status | total_iso_controls_count_not_null | NOT NULL estructural | total_iso_controls_count NOT NULL DEFAULT 0 |
| public | iso_catalog_sync_status | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_catalog_sync_status | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_catalog_sync_status | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_clause_guides | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT nextval('iso_clause_guides_id_seq'::regclass) |
| public | iso_clauses | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_clauses | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_clauses | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_clauses | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_clauses | clause_code_not_null | NOT NULL estructural | clause_code NOT NULL |
| public | iso_clauses | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_clauses | sort_order_not_null | NOT NULL estructural | sort_order NOT NULL DEFAULT 0 |
| public | iso_clauses | is_required_not_null | NOT NULL estructural | is_required NOT NULL DEFAULT true |
| public | iso_clauses | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_clauses | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_control_catalog_links | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_control_catalog_links | iso_control_id_not_null | NOT NULL estructural | iso_control_id NOT NULL |
| public | iso_control_catalog_links | catalog_control_id_not_null | NOT NULL estructural | catalog_control_id NOT NULL |
| public | iso_control_catalog_links | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_control_catalog_links | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_control_catalog_links | control_code_not_null | NOT NULL estructural | control_code NOT NULL |
| public | iso_control_catalog_links | relationship_type_not_null | NOT NULL estructural | relationship_type NOT NULL DEFAULT 'related'::text |
| public | iso_control_catalog_links | confidence_not_null | NOT NULL estructural | confidence NOT NULL DEFAULT 0.75 |
| public | iso_control_catalog_links | mapping_source_not_null | NOT NULL estructural | mapping_source NOT NULL DEFAULT 'seeded'::text |
| public | iso_control_catalog_links | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | iso_control_catalog_links | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_control_catalog_links | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_control_mapping_apply_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_control_mapping_apply_log | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_control_mapping_apply_log | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_control_mapping_apply_log | dry_run_not_null | NOT NULL estructural | dry_run NOT NULL |
| public | iso_control_mapping_apply_log | min_confidence_not_null | NOT NULL estructural | min_confidence NOT NULL |
| public | iso_control_mapping_apply_log | candidates_total_not_null | NOT NULL estructural | candidates_total NOT NULL DEFAULT 0 |
| public | iso_control_mapping_apply_log | can_auto_apply_count_not_null | NOT NULL estructural | can_auto_apply_count NOT NULL DEFAULT 0 |
| public | iso_control_mapping_apply_log | applied_count_not_null | NOT NULL estructural | applied_count NOT NULL DEFAULT 0 |
| public | iso_control_mapping_apply_log | skipped_count_not_null | NOT NULL estructural | skipped_count NOT NULL DEFAULT 0 |
| public | iso_control_mapping_apply_log | conflict_count_not_null | NOT NULL estructural | conflict_count NOT NULL DEFAULT 0 |
| public | iso_control_mapping_apply_log | request_payload_not_null | NOT NULL estructural | request_payload NOT NULL DEFAULT '{}'::jsonb |
| public | iso_control_mapping_apply_log | result_summary_not_null | NOT NULL estructural | result_summary NOT NULL DEFAULT '{}'::jsonb |
| public | iso_control_mapping_apply_log | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_control_mappings | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_control_mappings | source_standard_code_not_null | NOT NULL estructural | source_standard_code NOT NULL |
| public | iso_control_mappings | source_version_code_not_null | NOT NULL estructural | source_version_code NOT NULL |
| public | iso_control_mappings | source_control_code_not_null | NOT NULL estructural | source_control_code NOT NULL |
| public | iso_control_mappings | target_standard_code_not_null | NOT NULL estructural | target_standard_code NOT NULL |
| public | iso_control_mappings | target_version_code_not_null | NOT NULL estructural | target_version_code NOT NULL |
| public | iso_control_mappings | target_control_code_not_null | NOT NULL estructural | target_control_code NOT NULL |
| public | iso_control_mappings | relationship_type_not_null | NOT NULL estructural | relationship_type NOT NULL |
| public | iso_control_mappings | reuse_evidence_not_null | NOT NULL estructural | reuse_evidence NOT NULL DEFAULT false |
| public | iso_control_mappings | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_controls | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_controls | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_controls | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_controls | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_controls | control_code_not_null | NOT NULL estructural | control_code NOT NULL |
| public | iso_controls | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_controls | default_priority_not_null | NOT NULL estructural | default_priority NOT NULL DEFAULT 'media'::text |
| public | iso_controls | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | iso_controls | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_controls | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_document_audit_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_document_audit_log | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_document_audit_log | action_not_null | NOT NULL estructural | action NOT NULL |
| public | iso_document_audit_log | old_data_not_null | NOT NULL estructural | old_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_document_audit_log | new_data_not_null | NOT NULL estructural | new_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_document_audit_log | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_document_audit_log | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_document_generation_runs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_document_generation_runs | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_document_generation_runs | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_document_generation_runs | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_document_generation_runs | document_type_not_null | NOT NULL estructural | document_type NOT NULL |
| public | iso_document_generation_runs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'success'::text |
| public | iso_document_generation_runs | ai_used_not_null | NOT NULL estructural | ai_used NOT NULL DEFAULT false |
| public | iso_document_generation_runs | request_payload_not_null | NOT NULL estructural | request_payload NOT NULL DEFAULT '{}'::jsonb |
| public | iso_document_generation_runs | result_summary_not_null | NOT NULL estructural | result_summary NOT NULL DEFAULT '{}'::jsonb |
| public | iso_document_generation_runs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_evidence_expectations | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_evidence_expectations | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_evidence_expectations | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_evidence_expectations | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_evidence_expectations | control_code_not_null | NOT NULL estructural | control_code NOT NULL |
| public | iso_evidence_expectations | evidence_name_not_null | NOT NULL estructural | evidence_name NOT NULL |
| public | iso_evidence_expectations | evidence_type_not_null | NOT NULL estructural | evidence_type NOT NULL |
| public | iso_evidence_expectations | required_level_not_null | NOT NULL estructural | required_level NOT NULL DEFAULT 'recommended'::text |
| public | iso_evidence_expectations | validation_criteria_not_null | NOT NULL estructural | validation_criteria NOT NULL DEFAULT '{}'::jsonb |
| public | iso_evidence_expectations | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_evidence_expectations | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_express_assessment_answers | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_express_assessment_answers | assessment_id_not_null | NOT NULL estructural | assessment_id NOT NULL |
| public | iso_express_assessment_answers | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_express_assessment_answers | question_code_not_null | NOT NULL estructural | question_code NOT NULL |
| public | iso_express_assessment_answers | question_text_not_null | NOT NULL estructural | question_text NOT NULL |
| public | iso_express_assessment_answers | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_express_assessment_answers | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_express_assessment_audit_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_express_assessment_audit_log | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_express_assessment_audit_log | action_not_null | NOT NULL estructural | action NOT NULL |
| public | iso_express_assessment_audit_log | old_data_not_null | NOT NULL estructural | old_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessment_audit_log | new_data_not_null | NOT NULL estructural | new_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessment_audit_log | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessment_audit_log | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_express_assessment_gaps | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_express_assessment_gaps | assessment_id_not_null | NOT NULL estructural | assessment_id NOT NULL |
| public | iso_express_assessment_gaps | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_express_assessment_gaps | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_express_assessment_gaps | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_express_assessment_gaps | gap_type_not_null | NOT NULL estructural | gap_type NOT NULL |
| public | iso_express_assessment_gaps | severity_not_null | NOT NULL estructural | severity NOT NULL DEFAULT 'media'::text |
| public | iso_express_assessment_gaps | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_express_assessment_gaps | suggested_due_days_not_null | NOT NULL estructural | suggested_due_days NOT NULL DEFAULT 30 |
| public | iso_express_assessment_gaps | source_not_null | NOT NULL estructural | source NOT NULL DEFAULT 'diagnostic_engine'::text |
| public | iso_express_assessment_gaps | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessment_gaps | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_express_assessment_items | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_express_assessment_items | assessment_id_not_null | NOT NULL estructural | assessment_id NOT NULL |
| public | iso_express_assessment_items | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_express_assessment_items | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_express_assessment_items | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_express_assessment_items | control_code_not_null | NOT NULL estructural | control_code NOT NULL |
| public | iso_express_assessment_items | evidence_count_not_null | NOT NULL estructural | evidence_count NOT NULL DEFAULT 0 |
| public | iso_express_assessment_items | approved_evidence_count_not_null | NOT NULL estructural | approved_evidence_count NOT NULL DEFAULT 0 |
| public | iso_express_assessment_items | pending_evidence_count_not_null | NOT NULL estructural | pending_evidence_count NOT NULL DEFAULT 0 |
| public | iso_express_assessment_items | rejected_evidence_count_not_null | NOT NULL estructural | rejected_evidence_count NOT NULL DEFAULT 0 |
| public | iso_express_assessment_items | has_expected_evidence_not_null | NOT NULL estructural | has_expected_evidence NOT NULL DEFAULT false |
| public | iso_express_assessment_items | expected_evidence_count_not_null | NOT NULL estructural | expected_evidence_count NOT NULL DEFAULT 0 |
| public | iso_express_assessment_items | evidence_gap_not_null | NOT NULL estructural | evidence_gap NOT NULL DEFAULT false |
| public | iso_express_assessment_items | control_gap_not_null | NOT NULL estructural | control_gap NOT NULL DEFAULT false |
| public | iso_express_assessment_items | gap_severity_not_null | NOT NULL estructural | gap_severity NOT NULL DEFAULT 'media'::text |
| public | iso_express_assessment_items | item_score_not_null | NOT NULL estructural | item_score NOT NULL DEFAULT 0 |
| public | iso_express_assessment_items | item_result_json_not_null | NOT NULL estructural | item_result_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessment_items | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_express_assessment_items | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_express_assessments | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_express_assessments | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_express_assessments | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_express_assessments | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_express_assessments | assessment_type_not_null | NOT NULL estructural | assessment_type NOT NULL DEFAULT 'express'::text |
| public | iso_express_assessments | assessment_status_not_null | NOT NULL estructural | assessment_status NOT NULL DEFAULT 'draft'::text |
| public | iso_express_assessments | source_not_null | NOT NULL estructural | source NOT NULL DEFAULT 'manual'::text |
| public | iso_express_assessments | certifiable_version_not_null | NOT NULL estructural | certifiable_version NOT NULL DEFAULT false |
| public | iso_express_assessments | readiness_score_not_null | NOT NULL estructural | readiness_score NOT NULL DEFAULT 0 |
| public | iso_express_assessments | total_iso_controls_not_null | NOT NULL estructural | total_iso_controls NOT NULL DEFAULT 0 |
| public | iso_express_assessments | mapped_controls_count_not_null | NOT NULL estructural | mapped_controls_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | evaluated_controls_count_not_null | NOT NULL estructural | evaluated_controls_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | controls_with_evidence_count_not_null | NOT NULL estructural | controls_with_evidence_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | controls_without_evidence_count_not_null | NOT NULL estructural | controls_without_evidence_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | gaps_count_not_null | NOT NULL estructural | gaps_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | critical_gaps_count_not_null | NOT NULL estructural | critical_gaps_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | high_gaps_count_not_null | NOT NULL estructural | high_gaps_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | medium_gaps_count_not_null | NOT NULL estructural | medium_gaps_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | low_gaps_count_not_null | NOT NULL estructural | low_gaps_count NOT NULL DEFAULT 0 |
| public | iso_express_assessments | risk_score_not_null | NOT NULL estructural | risk_score NOT NULL DEFAULT 0 |
| public | iso_express_assessments | maturity_score_not_null | NOT NULL estructural | maturity_score NOT NULL DEFAULT 0 |
| public | iso_express_assessments | plan_30_json_not_null | NOT NULL estructural | plan_30_json NOT NULL DEFAULT '[]'::jsonb |
| public | iso_express_assessments | plan_60_json_not_null | NOT NULL estructural | plan_60_json NOT NULL DEFAULT '[]'::jsonb |
| public | iso_express_assessments | plan_90_json_not_null | NOT NULL estructural | plan_90_json NOT NULL DEFAULT '[]'::jsonb |
| public | iso_express_assessments | summary_json_not_null | NOT NULL estructural | summary_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessments | input_json_not_null | NOT NULL estructural | input_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessments | result_json_not_null | NOT NULL estructural | result_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_express_assessments | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_express_assessments | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_gap_rules | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_gap_rules | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_gap_rules | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_gap_rules | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_gap_rules | rule_code_not_null | NOT NULL estructural | rule_code NOT NULL |
| public | iso_gap_rules | name_not_null | NOT NULL estructural | name NOT NULL |
| public | iso_gap_rules | condition_json_not_null | NOT NULL estructural | condition_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_gap_rules | severity_not_null | NOT NULL estructural | severity NOT NULL DEFAULT 'media'::text |
| public | iso_gap_rules | creates_finding_suggestion_not_null | NOT NULL estructural | creates_finding_suggestion NOT NULL DEFAULT false |
| public | iso_gap_rules | creates_action_suggestion_not_null | NOT NULL estructural | creates_action_suggestion NOT NULL DEFAULT true |
| public | iso_gap_rules | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_gap_rules | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_generated_document_sections | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_generated_document_sections | document_id_not_null | NOT NULL estructural | document_id NOT NULL |
| public | iso_generated_document_sections | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_generated_document_sections | section_order_not_null | NOT NULL estructural | section_order NOT NULL DEFAULT 0 |
| public | iso_generated_document_sections | section_key_not_null | NOT NULL estructural | section_key NOT NULL |
| public | iso_generated_document_sections | section_title_not_null | NOT NULL estructural | section_title NOT NULL |
| public | iso_generated_document_sections | section_content_not_null | NOT NULL estructural | section_content NOT NULL |
| public | iso_generated_document_sections | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'template'::text |
| public | iso_generated_document_sections | source_reference_not_null | NOT NULL estructural | source_reference NOT NULL DEFAULT '{}'::jsonb |
| public | iso_generated_document_sections | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_generated_document_sections | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_generated_documents | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_generated_documents | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_generated_documents | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_generated_documents | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_generated_documents | document_type_not_null | NOT NULL estructural | document_type NOT NULL |
| public | iso_generated_documents | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_generated_documents | document_status_not_null | NOT NULL estructural | document_status NOT NULL DEFAULT 'draft'::text |
| public | iso_generated_documents | version_not_null | NOT NULL estructural | version NOT NULL DEFAULT 1 |
| public | iso_generated_documents | language_not_null | NOT NULL estructural | language NOT NULL DEFAULT 'es'::text |
| public | iso_generated_documents | content_markdown_not_null | NOT NULL estructural | content_markdown NOT NULL |
| public | iso_generated_documents | content_json_not_null | NOT NULL estructural | content_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_generated_documents | variables_json_not_null | NOT NULL estructural | variables_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_generated_documents | source_trace_json_not_null | NOT NULL estructural | source_trace_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_generated_documents | ai_used_not_null | NOT NULL estructural | ai_used NOT NULL DEFAULT false |
| public | iso_generated_documents | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_generated_documents | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_maturity_rules | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_maturity_rules | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_maturity_rules | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_maturity_rules | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_maturity_rules | maturity_level_not_null | NOT NULL estructural | maturity_level NOT NULL |
| public | iso_maturity_rules | name_not_null | NOT NULL estructural | name NOT NULL |
| public | iso_maturity_rules | criteria_json_not_null | NOT NULL estructural | criteria_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_maturity_rules | min_score_not_null | NOT NULL estructural | min_score NOT NULL DEFAULT 0 |
| public | iso_maturity_rules | max_score_not_null | NOT NULL estructural | max_score NOT NULL DEFAULT 100 |
| public | iso_maturity_rules | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_maturity_rules | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_operational_suggestion_audit_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_operational_suggestion_audit_log | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_operational_suggestion_audit_log | action_not_null | NOT NULL estructural | action NOT NULL |
| public | iso_operational_suggestion_audit_log | old_data_not_null | NOT NULL estructural | old_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_operational_suggestion_audit_log | new_data_not_null | NOT NULL estructural | new_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_operational_suggestion_audit_log | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_operational_suggestion_audit_log | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_operational_suggestions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_operational_suggestions | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_operational_suggestions | source_module_not_null | NOT NULL estructural | source_module NOT NULL |
| public | iso_operational_suggestions | suggestion_type_not_null | NOT NULL estructural | suggestion_type NOT NULL |
| public | iso_operational_suggestions | target_record_type_not_null | NOT NULL estructural | target_record_type NOT NULL |
| public | iso_operational_suggestions | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_operational_suggestions | priority_not_null | NOT NULL estructural | priority NOT NULL DEFAULT 'media'::text |
| public | iso_operational_suggestions | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'pending'::text |
| public | iso_operational_suggestions | dedupe_key_not_null | NOT NULL estructural | dedupe_key NOT NULL |
| public | iso_operational_suggestions | payload_json_not_null | NOT NULL estructural | payload_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_operational_suggestions | source_trace_json_not_null | NOT NULL estructural | source_trace_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_operational_suggestions | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_operational_suggestions | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_policy_templates | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_policy_templates | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_policy_templates | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_policy_templates | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_policy_templates | template_code_not_null | NOT NULL estructural | template_code NOT NULL |
| public | iso_policy_templates | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_policy_templates | sections_json_not_null | NOT NULL estructural | sections_json NOT NULL DEFAULT '[]'::jsonb |
| public | iso_policy_templates | variables_json_not_null | NOT NULL estructural | variables_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_policy_templates | related_control_codes_not_null | NOT NULL estructural | related_control_codes NOT NULL DEFAULT '{}'::text[] |
| public | iso_policy_templates | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | iso_policy_templates | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_policy_templates | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_procedure_templates | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_procedure_templates | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_procedure_templates | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_procedure_templates | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_procedure_templates | template_code_not_null | NOT NULL estructural | template_code NOT NULL |
| public | iso_procedure_templates | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_procedure_templates | steps_json_not_null | NOT NULL estructural | steps_json NOT NULL DEFAULT '[]'::jsonb |
| public | iso_procedure_templates | roles_json_not_null | NOT NULL estructural | roles_json NOT NULL DEFAULT '[]'::jsonb |
| public | iso_procedure_templates | records_json_not_null | NOT NULL estructural | records_json NOT NULL DEFAULT '[]'::jsonb |
| public | iso_procedure_templates | related_control_codes_not_null | NOT NULL estructural | related_control_codes NOT NULL DEFAULT '{}'::text[] |
| public | iso_procedure_templates | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | iso_procedure_templates | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_procedure_templates | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_recommended_action_conversions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_recommended_action_conversions | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_recommended_action_conversions | recommendation_id_not_null | NOT NULL estructural | recommendation_id NOT NULL |
| public | iso_recommended_action_conversions | target_type_not_null | NOT NULL estructural | target_type NOT NULL |
| public | iso_recommended_action_conversions | conversion_status_not_null | NOT NULL estructural | conversion_status NOT NULL DEFAULT 'converted'::text |
| public | iso_recommended_action_conversions | source_payload_not_null | NOT NULL estructural | source_payload NOT NULL DEFAULT '{}'::jsonb |
| public | iso_recommended_action_conversions | result_payload_not_null | NOT NULL estructural | result_payload NOT NULL DEFAULT '{}'::jsonb |
| public | iso_recommended_action_conversions | converted_at_not_null | NOT NULL estructural | converted_at NOT NULL DEFAULT now() |
| public | iso_recommended_action_conversions | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_recommended_action_conversions | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_recommended_action_workflow_events | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_recommended_action_workflow_events | suggestion_id_not_null | NOT NULL estructural | suggestion_id NOT NULL |
| public | iso_recommended_action_workflow_events | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_recommended_action_workflow_events | new_status_not_null | NOT NULL estructural | new_status NOT NULL |
| public | iso_recommended_action_workflow_events | event_type_not_null | NOT NULL estructural | event_type NOT NULL |
| public | iso_recommended_action_workflow_events | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_recommended_action_workflow_events | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_risk_matrix_actions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_risk_matrix_actions | run_id_not_null | NOT NULL estructural | run_id NOT NULL |
| public | iso_risk_matrix_actions | risk_item_id_not_null | NOT NULL estructural | risk_item_id NOT NULL |
| public | iso_risk_matrix_actions | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_risk_matrix_actions | action_title_not_null | NOT NULL estructural | action_title NOT NULL |
| public | iso_risk_matrix_actions | suggested_due_days_not_null | NOT NULL estructural | suggested_due_days NOT NULL DEFAULT 30 |
| public | iso_risk_matrix_actions | priority_not_null | NOT NULL estructural | priority NOT NULL DEFAULT 'media'::text |
| public | iso_risk_matrix_actions | action_type_not_null | NOT NULL estructural | action_type NOT NULL DEFAULT 'risk_treatment'::text |
| public | iso_risk_matrix_actions | creates_action_plan_candidate_not_null | NOT NULL estructural | creates_action_plan_candidate NOT NULL DEFAULT true |
| public | iso_risk_matrix_actions | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'suggested'::text |
| public | iso_risk_matrix_actions | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_actions | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_risk_matrix_actions | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_risk_matrix_audit_log | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_risk_matrix_audit_log | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_risk_matrix_audit_log | action_not_null | NOT NULL estructural | action NOT NULL |
| public | iso_risk_matrix_audit_log | old_data_not_null | NOT NULL estructural | old_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_audit_log | new_data_not_null | NOT NULL estructural | new_data NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_audit_log | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_audit_log | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_risk_matrix_items | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_risk_matrix_items | run_id_not_null | NOT NULL estructural | run_id NOT NULL |
| public | iso_risk_matrix_items | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_risk_matrix_items | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_risk_matrix_items | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_risk_matrix_items | risk_title_not_null | NOT NULL estructural | risk_title NOT NULL |
| public | iso_risk_matrix_items | likelihood_not_null | NOT NULL estructural | likelihood NOT NULL DEFAULT 3 |
| public | iso_risk_matrix_items | impact_not_null | NOT NULL estructural | impact NOT NULL DEFAULT 3 |
| public | iso_risk_matrix_items | inherent_risk_score_not_null | NOT NULL estructural | inherent_risk_score NOT NULL DEFAULT 9 |
| public | iso_risk_matrix_items | inherent_risk_level_not_null | NOT NULL estructural | inherent_risk_level NOT NULL DEFAULT 'medio'::text |
| public | iso_risk_matrix_items | control_effectiveness_score_not_null | NOT NULL estructural | control_effectiveness_score NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_items | residual_likelihood_not_null | NOT NULL estructural | residual_likelihood NOT NULL DEFAULT 3 |
| public | iso_risk_matrix_items | residual_impact_not_null | NOT NULL estructural | residual_impact NOT NULL DEFAULT 3 |
| public | iso_risk_matrix_items | residual_risk_score_not_null | NOT NULL estructural | residual_risk_score NOT NULL DEFAULT 9 |
| public | iso_risk_matrix_items | residual_risk_level_not_null | NOT NULL estructural | residual_risk_level NOT NULL DEFAULT 'medio'::text |
| public | iso_risk_matrix_items | treatment_strategy_not_null | NOT NULL estructural | treatment_strategy NOT NULL DEFAULT 'mitigar'::text |
| public | iso_risk_matrix_items | suggested_controls_not_null | NOT NULL estructural | suggested_controls NOT NULL DEFAULT '{}'::text[] |
| public | iso_risk_matrix_items | suggested_actions_not_null | NOT NULL estructural | suggested_actions NOT NULL DEFAULT '[]'::jsonb |
| public | iso_risk_matrix_items | evidence_expectations_not_null | NOT NULL estructural | evidence_expectations NOT NULL DEFAULT '[]'::jsonb |
| public | iso_risk_matrix_items | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'suggested'::text |
| public | iso_risk_matrix_items | confidence_not_null | NOT NULL estructural | confidence NOT NULL DEFAULT 0.75 |
| public | iso_risk_matrix_items | source_type_not_null | NOT NULL estructural | source_type NOT NULL DEFAULT 'risk_template'::text |
| public | iso_risk_matrix_items | source_trace_json_not_null | NOT NULL estructural | source_trace_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_items | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_risk_matrix_items | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_risk_matrix_runs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_risk_matrix_runs | tenant_id_not_null | NOT NULL estructural | tenant_id NOT NULL |
| public | iso_risk_matrix_runs | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_risk_matrix_runs | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_risk_matrix_runs | run_type_not_null | NOT NULL estructural | run_type NOT NULL DEFAULT 'automated'::text |
| public | iso_risk_matrix_runs | run_status_not_null | NOT NULL estructural | run_status NOT NULL DEFAULT 'completed'::text |
| public | iso_risk_matrix_runs | certifiable_version_not_null | NOT NULL estructural | certifiable_version NOT NULL DEFAULT false |
| public | iso_risk_matrix_runs | total_assets_not_null | NOT NULL estructural | total_assets NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | total_risk_templates_not_null | NOT NULL estructural | total_risk_templates NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | suggested_risks_count_not_null | NOT NULL estructural | suggested_risks_count NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | accepted_risks_count_not_null | NOT NULL estructural | accepted_risks_count NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | rejected_risks_count_not_null | NOT NULL estructural | rejected_risks_count NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | critical_risks_count_not_null | NOT NULL estructural | critical_risks_count NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | high_risks_count_not_null | NOT NULL estructural | high_risks_count NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | medium_risks_count_not_null | NOT NULL estructural | medium_risks_count NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | low_risks_count_not_null | NOT NULL estructural | low_risks_count NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | inherent_risk_avg_not_null | NOT NULL estructural | inherent_risk_avg NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | residual_risk_avg_not_null | NOT NULL estructural | residual_risk_avg NOT NULL DEFAULT 0 |
| public | iso_risk_matrix_runs | summary_json_not_null | NOT NULL estructural | summary_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_runs | input_json_not_null | NOT NULL estructural | input_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_runs | result_json_not_null | NOT NULL estructural | result_json NOT NULL DEFAULT '{}'::jsonb |
| public | iso_risk_matrix_runs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_risk_matrix_runs | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_risk_templates | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_risk_templates | standard_version_id_not_null | NOT NULL estructural | standard_version_id NOT NULL |
| public | iso_risk_templates | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_risk_templates | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_risk_templates | risk_code_not_null | NOT NULL estructural | risk_code NOT NULL |
| public | iso_risk_templates | title_not_null | NOT NULL estructural | title NOT NULL |
| public | iso_risk_templates | typical_causes_not_null | NOT NULL estructural | typical_causes NOT NULL DEFAULT '[]'::jsonb |
| public | iso_risk_templates | typical_consequences_not_null | NOT NULL estructural | typical_consequences NOT NULL DEFAULT '[]'::jsonb |
| public | iso_risk_templates | suggested_controls_not_null | NOT NULL estructural | suggested_controls NOT NULL DEFAULT '{}'::text[] |
| public | iso_risk_templates | suggested_treatments_not_null | NOT NULL estructural | suggested_treatments NOT NULL DEFAULT '[]'::jsonb |
| public | iso_risk_templates | default_likelihood_not_null | NOT NULL estructural | default_likelihood NOT NULL DEFAULT 3 |
| public | iso_risk_templates | default_impact_not_null | NOT NULL estructural | default_impact NOT NULL DEFAULT 3 |
| public | iso_risk_templates | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_risk_templates | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_standard_versions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_standard_versions | standard_id_not_null | NOT NULL estructural | standard_id NOT NULL |
| public | iso_standard_versions | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_standard_versions | version_code_not_null | NOT NULL estructural | version_code NOT NULL |
| public | iso_standard_versions | display_name_not_null | NOT NULL estructural | display_name NOT NULL |
| public | iso_standard_versions | publication_status_not_null | NOT NULL estructural | publication_status NOT NULL |
| public | iso_standard_versions | certifiable_not_null | NOT NULL estructural | certifiable NOT NULL DEFAULT false |
| public | iso_standard_versions | source_policy_not_null | NOT NULL estructural | source_policy NOT NULL DEFAULT 'copyright_safe_summary'::text |
| public | iso_standard_versions | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | iso_standard_versions | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_standard_versions | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_standards | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_standards | standard_code_not_null | NOT NULL estructural | standard_code NOT NULL |
| public | iso_standards | display_name_not_null | NOT NULL estructural | display_name NOT NULL |
| public | iso_standards | family_not_null | NOT NULL estructural | family NOT NULL |
| public | iso_standards | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | iso_standards | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_standards | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | iso_transition_guidance | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | iso_transition_guidance | source_standard_code_not_null | NOT NULL estructural | source_standard_code NOT NULL |
| public | iso_transition_guidance | source_version_code_not_null | NOT NULL estructural | source_version_code NOT NULL |
| public | iso_transition_guidance | target_standard_code_not_null | NOT NULL estructural | target_standard_code NOT NULL |
| public | iso_transition_guidance | target_version_code_not_null | NOT NULL estructural | target_version_code NOT NULL |
| public | iso_transition_guidance | transition_status_not_null | NOT NULL estructural | transition_status NOT NULL |
| public | iso_transition_guidance | certifiable_target_not_null | NOT NULL estructural | certifiable_target NOT NULL DEFAULT false |
| public | iso_transition_guidance | recommended_actions_not_null | NOT NULL estructural | recommended_actions NOT NULL DEFAULT '[]'::jsonb |
| public | iso_transition_guidance | caveats_not_null | NOT NULL estructural | caveats NOT NULL DEFAULT '[]'::jsonb |
| public | iso_transition_guidance | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | iso_transition_guidance | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | kpi_calculation_jobs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | kpi_calculation_jobs | job_type_not_null | NOT NULL estructural | job_type NOT NULL |
| public | kpi_calculation_jobs | trigger_source_not_null | NOT NULL estructural | trigger_source NOT NULL DEFAULT 'manual'::character varying |
| public | kpi_calculation_jobs | status_not_null | NOT NULL estructural | status NOT NULL DEFAULT 'pending'::kpi_job_status_enum |
| public | kpi_calculation_jobs | payload_json_not_null | NOT NULL estructural | payload_json NOT NULL DEFAULT '{}'::jsonb |
| public | kpi_calculation_jobs | result_json_not_null | NOT NULL estructural | result_json NOT NULL DEFAULT '{}'::jsonb |
| public | kpi_calculation_jobs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | kpi_calculation_jobs | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | kpi_calculation_rules | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | kpi_calculation_rules | kpi_id_not_null | NOT NULL estructural | kpi_id NOT NULL |
| public | kpi_calculation_rules | version_not_null | NOT NULL estructural | version NOT NULL DEFAULT 1 |
| public | kpi_calculation_rules | rule_name_not_null | NOT NULL estructural | rule_name NOT NULL |
| public | kpi_calculation_rules | calculation_mode_not_null | NOT NULL estructural | calculation_mode NOT NULL DEFAULT 'sql'::character varying |
| public | kpi_calculation_rules | is_default_not_null | NOT NULL estructural | is_default NOT NULL DEFAULT true |
| public | kpi_calculation_rules | is_active_not_null | NOT NULL estructural | is_active NOT NULL DEFAULT true |
| public | kpi_calculation_rules | metadata_not_null | NOT NULL estructural | metadata NOT NULL DEFAULT '{}'::jsonb |
| public | kpi_calculation_rules | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | kpi_calculation_rules | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | kpi_custom_inputs | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | kpi_custom_inputs | kpi_id_not_null | NOT NULL estructural | kpi_id NOT NULL |
| public | kpi_custom_inputs | input_key_not_null | NOT NULL estructural | input_key NOT NULL |
| public | kpi_custom_inputs | input_label_not_null | NOT NULL estructural | input_label NOT NULL |
| public | kpi_custom_inputs | input_type_not_null | NOT NULL estructural | input_type NOT NULL DEFAULT 'number'::character varying |
| public | kpi_custom_inputs | is_required_not_null | NOT NULL estructural | is_required NOT NULL DEFAULT true |
| public | kpi_custom_inputs | validation_rules_not_null | NOT NULL estructural | validation_rules NOT NULL DEFAULT '{}'::jsonb |
| public | kpi_custom_inputs | display_order_not_null | NOT NULL estructural | display_order NOT NULL DEFAULT 0 |
| public | kpi_custom_inputs | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | kpi_custom_inputs | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | kpi_data_sources | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | kpi_data_sources | kpi_id_not_null | NOT NULL estructural | kpi_id NOT NULL |
| public | kpi_data_sources | source_name_not_null | NOT NULL estructural | source_name NOT NULL |
| public | kpi_data_sources | source_table_not_null | NOT NULL estructural | source_table NOT NULL |
| public | kpi_data_sources | is_required_not_null | NOT NULL estructural | is_required NOT NULL DEFAULT true |
| public | kpi_data_sources | filter_json_not_null | NOT NULL estructural | filter_json NOT NULL DEFAULT '{}'::jsonb |
| public | kpi_data_sources | created_at_not_null | NOT NULL estructural | created_at NOT NULL DEFAULT now() |
| public | kpi_data_sources | updated_at_not_null | NOT NULL estructural | updated_at NOT NULL DEFAULT now() |
| public | kpi_definitions | id_not_null | NOT NULL estructural | id NOT NULL DEFAULT gen_random_uuid() |
| public | kpi_definitions | code_not_null | NOT NULL estructural | code NOT NULL |
| public | kpi_definitions | name_not_null | NOT NULL estructural | name NOT NULL |
| public | kpi_definitions | category_not_null | NOT NULL estructural | category NOT NULL |
| public | kpi_definitions | kpi_type_not_null | NOT NULL estructural | kpi_type NOT NULL |
| public | kpi_definitions | scope_not_null | NOT NULL estructural | scope NOT NULL DEFAULT 'global'::kpi_scope_enum |
| public | kpi_definitions | unit_not_null | NOT NULL estructural | unit NOT NULL |

Fuente: `pg_catalog.pg_constraint`, `pg_catalog.pg_get_constraintdef`, `information_schema.columns`.
