-- DB-N04 - Runtime tenant context and controlled legacy cleanup readiness.
--
-- Apply order:
--   DB-N01 -> DB-N02 -> DB-N03 -> DB-N04
--
-- This migration is deliberately non-destructive. Runtime RLS is made
-- technically inspectable, but RLS is still not enabled here and legacy DROP
-- work is deferred unless a later authorized package proves zero consumers.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090704) THEN
    RAISE EXCEPTION 'DB-N04 migration lock unavailable';
  END IF;
END $$;

DO $$
DECLARE
  missing_prerequisites text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name)
    INTO missing_prerequisites
  FROM (
    VALUES
      ('tcdx_security.current_tenant_id()'),
      ('tcdx_security.platform_scope_enabled()'),
      ('tcdx_security.tenant_visible(uuid)'),
      ('tcdx_security.tenant_write_allowed(uuid)')
  ) required(name)
  WHERE to_regprocedure(required.name) IS NULL;

  IF missing_prerequisites IS NOT NULL THEN
    RAISE EXCEPTION 'DB-N04 preflight failed; DB-N03 RLS prerequisites missing: %',
      missing_prerequisites;
  END IF;
END $$;

-- PHASE A: runtime/RLS prerequisites

CREATE OR REPLACE VIEW tcdx_security.dbn04_rls_runtime_readiness AS
WITH pilot_tables(schema_name, table_name) AS (
  VALUES
    ('public', 'tenant_controls'),
    ('public', 'findings'),
    ('public', 'evidences'),
    ('public', 'action_plans'),
    ('public', 'control_health_scores')
),
policy_state AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls_enabled,
    count(p.polname) FILTER (WHERE p.polname LIKE 'dbn03_tenant_isolation_%') AS staged_policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE c.relkind IN ('r', 'p')
  GROUP BY n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
)
SELECT
  p.schema_name,
  p.table_name,
  COALESCE(s.rls_enabled, false) AS rls_enabled,
  COALESCE(s.force_rls_enabled, false) AS force_rls_enabled,
  COALESCE(s.staged_policy_count, 0) AS staged_policy_count,
  to_regprocedure('tcdx_security.current_tenant_id()') IS NOT NULL
    AND to_regprocedure('tcdx_security.platform_scope_enabled()') IS NOT NULL
    AND to_regprocedure('tcdx_security.tenant_visible(uuid)') IS NOT NULL
    AND to_regprocedure('tcdx_security.tenant_write_allowed(uuid)') IS NOT NULL
    AS db_context_functions_ready,
  CASE
    WHEN COALESCE(s.staged_policy_count, 0) > 0 THEN 'POLICY_STAGED_RLS_DISABLED'
    ELSE 'POLICY_MISSING'
  END AS readiness_state
FROM pilot_tables p
LEFT JOIN policy_state s
  ON s.schema_name = p.schema_name
 AND s.table_name = p.table_name
ORDER BY p.schema_name, p.table_name;

COMMENT ON VIEW tcdx_security.dbn04_rls_runtime_readiness IS
  'DB-N04 read-only readiness view for staged pilot RLS tables. This migration does not ENABLE or FORCE RLS.';

COMMENT ON FUNCTION tcdx_security.current_tenant_id() IS
  'DB-N04: reads transaction-local app.tenant_id set by backend dbTenantContext; returns NULL for missing or malformed context.';

COMMENT ON FUNCTION tcdx_security.platform_scope_enabled() IS
  'DB-N04: platform read scope is explicit app.platform_scope=true in an administrative transaction; tenant runtime users must not rely on BYPASSRLS.';

COMMENT ON FUNCTION tcdx_security.tenant_visible(uuid) IS
  'DB-N04: tenant rows are visible to matching transaction tenant or explicit platform read scope.';

COMMENT ON FUNCTION tcdx_security.tenant_write_allowed(uuid) IS
  'DB-N04: writes require matching transaction tenant; platform scope is not a tenant write bypass.';

-- PHASE B: safe cleanup
--
-- No safe DROP is executed in DB-N04. The local code/docs inventory still has
-- runtime readers or insufficient dependency evidence for every named legacy
-- candidate. DB-N04 only annotates known historical backup/preview objects if
-- present, preserving them for explicit human review.

CREATE OR REPLACE FUNCTION pg_temp.dbn04_comment_table_if_exists(
  p_schema text,
  p_table text,
  p_comment text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass(format('%I.%I', p_schema, p_table)) IS NOT NULL THEN
    EXECUTE format('COMMENT ON TABLE %I.%I IS %L', p_schema, p_table, p_comment);
  END IF;
END $$;

SELECT pg_temp.dbn04_comment_table_if_exists(
  'public',
  'control_health_scores_backup_history',
  'DB-N04 classification: BACKUP_ONLY / DROP_CANDIDATE_DEFERRED. No DROP without zero-reader and dependency proof.'
);

SELECT pg_temp.dbn04_comment_table_if_exists(
  'public',
  'control_health_scores_v2_preview',
  'DB-N04 classification: DEAD_LEGACY_CANDIDATE / DROP_CANDIDATE_DEFERRED. No DROP without runtime dependency proof.'
);

SELECT pg_temp.dbn04_comment_table_if_exists(
  'public',
  'evidences_backup_history',
  'DB-N04 classification: BACKUP_ONLY / DROP_CANDIDATE_DEFERRED. Preserve until retention/dependency proof is reviewed.'
);

SELECT pg_temp.dbn04_comment_table_if_exists(
  'public',
  'action_plans_backup_history',
  'DB-N04 classification: BACKUP_ONLY / DROP_CANDIDATE_DEFERRED. Preserve until retention/dependency proof is reviewed.'
);

SELECT pg_temp.dbn04_comment_table_if_exists(
  'ai_core',
  'view_definition_backups',
  'DB-N04 classification: MIGRATION_HISTORY_ONLY / DROP_CANDIDATE_DEFERRED. ai_reader safety must be proven before cleanup.'
);

-- PHASE C: deferred drops/documentation
--
-- Deferred by design:
-- - public.controls remains compatibility-required after DB-N01.
-- - KPI-HLT definitions/snapshots remain compatibility-only after DB-N02.
-- - qa_audit schema is QA-only and must not be dropped from product migration.
-- - backup/preview tables require authorized read-only preflight evidence.
-- - duplicate index cleanup requires exact pg_get_indexdef equality and no
--   constraint ownership; no such DROP is encoded here.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('tenant_controls', 'findings', 'evidences', 'action_plans', 'control_health_scores')
      AND (c.relrowsecurity OR c.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'DB-N04 unexpected RLS enabled; this package must not enable RLS on db-v4';
  END IF;
END $$;

COMMIT;
