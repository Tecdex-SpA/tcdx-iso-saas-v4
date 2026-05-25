-- =========================================================
-- TCDX ISO SaaS
-- Consistencia BD: entitlements IA, vistas aplicables y duplicados activos
-- Idempotente y no destructiva para datos comerciales vigentes.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------
-- 1) Entitlements IA fail-closed por defecto
-- ---------------------------------------------------------

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_plan text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_web_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auditor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_monthly_quota integer NULL,
  ADD COLUMN IF NOT EXISTS ai_quota_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_features_json jsonb NOT NULL DEFAULT
    '{
      "company_profile_analysis": false,
      "report_enrichment": false,
      "auditor": false,
      "web_research": false,
      "document_generation": false,
      "suggestions": false
    }'::jsonb;

ALTER TABLE public.tenants
  ALTER COLUMN ai_enabled SET DEFAULT false,
  ALTER COLUMN ai_plan SET DEFAULT 'none',
  ALTER COLUMN ai_web_enabled SET DEFAULT false,
  ALTER COLUMN ai_report_enabled SET DEFAULT false,
  ALTER COLUMN ai_auditor_enabled SET DEFAULT false,
  ALTER COLUMN ai_quota_used SET DEFAULT 0,
  ALTER COLUMN ai_features_json SET DEFAULT
    '{
      "company_profile_analysis": false,
      "report_enrichment": false,
      "auditor": false,
      "web_research": false,
      "document_generation": false,
      "suggestions": false
    }'::jsonb;

UPDATE public.tenants
SET
  ai_enabled = false,
  ai_plan = 'none',
  ai_web_enabled = false,
  ai_report_enabled = false,
  ai_auditor_enabled = false,
  ai_features_json =
    '{
      "company_profile_analysis": false,
      "report_enrichment": false,
      "auditor": false,
      "web_research": false,
      "document_generation": false,
      "suggestions": false
    }'::jsonb,
  ai_quota_used = COALESCE(ai_quota_used, 0)
WHERE COALESCE(ai_enabled, false) = false
   OR COALESCE(ai_plan, 'none') = 'none';

UPDATE public.tenants
SET ai_plan = 'standard'
WHERE ai_enabled = true
  AND COALESCE(ai_plan, 'none') = 'none';

UPDATE public.tenants
SET ai_features_json =
  jsonb_build_object(
    'company_profile_analysis', COALESCE((ai_features_json->>'company_profile_analysis')::boolean, true),
    'report_enrichment', COALESCE((ai_features_json->>'report_enrichment')::boolean, ai_report_enabled, true),
    'auditor', COALESCE((ai_features_json->>'auditor')::boolean, ai_auditor_enabled, true),
    'web_research', COALESCE((ai_features_json->>'web_research')::boolean, ai_web_enabled, true),
    'document_generation', COALESCE((ai_features_json->>'document_generation')::boolean, true),
    'suggestions', COALESCE((ai_features_json->>'suggestions')::boolean, true)
  )
WHERE ai_enabled = true
  AND ai_plan <> 'none';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass
      AND conname = 'tenants_ai_plan_check'
  ) THEN
    ALTER TABLE public.tenants DROP CONSTRAINT tenants_ai_plan_check;
  END IF;

  ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_ai_plan_check
    CHECK (ai_plan IN ('none', 'basic', 'standard', 'pro', 'premium', 'enterprise'));

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass
      AND conname = 'tenants_ai_enabled_plan_consistency_check'
  ) THEN
    ALTER TABLE public.tenants DROP CONSTRAINT tenants_ai_enabled_plan_consistency_check;
  END IF;

  ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_ai_enabled_plan_consistency_check
    CHECK (
      (ai_enabled = false AND ai_plan = 'none')
      OR
      (ai_enabled = true AND ai_plan <> 'none')
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_ai_enabled_plan
  ON public.tenants (ai_enabled, ai_plan);

-- ---------------------------------------------------------
-- 2) Columnas auxiliares para claves naturales de aplicabilidad
-- ---------------------------------------------------------

