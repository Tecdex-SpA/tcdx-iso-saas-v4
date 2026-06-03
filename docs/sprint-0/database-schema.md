# Sprint 0 - Inventario base de datos

## Migraciones
| Archivo | Tablas | Alters | Vistas | Tenant | Riesgo |
| --- | --- | --- | --- | --- | --- |
| database/migrations/20260430_audits_summary_support.sql | - | - | - | 0 | normal |
| database/migrations/20260430_final7_audits_ai_billing.sql | audit_control_reviews<br>ai_auditor_runs<br>tenant_billing_settings<br>tenant_monthly_preinvoices | - | - | 8 | normal |
| database/migrations/20260430_fix_audit_review_friendly_labels.sql | - | - | - | 0 | normal |
| database/migrations/20260430_reportes_rbac_access.sql | report_access_rules_backup_20260430 | - | - | 0 | revisar destructivo/backups |
| database/migrations/20260502_ai_bootstrap_knowledge.sql | ai_bootstrap_knowledge_runs<br>ai_bootstrap_knowledge_topics<br>ai_bootstrap_knowledge_sources<br>ai_bootstrap_knowledge_items | - | - | 0 | normal |
| database/migrations/20260504_3k_ai_auditor_runs.sql | ai_auditor_runs | ai_auditor_runs | - | 4 | normal |
| database/migrations/20260504_3m_ai_auditor_human_review.sql | - | ai_auditor_runs | - | 1 | normal |
| database/migrations/20260506_iso_control_catalog_mapping.sql | - | - | v_iso_control_catalog_coverage<br>v_iso_controls_without_catalog_link<br>v_catalog_controls_without_iso_link<br>v_iso_catalog_sync_summary | 3 | normal |
| database/migrations/20260506_iso_control_mapping_apply_log.sql | iso_control_mapping_apply_log | - | - | 0 | normal |
| database/migrations/20260506_iso_document_generator.sql | iso_generated_documents<br>iso_generated_document_sections<br>iso_document_generation_runs<br>iso_document_audit_log | - | v_iso_generated_documents_latest<br>v_iso_document_summary_by_tenant | 13 | normal |
| database/migrations/20260506_iso_express_diagnostic.sql | iso_express_assessments<br>iso_express_assessment_items<br>iso_express_assessment_gaps<br>iso_express_assessment_answers<br>iso_express_assessment_audit_log | - | v_iso_express_tenant_standard_readiness<br>v_iso_express_latest_assessments<br>v_iso_express_gap_summary | 15 | normal |
| database/migrations/20260506_iso_knowledge_base.sql | iso_standards<br>iso_standard_versions<br>iso_clauses<br>iso_controls<br>iso_control_catalog_links<br>iso_control_mappings<br>iso_evidence_expectations<br>iso_policy_templates<br>iso_procedure_templates<br>iso_risk_templates<br>iso_audit_questions<br>iso_gap_rules<br>iso_maturity_rules<br>iso_transition_guidance<br>iso_ai_guidance<br>iso_catalog_sync_status | - | - | 0 | normal |
| database/migrations/20260506_iso_operational_execution.sql | iso_operational_suggestions<br>iso_operational_suggestion_audit_log | - | v_iso_operational_suggestions_summary<br>v_iso_operational_suggestions_queue | 13 | normal |
| database/migrations/20260506_iso_risk_matrix.sql | iso_risk_matrix_runs<br>iso_risk_matrix_items<br>iso_risk_matrix_actions<br>iso_risk_matrix_audit_log | - | v_iso_risk_matrix_latest_runs<br>v_iso_risk_matrix_summary<br>v_iso_risk_matrix_by_asset<br>v_iso_risk_matrix_actions_summary | 18 | normal |
| database/migrations/20260507_dashboard_v2_user_preferences.sql | user_dashboard_preferences | - | - | 4 | normal |
| database/migrations/20260507_iso_recommended_action_conversions.sql | iso_recommended_action_conversions | - | - | 2 | normal |
| database/migrations/20260507_iso_recommended_action_workflow.sql | iso_recommended_action_workflow_events | - | - | 3 | normal |
| database/migrations/20260512_001_centro_inteligente_evidencias_base.sql | tenant_integrations<br>tenant_document_sources<br>document_index<br>document_sync_logs<br>document_ai_analysis<br>document_association_suggestions<br>evidence_document_links | - | - | 17 | normal |
| database/migrations/20260512_02_document_suggestions_pending_control_unique.sql | - | - | - | 1 | normal |
| database/migrations/20260515_ai_knowledge_tables_minimal.sql | ai_knowledge_datasets<br>ai_knowledge_standards<br>ai_knowledge_records | ai_knowledge_datasets<br>ai_knowledge_standards<br>ai_knowledge_records | - | 0 | normal |
| database/migrations/20260515_audit_preparation_documentary_sources.sql | audit_documentary_sources | - | - | 2 | normal |
| database/migrations/20260515_audit_preparation_formats_versioning.sql | - | audit_package_documents | - | 0 | normal |
| database/migrations/20260515_audit_preparation_iso9001.sql | audit_preparation_packages<br>audit_document_templates<br>audit_package_documents<br>audit_evidence_index<br>audit_document_generation_runs<br>audit_uploaded_zip_files | - | - | 9 | normal |
| database/migrations/20260519_tcdx_async_jobs.sql | tcdx_async_jobs | tcdx_async_jobs | - | 4 | normal |
| database/migrations/20260520_ai_auditor_pdf_cache.sql | - | ai_auditor_runs | - | 0 | normal |
| database/migrations/20260520_tenant_company_profiles.sql | tenant_company_profiles | tenant_company_profiles | - | 2 | normal |
| database/migrations/20260522_tenant_applicability_universe.sql | tenant_applicability_profiles<br>tenant_applicable_controls<br>tenant_applicable_kpis<br>tenant_applicable_evidence_requirements<br>tenant_applicability_exclusions<br>tenant_applicability_runs | - | - | 18 | normal |
| database/migrations/20260525_ai_entitlements_applicability_consistency.sql | public.tenant_applicable_controls_cleanup_backup_20260525<br>public.tenant_applicable_kpis_cleanup_backup_20260525<br>public.tenant_applicable_evidence_requirements_cleanup_backup_20260525<br>public.tenant_applicability_exclusions_cleanup_backup_20260525 | public.tenants<br>public.tenant_applicable_kpis<br>public.tenant_applicable_evidence_requirements<br>public.tenant_applicability_exclusions | public.v_control_health_risks_applicable<br>public.v_latest_health_kpi_snapshots_applicable<br>public.v_health_dashboard_by_standard_applicable<br>public.v_health_dashboard_summary_applicable<br>public.v_iso_control_effective_health_applicable<br>public.v_iso_effective_kpi_summary_applicable | 38 | normal |
| database/migrations/20260525_harden_applicability_calculations_and_rbac.sql | - | - | public.v_control_health_risks_applicable<br>public.v_latest_health_kpi_snapshots_applicable<br>public.v_health_dashboard_by_standard_applicable<br>public.v_health_dashboard_summary_applicable<br>public.v_iso_control_effective_health_applicable<br>public.v_iso_effective_kpi_summary_applicable | 18 | normal |
| database/migrations/20260525_tenant_ai_entitlements.sql | - | tenants | - | 0 | normal |
| database/migrations/20260526_tenant_scoped_document_sources_connectors.sql | tenant_document_provider_credentials<br>tenant_sync_agents<br>tenant_sync_agent_pairing_codes | tenant_integrations<br>tenant_document_sources<br>document_index | - | 10 | normal |

