const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

function getUserId(user) {
  return user?.id || user?.user_id || user?.userId || null;
}

function getTenantId(user, req) {
  return (
    req.body?.tenant_id ||
    req.query?.tenant_id ||
    req.params?.tenant_id ||
    user?.tenant_id ||
    user?.tenantId ||
    null
  );
}

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isPlatformRole(role) {
  const r = normalizeRole(role);

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'global_admin',
    'admin_global',
    'owner',
  ].includes(r);
}

function normalizeQuestion(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 2000);
}

function normalizeConfidence(value) {
  const v = String(value || '').toLowerCase();

  if (['alta', 'high'].includes(v)) return 'alta';
  if (['media', 'medium'].includes(v)) return 'media';
  return 'baja';
}

function normalizeSourceLevel(value) {
  const v = String(value || '').toLowerCase();

  const allowed = [
    'tenant_internal',
    'tcdx_knowledge',
    'anonymized_benchmark',
    'external_web',
    'best_effort',
  ];

  return allowed.includes(v) ? v : 'best_effort';
}

// =====================================================
// POST /api/ai-traces
// Registra trazabilidad de una respuesta IA.
// =====================================================
router.post('/', auth, async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const tenantId = getTenantId(req.user, req);

    const question = String(req.body?.question || '').trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        error: 'question es obligatorio',
      });
    }

    const sourceLevel = normalizeSourceLevel(req.body?.source_level);
    const confidence = normalizeConfidence(req.body?.confidence);

    const result = await pool.query(
      `
      INSERT INTO ai_core.ai_response_traces (
        tenant_id,
        user_id,
        question,
        normalized_question,
        intent,
        source_level,
        source_label,
        confidence,
        confidence_score,
        tenant_hits,
        knowledge_hits,
        benchmark_hits,
        external_hits,
        used_tenant_internal,
        used_tcdx_knowledge,
        used_anonymized_benchmark,
        used_external_lookup,
        must_review_by_human,
        final_strategy,
        answer_summary,
        answer_json,
        sources_json,
        trace_json,
        metadata
      )
      VALUES (
        NULLIF($1::text, '')::uuid,
        NULLIF($2::text, '')::uuid,
        $3::text,
        $4::text,
        $5::text,
        $6::text,
        $7::text,
        $8::text,
        $9::numeric,
        $10::int,
        $11::int,
        $12::int,
        $13::int,
        $14::boolean,
        $15::boolean,
        $16::boolean,
        $17::boolean,
        $18::boolean,
        $19::text,
        $20::text,
        $21::jsonb,
        $22::jsonb,
        $23::jsonb,
        $24::jsonb
      )
      RETURNING *
      `,
      [
        tenantId || '',
        userId || '',
        question,
        normalizeQuestion(question),
        req.body?.intent || null,
        sourceLevel,
        req.body?.source_label || 'Mejor esfuerzo controlado',
        confidence,
        req.body?.confidence_score ?? null,
        Number(req.body?.tenant_hits || 0),
        Number(req.body?.knowledge_hits || 0),
        Number(req.body?.benchmark_hits || 0),
        Number(req.body?.external_hits || 0),
        req.body?.used_tenant_internal === true,
        req.body?.used_tcdx_knowledge === true,
        req.body?.used_anonymized_benchmark === true,
        req.body?.used_external_lookup === true,
        req.body?.must_review_by_human === true,
        req.body?.final_strategy || null,
        req.body?.answer_summary || null,
        JSON.stringify(req.body?.answer_json || {}),
        JSON.stringify(Array.isArray(req.body?.sources_json) ? req.body.sources_json : []),
        JSON.stringify(req.body?.trace_json || {}),
        JSON.stringify(req.body?.metadata || {}),
      ]
    );

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('ERROR CREATE AI TRACE:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error registrando trazabilidad IA',
      detail: error.message,
    });
  }
});

// =====================================================
// GET /api/ai-traces
// Lista trazas IA. Superadmin puede filtrar tenant_id.
// Usuario normal solo ve su tenant.
// =====================================================
router.get('/', auth, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const isPlatform = isPlatformRole(role);

    const userTenantId =
      req.user?.tenant_id ||
      req.user?.tenantId ||
      null;

    const queryTenantId = req.query?.tenant_id
      ? String(req.query.tenant_id)
      : null;

    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);

    const params = [];
    const conditions = [];

    if (isPlatform && queryTenantId) {
      params.push(queryTenantId);
      conditions.push(`tenant_id = $${params.length}::uuid`);
    }

    if (!isPlatform) {
      if (!userTenantId) {
        return res.status(400).json({
          ok: false,
          error: 'El usuario no tiene tenant_id asociado',
        });
      }

      params.push(userTenantId);
      conditions.push(`tenant_id = $${params.length}::uuid`);
    }

    if (req.query?.source_level) {
      params.push(String(req.query.source_level));
      conditions.push(`source_level = $${params.length}::text`);
    }

    if (req.query?.confidence) {
      params.push(normalizeConfidence(req.query.confidence));
      conditions.push(`confidence = $${params.length}::text`);
    }

    params.push(limit);

    const whereSql = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        user_id,
        question,
        intent,
        source_level,
        source_label,
        confidence,
        confidence_score,
        tenant_hits,
        knowledge_hits,
        benchmark_hits,
        external_hits,
        used_tenant_internal,
        used_tcdx_knowledge,
        used_anonymized_benchmark,
        used_external_lookup,
        must_review_by_human,
        final_strategy,
        answer_summary,
        answer_json,
        sources_json,
        trace_json,
        metadata,
        created_at
      FROM ai_core.ai_response_traces
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${params.length}
      `,
      params
    );

    return res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR LIST AI TRACES:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error listando trazabilidad IA',
      detail: error.message,
    });
  }
});

// =====================================================
// GET /api/ai-traces/:id
// Lee una traza específica.
// =====================================================
router.get('/:id', auth, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const isPlatform = isPlatformRole(role);

    const userTenantId =
      req.user?.tenant_id ||
      req.user?.tenantId ||
      null;

    const result = await pool.query(
      `
      SELECT *
      FROM ai_core.ai_response_traces
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [req.params.id]
    );

    const trace = result.rows[0];

    if (!trace) {
      return res.status(404).json({
        ok: false,
        error: 'Traza IA no encontrada',
      });
    }

    if (!isPlatform && String(trace.tenant_id) !== String(userTenantId)) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a esta traza IA',
      });
    }

    return res.json({
      ok: true,
      data: trace,
    });
  } catch (error) {
    console.error('ERROR GET AI TRACE:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo traza IA',
      detail: error.message,
    });
  }
});

module.exports = router;