ALTER TABLE public.tenant_applicable_kpis
  ADD COLUMN IF NOT EXISTS standard_code text NULL;

ALTER TABLE public.tenant_applicable_evidence_requirements
  ADD COLUMN IF NOT EXISTS standard_code text NULL,
  ADD COLUMN IF NOT EXISTS requirement_code text NULL;

ALTER TABLE public.tenant_applicability_exclusions
  ADD COLUMN IF NOT EXISTS standard_code text NULL;

-- ---------------------------------------------------------
-- 3) Backups de duplicados activos antes de limpieza
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_applicable_controls_cleanup_backup_20260525 AS
SELECT gen_random_uuid() AS cleanup_run_id, now() AS backed_up_at, t.*
FROM public.tenant_applicable_controls t
WHERE false;

CREATE TABLE IF NOT EXISTS public.tenant_applicable_kpis_cleanup_backup_20260525 AS
SELECT gen_random_uuid() AS cleanup_run_id, now() AS backed_up_at, t.*
FROM public.tenant_applicable_kpis t
WHERE false;

CREATE TABLE IF NOT EXISTS public.tenant_applicable_evidence_requirements_cleanup_backup_20260525 AS
SELECT gen_random_uuid() AS cleanup_run_id, now() AS backed_up_at, t.*
FROM public.tenant_applicable_evidence_requirements t
WHERE false;

CREATE TABLE IF NOT EXISTS public.tenant_applicability_exclusions_cleanup_backup_20260525 AS
SELECT gen_random_uuid() AS cleanup_run_id, now() AS backed_up_at, t.*
FROM public.tenant_applicability_exclusions t
WHERE false;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        COALESCE(standard_code, ''),
        COALESCE(tenant_control_id::text, ''),
        COALESCE(control_catalog_id::text, ''),
        COALESCE(control_code, ''),
        lower(COALESCE(control_name, '')),
        active,
        visible_to_tenant
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicable_controls
  WHERE active = true
    AND visible_to_tenant = true
)
INSERT INTO public.tenant_applicable_controls_cleanup_backup_20260525
SELECT gen_random_uuid(), now(), t.*
FROM public.tenant_applicable_controls t
INNER JOIN ranked r ON r.id = t.id
WHERE r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        COALESCE(standard_code, ''),
        COALESCE(tenant_control_id::text, ''),
        COALESCE(control_catalog_id::text, ''),
        COALESCE(control_code, ''),
        lower(COALESCE(control_name, '')),
        active,
        visible_to_tenant
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicable_controls
  WHERE active = true
    AND visible_to_tenant = true
)
UPDATE public.tenant_applicable_controls t
SET active = false,
    visible_to_tenant = false,
    applicability_status = 'duplicate_inactive',
    applicability_reason = COALESCE(NULLIF(t.applicability_reason, ''), 'Desactivado por limpieza idempotente de duplicados activos.'),
    updated_at = now()
FROM ranked r
WHERE r.id = t.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        COALESCE(standard_code, ''),
        COALESCE(kpi_definition_id::text, ''),
        COALESCE(kpi_code, ''),
        lower(COALESCE(kpi_name, '')),
        active,
        visible_to_tenant
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicable_kpis
  WHERE active = true
    AND visible_to_tenant = true
)
INSERT INTO public.tenant_applicable_kpis_cleanup_backup_20260525
SELECT gen_random_uuid(), now(), t.*
FROM public.tenant_applicable_kpis t
INNER JOIN ranked r ON r.id = t.id
WHERE r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        COALESCE(standard_code, ''),
        COALESCE(kpi_definition_id::text, ''),
        COALESCE(kpi_code, ''),
        lower(COALESCE(kpi_name, '')),
        active,
        visible_to_tenant
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicable_kpis
  WHERE active = true
    AND visible_to_tenant = true
)
UPDATE public.tenant_applicable_kpis t
SET active = false,
    visible_to_tenant = false,
    applicability_status = 'duplicate_inactive',
    applicability_reason = COALESCE(NULLIF(t.applicability_reason, ''), 'Desactivado por limpieza idempotente de duplicados activos.'),
    updated_at = now()
