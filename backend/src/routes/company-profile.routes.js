'use strict';

const express = require('express');
const fs = require('fs');
const auth = require('../middleware/auth');
const asyncJobs = require('../services/asyncJob.service');
const {
  getCompanyProfileForRequest,
  getCompanyProfileForTenant,
  upsertCompanyProfile,
  analyzeCompanyProfile,
  exportCompanyProfileContextPdf,
} = require('../services/companyProfile.service');
const {
  buildCompanyProfileImpact,
  buildCompanyProfileModuleImpact,
} = require('../services/companyProfileImpact.service');
const {
  buildTenantApplicabilityUniverse,
  getTenantApplicabilitySummary,
  getTenantApplicableControls,
  getTenantApplicableKpis,
  getTenantApplicableEvidenceRequirements,
  getTenantApplicabilityExclusions,
} = require('../services/companyProfileApplicabilityEngine.service');

const router = express.Router();

function publicProfile(row) {
  return row || {
    profile_json: {},
    allow_web_research: false,
    allow_document_context: true,
    allow_ai_recommendations: true,
  };
}

function safeError(error) {
  if (error?.code === 'COMPANY_PROFILE_NOT_FOUND') {
    return { status: 404, code: 'COMPANY_PROFILE_NOT_FOUND', error: 'Perfil empresa no encontrado.' };
  }
  if (error?.code === 'TENANT_REQUIRED') {
    return { status: 400, code: 'TENANT_REQUIRED', error: 'Tenant no identificado.' };
  }
  return { status: 500, code: 'COMPANY_PROFILE_ERROR', error: 'No fue posible procesar el perfil empresa.' };
}

function getRequestId(req) {
  return String(req.requestId || req.headers?.['x-request-id'] || '').trim() || null;
}

function publicJob(job, { includeResult = false } = {}) {
  if (!job) return null;
  return {
    ok: true,
    job_id: job.id || job.job_id,
    status: job.status,
    result_available: job.status === 'completed' && !!job.result_json,
    result_json: includeResult || job.status === 'completed' ? job.result_json : undefined,
    error_json: job.status === 'failed' ? job.error_json : undefined,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    model_mode: job.model_mode || null,
    source_module: job.source_module || null,
    request_id: job.request_id || null,
  };
}

function buildJobPayload({ tenantId, userId, profile, modelMode, requestId }) {
  return {
    tenant_id: tenantId,
    user_id: userId,
    locale: 'es',
    model_mode: modelMode,
    use_llm: true,
    use_rag: true,
    use_web: profile?.allow_web_research === true,
    allow_web_research: profile?.allow_web_research === true,
    use_drive: profile?.allow_document_context === true,
    allow_document_context: profile?.allow_document_context === true,
    used_company_profile: true,
    request_id: requestId,
    request_metadata: {
      request_id: requestId,
      module_origin: 'company_profile',
      task_type: 'company_profile_context',
    },
  };
}

function runApplicabilityRebuildInBackground({ tenantId, userId = null, requestId = null, forceRebuild = false }) {
  setImmediate(() => {
    buildTenantApplicabilityUniverse({ tenantId, userId, forceRebuild })
      .then((result) => {
        console.info('COMPANY PROFILE APPLICABILITY REBUILD OK:', {
          request_id: requestId,
          tenant_id: tenantId,
          run_id: result.run_id,
          applicable_controls_count: result.summary?.applicable_controls_count,
          applicable_kpis_count: result.summary?.applicable_kpis_count,
          exclusions_count: result.summary?.exclusions_count,
        });
      })
      .catch((error) => {
        console.error('COMPANY PROFILE APPLICABILITY REBUILD ERROR:', {
          request_id: requestId,
          tenant_id: tenantId,
          error_type: error?.code || error?.name,
          error: error?.message,
        });
      });
  });
}

