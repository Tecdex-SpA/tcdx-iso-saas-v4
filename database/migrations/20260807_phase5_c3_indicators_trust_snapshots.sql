-- TCDX ISO SaaS v4 - Phase 5-C3 official functional indicators.
-- Additive governance over the existing official formula registry and semantic layer.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION reject_published_indicator_governance_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(to_jsonb(OLD)->>'status', to_jsonb(OLD)->>'binding_status', to_jsonb(OLD)->>'snapshot_status') = 'published' THEN
    RAISE EXCEPTION 'published indicator governance records are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='metric_definitions'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (metric_code)'
  LOOP EXECUTE format('ALTER TABLE metric_definitions DROP CONSTRAINT %I', item.conname); END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_definitions_scope_code
  ON metric_definitions (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_code);

CREATE TABLE IF NOT EXISTS metric_definition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  functional_code text NOT NULL CHECK (functional_code ~ '^[A-Z0-9][A-Z0-9-]{2,79}$'),
  display_name text NOT NULL,
  business_definition text NOT NULL,
  domain text NOT NULL,
  objective text NOT NULL,
  unit text NOT NULL,
  favorable_direction text NOT NULL CHECK (favorable_direction IN ('higher_is_better','lower_is_better','target_range','informational')),
  frequency text NOT NULL CHECK (frequency IN ('realtime','daily','weekly','monthly','quarterly','semiannual','annual','on_demand')),
  population_definition text NOT NULL,
  numerator_definition text,
  denominator_definition text,
  methodology text NOT NULL,
  semantic_contract_code text,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','published','retired')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE (metric_definition_id,version_number),
  UNIQUE (checksum)
);
ALTER TABLE metric_definition_versions DROP CONSTRAINT IF EXISTS metric_definition_versions_checksum_key;
CREATE INDEX IF NOT EXISTS idx_metric_definition_versions_checksum ON metric_definition_versions(checksum);
CREATE INDEX IF NOT EXISTS idx_metric_definition_versions_scope_status ON metric_definition_versions (tenant_id,status,effective_from DESC);
DROP TRIGGER IF EXISTS trg_metric_definition_versions_immutable ON metric_definition_versions;
CREATE TRIGGER trg_metric_definition_versions_immutable BEFORE UPDATE OR DELETE ON metric_definition_versions
FOR EACH ROW EXECUTE FUNCTION reject_published_indicator_governance_change();

ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS metric_definition_id uuid REFERENCES metric_definitions(id) ON DELETE CASCADE;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS definition_version_id uuid REFERENCES metric_definition_versions(id) ON DELETE RESTRICT;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS official_formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE RESTRICT;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS semantic_contract_version_id uuid REFERENCES data_source_contract_versions(id) ON DELETE RESTRICT;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS mapping_id uuid REFERENCES data_source_field_mappings(id) ON DELETE SET NULL;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0);
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS methodology_version integer NOT NULL DEFAULT 1 CHECK (methodology_version > 0);
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS checksum char(64);
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE metric_source_bindings ADD COLUMN IF NOT EXISTS published_at timestamptz;
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='metric_source_bindings'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%binding_status%'
  LOOP EXECUTE format('ALTER TABLE metric_source_bindings DROP CONSTRAINT %I',item.conname); END LOOP;
END $$;
ALTER TABLE metric_source_bindings ADD CONSTRAINT metric_source_bindings_status_check CHECK (binding_status IN ('draft','reviewed','published','retired'));
DROP INDEX IF EXISTS idx_metric_source_bindings_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_source_binding_version ON metric_source_bindings
  (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_key,version_number);