FROM ranked r
WHERE r.id = t.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        COALESCE(standard_code, ''),
        COALESCE(related_control_id::text, ''),
        COALESCE(related_kpi_id::text, ''),
        COALESCE(requirement_code, ''),
        COALESCE(evidence_type, ''),
        lower(COALESCE(evidence_name, '')),
        active,
        visible_to_tenant
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicable_evidence_requirements
  WHERE active = true
    AND visible_to_tenant = true
)
INSERT INTO public.tenant_applicable_evidence_requirements_cleanup_backup_20260525
SELECT gen_random_uuid(), now(), t.*
FROM public.tenant_applicable_evidence_requirements t
INNER JOIN ranked r ON r.id = t.id
WHERE r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        COALESCE(standard_code, ''),
        COALESCE(related_control_id::text, ''),
        COALESCE(related_kpi_id::text, ''),
        COALESCE(requirement_code, ''),
        COALESCE(evidence_type, ''),
        lower(COALESCE(evidence_name, '')),
        active,
        visible_to_tenant
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicable_evidence_requirements
  WHERE active = true
    AND visible_to_tenant = true
)
UPDATE public.tenant_applicable_evidence_requirements t
SET active = false,
    visible_to_tenant = false,
    requirement_reason = COALESCE(NULLIF(t.requirement_reason, ''), 'Desactivado por limpieza idempotente de duplicados activos.'),
    updated_at = now()
FROM ranked r
WHERE r.id = t.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        object_type,
        COALESCE(standard_code, ''),
        COALESCE(object_id::text, ''),
        COALESCE(object_code, ''),
        lower(COALESCE(object_name, '')),
        lower(COALESCE(exclusion_reason, '')),
        active
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicability_exclusions
  WHERE active = true
)
INSERT INTO public.tenant_applicability_exclusions_cleanup_backup_20260525
SELECT gen_random_uuid(), now(), t.*
FROM public.tenant_applicability_exclusions t
INNER JOIN ranked r ON r.id = t.id
WHERE r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        tenant_id,
        object_type,
        COALESCE(standard_code, ''),
        COALESCE(object_id::text, ''),
        COALESCE(object_code, ''),
        lower(COALESCE(object_name, '')),
        lower(COALESCE(exclusion_reason, '')),
        active
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tenant_applicability_exclusions
  WHERE active = true
)
UPDATE public.tenant_applicability_exclusions t
SET active = false,
    exclusion_reason = COALESCE(NULLIF(t.exclusion_reason, ''), 'Desactivado por limpieza idempotente de duplicados activos.'),
    updated_at = now()
FROM ranked r
WHERE r.id = t.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tac_active_natural
  ON public.tenant_applicable_controls (
    tenant_id,
    COALESCE(standard_code, ''),
    COALESCE(tenant_control_id::text, ''),
    COALESCE(control_catalog_id::text, ''),
    COALESCE(control_code, ''),
    lower(COALESCE(control_name, ''))
  )
  WHERE active = true AND visible_to_tenant = true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tak_active_natural
  ON public.tenant_applicable_kpis (
    tenant_id,
    COALESCE(standard_code, ''),
    COALESCE(kpi_definition_id::text, ''),
    COALESCE(kpi_code, ''),
    lower(COALESCE(kpi_name, ''))
  )
  WHERE active = true AND visible_to_tenant = true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_taer_active_natural
  ON public.tenant_applicable_evidence_requirements (
    tenant_id,
    COALESCE(standard_code, ''),
    COALESCE(related_control_id::text, ''),
    COALESCE(related_kpi_id::text, ''),
    COALESCE(requirement_code, ''),
    COALESCE(evidence_type, ''),
    lower(COALESCE(evidence_name, ''))
  )
  WHERE active = true AND visible_to_tenant = true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tae_active_natural
  ON public.tenant_applicability_exclusions (
    tenant_id,
    object_type,
    COALESCE(standard_code, ''),
    COALESCE(object_id::text, ''),
    COALESCE(object_code, ''),
    lower(COALESCE(object_name, '')),
    lower(COALESCE(exclusion_reason, ''))
  )
  WHERE active = true;

