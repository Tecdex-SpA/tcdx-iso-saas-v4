-- TCDX ISO SaaS v4 - Phase 5-C2 canonical semantic layer.
-- Additive, tenant-scoped and idempotent. Operational source records remain authoritative.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE tcdx_async_jobs
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS model_mode text,
  ADD COLUMN IF NOT EXISTS source_module text,
  ADD COLUMN IF NOT EXISTS request_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_json jsonb,
  ADD COLUMN IF NOT EXISTS result_file_id uuid,
  ADD COLUMN IF NOT EXISTS result_file_url text,
  ADD COLUMN IF NOT EXISTS result_download_url text,
  ADD COLUMN IF NOT EXISTS error_json jsonb,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_tcdx_async_jobs_type_status ON tcdx_async_jobs (job_type,status);

CREATE TABLE IF NOT EXISTS data_source_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  source_code text NOT NULL CHECK (source_code ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  display_name text NOT NULL,
  entity_type text NOT NULL,
  adapter_key text NOT NULL CHECK (adapter_key ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  current_version_id uuid,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_semantic_contracts_tenant_code
  ON data_source_contracts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), source_code);
CREATE INDEX IF NOT EXISTS idx_semantic_contracts_tenant_status
  ON data_source_contracts (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS data_source_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES data_source_contracts(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  physical_tables jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(physical_tables) = 'array'),
  allowed_joins jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allowed_joins) = 'array'),
  tenant_key_candidates jsonb NOT NULL DEFAULT '["tenant_id"]'::jsonb CHECK (jsonb_typeof(tenant_key_candidates) = 'array'),
  timestamp_candidates jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(timestamp_candidates) = 'array'),
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_fields) = 'array'),
  optional_fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(optional_fields) = 'array'),
  field_equivalences jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(field_equivalences) = 'object'),
  unit_policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(unit_policy) = 'object'),
  period_policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(period_policy) = 'object'),
  exclusion_policy jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exclusion_policy) = 'array'),
  fallback_policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fallback_policy) = 'object'),
  minimum_coverage numeric(5,4) NOT NULL DEFAULT 0 CHECK (minimum_coverage BETWEEN 0 AND 1),
  maximum_age_seconds bigint CHECK (maximum_age_seconds IS NULL OR maximum_age_seconds > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  valid_from timestamptz,
  valid_until timestamptz,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from),
  UNIQUE (contract_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_semantic_contract_versions_status
  ON data_source_contract_versions (contract_id, status, version_number DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_source_contracts_current_version_fk') THEN
    ALTER TABLE data_source_contracts ADD CONSTRAINT data_source_contracts_current_version_fk
      FOREIGN KEY (current_version_id) REFERENCES data_source_contract_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS data_source_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_version_id uuid NOT NULL REFERENCES data_source_contract_versions(id) ON DELETE CASCADE,
  physical_table text NOT NULL CHECK (physical_table ~ '^[a-z_][a-z0-9_]*$'),
  physical_column text NOT NULL CHECK (physical_column ~ '^[a-z_][a-z0-9_]*$'),
  canonical_field text NOT NULL CHECK (canonical_field ~ '^[a-z][a-z0-9_.-]*$'),
  transformation_type text NOT NULL CHECK (transformation_type IN ('direct','trim','lowercase','uppercase','date_parse','timezone_normalize','status_map','severity_map','unit_convert','boolean_map','numeric_parse','enum_map','coalesce_controlled')),
  transformation_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(transformation_config) = 'object'),
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000),
  required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','invalid','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE (tenant_id, contract_version_id, canonical_field, priority)
);
CREATE INDEX IF NOT EXISTS idx_semantic_mappings_version
  ON data_source_field_mappings (tenant_id, contract_version_id, status, priority);