DROP INDEX IF EXISTS idx_metric_source_binding_one_published;
DROP TRIGGER IF EXISTS trg_metric_source_binding_immutable ON metric_source_bindings;
CREATE TRIGGER trg_metric_source_binding_immutable BEFORE UPDATE OR DELETE ON metric_source_bindings
FOR EACH ROW EXECUTE FUNCTION reject_published_indicator_governance_change();

ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0);
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS timeout_ms integer NOT NULL DEFAULT 30000 CHECK (timeout_ms BETWEEN 1000 AND 300000);
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10);
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS retry_backoff_seconds integer NOT NULL DEFAULT 30 CHECK (retry_backoff_seconds BETWEEN 1 AND 86400);
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS retention_periods integer NOT NULL DEFAULT 24 CHECK (retention_periods BETWEEN 1 AND 240);
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS checksum char(64);
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE metric_calculation_policies ADD COLUMN IF NOT EXISTS published_at timestamptz;
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='metric_calculation_policies'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP EXECUTE format('ALTER TABLE metric_calculation_policies DROP CONSTRAINT %I',item.conname); END LOOP;
END $$;
ALTER TABLE metric_calculation_policies ADD CONSTRAINT metric_calculation_policies_status_check CHECK (status IN ('draft','reviewed','published','retired'));
DROP INDEX IF EXISTS idx_metric_calculation_policies_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_calculation_policy_version ON metric_calculation_policies
  (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_key,version_number);
DROP INDEX IF EXISTS idx_metric_calculation_policy_one_published;
DROP TRIGGER IF EXISTS trg_metric_calculation_policy_immutable ON metric_calculation_policies;
CREATE TRIGGER trg_metric_calculation_policy_immutable BEFORE UPDATE OR DELETE ON metric_calculation_policies
FOR EACH ROW EXECUTE FUNCTION reject_published_indicator_governance_change();

DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='metric_thresholds'::regclass AND contype='u'
  LOOP EXECUTE format('ALTER TABLE metric_thresholds DROP CONSTRAINT %I',item.conname); END LOOP;
END $$;
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0);
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('higher_is_better','lower_is_better','target_range','informational'));
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS justification text;
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','published','retired'));
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS checksum char(64);
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE metric_thresholds ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_threshold_version_band ON metric_thresholds
  (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_definition_id,version_number,threshold_key);
DROP TRIGGER IF EXISTS trg_metric_threshold_immutable ON metric_thresholds;
CREATE TRIGGER trg_metric_threshold_immutable BEFORE UPDATE OR DELETE ON metric_thresholds
FOR EACH ROW EXECUTE FUNCTION reject_published_indicator_governance_change();

CREATE TABLE IF NOT EXISTS metric_trust_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid REFERENCES metric_definitions(id) ON DELETE CASCADE,
  policy_code text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  weights jsonb NOT NULL CHECK (jsonb_typeof(weights)='object'),
  critical_dimensions text[] NOT NULL DEFAULT ARRAY['freshness','lineage','validation','coverage'],
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','published','retired')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_trust_policy_version ON metric_trust_policies
  (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),policy_code,version_number);
DROP INDEX IF EXISTS idx_metric_trust_policy_one_published;
DROP TRIGGER IF EXISTS trg_metric_trust_policy_immutable ON metric_trust_policies;
CREATE TRIGGER trg_metric_trust_policy_immutable BEFORE UPDATE OR DELETE ON metric_trust_policies
FOR EACH ROW EXECUTE FUNCTION reject_published_indicator_governance_change();

CREATE TABLE IF NOT EXISTS metric_trust_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE RESTRICT,
  measurement_id uuid REFERENCES metric_measurements(id) ON DELETE RESTRICT,
  calculation_run_id uuid REFERENCES calculation_runs(id) ON DELETE RESTRICT,
  trust_policy_id uuid NOT NULL REFERENCES metric_trust_policies(id) ON DELETE RESTRICT,
  score numeric(5,2) CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  trust_status text NOT NULL CHECK (trust_status IN ('trusted','acceptable','attention','untrusted','unknown')),
  dimensions jsonb NOT NULL CHECK (jsonb_typeof(dimensions)='object'),
  evidence_checksum char(64) NOT NULL,
  assessment_checksum char(64) NOT NULL,
  correlation_id text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id,metric_definition_id,correlation_id,assessment_checksum)
);

ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS official_state text CHECK (official_state IS NULL OR official_state IN ('calculated','unmeasured','source_unavailable','mapping_required','insufficient_data','insufficient_coverage','stale_source','dependency_pending','source_incompatible','validation_failed','technical_error'));
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS coverage_ratio numeric(7,6) CHECK (coverage_ratio IS NULL OR coverage_ratio BETWEEN 0 AND 1);
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS sample_size integer CHECK (sample_size IS NULL OR sample_size >= 0);
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS population_size integer CHECK (population_size IS NULL OR population_size >= 0);
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS sufficiency_status text CHECK (sufficiency_status IS NULL OR sufficiency_status IN ('sufficient','partial','insufficient','source_unavailable','mapping_required','invalid'));
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS source_snapshot_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS calculation_run_id uuid REFERENCES calculation_runs(id) ON DELETE RESTRICT;
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS official_formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE RESTRICT;
ALTER TABLE metric_measurements ADD COLUMN IF NOT EXISTS trust_assessment_id uuid REFERENCES metric_trust_assessments(id) ON DELETE SET NULL;
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='metric_measurements'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%value_numeric IS NOT NULL OR value_text IS NOT NULL%'
  LOOP EXECUTE format('ALTER TABLE metric_measurements DROP CONSTRAINT %I',item.conname); END LOOP;
