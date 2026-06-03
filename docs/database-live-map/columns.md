# Columns

| Schema | Tabla | Columna | Tipo | Nullable | Default | Longitud | Es PK | Es FK | Referencia | Comentario |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ai_core | ai_core_migrations | id | bigint (int8) | NO | nextval('ai_core.ai_core_migrations_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | ai_core_migrations | migration_code | text | NO | - | - | No | No | - | - |
| ai_core | ai_core_migrations | description | text | NO | - | - | No | No | - | - |
| ai_core | ai_core_migrations | applied_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | - |
| ai_core | ai_feedback | id | bigint (int8) | NO | nextval('ai_core.ai_feedback_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | ai_feedback | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| ai_core | ai_feedback | entity_type | text | YES | - | - | No | No | - | - |
| ai_core | ai_feedback | entity_id | uuid | YES | - | - | No | No | - | - |
| ai_core | ai_feedback | suggestion_type | text | YES | - | - | No | No | - | - |
| ai_core | ai_feedback | suggestion_payload | jsonb | YES | '{}'::jsonb | - | No | No | - | json/jsonb |
| ai_core | ai_feedback | rating | integer (int4) | YES | - | 32 | No | No | - | - |
| ai_core | ai_feedback | was_useful | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | ai_feedback | was_applied | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | ai_feedback | solved_problem | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | ai_feedback | auditor_accepted | boolean (bool) | YES | - | - | No | No | - | auditoría |
| ai_core | ai_feedback | feedback_text | text | YES | - | - | No | No | - | - |
| ai_core | ai_feedback | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| ai_core | ai_feedback | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | ai_response_feedback | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | ai_response_feedback | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| ai_core | ai_response_feedback | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| ai_core | ai_response_feedback | source_entity_type | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | source_entity_id | uuid | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | ai_response_feedback | domain_code | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | problem_type_code | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | scenario_code | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | ai_response | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| ai_core | ai_response_feedback | user_rating | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | user_comment | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | user_corrected_response | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| ai_core | ai_response_feedback | was_useful | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | ai_response_feedback | was_applied | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | ai_response_feedback | was_corrected | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | ai_response_feedback | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | ai_response_feedback | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | ai_response_traces | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | ai_response_traces | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| ai_core | ai_response_traces | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| ai_core | ai_response_traces | question | text | NO | - | - | No | No | - | - |
| ai_core | ai_response_traces | normalized_question | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_traces | intent | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_traces | source_level | text | NO | 'best_effort'::text | - | No | No | - | - |
| ai_core | ai_response_traces | source_label | text | NO | 'Mejor esfuerzo controlado'::text | - | No | No | - | - |
| ai_core | ai_response_traces | confidence | text | NO | 'baja'::text | - | No | No | - | - |
| ai_core | ai_response_traces | confidence_score | numeric | YES | - | 5 | No | No | - | - |
| ai_core | ai_response_traces | tenant_hits | integer (int4) | NO | 0 | 32 | No | No | - | - |
| ai_core | ai_response_traces | knowledge_hits | integer (int4) | NO | 0 | 32 | No | No | - | - |
| ai_core | ai_response_traces | benchmark_hits | integer (int4) | NO | 0 | 32 | No | No | - | - |
| ai_core | ai_response_traces | external_hits | integer (int4) | NO | 0 | 32 | No | No | - | - |
| ai_core | ai_response_traces | used_tenant_internal | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | ai_response_traces | used_tcdx_knowledge | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | ai_response_traces | used_anonymized_benchmark | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | ai_response_traces | used_external_lookup | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | ai_response_traces | must_review_by_human | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | ai_response_traces | final_strategy | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_traces | answer_summary | text | YES | - | - | No | No | - | - |
| ai_core | ai_response_traces | answer_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| ai_core | ai_response_traces | sources_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | ai_response_traces | trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| ai_core | ai_response_traces | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | ai_response_traces | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| ai_core | clause_control_domain_map | id | bigint (int8) | NO | nextval('ai_core.clause_control_domain_map_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | clause_control_domain_map | standard_code | text | NO | - | - | No | Sí | ai_core.standards_catalog.standard_code | norma ISO |
| ai_core | clause_control_domain_map | clause_or_control_code | text | NO | - | - | No | No | - | control |
| ai_core | clause_control_domain_map | clause_or_control_title | text | YES | - | - | No | No | - | control |
| ai_core | clause_control_domain_map | domain_code | text | NO | - | - | No | Sí | ai_core.domains_catalog.domain_code | - |
| ai_core | clause_control_domain_map | relevance_level | text | YES | 'media'::text | - | No | No | - | - |
| ai_core | clause_control_domain_map | notes | text | YES | - | - | No | No | - | - |
| ai_core | clause_control_domain_map | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | clause_control_domain_map | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | clause_control_domain_map | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | clause_control_domain_map | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | closure_criteria | id | bigint (int8) | NO | nextval('ai_core.closure_criteria_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | closure_criteria | problem_type_code | text | NO | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | closure_criteria | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | closure_criteria | control_code | text | YES | - | - | No | No | - | control |
| ai_core | closure_criteria | title | text | NO | - | - | No | No | - | - |
| ai_core | closure_criteria | required_conditions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | closure_criteria | validation_questions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | closure_criteria | rejection_reasons | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | closure_criteria | closure_summary_template | text | YES | - | - | No | No | - | - |
| ai_core | closure_criteria | requires_effectiveness_validation | boolean (bool) | YES | false | - | No | No | - | - |
| ai_core | closure_criteria | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | closure_criteria | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | closure_criteria | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | closure_criteria | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_closure_criteria | id | bigint (int8) | NO | nextval('ai_core.domain_closure_criteria_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | domain_closure_criteria | domain_code | text | NO | - | - | No | Sí | ai_core.domains_catalog.domain_code | - |
| ai_core | domain_closure_criteria | problem_type_code | text | YES | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | domain_closure_criteria | title | text | NO | - | - | No | No | - | - |
| ai_core | domain_closure_criteria | required_conditions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_closure_criteria | validation_questions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_closure_criteria | rejection_reasons | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_closure_criteria | closure_summary_template | text | YES | - | - | No | No | - | - |
| ai_core | domain_closure_criteria | requires_effectiveness_validation | boolean (bool) | YES | false | - | No | No | - | - |
| ai_core | domain_closure_criteria | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | domain_closure_criteria | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | domain_closure_criteria | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_closure_criteria | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_evidence_expectations | id | bigint (int8) | NO | nextval('ai_core.domain_evidence_expectations_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | domain_evidence_expectations | domain_code | text | NO | - | - | No | Sí | ai_core.domains_catalog.domain_code | - |
| ai_core | domain_evidence_expectations | problem_type_code | text | YES | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | domain_evidence_expectations | evidence_context | text | YES | - | - | No | No | - | evidencia |
| ai_core | domain_evidence_expectations | expected_deliverables | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_evidence_expectations | minimum_content | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_evidence_expectations | accepted_formats | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_evidence_expectations | invalid_evidence | jsonb | YES | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| ai_core | domain_evidence_expectations | validation_criteria | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_evidence_expectations | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | domain_evidence_expectations | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | domain_evidence_expectations | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_evidence_expectations | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_problem_type_map | id | bigint (int8) | NO | nextval('ai_core.domain_problem_type_map_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | domain_problem_type_map | domain_code | text | NO | - | - | No | Sí | ai_core.domains_catalog.domain_code | - |
| ai_core | domain_problem_type_map | problem_type_code | text | NO | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | domain_problem_type_map | relevance_level | text | YES | 'media'::text | - | No | No | - | - |
| ai_core | domain_problem_type_map | detection_keywords | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_problem_type_map | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | domain_problem_type_map | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | domain_problem_type_map | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_problem_type_map | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_solution_playbooks | id | bigint (int8) | NO | nextval('ai_core.domain_solution_playbooks_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | domain_solution_playbooks | domain_code | text | NO | - | - | No | Sí | ai_core.domains_catalog.domain_code | - |
| ai_core | domain_solution_playbooks | problem_type_code | text | YES | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | domain_solution_playbooks | title | text | NO | - | - | No | No | - | - |
| ai_core | domain_solution_playbooks | diagnosis_template | text | YES | - | - | No | No | - | - |
| ai_core | domain_solution_playbooks | solution_summary | text | YES | - | - | No | No | - | - |
| ai_core | domain_solution_playbooks | solution_steps | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_solution_playbooks | corrective_actions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_solution_playbooks | preventive_actions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_solution_playbooks | closure_conditions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | domain_solution_playbooks | health_impact_notes | text | YES | - | - | No | No | - | - |
| ai_core | domain_solution_playbooks | kpi_impact_notes | text | YES | - | - | No | No | - | - |
| ai_core | domain_solution_playbooks | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | domain_solution_playbooks | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | domain_solution_playbooks | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domain_solution_playbooks | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domains_catalog | id | bigint (int8) | NO | nextval('ai_core.domains_catalog_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | domains_catalog | domain_code | text | NO | - | - | No | No | - | - |
| ai_core | domains_catalog | domain_name | text | NO | - | - | No | No | - | - |
| ai_core | domains_catalog | domain_category | text | YES | - | - | No | No | - | - |
| ai_core | domains_catalog | description | text | YES | - | - | No | No | - | - |
| ai_core | domains_catalog | is_transversal | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | domains_catalog | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | domains_catalog | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | domains_catalog | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | domains_catalog | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | evidence_expectations | id | bigint (int8) | NO | nextval('ai_core.evidence_expectations_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | evidence_expectations | problem_type_code | text | NO | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | evidence_expectations | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | evidence_expectations | control_code | text | YES | - | - | No | No | - | control |
| ai_core | evidence_expectations | evidence_context | text | YES | - | - | No | No | - | evidencia |
| ai_core | evidence_expectations | expected_deliverables | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | evidence_expectations | minimum_content | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | evidence_expectations | accepted_formats | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | evidence_expectations | invalid_evidence | jsonb | YES | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| ai_core | evidence_expectations | validation_criteria | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | evidence_expectations | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | evidence_expectations | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | evidence_expectations | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | evidence_expectations | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | external_lookup_extra_charges | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | external_lookup_extra_charges | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| ai_core | external_lookup_extra_charges | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| ai_core | external_lookup_extra_charges | search_log_id | uuid | YES | - | - | No | No | - | - |
| ai_core | external_lookup_extra_charges | billing_month | text | NO | - | - | No | No | - | - |
| ai_core | external_lookup_extra_charges | quantity | integer (int4) | NO | 1 | 32 | No | No | - | - |
| ai_core | external_lookup_extra_charges | unit_price | integer (int4) | NO | 100 | 32 | No | No | - | - |
| ai_core | external_lookup_extra_charges | total_amount | integer (int4) | NO | 100 | 32 | No | No | - | - |
| ai_core | external_lookup_extra_charges | accepted | boolean (bool) | NO | true | - | No | No | - | - |
| ai_core | external_lookup_extra_charges | accepted_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | - |
| ai_core | external_lookup_extra_charges | reason | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_extra_charges | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | external_lookup_extra_charges | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | external_lookup_logs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | external_lookup_logs | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| ai_core | external_lookup_logs | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | external_lookup_logs | domain_code | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_logs | problem_type_code | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_logs | scenario_code | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_logs | query_text | text | NO | - | - | No | No | - | - |
| ai_core | external_lookup_logs | lookup_reason | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_logs | sources_requested | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | external_lookup_logs | sources_used | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | external_lookup_logs | result_summary | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_logs | response_used | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | external_lookup_logs | quality_score | numeric | YES | - | 5 | No | No | - | - |
| ai_core | external_lookup_logs | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | external_lookup_logs | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | external_lookup_quota_audit | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | external_lookup_quota_audit | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| ai_core | external_lookup_quota_audit | changed_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| ai_core | external_lookup_quota_audit | old_monthly_limit | integer (int4) | YES | - | 32 | No | No | - | - |
| ai_core | external_lookup_quota_audit | new_monthly_limit | integer (int4) | NO | - | 32 | No | No | - | - |
| ai_core | external_lookup_quota_audit | old_is_active | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | external_lookup_quota_audit | new_is_active | boolean (bool) | NO | true | - | No | No | - | - |
| ai_core | external_lookup_quota_audit | old_notes | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_quota_audit | new_notes | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_quota_audit | change_reason | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_quota_audit | source | text | NO | 'admin_saas'::text | - | No | No | - | - |
| ai_core | external_lookup_quota_audit | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | external_lookup_quota_audit | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | external_lookup_quotas | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | external_lookup_quotas | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| ai_core | external_lookup_quotas | monthly_limit | integer (int4) | NO | 100 | 32 | No | No | - | - |
| ai_core | external_lookup_quotas | is_default | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | external_lookup_quotas | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| ai_core | external_lookup_quotas | notes | text | YES | - | - | No | No | - | - |
| ai_core | external_lookup_quotas | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | external_lookup_quotas | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | external_lookup_quotas | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | finding_scenarios | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | finding_scenarios | scenario_code | text | NO | - | - | No | No | - | - |
| ai_core | finding_scenarios | scenario_name | text | NO | - | - | No | No | - | - |
| ai_core | finding_scenarios | scenario_description | text | YES | - | - | No | No | - | - |
| ai_core | finding_scenarios | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | finding_scenarios | domain_code | text | NO | - | - | No | No | - | - |
| ai_core | finding_scenarios | problem_type_code | text | NO | - | - | No | No | - | - |
| ai_core | finding_scenarios | detection_keywords | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | finding_scenarios | negative_keywords | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | finding_scenarios | example_titles | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | finding_scenarios | example_descriptions | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | finding_scenarios | diagnosis_guidance | text | YES | - | - | No | No | - | - |
| ai_core | finding_scenarios | solution_summary | text | YES | - | - | No | No | - | - |
| ai_core | finding_scenarios | solution_steps | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | finding_scenarios | expected_evidence | jsonb | NO | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| ai_core | finding_scenarios | minimum_evidence_content | jsonb | NO | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| ai_core | finding_scenarios | invalid_evidence | jsonb | NO | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| ai_core | finding_scenarios | closure_conditions | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | finding_scenarios | health_impact | text | YES | - | - | No | No | - | - |
| ai_core | finding_scenarios | kpi_impact | text | YES | - | - | No | No | - | - |
| ai_core | finding_scenarios | requires_external_lookup | boolean (bool) | NO | false | - | No | No | - | - |
| ai_core | finding_scenarios | external_lookup_reason | text | YES | - | - | No | No | - | - |
| ai_core | finding_scenarios | external_source_profile | text | YES | - | - | No | No | - | - |
| ai_core | finding_scenarios | priority | integer (int4) | NO | 50 | 32 | No | No | - | - |
| ai_core | finding_scenarios | confidence_boost | numeric | NO | 0.15 | 5 | No | No | - | - |
| ai_core | finding_scenarios | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| ai_core | finding_scenarios | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | finding_scenarios | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | finding_scenarios | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | invalid_evidence_patterns | id | bigint (int8) | NO | nextval('ai_core.invalid_evidence_patterns_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | invalid_evidence_patterns | code | text | NO | - | - | No | No | - | - |
| ai_core | invalid_evidence_patterns | name | text | NO | - | - | No | No | - | - |
| ai_core | invalid_evidence_patterns | description | text | YES | - | - | No | No | - | - |
| ai_core | invalid_evidence_patterns | examples | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | invalid_evidence_patterns | why_invalid | text | YES | - | - | No | No | - | - |
| ai_core | invalid_evidence_patterns | suggested_fix | text | YES | - | - | No | No | - | - |
| ai_core | invalid_evidence_patterns | severity | text | YES | 'media'::text | - | No | No | - | - |
| ai_core | invalid_evidence_patterns | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | invalid_evidence_patterns | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | invalid_evidence_patterns | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | invalid_evidence_patterns | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | priority_rules | id | bigint (int8) | NO | nextval('ai_core.priority_rules_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | priority_rules | code | text | NO | - | - | No | No | - | - |
| ai_core | priority_rules | name | text | NO | - | - | No | No | - | - |
| ai_core | priority_rules | description | text | YES | - | - | No | No | - | - |
| ai_core | priority_rules | weight | integer (int4) | NO | 10 | 32 | No | No | - | - |
| ai_core | priority_rules | applies_when | jsonb | YES | '{}'::jsonb | - | No | No | - | json/jsonb |
| ai_core | priority_rules | priority_effect | text | YES | 'increase'::text | - | No | No | - | - |
| ai_core | priority_rules | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | priority_rules | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | priority_rules | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | priority_rules | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | problem_types | id | bigint (int8) | NO | nextval('ai_core.problem_types_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | problem_types | code | text | NO | - | - | No | No | - | Código estable usado por la IA para clasificar problemas. Ejemplo: missing_evidence, expired_evidence, kpi_deteriorated. |
| ai_core | problem_types | name | text | NO | - | - | No | No | - | - |
| ai_core | problem_types | description | text | YES | - | - | No | No | - | - |
| ai_core | problem_types | category | text | YES | - | - | No | No | - | - |
| ai_core | problem_types | default_severity | text | YES | 'media'::text | - | No | No | - | - |
| ai_core | problem_types | default_priority_weight | integer (int4) | YES | 50 | 32 | No | No | - | - |
| ai_core | problem_types | applies_to | ARRAY (_text) | YES | '{}'::text[] | - | No | No | - | - |
| ai_core | problem_types | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | problem_types | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | problem_types | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | problem_types | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | response_templates | id | bigint (int8) | NO | nextval('ai_core.response_templates_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | response_templates | code | text | NO | - | - | No | No | - | - |
| ai_core | response_templates | name | text | NO | - | - | No | No | - | - |
| ai_core | response_templates | response_type | text | NO | - | - | No | No | - | - |
| ai_core | response_templates | template_text | text | NO | - | - | No | No | - | - |
| ai_core | response_templates | required_sections | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | response_templates | tone | text | YES | 'claro_profesional'::text | - | No | No | - | - |
| ai_core | response_templates | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | response_templates | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | response_templates | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | response_templates | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | solution_playbooks | id | bigint (int8) | NO | nextval('ai_core.solution_playbooks_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | solution_playbooks | problem_type_code | text | NO | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | solution_playbooks | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | solution_playbooks | control_code | text | YES | - | - | No | No | - | control |
| ai_core | solution_playbooks | title | text | NO | - | - | No | No | - | - |
| ai_core | solution_playbooks | diagnosis_template | text | YES | - | - | No | No | - | - |
| ai_core | solution_playbooks | solution_summary | text | YES | - | - | No | No | - | - |
| ai_core | solution_playbooks | solution_steps | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | solution_playbooks | corrective_actions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | solution_playbooks | preventive_actions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | solution_playbooks | closure_conditions | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | solution_playbooks | health_impact_notes | text | YES | - | - | No | No | - | - |
| ai_core | solution_playbooks | kpi_impact_notes | text | YES | - | - | No | No | - | - |
| ai_core | solution_playbooks | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | solution_playbooks | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | solution_playbooks | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | solution_playbooks | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | standard_domain_map | id | bigint (int8) | NO | nextval('ai_core.standard_domain_map_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | standard_domain_map | standard_code | text | NO | - | - | No | Sí | ai_core.standards_catalog.standard_code | norma ISO |
| ai_core | standard_domain_map | domain_code | text | NO | - | - | No | Sí | ai_core.domains_catalog.domain_code | - |
| ai_core | standard_domain_map | relevance_level | text | YES | 'media'::text | - | No | No | - | - |
| ai_core | standard_domain_map | standard_focus | text | YES | - | - | No | No | - | - |
| ai_core | standard_domain_map | expected_emphasis | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | standard_domain_map | typical_findings | jsonb | YES | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | standard_domain_map | typical_evidence | jsonb | YES | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| ai_core | standard_domain_map | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | standard_domain_map | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | standard_domain_map | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | standard_domain_map | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | standard_specific_overrides | id | bigint (int8) | NO | nextval('ai_core.standard_specific_overrides_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | standard_specific_overrides | standard_code | text | NO | - | - | No | Sí | ai_core.standards_catalog.standard_code | norma ISO |
| ai_core | standard_specific_overrides | domain_code | text | YES | - | - | No | Sí | ai_core.domains_catalog.domain_code | - |
| ai_core | standard_specific_overrides | problem_type_code | text | YES | - | - | No | Sí | ai_core.problem_types.code | - |
| ai_core | standard_specific_overrides | override_type | text | NO | - | - | No | No | - | - |
| ai_core | standard_specific_overrides | title | text | YES | - | - | No | No | - | - |
| ai_core | standard_specific_overrides | content | jsonb | YES | '{}'::jsonb | - | No | No | - | json/jsonb |
| ai_core | standard_specific_overrides | priority | integer (int4) | YES | 50 | 32 | No | No | - | - |
| ai_core | standard_specific_overrides | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | standard_specific_overrides | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | standard_specific_overrides | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | standard_specific_overrides | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | standards_catalog | id | bigint (int8) | NO | nextval('ai_core.standards_catalog_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | standards_catalog | standard_code | text | NO | - | - | No | No | - | norma ISO; Código normalizado sin caracteres especiales críticos. Ejemplo: ISO9001, ISO27001, ISO20000-1. |
| ai_core | standards_catalog | display_code | text | NO | - | - | No | No | - | Código visible de la norma. Ejemplo: ISO/IEC 27001. |
| ai_core | standards_catalog | name | text | NO | - | - | No | No | - | - |
| ai_core | standards_catalog | family | text | YES | - | - | No | No | - | - |
| ai_core | standards_catalog | description | text | YES | - | - | No | No | - | - |
| ai_core | standards_catalog | sector | text | YES | - | - | No | No | - | - |
| ai_core | standards_catalog | is_management_system | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | standards_catalog | is_active | boolean (bool) | YES | true | - | No | No | - | - |
| ai_core | standards_catalog | metadata | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | standards_catalog | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | standards_catalog | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | trusted_external_sources | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| ai_core | trusted_external_sources | source_code | text | NO | - | - | No | No | - | - |
| ai_core | trusted_external_sources | source_name | text | NO | - | - | No | No | - | - |
| ai_core | trusted_external_sources | source_type | text | NO | 'documentation'::text | - | No | No | - | - |
| ai_core | trusted_external_sources | base_url | text | YES | - | - | No | No | - | - |
| ai_core | trusted_external_sources | allowed_domains | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | trusted_external_sources | applicable_domains | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | trusted_external_sources | applicable_standards | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| ai_core | trusted_external_sources | description | text | YES | - | - | No | No | - | - |
| ai_core | trusted_external_sources | trust_level | text | NO | 'high'::text | - | No | No | - | - |
| ai_core | trusted_external_sources | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| ai_core | trusted_external_sources | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| ai_core | trusted_external_sources | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | trusted_external_sources | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| ai_core | v_action_context | action_plan_id | text | YES | - | - | No | No | - | plan de acción |
| ai_core | v_action_context | tenant_id | text | YES | - | - | No | No | - | tenant scope |
| ai_core | v_action_context | tenant_control_id | text | YES | - | - | No | No | - | control |
| ai_core | v_action_context | control_id | text | YES | - | - | No | No | - | control |
| ai_core | v_action_context | finding_id | text | YES | - | - | No | No | - | - |
| ai_core | v_action_context | title | text | YES | - | - | No | No | - | - |
| ai_core | v_action_context | description | text | YES | - | - | No | No | - | - |
| ai_core | v_action_context | status | text | YES | - | - | No | No | - | estado |
| ai_core | v_action_context | priority | text | YES | - | - | No | No | - | - |
| ai_core | v_action_context | responsible_user_id | text | YES | - | - | No | No | - | usuario/responsable |
| ai_core | v_action_context | due_date | text | YES | - | - | No | No | - | - |
| ai_core | v_action_context | completed_at | text | YES | - | - | No | No | - | - |
| ai_core | v_action_context | created_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_action_context | updated_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_ai_useful_feedback_cases | id | uuid | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| ai_core | v_ai_useful_feedback_cases | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| ai_core | v_ai_useful_feedback_cases | source_entity_type | text | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | source_entity_id | uuid | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | v_ai_useful_feedback_cases | domain_code | text | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | problem_type_code | text | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | scenario_code | text | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | user_rating | text | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | user_comment | text | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | was_useful | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | was_applied | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | was_corrected | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | ai_response | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_ai_useful_feedback_cases | user_corrected_response | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_ai_useful_feedback_cases | usefulness_score | integer (int4) | YES | - | 32 | No | No | - | - |
| ai_core | v_ai_useful_feedback_cases | preferred_response | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_ai_useful_feedback_cases | metadata | jsonb | YES | - | - | No | No | - | metadata, json/jsonb |
| ai_core | v_ai_useful_feedback_cases | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_control_context | tenant_control_id | text | YES | - | - | No | No | - | control |
| ai_core | v_control_context | tenant_id | text | YES | - | - | No | No | - | tenant scope |
| ai_core | v_control_context | tenant_name | text | YES | - | - | No | No | - | - |
| ai_core | v_control_context | control_catalog_id | text | YES | - | - | No | No | - | control |
| ai_core | v_control_context | status | text | YES | - | - | No | No | - | estado |
| ai_core | v_control_context | score | text | YES | - | - | No | No | - | - |
| ai_core | v_control_context | health_status | text | YES | - | - | No | No | - | estado |
| ai_core | v_control_context | responsible_user_id | text | YES | - | - | No | No | - | usuario/responsable |
| ai_core | v_control_context | last_reviewed_at | text | YES | - | - | No | No | - | - |
| ai_core | v_control_context | due_date | text | YES | - | - | No | No | - | - |
| ai_core | v_control_context | priority | text | YES | - | - | No | No | - | - |
| ai_core | v_control_context | applicability | text | YES | - | - | No | No | - | - |
| ai_core | v_control_context | created_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_control_context | updated_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_control_context | catalog_id | text | YES | - | - | No | No | - | - |
| ai_core | v_control_context | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | v_control_context | control_code | text | YES | - | - | No | No | - | control |
| ai_core | v_control_context | control_title | text | YES | - | - | No | No | - | control |
| ai_core | v_control_context | control_description | text | YES | - | - | No | No | - | control |
| ai_core | v_control_context | control_category | text | YES | - | - | No | No | - | control |
| ai_core | v_control_context | evidence_count | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| ai_core | v_control_context | finding_count | bigint (int8) | YES | - | 64 | No | No | - | - |
| ai_core | v_control_context | action_plan_count | bigint (int8) | YES | - | 64 | No | No | - | plan de acción |
| ai_core | v_evidence_context | evidence_id | text | YES | - | - | No | No | - | evidencia |
| ai_core | v_evidence_context | tenant_id | text | YES | - | - | No | No | - | tenant scope |
| ai_core | v_evidence_context | tenant_control_id | text | YES | - | - | No | No | - | control |
| ai_core | v_evidence_context | control_id | text | YES | - | - | No | No | - | control |
| ai_core | v_evidence_context | title | text | YES | - | - | No | No | - | - |
| ai_core | v_evidence_context | description | text | YES | - | - | No | No | - | - |
| ai_core | v_evidence_context | file_url | text | YES | - | - | No | No | - | - |
| ai_core | v_evidence_context | file_name | text | YES | - | - | No | No | - | - |
| ai_core | v_evidence_context | status | text | YES | - | - | No | No | - | estado |
| ai_core | v_evidence_context | created_by | text | YES | - | - | No | No | - | usuario/responsable |
| ai_core | v_evidence_context | created_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_evidence_context | updated_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_external_lookup_usage_monthly | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| ai_core | v_external_lookup_usage_monthly | usage_month | date | YES | - | - | No | No | - | - |
| ai_core | v_external_lookup_usage_monthly | used_count | integer (int4) | YES | - | 32 | No | No | - | - |
| ai_core | v_external_lookup_usage_monthly | last_lookup_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | finding_id | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | tenant_id | text | YES | - | - | No | No | - | tenant scope |
| ai_core | v_finding_context | tenant_control_id | text | YES | - | - | No | No | - | control |
| ai_core | v_finding_context | control_id | text | YES | - | - | No | No | - | control |
| ai_core | v_finding_context | title | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | description | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | severity | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | status | text | YES | - | - | No | No | - | estado |
| ai_core | v_finding_context | finding_type | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | responsible_user_id | text | YES | - | - | No | No | - | usuario/responsable |
| ai_core | v_finding_context | due_date | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | closed_at | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_context | created_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_finding_context | updated_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_finding_scenarios_active | id | uuid | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | scenario_code | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | scenario_name | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | scenario_description | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | v_finding_scenarios_active | domain_code | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | domain_name | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | problem_type_code | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | problem_type_name | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | detection_keywords | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_finding_scenarios_active | negative_keywords | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_finding_scenarios_active | example_titles | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_finding_scenarios_active | example_descriptions | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_finding_scenarios_active | diagnosis_guidance | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | solution_summary | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | solution_steps | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_finding_scenarios_active | expected_evidence | jsonb | YES | - | - | No | No | - | evidencia, json/jsonb |
| ai_core | v_finding_scenarios_active | minimum_evidence_content | jsonb | YES | - | - | No | No | - | evidencia, json/jsonb |
| ai_core | v_finding_scenarios_active | invalid_evidence | jsonb | YES | - | - | No | No | - | evidencia, json/jsonb |
| ai_core | v_finding_scenarios_active | closure_conditions | jsonb | YES | - | - | No | No | - | json/jsonb |
| ai_core | v_finding_scenarios_active | health_impact | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | kpi_impact | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | requires_external_lookup | boolean (bool) | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | external_lookup_reason | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | external_source_profile | text | YES | - | - | No | No | - | - |
| ai_core | v_finding_scenarios_active | priority | integer (int4) | YES | - | 32 | No | No | - | - |
| ai_core | v_finding_scenarios_active | confidence_boost | numeric | YES | - | 5 | No | No | - | - |
| ai_core | v_finding_scenarios_active | metadata | jsonb | YES | - | - | No | No | - | metadata, json/jsonb |
| ai_core | v_kpi_context | kpi_snapshot_id | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | tenant_id | text | YES | - | - | No | No | - | tenant scope |
| ai_core | v_kpi_context | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | v_kpi_context | kpi_definition_id | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | kpi_code | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | kpi_name | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | kpi_category | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | period_type | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | period_start | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | period_end | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | value | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | calculated_value | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | score | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | status_color | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | breakdown_json | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | source_trace_json | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | calculated_at | text | YES | - | - | No | No | - | - |
| ai_core | v_kpi_context | created_at | text | YES | - | - | No | No | - | timestamp/auditoría |
| ai_core | v_tenant_health_context | tenant_id | text | YES | - | - | No | No | - | tenant scope |
| ai_core | v_tenant_health_context | tenant_name | text | YES | - | - | No | No | - | - |
| ai_core | v_tenant_health_context | standard_code | text | YES | - | - | No | No | - | norma ISO |
| ai_core | v_tenant_health_context | total_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| ai_core | v_tenant_health_context | healthy_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| ai_core | v_tenant_health_context | attention_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| ai_core | v_tenant_health_context | deteriorated_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| ai_core | v_tenant_health_context | total_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| ai_core | v_tenant_health_context | total_findings | bigint (int8) | YES | - | 64 | No | No | - | - |
| ai_core | v_tenant_health_context | total_action_plans | bigint (int8) | YES | - | 64 | No | No | - | plan de acción |
| ai_core | v_tenant_health_context | healthy_percentage | numeric | YES | - | - | No | No | - | - |
| ai_core | view_definition_backups | id | bigint (int8) | NO | nextval('ai_core.view_definition_backups_id_seq'::regclass) | 64 | Sí | No | - | - |
| ai_core | view_definition_backups | backup_code | text | NO | - | - | No | No | - | - |
| ai_core | view_definition_backups | schemaname | text | NO | - | - | No | No | - | - |
| ai_core | view_definition_backups | viewname | text | NO | - | - | No | No | - | - |
| ai_core | view_definition_backups | definition | text | NO | - | - | No | No | - | - |
| ai_core | view_definition_backups | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | action_plan_updates | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | action_plan_updates | action_plan_id | uuid | NO | - | - | No | Sí | public.action_plans.id | plan de acción |
| public | action_plan_updates | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | action_plan_updates | comment | text | NO | - | - | No | No | - | - |
| public | action_plan_updates | progress_percent | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | action_plan_updates | status_after | text | NO | 'abierto'::text | - | No | No | - | - |
| public | action_plan_updates | blocked_reason | text | YES | - | - | No | No | - | - |
| public | action_plan_updates | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | action_plan_updates | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | action_plan_updates | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | action_plans | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | action_plans | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | action_plans | iso_code | text | NO | - | - | No | Sí | public.standards.code | - |
| public | action_plans | title | text | NO | - | - | No | No | - | - |
| public | action_plans | description | text | YES | - | - | No | No | - | - |
| public | action_plans | source_type | text | NO | 'manual'::text | - | No | No | - | - |
| public | action_plans | source_id | uuid | YES | - | - | No | No | - | - |
| public | action_plans | priority | text | NO | 'media'::text | - | No | No | - | - |
| public | action_plans | status | text | NO | 'abierto'::text | - | No | No | - | estado |
| public | action_plans | owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | action_plans | due_date | date | YES | - | - | No | No | - | - |
| public | action_plans | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | action_plans | completed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | action_plans | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | action_plans | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | action_plans | tenant_control_id | uuid | YES | - | - | No | Sí | public.tenant_controls.id | control |
| public | action_plans | finding_id | uuid | YES | - | - | No | Sí | public.findings.id | - |
| public | action_plans | nonconformity_id | uuid | YES | - | - | No | Sí | public.tenant_nonconformities.id | - |
| public | action_plans | audit_id | uuid | YES | - | - | No | Sí | public.audits.id | auditoría |
| public | action_plans | asset_id | uuid | YES | - | - | No | Sí | public.assets.id | - |
| public | action_plans | approval_status | text | NO | 'no_requerida'::text | - | No | No | - | estado |
| public | action_plans | approval_requested_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | action_plans | approval_requested_by | uuid | YES | - | - | No | No | - | - |
| public | action_plans | approval_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | action_plans | approval_reviewed_by | uuid | YES | - | - | No | No | - | - |
| public | action_plans | approval_comment | text | YES | - | - | No | No | - | - |
| public | action_plans | ai_trace_id | uuid | YES | - | - | No | No | - | - |
| public | action_plans | ai_source_level | text | YES | - | - | No | No | - | - |
| public | action_plans | ai_source_label | text | YES | - | - | No | No | - | - |
| public | action_plans | ai_confidence | text | YES | - | - | No | No | - | - |
| public | action_plans | ai_confidence_score | numeric | YES | - | - | No | No | - | - |
| public | action_plans | ai_orchestration_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | action_plans | ai_enhanced_answer_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | action_plans_backup_history | backup_id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | action_plans_backup_history | backup_reason | text | NO | - | - | No | No | - | - |
| public | action_plans_backup_history | backup_created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | - |
| public | action_plans_backup_history | action_plan_id | uuid | YES | - | - | No | No | - | plan de acción |
| public | action_plans_backup_history | action_plan_snapshot | jsonb | NO | - | - | No | No | - | plan de acción, json/jsonb |
| public | admin_audit_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | admin_audit_log | actor_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | admin_audit_log | actor_role | text | YES | - | - | No | No | - | - |
| public | admin_audit_log | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | admin_audit_log | entity_type | text | NO | - | - | No | No | - | - |
| public | admin_audit_log | entity_id | uuid | YES | - | - | No | No | - | - |
| public | admin_audit_log | action | text | NO | - | - | No | No | - | - |
| public | admin_audit_log | action_label | text | YES | - | - | No | No | - | - |
| public | admin_audit_log | old_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | admin_audit_log | new_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | admin_audit_log | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | admin_audit_log | ip_address | text | YES | - | - | No | No | - | - |
| public | admin_audit_log | user_agent | text | YES | - | - | No | No | - | - |
| public | admin_audit_log | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_auditor_runs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_auditor_runs | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | ai_auditor_runs | audit_id | uuid | YES | - | - | No | No | - | auditoría |
| public | ai_auditor_runs | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | ai_auditor_runs | requested_by | uuid | YES | - | - | No | No | - | - |
| public | ai_auditor_runs | status | text | NO | 'completed'::text | - | No | No | - | estado |
| public | ai_auditor_runs | summary | text | YES | - | - | No | No | - | - |
| public | ai_auditor_runs | suggestions_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_auditor_runs | source_trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_auditor_runs | created_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_auditor_runs | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | ai_auditor_runs | locale | text | NO | 'es'::text | - | No | No | - | - |
| public | ai_auditor_runs | audit_focus | text | YES | - | - | No | No | - | auditoría |
| public | ai_auditor_runs | depth | text | YES | - | - | No | No | - | - |
| public | ai_auditor_runs | score | numeric | YES | - | 5 | No | No | - | - |
| public | ai_auditor_runs | readiness_level | text | YES | - | - | No | No | - | - |
| public | ai_auditor_runs | ai_engine_used | boolean (bool) | NO | false | - | No | No | - | - |
| public | ai_auditor_runs | human_review_required | boolean (bool) | NO | true | - | No | No | - | - |
| public | ai_auditor_runs | can_create_records | boolean (bool) | NO | false | - | No | No | - | - |
| public | ai_auditor_runs | db_write | boolean (bool) | NO | false | - | No | No | - | - |
| public | ai_auditor_runs | history_saved | boolean (bool) | NO | true | - | No | No | - | - |
| public | ai_auditor_runs | summary_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_auditor_runs | coverage_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_auditor_runs | full_result_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_auditor_runs | trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_auditor_runs | deleted_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | ai_auditor_runs | human_review_status | text | YES | - | - | No | No | - | estado; Estado de revisión humana del análisis IA Auditor: pending, reviewed, accepted, rejected, needs_more_evidence. |
| public | ai_auditor_runs | human_review_comment | text | YES | - | - | No | No | - | Comentario humano de revisión del análisis IA Auditor. No equivale a cierre o aprobación de controles. |
| public | ai_auditor_runs | human_reviewed_by | uuid | YES | - | - | No | No | - | Usuario que registró la revisión humana del análisis IA Auditor. |
| public | ai_auditor_runs | human_reviewed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | Fecha y hora de revisión humana del análisis IA Auditor. |
| public | ai_auditor_runs | human_review_metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | ai_auditor_runs | rendered_pdf_file_path | text | YES | - | - | No | No | - | - |
| public | ai_auditor_runs | rendered_pdf_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | ai_auditor_runs | pdf_render_engine | text | YES | - | - | No | No | - | - |
| public | ai_auditor_runs | pdf_render_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_items | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_bootstrap_knowledge_items | topic_id | uuid | YES | - | - | No | Sí | public.ai_bootstrap_knowledge_topics.id | - |
| public | ai_bootstrap_knowledge_items | source_id | uuid | YES | - | - | No | Sí | public.ai_bootstrap_knowledge_sources.id | - |
| public | ai_bootstrap_knowledge_items | run_id | uuid | YES | - | - | No | Sí | public.ai_bootstrap_knowledge_runs.id | - |
| public | ai_bootstrap_knowledge_items | title | text | NO | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | summary | text | NO | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | content | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | practical_use | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | recommended_application | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | limitations | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | knowledge_type | text | NO | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | domain | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | module | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | ai_bootstrap_knowledge_items | clause_or_control | text | YES | - | - | No | No | - | control |
| public | ai_bootstrap_knowledge_items | tags_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_items | trust_score | numeric | NO | 90 | 5 | No | No | - | - |
| public | ai_bootstrap_knowledge_items | freshness_score | numeric | NO | 80 | 5 | No | No | - | - |
| public | ai_bootstrap_knowledge_items | usefulness_score | numeric | NO | 90 | 5 | No | No | - | - |
| public | ai_bootstrap_knowledge_items | confidence_score | numeric | NO | 85 | 5 | No | No | - | - |
| public | ai_bootstrap_knowledge_items | source_type | text | NO | 'internal_seed'::text | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | origin | text | NO | 'bootstrap_seed'::text | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | status | text | NO | 'bootstrap_pending_review'::text | - | No | No | - | estado |
| public | ai_bootstrap_knowledge_items | source_url | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | source_provider | text | NO | 'internal_seed'::text | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | retrieved_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | fingerprint | text | NO | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | raw_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_items | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | approved_by | uuid | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | approved_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | reviewed_by | uuid | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | rejection_reason | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_items | created_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_bootstrap_knowledge_items | updated_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_bootstrap_knowledge_runs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_bootstrap_knowledge_runs | mode | text | NO | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | status | text | NO | 'running'::text | - | No | No | - | estado |
| public | ai_bootstrap_knowledge_runs | provider | text | NO | 'internal_seed'::text | - | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | dry_run | boolean (bool) | NO | false | - | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | require_review | boolean (bool) | NO | true | - | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | topics_requested_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_runs | topics_processed | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | items_created | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | items_pending_review | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | items_approved | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | items_rejected | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | duplicates | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | config_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_runs | log_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_runs | error_message | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | started_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | finished_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_runs | created_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_bootstrap_knowledge_runs | updated_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_bootstrap_knowledge_sources | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_bootstrap_knowledge_sources | source_url | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | source_provider | text | NO | 'internal_seed'::text | - | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | source_domain | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | source_type | text | NO | 'internal_seed'::text | - | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | title | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | summary | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | trust_score | numeric | NO | 90 | 5 | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | retrieved_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_sources | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | ai_bootstrap_knowledge_sources | created_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_bootstrap_knowledge_sources | updated_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_bootstrap_knowledge_topics | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_bootstrap_knowledge_topics | code | text | NO | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | title | text | NO | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | query_templates_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_topics | domain | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | module | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | ai_bootstrap_knowledge_topics | knowledge_types_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_topics | priority | text | NO | 'medium'::text | - | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | max_results | integer (int4) | NO | 5 | 32 | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | source_file | text | YES | - | - | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | raw_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_bootstrap_knowledge_topics | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | ai_bootstrap_knowledge_topics | created_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_bootstrap_knowledge_topics | updated_at | timestamp without time zone (timestamp) | NO | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | ai_knowledge_datasets | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_knowledge_datasets | dataset_name | text | NO | - | - | No | No | - | - |
| public | ai_knowledge_datasets | schema_version | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_datasets | generated_on | date | YES | - | - | No | No | - | - |
| public | ai_knowledge_datasets | language | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_datasets | scope | text | NO | 'global'::text | - | No | No | - | - |
| public | ai_knowledge_datasets | source_file_name | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_datasets | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | ai_knowledge_datasets | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | ai_knowledge_datasets | imported_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | - |
| public | ai_knowledge_datasets | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_knowledge_datasets | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_knowledge_records | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_knowledge_records | dataset_id | uuid | NO | - | - | No | Sí | public.ai_knowledge_datasets.id | - |
| public | ai_knowledge_records | record_id | text | NO | - | - | No | No | - | - |
| public | ai_knowledge_records | norma | text | NO | - | - | No | No | - | - |
| public | ai_knowledge_records | norma_key | text | NO | - | - | No | No | - | - |
| public | ai_knowledge_records | edicion_estado | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | coverage_type | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | clausula_o_control | text | YES | - | - | No | No | - | control |
| public | ai_knowledge_records | titulo | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | descripcion_resumen | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | que_exige | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | ejemplos_evidencia_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | hallazgos_tipicos_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | acciones_correctivas_sugeridas_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | palabras_clave_tags_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | related_norms_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | source_refs_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | standard_type | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | uses_hls_annex_sl | boolean (bool) | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | norma_objetivo | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | scope_public_summary | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_records | verified_public_crosswalks_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | embedding_text | text | YES | - | - | No | No | - | embedding/vector |
| public | ai_knowledge_records | search_text | text | NO | ''::text | - | No | No | - | - |
| public | ai_knowledge_records | is_draft | boolean (bool) | NO | false | - | No | No | - | - |
| public | ai_knowledge_records | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | ai_knowledge_records | raw_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_records | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_knowledge_records | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_knowledge_standards | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_knowledge_standards | dataset_id | uuid | NO | - | - | No | Sí | public.ai_knowledge_datasets.id | - |
| public | ai_knowledge_standards | norma | text | NO | - | - | No | No | - | - |
| public | ai_knowledge_standards | norma_key | text | NO | - | - | No | No | - | - |
| public | ai_knowledge_standards | edicion_estado | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_standards | status | text | YES | - | - | No | No | - | estado |
| public | ai_knowledge_standards | standard_type | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_standards | uses_hls_annex_sl | boolean (bool) | YES | - | - | No | No | - | - |
| public | ai_knowledge_standards | certifiable_or_assurable | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_standards | objective | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_standards | principal_control_areas_json | jsonb | NO | '[]'::jsonb | - | No | No | - | control, json/jsonb |
| public | ai_knowledge_standards | related_standards_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_standards | verified_public_crosswalks_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_standards | notes_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_standards | source_refs_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_standards | scope_public_summary | text | YES | - | - | No | No | - | - |
| public | ai_knowledge_standards | key_definitions_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_standards | structure_profile_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_standards | record_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | ai_knowledge_standards | raw_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_knowledge_standards | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_knowledge_standards | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_prompt_logs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_prompt_logs | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | ai_prompt_logs | prompt_type | text | NO | - | - | No | No | - | - |
| public | ai_prompt_logs | source_module | text | NO | - | - | No | No | - | - |
| public | ai_prompt_logs | source_entity_type | text | YES | - | - | No | No | - | - |
| public | ai_prompt_logs | source_entity_id | uuid | YES | - | - | No | No | - | - |
| public | ai_prompt_logs | request_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_prompt_logs | response_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_prompt_logs | status | text | NO | 'ok'::text | - | No | No | - | estado |
| public | ai_prompt_logs | error_message | text | YES | - | - | No | No | - | - |
| public | ai_prompt_logs | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | ai_prompt_logs | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_suggestions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | ai_suggestions | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | ai_suggestions | suggestion_type | text | NO | - | - | No | No | - | - |
| public | ai_suggestions | source_module | text | NO | - | - | No | No | - | - |
| public | ai_suggestions | source_entity_type | text | YES | - | - | No | No | - | - |
| public | ai_suggestions | source_entity_id | uuid | YES | - | - | No | No | - | - |
| public | ai_suggestions | title | text | YES | - | - | No | No | - | - |
| public | ai_suggestions | input_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_suggestions | output_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | ai_suggestions | confidence | text | YES | - | - | No | No | - | - |
| public | ai_suggestions | status | text | NO | 'draft'::text | - | No | No | - | estado |
| public | ai_suggestions | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | ai_suggestions | applied_by | uuid | YES | - | - | No | No | - | - |
| public | ai_suggestions | applied_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | ai_suggestions | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | ai_suggestions | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | app_roles | role_key | text | NO | - | - | Sí | No | - | - |
| public | app_roles | display_name | text | NO | - | - | No | No | - | - |
| public | app_roles | description | text | YES | - | - | No | No | - | - |
| public | app_roles | role_level | integer (int4) | NO | 100 | 32 | No | No | - | - |
| public | app_roles | is_system | boolean (bool) | NO | true | - | No | No | - | - |
| public | app_roles | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | app_roles | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | app_roles | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | assessments | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | assessments | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | assessments | standard_id | integer (int4) | YES | - | 32 | No | Sí | public.standards.id | - |
| public | assessments | name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | assessments | created_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | asset_risks | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | asset_risks | asset_id | uuid | YES | - | - | No | No | - | - |
| public | asset_risks | risk | text | YES | - | - | No | No | - | riesgo |
| public | asset_risks | impact | text | YES | - | - | No | No | - | - |
| public | asset_risks | probability | text | YES | - | - | No | No | - | - |
| public | asset_risks | level | text | YES | - | - | No | No | - | - |
| public | asset_risks | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | asset_standards | asset_id | uuid | NO | - | - | Sí | Sí | public.assets.id | - |
| public | asset_standards | standard_code | text | NO | - | - | Sí | Sí | public.standards.code | norma ISO |
| public | asset_standards | source | text | NO | 'auto'::text | - | No | No | - | - |
| public | asset_standards | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | assets | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | assets | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | assets | name | text | YES | - | - | No | No | - | - |
| public | assets | type | text | YES | - | - | No | No | - | - |
| public | assets | iso | text | YES | - | - | No | No | - | - |
| public | assets | criticality | text | YES | - | - | No | No | - | - |
| public | assets | owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | assets | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | audit_control_reviews | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_control_reviews | audit_id | uuid | NO | - | - | No | No | - | auditoría |
| public | audit_control_reviews | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | audit_control_reviews | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | audit_control_reviews | control_code | text | YES | - | - | No | No | - | control |
| public | audit_control_reviews | control_title | text | YES | - | - | No | No | - | control |
| public | audit_control_reviews | clause | text | YES | - | - | No | No | - | - |
| public | audit_control_reviews | initial_status | text | YES | - | - | No | No | - | estado |
| public | audit_control_reviews | initial_health_status | text | YES | - | - | No | No | - | estado |
| public | audit_control_reviews | result | text | NO | 'pendiente'::text | - | No | No | - | - |
| public | audit_control_reviews | notes | text | YES | - | - | No | No | - | - |
| public | audit_control_reviews | reviewed_by | uuid | YES | - | - | No | No | - | - |
| public | audit_control_reviews | reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | audit_control_reviews | created_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | audit_control_reviews | updated_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | audit_document_generation_runs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_document_generation_runs | package_id | uuid | NO | - | - | No | Sí | public.audit_preparation_packages.id | - |
| public | audit_document_generation_runs | audit_id | uuid | YES | - | - | No | Sí | public.audits.id | auditoría |
| public | audit_document_generation_runs | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | audit_document_generation_runs | standard_code | character varying (varchar) | NO | - | 50 | No | No | - | norma ISO |
| public | audit_document_generation_runs | run_type | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | audit_document_generation_runs | ai_engine_request_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_document_generation_runs | ai_engine_response_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_document_generation_runs | status | character varying (varchar) | NO | 'completed'::character varying | 50 | No | No | - | estado |
| public | audit_document_generation_runs | error_message | text | YES | - | - | No | No | - | - |
| public | audit_document_generation_runs | created_by | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | audit_document_generation_runs | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_document_templates | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_document_templates | standard_code | character varying (varchar) | NO | - | 50 | No | No | - | norma ISO |
| public | audit_document_templates | template_key | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | audit_document_templates | document_name | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | audit_document_templates | document_type | character varying (varchar) | NO | - | 50 | No | No | - | - |
| public | audit_document_templates | output_format | character varying (varchar) | NO | 'docx'::character varying | 20 | No | No | - | - |
| public | audit_document_templates | folder_path | character varying (varchar) | NO | - | 500 | No | No | - | - |
| public | audit_document_templates | version | character varying (varchar) | NO | '1.0'::character varying | 50 | No | No | - | - |
| public | audit_document_templates | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | audit_document_templates | template_schema_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_document_templates | ai_prompt_template | text | YES | - | - | No | No | - | - |
| public | audit_document_templates | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_document_templates | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_documentary_sources | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_documentary_sources | package_id | uuid | YES | - | - | No | No | - | - |
| public | audit_documentary_sources | audit_id | uuid | YES | - | - | No | No | - | auditoría |
| public | audit_documentary_sources | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | audit_documentary_sources | standard_code | character varying (varchar) | NO | - | 50 | No | No | - | norma ISO |
| public | audit_documentary_sources | period_year | integer (int4) | NO | - | 32 | No | No | - | - |
| public | audit_documentary_sources | source_type | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | audit_documentary_sources | title | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | audit_documentary_sources | description | text | YES | - | - | No | No | - | - |
| public | audit_documentary_sources | status | character varying (varchar) | YES | 'requires_validation'::character varying | 50 | No | No | - | estado |
| public | audit_documentary_sources | source_origin | character varying (varchar) | YES | 'manual'::character varying | 50 | No | No | - | - |
| public | audit_documentary_sources | source_file_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | audit_documentary_sources | source_file_url | text | YES | - | - | No | No | - | - |
| public | audit_documentary_sources | extracted_text_preview | text | YES | - | - | No | No | - | - |
| public | audit_documentary_sources | metadata_json | jsonb | YES | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | audit_documentary_sources | confidence_score | numeric | YES | - | 5 | No | No | - | - |
| public | audit_documentary_sources | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | audit_documentary_sources | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | audit_documentary_sources | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | audit_event_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_event_log | table_name | text | NO | - | - | No | No | - | - |
| public | audit_event_log | record_id | uuid | YES | - | - | No | No | - | - |
| public | audit_event_log | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | audit_event_log | action | text | NO | - | - | No | No | - | - |
| public | audit_event_log | changed_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | - |
| public | audit_event_log | changed_by | uuid | YES | - | - | No | No | - | - |
| public | audit_event_log | old_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | audit_event_log | new_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | audit_event_log | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | audit_evidence_index | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_evidence_index | package_id | uuid | NO | - | - | No | Sí | public.audit_preparation_packages.id | - |
| public | audit_evidence_index | audit_id | uuid | YES | - | - | No | Sí | public.audits.id | auditoría |
| public | audit_evidence_index | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | audit_evidence_index | standard_code | character varying (varchar) | NO | - | 50 | No | No | - | norma ISO |
| public | audit_evidence_index | evidence_name | character varying (varchar) | NO | - | 255 | No | No | - | evidencia |
| public | audit_evidence_index | evidence_type | character varying (varchar) | YES | - | 100 | No | No | - | evidencia |
| public | audit_evidence_index | folder_path | character varying (varchar) | NO | - | 500 | No | No | - | - |
| public | audit_evidence_index | source_module | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | audit_evidence_index | source_id | uuid | YES | - | - | No | No | - | - |
| public | audit_evidence_index | source_reference | text | YES | - | - | No | No | - | - |
| public | audit_evidence_index | related_document_id | uuid | YES | - | - | No | Sí | public.audit_package_documents.id | - |
| public | audit_evidence_index | related_requirement | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | audit_evidence_index | status | character varying (varchar) | NO | 'pending'::character varying | 50 | No | No | - | estado |
| public | audit_evidence_index | notes | text | YES | - | - | No | No | - | - |
| public | audit_evidence_index | file_url | text | YES | - | - | No | No | - | - |
| public | audit_evidence_index | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_evidence_index | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_package_documents | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_package_documents | package_id | uuid | NO | - | - | No | Sí | public.audit_preparation_packages.id | - |
| public | audit_package_documents | audit_id | uuid | YES | - | - | No | Sí | public.audits.id | auditoría |
| public | audit_package_documents | template_id | uuid | YES | - | - | No | Sí | public.audit_document_templates.id | - |
| public | audit_package_documents | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | audit_package_documents | standard_code | character varying (varchar) | NO | - | 50 | No | No | - | norma ISO |
| public | audit_package_documents | document_name | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | audit_package_documents | folder_path | character varying (varchar) | NO | - | 500 | No | No | - | - |
| public | audit_package_documents | document_status | character varying (varchar) | NO | 'draft'::character varying | 50 | No | No | - | estado |
| public | audit_package_documents | original_file_url | text | YES | - | - | No | No | - | - |
| public | audit_package_documents | updated_file_url | text | YES | - | - | No | No | - | - |
| public | audit_package_documents | generated_content | text | YES | - | - | No | No | - | - |
| public | audit_package_documents | generated_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_package_documents | pending_items_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | audit_package_documents | evidence_links_json | jsonb | NO | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| public | audit_package_documents | source_trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_package_documents | change_summary_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_package_documents | created_by | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | audit_package_documents | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_package_documents | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_package_documents | generated_file_url | text | YES | - | - | No | No | - | Authenticated/generated file reference for the rendered document artifact. |
| public | audit_package_documents | output_format | character varying (varchar) | YES | - | 20 | No | No | - | - |
| public | audit_package_documents | mime_type | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | audit_package_documents | file_size_bytes | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | audit_package_documents | file_hash | character varying (varchar) | YES | - | 255 | No | No | - | sensible por nombre: no leer valores |
| public | audit_package_documents | version | character varying (varchar) | NO | '1.0'::character varying | 50 | No | No | - | - |
| public | audit_package_documents | revision_number | integer (int4) | NO | 1 | 32 | No | No | - | - |
| public | audit_package_documents | prepared_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | audit_package_documents | reviewed_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | audit_package_documents | approved_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | audit_package_documents | approved_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | audit_package_documents | effective_from | date | YES | - | - | No | No | - | - |
| public | audit_package_documents | expires_at | date | YES | - | - | No | No | - | - |
| public | audit_package_documents | supersedes_document_id | uuid | YES | - | - | No | Sí | public.audit_package_documents.id | - |
| public | audit_package_documents | source_document_id | uuid | YES | - | - | No | Sí | public.audit_package_documents.id | - |
| public | audit_package_documents | is_current | boolean (bool) | NO | true | - | No | No | - | Marks the current version within a package/template chain. |
| public | audit_package_documents | approval_notes | text | YES | - | - | No | No | - | - |
| public | audit_package_documents | rejection_reason | text | YES | - | - | No | No | - | - |
| public | audit_preparation_packages | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_preparation_packages | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | audit_preparation_packages | audit_id | uuid | YES | - | - | No | Sí | public.audits.id | auditoría |
| public | audit_preparation_packages | standard_code | character varying (varchar) | NO | - | 50 | No | No | - | norma ISO |
| public | audit_preparation_packages | period_year | integer (int4) | NO | - | 32 | No | No | - | - |
| public | audit_preparation_packages | package_name | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | audit_preparation_packages | status | character varying (varchar) | NO | 'draft'::character varying | 50 | No | No | - | estado |
| public | audit_preparation_packages | package_source | character varying (varchar) | NO | 'generated'::character varying | 50 | No | No | - | - |
| public | audit_preparation_packages | original_zip_file_url | text | YES | - | - | No | No | - | - |
| public | audit_preparation_packages | latest_export_file_url | text | YES | - | - | No | No | - | - |
| public | audit_preparation_packages | generated_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | audit_preparation_packages | generated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | - |
| public | audit_preparation_packages | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_preparation_packages | source_context_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_preparation_packages | summary_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_uploaded_zip_files | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audit_uploaded_zip_files | package_id | uuid | YES | - | - | No | Sí | public.audit_preparation_packages.id | - |
| public | audit_uploaded_zip_files | audit_id | uuid | YES | - | - | No | Sí | public.audits.id | auditoría |
| public | audit_uploaded_zip_files | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | audit_uploaded_zip_files | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | audit_uploaded_zip_files | period_year | integer (int4) | YES | - | 32 | No | No | - | - |
| public | audit_uploaded_zip_files | original_filename | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | audit_uploaded_zip_files | file_url | text | NO | - | - | No | No | - | - |
| public | audit_uploaded_zip_files | extracted_path | text | YES | - | - | No | No | - | - |
| public | audit_uploaded_zip_files | file_hash | character varying (varchar) | YES | - | 255 | No | No | - | sensible por nombre: no leer valores |
| public | audit_uploaded_zip_files | analysis_status | character varying (varchar) | NO | 'pending'::character varying | 50 | No | No | - | estado |
| public | audit_uploaded_zip_files | inventory_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | audit_uploaded_zip_files | detected_structure_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | audit_uploaded_zip_files | gaps_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | audit_uploaded_zip_files | created_by | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | audit_uploaded_zip_files | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audit_uploaded_zip_files | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | audits | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | audits | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | audits | iso | text | YES | - | - | No | No | - | - |
| public | audits | start_date | date | YES | - | - | No | No | - | - |
| public | audits | end_date | date | YES | - | - | No | No | - | - |
| public | audits | requester_name | text | YES | - | - | No | No | - | - |
| public | audits | auditor_type | text | YES | - | - | No | No | - | auditoría |
| public | audits | auditor_name | text | YES | - | - | No | No | - | auditoría |
| public | audits | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | audits | status | text | YES | 'pendiente'::text | - | No | No | - | estado |
| public | audits | report_file | text | YES | - | - | No | No | - | - |
| public | audits | audit_result | text | YES | - | - | No | No | - | auditoría |
| public | audits | audit_result_notes | text | YES | - | - | No | No | - | auditoría |
| public | audits | audit_result_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | auditoría |
| public | clauses | id | integer (int4) | NO | nextval('clauses_id_seq'::regclass) | 32 | Sí | No | - | - |
| public | clauses | standard_id | integer (int4) | YES | - | 32 | No | Sí | public.standards.id | - |
| public | clauses | code | character varying (varchar) | YES | - | 50 | No | No | - | - |
| public | clauses | description | text | YES | - | - | No | No | - | - |
| public | control_health_scores | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | control_health_scores | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | control_health_scores | tenant_control_id | uuid | NO | - | - | No | Sí | public.tenant_controls.id | control |
| public | control_health_scores | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | control_health_scores | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | control_health_scores | health_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores | health_status | text | NO | 'sin_datos'::text | - | No | No | - | estado |
| public | control_health_scores | evidence_score | numeric | NO | 0 | 5 | No | No | - | evidencia |
| public | control_health_scores | compliance_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores | findings_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores | risk_score | numeric | NO | 0 | 5 | No | No | - | riesgo |
| public | control_health_scores | action_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores | review_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores | evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores | approved_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores | pending_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores | rejected_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores | open_findings_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores | open_actions_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores | overdue_actions_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores | high_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | control_health_scores | calculated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | control_health_scores | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | control_health_scores_backup_history | backup_id | uuid | YES | - | - | No | No | - | - |
| public | control_health_scores_backup_history | backup_created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | control_health_scores_backup_history | backup_reason | text | YES | - | - | No | No | - | - |
| public | control_health_scores_backup_history | id | uuid | YES | - | - | No | No | - | - |
| public | control_health_scores_backup_history | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | control_health_scores_backup_history | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | control_health_scores_backup_history | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | control_health_scores_backup_history | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | control_health_scores_backup_history | health_score | numeric | YES | - | 5 | No | No | - | - |
| public | control_health_scores_backup_history | health_status | text | YES | - | - | No | No | - | estado |
| public | control_health_scores_backup_history | evidence_score | numeric | YES | - | 5 | No | No | - | evidencia |
| public | control_health_scores_backup_history | compliance_score | numeric | YES | - | 5 | No | No | - | - |
| public | control_health_scores_backup_history | findings_score | numeric | YES | - | 5 | No | No | - | - |
| public | control_health_scores_backup_history | risk_score | numeric | YES | - | 5 | No | No | - | riesgo |
| public | control_health_scores_backup_history | action_score | numeric | YES | - | 5 | No | No | - | - |
| public | control_health_scores_backup_history | review_score | numeric | YES | - | 5 | No | No | - | - |
| public | control_health_scores_backup_history | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | control_health_scores_backup_history | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | control_health_scores_backup_history | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | control_health_scores_backup_history | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | control_health_scores_backup_history | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | control_health_scores_backup_history | open_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | control_health_scores_backup_history | overdue_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | control_health_scores_backup_history | high_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | control_health_scores_backup_history | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | control_health_scores_backup_history | metadata | jsonb | YES | - | - | No | No | - | metadata, json/jsonb |
| public | control_health_scores_v2_preview | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | control_health_scores_v2_preview | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | control_health_scores_v2_preview | tenant_control_id | uuid | NO | - | - | No | No | - | control |
| public | control_health_scores_v2_preview | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | control_health_scores_v2_preview | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | control_health_scores_v2_preview | health_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores_v2_preview | health_status | text | NO | 'sin_datos'::text | - | No | No | - | estado |
| public | control_health_scores_v2_preview | evidence_score | numeric | NO | 0 | 5 | No | No | - | evidencia |
| public | control_health_scores_v2_preview | compliance_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores_v2_preview | findings_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores_v2_preview | risk_score | numeric | NO | 0 | 5 | No | No | - | riesgo |
| public | control_health_scores_v2_preview | action_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores_v2_preview | review_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | control_health_scores_v2_preview | evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores_v2_preview | approved_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores_v2_preview | pending_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores_v2_preview | rejected_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores_v2_preview | expired_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | control_health_scores_v2_preview | open_findings_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores_v2_preview | high_open_findings_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores_v2_preview | open_nonconformities_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores_v2_preview | open_actions_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores_v2_preview | overdue_actions_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | control_health_scores_v2_preview | high_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | control_health_scores_v2_preview | calculated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | control_health_scores_v2_preview | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | control_soa | tenant_control_id | uuid | NO | - | - | Sí | Sí | public.controls.id | control |
| public | control_soa | applicable | boolean (bool) | YES | - | - | No | No | - | - |
| public | control_soa | implementation_status | text | NO | 'pendiente'::text | - | No | No | - | estado |
| public | control_soa | justification | text | YES | - | - | No | No | - | - |
| public | control_soa | notes | text | YES | - | - | No | No | - | - |
| public | control_soa | owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | control_soa | review_date | date | YES | - | - | No | No | - | - |
| public | control_soa | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | control_soa | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | controls | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | controls | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | controls | iso_code | text | YES | - | - | No | No | - | - |
| public | controls | clause | text | YES | - | - | No | No | - | - |
| public | controls | status | text | YES | - | - | No | No | - | estado |
| public | controls | score | integer (int4) | YES | 0 | 32 | No | No | - | - |
| public | controls | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | controls | catalog_control_id | uuid | YES | - | - | No | Sí | public.controls_catalog.id | control |
| public | controls_catalog | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | controls_catalog | iso | text | YES | - | - | No | No | - | - |
| public | controls_catalog | clause | text | YES | - | - | No | No | - | - |
| public | controls_catalog | category | text | YES | - | - | No | No | - | - |
| public | controls_catalog | description | text | YES | - | - | No | No | - | - |
| public | controls_catalog | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | controls_catalog | source_type | text | NO | 'generic'::text | - | No | No | - | - |
| public | controls_catalog | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | controls_catalog | base_control_id | uuid | YES | - | - | No | Sí | public.controls_catalog.id | control |
| public | controls_catalog | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | controls_catalog | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | controls_catalog_standards | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | controls_catalog_standards | control_id | uuid | NO | - | - | No | Sí | public.controls_catalog.id | control |
| public | controls_catalog_standards | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | controls_catalog_standards | clause | text | YES | - | - | No | No | - | - |
| public | controls_catalog_standards | is_primary | boolean (bool) | NO | false | - | No | No | - | - |
| public | controls_catalog_standards | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | controls_catalog_standards | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | dealer_requests | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | dealer_requests | dealer_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | dealer_requests | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | dealer_requests | request_type | text | NO | - | - | No | No | - | - |
| public | dealer_requests | request_status | text | NO | 'open'::text | - | No | No | - | estado |
| public | dealer_requests | title | text | NO | - | - | No | No | - | - |
| public | dealer_requests | description | text | YES | - | - | No | No | - | - |
| public | dealer_requests | requested_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | dealer_requests | reviewed_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | dealer_requests | reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | dealer_requests | review_comment | text | YES | - | - | No | No | - | - |
| public | dealer_requests | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | dealer_requests | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | dealer_tenant_access | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | dealer_tenant_access | dealer_user_id | uuid | NO | - | - | No | No | - | usuario/responsable |
| public | dealer_tenant_access | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | dealer_tenant_access | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | dealer_tenant_access | notes | text | YES | - | - | No | No | - | - |
| public | dealer_tenant_access | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | dealer_tenants | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | dealer_tenants | dealer_user_id | uuid | NO | - | - | No | Sí | public.users.id | usuario/responsable |
| public | dealer_tenants | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | dealer_tenants | relationship_type | text | NO | 'commercial_partner'::text | - | No | No | - | - |
| public | dealer_tenants | can_view_health | boolean (bool) | NO | true | - | No | No | - | - |
| public | dealer_tenants | can_view_contract | boolean (bool) | NO | true | - | No | No | - | - |
| public | dealer_tenants | can_request_changes | boolean (bool) | NO | true | - | No | No | - | - |
| public | dealer_tenants | can_view_sensitive_evidence | boolean (bool) | NO | false | - | No | No | - | evidencia |
| public | dealer_tenants | status | text | NO | 'active'::text | - | No | No | - | estado |
| public | dealer_tenants | assigned_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | dealer_tenants | assigned_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | dealer_tenants | revoked_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | dealer_tenants | revoked_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | dealer_tenants | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | dealer_tenants | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | dealer_tenants | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | document_ai_analysis | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | document_ai_analysis | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | document_ai_analysis | document_id | uuid | NO | - | - | No | Sí | public.document_index.id | - |
| public | document_ai_analysis | detected_document_type | character varying (varchar) | YES | - | 80 | No | No | - | - |
| public | document_ai_analysis | detected_standard_code | character varying (varchar) | YES | - | 80 | No | No | - | norma ISO |
| public | document_ai_analysis | detected_control_refs | ARRAY (_text) | YES | - | - | No | No | - | control |
| public | document_ai_analysis | summary | text | YES | - | - | No | No | - | - |
| public | document_ai_analysis | extracted_keywords | ARRAY (_text) | YES | - | - | No | No | - | - |
| public | document_ai_analysis | confidence_score | numeric | YES | - | 5 | No | No | - | - |
| public | document_ai_analysis | evidence_quality | character varying (varchar) | YES | - | 40 | No | No | - | evidencia |
| public | document_ai_analysis | missing_elements | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | document_ai_analysis | recommended_actions | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | document_ai_analysis | analysis_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | document_ai_analysis | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | document_association_suggestions | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | document_association_suggestions | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | document_association_suggestions | document_id | uuid | NO | - | - | No | Sí | public.document_index.id | - |
| public | document_association_suggestions | target_type | character varying (varchar) | NO | - | 80 | No | No | - | - |
| public | document_association_suggestions | target_id | uuid | YES | - | - | No | No | - | - |
| public | document_association_suggestions | suggested_standard_code | character varying (varchar) | YES | - | 80 | No | No | - | norma ISO |
| public | document_association_suggestions | suggested_control_ref | character varying (varchar) | YES | - | 120 | No | No | - | control |
| public | document_association_suggestions | suggested_reason | text | YES | - | - | No | No | - | - |
| public | document_association_suggestions | confidence_score | numeric | YES | - | 5 | No | No | - | - |
| public | document_association_suggestions | status | character varying (varchar) | NO | 'pending'::character varying | 40 | No | No | - | estado |
| public | document_association_suggestions | reviewed_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | document_association_suggestions | reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | document_association_suggestions | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | document_index | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | document_index | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | document_index | source_id | uuid | YES | - | - | No | Sí | public.tenant_document_sources.id | - |
| public | document_index | integration_id | uuid | YES | - | - | No | Sí | public.tenant_integrations.id | - |
| public | document_index | provider | character varying (varchar) | NO | - | 80 | No | No | - | - |
| public | document_index | provider_file_id | character varying (varchar) | NO | - | 500 | No | No | - | - |
| public | document_index | provider_version_id | character varying (varchar) | YES | - | 500 | No | No | - | - |
| public | document_index | file_name | character varying (varchar) | NO | - | 500 | No | No | - | - |
| public | document_index | mime_type | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | document_index | file_extension | character varying (varchar) | YES | - | 40 | No | No | - | - |
| public | document_index | file_url | text | YES | - | - | No | No | - | - |
| public | document_index | web_view_url | text | YES | - | - | No | No | - | - |
| public | document_index | size_bytes | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | document_index | checksum | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | document_index | modified_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | document_index | indexed_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | document_index | last_seen_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | document_index | status | character varying (varchar) | NO | 'indexed'::character varying | 40 | No | No | - | estado |
| public | document_index | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | document_index | relative_path | text | YES | - | - | No | No | - | - |
| public | document_index | content_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | document_index | file_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | document_index | local_storage_path | text | YES | - | - | No | No | - | - |
| public | document_sync_logs | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | document_sync_logs | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | document_sync_logs | source_id | uuid | YES | - | - | No | Sí | public.tenant_document_sources.id | - |
| public | document_sync_logs | integration_id | uuid | YES | - | - | No | Sí | public.tenant_integrations.id | - |
| public | document_sync_logs | provider | character varying (varchar) | YES | - | 80 | No | No | - | - |
| public | document_sync_logs | status | character varying (varchar) | NO | 'started'::character varying | 40 | No | No | - | estado |
| public | document_sync_logs | started_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | document_sync_logs | finished_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | document_sync_logs | files_seen | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | document_sync_logs | files_indexed | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | document_sync_logs | files_updated | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | document_sync_logs | files_skipped | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | document_sync_logs | error_message | text | YES | - | - | No | No | - | - |
| public | document_sync_logs | details_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_assessments | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | evidence_ai_assessments | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | evidence_ai_assessments | evidence_id | uuid | NO | - | - | No | Sí | public.evidences.id | evidencia |
| public | evidence_ai_assessments | extract_id | uuid | YES | - | - | No | Sí | public.evidence_document_extracts.id | - |
| public | evidence_ai_assessments | is_current | boolean (bool) | NO | true | - | No | No | - | - |
| public | evidence_ai_assessments | analysis_status | text | NO | 'pending'::text | - | No | No | - | estado |
| public | evidence_ai_assessments | validity_result | text | NO | 'sin_determinar'::text | - | No | No | - | - |
| public | evidence_ai_assessments | contribution_level | text | NO | 'indeterminado'::text | - | No | No | - | - |
| public | evidence_ai_assessments | pertinence_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | evidence_ai_assessments | sufficiency_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | evidence_ai_assessments | freshness_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | evidence_ai_assessments | traceability_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | evidence_ai_assessments | consistency_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | evidence_ai_assessments | compliance_impact_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | evidence_ai_assessments | recommended_standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | evidence_ai_assessments | recommended_clause | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | recommended_control_id | uuid | YES | - | - | No | Sí | public.controls_catalog.id | control |
| public | evidence_ai_assessments | recommended_operation_id | uuid | YES | - | - | No | Sí | public.tenant_operations.id | - |
| public | evidence_ai_assessments | headline | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | narrative | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | risks_json | jsonb | NO | '[]'::jsonb | - | No | No | - | riesgo, json/jsonb |
| public | evidence_ai_assessments | next_steps_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_assessments | extracted_entities_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_assessments | control_fit | text | YES | - | - | No | No | - | control |
| public | evidence_ai_assessments | gap_summary | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | duplicate_of_evidence_id | uuid | YES | - | - | No | Sí | public.evidences.id | evidencia |
| public | evidence_ai_assessments | appears_expired | boolean (bool) | NO | false | - | No | No | - | - |
| public | evidence_ai_assessments | appears_complete | boolean (bool) | NO | false | - | No | No | - | - |
| public | evidence_ai_assessments | appears_authentic | boolean (bool) | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | model_name | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | model_version | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | source_system | text | NO | 'own_ai_140'::text | - | No | No | - | - |
| public | evidence_ai_assessments | raw_response_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_assessments | analyzed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_ai_assessments | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_ai_assessments | ai_trace_id | uuid | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | ai_source_level | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | ai_source_label | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | ai_confidence | text | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | ai_confidence_score | numeric | YES | - | - | No | No | - | - |
| public | evidence_ai_assessments | ai_orchestration_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_assessments | ai_enhanced_answer_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_jobs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | evidence_ai_jobs | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | evidence_ai_jobs | evidence_id | uuid | NO | - | - | No | Sí | public.evidences.id | evidencia |
| public | evidence_ai_jobs | job_type | text | NO | - | - | No | No | - | - |
| public | evidence_ai_jobs | status | text | NO | 'pending'::text | - | No | No | - | estado |
| public | evidence_ai_jobs | priority | smallint (int2) | NO | 50 | 16 | No | No | - | - |
| public | evidence_ai_jobs | retry_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | evidence_ai_jobs | max_retries | integer (int4) | NO | 5 | 32 | No | No | - | - |
| public | evidence_ai_jobs | run_after | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | evidence_ai_jobs | locked_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidence_ai_jobs | locked_by | text | YES | - | - | No | No | - | - |
| public | evidence_ai_jobs | payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_jobs | result | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_ai_jobs | error_message | text | YES | - | - | No | No | - | - |
| public | evidence_ai_jobs | created_by | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | evidence_ai_jobs | completed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidence_ai_jobs | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_ai_jobs | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_document_extracts | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | evidence_document_extracts | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | evidence_document_extracts | evidence_id | uuid | NO | - | - | No | Sí | public.evidences.id | evidencia |
| public | evidence_document_extracts | is_current | boolean (bool) | NO | true | - | No | No | - | - |
| public | evidence_document_extracts | extraction_status | text | NO | 'pending'::text | - | No | No | - | estado |
| public | evidence_document_extracts | extraction_engine | text | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | file_type | text | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | mime_type | text | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | raw_text | text | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | structured_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | evidence_document_extracts | text_char_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | evidence_document_extracts | ocr_used | boolean (bool) | NO | false | - | No | No | - | - |
| public | evidence_document_extracts | detected_language | text | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | page_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | evidence_document_extracts | sheet_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | evidence_document_extracts | image_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | evidence_document_extracts | extraction_notes | text | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | started_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | extracted_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidence_document_extracts | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_document_extracts | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_document_links | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | evidence_document_links | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | evidence_document_links | evidence_id | uuid | NO | - | - | No | Sí | public.evidences.id | evidencia |
| public | evidence_document_links | document_id | uuid | NO | - | - | No | Sí | public.document_index.id | - |
| public | evidence_document_links | relation_type | character varying (varchar) | NO | 'source_document'::character varying | 80 | No | No | - | - |
| public | evidence_document_links | created_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | evidence_document_links | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_knowledge_chunks | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | evidence_knowledge_chunks | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | evidence_knowledge_chunks | evidence_id | uuid | NO | - | - | No | Sí | public.evidences.id | evidencia |
| public | evidence_knowledge_chunks | assessment_id | uuid | YES | - | - | No | Sí | public.evidence_ai_assessments.id | - |
| public | evidence_knowledge_chunks | extract_id | uuid | YES | - | - | No | Sí | public.evidence_document_extracts.id | - |
| public | evidence_knowledge_chunks | chunk_index | integer (int4) | NO | - | 32 | No | No | - | - |
| public | evidence_knowledge_chunks | chunk_type | text | NO | 'text'::text | - | No | No | - | - |
| public | evidence_knowledge_chunks | content | text | NO | - | - | No | No | - | - |
| public | evidence_knowledge_chunks | content_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | evidence_knowledge_chunks | token_estimate | integer (int4) | YES | - | 32 | No | No | - | sensible por nombre: no leer valores |
| public | evidence_knowledge_chunks | embedding_status | text | NO | 'pending'::text | - | No | No | - | estado, embedding/vector |
| public | evidence_knowledge_chunks | embedding_model | text | YES | - | - | No | No | - | embedding/vector |
| public | evidence_knowledge_chunks | embedding_vector_ref | text | YES | - | - | No | No | - | embedding/vector |
| public | evidence_knowledge_chunks | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | evidence_knowledge_chunks | is_approved_signal | boolean (bool) | NO | false | - | No | No | - | - |
| public | evidence_knowledge_chunks | is_negative_signal | boolean (bool) | NO | false | - | No | No | - | - |
| public | evidence_knowledge_chunks | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | evidence_knowledge_chunks | clause | text | YES | - | - | No | No | - | - |
| public | evidence_knowledge_chunks | control_id | uuid | YES | - | - | No | Sí | public.controls_catalog.id | control |
| public | evidence_knowledge_chunks | tenant_control_id | uuid | YES | - | - | No | Sí | public.tenant_controls.id | control |
| public | evidence_knowledge_chunks | operation_id | uuid | YES | - | - | No | Sí | public.tenant_operations.id | - |
| public | evidence_knowledge_chunks | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_knowledge_chunks | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | evidence_tenant_control_migration_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | evidence_tenant_control_migration_log | evidence_id | uuid | NO | - | - | No | No | - | evidencia |
| public | evidence_tenant_control_migration_log | old_control_id | uuid | YES | - | - | No | No | - | control |
| public | evidence_tenant_control_migration_log | new_tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | evidence_tenant_control_migration_log | strategy | text | NO | - | - | No | No | - | - |
| public | evidence_tenant_control_migration_log | migrated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | evidences | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | evidences | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | evidences | control_id | uuid | YES | - | - | No | No | - | control; Campo legacy/compatibilidad. Puede contener referencias antiguas. No usar como relación oficial a futuro. |
| public | evidences | description | text | YES | - | - | No | No | - | - |
| public | evidences | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | evidences | file_name | text | YES | - | - | No | No | - | - |
| public | evidences | file_path | text | YES | - | - | No | No | - | - |
| public | evidences | status | text | YES | 'pendiente'::text | - | No | No | - | estado |
| public | evidences | validated | boolean (bool) | YES | false | - | No | No | - | - |
| public | evidences | tenant_control_id | uuid | YES | - | - | No | Sí | public.tenant_controls.id | control; Relación oficial nueva: evidencia asociada al control real del tenant en tenant_controls.id. |
| public | evidences | reviewed_by | uuid | YES | - | - | No | No | - | - |
| public | evidences | reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidences | expires_at | date | YES | - | - | No | No | - | - |
| public | evidences | evidence_type | text | YES | 'documento'::text | - | No | No | - | evidencia |
| public | evidences | version | integer (int4) | YES | 1 | 32 | No | No | - | - |
| public | evidences | rejection_reason | text | YES | - | - | No | No | - | - |
| public | evidences | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | evidences | file_mime_type | text | YES | - | - | No | No | - | - |
| public | evidences | file_size_bytes | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | evidences | content_fingerprint | text | YES | - | - | No | No | - | - |
| public | evidences | document_extraction_status | text | YES | 'pending'::text | - | No | No | - | estado |
| public | evidences | ai_analysis_status | text | YES | 'pending'::text | - | No | No | - | estado |
| public | evidences | last_extracted_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidences | last_ai_analyzed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | evidences | ai_last_error | text | YES | - | - | No | No | - | - |
| public | evidences | ai_model_name | text | YES | - | - | No | No | - | - |
| public | evidences | ai_model_version | text | YES | - | - | No | No | - | - |
| public | evidences_backup_history | backup_id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | evidences_backup_history | backup_reason | text | NO | - | - | No | No | - | - |
| public | evidences_backup_history | backup_created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | - |
| public | evidences_backup_history | evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | evidences_backup_history | evidence_snapshot | jsonb | NO | - | - | No | No | - | evidencia, json/jsonb |
| public | findings | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | findings | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | findings | iso_code | text | NO | - | - | No | Sí | public.standards.code | - |
| public | findings | title | text | NO | - | - | No | No | - | - |
| public | findings | description | text | YES | - | - | No | No | - | - |
| public | findings | finding_type | text | NO | 'observacion'::text | - | No | No | - | - |
| public | findings | severity | text | NO | 'media'::text | - | No | No | - | - |
| public | findings | status | text | NO | 'abierto'::text | - | No | No | - | estado |
| public | findings | source_type | text | NO | 'manual'::text | - | No | No | - | - |
| public | findings | source_id | uuid | YES | - | - | No | No | - | - |
| public | findings | owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | findings | detected_by | text | YES | - | - | No | No | - | - |
| public | findings | due_date | date | YES | - | - | No | No | - | - |
| public | findings | closed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | findings | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | findings | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | findings | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | findings | tenant_control_id | uuid | YES | - | - | No | Sí | public.controls.id | control |
| public | findings | nonconformity_id | uuid | YES | - | - | No | Sí | public.tenant_nonconformities.id | - |
| public | findings | audit_id | uuid | YES | - | - | No | Sí | public.audits.id | auditoría |
| public | findings | asset_id | uuid | YES | - | - | No | Sí | public.assets.id | - |
| public | iso_ai_guidance | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_ai_guidance | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_ai_guidance | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_ai_guidance | version_code | text | NO | - | - | No | No | - | - |
| public | iso_ai_guidance | guidance_type | text | NO | - | - | No | No | - | - |
| public | iso_ai_guidance | system_instruction | text | NO | - | - | No | No | - | - |
| public | iso_ai_guidance | evaluation_criteria | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_ai_guidance | forbidden_claims | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_ai_guidance | preferred_output_schema | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_ai_guidance | locale | text | NO | 'es'::text | - | No | No | - | - |
| public | iso_ai_guidance | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_ai_guidance | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_audit_questions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_audit_questions | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_audit_questions | clause_id | uuid | YES | - | - | No | Sí | public.iso_clauses.id | - |
| public | iso_audit_questions | control_id | uuid | YES | - | - | No | Sí | public.iso_controls.id | control |
| public | iso_audit_questions | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_audit_questions | version_code | text | NO | - | - | No | No | - | - |
| public | iso_audit_questions | question | text | NO | - | - | No | No | - | - |
| public | iso_audit_questions | expected_evidence | text | YES | - | - | No | No | - | evidencia |
| public | iso_audit_questions | auditor_criteria | text | YES | - | - | No | No | - | auditoría |
| public | iso_audit_questions | severity_if_missing | text | NO | 'media'::text | - | No | No | - | - |
| public | iso_audit_questions | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_audit_questions | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_catalog_sync_status | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_catalog_sync_status | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_catalog_sync_status | version_code | text | NO | - | - | No | No | - | - |
| public | iso_catalog_sync_status | sync_target | text | NO | - | - | No | No | - | - |
| public | iso_catalog_sync_status | sync_status | text | NO | 'not_started'::text | - | No | No | - | estado |
| public | iso_catalog_sync_status | last_checked_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_catalog_sync_status | linked_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | iso_catalog_sync_status | total_iso_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | iso_catalog_sync_status | notes | text | YES | - | - | No | No | - | - |
| public | iso_catalog_sync_status | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_catalog_sync_status | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_catalog_sync_status | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_clause_guides | id | integer (int4) | NO | nextval('iso_clause_guides_id_seq'::regclass) | 32 | Sí | No | - | - |
| public | iso_clause_guides | iso | character varying (varchar) | YES | - | 20 | No | No | - | - |
| public | iso_clause_guides | clause | character varying (varchar) | YES | - | 20 | No | No | - | - |
| public | iso_clause_guides | title | text | YES | - | - | No | No | - | - |
| public | iso_clause_guides | accion | text | YES | - | - | No | No | - | - |
| public | iso_clause_guides | evidencia | text | YES | - | - | No | No | - | - |
| public | iso_clauses | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_clauses | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_clauses | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_clauses | version_code | text | NO | - | - | No | No | - | - |
| public | iso_clauses | clause_code | text | NO | - | - | No | No | - | - |
| public | iso_clauses | title | text | NO | - | - | No | No | - | - |
| public | iso_clauses | summary | text | YES | - | - | No | No | - | - |
| public | iso_clauses | parent_clause_code | text | YES | - | - | No | No | - | - |
| public | iso_clauses | sort_order | numeric | NO | 0 | - | No | No | - | - |
| public | iso_clauses | is_required | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_clauses | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_clauses | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_control_catalog_links | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_control_catalog_links | iso_control_id | uuid | NO | - | - | No | Sí | public.iso_controls.id | control |
| public | iso_control_catalog_links | catalog_control_id | uuid | NO | - | - | No | Sí | public.controls_catalog.id | control |
| public | iso_control_catalog_links | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_control_catalog_links | version_code | text | NO | - | - | No | No | - | - |
| public | iso_control_catalog_links | control_code | text | NO | - | - | No | No | - | control |
| public | iso_control_catalog_links | catalog_iso | text | YES | - | - | No | No | - | - |
| public | iso_control_catalog_links | catalog_clause | text | YES | - | - | No | No | - | - |
| public | iso_control_catalog_links | relationship_type | text | NO | 'related'::text | - | No | No | - | - |
| public | iso_control_catalog_links | confidence | numeric | NO | 0.75 | - | No | No | - | - |
| public | iso_control_catalog_links | mapping_source | text | NO | 'seeded'::text | - | No | No | - | - |
| public | iso_control_catalog_links | notes | text | YES | - | - | No | No | - | - |
| public | iso_control_catalog_links | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_control_catalog_links | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_control_catalog_links | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_control_mapping_apply_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_control_mapping_apply_log | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_control_mapping_apply_log | version_code | text | NO | - | - | No | No | - | - |
| public | iso_control_mapping_apply_log | dry_run | boolean (bool) | NO | - | - | No | No | - | - |
| public | iso_control_mapping_apply_log | min_confidence | numeric | NO | - | - | No | No | - | - |
| public | iso_control_mapping_apply_log | candidates_total | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_control_mapping_apply_log | can_auto_apply_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_control_mapping_apply_log | applied_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_control_mapping_apply_log | skipped_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_control_mapping_apply_log | conflict_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_control_mapping_apply_log | requested_by | uuid | YES | - | - | No | No | - | - |
| public | iso_control_mapping_apply_log | requested_role | text | YES | - | - | No | No | - | - |
| public | iso_control_mapping_apply_log | request_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_control_mapping_apply_log | result_summary | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_control_mapping_apply_log | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_control_mappings | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_control_mappings | source_standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_control_mappings | source_version_code | text | NO | - | - | No | No | - | - |
| public | iso_control_mappings | source_control_code | text | NO | - | - | No | No | - | control |
| public | iso_control_mappings | target_standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_control_mappings | target_version_code | text | NO | - | - | No | No | - | - |
| public | iso_control_mappings | target_control_code | text | NO | - | - | No | No | - | control |
| public | iso_control_mappings | relationship_type | text | NO | - | - | No | No | - | - |
| public | iso_control_mappings | reuse_evidence | boolean (bool) | NO | false | - | No | No | - | evidencia |
| public | iso_control_mappings | notes | text | YES | - | - | No | No | - | - |
| public | iso_control_mappings | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_controls | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_controls | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_controls | clause_id | uuid | YES | - | - | No | Sí | public.iso_clauses.id | - |
| public | iso_controls | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_controls | version_code | text | NO | - | - | No | No | - | - |
| public | iso_controls | control_code | text | NO | - | - | No | No | - | control |
| public | iso_controls | title | text | NO | - | - | No | No | - | - |
| public | iso_controls | description | text | YES | - | - | No | No | - | - |
| public | iso_controls | control_type | text | YES | - | - | No | No | - | control |
| public | iso_controls | domain | text | YES | - | - | No | No | - | - |
| public | iso_controls | default_priority | text | NO | 'media'::text | - | No | No | - | - |
| public | iso_controls | default_frequency | text | YES | - | - | No | No | - | - |
| public | iso_controls | owner_role_suggested | text | YES | - | - | No | No | - | usuario/responsable |
| public | iso_controls | copyright_safe_summary | text | YES | - | - | No | No | - | - |
| public | iso_controls | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_controls | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_controls | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_document_audit_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_document_audit_log | document_id | uuid | YES | - | - | No | Sí | public.iso_generated_documents.id | - |
| public | iso_document_audit_log | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_document_audit_log | action | text | NO | - | - | No | No | - | - |
| public | iso_document_audit_log | actor_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | iso_document_audit_log | old_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_document_audit_log | new_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_document_audit_log | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_document_audit_log | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_document_generation_runs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_document_generation_runs | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | iso_document_generation_runs | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_document_generation_runs | version_code | text | NO | - | - | No | No | - | - |
| public | iso_document_generation_runs | document_type | text | NO | - | - | No | No | - | - |
| public | iso_document_generation_runs | template_code | text | YES | - | - | No | No | - | - |
| public | iso_document_generation_runs | source_assessment_id | uuid | YES | - | - | No | No | - | - |
| public | iso_document_generation_runs | requested_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_document_generation_runs | status | text | NO | 'success'::text | - | No | No | - | estado |
| public | iso_document_generation_runs | ai_used | boolean (bool) | NO | false | - | No | No | - | - |
| public | iso_document_generation_runs | request_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_document_generation_runs | result_summary | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_document_generation_runs | error_message | text | YES | - | - | No | No | - | - |
| public | iso_document_generation_runs | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_evidence_expectations | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_evidence_expectations | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_evidence_expectations | control_id | uuid | YES | - | - | No | Sí | public.iso_controls.id | control |
| public | iso_evidence_expectations | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_evidence_expectations | version_code | text | NO | - | - | No | No | - | - |
| public | iso_evidence_expectations | control_code | text | NO | - | - | No | No | - | control |
| public | iso_evidence_expectations | evidence_name | text | NO | - | - | No | No | - | evidencia |
| public | iso_evidence_expectations | evidence_type | text | NO | - | - | No | No | - | evidencia |
| public | iso_evidence_expectations | description | text | YES | - | - | No | No | - | - |
| public | iso_evidence_expectations | required_level | text | NO | 'recommended'::text | - | No | No | - | - |
| public | iso_evidence_expectations | freshness_days | integer (int4) | YES | - | 32 | No | No | - | - |
| public | iso_evidence_expectations | validation_criteria | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_evidence_expectations | ai_review_guidance | text | YES | - | - | No | No | - | - |
| public | iso_evidence_expectations | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_evidence_expectations | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessment_answers | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_express_assessment_answers | assessment_id | uuid | NO | - | - | No | Sí | public.iso_express_assessments.id | - |
| public | iso_express_assessment_answers | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_express_assessment_answers | question_code | text | NO | - | - | No | No | - | - |
| public | iso_express_assessment_answers | question_text | text | NO | - | - | No | No | - | - |
| public | iso_express_assessment_answers | answer_value | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_answers | answer_score | numeric | YES | - | - | No | No | - | - |
| public | iso_express_assessment_answers | notes | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_answers | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessment_answers | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessment_audit_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_express_assessment_audit_log | assessment_id | uuid | YES | - | - | No | No | - | - |
| public | iso_express_assessment_audit_log | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_express_assessment_audit_log | action | text | NO | - | - | No | No | - | - |
| public | iso_express_assessment_audit_log | actor_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | iso_express_assessment_audit_log | old_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessment_audit_log | new_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessment_audit_log | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_express_assessment_audit_log | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessment_gaps | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_express_assessment_gaps | assessment_id | uuid | NO | - | - | No | Sí | public.iso_express_assessments.id | - |
| public | iso_express_assessment_gaps | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_express_assessment_gaps | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_express_assessment_gaps | version_code | text | NO | - | - | No | No | - | - |
| public | iso_express_assessment_gaps | iso_control_id | uuid | YES | - | - | No | Sí | public.iso_controls.id | control |
| public | iso_express_assessment_gaps | control_code | text | YES | - | - | No | No | - | control |
| public | iso_express_assessment_gaps | gap_type | text | NO | - | - | No | No | - | - |
| public | iso_express_assessment_gaps | severity | text | NO | 'media'::text | - | No | No | - | - |
| public | iso_express_assessment_gaps | title | text | NO | - | - | No | No | - | - |
| public | iso_express_assessment_gaps | description | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_gaps | recommendation | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_gaps | suggested_action_type | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_gaps | suggested_owner_role | text | YES | - | - | No | No | - | usuario/responsable |
| public | iso_express_assessment_gaps | suggested_due_days | integer (int4) | NO | 30 | 32 | No | No | - | - |
| public | iso_express_assessment_gaps | source | text | NO | 'diagnostic_engine'::text | - | No | No | - | - |
| public | iso_express_assessment_gaps | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_express_assessment_gaps | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessment_items | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_express_assessment_items | assessment_id | uuid | NO | - | - | No | Sí | public.iso_express_assessments.id | - |
| public | iso_express_assessment_items | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_express_assessment_items | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_express_assessment_items | version_code | text | NO | - | - | No | No | - | - |
| public | iso_express_assessment_items | iso_control_id | uuid | YES | - | - | No | Sí | public.iso_controls.id | control |
| public | iso_express_assessment_items | control_code | text | NO | - | - | No | No | - | control |
| public | iso_express_assessment_items | control_title | text | YES | - | - | No | No | - | control |
| public | iso_express_assessment_items | clause_code | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_items | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | iso_express_assessment_items | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | iso_express_assessment_items | mapping_relationship_type | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_items | mapping_confidence | numeric | YES | - | - | No | No | - | - |
| public | iso_express_assessment_items | implementation_status | text | YES | - | - | No | No | - | estado |
| public | iso_express_assessment_items | health_status | text | YES | - | - | No | No | - | estado |
| public | iso_express_assessment_items | health_score | numeric | YES | - | - | No | No | - | - |
| public | iso_express_assessment_items | evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | iso_express_assessment_items | approved_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | iso_express_assessment_items | pending_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | iso_express_assessment_items | rejected_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | iso_express_assessment_items | has_expected_evidence | boolean (bool) | NO | false | - | No | No | - | evidencia |
| public | iso_express_assessment_items | expected_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | evidencia |
| public | iso_express_assessment_items | evidence_gap | boolean (bool) | NO | false | - | No | No | - | evidencia |
| public | iso_express_assessment_items | control_gap | boolean (bool) | NO | false | - | No | No | - | control |
| public | iso_express_assessment_items | risk_hint | text | YES | - | - | No | No | - | riesgo |
| public | iso_express_assessment_items | gap_severity | text | NO | 'media'::text | - | No | No | - | - |
| public | iso_express_assessment_items | recommendation | text | YES | - | - | No | No | - | - |
| public | iso_express_assessment_items | item_score | numeric | NO | 0 | - | No | No | - | - |
| public | iso_express_assessment_items | item_result_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessment_items | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessment_items | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessments | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_express_assessments | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | iso_express_assessments | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_express_assessments | version_code | text | NO | - | - | No | No | - | - |
| public | iso_express_assessments | assessment_type | text | NO | 'express'::text | - | No | No | - | - |
| public | iso_express_assessments | assessment_status | text | NO | 'draft'::text | - | No | No | - | estado |
| public | iso_express_assessments | requested_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_express_assessments | source | text | NO | 'manual'::text | - | No | No | - | - |
| public | iso_express_assessments | certifiable_version | boolean (bool) | NO | false | - | No | No | - | - |
| public | iso_express_assessments | coverage_warning | text | YES | - | - | No | No | - | - |
| public | iso_express_assessments | readiness_score | numeric | NO | 0 | - | No | No | - | - |
| public | iso_express_assessments | readiness_level | text | YES | - | - | No | No | - | - |
| public | iso_express_assessments | total_iso_controls | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | iso_express_assessments | mapped_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | iso_express_assessments | evaluated_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | iso_express_assessments | controls_with_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | control, evidencia |
| public | iso_express_assessments | controls_without_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | control, evidencia |
| public | iso_express_assessments | gaps_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_express_assessments | critical_gaps_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_express_assessments | high_gaps_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_express_assessments | medium_gaps_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_express_assessments | low_gaps_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_express_assessments | risk_score | numeric | NO | 0 | - | No | No | - | riesgo |
| public | iso_express_assessments | maturity_score | numeric | NO | 0 | - | No | No | - | - |
| public | iso_express_assessments | plan_30_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessments | plan_60_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessments | plan_90_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessments | summary_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessments | input_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessments | result_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_express_assessments | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessments | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_express_assessments | completed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_gap_rules | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_gap_rules | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_gap_rules | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_gap_rules | version_code | text | NO | - | - | No | No | - | - |
| public | iso_gap_rules | rule_code | text | NO | - | - | No | No | - | - |
| public | iso_gap_rules | name | text | NO | - | - | No | No | - | - |
| public | iso_gap_rules | description | text | YES | - | - | No | No | - | - |
| public | iso_gap_rules | condition_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_gap_rules | severity | text | NO | 'media'::text | - | No | No | - | - |
| public | iso_gap_rules | recommendation | text | YES | - | - | No | No | - | - |
| public | iso_gap_rules | creates_finding_suggestion | boolean (bool) | NO | false | - | No | No | - | - |
| public | iso_gap_rules | creates_action_suggestion | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_gap_rules | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_gap_rules | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_generated_document_sections | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_generated_document_sections | document_id | uuid | NO | - | - | No | Sí | public.iso_generated_documents.id | - |
| public | iso_generated_document_sections | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_generated_document_sections | section_order | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_generated_document_sections | section_key | text | NO | - | - | No | No | - | - |
| public | iso_generated_document_sections | section_title | text | NO | - | - | No | No | - | - |
| public | iso_generated_document_sections | section_content | text | NO | - | - | No | No | - | - |
| public | iso_generated_document_sections | source_type | text | NO | 'template'::text | - | No | No | - | - |
| public | iso_generated_document_sections | source_reference | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_generated_document_sections | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_generated_document_sections | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_generated_documents | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_generated_documents | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | iso_generated_documents | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_generated_documents | version_code | text | NO | - | - | No | No | - | - |
| public | iso_generated_documents | document_type | text | NO | - | - | No | No | - | - |
| public | iso_generated_documents | template_code | text | YES | - | - | No | No | - | - |
| public | iso_generated_documents | template_id | uuid | YES | - | - | No | No | - | - |
| public | iso_generated_documents | source_assessment_id | uuid | YES | - | - | No | Sí | public.iso_express_assessments.id | - |
| public | iso_generated_documents | title | text | NO | - | - | No | No | - | - |
| public | iso_generated_documents | document_status | text | NO | 'draft'::text | - | No | No | - | estado |
| public | iso_generated_documents | version | integer (int4) | NO | 1 | 32 | No | No | - | - |
| public | iso_generated_documents | language | text | NO | 'es'::text | - | No | No | - | - |
| public | iso_generated_documents | generated_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_generated_documents | approved_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_generated_documents | approved_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_generated_documents | archived_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_generated_documents | archived_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_generated_documents | content_markdown | text | NO | - | - | No | No | - | - |
| public | iso_generated_documents | content_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_generated_documents | variables_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_generated_documents | source_trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_generated_documents | ai_used | boolean (bool) | NO | false | - | No | No | - | - |
| public | iso_generated_documents | ai_trace_id | uuid | YES | - | - | No | No | - | - |
| public | iso_generated_documents | disclaimer | text | YES | - | - | No | No | - | - |
| public | iso_generated_documents | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_generated_documents | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_maturity_rules | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_maturity_rules | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_maturity_rules | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_maturity_rules | version_code | text | NO | - | - | No | No | - | - |
| public | iso_maturity_rules | maturity_level | integer (int4) | NO | - | 32 | No | No | - | - |
| public | iso_maturity_rules | name | text | NO | - | - | No | No | - | - |
| public | iso_maturity_rules | criteria_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_maturity_rules | min_score | numeric | NO | 0 | - | No | No | - | - |
| public | iso_maturity_rules | max_score | numeric | NO | 100 | - | No | No | - | - |
| public | iso_maturity_rules | recommendation | text | YES | - | - | No | No | - | - |
| public | iso_maturity_rules | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_maturity_rules | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_operational_suggestion_audit_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_operational_suggestion_audit_log | suggestion_id | uuid | YES | - | - | No | Sí | public.iso_operational_suggestions.id | - |
| public | iso_operational_suggestion_audit_log | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_operational_suggestion_audit_log | action | text | NO | - | - | No | No | - | - |
| public | iso_operational_suggestion_audit_log | actor_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | iso_operational_suggestion_audit_log | old_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_operational_suggestion_audit_log | new_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_operational_suggestion_audit_log | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_operational_suggestion_audit_log | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_operational_suggestions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_operational_suggestions | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | iso_operational_suggestions | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | iso_operational_suggestions | operation_id | uuid | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | tenant_control_id | uuid | YES | - | - | No | Sí | public.tenant_controls.id | control |
| public | iso_operational_suggestions | source_module | text | NO | - | - | No | No | - | - |
| public | iso_operational_suggestions | source_entity_type | text | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | source_entity_id | uuid | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | source_reason | text | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | suggestion_type | text | NO | - | - | No | No | - | - |
| public | iso_operational_suggestions | target_record_type | text | NO | - | - | No | No | - | - |
| public | iso_operational_suggestions | title | text | NO | - | - | No | No | - | - |
| public | iso_operational_suggestions | description | text | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | rationale | text | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | priority | text | NO | 'media'::text | - | No | No | - | - |
| public | iso_operational_suggestions | status | text | NO | 'pending'::text | - | No | No | - | estado |
| public | iso_operational_suggestions | dedupe_key | text | NO | - | - | No | No | - | - |
| public | iso_operational_suggestions | suggested_owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | iso_operational_suggestions | suggested_due_date | date | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | payload_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_operational_suggestions | source_trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_operational_suggestions | ai_trace_id | uuid | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | created_by | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | iso_operational_suggestions | approved_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_operational_suggestions | approved_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | rejected_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_operational_suggestions | rejected_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | rejection_comment | text | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | created_record_type | text | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | created_record_id | uuid | YES | - | - | No | No | - | - |
| public | iso_operational_suggestions | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_operational_suggestions | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_policy_templates | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_policy_templates | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_policy_templates | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_policy_templates | version_code | text | NO | - | - | No | No | - | - |
| public | iso_policy_templates | template_code | text | NO | - | - | No | No | - | - |
| public | iso_policy_templates | title | text | NO | - | - | No | No | - | - |
| public | iso_policy_templates | objective | text | YES | - | - | No | No | - | - |
| public | iso_policy_templates | scope_guidance | text | YES | - | - | No | No | - | - |
| public | iso_policy_templates | sections_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_policy_templates | variables_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_policy_templates | related_control_codes | ARRAY (_text) | NO | '{}'::text[] | - | No | No | - | control |
| public | iso_policy_templates | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_policy_templates | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_policy_templates | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_procedure_templates | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_procedure_templates | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_procedure_templates | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_procedure_templates | version_code | text | NO | - | - | No | No | - | - |
| public | iso_procedure_templates | template_code | text | NO | - | - | No | No | - | - |
| public | iso_procedure_templates | title | text | NO | - | - | No | No | - | - |
| public | iso_procedure_templates | objective | text | YES | - | - | No | No | - | - |
| public | iso_procedure_templates | scope_guidance | text | YES | - | - | No | No | - | - |
| public | iso_procedure_templates | steps_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_procedure_templates | roles_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_procedure_templates | records_json | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_procedure_templates | related_control_codes | ARRAY (_text) | NO | '{}'::text[] | - | No | No | - | control |
| public | iso_procedure_templates | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_procedure_templates | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_procedure_templates | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_recommended_action_conversions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_recommended_action_conversions | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | iso_recommended_action_conversions | recommendation_id | uuid | NO | - | - | No | Sí | public.iso_operational_suggestions.id | - |
| public | iso_recommended_action_conversions | target_type | text | NO | - | - | No | No | - | - |
| public | iso_recommended_action_conversions | target_table | text | YES | - | - | No | No | - | - |
| public | iso_recommended_action_conversions | target_id | uuid | YES | - | - | No | No | - | - |
| public | iso_recommended_action_conversions | conversion_status | text | NO | 'converted'::text | - | No | No | - | estado |
| public | iso_recommended_action_conversions | source_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_recommended_action_conversions | result_payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_recommended_action_conversions | converted_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_recommended_action_conversions | converted_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | - |
| public | iso_recommended_action_conversions | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_recommended_action_conversions | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_recommended_action_workflow_events | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_recommended_action_workflow_events | suggestion_id | uuid | NO | - | - | No | No | - | - |
| public | iso_recommended_action_workflow_events | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_recommended_action_workflow_events | previous_status | text | YES | - | - | No | No | - | estado |
| public | iso_recommended_action_workflow_events | new_status | text | NO | - | - | No | No | - | estado |
| public | iso_recommended_action_workflow_events | event_type | text | NO | - | - | No | No | - | - |
| public | iso_recommended_action_workflow_events | comment | text | YES | - | - | No | No | - | - |
| public | iso_recommended_action_workflow_events | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | iso_recommended_action_workflow_events | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_recommended_action_workflow_events | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_actions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_risk_matrix_actions | run_id | uuid | NO | - | - | No | Sí | public.iso_risk_matrix_runs.id | - |
| public | iso_risk_matrix_actions | risk_item_id | uuid | NO | - | - | No | Sí | public.iso_risk_matrix_items.id | riesgo |
| public | iso_risk_matrix_actions | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_risk_matrix_actions | action_title | text | NO | - | - | No | No | - | - |
| public | iso_risk_matrix_actions | action_description | text | YES | - | - | No | No | - | - |
| public | iso_risk_matrix_actions | suggested_owner_role | text | YES | - | - | No | No | - | usuario/responsable |
| public | iso_risk_matrix_actions | suggested_due_days | integer (int4) | NO | 30 | 32 | No | No | - | - |
| public | iso_risk_matrix_actions | priority | text | NO | 'media'::text | - | No | No | - | - |
| public | iso_risk_matrix_actions | action_type | text | NO | 'risk_treatment'::text | - | No | No | - | - |
| public | iso_risk_matrix_actions | creates_action_plan_candidate | boolean (bool) | NO | true | - | No | No | - | plan de acción |
| public | iso_risk_matrix_actions | status | text | NO | 'suggested'::text | - | No | No | - | estado |
| public | iso_risk_matrix_actions | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_risk_matrix_actions | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_actions | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_audit_log | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_risk_matrix_audit_log | run_id | uuid | YES | - | - | No | Sí | public.iso_risk_matrix_runs.id | - |
| public | iso_risk_matrix_audit_log | risk_item_id | uuid | YES | - | - | No | Sí | public.iso_risk_matrix_items.id | riesgo |
| public | iso_risk_matrix_audit_log | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_risk_matrix_audit_log | action | text | NO | - | - | No | No | - | - |
| public | iso_risk_matrix_audit_log | actor_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | iso_risk_matrix_audit_log | old_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_matrix_audit_log | new_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_matrix_audit_log | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | iso_risk_matrix_audit_log | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_items | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_risk_matrix_items | run_id | uuid | NO | - | - | No | Sí | public.iso_risk_matrix_runs.id | - |
| public | iso_risk_matrix_items | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | iso_risk_matrix_items | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_risk_matrix_items | version_code | text | NO | - | - | No | No | - | - |
| public | iso_risk_matrix_items | risk_template_id | uuid | YES | - | - | No | Sí | public.iso_risk_templates.id | riesgo |
| public | iso_risk_matrix_items | asset_id | uuid | YES | - | - | No | Sí | public.assets.id | - |
| public | iso_risk_matrix_items | iso_control_id | uuid | YES | - | - | No | Sí | public.iso_controls.id | control |
| public | iso_risk_matrix_items | catalog_control_id | uuid | YES | - | - | No | Sí | public.controls_catalog.id | control |
| public | iso_risk_matrix_items | tenant_control_id | uuid | YES | - | - | No | Sí | public.tenant_controls.id | control |
| public | iso_risk_matrix_items | source_assessment_id | uuid | YES | - | - | No | Sí | public.iso_express_assessments.id | - |
| public | iso_risk_matrix_items | source_gap_id | uuid | YES | - | - | No | Sí | public.iso_express_assessment_gaps.id | - |
| public | iso_risk_matrix_items | risk_code | text | YES | - | - | No | No | - | riesgo |
| public | iso_risk_matrix_items | risk_title | text | NO | - | - | No | No | - | riesgo |
| public | iso_risk_matrix_items | risk_description | text | YES | - | - | No | No | - | riesgo |
| public | iso_risk_matrix_items | risk_category | text | YES | - | - | No | No | - | riesgo |
| public | iso_risk_matrix_items | asset_name | text | YES | - | - | No | No | - | - |
| public | iso_risk_matrix_items | asset_type | text | YES | - | - | No | No | - | - |
| public | iso_risk_matrix_items | asset_criticality | text | YES | - | - | No | No | - | - |
| public | iso_risk_matrix_items | likelihood | integer (int4) | NO | 3 | 32 | No | No | - | - |
| public | iso_risk_matrix_items | impact | integer (int4) | NO | 3 | 32 | No | No | - | - |
| public | iso_risk_matrix_items | inherent_risk_score | integer (int4) | NO | 9 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_items | inherent_risk_level | text | NO | 'medio'::text | - | No | No | - | riesgo |
| public | iso_risk_matrix_items | control_effectiveness_score | numeric | NO | 0 | - | No | No | - | control |
| public | iso_risk_matrix_items | residual_likelihood | integer (int4) | NO | 3 | 32 | No | No | - | - |
| public | iso_risk_matrix_items | residual_impact | integer (int4) | NO | 3 | 32 | No | No | - | - |
| public | iso_risk_matrix_items | residual_risk_score | integer (int4) | NO | 9 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_items | residual_risk_level | text | NO | 'medio'::text | - | No | No | - | riesgo |
| public | iso_risk_matrix_items | treatment_strategy | text | NO | 'mitigar'::text | - | No | No | - | - |
| public | iso_risk_matrix_items | suggested_controls | ARRAY (_text) | NO | '{}'::text[] | - | No | No | - | control |
| public | iso_risk_matrix_items | suggested_actions | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_matrix_items | evidence_expectations | jsonb | NO | '[]'::jsonb | - | No | No | - | evidencia, json/jsonb |
| public | iso_risk_matrix_items | status | text | NO | 'suggested'::text | - | No | No | - | estado |
| public | iso_risk_matrix_items | confidence | numeric | NO | 0.75 | - | No | No | - | - |
| public | iso_risk_matrix_items | source_type | text | NO | 'risk_template'::text | - | No | No | - | - |
| public | iso_risk_matrix_items | source_trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_matrix_items | reviewer_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | iso_risk_matrix_items | reviewed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_risk_matrix_items | review_comment | text | YES | - | - | No | No | - | - |
| public | iso_risk_matrix_items | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_items | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_runs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_risk_matrix_runs | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | iso_risk_matrix_runs | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_risk_matrix_runs | version_code | text | NO | - | - | No | No | - | - |
| public | iso_risk_matrix_runs | source_assessment_id | uuid | YES | - | - | No | Sí | public.iso_express_assessments.id | - |
| public | iso_risk_matrix_runs | run_type | text | NO | 'automated'::text | - | No | No | - | - |
| public | iso_risk_matrix_runs | run_status | text | NO | 'completed'::text | - | No | No | - | estado |
| public | iso_risk_matrix_runs | requested_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | iso_risk_matrix_runs | certifiable_version | boolean (bool) | NO | false | - | No | No | - | - |
| public | iso_risk_matrix_runs | coverage_warning | text | YES | - | - | No | No | - | - |
| public | iso_risk_matrix_runs | total_assets | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | iso_risk_matrix_runs | total_risk_templates | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | suggested_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | accepted_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | rejected_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | critical_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | high_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | medium_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | low_risks_count | integer (int4) | NO | 0 | 32 | No | No | - | riesgo |
| public | iso_risk_matrix_runs | inherent_risk_avg | numeric | NO | 0 | - | No | No | - | riesgo |
| public | iso_risk_matrix_runs | residual_risk_avg | numeric | NO | 0 | - | No | No | - | riesgo |
| public | iso_risk_matrix_runs | risk_posture | text | YES | - | - | No | No | - | riesgo |
| public | iso_risk_matrix_runs | summary_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_matrix_runs | input_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_matrix_runs | result_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_matrix_runs | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_runs | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_matrix_runs | completed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | iso_risk_templates | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_risk_templates | standard_version_id | uuid | NO | - | - | No | Sí | public.iso_standard_versions.id | - |
| public | iso_risk_templates | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_risk_templates | version_code | text | NO | - | - | No | No | - | - |
| public | iso_risk_templates | risk_code | text | NO | - | - | No | No | - | riesgo |
| public | iso_risk_templates | title | text | NO | - | - | No | No | - | - |
| public | iso_risk_templates | description | text | YES | - | - | No | No | - | - |
| public | iso_risk_templates | category | text | YES | - | - | No | No | - | - |
| public | iso_risk_templates | typical_causes | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_templates | typical_consequences | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_templates | suggested_controls | ARRAY (_text) | NO | '{}'::text[] | - | No | No | - | control |
| public | iso_risk_templates | suggested_treatments | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_risk_templates | default_likelihood | integer (int4) | NO | 3 | 32 | No | No | - | - |
| public | iso_risk_templates | default_impact | integer (int4) | NO | 3 | 32 | No | No | - | - |
| public | iso_risk_templates | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_risk_templates | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_standard_versions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_standard_versions | standard_id | uuid | NO | - | - | No | Sí | public.iso_standards.id | - |
| public | iso_standard_versions | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_standard_versions | version_code | text | NO | - | - | No | No | - | - |
| public | iso_standard_versions | display_name | text | NO | - | - | No | No | - | - |
| public | iso_standard_versions | publication_status | text | NO | - | - | No | No | - | estado |
| public | iso_standard_versions | certifiable | boolean (bool) | NO | false | - | No | No | - | - |
| public | iso_standard_versions | replaces_version | text | YES | - | - | No | No | - | - |
| public | iso_standard_versions | effective_from | date | YES | - | - | No | No | - | - |
| public | iso_standard_versions | transition_until | date | YES | - | - | No | No | - | - |
| public | iso_standard_versions | source_policy | text | NO | 'copyright_safe_summary'::text | - | No | No | - | - |
| public | iso_standard_versions | notes | text | YES | - | - | No | No | - | - |
| public | iso_standard_versions | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_standard_versions | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_standard_versions | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_standards | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_standards | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_standards | display_name | text | NO | - | - | No | No | - | - |
| public | iso_standards | family | text | NO | - | - | No | No | - | - |
| public | iso_standards | description | text | YES | - | - | No | No | - | - |
| public | iso_standards | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | iso_standards | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_standards | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_transition_guidance | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | iso_transition_guidance | source_standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_transition_guidance | source_version_code | text | NO | - | - | No | No | - | - |
| public | iso_transition_guidance | target_standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | iso_transition_guidance | target_version_code | text | NO | - | - | No | No | - | - |
| public | iso_transition_guidance | transition_status | text | NO | - | - | No | No | - | estado |
| public | iso_transition_guidance | certifiable_target | boolean (bool) | NO | false | - | No | No | - | - |
| public | iso_transition_guidance | guidance_summary | text | YES | - | - | No | No | - | - |
| public | iso_transition_guidance | recommended_actions | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_transition_guidance | caveats | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | iso_transition_guidance | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | iso_transition_guidance | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_calculation_jobs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_calculation_jobs | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | kpi_calculation_jobs | job_type | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_calculation_jobs | trigger_source | character varying (varchar) | NO | 'manual'::character varying | 50 | No | No | - | - |
| public | kpi_calculation_jobs | status | USER-DEFINED (kpi_job_status_enum) | NO | 'pending'::kpi_job_status_enum | - | No | No | - | estado |
| public | kpi_calculation_jobs | requested_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | kpi_calculation_jobs | payload_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_calculation_jobs | result_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_calculation_jobs | error_message | text | YES | - | - | No | No | - | - |
| public | kpi_calculation_jobs | started_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | kpi_calculation_jobs | finished_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | kpi_calculation_jobs | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_calculation_jobs | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_calculation_rules | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_calculation_rules | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_calculation_rules | version | integer (int4) | NO | 1 | 32 | No | No | - | - |
| public | kpi_calculation_rules | rule_name | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | kpi_calculation_rules | calculation_mode | character varying (varchar) | NO | 'sql'::character varying | 50 | No | No | - | - |
| public | kpi_calculation_rules | numerator_sql | text | YES | - | - | No | No | - | - |
| public | kpi_calculation_rules | denominator_sql | text | YES | - | - | No | No | - | - |
| public | kpi_calculation_rules | value_sql | text | YES | - | - | No | No | - | - |
| public | kpi_calculation_rules | formula_expression | text | YES | - | - | No | No | - | - |
| public | kpi_calculation_rules | post_processing_expression | text | YES | - | - | No | No | - | - |
| public | kpi_calculation_rules | applies_to_standard_code | character varying (varchar) | YES | - | 50 | No | Sí | public.standards.code | norma ISO |
| public | kpi_calculation_rules | is_default | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_calculation_rules | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_calculation_rules | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | kpi_calculation_rules | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_calculation_rules | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_custom_inputs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_custom_inputs | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_custom_inputs | input_key | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_custom_inputs | input_label | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | kpi_custom_inputs | input_type | character varying (varchar) | NO | 'number'::character varying | 50 | No | No | - | - |
| public | kpi_custom_inputs | is_required | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_custom_inputs | default_value | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | kpi_custom_inputs | validation_rules | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_custom_inputs | display_order | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | kpi_custom_inputs | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_custom_inputs | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_data_sources | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_data_sources | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_data_sources | source_name | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_data_sources | source_table | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_data_sources | source_description | text | YES | - | - | No | No | - | - |
| public | kpi_data_sources | is_required | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_data_sources | filter_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_data_sources | aggregation_hint | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | kpi_data_sources | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_data_sources | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_definitions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_definitions | code | character varying (varchar) | NO | - | 50 | No | No | - | - |
| public | kpi_definitions | name | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | kpi_definitions | description | text | YES | - | - | No | No | - | - |
| public | kpi_definitions | category | USER-DEFINED (kpi_category_enum) | NO | - | - | No | No | - | - |
| public | kpi_definitions | kpi_type | USER-DEFINED (kpi_type_enum) | NO | - | - | No | No | - | - |
| public | kpi_definitions | scope | USER-DEFINED (kpi_scope_enum) | NO | 'global'::kpi_scope_enum | - | No | No | - | - |
| public | kpi_definitions | unit | character varying (varchar) | NO | - | 50 | No | No | - | - |
| public | kpi_definitions | base_formula | text | YES | - | - | No | No | - | - |
| public | kpi_definitions | formula_expression | text | YES | - | - | No | No | - | - |
| public | kpi_definitions | data_source_summary | text | YES | - | - | No | No | - | - |
| public | kpi_definitions | frequency | USER-DEFINED (kpi_frequency_enum) | NO | - | - | No | No | - | - |
| public | kpi_definitions | direction | USER-DEFINED (kpi_direction_enum) | NO | - | - | No | No | - | - |
| public | kpi_definitions | target_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_definitions | min_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_definitions | max_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_definitions | display_order | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | kpi_definitions | is_standard | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_definitions | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | kpi_definitions | created_by | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | kpi_definitions | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_definitions | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | kpi_definitions | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_definitions | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_dimensions_catalog | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_dimensions_catalog | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_dimensions_catalog | dimension_type | USER-DEFINED (kpi_dimension_type_enum) | NO | - | - | No | No | - | - |
| public | kpi_dimensions_catalog | dimension_key | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_dimensions_catalog | dimension_label | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | kpi_dimensions_catalog | is_required | boolean (bool) | NO | false | - | No | No | - | - |
| public | kpi_dimensions_catalog | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_dimensions_catalog | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | kpi_dimensions_catalog | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_dimensions_catalog | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_event_queue | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_event_queue | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | kpi_event_queue | event_type | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_event_queue | entity_type | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_event_queue | entity_id | uuid | YES | - | - | No | No | - | - |
| public | kpi_event_queue | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | kpi_event_queue | payload_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_event_queue | processed | boolean (bool) | NO | false | - | No | No | - | - |
| public | kpi_event_queue | processed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | kpi_event_queue | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_manual_values | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_manual_values | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | kpi_manual_values | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_manual_values | standard_code | character varying (varchar) | YES | - | 50 | No | Sí | public.standards.code | norma ISO |
| public | kpi_manual_values | period_type | USER-DEFINED (kpi_period_type_enum) | NO | - | - | No | No | - | - |
| public | kpi_manual_values | period_start | date | NO | - | - | No | No | - | - |
| public | kpi_manual_values | period_end | date | NO | - | - | No | No | - | - |
| public | kpi_manual_values | value | numeric | NO | - | 18 | No | No | - | - |
| public | kpi_manual_values | numerator_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_manual_values | denominator_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_manual_values | dimension_data | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_manual_values | notes | text | YES | - | - | No | No | - | - |
| public | kpi_manual_values | entered_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | kpi_manual_values | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_manual_values | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_snapshot_dimensions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_snapshot_dimensions | snapshot_id | uuid | NO | - | - | No | Sí | public.kpi_snapshots.id | - |
| public | kpi_snapshot_dimensions | dimension_type | USER-DEFINED (kpi_dimension_type_enum) | NO | - | - | No | No | - | - |
| public | kpi_snapshot_dimensions | dimension_key | character varying (varchar) | NO | - | 100 | No | No | - | - |
| public | kpi_snapshot_dimensions | dimension_value | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | kpi_snapshot_dimensions | dimension_label | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | kpi_snapshot_dimensions | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_snapshots | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_snapshots | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | kpi_snapshots | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_snapshots | standard_code | character varying (varchar) | YES | - | 50 | No | Sí | public.standards.code | norma ISO |
| public | kpi_snapshots | period_type | USER-DEFINED (kpi_period_type_enum) | NO | - | - | No | No | - | - |
| public | kpi_snapshots | period_start | date | NO | - | - | No | No | - | - |
| public | kpi_snapshots | period_end | date | NO | - | - | No | No | - | - |
| public | kpi_snapshots | value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_snapshots | numerator_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_snapshots | denominator_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_snapshots | status_color | USER-DEFINED (kpi_status_color_enum) | NO | 'gray'::kpi_status_color_enum | - | No | No | - | - |
| public | kpi_snapshots | direction | USER-DEFINED (kpi_direction_enum) | NO | - | - | No | No | - | - |
| public | kpi_snapshots | target_value | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_snapshots | calculated_from | character varying (varchar) | NO | 'engine'::character varying | 50 | No | No | - | - |
| public | kpi_snapshots | calculation_rule_id | uuid | YES | - | - | No | Sí | public.kpi_calculation_rules.id | - |
| public | kpi_snapshots | breakdown_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_snapshots | source_trace_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_snapshots | calculated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | kpi_snapshots | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_snapshots | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_staging_import | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_staging_import | batch_id | uuid | NO | gen_random_uuid() | - | No | No | - | - |
| public | kpi_staging_import | source_file_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | kpi_staging_import | row_number | integer (int4) | YES | - | 32 | No | No | - | - |
| public | kpi_staging_import | norma | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | kpi_staging_import | kpi | character varying (varchar) | YES | - | 500 | No | No | - | - |
| public | kpi_staging_import | descripcion | text | YES | - | - | No | No | - | - |
| public | kpi_staging_import | formula | text | YES | - | - | No | No | - | - |
| public | kpi_staging_import | tipo | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | kpi_staging_import | frecuencia | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | kpi_staging_import | unidad | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | kpi_staging_import | fuente_datos | text | YES | - | - | No | No | - | - |
| public | kpi_staging_import | relacionado_con | text | YES | - | - | No | No | - | - |
| public | kpi_staging_import | umbral_verde | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | kpi_staging_import | umbral_amarillo | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | kpi_staging_import | umbral_rojo | character varying (varchar) | YES | - | 100 | No | No | - | - |
| public | kpi_staging_import | raw_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | kpi_staging_import | imported_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | kpi_staging_import | processed | boolean (bool) | NO | false | - | No | No | - | - |
| public | kpi_staging_import | process_notes | text | YES | - | - | No | No | - | - |
| public | kpi_standard_mappings | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_standard_mappings | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_standard_mappings | standard_code | character varying (varchar) | NO | - | 50 | No | Sí | public.standards.code | norma ISO |
| public | kpi_standard_mappings | variation_label | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | kpi_standard_mappings | variation_formula | text | YES | - | - | No | No | - | - |
| public | kpi_standard_mappings | variation_notes | text | YES | - | - | No | No | - | - |
| public | kpi_standard_mappings | relevance_weight | integer (int4) | NO | 100 | 32 | No | No | - | - |
| public | kpi_standard_mappings | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | kpi_standard_mappings | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_standard_mappings | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_thresholds | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | kpi_thresholds | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | kpi_thresholds | green_min | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_thresholds | green_max | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_thresholds | yellow_min | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_thresholds | yellow_max | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_thresholds | red_min | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_thresholds | red_max | numeric | YES | - | 18 | No | No | - | - |
| public | kpi_thresholds | direction | USER-DEFINED (kpi_direction_enum) | NO | - | - | No | No | - | - |
| public | kpi_thresholds | notes | text | YES | - | - | No | No | - | - |
| public | kpi_thresholds | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | kpi_thresholds | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | lifecycle_stage_catalog | stage_code | text | NO | - | - | Sí | No | - | - |
| public | lifecycle_stage_catalog | stage_name | text | NO | - | - | No | No | - | - |
| public | lifecycle_stage_catalog | sort_order | integer (int4) | NO | - | 32 | No | No | - | - |
| public | lifecycle_stage_catalog | is_terminal | boolean (bool) | NO | false | - | No | No | - | - |
| public | lifecycle_stage_catalog | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | lifecycle_stage_catalog | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | management_objectives | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | management_objectives | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | management_objectives | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | management_objectives | title | text | NO | - | - | No | No | - | - |
| public | management_objectives | description | text | YES | - | - | No | No | - | - |
| public | management_objectives | owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | management_objectives | period_type | text | NO | 'mensual'::text | - | No | No | - | - |
| public | management_objectives | period_start | date | YES | - | - | No | No | - | - |
| public | management_objectives | period_end | date | YES | - | - | No | No | - | - |
| public | management_objectives | target_value | numeric | YES | - | 12 | No | No | - | - |
| public | management_objectives | actual_value | numeric | YES | - | 12 | No | No | - | - |
| public | management_objectives | progress_percent | numeric | YES | - | 5 | No | No | - | - |
| public | management_objectives | status | text | NO | 'en_progreso'::text | - | No | No | - | estado |
| public | management_objectives | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | management_objectives | evidence_url | text | YES | - | - | No | No | - | evidencia |
| public | management_objectives | notes | text | YES | - | - | No | No | - | - |
| public | management_objectives | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | management_objectives | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | management_objectives | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | management_objectives | updated_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | management_objectives | status_updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | nonconformities_catalog | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | nonconformities_catalog | iso | text | YES | - | - | No | No | - | - |
| public | nonconformities_catalog | clause | text | YES | - | - | No | No | - | - |
| public | nonconformities_catalog | description | text | YES | - | - | No | No | - | - |
| public | notifications | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | notifications | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | notifications | type | text | NO | - | - | No | No | - | - |
| public | notifications | title | text | NO | - | - | No | No | - | - |
| public | notifications | description | text | YES | - | - | No | No | - | - |
| public | notifications | href | text | NO | - | - | No | No | - | - |
| public | notifications | level | text | NO | - | - | No | No | - | - |
| public | notifications | entity_type | text | YES | - | - | No | No | - | - |
| public | notifications | entity_id | uuid | YES | - | - | No | No | - | - |
| public | notifications | dedupe_key | text | NO | - | - | No | No | - | - |
| public | notifications | is_read | boolean (bool) | NO | false | - | No | No | - | - |
| public | notifications | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | notifications | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | notifications | expires_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | permissions | permission_key | text | NO | - | - | Sí | No | - | - |
| public | permissions | permission_group | text | NO | - | - | No | No | - | - |
| public | permissions | display_name | text | NO | - | - | No | No | - | - |
| public | permissions | description | text | YES | - | - | No | No | - | - |
| public | permissions | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | permissions | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | permissions | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | report_access_rules | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | report_access_rules | report_type_code | text | NO | - | - | No | Sí | public.report_types.code | - |
| public | report_access_rules | role_code | text | NO | - | - | No | No | - | - |
| public | report_access_rules | can_view | boolean (bool) | NO | true | - | No | No | - | - |
| public | report_access_rules | can_generate | boolean (bool) | NO | true | - | No | No | - | - |
| public | report_access_rules | can_schedule | boolean (bool) | NO | false | - | No | No | - | - |
| public | report_access_rules | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | report_access_rules_backup_20260430 | id | uuid | YES | - | - | No | No | - | - |
| public | report_access_rules_backup_20260430 | report_type_code | text | YES | - | - | No | No | - | - |
| public | report_access_rules_backup_20260430 | role_code | text | YES | - | - | No | No | - | - |
| public | report_access_rules_backup_20260430 | can_view | boolean (bool) | YES | - | - | No | No | - | - |
| public | report_access_rules_backup_20260430 | can_generate | boolean (bool) | YES | - | - | No | No | - | - |
| public | report_access_rules_backup_20260430 | can_schedule | boolean (bool) | YES | - | - | No | No | - | - |
| public | report_access_rules_backup_20260430 | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | report_exports | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | report_exports | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | report_exports | requested_by | uuid | YES | - | - | No | No | - | - |
| public | report_exports | report_type_code | text | NO | - | - | No | Sí | public.report_types.code | - |
| public | report_exports | report_title | text | NO | - | - | No | No | - | - |
| public | report_exports | report_format | text | NO | 'pdf'::text | - | No | No | - | - |
| public | report_exports | status | text | NO | 'generated'::text | - | No | No | - | estado |
| public | report_exports | file_url | text | YES | - | - | No | No | - | - |
| public | report_exports | payload_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | report_exports | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | report_exports | generated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | report_schedules | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | report_schedules | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | report_schedules | report_type_code | text | NO | - | - | No | Sí | public.report_types.code | - |
| public | report_schedules | frequency | text | NO | 'monthly'::text | - | No | No | - | - |
| public | report_schedules | day_of_month | integer (int4) | NO | 1 | 32 | No | No | - | - |
| public | report_schedules | recipients | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | report_schedules | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | report_schedules | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | report_schedules | last_sent_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | report_schedules | next_run_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | report_schedules | notes | text | YES | - | - | No | No | - | - |
| public | report_schedules | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | report_schedules | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | report_schedules | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | report_types | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | report_types | code | text | NO | - | - | No | No | - | - |
| public | report_types | name | text | NO | - | - | No | No | - | - |
| public | report_types | description | text | YES | - | - | No | No | - | - |
| public | report_types | category | text | NO | 'executive'::text | - | No | No | - | - |
| public | report_types | default_format | text | NO | 'pdf'::text | - | No | No | - | - |
| public | report_types | template_key | text | NO | - | - | No | No | - | - |
| public | report_types | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | report_types | sort_order | integer (int4) | NO | 100 | 32 | No | No | - | - |
| public | report_types | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | report_types | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | report_types | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | responses | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | responses | assessment_id | uuid | YES | - | - | No | Sí | public.assessments.id | - |
| public | responses | clause_id | integer (int4) | YES | - | 32 | No | Sí | public.clauses.id | - |
| public | responses | status | character varying (varchar) | YES | - | 50 | No | No | - | estado |
| public | responses | score | integer (int4) | YES | - | 32 | No | No | - | - |
| public | responses | evidence | text | YES | - | - | No | No | - | evidencia |
| public | responses | updated_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | role_permissions | role_key | text | NO | - | - | Sí | Sí | public.app_roles.role_key | - |
| public | role_permissions | permission_key | text | NO | - | - | Sí | Sí | public.permissions.permission_key | - |
| public | role_permissions | is_allowed | boolean (bool) | NO | true | - | No | No | - | - |
| public | role_permissions | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | role_permissions | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | roles | id | integer (int4) | NO | nextval('roles_id_seq'::regclass) | 32 | Sí | No | - | - |
| public | roles | name | character varying (varchar) | NO | - | 50 | No | No | - | - |
| public | saas_modules | module_key | text | NO | - | - | Sí | No | - | - |
| public | saas_modules | display_name | text | NO | - | - | No | No | - | - |
| public | saas_modules | description | text | YES | - | - | No | No | - | - |
| public | saas_modules | default_enabled | boolean (bool) | NO | true | - | No | No | - | - |
| public | saas_modules | is_system | boolean (bool) | NO | true | - | No | No | - | - |
| public | saas_modules | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | saas_modules | sort_order | integer (int4) | NO | 100 | 32 | No | No | - | - |
| public | saas_modules | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | saas_modules | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | saas_monthly_prebilling | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | saas_monthly_prebilling | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | saas_monthly_prebilling | billing_month | date | NO | - | - | No | No | - | - |
| public | saas_monthly_prebilling | status | text | NO | 'draft'::text | - | No | No | - | estado |
| public | saas_monthly_prebilling | currency | text | NO | 'CLP'::text | - | No | No | - | - |
| public | saas_monthly_prebilling | plan_key | text | YES | - | - | No | No | - | - |
| public | saas_monthly_prebilling | contract_status | text | YES | - | - | No | No | - | estado |
| public | saas_monthly_prebilling | subtotal_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_monthly_prebilling | discount_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_monthly_prebilling | additional_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_monthly_prebilling | tax_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_monthly_prebilling | total_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_monthly_prebilling | reviewed_by_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | saas_monthly_prebilling | reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | saas_monthly_prebilling | exported_to_crm_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | saas_monthly_prebilling | crm_reference | text | YES | - | - | No | No | - | - |
| public | saas_monthly_prebilling | notes | text | YES | - | - | No | No | - | - |
| public | saas_monthly_prebilling | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | saas_monthly_prebilling | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_monthly_prebilling | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_monthly_prebilling_lines | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | saas_monthly_prebilling_lines | prebilling_id | uuid | NO | - | - | No | Sí | public.saas_monthly_prebilling.id | - |
| public | saas_monthly_prebilling_lines | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | saas_monthly_prebilling_lines | billing_month | date | NO | - | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | line_type | text | NO | - | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | line_key | text | NO | - | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | line_name | text | NO | - | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | line_description | text | YES | - | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | quantity | numeric | NO | 1 | 14 | No | No | - | - |
| public | saas_monthly_prebilling_lines | unit_price | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_monthly_prebilling_lines | subtotal_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_monthly_prebilling_lines | is_manual | boolean (bool) | NO | false | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | is_discount | boolean (bool) | NO | false | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | is_billable | boolean (bool) | NO | true | - | No | No | - | - |
| public | saas_monthly_prebilling_lines | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | saas_monthly_prebilling_lines | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_monthly_prebilling_lines | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_price_catalog | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | saas_price_catalog | item_type | text | NO | - | - | No | No | - | - |
| public | saas_price_catalog | item_key | text | NO | - | - | No | No | - | - |
| public | saas_price_catalog | item_name | text | NO | - | - | No | No | - | - |
| public | saas_price_catalog | item_description | text | YES | - | - | No | No | - | - |
| public | saas_price_catalog | currency | text | NO | 'CLP'::text | - | No | No | - | - |
| public | saas_price_catalog | unit_price | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_price_catalog | billing_frequency | text | NO | 'monthly'::text | - | No | No | - | - |
| public | saas_price_catalog | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | saas_price_catalog | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | saas_price_catalog | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_price_catalog | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_quote_lines | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | saas_quote_lines | quote_id | uuid | NO | - | - | No | Sí | public.saas_quotes.id | - |
| public | saas_quote_lines | line_type | text | NO | - | - | No | No | - | - |
| public | saas_quote_lines | line_key | text | NO | - | - | No | No | - | - |
| public | saas_quote_lines | line_name | text | NO | - | - | No | No | - | - |
| public | saas_quote_lines | line_description | text | YES | - | - | No | No | - | - |
| public | saas_quote_lines | quantity | numeric | NO | 1 | 14 | No | No | - | - |
| public | saas_quote_lines | unit_price | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_quote_lines | subtotal_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_quote_lines | is_billable | boolean (bool) | NO | true | - | No | No | - | - |
| public | saas_quote_lines | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | saas_quote_lines | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_quotes | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | saas_quotes | quote_number | text | NO | - | - | No | No | - | - |
| public | saas_quotes | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | saas_quotes | prospect_name | text | NO | - | - | No | No | - | - |
| public | saas_quotes | prospect_rut | text | YES | - | - | No | No | - | - |
| public | saas_quotes | prospect_email | text | YES | - | - | No | No | - | - |
| public | saas_quotes | prospect_phone | text | YES | - | - | No | No | - | - |
| public | saas_quotes | created_by_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | saas_quotes | dealer_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | saas_quotes | status | text | NO | 'draft'::text | - | No | No | - | estado |
| public | saas_quotes | currency | text | NO | 'CLP'::text | - | No | No | - | - |
| public | saas_quotes | plan_key | text | NO | 'pyme'::text | - | No | No | - | - |
| public | saas_quotes | active_standards_count | integer (int4) | NO | 1 | 32 | No | No | - | - |
| public | saas_quotes | premium_modules_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | saas_quotes | external_lookup_quota | integer (int4) | NO | 25 | 32 | No | No | - | - |
| public | saas_quotes | subtotal_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_quotes | discount_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_quotes | tax_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_quotes | total_monthly_amount | numeric | NO | 0 | 14 | No | No | - | - |
| public | saas_quotes | validity_days | integer (int4) | NO | 15 | 32 | No | No | - | - |
| public | saas_quotes | valid_until | date | YES | - | - | No | No | - | - |
| public | saas_quotes | notes | text | YES | - | - | No | No | - | - |
| public | saas_quotes | crm_reference | text | YES | - | - | No | No | - | - |
| public | saas_quotes | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | saas_quotes | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | saas_quotes | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | search_history | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | search_history | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | search_history | user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | search_history | query | text | NO | - | - | No | No | - | - |
| public | search_history | result_type | text | YES | - | - | No | No | - | - |
| public | search_history | result_title | text | YES | - | - | No | No | - | - |
| public | search_history | result_href | text | YES | - | - | No | No | - | - |
| public | search_history | clicked_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | standard_lifecycle_ai_feed | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | standard_lifecycle_ai_feed | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | standard_lifecycle_ai_feed | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | standard_lifecycle_ai_feed | operation_id | uuid | NO | - | - | No | Sí | public.tenant_operations.id | - |
| public | standard_lifecycle_ai_feed | event_type | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_ai_feed | content_text | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_ai_feed | payload | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | standard_lifecycle_ai_feed | is_processed | boolean (bool) | NO | false | - | No | No | - | - |
| public | standard_lifecycle_ai_feed | processed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | standard_lifecycle_ai_feed | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | standard_lifecycle_snapshots | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | standard_lifecycle_snapshots | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | standard_lifecycle_snapshots | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | standard_lifecycle_snapshots | operation_id | uuid | NO | - | - | No | Sí | public.tenant_operations.id | - |
| public | standard_lifecycle_snapshots | calculated_stage_code | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_snapshots | confirmed_stage_code | text | YES | - | - | No | No | - | - |
| public | standard_lifecycle_snapshots | effective_stage_code | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_snapshots | health_status | text | NO | - | - | No | No | - | estado |
| public | standard_lifecycle_snapshots | maturity_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | standard_lifecycle_snapshots | catalog_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | standard_lifecycle_snapshots | enabled_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | standard_lifecycle_snapshots | controls_enabled_pct | numeric | NO | 0 | 5 | No | No | - | control |
| public | standard_lifecycle_snapshots | controls_with_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | control, evidencia |
| public | standard_lifecycle_snapshots | evidence_coverage_pct | numeric | NO | 0 | 5 | No | No | - | evidencia |
| public | standard_lifecycle_snapshots | avg_health_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | standard_lifecycle_snapshots | open_nonconformities_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | standard_lifecycle_snapshots | open_findings_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | standard_lifecycle_snapshots | open_action_plans_count | integer (int4) | NO | 0 | 32 | No | No | - | plan de acción |
| public | standard_lifecycle_snapshots | open_audits_count | integer (int4) | NO | 0 | 32 | No | No | - | auditoría |
| public | standard_lifecycle_snapshots | last_activity_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | standard_lifecycle_snapshots | snapshot_date | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | standard_lifecycle_snapshots | metrics_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | standard_lifecycle_stage_requests | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | standard_lifecycle_stage_requests | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | standard_lifecycle_stage_requests | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | standard_lifecycle_stage_requests | operation_id | uuid | NO | - | - | No | Sí | public.tenant_operations.id | - |
| public | standard_lifecycle_stage_requests | from_stage_code | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | to_stage_code | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | request_status | text | NO | 'por_confirmar'::text | - | No | No | - | estado |
| public | standard_lifecycle_stage_requests | request_source | text | NO | 'manual_drag'::text | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | request_reason | text | YES | - | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | requested_by | uuid | YES | - | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | requested_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | reviewed_by | uuid | YES | - | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | review_comment | text | YES | - | - | No | No | - | - |
| public | standard_lifecycle_stage_requests | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | standard_lifecycle_stage_requests | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | standard_lifecycle_status | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | standard_lifecycle_status | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | standard_lifecycle_status | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | standard_lifecycle_status | operation_id | uuid | NO | - | - | No | Sí | public.tenant_operations.id | - |
| public | standard_lifecycle_status | calculated_stage_code | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_status | confirmed_stage_code | text | YES | - | - | No | No | - | - |
| public | standard_lifecycle_status | effective_stage_code | text | NO | - | - | No | No | - | - |
| public | standard_lifecycle_status | pending_stage_code | text | YES | - | - | No | No | - | - |
| public | standard_lifecycle_status | pending_request_id | uuid | YES | - | - | No | No | - | - |
| public | standard_lifecycle_status | pending_requested_by | uuid | YES | - | - | No | No | - | - |
| public | standard_lifecycle_status | pending_requested_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | standard_lifecycle_status | health_status | text | NO | 'atencion'::text | - | No | No | - | estado |
| public | standard_lifecycle_status | maturity_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | standard_lifecycle_status | catalog_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | standard_lifecycle_status | enabled_controls_count | integer (int4) | NO | 0 | 32 | No | No | - | control |
| public | standard_lifecycle_status | controls_enabled_pct | numeric | NO | 0 | 5 | No | No | - | control |
| public | standard_lifecycle_status | controls_with_evidence_count | integer (int4) | NO | 0 | 32 | No | No | - | control, evidencia |
| public | standard_lifecycle_status | evidence_coverage_pct | numeric | NO | 0 | 5 | No | No | - | evidencia |
| public | standard_lifecycle_status | avg_health_score | numeric | NO | 0 | 5 | No | No | - | - |
| public | standard_lifecycle_status | open_nonconformities_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | standard_lifecycle_status | open_findings_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | standard_lifecycle_status | open_action_plans_count | integer (int4) | NO | 0 | 32 | No | No | - | plan de acción |
| public | standard_lifecycle_status | open_audits_count | integer (int4) | NO | 0 | 32 | No | No | - | auditoría |
| public | standard_lifecycle_status | last_activity_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | standard_lifecycle_status | last_snapshot_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | standard_lifecycle_status | metrics_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | standard_lifecycle_status | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | standard_lifecycle_status | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | standards | id | integer (int4) | NO | nextval('standards_id_seq'::regclass) | 32 | Sí | No | - | - |
| public | standards | code | character varying (varchar) | NO | - | 50 | No | No | - | - |
| public | standards | name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | tcdx_async_jobs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tcdx_async_jobs | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tcdx_async_jobs | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tcdx_async_jobs | job_type | text | NO | - | - | No | No | - | - |
| public | tcdx_async_jobs | status | text | NO | 'queued'::text | - | No | No | - | estado |
| public | tcdx_async_jobs | priority | text | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | model_mode | text | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | source_module | text | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | request_payload_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | tcdx_async_jobs | result_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tcdx_async_jobs | result_file_id | uuid | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | result_file_url | text | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | result_download_url | text | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | error_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tcdx_async_jobs | request_id | text | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | started_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | completed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | expires_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tcdx_async_jobs | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tcdx_async_jobs | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicability_exclusions | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_applicability_exclusions | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_applicability_exclusions | object_type | text | NO | - | - | No | No | - | - |
| public | tenant_applicability_exclusions | object_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions | object_code | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions | object_name | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions | exclusion_reason | text | NO | - | - | No | No | - | - |
| public | tenant_applicability_exclusions | excluded_by | text | NO | 'profile_engine'::text | - | No | No | - | - |
| public | tenant_applicability_exclusions | profile_drivers | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_applicability_exclusions | active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicability_exclusions | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicability_exclusions | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicability_exclusions | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | cleanup_run_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | backed_up_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | object_type | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | object_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | object_code | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | object_name | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | exclusion_reason | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | excluded_by | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | profile_drivers | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | active | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicability_exclusions_cleanup_backup_20260525 | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_applicability_profiles | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_applicability_profiles | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_applicability_profiles | profile_source | character varying (varchar) | YES | - | - | No | No | - | - |
| public | tenant_applicability_profiles | profile_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_applicability_profiles | industry | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_profiles | subindustry | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_profiles | company_size | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_profiles | maturity_level | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_profiles | risk_appetite | text | YES | - | - | No | No | - | riesgo |
| public | tenant_applicability_profiles | active_standards | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_applicability_profiles | declared_scope | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_applicability_profiles | critical_processes | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_applicability_profiles | excluded_operations | jsonb | NO | '[]'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_applicability_profiles | generated_by | text | YES | - | - | No | No | - | - |
| public | tenant_applicability_profiles | ai_used | boolean (bool) | NO | false | - | No | No | - | - |
| public | tenant_applicability_profiles | web_used | boolean (bool) | NO | false | - | No | No | - | - |
| public | tenant_applicability_profiles | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicability_profiles | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicability_runs | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_applicability_runs | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_applicability_runs | status | text | NO | - | - | No | No | - | estado |
| public | tenant_applicability_runs | started_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_applicability_runs | completed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_applicability_runs | error_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tenant_applicability_runs | summary_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tenant_applicability_runs | trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tenant_applicability_runs | created_by | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | tenant_applicability_runs | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_controls | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_applicable_controls | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_applicable_controls | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | tenant_applicable_controls | control_catalog_id | uuid | YES | - | - | No | No | - | control |
| public | tenant_applicable_controls | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_applicable_controls | control_code | text | YES | - | - | No | No | - | control |
| public | tenant_applicable_controls | control_name | text | NO | - | - | No | No | - | control |
| public | tenant_applicable_controls | applicability_status | text | NO | 'applicable'::text | - | No | No | - | estado |
| public | tenant_applicable_controls | applicability_reason | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls | applicability_score | numeric | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls | priority | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls | profile_drivers | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_applicable_controls | calculation_weight | numeric | NO | 1 | - | No | No | - | - |
| public | tenant_applicable_controls | must_exist | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicable_controls | visible_to_tenant | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicable_controls | active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicable_controls | source | text | NO | 'profile_engine'::text | - | No | No | - | - |
| public | tenant_applicable_controls | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_controls | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_controls_cleanup_backup_20260525 | cleanup_run_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | backed_up_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | tenant_applicable_controls_cleanup_backup_20260525 | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | tenant_applicable_controls_cleanup_backup_20260525 | control_catalog_id | uuid | YES | - | - | No | No | - | control |
| public | tenant_applicable_controls_cleanup_backup_20260525 | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_applicable_controls_cleanup_backup_20260525 | control_code | text | YES | - | - | No | No | - | control |
| public | tenant_applicable_controls_cleanup_backup_20260525 | control_name | text | YES | - | - | No | No | - | control |
| public | tenant_applicable_controls_cleanup_backup_20260525 | applicability_status | text | YES | - | - | No | No | - | estado |
| public | tenant_applicable_controls_cleanup_backup_20260525 | applicability_reason | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | applicability_score | numeric | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | priority | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | profile_drivers | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tenant_applicable_controls_cleanup_backup_20260525 | calculation_weight | numeric | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | must_exist | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | visible_to_tenant | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | active | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | source | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_controls_cleanup_backup_20260525 | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_controls_cleanup_backup_20260525 | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_evidence_requirements | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_applicable_evidence_requirements | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_applicable_evidence_requirements | related_control_id | uuid | YES | - | - | No | No | - | control |
| public | tenant_applicable_evidence_requirements | related_kpi_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements | evidence_type | text | YES | - | - | No | No | - | evidencia |
| public | tenant_applicable_evidence_requirements | evidence_name | text | NO | - | - | No | No | - | evidencia |
| public | tenant_applicable_evidence_requirements | requirement_reason | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements | priority | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements | active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements | visible_to_tenant | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements | source | text | NO | 'profile_engine'::text | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_evidence_requirements | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_evidence_requirements | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_applicable_evidence_requirements | requirement_code | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | cleanup_run_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | backed_up_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | related_control_id | uuid | YES | - | - | No | No | - | control |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | related_kpi_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | evidence_type | text | YES | - | - | No | No | - | evidencia |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | evidence_name | text | YES | - | - | No | No | - | evidencia |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | requirement_reason | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | priority | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | active | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | visible_to_tenant | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | source | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_applicable_evidence_requirements_cleanup_backup_20260525 | requirement_code | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_applicable_kpis | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_applicable_kpis | kpi_definition_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis | kpi_code | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis | kpi_name | text | NO | - | - | No | No | - | - |
| public | tenant_applicable_kpis | applicability_status | text | NO | 'applicable'::text | - | No | No | - | estado |
| public | tenant_applicable_kpis | applicability_reason | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis | applicability_score | numeric | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis | priority | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis | calculation_weight | numeric | NO | 1 | - | No | No | - | - |
| public | tenant_applicable_kpis | visible_to_tenant | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicable_kpis | active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_applicable_kpis | source | text | NO | 'profile_engine'::text | - | No | No | - | - |
| public | tenant_applicable_kpis | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_kpis | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_kpis | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | cleanup_run_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | backed_up_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | kpi_definition_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | kpi_code | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | kpi_name | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | applicability_status | text | YES | - | - | No | No | - | estado |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | applicability_reason | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | applicability_score | numeric | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | priority | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | calculation_weight | numeric | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | visible_to_tenant | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | active | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | source | text | YES | - | - | No | No | - | - |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenant_applicable_kpis_cleanup_backup_20260525 | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_billing_settings | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_billing_settings | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_billing_settings | plan_code | text | NO | 'growth'::text | - | No | No | - | - |
| public | tenant_billing_settings | base_monthly_uf | numeric | NO | 8 | 12 | No | No | - | - |
| public | tenant_billing_settings | price_per_active_standard_uf | numeric | NO | 2 | 12 | No | No | - | - |
| public | tenant_billing_settings | price_per_active_module_uf | numeric | NO | 0.8 | 12 | No | No | - | - |
| public | tenant_billing_settings | included_ai_units | integer (int4) | NO | 100 | 32 | No | No | - | - |
| public | tenant_billing_settings | price_per_extra_ai_unit_uf | numeric | NO | 0.02 | 12 | No | No | - | - |
| public | tenant_billing_settings | currency | text | NO | 'UF'::text | - | No | No | - | - |
| public | tenant_billing_settings | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_billing_settings | created_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | tenant_billing_settings | updated_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | tenant_company_profiles | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_company_profiles | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_company_profiles | created_by_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | tenant_company_profiles | updated_by_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | tenant_company_profiles | profile_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_company_profiles | industry | text | YES | - | - | No | No | - | - |
| public | tenant_company_profiles | subindustry | text | YES | - | - | No | No | - | - |
| public | tenant_company_profiles | company_size | text | YES | - | - | No | No | - | - |
| public | tenant_company_profiles | maturity_level | text | YES | - | - | No | No | - | - |
| public | tenant_company_profiles | risk_appetite | text | YES | - | - | No | No | - | riesgo |
| public | tenant_company_profiles | allow_web_research | boolean (bool) | NO | false | - | No | No | - | - |
| public | tenant_company_profiles | allow_document_context | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_company_profiles | allow_ai_recommendations | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_company_profiles | context_document_file_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_company_profiles | context_document_url | text | YES | - | - | No | No | - | - |
| public | tenant_company_profiles | ai_profile_summary_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tenant_company_profiles | ai_research_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | tenant_company_profiles | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_company_profiles | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_contracts | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_contracts | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_contracts | plan_key | text | NO | 'demo'::text | - | No | No | - | - |
| public | tenant_contracts | contract_status | text | NO | 'active'::text | - | No | No | - | estado |
| public | tenant_contracts | started_at | date | YES | - | - | No | No | - | - |
| public | tenant_contracts | ends_at | date | YES | - | - | No | No | - | - |
| public | tenant_contracts | billing_notes | text | YES | - | - | No | No | - | - |
| public | tenant_contracts | commercial_owner_user_id | uuid | YES | - | - | No | Sí | public.users.id | usuario/responsable |
| public | tenant_contracts | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_contracts | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_contracts | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_contracts | billing_currency | text | NO | 'CLP'::text | - | No | No | - | - |
| public | tenant_contracts | commercial_notes | text | YES | - | - | No | No | - | - |
| public | tenant_contracts | crm_reference | text | YES | - | - | No | No | - | - |
| public | tenant_contracts | max_active_standards | integer (int4) | YES | - | 32 | No | No | - | - |
| public | tenant_contracts | max_premium_modules | integer (int4) | YES | - | 32 | No | No | - | - |
| public | tenant_contracts | external_lookup_quota | integer (int4) | YES | - | 32 | No | No | - | - |
| public | tenant_controls | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_controls | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_controls | control_id | uuid | YES | - | - | No | Sí | public.controls_catalog.id | control; Debe representar el control base del catálogo controls_catalog.id. |
| public | tenant_controls | status | text | YES | '-'::text | - | No | No | - | estado |
| public | tenant_controls | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_controls | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_controls | score | numeric | YES | 0 | 5 | No | No | - | - |
| public | tenant_controls | health_status | text | YES | 'sin_datos'::text | - | No | No | - | estado |
| public | tenant_controls | responsible_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_controls | last_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_controls | due_date | date | YES | - | - | No | No | - | - |
| public | tenant_controls | priority | text | YES | 'media'::text | - | No | No | - | - |
| public | tenant_controls | applicability | text | YES | 'aplicable'::text | - | No | No | - | - |
| public | tenant_controls | notes | text | YES | - | - | No | No | - | - |
| public | tenant_controls | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_controls | operation_id | uuid | NO | - | - | No | Sí | public.tenant_operations.id | - |
| public | tenant_document_provider_credentials | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | tenant_document_provider_credentials | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_document_provider_credentials | source_id | uuid | YES | - | - | No | Sí | public.tenant_document_sources.id | - |
| public | tenant_document_provider_credentials | provider | text | NO | - | - | No | No | - | - |
| public | tenant_document_provider_credentials | account_email | text | YES | - | - | No | No | - | - |
| public | tenant_document_provider_credentials | access_token_encrypted | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_document_provider_credentials | refresh_token_encrypted | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_document_provider_credentials | token_expires_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_document_provider_credentials | scopes | ARRAY (_text) | YES | - | - | No | No | - | - |
| public | tenant_document_provider_credentials | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_document_provider_credentials | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_document_provider_credentials | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_document_provider_credentials | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_document_sources | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | tenant_document_sources | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_document_sources | integration_id | uuid | YES | - | - | No | Sí | public.tenant_integrations.id | - |
| public | tenant_document_sources | provider | character varying (varchar) | NO | - | 80 | No | No | - | - |
| public | tenant_document_sources | source_name | character varying (varchar) | NO | - | 180 | No | No | - | - |
| public | tenant_document_sources | folder_id | character varying (varchar) | YES | - | 500 | No | No | - | - |
| public | tenant_document_sources | folder_path | text | YES | - | - | No | No | - | - |
| public | tenant_document_sources | sync_enabled | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_document_sources | scan_frequency | character varying (varchar) | NO | 'manual'::character varying | 40 | No | No | - | - |
| public | tenant_document_sources | last_sync_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_document_sources | created_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_document_sources | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_document_sources | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_document_sources | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_document_sources | status | text | NO | 'active'::text | - | No | No | - | estado |
| public | tenant_document_sources | folder_display_name | text | YES | - | - | No | No | - | - |
| public | tenant_document_sources | provider_account_email | text | YES | - | - | No | No | - | - |
| public | tenant_document_sources | provider_team_id | text | YES | - | - | No | No | - | - |
| public | tenant_document_sources | include_subfolders | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_document_sources | associated_standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | tenant_document_sources | last_sync_status | text | YES | - | - | No | No | - | estado |
| public | tenant_document_sources | last_sync_error | text | YES | - | - | No | No | - | - |
| public | tenant_document_sources | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_integrations | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | tenant_integrations | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_integrations | provider | character varying (varchar) | NO | - | 80 | No | No | - | - |
| public | tenant_integrations | status | character varying (varchar) | NO | 'prepared'::character varying | 40 | No | No | - | estado |
| public | tenant_integrations | display_name | character varying (varchar) | YES | - | 180 | No | No | - | - |
| public | tenant_integrations | connected_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_integrations | encrypted_access_token | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_integrations | encrypted_refresh_token | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_integrations | token_expires_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_integrations | scopes | text | YES | - | - | No | No | - | - |
| public | tenant_integrations | provider_account_email | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | tenant_integrations | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_integrations | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_integrations | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_integrations | last_sync_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_integrations | disconnected_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_kpi_settings | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_kpi_settings | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_kpi_settings | kpi_id | uuid | NO | - | - | No | Sí | public.kpi_definitions.id | - |
| public | tenant_kpi_settings | is_enabled | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_kpi_settings | override_frequency | USER-DEFINED (kpi_frequency_enum) | YES | - | - | No | No | - | - |
| public | tenant_kpi_settings | override_target_value | numeric | YES | - | 18 | No | No | - | - |
| public | tenant_kpi_settings | override_direction | USER-DEFINED (kpi_direction_enum) | YES | - | - | No | No | - | - |
| public | tenant_kpi_settings | override_thresholds_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_kpi_settings | custom_label | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | tenant_kpi_settings | custom_description | text | YES | - | - | No | No | - | - |
| public | tenant_kpi_settings | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_kpi_settings | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_module_settings | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_module_settings | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_module_settings | module_key | text | NO | - | - | No | Sí | public.saas_modules.module_key | - |
| public | tenant_module_settings | is_enabled | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_module_settings | enabled_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_module_settings | disabled_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_module_settings | enabled_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | tenant_module_settings | disabled_by | uuid | YES | - | - | No | Sí | public.users.id | - |
| public | tenant_module_settings | notes | text | YES | - | - | No | No | - | - |
| public | tenant_module_settings | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_module_settings | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_module_settings | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_monthly_preinvoices | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_monthly_preinvoices | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_monthly_preinvoices | period | text | NO | - | - | No | No | - | - |
| public | tenant_monthly_preinvoices | plan_code | text | YES | - | - | No | No | - | - |
| public | tenant_monthly_preinvoices | active_standards_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | tenant_monthly_preinvoices | active_modules_count | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | tenant_monthly_preinvoices | ai_units_used | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | tenant_monthly_preinvoices | ai_units_extra | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | tenant_monthly_preinvoices | base_monthly_uf | numeric | NO | 0 | 12 | No | No | - | - |
| public | tenant_monthly_preinvoices | standards_uf | numeric | NO | 0 | 12 | No | No | - | - |
| public | tenant_monthly_preinvoices | modules_uf | numeric | NO | 0 | 12 | No | No | - | - |
| public | tenant_monthly_preinvoices | ai_extra_uf | numeric | NO | 0 | 12 | No | No | - | - |
| public | tenant_monthly_preinvoices | total_uf | numeric | NO | 0 | 12 | No | No | - | - |
| public | tenant_monthly_preinvoices | detail_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | tenant_monthly_preinvoices | status | text | NO | 'draft'::text | - | No | No | - | estado |
| public | tenant_monthly_preinvoices | created_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | tenant_nonconformities | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_nonconformities | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | tenant_nonconformities | control_id | uuid | YES | - | - | No | No | - | control |
| public | tenant_nonconformities | nonconformity_id | uuid | YES | - | - | No | No | - | - |
| public | tenant_nonconformities | detected_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | - |
| public | tenant_nonconformities | status | text | YES | 'abierta'::text | - | No | No | - | estado |
| public | tenant_nonconformities | resolved_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_nonconformities | control_description | text | YES | - | - | No | No | - | control |
| public | tenant_operations | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_operations | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_operations | code | text | YES | - | - | No | No | - | - |
| public | tenant_operations | name | text | NO | - | - | No | No | - | - |
| public | tenant_operations | description | text | YES | - | - | No | No | - | - |
| public | tenant_operations | operation_type | text | NO | 'operacion'::text | - | No | No | - | - |
| public | tenant_operations | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_operations | is_default | boolean (bool) | NO | false | - | No | No | - | - |
| public | tenant_operations | sort_order | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | tenant_operations | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_operations | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_operations | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_standard_audit | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_standard_audit | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_standard_audit | standard_code | text | NO | - | - | No | No | - | norma ISO |
| public | tenant_standard_audit | action | text | NO | - | - | No | No | - | - |
| public | tenant_standard_audit | old_is_active | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_standard_audit | new_is_active | boolean (bool) | YES | - | - | No | No | - | - |
| public | tenant_standard_audit | changed_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_standard_audit | notes | text | YES | - | - | No | No | - | - |
| public | tenant_standard_audit | metadata | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_standard_audit | created_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_standard_operations | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_standard_operations | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_standard_operations | standard_code | text | NO | - | - | No | Sí | public.standards.code | norma ISO |
| public | tenant_standard_operations | operation_id | uuid | NO | - | - | No | Sí | public.tenant_operations.id | - |
| public | tenant_standard_operations | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_standard_operations | notes | text | YES | - | - | No | No | - | - |
| public | tenant_standard_operations | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_standard_operations | updated_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_standards | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenant_standards | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | tenant_standards | standard_code | text | NO | - | - | No | Sí | public.standards.code | norma ISO |
| public | tenant_standards | is_active | boolean (bool) | NO | true | - | No | No | - | - |
| public | tenant_standards | initialized_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_standards | created_at | timestamp without time zone (timestamp) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_standards | catalog_mode | text | NO | 'generic'::text | - | No | No | - | - |
| public | tenant_standards | contracted_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | - |
| public | tenant_standards | deactivated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_standards | updated_at | timestamp without time zone (timestamp) | YES | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_standards | lifecycle_status | text | NO | 'active'::text | - | No | No | - | estado |
| public | tenant_standards | paused_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_standards | permanently_deactivated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenant_sync_agent_pairing_codes | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | tenant_sync_agent_pairing_codes | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_sync_agent_pairing_codes | source_id | uuid | NO | - | - | No | Sí | public.tenant_document_sources.id | - |
| public | tenant_sync_agent_pairing_codes | code_hash | text | NO | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_sync_agent_pairing_codes | expires_at | timestamp with time zone (timestamptz) | NO | - | - | No | No | - | - |
| public | tenant_sync_agent_pairing_codes | used_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_sync_agent_pairing_codes | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_sync_agent_pairing_codes | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_sync_agents | id | uuid | NO | uuid_generate_v4() | - | Sí | No | - | - |
| public | tenant_sync_agents | tenant_id | uuid | NO | - | - | No | No | - | tenant scope |
| public | tenant_sync_agents | source_id | uuid | YES | - | - | No | Sí | public.tenant_document_sources.id | - |
| public | tenant_sync_agents | agent_name | text | YES | - | - | No | No | - | - |
| public | tenant_sync_agents | device_name | text | YES | - | - | No | No | - | - |
| public | tenant_sync_agents | device_fingerprint | text | YES | - | - | No | No | - | - |
| public | tenant_sync_agents | status | text | NO | 'pending'::text | - | No | No | - | estado |
| public | tenant_sync_agents | agent_token_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | tenant_sync_agents | last_seen_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | tenant_sync_agents | version | text | YES | - | - | No | No | - | - |
| public | tenant_sync_agents | metadata_json | jsonb | NO | '{}'::jsonb | - | No | No | - | metadata, json/jsonb |
| public | tenant_sync_agents | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenant_sync_agents | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenant_sync_agents | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | tenants | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | tenants | name | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | tenants | created_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | tenants | logo_url | text | YES | - | - | No | No | - | - |
| public | tenants | rut | text | NO | - | - | No | No | - | - |
| public | tenants | address | text | YES | - | - | No | No | - | - |
| public | tenants | business | text | YES | - | - | No | No | - | - |
| public | tenants | branches | text | YES | - | - | No | No | - | - |
| public | tenants | logo | text | YES | - | - | No | No | - | - |
| public | tenants | report_primary_color | text | YES | '#0B2F4F'::text | - | No | No | - | - |
| public | tenants | report_secondary_color | text | YES | '#22C55E'::text | - | No | No | - | - |
| public | tenants | report_rights_message | text | YES | - | - | No | No | - | - |
| public | tenants | report_privacy_message | text | YES | - | - | No | No | - | - |
| public | tenants | report_footer_text | text | YES | - | - | No | No | - | - |
| public | tenants | service_status | text | NO | 'active'::text | - | No | No | - | estado |
| public | tenants | suspended_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | tenants | suspended_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenants | suspension_reason | text | YES | - | - | No | No | - | - |
| public | tenants | deleted_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | tenants | deleted_by_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | tenants | deletion_reason | text | YES | - | - | No | No | - | - |
| public | tenants | ai_enabled | boolean (bool) | NO | false | - | No | No | - | - |
| public | tenants | ai_plan | text | NO | 'none'::text | - | No | No | - | - |
| public | tenants | ai_web_enabled | boolean (bool) | NO | false | - | No | No | - | - |
| public | tenants | ai_report_enabled | boolean (bool) | NO | false | - | No | No | - | - |
| public | tenants | ai_auditor_enabled | boolean (bool) | NO | false | - | No | No | - | auditoría |
| public | tenants | ai_monthly_quota | integer (int4) | YES | - | 32 | No | No | - | - |
| public | tenants | ai_quota_used | integer (int4) | NO | 0 | 32 | No | No | - | - |
| public | tenants | ai_features_json | jsonb | NO | '{"auditor": false, "suggestions": false, "web_research": false, "report_enrichment": false, "document_generation": false, "company_profile_... | - | No | No | - | json/jsonb |
| public | user_dashboard_preferences | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | user_dashboard_preferences | tenant_id | uuid | NO | - | - | No | Sí | public.tenants.id | tenant scope |
| public | user_dashboard_preferences | user_id | uuid | NO | - | - | No | Sí | public.users.id | usuario/responsable |
| public | user_dashboard_preferences | dashboard_key | text | NO | - | - | No | No | - | - |
| public | user_dashboard_preferences | layout_json | jsonb | NO | '{}'::jsonb | - | No | No | - | json/jsonb |
| public | user_dashboard_preferences | created_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | user_dashboard_preferences | updated_at | timestamp with time zone (timestamptz) | NO | now() | - | No | No | - | timestamp/auditoría |
| public | user_roles | user_id | uuid | NO | - | - | Sí | Sí | public.users.id | usuario/responsable |
| public | user_roles | role_id | integer (int4) | NO | - | 32 | Sí | Sí | public.roles.id | - |
| public | users | id | uuid | NO | gen_random_uuid() | - | Sí | No | - | - |
| public | users | tenant_id | uuid | YES | - | - | No | Sí | public.tenants.id | tenant scope |
| public | users | email | character varying (varchar) | NO | - | 255 | No | No | - | - |
| public | users | password_hash | text | NO | - | - | No | No | - | sensible por nombre: no leer valores |
| public | users | created_at | timestamp without time zone (timestamp) | YES | CURRENT_TIMESTAMP | - | No | No | - | timestamp/auditoría |
| public | users | full_name | text | YES | - | - | No | No | - | - |
| public | users | role | text | YES | 'user'::text | - | No | No | - | - |
| public | users | name | text | YES | - | - | No | No | - | - |
| public | users | phone | text | YES | - | - | No | No | - | - |
| public | users | job_title | text | YES | - | - | No | No | - | - |
| public | users | avatar | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | id | uuid | YES | - | - | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | users_backup_before_role_governance_20260417 | email | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | password_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | users_backup_before_role_governance_20260417 | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | users_backup_before_role_governance_20260417 | full_name | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | role | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | name | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | phone | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | job_title | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_governance_20260417 | avatar | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | id | uuid | YES | - | - | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | users_backup_before_role_normalization_20260430 | email | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | password_hash | text | YES | - | - | No | No | - | sensible por nombre: no leer valores |
| public | users_backup_before_role_normalization_20260430 | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | users_backup_before_role_normalization_20260430 | full_name | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | role | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | name | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | phone | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | job_title | text | YES | - | - | No | No | - | - |
| public | users_backup_before_role_normalization_20260430 | avatar | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | audit_event_id | uuid | YES | - | - | No | No | - | auditoría |
| public | v_audit_action_plan_timeline | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_audit_action_plan_timeline | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_audit_action_plan_timeline | action_plan_id | uuid | YES | - | - | No | No | - | plan de acción |
| public | v_audit_action_plan_timeline | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_audit_action_plan_timeline | iso_code | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | action_plan_title | text | YES | - | - | No | No | - | plan de acción |
| public | v_audit_action_plan_timeline | source_type | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | action | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | changed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | actor_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_audit_action_plan_timeline | event_label | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | event_description | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | old_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_action_plan_timeline | new_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_action_plan_timeline | old_priority | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | new_priority | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | old_owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | v_audit_action_plan_timeline | new_owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | v_audit_action_plan_timeline | old_due_date | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | new_due_date | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | old_completed_at | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | new_completed_at | text | YES | - | - | No | No | - | - |
| public | v_audit_action_plan_timeline | old_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_audit_action_plan_timeline | new_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_audit_action_plan_timeline | metadata | jsonb | YES | - | - | No | No | - | metadata, json/jsonb |
| public | v_audit_control_recovery_timeline | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_audit_control_recovery_timeline | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_audit_control_recovery_timeline | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_audit_control_recovery_timeline | action_plan_id | uuid | YES | - | - | No | No | - | plan de acción |
| public | v_audit_control_recovery_timeline | evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | v_audit_control_recovery_timeline | iso_code | text | YES | - | - | No | No | - | - |
| public | v_audit_control_recovery_timeline | clause | text | YES | - | - | No | No | - | - |
| public | v_audit_control_recovery_timeline | control_description | text | YES | - | - | No | No | - | control |
| public | v_audit_control_recovery_timeline | action_plan_title | text | YES | - | - | No | No | - | plan de acción |
| public | v_audit_control_recovery_timeline | file_name | text | YES | - | - | No | No | - | - |
| public | v_audit_control_recovery_timeline | evidence_approved_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | evidencia |
| public | v_audit_control_recovery_timeline | evidence_approved_by | uuid | YES | - | - | No | No | - | evidencia |
| public | v_audit_control_recovery_timeline | plan_completed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_audit_control_recovery_timeline | plan_completed_by | uuid | YES | - | - | No | No | - | - |
| public | v_audit_control_recovery_timeline | recovered_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_audit_control_recovery_timeline | event_label | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | id | uuid | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | table_name | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | record_id | uuid | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_audit_event_log_enriched | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_audit_event_log_enriched | action | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | changed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | changed_by | uuid | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | old_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_audit_event_log_enriched | new_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_audit_event_log_enriched | metadata | jsonb | YES | - | - | No | No | - | metadata, json/jsonb |
| public | v_audit_event_log_enriched | actor_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_audit_event_log_enriched | iso_code | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | action_plan_title | text | YES | - | - | No | No | - | plan de acción |
| public | v_audit_event_log_enriched | source_type | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_audit_event_log_enriched | finding_id | uuid | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | nonconformity_id | uuid | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | audit_id | uuid | YES | - | - | No | No | - | auditoría |
| public | v_audit_event_log_enriched | asset_id | uuid | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | old_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_event_log_enriched | new_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_event_log_enriched | old_priority | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | new_priority | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | old_owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | v_audit_event_log_enriched | new_owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | v_audit_event_log_enriched | old_due_date | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | new_due_date | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | old_completed_at | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | new_completed_at | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | file_name | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | file_path | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | evidence_description | text | YES | - | - | No | No | - | evidencia |
| public | v_audit_event_log_enriched | evidence_type | text | YES | - | - | No | No | - | evidencia |
| public | v_audit_event_log_enriched | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_audit_event_log_enriched | validated | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | reviewed_at | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | rejection_reason | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | metadata_action_plan_id | uuid | YES | - | - | No | No | - | plan de acción, metadata |
| public | v_audit_event_log_enriched | uploaded_from | text | YES | - | - | No | No | - | - |
| public | v_audit_event_log_enriched | last_review_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_event_log_enriched | metadata_iso | text | YES | - | - | No | No | - | metadata |
| public | v_audit_event_log_enriched | metadata_clause | text | YES | - | - | No | No | - | metadata |
| public | v_audit_event_log_enriched | metadata_control_description | text | YES | - | - | No | No | - | control, metadata |
| public | v_audit_evidence_timeline | audit_event_id | uuid | YES | - | - | No | No | - | auditoría |
| public | v_audit_evidence_timeline | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_audit_evidence_timeline | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_audit_evidence_timeline | evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | v_audit_evidence_timeline | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_audit_evidence_timeline | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_audit_evidence_timeline | action_plan_id | uuid | YES | - | - | No | No | - | plan de acción |
| public | v_audit_evidence_timeline | iso_code | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | clause | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | control_description | text | YES | - | - | No | No | - | control |
| public | v_audit_evidence_timeline | file_name | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | file_path | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | evidence_description | text | YES | - | - | No | No | - | evidencia |
| public | v_audit_evidence_timeline | evidence_type | text | YES | - | - | No | No | - | evidencia |
| public | v_audit_evidence_timeline | action | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | changed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | actor_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_audit_evidence_timeline | event_label | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | event_description | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | old_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_evidence_timeline | new_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_evidence_timeline | validated | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | reviewed_at | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | rejection_reason | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | uploaded_from | text | YES | - | - | No | No | - | - |
| public | v_audit_evidence_timeline | last_review_status | text | YES | - | - | No | No | - | estado |
| public | v_audit_evidence_timeline | old_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_audit_evidence_timeline | new_data | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_audit_evidence_timeline | metadata | jsonb | YES | - | - | No | No | - | metadata, json/jsonb |
| public | v_catalog_controls_without_iso_link | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_catalog_controls_without_iso_link | catalog_iso | text | YES | - | - | No | No | - | - |
| public | v_catalog_controls_without_iso_link | catalog_standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_catalog_controls_without_iso_link | clause | text | YES | - | - | No | No | - | - |
| public | v_catalog_controls_without_iso_link | category | text | YES | - | - | No | No | - | - |
| public | v_catalog_controls_without_iso_link | description | text | YES | - | - | No | No | - | - |
| public | v_catalog_controls_without_iso_link | source_type | text | YES | - | - | No | No | - | - |
| public | v_catalog_controls_without_iso_link | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_catalog_controls_without_iso_link | is_active | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_control_health_base | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_control_health_base | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_control_health_base | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_control_health_base | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_control_health_base | clause | text | YES | - | - | No | No | - | - |
| public | v_control_health_base | category | text | YES | - | - | No | No | - | - |
| public | v_control_health_base | control_description | text | YES | - | - | No | No | - | control |
| public | v_control_health_base | normalized_status | text | YES | - | - | No | No | - | estado |
| public | v_control_health_base | evidence_count | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_control_health_base | approved_evidence_count | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_control_health_base | pending_evidence_count | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_control_health_base | rejected_evidence_count | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_control_health_base | evidence_score | numeric | YES | - | - | No | No | - | evidencia |
| public | v_control_health_base | compliance_score | numeric | YES | - | - | No | No | - | - |
| public | v_control_health_base | findings_score | numeric | YES | - | - | No | No | - | - |
| public | v_control_health_base | risk_score | numeric | YES | - | - | No | No | - | riesgo |
| public | v_control_health_base | action_score | numeric | YES | - | - | No | No | - | - |
| public | v_control_health_base | review_score | numeric | YES | - | - | No | No | - | - |
| public | v_control_health_base | health_score | numeric | YES | - | - | No | No | - | - |
| public | v_control_health_base | health_status | text | YES | - | - | No | No | - | estado |
| public | v_control_health_detail | health_id | uuid | YES | - | - | No | No | - | - |
| public | v_control_health_detail | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_control_health_detail | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_control_health_detail | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_control_health_detail | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_control_health_detail | clause | text | YES | - | - | No | No | - | - |
| public | v_control_health_detail | category | text | YES | - | - | No | No | - | - |
| public | v_control_health_detail | control_description | text | YES | - | - | No | No | - | control |
| public | v_control_health_detail | control_status | text | YES | - | - | No | No | - | control, estado |
| public | v_control_health_detail | priority | text | YES | - | - | No | No | - | - |
| public | v_control_health_detail | applicability | text | YES | - | - | No | No | - | - |
| public | v_control_health_detail | responsible_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_control_health_detail | last_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_control_health_detail | due_date | date | YES | - | - | No | No | - | - |
| public | v_control_health_detail | health_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_detail | health_status | text | YES | - | - | No | No | - | estado |
| public | v_control_health_detail | evidence_score | numeric | YES | - | 5 | No | No | - | evidencia |
| public | v_control_health_detail | compliance_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_detail | findings_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_detail | risk_score | numeric | YES | - | 5 | No | No | - | riesgo |
| public | v_control_health_detail | action_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_detail | review_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_detail | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_detail | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_detail | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_detail | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_detail | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_detail | open_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_detail | overdue_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_detail | high_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_control_health_detail | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_control_health_risks | health_id | uuid | YES | - | - | No | No | - | - |
| public | v_control_health_risks | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_control_health_risks | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_control_health_risks | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_control_health_risks | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_control_health_risks | clause | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks | category | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks | control_description | text | YES | - | - | No | No | - | control |
| public | v_control_health_risks | control_status | text | YES | - | - | No | No | - | control, estado |
| public | v_control_health_risks | priority | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks | applicability | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks | responsible_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_control_health_risks | last_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_control_health_risks | due_date | date | YES | - | - | No | No | - | - |
| public | v_control_health_risks | health_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks | health_status | text | YES | - | - | No | No | - | estado |
| public | v_control_health_risks | evidence_score | numeric | YES | - | 5 | No | No | - | evidencia |
| public | v_control_health_risks | compliance_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks | findings_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks | risk_score | numeric | YES | - | 5 | No | No | - | riesgo |
| public | v_control_health_risks | action_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks | review_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_risks | open_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_risks | overdue_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_risks | high_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_control_health_risks | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | health_id | uuid | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_control_health_risks_applicable | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_control_health_risks_applicable | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_control_health_risks_applicable | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_control_health_risks_applicable | clause | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | category | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | control_description | text | YES | - | - | No | No | - | control |
| public | v_control_health_risks_applicable | control_status | text | YES | - | - | No | No | - | control, estado |
| public | v_control_health_risks_applicable | priority | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | applicability | text | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | responsible_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_control_health_risks_applicable | last_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | due_date | date | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | health_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks_applicable | health_status | text | YES | - | - | No | No | - | estado |
| public | v_control_health_risks_applicable | evidence_score | numeric | YES | - | 5 | No | No | - | evidencia |
| public | v_control_health_risks_applicable | compliance_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks_applicable | findings_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks_applicable | risk_score | numeric | YES | - | 5 | No | No | - | riesgo |
| public | v_control_health_risks_applicable | action_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks_applicable | review_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_control_health_risks_applicable | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks_applicable | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks_applicable | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks_applicable | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_control_health_risks_applicable | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_risks_applicable | open_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_risks_applicable | overdue_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_risks_applicable | high_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_control_health_risks_applicable | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | applicability_match_priority | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_control_health_risks_applicable | applicability_universe_applied | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | filtered_by_applicability_universe | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | tenant_filter_enforced | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | filtered_by_tenant_id | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_control_health_risks_applicable | rn | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_controls_recovered_by_remediation | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_controls_recovered_by_remediation | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_controls_recovered_by_remediation | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_controls_recovered_by_remediation | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_controls_recovered_by_remediation | clause | text | YES | - | - | No | No | - | - |
| public | v_controls_recovered_by_remediation | control_description | text | YES | - | - | No | No | - | control |
| public | v_controls_recovered_by_remediation | health_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_controls_recovered_by_remediation | health_status | text | YES | - | - | No | No | - | estado |
| public | v_controls_recovered_by_remediation | evidence_score | numeric | YES | - | 5 | No | No | - | evidencia |
| public | v_controls_recovered_by_remediation | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_controls_recovered_by_remediation | action_plan_id | uuid | YES | - | - | No | No | - | plan de acción |
| public | v_controls_recovered_by_remediation | action_plan_title | text | YES | - | - | No | No | - | plan de acción |
| public | v_controls_recovered_by_remediation | completed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_controls_recovered_by_remediation | latest_evidence_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | evidencia |
| public | v_controls_without_evidence | health_id | uuid | YES | - | - | No | No | - | - |
| public | v_controls_without_evidence | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_controls_without_evidence | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_controls_without_evidence | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_controls_without_evidence | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_controls_without_evidence | clause | text | YES | - | - | No | No | - | - |
| public | v_controls_without_evidence | category | text | YES | - | - | No | No | - | - |
| public | v_controls_without_evidence | control_description | text | YES | - | - | No | No | - | control |
| public | v_controls_without_evidence | control_status | text | YES | - | - | No | No | - | control, estado |
| public | v_controls_without_evidence | priority | text | YES | - | - | No | No | - | - |
| public | v_controls_without_evidence | applicability | text | YES | - | - | No | No | - | - |
| public | v_controls_without_evidence | responsible_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_controls_without_evidence | last_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_controls_without_evidence | due_date | date | YES | - | - | No | No | - | - |
| public | v_controls_without_evidence | health_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_controls_without_evidence | health_status | text | YES | - | - | No | No | - | estado |
| public | v_controls_without_evidence | evidence_score | numeric | YES | - | 5 | No | No | - | evidencia |
| public | v_controls_without_evidence | compliance_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_controls_without_evidence | findings_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_controls_without_evidence | risk_score | numeric | YES | - | 5 | No | No | - | riesgo |
| public | v_controls_without_evidence | action_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_controls_without_evidence | review_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_controls_without_evidence | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_controls_without_evidence | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_controls_without_evidence | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_controls_without_evidence | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_controls_without_evidence | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_controls_without_evidence | open_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_controls_without_evidence | overdue_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_controls_without_evidence | high_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_controls_without_evidence | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | id | uuid | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | dealer_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_dealer_tenants | dealer_name | text | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | dealer_email | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_dealer_tenants | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_dealer_tenants | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_dealer_tenants | relationship_type | text | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | can_view_health | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | can_view_contract | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | can_request_changes | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | can_view_sensitive_evidence | boolean (bool) | YES | - | - | No | No | - | evidencia |
| public | v_dealer_tenants | status | text | YES | - | - | No | No | - | estado |
| public | v_dealer_tenants | assigned_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | revoked_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_dealer_tenants | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_dealer_tenants | updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_evidence_approval_queue | evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | v_evidence_approval_queue | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_evidence_approval_queue | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_evidence_approval_queue | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_evidence_approval_queue | control_id | uuid | YES | - | - | No | No | - | control |
| public | v_evidence_approval_queue | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_evidence_approval_queue | clause | text | YES | - | - | No | No | - | - |
| public | v_evidence_approval_queue | control_description | text | YES | - | - | No | No | - | control |
| public | v_evidence_approval_queue | evidence_description | text | YES | - | - | No | No | - | evidencia |
| public | v_evidence_approval_queue | file_name | text | YES | - | - | No | No | - | - |
| public | v_evidence_approval_queue | file_path | text | YES | - | - | No | No | - | - |
| public | v_evidence_approval_queue | status | text | YES | - | - | No | No | - | estado |
| public | v_evidence_approval_queue | validated | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_evidence_approval_queue | evidence_type | text | YES | - | - | No | No | - | evidencia |
| public | v_evidence_approval_queue | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_evidence_approval_queue | expires_at | date | YES | - | - | No | No | - | - |
| public | v_evidence_approval_queue | action_plan_id | text | YES | - | - | No | No | - | plan de acción |
| public | v_evidence_approval_queue | action_plan_title | text | YES | - | - | No | No | - | plan de acción |
| public | v_evidence_approval_queue | action_plan_status | text | YES | - | - | No | No | - | plan de acción, estado |
| public | v_evidence_approval_queue | action_plan_priority | text | YES | - | - | No | No | - | plan de acción |
| public | v_health_dashboard_by_standard | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_dashboard_by_standard | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_dashboard_by_standard | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_health_dashboard_by_standard | standard_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_dashboard_by_standard | total_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_by_standard | healthy_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_by_standard | attention_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_by_standard | deteriorated_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_by_standard | critical_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_by_standard | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard | standard_health_status | text | YES | - | - | No | No | - | estado |
| public | v_health_dashboard_by_standard | healthy_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard | controls_with_evidence_percentage | numeric | YES | - | - | No | No | - | control, evidencia |
| public | v_health_dashboard_by_standard | total_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_by_standard | approved_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_by_standard | pending_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_by_standard | rejected_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_by_standard | kpi_standard_health_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_health_dashboard_by_standard | kpi_standard_health_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard | kpi_evidence_coverage_value | numeric | YES | - | 18 | No | No | - | evidencia |
| public | v_health_dashboard_by_standard | kpi_evidence_coverage_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | evidencia |
| public | v_health_dashboard_by_standard | kpi_deteriorated_controls_value | numeric | YES | - | 18 | No | No | - | control |
| public | v_health_dashboard_by_standard | kpi_deteriorated_controls_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | control |
| public | v_health_dashboard_by_standard | last_calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_dashboard_by_standard_applicable | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_health_dashboard_by_standard_applicable | standard_name | character varying (varchar) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | total_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_by_standard_applicable | healthy_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_by_standard_applicable | attention_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_by_standard_applicable | deteriorated_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_by_standard_applicable | critical_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_by_standard_applicable | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | healthy_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | controls_with_evidence_percentage | numeric | YES | - | - | No | No | - | control, evidencia |
| public | v_health_dashboard_by_standard_applicable | kpi_standard_health_value | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | kpi_standard_health_color | text | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | kpi_evidence_coverage_value | numeric | YES | - | - | No | No | - | evidencia |
| public | v_health_dashboard_by_standard_applicable | kpi_evidence_coverage_color | text | YES | - | - | No | No | - | evidencia |
| public | v_health_dashboard_by_standard_applicable | kpi_deteriorated_controls_value | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_by_standard_applicable | kpi_deteriorated_controls_color | text | YES | - | - | No | No | - | control |
| public | v_health_dashboard_by_standard_applicable | standard_health_status | text | YES | - | - | No | No | - | estado |
| public | v_health_dashboard_by_standard_applicable | applicability_universe_applied | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | filtered_by_applicability_universe | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | tenant_filter_enforced | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_by_standard_applicable | filtered_by_tenant_id | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_dashboard_summary | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_dashboard_summary | total_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_summary | healthy_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_summary | attention_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_summary | deteriorated_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_summary | critical_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_dashboard_summary | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary | tenant_health_status | text | YES | - | - | No | No | - | estado |
| public | v_health_dashboard_summary | healthy_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary | controls_with_evidence_percentage | numeric | YES | - | - | No | No | - | control, evidencia |
| public | v_health_dashboard_summary | total_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_summary | approved_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_summary | pending_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_summary | rejected_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_dashboard_summary | kpi_health_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_health_dashboard_summary | kpi_health_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary | kpi_evidence_coverage_value | numeric | YES | - | 18 | No | No | - | evidencia |
| public | v_health_dashboard_summary | kpi_evidence_coverage_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | evidencia |
| public | v_health_dashboard_summary | kpi_deteriorated_controls_value | numeric | YES | - | 18 | No | No | - | control |
| public | v_health_dashboard_summary | kpi_deteriorated_controls_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | control |
| public | v_health_dashboard_summary | last_calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_dashboard_summary_applicable | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_dashboard_summary_applicable | total_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_summary_applicable | healthy_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_summary_applicable | attention_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_summary_applicable | deteriorated_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_summary_applicable | critical_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_summary_applicable | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | healthy_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | controls_with_evidence_percentage | numeric | YES | - | - | No | No | - | control, evidencia |
| public | v_health_dashboard_summary_applicable | total_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_dashboard_summary_applicable | approved_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_dashboard_summary_applicable | pending_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_dashboard_summary_applicable | rejected_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_dashboard_summary_applicable | kpi_health_value | numeric | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | kpi_health_color | text | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | kpi_evidence_coverage_value | numeric | YES | - | - | No | No | - | evidencia |
| public | v_health_dashboard_summary_applicable | kpi_evidence_coverage_color | text | YES | - | - | No | No | - | evidencia |
| public | v_health_dashboard_summary_applicable | kpi_deteriorated_controls_value | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_health_dashboard_summary_applicable | kpi_deteriorated_controls_color | text | YES | - | - | No | No | - | control |
| public | v_health_dashboard_summary_applicable | last_calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | tenant_health_status | text | YES | - | - | No | No | - | estado |
| public | v_health_dashboard_summary_applicable | applicability_universe_applied | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | filtered_by_applicability_universe | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | tenant_filter_enforced | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_dashboard_summary_applicable | filtered_by_tenant_id | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_remediation_plan | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_remediation_plan | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_health_remediation_plan | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_health_remediation_plan | clause | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | category | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | control_description | text | YES | - | - | No | No | - | control |
| public | v_health_remediation_plan | control_status | text | YES | - | - | No | No | - | control, estado |
| public | v_health_remediation_plan | control_priority | text | YES | - | - | No | No | - | control |
| public | v_health_remediation_plan | applicability | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | health_score | numeric | YES | - | 5 | No | No | - | - |
| public | v_health_remediation_plan | health_status | text | YES | - | - | No | No | - | estado |
| public | v_health_remediation_plan | evidence_score | numeric | YES | - | - | No | No | - | evidencia |
| public | v_health_remediation_plan | compliance_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | findings_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | action_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | risk_score | numeric | YES | - | - | No | No | - | riesgo |
| public | v_health_remediation_plan | review_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_remediation_plan | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_remediation_plan | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_remediation_plan | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_health_remediation_plan | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_health_remediation_plan | open_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_health_remediation_plan | overdue_actions_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_health_remediation_plan | high_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_health_remediation_plan | main_gap_key | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | main_gap_label | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | main_deficit_value | numeric | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | remediation_priority | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | remediation_priority_order | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_health_remediation_plan | suggested_action_type | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | suggested_owner_role | text | YES | - | - | No | No | - | usuario/responsable |
| public | v_health_remediation_plan | suggested_due_days | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_health_remediation_plan | suggested_action_title | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | suggested_action_description | text | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | suggested_due_date | date | YES | - | - | No | No | - | - |
| public | v_health_remediation_plan | recommendation_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_health_remediation_plan | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_health_remediation_summary_by_standard | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_remediation_summary_by_standard | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_health_remediation_summary_by_standard | total_suggested_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | urgent_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | high_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | medium_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | evidence_actions | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_remediation_summary_by_standard | compliance_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | findings_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | action_followup_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | risk_actions | bigint (int8) | YES | - | 64 | No | No | - | riesgo |
| public | v_health_remediation_summary_by_standard | review_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_standard | avg_affected_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_remediation_summary_by_standard | nearest_due_date | date | YES | - | - | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_remediation_summary_by_tenant | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | total_suggested_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | urgent_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | high_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | medium_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | evidence_actions | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_remediation_summary_by_tenant | compliance_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | findings_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | action_followup_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | risk_actions | bigint (int8) | YES | - | 64 | No | No | - | riesgo |
| public | v_health_remediation_summary_by_tenant | review_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | avg_affected_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | nearest_due_date | date | YES | - | - | No | No | - | - |
| public | v_health_remediation_summary_by_tenant | main_gap_summary_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_health_root_causes_by_standard | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_root_causes_by_standard | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_root_causes_by_standard | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_health_root_causes_by_standard | standard_name | character varying (varchar) | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_standard | total_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_standard | healthy_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | attention_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | deteriorated_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | critical_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | controls_with_evidence_gap | bigint (int8) | YES | - | 64 | No | No | - | control, evidencia |
| public | v_health_root_causes_by_standard | controls_with_compliance_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | controls_with_findings_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | controls_with_action_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | controls_with_risk_gap | bigint (int8) | YES | - | 64 | No | No | - | control, riesgo |
| public | v_health_root_causes_by_standard | controls_with_review_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_standard | avg_evidence_score | numeric | YES | - | - | No | No | - | evidencia |
| public | v_health_root_causes_by_standard | avg_compliance_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_standard | avg_findings_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_standard | avg_action_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_standard | avg_risk_score | numeric | YES | - | - | No | No | - | riesgo |
| public | v_health_root_causes_by_standard | avg_review_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_standard | main_cause_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_health_root_causes_by_standard | causes_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_health_root_causes_by_tenant | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_health_root_causes_by_tenant | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_health_root_causes_by_tenant | total_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_tenant | healthy_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | attention_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | deteriorated_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | critical_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | controls_with_evidence_gap | bigint (int8) | YES | - | 64 | No | No | - | control, evidencia |
| public | v_health_root_causes_by_tenant | controls_with_compliance_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | controls_with_findings_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | controls_with_action_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | controls_with_risk_gap | bigint (int8) | YES | - | 64 | No | No | - | control, riesgo |
| public | v_health_root_causes_by_tenant | controls_with_review_gap | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_health_root_causes_by_tenant | avg_evidence_score | numeric | YES | - | - | No | No | - | evidencia |
| public | v_health_root_causes_by_tenant | avg_compliance_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_tenant | avg_findings_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_tenant | avg_action_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_tenant | avg_risk_score | numeric | YES | - | - | No | No | - | riesgo |
| public | v_health_root_causes_by_tenant | avg_review_score | numeric | YES | - | - | No | No | - | - |
| public | v_health_root_causes_by_tenant | total_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_root_causes_by_tenant | approved_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_root_causes_by_tenant | pending_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_root_causes_by_tenant | rejected_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_health_root_causes_by_tenant | open_findings | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_root_causes_by_tenant | open_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_root_causes_by_tenant | overdue_actions | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_health_root_causes_by_tenant | high_risks | bigint (int8) | YES | - | 64 | No | No | - | riesgo |
| public | v_health_root_causes_by_tenant | main_cause_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_health_root_causes_by_tenant | causes_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_health_root_causes_by_tenant | executive_recommendation | text | YES | - | - | No | No | - | - |
| public | v_iso_catalog_sync_summary | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_catalog_sync_summary | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_catalog_sync_summary | sync_target | text | YES | - | - | No | No | - | - |
| public | v_iso_catalog_sync_summary | sync_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_catalog_sync_summary | linked_controls_count | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_catalog_sync_summary | total_iso_controls_count | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_catalog_sync_summary | coverage_pct | numeric | YES | - | - | No | No | - | - |
| public | v_iso_catalog_sync_summary | notes | text | YES | - | - | No | No | - | - |
| public | v_iso_catalog_sync_summary | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_control_catalog_coverage | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_control_catalog_coverage | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_control_catalog_coverage | total_iso_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_control_catalog_coverage | linked_iso_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_control_catalog_coverage | unlinked_iso_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_control_catalog_coverage | linked_catalog_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_control_catalog_coverage | coverage_pct | numeric | YES | - | - | No | No | - | - |
| public | v_iso_control_catalog_coverage | equivalent_links | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_catalog_coverage | partial_links | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_catalog_coverage | related_links | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_catalog_coverage | transition_links | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_catalog_coverage | needs_review_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_iso_control_effective_health | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_control_effective_health | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_iso_control_effective_health | operation_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | operation_name | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | operation_code | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | operation_type | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | operation_is_default | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | iso | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | clause | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | category | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | control_description | text | YES | - | - | No | No | - | control |
| public | v_iso_control_effective_health | source_type | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | declared_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_control_effective_health | declared_score | numeric | YES | - | 10 | No | No | - | - |
| public | v_iso_control_effective_health | stored_health_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_control_effective_health | applicability | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | priority | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | responsible_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_iso_control_effective_health | last_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | due_date | date | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_control_effective_health | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health | official_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health | last_evidence_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | evidencia |
| public | v_iso_control_effective_health | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health | total_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health | last_finding_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | open_nonconformities_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health | total_nonconformities_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health | last_nonconformity_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | open_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_control_effective_health | overdue_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_control_effective_health | total_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_control_effective_health | last_action_plan_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | plan de acción |
| public | v_iso_control_effective_health | is_in_active_operational_scope | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | effective_health_score | numeric | YES | - | 10 | No | No | - | - |
| public | v_iso_control_effective_health | effective_health_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_control_effective_health | compliance_bucket | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health | evidence_quality_status | text | YES | - | - | No | No | - | evidencia, estado |
| public | v_iso_control_effective_health | health_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_control_effective_health_applicable | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_iso_control_effective_health_applicable | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_control_effective_health_applicable | catalog_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_iso_control_effective_health_applicable | operation_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | operation_name | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | operation_code | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | operation_type | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | operation_is_default | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | iso | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | clause | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | category | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | control_description | text | YES | - | - | No | No | - | control |
| public | v_iso_control_effective_health_applicable | source_type | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | declared_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_control_effective_health_applicable | declared_score | numeric | YES | - | 10 | No | No | - | - |
| public | v_iso_control_effective_health_applicable | stored_health_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_control_effective_health_applicable | applicability | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | priority | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | responsible_user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_iso_control_effective_health_applicable | last_reviewed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | due_date | date | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_control_effective_health_applicable | evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health_applicable | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health_applicable | pending_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health_applicable | rejected_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health_applicable | official_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_control_effective_health_applicable | last_evidence_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | evidencia |
| public | v_iso_control_effective_health_applicable | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health_applicable | total_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health_applicable | last_finding_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | open_nonconformities_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health_applicable | total_nonconformities_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_control_effective_health_applicable | last_nonconformity_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | open_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_control_effective_health_applicable | overdue_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_control_effective_health_applicable | total_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_control_effective_health_applicable | last_action_plan_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | plan de acción |
| public | v_iso_control_effective_health_applicable | is_in_active_operational_scope | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | effective_health_score | numeric | YES | - | 10 | No | No | - | - |
| public | v_iso_control_effective_health_applicable | effective_health_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_control_effective_health_applicable | compliance_bucket | text | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | evidence_quality_status | text | YES | - | - | No | No | - | evidencia, estado |
| public | v_iso_control_effective_health_applicable | health_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_control_effective_health_applicable | applicability_universe_applied | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | filtered_by_applicability_universe | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | tenant_filter_enforced | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | filtered_by_tenant_id | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_control_effective_health_applicable | rn | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_iso_controls_without_catalog_link | iso_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_iso_controls_without_catalog_link | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_controls_without_catalog_link | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_controls_without_catalog_link | control_code | text | YES | - | - | No | No | - | control |
| public | v_iso_controls_without_catalog_link | title | text | YES | - | - | No | No | - | - |
| public | v_iso_controls_without_catalog_link | clause_code | text | YES | - | - | No | No | - | - |
| public | v_iso_controls_without_catalog_link | domain | text | YES | - | - | No | No | - | - |
| public | v_iso_controls_without_catalog_link | default_priority | text | YES | - | - | No | No | - | - |
| public | v_iso_document_summary_by_tenant | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_document_summary_by_tenant | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_document_summary_by_tenant | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_document_summary_by_tenant | total_documents | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_document_summary_by_tenant | policies_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_document_summary_by_tenant | procedures_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_document_summary_by_tenant | approved_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_document_summary_by_tenant | draft_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_document_summary_by_tenant | archived_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_document_summary_by_tenant | last_generated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_effective_kpi_summary | iso | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | operation_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | operation_name | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | operation_code | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | operation_type | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | total_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | active_scope_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | out_of_scope_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | complies_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | partial_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | non_compliant_or_no_data_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | healthy_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | attention_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | deteriorated_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary | controls_with_official_evidence | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_effective_kpi_summary | controls_with_approved_non_official_evidence | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_effective_kpi_summary | controls_without_evidence | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_effective_kpi_summary | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_effective_kpi_summary | official_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_effective_kpi_summary | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_effective_kpi_summary | open_nonconformities_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_effective_kpi_summary | open_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_effective_kpi_summary | overdue_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_effective_kpi_summary | avg_effective_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | compliance_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary | official_evidence_percentage | numeric | YES | - | - | No | No | - | evidencia |
| public | v_iso_effective_kpi_summary | kpi_health_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_effective_kpi_summary | kpi_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_effective_kpi_summary_applicable | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_effective_kpi_summary_applicable | iso | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | operation_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | operation_name | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | operation_code | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | operation_type | text | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | total_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | active_scope_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | out_of_scope_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | complies_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | partial_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | non_compliant_or_no_data_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | healthy_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | attention_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | deteriorated_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_effective_kpi_summary_applicable | controls_with_official_evidence | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_effective_kpi_summary_applicable | controls_with_approved_non_official_evidence | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_effective_kpi_summary_applicable | controls_without_evidence | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_effective_kpi_summary_applicable | approved_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_effective_kpi_summary_applicable | official_evidence_count | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_effective_kpi_summary_applicable | open_findings_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | open_nonconformities_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | open_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_effective_kpi_summary_applicable | overdue_action_plans_count | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_effective_kpi_summary_applicable | avg_effective_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | compliance_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | official_evidence_percentage | numeric | YES | - | - | No | No | - | evidencia |
| public | v_iso_effective_kpi_summary_applicable | kpi_health_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_effective_kpi_summary_applicable | kpi_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_effective_kpi_summary_applicable | applicability_universe_applied | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | filtered_by_applicability_universe | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | tenant_filter_enforced | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_effective_kpi_summary_applicable | filtered_by_tenant_id | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_express_gap_summary | assessment_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_express_gap_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_express_gap_summary | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_express_gap_summary | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_express_gap_summary | gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_gap_summary | critical_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_gap_summary | high_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_gap_summary | medium_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_gap_summary | low_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_latest_assessments | id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_express_latest_assessments | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_express_latest_assessments | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | assessment_type | text | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | assessment_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_express_latest_assessments | requested_by | uuid | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | source | text | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | certifiable_version | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | coverage_warning | text | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | readiness_score | numeric | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | readiness_level | text | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | total_iso_controls | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_express_latest_assessments | mapped_controls_count | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_express_latest_assessments | evaluated_controls_count | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_iso_express_latest_assessments | controls_with_evidence_count | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_express_latest_assessments | controls_without_evidence_count | integer (int4) | YES | - | 32 | No | No | - | control, evidencia |
| public | v_iso_express_latest_assessments | gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_latest_assessments | critical_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_latest_assessments | high_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_latest_assessments | medium_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_latest_assessments | low_gaps_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_express_latest_assessments | risk_score | numeric | YES | - | - | No | No | - | riesgo |
| public | v_iso_express_latest_assessments | maturity_score | numeric | YES | - | - | No | No | - | - |
| public | v_iso_express_latest_assessments | plan_30_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_express_latest_assessments | plan_60_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_express_latest_assessments | plan_90_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_express_latest_assessments | summary_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_express_latest_assessments | input_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_express_latest_assessments | result_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_express_latest_assessments | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_express_latest_assessments | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_express_latest_assessments | completed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_express_tenant_standard_readiness | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_express_tenant_standard_readiness | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_express_tenant_standard_readiness | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_express_tenant_standard_readiness | certifiable | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_express_tenant_standard_readiness | publication_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_express_tenant_standard_readiness | tenant_standard_active | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_express_tenant_standard_readiness | catalog_coverage_pct | numeric | YES | - | - | No | No | - | - |
| public | v_iso_express_tenant_standard_readiness | sync_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_express_tenant_standard_readiness | recommended_assessment_type | text | YES | - | - | No | No | - | - |
| public | v_iso_express_tenant_standard_readiness | warning_text | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_generated_documents_latest | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_generated_documents_latest | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | document_type | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | template_code | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | template_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | source_assessment_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | title | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | document_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_generated_documents_latest | version | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_generated_documents_latest | language | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | generated_by | uuid | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | approved_by | uuid | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | approved_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | archived_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | archived_by | uuid | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | content_markdown | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | content_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_generated_documents_latest | variables_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_generated_documents_latest | source_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_generated_documents_latest | ai_used | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | ai_trace_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | disclaimer | text | YES | - | - | No | No | - | - |
| public | v_iso_generated_documents_latest | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_generated_documents_latest | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_operational_suggestions_queue | id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_operational_suggestions_queue | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_operational_suggestions_queue | operation_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | v_iso_operational_suggestions_queue | source_module | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | source_entity_type | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | source_entity_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | source_reason | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | suggestion_type | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | target_record_type | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | title | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | description | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | rationale | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | priority | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | status | text | YES | - | - | No | No | - | estado |
| public | v_iso_operational_suggestions_queue | dedupe_key | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | suggested_owner | text | YES | - | - | No | No | - | usuario/responsable |
| public | v_iso_operational_suggestions_queue | suggested_due_date | date | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | payload_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_operational_suggestions_queue | source_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_operational_suggestions_queue | ai_trace_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | created_by | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_iso_operational_suggestions_queue | approved_by | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | approved_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | rejected_by | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | rejected_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | rejection_comment | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | created_record_type | text | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | created_record_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_operational_suggestions_queue | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_operational_suggestions_queue | resolved_operation_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_operational_suggestions_queue | control_iso | text | YES | - | - | No | No | - | control |
| public | v_iso_operational_suggestions_queue | control_clause | text | YES | - | - | No | No | - | control |
| public | v_iso_operational_suggestions_queue | control_category | text | YES | - | - | No | No | - | control |
| public | v_iso_operational_suggestions_queue | control_description | text | YES | - | - | No | No | - | control |
| public | v_iso_operational_suggestions_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_operational_suggestions_summary | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_operational_suggestions_summary | total_suggestions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | pending_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | approved_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | rejected_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | critical_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | high_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | medium_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | low_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | action_plan_targets | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_iso_operational_suggestions_summary | finding_targets | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | nonconformity_targets | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_operational_suggestions_summary | evidence_request_targets | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_iso_operational_suggestions_summary | latest_suggestion_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_risk_matrix_actions_summary | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_risk_matrix_actions_summary | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | run_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | suggested_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | critical_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | high_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | medium_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | accepted_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_risk_matrix_actions_summary | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_risk_matrix_by_asset | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_risk_matrix_by_asset | asset_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_by_asset | asset_name | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_by_asset | asset_type | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_by_asset | asset_criticality | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_by_asset | total_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_by_asset | max_residual_risk_score | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_by_asset | highest_risk_level | text | YES | - | - | No | No | - | riesgo |
| public | v_iso_risk_matrix_by_asset | open_suggested_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | run_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_risk_matrix_latest_runs | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_risk_matrix_latest_runs | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | source_assessment_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | run_type | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | run_status | text | YES | - | - | No | No | - | estado |
| public | v_iso_risk_matrix_latest_runs | certifiable_version | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | coverage_warning | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | total_assets | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_iso_risk_matrix_latest_runs | total_risk_templates | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | suggested_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | accepted_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | rejected_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | critical_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | high_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | medium_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | low_risks_count | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | inherent_risk_avg | numeric | YES | - | - | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | residual_risk_avg | numeric | YES | - | - | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | risk_posture | text | YES | - | - | No | No | - | riesgo |
| public | v_iso_risk_matrix_latest_runs | summary_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_iso_risk_matrix_latest_runs | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_risk_matrix_latest_runs | updated_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_iso_risk_matrix_latest_runs | completed_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_iso_risk_matrix_summary | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_iso_risk_matrix_summary | version_code | text | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_summary | run_id | uuid | YES | - | - | No | No | - | - |
| public | v_iso_risk_matrix_summary | total_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | critical_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | high_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | medium_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | low_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | accepted_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | suggested_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | needs_review_risks | integer (int4) | YES | - | 32 | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | inherent_risk_avg | numeric | YES | - | - | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | residual_risk_avg | numeric | YES | - | - | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | risk_posture | text | YES | - | - | No | No | - | riesgo |
| public | v_iso_risk_matrix_summary | created_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_latest_health_kpi_snapshots | id | uuid | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_latest_health_kpi_snapshots | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | kpi_id | uuid | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | kpi_code | character varying (varchar) | YES | - | 50 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | kpi_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_latest_health_kpi_snapshots | standard_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | period_type | USER-DEFINED (kpi_period_type_enum) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | period_start | date | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | period_end | date | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | numerator_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | denominator_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | status_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | direction | USER-DEFINED (kpi_direction_enum) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | target_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | unit | character varying (varchar) | YES | - | 50 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | calculated_from | character varying (varchar) | YES | - | 50 | No | No | - | - |
| public | v_latest_health_kpi_snapshots | breakdown_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_latest_health_kpi_snapshots | source_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_latest_health_kpi_snapshots | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_latest_health_kpi_snapshots | updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_latest_health_kpi_snapshots_applicable | id | uuid | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_latest_health_kpi_snapshots_applicable | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | kpi_id | uuid | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | kpi_code | character varying (varchar) | YES | - | 50 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | kpi_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_latest_health_kpi_snapshots_applicable | standard_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | period_type | USER-DEFINED (kpi_period_type_enum) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | period_start | date | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | period_end | date | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | numerator_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | denominator_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | status_color | USER-DEFINED (kpi_status_color_enum) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | direction | USER-DEFINED (kpi_direction_enum) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | target_value | numeric | YES | - | 18 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | unit | character varying (varchar) | YES | - | 50 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | calculated_from | character varying (varchar) | YES | - | 50 | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | breakdown_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_latest_health_kpi_snapshots_applicable | source_trace_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | v_latest_health_kpi_snapshots_applicable | calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_latest_health_kpi_snapshots_applicable | updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | v_latest_health_kpi_snapshots_applicable | applicability_universe_applied | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | filtered_by_applicability_universe | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | tenant_filter_enforced | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | filtered_by_tenant_id | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_latest_health_kpi_snapshots_applicable | rn | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_remediation_executive_by_standard | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_remediation_executive_by_standard | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_remediation_executive_by_standard | standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | v_remediation_executive_by_standard | total_action_plans | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_remediation_executive_by_standard | open_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_standard | in_progress_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_standard | blocked_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_standard | completed_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_standard | overdue_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_standard | pending_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_remediation_executive_by_standard | approved_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_remediation_executive_by_standard | completion_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_remediation_executive_by_standard | nearest_due_date | date | YES | - | - | No | No | - | - |
| public | v_remediation_executive_by_standard | last_action_update | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_remediation_executive_by_tenant | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_remediation_executive_by_tenant | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_remediation_executive_by_tenant | total_action_plans | integer (int4) | YES | - | 32 | No | No | - | plan de acción |
| public | v_remediation_executive_by_tenant | open_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | in_progress_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | blocked_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | completed_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | cancelled_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | overdue_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | high_open_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | health_generated_actions | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_remediation_executive_by_tenant | controls_with_actions | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_remediation_executive_by_tenant | controls_with_completed_actions | integer (int4) | YES | - | 32 | No | No | - | control |
| public | v_remediation_executive_by_tenant | pending_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_remediation_executive_by_tenant | approved_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_remediation_executive_by_tenant | rejected_evidences | integer (int4) | YES | - | 32 | No | No | - | evidencia |
| public | v_remediation_executive_by_tenant | completion_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_remediation_executive_by_tenant | nearest_due_date | date | YES | - | - | No | No | - | - |
| public | v_remediation_executive_by_tenant | last_action_update | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_saas_prebilling_tenant_context | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_saas_prebilling_tenant_context | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_saas_prebilling_tenant_context | rut | text | YES | - | - | No | No | - | - |
| public | v_saas_prebilling_tenant_context | business | text | YES | - | - | No | No | - | - |
| public | v_saas_prebilling_tenant_context | plan_key | text | YES | - | - | No | No | - | - |
| public | v_saas_prebilling_tenant_context | contract_status | text | YES | - | - | No | No | - | estado |
| public | v_saas_prebilling_tenant_context | started_at | date | YES | - | - | No | No | - | - |
| public | v_saas_prebilling_tenant_context | ends_at | date | YES | - | - | No | No | - | - |
| public | v_saas_prebilling_tenant_context | active_standards | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_saas_prebilling_tenant_context | enabled_modules | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_saas_prebilling_tenant_context | total_users | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_saas_prebilling_tenant_context | external_lookup_monthly_limit | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_saas_prebilling_tenant_context | external_lookup_used_month | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_saas_prebilling_tenant_context | external_lookup_remaining_month | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_standard_health_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_standard_health_summary | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_standard_health_summary | standard_code | character varying (varchar) | YES | - | 50 | No | No | - | norma ISO |
| public | v_standard_health_summary | standard_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_standard_health_summary | total_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_standard_health_summary | healthy_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_standard_health_summary | attention_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_standard_health_summary | deteriorated_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_standard_health_summary | critical_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_standard_health_summary | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_standard_health_summary | healthy_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_standard_health_summary | controls_with_evidence_percentage | numeric | YES | - | - | No | No | - | control, evidencia |
| public | v_standard_health_summary | total_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_standard_health_summary | approved_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_standard_health_summary | pending_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_standard_health_summary | rejected_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_standard_health_summary | last_calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_standard_health_summary | standard_health_status | text | YES | - | - | No | No | - | estado |
| public | v_tenant_governance_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_tenant_governance_summary | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_tenant_governance_summary | active_standards | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_tenant_governance_summary | inactive_standards | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_tenant_governance_summary | enabled_modules | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_tenant_governance_summary | disabled_modules | bigint (int8) | YES | - | 64 | No | No | - | - |
| public | v_tenant_governance_summary | plan_key | text | YES | - | - | No | No | - | - |
| public | v_tenant_governance_summary | contract_status | text | YES | - | - | No | No | - | estado |
| public | v_tenant_governance_summary | started_at | date | YES | - | - | No | No | - | - |
| public | v_tenant_governance_summary | ends_at | date | YES | - | - | No | No | - | - |
| public | v_tenant_governance_summary | last_admin_event_at | timestamp with time zone (timestamptz) | YES | - | - | No | No | - | - |
| public | v_tenant_health_summary | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_tenant_health_summary | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_tenant_health_summary | total_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_tenant_health_summary | healthy_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_tenant_health_summary | attention_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_tenant_health_summary | deteriorated_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_tenant_health_summary | critical_controls | bigint (int8) | YES | - | 64 | No | No | - | control |
| public | v_tenant_health_summary | avg_health_score | numeric | YES | - | - | No | No | - | - |
| public | v_tenant_health_summary | healthy_percentage | numeric | YES | - | - | No | No | - | - |
| public | v_tenant_health_summary | controls_with_evidence_percentage | numeric | YES | - | - | No | No | - | control, evidencia |
| public | v_tenant_health_summary | total_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_tenant_health_summary | approved_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_tenant_health_summary | pending_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_tenant_health_summary | rejected_evidences | bigint (int8) | YES | - | 64 | No | No | - | evidencia |
| public | v_tenant_health_summary | last_calculated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_tenant_health_summary | tenant_health_status | text | YES | - | - | No | No | - | estado |
| public | v_tenant_modules | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | v_tenant_modules | tenant_name | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_tenant_modules | module_key | text | YES | - | - | No | No | - | - |
| public | v_tenant_modules | module_name | text | YES | - | - | No | No | - | - |
| public | v_tenant_modules | module_description | text | YES | - | - | No | No | - | - |
| public | v_tenant_modules | sort_order | integer (int4) | YES | - | 32 | No | No | - | - |
| public | v_tenant_modules | is_enabled | boolean (bool) | YES | - | - | No | No | - | - |
| public | v_tenant_modules | enabled_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_tenant_modules | disabled_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | v_tenant_modules | notes | text | YES | - | - | No | No | - | - |
| public | v_tenant_modules | metadata | jsonb | YES | - | - | No | No | - | metadata, json/jsonb |
| public | v_user_permissions | user_id | uuid | YES | - | - | No | No | - | usuario/responsable |
| public | v_user_permissions | email | character varying (varchar) | YES | - | 255 | No | No | - | - |
| public | v_user_permissions | full_name | text | YES | - | - | No | No | - | - |
| public | v_user_permissions | role | text | YES | - | - | No | No | - | - |
| public | v_user_permissions | role_display_name | text | YES | - | - | No | No | - | - |
| public | v_user_permissions | permission_key | text | YES | - | - | No | No | - | - |
| public | v_user_permissions | permission_group | text | YES | - | - | No | No | - | - |
| public | v_user_permissions | permission_display_name | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | vw_evidence_ai_state | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | vw_evidence_ai_state | control_id | uuid | YES | - | - | No | No | - | control |
| public | vw_evidence_ai_state | tenant_control_id | uuid | YES | - | - | No | No | - | control |
| public | vw_evidence_ai_state | description | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | file_name | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | file_path | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | evidence_status | text | YES | - | - | No | No | - | evidencia, estado |
| public | vw_evidence_ai_state | validated | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | evidence_type | text | YES | - | - | No | No | - | evidencia |
| public | vw_evidence_ai_state | document_extraction_status | text | YES | - | - | No | No | - | estado |
| public | vw_evidence_ai_state | ai_analysis_status | text | YES | - | - | No | No | - | estado |
| public | vw_evidence_ai_state | last_extracted_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | last_ai_analyzed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | extract_id | uuid | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | extraction_status | text | YES | - | - | No | No | - | estado |
| public | vw_evidence_ai_state | file_type | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | mime_type | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | text_char_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | vw_evidence_ai_state | ocr_used | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | detected_language | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | assessment_id | uuid | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | analysis_status | text | YES | - | - | No | No | - | estado |
| public | vw_evidence_ai_state | validity_result | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | contribution_level | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | pertinence_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_ai_state | sufficiency_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_ai_state | freshness_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_ai_state | traceability_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_ai_state | consistency_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_ai_state | compliance_impact_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_ai_state | recommended_standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | vw_evidence_ai_state | recommended_clause | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | recommended_control_id | uuid | YES | - | - | No | No | - | control |
| public | vw_evidence_ai_state | headline | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | narrative | text | YES | - | - | No | No | - | - |
| public | vw_evidence_ai_state | analyzed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | id | uuid | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | vw_evidence_current_ai_assessments | evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | vw_evidence_current_ai_assessments | extract_id | uuid | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | is_current | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | analysis_status | text | YES | - | - | No | No | - | estado |
| public | vw_evidence_current_ai_assessments | validity_result | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | contribution_level | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | pertinence_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_current_ai_assessments | sufficiency_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_current_ai_assessments | freshness_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_current_ai_assessments | traceability_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_current_ai_assessments | consistency_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_current_ai_assessments | compliance_impact_score | numeric | YES | - | 5 | No | No | - | - |
| public | vw_evidence_current_ai_assessments | recommended_standard_code | text | YES | - | - | No | No | - | norma ISO |
| public | vw_evidence_current_ai_assessments | recommended_clause | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | recommended_control_id | uuid | YES | - | - | No | No | - | control |
| public | vw_evidence_current_ai_assessments | recommended_operation_id | uuid | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | headline | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | narrative | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | risks_json | jsonb | YES | - | - | No | No | - | riesgo, json/jsonb |
| public | vw_evidence_current_ai_assessments | next_steps_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | vw_evidence_current_ai_assessments | extracted_entities_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | vw_evidence_current_ai_assessments | control_fit | text | YES | - | - | No | No | - | control |
| public | vw_evidence_current_ai_assessments | gap_summary | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | duplicate_of_evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | vw_evidence_current_ai_assessments | appears_expired | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | appears_complete | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | appears_authentic | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | model_name | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | model_version | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | source_system | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | raw_response_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | vw_evidence_current_ai_assessments | analyzed_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | vw_evidence_current_ai_assessments | updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | vw_evidence_current_ai_assessments | ai_trace_id | uuid | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | ai_source_level | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | ai_source_label | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | ai_confidence | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | ai_confidence_score | numeric | YES | - | - | No | No | - | - |
| public | vw_evidence_current_ai_assessments | ai_orchestration_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | vw_evidence_current_ai_assessments | ai_enhanced_answer_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | vw_evidence_current_extracts | id | uuid | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | tenant_id | uuid | YES | - | - | No | No | - | tenant scope |
| public | vw_evidence_current_extracts | evidence_id | uuid | YES | - | - | No | No | - | evidencia |
| public | vw_evidence_current_extracts | is_current | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | extraction_status | text | YES | - | - | No | No | - | estado |
| public | vw_evidence_current_extracts | extraction_engine | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | file_type | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | mime_type | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | raw_text | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | structured_json | jsonb | YES | - | - | No | No | - | json/jsonb |
| public | vw_evidence_current_extracts | text_char_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | vw_evidence_current_extracts | ocr_used | boolean (bool) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | detected_language | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | page_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | vw_evidence_current_extracts | sheet_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | vw_evidence_current_extracts | image_count | integer (int4) | YES | - | 32 | No | No | - | - |
| public | vw_evidence_current_extracts | extraction_notes | text | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | started_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | extracted_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | - |
| public | vw_evidence_current_extracts | created_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |
| public | vw_evidence_current_extracts | updated_at | timestamp without time zone (timestamp) | YES | - | - | No | No | - | timestamp/auditoría |

Fuente: `information_schema.columns`, `pg_catalog.pg_constraint`, `pg_catalog.pg_attribute`, `pg_catalog.pg_description`.
