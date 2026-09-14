BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091401) THEN
    RAISE EXCEPTION 'TCDX AI Core runtime context view grants migration is already running';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regrole('tcdx_backend_runtime') IS NULL THEN
    RAISE EXCEPTION 'Required role tcdx_backend_runtime is missing';
  END IF;
  IF to_regrole('tcdx_backend_app') IS NULL THEN
    RAISE EXCEPTION 'Required role tcdx_backend_app is missing';
  END IF;
  IF to_regnamespace('ai_core') IS NULL THEN
    RAISE EXCEPTION 'Required schema ai_core is missing';
  END IF;
  IF to_regclass('ai_core.v_tenant_health_context') IS NULL THEN
    RAISE EXCEPTION 'Required view ai_core.v_tenant_health_context is missing';
  END IF;
  IF to_regclass('ai_core.v_control_context') IS NULL THEN
    RAISE EXCEPTION 'Required view ai_core.v_control_context is missing';
  END IF;
  IF to_regclass('ai_core.v_finding_context') IS NULL THEN
    RAISE EXCEPTION 'Required view ai_core.v_finding_context is missing';
  END IF;
  IF to_regclass('ai_core.v_kpi_context') IS NULL THEN
    RAISE EXCEPTION 'Required view ai_core.v_kpi_context is missing';
  END IF;
  IF NOT pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member') THEN
    RAISE EXCEPTION 'Role tcdx_backend_app must be a member of tcdx_backend_runtime';
  END IF;
END $$;

GRANT SELECT ON ai_core.v_tenant_health_context TO tcdx_backend_runtime;
GRANT SELECT ON ai_core.v_control_context TO tcdx_backend_runtime;
GRANT SELECT ON ai_core.v_finding_context TO tcdx_backend_runtime;
GRANT SELECT ON ai_core.v_kpi_context TO tcdx_backend_runtime;

DO $$
DECLARE
  ai_reader_select_count integer;
  backend_runtime_dml_count integer;
BEGIN
  IF NOT has_schema_privilege('tcdx_backend_runtime', 'ai_core', 'USAGE') THEN
    RAISE EXCEPTION 'tcdx_backend_runtime lacks USAGE on ai_core';
  END IF;
  IF NOT has_table_privilege('tcdx_backend_runtime', 'ai_core.v_tenant_health_context', 'SELECT') THEN
    RAISE EXCEPTION 'tcdx_backend_runtime lacks SELECT on ai_core.v_tenant_health_context';
  END IF;
  IF NOT has_table_privilege('tcdx_backend_runtime', 'ai_core.v_control_context', 'SELECT') THEN
    RAISE EXCEPTION 'tcdx_backend_runtime lacks SELECT on ai_core.v_control_context';
  END IF;
  IF NOT has_table_privilege('tcdx_backend_runtime', 'ai_core.v_finding_context', 'SELECT') THEN
    RAISE EXCEPTION 'tcdx_backend_runtime lacks SELECT on ai_core.v_finding_context';
  END IF;
  IF NOT has_table_privilege('tcdx_backend_runtime', 'ai_core.v_kpi_context', 'SELECT') THEN
    RAISE EXCEPTION 'tcdx_backend_runtime lacks SELECT on ai_core.v_kpi_context';
  END IF;
  IF (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'tcdx_backend_runtime') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'tcdx_backend_runtime must remain NOLOGIN';
  END IF;
  IF NOT pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member') THEN
    RAISE EXCEPTION 'tcdx_backend_app must inherit access through tcdx_backend_runtime membership';
  END IF;

  SELECT COUNT(*)::integer
    INTO ai_reader_select_count
  FROM (VALUES
      ('ai_core.v_tenant_health_context'::regclass),
      ('ai_core.v_control_context'::regclass),
      ('ai_core.v_finding_context'::regclass),
      ('ai_core.v_kpi_context'::regclass)
  ) AS v(view_oid)
  WHERE has_table_privilege('ai_reader', v.view_oid, 'SELECT');

  IF ai_reader_select_count <> 0 THEN
    RAISE EXCEPTION 'ai_reader must not receive SELECT on AI Core runtime context views';
  END IF;

  SELECT COUNT(*)::integer
    INTO backend_runtime_dml_count
  FROM (VALUES
      ('ai_core.v_tenant_health_context'::regclass),
      ('ai_core.v_control_context'::regclass),
      ('ai_core.v_finding_context'::regclass),
      ('ai_core.v_kpi_context'::regclass)
  ) AS v(view_oid)
  WHERE has_table_privilege('tcdx_backend_runtime', v.view_oid, 'INSERT')
     OR has_table_privilege('tcdx_backend_runtime', v.view_oid, 'UPDATE')
     OR has_table_privilege('tcdx_backend_runtime', v.view_oid, 'DELETE')
     OR has_table_privilege('tcdx_backend_runtime', v.view_oid, 'TRUNCATE')
     OR has_table_privilege('tcdx_backend_runtime', v.view_oid, 'REFERENCES')
     OR has_table_privilege('tcdx_backend_runtime', v.view_oid, 'TRIGGER');

  IF backend_runtime_dml_count <> 0 THEN
    RAISE EXCEPTION 'tcdx_backend_runtime must not receive DML privileges on AI Core runtime context views';
  END IF;
END $$;

COMMIT;
