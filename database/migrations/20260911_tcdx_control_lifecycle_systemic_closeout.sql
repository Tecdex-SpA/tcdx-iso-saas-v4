BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091101) THEN
    RAISE EXCEPTION 'tcdx control lifecycle systemic closeout lock not available';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tcdx_effective_control_catalog(
  p_tenant_id uuid,
  p_standard_code text,
  p_catalog_mode text DEFAULT 'generic'
)
RETURNS TABLE (
  control_catalog_id uuid,
  catalog_scope text,
  primary_standard_code text,
  control_code text,
  clause text,
  category text,
  title text,
  description text,
  source_type text,
  base_control_id uuid
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT
      p_tenant_id AS tenant_id,
      upper(trim(p_standard_code)) AS standard_code,
      CASE lower(trim(COALESCE(p_catalog_mode, 'generic')))
        WHEN 'personalized' THEN 'personalized'
        WHEN 'mixed' THEN 'mixed'
        ELSE 'generic'
      END AS catalog_mode
  ),
  candidates AS (
    SELECT
      cc.id AS control_catalog_id,
      CASE
        WHEN cc.tenant_id IS NULL THEN 'global'
        WHEN cc.tenant_id = normalized.tenant_id THEN 'tenant'
        ELSE 'out_of_scope'
      END AS catalog_scope,
      cc.iso AS primary_standard_code,
      cc.code AS control_code,
      cc.clause,
      cc.category,
      cc.title,
      cc.description,
      cc.source_type,
      cc.base_control_id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(cc.base_control_id, cc.id)
        ORDER BY
          CASE WHEN cc.tenant_id = normalized.tenant_id THEN 0 ELSE 1 END,
          CASE WHEN upper(trim(cc.iso)) = normalized.standard_code THEN 0 ELSE 1 END,
          cc.code,
          cc.id
      ) AS rn
    FROM controls_catalog cc
    CROSS JOIN normalized
    WHERE cc.is_active IS TRUE
      AND (
        upper(trim(cc.iso)) = normalized.standard_code
        OR EXISTS (
          SELECT 1
          FROM controls_catalog_standards ccs
          WHERE ccs.control_id = cc.id
            AND upper(trim(ccs.standard_code)) = normalized.standard_code
        )
      )
      AND (
        (normalized.catalog_mode = 'generic' AND cc.tenant_id IS NULL)
        OR
        (normalized.catalog_mode = 'personalized' AND cc.tenant_id = normalized.tenant_id)
        OR
        (normalized.catalog_mode = 'mixed' AND (cc.tenant_id IS NULL OR cc.tenant_id = normalized.tenant_id))
      )
  )
  SELECT
    candidates.control_catalog_id,
    candidates.catalog_scope,
    candidates.primary_standard_code,
    candidates.control_code,
    candidates.clause,
    candidates.category,
    candidates.title,
    candidates.description,
    candidates.source_type,
    candidates.base_control_id
  FROM candidates
  WHERE candidates.rn = 1
  ORDER BY
    candidates.clause NULLS LAST,
    candidates.category NULLS LAST,
    candidates.control_code,
    candidates.control_catalog_id;
$$;

CREATE INDEX IF NOT EXISTS idx_control_lifecycle_catalog_global
  ON controls_catalog (iso, is_active, code)
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_control_lifecycle_catalog_tenant
  ON controls_catalog (tenant_id, iso, is_active, code)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_control_lifecycle_tac_scope
  ON tenant_applicable_controls (tenant_id, standard_code, tenant_control_id)
  WHERE tenant_control_id IS NOT NULL;

WITH active_standards AS (
  SELECT
    ts.id AS tenant_standard_id,
    ts.tenant_id,
    ts.standard_code,
    COALESCE(ts.catalog_mode, 'generic') AS catalog_mode
  FROM tenant_standards ts
  WHERE ts.is_active IS TRUE
    AND COALESCE(
      ts.lifecycle_status,
      CASE WHEN ts.is_active IS TRUE THEN 'active' ELSE 'paused' END
    ) = 'active'
),
effective_tenant_controls AS (
  SELECT DISTINCT ON (tc.tenant_id, tc.id, ast.standard_code)
    tc.tenant_id,
    tc.id AS tenant_control_id,
    tc.control_id AS control_catalog_id,
    ast.standard_code,
    ec.control_code,
    COALESCE(NULLIF(ec.title, ''), NULLIF(ec.description, ''), ec.control_code, 'Control') AS control_name,
    tc.priority,
    ast.catalog_mode
  FROM active_standards ast
  JOIN tenant_controls tc
    ON tc.tenant_id = ast.tenant_id
   AND tc.tenant_standard_id = ast.tenant_standard_id
  JOIN LATERAL public.tcdx_effective_control_catalog(ast.tenant_id, ast.standard_code, ast.catalog_mode) ec
    ON ec.control_catalog_id = tc.control_id
  ORDER BY tc.tenant_id, tc.id, ast.standard_code
)
INSERT INTO tenant_applicable_controls (
  tenant_id,
  tenant_control_id,
  control_catalog_id,
  standard_code,
  control_code,
  control_name,
  applicability_status,
  applicability_reason,
  applicability_score,
  priority,
  profile_drivers,
  calculation_weight,
  must_exist,
  visible_to_tenant,
  active,
  source,
  created_at,
  updated_at
)
SELECT
  etc.tenant_id,
  etc.tenant_control_id,
  etc.control_catalog_id,
  etc.standard_code,
  etc.control_code,
  etc.control_name,
  'applicable',
  'backfill_from_effective_control_catalog',
  NULL::numeric,
  COALESCE(etc.priority, 'media'),
  jsonb_build_object(
    'source', 'tcdx_control_lifecycle_systemic_closeout',
    'standard_code', etc.standard_code,
    'catalog_mode', etc.catalog_mode
  ),
  1,
  TRUE,
  TRUE,
  TRUE,
  'control_lifecycle_backfill',
  now(),
  now()
FROM effective_tenant_controls etc
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_applicable_controls tac
  WHERE tac.tenant_id = etc.tenant_id
    AND (
      tac.tenant_control_id = etc.tenant_control_id
      OR (
        tac.tenant_control_id IS NULL
        AND tac.control_catalog_id = etc.control_catalog_id
        AND COALESCE(tac.standard_code, etc.standard_code) = etc.standard_code
      )
    )
);

GRANT EXECUTE ON FUNCTION public.tcdx_effective_control_catalog(uuid, text, text)
  TO tcdx_backend_runtime;

DO $$
DECLARE
  invented_scores integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO invented_scores
  FROM tenant_controls
  WHERE metadata->>'source' = 'tcdx_control_lifecycle_systemic_closeout'
    AND score = 0;

  IF invented_scores <> 0 THEN
    RAISE EXCEPTION 'control lifecycle closeout must not create score zero rows';
  END IF;
END $$;

COMMIT;
