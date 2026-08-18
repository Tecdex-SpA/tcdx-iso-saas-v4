-- TCDX ISO SaaS v4 - F6.8-01 GRC Observation Model
-- Additive, tenant-scoped, no demo data, no source/formula payload changes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('observation.read', 'observation', 'Consultar observaciones GRC', 'Consulta observaciones GRC tenant-scoped y su provenance.'),
  ('observation.manage', 'observation', 'Administrar observaciones GRC', 'Crea y actualiza observaciones GRC canónicas.'),
  ('observation.transition', 'observation', 'Transicionar observaciones GRC', 'Ejecuta cambios de estado del lifecycle de observaciones.'),
  ('observation.link', 'observation', 'Relacionar observaciones GRC', 'Vincula observaciones con objetos GRC del mismo tenant.')
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
  AND p.permission_key LIKE 'observation.%'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key = 'auditor'
  AND p.permission_key IN ('observation.read', 'observation.manage', 'observation.transition', 'observation.link')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('operativo', 'responsable_area', 'area_owner')
  AND p.permission_key IN ('observation.read', 'observation.transition')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

CREATE TABLE IF NOT EXISTS grc_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  observation_key text NOT NULL,
  observation_hash text NOT NULL,
  observation_code text NOT NULL DEFAULT ('OBS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  observation_type text NOT NULL,
  domain text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  severity text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  source_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL,
  effective_from timestamptz,
  effective_to timestamptz,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  responsible_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grc_observations_type_check CHECK (
    observation_type IN (
      'observation','finding','nonconformity','deviation','control_weakness','gap',
      'exception','improvement_opportunity','evidence_issue','compliance_issue',
      'risk_condition','general','custom'
    )
  ),
  CONSTRAINT grc_observations_domain_check CHECK (
    domain IN ('audit','risk','control','compliance','evidence','incident','readiness','assessment','action','data_quality','general')
  ),
  CONSTRAINT grc_observations_status_check CHECK (
    status IN ('open','under_review','accepted','in_treatment','resolved','closed','cancelled')
  ),
  CONSTRAINT grc_observations_severity_check CHECK (
    severity IN ('informational','low','medium','high','critical')
  ),
  CONSTRAINT grc_observations_source_type_check CHECK (
    source_type IN (
      'manual','finding','action','audit','control','risk','evidence','document',
      'incident','readiness_snapshot','readiness_finding','nonconformity',
      'metric_measurement','assessment'
    )
  ),
  CONSTRAINT grc_observations_manual_source_check CHECK (
    (source_type = 'manual' AND source_id IS NULL)
    OR
    (source_type <> 'manual' AND source_id IS NOT NULL)
  ),
  CONSTRAINT grc_observations_effective_interval_check CHECK (
    effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to
  ),
  UNIQUE (tenant_id, observation_key),
  UNIQUE (tenant_id, observation_code)
);

CREATE TABLE IF NOT EXISTS grc_observation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  observation_id uuid NOT NULL REFERENCES grc_observations(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  relation_type text NOT NULL DEFAULT 'relates_to',
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grc_observation_links_target_type_check CHECK (
    target_type IN (
      'finding','action','audit','control','risk','evidence','document','incident',
      'readiness_snapshot','readiness_finding','nonconformity','metric_measurement','assessment'
    )
  ),
  CONSTRAINT grc_observation_links_relation_type_check CHECK (
    relation_type IN ('relates_to','evidence_for','impacts','caused_by','mitigated_by','duplicates','remediated_by','blocks')
  ),
  CONSTRAINT grc_observation_links_source_check CHECK (
    source IN ('manual','system','import','ai_suggested')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grc_observation_links_active
  ON grc_observation_links (tenant_id, observation_id, target_type, target_id, relation_type)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_status
  ON grc_observations (tenant_id, status, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_source
  ON grc_observations (tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_domain
  ON grc_observations (tenant_id, domain, observation_type);

CREATE INDEX IF NOT EXISTS idx_grc_observation_links_target
  ON grc_observation_links (tenant_id, target_type, target_id);

CREATE OR REPLACE FUNCTION grc_touch_observation_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grc_observations_touch_updated_at') THEN
    CREATE TRIGGER trg_grc_observations_touch_updated_at
    BEFORE UPDATE ON grc_observations
    FOR EACH ROW EXECUTE FUNCTION grc_touch_observation_updated_at();
  END IF;
END $$;

COMMIT;
