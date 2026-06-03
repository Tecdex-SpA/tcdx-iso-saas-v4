# Database Risks and Findings

| Severidad | Hallazgo | Evidencia estructural | Impacto | Recomendación |
| --- | --- | --- | --- | --- |
| Media | No se detectó RLS habilitado en tablas de aplicación. | pg_catalog.pg_class relrowsecurity | Aislamiento multi-tenant depende de backend, JWT, RBAC y filtros SQL. | Mantener pruebas cross-tenant y evaluar RLS si el modelo SaaS lo requiere. |
| Media | Hay objetos con tenant_id sin índice evidente; la lista incluye vistas, por lo que la decisión debe enfocarse en tablas persistentes. | pg_catalog.pg_indexes: ai_core.ai_response_feedback, ai_core.v_action_context, ai_core.v_ai_useful_feedback_cases, ai_core.v_control_context, ai_core.v_evidence_context, ai_core.v_external_lookup_usage_monthly, ai_core.v_finding_context, ai_core.v_kpi_context, ai_core.v_tenant_health_context, public.assessments, public.assets, public.audit_document_generation_runs | Consultas multi-tenant sobre tablas reales pueden degradar performance y aumentar riesgo de scans amplios. | Evaluar índices por tenant_id combinados con status/standard_code/created_at según uso real. |
| Media | Existen objetos sin primary key detectada; la lista incluye vistas y tablas de backup/legacy que deben separarse en revisión humana. | pg_catalog.pg_constraint: ai_core.v_action_context, ai_core.v_ai_useful_feedback_cases, ai_core.v_control_context, ai_core.v_evidence_context, ai_core.v_external_lookup_usage_monthly, ai_core.v_finding_context, ai_core.v_finding_scenarios_active, ai_core.v_kpi_context, ai_core.v_tenant_health_context, public.control_health_scores_backup_history, public.report_access_rules_backup_20260430, public.tenant_applicability_exclusions_cleanup_backup_20260525, public.tenant_applicable_controls_cleanup_backup_20260525, public.tenant_applicable_evidence_requirements_cleanup_backup_20260525, public.tenant_applicable_kpis_cleanup_backup_20260525, public.users_backup_before_role_governance_20260417, public.users_backup_before_role_normalization_20260430, public.v_audit_action_plan_timeline | Las tablas reales sin PK pueden complicar integridad, auditoría, updates seguros y replicación; las vistas no requieren PK. | Revisar si son vistas, catálogos, backups o legacy; agregar PK solo en sprint aprobado. |
| Media | Existen columnas con nombres sensibles. | information_schema.columns: public.audit_package_documents.file_hash, public.audit_uploaded_zip_files.file_hash, public.document_index.content_hash, public.document_index.file_hash, public.evidence_knowledge_chunks.content_hash, public.evidence_knowledge_chunks.token_estimate, public.tenant_applicability_profiles.profile_hash, public.tenant_document_provider_credentials.access_token_encrypted, public.tenant_document_provider_credentials.refresh_token_encrypted, public.tenant_document_provider_credentials.token_expires_at, public.tenant_integrations.encrypted_access_token, public.tenant_integrations.encrypted_refresh_token | Requiere cifrado/rotación/controles de acceso; no se leyeron valores. | Validar cifrado, masking, retención y grants mínimos. |
| Crítica | El usuario de conexión no debe asumirse solo lectura sin revisión de grants. | roles-privileges.md / information_schema.role_table_grants | El mapeo no usó escritura, pero futuras auditorías deberían usar rol read-only dedicado. | Crear usuario dedicado solo lectura para inspecciones estructurales. |

## Objetos sin PK detectada
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

## Objetos con tenant_id sin índice tenant_id evidente
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

## Columnas sensibles por nombre
- `public.audit_package_documents.file_hash`
- `public.audit_uploaded_zip_files.file_hash`
- `public.document_index.content_hash`
- `public.document_index.file_hash`
- `public.evidence_knowledge_chunks.content_hash`
- `public.evidence_knowledge_chunks.token_estimate`
- `public.tenant_applicability_profiles.profile_hash`
- `public.tenant_document_provider_credentials.access_token_encrypted`
- `public.tenant_document_provider_credentials.refresh_token_encrypted`
- `public.tenant_document_provider_credentials.token_expires_at`
- `public.tenant_integrations.encrypted_access_token`
- `public.tenant_integrations.encrypted_refresh_token`
- `public.tenant_integrations.token_expires_at`
- `public.tenant_sync_agent_pairing_codes.code_hash`
- `public.tenant_sync_agents.agent_token_hash`
- `public.users.password_hash`
- `public.users_backup_before_role_governance_20260417.password_hash`
- `public.users_backup_before_role_normalization_20260430.password_hash`

## Puntos para revisión humana
- Validar si el usuario `tecdex_user` debe ser reemplazado por uno estrictamente read-only.
- Revisar objetos sin PK y sin tenant_id con conocimiento funcional, separando vistas esperadas de tablas persistentes.
- Confirmar estrategia de RLS versus aislamiento en backend.
- Confirmar estrategia pgvector/PLN/NLP si IA semántica crecerá dentro de PostgreSQL.

Fuente: `information_schema`, `pg_catalog`.
