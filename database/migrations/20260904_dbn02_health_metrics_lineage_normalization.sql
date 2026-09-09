-- DB-N02 - Health, metrics, formula and lineage normalization.
--
-- Executive GRC Health authority:
--   official_formula_versions -> calculation_runs -> calculation_outputs
--   -> metric_snapshots -> canonicalHealthProjection
--
-- Control operational health remains a drill-down/diagnostic compatibility surface.
-- This migration does not drop KPI-HLT objects, control_health_scores history,
-- control_health_scores_backup_history or control_health_scores_v2_preview.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090402) THEN
    RAISE EXCEPTION 'DB-N02 migration lock unavailable';
  END IF;
END $$;

DO $$
DECLARE
  missing_columns text;
BEGIN
  WITH required_columns(table_name, column_name) AS (
    VALUES
      ('tenant_controls','id'),
      ('tenant_controls','tenant_id'),
      ('tenant_controls','control_id'),
      ('controls_catalog','id'),
      ('controls_catalog','iso'),
      ('controls_catalog','is_active'),
      ('controls_catalog_standards','control_id'),
      ('controls_catalog_standards','standard_code'),
      ('controls_catalog_standards','is_primary'),
      ('tenant_standards','tenant_id'),
      ('tenant_standards','standard_code'),
      ('tenant_standards','is_active'),
      ('tenant_standards','lifecycle_status'),
      ('control_health_scores','id'),
      ('control_health_scores','tenant_id'),
      ('control_health_scores','tenant_control_id'),
      ('control_health_scores','standard_code'),
      ('control_health_scores','catalog_control_id'),
      ('control_health_scores','metadata'),
      ('control_health_scores','calculated_at')
  ), column_state AS (
    SELECT rc.table_name, rc.column_name, c.column_name IS NOT NULL AS ready
    FROM required_columns rc
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = rc.table_name
     AND c.column_name = rc.column_name
  )
  SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name, column_name)
  INTO missing_columns
  FROM column_state
  WHERE ready IS NOT TRUE;

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'DB-N02 preflight failed: missing required columns: %', missing_columns;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION dbn02_normalize_health_component_state(
  raw_state text,
  has_numeric boolean DEFAULT false,
  effective_at timestamptz DEFAULT NULL,
  stale_after interval DEFAULT NULL,
  as_of timestamptz DEFAULT now()
) RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(trim(coalesce(raw_state, '')));

  IF normalized = ANY (ARRAY['calculated','completed','available','measured']) THEN
    IF effective_at IS NOT NULL AND stale_after IS NOT NULL AND effective_at + stale_after < as_of THEN
      RETURN 'STALE';
    END IF;
    RETURN 'AVAILABLE';
  END IF;

  IF normalized = ANY (ARRAY['not_applicable','excluded']) THEN
    RETURN 'NOT_APPLICABLE';
  END IF;

  IF normalized = ANY (ARRAY['stale','stale_source']) THEN
    RETURN 'STALE';
  END IF;

  IF normalized = ANY (ARRAY['failed','source_incompatible','technical_error','validation_failed','invalid']) THEN
    RETURN 'INVALID';
  END IF;

  IF normalized = ANY (ARRAY['not_configured','configuration_missing']) THEN
    RETURN 'NOT_CONFIGURED';
  END IF;

  IF normalized = ANY (ARRAY['dependency_pending','unmeasured','insufficient_data','insufficient_coverage','source_unavailable','not_calculable','missing']) THEN
    RETURN 'MISSING';
  END IF;

  RETURN 'UNKNOWN';
END $$;

