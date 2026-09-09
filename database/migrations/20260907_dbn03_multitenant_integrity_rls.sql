-- DB-N03 - Multi-tenant integrity and RLS prerequisites.
--
-- Apply order:
--   DB-N01 -> DB-N02 -> DB-N03
--
-- DB-N03 enforces same-tenant ownership on critical relationships where both
-- child and parent are tenant-scoped. RLS is prepared but not enabled because
-- the current backend pool does not yet set transaction-local tenant context
-- on every runtime query path.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090703) THEN
    RAISE EXCEPTION 'DB-N03 migration lock unavailable';
  END IF;
END $$;

DO $$
DECLARE
  missing_columns text;
BEGIN
  SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name, column_name)
    INTO missing_columns
  FROM (
    VALUES
      ('tenant_controls','id'),
      ('tenant_controls','tenant_id'),
      ('findings','id'),
      ('findings','tenant_id'),
      ('findings','tenant_control_id'),
      ('evidences','id'),
      ('evidences','tenant_id'),
      ('evidences','tenant_control_id'),
      ('action_plans','id'),
      ('action_plans','tenant_id'),
      ('action_plans','tenant_control_id'),
      ('control_health_scores','id'),
      ('control_health_scores','tenant_id'),
      ('control_health_scores','tenant_control_id')
  ) required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'DB-N03 preflight failed; required columns missing after DB-N01/DB-N02: %',
      missing_columns;
  END IF;
END $$;

