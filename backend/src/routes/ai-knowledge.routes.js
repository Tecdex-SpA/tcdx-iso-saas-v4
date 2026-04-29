const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

function normalizeStandardKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function expandStandardAliases(values = []) {
  const set = new Set();

  for (const value of values) {
    const key = normalizeStandardKey(value);
    if (!key) continue;

    set.add(key);

    // Alias frecuentes entre tenant_standards y corpus global
    if (key === 'ISO27001') set.add('ISO/IEC27001');
    if (key === 'ISO/IEC27001') set.add('ISO27001');

    if (key === 'ISO9001') set.add('ISO/IEC9001');
    if (key === 'ISO/IEC9001') set.add('ISO9001');

    if (key === 'ISO20000-1') set.add('ISO/IEC20000-1');
    if (key === 'ISO/IEC20000-1') set.add('ISO20000-1');
  }

  return Array.from(set);
}

function sanitizeLimit(value, fallback = 8) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 20);
}

function internalAuth(req, res, next) {
  const incoming =
    req.headers['x-ai-internal-token'] ||
    req.headers['x-ai-engine-token'] ||
    '';

  if (!process.env.AI_INTERNAL_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'AI_INTERNAL_TOKEN no está definido en backend',
    });
  }

  if (incoming !== process.env.AI_INTERNAL_TOKEN) {
    return res.status(401).json({
      ok: false,
      error: 'Token interno inválido',
    });
  }

  next();
}

async function searchKnowledge({
  q,
  tenantStandards = [],
  standardCode = null,
  includeDrafts = false,
  limit = 8,
}) {
  const expandedTenantStandards = expandStandardAliases(
    Array.isArray(tenantStandards) ? tenantStandards : []
  );

  const expandedStandardCodes = standardCode
    ? expandStandardAliases([standardCode])
    : [];

  const sql = `
    WITH base AS (
      SELECT
        r.id,
        r.record_id,
        r.norma,
        r.norma_key,
        r.edicion_estado,
        r.coverage_type,
        r.clausula_o_control,
        r.titulo,
        r.descripcion_resumen,
        r.que_exige,
        r.ejemplos_evidencia_json,
        r.hallazgos_tipicos_json,
        r.acciones_correctivas_sugeridas_json,
        r.palabras_clave_tags_json,
        r.related_norms_json,
        r.source_refs_json,
        r.standard_type,
        r.uses_hls_annex_sl,
        r.norma_objetivo,
        r.scope_public_summary,
        r.verified_public_crosswalks_json,
        r.embedding_text,
        r.search_text,
        r.is_draft,
        ts_rank_cd(
          to_tsvector('simple', coalesce(r.search_text, '')),
          websearch_to_tsquery('simple', $1)
        ) AS text_rank,
        similarity(lower(coalesce(r.search_text, '')), lower($1)) AS sim_rank
      FROM ai_knowledge_records r
      WHERE r.is_active = true
        AND ($2::boolean = true OR r.is_draft = false)
        AND (
          cardinality($3::text[]) = 0
          OR r.norma_key = ANY($3::text[])
        )
        AND (
          cardinality($4::text[]) = 0
          OR r.norma_key = ANY($4::text[])
        )
        AND (
          coalesce($1, '') = ''
          OR to_tsvector('simple', coalesce(r.search_text, '')) @@ websearch_to_tsquery('simple', $1)
          OR coalesce(r.search_text, '') ILIKE '%' || $1 || '%'
          OR coalesce(r.embedding_text, '') ILIKE '%' || $1 || '%'
          OR similarity(lower(coalesce(r.search_text, '')), lower($1)) > 0.05
        )
    )
    SELECT
      id,
      record_id,
      norma,
      norma_key,
      edicion_estado,
      coverage_type,
      clausula_o_control,
      titulo,
      descripcion_resumen,
      que_exige,
      ejemplos_evidencia_json,
      hallazgos_tipicos_json,
      acciones_correctivas_sugeridas_json,
      palabras_clave_tags_json,
      related_norms_json,
      source_refs_json,
      standard_type,
      uses_hls_annex_sl,
      norma_objetivo,
      scope_public_summary,
      verified_public_crosswalks_json,
      embedding_text,
      is_draft,
      text_rank,
      sim_rank,
      (text_rank * 10 + sim_rank) AS final_rank
    FROM base
    ORDER BY final_rank DESC, norma ASC, clausula_o_control ASC NULLS LAST
    LIMIT $5
  `;

  const result = await pool.query(sql, [
    String(q || '').trim(),
    includeDrafts === true,
    expandedTenantStandards,
    expandedStandardCodes,
    limit,
  ]);

  return result.rows.map((row) => ({
    id: row.id,
    record_id: row.record_id,
    norma: row.norma,
    norma_key: row.norma_key,
    edicion_estado: row.edicion_estado,
    coverage_type: row.coverage_type,
    clausula_o_control: row.clausula_o_control,
    titulo: row.titulo,
    descripcion_resumen: row.descripcion_resumen,
    que_exige: row.que_exige,
    ejemplos_evidencia: row.ejemplos_evidencia_json || [],
    hallazgos_tipicos: row.hallazgos_tipicos_json || [],
    acciones_correctivas_sugeridas:
      row.acciones_correctivas_sugeridas_json || [],
    palabras_clave_tags: row.palabras_clave_tags_json || [],
    related_norms: row.related_norms_json || [],
    source_refs: row.source_refs_json || [],
    standard_type: row.standard_type,
    uses_hls_annex_sl: row.uses_hls_annex_sl,
    norma_objetivo: row.norma_objetivo,
    scope_public_summary: row.scope_public_summary,
    verified_public_crosswalks:
      row.verified_public_crosswalks_json || [],
    embedding_text: row.embedding_text,
    is_draft: row.is_draft,
    text_rank: Number(row.text_rank || 0),
    sim_rank: Number(row.sim_rank || 0),
    final_rank: Number(row.final_rank || 0),
  }));
}

router.get('/search', auth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = sanitizeLimit(req.query.limit, 8);
    const standardCode = req.query.standard_code
      ? String(req.query.standard_code)
      : null;
    const tenantStandards = req.query.tenant_standards
      ? String(req.query.tenant_standards)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
    const includeDrafts =
      String(req.query.include_drafts || 'false') === 'true';

    const rows = await searchKnowledge({
      q,
      tenantStandards,
      standardCode,
      includeDrafts,
      limit,
    });

    return res.json({
      ok: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('ERROR AI KNOWLEDGE SEARCH:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error buscando conocimiento IA',
      detail: error.message,
    });
  }
});

router.post('/internal-search', internalAuth, async (req, res) => {
  try {
    const q = String(req.body?.q || '').trim();
    const limit = sanitizeLimit(req.body?.limit, 8);
    const standardCode = req.body?.standard_code
      ? String(req.body.standard_code)
      : null;
    const tenantStandards = Array.isArray(req.body?.tenant_standards)
      ? req.body.tenant_standards
      : [];
    const includeDrafts = req.body?.include_drafts === true;

    const rows = await searchKnowledge({
      q,
      tenantStandards,
      standardCode,
      includeDrafts,
      limit,
    });

    return res.json({
      ok: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('ERROR AI KNOWLEDGE INTERNAL SEARCH:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error buscando conocimiento IA interno',
      detail: error.message,
    });
  }
});

module.exports = router;
