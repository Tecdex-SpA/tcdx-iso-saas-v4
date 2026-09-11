BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091102) THEN
    RAISE EXCEPTION 'TCDX post-lifecycle runtime consumers systemic closeout is already running';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.v_control_health_risks AS
SELECT
  veh.tenant_id,
  t.name AS tenant_name,
  veh.tenant_control_id,
  veh.standard_code,
  veh.clause,
  veh.category,
  veh.control_description,
  tc.status AS control_status,
  tc.priority,
  tc.applicability,
  veh.effective_health_score AS health_score,
  veh.effective_health_status AS health_status,
  CASE WHEN veh.evidence_count > 0 THEN 100::numeric ELSE NULL::numeric END AS evidence_score,
  veh.effective_health_score AS compliance_score,
  CASE WHEN veh.open_findings_count = 0 THEN 100::numeric ELSE 0::numeric END AS findings_score,
  CASE WHEN veh.overdue_action_plans_count = 0 THEN 100::numeric ELSE 0::numeric END AS action_score,
  CASE WHEN veh.high_risks_count = 0 THEN 100::numeric ELSE 0::numeric END AS risk_score,
  CASE WHEN veh.effective_health_score IS NULL THEN NULL::numeric ELSE 100::numeric END AS review_score,
  veh.evidence_count,
  veh.approved_evidence_count,
  veh.pending_evidence_count,
  veh.rejected_evidence_count,
  veh.open_findings_count,
  veh.open_action_plans_count AS open_actions_count,
  veh.overdue_action_plans_count AS overdue_actions_count,
  veh.high_risks_count,
  NULLIF(veh.health_trace_json->>'effective_at', '')::timestamptz AS calculated_at
FROM public.v_iso_control_effective_health veh
JOIN public.tenant_controls tc
  ON tc.tenant_id = veh.tenant_id
 AND tc.id = veh.tenant_control_id
LEFT JOIN public.tenants t
  ON t.id = veh.tenant_id;

CREATE OR REPLACE VIEW public.v_control_health_risks_applicable AS
SELECT v.*
FROM public.v_control_health_risks v
JOIN public.tenant_applicable_controls tac
  ON tac.tenant_id = v.tenant_id
 AND tac.tenant_control_id = v.tenant_control_id
 AND COALESCE(tac.standard_code, v.standard_code) = v.standard_code
WHERE COALESCE(tac.active, true) IS TRUE
  AND COALESCE(tac.visible_to_tenant, true) IS TRUE
  AND COALESCE(tac.applicability_status, 'applicable') NOT IN ('not_applicable', 'no_aplica', 'excluded');

