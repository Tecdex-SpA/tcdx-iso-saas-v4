-- =========================================================
-- TCDX ISO SaaS
-- Vistas aplicables para salud/KPI/cumplimiento perfilado
-- Migracion no destructiva e idempotente
-- =========================================================

CREATE OR REPLACE VIEW public.v_control_health_risks_applicable AS
SELECT v.*
FROM public.v_control_health_risks v
INNER JOIN public.tenant_applicable_controls tac
  ON tac.tenant_id = v.tenant_id
 AND tac.active = true
 AND tac.visible_to_tenant = true
 AND (
   tac.tenant_control_id = v.tenant_control_id
   OR tac.control_code = v.clause
   OR lower(tac.control_name) = lower(v.control_description)
 )
WHERE EXISTS (
  SELECT 1
  FROM public.tenant_standards ts
  WHERE ts.tenant_id = v.tenant_id
    AND ts.standard_code = v.standard_code
    AND ts.is_active = true
);

CREATE OR REPLACE VIEW public.v_latest_health_kpi_snapshots_applicable AS
SELECT v.*
FROM public.v_latest_health_kpi_snapshots v
INNER JOIN public.tenant_applicable_kpis tak
  ON tak.tenant_id = v.tenant_id
 AND tak.active = true
 AND tak.visible_to_tenant = true
 AND tak.kpi_code = v.kpi_code
WHERE (
  v.standard_code IS NULL
  OR EXISTS (
    SELECT 1
    FROM public.tenant_standards ts
    WHERE ts.tenant_id = v.tenant_id
      AND ts.standard_code = v.standard_code
      AND ts.is_active = true
  )
);

