const assert = require('assert');
const {
  _private,
  actionPlanRuntimeProjection,
  insertActionPlan,
  updateActionPlan,
} = require('./actionPlanPersistence');

function fakeClient() {
  const calls = [];
  const physicalColumns = [
    'id',
    'tenant_id',
    'iso_code',
    'title',
    'status',
    'source_type',
    'source_id',
    'tenant_control_id',
    'finding_id',
    'nonconformity_id',
    'due_date',
    'completed_at',
    'created_at',
    'updated_at',
    'metadata',
  ];

  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params });
      if (String(sql).includes('information_schema.columns')) {
        return {
          rowCount: physicalColumns.length,
          rows: physicalColumns.map((column_name) => ({ column_name })),
        };
      }
      return { rowCount: 1, rows: [{ id: 'plan-1' }] };
    },
  };
}

async function run() {
  const client = fakeClient();

  await insertActionPlan(client, {
    tenant_id: 'tenant-1',
    iso_code: 'ISO27001',
    title: 'Plan canonico',
    description: 'Detalle sin columna legacy',
    priority: 'alta',
    owner: 'owner-1',
    status: 'abierto',
    source_type: 'control',
    source_id: 'control-1',
    metadata: { source: 'test' },
  });

  const insertCall = client.calls.find((call) => call.sql.includes('INSERT INTO action_plans'));
  assert.ok(insertCall, 'insert query should be issued');
  assert.match(insertCall.sql, /\btenant_id\b/);
  assert.match(insertCall.sql, /\bsource_id\b/);
  assert.match(insertCall.sql, /\bsource_type\b/);
  assert.doesNotMatch(insertCall.sql, /\bdescription\b/);
  assert.doesNotMatch(insertCall.sql, /\bpriority\b/);
  assert.doesNotMatch(insertCall.sql, /\bowner\b/);
  assert.match(insertCall.sql, /\bmetadata\b/);

  const insertMetadata = JSON.parse(insertCall.params[insertCall.params.length - 1]);
  assert.equal(insertMetadata.description, 'Detalle sin columna legacy');
  assert.equal(insertMetadata.priority, 'alta');
  assert.equal(insertMetadata.owner, 'owner-1');
  assert.equal(insertMetadata.source, 'test');

  await updateActionPlan(client, 'plan-1', {
    title: 'Plan actualizado',
    description: 'Detalle actualizado',
    priority: 'media',
    owner: 'owner-2',
    status: 'en progreso',
  }, { whereTenantId: 'tenant-1', returning: '*' });

  const updateCall = client.calls.find((call) => call.sql.includes('UPDATE action_plans'));
  assert.ok(updateCall, 'update query should be issued');
  assert.doesNotMatch(updateCall.sql, /\bdescription\s*=/);
  assert.doesNotMatch(updateCall.sql, /\bpriority\s*=/);
  assert.doesNotMatch(updateCall.sql, /\bowner\s*=/);
  assert.match(updateCall.sql, /metadata = COALESCE\(metadata, '\{\}'::jsonb\) \|\|/);

  await assert.rejects(
    () => insertActionPlan(client, {
      tenant_id: 'tenant-1',
      title: 'Typo',
      status: 'abierto',
      tenant_contol_id: 'control-typo',
    }),
    (error) => error.code === 'ACTION_PLAN_UNKNOWN_COLUMN' && error.field === 'tenant_contol_id'
  );

  await assert.rejects(
    () => updateActionPlan(client, 'plan-1', {
      source_typo: 'finding',
    }),
    (error) => error.code === 'ACTION_PLAN_UNKNOWN_COLUMN' && error.field === 'source_typo'
  );

  assert.equal(_private.assertKnownActionPlanField(new Set(['tenant_control_id']), 'tenant_control_id'), 'physical');
  assert.throws(
    () => _private.assertKnownActionPlanField(new Set(['metadata']), 'tenant_control_id'),
    (error) => error.code === 'ACTION_PLAN_REQUIRED_COLUMN_MISSING' && error.field === 'tenant_control_id'
  );
  assert.equal(_private.assertKnownActionPlanField(new Set(['description', 'metadata']), 'description'), 'physical');
  assert.equal(_private.assertKnownActionPlanField(new Set(['metadata']), 'description'), 'optional_metadata');
  assert.throws(
    () => _private.assertKnownActionPlanField(new Set(['metadata']), 'tenant_contol_id'),
    (error) => error.code === 'ACTION_PLAN_UNKNOWN_COLUMN' && error.field === 'tenant_contol_id'
  );
  assert.throws(
    () => _private.assertKnownActionPlanField(new Set(['metadata', 'rogue_physical_column']), 'rogue_physical_column'),
    (error) => error.code === 'ACTION_PLAN_UNKNOWN_COLUMN' && error.field === 'rogue_physical_column'
  );

  const projection = actionPlanRuntimeProjection('ap');
  assert.match(projection, /to_jsonb\(ap\)->>'description'/);
  assert.match(projection, /to_jsonb\(ap\)->>'priority'/);
  assert.match(projection, /to_jsonb\(ap\)->>'owner'/);
  assert.match(projection, /ap\.metadata/);
  assert.match(projection, /AS approval_status/);

  console.log('action plan persistence contract tests: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
