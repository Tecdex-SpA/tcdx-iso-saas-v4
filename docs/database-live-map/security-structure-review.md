# Security Structure Review

## Columnas con nombres sensibles
| Schema | Tabla | Columna | Tipo | Nullable | Default | Longitud | Es PK | Es FK | Referencia | Comentario |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public | audit_package_documents | file_hash | character varying (varchar) | YES | - | 255 | No | No | - | sensible por nombre: no leer valores |
| public | audit_uploaded_zip_files | file_hash | character varying (varchar) | YES | - | 255 | No | No | - | sensible por nombre: no leer valores |
| public | document_index | content_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | document_index | file_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | evidence_knowledge_chunks | content_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | evidence_knowledge_chunks | token_estimate | integer (int4) | YES | - | 32 | No | No | - | sensible por nombre: no leer valores |
| public | tenant_applicability_profiles | profile_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_document_provider_credentials | access_token_encrypted | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_document_provider_credentials | refresh_token_encrypted | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_document_provider_credentials | token_expires_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_integrations | encrypted_access_token | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_integrations | encrypted_refresh_token | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_integrations | token_expires_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_sync_agent_pairing_codes | code_hash | text | NO | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_sync_agents | agent_token_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | users | password_hash | text | NO | - | - | No | No | - | sensible por nombre: no leer valores |
| public | users_backup_before_role_governance_20260417 | password_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | users_backup_before_role_normalization_20260430 | password_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |

## Tablas de logs/auditoría/historial inferidas
- `ai_core.ai_response_traces` (IA / conocimiento)
- `ai_core.domains_catalog` (Normas ISO)
- `ai_core.external_lookup_logs` (IA / conocimiento)
- `ai_core.external_lookup_quota_audit` (Auditorías)
- `ai_core.standards_catalog` (Normas ISO)
- `public.action_plans_backup_history` (Planes de acción)
- `public.admin_audit_log` (Auditorías)
- `public.ai_auditor_runs` (Auditorías)
- `public.ai_prompt_logs` (IA / conocimiento)
- `public.audit_control_reviews` (Controles)
- `public.audit_document_generation_runs` (Evidencias)
- `public.audit_document_templates` (Evidencias)
- `public.audit_documentary_sources` (Evidencias)
- `public.audit_event_log` (Auditorías)
- `public.audit_evidence_index` (Evidencias)
- `public.audit_package_documents` (Evidencias)
- `public.audit_preparation_packages` (Auditorías)
- `public.audit_uploaded_zip_files` (Evidencias)
- `public.audits` (Auditorías)
- `public.control_health_scores_backup_history` (Controles)
- `public.controls_catalog` (Normas ISO)
- `public.controls_catalog_standards` (Normas ISO)
- `public.document_sync_logs` (Evidencias)
- `public.evidence_ai_jobs` (Evidencias)
- `public.evidence_tenant_control_migration_log` (Tenants / SaaS)
- `public.evidences_backup_history` (Evidencias)
- `public.iso_audit_questions` (Normas ISO)
- `public.iso_catalog_sync_status` (Normas ISO)
- `public.iso_control_catalog_links` (Normas ISO)
- `public.iso_control_mapping_apply_log` (Normas ISO)
- `public.iso_document_audit_log` (Normas ISO)
- `public.iso_express_assessment_audit_log` (Normas ISO)
- `public.iso_operational_suggestion_audit_log` (Normas ISO)
- `public.iso_recommended_action_workflow_events` (Normas ISO)
- `public.iso_risk_matrix_audit_log` (Normas ISO)
- `public.kpi_calculation_jobs` (KPIs)
- `public.kpi_dimensions_catalog` (Normas ISO)
- `public.kpi_event_queue` (KPIs)
- `public.lifecycle_stage_catalog` (Normas ISO)
- `public.nonconformities_catalog` (Normas ISO)
- `public.saas_price_catalog` (Tenants / SaaS)
- `public.search_history` (Sistema / logs)
- `public.tcdx_async_jobs` (Evidencias)
- `public.tenant_standard_audit` (Tenants / SaaS)
- `public.v_audit_action_plan_timeline` (Auditorías)
- `public.v_audit_control_recovery_timeline` (Controles)
- `public.v_audit_event_log_enriched` (Auditorías)
- `public.v_audit_evidence_timeline` (Evidencias)
- `public.v_catalog_controls_without_iso_link` (Normas ISO)
- `public.v_iso_catalog_sync_summary` (Normas ISO)
- `public.v_iso_control_catalog_coverage` (Normas ISO)
- `public.v_iso_controls_without_catalog_link` (Normas ISO)

