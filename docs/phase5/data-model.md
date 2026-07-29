# Fase 5 — Modelo de datos

Tablas creadas:

- Gobierno de datos: `data_domains`, `data_elements`, `data_definitions`, `data_owners`, `data_sources`, `data_quality_rules`, `data_quality_assessments`, `data_lineage_edges`, `data_snapshots`, `data_comparisons`, `data_trust_scores`.
- Métricas: `metric_definitions`, `metric_formula_versions`, `metric_dimensions`, `metric_sources`, `metric_thresholds`, `metric_measurements`, `metric_validations`, `metric_impact_rules`, `metric_snapshots`.
- Encuestas: `survey_definitions`, `survey_versions`, `survey_sections`, `survey_questions`, `survey_question_options`, `assessment_campaigns`, `assessment_recipients`, `survey_responses`, `survey_response_items`, `survey_evaluations`, `survey_approvals`.
- Assurance: `assurance_test_definitions`, `assurance_test_executions`, `assurance_test_samples`, `assurance_test_results`, `assurance_test_exceptions`.
- Pérdidas: `loss_events`, `loss_recoveries`.
- BI/reporting: `dashboard_definitions`, `dashboard_widgets`, `dashboard_permissions`, `report_definitions`, `report_template_versions`, `report_schedules`, `report_generations`, `report_artifacts`, `report_approvals`.

Todas las tablas operacionales son tenant-scoped con `tenant_id uuid NOT NULL REFERENCES tenants(id)`. Catálogos globales permitidos usan `tenant_id` nullable: `data_domains`, `metric_definitions`, `metric_impact_rules`, `report_template_versions`.