CREATE OR REPLACE VIEW public.v_health_root_causes_by_standard AS
SELECT
  v.tenant_id,
  v.tenant_name,
  v.standard_code,
  COUNT(v.tenant_control_id)::bigint AS total_controls,
  ROUND(AVG(v.health_score) FILTER (WHERE v.health_score IS NOT NULL), 2) AS avg_health_score,
  COUNT(*) FILTER (WHERE v.health_status = 'saludable')::bigint AS healthy_controls,
  COUNT(*) FILTER (WHERE v.health_status = 'atencion')::bigint AS attention_controls,
  COUNT(*) FILTER (WHERE v.health_status = 'deteriorado')::bigint AS deteriorated_controls,
  COUNT(*) FILTER (WHERE v.health_status = 'critico')::bigint AS critical_controls,
  COUNT(*) FILTER (WHERE v.evidence_count = 0)::bigint AS controls_with_evidence_gap,
  COUNT(*) FILTER (WHERE v.health_status IN ('deteriorado','sin_datos'))::bigint AS controls_with_compliance_gap,
  COALESCE(SUM(v.open_findings_count), 0)::bigint AS controls_with_findings_gap,
  COALESCE(SUM(v.open_actions_count), 0)::bigint AS controls_with_action_gap,
  COALESCE(SUM(v.high_risks_count), 0)::bigint AS controls_with_risk_gap,
  COUNT(*) FILTER (WHERE v.health_score IS NULL)::bigint AS controls_with_review_gap,
  CASE WHEN COUNT(*) = 0 THEN NULL::numeric ELSE ROUND((COUNT(*) FILTER (WHERE v.evidence_count > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) END AS avg_evidence_score,
  ROUND(AVG(v.health_score) FILTER (WHERE v.health_score IS NOT NULL), 2) AS avg_compliance_score,
  100 - LEAST(COALESCE(SUM(v.open_findings_count), 0), 100)::numeric AS avg_findings_score,
  100 - LEAST(COALESCE(SUM(v.overdue_actions_count), 0), 100)::numeric AS avg_action_score,
  100 - LEAST(COALESCE(SUM(v.high_risks_count), 0), 100)::numeric AS avg_risk_score,
  CASE WHEN COUNT(*) FILTER (WHERE v.health_score IS NULL) > 0 THEN NULL::numeric ELSE 100::numeric END AS avg_review_score,
  COALESCE(SUM(v.evidence_count), 0)::bigint AS total_evidences,
  COALESCE(SUM(v.approved_evidence_count), 0)::bigint AS approved_evidences,
  COALESCE(SUM(v.pending_evidence_count), 0)::bigint AS pending_evidences,
  COALESCE(SUM(v.rejected_evidence_count), 0)::bigint AS rejected_evidences,
  COALESCE(SUM(v.open_findings_count), 0)::bigint AS open_findings,
  COALESCE(SUM(v.open_actions_count), 0)::bigint AS open_actions,
  COALESCE(SUM(v.overdue_actions_count), 0)::bigint AS overdue_actions,
  COALESCE(SUM(v.high_risks_count), 0)::bigint AS high_risks,
  jsonb_build_object('source', 'v_control_health_risks') AS main_cause_json,
  jsonb_build_array(
    jsonb_build_object('key', 'evidence', 'count', COUNT(*) FILTER (WHERE v.evidence_count = 0)),
    jsonb_build_object('key', 'findings', 'count', COALESCE(SUM(v.open_findings_count), 0)),
    jsonb_build_object('key', 'actions', 'count', COALESCE(SUM(v.overdue_actions_count), 0))
  ) AS causes_json,
  'Priorizar controles sin evidencia, hallazgos abiertos y acciones vencidas.'::text AS executive_recommendation
FROM public.v_control_health_risks v
GROUP BY v.tenant_id, v.tenant_name, v.standard_code;

CREATE OR REPLACE VIEW public.v_health_remediation_summary_by_tenant AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  COUNT(ap.id)::bigint AS total_suggested_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado'))::bigint AS open_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado') AND ap.due_date < CURRENT_DATE)::bigint AS overdue_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.metadata->>'priority', ap.status, '')) IN ('urgente','critical'))::bigint AS urgent_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.metadata->>'priority', ap.status, '')) IN ('alta','high'))::bigint AS high_actions,
  MIN(ap.due_date) FILTER (WHERE lower(COALESCE(ap.status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado')) AS next_due_date
FROM public.tenants t
LEFT JOIN public.action_plans ap
  ON ap.tenant_id = t.id
GROUP BY t.id, t.name;

CREATE OR REPLACE VIEW public.v_health_remediation_summary_by_standard AS
SELECT
  v.tenant_id,
  v.tenant_name,
  v.standard_code,
  COUNT(ap.id)::bigint AS total_suggested_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado'))::bigint AS open_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado') AND ap.due_date < CURRENT_DATE)::bigint AS overdue_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.metadata->>'priority', ap.status, '')) IN ('urgente','critical'))::bigint AS urgent_actions,
  COUNT(ap.id) FILTER (WHERE lower(COALESCE(ap.metadata->>'priority', ap.status, '')) IN ('alta','high'))::bigint AS high_actions,
  MIN(ap.due_date) FILTER (WHERE lower(COALESCE(ap.status, 'open')) NOT IN ('cerrado','closed','completado','completed','cancelado')) AS next_due_date
FROM public.v_control_health_risks v
LEFT JOIN public.action_plans ap
  ON ap.tenant_id = v.tenant_id
 AND ap.tenant_control_id = v.tenant_control_id
GROUP BY v.tenant_id, v.tenant_name, v.standard_code;