async function runCompanyProfileAnalysisJob({ jobId, tenantId, userId, requestId, modelMode }) {
  const startedAt = Date.now();
  try {
    await asyncJobs.markRunning(jobId);
    console.info('COMPANY PROFILE AI JOB START:', {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      job_id: jobId,
      model_mode: modelMode,
    });
    console.info('COMPANY PROFILE AI ENGINE CALL START:', {
      request_id: requestId,
      tenant_id: tenantId,
      job_id: jobId,
      model_mode: modelMode,
    });

    const profile = await analyzeCompanyProfile({ tenantId, userId, requestId, modelMode });
    const trace = profile?.ai_research_trace_json || {};
    const durationMs = Date.now() - startedAt;
    const isFallback = trace.fallback_used === true || String(trace.selected_model || '').toLowerCase() === 'backend_fallback';

    if (isFallback) {
      const errorJson = {
        code: 'COMPANY_PROFILE_AI_FALLBACK',
        error_type: trace.error_type || 'AI_ENGINE_FALLBACK',
        error_message: trace.error_message || 'El análisis IA terminó en fallback controlado.',
        selected_model: trace.selected_model || 'backend_fallback',
        model_mode: trace.model_mode || modelMode,
        used_web: trace.used_web === true,
        used_rag: trace.used_rag === true,
        fallback_used: true,
        ai_enrichment_failed: true,
        timeout_stage: trace.timeout_stage || null,
        timeout_ms: trace.timeout_ms || null,
        duration_ms: trace.duration_ms || durationMs,
        request_id: requestId,
      };
      await asyncJobs.markFailed(jobId, { error_json: errorJson });
      console.warn('COMPANY PROFILE AI ENGINE CALL FALLBACK:', {
        request_id: requestId,
        tenant_id: tenantId,
        job_id: jobId,
        model_mode: modelMode,
        selected_model: errorJson.selected_model,
        used_web: errorJson.used_web,
        used_rag: errorJson.used_rag,
        fallback_used: true,
        duration_ms: errorJson.duration_ms,
      });
      console.warn('COMPANY PROFILE AI JOB FAILED:', {
        request_id: requestId,
        tenant_id: tenantId,
        job_id: jobId,
        model_mode: modelMode,
        selected_model: errorJson.selected_model,
        fallback_used: true,
        duration_ms: errorJson.duration_ms,
      });
      return;
    }

    const resultJson = {
      profile,
      ai_profile_summary_json: profile.ai_profile_summary_json || null,
      ai_research_trace_json: trace,
      model_mode: trace.model_mode || modelMode,
      selected_model: trace.selected_model || null,
      used_web: trace.used_web === true,
      used_rag: trace.used_rag === true,
      fallback_used: false,
      ai_enrichment_failed: false,
      duration_ms: trace.duration_ms || durationMs,
      request_id: requestId,
    };
    console.info('COMPANY PROFILE AI ENGINE CALL OK:', {
      request_id: requestId,
      tenant_id: tenantId,
      job_id: jobId,
      model_mode: modelMode,
      selected_model: resultJson.selected_model,
      used_web: resultJson.used_web,
      used_rag: resultJson.used_rag,
      fallback_used: false,
      duration_ms: resultJson.duration_ms,
    });
    await asyncJobs.markCompleted(jobId, { result_json: resultJson });
    try {
      await buildTenantApplicabilityUniverse({
        tenantId,
        userId,
        forceRebuild: true,
      });
    } catch (applicabilityError) {
      console.warn('COMPANY PROFILE AI APPLICABILITY REFRESH WARNING:', {
        request_id: requestId,
        tenant_id: tenantId,
        job_id: jobId,
        error_type: applicabilityError?.code || applicabilityError?.name,
        error: applicabilityError?.message,
      });
    }
    console.info('COMPANY PROFILE AI JOB COMPLETED:', {
      request_id: requestId,
      tenant_id: tenantId,
      job_id: jobId,
      model_mode: modelMode,
      selected_model: resultJson.selected_model,
      used_web: resultJson.used_web,
      fallback_used: false,
      duration_ms: resultJson.duration_ms,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorJson = {
      code: 'COMPANY_PROFILE_AI_JOB_FAILED',
      error_type: error?.code || error?.name || 'COMPANY_PROFILE_AI_ERROR',
      error_message: error?.message ? String(error.message).slice(0, 500) : 'No fue posible completar el análisis IA de Perfil Empresa.',
      model_mode: modelMode,
      fallback_used: true,
      ai_enrichment_failed: true,
      duration_ms: durationMs,
      request_id: requestId,
    };
    await asyncJobs.markFailed(jobId, { error_json: errorJson });
    console.error('COMPANY PROFILE AI JOB FAILED:', {
      request_id: requestId,
      tenant_id: tenantId,
      job_id: jobId,
      model_mode: modelMode,
      error_type: errorJson.error_type,
      duration_ms: durationMs,
    });
  }
}

async function createOrReuseAnalysisJob(req) {
  const requestId = getRequestId(req);
  const { tenantId, userId } = await getCompanyProfileForRequest(req, req.body?.tenant_id || null);
  const profile = await getCompanyProfileForTenant(tenantId);
  if (!profile) {
    const error = new Error('Perfil empresa no existe para este tenant');
    error.code = 'COMPANY_PROFILE_NOT_FOUND';
    throw error;
  }

  const scope = { tenant_id: tenantId, is_platform: false };
  const activeJob = await asyncJobs.findLatestActiveJobScoped(scope, {
    job_type: 'company_profile_analysis',
    source_module: 'company_profile',
  });
  if (activeJob) {
    return { job: activeJob, reused: true, tenantId, userId, requestId: activeJob.request_id || requestId };
  }

  const modelMode = String(req.body?.model_mode || 'balanced').toLowerCase() === 'deep' ? 'deep' : 'balanced';
  const job = await asyncJobs.createJob({
    tenant_id: tenantId,
    user_id: userId,
    job_type: 'company_profile_analysis',
    source_module: 'company_profile',
    model_mode: modelMode,
    payload: buildJobPayload({ tenantId, userId, profile, modelMode, requestId }),
    request_id: requestId,
  });

  console.info('COMPANY PROFILE AI JOB CREATED:', {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    job_id: job.id,
    model_mode: modelMode,
    use_web: profile.allow_web_research === true,
    use_rag: true,
  });

  setImmediate(() => {
    runCompanyProfileAnalysisJob({
      jobId: job.id,
      tenantId,
      userId,
      requestId,
      modelMode,
    }).catch((error) => {
      console.error('COMPANY PROFILE AI JOB UNHANDLED ERROR:', {
        request_id: requestId,
        tenant_id: tenantId,
        job_id: job.id,
        error: error?.message,
      });
    });
  });

  return { job, reused: false, tenantId, userId, requestId };
}

router.get('/', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const profile = await getCompanyProfileForTenant(tenantId);
    return res.json({ ok: true, data: publicProfile(profile) });
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/impact', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const impact = await buildCompanyProfileImpact({ tenantId });
    return res.json({ ok: true, data: impact, request_id: req.requestId || null });
  } catch (error) {
    console.error('COMPANY PROFILE IMPACT ERROR:', {
      request_id: req.requestId || null,
      error: error.message,
    });
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/impact/summary', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const impact = await buildCompanyProfileImpact({ tenantId });
    return res.json({
      ok: true,
      data: {
        tenant_id: impact.tenant_id,
        industry: impact.industry,
        subindustry: impact.subindustry,
        active_standards: impact.active_standards,
        suggested_kpis: impact.impact_profile?.suggested_kpis || [],
        suggested_controls: impact.impact_profile?.suggested_controls || [],
        prioritized_controls: impact.impact_profile?.prioritized_controls || [],
        risk_focus_areas: impact.impact_profile?.risk_focus_areas || [],
        improvement_roadmap: impact.impact_profile?.improvement_roadmap || [],
        trace: impact.trace,
      },
      request_id: req.requestId || null,
    });
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/impact/module/:moduleCode', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const data = await buildCompanyProfileModuleImpact({
      tenantId,
      moduleCode: req.params.moduleCode,
    });
    return res.json({
      ok: true,
      ...data,
      request_id: req.requestId || null,
    });
  } catch (error) {
    console.error('COMPANY PROFILE MODULE IMPACT ERROR:', {
      request_id: req.requestId || null,
      module_code: req.params.moduleCode,
      error: error.message,
    });
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.post('/applicability/rebuild', auth, async (req, res) => {
  try {
    const { tenantId, userId } = await getCompanyProfileForRequest(req, req.body?.tenant_id || null);
    const result = await buildTenantApplicabilityUniverse({
      tenantId,
      userId,
      forceRebuild: req.body?.force_rebuild !== false,
    });
    return res.status(202).json({
      ok: true,
      tenant_id: tenantId,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      profile_used: true,
      active_universe: true,
      ...result,
      request_id: req.requestId || null,
    });
  } catch (error) {
    console.error('COMPANY PROFILE APPLICABILITY REBUILD ENDPOINT ERROR:', {
      request_id: req.requestId || null,
      error: error.message,
    });
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/applicability/summary', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const summary = await getTenantApplicabilitySummary({ tenantId });
    return res.json({
      ok: true,
      tenant_id: tenantId,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      profile_used: true,
      active_universe: true,
      data: summary,
      request_id: req.requestId || null,
    });
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/applicability/controls', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const controls = await getTenantApplicableControls({
      tenantId,
      filters: {
        standard_code: req.query.standard_code || req.query.iso || null,
        limit: req.query.limit || 200,
      },
    });
    return res.json({
      ok: true,
      tenant_id: tenantId,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      profile_used: true,
      active_universe: true,
      total: controls.length,
      data: controls,
      request_id: req.requestId || null,
    });
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/applicability/kpis', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const kpis = await getTenantApplicableKpis({ tenantId, filters: { limit: req.query.limit || 200 } });
    return res.json({
      ok: true,
      tenant_id: tenantId,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      profile_used: true,
      active_universe: true,
      total: kpis.length,
      data: kpis,
      request_id: req.requestId || null,
    });
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/applicability/evidence-requirements', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const evidence = await getTenantApplicableEvidenceRequirements({ tenantId, filters: { limit: req.query.limit || 200 } });
    return res.json({
      ok: true,
      tenant_id: tenantId,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      profile_used: true,
      active_universe: true,
      total: evidence.length,
      data: evidence,
      request_id: req.requestId || null,
    });
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/applicability/exclusions', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const exclusions = await getTenantApplicabilityExclusions({
      tenantId,
      filters: {
        object_type: req.query.object_type || null,
        limit: req.query.limit || 200,
      },
    });
    return res.json({
      ok: true,
      tenant_id: tenantId,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      profile_used: true,
      active_universe: true,
      total: exclusions.length,
      data: exclusions,
      request_id: req.requestId || null,
    });
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const { tenantId, userId } = await getCompanyProfileForRequest(req, req.body?.tenant_id || null);
    const profile = await upsertCompanyProfile({
      tenantId,
      userId,
      profile: req.body || {},
    });
    runApplicabilityRebuildInBackground({
      tenantId,
      userId,
      requestId: req.requestId || null,
      forceRebuild: true,
    });
    return res.json({ ok: true, data: profile });
  } catch (error) {
    console.error('COMPANY PROFILE SAVE ERROR:', {
      request_id: req.requestId || null,
      error: error.message,
    });
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.post('/analyze/start', auth, async (req, res) => {
  try {
    const { job, reused, requestId } = await createOrReuseAnalysisJob(req);
    return res.status(reused ? 200 : 202).json({
      ok: true,
      job_id: job.id,
      status: job.status,
      reused,
      request_id: requestId,
      poll_url: `/api/company-profile/analyze/jobs/${job.id}`,
      result_url: `/api/company-profile/analyze/jobs/${job.id}/result`,
    });
  } catch (error) {
    console.error('COMPANY PROFILE AI JOB CREATE ERROR:', {
      request_id: req.requestId || null,
      error: error.message,
    });
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/analyze/jobs/:jobId', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const job = await asyncJobs.getJobScoped(req.params.jobId, { tenant_id: tenantId, is_platform: false });
    if (!job) {
      return res.status(404).json({ ok: false, code: 'COMPANY_PROFILE_JOB_NOT_FOUND', error: 'Job de análisis no encontrado.', request_id: req.requestId || null });
    }
    return res.json(publicJob(job));
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/analyze/jobs/:jobId/result', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const job = await asyncJobs.getJobScoped(req.params.jobId, { tenant_id: tenantId, is_platform: false });
    if (!job) {
      return res.status(404).json({ ok: false, code: 'COMPANY_PROFILE_JOB_NOT_FOUND', error: 'Job de análisis no encontrado.', request_id: req.requestId || null });
    }
    if (job.status !== 'completed') {
      return res.status(job.status === 'failed' ? 422 : 202).json(publicJob(job));
    }
    return res.json(publicJob(job, { includeResult: true }));
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.post('/analyze', auth, async (req, res) => {
  try {
    const { job, reused, requestId } = await createOrReuseAnalysisJob(req);
    return res.status(202).json({
      ok: true,
      async: true,
      message: 'Análisis IA iniciado en segundo plano.',
      job_id: job.id,
      status: job.status,
      reused,
      request_id: requestId,
      poll_url: `/api/company-profile/analyze/jobs/${job.id}`,
      result_url: `/api/company-profile/analyze/jobs/${job.id}/result`,
    });
  } catch (error) {
    console.error('COMPANY PROFILE AI ANALYSIS ERROR:', {
      request_id: req.requestId || null,
      error: error.message,
    });
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.post('/export-context-document', auth, async (req, res) => {
  try {
    const { tenantId, userId } = await getCompanyProfileForRequest(req, req.body?.tenant_id || null);
    const result = await exportCompanyProfileContextPdf({
      tenantId,
      userId,
      requestId: req.requestId || null,
    });
    return res.status(201).json({
      ok: true,
      data: {
        profile: result.profile,
        file_id: result.file_id,
        download_url: result.download_url,
        file_size: result.file_size,
      },
    });
  } catch (error) {
    console.error('COMPANY PROFILE CONTEXT PDF ERROR:', {
      request_id: req.requestId || null,
      error: error.message,
    });
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

router.get('/context-document/download', auth, async (req, res) => {
  try {
    const { tenantId } = await getCompanyProfileForRequest(req, req.query.tenant_id || null);
    const profile = await getCompanyProfileForTenant(tenantId);
    const filePath = profile?.context_document_url;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, code: 'CONTEXT_DOCUMENT_NOT_FOUND', error: 'Documento de contexto no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="contexto-organizacion.pdf"');
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    const safe = safeError(error);
    return res.status(safe.status).json({ ok: false, ...safe, request_id: req.requestId || null });
  }
});

module.exports = router;
