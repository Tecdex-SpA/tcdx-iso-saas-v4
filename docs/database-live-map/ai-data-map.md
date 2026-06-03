# AI Data Map

## Objetos IA/conocimiento detectados
| Categoría | Objetos | Fuente |
|---|---|---|
| Tablas IA/conocimiento | ai_core.ai_core_migrations<br>ai_core.ai_feedback<br>ai_core.ai_response_feedback<br>ai_core.ai_response_traces<br>ai_core.clause_control_domain_map<br>ai_core.closure_criteria<br>ai_core.domain_closure_criteria<br>ai_core.domain_evidence_expectations<br>ai_core.domain_problem_type_map<br>ai_core.domain_solution_playbooks<br>ai_core.domains_catalog<br>ai_core.evidence_expectations<br>ai_core.external_lookup_extra_charges<br>ai_core.external_lookup_logs<br>ai_core.external_lookup_quota_audit<br>ai_core.external_lookup_quotas<br>ai_core.finding_scenarios<br>ai_core.invalid_evidence_patterns<br>ai_core.priority_rules<br>ai_core.problem_types<br>ai_core.response_templates<br>ai_core.solution_playbooks<br>ai_core.standard_domain_map<br>ai_core.standard_specific_overrides<br>ai_core.standards_catalog<br>ai_core.trusted_external_sources<br>ai_core.v_action_context<br>ai_core.v_ai_useful_feedback_cases<br>ai_core.v_control_context<br>ai_core.v_evidence_context<br>ai_core.v_external_lookup_usage_monthly<br>ai_core.v_finding_context<br>ai_core.v_finding_scenarios_active<br>ai_core.v_kpi_context<br>ai_core.v_tenant_health_context<br>ai_core.view_definition_backups<br>public.ai_auditor_runs<br>public.ai_bootstrap_knowledge_items<br>public.ai_bootstrap_knowledge_runs<br>public.ai_bootstrap_knowledge_sources<br>public.ai_bootstrap_knowledge_topics<br>public.ai_knowledge_datasets<br>public.ai_knowledge_records<br>public.ai_knowledge_standards<br>public.ai_prompt_logs<br>public.ai_suggestions<br>public.document_ai_analysis<br>public.document_association_suggestions<br>public.evidence_ai_assessments<br>public.evidence_ai_jobs<br>public.evidence_knowledge_chunks<br>public.iso_ai_guidance<br>public.iso_operational_suggestion_audit_log<br>public.iso_operational_suggestions<br>public.standard_lifecycle_ai_feed<br>public.v_iso_control_catalog_coverage<br>public.v_iso_operational_suggestions_queue<br>public.v_iso_operational_suggestions_summary<br>public.vw_evidence_ai_state<br>public.vw_evidence_current_ai_assessments | information_schema.tables |
| Vistas IA/conocimiento | ai_core.v_action_context<br>ai_core.v_ai_useful_feedback_cases<br>ai_core.v_control_context<br>ai_core.v_evidence_context<br>ai_core.v_external_lookup_usage_monthly<br>ai_core.v_finding_context<br>ai_core.v_finding_scenarios_active<br>ai_core.v_kpi_context<br>ai_core.v_tenant_health_context<br>public.v_iso_control_catalog_coverage<br>public.v_iso_operational_suggestions_queue<br>public.v_iso_operational_suggestions_summary<br>public.vw_evidence_ai_state<br>public.vw_evidence_current_ai_assessments | information_schema.views / pg_catalog.pg_class |
| Funciones IA/conocimiento | ai_core.fn_audit_external_lookup_quota_change<br>ai_core.has_column<br>ai_core.has_table<br>ai_core.text_expr<br>public.enqueue_evidence_ai_job | pg_catalog.pg_proc |
| Extensiones de búsqueda/IA | pg_trgm 1.6, unaccent 1.1 | pg_catalog.pg_extension |

## Embeddings y RAG
- Columnas con nombre/type embedding/vector: public.ai_knowledge_records.embedding_text (text/text), public.evidence_knowledge_chunks.embedding_status (text/text), public.evidence_knowledge_chunks.embedding_model (text/text), public.evidence_knowledge_chunks.embedding_vector_ref (text/text).
- Extensión pgvector: no detectada.
- Extensión pg_trgm: detectada.

## Trazabilidad IA
Objetos por nombre sugieren runs, prompts, suggestions, feedback, knowledge y auditoría IA. No se leyeron prompts ni respuestas reales.

## Riesgos de privacidad
Columnas JSON/metadata y tablas de trazas pueden contener contexto sensible si no hay minimización, retención y masking. Validar políticas antes de ampliar PLN/NLP/RAG.

Fuente: `information_schema`, `pg_catalog.pg_extension`.