CREATE OR REPLACE VIEW public.v_health_remediation_plan AS
SELECT
  v.tenant_id,
  v.tenant_name,
  v.tenant_control_id,
  v.standard_code,
  v.clause,
  v.category,
  v.control_description,
  v.health_score,
  v.health_status,
  CASE
    WHEN v.overdue_actions_count > 0 OR v.health_score < 50 THEN 'urgente'
    WHEN v.open_findings_count > 0 OR v.evidence_count = 0 OR v.health_score < 80 THEN 'alta'
    ELSE 'media'
  END AS remediation_priority,
  CASE
    WHEN v.overdue_actions_count > 0 OR v.health_score < 50 THEN 1
    WHEN v.open_findings_count > 0 OR v.evidence_count = 0 OR v.health_score < 80 THEN 2
    ELSE 3
  END AS remediation_priority_order,
  CASE
    WHEN v.evidence_count = 0 THEN 'evidence_gap'
    WHEN v.open_findings_count > 0 THEN 'findings_gap'
    WHEN v.open_actions_count > 0 THEN 'action_gap'
    WHEN v.health_score IS NULL THEN 'not_measured'
    ELSE 'health_attention'
  END AS main_gap_key,
  CASE
    WHEN v.evidence_count = 0 THEN 'Control sin evidencia asociada'
    WHEN v.open_findings_count > 0 THEN 'Hallazgos abiertos'
    WHEN v.open_actions_count > 0 THEN 'Acciones abiertas'
    WHEN v.health_score IS NULL THEN 'Control sin medicion oficial'
    ELSE 'Health requiere atencion'
  END AS main_gap_label,
  ('Remediar ' || COALESCE(v.clause, v.control_description, 'control'))::text AS title,
  ('Accion sugerida por Health ISO usando fuente canonica v_iso_control_effective_health. Estado: ' || COALESCE(v.health_status, 'sin_datos'))::text AS description,
  CURRENT_DATE + CASE
    WHEN v.overdue_actions_count > 0 OR v.health_score < 50 THEN 7
    WHEN v.open_findings_count > 0 OR v.evidence_count = 0 OR v.health_score < 80 THEN 30
    ELSE 60
  END AS suggested_due_date
FROM public.v_control_health_risks v
WHERE v.health_score IS NULL
   OR v.health_score < 80
   OR v.evidence_count = 0
   OR v.open_findings_count > 0
   OR v.open_actions_count > 0;

CREATE OR REPLACE VIEW public.v_remediation_executive_by_tenant AS
SELECT
  s.tenant_id,
  s.tenant_name,
  s.total_suggested_actions,
  s.open_actions,
  s.overdue_actions,
  s.urgent_actions,
  s.high_actions,
  s.next_due_date
FROM public.v_health_remediation_summary_by_tenant s;

CREATE OR REPLACE VIEW public.v_remediation_executive_by_standard AS
SELECT
  s.tenant_id,
  s.tenant_name,
  s.standard_code,
  s.total_suggested_actions,
  s.open_actions,
  s.overdue_actions,
  s.urgent_actions,
  s.high_actions,
  s.next_due_date
FROM public.v_health_remediation_summary_by_standard s;

CREATE OR REPLACE VIEW public.v_evidence_approval_queue AS
SELECT
  e.tenant_id,
  t.name AS tenant_name,
  COALESCE(cc.iso, e.metadata->>'standard_code') AS standard_code,
  e.id AS evidence_id,
  e.tenant_control_id,
  e.file_name,
  e.title,
  e.description,
  e.status,
  e.validated,
  e.created_at,
  e.updated_at
FROM public.evidences e
LEFT JOIN public.tenants t ON t.id = e.tenant_id
LEFT JOIN public.tenant_controls tc ON tc.tenant_id = e.tenant_id AND tc.id = e.tenant_control_id
LEFT JOIN public.controls_catalog cc ON cc.id = COALESCE(e.catalog_control_id, tc.control_id, e.control_id)
WHERE lower(COALESCE(e.status, 'pending')) IN ('pending','pendiente','draft','submitted','en_revision','in_review')
  AND COALESCE(e.validated, false) IS NOT TRUE;

CREATE OR REPLACE VIEW public.v_controls_recovered_by_remediation AS
SELECT
  v.tenant_id,
  v.tenant_name,
  v.standard_code,
  v.tenant_control_id,
  v.clause,
  v.control_description,
  MAX(e.reviewed_at) AS latest_evidence_reviewed_at,
  MAX(ap.completed_at) AS completed_at,
  v.health_score,
  v.health_status
FROM public.v_control_health_risks v
LEFT JOIN public.evidences e
  ON e.tenant_id = v.tenant_id
 AND e.tenant_control_id = v.tenant_control_id
 AND (e.validated IS TRUE OR lower(COALESCE(e.status, '')) IN ('approved','aprobada','validada','validated'))
