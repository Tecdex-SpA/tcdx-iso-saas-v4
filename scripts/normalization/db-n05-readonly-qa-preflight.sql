-- DB-N05 read-only QA preflight.
--
-- Purpose: inspect an existing QA database before a future data migration
-- decision. Do not run this from Codex against db-v4. This script performs no
-- writes and does not create a production database.

BEGIN READ ONLY;

SELECT 'legacy object presence' AS section;
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relkind AS object_kind,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'qa_audit'
   OR c.relname ~* '(backup_before_|cleanup_backup|backup_history|v2_preview)'
ORDER BY n.nspname, c.relname;

SELECT 'production candidate objects' AS section;
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relkind AS object_kind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','tcdx_security','ai_core')
  AND c.relkind IN ('r','v','m')
ORDER BY n.nspname, c.relname;

SELECT 'global reference counts' AS section;
SELECT 'standards' AS object_name, count(*)::bigint AS row_count FROM standards
UNION ALL SELECT 'controls_catalog', count(*)::bigint FROM controls_catalog
UNION ALL SELECT 'controls_catalog_standards', count(*)::bigint FROM controls_catalog_standards
UNION ALL SELECT 'app_roles', count(*)::bigint FROM app_roles
UNION ALL SELECT 'permissions', count(*)::bigint FROM permissions
UNION ALL SELECT 'commercial_plans', count(*)::bigint FROM commercial_plans
UNION ALL SELECT 'commercial_technical_capabilities', count(*)::bigint FROM commercial_technical_capabilities
UNION ALL SELECT 'official_formula_versions', count(*)::bigint FROM official_formula_versions
ORDER BY object_name;

SELECT 'tenant/customer row counts' AS section;
SELECT 'tenants' AS object_name, count(*)::bigint AS row_count FROM tenants
UNION ALL SELECT 'users', count(*)::bigint FROM users
UNION ALL SELECT 'tenant_controls', count(*)::bigint FROM tenant_controls
UNION ALL SELECT 'evidences', count(*)::bigint FROM evidences
UNION ALL SELECT 'findings', count(*)::bigint FROM findings
UNION ALL SELECT 'action_plans', count(*)::bigint FROM action_plans
UNION ALL SELECT 'risks', count(*)::bigint FROM risks
UNION ALL SELECT 'audits', count(*)::bigint FROM audits
ORDER BY object_name;

SELECT 'duplicate indexes' AS section;
WITH index_defs AS (
  SELECT
    ns.nspname AS schema_name,
    tbl.relname AS table_name,
    idx.relname AS index_name,
    i.indisunique,
    i.indisprimary,
    i.indkey,
    i.indpred,
    pg_get_indexdef(i.indexrelid) AS index_definition,
    regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX\s+\S+\s+', 'INDEX <name> ', 'i') AS normalized_definition
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname NOT IN ('pg_catalog','information_schema')
)
SELECT
  schema_name,
  table_name,
  array_agg(index_name ORDER BY index_name) AS duplicate_indexes,
  normalized_definition
FROM index_defs
GROUP BY schema_name, table_name, normalized_definition
HAVING count(*) > 1
ORDER BY schema_name, table_name;

SELECT 'DB-N01..DB-N04 prerequisites' AS section;
SELECT
  to_regclass('public.tenant_controls') IS NOT NULL AS tenant_controls_ready,
  to_regclass('public.controls_catalog') IS NOT NULL AS controls_catalog_ready,
  to_regclass('public.control_health_scores') IS NOT NULL AS control_health_ready,
  to_regprocedure('dbn02_resolve_control_standard_code(uuid,uuid)') IS NOT NULL AS dbn02_standard_resolver_ready,
  to_regprocedure('tcdx_security.current_tenant_id()') IS NOT NULL AS tenant_context_ready,
  to_regclass('tcdx_security.dbn04_rls_runtime_readiness') IS NOT NULL AS rls_readiness_view_ready;

SELECT 'ai_reader grants' AS section;
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'ai_reader'
ORDER BY table_schema, table_name, privilege_type;

COMMIT;
