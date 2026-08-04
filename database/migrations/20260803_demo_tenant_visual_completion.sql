-- TCDX ISO SaaS v4 - enriquecimiento visual aditivo de Demo Tecdex.
-- Requiere 20260803_demo_tenant_iso_grc. No crea ni elimina tenants ni catálogos globales.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.demo_visual_uuid(p_key text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5('demo-tecdex:visual:' || p_key), 1, 8) || '-' ||
    substr(md5('demo-tecdex:visual:' || p_key), 9, 4) || '-' ||
    substr(md5('demo-tecdex:visual:' || p_key), 13, 4) || '-' ||
    substr(md5('demo-tecdex:visual:' || p_key), 17, 4) || '-' ||
    substr(md5('demo-tecdex:visual:' || p_key), 21, 12)
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION pg_temp.demo_base_uuid(p_key text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5('demo-tecdex:' || p_key), 1, 8) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 9, 4) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 13, 4) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 17, 4) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 21, 12)
  )::uuid;
$$;

CREATE TEMP TABLE demo_visual_context (
  tenant_id uuid PRIMARY KEY,
  admin_id uuid NOT NULL,
  auditor_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_visual_context (tenant_id, admin_id, auditor_id)
SELECT t.id, a.id, u.id
FROM tenants t
JOIN users a ON a.tenant_id=t.id AND a.email='admin.demo@tcdx.demo'
JOIN users u ON u.tenant_id=t.id AND u.email='auditor.demo@tcdx.demo'
WHERE t.id='76c44a0e-6041-8bda-99c7-b740fccea001'::uuid
  AND t.rut='DEMO-TECDX-ISO-GRC'
  AND t.name='Demo Tecdex';

DO $$
DECLARE
  missing_tables text[];
BEGIN
  IF (SELECT count(*) FROM demo_visual_context) <> 1 THEN
    RAISE EXCEPTION 'Demo visual completion preflight failed: deterministic tenant, RUT or demo users do not match';
  END IF;

  SELECT array_agg(name ORDER BY name)
  INTO missing_tables
  FROM (VALUES
    ('tenant_standard_operations'),('controls'),('controls_catalog_standards'),('tenant_applicable_controls'),
    ('control_health_scores'),('tenant_nonconformities'),('action_plan_updates'),
    ('kpi_definitions'),('kpi_snapshots'),('control_soa_assessments'),('control_soa_change_log'),
    ('iso_risk_matrix_runs'),('iso_risk_matrix_items'),('operational_risk_simulations'),
    ('operational_risk_recommendations'),('grc_frameworks'),('grc_framework_versions'),
    ('grc_framework_requirements'),('grc_requirement_control_mappings'),('grc_mapping_reviews'),
    ('grc_evidence_requests'),('grc_evidence_requirements'),('grc_evidence_submissions'),
    ('grc_evidence_versions'),('grc_evidence_reviews'),('grc_evidence_links'),
    ('grc_evidence_quality_scores'),('grc_readiness_rules'),('grc_readiness_snapshots'),
    ('grc_readiness_results'),('grc_readiness_findings'),('grc_audit_universe_entities'),
    ('grc_audit_annual_plans'),('grc_audit_plan_items'),('grc_audit_programs'),
    ('grc_audit_team_members'),('grc_audit_sample_plans'),('grc_audit_sample_items'),
    ('grc_audit_workpapers'),('grc_audit_interviews'),('grc_audit_evidence_links'),
    ('grc_audit_supervisor_reviews'),('grc_audit_reports'),('grc_audit_followups'),
    ('grc_control_assurance'),('grc_effectiveness_verifications'),('grc_suppliers'),
    ('grc_supplier_history'),('grc_supplier_services'),('grc_supplier_contracts'),('grc_questionnaire_templates'),
    ('grc_questionnaire_versions'),('grc_questionnaire_sections'),('grc_questionnaire_questions'),
    ('grc_supplier_assessments'),('grc_supplier_answers'),('grc_supplier_assessment_history'),
    ('privacy_processing_activities'),('privacy_processing_versions'),('privacy_processors'),('privacy_dpias'),
    ('privacy_dpia_risks'),('privacy_data_subject_requests'),('privacy_breaches'),
    ('grc_incidents'),('grc_incident_timeline'),('grc_incident_impacts'),
    ('grc_incident_root_causes'),('grc_incident_postmortems'),('grc_connector_definitions'),
    ('grc_connector_instances'),('grc_connector_runs'),('grc_external_records'),
    ('grc_operational_alerts'),('grc_metric_observations'),('grc_organizational_units'),
    ('grc_operational_services'),('grc_operational_dependencies'),('grc_bia_assessments'),
    ('grc_bia_impacts'),('grc_continuity_plans'),('grc_continuity_tests'),
    ('grc_crisis_activations'),('grc_crisis_log'),('grc_metric_definitions'),
    ('grc_metric_measurements'),('grc_quantitative_risk_assessments'),
    ('data_quality_rules'),('data_quality_assessments'),('metric_sources'),('metric_thresholds'),
    ('survey_sections'),('survey_questions'),('survey_question_options'),('assessment_recipients'),
    ('survey_responses'),('survey_response_items'),('survey_evaluations'),('survey_approvals'),
    ('assurance_test_samples'),('assurance_test_results'),('assurance_test_exceptions'),
    ('iso_operational_suggestions'),('report_exports'),('report_template_versions'),('report_schedules')
  ) required(name)
  WHERE to_regclass('public.' || name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Demo visual completion requires deployed schema tables: %', array_to_string(missing_tables, ', ');
  END IF;
END $$;

-- Operational scope consumed by dashboard, controls, SoA, audits and lifecycle.
INSERT INTO tenant_standard_operations (id, tenant_id, standard_code, operation_id, is_active, notes, created_at, updated_at)
SELECT pg_temp.demo_visual_uuid('standard-operation-' || s.code || '-' || p.seq), c.tenant_id, s.code,
       pg_temp.demo_base_uuid('operation-' || p.seq), true,
       'Alcance operacional integrado Demo Tecdex para ' || s.code, now(), now()
FROM demo_visual_context c
CROSS JOIN (VALUES ('ISO9001'),('ISO27001')) s(code)
CROSS JOIN generate_series(1,10) p(seq)
ON CONFLICT (tenant_id, standard_code, operation_id) DO UPDATE SET
  is_active=true, notes=EXCLUDED.notes, updated_at=now();

INSERT INTO controls_catalog_standards (id, control_id, standard_code, clause, is_primary, created_at, updated_at)
SELECT pg_temp.demo_visual_uuid('catalog-standard-' || gs), pg_temp.demo_base_uuid('control-catalog-' || gs),
       CASE WHEN gs <= 28 THEN 'ISO9001' ELSE 'ISO27001' END,
       CASE WHEN gs <= 28 THEN ((ARRAY['4','5','6','7','8','9','10'])[((gs-1)%7)+1])
            ELSE ((ARRAY['A.5','A.6','A.7','A.8'])[((gs-29)%4)+1]) END,
       true, now(), now()
FROM generate_series(1,55) gs
ON CONFLICT (control_id, standard_code) DO UPDATE SET
  clause=EXCLUDED.clause, is_primary=true, updated_at=now();

INSERT INTO tenant_applicable_controls (
  id, tenant_id, tenant_control_id, control_catalog_id, standard_code, control_code, control_name,
  applicability_status, applicability_reason, applicability_score, priority, profile_drivers,
  calculation_weight, must_exist, visible_to_tenant, active, source, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('applicable-control-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('tenant-control-' || gs), pg_temp.demo_base_uuid('control-catalog-' || gs),
       CASE WHEN gs <= 28 THEN 'ISO9001' ELSE 'ISO27001' END,
       CASE WHEN gs <= 28 THEN 'QMS-' || lpad(gs::text,2,'0') ELSE 'ISMS-' || lpad((gs-28)::text,2,'0') END,
       CASE WHEN gs <= 28 THEN 'Control de gestión de calidad ' || gs ELSE 'Control de seguridad de la información ' || (gs-28) END,
       CASE WHEN gs IN (14,41,52) THEN 'not_applicable' ELSE 'applicable' END,
       CASE WHEN gs IN (14,41,52) THEN 'No aplica al alcance tecnológico actual; decisión revisada y trazada.'
            ELSE 'Aplicable por procesos, activos, riesgos y alcance integrado del tenant demo.' END,
       CASE WHEN gs IN (14,41,52) THEN 18 ELSE 82 + (gs % 14) END,
       CASE WHEN gs % 7=0 THEN 'alta' WHEN gs % 3=0 THEN 'media' ELSE 'baja' END,
       jsonb_build_object('industry','technology','standards',jsonb_build_array(CASE WHEN gs<=28 THEN 'ISO9001' ELSE 'ISO27001' END),'demo_slug','demo-tecdex'),
       CASE WHEN gs % 9=0 THEN 1.5 ELSE 1 END, gs NOT IN (14,41,52), true, true,
       'demo_visual_completion', now(), now()
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (id) DO UPDATE SET
  applicability_status=EXCLUDED.applicability_status,
  applicability_reason=EXCLUDED.applicability_reason,
  applicability_score=EXCLUDED.applicability_score,
  priority=EXCLUDED.priority,
  profile_drivers=EXCLUDED.profile_drivers,
  active=true, visible_to_tenant=true, updated_at=now();

INSERT INTO control_health_scores (
  id, tenant_id, tenant_control_id, standard_code, catalog_control_id,
  health_score, health_status, evidence_score, compliance_score, findings_score,
  risk_score, action_score, review_score, evidence_count, approved_evidence_count,
  pending_evidence_count, rejected_evidence_count, open_findings_count, open_actions_count,
  overdue_actions_count, high_risks_count, calculated_at, metadata
)
SELECT pg_temp.demo_visual_uuid('control-health-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('tenant-control-' || gs),
       CASE WHEN gs<=28 THEN 'ISO9001' ELSE 'ISO27001' END,
       pg_temp.demo_base_uuid('control-catalog-' || gs),
       CASE WHEN gs%11=0 THEN 39 WHEN gs%7=0 THEN 58 WHEN gs%3=0 THEN 72 ELSE 88 END,
       CASE WHEN gs%11=0 THEN 'deteriorado' WHEN gs%7=0 THEN 'atencion' ELSE 'saludable' END,
       CASE WHEN gs%8=0 THEN 55 ELSE 86 END,
       CASE WHEN gs%11=0 THEN 42 WHEN gs%7=0 THEN 64 ELSE 90 END,
       CASE WHEN gs%9=0 THEN 48 ELSE 84 END,
       CASE WHEN gs%10=0 THEN 50 ELSE 82 END,
       CASE WHEN gs%7=0 THEN 62 ELSE 85 END,
       80 + (gs%16), 1 + (gs%3), CASE WHEN gs%5=0 THEN 1 ELSE 2 END,
       CASE WHEN gs%4=0 THEN 1 ELSE 0 END, CASE WHEN gs%13=0 THEN 1 ELSE 0 END,
       CASE WHEN gs%6=0 THEN 1 ELSE 0 END, CASE WHEN gs%5=0 THEN 1 ELSE 0 END,
       CASE WHEN gs%12=0 THEN 1 ELSE 0 END, CASE WHEN gs%8=0 THEN 1 ELSE 0 END,
       now() - ((gs%28) || ' days')::interval,
       jsonb_build_object('formula_version','demo-visual-v1','design',CASE WHEN gs%7=0 THEN 'partial' ELSE 'effective' END,'execution_frequency',CASE WHEN gs%3=0 THEN 'monthly' ELSE 'quarterly' END,'demo_slug','demo-tecdex')
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (tenant_control_id) DO UPDATE SET
  health_score=EXCLUDED.health_score, health_status=EXCLUDED.health_status,
  evidence_score=EXCLUDED.evidence_score, compliance_score=EXCLUDED.compliance_score,
  findings_score=EXCLUDED.findings_score, risk_score=EXCLUDED.risk_score,
  action_score=EXCLUDED.action_score, review_score=EXCLUDED.review_score,
  evidence_count=EXCLUDED.evidence_count, approved_evidence_count=EXCLUDED.approved_evidence_count,
  pending_evidence_count=EXCLUDED.pending_evidence_count, rejected_evidence_count=EXCLUDED.rejected_evidence_count,
  open_findings_count=EXCLUDED.open_findings_count, open_actions_count=EXCLUDED.open_actions_count,
  overdue_actions_count=EXCLUDED.overdue_actions_count, high_risks_count=EXCLUDED.high_risks_count,
  calculated_at=EXCLUDED.calculated_at, metadata=EXCLUDED.metadata;

INSERT INTO tenant_nonconformities (id, tenant_id, control_id, nonconformity_id, detected_at, status, resolved_at, control_description)
SELECT pg_temp.demo_visual_uuid('nonconformity-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('control-catalog-' || (((gs-1)%55)+1)), pg_temp.demo_base_uuid('finding-' || (((gs-1)%18)+1)),
       now() - ((gs*23) || ' days')::interval,
       CASE WHEN gs IN (3,7,10) THEN 'cerrada' WHEN gs IN (2,6,9) THEN 'en tratamiento' ELSE 'abierta' END,
       CASE WHEN gs IN (3,7,10) THEN now() - ((gs*7) || ' days')::interval ELSE NULL END,
       CASE WHEN gs%2=0 THEN 'Brecha de efectividad operativa con acción correctiva en seguimiento.' ELSE 'Desviación documental detectada en revisión de control.' END
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, resolved_at=EXCLUDED.resolved_at, control_description=EXCLUDED.control_description;

INSERT INTO action_plan_updates (id, action_plan_id, tenant_id, comment, progress_percent, status_after, blocked_reason, created_by, created_at, updated_at)
SELECT pg_temp.demo_visual_uuid('action-update-' || a || '-' || m), pg_temp.demo_base_uuid('action-' || a), c.tenant_id,
       CASE m WHEN 1 THEN 'Plan priorizado y responsable confirmado.' WHEN 2 THEN 'Avance revisado con evidencia parcial.' ELSE 'Verificación de efectividad y próximos pasos registrados.' END,
       LEAST(100, CASE WHEN a%6=0 THEN 20 ELSE (m*25 + (a%4)*8) END),
       CASE WHEN a<=8 THEN 'completado' WHEN a<=16 THEN 'en progreso' WHEN a<=20 THEN 'bloqueado' ELSE 'abierto' END,
       CASE WHEN a BETWEEN 17 AND 20 AND m=3 THEN 'Dependencia de proveedor y ventana de cambio pendiente.' ELSE NULL END,
       CASE WHEN m=3 THEN c.auditor_id ELSE c.admin_id END,
       now() - (((4-m)*30 + a) || ' days')::interval, now() - (((4-m)*30 + a) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,24) a CROSS JOIN generate_series(1,3) m
ON CONFLICT (id) DO UPDATE SET comment=EXCLUDED.comment, progress_percent=EXCLUDED.progress_percent,
  status_after=EXCLUDED.status_after, blocked_reason=EXCLUDED.blocked_reason, updated_at=EXCLUDED.updated_at;

-- Legacy KPI surface used by /dashboard and /administrar-kpis. Phase 5 metrics remain the governed source.
CREATE TEMP TABLE demo_visual_kpis (
  seq integer PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  kpi_type text NOT NULL,
  direction text NOT NULL,
  target numeric NOT NULL,
  source_metric_code text NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_visual_kpis VALUES
  (1,'DEMO-KPI-HLT-001','Salud global integrada','estrategico','automatico','higher_is_better',82,'demo_tecdex.grc_health'),
  (2,'DEMO-KPI-HLT-002','Cumplimiento de controles','cumplimiento','automatico','higher_is_better',85,'demo_tecdex.control_effectiveness'),
  (3,'DEMO-KPI-HLT-003','Cobertura de evidencia','cumplimiento','automatico','higher_is_better',90,'demo_tecdex.evidence_coverage'),
  (4,'DEMO-KPI-HLT-004','Controles deteriorados','riesgo','automatico','lower_is_better',8,'demo_tecdex.failed_controls'),
  (5,'DEMO-KPI-005','Riesgos fuera de apetito','riesgo','hibrido','lower_is_better',4,'demo_tecdex.out_of_appetite'),
  (6,'DEMO-KPI-006','Acciones cerradas a tiempo','operacional','hibrido','higher_is_better',88,'demo_tecdex.action_completion'),
  (7,'DEMO-KPI-007','Readiness de auditoría','cumplimiento','hibrido','higher_is_better',85,'demo_tecdex.audit_readiness'),
  (8,'DEMO-KPI-008','Calidad del dato GRC','estrategico','automatico','higher_is_better',90,'demo_tecdex.data_quality'),
  (9,'DEMO-KPI-009','Incidentes críticos abiertos','riesgo','manual','lower_is_better',2,'demo_tecdex.critical_incidents'),
  (10,'DEMO-KPI-010','Continuidad probada','operacional','hibrido','higher_is_better',90,'demo_tecdex.continuity_test_success'),
  (11,'DEMO-KPI-011','Efectividad de terceros críticos','riesgo','hibrido','higher_is_better',82,'demo_tecdex.supplier_assurance'),
  (12,'DEMO-KPI-012','Suficiencia semántica','estrategico','automatico','higher_is_better',88,'demo_tecdex.semantic_sufficiency');

INSERT INTO kpi_definitions (
  id, code, name, description, category, kpi_type, unit, base_formula, formula_expression,
  data_source_summary, frequency, direction, target_value, min_value, max_value,
  display_order, is_standard, tenant_id, created_by, is_active, metadata, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('legacy-kpi-' || k.seq), k.code, k.name,
       'KPI comercial Demo Tecdex enlazado a la métrica gobernada ' || k.source_metric_code || '.',
       k.category::kpi_category_enum, k.kpi_type::kpi_type_enum,
       CASE WHEN k.seq IN (4,5,9) THEN 'cantidad' ELSE '%' END,
       'metric_definitions/' || k.source_metric_code,
       CASE WHEN k.direction='lower_is_better' THEN 'menor es mejor' ELSE 'mayor es mejor' END,
       'metric_measurements + metric_snapshots; tenant demo; últimos 12 meses',
       'mensual'::kpi_frequency_enum, k.direction::kpi_direction_enum, k.target, 0, 100,
       k.seq, false, c.tenant_id, c.admin_id, true,
       jsonb_build_object('demo_slug','demo-tecdex','source_metric_code',k.source_metric_code,'lineage','metric_measurements->kpi_snapshots'),
       now(), now()
FROM demo_visual_context c CROSS JOIN demo_visual_kpis k
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category,
  kpi_type=EXCLUDED.kpi_type, unit=EXCLUDED.unit, data_source_summary=EXCLUDED.data_source_summary,
  frequency=EXCLUDED.frequency, direction=EXCLUDED.direction, target_value=EXCLUDED.target_value,
  created_by=EXCLUDED.created_by, is_active=true, metadata=EXCLUDED.metadata, updated_at=now()
WHERE kpi_definitions.tenant_id = EXCLUDED.tenant_id;

INSERT INTO kpi_snapshots (
  id, tenant_id, kpi_id, standard_code, period_type, period_start, period_end,
  value, numerator_value, denominator_value, status_color, direction, target_value,
  calculated_from, breakdown_json, source_trace_json, calculated_at, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('legacy-kpi-snapshot-' || k.seq || '-' || month_no), c.tenant_id,
       kd.id,
       CASE WHEN k.seq IN (2,3,6,7) THEN CASE WHEN month_no%2=0 THEN 'ISO9001' ELSE 'ISO27001' END ELSE NULL END,
       'mensual'::kpi_period_type_enum,
       (date_trunc('month', current_date) - ((12-month_no) || ' months')::interval)::date,
       ((date_trunc('month', current_date) - ((11-month_no) || ' months')::interval) - interval '1 day')::date,
       CASE WHEN k.direction='lower_is_better'
            THEN greatest(0, round((k.target + 6 - month_no*0.45 + ((k.seq+month_no)%3))::numeric,2))
            ELSE least(98, round((k.target - 9 + month_no*0.72 + (((k.seq*month_no)%5)-2))::numeric,2)) END,
       CASE WHEN k.direction='lower_is_better' THEN NULL ELSE 70 + month_no + (k.seq%7) END,
       CASE WHEN k.direction='lower_is_better' THEN NULL ELSE 100 END,
       CASE
         WHEN k.direction='lower_is_better' AND (k.target + 6 - month_no*0.45 + ((k.seq+month_no)%3)) <= k.target THEN 'green'
         WHEN k.direction='lower_is_better' AND (k.target + 6 - month_no*0.45 + ((k.seq+month_no)%3)) <= k.target*1.5 THEN 'yellow'
         WHEN k.direction='lower_is_better' THEN 'red'
         WHEN (k.target - 9 + month_no*0.72 + (((k.seq*month_no)%5)-2)) >= k.target THEN 'green'
         WHEN (k.target - 9 + month_no*0.72 + (((k.seq*month_no)%5)-2)) >= k.target*0.85 THEN 'yellow'
         ELSE 'red'
       END::kpi_status_color_enum,
       k.direction::kpi_direction_enum, k.target, 'demo_visual_completion',
       jsonb_build_object('month',month_no,'series_points',12,'source_metric_code',k.source_metric_code),
       jsonb_build_object('tenant_id',c.tenant_id,'metric_code',k.source_metric_code,'quality','valid','freshness','current'),
       now() - ((12-month_no) || ' months')::interval,
       now() - ((12-month_no) || ' months')::interval,
       now() - ((12-month_no) || ' months')::interval
FROM demo_visual_context c
CROSS JOIN demo_visual_kpis k
JOIN kpi_definitions kd
  ON kd.code = k.code
 AND kd.tenant_id = c.tenant_id
CROSS JOIN generate_series(1,12) month_no
ON CONFLICT (id) DO UPDATE SET
  value=EXCLUDED.value, numerator_value=EXCLUDED.numerator_value, denominator_value=EXCLUDED.denominator_value,
  status_color=EXCLUDED.status_color, breakdown_json=EXCLUDED.breakdown_json,
  source_trace_json=EXCLUDED.source_trace_json, calculated_at=EXCLUDED.calculated_at,
  updated_at=EXCLUDED.updated_at;

-- SoA history for every tenant control; never creates a control outside the existing catalog.
INSERT INTO controls (id, tenant_id, iso_code, clause, status, score, created_at, catalog_control_id)
SELECT pg_temp.demo_visual_uuid('legacy-control-' || gs), c.tenant_id,
       CASE WHEN gs<=28 THEN 'ISO9001' ELSE 'ISO27001' END,
       CASE WHEN gs<=28 THEN ((ARRAY['4','5','6','7','8','9','10'])[((gs-1)%7)+1])
            ELSE ((ARRAY['A.5','A.6','A.7','A.8'])[((gs-29)%4)+1]) END,
       CASE WHEN gs%11=0 THEN 'no cumple' WHEN gs%7=0 THEN 'parcial' ELSE 'cumple' END,
       CASE WHEN gs%11=0 THEN 39 WHEN gs%7=0 THEN 62 ELSE 88 END,
       now() - ((gs%120) || ' days')::interval,
       pg_temp.demo_base_uuid('control-catalog-' || gs)
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (id) DO UPDATE SET
  status=EXCLUDED.status, score=EXCLUDED.score, catalog_control_id=EXCLUDED.catalog_control_id;

INSERT INTO control_soa_assessments (
  id, tenant_id, tenant_control_id, iso_code, source, status,
  suggested_applicable, suggested_implementation_status, suggested_justification,
  confidence_score, confidence_level, evidence_summary, risk_summary, finding_summary,
  nonconformity_summary, action_summary, audit_summary, health_summary, kpi_summary,
  rule_results, ai_result, recommended_actions, ai_model, ai_prompt_version,
  reviewed_by, reviewed_at, applied_by, applied_at, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('soa-assessment-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('legacy-control-' || gs),
       CASE WHEN gs<=28 THEN 'ISO9001' ELSE 'ISO27001' END,
       'system', CASE WHEN gs%9=0 THEN 'reviewed' ELSE 'applied' END,
       gs NOT IN (14,41,52),
       CASE WHEN gs IN (14,41,52) THEN 'no aplica' WHEN gs%7=0 THEN 'parcial' ELSE 'implementado' END,
       CASE WHEN gs IN (14,41,52) THEN 'Exclusión justificada por alcance y arquitectura actual.'
            WHEN gs%7=0 THEN 'Implementación parcial con plan y evidencia de avance.'
            ELSE 'Control aplicable, implementado y sujeto a prueba periódica.' END,
       76 + (gs%20), CASE WHEN gs%9=0 THEN 'media' ELSE 'alta' END,
       jsonb_build_object('count',1+(gs%3),'approved',gs%4<>0,'evidence_id',pg_temp.demo_base_uuid('evidence-' || (((gs-1)%80)+1))),
       jsonb_build_object('open',CASE WHEN gs%8=0 THEN 1 ELSE 0 END,'residual_level',CASE WHEN gs%8=0 THEN 'alto' ELSE 'medio' END),
       jsonb_build_object('open',CASE WHEN gs%6=0 THEN 1 ELSE 0 END),
       jsonb_build_object('open',CASE WHEN gs%10=0 THEN 1 ELSE 0 END),
       jsonb_build_object('open',CASE WHEN gs%5=0 THEN 1 ELSE 0 END,'overdue',CASE WHEN gs%12=0 THEN 1 ELSE 0 END),
       jsonb_build_object('tested',true,'last_audit_days',gs%320),
       jsonb_build_object('score',CASE WHEN gs%11=0 THEN 39 WHEN gs%7=0 THEN 62 ELSE 88 END),
       jsonb_build_object('latest_status',CASE WHEN gs%7=0 THEN 'yellow' ELSE 'green' END),
       jsonb_build_array(jsonb_build_object('rule','evidence_and_effectiveness','matched',true)),
       '{}'::jsonb,
       jsonb_build_array(jsonb_build_object('title','Mantener prueba y evidencia vigente','priority',CASE WHEN gs%7=0 THEN 'alta' ELSE 'media' END)),
       NULL, NULL, c.auditor_id, now() - ((gs%40) || ' days')::interval,
       CASE WHEN gs%9=0 THEN NULL ELSE c.admin_id END,
       CASE WHEN gs%9=0 THEN NULL ELSE now() - ((gs%35) || ' days')::interval END,
       now() - ((gs%70) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (id) DO UPDATE SET
  status=EXCLUDED.status, suggested_applicable=EXCLUDED.suggested_applicable,
  suggested_implementation_status=EXCLUDED.suggested_implementation_status,
  suggested_justification=EXCLUDED.suggested_justification,
  confidence_score=EXCLUDED.confidence_score, reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at,
  applied_by=EXCLUDED.applied_by, applied_at=EXCLUDED.applied_at, updated_at=now();

INSERT INTO control_soa_change_log (
  id, tenant_id, tenant_control_id, assessment_id, source, field_changed,
  old_value, new_value, reason, changed_by, changed_at
)
SELECT pg_temp.demo_visual_uuid('soa-change-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('legacy-control-' || gs), pg_temp.demo_visual_uuid('soa-assessment-' || gs),
       CASE WHEN gs%9=0 THEN 'manual' ELSE 'system_suggestion_applied' END,
       'implementation_status', 'pendiente',
       CASE WHEN gs IN (14,41,52) THEN 'no aplica' WHEN gs%7=0 THEN 'parcial' ELSE 'implementado' END,
       'Actualización trazada por enriquecimiento visual demo.',
       CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END,
       now() - ((gs%35) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (id) DO NOTHING;

-- Versioned ISO references and mappings. Only reference codes and TCDX interpretations are stored.
INSERT INTO grc_framework_versions (
  id, tenant_id, framework_id, version_label, effective_from, status,
  source_url, license_metadata, published_at, created_at
)
SELECT pg_temp.demo_visual_uuid('framework-version-' || f.code), c.tenant_id, f.id,
       CASE WHEN f.code='ISO-9001' THEN '2015' ELSE '2022' END,
       CASE WHEN f.code='ISO-9001' THEN DATE '2015-09-15' ELSE DATE '2022-10-25' END,
       'published', NULL,
       jsonb_build_object('content_policy','references_only','catalog_source','existing_grc_frameworks','demo_slug','demo-tecdex'),
       now() - interval '11 months', now() - interval '11 months'
FROM demo_visual_context c
JOIN grc_frameworks f ON f.tenant_id IS NULL AND f.code IN ('ISO-9001','ISO-27001')
ON CONFLICT (tenant_id, framework_id, version_label) DO NOTHING;

INSERT INTO grc_framework_requirements (
  id, tenant_id, version_id, reference_code, permitted_title,
  tcdx_interpretation, content_classification, metadata
)
SELECT pg_temp.demo_visual_uuid('framework-requirement-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('framework-version-' || CASE WHEN gs<=28 THEN 'ISO-9001' ELSE 'ISO-27001' END),
       CASE WHEN gs<=28
            THEN 'ISO9001-' || ((ARRAY['4','5','6','7','8','9','10'])[((gs-1)%7)+1]) || '-' || lpad(gs::text,2,'0')
            ELSE 'ISO27001-' || ((ARRAY['A.5','A.6','A.7','A.8'])[((gs-29)%4)+1]) || '-' || lpad((gs-28)::text,2,'0') END,
       CASE WHEN gs<=28 THEN 'Referencia de requisito SGC ' || gs ELSE 'Referencia de control SGSI ' || (gs-28) END,
       CASE WHEN gs<=28
            THEN 'Interpretación TCDX: gobernar el proceso, conservar evidencia y medir mejora.'
            ELSE 'Interpretación TCDX: reducir el riesgo mediante diseño, operación, prueba y evidencia.' END,
       'tcdx_interpretation',
       jsonb_build_object('catalog_control_id',pg_temp.demo_base_uuid('control-catalog-' || gs),'demo_slug','demo-tecdex')
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (tenant_id, version_id, reference_code) DO UPDATE SET
  permitted_title=EXCLUDED.permitted_title, tcdx_interpretation=EXCLUDED.tcdx_interpretation,
  metadata=EXCLUDED.metadata;

INSERT INTO grc_requirement_control_mappings (
  id, tenant_id, requirement_id, tenant_control_id, catalog_control_id,
  mapping_type, coverage_level, justification, source_type, status,
  created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('requirement-mapping-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('framework-requirement-' || gs),
       pg_temp.demo_base_uuid('tenant-control-' || gs), pg_temp.demo_base_uuid('control-catalog-' || gs),
       CASE WHEN gs%7=0 THEN 'partial' ELSE 'exact' END,
       CASE WHEN gs%7=0 THEN 68 ELSE 94 END,
       CASE WHEN gs%7=0 THEN 'Cobertura parcial con acción de fortalecimiento activa.' ELSE 'Trazabilidad directa control-requisito verificada por el auditor demo.' END,
       'tcdx_interpretation', 'published', c.admin_id,
       now() - ((gs%90) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (tenant_id, requirement_id, tenant_control_id, catalog_control_id) DO UPDATE SET
  mapping_type=EXCLUDED.mapping_type, coverage_level=EXCLUDED.coverage_level,
  justification=EXCLUDED.justification, status='published', updated_at=now();

INSERT INTO grc_mapping_reviews (id, tenant_id, mapping_id, reviewer_id, decision, comment, created_at)
SELECT pg_temp.demo_visual_uuid('mapping-review-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('requirement-mapping-' || gs), c.auditor_id,
       'approved', 'Mapping revisado contra el catálogo tenant y la evidencia disponible.',
       now() - ((gs%60) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (id) DO NOTHING;

-- Evidence workflow, quality, links and 12-month readiness consumed by GRC panels.
INSERT INTO grc_evidence_requests (
  id, tenant_id, title, instructions, status, owner_id, reviewer_id, approver_id,
  due_at, valid_until, created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('evidence-request-' || gs), c.tenant_id,
       'Solicitud de evidencia ' || lpad(gs::text,2,'0') || ' — ' ||
         CASE WHEN gs%4=0 THEN 'Seguridad de acceso' WHEN gs%3=0 THEN 'Continuidad' WHEN gs%2=0 THEN 'Calidad del servicio' ELSE 'Gobierno y revisión' END,
       'Adjuntar registro vigente, indicar período y mantener trazabilidad con control y requisito.',
       CASE WHEN gs IN (4,11) THEN 'rejected' WHEN gs IN (6,17) THEN 'under_review' WHEN gs IN (9,19) THEN 'expired' ELSE 'approved' END,
       c.admin_id, c.auditor_id, c.admin_id,
       now() + ((gs-10) || ' days')::interval,
       (current_date + ((gs*9-30) || ' days')::interval)::date,
       c.admin_id, now() - ((gs*13) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,20) gs
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, due_at=EXCLUDED.due_at,
  valid_until=EXCLUDED.valid_until, updated_at=now();

INSERT INTO grc_evidence_requirements (id, tenant_id, request_id, requirement_type, requirement_id, mandatory)
SELECT pg_temp.demo_visual_uuid('evidence-requirement-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('evidence-request-' || gs), 'control',
       pg_temp.demo_base_uuid('tenant-control-' || (((gs-1)%55)+1)), true
FROM demo_visual_context c CROSS JOIN generate_series(1,20) gs
ON CONFLICT (tenant_id, request_id, requirement_type, requirement_id) DO UPDATE SET mandatory=true;

INSERT INTO grc_evidence_submissions (
  id, tenant_id, request_id, evidence_id, status, submitted_by, submitted_at
)
SELECT pg_temp.demo_visual_uuid('evidence-submission-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('evidence-request-' || gs),
       pg_temp.demo_base_uuid('evidence-' || (((gs-1)%80)+1)),
       CASE WHEN gs IN (4,11) THEN 'rejected' WHEN gs IN (6,17) THEN 'under_review' ELSE 'approved' END,
       c.admin_id, now() - ((gs*9) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,20) gs
ON CONFLICT (tenant_id, request_id, evidence_id) DO UPDATE SET status=EXCLUDED.status, submitted_at=EXCLUDED.submitted_at;

INSERT INTO grc_evidence_versions (
  id, tenant_id, submission_id, version, evidence_id, content_hash,
  source_type, integrity_metadata, created_by, created_at
)
SELECT pg_temp.demo_visual_uuid('evidence-version-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('evidence-submission-' || gs), 1,
       pg_temp.demo_base_uuid('evidence-' || (((gs-1)%80)+1)),
       encode(digest('demo-visual-evidence-version-' || gs,'sha256'),'hex'),
       'manual', jsonb_build_object('synthetic_metadata_only',true,'verified',true,'demo_slug','demo-tecdex'),
       c.admin_id, now() - ((gs*9) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,20) gs
ON CONFLICT (tenant_id, submission_id, version) DO NOTHING;

INSERT INTO grc_evidence_reviews (id, tenant_id, submission_id, reviewer_id, decision, reason, created_at)
SELECT pg_temp.demo_visual_uuid('evidence-review-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('evidence-submission-' || gs), c.auditor_id,
       CASE WHEN gs IN (4,11) THEN 'rejected' ELSE 'approved' END,
       CASE WHEN gs IN (4,11) THEN 'La evidencia no cubre completamente el período; se solicitó una nueva versión.' ELSE 'Pertinencia, vigencia e integridad verificadas.' END,
       now() - ((gs*8) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,20) gs
ON CONFLICT (id) DO NOTHING;

INSERT INTO grc_evidence_links (id, tenant_id, evidence_id, entity_type, entity_id, created_by, created_at)
SELECT pg_temp.demo_visual_uuid('evidence-link-control-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('evidence-' || gs), 'tenant_control',
       pg_temp.demo_base_uuid('tenant-control-' || (((gs-1)%55)+1)), c.admin_id,
       now() - ((gs%300) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,80) gs
ON CONFLICT (tenant_id, evidence_id, entity_type, entity_id) DO NOTHING;

INSERT INTO grc_evidence_quality_scores (
  id, tenant_id, evidence_id, score, formula_version, factors, limitations, calculated_at
)
SELECT pg_temp.demo_visual_uuid('evidence-quality-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('evidence-' || gs),
       CASE WHEN gs%13=0 THEN 54 WHEN gs%7=0 THEN 69 ELSE 82+(gs%14) END,
       'demo-evidence-quality-v1',
       jsonb_build_object('pertinence',75+(gs%23),'sufficiency',68+(gs%29),'freshness',62+(gs%35),'traceability',80+(gs%18),'consistency',76+(gs%21)),
       CASE WHEN gs%13=0 THEN jsonb_build_array('Requiere actualización y mayor cobertura temporal.') ELSE '[]'::jsonb END,
       now() - ((gs%45) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,80) gs
ON CONFLICT (tenant_id, evidence_id, formula_version) DO UPDATE SET
  score=EXCLUDED.score, factors=EXCLUDED.factors, limitations=EXCLUDED.limitations,
  calculated_at=EXCLUDED.calculated_at;

CREATE TEMP TABLE demo_readiness_dimensions (seq int PRIMARY KEY, code text, dimension text, source_table text, weight numeric) ON COMMIT DROP;
INSERT INTO demo_readiness_dimensions VALUES
  (1,'DEMO-READY-REQ','requirements','grc_framework_requirements',0.14),
  (2,'DEMO-READY-CTL','controls','control_health_scores',0.18),
  (3,'DEMO-READY-EVD','evidence','grc_evidence_quality_scores',0.18),
  (4,'DEMO-READY-RSK','risks','iso_risk_matrix_items',0.14),
  (5,'DEMO-READY-ACT','actions','action_plans',0.12),
  (6,'DEMO-READY-AUD','audits','grc_audit_workpapers',0.10),
  (7,'DEMO-READY-DOC','documents','evidences',0.07),
  (8,'DEMO-READY-OBJ','objectives','metric_definitions',0.07);

INSERT INTO grc_readiness_rules (
  id, tenant_id, code, description, dimension, source_table, filter_config,
  formula, weight, threshold, version, effective_from, is_active
)
SELECT pg_temp.demo_visual_uuid('readiness-rule-' || d.seq), c.tenant_id, d.code,
       'Regla demo reproducible de readiness para ' || d.dimension, d.dimension, d.source_table,
       jsonb_build_object('tenant_scoped',true,'demo_slug','demo-tecdex'),
       'porcentaje de registros válidos y vigentes', d.weight, 75, 1,
       current_date - 365, true
FROM demo_visual_context c CROSS JOIN demo_readiness_dimensions d
ON CONFLICT (tenant_id, code, version) DO UPDATE SET
  description=EXCLUDED.description, filter_config=EXCLUDED.filter_config,
  formula=EXCLUDED.formula, weight=EXCLUDED.weight, threshold=EXCLUDED.threshold, is_active=true;

INSERT INTO grc_readiness_snapshots (
  id, tenant_id, score, formula_version, input_hash, generated_by, generated_at,
  period_start, period_end, metadata
)
SELECT pg_temp.demo_visual_uuid('readiness-snapshot-' || month_no), c.tenant_id,
       72 + month_no*0.9 + (((month_no%4)-2)*1.4), 'demo-readiness-v1',
       encode(digest('demo-readiness-' || month_no,'sha256'),'hex'), c.admin_id,
       date_trunc('month',now()) - ((12-month_no) || ' months')::interval + interval '27 days',
       (date_trunc('month',current_date) - ((12-month_no) || ' months')::interval)::date,
       ((date_trunc('month',current_date) - ((11-month_no) || ' months')::interval)-interval '1 day')::date,
       jsonb_build_object('series_points',12,'trend','improving','demo_slug','demo-tecdex')
FROM demo_visual_context c CROSS JOIN generate_series(1,12) month_no
ON CONFLICT (tenant_id, input_hash) DO UPDATE SET score=EXCLUDED.score,
  generated_at=EXCLUDED.generated_at, metadata=EXCLUDED.metadata;

INSERT INTO grc_readiness_results (
  id, tenant_id, snapshot_id, rule_id, dimension, score, weight,
  included_records, excluded_records, pending_records, source_as_of
)
SELECT pg_temp.demo_visual_uuid('readiness-result-' || month_no || '-' || d.seq), c.tenant_id,
       pg_temp.demo_visual_uuid('readiness-snapshot-' || month_no),
       pg_temp.demo_visual_uuid('readiness-rule-' || d.seq), d.dimension,
       least(97, 65 + month_no*1.2 + d.seq + ((month_no*d.seq)%5)), d.weight,
       jsonb_build_array(jsonb_build_object('count',18+d.seq+month_no,'source',d.source_table)),
       CASE WHEN d.seq IN (3,4) THEN jsonb_build_array(jsonb_build_object('count',1,'reason','not_applicable')) ELSE '[]'::jsonb END,
       CASE WHEN (month_no+d.seq)%5=0 THEN jsonb_build_array(jsonb_build_object('count',2,'reason','review_pending')) ELSE '[]'::jsonb END,
       date_trunc('month',now()) - ((12-month_no) || ' months')::interval + interval '27 days'
FROM demo_visual_context c CROSS JOIN generate_series(1,12) month_no CROSS JOIN demo_readiness_dimensions d
ON CONFLICT (tenant_id, snapshot_id, rule_id) DO UPDATE SET
  score=EXCLUDED.score, included_records=EXCLUDED.included_records,
  excluded_records=EXCLUDED.excluded_records, pending_records=EXCLUDED.pending_records,
  source_as_of=EXCLUDED.source_as_of;

INSERT INTO grc_readiness_findings (
  id, tenant_id, snapshot_id, result_id, finding_code, severity,
  source_type, source_id, explanation
)
SELECT pg_temp.demo_visual_uuid('readiness-finding-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('readiness-snapshot-12'),
       pg_temp.demo_visual_uuid('readiness-result-12-' || (((gs-1)%8)+1)),
       'READY-GAP-' || lpad(gs::text,2,'0'),
       CASE WHEN gs IN (3,8) THEN 'high' WHEN gs IN (2,5,10) THEN 'medium' ELSE 'low' END,
       'finding', pg_temp.demo_base_uuid('finding-' || (((gs-1)%18)+1)),
       'Brecha de readiness trazada a evidencia, control, riesgo o acción con responsable activo.'
FROM demo_visual_context c CROSS JOIN generate_series(1,10) gs
ON CONFLICT (tenant_id, snapshot_id, finding_code, source_id) DO NOTHING;

-- Annual audit programme, scope, team, samples, workpapers, evidence, reports and follow-up.
INSERT INTO grc_audit_universe_entities (
  id, tenant_id, entity_type, entity_id, name, risk_score, owner_id, is_active, metadata
)
SELECT pg_temp.demo_visual_uuid('audit-universe-' || gs), c.tenant_id, 'process',
       pg_temp.demo_base_uuid('process-' || gs),
       (ARRAY['Dirección y planificación','Gestión comercial','Prestación del servicio','Operación tecnológica','Gestión de proveedores','Gestión de personas','Gestión documental','Auditoría interna','No conformidades','Mejora continua'])[gs],
       35 + gs*5, c.admin_id, true,
       jsonb_build_object('standards',jsonb_build_array('ISO9001','ISO27001'),'demo_slug','demo-tecdex')
FROM demo_visual_context c CROSS JOIN generate_series(1,10) gs
ON CONFLICT (tenant_id, entity_type, entity_id) DO UPDATE SET
  name=EXCLUDED.name, risk_score=EXCLUDED.risk_score, owner_id=EXCLUDED.owner_id, is_active=true;

INSERT INTO grc_audit_annual_plans (
  id, tenant_id, year, version, status, prioritization_criteria,
  approved_by, approved_at, created_by, created_at
)
SELECT pg_temp.demo_visual_uuid('audit-annual-plan-' || extract(year FROM current_date)::int), c.tenant_id,
       extract(year FROM current_date)::int, 1, 'approved',
       jsonb_build_object('method','risk_based','risk_weight',0.45,'control_health_weight',0.25,'regulatory_weight',0.20,'management_priority_weight',0.10),
       c.auditor_id, date_trunc('year',now()) - interval '20 days', c.admin_id,
       date_trunc('year',now()) - interval '30 days'
FROM demo_visual_context c
ON CONFLICT (tenant_id, year, version) DO UPDATE SET
  status='approved', prioritization_criteria=EXCLUDED.prioritization_criteria,
  approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at;

INSERT INTO grc_audit_plan_items (
  id, tenant_id, annual_plan_id, universe_entity_id, audit_id,
  priority, planned_start, planned_end, effort_hours, status
)
SELECT pg_temp.demo_visual_uuid('audit-plan-item-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('audit-annual-plan-' || extract(year FROM current_date)::int),
       pg_temp.demo_visual_uuid('audit-universe-' || (((gs-1)%10)+1)),
       pg_temp.demo_base_uuid('audit-' || gs),
       CASE WHEN gs IN (2,4) THEN 'high' WHEN gs=5 THEN 'critical' ELSE 'medium' END,
       (current_date - ((6-gs)*64) + 10), (current_date - ((6-gs)*64) + 16),
       36 + gs*6,
       CASE WHEN gs<=2 THEN 'completed' WHEN gs=3 THEN 'in_progress' ELSE 'scheduled' END
FROM demo_visual_context c CROSS JOIN generate_series(1,5) gs
ON CONFLICT (tenant_id, annual_plan_id, universe_entity_id) DO UPDATE SET
  audit_id=EXCLUDED.audit_id, priority=EXCLUDED.priority,
  planned_start=EXCLUDED.planned_start, planned_end=EXCLUDED.planned_end,
  effort_hours=EXCLUDED.effort_hours, status=EXCLUDED.status;

INSERT INTO grc_audit_programs (
  id, tenant_id, audit_id, version, status, objectives, scope, criteria,
  procedures, approved_by, approved_at, created_at
)
SELECT pg_temp.demo_visual_uuid('audit-program-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || gs), 1,
       CASE WHEN gs<=3 THEN 'approved' ELSE 'submitted' END,
       jsonb_build_array('Evaluar conformidad','Verificar efectividad','Confirmar trazabilidad y mejora'),
       jsonb_build_object('processes',jsonb_build_array(((gs-1)%10)+1,((gs+2)%10)+1),'sites',jsonb_build_array('Santiago','Cloud'),'standards',jsonb_build_array(CASE WHEN gs%2=0 THEN 'ISO27001' ELSE 'ISO9001' END)),
       jsonb_build_array('criterios ISO referenciados','políticas internas','controles tenant','evidencia vigente'),
       jsonb_build_array('entrevista','inspección','muestreo','reperformance','análisis de datos'),
       CASE WHEN gs<=3 THEN c.auditor_id ELSE NULL END,
       CASE WHEN gs<=3 THEN now() - ((gs*40) || ' days')::interval ELSE NULL END,
       now() - ((gs*55) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,5) gs
ON CONFLICT (tenant_id, audit_id, version) DO UPDATE SET
  status=EXCLUDED.status, objectives=EXCLUDED.objectives, scope=EXCLUDED.scope,
  criteria=EXCLUDED.criteria, procedures=EXCLUDED.procedures,
  approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at;

INSERT INTO grc_audit_team_members (
  id, tenant_id, audit_id, user_id, team_role, independence_status,
  declaration, declared_at
)
SELECT pg_temp.demo_visual_uuid('audit-team-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || gs), c.auditor_id, 'auditor_líder',
       'declared', jsonb_build_object('independent',true,'conflicts_disclosed',false),
       now() - ((gs*50) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,5) gs
ON CONFLICT (tenant_id, audit_id, user_id) DO UPDATE SET
  team_role=EXCLUDED.team_role, independence_status='declared', declaration=EXCLUDED.declaration,
  declared_at=EXCLUDED.declared_at;

INSERT INTO grc_audit_sample_plans (
  id, tenant_id, audit_id, population_description, population_size, method,
  sample_size, selection_criteria, random_seed, limitation, created_at
)
SELECT pg_temp.demo_visual_uuid('audit-sample-plan-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || gs),
       'Población de ejecuciones, evidencias y tickets del período auditado.',
       120 + gs*35, CASE WHEN gs%2=0 THEN 'Muestreo dirigido por riesgo' ELSE 'Muestreo sistemático reproducible' END,
       8 + gs, jsonb_build_object('high_risk',true,'period_coverage','12_months','seeded',true),
       'demo-audit-' || gs, 'Muestra sintética para demo; no extrapola fuera del alcance.',
       now() - ((gs*45) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,5) gs
ON CONFLICT (id) DO UPDATE SET population_size=EXCLUDED.population_size,
  method=EXCLUDED.method, sample_size=EXCLUDED.sample_size,
  selection_criteria=EXCLUDED.selection_criteria, limitation=EXCLUDED.limitation;

INSERT INTO grc_audit_sample_items (
  id, tenant_id, sample_plan_id, population_reference, selection_reason, result, exception_detail
)
SELECT pg_temp.demo_visual_uuid('audit-sample-item-' || audit_no || '-' || item_no), c.tenant_id,
       pg_temp.demo_visual_uuid('audit-sample-plan-' || audit_no),
       'MUESTRA-' || audit_no || '-' || lpad(item_no::text,2,'0'),
       CASE WHEN item_no<=3 THEN 'Riesgo alto' ELSE 'Cobertura temporal y representatividad' END,
       CASE WHEN item_no IN (4,9) THEN 'exception' ELSE 'conforming' END,
       CASE WHEN item_no IN (4,9) THEN 'Desviación menor vinculada a hallazgo y acción.' ELSE NULL END
FROM demo_visual_context c CROSS JOIN generate_series(1,5) audit_no CROSS JOIN generate_series(1,10) item_no
ON CONFLICT (tenant_id, sample_plan_id, population_reference) DO UPDATE SET
  result=EXCLUDED.result, exception_detail=EXCLUDED.exception_detail;

INSERT INTO grc_audit_workpapers (
  id, tenant_id, audit_id, code, version, objective, procedure_text,
  population, sample_summary, result, conclusion, status,
  prepared_by, reviewed_by, reviewed_at, content_hash, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('audit-workpaper-' || audit_no || '-' || paper_no), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || audit_no),
       'PT-' || audit_no || '-' || lpad(paper_no::text,2,'0'), 1,
       CASE paper_no WHEN 1 THEN 'Evaluar diseño del control' WHEN 2 THEN 'Probar operación durante el período' ELSE 'Verificar evidencia, excepción y cierre' END,
       'Inspeccionar diseño, seleccionar muestra, contrastar evidencia y documentar conclusión.',
       'Controles y registros del proceso en alcance.',
       '10 elementos, cobertura anual, énfasis en riesgo alto.',
       CASE WHEN (audit_no+paper_no)%5=0 THEN 'Excepción menor; acción de mejora abierta.' ELSE 'Prueba satisfactoria con trazabilidad suficiente.' END,
       CASE WHEN (audit_no+paper_no)%5=0 THEN 'Parcialmente efectivo' ELSE 'Efectivo' END,
       CASE WHEN audit_no<=3 THEN 'approved' ELSE 'submitted' END,
       c.auditor_id, CASE WHEN audit_no<=3 THEN c.admin_id ELSE NULL END,
       CASE WHEN audit_no<=3 THEN now() - ((audit_no*35+paper_no) || ' days')::interval ELSE NULL END,
       encode(digest('demo-workpaper-' || audit_no || '-' || paper_no,'sha256'),'hex'),
       now() - ((audit_no*40+paper_no) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,5) audit_no CROSS JOIN generate_series(1,3) paper_no
ON CONFLICT (tenant_id, audit_id, code, version) DO UPDATE SET
  result=EXCLUDED.result, conclusion=EXCLUDED.conclusion, status=EXCLUDED.status,
  reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at,
  content_hash=EXCLUDED.content_hash, updated_at=now();

INSERT INTO grc_audit_interviews (
  id, tenant_id, audit_id, scheduled_at, participants, agenda,
  questions_answers, confirmation_status, confidentiality, created_by, created_at
)
SELECT pg_temp.demo_visual_uuid('audit-interview-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || gs), now() - ((gs*42) || ' days')::interval,
       jsonb_build_array(jsonb_build_object('role','owner del proceso'),jsonb_build_object('role','auditor líder')),
       'Diseño, ejecución, excepciones, riesgos y oportunidades de mejora.',
       jsonb_build_array(jsonb_build_object('question','¿Cómo se monitorea el control?','answer','Medición mensual, evidencia y revisión independiente.')),
       CASE WHEN gs<=3 THEN 'confirmed' ELSE 'pending' END,
       'Uso interno y trazabilidad de auditoría.', c.auditor_id,
       now() - ((gs*42) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,5) gs
ON CONFLICT (id) DO UPDATE SET confirmation_status=EXCLUDED.confirmation_status,
  questions_answers=EXCLUDED.questions_answers;

INSERT INTO grc_audit_evidence_links (tenant_id, audit_id, evidence_id, workpaper_id, linked_by, linked_at)
SELECT c.tenant_id, pg_temp.demo_base_uuid('audit-' || audit_no),
       pg_temp.demo_base_uuid('evidence-' || (((audit_no*11+paper_no-1)%80)+1)),
       pg_temp.demo_visual_uuid('audit-workpaper-' || audit_no || '-' || paper_no),
       c.auditor_id, now() - ((audit_no*35+paper_no) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,5) audit_no CROSS JOIN generate_series(1,3) paper_no
ON CONFLICT (tenant_id, audit_id, evidence_id, workpaper_id) DO NOTHING;

INSERT INTO grc_audit_supervisor_reviews (
  id, tenant_id, audit_id, workpaper_id, reviewer_id, decision,
  observations, version, assigned_to, evidence_id, confirmation_hash, created_at
)
SELECT pg_temp.demo_visual_uuid('audit-supervisor-review-' || audit_no || '-' || paper_no), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || audit_no),
       pg_temp.demo_visual_uuid('audit-workpaper-' || audit_no || '-' || paper_no), c.admin_id,
       CASE WHEN (audit_no+paper_no)%6=0 THEN 'changes_requested' ELSE 'approved' END,
       CASE WHEN (audit_no+paper_no)%6=0 THEN 'Agregar evidencia del mes más reciente.' ELSE 'Prueba y conclusión consistentes.' END,
       1, c.auditor_id,
       pg_temp.demo_base_uuid('evidence-' || (((audit_no*11+paper_no-1)%80)+1)),
       encode(digest('demo-supervisor-review-' || audit_no || '-' || paper_no,'sha256'),'hex'),
       now() - ((audit_no*32+paper_no) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,5) audit_no CROSS JOIN generate_series(1,3) paper_no
ON CONFLICT (id) DO UPDATE SET decision=EXCLUDED.decision,
  observations=EXCLUDED.observations, confirmation_hash=EXCLUDED.confirmation_hash;

INSERT INTO grc_audit_reports (
  id, tenant_id, audit_id, version, status, report_format, file_url,
  content_hash, source_snapshot, approved_by, approved_at, created_at
)
SELECT pg_temp.demo_visual_uuid('audit-report-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || gs), 1,
       CASE WHEN gs<=2 THEN 'approved' ELSE 'submitted' END, 'pdf', NULL,
       encode(digest('demo-audit-report-metadata-' || gs,'sha256'),'hex'),
       jsonb_build_object('artifact_policy','generate_on_download','workpapers',3,'evidences',3,'findings',CASE WHEN gs%2=0 THEN 4 ELSE 3 END,'demo_slug','demo-tecdex'),
       CASE WHEN gs<=2 THEN c.admin_id ELSE NULL END,
       CASE WHEN gs<=2 THEN now() - ((gs*50) || ' days')::interval ELSE NULL END,
       now() - ((gs*52) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,5) gs
ON CONFLICT (tenant_id, audit_id, version, report_format) DO UPDATE SET
  status=EXCLUDED.status, file_url=NULL, content_hash=EXCLUDED.content_hash,
  source_snapshot=EXCLUDED.source_snapshot, approved_by=EXCLUDED.approved_by,
  approved_at=EXCLUDED.approved_at;

INSERT INTO grc_audit_followups (
  id, tenant_id, audit_id, finding_id, action_plan_id, owner_id,
  due_at, status, verification_notes, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('audit-followup-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('audit-' || (((gs-1)%5)+1)),
       pg_temp.demo_base_uuid('finding-' || (((gs-1)%18)+1)),
       pg_temp.demo_base_uuid('action-' || (((gs-1)%24)+1)), c.admin_id,
       now() + ((gs-7)*9 || ' days')::interval,
       CASE WHEN gs IN (3,8) THEN 'overdue' WHEN gs<=4 THEN 'verified' WHEN gs<=8 THEN 'in_progress' ELSE 'open' END,
       CASE WHEN gs<=4 THEN 'Efectividad confirmada con evidencia posterior al cierre.' ELSE 'Seguimiento activo; próxima revisión calendarizada.' END,
       now() - ((gs*17) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (id) DO UPDATE SET due_at=EXCLUDED.due_at, status=EXCLUDED.status,
  verification_notes=EXCLUDED.verification_notes, updated_at=now();

-- Phase 2: control assurance, suppliers, privacy, incidents and connector observability.
INSERT INTO grc_control_assurance (
  id, tenant_id, tenant_control_id, assurance_status, score, reason_codes,
  calculated_at, formula_version
)
SELECT pg_temp.demo_visual_uuid('phase2-control-assurance-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('tenant-control-' || gs),
       CASE WHEN gs%11=0 THEN 'ineffective' WHEN gs%7=0 THEN 'degraded' WHEN gs%5=0 THEN 'incomplete' ELSE 'effective' END,
       CASE WHEN gs%11=0 THEN 38 WHEN gs%7=0 THEN 61 WHEN gs%5=0 THEN 72 ELSE 88 END,
       CASE WHEN gs%11=0 THEN ARRAY['failed_test','overdue_action']
            WHEN gs%7=0 THEN ARRAY['partial_evidence'] ELSE ARRAY['design_and_operation_verified'] END,
       now() - ((gs%30) || ' days')::interval, 'phase2-assurance-demo-visual-v1'
FROM demo_visual_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (tenant_id, tenant_control_id) DO UPDATE SET
  assurance_status=EXCLUDED.assurance_status, score=EXCLUDED.score,
  reason_codes=EXCLUDED.reason_codes, calculated_at=EXCLUDED.calculated_at,
  formula_version=EXCLUDED.formula_version;

INSERT INTO grc_effectiveness_verifications (
  id, tenant_id, action_plan_id, outcome, criteria, result, verified_by,
  verified_at, evidence_ids, followup_due_at, metadata
)
SELECT pg_temp.demo_visual_uuid('effectiveness-verification-' || gs), c.tenant_id,
       pg_temp.demo_base_uuid('action-' || gs),
       CASE WHEN gs IN (4,9) THEN 'ineffective' WHEN gs IN (3,7,11) THEN 'partially_effective' ELSE 'effective' END,
       'Verificar reducción de recurrencia, cumplimiento del objetivo y evidencia posterior al cierre.',
       CASE WHEN gs IN (4,9) THEN 'Persisten excepciones; acción reabierta.'
            WHEN gs IN (3,7,11) THEN 'Mejora observable, pendiente completar un ciclo adicional.'
            ELSE 'Objetivo alcanzado y operación estable durante el período de observación.' END,
       c.auditor_id, now() - ((gs*14) || ' days')::interval,
       ARRAY[pg_temp.demo_base_uuid('evidence-' || (((gs*5-1)%80)+1))]::uuid[],
       CASE WHEN gs IN (3,4,7,9,11) THEN now() + ((gs*5) || ' days')::interval ELSE NULL END,
       jsonb_build_object('demo_slug','demo-tecdex','verification_window_days',30+gs)
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (id) DO UPDATE SET outcome=EXCLUDED.outcome, result=EXCLUDED.result,
  evidence_ids=EXCLUDED.evidence_ids, followup_due_at=EXCLUDED.followup_due_at,
  metadata=EXCLUDED.metadata;

INSERT INTO grc_suppliers (
  id, tenant_id, code, legal_name, trade_name, tax_identifier, country_code,
  status, criticality, inherent_risk_score, residual_risk_score, risk_level,
  owner_user_id, data_access_level, access_summary, approved_by, approved_at,
  next_assessment_at, metadata, created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('supplier-' || gs), c.tenant_id,
       'SUP-' || lpad(gs::text,2,'0'),
       (ARRAY['Andes Cloud SpA','Pacífico Data Center Ltda.','Nimbus Identity SpA','Sur Telecom Servicios','Cordillera Backup Ltda.','Austral People SaaS','Valle Fintech API','Atacama SOC SpA'])[gs],
       (ARRAY['Andes Cloud','Pacífico DC','Nimbus IAM','Sur Telecom','Cordillera Backup','Austral People','Valle API','Atacama SOC'])[gs],
       '76.500.' || lpad((100+gs)::text,3,'0') || '-' || (gs%9+1), 'CL',
       CASE WHEN gs=6 THEN 'remediation_required' WHEN gs=8 THEN 'reassessment_required' ELSE 'active' END,
       CASE WHEN gs IN (1,2,3,8) THEN 'critical' WHEN gs IN (4,5,7) THEN 'high' ELSE 'medium' END,
       58 + gs*4, 32 + gs*3,
       CASE WHEN gs IN (6,8) THEN 'high' WHEN gs IN (1,2,3,4) THEN 'medium' ELSE 'low' END,
       c.admin_id, CASE WHEN gs IN (1,3,6,7,8) THEN 'sensitive' WHEN gs IN (2,4,5) THEN 'confidential' ELSE 'internal' END,
       'Acceso limitado por contrato, mínimo privilegio, revisión trimestral y monitoreo de evidencias.',
       c.auditor_id, now() - ((gs*35) || ' days')::interval,
       now() + ((gs*24) || ' days')::interval,
       jsonb_build_object('services',1+(gs%3),'country_risk','low','demo_slug','demo-tecdex'),
       c.admin_id, now() - ((gs*45) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET
  legal_name=EXCLUDED.legal_name, trade_name=EXCLUDED.trade_name, status=EXCLUDED.status,
  criticality=EXCLUDED.criticality, inherent_risk_score=EXCLUDED.inherent_risk_score,
  residual_risk_score=EXCLUDED.residual_risk_score, risk_level=EXCLUDED.risk_level,
  data_access_level=EXCLUDED.data_access_level, next_assessment_at=EXCLUDED.next_assessment_at,
  metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO grc_supplier_history (
  id, tenant_id, supplier_id, from_status, to_status, reason, changed_by, changed_at, snapshot
)
SELECT pg_temp.demo_visual_uuid('supplier-history-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('supplier-' || gs), 'under_assessment',
       CASE WHEN gs=6 THEN 'remediation_required' WHEN gs=8 THEN 'reassessment_required' ELSE 'active' END,
       CASE WHEN gs IN (6,8) THEN 'Evaluación detectó brechas con tratamiento y fecha comprometida.' ELSE 'Due diligence aprobada y riesgo residual aceptado.' END,
       c.auditor_id, now() - ((gs*32) || ' days')::interval,
       jsonb_build_object('score',68+gs*3,'criticality',CASE WHEN gs<=3 THEN 'critical' ELSE 'high' END)
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET to_status=EXCLUDED.to_status, reason=EXCLUDED.reason,
  snapshot=EXCLUDED.snapshot;

INSERT INTO grc_supplier_services (
  id, tenant_id, supplier_id, name, description, service_criticality,
  process_id, operation_id, asset_id, dependency_type, active, metadata, created_at
)
SELECT pg_temp.demo_visual_uuid('supplier-service-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('supplier-' || gs),
       (ARRAY['Infraestructura cloud productiva','Colocation y energía','Identidad y autenticación','Conectividad primaria','Respaldo inmutable','Gestión de personas','Pagos y facturación','Monitoreo SOC 24x7'])[gs],
       'Servicio tercero integrado al mapa de dependencias, riesgos, controles, incidentes y continuidad.',
       CASE WHEN gs IN (1,2,3,8) THEN 'critical' ELSE 'high' END,
       pg_temp.demo_base_uuid('process-' || (((gs-1)%10)+1)),
       pg_temp.demo_base_uuid('operation-' || (((gs-1)%10)+1)),
       pg_temp.demo_base_uuid('asset-' || (((gs-1)%8)+1)),
       CASE WHEN gs IN (1,2,3,8) THEN 'critical' ELSE 'important' END,
       true, jsonb_build_object('rto_minutes',60+gs*15,'demo_slug','demo-tecdex'),
       now() - ((gs*40) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET service_criticality=EXCLUDED.service_criticality,
  dependency_type=EXCLUDED.dependency_type, active=true, metadata=EXCLUDED.metadata;

INSERT INTO grc_supplier_contracts (
  id, tenant_id, supplier_id, contract_number, title, starts_on, ends_on,
  renewal_on, status, security_terms, privacy_terms, exit_terms,
  owner_user_id, document_id, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('supplier-contract-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('supplier-' || gs), 'CTR-DEMO-' || lpad(gs::text,3,'0'),
       'Contrato de servicio y seguridad — ' || (ARRAY['Cloud','Data Center','Identidad','Telecom','Backup','Personas','Fintech','SOC'])[gs],
       current_date - 500, current_date + (120+gs*35), current_date + (90+gs*30),
       CASE WHEN gs=6 THEN 'renewal_due' ELSE 'active' END,
       jsonb_build_object('incident_notification_hours',4,'audit_right',true,'encryption_required',true),
       jsonb_build_object('processor_terms',true,'deletion_days',30,'subprocessors_reviewed',true),
       jsonb_build_object('access_revocation_days',1,'data_return_days',15,'deletion_certificate',true),
       c.admin_id, NULL, now() - interval '14 months', now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (tenant_id, supplier_id, contract_number) DO UPDATE SET
  ends_on=EXCLUDED.ends_on, renewal_on=EXCLUDED.renewal_on, status=EXCLUDED.status,
  security_terms=EXCLUDED.security_terms, privacy_terms=EXCLUDED.privacy_terms,
  exit_terms=EXCLUDED.exit_terms, updated_at=now();

INSERT INTO grc_questionnaire_templates (id, tenant_id, code, name, domain, status, created_by, created_at)
SELECT pg_temp.demo_visual_uuid('phase2-questionnaire'), c.tenant_id,
       'TPRM-CRITICAL-2026', 'Due diligence de proveedores críticos', 'security_privacy_continuity',
       'published', c.admin_id, now() - interval '11 months'
FROM demo_visual_context c
ON CONFLICT (tenant_id, code) DO UPDATE SET name=EXCLUDED.name, domain=EXCLUDED.domain, status='published';

INSERT INTO grc_questionnaire_versions (
  id, tenant_id, template_id, version, status, scoring_model, published_by, published_at, created_at
)
SELECT pg_temp.demo_visual_uuid('phase2-questionnaire-version'), c.tenant_id,
       pg_temp.demo_visual_uuid('phase2-questionnaire'), 1, 'published',
       jsonb_build_object('scale','0-100','pass',75,'critical_question_floor',60,'human_approval',true),
       c.auditor_id, now() - interval '10 months', now() - interval '11 months'
FROM demo_visual_context c
ON CONFLICT (template_id, version) DO NOTHING;

INSERT INTO grc_questionnaire_sections (id, tenant_id, version_id, code, title, sort_order, condition)
SELECT pg_temp.demo_visual_uuid('phase2-questionnaire-section-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('phase2-questionnaire-version'),
       (ARRAY['GOV','SEC','PRI','BCM'])[gs],
       (ARRAY['Gobierno y assurance','Seguridad de la información','Privacidad y datos','Continuidad y resiliencia'])[gs],
       gs, '{}'::jsonb
FROM demo_visual_context c CROSS JOIN generate_series(1,4) gs
ON CONFLICT (version_id, code) DO UPDATE SET title=EXCLUDED.title, sort_order=EXCLUDED.sort_order;

INSERT INTO grc_questionnaire_questions (
  id, tenant_id, section_id, code, prompt, answer_type, required, weight,
  options, condition, evidence_required, risk_mapping, control_mapping, sort_order
)
SELECT pg_temp.demo_visual_uuid('phase2-question-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('phase2-questionnaire-section-' || (((gs-1)%4)+1)),
       'Q-' || lpad(gs::text,2,'0'),
       CASE ((gs-1)%4)+1
         WHEN 1 THEN '¿Existe gobierno formal, responsables y revisión independiente del servicio?'
         WHEN 2 THEN '¿Los controles de acceso, cifrado, vulnerabilidades y monitoreo se prueban periódicamente?'
         WHEN 3 THEN '¿El tratamiento de datos, subencargados, retención y eliminación están contractualmente gobernados?'
         ELSE '¿El servicio cuenta con continuidad probada, RTO/RPO y comunicaciones de crisis?' END,
       CASE WHEN gs%5=0 THEN 'text' ELSE 'boolean' END, true, CASE WHEN gs%4=0 THEN 2 ELSE 1 END,
       CASE WHEN gs%5=0 THEN '[]'::jsonb ELSE jsonb_build_array('Sí','Parcial','No') END,
       '{}'::jsonb, gs%3=0,
       jsonb_build_object('risk_category',CASE ((gs-1)%4)+1 WHEN 1 THEN 'governance' WHEN 2 THEN 'security' WHEN 3 THEN 'privacy' ELSE 'continuity' END),
       jsonb_build_object('tenant_control_id',pg_temp.demo_base_uuid('tenant-control-' || (((gs-1)%55)+1))),
       gs
FROM demo_visual_context c CROSS JOIN generate_series(1,16) gs
ON CONFLICT (section_id, code) DO UPDATE SET prompt=EXCLUDED.prompt, weight=EXCLUDED.weight,
  evidence_required=EXCLUDED.evidence_required, risk_mapping=EXCLUDED.risk_mapping,
  control_mapping=EXCLUDED.control_mapping;

INSERT INTO grc_supplier_assessments (
  id, tenant_id, supplier_id, questionnaire_version_id, status, due_at,
  submitted_at, score, inherent_risk_score, residual_risk_score,
  reviewer_user_id, approved_by, approved_at, expires_at,
  decision_reason, created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('supplier-assessment-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('supplier-' || gs),
       pg_temp.demo_visual_uuid('phase2-questionnaire-version'),
       CASE WHEN gs=6 THEN 'remediation_required' WHEN gs=8 THEN 'under_review' ELSE 'approved' END,
       now() + ((gs*12) || ' days')::interval, now() - ((gs*27) || ' days')::interval,
       64 + gs*4, 58 + gs*4, 35 + gs*3, c.auditor_id,
       CASE WHEN gs NOT IN (6,8) THEN c.auditor_id ELSE NULL END,
       CASE WHEN gs NOT IN (6,8) THEN now() - ((gs*24) || ' days')::interval ELSE NULL END,
       now() + ((300-gs*15) || ' days')::interval,
       CASE WHEN gs=6 THEN 'Plan de remediación requerido por cobertura de continuidad.'
            WHEN gs=8 THEN 'Revisión humana pendiente por evidencia de monitoreo.'
            ELSE 'Riesgo residual dentro de apetito y obligaciones contractuales verificadas.' END,
       c.admin_id, now() - ((gs*32) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, due_at=EXCLUDED.due_at,
  score=EXCLUDED.score, residual_risk_score=EXCLUDED.residual_risk_score,
  approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at,
  decision_reason=EXCLUDED.decision_reason, updated_at=now();

INSERT INTO grc_supplier_answers (
  id, tenant_id, assessment_id, question_id, answer, score, observation,
  evidence_ids, answered_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('supplier-answer-' || supplier_no || '-' || question_no), c.tenant_id,
       pg_temp.demo_visual_uuid('supplier-assessment-' || supplier_no),
       pg_temp.demo_visual_uuid('phase2-question-' || question_no),
       CASE WHEN (supplier_no+question_no)%7=0 THEN jsonb_build_object('value','Parcial') ELSE jsonb_build_object('value','Sí') END,
       CASE WHEN (supplier_no+question_no)%7=0 THEN 0.5 ELSE 1 END,
       CASE WHEN (supplier_no+question_no)%7=0 THEN 'Brecha menor incluida en el plan de remediación.' ELSE 'Respuesta y evidencia revisadas.' END,
       ARRAY[pg_temp.demo_base_uuid('evidence-' || (((supplier_no*9+question_no-1)%80)+1))]::uuid[],
       now() - ((supplier_no*24+question_no) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) supplier_no CROSS JOIN generate_series(1,16) question_no
ON CONFLICT (tenant_id, assessment_id, question_id) DO UPDATE SET
  answer=EXCLUDED.answer, score=EXCLUDED.score, observation=EXCLUDED.observation,
  evidence_ids=EXCLUDED.evidence_ids, updated_at=now();

INSERT INTO grc_supplier_assessment_history (
  id, tenant_id, assessment_id, from_status, to_status, comment, changed_by, changed_at, snapshot
)
SELECT pg_temp.demo_visual_uuid('supplier-assessment-history-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('supplier-assessment-' || gs), 'under_review',
       CASE WHEN gs=6 THEN 'remediation_required' WHEN gs=8 THEN 'under_review' ELSE 'approved' END,
       'Decisión documentada con scoring, evidencia y riesgo residual.', c.auditor_id,
       now() - ((gs*23) || ' days')::interval,
       jsonb_build_object('score',64+gs*4,'residual_risk',35+gs*3)
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET to_status=EXCLUDED.to_status, comment=EXCLUDED.comment,
  snapshot=EXCLUDED.snapshot;

INSERT INTO privacy_processing_activities (
  id, tenant_id, code, name, description, status, process_id, operation_id,
  owner_user_id, legal_basis, legal_basis_source, purposes, data_subject_categories,
  data_categories, sensitive_data_categories, data_sources, recipients,
  retention_period, retention_basis, deletion_method, international_transfers,
  systems, asset_ids, primary_supplier_id, dpia_required, next_review_at,
  approved_by, approved_at, version, metadata, created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('processing-activity-' || gs), c.tenant_id,
       'RAT-' || lpad(gs::text,2,'0'),
       (ARRAY['Gestión de clientes B2B','Soporte y mesa de ayuda','Gestión de colaboradores','Selección y contratación','Marketing autorizado','Facturación y cobranza','Monitoreo de seguridad','Control de acceso físico','Gestión de proveedores','Continuidad y recuperación'])[gs],
       'Actividad operativa gobernada con base jurídica, retención, sistemas, proveedores, riesgos y revisión.',
       CASE WHEN gs IN (5,9) THEN 'review_required' ELSE 'active' END,
       pg_temp.demo_base_uuid('process-' || gs), pg_temp.demo_base_uuid('operation-' || gs), c.admin_id,
       CASE WHEN gs IN (3,4) THEN 'obligación laboral' WHEN gs=5 THEN 'consentimiento' ELSE 'ejecución contractual e interés legítimo evaluado' END,
       'Registro de base jurídica y análisis de proporcionalidad Demo Tecdex.',
       jsonb_build_array('prestación del servicio','seguridad','cumplimiento','mejora'),
       CASE WHEN gs IN (3,4) THEN jsonb_build_array('colaboradores','candidatos') ELSE jsonb_build_array('clientes','usuarios autorizados') END,
       jsonb_build_array('identificación','contacto','uso del servicio'),
       CASE WHEN gs IN (3,4,7) THEN jsonb_build_array('laborales','autenticación','registros de seguridad') ELSE '[]'::jsonb END,
       jsonb_build_array('portal','contratos','operación'), jsonb_build_array('áreas autorizadas','proveedor crítico'),
       CASE WHEN gs%3=0 THEN '5 años' ELSE 'vigencia contractual + 2 años' END,
       'Obligación legal, contractual y defensa de derechos.', 'eliminación segura y registro de ejecución',
       CASE WHEN gs IN (1,2,7) THEN jsonb_build_array(jsonb_build_object('country','US','mechanism','cláusulas contractuales y evaluación')) ELSE '[]'::jsonb END,
       jsonb_build_array(jsonb_build_object('name','TCDX SaaS'),jsonb_build_object('name','Repositorio gobernado')),
       ARRAY[pg_temp.demo_base_uuid('asset-' || (((gs-1)%8)+1))]::uuid[],
       pg_temp.demo_visual_uuid('supplier-' || (((gs-1)%8)+1)), gs IN (3,4,7,10),
       now() + ((gs*18) || ' days')::interval, c.auditor_id,
       now() - ((gs*24) || ' days')::interval, 1,
       jsonb_build_object('risk_score',42+gs*4,'demo_slug','demo-tecdex'), c.admin_id,
       now() - ((gs*50) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,10) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name=EXCLUDED.name, status=EXCLUDED.status, legal_basis=EXCLUDED.legal_basis,
  purposes=EXCLUDED.purposes, data_categories=EXCLUDED.data_categories,
  sensitive_data_categories=EXCLUDED.sensitive_data_categories,
  international_transfers=EXCLUDED.international_transfers, systems=EXCLUDED.systems,
  dpia_required=EXCLUDED.dpia_required, next_review_at=EXCLUDED.next_review_at,
  approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at,
  metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO privacy_processing_versions (
  id, tenant_id, processing_activity_id, version, snapshot, change_reason, created_by, created_at
)
SELECT pg_temp.demo_visual_uuid('processing-version-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('processing-activity-' || gs), 1,
       jsonb_build_object('status',CASE WHEN gs IN (5,9) THEN 'review_required' ELSE 'active' END,'retention','governed','dpia_required',gs IN (3,4,7,10)),
       'Versión inicial aprobada para experiencia demo comercial.', c.admin_id,
       now() - ((gs*45) || ' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,10) gs
ON CONFLICT (tenant_id, processing_activity_id, version) DO NOTHING;

INSERT INTO privacy_processors (
  id, tenant_id, processing_activity_id, supplier_id, role, purpose,
  contract_id, tprm_assessment_id, valid_from, valid_to, status, created_at
)
SELECT pg_temp.demo_visual_uuid('privacy-processor-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('processing-activity-' || gs),
       pg_temp.demo_visual_uuid('supplier-' || (((gs-1)%8)+1)), 'processor',
       'Soporte tecnológico sujeto a instrucciones, confidencialidad y controles verificados.',
       pg_temp.demo_visual_uuid('supplier-contract-' || (((gs-1)%8)+1)),
       pg_temp.demo_visual_uuid('supplier-assessment-' || (((gs-1)%8)+1)),
       current_date - 360, current_date + 360, 'active', now() - interval '11 months'
FROM demo_visual_context c CROSS JOIN generate_series(1,10) gs
ON CONFLICT (tenant_id, processing_activity_id, supplier_id, role) DO UPDATE SET
  contract_id=EXCLUDED.contract_id, tprm_assessment_id=EXCLUDED.tprm_assessment_id,
  valid_to=EXCLUDED.valid_to, status='active';

INSERT INTO privacy_dpias (
  id, tenant_id, processing_activity_id, status, screening,
  necessity_assessment, proportionality_assessment, consultation,
  residual_risk_level, conditions, owner_user_id, approved_by, approved_at,
  next_review_at, version, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('dpia-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('processing-activity-' || (ARRAY[3,4,7,10,1,2])[gs]),
       CASE WHEN gs=5 THEN 'review_required' WHEN gs=6 THEN 'pending_approval' ELSE 'approved' END,
       jsonb_build_object('large_scale',gs IN (1,3,5),'systematic_monitoring',gs IN (3,5),'sensitive_data',gs IN (1,2,3)),
       'El tratamiento es necesario para la finalidad documentada y no existe una alternativa menos intrusiva equivalente.',
       'Acceso restringido, minimización, retención y revisión mantienen proporcionalidad.',
       jsonb_build_object('security',true,'legal',true,'process_owner',true),
       CASE WHEN gs IN (3,5) THEN 'high' WHEN gs IN (2,6) THEN 'medium' ELSE 'low' END,
       CASE WHEN gs IN (3,5) THEN jsonb_build_array('fortalecer monitoreo','revisar evidencia trimestral') ELSE jsonb_build_array('mantener controles') END,
       c.admin_id, CASE WHEN gs<=4 THEN c.auditor_id ELSE NULL END,
       CASE WHEN gs<=4 THEN now() - ((gs*30) || ' days')::interval ELSE NULL END,
       now() + ((gs*40) || ' days')::interval, 1,
       now() - ((gs*45) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,6) gs
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, screening=EXCLUDED.screening,
  residual_risk_level=EXCLUDED.residual_risk_level, conditions=EXCLUDED.conditions,
  approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at,
  next_review_at=EXCLUDED.next_review_at, updated_at=now();

INSERT INTO privacy_dpia_risks (
  id, tenant_id, dpia_id, title, description, likelihood, impact,
  residual_likelihood, residual_impact, tenant_control_id, treatment,
  owner_user_id, status
)
SELECT pg_temp.demo_visual_uuid('dpia-risk-' || gs), c.tenant_id,
       pg_temp.demo_visual_uuid('dpia-' || (((gs-1)%6)+1)),
       CASE WHEN gs%3=0 THEN 'Acceso excesivo a datos' WHEN gs%2=0 THEN 'Retención superior a la necesaria' ELSE 'Transferencia o proveedor sin evidencia vigente' END,
       'Riesgo de privacidad evaluado con probabilidad, impacto, control y tratamiento trazables.',
       2+(gs%3), 3+(gs%3), 1+(gs%2), 2+(gs%2),
       pg_temp.demo_base_uuid('tenant-control-' || (((gs*3-1)%55)+1)),
       'Fortalecer control, automatizar revisión y verificar evidencia posterior.', c.admin_id,
       CASE WHEN gs IN (4,9) THEN 'open' WHEN gs IN (3,8) THEN 'accepted' ELSE 'treated' END
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (id) DO UPDATE SET residual_likelihood=EXCLUDED.residual_likelihood,
  residual_impact=EXCLUDED.residual_impact, treatment=EXCLUDED.treatment,
  status=EXCLUDED.status;

INSERT INTO privacy_data_subject_requests (
  id, tenant_id, request_number, request_type, status, subject_reference,
  identity_verification, received_at, due_at, extension_until, extension_reason,
  owner_user_id, processing_activity_ids, systems, response_summary,
  response_evidence_ids, approved_by, approved_at, closed_at,
  escalation_level, normative_source, created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('privacy-request-' || gs), c.tenant_id,
       'DSR-2026-' || lpad(gs::text,3,'0'),
       (ARRAY['access','rectification','deletion','restriction','objection','portability','withdraw_consent','other'])[((gs-1)%8)+1],
       CASE WHEN gs<=5 THEN 'closed' WHEN gs<=8 THEN 'responded' WHEN gs=9 THEN 'extended' ELSE 'in_progress' END,
       encode(digest('demo-subject-' || gs,'sha256'),'hex'),
       jsonb_build_object('method','two_factor','verified',gs<>11),
       now() - ((gs*11) || ' days')::interval,
       now() + ((20-gs) || ' days')::interval,
       CASE WHEN gs=9 THEN now()+interval '25 days' ELSE NULL END,
       CASE WHEN gs=9 THEN 'Complejidad y múltiples sistemas; extensión comunicada.' ELSE NULL END,
       c.admin_id, ARRAY[pg_temp.demo_visual_uuid('processing-activity-' || (((gs-1)%10)+1))]::uuid[],
       jsonb_build_array('TCDX SaaS','Repositorio gobernado'),
       CASE WHEN gs<=8 THEN 'Solicitud atendida con alcance, decisiones y evidencia documentados.' ELSE NULL END,
       CASE WHEN gs<=8 THEN ARRAY[pg_temp.demo_base_uuid('evidence-' || (((gs*4-1)%80)+1))]::uuid[] ELSE '{}'::uuid[] END,
       CASE WHEN gs<=8 THEN c.auditor_id ELSE NULL END,
       CASE WHEN gs<=8 THEN now() - ((gs*4) || ' days')::interval ELSE NULL END,
       CASE WHEN gs<=5 THEN now() - ((gs*3) || ' days')::interval ELSE NULL END,
       CASE WHEN gs IN (9,11) THEN 2 ELSE 0 END,
       'Política de privacidad, contrato y normativa aplicable evaluada por responsable.',
       c.admin_id, now() - ((gs*11) || ' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (tenant_id, request_number) DO UPDATE SET
  status=EXCLUDED.status, due_at=EXCLUDED.due_at, extension_until=EXCLUDED.extension_until,
  response_summary=EXCLUDED.response_summary, response_evidence_ids=EXCLUDED.response_evidence_ids,
  approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at,
  closed_at=EXCLUDED.closed_at, escalation_level=EXCLUDED.escalation_level,
  updated_at=now();

-- Privacy breaches and incidents provide timelines, impact, cause and closure detail.
INSERT INTO grc_incidents (
  id, tenant_id, incident_number, title, description, status, category, priority,
  calculated_severity, confirmed_severity, severity_inputs,
  severity_formula_version, severity_overridden, severity_approved_by, severity_confirmed_at,
  commander_user_id, reported_by, reported_at, detected_at, contained_at, recovered_at,
  resolved_at, closed_at, recurrence_key, process_id, operation_id, asset_id, supplier_id,
  privacy_impact, regulatory_impact, customer_impact, financial_impact, duration_minutes,
  closure_summary, effectiveness_verified, metadata, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('incident-' || gs), c.tenant_id,
       'INC-2026-' || lpad(gs::text,3,'0'),
       (ARRAY['Intentos de acceso anómalo en repositorio','Interrupción parcial del portal cliente','Configuración incorrecta de permisos','Falla de integración de evidencias','Exposición acotada de metadatos','Degradación de servicio de proveedor','Alerta de malware contenida','Error de procesamiento de solicitudes','Pérdida temporal de telemetría','Incumplimiento de ventana de respaldo','Acceso privilegiado sin MFA','Indisponibilidad de reportes ejecutivos'])[((gs-1)%12)+1],
       'Incidente comercial trazable desde detección hasta recuperación, con impacto y verificación de efectividad.',
       CASE WHEN gs<=3 THEN 'closed' WHEN gs<=5 THEN 'post_incident_review' WHEN gs<=7 THEN 'resolved' WHEN gs<=9 THEN 'recovering' WHEN gs=10 THEN 'contained' ELSE 'active' END,
       (ARRAY['security','availability','access','integration','privacy','supplier','malware','quality','monitoring','continuity','identity','reporting'])[((gs-1)%12)+1],
       CASE WHEN gs IN (5,11) THEN 'urgent' WHEN gs%3=0 THEN 'high' WHEN gs%3=1 THEN 'medium' ELSE 'low' END,
       CASE WHEN gs IN (5,11) THEN 'critical' WHEN gs%3=0 THEN 'high' WHEN gs%3=1 THEN 'medium' ELSE 'low' END,
       CASE WHEN gs IN (5,11) THEN 'critical' WHEN gs%3=0 THEN 'high' WHEN gs%3=1 THEN 'medium' ELSE 'low' END,
       jsonb_build_object('confidentiality',1+(gs%5),'integrity',1+((gs+1)%5),'availability',1+((gs+2)%5),'customer_scope',gs*3),
       'incident-severity-v1', false, c.auditor_id, now()-((gs*9-1)||' days')::interval,
       c.admin_id, c.auditor_id, now()-(gs*9||' days')::interval, now()-(gs*9||' days')::interval+interval '20 minutes',
       CASE WHEN gs<=10 THEN now()-(gs*9||' days')::interval+interval '3 hours' END,
       CASE WHEN gs<=9 THEN now()-(gs*9||' days')::interval+interval '9 hours' END,
       CASE WHEN gs<=7 THEN now()-(gs*9||' days')::interval+interval '16 hours' END,
       CASE WHEN gs<=3 THEN now()-(gs*9||' days')::interval+interval '4 days' END,
       'recurrence-' || (((gs-1)%4)+1), pg_temp.demo_base_uuid('process-'||(((gs-1)%10)+1)),
       pg_temp.demo_base_uuid('operation-'||(((gs-1)%10)+1)), pg_temp.demo_base_uuid('asset-'||(((gs-1)%8)+1)),
       CASE WHEN gs IN (6,12) THEN pg_temp.demo_visual_uuid('supplier-'||CASE WHEN gs=6 THEN 1 ELSE 5 END) END,
       gs IN (5,8), gs IN (5,11), gs IN (2,5,6,12), gs*185000, gs*42,
       CASE WHEN gs<=7 THEN 'Servicio estabilizado; causa y controles correctivos verificados.' END,
       gs<=3, jsonb_build_object('demo_slug','demo-tecdex','linked_risk',((gs*2-1)%24)+1),
       now()-(gs*9||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (tenant_id, incident_number) DO UPDATE SET
  status=EXCLUDED.status, priority=EXCLUDED.priority, calculated_severity=EXCLUDED.calculated_severity,
  confirmed_severity=EXCLUDED.confirmed_severity, contained_at=EXCLUDED.contained_at,
  recovered_at=EXCLUDED.recovered_at, resolved_at=EXCLUDED.resolved_at, closed_at=EXCLUDED.closed_at,
  closure_summary=EXCLUDED.closure_summary, effectiveness_verified=EXCLUDED.effectiveness_verified,
  metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO privacy_breaches (
  id, tenant_id, breach_number, processing_activity_id, incident_id, status, occurred_at,
  detected_at, data_categories, affected_subjects_estimate, impact_summary,
  notification_assessment, notification_due_at, authority_notified_at, subjects_notified_at,
  owner_user_id, closed_by, closed_at, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('privacy-breach-'||gs), c.tenant_id,
       'BR-2026-'||lpad(gs::text,3,'0'), pg_temp.demo_visual_uuid('processing-activity-'||(((gs*2-1)%10)+1)),
       pg_temp.demo_visual_uuid('incident-'||CASE WHEN gs=1 THEN 5 WHEN gs=2 THEN 8 ELSE 11 END),
       (ARRAY['closed','notified','notification_required'])[gs], now()-(gs*37||' days')::interval,
       now()-(gs*37||' days')::interval+interval '35 minutes',
       jsonb_build_array('identificación','contacto',CASE WHEN gs=3 THEN 'autenticación' ELSE 'uso de plataforma' END),
       gs*28, 'Exposición acotada, contenida y evaluada con registro de decisión de notificación.',
       jsonb_build_object('risk_to_rights',CASE WHEN gs=3 THEN 'high' ELSE 'medium' END,'authority_required',gs>=2,'subjects_required',gs=3),
       now()-(gs*37||' days')::interval+interval '72 hours',
       CASE WHEN gs>=2 THEN now()-(gs*37||' days')::interval+interval '46 hours' END,
       CASE WHEN gs=3 THEN now()-(gs*37||' days')::interval+interval '60 hours' END,
       c.admin_id, CASE WHEN gs=1 THEN c.auditor_id END,
       CASE WHEN gs=1 THEN now()-(gs*37||' days')::interval+interval '8 days' END,
       now()-(gs*37||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,3) gs
ON CONFLICT (tenant_id, breach_number) DO UPDATE SET status=EXCLUDED.status,
  notification_assessment=EXCLUDED.notification_assessment, notification_due_at=EXCLUDED.notification_due_at,
  authority_notified_at=EXCLUDED.authority_notified_at, subjects_notified_at=EXCLUDED.subjects_notified_at,
  closed_by=EXCLUDED.closed_by, closed_at=EXCLUDED.closed_at, updated_at=now();

INSERT INTO grc_incident_history (id, tenant_id, incident_id, from_status, to_status, from_severity, to_severity, note, changed_by, changed_at, snapshot)
SELECT pg_temp.demo_visual_uuid('incident-history-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('incident-'||(((gs-1)%12)+1)),
       CASE WHEN gs<=12 THEN NULL WHEN gs<=24 THEN 'reported' ELSE 'triaged' END,
       CASE WHEN gs<=12 THEN 'reported' WHEN gs<=24 THEN 'triaged' ELSE 'active' END,
       NULL, CASE WHEN ((gs-1)%12)+1 IN (5,11) THEN 'critical' ELSE 'medium' END,
       'Transición documentada en la línea de tiempo del incidente.', c.admin_id,
       now()-((((gs-1)%12)+1)*9||' days')::interval+((gs/12)||' hours')::interval,
       jsonb_build_object('sequence',gs,'source','demo_visual_completion')
FROM demo_visual_context c CROSS JOIN generate_series(1,36) gs
ON CONFLICT (id) DO UPDATE SET to_status=EXCLUDED.to_status, note=EXCLUDED.note, snapshot=EXCLUDED.snapshot;

INSERT INTO grc_incident_timeline (id, tenant_id, incident_id, event_type, occurred_at, description, actor_user_id, source, evidence_ids, metadata)
SELECT pg_temp.demo_visual_uuid('incident-timeline-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('incident-'||(((gs-1)%12)+1)),
       (ARRAY['detected','triage','containment','recovery'])[((gs-1)/12)+1],
       now()-((((gs-1)%12)+1)*9||' days')::interval+(((gs-1)/12)*3||' hours')::interval,
       'Hito verificable: '||(ARRAY['detección y registro','triage y clasificación','contención técnica','recuperación y monitoreo'])[((gs-1)/12)+1]||'.',
       CASE WHEN gs%2=0 THEN c.admin_id ELSE c.auditor_id END, 'demo_visual_completion',
       ARRAY[pg_temp.demo_base_uuid('evidence-'||(((gs*3-1)%80)+1))]::uuid[], jsonb_build_object('sequence',gs)
FROM demo_visual_context c CROSS JOIN generate_series(1,48) gs
ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description, evidence_ids=EXCLUDED.evidence_ids, metadata=EXCLUDED.metadata;

INSERT INTO grc_incident_impacts (id, tenant_id, incident_id, impact_type, entity_id, severity, description, started_at, ended_at, metadata)
SELECT pg_temp.demo_visual_uuid('incident-impact-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('incident-'||(((gs-1)%12)+1)),
       (ARRAY['service','process','asset','supplier','privacy','regulatory','customer','financial'])[((gs-1)%8)+1],
       CASE WHEN gs%8=1 THEN pg_temp.demo_visual_uuid('service-'||(((gs-1)%8)+1))
            WHEN gs%8=2 THEN pg_temp.demo_base_uuid('process-'||(((gs-1)%10)+1))
            WHEN gs%8=3 THEN pg_temp.demo_base_uuid('asset-'||(((gs-1)%8)+1)) END,
       CASE WHEN ((gs-1)%12)+1 IN (5,11) THEN 'critical' WHEN gs%3=0 THEN 'high' ELSE 'medium' END,
       'Impacto cuantificado y asociado a un objeto operacional navegable.', now()-((((gs-1)%12)+1)*9||' days')::interval,
       CASE WHEN ((gs-1)%12)+1<=9 THEN now()-((((gs-1)%12)+1)*9||' days')::interval+interval '10 hours' END,
       jsonb_build_object('estimated_loss',gs*95000)
FROM demo_visual_context c CROSS JOIN generate_series(1,24) gs
ON CONFLICT (id) DO UPDATE SET severity=EXCLUDED.severity, description=EXCLUDED.description, ended_at=EXCLUDED.ended_at, metadata=EXCLUDED.metadata;

INSERT INTO grc_incident_root_causes (id, tenant_id, incident_id, method, cause_category, description, contributing_factors, confirmed, confirmed_by, confirmed_at, created_at)
SELECT pg_temp.demo_visual_uuid('incident-root-'||gs), c.tenant_id, pg_temp.demo_visual_uuid('incident-'||gs),
       CASE WHEN gs%2=0 THEN '5 porqués' ELSE 'Ishikawa' END,
       (ARRAY['proceso','tecnología','personas','tercero'])[((gs-1)%4)+1],
       'Debilidad de verificación preventiva combinada con monitoreo tardío.',
       jsonb_build_array('alerta no priorizada','revisión manual','dependencia externa'), gs<=9,
       CASE WHEN gs<=9 THEN c.auditor_id END, CASE WHEN gs<=9 THEN now()-(gs*8||' days')::interval END,
       now()-(gs*8||' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description, contributing_factors=EXCLUDED.contributing_factors, confirmed=EXCLUDED.confirmed, confirmed_by=EXCLUDED.confirmed_by, confirmed_at=EXCLUDED.confirmed_at;

INSERT INTO grc_incident_postmortems (id, tenant_id, incident_id, summary, what_worked, what_failed, lessons, action_plan_ids, status, approved_by, approved_at, created_at, updated_at)
SELECT pg_temp.demo_visual_uuid('incident-postmortem-'||gs), c.tenant_id, pg_temp.demo_visual_uuid('incident-'||gs),
       'Revisión posterior con decisiones, evidencia y acciones enlazadas.',
       'Detección, escalamiento y coordinación transversal.', 'La alerta inicial y la revisión preventiva fueron tardías.',
       jsonb_build_array('automatizar umbral','ensayar recuperación','verificar al tercero'),
       ARRAY[pg_temp.demo_base_uuid('action-'||(((gs*2-1)%24)+1))]::uuid[],
       CASE WHEN gs<=3 THEN 'approved' WHEN gs<=5 THEN 'under_review' ELSE 'draft' END,
       CASE WHEN gs<=3 THEN c.auditor_id END, CASE WHEN gs<=3 THEN now()-(gs*4||' days')::interval END,
       now()-(gs*7||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,7) gs
ON CONFLICT (tenant_id, incident_id) DO UPDATE SET summary=EXCLUDED.summary, what_worked=EXCLUDED.what_worked,
  what_failed=EXCLUDED.what_failed, lessons=EXCLUDED.lessons, action_plan_ids=EXCLUDED.action_plan_ids,
  status=EXCLUDED.status, approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at, updated_at=now();

-- Connector history drives the integration catalog, run history and health widgets.
INSERT INTO grc_connector_instances (
  id, tenant_id, definition_id, provider, connector_version, status, display_name,
  connected_by_user_id, scopes, metadata_json, execution_mode, credential_envelope,
  cursor, schedule, rate_limit_config, retry_config, health_status, next_sync_at,
  last_sync_at, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('connector-'||row_number() OVER (ORDER BY d.provider)), c.tenant_id, d.id,
       d.provider, d.version, 'connected', d.display_name||' — Demo Tecdex', c.admin_id,
       array_to_string(d.supported_scopes,' '), jsonb_build_object('demo_slug','demo-tecdex','environment','sandbox'),
       'sandbox', jsonb_build_object('ciphertext','demo-redacted-envelope','key_version',1),
       jsonb_build_object('page',12), jsonb_build_object('enabled',true,'cron','0 */6 * * *'),
       jsonb_build_object('requests_per_minute',120), jsonb_build_object('max_attempts',5,'base_seconds',30),
       CASE WHEN d.provider='jira' THEN 'degraded' ELSE 'healthy' END, now()+interval '4 hours',
       now()-interval '2 hours', now()-interval '240 days', now()
FROM demo_visual_context c JOIN grc_connector_definitions d ON d.provider IN ('microsoft_graph','google_workspace','jira','github')
ON CONFLICT (tenant_id, id) DO UPDATE SET status='connected', display_name=EXCLUDED.display_name,
  metadata_json=EXCLUDED.metadata_json, schedule=EXCLUDED.schedule, health_status=EXCLUDED.health_status,
  next_sync_at=EXCLUDED.next_sync_at, last_sync_at=EXCLUDED.last_sync_at, updated_at=now();

INSERT INTO grc_connector_runs (
  id, tenant_id, integration_id, run_type, status, attempt, idempotency_key,
  cursor_before, cursor_after, records_seen, records_normalized, records_rejected,
  alerts_created, mappings_failed, started_at, finished_at, triggered_by, correlation_id, metrics
)
SELECT pg_temp.demo_visual_uuid('connector-run-'||connector_no||'-'||month_no), c.tenant_id,
       pg_temp.demo_visual_uuid('connector-'||connector_no), CASE WHEN month_no%6=0 THEN 'healthcheck' ELSE 'sync' END,
       CASE WHEN connector_no=3 AND month_no IN (4,9) THEN 'completed_with_warnings' ELSE 'completed' END,
       1, 'demo-connector-'||connector_no||'-'||month_no,
       jsonb_build_object('page',month_no-1), jsonb_build_object('page',month_no),
       110+connector_no*17+month_no*3, 106+connector_no*17+month_no*3,
       CASE WHEN connector_no=3 AND month_no IN (4,9) THEN 4 ELSE 0 END,
       CASE WHEN month_no%4=0 THEN 2 ELSE 0 END,
       CASE WHEN connector_no=3 AND month_no IN (4,9) THEN 1 ELSE 0 END,
       now()-((12-month_no)||' months')::interval, now()-((12-month_no)||' months')::interval+interval '8 minutes',
       c.admin_id, 'demo-connector-'||connector_no||'-'||month_no,
       jsonb_build_object('duration_ms',420000+month_no*1900,'coverage_pct',92+month_no/2.0)
FROM demo_visual_context c CROSS JOIN generate_series(1,4) connector_no CROSS JOIN generate_series(1,12) month_no
ON CONFLICT (tenant_id, integration_id, idempotency_key) DO UPDATE SET status=EXCLUDED.status,
  records_seen=EXCLUDED.records_seen, records_normalized=EXCLUDED.records_normalized,
  records_rejected=EXCLUDED.records_rejected, alerts_created=EXCLUDED.alerts_created,
  mappings_failed=EXCLUDED.mappings_failed, metrics=EXCLUDED.metrics;

INSERT INTO grc_external_records (
  id, tenant_id, integration_id, run_id, provider, external_type, external_id,
  external_version, observed_at, received_at, payload_hash, normalized_payload,
  provenance, mapping_status, mapped_entity_type, mapped_entity_id, created_at
)
SELECT pg_temp.demo_visual_uuid('external-record-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('connector-'||(((gs-1)%4)+1)),
       pg_temp.demo_visual_uuid('connector-run-'||(((gs-1)%4)+1)||'-'||(((gs-1)%12)+1)),
       (ARRAY['github','google_workspace','jira','microsoft_graph'])[((gs-1)%4)+1],
       (ARRAY['workflow','user','issue','directory_control'])[((gs-1)%4)+1], 'DEMO-EXT-'||gs, 'v'||(((gs-1)%3)+1),
       now()-((96-gs)||' days')::interval, now()-((96-gs)||' days')::interval+interval '1 minute',
       encode(digest('demo-external-record-'||gs,'sha256'),'hex'),
       jsonb_build_object('control_code','CTRL-'||lpad((((gs-1)%55)+1)::text,3,'0'),'state',CASE WHEN gs%7=0 THEN 'attention' ELSE 'compliant' END,'observed_value',70+(gs%27)),
       jsonb_build_object('connector_run',(((gs-1)%12)+1),'source','sandbox','tenant',c.tenant_id),
       CASE WHEN gs%11=0 THEN 'pending' ELSE 'mapped' END,
       CASE WHEN gs%11=0 THEN NULL ELSE 'control' END,
       CASE WHEN gs%11=0 THEN NULL ELSE pg_temp.demo_base_uuid('tenant-control-'||(((gs-1)%55)+1)) END,
       now()-((96-gs)||' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,96) gs
ON CONFLICT (tenant_id, integration_id, external_type, external_id, payload_hash) DO UPDATE SET
  normalized_payload=EXCLUDED.normalized_payload, provenance=EXCLUDED.provenance,
  mapping_status=EXCLUDED.mapping_status, mapped_entity_type=EXCLUDED.mapped_entity_type,
  mapped_entity_id=EXCLUDED.mapped_entity_id;

-- Phase 3 operating model, continuity and quantitative risk.
INSERT INTO grc_organizational_units (
  id, tenant_id, code, name, description, unit_type, parent_unit_id, owner_user_id,
  backup_owner_user_id, location_reference, status, valid_from, next_review_at,
  approved_by, approved_at, version, provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('org-unit-1'), c.tenant_id, 'ORG-DEMO', 'Demo Tecdex',
       'Compañía tecnológica con SGC y SGSI integrados.', 'company', NULL, c.admin_id, c.auditor_id,
       'Santiago / operación híbrida', 'active', current_date-interval '2 years', now()+interval '210 days',
       c.auditor_id, now()-interval '300 days', 2,
       jsonb_build_object('source','demo_visual_completion','approved',true), c.admin_id, c.admin_id,
       now()-interval '2 years', now()
FROM demo_visual_context c
ON CONFLICT (tenant_id, code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
  owner_user_id=EXCLUDED.owner_user_id, backup_owner_user_id=EXCLUDED.backup_owner_user_id,
  status='active', next_review_at=EXCLUDED.next_review_at, provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_organizational_units (
  id, tenant_id, code, name, description, unit_type, parent_unit_id, owner_user_id,
  backup_owner_user_id, location_reference, status, valid_from, next_review_at,
  approved_by, approved_at, version, provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('org-unit-'||gs), c.tenant_id,
       (ARRAY['TEC','OPS','SEG','CAL','COM','FIN','PER'])[gs-1],
       (ARRAY['Tecnología y Producto','Operaciones','Seguridad de la Información','Calidad y Mejora','Comercial y Clientes','Finanzas y Legal','Personas y Cultura'])[gs-1],
       'Unidad operativa incluida en el alcance integrado y en la cadena de continuidad.',
       CASE WHEN gs IN (2,3) THEN 'division' ELSE 'department' END,
       pg_temp.demo_visual_uuid('org-unit-1'), CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END,
       CASE WHEN gs%2=0 THEN c.admin_id ELSE c.auditor_id END, 'Santiago / remoto',
       CASE WHEN gs=7 THEN 'review_required' ELSE 'active' END, current_date-interval '18 months',
       now()+((70+gs*18)||' days')::interval, c.auditor_id, now()-interval '270 days',
       2, jsonb_build_object('source','demo_visual_completion','scope','integrated'), c.admin_id, c.admin_id,
       now()-interval '18 months', now()
FROM demo_visual_context c CROSS JOIN generate_series(2,8) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
  parent_unit_id=EXCLUDED.parent_unit_id, owner_user_id=EXCLUDED.owner_user_id,
  backup_owner_user_id=EXCLUDED.backup_owner_user_id, status=EXCLUDED.status,
  next_review_at=EXCLUDED.next_review_at, provenance=EXCLUDED.provenance, updated_at=now();

UPDATE tenant_processes p SET
  organizational_unit_id=pg_temp.demo_visual_uuid('org-unit-'||(((v.seq-1)%7)+2)),
  backup_owner_user_id=c.auditor_id,
  process_type=CASE WHEN v.seq IN (1,2,6) THEN 'core' WHEN v.seq IN (3,4,5) THEN 'support' ELSE 'management' END,
  objective='Asegurar resultados consistentes, protegidos y medibles para clientes y partes interesadas.',
  scope='Desde la entrada controlada hasta el resultado, incluyendo tecnología, personas, terceros y evidencia.',
  lifecycle_status=CASE WHEN v.seq=9 THEN 'review_required' ELSE 'active' END,
  criticality_score=55+v.seq*4,
  criticality_confirmed=CASE WHEN v.seq>=8 THEN 'critical' WHEN v.seq>=5 THEN 'high' ELSE 'medium' END,
  review_due_at=now()+((30+v.seq*12)||' days')::interval,
  approved_by=c.auditor_id, approved_at=now()-interval '180 days', updated_by=c.admin_id,
  valid_from=current_date-interval '2 years', version=2, updated_at=now()
FROM demo_visual_context c CROSS JOIN generate_series(1,10) v(seq)
WHERE p.tenant_id=c.tenant_id AND p.id=pg_temp.demo_base_uuid('process-'||v.seq);

INSERT INTO grc_operational_services (
  id, tenant_id, code, name, description, organizational_unit_id, primary_process_id,
  owner_user_id, backup_owner_user_id, minimum_service_level, critical_schedule,
  criticality, rto_minutes, rpo_minutes, mtpd_minutes, status, next_review_at,
  approved_by, approved_at, version, provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('service-'||gs), c.tenant_id, 'SRV-'||lpad(gs::text,3,'0'),
       (ARRAY['Plataforma SaaS de cumplimiento','Gestión de evidencias','Analítica ejecutiva GRC','Autenticación e identidad','Atención y soporte cliente','Respaldo y recuperación','Integraciones empresariales','Reportería regulatoria'])[((gs-1)%8)+1],
       'Servicio operativo con propietario, tolerancias, dependencias y continuidad verificable.',
       pg_temp.demo_visual_uuid('org-unit-'||(((gs-1)%7)+2)), pg_temp.demo_base_uuid('process-'||(((gs-1)%10)+1)),
       CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END, CASE WHEN gs%2=0 THEN c.admin_id ELSE c.auditor_id END,
       CASE WHEN gs IN (1,4) THEN '99,9% mensual' ELSE '98,5% mensual' END,
       CASE WHEN gs IN (1,4,6) THEN '24x7' ELSE 'Horario hábil con guardia' END,
       CASE WHEN gs IN (1,4) THEN 'critical' WHEN gs IN (2,3,6,8) THEN 'high' ELSE 'medium' END,
       CASE WHEN gs IN (1,4) THEN 120 WHEN gs IN (2,3,6,8) THEN 240 ELSE 480 END,
       CASE WHEN gs IN (1,4,6) THEN 60 ELSE 240 END,
       CASE WHEN gs IN (1,4) THEN 480 WHEN gs IN (2,3,6,8) THEN 720 ELSE 1440 END,
       CASE WHEN gs=7 THEN 'review_required' ELSE 'active' END,
       now()+((45+gs*16)||' days')::interval, c.auditor_id, now()-interval '160 days', 2,
       jsonb_build_object('source','demo_visual_completion','service_map',true), c.admin_id, c.admin_id,
       now()-interval '20 months', now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
  organizational_unit_id=EXCLUDED.organizational_unit_id, primary_process_id=EXCLUDED.primary_process_id,
  owner_user_id=EXCLUDED.owner_user_id, criticality=EXCLUDED.criticality,
  rto_minutes=EXCLUDED.rto_minutes, rpo_minutes=EXCLUDED.rpo_minutes, mtpd_minutes=EXCLUDED.mtpd_minutes,
  status=EXCLUDED.status, next_review_at=EXCLUDED.next_review_at, provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_operational_dependencies (
  id, tenant_id, source_type, source_id, target_type, target_id, dependency_type,
  criticality, is_mandatory, alternative_description, max_tolerable_minutes,
  valid_from, source_reference, approved_by, approved_at, provenance, created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('dependency-'||gs), c.tenant_id,
       CASE WHEN gs%4=0 THEN 'process' ELSE 'service' END,
       CASE WHEN gs%4=0 THEN pg_temp.demo_base_uuid('process-'||((((gs-1)/4)%10)+1))
            ELSE pg_temp.demo_visual_uuid('service-'||(((gs-1)%8)+1)) END,
       (ARRAY['asset','supplier','control','process'])[((gs-1)%4)+1],
       CASE WHEN gs%4=1 THEN pg_temp.demo_base_uuid('asset-'||((((gs-1)/4)%8)+1))
            WHEN gs%4=2 THEN pg_temp.demo_visual_uuid('supplier-'||((((gs-1)/4)%8)+1))
            WHEN gs%4=3 THEN pg_temp.demo_base_uuid('tenant-control-'||(((gs-1)%55)+1))
            ELSE pg_temp.demo_base_uuid('process-'||(((((gs-1)/4)+2)%10)+1)) END,
       (ARRAY['service_to_asset','service_to_supplier','service_to_control','process_to_process'])[((gs-1)%4)+1],
       CASE WHEN gs%5=0 THEN 'critical' WHEN gs%3=0 THEN 'high' ELSE 'medium' END,
       gs%7<>0, CASE WHEN gs%7=0 THEN 'Operación manual temporal y proveedor alternativo.' END,
       240+(gs%4)*120, now()-interval '12 months', 'Mapa de dependencias Demo Tecdex v2',
       c.auditor_id, now()-interval '150 days', jsonb_build_object('source','demo_visual_completion'),
       c.admin_id, now()-interval '12 months', now()
FROM demo_visual_context c CROSS JOIN generate_series(1,32) gs
ON CONFLICT (tenant_id, source_type, source_id, target_type, target_id, dependency_type) DO UPDATE SET
  criticality=EXCLUDED.criticality, is_mandatory=EXCLUDED.is_mandatory,
  alternative_description=EXCLUDED.alternative_description,
  max_tolerable_minutes=EXCLUDED.max_tolerable_minutes, provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_bia_assessments (
  id, tenant_id, code, organizational_unit_id, process_id, service_id, version,
  owner_user_id, assessment_date, assumptions, estimated_financial_impact,
  mtpd_minutes, rto_minutes, rpo_minutes, minimum_service_level, required_people,
  alternative_resources, status, next_review_at, approved_by, approved_at,
  provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('bia-'||gs), c.tenant_id, 'BIA-2026-'||lpad(gs::text,2,'0'),
       pg_temp.demo_visual_uuid('org-unit-'||(((gs-1)%7)+2)), pg_temp.demo_base_uuid('process-'||(((gs-1)%10)+1)),
       pg_temp.demo_visual_uuid('service-'||gs), 2, CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END,
       current_date-(gs*22), 'Escenario de indisponibilidad completa durante ventana crítica, sin mitigaciones extraordinarias.',
       1400000+gs*475000, CASE WHEN gs IN (1,4) THEN 480 ELSE 720+gs*60 END,
       CASE WHEN gs IN (1,4) THEN 120 ELSE 240+gs*20 END, CASE WHEN gs IN (1,4,6) THEN 60 ELSE 180 END,
       CASE WHEN gs IN (1,4) THEN '50% en 2 horas' ELSE '60% en 4 horas' END, 3+gs,
       'Sitio alternativo, procedimiento manual y capacidad del proveedor secundario.',
       CASE WHEN gs=7 THEN 'review_required' ELSE 'current' END,
       now()+((60+gs*20)||' days')::interval, c.auditor_id, now()-((gs*14)||' days')::interval,
       jsonb_build_object('source','demo_visual_completion','method','bia-v2'), c.admin_id, c.admin_id,
       now()-((gs*22)||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET version=EXCLUDED.version,
  estimated_financial_impact=EXCLUDED.estimated_financial_impact, mtpd_minutes=EXCLUDED.mtpd_minutes,
  rto_minutes=EXCLUDED.rto_minutes, rpo_minutes=EXCLUDED.rpo_minutes, status=EXCLUDED.status,
  next_review_at=EXCLUDED.next_review_at, provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_bia_impacts (id, tenant_id, bia_id, dimension, duration_minutes, impact_level, estimated_amount, rationale, provenance, created_by, created_at)
SELECT pg_temp.demo_visual_uuid('bia-impact-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('bia-'||(((gs-1)%8)+1)),
       (ARRAY['operational','financial','customer','legal_regulatory'])[((gs-1)/8)+1],
       (ARRAY[120,240,480,720])[((gs-1)/8)+1],
       CASE WHEN ((gs-1)%8)+1 IN (1,4) AND gs>16 THEN 'critical' WHEN gs>16 THEN 'high' WHEN gs>8 THEN 'medium' ELSE 'low' END,
       CASE WHEN gs>8 THEN 250000+gs*72000 END,
       'Impacto escalonado validado con dueño de servicio y supuestos explícitos.',
       jsonb_build_object('source','demo_visual_completion','duration_bucket',((gs-1)/8)+1), c.admin_id,
       now()-((gs%8+1)*20||' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,32) gs
ON CONFLICT (tenant_id, bia_id, dimension, duration_minutes) DO UPDATE SET
  impact_level=EXCLUDED.impact_level, estimated_amount=EXCLUDED.estimated_amount,
  rationale=EXCLUDED.rationale, provenance=EXCLUDED.provenance;

INSERT INTO grc_continuity_plans (
  id, tenant_id, code, name, scope, organizational_unit_id, process_id, service_id, bia_id,
  activation_criteria, activation_authority_user_id, procedures, recovery_sequence,
  communication_plan, return_to_operation_criteria, version, status, valid_from,
  next_review_at, approved_by, approved_at, provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('continuity-plan-'||gs), c.tenant_id, 'PCN-'||lpad(gs::text,3,'0'),
       'Continuidad — '||(ARRAY['Plataforma SaaS','Evidencias','Analítica GRC','Identidad','Soporte','Respaldo','Integraciones','Reportería'])[((gs-1)%8)+1],
       'Personas, tecnología, proveedores, comunicaciones y retorno controlado para el servicio.',
       pg_temp.demo_visual_uuid('org-unit-'||(((gs-1)%7)+2)), pg_temp.demo_base_uuid('process-'||(((gs-1)%10)+1)),
       pg_temp.demo_visual_uuid('service-'||gs), pg_temp.demo_visual_uuid('bia-'||gs),
       'Indisponibilidad superior al RTO, impacto crítico o decisión del líder de crisis.', c.admin_id,
       'Confirmar alcance; activar equipo; ejecutar contingencia; registrar evidencia cada 30 minutos.',
       'Contención; servicio mínimo; recuperación priorizada; validación; retorno gradual.',
       'Matriz de comunicaciones por severidad, clientes, autoridades y proveedores.',
       'Servicio estable por 4 horas, backlog controlado y aprobación del dueño.', 2,
       CASE WHEN gs=7 THEN 'review_required' ELSE 'active' END, current_date-interval '11 months',
       now()+((50+gs*18)||' days')::interval, c.auditor_id, now()-interval '145 days',
       jsonb_build_object('source','demo_visual_completion','tested',true), c.admin_id, c.admin_id,
       now()-interval '11 months', now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET name=EXCLUDED.name, scope=EXCLUDED.scope,
  activation_criteria=EXCLUDED.activation_criteria, procedures=EXCLUDED.procedures,
  recovery_sequence=EXCLUDED.recovery_sequence, status=EXCLUDED.status,
  next_review_at=EXCLUDED.next_review_at, provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_continuity_tests (
  id, tenant_id, plan_id, test_type, objective, scenario, scope, scheduled_at,
  completed_at, expected_result, actual_result, target_rto_minutes, observed_rto_minutes,
  target_rpo_minutes, observed_rpo_minutes, status, next_test_at, approved_by,
  approved_at, provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('continuity-test-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('continuity-plan-'||(((gs-1)%8)+1)),
       (ARRAY['tabletop','technical_recovery','communication_test'])[((gs-1)/8)+1],
       'Verificar decisión, recuperación y comunicaciones dentro de tolerancias.',
       CASE WHEN gs%3=0 THEN 'Caída de proveedor primario durante cierre mensual.' ELSE 'Indisponibilidad de plataforma con afectación parcial de clientes.' END,
       'Servicio, proceso, activos, tercero y comunicaciones.',
       CASE WHEN gs<=20 THEN now()-((24-gs)*14||' days')::interval ELSE now()+((gs-20)*20||' days')::interval END,
       CASE WHEN gs<=20 THEN now()-((24-gs)*14||' days')::interval+interval '4 hours' END,
       'Activación correcta y recuperación dentro del RTO.',
       CASE WHEN gs<=20 THEN CASE WHEN gs IN (6,14) THEN 'RTO excedido; se abrió acción correctiva.' ELSE 'Objetivo logrado con observaciones menores.' END END,
       240, CASE WHEN gs<=20 THEN CASE WHEN gs IN (6,14) THEN 315 ELSE 175+(gs%4)*14 END END,
       120, CASE WHEN gs<=20 THEN 70+(gs%5)*9 END,
       CASE WHEN gs>20 THEN 'planned' WHEN gs IN (6,14) THEN 'failed' WHEN gs%4=0 THEN 'passed_with_observations' ELSE 'passed' END,
       now()+((60+gs*5)||' days')::interval, CASE WHEN gs<=20 THEN c.auditor_id END,
       CASE WHEN gs<=20 THEN now()-((24-gs)*14||' days')::interval+interval '2 days' END,
       jsonb_build_object('source','demo_visual_completion','evidence_id',pg_temp.demo_base_uuid('evidence-'||(((gs*3-1)%80)+1))),
       c.admin_id, c.admin_id, now()-interval '12 months', now()
FROM demo_visual_context c CROSS JOIN generate_series(1,24) gs
ON CONFLICT (id) DO UPDATE SET actual_result=EXCLUDED.actual_result,
  observed_rto_minutes=EXCLUDED.observed_rto_minutes, observed_rpo_minutes=EXCLUDED.observed_rpo_minutes,
  status=EXCLUDED.status, next_test_at=EXCLUDED.next_test_at, provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_crisis_activations (
  id, tenant_id, code, plan_id, incident_id, organizational_unit_id, process_id,
  service_id, crisis_level, activation_reason, recovery_status, lessons_learned,
  status, activated_at, closed_at, activated_by, closed_by, provenance, updated_by,
  created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('crisis-'||gs), c.tenant_id, 'CRISIS-2026-'||lpad(gs::text,2,'0'),
       pg_temp.demo_visual_uuid('continuity-plan-'||CASE WHEN gs=1 THEN 1 WHEN gs=2 THEN 4 ELSE 7 END),
       pg_temp.demo_visual_uuid('incident-'||CASE WHEN gs=1 THEN 2 WHEN gs=2 THEN 5 ELSE 12 END),
       pg_temp.demo_visual_uuid('org-unit-'||(gs+1)), pg_temp.demo_base_uuid('process-'||gs),
       pg_temp.demo_visual_uuid('service-'||CASE WHEN gs=1 THEN 1 WHEN gs=2 THEN 4 ELSE 7 END),
       (ARRAY['level_2','level_3','level_1'])[gs],
       'Impacto operacional superior al umbral y coordinación transversal requerida.',
       CASE WHEN gs<=2 THEN 'operación normal restaurada y monitoreo reforzado' ELSE 'contención activa' END,
       CASE WHEN gs<=2 THEN 'Mejorar umbrales, vocerías y disponibilidad de runbooks.' END,
       CASE WHEN gs<=2 THEN 'closed' ELSE 'active' END,
       now()-(gs*54||' days')::interval, CASE WHEN gs<=2 THEN now()-(gs*54||' days')::interval+interval '18 hours' END,
       c.admin_id, CASE WHEN gs<=2 THEN c.auditor_id END,
       jsonb_build_object('source','demo_visual_completion','exercise',false), c.admin_id,
       now()-(gs*54||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,3) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET recovery_status=EXCLUDED.recovery_status,
  lessons_learned=EXCLUDED.lessons_learned, status=EXCLUDED.status,
  closed_at=EXCLUDED.closed_at, closed_by=EXCLUDED.closed_by, provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_crisis_log (id, tenant_id, crisis_id, entry_type, entry_text, occurred_at, recorded_by, provenance, created_at)
SELECT pg_temp.demo_visual_uuid('crisis-log-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('crisis-'||(((gs-1)%3)+1)),
       (ARRAY['status','decision','communication','action','observation'])[((gs-1)/3)+1],
       'Registro cronológico de crisis: '||(ARRAY['estado confirmado','decisión aprobada','comunicación emitida','acción ejecutada','observación para mejora'])[((gs-1)/3)+1]||'.',
       now()-((((gs-1)%3)+1)*54||' days')::interval+(((gs-1)/3)*2||' hours')::interval,
       CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END,
       jsonb_build_object('source','demo_visual_completion','sequence',gs), now()-interval '160 days'
FROM demo_visual_context c CROSS JOIN generate_series(1,15) gs
ON CONFLICT (id) DO UPDATE SET entry_text=EXCLUDED.entry_text, provenance=EXCLUDED.provenance;

INSERT INTO grc_metric_definitions (
  id, tenant_id, code, name, description, metric_type, entity_type, entity_id,
  formula_definition, source_description, frequency, owner_user_id, unit,
  expected_direction, target_value, warning_threshold, critical_threshold,
  measurement_window, status, valid_from, version, approved_by, approved_at,
  provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('ops-metric-'||gs), c.tenant_id, 'OPS-MET-'||lpad(gs::text,3,'0'),
       (ARRAY['Disponibilidad del servicio','Cumplimiento RTO','Incidentes recurrentes','Dependencias críticas sin alternativa','Pruebas de continuidad exitosas','Tiempo medio de recuperación','Freshness de evidencia operacional','Calidad de medición operacional'])[((gs-1)%8)+1],
       'Métrica operacional gobernada, enlazada a servicio y con mediciones mensuales no planas.',
       CASE WHEN gs IN (3,4,6) THEN 'kri' ELSE 'kpi' END, 'service', pg_temp.demo_visual_uuid('service-'||gs),
       CASE WHEN gs IN (3,4,6) THEN 'count_or_duration(source_records)' ELSE 'valid_results / total_results * 100' END,
       'Incidentes, continuidad, dependencias, evidencias y telemetría gobernada.', 'monthly',
       CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END,
       CASE WHEN gs IN (3,4) THEN 'cantidad' WHEN gs=6 THEN 'minutos' ELSE '%' END,
       CASE WHEN gs IN (3,4,6) THEN 'lower_is_better' ELSE 'higher_is_better' END,
       CASE WHEN gs IN (3,4) THEN 2 WHEN gs=6 THEN 180 ELSE 90 END,
       CASE WHEN gs IN (3,4) THEN 4 WHEN gs=6 THEN 240 ELSE 82 END,
       CASE WHEN gs IN (3,4) THEN 7 WHEN gs=6 THEN 360 ELSE 70 END,
       'calendar_month', 'active', current_date-interval '12 months', 1, c.auditor_id,
       now()-interval '11 months', jsonb_build_object('source','demo_visual_completion','lineage','grc_metric_measurements'),
       c.admin_id, c.admin_id, now()-interval '12 months', now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
  formula_definition=EXCLUDED.formula_definition, source_description=EXCLUDED.source_description,
  target_value=EXCLUDED.target_value, warning_threshold=EXCLUDED.warning_threshold,
  critical_threshold=EXCLUDED.critical_threshold, status='active', provenance=EXCLUDED.provenance, updated_at=now();

INSERT INTO grc_metric_measurements (
  id, tenant_id, metric_id, period_start, period_end, numeric_value, source_description,
  measured_at, provenance, evidence_id, quality, validation_status, approved_by,
  approved_at, comment, trend, impact_status, idempotency_key, created_by, created_at
)
SELECT pg_temp.demo_visual_uuid('ops-measurement-'||metric_no||'-'||month_no), c.tenant_id,
       pg_temp.demo_visual_uuid('ops-metric-'||metric_no),
       date_trunc('month',current_date)-((12-month_no)||' months')::interval,
       date_trunc('month',current_date)-((11-month_no)||' months')::interval-interval '1 second',
       CASE WHEN metric_no IN (3,4) THEN greatest(0,8-month_no/2.0+((metric_no+month_no)%3))
            WHEN metric_no=6 THEN greatest(120,340-month_no*13+((month_no%3)*18))
            ELSE least(99,74+month_no*1.45+(((metric_no*month_no)%5)-2)) END,
       'Cálculo mensual reproducible desde fuente gobernada.',
       date_trunc('month',current_date)-((11-month_no)||' months')::interval+interval '1 day',
       jsonb_build_object('source','demo_visual_completion','metric',metric_no,'period',month_no,'quality_rule','ops-series-v1'),
       pg_temp.demo_base_uuid('evidence-'||(((metric_no*month_no-1)%80)+1)),
       CASE WHEN month_no=3 AND metric_no=7 THEN 'estimated' ELSE 'valid' END,
       'approved', c.auditor_id,
       date_trunc('month',current_date)-((11-month_no)||' months')::interval+interval '2 days',
       CASE WHEN month_no=3 AND metric_no=7 THEN 'Fuente tardía; estimación aprobada y luego reconciliada.' ELSE 'Medición validada.' END,
       CASE WHEN month_no>=8 THEN 'improving' WHEN month_no IN (4,5) THEN 'stable' ELSE 'deteriorating' END,
       CASE WHEN metric_no IN (3,4) AND month_no<6 THEN 'warning' WHEN metric_no=6 AND month_no<5 THEN 'critical' WHEN metric_no NOT IN (3,4,6) AND month_no<5 THEN 'warning' ELSE 'normal' END,
       'ops-metric-'||metric_no||'-month-'||month_no, c.admin_id,
       date_trunc('month',current_date)-((11-month_no)||' months')::interval+interval '1 day'
FROM demo_visual_context c CROSS JOIN generate_series(1,8) metric_no CROSS JOIN generate_series(1,12) month_no
ON CONFLICT (tenant_id, metric_id, idempotency_key) DO UPDATE SET numeric_value=EXCLUDED.numeric_value,
  provenance=EXCLUDED.provenance, quality=EXCLUDED.quality, validation_status=EXCLUDED.validation_status,
  comment=EXCLUDED.comment, trend=EXCLUDED.trend, impact_status=EXCLUDED.impact_status;

INSERT INTO grc_quantitative_risk_assessments (
  id, tenant_id, code, risk_id, organizational_unit_id, process_id, service_id,
  scenario, minimum_impact, most_likely_impact, maximum_impact, estimated_frequency,
  expected_impact, annualized_loss, residual_annualized_loss, treatment_annualized_loss,
  control_cost, expected_reduction, net_expected_benefit, sensitivity_notes,
  treatment_comparison, assumptions, source_description, status, version,
  approved_by, approved_at, provenance, created_by, updated_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('quant-risk-'||gs), c.tenant_id, 'QRA-2026-'||lpad(gs::text,3,'0'),
       pg_temp.demo_base_uuid('risk-'||(((gs*3-1)%24)+1)), pg_temp.demo_visual_uuid('org-unit-'||(((gs-1)%7)+2)),
       pg_temp.demo_base_uuid('process-'||(((gs-1)%10)+1)), pg_temp.demo_visual_uuid('service-'||gs),
       'Interrupción o compromiso del servicio con impacto directo e indirecto cuantificado.',
       180000+gs*25000, 650000+gs*85000, 2100000+gs*190000, 0.55+gs*0.11,
       820000+gs*92000, 540000+gs*105000, 260000+gs*48000, 180000+gs*35000,
       65000+gs*9500, 280000+gs*57000, 215000+gs*47500,
       'Frecuencia y máximo impacto explican la mayor parte de la sensibilidad.',
       'Mitigar reduce pérdida anual esperada y permanece por debajo del apetito.',
       'Ventana de 12 meses, exposición constante y controles operando según mediciones.',
       'Registro de riesgos, incidentes, pérdidas, BIA y eficacia de controles.',
       CASE WHEN gs=8 THEN 'review_required' ELSE 'current' END, 1,
       c.auditor_id, now()-((gs*12)||' days')::interval,
       jsonb_build_object('source','demo_visual_completion','method','pert-scenario-v1'),
       c.admin_id, c.admin_id, now()-((gs*12)||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (tenant_id, code) DO UPDATE SET expected_impact=EXCLUDED.expected_impact,
  annualized_loss=EXCLUDED.annualized_loss, residual_annualized_loss=EXCLUDED.residual_annualized_loss,
  treatment_annualized_loss=EXCLUDED.treatment_annualized_loss, control_cost=EXCLUDED.control_cost,
  expected_reduction=EXCLUDED.expected_reduction, net_expected_benefit=EXCLUDED.net_expected_benefit,
  status=EXCLUDED.status, provenance=EXCLUDED.provenance, updated_at=now();

-- ISO matrix pages use their own persisted read model, separate from asset_risks.
INSERT INTO iso_risk_matrix_runs (
  id, tenant_id, standard_code, version_code, run_type, run_status, requested_by,
  certifiable_version, coverage_warning, total_assets, total_risk_templates,
  suggested_risks_count, accepted_risks_count, rejected_risks_count,
  critical_risks_count, high_risks_count, medium_risks_count, low_risks_count,
  inherent_risk_avg, residual_risk_avg, risk_posture, summary_json, input_json,
  result_json, created_at, updated_at, completed_at
)
SELECT pg_temp.demo_visual_uuid('iso-risk-run-'||standard_no), c.tenant_id,
       CASE WHEN standard_no=1 THEN 'ISO27001' ELSE 'ISO9001' END,
       CASE WHEN standard_no=1 THEN '2022' ELSE '2015' END,
       'asset_based', 'reviewed', c.admin_id, true, NULL, 8, 12, 3, 9, 0,
       2, 4, 4, 2, 14.6, 7.8, 'Tendencia favorable con riesgos residuales fuera de apetito en tratamiento.',
       jsonb_build_object('total',12,'outside_appetite',3,'trend','improving','standard_no',standard_no),
       jsonb_build_object('assets',8,'controls',55,'period','2026'),
       jsonb_build_object('heatmap_cells',16,'accepted',9,'needs_review',3),
       now()-(standard_no*18||' days')::interval, now(), now()-(standard_no*18||' days')::interval+interval '4 minutes'
FROM demo_visual_context c CROSS JOIN generate_series(1,2) standard_no
ON CONFLICT (id) DO UPDATE SET suggested_risks_count=EXCLUDED.suggested_risks_count,
  accepted_risks_count=EXCLUDED.accepted_risks_count, critical_risks_count=EXCLUDED.critical_risks_count,
  high_risks_count=EXCLUDED.high_risks_count, medium_risks_count=EXCLUDED.medium_risks_count,
  low_risks_count=EXCLUDED.low_risks_count, inherent_risk_avg=EXCLUDED.inherent_risk_avg,
  residual_risk_avg=EXCLUDED.residual_risk_avg, risk_posture=EXCLUDED.risk_posture,
  summary_json=EXCLUDED.summary_json, result_json=EXCLUDED.result_json, updated_at=now();

INSERT INTO iso_risk_matrix_items (
  id, run_id, tenant_id, standard_code, version_code, asset_id, catalog_control_id,
  tenant_control_id, risk_code, risk_title, risk_description, risk_category,
  asset_name, asset_type, asset_criticality, likelihood, impact, inherent_risk_score,
  inherent_risk_level, control_effectiveness_score, residual_likelihood,
  residual_impact, residual_risk_score, residual_risk_level, treatment_strategy,
  suggested_controls, suggested_actions, evidence_expectations, status, confidence,
  source_type, source_trace_json, reviewer_user_id, reviewed_at, review_comment,
  created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('iso-risk-item-'||gs),
       pg_temp.demo_visual_uuid('iso-risk-run-'||CASE WHEN gs<=12 THEN 1 ELSE 2 END), c.tenant_id,
       CASE WHEN gs<=12 THEN 'ISO27001' ELSE 'ISO9001' END,
       CASE WHEN gs<=12 THEN '2022' ELSE '2015' END,
       pg_temp.demo_base_uuid('asset-'||(((gs-1)%8)+1)),
       pg_temp.demo_base_uuid('control-catalog-'||(((gs*2-1)%55)+1)),
       pg_temp.demo_base_uuid('tenant-control-'||(((gs*2-1)%55)+1)),
       'RISK-DEMO-'||lpad(gs::text,3,'0'),
       (ARRAY['Acceso no autorizado','Interrupción de plataforma','Cambio sin validación','Evidencia insuficiente','Dependencia crítica de tercero','Pérdida de trazabilidad','Error en entrega al cliente','Incumplimiento de continuidad'])[((gs-1)%8)+1],
       'Riesgo contextualizado con activo, control, evidencia y tratamiento navegables.',
       (ARRAY['Seguridad','Continuidad','Cambio','Cumplimiento','Terceros','Datos','Calidad','Operación'])[((gs-1)%8)+1],
       'Activo crítico '||(((gs-1)%8)+1), (ARRAY['aplicación','información','infraestructura','servicio'])[((gs-1)%4)+1],
       CASE WHEN gs%5=0 THEN 'critical' WHEN gs%3=0 THEN 'high' ELSE 'medium' END,
       2+(gs%4), 2+((gs+1)%4), (2+(gs%4))*(2+((gs+1)%4)),
       CASE WHEN (2+(gs%4))*(2+((gs+1)%4))>=16 THEN 'critico' WHEN (2+(gs%4))*(2+((gs+1)%4))>=10 THEN 'alto' ELSE 'medio' END,
       55+(gs%8)*5, 1+(gs%3), 2+((gs+2)%3), (1+(gs%3))*(2+((gs+2)%3)),
       CASE WHEN (1+(gs%3))*(2+((gs+2)%3))>=10 THEN 'alto' WHEN (1+(gs%3))*(2+((gs+2)%3))>=5 THEN 'medio' ELSE 'bajo' END,
       (ARRAY['mitigar','mitigar','monitorear','transferir','aceptar'])[((gs-1)%5)+1],
       ARRAY['CTRL-'||lpad((((gs*2-1)%55)+1)::text,3,'0')],
       jsonb_build_array(jsonb_build_object('title','Fortalecer prueba y evidencia','priority',CASE WHEN gs%4=0 THEN 'alta' ELSE 'media' END)),
       jsonb_build_array('ejecución vigente','aprobación','trazabilidad'),
       CASE WHEN gs%5=0 THEN 'needs_review' ELSE 'accepted' END, 0.72+(gs%8)*0.03,
       'demo_visual_completion', jsonb_build_object('asset_id',pg_temp.demo_base_uuid('asset-'||(((gs-1)%8)+1)),'risk_id',pg_temp.demo_base_uuid('risk-'||gs)),
       c.auditor_id, now()-(gs*3||' days')::interval, 'Evaluado contra apetito, control y evidencia disponible.',
       now()-(gs*4||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,24) gs
ON CONFLICT (id) DO UPDATE SET likelihood=EXCLUDED.likelihood, impact=EXCLUDED.impact,
  inherent_risk_score=EXCLUDED.inherent_risk_score, inherent_risk_level=EXCLUDED.inherent_risk_level,
  control_effectiveness_score=EXCLUDED.control_effectiveness_score,
  residual_likelihood=EXCLUDED.residual_likelihood, residual_impact=EXCLUDED.residual_impact,
  residual_risk_score=EXCLUDED.residual_risk_score, residual_risk_level=EXCLUDED.residual_risk_level,
  treatment_strategy=EXCLUDED.treatment_strategy, suggested_actions=EXCLUDED.suggested_actions,
  evidence_expectations=EXCLUDED.evidence_expectations, status=EXCLUDED.status,
  source_trace_json=EXCLUDED.source_trace_json, reviewer_user_id=EXCLUDED.reviewer_user_id,
  reviewed_at=EXCLUDED.reviewed_at, review_comment=EXCLUDED.review_comment, updated_at=now();

INSERT INTO iso_risk_matrix_actions (
  id, run_id, risk_item_id, tenant_id, action_title, action_description,
  suggested_owner_role, suggested_due_days, priority, action_type,
  creates_action_plan_candidate, status, metadata, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('iso-risk-action-'||gs),
       pg_temp.demo_visual_uuid('iso-risk-run-'||CASE WHEN gs<=12 THEN 1 ELSE 2 END),
       pg_temp.demo_visual_uuid('iso-risk-item-'||gs), c.tenant_id,
       'Tratamiento verificable para '||'RISK-DEMO-'||lpad(gs::text,3,'0'),
       'Completar control, ejecución, evidencia y prueba de efectividad antes del vencimiento.',
       CASE WHEN gs%2=0 THEN 'Auditor interno' ELSE 'Dueño de proceso' END,
       20+(gs%4)*15, CASE WHEN gs%5=0 THEN 'alta' ELSE 'media' END,
       'risk_treatment', true, CASE WHEN gs%5=0 THEN 'accepted' ELSE 'suggested' END,
       jsonb_build_object('action_plan_id',pg_temp.demo_base_uuid('action-'||(((gs-1)%24)+1)),'source','demo_visual_completion'),
       now()-(gs*3||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,24) gs
ON CONFLICT (id) DO UPDATE SET action_description=EXCLUDED.action_description,
  suggested_due_days=EXCLUDED.suggested_due_days, priority=EXCLUDED.priority,
  status=EXCLUDED.status, metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO operational_risk_simulations (
  id, tenant_id, source_risk_id, norma_tipo, modelo_usado, nombre_riesgo,
  proceso_afectado, descripcion, frecuencia_min, frecuencia_mode, frecuencia_max,
  impacto_min, impacto_mode, impacto_max, tasa_error_min, tasa_error_mode,
  tasa_error_max, tiempo_subsanacion_min, tiempo_subsanacion_mode,
  tiempo_subsanacion_max, volumen_operativo_anual, umbral_disrupcion_critica_horas,
  iteraciones, media_operativa_anual, mediana_operativa_anual, peor_escenario_p90,
  peor_escenario_p95, peor_escenario_p99, desviacion_estandar, minimo_simulado,
  maximo_simulado, probabilidad_disrupcion_critica, histograma_json, input_json,
  result_json, created_by, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('op-risk-simulation-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('iso-risk-item-'||gs),
       CASE WHEN gs<=4 THEN 'ISO27001' ELSE 'ISO9001' END,
       CASE WHEN gs<=4 THEN 'ISO27001_TTIA' WHEN gs%2=0 THEN 'ISO9001_COP_AVANZADO' ELSE 'ISO9001_COP_SIMPLE' END,
       'Simulación — '||(ARRAY['indisponibilidad SaaS','compromiso de cuenta privilegiada','falla de respaldo','dependencia cloud','defecto en entrega','reproceso operacional','incumplimiento de SLA','error de reporte'])[((gs-1)%8)+1],
       (ARRAY['Tecnología','Seguridad','Continuidad','Proveedores','Calidad','Operaciones','Soporte','Gobierno'])[((gs-1)%8)+1],
       'Escenario Beta-PERT con supuestos, percentiles y tratamiento comercialmente explicables.',
       0.2+gs*0.03, 0.7+gs*0.08, 1.8+gs*0.14,
       120000+gs*30000, 580000+gs*85000, 2500000+gs*210000,
       CASE WHEN gs>4 THEN 0.005+gs*0.001 END, CASE WHEN gs>4 THEN 0.018+gs*0.002 END,
       CASE WHEN gs>4 THEN 0.05+gs*0.003 END,
       2+gs, 7+gs*2, 18+gs*3, 18000+gs*1300, 8,
       25000, 420000+gs*115000, 360000+gs*92000, 980000+gs*180000,
       1250000+gs*225000, 1900000+gs*320000, 280000+gs*65000,
       45000+gs*9000, 3100000+gs*410000, 0.08+gs*0.025,
       jsonb_build_array(
         jsonb_build_object('bucket','0-250k','count',5800-gs*80),
         jsonb_build_object('bucket','250k-750k','count',9100+gs*55),
         jsonb_build_object('bucket','750k-1.5m','count',6200+gs*70),
         jsonb_build_object('bucket','1.5m+','count',3900-gs*45)),
       jsonb_build_object('distribution','beta_pert','frequency',jsonb_build_array(0.2+gs*0.03,0.7+gs*0.08,1.8+gs*0.14),'iterations',25000),
       jsonb_build_object('mean',420000+gs*115000,'p95',1250000+gs*225000,'critical_probability',0.08+gs*0.025),
       c.admin_id, now()-(gs*25||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET media_operativa_anual=EXCLUDED.media_operativa_anual,
  peor_escenario_p95=EXCLUDED.peor_escenario_p95,
  probabilidad_disrupcion_critica=EXCLUDED.probabilidad_disrupcion_critica,
  histograma_json=EXCLUDED.histograma_json, input_json=EXCLUDED.input_json,
  result_json=EXCLUDED.result_json, updated_at=now();

INSERT INTO operational_risk_recommendations (
  id, tenant_id, simulation_id, source_risk_id, diagnostico_operativo,
  controles_sugeridos, efectividad_estimada_pct, ai_model, prompt_version,
  created_by, created_at
)
SELECT pg_temp.demo_visual_uuid('op-risk-recommendation-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('op-risk-simulation-'||gs), pg_temp.demo_visual_uuid('iso-risk-item-'||gs),
       'El percentil 95 permanece sobre apetito; conviene fortalecer prevención, recuperación y verificación periódica.',
       jsonb_build_array(
         jsonb_build_object('control_id',pg_temp.demo_base_uuid('tenant-control-'||(((gs*3-1)%55)+1)),'action','aumentar frecuencia de prueba'),
         jsonb_build_object('control_id',pg_temp.demo_base_uuid('tenant-control-'||(((gs*3)%55)+1)),'action','automatizar alerta y evidencia')),
       52+gs*3, NULL, 'deterministic-demo-v1', c.admin_id, now()-(gs*25||' days')::interval
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET diagnostico_operativo=EXCLUDED.diagnostico_operativo,
  controles_sugeridos=EXCLUDED.controles_sugeridos,
  efectividad_estimada_pct=EXCLUDED.efectividad_estimada_pct;

INSERT INTO grc_operational_alerts (
  id, tenant_id, code, severity, status, title, description, entity_type,
  entity_id, due_at, owner_user_id, acknowledged_by, acknowledged_at,
  resolved_at, metadata, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('operational-alert-'||gs), c.tenant_id,
       'ALERT-DEMO-'||lpad(gs::text,3,'0'),
       (ARRAY['critical','high','medium','low','info'])[((gs-1)%5)+1],
       CASE WHEN gs<=4 THEN 'resolved' WHEN gs<=8 THEN 'acknowledged' ELSE 'open' END,
       (ARRAY['Riesgo residual fuera de apetito','Evidencia próxima a vencer','Control con resultado parcial','Acción con atraso','Fuente semántica envejecida'])[((gs-1)%5)+1],
       'Alerta accionable enlazada a objeto, dueño y fecha, con severidad y estado diversos.',
       (ARRAY['risk','evidence','control','action','metric'])[((gs-1)%5)+1],
       CASE WHEN gs%5=1 THEN pg_temp.demo_base_uuid('risk-'||(((gs-1)%24)+1))
            WHEN gs%5=2 THEN pg_temp.demo_base_uuid('evidence-'||(((gs-1)%80)+1))
            WHEN gs%5=3 THEN pg_temp.demo_base_uuid('tenant-control-'||(((gs-1)%55)+1))
            WHEN gs%5=4 THEN pg_temp.demo_base_uuid('action-'||(((gs-1)%24)+1))
            ELSE pg_temp.demo_base_uuid('metric-'||(((gs-1)%12)+1)) END,
       now()+((gs-7)*6||' days')::interval, CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END,
       CASE WHEN gs<=8 THEN c.admin_id END, CASE WHEN gs<=8 THEN now()-((13-gs)||' days')::interval END,
       CASE WHEN gs<=4 THEN now()-((9-gs)||' days')::interval END,
       jsonb_build_object('source','demo_visual_completion','navigable',true),
       now()-((16-gs)*5||' days')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,15) gs
ON CONFLICT (id) DO UPDATE SET severity=EXCLUDED.severity, status=EXCLUDED.status,
  title=EXCLUDED.title, description=EXCLUDED.description, due_at=EXCLUDED.due_at,
  owner_user_id=EXCLUDED.owner_user_id, acknowledged_by=EXCLUDED.acknowledged_by,
  acknowledged_at=EXCLUDED.acknowledged_at, resolved_at=EXCLUDED.resolved_at,
  metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO grc_metric_observations (
  id, tenant_id, metric_code, metric_type, numeric_value, unit, observed_at,
  valid_until, entity_type, entity_id, source_type, source_id, provenance,
  confidence, created_at
)
SELECT pg_temp.demo_visual_uuid('phase2-observation-'||metric_no||'-'||month_no), c.tenant_id,
       'demo.ops.'||metric_no, CASE WHEN metric_no%4=0 THEN 'kri' WHEN metric_no%3=0 THEN 'assurance' ELSE 'operational' END,
       CASE WHEN metric_no IN (4,8) THEN greatest(1,14-month_no+metric_no%3)
            ELSE 68+month_no*1.7+((metric_no*month_no)%6) END,
       CASE WHEN metric_no IN (4,8) THEN 'count' ELSE '%' END,
       date_trunc('month',current_date)-((12-month_no)||' months')::interval+interval '20 days',
       date_trunc('month',current_date)-((11-month_no)||' months')::interval+interval '20 days',
       'service', pg_temp.demo_visual_uuid('service-'||metric_no), 'connector_run',
       pg_temp.demo_visual_uuid('connector-run-'||(((metric_no-1)%4)+1)||'-'||month_no),
       jsonb_build_object('source','demo_visual_completion','connector',((metric_no-1)%4)+1,'period',month_no),
       78+month_no, date_trunc('month',current_date)-((12-month_no)||' months')::interval+interval '20 days'
FROM demo_visual_context c CROSS JOIN generate_series(1,8) metric_no CROSS JOIN generate_series(1,12) month_no
ON CONFLICT (id) DO UPDATE SET numeric_value=EXCLUDED.numeric_value, valid_until=EXCLUDED.valid_until,
  provenance=EXCLUDED.provenance, confidence=EXCLUDED.confidence;

-- Governed data-quality, metric-source and threshold detail for Phase 5 endpoints.
INSERT INTO data_owners (id, tenant_id, data_element_id, data_domain_id, owner_user_id, owner_type, status, created_by, metadata)
SELECT pg_temp.demo_visual_uuid('data-owner-'||gs), c.tenant_id,
       pg_temp.demo_base_uuid('element-'||(ARRAY['compliance_score','risk_level','control_effectiveness','evidence_freshness','metric_value','trust_score'])[((gs-1)%6)+1]),
       NULL, CASE WHEN gs%2=0 THEN c.auditor_id ELSE c.admin_id END,
       (ARRAY['business_owner','technical_owner','steward','reviewer'])[((gs-1)%4)+1],
       'active', c.admin_id, jsonb_build_object('source','demo_visual_completion')
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (tenant_id, COALESCE(data_element_id, data_domain_id), owner_user_id, owner_type) DO NOTHING;

INSERT INTO data_quality_rules (
  id, tenant_id, data_element_id, rule_key, display_name, rule_type, severity,
  rule_definition, status, created_by, created_at, updated_at, metadata
)
SELECT pg_temp.demo_visual_uuid('quality-rule-'||gs), c.tenant_id,
       pg_temp.demo_base_uuid('element-'||(ARRAY['compliance_score','risk_level','control_effectiveness','evidence_freshness','metric_value','trust_score'])[((gs-1)%6)+1]),
       'demo_quality_'||lpad(gs::text,2,'0'),
       (ARRAY['Completitud de medición','Rango válido','Consistencia temporal','Cobertura de lineage','Freshness máximo','Referencia navegable'])[((gs-1)%6)+1]||' '||(((gs-1)/6)+1),
       (ARRAY['completeness','range','consistency','coverage','max_age','reference'])[((gs-1)%6)+1],
       CASE WHEN gs%7=0 THEN 'critical' WHEN gs%4=0 THEN 'high' ELSE 'medium' END,
       CASE WHEN gs%6=1 THEN jsonb_build_object('required_fields',jsonb_build_array('value','period','source'))
            WHEN gs%6=2 THEN jsonb_build_object('min',0,'max',100)
            WHEN gs%6=5 THEN jsonb_build_object('max_age_hours',744)
            ELSE jsonb_build_object('minimum_coverage_pct',85,'tenant_scoped',true) END,
       'active', c.admin_id, now()-interval '12 months', now(),
       jsonb_build_object('source','demo_visual_completion','rule_version',1)
FROM demo_visual_context c CROSS JOIN generate_series(1,18) gs
ON CONFLICT (tenant_id, rule_key) DO UPDATE SET display_name=EXCLUDED.display_name,
  severity=EXCLUDED.severity, rule_definition=EXCLUDED.rule_definition,
  status='active', metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO data_quality_assessments (
  id, tenant_id, data_element_id, quality_rule_id, assessed_entity_type,
  assessed_entity_id, assessment_status, score, findings, assessed_at,
  assessed_by, correlation_id, metadata
)
SELECT pg_temp.demo_visual_uuid('quality-assessment-'||rule_no||'-'||month_no), c.tenant_id,
       pg_temp.demo_base_uuid('element-'||(ARRAY['compliance_score','risk_level','control_effectiveness','evidence_freshness','metric_value','trust_score'])[((rule_no-1)%6)+1]),
       pg_temp.demo_visual_uuid('quality-rule-'||rule_no), 'metric_definition',
       pg_temp.demo_base_uuid('metric-'||(((rule_no-1)%12)+1)),
       CASE WHEN month_no=2 AND rule_no%5=0 THEN 'incomplete' WHEN month_no=4 AND rule_no%7=0 THEN 'estimated' ELSE 'valid' END,
       least(99,72+month_no*1.4+(rule_no%8)),
       CASE WHEN month_no IN (2,4) AND rule_no%5=0 THEN jsonb_build_array(jsonb_build_object('code','DQ-DEMO','message','Fuente recibida con atraso y reconciliada.')) ELSE '[]'::jsonb END,
       date_trunc('month',current_date)-((12-month_no)||' months')::interval+interval '25 days',
       c.auditor_id, 'demo-quality-'||rule_no||'-'||month_no,
       jsonb_build_object('source','demo_visual_completion','period',month_no)
FROM demo_visual_context c CROSS JOIN generate_series(1,18) rule_no CROSS JOIN generate_series(1,12) month_no
ON CONFLICT (id) DO UPDATE SET assessment_status=EXCLUDED.assessment_status,
  score=EXCLUDED.score, findings=EXCLUDED.findings, metadata=EXCLUDED.metadata;

INSERT INTO metric_sources (
  id, metric_definition_id, data_source_id, source_key, source_entity,
  source_field, role, status, metadata
)
SELECT pg_temp.demo_visual_uuid('metric-source-'||metric_no||'-'||role_no),
       pg_temp.demo_base_uuid('metric-'||metric_no),
       pg_temp.demo_base_uuid('source-'||(ARRAY['controls','evidences','risks','findings','actions','metrics'])[((metric_no-1)%6)+1]),
       'demo_source_'||metric_no||'_'||role_no,
       (ARRAY['tenant_controls','evidences','asset_risks','findings','action_plans','metric_measurements'])[((metric_no-1)%6)+1],
       CASE WHEN metric_no IN (5,6,7) THEN 'status' ELSE 'value_numeric' END,
       CASE WHEN role_no=1 THEN 'primary' ELSE 'validation' END,
       'active', jsonb_build_object('source','demo_visual_completion','tenant_scoped',true)
FROM generate_series(1,12) metric_no CROSS JOIN generate_series(1,2) role_no
ON CONFLICT (metric_definition_id, source_key, role) DO UPDATE SET
  source_entity=EXCLUDED.source_entity, source_field=EXCLUDED.source_field,
  status='active', metadata=EXCLUDED.metadata;

INSERT INTO metric_thresholds (
  id, metric_definition_id, threshold_key, label, operator, value_min,
  value_max, status_result, effective_from, created_by, metadata
)
SELECT pg_temp.demo_visual_uuid('metric-threshold-'||metric_no||'-'||band_no),
       pg_temp.demo_base_uuid('metric-'||metric_no),
       CASE WHEN band_no=1 THEN 'good' WHEN band_no=2 THEN 'warning' ELSE 'critical' END,
       CASE WHEN band_no=1 THEN 'Objetivo' WHEN band_no=2 THEN 'Atención' ELSE 'Crítico' END,
       'between',
       CASE WHEN metric_no IN (5,6,7,11) THEN (band_no-1)*4 ELSE CASE WHEN band_no=1 THEN 85 WHEN band_no=2 THEN 70 ELSE 0 END END,
       CASE WHEN metric_no IN (5,6,7,11) THEN band_no*4-0.01 ELSE CASE WHEN band_no=1 THEN 100 WHEN band_no=2 THEN 84.99 ELSE 69.99 END END,
       CASE WHEN band_no=1 THEN 'good' WHEN band_no=2 THEN 'warning' ELSE 'critical' END,
       now()-interval '12 months', c.admin_id,
       jsonb_build_object('source','demo_visual_completion','traffic_light',true)
FROM demo_visual_context c CROSS JOIN generate_series(1,12) metric_no CROSS JOIN generate_series(1,3) band_no
ON CONFLICT (metric_definition_id, threshold_key) DO UPDATE SET label=EXCLUDED.label,
  operator=EXCLUDED.operator, value_min=EXCLUDED.value_min, value_max=EXCLUDED.value_max,
  status_result=EXCLUDED.status_result, metadata=EXCLUDED.metadata;

INSERT INTO data_trust_scores (
  id, tenant_id, entity_type, entity_id, score, status, components,
  calculated_at, formula_version, correlation_id, metadata
)
SELECT pg_temp.demo_visual_uuid('trust-score-'||metric_no||'-'||month_no), c.tenant_id,
       'metric_definition', pg_temp.demo_base_uuid('metric-'||metric_no),
       least(98,70+month_no*1.6+(metric_no%7)),
       CASE WHEN month_no<=2 AND metric_no%4=0 THEN 'attention' WHEN month_no<=4 THEN 'acceptable' ELSE 'trusted' END,
       jsonb_build_object('quality',72+month_no*1.5,'freshness',68+month_no*2,'lineage',80+(metric_no%8),'sufficiency',74+month_no),
       date_trunc('month',current_date)-((12-month_no)||' months')::interval+interval '26 days',
       'data_trust_score_v1', 'demo-trust-'||metric_no||'-'||month_no,
       jsonb_build_object('source','demo_visual_completion')
FROM demo_visual_context c CROSS JOIN generate_series(1,12) metric_no CROSS JOIN generate_series(1,12) month_no
ON CONFLICT (tenant_id, entity_type, entity_id, correlation_id) DO UPDATE SET
  score=EXCLUDED.score, status=EXCLUDED.status, components=EXCLUDED.components,
  calculated_at=EXCLUDED.calculated_at, metadata=EXCLUDED.metadata;

-- Survey detail: sections, questions, recipients, responses, scoring and approval.
INSERT INTO survey_sections (id, survey_version_id, section_key, title, description, sort_order, metadata)
SELECT pg_temp.demo_visual_uuid('survey-section-'||gs), pg_temp.demo_base_uuid('survey-version-supplier-assessment'),
       'section_'||gs, (ARRAY['Gobierno y alcance','Seguridad y privacidad','Continuidad y terceros','Evidencia y mejora'])[((gs-1)%4)+1],
       'Sección comercial con preguntas, ponderación y evidencia.', gs*10,
       jsonb_build_object('source','demo_visual_completion')
FROM generate_series(1,4) gs
ON CONFLICT (survey_version_id, section_key) DO NOTHING;

INSERT INTO survey_questions (
  id, survey_version_id, section_id, question_key, question_text, question_type,
  help_text, required, allow_not_applicable, validation_definition,
  scoring_definition, weight, branching_definition, visibility_condition,
  sort_order, metadata
)
SELECT pg_temp.demo_visual_uuid('survey-question-'||gs), pg_temp.demo_base_uuid('survey-version-supplier-assessment'),
       pg_temp.demo_visual_uuid('survey-section-'||(((gs-1)/4)+1)), 'question_'||lpad(gs::text,2,'0'),
       (ARRAY['¿Existe responsable formal y alcance aprobado?','¿Se revisan accesos privilegiados?','¿Se cifran datos en tránsito y reposo?','¿Se prueban respaldos y recuperación?','¿Se gestionan subprocesadores?','¿Se notifican incidentes según SLA?','¿Existe continuidad probada?','¿Las evidencias están vigentes?'])[((gs-1)%8)+1],
       CASE WHEN gs%4=0 THEN 'evidence' WHEN gs%3=0 THEN 'scale' ELSE 'yes_no' END,
       'Responder con base en evidencia vigente y alcance contractual.', true, gs%5=0,
       jsonb_build_object('min',CASE WHEN gs%3=0 THEN 1 END,'max',CASE WHEN gs%3=0 THEN 5 END),
       jsonb_build_object('yes',5,'no',0,'max_score',5), 1+(gs%3)*0.5,
       jsonb_build_object('if_no','request_evidence'), '{}'::jsonb, gs*10,
       jsonb_build_object('source','demo_visual_completion','control_id',pg_temp.demo_base_uuid('tenant-control-'||(((gs*3-1)%55)+1)))
FROM generate_series(1,16) gs
ON CONFLICT (survey_version_id, question_key) DO NOTHING;

INSERT INTO assessment_recipients (
  id, tenant_id, campaign_id, user_id, external_contact, recipient_status,
  invited_at, responded_at, token_hash, metadata
)
SELECT pg_temp.demo_visual_uuid('survey-recipient-'||gs), c.tenant_id,
       pg_temp.demo_base_uuid('survey-campaign-cloud'),
       CASE WHEN gs=1 THEN c.admin_id WHEN gs=2 THEN c.auditor_id END,
       CASE WHEN gs<=2 THEN '{}'::jsonb ELSE jsonb_build_object('display_name','Responsable proveedor '||gs,'contact_reference','demo-supplier-'||gs) END,
       CASE WHEN gs<=6 THEN 'responded' WHEN gs=7 THEN 'opened' ELSE 'sent' END,
       now()-(25-gs||' days')::interval, CASE WHEN gs<=6 THEN now()-(14-gs||' days')::interval END,
       encode(digest('demo-survey-token-'||gs,'sha256'),'hex'),
       jsonb_build_object('source','demo_visual_completion','supplier_id',pg_temp.demo_visual_uuid('supplier-'||gs))
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET recipient_status=EXCLUDED.recipient_status,
  responded_at=EXCLUDED.responded_at, metadata=EXCLUDED.metadata;

INSERT INTO survey_responses (
  id, tenant_id, campaign_id, survey_version_id, recipient_id, respondent_user_id,
  status, submitted_at, total_score, max_score, created_at, updated_at, metadata
)
SELECT pg_temp.demo_visual_uuid('survey-response-'||gs), c.tenant_id,
       pg_temp.demo_base_uuid('survey-campaign-cloud'), pg_temp.demo_base_uuid('survey-version-supplier-assessment'),
       pg_temp.demo_visual_uuid('survey-recipient-'||gs), CASE WHEN gs=1 THEN c.admin_id WHEN gs=2 THEN c.auditor_id END,
       CASE WHEN gs<=4 THEN 'approved' WHEN gs<=6 THEN 'evaluated' ELSE 'draft' END,
       CASE WHEN gs<=6 THEN now()-(14-gs||' days')::interval END,
       CASE WHEN gs<=6 THEN 62+gs*5 END, CASE WHEN gs<=6 THEN 100 END,
       now()-(25-gs||' days')::interval, now(),
       jsonb_build_object('source','demo_visual_completion','supplier_id',pg_temp.demo_visual_uuid('supplier-'||gs))
FROM demo_visual_context c CROSS JOIN generate_series(1,8) gs
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, submitted_at=EXCLUDED.submitted_at,
  total_score=EXCLUDED.total_score, max_score=EXCLUDED.max_score, metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO survey_response_items (
  id, tenant_id, response_id, question_id, answer_text, answer_numeric,
  answer_json, not_applicable, score, evidence_id, created_at, metadata
)
SELECT pg_temp.demo_visual_uuid('survey-answer-'||response_no||'-'||question_no), c.tenant_id,
       pg_temp.demo_visual_uuid('survey-response-'||response_no), pg_temp.demo_visual_uuid('survey-question-'||question_no),
       CASE WHEN question_no%3<>0 THEN CASE WHEN (response_no+question_no)%5=0 THEN 'No' ELSE 'Sí' END END,
       CASE WHEN question_no%3=0 THEN 2+((response_no+question_no)%4) END,
       jsonb_build_object('comment','Respuesta demostrativa sustentada en evidencia y revisión.'),
       question_no%11=0, CASE WHEN (response_no+question_no)%5=0 THEN 1 ELSE 4 END,
       pg_temp.demo_base_uuid('evidence-'||(((response_no*question_no-1)%80)+1)), now()-interval '8 days',
       jsonb_build_object('source','demo_visual_completion')
FROM demo_visual_context c CROSS JOIN generate_series(1,6) response_no CROSS JOIN generate_series(1,16) question_no
ON CONFLICT (tenant_id, response_id, question_id) DO UPDATE SET
  answer_text=EXCLUDED.answer_text, answer_numeric=EXCLUDED.answer_numeric,
  answer_json=EXCLUDED.answer_json, not_applicable=EXCLUDED.not_applicable,
  score=EXCLUDED.score, evidence_id=EXCLUDED.evidence_id, metadata=EXCLUDED.metadata;

INSERT INTO survey_evaluations (
  id, tenant_id, response_id, evaluation_status, score, findings_preview,
  consequences_preview, created_by, confirmed_by, created_at, confirmed_at, metadata
)
SELECT pg_temp.demo_visual_uuid('survey-evaluation-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('survey-response-'||gs), CASE WHEN gs<=4 THEN 'applied' ELSE 'confirmed' END,
       62+gs*5,
       CASE WHEN gs<=2 THEN jsonb_build_array(jsonb_build_object('severity','medium','title','Evidencia de continuidad incompleta')) ELSE '[]'::jsonb END,
       jsonb_build_array(jsonb_build_object('type','risk_update','status','previewed')),
       c.auditor_id, c.admin_id, now()-(10-gs||' days')::interval,
       now()-(9-gs||' days')::interval, jsonb_build_object('source','demo_visual_completion')
FROM demo_visual_context c CROSS JOIN generate_series(1,6) gs
ON CONFLICT (id) DO UPDATE SET evaluation_status=EXCLUDED.evaluation_status,
  score=EXCLUDED.score, findings_preview=EXCLUDED.findings_preview,
  consequences_preview=EXCLUDED.consequences_preview, metadata=EXCLUDED.metadata;

INSERT INTO survey_approvals (id, tenant_id, response_id, evaluation_id, approval_status, comment, approved_by, approved_at, metadata)
SELECT pg_temp.demo_visual_uuid('survey-approval-'||gs), c.tenant_id,
       pg_temp.demo_visual_uuid('survey-response-'||gs), pg_temp.demo_visual_uuid('survey-evaluation-'||gs),
       CASE WHEN gs=3 THEN 'changes_requested' ELSE 'approved' END,
       CASE WHEN gs=3 THEN 'Completar evidencia del ensayo de recuperación.' ELSE 'Respuesta y evaluación revisadas.' END,
       c.admin_id, now()-(7-gs||' days')::interval, jsonb_build_object('source','demo_visual_completion')
FROM demo_visual_context c CROSS JOIN generate_series(1,6) gs
ON CONFLICT (id) DO UPDATE SET approval_status=EXCLUDED.approval_status,
  comment=EXCLUDED.comment, approved_by=EXCLUDED.approved_by,
  approved_at=EXCLUDED.approved_at, metadata=EXCLUDED.metadata;

-- Assurance sample/result/exception detail for every existing test execution.
INSERT INTO assurance_test_samples (id, tenant_id, execution_id, sample_reference, sample_description, selected_at, metadata)
SELECT pg_temp.demo_visual_uuid('assurance-sample-'||execution_no||'-'||sample_no), c.tenant_id,
       pg_temp.demo_base_uuid('assurance-execution-'||execution_no),
       'SAMPLE-'||lpad(execution_no::text,2,'0')||'-'||sample_no,
       'Elemento de población seleccionado por riesgo, periodo y materialidad.',
       now()-((execution_no*7+sample_no)||' days')::interval,
       jsonb_build_object('source','demo_visual_completion','population_index',sample_no)
FROM demo_visual_context c CROSS JOIN generate_series(1,12) execution_no CROSS JOIN generate_series(1,5) sample_no
ON CONFLICT (id) DO UPDATE SET sample_description=EXCLUDED.sample_description, metadata=EXCLUDED.metadata;

INSERT INTO assurance_test_results (
  id, tenant_id, execution_id, sample_id, result, severity, observation,
  evidence_id, created_by, created_at, metadata
)
SELECT pg_temp.demo_visual_uuid('assurance-result-'||execution_no||'-'||sample_no), c.tenant_id,
       pg_temp.demo_base_uuid('assurance-execution-'||execution_no),
       pg_temp.demo_visual_uuid('assurance-sample-'||execution_no||'-'||sample_no),
       CASE WHEN execution_no IN (3,7,11) AND sample_no IN (2,5) THEN 'fail'
            WHEN sample_no=4 THEN 'pass_with_observations' ELSE 'pass' END,
       CASE WHEN execution_no IN (3,7,11) AND sample_no IN (2,5) THEN 'high'
            WHEN sample_no=4 THEN 'low' END,
       CASE WHEN execution_no IN (3,7,11) AND sample_no IN (2,5) THEN 'La ejecución no acredita el resultado esperado para el periodo.'
            WHEN sample_no=4 THEN 'Cumple con oportunidad de mejorar la trazabilidad.' ELSE 'Resultado conforme y evidencia suficiente.' END,
       pg_temp.demo_base_uuid('evidence-'||(((execution_no*5+sample_no-1)%80)+1)), c.auditor_id,
       now()-((execution_no*7-sample_no)||' days')::interval,
       jsonb_build_object('source','demo_visual_completion','reviewed',true)
FROM demo_visual_context c CROSS JOIN generate_series(1,12) execution_no CROSS JOIN generate_series(1,5) sample_no
ON CONFLICT (id) DO UPDATE SET result=EXCLUDED.result, severity=EXCLUDED.severity,
  observation=EXCLUDED.observation, evidence_id=EXCLUDED.evidence_id, metadata=EXCLUDED.metadata;

INSERT INTO assurance_test_exceptions (
  id, tenant_id, execution_id, result_id, severity, description, status,
  finding_id, action_id, created_by, created_at, metadata
)
SELECT pg_temp.demo_visual_uuid('assurance-exception-'||execution_no||'-'||sample_no), c.tenant_id,
       pg_temp.demo_base_uuid('assurance-execution-'||execution_no),
       pg_temp.demo_visual_uuid('assurance-result-'||execution_no||'-'||sample_no),
       'high', 'Excepción de muestra trazada a hallazgo, acción y evidencia.',
       CASE WHEN execution_no=3 THEN 'remediated' WHEN execution_no=7 THEN 'accepted' ELSE 'open' END,
       pg_temp.demo_base_uuid('finding-'||execution_no), pg_temp.demo_base_uuid('action-'||execution_no),
       c.auditor_id, now()-(execution_no*5||' days')::interval,
       jsonb_build_object('source','demo_visual_completion','verification_required',execution_no=11)
FROM demo_visual_context c CROSS JOIN (VALUES (3,2),(3,5),(7,2),(7,5),(11,2),(11,5)) v(execution_no,sample_no)
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, description=EXCLUDED.description,
  finding_id=EXCLUDED.finding_id, action_id=EXCLUDED.action_id, metadata=EXCLUDED.metadata;

INSERT INTO dashboard_permissions (
  id, tenant_id, dashboard_id, principal_type, principal_id, permission_level,
  created_by, created_at, metadata
)
SELECT pg_temp.demo_visual_uuid('dashboard-permission-'||dashboard_key||'-'||role_name), c.tenant_id,
       pg_temp.demo_base_uuid('dashboard-'||dashboard_key), 'role', role_name, 'read',
       c.admin_id, now()-interval '10 months', jsonb_build_object('source','demo_visual_completion')
FROM demo_visual_context c
CROSS JOIN (VALUES ('executive_grc'),('compliance'),('risk'),('data_quality')) d(dashboard_key)
CROSS JOIN (VALUES ('admin'),('auditor')) r(role_name)
ON CONFLICT (dashboard_id, principal_type, principal_id, permission_level) DO NOTHING;

INSERT INTO report_template_versions (
  id, tenant_id, template_key, display_name, version_number, format,
  template_definition, status, created_by, created_at, metadata
)
SELECT pg_temp.demo_visual_uuid('report-template-'||report_key||'-'||format), c.tenant_id,
       'demo_tecdex_'||report_key, display_name, 1, format,
       jsonb_build_object('sections',jsonb_build_array('portada','resumen','tendencias','riesgos','controles','hallazgos','acciones','lineage'),
                          'filters',jsonb_build_array('period','standard','owner','status'),
                          'classification','internal'),
       'published', c.admin_id, now()-interval '9 months',
       jsonb_build_object('source','demo_visual_completion','commercial',true)
FROM demo_visual_context c
CROSS JOIN (VALUES
  ('executive_grc','Plantilla ejecutiva GRC'),('risks','Plantilla de riesgos'),
  ('compliance','Plantilla de cumplimiento'),('data_quality','Plantilla de calidad de datos')
) r(report_key,display_name)
CROSS JOIN (VALUES ('pdf'),('docx'),('xlsx')) f(format)
ON CONFLICT (tenant_id, template_key, version_number, format) DO NOTHING;

INSERT INTO report_schedules (
  id, tenant_id, report_type_code, frequency, day_of_month, recipients,
  is_active, created_by, last_sent_at, next_run_at, notes, metadata,
  created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('report-schedule-'||report_key), c.tenant_id,
       CASE report_key
         WHEN 'executive_grc' THEN 'executive_iso_status'
         WHEN 'risks' THEN 'iso_risk_report'
         WHEN 'compliance' THEN 'control_health_report'
         WHEN 'data_quality' THEN 'maturity_gap_diagnostic'
       END,
       CASE WHEN report_key='risks' THEN 'quarterly' ELSE 'monthly' END,
       CASE WHEN report_key='executive_grc' THEN 1 WHEN report_key='risks' THEN 15 ELSE 5 END,
       jsonb_build_array('admin.demo@tcdx.demo','auditor.demo@tcdx.demo'),
       true, c.admin_id,
       date_trunc('month',now())+interval '8 hours',
       date_trunc('month',now())+interval '1 month 8 hours',
       'Programación demo determinística para cobertura comercial.',
       jsonb_build_object('source','demo_visual_completion','report_key',report_key,'timezone','America/Santiago'),
       now()-interval '8 months', now()
FROM demo_visual_context c
CROSS JOIN (VALUES ('executive_grc'),('risks'),('compliance'),('data_quality')) r(report_key)
ON CONFLICT (id) DO UPDATE SET
  report_type_code=EXCLUDED.report_type_code,
  frequency=EXCLUDED.frequency,
  day_of_month=EXCLUDED.day_of_month,
  recipients=EXCLUDED.recipients,
  is_active=true,
  created_by=EXCLUDED.created_by,
  last_sent_at=EXCLUDED.last_sent_at,
  next_run_at=EXCLUDED.next_run_at,
  notes=EXCLUDED.notes,
  metadata=EXCLUDED.metadata,
  updated_at=now();

-- Filas consumidas por las dos entradas operacionales que aún usan read models legacy.
INSERT INTO iso_operational_suggestions (
  id, tenant_id, standard_code, operation_id, tenant_control_id, source_module,
  source_entity_type, source_entity_id, source_reason, suggestion_type,
  target_record_type, title, description, rationale, priority, status, dedupe_key,
  suggested_owner, suggested_due_date, payload_json, source_trace_json, created_by,
  approved_by, approved_at, rejected_by, rejected_at, rejection_comment,
  created_record_type, created_record_id, created_at, updated_at
)
SELECT pg_temp.demo_visual_uuid('operational-suggestion-'||gs), c.tenant_id,
       CASE WHEN gs<=8 THEN 'ISO9001' ELSE 'ISO27001' END,
       pg_temp.demo_base_uuid('operation-'||(((gs-1)%10)+1)),
       pg_temp.demo_base_uuid('tenant-control-'||(((gs*3-1)%55)+1)),
       (ARRAY['health','risk_matrix','evidence','audit'])[((gs-1)%4)+1],
       (ARRAY['tenant_control','risk','evidence','finding'])[((gs-1)%4)+1],
       pg_temp.demo_base_uuid('tenant-control-'||(((gs*3-1)%55)+1)),
       'Señal operativa demostrable originada en el read model real.',
       (ARRAY['remediation','risk_treatment','evidence_refresh','control_test'])[((gs-1)%4)+1],
       (ARRAY['action_plan','finding','evidence_request','nonconformity'])[((gs-1)%4)+1],
       'Recomendación operativa '||lpad(gs::text,2,'0')||': '||
         (ARRAY['cerrar brecha de diseño','reducir exposición residual','renovar evidencia','repetir prueba de efectividad'])[((gs-1)%4)+1],
       'Acción propuesta con origen, prioridad, responsable y relación navegable.',
       'La tendencia y el umbral del objeto fuente requieren tratamiento humano trazable.',
       (ARRAY['critica','alta','media','baja'])[((gs-1)%4)+1],
       (ARRAY['pending','approved','applied','rejected'])[((gs-1)%4)+1],
       'demo-visual-operational-'||gs,
       (ARRAY['Gerencia de Operaciones','CISO','Quality Manager','Internal Auditor'])[((gs-1)%4)+1],
       current_date+((gs-5)*5),
       jsonb_build_object('source','demo_visual_completion','progress',10+gs*5),
       jsonb_build_object('tenant_id',c.tenant_id,'control_id',pg_temp.demo_base_uuid('tenant-control-'||(((gs*3-1)%55)+1))),
       c.admin_id,
       CASE WHEN gs%4 IN (2,3) THEN c.auditor_id END,
       CASE WHEN gs%4 IN (2,3) THEN now()-(gs||' days')::interval END,
       CASE WHEN gs%4=0 THEN c.auditor_id END,
       CASE WHEN gs%4=0 THEN now()-(gs||' days')::interval END,
       CASE WHEN gs%4=0 THEN 'Se priorizó una medida alternativa con mejor costo-beneficio.' END,
       CASE WHEN gs%4=3 THEN 'action_plan' END,
       CASE WHEN gs%4=3 THEN pg_temp.demo_base_uuid('action-'||(((gs-1)%24)+1)) END,
       now()-((17-gs)||' months')::interval, now()
FROM demo_visual_context c CROSS JOIN generate_series(1,16) gs
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, rationale=EXCLUDED.rationale,
  priority=EXCLUDED.priority, status=EXCLUDED.status, suggested_owner=EXCLUDED.suggested_owner,
  suggested_due_date=EXCLUDED.suggested_due_date, payload_json=EXCLUDED.payload_json,
  source_trace_json=EXCLUDED.source_trace_json, updated_at=now();

INSERT INTO report_exports (
  id, tenant_id, requested_by, report_type_code, report_title, report_format,
  status, file_url, payload_json, metadata, generated_at
)
SELECT pg_temp.demo_visual_uuid('legacy-report-export-'||gs), c.tenant_id,
       CASE WHEN gs%3=0 THEN c.auditor_id ELSE c.admin_id END,
       (ARRAY['executive_iso_status','iso_risk_report','control_health_report','internal_audit_report'])[((gs-1)%4)+1],
       (ARRAY['Estado ejecutivo SGI','Registro de riesgos','Cumplimiento integrado','Resumen de auditoría'])[((gs-1)%4)+1]
         ||' · '||to_char(date_trunc('month',now())-((12-gs)||' months')::interval,'Mon YYYY'),
       (ARRAY['pdf','xlsx','pdf','docx'])[((gs-1)%4)+1], 'generated',
       '/uploads/reports/'||c.tenant_id||'/demo-commercial-'||lpad(gs::text,2,'0')||'.pdf',
       jsonb_build_object('period_start',date_trunc('month',now())-((12-gs)||' months')::interval,
                          'standards',jsonb_build_array('ISO9001','ISO27001'),'records',24+gs),
       jsonb_build_object('source','demo_visual_completion','commercial',true,'navigable_generation_id',pg_temp.demo_base_uuid('report-generation-'||
         (ARRAY['executive_grc','risks','compliance','data_quality'])[((gs-1)%4)+1]||'-'||
         (ARRAY['pdf','docx','xlsx'])[((gs-1)%3)+1])),
       date_trunc('month',now())-((12-gs)||' months')::interval+interval '8 hours'
FROM demo_visual_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (id) DO UPDATE SET
  report_title=EXCLUDED.report_title, report_format=EXCLUDED.report_format,
  status=EXCLUDED.status, file_url=EXCLUDED.file_url, payload_json=EXCLUDED.payload_json,
  metadata=EXCLUDED.metadata, generated_at=EXCLUDED.generated_at;

DO $$
DECLARE
  demo_id constant uuid := '76c44a0e-6041-8bda-99c7-b740fccea001'::uuid;
  failure text;
BEGIN
  SELECT string_agg(label||'='||actual||'<'||minimum, ', ' ORDER BY label)
  INTO failure
  FROM (
    SELECT 'standard_operations' label, count(*)::int actual, 20 minimum FROM tenant_standard_operations WHERE tenant_id=demo_id
    UNION ALL SELECT 'applicable_controls',count(*)::int,55 FROM tenant_applicable_controls WHERE tenant_id=demo_id
    UNION ALL SELECT 'control_health',count(*)::int,55 FROM control_health_scores WHERE tenant_id=demo_id
    UNION ALL SELECT 'control_assurance',count(*)::int,55 FROM grc_control_assurance WHERE tenant_id=demo_id
    UNION ALL SELECT 'legacy_kpi_series',count(*)::int,144 FROM kpi_snapshots WHERE tenant_id=demo_id
    UNION ALL SELECT 'audit_workpapers',count(*)::int,15 FROM grc_audit_workpapers WHERE tenant_id=demo_id
    UNION ALL SELECT 'suppliers',count(*)::int,8 FROM grc_suppliers WHERE tenant_id=demo_id
    UNION ALL SELECT 'privacy_activities',count(*)::int,10 FROM privacy_processing_activities WHERE tenant_id=demo_id
    UNION ALL SELECT 'incidents',count(*)::int,12 FROM grc_incidents WHERE tenant_id=demo_id
    UNION ALL SELECT 'incident_timeline',count(*)::int,48 FROM grc_incident_timeline WHERE tenant_id=demo_id
    UNION ALL SELECT 'connector_runs',count(*)::int,48 FROM grc_connector_runs WHERE tenant_id=demo_id
    UNION ALL SELECT 'organizational_units',count(*)::int,8 FROM grc_organizational_units WHERE tenant_id=demo_id
    UNION ALL SELECT 'services',count(*)::int,8 FROM grc_operational_services WHERE tenant_id=demo_id
    UNION ALL SELECT 'continuity_tests',count(*)::int,24 FROM grc_continuity_tests WHERE tenant_id=demo_id
    UNION ALL SELECT 'operational_metric_series',count(*)::int,96 FROM grc_metric_measurements WHERE tenant_id=demo_id
    UNION ALL SELECT 'iso_risk_items',count(*)::int,24 FROM iso_risk_matrix_items WHERE tenant_id=demo_id
    UNION ALL SELECT 'risk_simulations',count(*)::int,8 FROM operational_risk_simulations WHERE tenant_id=demo_id
    UNION ALL SELECT 'quality_assessments',count(*)::int,216 FROM data_quality_assessments WHERE tenant_id=demo_id
    UNION ALL SELECT 'survey_answers',count(*)::int,96 FROM survey_response_items WHERE tenant_id=demo_id
    UNION ALL SELECT 'assurance_samples',count(*)::int,60 FROM assurance_test_samples WHERE tenant_id=demo_id
    UNION ALL SELECT 'operational_suggestions',count(*)::int,16 FROM iso_operational_suggestions WHERE tenant_id=demo_id
    UNION ALL SELECT 'legacy_report_exports',count(*)::int,12 FROM report_exports WHERE tenant_id=demo_id
    UNION ALL SELECT 'report_schedules',count(*)::int,4 FROM report_schedules WHERE tenant_id=demo_id
  ) checks
  WHERE actual < minimum;

  IF failure IS NOT NULL THEN
    RAISE EXCEPTION 'Demo visual completion postconditions failed: %', failure;
  END IF;

  IF (SELECT count(DISTINCT period_start::date) FROM kpi_snapshots WHERE tenant_id=demo_id) < 12
     OR (SELECT count(DISTINCT period_start::date) FROM grc_metric_measurements WHERE tenant_id=demo_id) < 12 THEN
    RAISE EXCEPTION 'Demo visual completion postconditions failed: required 12-period series are incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM demo_visual_kpis expected
    LEFT JOIN kpi_definitions kd
      ON kd.code = expected.code
     AND kd.tenant_id = demo_id
    LEFT JOIN kpi_snapshots ks
      ON ks.kpi_id = kd.id
     AND ks.tenant_id = demo_id
    GROUP BY expected.seq, expected.code
    HAVING count(ks.id) <> 12
       OR count(DISTINCT ks.value) < 4
  ) THEN
    RAISE EXCEPTION 'Demo visual completion postconditions failed: generated KPI series are flat or incomplete';
  END IF;
END $$;

COMMIT;
