# Functions and Procedures

| Schema | Función | Argumentos | Retorno | Lenguaje | Módulo inferido | Volatilidad | Observación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ai_core | fn_audit_external_lookup_quota_change | - | trigger | plpgsql | Auditorías | VOLATILE | function |
| ai_core | has_column | p_schema text, p_table text, p_column text | boolean | sql | No determinado | STABLE | function |
| ai_core | has_table | p_schema text, p_table text | boolean | sql | No determinado | STABLE | function |
| ai_core | text_expr | p_alias text, p_schema text, p_table text, p_column text, p_output text | text | plpgsql | No determinado | STABLE | function |
| public | armor | bytea | text | c | No determinado | IMMUTABLE | function |
| public | armor | bytea, text[], text[] | text | c | No determinado | IMMUTABLE | function |
| public | cleanup_inactive_health_scope | p_tenant_id uuid DEFAULT NULL::uuid | TABLE(deleted_health_rows integer, deleted_kpi_snapshots integer, deleted_kpi_dimensions integer) | plpgsql | Health | VOLATILE | function |
| public | crypt | text, text | text | c | No determinado | IMMUTABLE | function |
| public | dearmor | text | bytea | c | No determinado | IMMUTABLE | function |
| public | decrypt | bytea, bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | decrypt_iv | bytea, bytea, bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | digest | bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | digest | text, text | bytea | c | No determinado | IMMUTABLE | function |
| public | encrypt | bytea, bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | encrypt_iv | bytea, bytea, bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | enqueue_evidence_ai_job | p_tenant_id uuid, p_evidence_id uuid, p_job_type text, p_payload jsonb DEFAULT '{}'::jsonb, p_priority smallint DEFAULT 50, p_run_after timestamp without time zone DEFAULT now(), p_created_by uuid DEFAULT NULL::uuid | uuid | plpgsql | Evidencias | VOLATILE | function |
| public | fn_enforce_tenant_module_contract_limit | - | trigger | plpgsql | Tenants / SaaS | VOLATILE | function |
| public | fn_seed_tenant_modules_disabled | p_tenant_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid | integer | plpgsql | Tenants / SaaS | VOLATILE | function |
| public | gen_random_bytes | integer | bytea | c | No determinado | VOLATILE | function |
| public | gen_random_uuid | - | uuid | c | No determinado | VOLATILE | function |
| public | gen_salt | text | text | c | No determinado | VOLATILE | function |
| public | gen_salt | text, integer | text | c | No determinado | VOLATILE | function |
| public | get_user_effective_permissions | p_user_id uuid | TABLE(permission_key text, permission_group text, display_name text) | sql | Auth / usuarios | VOLATILE | function |
| public | gin_extract_query_trgm | text, internal, smallint, internal, internal, internal, internal | internal | c | No determinado | IMMUTABLE | function |
| public | gin_extract_value_trgm | text, internal | internal | c | No determinado | IMMUTABLE | function |
| public | gin_trgm_consistent | internal, smallint, text, integer, internal, internal, internal, internal | boolean | c | No determinado | IMMUTABLE | function |
| public | gin_trgm_triconsistent | internal, smallint, text, integer, internal, internal, internal | "char" | c | No determinado | IMMUTABLE | function |
| public | gtrgm_compress | internal | internal | c | No determinado | IMMUTABLE | function |
| public | gtrgm_consistent | internal, text, smallint, oid, internal | boolean | c | No determinado | IMMUTABLE | function |
| public | gtrgm_decompress | internal | internal | c | No determinado | IMMUTABLE | function |
| public | gtrgm_distance | internal, text, smallint, oid, internal | double precision | c | No determinado | IMMUTABLE | function |
| public | gtrgm_in | cstring | gtrgm | c | No determinado | IMMUTABLE | function |
| public | gtrgm_options | internal | void | c | No determinado | IMMUTABLE | function |
| public | gtrgm_out | gtrgm | cstring | c | No determinado | IMMUTABLE | function |
| public | gtrgm_penalty | internal, internal, internal | internal | c | No determinado | IMMUTABLE | function |
| public | gtrgm_picksplit | internal, internal | internal | c | No determinado | IMMUTABLE | function |
| public | gtrgm_same | gtrgm, gtrgm, internal | internal | c | No determinado | IMMUTABLE | function |
| public | gtrgm_union | internal, internal | gtrgm | c | No determinado | IMMUTABLE | function |
| public | hmac | bytea, bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | hmac | text, text, text | bytea | c | No determinado | IMMUTABLE | function |
| public | initialize_tenant_module_defaults | p_tenant_id uuid | TABLE(inserted_modules integer) | plpgsql | Tenants / SaaS | VOLATILE | function |
| public | initialize_tenant_standard | p_tenant_id uuid, p_standard_code text | integer | plpgsql | Tenants / SaaS | VOLATILE | function |
| public | log_admin_audit_event | p_actor_user_id uuid, p_action text, p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb | void | plpgsql | Auditorías | VOLATILE | function |
| public | log_admin_audit_event | p_actor_user_id uuid, p_actor_role text, p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_action text, p_action_label text DEFAULT NULL::text, p_old_data jsonb DEFAULT '{}'::jsonb, p_new_data jsonb DEFAULT '{}'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text | uuid | plpgsql | Auditorías | VOLATILE | function |
| public | normalize_status_for_audits | status_value text | text | plpgsql | Auditorías | IMMUTABLE | function |
| public | pgp_armor_headers | text, OUT key text, OUT value text | SETOF record | c | No determinado | IMMUTABLE | function |
| public | pgp_key_id | bytea | text | c | No determinado | IMMUTABLE | function |
| public | pgp_pub_decrypt | bytea, bytea | text | c | No determinado | IMMUTABLE | function |
| public | pgp_pub_decrypt | bytea, bytea, text | text | c | No determinado | IMMUTABLE | function |
| public | pgp_pub_decrypt | bytea, bytea, text, text | text | c | No determinado | IMMUTABLE | function |
| public | pgp_pub_decrypt_bytea | bytea, bytea | bytea | c | No determinado | IMMUTABLE | function |
| public | pgp_pub_decrypt_bytea | bytea, bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | pgp_pub_decrypt_bytea | bytea, bytea, text, text | bytea | c | No determinado | IMMUTABLE | function |
| public | pgp_pub_encrypt | text, bytea | bytea | c | No determinado | VOLATILE | function |
| public | pgp_pub_encrypt | text, bytea, text | bytea | c | No determinado | VOLATILE | function |
| public | pgp_pub_encrypt_bytea | bytea, bytea | bytea | c | No determinado | VOLATILE | function |
| public | pgp_pub_encrypt_bytea | bytea, bytea, text | bytea | c | No determinado | VOLATILE | function |
| public | pgp_sym_decrypt | bytea, text | text | c | No determinado | IMMUTABLE | function |
| public | pgp_sym_decrypt | bytea, text, text | text | c | No determinado | IMMUTABLE | function |
| public | pgp_sym_decrypt_bytea | bytea, text | bytea | c | No determinado | IMMUTABLE | function |
| public | pgp_sym_decrypt_bytea | bytea, text, text | bytea | c | No determinado | IMMUTABLE | function |
| public | pgp_sym_encrypt | text, text | bytea | c | No determinado | VOLATILE | function |
| public | pgp_sym_encrypt | text, text, text | bytea | c | No determinado | VOLATILE | function |
| public | pgp_sym_encrypt_bytea | bytea, text | bytea | c | No determinado | VOLATILE | function |
| public | pgp_sym_encrypt_bytea | bytea, text, text | bytea | c | No determinado | VOLATILE | function |
| public | refresh_control_health_scores | - | void | plpgsql | Controles | VOLATILE | function |
| public | refresh_control_health_scores_v2_1 | p_tenant_id uuid DEFAULT NULL::uuid | TABLE(total_processed integer, avg_health_score numeric, saludable integer, atencion integer, deteriorado integer, critico integer) | plpgsql | Controles | VOLATILE | function |
| public | refresh_control_health_scores_v2_preview | p_tenant_id uuid DEFAULT NULL::uuid | TABLE(total_processed integer, avg_health_score numeric, saludable integer, atencion integer, deteriorado integer, critico integer) | plpgsql | Controles | VOLATILE | function |
| public | refresh_kpi_health_snapshots | p_tenant_id uuid DEFAULT NULL::uuid | TABLE(snapshots_inserted integer, period_start date, period_end date) | plpgsql | KPIs | VOLATILE | function |
| public | set_current_timestamp_updated_at | - | trigger | plpgsql | No determinado | VOLATILE | function |
| public | set_limit | real | real | c | No determinado | VOLATILE | function |
| public | set_management_objectives_updated_at | - | trigger | plpgsql | Configuración | VOLATILE | function |
| public | set_updated_at | - | trigger | plpgsql | No determinado | VOLATILE | function |
| public | show_limit | - | real | c | No determinado | STABLE | function |
| public | show_trgm | text | text[] | c | No determinado | IMMUTABLE | function |
| public | similarity | text, text | real | c | No determinado | IMMUTABLE | function |
| public | similarity_dist | text, text | real | c | No determinado | IMMUTABLE | function |
| public | similarity_op | text, text | boolean | c | No determinado | STABLE | function |
| public | strict_word_similarity | text, text | real | c | No determinado | IMMUTABLE | function |
| public | strict_word_similarity_commutator_op | text, text | boolean | c | No determinado | STABLE | function |
| public | strict_word_similarity_dist_commutator_op | text, text | real | c | No determinado | IMMUTABLE | function |
| public | strict_word_similarity_dist_op | text, text | real | c | No determinado | IMMUTABLE | function |
| public | strict_word_similarity_op | text, text | boolean | c | No determinado | STABLE | function |
| public | tenant_has_active_standard | p_tenant_id uuid, p_standard_code text | boolean | sql | Tenants / SaaS | VOLATILE | function |
| public | tenant_module_is_enabled | p_tenant_id uuid, p_module_key text | boolean | plpgsql | Tenants / SaaS | VOLATILE | function |
| public | touch_updated_at | - | trigger | plpgsql | No determinado | VOLATILE | function |
| public | trg_audit_action_plans | - | trigger | plpgsql | Auditorías | VOLATILE | function |
| public | trg_audit_evidences | - | trigger | plpgsql | Evidencias | VOLATILE | function |
| public | unaccent | regdictionary, text | text | c | No determinado | STABLE | function |
| public | unaccent | text | text | c | No determinado | STABLE | function |
| public | unaccent_init | internal | internal | c | No determinado | VOLATILE | function |
| public | unaccent_lexize | internal, internal, internal, internal | internal | c | No determinado | VOLATILE | function |
| public | user_has_permission | p_user_id uuid, p_permission_key text | boolean | plpgsql | Auth / usuarios | VOLATILE | function |
| public | uuid_generate_v1 | - | uuid | c | No determinado | VOLATILE | function |
| public | uuid_generate_v1mc | - | uuid | c | No determinado | VOLATILE | function |
| public | uuid_generate_v3 | namespace uuid, name text | uuid | c | No determinado | IMMUTABLE | function |
| public | uuid_generate_v4 | - | uuid | c | No determinado | VOLATILE | function |
| public | uuid_generate_v5 | namespace uuid, name text | uuid | c | No determinado | IMMUTABLE | function |
| public | uuid_nil | - | uuid | c | No determinado | IMMUTABLE | function |
| public | uuid_ns_dns | - | uuid | c | No determinado | IMMUTABLE | function |
| public | uuid_ns_oid | - | uuid | c | No determinado | IMMUTABLE | function |
| public | uuid_ns_url | - | uuid | c | No determinado | IMMUTABLE | function |
| public | uuid_ns_x500 | - | uuid | c | No determinado | IMMUTABLE | function |
| public | word_similarity | text, text | real | c | No determinado | IMMUTABLE | function |
| public | word_similarity_commutator_op | text, text | boolean | c | No determinado | STABLE | function |
| public | word_similarity_dist_commutator_op | text, text | real | c | No determinado | IMMUTABLE | function |
| public | word_similarity_dist_op | text, text | real | c | No determinado | IMMUTABLE | function |
| public | word_similarity_op | text, text | boolean | c | No determinado | STABLE | function |

## Funciones destacadas por dominio
- Health/KPI: public.cleanup_inactive_health_scope<br>public.refresh_control_health_scores<br>public.refresh_control_health_scores_v2_1<br>public.refresh_control_health_scores_v2_preview<br>public.refresh_kpi_health_snapshots
- IA/conocimiento: ai_core.fn_audit_external_lookup_quota_change<br>ai_core.has_column<br>ai_core.has_table<br>ai_core.text_expr<br>public.enqueue_evidence_ai_job
- Evidencias/documentos: public.enqueue_evidence_ai_job<br>public.trg_audit_evidences
- Auditoría/riesgo/acciones: ai_core.fn_audit_external_lookup_quota_change<br>public.log_admin_audit_event<br>public.log_admin_audit_event<br>public.normalize_status_for_audits<br>public.trg_audit_action_plans<br>public.trg_audit_evidences

Fuente: `pg_catalog.pg_proc`, `pg_catalog.pg_namespace`, `pg_catalog.pg_language`.
