const express = require('express');
const pool = require('../config/db');
const { errorDetail } = require('../utils/errorResponse');
const monteCarlo = require('../services/operationalRiskMonteCarlo.service');
const aiEngineClient = require('../services/aiEngineClient.service');

const router = express.Router();

function sendData(res, data, extra = {}) {
  return res.json({
    ok: true,
    data,
    ...extra,
  });
}

function handleError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error('ERROR OPERATIONAL RISKS:', error);
  }

  return res.status(status).json({
    ok: false,
    code: error.code || 'OPERATIONAL_RISK_ERROR',
    error: error.message || 'Error procesando simulacion operativa',
    ...errorDetail(error),
  });
}

function buildSimulationResponse(row) {
  if (!row) return null;
  return {
    ...row,
    media_operativa_anual: Number(row.media_operativa_anual || 0),
    mediana_operativa_anual: row.mediana_operativa_anual === null ? null : Number(row.mediana_operativa_anual),
    peor_escenario_p90: row.peor_escenario_p90 === null ? null : Number(row.peor_escenario_p90),
    peor_escenario_p95: Number(row.peor_escenario_p95 || 0),
    peor_escenario_p99: row.peor_escenario_p99 === null ? null : Number(row.peor_escenario_p99),
    desviacion_estandar: row.desviacion_estandar === null ? null : Number(row.desviacion_estandar),
    minimo_simulado: row.minimo_simulado === null ? null : Number(row.minimo_simulado),
    maximo_simulado: row.maximo_simulado === null ? null : Number(row.maximo_simulado),
    probabilidad_disrupcion_critica: row.probabilidad_disrupcion_critica === null
      ? null
      : Number(row.probabilidad_disrupcion_critica),
  };
}

function simulationSelectSql() {
  return `
    SELECT
      id,
      tenant_id,
      source_risk_id,
      norma_tipo,
      modelo_usado,
      nombre_riesgo,
      proceso_afectado,
      descripcion,
      frecuencia_min,
      frecuencia_mode,
      frecuencia_max,
      impacto_min,
      impacto_mode,
      impacto_max,
      tasa_error_min,
      tasa_error_mode,
      tasa_error_max,
      tiempo_subsanacion_min,
      tiempo_subsanacion_mode,
      tiempo_subsanacion_max,
      volumen_operativo_anual,
      umbral_disrupcion_critica_horas,
      iteraciones,
      media_operativa_anual,
      mediana_operativa_anual,
      peor_escenario_p90,
      peor_escenario_p95,
      peor_escenario_p99,
      desviacion_estandar,
      minimo_simulado,
      maximo_simulado,
      probabilidad_disrupcion_critica,
      histograma_json,
      input_json,
      result_json,
      created_by,
      created_at,
      updated_at
    FROM operational_risk_simulations
  `;
}