CREATE TEMP TABLE dbn03_relation_preflight (
  relation_name text PRIMARY KEY,
  child_table text NOT NULL,
  child_column text NOT NULL,
  parent_table text NOT NULL,
  invalid_count integer NOT NULL
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.dbn03_has_columns(p_table text, p_columns text[])
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  missing_count integer;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO missing_count
  FROM unnest(p_columns) AS col(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
      AND c.column_name = col.column_name
  );

  RETURN missing_count = 0;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.dbn03_check_same_tenant_relation(
  p_relation_name text,
  p_child_table text,
  p_child_column text,
  p_parent_table text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  invalid_count integer;
BEGIN
  IF NOT pg_temp.dbn03_has_columns(p_child_table, ARRAY['tenant_id', p_child_column])
     OR NOT pg_temp.dbn03_has_columns(p_parent_table, ARRAY['tenant_id', 'id']) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT count(*)::integer
       FROM public.%I child
       LEFT JOIN public.%I parent
         ON parent.id = child.%I
        AND parent.tenant_id = child.tenant_id
      WHERE child.%I IS NOT NULL
        AND parent.id IS NULL',
    p_child_table,
    p_parent_table,
    p_child_column,
    p_child_column
  )
  INTO invalid_count;

  INSERT INTO dbn03_relation_preflight (
    relation_name,
    child_table,
    child_column,
    parent_table,
    invalid_count
  )
  VALUES (
    p_relation_name,
    p_child_table,
    p_child_column,
    p_parent_table,
    invalid_count
  )
  ON CONFLICT (relation_name) DO UPDATE SET
    invalid_count = EXCLUDED.invalid_count;
END $$;

SELECT pg_temp.dbn03_check_same_tenant_relation('findings_tenant_control', 'findings', 'tenant_control_id', 'tenant_controls');
SELECT pg_temp.dbn03_check_same_tenant_relation('evidences_tenant_control', 'evidences', 'tenant_control_id', 'tenant_controls');
SELECT pg_temp.dbn03_check_same_tenant_relation('action_plans_tenant_control', 'action_plans', 'tenant_control_id', 'tenant_controls');
SELECT pg_temp.dbn03_check_same_tenant_relation('control_health_scores_tenant_control', 'control_health_scores', 'tenant_control_id', 'tenant_controls');
SELECT pg_temp.dbn03_check_same_tenant_relation('action_plans_finding', 'action_plans', 'finding_id', 'findings');
SELECT pg_temp.dbn03_check_same_tenant_relation('findings_audit', 'findings', 'audit_id', 'audits');
SELECT pg_temp.dbn03_check_same_tenant_relation('action_plans_audit', 'action_plans', 'audit_id', 'audits');
SELECT pg_temp.dbn03_check_same_tenant_relation('findings_asset', 'findings', 'asset_id', 'assets');
SELECT pg_temp.dbn03_check_same_tenant_relation('action_plans_asset', 'action_plans', 'asset_id', 'assets');
SELECT pg_temp.dbn03_check_same_tenant_relation('findings_nonconformity', 'findings', 'nonconformity_id', 'tenant_nonconformities');
SELECT pg_temp.dbn03_check_same_tenant_relation('action_plans_nonconformity', 'action_plans', 'nonconformity_id', 'tenant_nonconformities');
SELECT pg_temp.dbn03_check_same_tenant_relation('grc_readiness_findings_snapshot', 'grc_readiness_findings', 'snapshot_id', 'grc_readiness_snapshots');
SELECT pg_temp.dbn03_check_same_tenant_relation('grc_readiness_findings_result', 'grc_readiness_findings', 'result_id', 'grc_readiness_results');
SELECT pg_temp.dbn03_check_same_tenant_relation('calculation_inputs_run', 'calculation_inputs', 'run_id', 'calculation_runs');
SELECT pg_temp.dbn03_check_same_tenant_relation('calculation_outputs_run', 'calculation_outputs', 'run_id', 'calculation_runs');
SELECT pg_temp.dbn03_check_same_tenant_relation('calculation_validations_run', 'calculation_validations', 'run_id', 'calculation_runs');
SELECT pg_temp.dbn03_check_same_tenant_relation('calculation_snapshots_run', 'calculation_snapshots', 'run_id', 'calculation_runs');
SELECT pg_temp.dbn03_check_same_tenant_relation('calculation_explanations_run', 'calculation_explanations', 'run_id', 'calculation_runs');
SELECT pg_temp.dbn03_check_same_tenant_relation('calculation_anomalies_run', 'calculation_anomalies', 'run_id', 'calculation_runs');

DO $$
DECLARE
  invalid_rows text;
BEGIN
  SELECT string_agg(relation_name || '=' || invalid_count, ', ' ORDER BY relation_name)
    INTO invalid_rows
  FROM dbn03_relation_preflight
  WHERE invalid_count > 0;

  IF invalid_rows IS NOT NULL THEN
    RAISE EXCEPTION 'DB-N03 same-tenant preflight failed: %', invalid_rows;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.dbn03_add_unique_constraint(
  p_table text,
  p_constraint text,
  p_columns text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = ('public.' || p_table)::regclass
      AND conname = p_constraint
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%s)',
      p_table,
      p_constraint,
      p_columns
    );
  END IF;
END $$;