## Seeds
| Archivo | Tablas | Alters | Vistas | Tenant | Riesgo |
| --- | --- | --- | --- | --- | --- |
| database/seeds/001_extend_iso9001_coverage.sql | - | - | - | 1 | normal |
| database/seeds/002_extend_iso27001_coverage.sql | - | - | - | 4 | normal |
| database/seeds/003_create_iso42001_operational_controls.sql | - | - | - | 5 | normal |
| database/seeds/004_refresh_iso_catalog_sync_status.sql | - | - | - | 0 | normal |
| database/seeds/20260506_seed_iso27001_2022.sql | - | - | - | 0 | normal |
| database/seeds/20260506_seed_iso42001_2023.sql | - | - | - | 0 | normal |
| database/seeds/20260506_seed_iso9001_2015.sql | - | - | - | 0 | normal |
| database/seeds/20260506_seed_iso9001_2026_fdis.sql | - | - | - | 0 | normal |
| database/seeds/20260506_seed_iso_catalog_sync_status.sql | - | - | - | 0 | normal |
| database/seeds/20260506_seed_iso_control_catalog_links_initial.sql | - | - | - | 1 | normal |
| database/seeds/20260506_seed_iso_crosswalks.sql | - | - | - | 0 | normal |
| database/seeds/20260506_seed_iso_knowledge_base.sql | - | - | - | 0 | normal |
| database/seeds/20260515_seed_ai_knowledge_iso9001_audit_documents.sql | - | - | - | 0 | revisar destructivo/backups |
| database/seeds/20260515_seed_audit_document_templates_iso27001.sql | - | - | - | 0 | normal |
| database/seeds/20260515_seed_audit_document_templates_iso9001.sql | - | - | - | 0 | normal |

