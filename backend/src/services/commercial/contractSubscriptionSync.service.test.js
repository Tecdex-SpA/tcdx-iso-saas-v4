'use strict';

const assert = require('node:assert/strict');
const {
  normalizeSubscriptionStatus,
  syncTenantContractSubscription,
} = require('./contractSubscriptionSync.service');

const tenantId = '70000000-0000-0000-0000-000000000701';
const actorUserId = '80000000-0000-0000-0000-000000000801';
const planVersion = {
  id: '90000000-0000-0000-0000-000000000901',
  plan_key: 'pyme',
};

function rows(value) {
  return { rows: value, rowCount: value.length };
}

function fakeClient({ current = null, existingSynced = null, currentAddons = [] } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      const text = sql.replace(/\s+/g, ' ').trim();
      calls.push({ text, params });

      if (/FROM commercial_plan_versions/i.test(text)) {
        return rows([{
          id: params[0] === 'pyme' ? planVersion.id : '90000000-0000-0000-0000-000000000902',
          plan_key: params[0],
        }]);
      }

      if (/metadata->>'tenant_contract_id'/i.test(text)) {
        return rows(existingSynced ? [existingSynced] : []);
      }

      if (/FROM tenant_subscriptions/i.test(text) && /status IN/i.test(text) && /FOR UPDATE/i.test(text)) {
        return rows(current ? [current] : []);
      }

      if (/UPDATE tenant_subscriptions SET plan_key/i.test(text)) {
        return rows([{
          ...(current || {}),
          id: current?.id || '91000000-0000-0000-0000-000000000910',
          plan_version_id: params[1],
          plan_key: params[2],
          status: params[3],
        }]);
      }

      if (/UPDATE tenant_subscriptions SET status = 'replaced'/i.test(text)) {
        return rows([]);
      }

      if (/INSERT INTO tenant_subscriptions/i.test(text)) {
        return rows([{
          id: '92000000-0000-0000-0000-000000000920',
          tenant_id: params[0],
          plan_version_id: params[1],
          plan_key: params[2],
          status: params[3],
        }]);
      }

      if (/FROM tenant_subscription_addons/i.test(text) && /FOR UPDATE/i.test(text)) {
        return rows(currentAddons);
      }

      if (/INSERT INTO tenant_subscription_addons/i.test(text)) {
        return rows([{
          tenant_subscription_id: params[0],
          addon_key: params[1],
          status: params[2],
          started_at: params[3],
          ended_at: params[4],
        }]);
      }

      throw new Error(`Unexpected SQL in test: ${text}`);
    },
  };
}

async function run() {
  assert.equal(normalizeSubscriptionStatus('trial'), 'trialing');
  assert.equal(normalizeSubscriptionStatus('active'), 'active');
  assert.equal(normalizeSubscriptionStatus('suspended_non_payment'), 'suspended');
  assert.equal(normalizeSubscriptionStatus('cancelled'), 'cancelled');
  assert.equal(normalizeSubscriptionStatus('unexpected'), 'active');

  const contract = {
    id: '93000000-0000-0000-0000-000000000930',
    plan_key: 'pyme',
    contract_status: 'active',
    started_at: '2026-08-01',
    ends_at: '2027-08-01',
  };

  const insertClient = fakeClient();
  const inserted = await syncTenantContractSubscription(insertClient, {
    tenantId,
    contract,
    actorUserId,
    requestId: 'contract-sync-insert',
  });
  assert.equal(inserted.action, 'inserted_subscription');
  assert.equal(inserted.subscription.status, 'active');
  assert.equal(inserted.subscription.plan_key, 'pyme');
  assert.equal(insertClient.calls.find((call) => /FROM commercial_plan_versions/i.test(call.text))?.params[0], 'pyme');
  assert.equal(insertClient.calls.some((call) => /INSERT INTO tenant_subscriptions/i.test(call.text)), true);

  const aliasClient = fakeClient();
  const aliasInserted = await syncTenantContractSubscription(aliasClient, {
    tenantId,
    contract: { ...contract, plan_key: 'ISO + Riesgo Operativo' },
    actorUserId,
    requestId: 'contract-sync-plan-alias',
  });
  assert.equal(aliasInserted.action, 'inserted_subscription');
  assert.equal(aliasInserted.subscription.plan_key, 'empresa');
  assert.equal(aliasClient.calls.find((call) => /FROM commercial_plan_versions/i.test(call.text))?.params[0], 'empresa');

  const current = {
    id: '94000000-0000-0000-0000-000000000940',
    tenant_id: tenantId,
    plan_version_id: planVersion.id,
    plan_key: 'pyme',
    status: 'trialing',
  };
  const updateClient = fakeClient({ current });
  const updated = await syncTenantContractSubscription(updateClient, {
    tenantId,
    contract: { ...contract, contract_status: 'active' },
    actorUserId,
    requestId: 'contract-sync-update',
  });
  assert.equal(updated.action, 'updated_current_subscription');
  assert.equal(updated.subscription.status, 'active');
  assert.equal(updateClient.calls.some((call) => /UPDATE tenant_subscriptions SET plan_key/i.test(call.text)), true);
  assert.equal(updateClient.calls.some((call) => /INSERT INTO tenant_subscriptions/i.test(call.text)), false);

  const replacedCurrent = {
    ...current,
    plan_version_id: '95000000-0000-0000-0000-000000000950',
    plan_key: 'legacy',
  };
  const replaceClient = fakeClient({
    current: replacedCurrent,
    currentAddons: [{
      addon_key: 'ai',
      status: 'active',
      started_at: '2026-08-01T00:00:00.000Z',
      ended_at: null,
      created_by: actorUserId,
    }],
  });
  const replaced = await syncTenantContractSubscription(replaceClient, {
    tenantId,
    contract,
    actorUserId,
    requestId: 'contract-sync-replace',
  });
  assert.equal(replaced.action, 'replaced_and_inserted_subscription');
  assert.deepEqual(replaced.copied_addons.map((addon) => addon.addon_key), ['ai']);
  assert.equal(replaceClient.calls.some((call) => /UPDATE tenant_subscriptions SET status = 'replaced'/i.test(call.text)), true);
  assert.equal(replaceClient.calls.some((call) => /INSERT INTO tenant_subscriptions/i.test(call.text)), true);
  assert.equal(replaceClient.calls.some((call) => /INSERT INTO tenant_subscription_addons/i.test(call.text)), true);
}

run()
  .then(() => {
    process.stdout.write('CONTRACT_SUBSCRIPTION_SYNC_TEST_PASS\n');
  })
  .catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exit(1);
  });
