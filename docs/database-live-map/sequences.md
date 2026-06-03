# Sequences

| Schema | Sequence | Tipo dato | Start | Min | Max | Increment | Ciclo | Asociada a tabla/columna |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ai_core | ai_core_migrations_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.ai_core_migrations.id |
| ai_core | ai_feedback_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.ai_feedback.id |
| ai_core | clause_control_domain_map_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.clause_control_domain_map.id |
| ai_core | closure_criteria_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.closure_criteria.id |
| ai_core | domain_closure_criteria_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.domain_closure_criteria.id |
| ai_core | domain_evidence_expectations_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.domain_evidence_expectations.id |
| ai_core | domain_problem_type_map_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.domain_problem_type_map.id |
| ai_core | domain_solution_playbooks_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.domain_solution_playbooks.id |
| ai_core | domains_catalog_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.domains_catalog.id |
| ai_core | evidence_expectations_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.evidence_expectations.id |
| ai_core | invalid_evidence_patterns_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.invalid_evidence_patterns.id |
| ai_core | priority_rules_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.priority_rules.id |
| ai_core | problem_types_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.problem_types.id |
| ai_core | response_templates_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.response_templates.id |
| ai_core | solution_playbooks_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.solution_playbooks.id |
| ai_core | standard_domain_map_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.standard_domain_map.id |
| ai_core | standard_specific_overrides_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.standard_specific_overrides.id |
| ai_core | standards_catalog_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.standards_catalog.id |
| ai_core | view_definition_backups_id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | NO | ai_core.view_definition_backups.id |
| public | clauses_id_seq | integer | 1 | 1 | 2147483647 | 1 | NO | public.clauses.id |
| public | iso_clause_guides_id_seq | integer | 1 | 1 | 2147483647 | 1 | NO | public.iso_clause_guides.id |
| public | roles_id_seq | integer | 1 | 1 | 2147483647 | 1 | NO | public.roles.id |
| public | standards_id_seq | integer | 1 | 1 | 2147483647 | 1 | NO | public.standards.id |

Fuente: `information_schema.sequences`, `pg_catalog.pg_depend`, `pg_catalog.pg_class`, `pg_catalog.pg_attribute`.
