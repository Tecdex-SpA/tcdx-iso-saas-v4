BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091402) THEN
    RAISE EXCEPTION 'TCDX AI Guided canonical knowledge runtime grants migration is already running';
  END IF;
END $$;

DO $$
DECLARE
  missing_relations text[];
BEGIN
  IF to_regrole('tcdx_backend_runtime') IS NULL THEN
    RAISE EXCEPTION 'Required role tcdx_backend_runtime is missing';
  END IF;
  IF to_regrole('tcdx_backend_app') IS NULL THEN
    RAISE EXCEPTION 'Required role tcdx_backend_app is missing';
  END IF;
  IF to_regnamespace('public') IS NULL THEN
    RAISE EXCEPTION 'Required schema public is missing';
  END IF;
  IF NOT has_schema_privilege('tcdx_backend_runtime', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'tcdx_backend_runtime lacks USAGE on public';
  END IF;
  IF NOT pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member') THEN
    RAISE EXCEPTION 'Role tcdx_backend_app must be a member of tcdx_backend_runtime';
  END IF;
  IF (SELECT rolinherit FROM pg_roles WHERE rolname = 'tcdx_backend_app') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'tcdx_backend_app must keep INHERIT enabled';
  END IF;
  IF (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'tcdx_backend_runtime') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'tcdx_backend_runtime must remain NOLOGIN';
  END IF;

  SELECT array_agg('public.' || name ORDER BY name)
    INTO missing_relations
  FROM (VALUES
    ('knowledge_audit_questions'),
    ('knowledge_common_gaps'),
    ('knowledge_evidence_expectations'),
    ('knowledge_mappings'),
    ('knowledge_recommended_actions'),
    ('knowledge_rule_hints'),
    ('knowledge_rules')
  ) AS required(name)
  WHERE to_regclass('public.' || required.name) IS NULL;

  IF COALESCE(cardinality(missing_relations), 0) <> 0 THEN
    RAISE EXCEPTION 'Required canonical knowledge relations are missing: %', array_to_string(missing_relations, ', ');
  END IF;
END $$;

GRANT SELECT ON public.knowledge_audit_questions TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_common_gaps TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_evidence_expectations TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_mappings TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_recommended_actions TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_rule_hints TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_rules TO tcdx_backend_runtime;

DO $$
DECLARE
  ai_reader_select_count integer;
  backend_runtime_dml_count integer;
  app_direct_select_count integer;
  backend_runtime_missing_select_count integer;
BEGIN
  SELECT COUNT(*)::integer
    INTO backend_runtime_missing_select_count
  FROM (VALUES
      ('public.knowledge_audit_questions'::regclass),
      ('public.knowledge_common_gaps'::regclass),
      ('public.knowledge_evidence_expectations'::regclass),
      ('public.knowledge_mappings'::regclass),
      ('public.knowledge_recommended_actions'::regclass),
      ('public.knowledge_rule_hints'::regclass),
      ('public.knowledge_rules'::regclass)
  ) AS v(relation_oid)
  WHERE NOT has_table_privilege('tcdx_backend_runtime', v.relation_oid, 'SELECT')
     OR NOT has_table_privilege('tcdx_backend_app', v.relation_oid, 'SELECT');

  IF backend_runtime_missing_select_count <> 0 THEN
    RAISE EXCEPTION 'tcdx_backend_runtime/app inherited SELECT is incomplete for canonical knowledge relations';
  END IF;

  SELECT COUNT(*)::integer
    INTO ai_reader_select_count
  FROM (VALUES
      ('public.knowledge_audit_questions'::regclass),
      ('public.knowledge_common_gaps'::regclass),
      ('public.knowledge_evidence_expectations'::regclass),
      ('public.knowledge_mappings'::regclass),
      ('public.knowledge_recommended_actions'::regclass),
      ('public.knowledge_rule_hints'::regclass),
      ('public.knowledge_rules'::regclass)
  ) AS v(relation_oid)
  WHERE has_table_privilege('ai_reader', v.relation_oid, 'SELECT');

  IF ai_reader_select_count <> 0 THEN
    RAISE EXCEPTION 'ai_reader must not receive SELECT on AI Guided canonical knowledge relations';
  END IF;

  SELECT COUNT(*)::integer
    INTO backend_runtime_dml_count
  FROM (VALUES
      ('public.knowledge_audit_questions'::regclass),
      ('public.knowledge_common_gaps'::regclass),
      ('public.knowledge_evidence_expectations'::regclass),
      ('public.knowledge_mappings'::regclass),
      ('public.knowledge_recommended_actions'::regclass),
      ('public.knowledge_rule_hints'::regclass),
      ('public.knowledge_rules'::regclass)
  ) AS v(relation_oid)
  WHERE has_table_privilege('tcdx_backend_runtime', v.relation_oid, 'INSERT')
     OR has_table_privilege('tcdx_backend_runtime', v.relation_oid, 'UPDATE')
     OR has_table_privilege('tcdx_backend_runtime', v.relation_oid, 'DELETE')
     OR has_table_privilege('tcdx_backend_runtime', v.relation_oid, 'TRUNCATE')
     OR has_table_privilege('tcdx_backend_runtime', v.relation_oid, 'REFERENCES')
     OR has_table_privilege('tcdx_backend_runtime', v.relation_oid, 'TRIGGER');

  IF backend_runtime_dml_count <> 0 THEN
    RAISE EXCEPTION 'tcdx_backend_runtime must not receive DML privileges on AI Guided canonical knowledge relations';
  END IF;

  SELECT COUNT(*)::integer
    INTO app_direct_select_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
  JOIN pg_roles grantee ON grantee.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'knowledge_audit_questions',
      'knowledge_common_gaps',
      'knowledge_evidence_expectations',
      'knowledge_mappings',
      'knowledge_recommended_actions',
      'knowledge_rule_hints',
      'knowledge_rules'
    )
    AND grantee.rolname = 'tcdx_backend_app'
    AND acl.privilege_type = 'SELECT';

  IF app_direct_select_count <> 0 THEN
    RAISE EXCEPTION 'tcdx_backend_app must inherit canonical knowledge SELECT through tcdx_backend_runtime, not direct grants';
  END IF;
END $$;

COMMIT;
