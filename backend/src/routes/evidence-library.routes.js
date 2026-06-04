'use strict';

const express = require('express');
const {
  listSources,
  listDocuments,
  getDocumentDetail,
  listDocumentChildren,
  listAssociations,
  createAssociation,
  setAssociationStatus,
  listTargetCandidates,
  analyzeSemanticEvidence,
  reviewSuggestion,
} = require('../services/evidenceLibrary.service');

const router = express.Router();

function sendError(res, error) {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    ok: false,
    code: error?.code || 'EVIDENCE_LIBRARY_ERROR',
    error: status >= 500 ? 'No fue posible procesar la solicitud.' : error.message,
  });
}

router.get('/sources', async (req, res) => {
  try {
    const data = await listSources({ user: req.user });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/documents', async (req, res) => {
  try {
    const result = await listDocuments({ user: req.user, filters: req.query || {} });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/documents/:sourceType/:sourceId/children', async (req, res) => {
  try {
    const result = await listDocumentChildren({
      user: req.user,
      sourceType: req.params.sourceType,
      sourceId: req.params.sourceId,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/documents/:sourceType/:sourceId', async (req, res) => {
  try {
    const data = await getDocumentDetail({
      user: req.user,
      sourceType: req.params.sourceType,
      sourceId: req.params.sourceId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/associations', async (req, res) => {
  try {
    const data = await listAssociations({ user: req.user, filters: req.query || {} });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/associations', async (req, res) => {
  try {
    const data = await createAssociation({ user: req.user, payload: req.body || {} });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/associations/:id/deactivate', async (req, res) => {
  try {
    const data = await setAssociationStatus({ user: req.user, id: req.params.id, isActive: false });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/associations/:id/reactivate', async (req, res) => {
  try {
    const data = await setAssociationStatus({ user: req.user, id: req.params.id, isActive: true });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/targets/:targetType', async (req, res) => {
  try {
    const data = await listTargetCandidates({
      user: req.user,
      targetType: req.params.targetType,
      search: req.query?.search || '',
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/semantic/analyze', async (req, res) => {
  try {
    const data = await analyzeSemanticEvidence({
      user: req.user,
      sourceType: req.body?.source_type,
      sourceId: req.body?.source_id,
      libraryItemId: req.body?.library_item_id,
      itemType: req.body?.item_type,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/semantic/suggestions/:id/accept', async (req, res) => {
  try {
    const data = await reviewSuggestion({ user: req.user, suggestionId: req.params.id, action: 'accept' });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/semantic/suggestions/:id/reject', async (req, res) => {
  try {
    const data = await reviewSuggestion({ user: req.user, suggestionId: req.params.id, action: 'reject' });
    return res.json({ ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