CREATE OR REPLACE FUNCTION dbn02_grc_health_publication_state(
  coverage numeric,
  minimum_coverage numeric DEFAULT 0.80,
  score numeric DEFAULT NULL
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN score IS NULL THEN 'not_calculable'
    WHEN COALESCE(coverage, 0) >= COALESCE(minimum_coverage, 0.80) THEN 'measured'
    ELSE 'insufficient_coverage'
  END;
$$;

CREATE OR REPLACE FUNCTION dbn02_resolve_control_standard_code(
  p_tenant_id uuid,
  p_tenant_control_id uuid
) RETURNS TABLE (
  canonical_standard_code text,
  catalog_control_id uuid,
  standard_source text,
  lineage_status text
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      tc.tenant_id,
      tc.control_id AS catalog_control_id,
      cc.iso AS catalog_iso,
      cc.is_active AS catalog_is_active
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    WHERE tc.tenant_id = p_tenant_id
      AND tc.id = p_tenant_control_id
  ), declared_candidates AS (
    SELECT
      ccs.standard_code,
      b.catalog_control_id,
      'tenant_controls.control_id->controls_catalog_standards.standard_code->tenant_standards.active'::text AS standard_source,
      1 AS priority,
      ccs.is_primary
    FROM base b
    JOIN controls_catalog_standards ccs
      ON ccs.control_id = b.catalog_control_id
    WHERE b.catalog_is_active IS TRUE

    UNION ALL

    SELECT
      b.catalog_iso AS standard_code,
      b.catalog_control_id,
      'tenant_controls.control_id->controls_catalog.iso->tenant_standards.active'::text AS standard_source,
      2 AS priority,
      true AS is_primary
    FROM base b
    WHERE b.catalog_is_active IS TRUE
      AND b.catalog_iso IS NOT NULL
  ), candidate_state AS (
    SELECT
      dc.standard_code,
      dc.catalog_control_id,
      dc.standard_source,
      dc.priority,
      dc.is_primary,
      ts.id IS NOT NULL AS tenant_standard_exists,
      ts.is_active IS TRUE
        AND lower(coalesce(ts.lifecycle_status, 'active')) NOT IN ('inactive','retired','deactivated','permanently_deactivated') AS tenant_standard_active
    FROM declared_candidates dc
    LEFT JOIN base b ON true
    LEFT JOIN tenant_standards ts
      ON ts.tenant_id = b.tenant_id
     AND ts.standard_code = dc.standard_code
  ), active_candidates AS (
    SELECT DISTINCT ON (standard_code)
      standard_code,
      catalog_control_id,
      standard_source,
      priority,
      is_primary
    FROM candidate_state
    WHERE tenant_standard_active IS TRUE
    ORDER BY standard_code, priority, is_primary DESC
  ), active_summary AS (
    SELECT
      count(*)::integer AS active_count,
      string_agg(standard_code, ',' ORDER BY standard_code) AS ambiguous_standard_codes
    FROM active_candidates
  ), single_active AS (
    SELECT
      ac.standard_code,
      ac.standard_source
    FROM active_candidates ac
    CROSS JOIN active_summary a
    WHERE a.active_count = 1
  ), inactive_summary AS (
    SELECT count(*)::integer AS inactive_count
    FROM candidate_state
    WHERE tenant_standard_exists IS TRUE
      AND tenant_standard_active IS NOT TRUE
  ), base_summary AS (
    SELECT
      b.catalog_control_id,
      COALESCE(a.active_count, 0) AS active_count,
      s.standard_code AS single_standard_code,
      s.standard_source AS single_standard_source,
      a.ambiguous_standard_codes,
      COALESCE(i.inactive_count, 0) AS inactive_count
    FROM base b
    CROSS JOIN active_summary a
    CROSS JOIN inactive_summary i
    LEFT JOIN single_active s ON true
  )
  SELECT
    CASE WHEN bs.active_count = 1 THEN bs.single_standard_code ELSE NULL END AS canonical_standard_code,
    bs.catalog_control_id AS catalog_control_id,
    CASE
      WHEN bs.active_count = 1 THEN bs.single_standard_source
      WHEN bs.active_count > 1 THEN 'tenant_controls.control_id->controls_catalog(_standards|iso)->tenant_standards.active ambiguous: ' || bs.ambiguous_standard_codes
      WHEN bs.inactive_count > 0 THEN 'tenant_controls.control_id->controls_catalog(_standards|iso)->tenant_standards.inactive'
      ELSE NULL
    END AS standard_source,
    CASE
      WHEN bs.active_count = 1 THEN 'RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE'
      WHEN bs.active_count > 1 THEN 'AMBIGUOUS'
      WHEN bs.inactive_count > 0 THEN 'INACTIVE_STANDARD_BLOCKED'
      ELSE 'MISSING_CANONICAL_STANDARD_MAPPING'
    END AS lineage_status
  FROM base_summary bs;
$$;

CREATE OR REPLACE VIEW v_control_health_scores_dbn02_lineage AS
SELECT
  chs.id AS control_health_score_id,
  chs.tenant_id,
  chs.tenant_control_id,
  chs.standard_code AS legacy_standard_code,
  lineage.canonical_standard_code,
  lineage.catalog_control_id,
  lineage.standard_source,
  COALESCE(lineage.lineage_status, 'MISSING_CANONICAL_STANDARD_MAPPING') AS lineage_status,
  chs.calculated_at
FROM control_health_scores chs
LEFT JOIN LATERAL dbn02_resolve_control_standard_code(chs.tenant_id, chs.tenant_control_id) lineage
  ON true;

CREATE OR REPLACE FUNCTION refresh_control_health_scores_v2_1(p_tenant_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  refreshed_count integer,
  missing_standard_mapping integer,
  standard_code_source text,
  circular_dependency_removed boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_refreshed_count integer := 0;
  v_missing_standard_mapping integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'DB-N02 refresh_control_health_scores_v2_1 requires tenant_id';
  END IF;

  WITH canonical_lineage AS (
    SELECT
      chs.id,
      lineage.canonical_standard_code,
      lineage.catalog_control_id,
      lineage.standard_source
    FROM control_health_scores chs
    JOIN LATERAL dbn02_resolve_control_standard_code(chs.tenant_id, chs.tenant_control_id) lineage
      ON true
    WHERE chs.tenant_id = p_tenant_id
      AND lineage.canonical_standard_code IS NOT NULL
      AND lineage.lineage_status = 'RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE'
  )
  UPDATE control_health_scores chs
  SET standard_code = canonical_lineage.canonical_standard_code,
      catalog_control_id = canonical_lineage.catalog_control_id,
      calculated_at = now(),
      metadata = COALESCE(chs.metadata, '{}'::jsonb) || jsonb_build_object(
        'db_n02_standard_code_source', canonical_lineage.standard_source,
        'db_n02_circular_dependency_removed', true,
        'db_n02_refreshed_at', now()
      )
  FROM canonical_lineage
  WHERE chs.id = canonical_lineage.id
    AND (
      chs.standard_code IS DISTINCT FROM canonical_lineage.canonical_standard_code
      OR chs.catalog_control_id IS DISTINCT FROM canonical_lineage.catalog_control_id
      OR COALESCE(chs.metadata->>'db_n02_circular_dependency_removed', 'false') <> 'true'
    );

  GET DIAGNOSTICS v_refreshed_count = ROW_COUNT;

  SELECT count(*)::integer
  INTO v_missing_standard_mapping
  FROM control_health_scores chs
  WHERE chs.tenant_id = p_tenant_id
    AND NOT EXISTS (
      SELECT 1
      FROM dbn02_resolve_control_standard_code(chs.tenant_id, chs.tenant_control_id) resolved
      WHERE resolved.canonical_standard_code IS NOT NULL
        AND resolved.lineage_status = 'RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE'
    );

  RETURN QUERY
  SELECT
    p_tenant_id,
    v_refreshed_count,
    v_missing_standard_mapping,
    'tenant_controls.control_id->controls_catalog(_standards|iso)->tenant_standards.active'::text,
    true;
END $$;

COMMENT ON FUNCTION refresh_control_health_scores_v2_1(uuid) IS
  'DB-N02: refreshes legacy control_health_scores standard lineage from tenant_controls/control catalog/active tenant standards; does not derive standard_code from prior control_health_scores.standard_code.';

COMMIT;
