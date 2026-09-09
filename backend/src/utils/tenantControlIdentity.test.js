const assert = require('assert');
const { resolveTenantControl, _private } = require('./tenantControlIdentity');

function fakeDb(resolver) {
  return {
    async query(sql, values = []) {
      return resolver(String(sql), values);
    },
  };
}

async function run() {
  const tenantId = '70000000-0000-0000-0000-000000000701';
  const catalogId = '70000000-0000-0000-0000-000000000901';
  const modernA = '70000000-0000-0000-0000-000000001001';
  const modernB = '70000000-0000-0000-0000-000000001002';
  const legacyId = '70000000-0000-0000-0000-000000002001';

  assert.equal(_private.pickUnambiguous([{ id: 1 }], 'strict').id, 1);
  assert.equal(_private.pickUnambiguous([], 'strict'), null);
  assert.equal(_private.pickUnambiguous([{ id: 1 }, { id: 2 }], 'strict').ambiguous, true);

  const strictDb = fakeDb((sql, values) => {
    if (sql.includes('WHERE tc.id = $1::uuid')) return { rows: [], rowCount: 0 };
    assert.doesNotMatch(sql, /FROM controls\b|JOIN controls\b/);
    if (sql.includes('FROM controls_catalog cc')) {
      assert.equal(values[0], catalogId);
      assert.equal(values[1], tenantId);
      return {
        rows: [
          {
            tenant_control_id_moderno: modernA,
            catalog_control_id: catalogId,
            operation_id: '70000000-0000-0000-0000-000000003001',
            operation_code: 'op-a',
            operation_name: 'Operacion A',
            iso: 'ISO9001',
          },
          {
            tenant_control_id_moderno: modernB,
            catalog_control_id: catalogId,
            operation_id: '70000000-0000-0000-0000-000000003002',
            operation_code: 'op-b',
            operation_name: 'Operacion B',
            iso: 'ISO9001',
          },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  });

  const ambiguous = await resolveTenantControl(strictDb, {
    tenantId,
    rawControlId: catalogId,
    isoCode: 'ISO9001',
    mode: 'strict',
  });

  assert.equal(ambiguous.ambiguous, true);
  assert.equal(ambiguous.candidate_count, 2);
  assert.deepEqual(
    ambiguous.candidates.map((candidate) => candidate.tenant_control_id_moderno),
    [modernA, modernB]
  );

  const modernDb = fakeDb((sql, values) => {
    if (sql.includes('WHERE tc.id = $1::uuid')) {
      assert.equal(values[0], modernA);
      assert.equal(values[1], tenantId);
      return {
          rows: [{
            tenant_control_id_moderno: modernA,
            catalog_control_id: catalogId,
            operation_id: '70000000-0000-0000-0000-000000003001',
            iso: 'ISO9001',
          identity_source: 'tenant_control',
        }],
        rowCount: 1,
      };
    }
    throw new Error('modern id resolution should not query legacy tables');
  });

  const modern = await resolveTenantControl(modernDb, {
    tenantId,
    rawControlId: modernA,
    isoCode: 'ISO9001',
  });

  assert.equal(modern.tenant_control_id_moderno, modernA);
  assert.equal(modern.identity_source, 'tenant_control');
  assert.equal(Object.prototype.hasOwnProperty.call(modern, 'controls_id_legacy'), false);

  const legacyUnsupportedDb = fakeDb((sql) => {
    assert.doesNotMatch(sql, /FROM controls\b|JOIN controls\b/);
    if (sql.includes('WHERE tc.id = $1::uuid')) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM controls_catalog cc')) return { rows: [], rowCount: 0 };
    throw new Error('unexpected SQL');
  });

  const legacyUnsupported = await resolveTenantControl(legacyUnsupportedDb, {
    tenantId,
    rawControlId: legacyId,
    isoCode: 'ISO9001',
  });
  assert.equal(legacyUnsupported, null);

  console.log('tenantControlIdentity tests: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
