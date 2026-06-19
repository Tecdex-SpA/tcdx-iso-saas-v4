'use strict';

const assert = require('assert');
const { createOperationalRiskAiJobsService } = require('./operationalRiskAiJobs.service');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const SIM_A = '44444444-4444-4444-8444-444444444444';
const SOURCE_A = '55555555-5555-4555-8555-555555555555';

function createFakeDb() {
  const jobs = [];
  const simulations = [{ id: SIM_A, tenant_id: TENANT_A, source_risk_id: SOURCE_A }];

  return {
    jobs,
    async query(sql, params) {
      if (sql.includes('FROM operational_risk_simulations')) {
        const [simulationId, tenantId] = params;
        return { rows: simulations.filter((row) => row.id === simulationId && row.tenant_id === tenantId) };
      }

      if (sql.includes('INSERT INTO operational_risk_ai_analysis_jobs')) {
        const row = {
          id: `66666666-6666-4666-8666-${String(jobs.length + 1).padStart(12, '0')}`,
          tenant_id: params[0],
          simulation_id: params[1],
          source_risk_id: params[2],
          status: 'pending',
          prompt_version: params[3],
          ai_model: null,
          request_payload_json: JSON.parse(params[4]),
          analysis_json: null,
          error_code: null,
          error_message: null,
          created_by: params[5],
          created_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
        };
        jobs.push(row);
        return { rows: [row] };
      }

      if (sql.includes('UPDATE operational_risk_ai_analysis_jobs')) {
        const [jobId, status, aiModel, analysisJson, errorCode, errorMessage] = params;
        const row = jobs.find((job) => job.id === jobId);
        if (!row) return { rows: [] };
        row.status = status;
        row.ai_model = aiModel || row.ai_model;
        row.analysis_json = analysisJson ? JSON.parse(analysisJson) : row.analysis_json;
        row.error_code = errorCode;
        row.error_message = errorMessage;
        if (status === 'running') row.started_at = row.started_at || new Date().toISOString();
        if (['completed', 'failed', 'timeout'].includes(status)) row.completed_at = new Date().toISOString();
        return { rows: [row] };
      }

      if (sql.includes('WHERE id = $1::uuid') && sql.includes('tenant_id = $2::uuid')) {
        const [jobId, tenantId] = params;
        return { rows: jobs.filter((job) => job.id === jobId && job.tenant_id === tenantId) };
      }

      if (sql.includes('FROM operational_risk_ai_analysis_jobs')) {
        const tenantId = params[0];
        const simulationId = sql.includes('simulation_id = $2::uuid') ? params[1] : null;
        const limit = params[params.length - 1];
        const rows = jobs
          .filter((job) => job.tenant_id === tenantId)
          .filter((job) => (simulationId ? job.simulation_id === simulationId : true))
          .slice(0, limit);
        return { rows };
      }

      throw new Error(`Unhandled SQL in fake db: ${sql}`);
    },
  };
}

function validPayload() {
  return {
    scope: 'portfolio',
    kpis: {
      exposureExpectedAccumulated: 100,
      conservativeP95: 220,
      criticalProbabilityAverage: 0.3,
      highPrioritizedRisks: 2,
    },
    selectedRisk: {
      id: SIM_A,
      name: 'Caida de servicio',
      standard: 'ISO27001',
      process: 'Continuidad',
      p95: 120,
      criticalProbability: 0.4,
    },
    risks: [
      {
        id: SIM_A,
        name: 'Caida de servicio',
        standard: 'ISO27001',
        process: 'Continuidad',
        p95: 120,
        criticalProbability: 0.4,
      },
    ],
  };
}