LEFT JOIN public.action_plans ap
  ON ap.tenant_id = v.tenant_id
 AND ap.tenant_control_id = v.tenant_control_id
 AND (ap.completed_at IS NOT NULL OR lower(COALESCE(ap.status, '')) IN ('completed','completado','closed','cerrado'))
WHERE e.id IS NOT NULL OR ap.id IS NOT NULL
GROUP BY v.tenant_id, v.tenant_name, v.standard_code, v.tenant_control_id, v.clause, v.control_description, v.health_score, v.health_status;

CREATE OR REPLACE VIEW public.v_audit_event_log_enriched AS
SELECT
  a.id,
  a.tenant_id,
  t.name AS tenant_name,
  a.table_name,
  a.record_id,
  a.action,
  a.changed_at,
  a.changed_by,
  COALESCE(u.full_name, u.name, u.email) AS changed_by_name,
  a.old_data,
  a.new_data,
  a.metadata
FROM public.audit_event_log a
LEFT JOIN public.tenants t ON t.id = a.tenant_id
LEFT JOIN public.users u ON u.id = a.changed_by;

CREATE OR REPLACE VIEW public.v_audit_action_plan_timeline AS
SELECT
  a.id,
  a.tenant_id,
  a.table_name,
  a.record_id AS action_plan_id,
  COALESCE(ap.iso_code, a.new_data->>'iso_code', a.old_data->>'iso_code') AS iso_code,
  COALESCE(ap.title, a.new_data->>'title', a.old_data->>'title') AS title,
  COALESCE(ap.status, a.new_data->>'status', a.old_data->>'status') AS status,
  a.action,
  a.changed_at,
  a.changed_by,
  a.metadata
FROM public.audit_event_log a
LEFT JOIN public.action_plans ap
  ON ap.tenant_id = a.tenant_id
 AND ap.id = a.record_id
WHERE a.table_name = 'action_plans';

CREATE OR REPLACE VIEW public.v_audit_evidence_timeline AS
SELECT
  a.id,
  a.tenant_id,
  a.table_name,
  a.record_id AS evidence_id,
  COALESCE(cc.iso, a.new_data->>'standard_code', a.old_data->>'standard_code') AS iso_code,
  COALESCE(e.file_name, e.title, a.new_data->>'file_name', a.old_data->>'file_name') AS evidence_name,
  COALESCE(e.status, a.new_data->>'status', a.old_data->>'status') AS status,
  a.action,
  a.changed_at,
  a.changed_by,
  a.metadata
FROM public.audit_event_log a
LEFT JOIN public.evidences e
  ON e.tenant_id = a.tenant_id
 AND e.id = a.record_id
LEFT JOIN public.tenant_controls tc
  ON tc.tenant_id = e.tenant_id
 AND tc.id = e.tenant_control_id
LEFT JOIN public.controls_catalog cc
  ON cc.id = COALESCE(e.catalog_control_id, tc.control_id, e.control_id)
WHERE a.table_name = 'evidences';

CREATE OR REPLACE VIEW public.v_audit_control_recovery_timeline AS
SELECT
  r.tenant_id,
  r.standard_code AS iso_code,
  r.tenant_control_id,
  r.clause,
  r.control_description,
  GREATEST(
    COALESCE(r.latest_evidence_reviewed_at, '-infinity'::timestamptz),
    COALESCE(r.completed_at, '-infinity'::timestamptz)
  ) AS recovered_at,
  r.latest_evidence_reviewed_at,
  r.completed_at,
  r.health_score,
  r.health_status
FROM public.v_controls_recovered_by_remediation r;

GRANT SELECT ON
  public.v_control_health_risks,
  public.v_control_health_risks_applicable,
  public.v_health_root_causes_by_standard,
  public.v_health_remediation_summary_by_tenant,
  public.v_health_remediation_summary_by_standard,
  public.v_health_remediation_plan,
  public.v_remediation_executive_by_tenant,
  public.v_remediation_executive_by_standard,
  public.v_evidence_approval_queue,
  public.v_controls_recovered_by_remediation,
  public.v_audit_event_log_enriched,
  public.v_audit_action_plan_timeline,
  public.v_audit_evidence_timeline,
  public.v_audit_control_recovery_timeline
TO tcdx_backend_runtime;

COMMIT;