END $$;
ALTER TABLE metric_measurements ADD CONSTRAINT metric_measurements_legacy_or_official_value_check CHECK (
  (official_state IS NULL AND (value_numeric IS NOT NULL OR value_text IS NOT NULL)) OR official_state IS NOT NULL
) NOT VALID;
ALTER TABLE metric_measurements ADD CONSTRAINT metric_measurements_official_value_contract CHECK (official_state IS NULL OR (official_state='calculated' AND value_numeric IS NOT NULL) OR (official_state<>'calculated' AND value_numeric IS NULL AND value_text IS NULL)) NOT VALID;

ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS definition_version_id uuid REFERENCES metric_definition_versions(id) ON DELETE RESTRICT;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS calculation_run_id uuid REFERENCES calculation_runs(id) ON DELETE RESTRICT;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS official_formula_version_id uuid REFERENCES official_formula_versions(id) ON DELETE RESTRICT;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS trust_assessment_id uuid REFERENCES metric_trust_assessments(id) ON DELETE RESTRICT;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS threshold_version integer;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS methodology_version integer;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS effective_at timestamptz;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS source_snapshot_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS snapshot_status text NOT NULL DEFAULT 'draft' CHECK (snapshot_status IN ('draft','published','superseded','retired'));
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS published_at timestamptz;
DROP INDEX IF EXISTS idx_metric_snapshot_logical_publish;
CREATE UNIQUE INDEX idx_metric_snapshot_logical_publish ON metric_snapshots
  (tenant_id,metric_definition_id,period_key,definition_version_id,official_formula_version_id,content_hash) WHERE snapshot_status='published';
DROP TRIGGER IF EXISTS trg_metric_snapshot_immutable ON metric_snapshots;
CREATE TRIGGER trg_metric_snapshot_immutable BEFORE UPDATE OR DELETE ON metric_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_published_indicator_governance_change();

CREATE TABLE IF NOT EXISTS metric_interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_snapshot_id uuid NOT NULL REFERENCES metric_snapshots(id) ON DELETE RESTRICT,
  interpretation_version integer NOT NULL CHECK (interpretation_version > 0),
  result_status text NOT NULL,
  trend jsonb NOT NULL DEFAULT '{}'::jsonb,
  comparison jsonb NOT NULL DEFAULT '{}'::jsonb,
  cause text,
  impact text,
  recommendation text,
  proposed_action text,
  priority text NOT NULL,
  suggested_owner text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,metric_snapshot_id,interpretation_version),
  UNIQUE (tenant_id,checksum)
);

CREATE TABLE IF NOT EXISTS metric_action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_snapshot_id uuid NOT NULL REFERENCES metric_snapshots(id) ON DELETE RESTRICT,
  interpretation_id uuid REFERENCES metric_interpretations(id) ON DELETE RESTRICT,
  proposal_type text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  priority text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  proposal_key char(64) NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected','transformed','expired')),
  proposed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  transformed_action_type text,
  transformed_action_id uuid,
  decision_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id,proposal_key)
);
CREATE INDEX IF NOT EXISTS idx_metric_action_proposals_status ON metric_action_proposals (tenant_id,status,priority,proposed_at DESC);

