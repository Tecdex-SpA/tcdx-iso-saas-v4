const assert = require('node:assert/strict');
const monteCarlo = require('./operationalRiskMonteCarlo.service');

function assertThrowsCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

function runTests() {
  const constant = monteCarlo.sampleBetaPert(3, 3, 3, 10000, () => 0.5);
  assert.equal(constant.length, 10000);
  assert.ok(constant.every((value) => value === 3));

  assertThrowsCode(
    () => monteCarlo.validatePertInput({ min: 5, mode: 4, max: 6 }, 'frecuencia'),
    'VALIDATION_ERROR'
  );

  assertThrowsCode(
    () => monteCarlo.validatePertInput({ min: 1, mode: 7, max: 6 }, 'frecuencia'),
    'VALIDATION_ERROR'
  );

  const simulation = monteCarlo.runIso27001OperationalSimulation({
    nombre_riesgo: 'Interrupcion de servicio critico',
    proceso_afectado: 'Continuidad operacional',
    frecuencia: { min: 1, mode: 3, max: 8 },
    impacto_operativo: { min: 2, mode: 5, max: 12, unidad: 'horas_por_evento' },
    umbral_disrupcion_critica_horas: 30,
    iteraciones: 10000,
    seed: 'unit-test-iso27001',
  });

  assert.equal(typeof simulation.summary.media_operativa_anual, 'number');
  assert.equal(typeof simulation.summary.peor_escenario_p95, 'number');
  assert.ok(simulation.summary.peor_escenario_p95 >= 0);
  assert.ok(simulation.summary.peor_escenario_p95 >= simulation.summary.media_operativa_anual);
  assert.ok(simulation.summary.probabilidad_disrupcion_critica >= 0);
  assert.ok(simulation.summary.probabilidad_disrupcion_critica <= 1);

  const recommendation = monteCarlo.buildRuleBasedRecommendation({
    norma_tipo: 'ISO9001',
    modelo_usado: 'ISO9001_COP_SIMPLE',
    nombre_riesgo: 'Errores de reproceso documental',
    proceso_afectado: 'Control documental',
    media_operativa_anual: 90,
    peor_escenario_p95: 160,
    probabilidad_disrupcion_critica: 0.35,
    umbral_disrupcion_critica_horas: 120,
  });

  assert.equal(recommendation.requiere_validacion_humana, true);
  assert.equal(recommendation.controles_sugeridos.length, 3);
  monteCarlo.assertNoFinancialLanguage(recommendation);

  const tenantA = { role: 'admin', tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  assertThrowsCode(
    () => monteCarlo.assertCanReadTenant(tenantA, tenantB),
    'TENANT_ACCESS_DENIED'
  );

  const viewer = { role: 'viewer', tenant_id: tenantA.tenant_id };
  assert.equal(monteCarlo.canReadOperationalRisk(viewer), true);
  assert.equal(monteCarlo.canCreateOperationalRisk(viewer), false);

  console.log('operationalRiskMonteCarlo.service tests OK');
}

runTests();
