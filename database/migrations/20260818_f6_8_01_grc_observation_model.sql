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

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_status_value
  ON grc_observations (tenant_id, status_value, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_source
  ON grc_observations (tenant_id, source_table, source_record_id);

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_severity
  ON grc_observations (tenant_id, severity_value, observed_at DESC);

WITH existing_contract AS (
  SELECT id
  FROM data_source_contracts
  WHERE tenant_id IS NULL
    AND source_code = 'grc.manual_observations'
  LIMIT 1
), inserted_contract AS (
  INSERT INTO data_source_contracts (
    tenant_id, source_code, display_name, entity_type, adapter_key, status, metadata
  )
  SELECT
    NULL,
    'grc.manual_observations',
    'GRC manual observations API',
    'grc_manual_observation',
    'grc_manual_observation_api',
    'published',
    '{"owner":"semantic_layer","purpose":"canonical provenance for manual GRC observation facade"}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM existing_contract)
  RETURNING id
), contract_row AS (
  SELECT id FROM inserted_contract
  UNION ALL
  SELECT id FROM existing_contract
), existing_version AS (
  SELECT version.id, version.contract_id
  FROM data_source_contract_versions version
  JOIN contract_row contract ON contract.id = version.contract_id
  WHERE version.version_number = 1
  LIMIT 1
), inserted_version AS (
  INSERT INTO data_source_contract_versions (
    contract_id, version_number, physical_tables, tenant_key_candidates,
    timestamp_candidates, required_fields, optional_fields, field_equivalences,
    unit_policy, period_policy, exclusion_policy, fallback_policy,
    minimum_coverage, status, valid_from, checksum, metadata
  )
  SELECT
    contract.id,
    1,
    '[{"table":"data_snapshots","role":"manual_observation_payload"}]'::jsonb,
    '["tenant_id"]'::jsonb,
    '["observed_at"]'::jsonb,
    '["observation_type","entity_type","observed_at","status_value","severity_value"]'::jsonb,
    '["period_start","period_end","numeric_value","text_value","boolean_value","unit","owner_user_id","evidence_id","metadata"]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{"source":"api_payload","observed_at":"required","period":"optional"}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    0,
    'published',
    now(),
    encode(digest('grc.manual_observations:v1:canonical-semantic-observation-facade', 'sha256'), 'hex'),
    '{"owner":"semantic_layer","append_only":true,"manual_api_facade":true}'::jsonb
  FROM contract_row contract
  WHERE NOT EXISTS (SELECT 1 FROM existing_version)
  RETURNING id, contract_id
), version_row AS (
  SELECT id, contract_id FROM inserted_version
  UNION ALL
  SELECT id, contract_id FROM existing_version
)
UPDATE data_source_contracts contract
SET current_version_id = version_row.id,
    status = 'published',
    updated_at = now(),
    metadata = contract.metadata || '{"owner":"semantic_layer","manual_api_facade":true}'::jsonb
FROM version_row
WHERE contract.id = version_row.contract_id
  AND contract.source_code = 'grc.manual_observations';

COMMIT;
