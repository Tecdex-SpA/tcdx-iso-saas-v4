-- TCDX ISO SaaS v4 - F6.8-01-HF2 manual observation semantic contract bootstrap.
-- Forward migration for the global canonical contract used by the GRC observation facade.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  global_contracts integer;
  tenant_contracts integer;
BEGIN
  SELECT COUNT(*)::int
    INTO global_contracts
  FROM data_source_contracts
  WHERE tenant_id IS NULL
    AND source_code = 'grc.manual_observations';

  IF global_contracts > 1 THEN
    RAISE EXCEPTION 'F6.8-01-HF2 duplicate global grc.manual_observations contracts: %', global_contracts;
  END IF;

  SELECT COUNT(*)::int
    INTO tenant_contracts
  FROM data_source_contracts
  WHERE tenant_id IS NOT NULL
    AND source_code = 'grc.manual_observations';

  IF tenant_contracts > 0 THEN
    RAISE EXCEPTION 'F6.8-01-HF2 tenant-specific grc.manual_observations contracts are not allowed: %', tenant_contracts;
  END IF;
END $$;

WITH inserted_contract AS (
  INSERT INTO data_source_contracts (
    tenant_id,
    source_code,
    display_name,
    entity_type,
    adapter_key,
    status,
    metadata
  )
  SELECT
    NULL::uuid,
    'grc.manual_observations',
    'GRC manual observations API',
    'grc_manual_observation',
    'grc_manual_observation_api',
    'published',
    '{"owner":"semantic_layer","purpose":"canonical provenance for manual GRC observation facade"}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM data_source_contracts
    WHERE tenant_id IS NULL
      AND source_code = 'grc.manual_observations'
  )
  RETURNING id
)
SELECT COUNT(*) FROM inserted_contract;

DO $$
DECLARE
  contract_row data_source_contracts%ROWTYPE;
  version_count integer;
BEGIN
  SELECT *
    INTO contract_row
  FROM data_source_contracts
  WHERE tenant_id IS NULL
    AND source_code = 'grc.manual_observations';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'F6.8-01-HF2 grc.manual_observations contract bootstrap failed';
  END IF;

  IF contract_row.display_name <> 'GRC manual observations API'
     OR contract_row.entity_type <> 'grc_manual_observation'
     OR contract_row.adapter_key <> 'grc_manual_observation_api'
     OR contract_row.status NOT IN ('published','approved','reviewed','draft')
     OR contract_row.metadata->>'owner' IS DISTINCT FROM 'semantic_layer'
     OR contract_row.metadata->>'purpose' IS DISTINCT FROM 'canonical provenance for manual GRC observation facade' THEN
    RAISE EXCEPTION 'F6.8-01-HF2 incompatible grc.manual_observations contract id=%', contract_row.id;
  END IF;

  SELECT COUNT(*)::int
    INTO version_count
  FROM data_source_contract_versions
  WHERE contract_id = contract_row.id
    AND version_number = 1;

  IF version_count > 1 THEN
    RAISE EXCEPTION 'F6.8-01-HF2 duplicate grc.manual_observations v1 rows for contract id=%', contract_row.id;
  END IF;
END $$;

WITH manual_contract AS (
  SELECT id
  FROM data_source_contracts
  WHERE tenant_id IS NULL
    AND source_code = 'grc.manual_observations'
),
inserted_version AS (
  INSERT INTO data_source_contract_versions (
    contract_id,
    version_number,
    physical_tables,
    allowed_joins,
    tenant_key_candidates,
    timestamp_candidates,
    required_fields,
    optional_fields,
    field_equivalences,
    unit_policy,
    period_policy,
    exclusion_policy,
    fallback_policy,
    minimum_coverage,
    status,
    valid_from,
    checksum,
    metadata
  )
  SELECT
    manual_contract.id,
    1,
    '[{"table":"data_snapshots","role":"manual_observation_payload"}]'::jsonb,
    '[]'::jsonb,
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
  FROM manual_contract
  WHERE NOT EXISTS (
    SELECT 1
    FROM data_source_contract_versions version
    WHERE version.contract_id = manual_contract.id
      AND version.version_number = 1
  )
  RETURNING id
)
SELECT COUNT(*) FROM inserted_version;

DO $$
DECLARE
  contract_row data_source_contracts%ROWTYPE;
  version_row data_source_contract_versions%ROWTYPE;
  expected_checksum text := encode(digest('grc.manual_observations:v1:canonical-semantic-observation-facade', 'sha256'), 'hex');