CREATE TABLE IF NOT EXISTS grc_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  observation_type text NOT NULL CHECK (observation_type ~ '^[a-z][a-z0-9_.-]*$'),
  entity_type text NOT NULL,
  entity_id uuid,
  contract_id uuid NOT NULL REFERENCES data_source_contracts(id) ON DELETE RESTRICT,
  contract_version_id uuid NOT NULL REFERENCES data_source_contract_versions(id) ON DELETE RESTRICT,
  source_table text NOT NULL CHECK (source_table ~ '^[a-z_][a-z0-9_]*$'),
  source_record_id text NOT NULL,
  source_identity_hash char(64) NOT NULL,
  observed_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  period_start timestamptz,
  period_end timestamptz,
  status_value text,
  severity_value text,
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  unit text,
  quality_status text NOT NULL CHECK (quality_status IN ('valid','attention','failed','unknown')),
  quality_score numeric(5,2) CHECK (quality_score BETWEEN 0 AND 100),
  freshness_status text NOT NULL CHECK (freshness_status IN ('fresh','attention','stale','unknown')),
  freshness_age_seconds bigint CHECK (freshness_age_seconds IS NULL OR freshness_age_seconds >= 0),
  trust_score numeric(5,2) CHECK (trust_score IS NULL OR trust_score BETWEEN 0 AND 100),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_id uuid,
  correlation_id text NOT NULL,
  source_snapshot_id uuid REFERENCES data_snapshots(id) ON DELETE RESTRICT,
  supersedes_observation_id uuid REFERENCES grc_observations(id) ON DELETE RESTRICT,
  superseded_by_id uuid REFERENCES grc_observations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  CHECK (num_nonnulls(numeric_value, text_value, boolean_value) <= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_observations_current_source_identity
  ON grc_observations (tenant_id, contract_version_id, source_identity_hash) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_observations_tenant_type_time ON grc_observations (tenant_id, observation_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_entity ON grc_observations (tenant_id, entity_type, entity_id, is_current);

CREATE TABLE IF NOT EXISTS grc_observation_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  observation_id uuid NOT NULL REFERENCES grc_observations(id) ON DELETE CASCADE,
  related_entity_type text NOT NULL,
  related_entity_id uuid NOT NULL,
  relation_type text NOT NULL CHECK (relation_type IN ('describes','supports','evidences','affects','measures','owned_by','derived_from','related_to')),
  confidence numeric(5,4) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE (tenant_id, observation_id, related_entity_type, related_entity_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_observation_relations_entity ON grc_observation_relations (tenant_id, related_entity_type, related_entity_id);

CREATE TABLE IF NOT EXISTS metric_sufficiency_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  metric_definition_id uuid REFERENCES metric_definitions(id) ON DELETE CASCADE,
  formula_code text,
  rule_code text NOT NULL CHECK (rule_code ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  version_number integer NOT NULL CHECK (version_number > 0),
  required_inputs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_inputs) = 'array'),
  optional_inputs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(optional_inputs) = 'array'),
  minimum_sample_size integer NOT NULL DEFAULT 1 CHECK (minimum_sample_size > 0),
  minimum_coverage numeric(5,4) NOT NULL DEFAULT 0 CHECK (minimum_coverage BETWEEN 0 AND 1),
  maximum_age_seconds bigint CHECK (maximum_age_seconds IS NULL OR maximum_age_seconds > 0),
  allowed_quality_statuses text[] NOT NULL DEFAULT ARRAY['valid','attention'],
  allowed_freshness_statuses text[] NOT NULL DEFAULT ARRAY['fresh','attention'],
  allowed_units text[] NOT NULL DEFAULT ARRAY[]::text[],
  period_policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(period_policy) = 'object'),
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exclusions) = 'array'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','published','retired')),
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (metric_definition_id IS NOT NULL OR formula_code IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sufficiency_rules_tenant_code_version ON metric_sufficiency_rules (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_code, version_number);

CREATE OR REPLACE FUNCTION reject_published_semantic_version_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' THEN RAISE EXCEPTION 'published semantic versions are immutable'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_semantic_contract_version_immutable ON data_source_contract_versions;
CREATE TRIGGER trg_semantic_contract_version_immutable BEFORE UPDATE OR DELETE ON data_source_contract_versions FOR EACH ROW EXECUTE FUNCTION reject_published_semantic_version_change();
DROP TRIGGER IF EXISTS trg_semantic_sufficiency_rule_immutable ON metric_sufficiency_rules;
CREATE TRIGGER trg_semantic_sufficiency_rule_immutable BEFORE UPDATE OR DELETE ON metric_sufficiency_rules FOR EACH ROW EXECUTE FUNCTION reject_published_semantic_version_change();

CREATE OR REPLACE FUNCTION protect_semantic_observation_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'canonical observations are append-only'; END IF;
  IF OLD.is_current AND NOT NEW.is_current AND OLD.superseded_by_id IS NULL AND NEW.superseded_by_id IS NOT NULL
     AND (to_jsonb(OLD) - ARRAY['is_current','superseded_by_id']) = (to_jsonb(NEW) - ARRAY['is_current','superseded_by_id']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical observations are immutable except controlled supersession';
END;
$$;
DROP TRIGGER IF EXISTS trg_semantic_observation_history ON grc_observations;
CREATE TRIGGER trg_semantic_observation_history BEFORE UPDATE OR DELETE ON grc_observations FOR EACH ROW EXECUTE FUNCTION protect_semantic_observation_history();

CREATE OR REPLACE FUNCTION protect_semantic_source_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.snapshot_type = 'semantic_source' THEN RAISE EXCEPTION 'semantic source snapshots are immutable'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_semantic_source_snapshot_immutable ON data_snapshots;
CREATE TRIGGER trg_semantic_source_snapshot_immutable BEFORE UPDATE OR DELETE ON data_snapshots FOR EACH ROW EXECUTE FUNCTION protect_semantic_source_snapshot();

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint
  WHERE conrelid = 'data_snapshots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%snapshot_type%' LIMIT 1;
  IF constraint_name IS NOT NULL THEN EXECUTE format('ALTER TABLE data_snapshots DROP CONSTRAINT %I', constraint_name); END IF;
  ALTER TABLE data_snapshots ADD CONSTRAINT data_snapshots_snapshot_type_check
    CHECK (snapshot_type IN ('metric','dashboard','report','readiness','risk','compliance','control','supplier','incident','loss','data','semantic_source'));
END $$;

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('semantic.contracts.read','semantic','Consultar contratos semánticos','Consulta contratos lógicos y sus estados funcionales.'),
  ('semantic.contracts.manage','semantic','Administrar contratos semánticos','Crea contratos y versiones en borrador.'),
  ('semantic.contracts.review','semantic','Revisar contratos semánticos','Revisa versiones antes de aprobación.'),
  ('semantic.contracts.publish','semantic','Publicar contratos semánticos','Publica versiones inmutables.'),
  ('semantic.mappings.read','semantic','Consultar mappings semánticos','Consulta mappings tipados autorizados.'),
  ('semantic.mappings.manage','semantic','Administrar mappings semánticos','Configura mappings con transformaciones permitidas.'),
  ('semantic.mappings.validate','semantic','Validar mappings semánticos','Valida mappings contra el contrato vigente.'),
  ('semantic.observations.read','semantic','Consultar observaciones canónicas','Consulta observaciones y disponibilidad funcional.'),
  ('semantic.observations.ingest','semantic','Ingerir observaciones canónicas','Ejecuta ingesta tenant-scoped e idempotente.'),
  ('semantic.lineage.read','semantic','Consultar lineage semántico','Consulta trazabilidad desde origen a observación.'),
  ('semantic.sufficiency.read','semantic','Consultar suficiencia','Consulta reglas y evaluaciones de suficiencia.'),
  ('semantic.sufficiency.manage','semantic','Administrar suficiencia','Crea reglas versionadas.'),
  ('semantic.sufficiency.publish','semantic','Publicar suficiencia','Publica reglas inmutables.')
ON CONFLICT (permission_key) DO UPDATE SET permission_group=EXCLUDED.permission_group,display_name=EXCLUDED.display_name,description=EXCLUDED.description;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key,p.permission_key,true FROM (VALUES ('admin'),('tenant_admin'),('admin_cumplimiento'),('compliance_admin')) AS r(role_key)
JOIN app_roles ar ON ar.role_key=r.role_key CROSS JOIN permissions p WHERE p.permission_group='semantic'
ON CONFLICT (role_key,permission_key) DO UPDATE SET is_allowed=EXCLUDED.is_allowed;
INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key,p.permission_key,true FROM (VALUES ('auditor'),('operativo'),('responsable_area'),('area_owner')) AS r(role_key)
JOIN app_roles ar ON ar.role_key=r.role_key CROSS JOIN permissions p
WHERE p.permission_key IN ('semantic.contracts.read','semantic.mappings.read','semantic.observations.read','semantic.lineage.read','semantic.sufficiency.read')
ON CONFLICT (role_key,permission_key) DO UPDATE SET is_allowed=EXCLUDED.is_allowed;

INSERT INTO commercial_technical_capabilities (capability_key,display_name,description,required_permission,status)
VALUES ('data.semantic_layer','Capa semántica GRC','Contratos, mappings, observaciones, calidad, freshness, suficiencia y lineage.','semantic.contracts.read','active')
ON CONFLICT (capability_key) DO UPDATE SET display_name=EXCLUDED.display_name,description=EXCLUDED.description,required_permission=EXCLUDED.required_permission,status=EXCLUDED.status,updated_at=now();
INSERT INTO feature_capabilities (feature_key,capability_key) VALUES ('data_governance_core','data.semantic_layer') ON CONFLICT DO NOTHING;

INSERT INTO usage_limit_definitions (resource_key,display_name,description,default_limit,unit,period,warning_threshold,enforcement)
VALUES
  ('semantic_contracts','Contratos semánticos','Contratos semánticos tenant activos.',100,'count','lifetime',0.8,'block'),
  ('semantic_mappings','Mappings semánticos','Mappings tipados tenant activos.',1000,'count','lifetime',0.8,'block'),
  ('semantic_observations_monthly','Observaciones semánticas','Observaciones canónicas ingeridas por mes.',100000,'count','month',0.8,'block')
ON CONFLICT (resource_key) DO UPDATE SET display_name=EXCLUDED.display_name,description=EXCLUDED.description,default_limit=EXCLUDED.default_limit,unit=EXCLUDED.unit,period=EXCLUDED.period,warning_threshold=EXCLUDED.warning_threshold,enforcement=EXCLUDED.enforcement,updated_at=now();

COMMIT;
