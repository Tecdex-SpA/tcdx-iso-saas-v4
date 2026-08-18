-- TCDX ISO SaaS v4 - F6.8-03 canonical GRC Gap model.
-- Additive, tenant-scoped, deterministic over canonical observations. No demo data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('gap.read', 'gap', 'Consultar brechas GRC', 'Consulta brechas GRC tenant-scoped y su provenance.'),
  ('gap.manage', 'gap', 'Administrar brechas GRC', 'Administra registros auxiliares de brechas e hipótesis separadas.'),
  ('gap.transition', 'gap', 'Transicionar brechas GRC', 'Ejecuta cambios gobernados del lifecycle de brechas.'),
  ('gap.evaluate', 'gap', 'Evaluar reglas de brechas GRC', 'Ejecuta reglas determinísticas sobre observaciones canónicas.')
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin')
  AND p.permission_key LIKE 'gap.%'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key = 'auditor'
  AND p.permission_key IN ('gap.read', 'gap.evaluate', 'gap.transition')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('operativo', 'responsable_area', 'area_owner')
  AND p.permission_key IN ('gap.read', 'gap.transition')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

CREATE TABLE IF NOT EXISTS grc_gap_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  rule_code text NOT NULL CHECK (rule_code ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  rule_version integer NOT NULL CHECK (rule_version > 0),
  rule_type text NOT NULL DEFAULT 'deterministic' CHECK (rule_type IN ('deterministic')),
  input_observation_type text NOT NULL CHECK (input_observation_type ~ '^[a-z][a-z0-9_.-]*$'),
  gap_type text NOT NULL CHECK (gap_type ~ '^[a-z][a-z0-9_.-]*$'),
  severity_policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(severity_policy) = 'object'),
  status_policy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(status_policy) = 'object'),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(definition) = 'object'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  enabled boolean NOT NULL DEFAULT TRUE,
  checksum char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_gap_rules_tenant_code_version
  ON grc_gap_rules (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_code, rule_version);

CREATE OR REPLACE FUNCTION protect_grc_gap_published_rule_version()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published'
     AND (
       NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.rule_code IS DISTINCT FROM OLD.rule_code
       OR NEW.rule_version IS DISTINCT FROM OLD.rule_version
       OR NEW.rule_type IS DISTINCT FROM OLD.rule_type
       OR NEW.input_observation_type IS DISTINCT FROM OLD.input_observation_type
       OR NEW.gap_type IS DISTINCT FROM OLD.gap_type
       OR NEW.severity_policy IS DISTINCT FROM OLD.severity_policy
       OR NEW.status_policy IS DISTINCT FROM OLD.status_policy
       OR NEW.definition IS DISTINCT FROM OLD.definition
       OR NEW.checksum IS DISTINCT FROM OLD.checksum
     ) THEN
    RAISE EXCEPTION 'Published GRC Gap rule versions are immutable; publish a new rule_version instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grc_gap_published_rule_version ON grc_gap_rules;
CREATE TRIGGER trg_grc_gap_published_rule_version
BEFORE UPDATE ON grc_gap_rules
FOR EACH ROW EXECUTE FUNCTION protect_grc_gap_published_rule_version();