BEGIN
  SELECT *
    INTO contract_row
  FROM data_source_contracts
  WHERE tenant_id IS NULL
    AND source_code = 'grc.manual_observations';

  SELECT *
    INTO version_row
  FROM data_source_contract_versions
  WHERE contract_id = contract_row.id
    AND version_number = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'F6.8-01-HF2 grc.manual_observations v1 bootstrap failed for contract id=%', contract_row.id;
  END IF;

  IF version_row.physical_tables <> '[{"role":"manual_observation_payload","table":"data_snapshots"}]'::jsonb
     OR version_row.allowed_joins <> '[]'::jsonb
     OR version_row.tenant_key_candidates <> '["tenant_id"]'::jsonb
     OR version_row.timestamp_candidates <> '["observed_at"]'::jsonb
     OR version_row.required_fields <> '["observation_type","entity_type","observed_at","status_value","severity_value"]'::jsonb
     OR version_row.optional_fields <> '["period_start","period_end","numeric_value","text_value","boolean_value","unit","owner_user_id","evidence_id","metadata"]'::jsonb
     OR version_row.field_equivalences <> '{}'::jsonb
     OR version_row.unit_policy <> '{}'::jsonb
     OR version_row.period_policy <> '{"source":"api_payload","period":"optional","observed_at":"required"}'::jsonb
     OR version_row.exclusion_policy <> '[]'::jsonb
     OR version_row.fallback_policy <> '{}'::jsonb
     OR version_row.minimum_coverage <> 0
     OR version_row.status <> 'published'
     OR version_row.checksum <> expected_checksum
     OR version_row.metadata->>'owner' IS DISTINCT FROM 'semantic_layer'
     OR version_row.metadata->>'append_only' IS DISTINCT FROM 'true'
     OR version_row.metadata->>'manual_api_facade' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'F6.8-01-HF2 incompatible grc.manual_observations v1 id=%', version_row.id;
  END IF;
END $$;

WITH manual_v1 AS (
  SELECT contract.id AS contract_id, version.id AS version_id
  FROM data_source_contracts contract
  JOIN data_source_contract_versions version
    ON version.contract_id = contract.id
   AND version.version_number = 1
   AND version.status = 'published'
  WHERE contract.tenant_id IS NULL
    AND contract.source_code = 'grc.manual_observations'
)
UPDATE data_source_contracts contract
SET current_version_id = manual_v1.version_id,
    status = 'published',
    metadata = contract.metadata || '{"owner":"semantic_layer","purpose":"canonical provenance for manual GRC observation facade"}'::jsonb,
    updated_at = now()
FROM manual_v1
WHERE contract.id = manual_v1.contract_id
  AND (
    contract.current_version_id IS DISTINCT FROM manual_v1.version_id
    OR contract.status IS DISTINCT FROM 'published'
    OR contract.metadata->>'owner' IS DISTINCT FROM 'semantic_layer'
    OR contract.metadata->>'purpose' IS DISTINCT FROM 'canonical provenance for manual GRC observation facade'
  );

DO $$
DECLARE
  duplicate_global_contract integer;
  orphan_contract_version integer;
  current_version_mismatch integer;
  contract_count integer;
  version_count integer;
BEGIN
  SELECT COUNT(*)::int
    INTO contract_count
  FROM data_source_contracts
  WHERE tenant_id IS NULL
    AND source_code = 'grc.manual_observations'
    AND status = 'published';

  IF contract_count <> 1 THEN
    RAISE EXCEPTION 'F6.8-01-HF2 expected exactly one published global grc.manual_observations contract, found %', contract_count;
  END IF;

  SELECT COUNT(*)::int
    INTO version_count
  FROM data_source_contract_versions version
  JOIN data_source_contracts contract ON contract.id = version.contract_id
  WHERE contract.tenant_id IS NULL
    AND contract.source_code = 'grc.manual_observations'
    AND version.version_number = 1
    AND version.status = 'published';

  IF version_count <> 1 THEN
    RAISE EXCEPTION 'F6.8-01-HF2 expected exactly one published grc.manual_observations v1, found %', version_count;
  END IF;

  SELECT GREATEST(COUNT(*)::int - 1, 0)
    INTO duplicate_global_contract
  FROM data_source_contracts
  WHERE tenant_id IS NULL
    AND source_code = 'grc.manual_observations';

  SELECT COUNT(*)::int
    INTO orphan_contract_version
  FROM data_source_contract_versions version
  LEFT JOIN data_source_contracts contract ON contract.id = version.contract_id
  WHERE version.version_number = 1
    AND contract.id IS NULL;

  SELECT COUNT(*)::int
    INTO current_version_mismatch
  FROM data_source_contracts contract
  JOIN data_source_contract_versions version
    ON version.contract_id = contract.id
   AND version.version_number = 1
   AND version.status = 'published'
  WHERE contract.tenant_id IS NULL
    AND contract.source_code = 'grc.manual_observations'
    AND contract.current_version_id IS DISTINCT FROM version.id;

  IF duplicate_global_contract <> 0
     OR orphan_contract_version <> 0
     OR current_version_mismatch <> 0 THEN
    RAISE EXCEPTION 'F6.8-01-HF2 integrity failed duplicate_global_contract=%, orphan_contract_version=%, current_version_mismatch=%',
      duplicate_global_contract, orphan_contract_version, current_version_mismatch;
  END IF;
END $$;

COMMIT;