-- ---------------------------------------------------------
-- 4) Vistas aplicables: deduplicación por prioridad de match
-- ---------------------------------------------------------

CREATE OR REPLACE VIEW public.v_control_health_risks_applicable AS
WITH matched AS (
  SELECT
    v.*,
    CASE
      WHEN tac.tenant_control_id IS NOT NULL AND tac.tenant_control_id = v.tenant_control_id THEN 1
      WHEN tac.control_code IS NOT NULL AND tac.control_code = v.clause THEN 3
      WHEN lower(COALESCE(tac.control_name, '')) = lower(COALESCE(v.control_description, '')) THEN 4
      ELSE 99
    END AS applicability_match_priority,
    true AS applicability_universe_applied,
    true AS filtered_by_applicability_universe,
    true AS tenant_filter_enforced,
    true AS filtered_by_tenant_id,
    row_number() OVER (
      PARTITION BY
        v.tenant_id,
        COALESCE(v.tenant_control_id::text, v.clause, lower(COALESCE(v.control_description, '')), ''),
        COALESCE(v.standard_code, '')
      ORDER BY
        CASE
          WHEN tac.tenant_control_id IS NOT NULL AND tac.tenant_control_id = v.tenant_control_id THEN 1
          WHEN tac.control_code IS NOT NULL AND tac.control_code = v.clause THEN 3
          WHEN lower(COALESCE(tac.control_name, '')) = lower(COALESCE(v.control_description, '')) THEN 4
          ELSE 99
        END ASC,
        v.calculated_at DESC NULLS LAST
    ) AS rn
  FROM public.v_control_health_risks v
  INNER JOIN public.tenant_applicable_controls tac
    ON tac.tenant_id = v.tenant_id
   AND tac.active = true
   AND tac.visible_to_tenant = true
   AND (tac.standard_code IS NULL OR v.standard_code IS NULL OR tac.standard_code = v.standard_code)
   AND (
     (tac.tenant_control_id IS NOT NULL AND tac.tenant_control_id = v.tenant_control_id)
     OR (tac.control_code IS NOT NULL AND tac.control_code = v.clause)
     OR (
       tac.tenant_control_id IS NULL
       AND tac.control_catalog_id IS NULL
       AND tac.control_code IS NULL
       AND lower(COALESCE(tac.control_name, '')) = lower(COALESCE(v.control_description, ''))
     )
   )
  WHERE EXISTS (
    SELECT 1
    FROM public.tenant_standards ts
    WHERE ts.tenant_id = v.tenant_id
      AND ts.standard_code = v.standard_code
      AND ts.is_active = true
  )
)
SELECT *
FROM matched
WHERE rn = 1;

CREATE OR REPLACE VIEW public.v_latest_health_kpi_snapshots_applicable AS
WITH matched AS (
  SELECT
    v.*,
    true AS applicability_universe_applied,
    true AS filtered_by_applicability_universe,
    true AS tenant_filter_enforced,
    true AS filtered_by_tenant_id,
    row_number() OVER (
      PARTITION BY v.tenant_id, COALESCE(v.kpi_code, ''), COALESCE(v.standard_code, '')
      ORDER BY v.calculated_at DESC NULLS LAST
    ) AS rn
  FROM public.v_latest_health_kpi_snapshots v
  INNER JOIN public.tenant_applicable_kpis tak
    ON tak.tenant_id = v.tenant_id
   AND tak.active = true
   AND tak.visible_to_tenant = true
   AND tak.kpi_code = v.kpi_code
   AND (tak.standard_code IS NULL OR v.standard_code IS NULL OR tak.standard_code = v.standard_code)
  WHERE (
    v.standard_code IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tenant_standards ts
      WHERE ts.tenant_id = v.tenant_id
        AND ts.standard_code = v.standard_code
        AND ts.is_active = true
    )
  )
)
SELECT *
FROM matched
WHERE rn = 1;

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
  END AS standard_health_status,
  true AS applicability_universe_applied,
  true AS filtered_by_applicability_universe,
  true AS tenant_filter_enforced,
  true AS filtered_by_tenant_id
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
  END AS tenant_health_status,
  true AS applicability_universe_applied,
  true AS filtered_by_applicability_universe,
  true AS tenant_filter_enforced,
  true AS filtered_by_tenant_id
