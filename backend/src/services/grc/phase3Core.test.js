const assert = require('assert');
const { createPhase3Service, Phase3Error } = require('./phase3.service');
const { assertTransition, evaluatePhase3Rules } = require('./phase3Rules');
const phase3Router = require('../../routes/phase3.routes');

const TENANT = '70000000-0000-4000-8000-000000000701';

async function run() {
  assert.doesNotThrow(() => assertTransition('process', 'draft', 'under_review'));
  assert.throws(
    () => assertTransition('process', 'draft', 'active'),
    error => error.code === 'PHASE3_INVALID_TRANSITION'
  );

  const effects = evaluatePhase3Rules('continuity.test.failed', {
    target_rto_minutes: 60,
    observed_rto_minutes: 120,
    target_rpo_minutes: 15,
    observed_rpo_minutes: 30,
  });
  assert(effects.some(effect => effect.kind === 'alert' && effect.code === 'RTO_BREACHED'));
  assert(effects.some(effect => effect.kind === 'alert' && effect.code === 'RPO_BREACHED'));
  assert(effects.some(effect => (
    effect.kind === 'recommendation'
    && effect.explanation.includes('revisión humana')
  )));
  assert(!effects.some(effect => effect.kind === 'automatic_decision'));

  const { normalizePayload, validatePayloadIds, mapDatabaseError } = phase3Router._test;
  assert.deepStrictEqual(
    normalizePayload({
      process_id: '',
      service_id: ' null ',
      owner_user_id: 'undefined',
      code: ' PROC-001 ',
    }),
    { process_id: null, service_id: null, owner_user_id: null, code: 'PROC-001' }
  );
  assert.doesNotThrow(() => validatePayloadIds({ process_id: null }));
  assert.throws(
    () => validatePayloadIds({ process_id: 'PROC-001' }),
    error => error instanceof Phase3Error
      && error.code === 'PHASE3_UUID_INVALID'
      && error.details.field === 'process_id'
  );
  const duplicate = mapDatabaseError({ code: '23505', constraint: 'tenant_code_key' });
  assert(duplicate instanceof Phase3Error);
  assert.strictEqual(duplicate.status, 409);
  assert.strictEqual(duplicate.code, 'PHASE3_DUPLICATE');

  const readinessPool = {
    async query(sql, values) {
      assert(String(sql).includes('tenant_id=$1::uuid'));
      assert.strictEqual(values[0], TENANT);
      return {
        rowCount: 1,
        rows: [{
          units_configured: 1,
          processes_with_owner: 1,
          critical_processes_without_bia: 0,
          services_without_rto_rpo: 0,
          processes_without_plan: 0,
          plans_without_tests: 0,
          metrics_without_measurements: 0,
          pending_relations: 0,
          total_processes: 1,
          total_services: 1,
          total_metrics: 1,
          demo_records: 0,
          pending_operational_states: 0,
        }],
      };
    },
  };
  const service = createPhase3Service(readinessPool);
  const readiness = await service.activationReadiness(TENANT);
  assert.strictEqual(readiness.state, 'operativo');
  assert.strictEqual(readiness.ready_to_operate, true);
  assert.strictEqual(readiness.items.length, 8);

  const template = service.getImportTemplate('processes');
  assert.strictEqual(template.template_version, 'phase3-operational-v1');
  assert(template.content.includes('unit_code'));
  assert(template.content.includes('owner_email'));
  assert(!template.content.includes('organizational_unit_id'));
  assert.throws(
    () => service.getImportTemplate('crisis'),
    error => error instanceof Phase3Error && error.code === 'PHASE3_IMPORT_ENTITY_INVALID'
  );

  console.log('grc Phase 3 core tests: OK');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
