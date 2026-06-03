# Tenant Structure Review

## Resumen
- Tablas con `tenant_id`: 166.
- FKs o columnas relacionadas con tenants: 55.
- Tablas con `tenant_id` sin índice por tenant evidente: 77.

| Tabla | Tiene tenant_id | Debe tener tenant_id | Motivo | Riesgo |
| --- | --- | --- | --- | --- |
| ai_core.ai_core_migrations | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.ai_feedback | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.ai_response_feedback | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.ai_response_traces | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.clause_control_domain_map | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| ai_core.closure_criteria | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.domain_closure_criteria | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.domain_evidence_expectations | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.domain_problem_type_map | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.domain_solution_playbooks | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.domains_catalog | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| ai_core.evidence_expectations | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.external_lookup_extra_charges | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.external_lookup_logs | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.external_lookup_quota_audit | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| ai_core.external_lookup_quotas | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.finding_scenarios | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.invalid_evidence_patterns | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.priority_rules | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.problem_types | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.response_templates | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.solution_playbooks | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.standard_domain_map | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| ai_core.standard_specific_overrides | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| ai_core.standards_catalog | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| ai_core.trusted_external_sources | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.v_action_context | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.v_ai_useful_feedback_cases | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.v_control_context | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.v_evidence_context | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.v_external_lookup_usage_monthly | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.v_finding_context | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.v_finding_scenarios_active | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| ai_core.v_kpi_context | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| ai_core.v_tenant_health_context | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| ai_core.view_definition_backups | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.action_plan_updates | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.action_plans | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.action_plans_backup_history | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.admin_audit_log | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.ai_auditor_runs | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.ai_bootstrap_knowledge_items | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.ai_bootstrap_knowledge_runs | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.ai_bootstrap_knowledge_sources | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.ai_bootstrap_knowledge_topics | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.ai_knowledge_datasets | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.ai_knowledge_records | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.ai_knowledge_standards | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.ai_prompt_logs | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.ai_suggestions | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.app_roles | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.assessments | Sí | Sí | Revisar manualmente. | Bajo |
| public.asset_risks | No | Probable sí | Diferenciador; exponer según madurez MVP. | Alto/Medio |
| public.asset_standards | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.assets | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.audit_control_reviews | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.audit_document_generation_runs | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.audit_document_templates | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.audit_documentary_sources | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.audit_event_log | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.audit_evidence_index | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.audit_package_documents | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.audit_preparation_packages | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.audit_uploaded_zip_files | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.audits | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.clauses | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.control_health_scores | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.control_health_scores_backup_history | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.control_health_scores_v2_preview | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.control_soa | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.controls | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.controls_catalog | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.controls_catalog_standards | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.dealer_requests | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.dealer_tenant_access | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.dealer_tenants | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.document_ai_analysis | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.document_association_suggestions | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.document_index | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.document_sync_logs | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.evidence_ai_assessments | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.evidence_ai_jobs | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.evidence_document_extracts | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.evidence_document_links | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.evidence_knowledge_chunks | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.evidence_tenant_control_migration_log | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.evidences | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.evidences_backup_history | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.findings | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.iso_ai_guidance | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_audit_questions | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_catalog_sync_status | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_clause_guides | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_clauses | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_control_catalog_links | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_control_mapping_apply_log | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_control_mappings | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_controls | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_document_audit_log | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_document_generation_runs | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_evidence_expectations | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_express_assessment_answers | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_express_assessment_audit_log | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_express_assessment_gaps | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_express_assessment_items | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_express_assessments | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_gap_rules | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_generated_document_sections | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_generated_documents | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_maturity_rules | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_operational_suggestion_audit_log | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_operational_suggestions | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_policy_templates | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_procedure_templates | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_recommended_action_conversions | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_recommended_action_workflow_events | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_risk_matrix_actions | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_risk_matrix_audit_log | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_risk_matrix_items | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_risk_matrix_runs | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.iso_risk_templates | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_standard_versions | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_standards | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.iso_transition_guidance | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.kpi_calculation_jobs | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.kpi_calculation_rules | No | Probable sí | Diferenciador; exponer según madurez MVP. | Alto/Medio |
| public.kpi_custom_inputs | No | Probable sí | Diferenciador; exponer según madurez MVP. | Alto/Medio |
| public.kpi_data_sources | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.kpi_definitions | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.kpi_dimensions_catalog | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.kpi_event_queue | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.kpi_manual_values | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.kpi_snapshot_dimensions | No | Probable sí | Diferenciador; exponer según madurez MVP. | Alto/Medio |
| public.kpi_snapshots | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.kpi_staging_import | No | Probable sí | Diferenciador; exponer según madurez MVP. | Alto/Medio |
| public.kpi_standard_mappings | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.kpi_thresholds | No | Probable sí | Diferenciador; exponer según madurez MVP. | Alto/Medio |
| public.lifecycle_stage_catalog | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.management_objectives | Sí | Sí | Revisar manualmente. | Bajo |
| public.nonconformities_catalog | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.notifications | Sí | Sí | Revisar manualmente. | Bajo |
| public.permissions | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.report_access_rules | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.report_access_rules_backup_20260430 | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.report_exports | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.report_schedules | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.report_types | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.responses | No | Depende | Revisar manualmente. | Medio |
| public.role_permissions | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.roles | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.saas_modules | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.saas_monthly_prebilling | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.saas_monthly_prebilling_lines | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.saas_price_catalog | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.saas_quote_lines | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.saas_quotes | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.search_history | Sí | Sí | Ocultar al cliente MVP; uso interno o revisión. | Bajo |
| public.standard_lifecycle_ai_feed | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.standard_lifecycle_snapshots | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.standard_lifecycle_stage_requests | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.standard_lifecycle_status | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.standards | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.tcdx_async_jobs | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicability_exclusions | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicability_exclusions_cleanup_backup_20260525 | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicability_profiles | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicability_runs | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicable_controls | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicable_controls_cleanup_backup_20260525 | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicable_evidence_requirements | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicable_evidence_requirements_cleanup_backup_20260525 | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicable_kpis | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_applicable_kpis_cleanup_backup_20260525 | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_billing_settings | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_company_profiles | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_contracts | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_controls | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_document_provider_credentials | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_document_sources | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_integrations | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_kpi_settings | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_module_settings | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_monthly_preinvoices | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_nonconformities | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_operations | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_standard_audit | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_standard_operations | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_standards | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_sync_agent_pairing_codes | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenant_sync_agents | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.tenants | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.user_dashboard_preferences | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.user_roles | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.users | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.users_backup_before_role_governance_20260417 | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.users_backup_before_role_normalization_20260430 | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_audit_action_plan_timeline | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.v_audit_control_recovery_timeline | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_audit_event_log_enriched | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.v_audit_evidence_timeline | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_catalog_controls_without_iso_link | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_control_health_base | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_control_health_detail | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_control_health_risks | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_control_health_risks_applicable | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_controls_recovered_by_remediation | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_controls_without_evidence | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_dealer_tenants | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_evidence_approval_queue | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_health_dashboard_by_standard | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_health_dashboard_by_standard_applicable | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_health_dashboard_summary | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.v_health_dashboard_summary_applicable | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.v_health_remediation_plan | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_health_remediation_summary_by_standard | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_health_remediation_summary_by_tenant | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_health_root_causes_by_standard | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_health_root_causes_by_tenant | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_iso_catalog_sync_summary | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.v_iso_control_catalog_coverage | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.v_iso_control_effective_health | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_control_effective_health_applicable | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_controls_without_catalog_link | No | Depende | Catálogo/global ISO puede ser compartido | Medio |
| public.v_iso_document_summary_by_tenant | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_iso_effective_kpi_summary | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_effective_kpi_summary_applicable | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_express_gap_summary | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_express_latest_assessments | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_express_tenant_standard_readiness | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_iso_generated_documents_latest | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_operational_suggestions_queue | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_operational_suggestions_summary | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_risk_matrix_actions_summary | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_risk_matrix_by_asset | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_risk_matrix_latest_runs | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_iso_risk_matrix_summary | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_latest_health_kpi_snapshots | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.v_latest_health_kpi_snapshots_applicable | Sí | Sí | Diferenciador; exponer según madurez MVP. | Bajo |
| public.v_remediation_executive_by_standard | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_remediation_executive_by_tenant | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_saas_prebilling_tenant_context | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_standard_health_summary | Sí | Sí | Catálogo/global ISO puede ser compartido | Bajo |
| public.v_tenant_governance_summary | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_tenant_health_summary | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_tenant_modules | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.v_user_permissions | No | Probable sí | Relevante para MVP o base SaaS. | Alto/Medio |
| public.vw_evidence_ai_state | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.vw_evidence_current_ai_assessments | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |
| public.vw_evidence_current_extracts | Sí | Sí | Relevante para MVP o base SaaS. | Bajo |