## QA fixes SQL
| Archivo | Tablas | Alters | Vistas | Tenant | Riesgo |
| --- | --- | --- | --- | --- | --- |
| database/qa-fixes/20260513_create_iso_effective_health_view.sql | - | - | public.v_iso_control_effective_health | 19 | revisar destructivo/backups |
| database/qa-fixes/20260513_create_iso_effective_kpi_summary_view.sql | - | - | public.v_iso_effective_kpi_summary | 2 | revisar destructivo/backups |
| database/qa-fixes/20260513_fix_iso_operational_links.sql | qa_audit.evidences_backup_20260513<br>qa_audit.action_plans_backup_20260513<br>qa_audit.findings_ambiguous_backup_20260513 | - | - | 18 | normal |
| database/qa-fixes/20260513_fix_iso_operational_links_v2.sql | qa_audit.evidences_backup_20260513<br>qa_audit.action_plans_backup_20260513<br>qa_audit.findings_ambiguous_backup_20260513 | - | - | 16 | normal |
| database/qa-fixes/20260513_fix_iso_operational_links_v3.sql | qa_audit.evidences_backup_20260513<br>qa_audit.action_plans_backup_20260513<br>qa_audit.findings_ambiguous_backup_20260513 | - | - | 14 | normal |
| database/qa-fixes/20260513_fix_iso_operational_links_v4.sql | qa_audit.evidences_backup_20260513<br>qa_audit.action_plans_backup_20260513<br>qa_audit.findings_ambiguous_backup_20260513 | - | - | 14 | normal |
| database/qa-fixes/20260513_fix_iso_remaining_integrity.sql | qa_audit.iso_remaining_fix_backup | - | - | 4 | revisar destructivo/backups |
| database/qa-fixes/20260513_qa_iso_integrity_audit.sql | - | - | - | 6 | normal |
| database/qa-fixes/20260513_qa_iso_integrity_audit_v2.sql | - | - | - | 7 | normal |
| database/qa-fixes/20260513_qa_pending_detail.sql | - | - | - | 16 | normal |
| database/qa-fixes/20260513_refresh_health_kpis.sql | - | - | - | 6 | normal |
| database/qa-fixes/20260513_rollback_iso_operational_links.sql | - | - | - | 6 | normal |

## Tablas principales inferidas por módulo
- Base SaaS/RBAC: `tenants`, `users`, `tenant_modules`/catálogo de módulos inferido por Admin SaaS, `tenant_standards`, `tenant_standard_operations`.
- Controles/cumplimiento: `controls_catalog`, `tenant_controls`, `iso_standards`, `iso_standard_versions`, `iso_clauses`, `iso_controls`, `iso_control_catalog_links`.
- Evidencias/documentos: `evidences`, `tenant_integrations`, `tenant_document_sources`, `document_index`, `document_sync_logs`, `document_ai_analysis`, `document_association_suggestions`, `evidence_document_links`.
- Riesgos/activos: `assets`, `asset_risks`, `iso_risk_matrix_runs`, `iso_risk_matrix_items`, `iso_risk_matrix_actions`.
- Auditoría/hallazgos/NC: `audits`, `audit_control_reviews`, `findings`, `tenant_nonconformities`, `audit_preparation_packages`, `audit_package_documents`, `audit_evidence_index`.
- Planes de acción: `action_plans`, `iso_operational_suggestions`, `iso_recommended_action_conversions`, `iso_recommended_action_workflow_events`.
- Reportes/exportes: `report_access_rules_backup_20260430` y tablas/vistas inferidas desde `reports.routes.js`; no hay migración dedicada reciente para todas las tablas de exportación.
- KPIs/health: `kpi_definitions`, `kpi_snapshots`, `kpi_snapshot_dimensions`, `control_health_scores` inferidas por código; vistas `v_iso_control_effective_health*`, `v_iso_effective_kpi_summary*`, `v_health_dashboard_*`.
- IA: `ai_auditor_runs`, `ai_prompt_logs`, `ai_suggestions`, `ai_feedback`, `ai_bootstrap_knowledge_*`, `ai_knowledge_*`, `tenant_ai_entitlements`/columnas en tenants.
- Perfil/aplicabilidad: `tenant_company_profiles`, `tenant_applicability_profiles`, `tenant_applicable_controls`, `tenant_applicable_kpis`, `tenant_applicable_evidence_requirements`, `tenant_applicability_exclusions`, `tenant_applicability_runs`.

## Relaciones inferidas
La multi-tenencia se basa en `tenant_id` en tablas operativas. Las tablas catálogo ISO globales no usan `tenant_id` o lo aceptan nulo para controles globales. Las rutas cruzan tenant con estándares activos, operaciones activas, controles tenant, evidencias, hallazgos, riesgos y reportes.