async function testCreateListAndTenantIsolation() {
  const db = createFakeDb();
  const service = createOperationalRiskAiJobsService({ db });
  const job = await service.createJob({
    tenantId: TENANT_A,
    userId: USER_ID,
    simulationId: SIM_A,
    payload: validPayload(),
  });

  assert.strictEqual(job.status, 'pending');
  assert.strictEqual(job.simulation_id, SIM_A);
  assert.strictEqual(job.source_risk_id, SOURCE_A);

  const visible = await service.listJobsForTenant({ tenantId: TENANT_A, simulationId: SIM_A });
  const hidden = await service.listJobsForTenant({ tenantId: TENANT_B, simulationId: SIM_A });
  assert.strictEqual(visible.length, 1);
  assert.strictEqual(hidden.length, 0);

  const sameTenant = await service.getJobForTenant(job.id, TENANT_A);
  const otherTenant = await service.getJobForTenant(job.id, TENANT_B);
  assert.strictEqual(sameTenant.id, job.id);
  assert.strictEqual(otherTenant, null);
}

async function testRunJobCompletedUsesOperationalBetaPert() {
  const db = createFakeDb();
  let calledOperationalAnalyzer = false;
  let capturedPayload = null;
  let capturedOptions = null;
  const engineClient = {
    async analyzeOperationalBetaPert(payload, options) {
      calledOperationalAnalyzer = true;
      capturedPayload = payload;
      capturedOptions = options;
      return {
        success: true,
        analysis: {
          diagnostico_ejecutivo: 'Exposicion operacional alta en continuidad.',
          lectura_portafolio: 'El P95 se concentra en la simulacion seleccionada.',
          acciones_sugeridas: [{ accion: 'Probar recuperacion.', horizonte: '30_dias' }],
          acciones_tratamiento: [{ accion: 'Probar recuperacion.', horizonte: '30_dias', evidencia_esperada: 'Acta de prueba' }],
          evidencia_requerida: [{ evidencia: 'Acta de prueba', tipo: 'prueba' }],
          criterios_cierre: [{ criterio: 'Prueba aprobada', horizonte: '30_dias' }],
          web_context: { used: false, status: 'not_requested', sources: [] },
          proximos_pasos: ['Asignar owner.'],
          ai_model: 'qwen-test',
          prompt_version: 'beta-pert-operational-risk-v1',
          source: 'ai-engine-operational-beta-pert',
          generation_mode: 'semantic_plus_llm',
        },
      };
    },
    async analyzeWithSeniorAuditor() {
      throw new Error('senior auditor should not be used');
    },
  };
  const service = createOperationalRiskAiJobsService({ db, engineClient });
  const job = await service.createJob({
    tenantId: TENANT_A,
    userId: USER_ID,
    simulationId: SIM_A,
    payload: validPayload(),
  });

  const completed = await service.runJob(job.id);
  assert.strictEqual(calledOperationalAnalyzer, true);
  assert.strictEqual(capturedPayload.options.execution_mode, 'async_job');
  assert.strictEqual(capturedPayload.options.allow_long_running, true);
  assert.strictEqual(capturedPayload.options.include_web_context, false);
  assert.strictEqual(capturedPayload.request_metadata.execution_mode, 'async_job');
  assert.strictEqual(capturedOptions.timeoutMs, 420000);
  assert.strictEqual(completed.status, 'completed');
  assert.strictEqual(completed.ai_model, 'qwen-test');
  assert.strictEqual(completed.analysis_json.diagnostico_ejecutivo, 'Exposicion operacional alta en continuidad.');
  assert.strictEqual(completed.analysis_json.web_context.status, 'not_requested');
  assert.strictEqual(completed.analysis_json.evidencia_requerida.length, 1);
}

