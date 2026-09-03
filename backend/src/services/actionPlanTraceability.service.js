const ACTIVE_CONTROL_REMEDIATION_STATUSES = Object.freeze([
  'abierto',
  'en progreso',
  'bloqueado',
]);

const PHASE2_ACTION_ORIGIN_TYPES = Object.freeze(['finding', 'nonconformity']);
const ACTION_ORIGIN_RELATION_TYPE = 'originates_action';

function isActiveControlRemediationStatus(status) {
  return ACTIVE_CONTROL_REMEDIATION_STATUSES.includes(String(status || ''));
}

async function upsertActionPlanOriginRelation(client, {
  tenantId,
  originType,
  originId,
  actionPlanId,
  createdBy = null,
  provenance = {},
}) {
  if (!tenantId || !originId || !actionPlanId) return null;

  const normalizedOriginType = String(originType || '').trim();
  if (!PHASE2_ACTION_ORIGIN_TYPES.includes(normalizedOriginType)) return null;

  const result = await client.query(
    `
    INSERT INTO grc_phase2_relations (
      tenant_id,
      source_type,
      source_id,
      target_type,
      target_id,
      relation_type,
      status,
      provenance,
      confidence,
      created_by
    )
    SELECT
      $1::uuid,
      $2,
      $3::uuid,
      'action',
      ap.id,
      $5,
      'active',
      $6::jsonb,
      100,
      $7::uuid
    FROM action_plans ap
    WHERE ap.tenant_id = $1::uuid
      AND ap.id = $4::uuid
      AND (
        (
          $2 = 'finding'
          AND EXISTS (
            SELECT 1
            FROM findings f
            WHERE f.tenant_id = $1::uuid
              AND f.id = $3::uuid
          )
        )
        OR (
          $2 = 'nonconformity'
          AND EXISTS (
            SELECT 1
            FROM tenant_nonconformities nc
            WHERE nc.tenant_id = $1::uuid
              AND nc.id = $3::uuid
          )
        )
      )
    ON CONFLICT (
      tenant_id,
      source_type,
      source_id,
      target_type,
      target_id,
      relation_type,
      version
    )
    DO UPDATE SET
      status = 'active',
      valid_to = NULL,
      provenance = grc_phase2_relations.provenance || EXCLUDED.provenance,
      updated_at = NOW()
    RETURNING *
    `,
    [
      tenantId,
      normalizedOriginType,
      originId,
      actionPlanId,
      ACTION_ORIGIN_RELATION_TYPE,
      JSON.stringify({
        source: 'action_traceability_reuse',
        ...provenance,
      }),
      createdBy,
    ]
  );

  return result.rows[0] || null;
}

async function listActionPlanOriginRelations(client, tenantId, actionPlanId) {
  if (!tenantId || !actionPlanId) return [];

  const result = await client.query(
    `
    SELECT
      source_type,
      source_id,
      target_type,
      target_id,
      relation_type,
      status,
      provenance
    FROM grc_phase2_relations
    WHERE tenant_id = $1::uuid
      AND target_type = 'action'
      AND target_id = $2::uuid
      AND relation_type = $3
      AND status = 'active'
      AND valid_to IS NULL
    ORDER BY source_type, source_id
    `,
    [tenantId, actionPlanId, ACTION_ORIGIN_RELATION_TYPE]
  );

  return result.rows;
}

module.exports = {
  ACTION_ORIGIN_RELATION_TYPE,
  ACTIVE_CONTROL_REMEDIATION_STATUSES,
  PHASE2_ACTION_ORIGIN_TYPES,
  isActiveControlRemediationStatus,
  listActionPlanOriginRelations,
  upsertActionPlanOriginRelation,
};