function getQueryTenantId(req) {
  return monteCarlo.resolveTenantIdForRequest(req.user, req.query.tenant_id || req.body?.tenant_id);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '', maxLength = 2000) {
  return String(value || fallback || '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function boundedNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getAiRequestTenantId(req) {
  return monteCarlo.getUserTenantId(req.user);
}

function normalizePayloadRisk(risk) {
  if (!risk || typeof risk !== 'object') return null;

  return {
    id: safeText(risk.id, '', 80),
    name: safeText(risk.name, 'Riesgo operativo', 220),
    standard: safeText(risk.standard || risk.norm, '', 40),
    model: safeText(risk.model || risk.modelo_usado, '', 80),
    process: safeText(risk.process || risk.processName, '', 180),
    expectedAnnualExposure: boundedNumber(risk.expectedAnnualExposure ?? risk.expectedValue, 0),
    p95: boundedNumber(risk.p95, 0),
    criticalProbability: boundedNumber(risk.criticalProbability, null),
    status: safeText(risk.status, '', 40),
    probabilityScore: boundedNumber(risk.probabilityScore, null),
    impactScore: boundedNumber(risk.impactScore, null),
    frequency: {
      min: boundedNumber(risk.frequency?.min, null),
      mode: boundedNumber(risk.frequency?.mode ?? risk.frequency?.mostLikely, null),
      max: boundedNumber(risk.frequency?.max, null),
    },
    impact: {
      min: boundedNumber(risk.impact?.min, null),
      mode: boundedNumber(risk.impact?.mode ?? risk.impact?.mostLikely, null),
      max: boundedNumber(risk.impact?.max, null),
    },
  };
}

function normalizeAiPayload(body = {}) {
  const risks = asArray(body.risks)
    .slice(0, 25)
    .map(normalizePayloadRisk)
    .filter(Boolean);
  const selectedRisk = normalizePayloadRisk(body.selectedRisk);
  const kpis = body.kpis && typeof body.kpis === 'object' ? body.kpis : {};

  return {
    scope: ['portfolio', 'simulation'].includes(String(body.scope || '')) ? body.scope : 'portfolio',
    methodology: {
      exposureExpectedAccumulated: 'SUM(media_operativa_anual)',
      conservativeP95: 'SUM(peor_escenario_p95)',
      criticalProbabilityAverage: 'AVG(probabilidad_disrupcion_critica)',
      warning: 'El P95 agregado conservador no equivale a un P95 de portafolio simulado.',
      ...(body.methodology && typeof body.methodology === 'object' ? body.methodology : {}),
    },
    kpis: {
      exposureExpectedAccumulated: boundedNumber(kpis.exposureExpectedAccumulated ?? kpis.expectedExposure, 0),
      conservativeP95: boundedNumber(kpis.conservativeP95, 0),
      criticalProbabilityAverage: boundedNumber(kpis.criticalProbabilityAverage ?? kpis.criticalProbability, null),
      highPrioritizedRisks: boundedNumber(kpis.highPrioritizedRisks ?? kpis.prioritizedHighRisks, 0),
    },
    risks,
    selectedRisk,
  };
}

function buildOperationalAiPrompt(payload) {
  return [
    'Actua como AI Auditor v4 senior para analisis operacional de riesgos Beta-PERT.',
    'Usa solo los riesgos enviados. Diferencia hechos calculados de inferencias.',
    'No afirmes cumplimiento ISO certificado. No afirmes P95 de portafolio si solo existe P95 agregado conservador.',
    'Entrega recomendaciones accionables y alineadas con ISO 27001 o ISO 9001 segun la norma de cada riesgo.',
    'Responde en espanol ejecutivo y devuelve JSON estructurado con diagnostico_ejecutivo, riesgos_prioritarios, acciones_sugeridas, controles_iso_sugeridos, advertencias_metodologicas, proximos_pasos y efectividad_estimada_pct.',
    `Contexto metodologico: ${JSON.stringify(payload.methodology)}`,
    `KPIs agregados: ${JSON.stringify(payload.kpis)}`,
    `Riesgo seleccionado: ${JSON.stringify(payload.selectedRisk || null)}`,
    `Riesgos filtrados: ${JSON.stringify(payload.risks)}`,
  ].join('\n');
}

function normalizeList(value, limit = 8) {
  return asArray(value)
    .map((item) => {
      if (typeof item === 'string') return safeText(item, '', 800);
      if (item && typeof item === 'object') return item;
      return '';
    })
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeOperationalAiAnalysis(aiResult, payload) {
  const structured = aiResult?.structured_result || aiResult?.analysis || aiResult?.answer || aiResult || {};
  const source = typeof structured === 'object' ? structured : {};
  const answerText = typeof aiResult?.answer === 'string' ? aiResult.answer : '';
  const executive =
    safeText(
      source.diagnostico_ejecutivo ||
        source.executive_summary ||
        source.diagnosis ||
        source.diagnostic ||
        answerText,
      '',
      2400
    );

  if (!executive) {
    throw monteCarlo.publicError(502, 'AI_ANALYSIS_EMPTY', 'AI Auditor no devolvio diagnostico utilizable');
  }

  return {
    diagnostico_ejecutivo: executive,
    riesgos_prioritarios: normalizeList(source.riesgos_prioritarios || source.prioritized_risks || source.key_risks),
    acciones_sugeridas: normalizeList(source.acciones_sugeridas || source.recommended_actions || source.actions),
    controles_iso_sugeridos: normalizeList(source.controles_iso_sugeridos || source.iso_controls || source.controls),
    advertencias_metodologicas: normalizeList(
      source.advertencias_metodologicas ||
        source.methodology_warnings ||
        source.limitations ||
        ['El P95 agregado conservador no equivale a una simulacion de portafolio con correlacion entre riesgos.']
    ),
    proximos_pasos: normalizeList(source.proximos_pasos || source.next_steps),
    efectividad_estimada_pct: boundedNumber(source.efectividad_estimada_pct || source.estimated_effectiveness_pct, null),
    ai_model: safeText(
      aiResult?.engine?.selected_model ||
        aiResult?.engine?.model ||
        aiResult?.metrics?.model ||
        aiResult?.source ||
        'ai-engine',
      'ai-engine',
      120
    ),
    prompt_version: 'beta-pert-operational-risk-v1',
    scope: payload.scope,
    ai_engine_used: aiResult?.engine?.ai_engine_used !== false && aiResult?.synthetic_result !== true,
    request_id: aiResult?.request_id || aiResult?.engine?.request_id || null,
  };
}

function isAiUnavailable(aiResult) {
  return (
    !aiResult ||
    aiResult.ok === false ||
    aiResult.disabled_by_plan === true ||
    aiResult.ai_disabled_by_plan === true ||
    aiResult.synthetic_result === true ||
    aiResult.deterministic_mode === true ||
    aiResult.engine?.ai_engine_used === false ||
    aiResult.engine?.fallback_used === true ||
    aiResult.engine?.ai_enrichment_failed === true
  );
}

async function getSimulationForTenant(simulationId, tenantId) {
  const result = await pool.query(
    `
    ${simulationSelectSql()}
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [simulationId, tenantId]
  );

  return result.rows[0] || null;
}

function normalizeAnalysisToSave(value) {
  const analysis = value && typeof value === 'object' ? value : {};
  const diagnostico = safeText(
    analysis.diagnostico_ejecutivo || analysis.diagnostico_operativo || analysis.executive_summary,
    '',
    3000
  );

  if (!diagnostico) {
    throw monteCarlo.publicError(400, 'AI_ANALYSIS_REQUIRED', 'diagnostico_ejecutivo es obligatorio');
  }

  return {
    diagnostico_ejecutivo: diagnostico,
    riesgos_prioritarios: normalizeList(analysis.riesgos_prioritarios, 10),
    acciones_sugeridas: normalizeList(analysis.acciones_sugeridas, 10),
    controles_iso_sugeridos: normalizeList(analysis.controles_iso_sugeridos, 10),
    advertencias_metodologicas: normalizeList(analysis.advertencias_metodologicas, 10),
    proximos_pasos: normalizeList(analysis.proximos_pasos, 10),
    efectividad_estimada_pct: boundedNumber(analysis.efectividad_estimada_pct, null),
    ai_model: safeText(analysis.ai_model, 'ai-engine', 120),
    prompt_version: safeText(analysis.prompt_version, 'beta-pert-operational-risk-v1', 120),
    request_id: safeText(analysis.request_id, '', 120) || null,
    scope: safeText(analysis.scope || 'portfolio', 'portfolio', 40),
  };
}

router.post('/simulations', async (req, res) => {
  try {
    const tenantId = monteCarlo.resolveTenantIdForRequest(req.user, req.body?.tenant_id);
    if (!tenantId) {
      throw monteCarlo.publicError(400, 'TENANT_REQUIRED', 'tenant_id es obligatorio');
    }

    monteCarlo.assertCanCreateTenant(req.user, tenantId);

    const simulation = monteCarlo.runOperationalSimulation(req.body || {});
    const input = simulation.input;
    const summary = simulation.summary;
    const resultJson = {
      ...summary,
      modelo_usado: simulation.modelo_usado,
      fecha_ejecucion: simulation.fecha_ejecucion,
      histograma_bins: simulation.histograma_json?.length || 0,
    };

    const insert = await pool.query(
      `
      INSERT INTO operational_risk_simulations (
        tenant_id,
        source_risk_id,
        norma_tipo,
        modelo_usado,
        nombre_riesgo,
        proceso_afectado,
        descripcion,
        frecuencia_min,
        frecuencia_mode,
        frecuencia_max,
        impacto_min,
        impacto_mode,
        impacto_max,
        tasa_error_min,
        tasa_error_mode,
        tasa_error_max,
        tiempo_subsanacion_min,
        tiempo_subsanacion_mode,
        tiempo_subsanacion_max,
        volumen_operativo_anual,
        umbral_disrupcion_critica_horas,
        iteraciones,
        media_operativa_anual,
        mediana_operativa_anual,
        peor_escenario_p90,
        peor_escenario_p95,
        peor_escenario_p99,
        desviacion_estandar,
        minimo_simulado,
        maximo_simulado,
        probabilidad_disrupcion_critica,
        histograma_json,
        input_json,
        result_json,
        created_by
      )
      VALUES (
        $1::uuid, $2::uuid, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22,
        $23, $24, $25, $26, $27, $28, $29, $30, $31,
        $32::jsonb, $33::jsonb, $34::jsonb, $35::uuid
      )
      RETURNING *
      `,
      [
        tenantId,
        input.source_risk_id,
        input.norma_tipo,
        input.modelo_usado,
        input.nombre_riesgo,
        input.proceso_afectado,
        input.descripcion,
        input.frecuencia.min,
        input.frecuencia.mode,
        input.frecuencia.max,
        input.impacto_operativo?.min ?? null,
        input.impacto_operativo?.mode ?? null,
        input.impacto_operativo?.max ?? null,
        input.tasa_error?.min ?? null,
        input.tasa_error?.mode ?? null,
        input.tasa_error?.max ?? null,
        input.tiempo_subsanacion?.min ?? null,
        input.tiempo_subsanacion?.mode ?? null,
        input.tiempo_subsanacion?.max ?? null,
        input.volumen_operativo_anual,
        input.umbral_disrupcion_critica_horas,
        input.iteraciones,
        summary.media_operativa_anual,
        summary.mediana_operativa_anual,
        summary.peor_escenario_p90,
        summary.peor_escenario_p95,
        summary.peor_escenario_p99,
        summary.desviacion_estandar,
        summary.minimo_simulado,
        summary.maximo_simulado,
        summary.probabilidad_disrupcion_critica,
        JSON.stringify(simulation.histograma_json),
        JSON.stringify(input),
        JSON.stringify(resultJson),
        monteCarlo.getUserId(req.user),
      ]
    );

    return sendData(res, buildSimulationResponse(insert.rows[0]), { success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/simulations', async (req, res) => {
  try {
    const tenantId = getQueryTenantId(req);
    if (!tenantId) {
      throw monteCarlo.publicError(400, 'TENANT_REQUIRED', 'tenant_id es obligatorio');
    }

    monteCarlo.assertCanReadTenant(req.user, tenantId);

    const params = [tenantId];
    const where = ['tenant_id = $1::uuid'];

    if (req.query.norma_tipo) {
      params.push(String(req.query.norma_tipo).toUpperCase());
      where.push(`norma_tipo = $${params.length}`);
    }

    if (req.query.source_risk_id) {
      params.push(req.query.source_risk_id);
      where.push(`source_risk_id = $${params.length}::uuid`);
    }

    if (req.query.proceso_afectado) {
      params.push(`%${String(req.query.proceso_afectado).trim()}%`);
      where.push(`proceso_afectado ILIKE $${params.length}`);
    }

    if (req.query.fecha_desde) {
      params.push(req.query.fecha_desde);
      where.push(`created_at >= $${params.length}::timestamptz`);
    }

    if (req.query.fecha_hasta) {
      params.push(req.query.fecha_hasta);
      where.push(`created_at <= $${params.length}::timestamptz`);
    }

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    params.push(limit);

    const result = await pool.query(
      `
      ${simulationSelectSql()}
      WHERE ${where.join(' AND ')}
      ORDER BY peor_escenario_p95 DESC, created_at DESC
      LIMIT $${params.length}
      `,
      params
    );

    return sendData(res, result.rows.map(buildSimulationResponse), { count: result.rows.length });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/simulations/:id', async (req, res) => {
  try {
    const tenantId = getQueryTenantId(req);
    if (!tenantId) {
      throw monteCarlo.publicError(400, 'TENANT_REQUIRED', 'tenant_id es obligatorio');
    }

    monteCarlo.assertCanReadTenant(req.user, tenantId);

    const result = await pool.query(
      `
      ${simulationSelectSql()}
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      LIMIT 1
      `,
      [req.params.id, tenantId]
    );

    if (!result.rows[0]) {
      throw monteCarlo.publicError(404, 'SIMULATION_NOT_FOUND', 'Simulacion no encontrada');
    }

    return sendData(res, buildSimulationResponse(result.rows[0]));
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/ai-analysis', async (req, res) => {
  try {
    const tenantId = getAiRequestTenantId(req);
    if (!tenantId) {
      throw monteCarlo.publicError(400, 'TENANT_REQUIRED', 'tenant_id es obligatorio');
    }

    monteCarlo.assertCanReadTenant(req.user, tenantId);

    const payload = normalizeAiPayload(req.body || {});
    if (payload.risks.length === 0) {
      throw monteCarlo.publicError(400, 'AI_ANALYSIS_RISKS_REQUIRED', 'Se requiere al menos un riesgo para analisis AI');
    }

    const requestId = `beta_pert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const aiPayload = {
      tenant_id: tenantId,
      request_id: requestId,
      locale: 'es',
      task_type: 'operational_risk_beta_pert_analysis',
      prompt_version: 'beta-pert-operational-risk-v1',
      question: buildOperationalAiPrompt(payload),
      context: {
        tenant: { tenant_id: tenantId },
        scope: {
          module: 'operational-risks',
          view: 'beta-pert',
          analysis_scope: payload.scope,
          prompt_version: 'beta-pert-operational-risk-v1',
        },
        operational_risk_beta_pert: payload,
      },
      options: {
        model_mode: 'balanced',
        response_format: 'json',
        require_json: true,
        human_review_required: true,
      },
    };

    const aiResult = await aiEngineClient.analyzeWithSeniorAuditor(aiPayload);
    if (isAiUnavailable(aiResult)) {
      const code = aiResult?.code || aiResult?.engine?.error_type || 'AI_ENGINE_UNAVAILABLE';
      const status = code === 'AI_DISABLED_BY_PLAN' ? 403 : 503;
      return res.status(status).json({
        ok: false,
        code,
        error: code === 'AI_DISABLED_BY_PLAN'
          ? 'AI Auditor no esta habilitado para este tenant.'
          : 'AI Auditor no esta disponible para analisis operacional Beta-PERT en este momento.',
        ai_available: false,
        request_id: aiResult?.request_id || requestId,
        engine: aiResult?.engine || aiResult?.trace || null,
      });
    }

    const analysis = normalizeOperationalAiAnalysis(aiResult, payload);
    return sendData(res, {
      analysis,
      ai_available: true,
      request_id: analysis.request_id || requestId,
      engine: aiResult?.engine || aiResult?.metrics || {},
    }, { success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/simulations/:id/recommendations', async (req, res) => {
  try {
    const tenantId = getQueryTenantId(req);
    if (!tenantId) {
      throw monteCarlo.publicError(400, 'TENANT_REQUIRED', 'tenant_id es obligatorio');
    }

    monteCarlo.assertCanCreateTenant(req.user, tenantId);

    const simulationResult = await pool.query(
      `
      ${simulationSelectSql()}
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      LIMIT 1
      `,
      [req.params.id, tenantId]
    );

    const simulation = simulationResult.rows[0];
    if (!simulation) {
      throw monteCarlo.publicError(404, 'SIMULATION_NOT_FOUND', 'Simulacion no encontrada');
    }

    const recommendation = monteCarlo.buildRuleBasedRecommendation(simulation);

    const insert = await pool.query(
      `
      INSERT INTO operational_risk_recommendations (
        tenant_id,
        simulation_id,
        source_risk_id,
        diagnostico_operativo,
        controles_sugeridos,
        efectividad_estimada_pct,
        ai_model,
        prompt_version,
        created_by
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6, $7, $8, $9::uuid)
      RETURNING *
      `,
      [
        tenantId,
        simulation.id,
        simulation.source_risk_id,
        recommendation.diagnostico_operativo,
        JSON.stringify(recommendation.controles_sugeridos),
        recommendation.efectividad_estimada_pct,
        'rule-based-operational-v1',
        'operational-risk-rule-v1',
        monteCarlo.getUserId(req.user),
      ]
    );

    return sendData(res, {
      ...insert.rows[0],
      requiere_validacion_humana: recommendation.requiere_validacion_humana,
    }, { success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/simulations/:id/recommendations/ai', async (req, res) => {
  try {
    const tenantId = getAiRequestTenantId(req);
    if (!tenantId) {
      throw monteCarlo.publicError(400, 'TENANT_REQUIRED', 'tenant_id es obligatorio');
    }

    monteCarlo.assertCanCreateTenant(req.user, tenantId);

    const simulation = await getSimulationForTenant(req.params.id, tenantId);
    if (!simulation) {
      throw monteCarlo.publicError(404, 'SIMULATION_NOT_FOUND', 'Simulacion no encontrada');
    }

    const analysis = normalizeAnalysisToSave(req.body?.analysis);
    const controlsPayload = {
      source: 'ai-engine',
      scope: safeText(req.body?.scope || analysis.scope, 'portfolio', 40),
      selectedRiskId: safeText(req.body?.selectedRiskId, '', 80) || null,
      riesgos_prioritarios: analysis.riesgos_prioritarios,
      acciones_sugeridas: analysis.acciones_sugeridas,
      controles_iso_sugeridos: analysis.controles_iso_sugeridos,
      advertencias_metodologicas: analysis.advertencias_metodologicas,
      proximos_pasos: analysis.proximos_pasos,
      metadata: {
        request_id: analysis.request_id,
        human_review_required: true,
        persisted_from: 'beta-pert-ai-analysis',
      },
    };

    const insert = await pool.query(
      `
      INSERT INTO operational_risk_recommendations (
        tenant_id,
        simulation_id,
        source_risk_id,
        diagnostico_operativo,
        controles_sugeridos,
        efectividad_estimada_pct,
        ai_model,
        prompt_version,
        created_by
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6, $7, $8, $9::uuid)
      RETURNING *
      `,
      [
        tenantId,
        simulation.id,
        simulation.source_risk_id,
        analysis.diagnostico_ejecutivo,
        JSON.stringify(controlsPayload),
        analysis.efectividad_estimada_pct,
        analysis.ai_model,
        analysis.prompt_version,
        monteCarlo.getUserId(req.user),
      ]
    );

    return sendData(res, {
      recommendation: insert.rows[0],
    }, { success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
