const express = require('express');
const pool = require('../config/db');
const { errorDetail } = require('../utils/errorResponse');
const monteCarlo = require('../services/operationalRiskMonteCarlo.service');

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

module.exports = router;