SELECT pg_temp.dbn03_add_unique_constraint('tenant_controls', 'uq_dbn03_tenant_controls_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('findings', 'uq_dbn03_findings_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('evidences', 'uq_dbn03_evidences_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('action_plans', 'uq_dbn03_action_plans_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('audits', 'uq_dbn03_audits_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('assets', 'uq_dbn03_assets_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('tenant_nonconformities', 'uq_dbn03_tenant_nonconformities_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('control_health_scores', 'uq_dbn03_control_health_scores_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('grc_readiness_snapshots', 'uq_dbn03_grc_readiness_snapshots_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('grc_readiness_results', 'uq_dbn03_grc_readiness_results_tenant_id_id', 'tenant_id, id');
SELECT pg_temp.dbn03_add_unique_constraint('calculation_runs', 'uq_dbn03_calculation_runs_tenant_id_id', 'tenant_id, id');

CREATE OR REPLACE FUNCTION pg_temp.dbn03_add_composite_fk(
  p_child_table text,
  p_constraint text,
  p_child_column text,
  p_parent_table text,
  p_on_delete text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT pg_temp.dbn03_has_columns(p_child_table, ARRAY['tenant_id', p_child_column])
     OR NOT pg_temp.dbn03_has_columns(p_parent_table, ARRAY['tenant_id', 'id']) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = ('public.' || p_child_table)::regclass
      AND conname = p_constraint
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id, %I) REFERENCES public.%I (tenant_id, id) ON DELETE %s NOT VALID',
      p_child_table,
      p_constraint,
      p_child_column,
      p_parent_table,
      p_on_delete
    );
  END IF;
END $$;

SELECT pg_temp.dbn03_add_composite_fk('findings', 'fk_dbn03_findings_tenant_control_same_tenant', 'tenant_control_id', 'tenant_controls', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('evidences', 'fk_dbn03_evidences_tenant_control_same_tenant', 'tenant_control_id', 'tenant_controls', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('action_plans', 'fk_dbn03_action_plans_tenant_control_same_tenant', 'tenant_control_id', 'tenant_controls', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('control_health_scores', 'fk_dbn03_control_health_scores_tenant_control_same_tenant', 'tenant_control_id', 'tenant_controls', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('action_plans', 'fk_dbn03_action_plans_finding_same_tenant', 'finding_id', 'findings', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('findings', 'fk_dbn03_findings_audit_same_tenant', 'audit_id', 'audits', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('action_plans', 'fk_dbn03_action_plans_audit_same_tenant', 'audit_id', 'audits', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('findings', 'fk_dbn03_findings_asset_same_tenant', 'asset_id', 'assets', 'SET NULL');
SELECT pg_temp.dbn03_add_composite_fk('action_plans', 'fk_dbn03_action_plans_asset_same_tenant', 'asset_id', 'assets', 'SET NULL');
SELECT pg_temp.dbn03_add_composite_fk('findings', 'fk_dbn03_findings_nonconformity_same_tenant', 'nonconformity_id', 'tenant_nonconformities', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('action_plans', 'fk_dbn03_action_plans_nonconformity_same_tenant', 'nonconformity_id', 'tenant_nonconformities', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('grc_readiness_findings', 'fk_dbn03_grc_readiness_findings_snapshot_same_tenant', 'snapshot_id', 'grc_readiness_snapshots', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('grc_readiness_findings', 'fk_dbn03_grc_readiness_findings_result_same_tenant', 'result_id', 'grc_readiness_results', 'RESTRICT');
SELECT pg_temp.dbn03_add_composite_fk('calculation_inputs', 'fk_dbn03_calculation_inputs_run_same_tenant', 'run_id', 'calculation_runs', 'CASCADE');
SELECT pg_temp.dbn03_add_composite_fk('calculation_outputs', 'fk_dbn03_calculation_outputs_run_same_tenant', 'run_id', 'calculation_runs', 'CASCADE');
SELECT pg_temp.dbn03_add_composite_fk('calculation_validations', 'fk_dbn03_calculation_validations_run_same_tenant', 'run_id', 'calculation_runs', 'CASCADE');
SELECT pg_temp.dbn03_add_composite_fk('calculation_snapshots', 'fk_dbn03_calculation_snapshots_run_same_tenant', 'run_id', 'calculation_runs', 'SET NULL');
SELECT pg_temp.dbn03_add_composite_fk('calculation_explanations', 'fk_dbn03_calculation_explanations_run_same_tenant', 'run_id', 'calculation_runs', 'CASCADE');
SELECT pg_temp.dbn03_add_composite_fk('calculation_anomalies', 'fk_dbn03_calculation_anomalies_run_same_tenant', 'run_id', 'calculation_runs', 'SET NULL');

CREATE OR REPLACE FUNCTION pg_temp.dbn03_validate_constraint(
  p_table text,
  p_constraint text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = ('public.' || p_table)::regclass
      AND conname = p_constraint
      AND NOT convalidated
  ) THEN
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', p_table, p_constraint);
  END IF;
END $$;

SELECT pg_temp.dbn03_validate_constraint('findings', 'fk_dbn03_findings_tenant_control_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('evidences', 'fk_dbn03_evidences_tenant_control_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('action_plans', 'fk_dbn03_action_plans_tenant_control_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('control_health_scores', 'fk_dbn03_control_health_scores_tenant_control_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('action_plans', 'fk_dbn03_action_plans_finding_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('findings', 'fk_dbn03_findings_audit_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('action_plans', 'fk_dbn03_action_plans_audit_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('findings', 'fk_dbn03_findings_asset_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('action_plans', 'fk_dbn03_action_plans_asset_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('findings', 'fk_dbn03_findings_nonconformity_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('action_plans', 'fk_dbn03_action_plans_nonconformity_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('grc_readiness_findings', 'fk_dbn03_grc_readiness_findings_snapshot_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('grc_readiness_findings', 'fk_dbn03_grc_readiness_findings_result_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('calculation_inputs', 'fk_dbn03_calculation_inputs_run_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('calculation_outputs', 'fk_dbn03_calculation_outputs_run_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('calculation_validations', 'fk_dbn03_calculation_validations_run_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('calculation_snapshots', 'fk_dbn03_calculation_snapshots_run_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('calculation_explanations', 'fk_dbn03_calculation_explanations_run_same_tenant');
SELECT pg_temp.dbn03_validate_constraint('calculation_anomalies', 'fk_dbn03_calculation_anomalies_run_same_tenant');

CREATE INDEX IF NOT EXISTS idx_dbn03_findings_tenant_control
  ON findings (tenant_id, tenant_control_id)
  WHERE tenant_control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dbn03_evidences_tenant_control
  ON evidences (tenant_id, tenant_control_id)
  WHERE tenant_control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dbn03_action_plans_tenant_control
  ON action_plans (tenant_id, tenant_control_id)
  WHERE tenant_control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dbn03_control_health_scores_tenant_control
  ON control_health_scores (tenant_id, tenant_control_id)
  WHERE tenant_control_id IS NOT NULL;

CREATE SCHEMA IF NOT EXISTS tcdx_security;

CREATE OR REPLACE FUNCTION tcdx_security.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.tenant_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN current_setting('app.tenant_id', true)::uuid
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION tcdx_security.platform_scope_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(COALESCE(current_setting('app.platform_scope', true), 'false')) IN ('1', 'true', 'on', 'yes')
$$;

CREATE OR REPLACE FUNCTION tcdx_security.tenant_visible(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT tcdx_security.platform_scope_enabled()
      OR row_tenant_id = tcdx_security.current_tenant_id()
$$;

CREATE OR REPLACE FUNCTION tcdx_security.tenant_write_allowed(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT row_tenant_id = tcdx_security.current_tenant_id()
$$;

COMMENT ON SCHEMA tcdx_security IS
  'DB-N03 RLS prerequisite functions. Runtime must set app.tenant_id transaction-locally before RLS is enabled.';

COMMENT ON FUNCTION tcdx_security.current_tenant_id() IS
  'Reads transaction-local app.tenant_id and returns NULL for missing or malformed context.';

COMMENT ON FUNCTION tcdx_security.platform_scope_enabled() IS
  'Reads transaction-local app.platform_scope for explicit platform read scope; runtime role must not rely on BYPASSRLS.';

CREATE OR REPLACE FUNCTION pg_temp.dbn03_create_policy(
  p_table text,
  p_policy text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT pg_temp.dbn03_has_columns(p_table, ARRAY['tenant_id']) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = ('public.' || p_table)::regclass
      AND polname = p_policy
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I USING (tcdx_security.tenant_visible(tenant_id)) WITH CHECK (tcdx_security.tenant_write_allowed(tenant_id))',
      p_policy,
      p_table
    );
  END IF;
END $$;

SELECT pg_temp.dbn03_create_policy('tenant_controls', 'dbn03_tenant_isolation_tenant_controls');
SELECT pg_temp.dbn03_create_policy('findings', 'dbn03_tenant_isolation_findings');
SELECT pg_temp.dbn03_create_policy('evidences', 'dbn03_tenant_isolation_evidences');
SELECT pg_temp.dbn03_create_policy('action_plans', 'dbn03_tenant_isolation_action_plans');
SELECT pg_temp.dbn03_create_policy('control_health_scores', 'dbn03_tenant_isolation_control_health_scores');

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
    RAISE EXCEPTION 'DB-N03 unexpected RLS enabled before runtime context rollout';
  END IF;
END $$;

COMMIT;