FROM public.v_control_health_risks_applicable v
GROUP BY v.tenant_id, v.tenant_name;

CREATE OR REPLACE VIEW public.v_iso_control_effective_health_applicable AS
WITH matched AS (
  SELECT
    v.*,
    true AS applicability_universe_applied,
    true AS filtered_by_applicability_universe,
    true AS tenant_filter_enforced,
    true AS filtered_by_tenant_id,
    row_number() OVER (
      PARTITION BY v.tenant_id, COALESCE(v.tenant_control_id::text, v.catalog_control_id::text, ''), COALESCE(v.iso, '')
      ORDER BY
        CASE
          WHEN tac.tenant_control_id IS NOT NULL AND tac.tenant_control_id = v.tenant_control_id THEN 1
          WHEN tac.control_catalog_id IS NOT NULL AND tac.control_catalog_id = v.catalog_control_id THEN 2
          ELSE 99
        END ASC
    ) AS rn
  FROM public.v_iso_control_effective_health v
  INNER JOIN public.tenant_applicable_controls tac
    ON tac.tenant_id = v.tenant_id
   AND tac.active = true
   AND tac.visible_to_tenant = true
   AND (tac.standard_code IS NULL OR v.iso IS NULL OR tac.standard_code = v.iso)
   AND (
     (tac.tenant_control_id IS NOT NULL AND tac.tenant_control_id = v.tenant_control_id)
     OR (tac.control_catalog_id IS NOT NULL AND tac.control_catalog_id = v.catalog_control_id)
   )
  WHERE COALESCE(v.is_in_active_operational_scope, false) = true
)
SELECT *
FROM matched
WHERE rn = 1;

CREATE OR REPLACE VIEW public.v_iso_effective_kpi_summary_applicable AS
SELECT
  v.*,
  true AS applicability_universe_applied,
  true AS filtered_by_applicability_universe,
  true AS tenant_filter_enforced,
  true AS filtered_by_tenant_id
FROM public.v_iso_effective_kpi_summary v
WHERE EXISTS (
  SELECT 1
  FROM public.tenant_applicable_controls tac
  WHERE tac.tenant_id = v.tenant_id
    AND tac.active = true
    AND tac.visible_to_tenant = true
    AND tac.standard_code = v.iso
);

-- ---------------------------------------------------------
-- 5) Trazas antiguas IA: no borrar, marcar como ignoradas si el tenant ya no tiene IA
-- ---------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.tenant_company_profiles') IS NOT NULL THEN
    UPDATE public.tenant_company_profiles tcp
    SET ai_research_trace_json =
      COALESCE(tcp.ai_research_trace_json, '{}'::jsonb)
      || jsonb_build_object(
        'ignored_due_to_ai_disabled', true,
        'ai_disabled_at_cleanup', true,
        'ai_engine_used', false,
        'llm_used', false,
        'used_llm', false,
        'used_web', false,
        'fallback_used', false,
        'ai_disabled_by_plan', true
      ),
      updated_at = now()
    FROM public.tenants t
    WHERE t.id = tcp.tenant_id
      AND t.ai_enabled = false;
  END IF;
END $$;

COMMENT ON VIEW public.v_control_health_risks_applicable IS
  'Control health tenant-scoped deduplicado por universo aplicable; match por tenant_control_id, código y nombre normalizado en orden de prioridad.';
COMMENT ON VIEW public.v_latest_health_kpi_snapshots_applicable IS
  'Últimos KPI snapshots filtrados por tenant_applicable_kpis activos/visibles y deduplicados por tenant/kpi/norma.';
