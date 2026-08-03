'use strict';

async function bootstrapSemanticRegistry(client, actor = null) {
  const insertedContracts = await client.query(`
    INSERT INTO data_source_contracts (
      tenant_id, source_code, display_name, entity_type, adapter_key, status,
      created_by, updated_by, metadata
    )
    SELECT DISTINCT
      source.tenant_id,
      source.source_code,
      initcap(replace(source.source_code, '_', ' ')),
      source.entity_name,
      'official_formula_source',
      'published',
      $1::uuid,
      $1::uuid,
      jsonb_build_object('bootstrap', 'official_formula_source_contracts')
    FROM official_formula_source_contracts source
    WHERE source.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM data_source_contracts target
        WHERE target.source_code = source.source_code
          AND target.tenant_id IS NOT DISTINCT FROM source.tenant_id
      )
    RETURNING id
  `, [actor]);

  const insertedVersions = await client.query(`
    INSERT INTO data_source_contract_versions (
      contract_id, version_number, physical_tables, allowed_joins, tenant_key_candidates,
      timestamp_candidates, required_fields, optional_fields, field_equivalences,
      unit_policy, period_policy, exclusion_policy, fallback_policy,
      minimum_coverage, status, checksum, created_by, reviewed_by, approved_by,
      published_by, reviewed_at, approved_at, published_at, metadata
    )
    SELECT
      target.id,
      source.version_number,
      source.tables,
      source.allowed_joins,
      COALESCE(source.tenant_filter->'columns', '["tenant_id"]'::jsonb),
      COALESCE(source.period_policy->'timestamp_candidates', '[]'::jsonb),
      source.required_fields,
      source.columns,
      '{}'::jsonb,
      jsonb_build_object('unit', source.unit),
      source.period_policy,
      source.exclusions,
      jsonb_build_object('null_policy', source.null_policy, 'availability', source.availability),
      COALESCE((source.metadata->>'minimum_coverage')::numeric, 0),
      'published',
      source.checksum,
      $1::uuid,
      $1::uuid,
      $1::uuid,
      $1::uuid,
      now(), now(), now(),
      jsonb_build_object('formula_code', source.formula_code, 'legacy_contract_id', source.id)
    FROM official_formula_source_contracts source
    JOIN data_source_contracts target
      ON target.source_code = source.source_code
     AND target.tenant_id IS NOT DISTINCT FROM source.tenant_id
    WHERE source.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM data_source_contract_versions version
        WHERE version.contract_id = target.id
          AND version.version_number = source.version_number
      )
    RETURNING id
  `, [actor]);

  await client.query(`
    UPDATE data_source_contracts contract
    SET current_version_id = (
          SELECT version.id
          FROM data_source_contract_versions version
          WHERE version.contract_id = contract.id AND version.status = 'published'
          ORDER BY version.version_number DESC
          LIMIT 1
        ),
        status = 'published',
        updated_at = now(),
        updated_by = COALESCE($1::uuid, contract.updated_by)
    WHERE contract.current_version_id IS DISTINCT FROM (
      SELECT version.id
      FROM data_source_contract_versions version
      WHERE version.contract_id = contract.id AND version.status = 'published'
      ORDER BY version.version_number DESC
      LIMIT 1
    )
  `, [actor]);

  const summary = await client.query(`
    SELECT
      COUNT(*)::int AS contracts,
      COUNT(*) FILTER (WHERE current_version_id IS NOT NULL)::int AS versioned,
      COUNT(*) FILTER (WHERE tenant_id IS NULL)::int AS global_contracts
    FROM data_source_contracts
  `);
  return {
    inserted_contracts: insertedContracts.rowCount,
    inserted_versions: insertedVersions.rowCount,
    ...summary.rows[0],
  };
}

module.exports = { bootstrapSemanticRegistry };