## Tablas de documentos/evidencias inferidas
- `ai_core.domain_evidence_expectations` (Evidencias)
- `ai_core.evidence_expectations` (Evidencias)
- `ai_core.invalid_evidence_patterns` (Evidencias)
- `ai_core.trusted_external_sources` (Evidencias)
- `ai_core.v_evidence_context` (Evidencias)
- `public.ai_bootstrap_knowledge_sources` (Evidencias)
- `public.audit_document_generation_runs` (Evidencias)
- `public.audit_document_templates` (Evidencias)
- `public.audit_documentary_sources` (Evidencias)
- `public.audit_evidence_index` (Evidencias)
- `public.audit_package_documents` (Evidencias)
- `public.audit_uploaded_zip_files` (Evidencias)
- `public.document_ai_analysis` (Evidencias)
- `public.document_association_suggestions` (Evidencias)
- `public.document_index` (Evidencias)
- `public.document_sync_logs` (Evidencias)
- `public.evidence_ai_assessments` (Evidencias)
- `public.evidence_ai_jobs` (Evidencias)
- `public.evidence_document_extracts` (Evidencias)
- `public.evidence_document_links` (Evidencias)
- `public.evidence_knowledge_chunks` (Evidencias)
- `public.evidence_tenant_control_migration_log` (Tenants / SaaS)
- `public.evidences` (Evidencias)
- `public.evidences_backup_history` (Evidencias)
- `public.iso_document_audit_log` (Normas ISO)
- `public.iso_document_generation_runs` (Normas ISO)
- `public.iso_evidence_expectations` (Normas ISO)
- `public.iso_generated_document_sections` (Normas ISO)
- `public.iso_generated_documents` (Normas ISO)
- `public.kpi_data_sources` (Evidencias)
- `public.tenant_applicability_profiles` (Tenants / SaaS)
- `public.tenant_applicable_evidence_requirements` (Tenants / SaaS)
- `public.tenant_applicable_evidence_requirements_cleanup_backup_20260525` (Tenants / SaaS)
- `public.tenant_company_profiles` (Tenants / SaaS)
- `public.tenant_document_provider_credentials` (Tenants / SaaS)
- `public.tenant_document_sources` (Tenants / SaaS)
- `public.tenant_integrations` (Tenants / SaaS)
- `public.v_audit_evidence_timeline` (Evidencias)
- `public.v_controls_without_evidence` (Controles)
- `public.v_evidence_approval_queue` (Evidencias)
- `public.v_iso_document_summary_by_tenant` (Tenants / SaaS)
- `public.v_iso_generated_documents_latest` (Normas ISO)
- `public.vw_evidence_ai_state` (Evidencias)
- `public.vw_evidence_current_ai_assessments` (Evidencias)
- `public.vw_evidence_current_extracts` (Evidencias)

## Soft delete y auditoría temporal
- Tablas con `deleted_at`: `public.ai_auditor_runs`, `public.tenants`.
- Tablas con `created_at`: 182.

## Observaciones
- No se leyeron valores reales de columnas sensibles.
- La presencia de tokens/secrets/passwords por nombre debe revisarse con políticas de cifrado, masking, grants mínimos y retención.
- Tablas de documentos/evidencias deben proteger descarga/lectura en backend y almacenamiento.

Fuente: `information_schema.columns`, nombres estructurales de tablas/columnas.