ALTER TABLE data_comparisons ALTER COLUMN baseline_snapshot_id DROP NOT NULL;
ALTER TABLE data_comparisons ALTER COLUMN current_snapshot_id DROP NOT NULL;
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS baseline_metric_snapshot_id uuid REFERENCES metric_snapshots(id) ON DELETE RESTRICT;
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS current_metric_snapshot_id uuid REFERENCES metric_snapshots(id) ON DELETE RESTRICT;
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS metric_definition_id uuid REFERENCES metric_definitions(id) ON DELETE RESTRICT;
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS methodology_compatible boolean;
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS compatibility_reason text;
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS period_distance integer CHECK (period_distance IS NULL OR period_distance >= 0);
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS comparison_checksum char(64);
ALTER TABLE data_comparisons ADD COLUMN IF NOT EXISTS target_value numeric;
ALTER TABLE data_comparisons DROP CONSTRAINT IF EXISTS data_comparisons_comparison_type_check;
ALTER TABLE data_comparisons ADD CONSTRAINT data_comparisons_comparison_type_check CHECK (comparison_type IN ('period','unit','process','standard','supplier','before_after','plan','baseline','target','window')) NOT VALID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_comparisons_snapshot_pair_check') THEN
    ALTER TABLE data_comparisons ADD CONSTRAINT data_comparisons_snapshot_pair_check CHECK (
      (baseline_snapshot_id IS NOT NULL AND current_snapshot_id IS NOT NULL AND baseline_metric_snapshot_id IS NULL AND current_metric_snapshot_id IS NULL)
      OR (baseline_snapshot_id IS NULL AND current_snapshot_id IS NULL AND baseline_metric_snapshot_id IS NOT NULL AND current_metric_snapshot_id IS NOT NULL)
      OR (comparison_type='target' AND baseline_snapshot_id IS NULL AND current_snapshot_id IS NULL AND baseline_metric_snapshot_id IS NULL AND current_metric_snapshot_id IS NOT NULL AND target_value IS NOT NULL)
    ) NOT VALID;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_comparison_unique ON data_comparisons
  (tenant_id,baseline_metric_snapshot_id,current_metric_snapshot_id,comparison_type,COALESCE(metric_definition_id,'00000000-0000-0000-0000-000000000000'::uuid))
  WHERE baseline_metric_snapshot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_target_comparison_unique ON data_comparisons
  (tenant_id,current_metric_snapshot_id,target_value,COALESCE(metric_definition_id,'00000000-0000-0000-0000-000000000000'::uuid))
  WHERE comparison_type='target' AND baseline_metric_snapshot_id IS NULL;

CREATE TABLE IF NOT EXISTS metric_job_policies (
  job_type text PRIMARY KEY CHECK (job_type IN ('metric.calculate','metric.snapshot','metric.compare','metric.freshness','metric.alert','metric.reconcile','metric.retention')),
  timeout_ms integer NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 300000),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  retry_backoff_seconds integer NOT NULL CHECK (retry_backoff_seconds BETWEEN 1 AND 86400),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  checksum char(64) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO metric_job_policies(job_type,timeout_ms,max_attempts,retry_backoff_seconds,checksum) VALUES
 ('metric.calculate',30000,3,30,encode(digest('metric.calculate:30000:3:30','sha256'),'hex')),
 ('metric.snapshot',30000,3,30,encode(digest('metric.snapshot:30000:3:30','sha256'),'hex')),
 ('metric.compare',30000,3,30,encode(digest('metric.compare:30000:3:30','sha256'),'hex')),
 ('metric.freshness',30000,3,60,encode(digest('metric.freshness:30000:3:60','sha256'),'hex')),
 ('metric.alert',30000,3,60,encode(digest('metric.alert:30000:3:60','sha256'),'hex')),
 ('metric.reconcile',60000,3,120,encode(digest('metric.reconcile:60000:3:120','sha256'),'hex')),
 ('metric.retention',60000,3,120,encode(digest('metric.retention:60000:3:120','sha256'),'hex'))
