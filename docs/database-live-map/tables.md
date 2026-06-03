# Tables

| Schema | Tabla | Tipo | Columnas | PK | FKs salientes | FKs entrantes | Tiene tenant_id | Módulo inferido | Observación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ai_core | ai_core_migrations | BASE TABLE | 4 | ai_core_migrations_pkey | 0 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | ai_feedback | BASE TABLE | 14 | ai_feedback_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | ai_response_feedback | BASE TABLE | 18 | ai_response_feedback_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | ai_response_traces | BASE TABLE | 26 | ai_response_traces_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | clause_control_domain_map | BASE TABLE | 11 | clause_control_domain_map_pkey | 2 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| ai_core | closure_criteria | BASE TABLE | 14 | closure_criteria_pkey | 1 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | domain_closure_criteria | BASE TABLE | 13 | domain_closure_criteria_pkey | 2 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | domain_evidence_expectations | BASE TABLE | 13 | domain_evidence_expectations_pkey | 2 | 0 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| ai_core | domain_problem_type_map | BASE TABLE | 9 | domain_problem_type_map_pkey | 2 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | domain_solution_playbooks | BASE TABLE | 16 | domain_solution_playbooks_pkey | 2 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | domains_catalog | BASE TABLE | 10 | domains_catalog_pkey | 0 | 7 | No | Normas ISO | Probable catálogo global compartido. |
| ai_core | evidence_expectations | BASE TABLE | 14 | evidence_expectations_pkey | 1 | 0 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| ai_core | external_lookup_extra_charges | BASE TABLE | 13 | external_lookup_extra_charges_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | external_lookup_logs | BASE TABLE | 15 | external_lookup_logs_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | external_lookup_quota_audit | BASE TABLE | 13 | external_lookup_quota_audit_pkey | 0 | 0 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| ai_core | external_lookup_quotas | BASE TABLE | 9 | external_lookup_quotas_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | finding_scenarios | BASE TABLE | 29 | finding_scenarios_pkey | 0 | 0 | No | Hallazgos | Revisar si requiere aislamiento multi-tenant. |
| ai_core | invalid_evidence_patterns | BASE TABLE | 12 | invalid_evidence_patterns_pkey | 0 | 0 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| ai_core | priority_rules | BASE TABLE | 11 | priority_rules_pkey | 0 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | problem_types | BASE TABLE | 12 | problem_types_pkey | 0 | 8 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | response_templates | BASE TABLE | 11 | response_templates_pkey | 0 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | solution_playbooks | BASE TABLE | 17 | solution_playbooks_pkey | 1 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| ai_core | standard_domain_map | BASE TABLE | 12 | standard_domain_map_pkey | 2 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| ai_core | standard_specific_overrides | BASE TABLE | 12 | standard_specific_overrides_pkey | 3 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| ai_core | standards_catalog | BASE TABLE | 12 | standards_catalog_pkey | 0 | 3 | No | Normas ISO | Probable catálogo global compartido. |
| ai_core | trusted_external_sources | BASE TABLE | 14 | trusted_external_sources_pkey | 0 | 0 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| ai_core | v_action_context | VIEW | 14 | - | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | v_ai_useful_feedback_cases | VIEW | 20 | - | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | v_control_context | VIEW | 23 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| ai_core | v_evidence_context | VIEW | 12 | - | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| ai_core | v_external_lookup_usage_monthly | VIEW | 4 | - | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| ai_core | v_finding_context | VIEW | 14 | - | 0 | 0 | Sí | Hallazgos | Objeto tenant-scoped por columna tenant_id. |
| ai_core | v_finding_scenarios_active | VIEW | 28 | - | 0 | 0 | No | Hallazgos | Revisar si requiere aislamiento multi-tenant. |
| ai_core | v_kpi_context | VIEW | 18 | - | 0 | 0 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| ai_core | v_tenant_health_context | VIEW | 11 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| ai_core | view_definition_backups | BASE TABLE | 6 | view_definition_backups_pkey | 0 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| public | action_plan_updates | BASE TABLE | 10 | action_plan_updates_pkey | 2 | 0 | Sí | Planes de acción | Objeto tenant-scoped por columna tenant_id. |
| public | action_plans | BASE TABLE | 33 | action_plans_pkey | 7 | 1 | Sí | Planes de acción | Objeto tenant-scoped por columna tenant_id. |
| public | action_plans_backup_history | BASE TABLE | 5 | action_plans_backup_history_pkey | 0 | 0 | No | Planes de acción | Revisar si requiere aislamiento multi-tenant. |
| public | admin_audit_log | BASE TABLE | 14 | admin_audit_log_pkey | 2 | 0 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| public | ai_auditor_runs | BASE TABLE | 35 | ai_auditor_runs_pkey | 0 | 0 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| public | ai_bootstrap_knowledge_items | BASE TABLE | 36 | ai_bootstrap_knowledge_items_pkey | 3 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| public | ai_bootstrap_knowledge_runs | BASE TABLE | 20 | ai_bootstrap_knowledge_runs_pkey | 0 | 1 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| public | ai_bootstrap_knowledge_sources | BASE TABLE | 12 | ai_bootstrap_knowledge_sources_pkey | 0 | 1 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| public | ai_bootstrap_knowledge_topics | BASE TABLE | 15 | ai_bootstrap_knowledge_topics_pkey | 0 | 1 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| public | ai_knowledge_datasets | BASE TABLE | 12 | ai_knowledge_datasets_pkey | 0 | 2 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| public | ai_knowledge_records | BASE TABLE | 29 | ai_knowledge_records_pkey | 1 | 0 | No | IA / conocimiento | Revisar si requiere aislamiento multi-tenant. |
| public | ai_knowledge_standards | BASE TABLE | 22 | ai_knowledge_standards_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | ai_prompt_logs | BASE TABLE | 12 | ai_prompt_logs_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| public | ai_suggestions | BASE TABLE | 16 | ai_suggestions_pkey | 0 | 0 | Sí | IA / conocimiento | Objeto tenant-scoped por columna tenant_id. |
| public | app_roles | BASE TABLE | 8 | app_roles_pkey | 0 | 1 | No | Auth / usuarios | Revisar si requiere aislamiento multi-tenant. |
| public | assessments | BASE TABLE | 5 | assessments_pkey | 2 | 1 | Sí | No determinado | Objeto tenant-scoped por columna tenant_id. |
| public | asset_risks | BASE TABLE | 7 | asset_risks_pkey | 0 | 0 | No | Riesgos | Revisar si requiere aislamiento multi-tenant. |
| public | asset_standards | BASE TABLE | 4 | asset_standards_pkey | 2 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | assets | BASE TABLE | 8 | assets_pkey | 0 | 4 | Sí | Activos | Objeto tenant-scoped por columna tenant_id. |
| public | audit_control_reviews | BASE TABLE | 15 | audit_control_reviews_pkey | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | audit_document_generation_runs | BASE TABLE | 12 | audit_document_generation_runs_pkey | 4 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | audit_document_templates | BASE TABLE | 13 | audit_document_templates_pkey | 0 | 1 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| public | audit_documentary_sources | BASE TABLE | 19 | audit_documentary_sources_pkey | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | audit_event_log | BASE TABLE | 10 | audit_event_log_pkey | 0 | 0 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| public | audit_evidence_index | BASE TABLE | 18 | audit_evidence_index_pkey | 4 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | audit_package_documents | BASE TABLE | 38 | audit_package_documents_pkey | 10 | 3 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | audit_preparation_packages | BASE TABLE | 15 | audit_preparation_packages_pkey | 3 | 4 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| public | audit_uploaded_zip_files | BASE TABLE | 17 | audit_uploaded_zip_files_pkey | 4 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | audits | BASE TABLE | 14 | audits_pkey | 0 | 7 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| public | clauses | BASE TABLE | 4 | clauses_pkey | 1 | 1 | No | Normas ISO | Probable catálogo global compartido. |
| public | control_health_scores | BASE TABLE | 23 | control_health_scores_pkey | 2 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | control_health_scores_backup_history | BASE TABLE | 26 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | control_health_scores_v2_preview | BASE TABLE | 26 | control_health_scores_v2_preview_pkey | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | control_soa | BASE TABLE | 9 | control_soa_pkey | 1 | 0 | No | Controles | Revisar si requiere aislamiento multi-tenant. |
| public | controls | BASE TABLE | 8 | controls_pkey | 1 | 2 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | controls_catalog | BASE TABLE | 11 | controls_catalog_pkey | 2 | 8 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | controls_catalog_standards | BASE TABLE | 7 | controls_catalog_standards_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | dealer_requests | BASE TABLE | 13 | dealer_requests_pkey | 3 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | dealer_tenant_access | BASE TABLE | 6 | dealer_tenant_access_pkey | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | dealer_tenants | BASE TABLE | 16 | dealer_tenants_pkey | 4 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | document_ai_analysis | BASE TABLE | 14 | document_ai_analysis_pkey | 1 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | document_association_suggestions | BASE TABLE | 13 | document_association_suggestions_pkey | 1 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | document_index | BASE TABLE | 23 | document_index_pkey | 2 | 3 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | document_sync_logs | BASE TABLE | 14 | document_sync_logs_pkey | 2 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | evidence_ai_assessments | BASE TABLE | 43 | evidence_ai_assessments_pkey | 6 | 1 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | evidence_ai_jobs | BASE TABLE | 18 | evidence_ai_jobs_pkey | 3 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | evidence_document_extracts | BASE TABLE | 21 | evidence_document_extracts_pkey | 2 | 2 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | evidence_document_links | BASE TABLE | 7 | evidence_document_links_pkey | 2 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | evidence_knowledge_chunks | BASE TABLE | 23 | evidence_knowledge_chunks_pkey | 7 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | evidence_tenant_control_migration_log | BASE TABLE | 6 | evidence_tenant_control_migration_log_pkey | 0 | 0 | No | Tenants / SaaS | Revisar si requiere aislamiento multi-tenant. |
| public | evidences | BASE TABLE | 27 | evidences_pkey | 1 | 6 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | evidences_backup_history | BASE TABLE | 5 | evidences_backup_history_pkey | 0 | 0 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| public | findings | BASE TABLE | 21 | findings_pkey | 6 | 1 | Sí | Hallazgos | Objeto tenant-scoped por columna tenant_id. |
| public | iso_ai_guidance | BASE TABLE | 12 | iso_ai_guidance_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_audit_questions | BASE TABLE | 12 | iso_audit_questions_pkey | 3 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_catalog_sync_status | BASE TABLE | 12 | iso_catalog_sync_status_pkey | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_clause_guides | BASE TABLE | 6 | iso_clause_guides_pkey | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_clauses | BASE TABLE | 12 | iso_clauses_pkey | 1 | 2 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_control_catalog_links | BASE TABLE | 15 | iso_control_catalog_links_pkey | 2 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_control_mapping_apply_log | BASE TABLE | 15 | iso_control_mapping_apply_log_pkey | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_control_mappings | BASE TABLE | 11 | iso_control_mappings_pkey | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_controls | BASE TABLE | 17 | iso_controls_pkey | 2 | 6 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_document_audit_log | BASE TABLE | 9 | iso_document_audit_log_pkey | 1 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_document_generation_runs | BASE TABLE | 14 | iso_document_generation_runs_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_evidence_expectations | BASE TABLE | 15 | iso_evidence_expectations_pkey | 2 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_express_assessment_answers | BASE TABLE | 10 | iso_express_assessment_answers_pkey | 1 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_express_assessment_audit_log | BASE TABLE | 9 | iso_express_assessment_audit_log_pkey | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_express_assessment_gaps | BASE TABLE | 18 | iso_express_assessment_gaps_pkey | 2 | 1 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_express_assessment_items | BASE TABLE | 31 | iso_express_assessment_items_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_express_assessments | BASE TABLE | 33 | iso_express_assessments_pkey | 2 | 6 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_gap_rules | BASE TABLE | 14 | iso_gap_rules_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_generated_document_sections | BASE TABLE | 11 | iso_generated_document_sections_pkey | 1 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_generated_documents | BASE TABLE | 26 | iso_generated_documents_pkey | 5 | 2 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_maturity_rules | BASE TABLE | 12 | iso_maturity_rules_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_operational_suggestion_audit_log | BASE TABLE | 9 | iso_operational_suggestion_audit_log_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_operational_suggestions | BASE TABLE | 32 | iso_operational_suggestions_pkey | 5 | 2 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_policy_templates | BASE TABLE | 14 | iso_policy_templates_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_procedure_templates | BASE TABLE | 15 | iso_procedure_templates_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_recommended_action_conversions | BASE TABLE | 13 | iso_recommended_action_conversions_pkey | 3 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_recommended_action_workflow_events | BASE TABLE | 10 | iso_recommended_action_workflow_events_pkey | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_risk_matrix_actions | BASE TABLE | 15 | iso_risk_matrix_actions_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_risk_matrix_audit_log | BASE TABLE | 10 | iso_risk_matrix_audit_log_pkey | 3 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_risk_matrix_items | BASE TABLE | 41 | iso_risk_matrix_items_pkey | 9 | 2 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_risk_matrix_runs | BASE TABLE | 28 | iso_risk_matrix_runs_pkey | 3 | 3 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | iso_risk_templates | BASE TABLE | 16 | iso_risk_templates_pkey | 1 | 1 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_standard_versions | BASE TABLE | 15 | iso_standard_versions_pkey | 1 | 10 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_standards | BASE TABLE | 8 | iso_standards_pkey | 0 | 1 | No | Normas ISO | Probable catálogo global compartido. |
| public | iso_transition_guidance | BASE TABLE | 12 | iso_transition_guidance_pkey | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | kpi_calculation_jobs | BASE TABLE | 13 | kpi_calculation_jobs_pkey | 2 | 0 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| public | kpi_calculation_rules | BASE TABLE | 16 | kpi_calculation_rules_pkey | 2 | 1 | No | KPIs | Revisar si requiere aislamiento multi-tenant. |
| public | kpi_custom_inputs | BASE TABLE | 11 | kpi_custom_inputs_pkey | 1 | 0 | No | KPIs | Revisar si requiere aislamiento multi-tenant. |
| public | kpi_data_sources | BASE TABLE | 10 | kpi_data_sources_pkey | 1 | 0 | No | Evidencias | Revisar si requiere aislamiento multi-tenant. |
| public | kpi_definitions | BASE TABLE | 24 | kpi_definitions_pkey | 2 | 9 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| public | kpi_dimensions_catalog | BASE TABLE | 10 | kpi_dimensions_catalog_pkey | 1 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | kpi_event_queue | BASE TABLE | 10 | kpi_event_queue_pkey | 1 | 0 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| public | kpi_manual_values | BASE TABLE | 15 | kpi_manual_values_pkey | 4 | 0 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| public | kpi_snapshot_dimensions | BASE TABLE | 7 | kpi_snapshot_dimensions_pkey | 1 | 0 | No | KPIs | Revisar si requiere aislamiento multi-tenant. |
| public | kpi_snapshots | BASE TABLE | 20 | kpi_snapshots_pkey | 4 | 1 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| public | kpi_staging_import | BASE TABLE | 20 | kpi_staging_import_pkey | 0 | 0 | No | KPIs | Revisar si requiere aislamiento multi-tenant. |
| public | kpi_standard_mappings | BASE TABLE | 10 | kpi_standard_mappings_pkey | 2 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | kpi_thresholds | BASE TABLE | 12 | kpi_thresholds_pkey | 1 | 0 | No | KPIs | Revisar si requiere aislamiento multi-tenant. |
| public | lifecycle_stage_catalog | BASE TABLE | 6 | lifecycle_stage_catalog_pkey | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | management_objectives | BASE TABLE | 21 | management_objectives_pkey | 1 | 0 | Sí | Configuración | Objeto tenant-scoped por columna tenant_id. |
| public | nonconformities_catalog | BASE TABLE | 4 | nonconformities_catalog_pkey | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | notifications | BASE TABLE | 14 | notifications_pkey | 1 | 0 | Sí | Configuración | Objeto tenant-scoped por columna tenant_id. |
| public | permissions | BASE TABLE | 7 | permissions_pkey | 0 | 1 | No | Auth / usuarios | Revisar si requiere aislamiento multi-tenant. |
| public | report_access_rules | BASE TABLE | 7 | report_access_rules_pkey | 1 | 0 | No | Reportes / exportes | Revisar si requiere aislamiento multi-tenant. |
| public | report_access_rules_backup_20260430 | BASE TABLE | 7 | - | 0 | 0 | No | Reportes / exportes | Revisar si requiere aislamiento multi-tenant. |
| public | report_exports | BASE TABLE | 11 | report_exports_pkey | 1 | 0 | Sí | Reportes / exportes | Objeto tenant-scoped por columna tenant_id. |
| public | report_schedules | BASE TABLE | 14 | report_schedules_pkey | 1 | 0 | Sí | Reportes / exportes | Objeto tenant-scoped por columna tenant_id. |
| public | report_types | BASE TABLE | 12 | report_types_pkey | 0 | 3 | No | Reportes / exportes | Revisar si requiere aislamiento multi-tenant. |
| public | responses | BASE TABLE | 7 | responses_pkey | 2 | 0 | No | No determinado | - |
| public | role_permissions | BASE TABLE | 5 | role_permissions_pkey | 2 | 0 | No | Auth / usuarios | Revisar si requiere aislamiento multi-tenant. |
| public | roles | BASE TABLE | 2 | roles_pkey | 0 | 1 | No | Auth / usuarios | Revisar si requiere aislamiento multi-tenant. |
| public | saas_modules | BASE TABLE | 9 | saas_modules_pkey | 0 | 1 | No | Tenants / SaaS | Revisar si requiere aislamiento multi-tenant. |
| public | saas_monthly_prebilling | BASE TABLE | 20 | saas_monthly_prebilling_pkey | 2 | 1 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | saas_monthly_prebilling_lines | BASE TABLE | 17 | saas_monthly_prebilling_lines_pkey | 2 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | saas_price_catalog | BASE TABLE | 12 | saas_price_catalog_pkey | 0 | 0 | No | Tenants / SaaS | Revisar si requiere aislamiento multi-tenant. |
| public | saas_quote_lines | BASE TABLE | 12 | saas_quote_lines_pkey | 1 | 0 | No | Tenants / SaaS | Revisar si requiere aislamiento multi-tenant. |
| public | saas_quotes | BASE TABLE | 26 | saas_quotes_pkey | 3 | 1 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | search_history | BASE TABLE | 8 | search_history_pkey | 2 | 0 | Sí | Sistema / logs | Objeto tenant-scoped por columna tenant_id. |
| public | standard_lifecycle_ai_feed | BASE TABLE | 10 | standard_lifecycle_ai_feed_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | standard_lifecycle_snapshots | BASE TABLE | 22 | standard_lifecycle_snapshots_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | standard_lifecycle_stage_requests | BASE TABLE | 16 | standard_lifecycle_stage_requests_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | standard_lifecycle_status | BASE TABLE | 28 | standard_lifecycle_status_pkey | 2 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | standards | BASE TABLE | 3 | standards_pkey | 0 | 11 | No | Normas ISO | Probable catálogo global compartido. |
| public | tcdx_async_jobs | BASE TABLE | 20 | tcdx_async_jobs_pkey | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicability_exclusions | BASE TABLE | 13 | tenant_applicability_exclusions_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | BASE TABLE | 15 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicability_profiles | BASE TABLE | 18 | tenant_applicability_profiles_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicability_runs | BASE TABLE | 10 | tenant_applicability_runs_pkey | 2 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicable_controls | BASE TABLE | 19 | tenant_applicable_controls_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicable_controls_cleanup_backup_20260525 | BASE TABLE | 21 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicable_evidence_requirements | BASE TABLE | 15 | tenant_applicable_evidence_requirements_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | BASE TABLE | 17 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicable_kpis | BASE TABLE | 16 | tenant_applicable_kpis_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | BASE TABLE | 18 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_billing_settings | BASE TABLE | 12 | tenant_billing_settings_pkey | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_company_profiles | BASE TABLE | 19 | tenant_company_profiles_pkey | 3 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_contracts | BASE TABLE | 17 | tenant_contracts_pkey | 2 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_controls | BASE TABLE | 16 | tenant_controls_pkey | 3 | 6 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_document_provider_credentials | BASE TABLE | 13 | tenant_document_provider_credentials_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_document_sources | BASE TABLE | 23 | tenant_document_sources_pkey | 1 | 5 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_integrations | BASE TABLE | 16 | tenant_integrations_pkey | 0 | 3 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_kpi_settings | BASE TABLE | 12 | tenant_kpi_settings_pkey | 2 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_module_settings | BASE TABLE | 12 | tenant_module_settings_pkey | 4 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_monthly_preinvoices | BASE TABLE | 16 | tenant_monthly_preinvoices_pkey | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_nonconformities | BASE TABLE | 8 | tenant_nonconformities_pkey | 0 | 2 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_operations | BASE TABLE | 12 | tenant_operations_pkey | 1 | 8 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_standard_audit | BASE TABLE | 10 | tenant_standard_audit_pkey | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_standard_operations | BASE TABLE | 8 | tenant_standard_operations_pkey | 3 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_standards | BASE TABLE | 13 | tenant_standards_pkey | 2 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_sync_agent_pairing_codes | BASE TABLE | 8 | tenant_sync_agent_pairing_codes_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenant_sync_agents | BASE TABLE | 14 | tenant_sync_agents_pkey | 1 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | tenants | BASE TABLE | 29 | tenants_pkey | 0 | 55 | No | Tenants / SaaS | Revisar si requiere aislamiento multi-tenant. |
| public | user_dashboard_preferences | BASE TABLE | 7 | user_dashboard_preferences_pkey | 2 | 0 | Sí | Auth / usuarios | Objeto tenant-scoped por columna tenant_id. |
| public | user_roles | BASE TABLE | 2 | user_roles_pkey | 2 | 0 | No | Auth / usuarios | Revisar si requiere aislamiento multi-tenant. |
| public | users | BASE TABLE | 11 | users_pkey | 1 | 42 | Sí | Auth / usuarios | Objeto tenant-scoped por columna tenant_id. |
| public | users_backup_before_role_governance_20260417 | BASE TABLE | 11 | - | 0 | 0 | Sí | Auth / usuarios | Objeto tenant-scoped por columna tenant_id. |
| public | users_backup_before_role_normalization_20260430 | BASE TABLE | 11 | - | 0 | 0 | Sí | Auth / usuarios | Objeto tenant-scoped por columna tenant_id. |
| public | v_audit_action_plan_timeline | VIEW | 26 | - | 0 | 0 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| public | v_audit_control_recovery_timeline | VIEW | 16 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | v_audit_event_log_enriched | VIEW | 44 | - | 0 | 0 | Sí | Auditorías | Objeto tenant-scoped por columna tenant_id. |
| public | v_audit_evidence_timeline | VIEW | 29 | - | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | v_catalog_controls_without_iso_link | VIEW | 9 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_control_health_base | VIEW | 20 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | v_control_health_detail | VIEW | 31 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | v_control_health_risks | VIEW | 31 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | v_control_health_risks_applicable | VIEW | 37 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | v_controls_recovered_by_remediation | VIEW | 14 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | v_controls_without_evidence | VIEW | 31 | - | 0 | 0 | Sí | Controles | Objeto tenant-scoped por columna tenant_id. |
| public | v_dealer_tenants | VIEW | 16 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_evidence_approval_queue | VIEW | 20 | - | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_dashboard_by_standard | VIEW | 24 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_dashboard_by_standard_applicable | VIEW | 23 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_dashboard_summary | VIEW | 22 | - | 0 | 0 | Sí | Health | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_dashboard_summary_applicable | VIEW | 26 | - | 0 | 0 | Sí | Health | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_remediation_plan | VIEW | 39 | - | 0 | 0 | Sí | Planes de acción | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_remediation_summary_by_standard | VIEW | 15 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_remediation_summary_by_tenant | VIEW | 15 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_root_causes_by_standard | VIEW | 24 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_health_root_causes_by_tenant | VIEW | 31 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_catalog_sync_summary | VIEW | 9 | - | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | v_iso_control_catalog_coverage | VIEW | 12 | - | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | v_iso_control_effective_health | VIEW | 44 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_control_effective_health_applicable | VIEW | 49 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_controls_without_catalog_link | VIEW | 8 | - | 0 | 0 | No | Normas ISO | Probable catálogo global compartido. |
| public | v_iso_document_summary_by_tenant | VIEW | 10 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_effective_kpi_summary | VIEW | 29 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_effective_kpi_summary_applicable | VIEW | 33 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_express_gap_summary | VIEW | 9 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_express_latest_assessments | VIEW | 33 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_express_tenant_standard_readiness | VIEW | 10 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_generated_documents_latest | VIEW | 26 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_operational_suggestions_queue | VIEW | 37 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_operational_suggestions_summary | VIEW | 15 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_risk_matrix_actions_summary | VIEW | 10 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_risk_matrix_by_asset | VIEW | 9 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_risk_matrix_latest_runs | VIEW | 25 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_iso_risk_matrix_summary | VIEW | 16 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_latest_health_kpi_snapshots | VIEW | 24 | - | 0 | 0 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| public | v_latest_health_kpi_snapshots_applicable | VIEW | 29 | - | 0 | 0 | Sí | KPIs | Objeto tenant-scoped por columna tenant_id. |
| public | v_remediation_executive_by_standard | VIEW | 14 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_remediation_executive_by_tenant | VIEW | 19 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_saas_prebilling_tenant_context | VIEW | 14 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_standard_health_summary | VIEW | 18 | - | 0 | 0 | Sí | Normas ISO | Objeto tenant-scoped por columna tenant_id. |
| public | v_tenant_governance_summary | VIEW | 11 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_tenant_health_summary | VIEW | 16 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_tenant_modules | VIEW | 11 | - | 0 | 0 | Sí | Tenants / SaaS | Objeto tenant-scoped por columna tenant_id. |
| public | v_user_permissions | VIEW | 8 | - | 0 | 0 | No | Auth / usuarios | Revisar si requiere aislamiento multi-tenant. |
| public | vw_evidence_ai_state | VIEW | 37 | - | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | vw_evidence_current_ai_assessments | VIEW | 43 | - | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |
| public | vw_evidence_current_extracts | VIEW | 21 | - | 0 | 0 | Sí | Evidencias | Objeto tenant-scoped por columna tenant_id. |

Fuente: `information_schema.tables`, `information_schema.columns`, `pg_catalog.pg_constraint`, `pg_catalog.pg_attribute`.