CREATE OR REPLACE VIEW public.v_health_dashboard_by_standard_applicable AS
SELECT
  v.tenant_id,
  v.tenant_name,
  v.standard_code,
  COALESCE(s.name, v.standard_code) AS standard_name,
  COUNT(*)::int AS total_controls,
  SUM(CASE WHEN v.health_status = 'saludable' THEN 1 ELSE 0 END)::int AS healthy_controls,
  SUM(CASE WHEN v.health_status = 'atencion' THEN 1 ELSE 0 END)::int AS attention_controls,
  SUM(CASE WHEN v.health_status = 'deteriorado' THEN 1 ELSE 0 END)::int AS deteriorated_controls,
  SUM(CASE WHEN v.health_status = 'critico' THEN 1 ELSE 0 END)::int AS critical_controls,
  ROUND(AVG(COALESCE(v.health_score, 0))::numeric, 1) AS avg_health_score,
  ROUND((SUM(CASE WHEN v.health_status = 'saludable' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS healthy_percentage,
  ROUND((SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS controls_with_evidence_percentage,
  ROUND(AVG(COALESCE(v.health_score, 0))::numeric, 1) AS kpi_standard_health_value,
  CASE WHEN AVG(COALESCE(v.health_score, 0)) >= 80 THEN 'green' WHEN AVG(COALESCE(v.health_score, 0)) >= 60 THEN 'yellow' ELSE 'red' END AS kpi_standard_health_color,
  ROUND((SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS kpi_evidence_coverage_value,
  CASE WHEN SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) >= 0.8 THEN 'green' WHEN SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) >= 0.6 THEN 'yellow' ELSE 'red' END AS kpi_evidence_coverage_color,
  (SUM(CASE WHEN v.health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END))::int AS kpi_deteriorated_controls_value,
  CASE WHEN SUM(CASE WHEN v.health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END) = 0 THEN 'green' WHEN SUM(CASE WHEN v.health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END) <= 3 THEN 'yellow' ELSE 'red' END AS kpi_deteriorated_controls_color,
  CASE
    WHEN AVG(COALESCE(v.health_score, 0)) >= 80 THEN 'saludable'
    WHEN AVG(COALESCE(v.health_score, 0)) >= 60 THEN 'atencion'
    WHEN AVG(COALESCE(v.health_score, 0)) >= 40 THEN 'deteriorado'
    ELSE 'critico'
  END AS standard_health_status
FROM public.v_control_health_risks_applicable v
LEFT JOIN public.standards s
  ON s.code = v.standard_code
GROUP BY v.tenant_id, v.tenant_name, v.standard_code, s.name;

CREATE OR REPLACE VIEW public.v_health_dashboard_summary_applicable AS
SELECT
  v.tenant_id,
  v.tenant_name,
  COUNT(*)::int AS total_controls,
  SUM(CASE WHEN v.health_status = 'saludable' THEN 1 ELSE 0 END)::int AS healthy_controls,
  SUM(CASE WHEN v.health_status = 'atencion' THEN 1 ELSE 0 END)::int AS attention_controls,
  SUM(CASE WHEN v.health_status = 'deteriorado' THEN 1 ELSE 0 END)::int AS deteriorated_controls,
  SUM(CASE WHEN v.health_status = 'critico' THEN 1 ELSE 0 END)::int AS critical_controls,
  ROUND(AVG(COALESCE(v.health_score, 0))::numeric, 1) AS avg_health_score,
  ROUND((SUM(CASE WHEN v.health_status = 'saludable' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS healthy_percentage,
  ROUND((SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS controls_with_evidence_percentage,
  SUM(COALESCE(v.evidence_count, 0))::int AS total_evidences,
  SUM(COALESCE(v.approved_evidence_count, 0))::int AS approved_evidences,
  SUM(COALESCE(v.pending_evidence_count, 0))::int AS pending_evidences,
  SUM(COALESCE(v.rejected_evidence_count, 0))::int AS rejected_evidences,
  ROUND(AVG(COALESCE(v.health_score, 0))::numeric, 1) AS kpi_health_value,
  CASE WHEN AVG(COALESCE(v.health_score, 0)) >= 80 THEN 'green' WHEN AVG(COALESCE(v.health_score, 0)) >= 60 THEN 'yellow' ELSE 'red' END AS kpi_health_color,
  ROUND((SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS kpi_evidence_coverage_value,
  CASE WHEN SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) >= 0.8 THEN 'green' WHEN SUM(CASE WHEN COALESCE(v.evidence_count, 0) > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) >= 0.6 THEN 'yellow' ELSE 'red' END AS kpi_evidence_coverage_color,
  (SUM(CASE WHEN v.health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END))::int AS kpi_deteriorated_controls_value,
  CASE WHEN SUM(CASE WHEN v.health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END) = 0 THEN 'green' WHEN SUM(CASE WHEN v.health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END) <= 3 THEN 'yellow' ELSE 'red' END AS kpi_deteriorated_controls_color,
  MAX(v.calculated_at) AS last_calculated_at,
  CASE
    WHEN AVG(COALESCE(v.health_score, 0)) >= 80 THEN 'saludable'
    WHEN AVG(COALESCE(v.health_score, 0)) >= 60 THEN 'atencion'
    WHEN AVG(COALESCE(v.health_score, 0)) >= 40 THEN 'deteriorado'
    ELSE 'critico'
  END AS tenant_health_status
FROM public.v_control_health_risks_applicable v
GROUP BY v.tenant_id, v.tenant_name;

CREATE OR REPLACE VIEW public.v_iso_control_effective_health_applicable AS
SELECT v.*
FROM public.v_iso_control_effective_health v
INNER JOIN public.tenant_applicable_controls tac
  ON tac.tenant_id = v.tenant_id
 AND tac.active = true
 AND tac.visible_to_tenant = true
 AND (
   tac.tenant_control_id = v.tenant_control_id
   OR tac.control_catalog_id = v.catalog_control_id
   OR tac.standard_code = v.iso
 )
WHERE COALESCE(v.is_in_active_operational_scope, false) = true;

CREATE OR REPLACE VIEW public.v_iso_effective_kpi_summary_applicable AS
SELECT v.*
FROM public.v_iso_effective_kpi_summary v
WHERE EXISTS (
  SELECT 1
  FROM public.tenant_applicable_controls tac
  WHERE tac.tenant_id = v.tenant_id
    AND tac.active = true
    AND tac.visible_to_tenant = true
    AND tac.standard_code = v.iso
);

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_controls_std_visible
  ON public.tenant_applicable_controls (tenant_id, standard_code, active, visible_to_tenant);

CREATE INDEX IF NOT EXISTS idx_tenant_applicable_kpis_code_visible
  ON public.tenant_applicable_kpis (tenant_id, kpi_code, active, visible_to_tenant);

COMMENT ON VIEW public.v_health_dashboard_summary_applicable IS
  'Resumen de salud calculado solo con controles activos/visibles del universo aplicable del tenant.';
COMMENT ON VIEW public.v_health_dashboard_by_standard_applicable IS
  'Salud por norma calculada solo con controles activos/visibles del universo aplicable del tenant.';
