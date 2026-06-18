const assert = require('node:assert/strict');
const monteCarlo = require('./operationalRiskMonteCarlo.service');
const operationalRiskAi = require('./operationalRiskAi.service');

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

  assertThrowsCode(
    () => operationalRiskAi.normalizeAiPayload({ risks: [] }),
    'ai_invalid_payload'
  );

  const aiPayload = operationalRiskAi.normalizeAiPayload({
    scope: 'portfolio',
    kpis: {
      exposureExpectedAccumulated: 45,
      conservativeP95: 120,
      criticalProbabilityAverage: 0.22,
      highPrioritizedRisks: 2,
    },
    risks: [
      {
        id: 'simulation-1',
        name: 'Caida de servicio critico',
        standard: 'ISO27001',
        process: 'Continuidad operacional',
        expectedAnnualExposure: 45,
        p95: 120,
        criticalProbability: 0.22,
        status: 'alto',
        probabilityScore: 3,
        impactScore: 5,
        frequency: { min: 1, mode: 3, max: 6 },
        impact: { min: 8, mode: 24, max: 72 },
      },
    ],
  });
  assert.equal(aiPayload.risks.length, 1);
  assert.equal(aiPayload.methodology.conservativeP95, 'SUM(peor_escenario_p95)');

  const duplicatedRisks = Array.from({ length: 12 }, (_, index) => ({
    id: `risk-${index}`,
    name: index % 2 === 0 ? 'Riesgo duplicado' : `Riesgo ${index}`,
    standard: 'ISO27001',
    model: 'ISO27001_TTIA',
    process: index % 2 === 0 ? 'Continuidad' : `Proceso ${index}`,
    expectedAnnualExposure: index * 3.12345,
    p95: index * 15.98765,
    criticalProbability: index / 20,
    status: index > 8 ? 'alto' : 'medio',
    frequency: { min: 1, mode: 2, max: 3 },
    impact: { min: 2, mode: 4, max: 6 },
  }));
  const compactPayload = operationalRiskAi.normalizeAiPayload({
    risks: duplicatedRisks,
    selectedRisk: duplicatedRisks[0],
  });
  assert.ok(compactPayload.risks.length <= 8);
  assert.equal(compactPayload.risks[0].id, 'risk-0');
  assert.equal(compactPayload.risks.filter((risk) => risk.name === 'Riesgo duplicado').length, 1);
  assert.equal(compactPayload.risks[0].expectedAnnualExposure, 0);

  const prompt = operationalRiskAi.buildOperationalAiPrompt(aiPayload);
  assert.ok(prompt.includes(operationalRiskAi.PROMPT_VERSION));
  assert.ok(prompt.includes('No afirmes P95 de portafolio'));

  const disabled = operationalRiskAi.classifyAiEngineResult({
    ok: false,
    disabled_by_plan: true,
    engine: { ai_disabled_reason: 'ai_feature_disabled' },
  });
  assert.equal(disabled.code, 'ai_feature_not_enabled');
  assert.equal(disabled.status, 403);

  const unconfigured = operationalRiskAi.classifyAiEngineResult({
    ok: false,
    engine: {
      ai_engine_used: false,
      fallback_used: true,
      error_type: 'AI_ENGINE_UNAVAILABLE',
      error_message: 'AI_ENGINE_URL o AI_INTERNAL_TOKEN no configurado',
    },
  });
  assert.equal(unconfigured.code, 'ai_engine_unconfigured');

  const normalizedAi = operationalRiskAi.normalizeOperationalAiAnalysis({
    ok: true,
    request_id: 'req-1',
    engine: { ai_engine_used: true, selected_model: 'gpt-test' },
    structured_result: {
      diagnostico_ejecutivo: 'Exposicion operacional alta con concentracion en continuidad.',
      riesgos_prioritarios: [{ nombre: 'Caida de servicio critico', motivo: 'P95 alto', prioridad: 'alta' }],
      acciones_sugeridas: [{ accion: 'Probar recuperacion y reforzar monitoreo.', horizonte: '30_dias' }],
      controles_iso_sugeridos: [{ norma: 'ISO27001', control_o_clausula: 'A.5.30', descripcion: 'Preparacion TIC para continuidad.' }],
      advertencias_metodologicas: ['P95 conservador no es P95 de portafolio.'],
      proximos_pasos: ['Validar owner y umbral operativo.'],
      efectividad_estimada_pct: 35,
    },
  }, aiPayload);
  assert.equal(normalizedAi.guardable, true);
  assert.equal(normalizedAi.ai_model, 'gpt-test');
  assert.equal(normalizedAi.prompt_version, operationalRiskAi.PROMPT_VERSION);
  assert.equal(normalizedAi.source, 'ai-engine-operational-beta-pert');
  assert.equal(normalizedAi.generation_mode, 'semantic_plus_llm');

  const wrapperAi = operationalRiskAi.normalizeOperationalAiAnalysis({
    ok: true,
    engine: { ai_engine_used: true, selected_model: 'qwen2.5:3b' },
    result: {
      content: {
        diagnostico_ejecutivo: 'Lectura ejecutiva valida.',
        acciones_sugeridas: [{ accion: 'Reducir recurrencia.', horizonte: '30_dias' }],
      },
    },
  }, aiPayload);
  assert.equal(wrapperAi.ai_model, 'qwen2.5:3b');
  assert.equal(wrapperAi.prompt_version, operationalRiskAi.PROMPT_VERSION);

  const markdownAi = operationalRiskAi.normalizeOperationalAiAnalysis({
    ok: true,
    source: 'ai-engine',
    answer: '```json\n{\"diagnostico_ejecutivo\":\"JSON en markdown valido.\",\"acciones_sugeridas\":[{\"accion\":\"Priorizar control.\",\"horizonte\":\"inmediato\"}]}\n```',
  }, aiPayload);
  assert.equal(markdownAi.guardable, true);

  assertThrowsCode(
    () => operationalRiskAi.normalizeOperationalAiAnalysis({ ok: true, answer: 'texto libre sin json' }, aiPayload),
    'ai_invalid_response'
  );

  assertThrowsCode(
    () => operationalRiskAi.normalizeOperationalAiAnalysis({
      ok: true,
      engine: { ai_engine_used: true, selected_model: 'qwen2.5:3b' },
      structured_result: {
        diagnostico_ejecutivo: 'Preparacion sin_datos: 0 controles activos, 0% cumplimiento efectivo.',
        acciones_sugeridas: [{ accion: 'Revisar evidencia documental.', horizonte: '30_dias' }],
      },
    }, aiPayload),
    'ai_domain_mismatch'
  );

  assertThrowsCode(
    () => operationalRiskAi.normalizeAnalysisToSave({ ...normalizedAi, prompt_version: 'old' }),
    'ai_invalid_response'
  );

  assertThrowsCode(
    () => operationalRiskAi.normalizeAnalysisToSave({ ...normalizedAi, ai_model: 'backend_fallback' }),
    'ai_invalid_response'
  );

  const saveable = operationalRiskAi.normalizeAnalysisToSave(normalizedAi);
  assert.equal(saveable.prompt_version, operationalRiskAi.PROMPT_VERSION);
  assert.equal(saveable.source, 'ai-engine-operational-beta-pert');
  assert.equal(saveable.generation_mode, 'semantic_plus_llm');

  assertThrowsCode(
    () => operationalRiskAi.normalizeAnalysisToSave({ ...normalizedAi, generation_mode: 'semantic_only' }),
    'ai_invalid_response'
  );

  assertThrowsCode(
    () => operationalRiskAi.normalizeAnalysisToSave({
      ...normalizedAi,
      diagnostico_ejecutivo: 'Preparacion sin_datos: 0 controles activos.',
    }),
    'ai_domain_mismatch'
  );

  console.log('operationalRiskMonteCarlo.service tests OK');
}

runTests();