ON CONFLICT(job_type) DO UPDATE SET timeout_ms=EXCLUDED.timeout_ms,max_attempts=EXCLUDED.max_attempts,retry_backoff_seconds=EXCLUDED.retry_backoff_seconds,checksum=EXCLUDED.checksum,updated_at=now();

INSERT INTO commercial_technical_capabilities(capability_key,display_name,description,required_permission,status) VALUES
 ('metrics.indicators.read','Indicadores funcionales','Consulta funcional de indicadores oficiales.','metrics.read','active'),
 ('metrics.indicators.technical','Detalle técnico de indicadores','Metodología, binding, lineage y checksums.','data.lineage.read','active'),
 ('metrics.methodology.manage','Administrar metodología','Crea versiones de catálogo, binding, políticas y thresholds.','metrics.manage','active'),
 ('metrics.methodology.review','Revisar metodología','Revisa definiciones, thresholds y políticas.','metrics.validate','active'),
 ('metrics.methodology.publish','Publicar metodología','Publica versiones inmutables.','metrics.publish','active'),
 ('metrics.snapshots.publish','Publicar snapshots','Crea y publica snapshots oficiales.','metrics.measure','active'),
 ('metrics.comparisons.read','Comparar indicadores','Consulta comparaciones metodológicamente compatibles.','metrics.read','active'),
 ('metrics.actions.propose','Proponer acciones','Crea propuestas reversibles desde indicadores.','metrics.measure','active'),
 ('metrics.actions.review','Revisar acciones propuestas','Acepta o rechaza propuestas sin ejecución automática.','metrics.validate','active'),
 ('metrics.jobs.run','Ejecutar jobs de indicadores','Ejecuta jobs tenant-scoped e idempotentes.','metrics.recalculate','active')
ON CONFLICT(capability_key) DO UPDATE SET display_name=EXCLUDED.display_name,description=EXCLUDED.description,required_permission=EXCLUDED.required_permission,status='active',updated_at=now();

INSERT INTO role_permissions(role_key,permission_key,is_allowed)
SELECT role_key,permission_key,true
FROM app_roles
CROSS JOIN (VALUES ('metrics.read'),('data.lineage.read')) AS allowed(permission_key)
WHERE role_key IN ('viewer','business_user','auditor')
  AND EXISTS (SELECT 1 FROM permissions p WHERE p.permission_key=allowed.permission_key)
ON CONFLICT(role_key,permission_key) DO UPDATE SET is_allowed=true,updated_at=now();

INSERT INTO feature_capabilities(feature_key,capability_key)
SELECT 'metrics_bi_core',capability_key FROM commercial_technical_capabilities WHERE capability_key LIKE 'metrics.%'
ON CONFLICT DO NOTHING;

INSERT INTO usage_limit_definitions(resource_key,display_name,description,default_limit,unit,period,warning_threshold,enforcement) VALUES
 ('indicators_active','Indicadores activos','Máximo de indicadores tenant publicados.',250,'count','lifetime',0.8,'block'),
 ('indicator_versions_active','Versiones de indicadores','Versiones metodológicas creadas por tenant.',1000,'count','lifetime',0.8,'block'),
 ('indicator_snapshots_monthly','Snapshots mensuales','Snapshots oficiales creados por mes.',5000,'count','month',0.8,'block'),
 ('indicator_snapshots_retained','Snapshots retenidos','Snapshots oficiales retenidos.',50000,'count','lifetime',0.8,'block'),
 ('indicator_jobs_concurrent','Jobs concurrentes','Jobs 5-C3 simultáneos por tenant.',4,'count','lifetime',0.75,'block'),
 ('indicator_comparisons_monthly','Comparaciones mensuales','Comparaciones históricas creadas por mes.',10000,'count','month',0.8,'block'),
 ('indicator_exports_monthly','Exportaciones de indicadores','Exportaciones oficiales por mes.',250,'count','month',0.8,'block')
ON CONFLICT(resource_key) DO UPDATE SET display_name=EXCLUDED.display_name,description=EXCLUDED.description,default_limit=EXCLUDED.default_limit,unit=EXCLUDED.unit,period=EXCLUDED.period,warning_threshold=EXCLUDED.warning_threshold,enforcement=EXCLUDED.enforcement,status='active',updated_at=now();

COMMIT;
