'use strict';

const express = require('express');
const fs = require('fs');
const auth = require('../middleware/auth');
const {
  getCompanyProfileForRequest,
  getCompanyProfileForTenant,
  upsertCompanyProfile,
  analyzeCompanyProfile,
  exportCompanyProfileContextPdf,
} = require('../services/companyProfile.service');

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

router.put('/', auth, async (req, res) => {
  try {
    const { tenantId, userId } = await getCompanyProfileForRequest(req, req.body?.tenant_id || null);
    const profile = await upsertCompanyProfile({
      tenantId,
      userId,
      profile: req.body || {},
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

router.post('/analyze', auth, async (req, res) => {
  try {
    const { tenantId, userId } = await getCompanyProfileForRequest(req, req.body?.tenant_id || null);
    const profile = await analyzeCompanyProfile({
      tenantId,
      userId,
      requestId: req.requestId || null,
      modelMode: req.body?.model_mode || 'balanced',
    });
    return res.json({ ok: true, data: profile });
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