async function testRunJobPersistsAndPassesEnabledWebContext() {
  const db = createFakeDb();
  let capturedPayload = null;
  const engineClient = {
    async analyzeOperationalBetaPert(payload) {
      capturedPayload = payload;
      return {
        success: true,
        analysis: {
          diagnostico_ejecutivo: 'Exposicion operacional alta en continuidad.',
          lectura_portafolio: 'El P95 se concentra en continuidad.',
          acciones_sugeridas: [{ accion: 'Probar recuperacion.', horizonte: '30_dias' }],
          proximos_pasos: ['Asignar owner.'],
          web_context: { used: true, status: 'used', queries: ['ISO 27001 continuity'], sources: [{ title: 'NIST', url: 'https://nist.gov' }] },
          ai_model: 'qwen-test',
          prompt_version: 'beta-pert-operational-risk-v1',
          source: 'ai-engine-operational-beta-pert',
          generation_mode: 'semantic_plus_llm',
        },
      };
    },
  };
  const aiSettingsService = {
    async isTenantAiFeatureEnabled() {
      return { enabled: true, reason: 'ai_enabled' };
    },
  };
  const service = createOperationalRiskAiJobsService({ db, engineClient, aiSettingsService });
  const payload = { ...validPayload(), include_web_context: true, options: { include_web_context: true } };
  const job = await service.createJob({
    tenantId: TENANT_A,
    userId: USER_ID,
    simulationId: SIM_A,
    payload,
  });

  assert.strictEqual(job.request_payload_json.include_web_context, true);
  const completed = await service.runJob(job.id);
  assert.strictEqual(capturedPayload.options.include_web_context, true);
  assert.strictEqual(capturedPayload.request_metadata.include_web_context, true);
  assert.strictEqual(completed.status, 'completed');
  assert.strictEqual(completed.analysis_json.web_context.status, 'used');
}

async function testRunJobDisablesWebContextWhenTenantFeatureOff() {
  const db = createFakeDb();
  let capturedPayload = null;
  const engineClient = {
    async analyzeOperationalBetaPert(payload) {
      capturedPayload = payload;
      return {
        success: true,
        analysis: {
          diagnostico_ejecutivo: 'Exposicion operacional alta en continuidad.',
          lectura_portafolio: 'El P95 se concentra en continuidad.',
          acciones_sugeridas: [{ accion: 'Probar recuperacion.', horizonte: '30_dias' }],
          proximos_pasos: ['Asignar owner.'],
          web_context: { used: false, status: 'disabled_for_tenant', sources: [] },
          ai_model: 'qwen-test',
          prompt_version: 'beta-pert-operational-risk-v1',
          source: 'ai-engine-operational-beta-pert',
          generation_mode: 'semantic_plus_llm',
        },
      };
    },
  };
  const aiSettingsService = {
    async isTenantAiFeatureEnabled() {
      return { enabled: false, reason: 'ai_feature_disabled' };
    },
  };
  const service = createOperationalRiskAiJobsService({ db, engineClient, aiSettingsService });
  const job = await service.createJob({
    tenantId: TENANT_A,
    userId: USER_ID,
    simulationId: SIM_A,
    payload: { ...validPayload(), include_web_context: true, options: { include_web_context: true } },
  });

  const completed = await service.runJob(job.id);
  assert.strictEqual(capturedPayload.options.include_web_context, false);
  assert.strictEqual(capturedPayload.options.web_context_disabled_for_tenant, true);
  assert.strictEqual(capturedPayload.request_metadata.web_context_reason, 'ai_feature_disabled');
  assert.strictEqual(completed.status, 'completed');
  assert.strictEqual(completed.analysis_json.web_context.status, 'disabled_for_tenant');
}

async function testRunJobTimeoutIsPersisted() {
  const db = createFakeDb();
  const engineClient = {
    async analyzeOperationalBetaPert() {
      return {
        ok: false,
        code: 'ai_timeout',
        message: 'timeout',
        engine: { ai_enrichment_failed: true, error_type: 'ai_timeout' },
      };
    },
  };
  const service = createOperationalRiskAiJobsService({ db, engineClient });
  const job = await service.createJob({
    tenantId: TENANT_A,
    userId: USER_ID,
    simulationId: SIM_A,
    payload: validPayload(),
  });

  const timedOut = await service.runJob(job.id);
  assert.strictEqual(timedOut.status, 'timeout');
  assert.strictEqual(timedOut.error_code, 'ai_timeout');
  assert.strictEqual(timedOut.analysis_json, null);
}

(async () => {
  await testCreateListAndTenantIsolation();
  await testRunJobCompletedUsesOperationalBetaPert();
  await testRunJobPersistsAndPassesEnabledWebContext();
  await testRunJobDisablesWebContextWhenTenantFeatureOff();
  await testRunJobTimeoutIsPersisted();
  console.log('operationalRiskAiJobs.service tests OK');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