## Objetos con tenant_id sin índice tenant_id evidente

La lista puede incluir vistas; las acciones de performance deben priorizar tablas persistentes con volumen real.
- `ai_core.ai_response_feedback`
- `ai_core.v_action_context`
- `ai_core.v_ai_useful_feedback_cases`
- `ai_core.v_control_context`
- `ai_core.v_evidence_context`
- `ai_core.v_external_lookup_usage_monthly`
- `ai_core.v_finding_context`
- `ai_core.v_kpi_context`
- `ai_core.v_tenant_health_context`
- `public.assessments`
- `public.assets`
- `public.audit_document_generation_runs`
- `public.audits`
- `public.control_health_scores_backup_history`
- `public.controls`
- `public.evidence_ai_jobs`
- `public.iso_express_assessment_answers`
- `public.iso_generated_document_sections`
- `public.iso_risk_matrix_actions`
- `public.standard_lifecycle_ai_feed`
- `public.tenant_applicability_exclusions_cleanup_backup_20260525`
- `public.tenant_applicable_controls_cleanup_backup_20260525`
- `public.tenant_applicable_evidence_requirements_cleanup_backup_20260525`
- `public.tenant_applicable_kpis_cleanup_backup_20260525`
- `public.tenant_nonconformities`
- `public.users`
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
- `public.v_iso_control_effective_health`
- `public.v_iso_control_effective_health_applicable`
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
- `public.vw_evidence_ai_state`
- `public.vw_evidence_current_ai_assessments`
- `public.vw_evidence_current_extracts`

## Recomendaciones sin implementar
- Validar que toda tabla con datos de cliente tenga `tenant_id NOT NULL` y FK a `tenants` salvo excepción documentada.
- Revisar índices compuestos por `tenant_id` en módulos de alto tráfico.
- Mantener pruebas negativas cross-tenant desde backend.

Fuente: `information_schema.columns`, `pg_catalog.pg_constraint`, `pg_catalog.pg_indexes`.