CREATE TABLE IF NOT EXISTS grc_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gap_key char(64) NOT NULL,
  gap_type text NOT NULL CHECK (gap_type ~ '^[a-z][a-z0-9_.-]*$'),
  rule_id uuid NOT NULL REFERENCES grc_gap_rules(id) ON DELETE RESTRICT,
  rule_code text NOT NULL CHECK (rule_code ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  rule_version integer NOT NULL CHECK (rule_version > 0),
  source_observation_id uuid NOT NULL REFERENCES grc_observations(id) ON DELETE RESTRICT,
  latest_source_observation_id uuid NOT NULL REFERENCES grc_observations(id) ON DELETE RESTRICT,
  affected_entity_type text NOT NULL,
  affected_entity_id uuid,
  severity text NOT NULL CHECK (severity IN ('informational','low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','in_treatment','verified','closed')),
  first_seen timestamptz NOT NULL,
  last_seen timestamptz NOT NULL,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  verified_at timestamptz,
  is_current boolean NOT NULL DEFAULT TRUE,
  correlation_id text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (last_seen >= first_seen),
  CHECK (status <> 'verified' OR verified_at IS NOT NULL),
  CHECK (status <> 'closed' OR resolved_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_gaps_tenant_gap_key
  ON grc_gaps (tenant_id, gap_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_gaps_current_gap_key
  ON grc_gaps (tenant_id, gap_key) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_grc_gaps_tenant_status
  ON grc_gaps (tenant_id, status, severity, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_grc_gaps_rule
  ON grc_gaps (tenant_id, rule_code, rule_version, status);
CREATE INDEX IF NOT EXISTS idx_grc_gaps_observation
  ON grc_gaps (tenant_id, latest_source_observation_id);
CREATE INDEX IF NOT EXISTS idx_grc_gaps_entity
  ON grc_gaps (tenant_id, affected_entity_type, affected_entity_id, status);

CREATE TABLE IF NOT EXISTS grc_gap_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gap_id uuid NOT NULL REFERENCES grc_gaps(id) ON DELETE CASCADE,
  from_status text CHECK (from_status IN ('open','acknowledged','in_treatment','verified','closed')),
  to_status text NOT NULL CHECK (to_status IN ('open','acknowledged','in_treatment','verified','closed')),
  transition_type text NOT NULL CHECK (transition_type IN ('evaluation_created','evaluation_confirmed','reopened','manual_transition')),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source_observation_id uuid REFERENCES grc_observations(id) ON DELETE RESTRICT,
  rule_code text NOT NULL,
  rule_version integer NOT NULL,
  reason text,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grc_gap_history_gap
  ON grc_gap_status_history (tenant_id, gap_id, created_at DESC);

CREATE TABLE IF NOT EXISTS grc_gap_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hypothesis_key char(64) NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  title text NOT NULL,
  statement text NOT NULL,
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','accepted','rejected','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE (tenant_id, hypothesis_key)
);
CREATE INDEX IF NOT EXISTS idx_grc_gap_hypotheses_tenant_status
  ON grc_gap_hypotheses (tenant_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION touch_grc_gaps_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grc_gaps_updated_at ON grc_gaps;
CREATE TRIGGER trg_grc_gaps_updated_at
BEFORE UPDATE ON grc_gaps
FOR EACH ROW EXECUTE FUNCTION touch_grc_gaps_updated_at();

WITH inserted AS (
  INSERT INTO grc_gap_rules (
    tenant_id, rule_code, rule_version, rule_type, input_observation_type,
    gap_type, severity_policy, status_policy, definition, status, enabled,
    checksum, published_at, metadata
  )
  SELECT
    NULL,
    'observation.data_trust_attention_gap',
    1,
    'deterministic',
    'official_calculation.data_trust_attention',
    'data_trust_attention',
    '{"source":"observation.severity_value","allowed":["low","medium","high","critical"]}'::jsonb,
    '{"initial":"open","reopen":"open","terminal":["verified","closed"]}'::jsonb,
    '{"material_data_trust_states":["TRUSTED_WITH_WARNINGS","LOW_CONFIDENCE"],"bad_data_states":["INSUFFICIENT_DATA","UNTRUSTED"],"business_semantics":"data_quality_gap_only"}'::jsonb,
    'published',
    TRUE,
    encode(digest('observation.data_trust_attention_gap:v1:official_calculation.data_trust_attention:data_quality_gap', 'sha256'), 'hex'),
    now(),
    '{"owner":"grc_gap_service","deterministic":true,"ai_created":false,"source":"F6.8-03"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM grc_gap_rules
    WHERE tenant_id IS NULL
      AND rule_code='observation.data_trust_attention_gap'
      AND rule_version=1
  )
  RETURNING id
)
SELECT COUNT(*) FROM inserted;

DO $$
DECLARE rule_row grc_gap_rules%ROWTYPE;
BEGIN
  SELECT * INTO rule_row
  FROM grc_gap_rules
  WHERE tenant_id IS NULL
    AND rule_code='observation.data_trust_attention_gap'
    AND rule_version=1;

  IF rule_row.id IS NULL THEN
    RAISE EXCEPTION 'F6.8-03 required gap rule is missing';
  END IF;
  IF rule_row.status <> 'published'
     OR rule_row.enabled IS DISTINCT FROM TRUE
     OR rule_row.rule_type <> 'deterministic'
     OR rule_row.input_observation_type <> 'official_calculation.data_trust_attention'
     OR rule_row.gap_type <> 'data_trust_attention'
     OR rule_row.metadata->>'owner' <> 'grc_gap_service'
     OR rule_row.metadata->>'ai_created' <> 'false' THEN
    RAISE EXCEPTION 'F6.8-03 required gap rule is incompatible';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.grc_observation_links') IS NOT NULL THEN
    RAISE EXCEPTION 'F6.8-03 refuses parallel observation relation table grc_observation_links';
  END IF;
  IF to_regclass('public.grc_observations') IS NULL OR to_regclass('public.grc_observation_relations') IS NULL THEN
    RAISE EXCEPTION 'F6.8-03 requires canonical observation tables before gap model bootstrap';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_semantic_observation_history'
      AND tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'F6.8-03 requires canonical observation history immutability trigger';
  END IF;
END $$;

COMMIT;
