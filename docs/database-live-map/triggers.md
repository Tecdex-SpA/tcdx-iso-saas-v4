# Triggers

| Schema | Tabla | Trigger | Evento | Timing | Función ejecutada | Habilitado | Observación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ai_core | external_lookup_quotas | trg_audit_external_lookup_quota_change | INSERT, UPDATE | AFTER | EXECUTE FUNCTION ai_core.fn_audit_external_lookup_quota_change() | Sí | ROW |
| public | action_plans | audit_action_plans_trigger | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION trg_audit_action_plans() | Sí | ROW |
| public | app_roles | trg_app_roles_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |
| public | dealer_requests | trg_dealer_requests_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |
| public | dealer_tenants | trg_dealer_tenants_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |
| public | evidence_ai_assessments | trg_evidence_ai_assessments_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_current_timestamp_updated_at() | Sí | ROW |
| public | evidence_ai_jobs | trg_evidence_ai_jobs_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_current_timestamp_updated_at() | Sí | ROW |
| public | evidence_document_extracts | trg_evidence_document_extracts_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_current_timestamp_updated_at() | Sí | ROW |
| public | evidence_knowledge_chunks | trg_evidence_knowledge_chunks_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_current_timestamp_updated_at() | Sí | ROW |
| public | evidences | audit_evidences_trigger | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION trg_audit_evidences() | Sí | ROW |
| public | kpi_calculation_jobs | trg_kpi_calculation_jobs_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_calculation_rules | trg_kpi_calculation_rules_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_custom_inputs | trg_kpi_custom_inputs_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_data_sources | trg_kpi_data_sources_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_definitions | trg_kpi_definitions_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_dimensions_catalog | trg_kpi_dimensions_catalog_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_manual_values | trg_kpi_manual_values_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_snapshots | trg_kpi_snapshots_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_standard_mappings | trg_kpi_standard_mappings_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | kpi_thresholds | trg_kpi_thresholds_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | management_objectives | trg_management_objectives_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_management_objectives_updated_at() | Sí | ROW |
| public | permissions | trg_permissions_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |
| public | role_permissions | trg_role_permissions_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |
| public | saas_modules | trg_saas_modules_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |
| public | tenant_contracts | trg_tenant_contracts_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |
| public | tenant_kpi_settings | trg_tenant_kpi_settings_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() | Sí | ROW |
| public | tenant_module_settings | trg_enforce_tenant_module_contract_limit | INSERT, UPDATE | BEFORE | EXECUTE FUNCTION fn_enforce_tenant_module_contract_limit() | Sí | ROW |
| public | tenant_module_settings | trg_tenant_module_settings_touch_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION touch_updated_at() | Sí | ROW |

Fuente: `information_schema.triggers`, `pg_catalog.pg_trigger`.
