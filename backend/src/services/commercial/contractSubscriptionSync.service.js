'use strict';

const { normalizeCommercialPlanKey } = require('./commercialPlanModel.service');

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSubscriptionStatus(contractStatus) {
  const status = normalizeKey(contractStatus);
  if (status === 'trial' || status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'suspended' || status === 'suspended_non_payment') return 'suspended';
  if (['cancelled', 'canceled', 'terminated', 'decontracted', 'inactive', 'expired', 'demo_expired'].includes(status)) {
    return 'cancelled';
  }
  return 'active';
}

function contractMetadata({ contract, actorUserId, requestId }) {
  return {
    source: 'tenant_contracts_auto_sync',
    tenant_contract_id: contract.id || null,
    legacy_plan_key: contract.plan_key || null,
    synced_by: actorUserId || null,
    synced_at: new Date().toISOString(),
    request_id: requestId || null,
  };
}

async function getPublishedPlanVersion(client, planKey) {
  const normalizedPlanKey = normalizeCommercialPlanKey(planKey, 'legacy') || 'legacy';
  const result = await client.query(
    `
    SELECT id, plan_key
    FROM commercial_plan_versions
    WHERE status = 'published'
      AND plan_key IN ($1::text, 'legacy')
    ORDER BY
      CASE WHEN plan_key = $1::text THEN 0 ELSE 1 END,
      version_number DESC,
      effective_from DESC NULLS LAST,
      created_at DESC NULLS LAST
    LIMIT 1
    `,
    [normalizedPlanKey]
  );

  return result.rows[0] || null;
}

async function syncTenantContractSubscription(client, { tenantId, contract, actorUserId = null, requestId = null } = {}) {
  if (!tenantId || !contract) {
    return { synced: false, reason: 'missing_contract_context' };
  }

  const planVersion = await getPublishedPlanVersion(client, contract.plan_key);
  if (!planVersion) {
    const error = new Error(`No published commercial plan version found for ${contract.plan_key || 'legacy'}`);
    error.code = 'COMMERCIAL_PLAN_VERSION_NOT_FOUND';
    error.status = 409;
    throw error;
  }

  const targetStatus = normalizeSubscriptionStatus(contract.contract_status);
  const metadata = contractMetadata({ contract, actorUserId, requestId });
  const startedAt = contract.started_at || null;
  const endedAt = contract.ends_at || null;

  const currentResult = await client.query(
    `
    SELECT *
    FROM tenant_subscriptions
    WHERE tenant_id = $1::uuid
      AND status IN ('active', 'trialing', 'past_due', 'suspended')
    ORDER BY started_at DESC, created_at DESC
    LIMIT 1
    FOR UPDATE
    `,
    [tenantId]
  );
  const current = currentResult.rows[0] || null;

  if (current && String(current.plan_version_id) === String(planVersion.id)) {
    const updated = await client.query(
      `
      UPDATE tenant_subscriptions
      SET
        plan_key = $3::text,
        status = $4::text,
        started_at = COALESCE($5::timestamptz, started_at),
        ended_at = $6::timestamptz,
        metadata = COALESCE(metadata, '{}'::jsonb) || $7::jsonb,
        updated_at = now()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      RETURNING *
      `,
      [
        current.id,
        tenantId,
        planVersion.plan_key,
        targetStatus,
        startedAt,
        endedAt,
        JSON.stringify(metadata),
      ]
    );

    return {
      synced: true,
      action: 'updated_current_subscription',
      subscription: updated.rows[0] || null,
    };
  }

  if (!current) {
    const existingSynced = await client.query(
      `
      SELECT *
      FROM tenant_subscriptions
      WHERE tenant_id = $1::uuid
        AND plan_version_id = $2::uuid
        AND status = $3::text
        AND metadata->>'tenant_contract_id' = $4::text
      ORDER BY started_at DESC, created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [tenantId, planVersion.id, targetStatus, String(contract.id || '')]
    );

    if (existingSynced.rowCount > 0) {
      return {
        synced: true,
        action: 'already_synced',
        subscription: existingSynced.rows[0],
      };
    }
  }

  if (current) {
    await client.query(
      `
      UPDATE tenant_subscriptions
      SET
        status = 'replaced',
        ended_at = COALESCE($2::timestamptz, now()),
        metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
        updated_at = now()
      WHERE tenant_id = $1::uuid
        AND status IN ('active', 'trialing', 'past_due', 'suspended')
      `,
      [
        tenantId,
        endedAt,
        JSON.stringify({
          replaced_by: 'tenant_contracts_auto_sync',
          tenant_contract_id: contract.id || null,
          request_id: requestId || null,
        }),
      ]
    );
  }

  const inserted = await client.query(
    `
    INSERT INTO tenant_subscriptions (
      tenant_id,
      plan_version_id,
      plan_key,
      status,
      started_at,
      ended_at,
      created_by,
      metadata
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::text,
      $4::text,
      COALESCE($5::timestamptz, now()),
      $6::timestamptz,
      $7::uuid,
      $8::jsonb
    )
    RETURNING *
    `,
    [
      tenantId,
      planVersion.id,
      planVersion.plan_key,
      targetStatus,
      startedAt,
      endedAt,
      actorUserId || null,
      JSON.stringify(metadata),
    ]
  );

  return {
    synced: true,
    action: current ? 'replaced_and_inserted_subscription' : 'inserted_subscription',
    subscription: inserted.rows[0] || null,
  };
}

module.exports = {
  normalizeSubscriptionStatus,
  syncTenantContractSubscription,
};
