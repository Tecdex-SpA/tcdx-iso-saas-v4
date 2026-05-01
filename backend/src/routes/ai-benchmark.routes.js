const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { errorDetail } = require('../utils/errorResponse');

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isPlatformRole(role) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'global_admin',
    'admin_global',
    'owner',
  ].includes(normalizeRole(role));
}

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || null;
}

function cleanQuery(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s./:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(name || ''))) {
    throw new Error(`Identificador SQL inválido: ${name}`);
  }

  return `"${name}"`;
}

async function getColumns(client, tableName, schema = 'public') {
  const result = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
    `,
    [schema, tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function tableExists(client, tableName, schema = 'public') {
  const result = await client.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name = $2
    LIMIT 1
    `,
    [schema, tableName]
  );

  return result.rowCount > 0;
}

function existingColumns(cols, candidates) {
  return candidates.filter((candidate) => cols.has(candidate));
}

function textExpr(alias, cols, candidates, fallback = "''") {
  const existing = existingColumns(cols, candidates);

  if (existing.length === 0) return fallback;

  return `COALESCE(${existing.map((column) => `${alias}.${quoteIdent(column)}::text`).join(', ')}, ${fallback})`;
}

function buildConcatExpr(parts) {
  const safeParts = parts.filter(Boolean);

  if (safeParts.length === 0) return "''";

  return `concat_ws(' ', ${safeParts.join(', ')})`;
}

function detectStandards(q) {
  const compact = String(q || '')
    .toUpperCase()
    .replace(/ISO\/IEC/g, 'ISO')
    .replace(/[^A-Z0-9]/g, '');

  const standards = [
    'ISO27001',
    'ISO9001',
    'ISO14001',
    'ISO14224',
    'ISO27017',
    'ISO27018',
    'ISO27701',
    'ISO20000',
    'ISO22301',
    'ISO31000',
    'ISO37301',
    'ISO50001',
    'ISO55002',
    'ISO17025',
    'ISO17020',
  ];

  return standards.filter((standard) => compact.includes(standard));
}

function buildRankExpr(searchDocExpr, standardExpr) {
  return `
    (
      CASE
        WHEN cardinality($5::text[]) > 0
         AND regexp_replace(replace(upper(coalesce(${standardExpr}, '')), 'ISO/IEC', 'ISO'), '[^A-Z0-9]', '', 'g') = ANY($5::text[])
        THEN 12 ELSE 0
      END
      +
      CASE
        WHEN unaccent(lower(${searchDocExpr})) ILIKE '%' || unaccent(lower($2)) || '%' THEN 10
        ELSE 0
      END
      +
      COALESCE(similarity(unaccent(lower(${searchDocExpr})), unaccent(lower($2))), 0) * 10
    )
  `;
}

async function searchControlPatterns(client, tenantId, q, limit, minTenants, standards) {
  const hasTenantControls = await tableExists(client, 'tenant_controls');
  const hasCatalog = await tableExists(client, 'controls_catalog');

  if (!hasTenantControls || !hasCatalog) return [];

  const tcCols = await getColumns(client, 'tenant_controls');
  const ccCols = await getColumns(client, 'controls_catalog');

  if (!tcCols.has('tenant_id') || !tcCols.has('control_id') || !ccCols.has('id')) {
    return [];
  }

  const standardExpr = textExpr('cc', ccCols, ['iso', 'standard_code', 'norma_key', 'norma']);
  const controlRefExpr = textExpr('cc', ccCols, ['clause', 'clausula', 'clausula_o_control', 'control_code', 'code', 'number']);
  const titleExpr = textExpr('cc', ccCols, ['title', 'titulo', 'name', 'control_name', 'display_name']);
  const descExpr = textExpr('cc', ccCols, ['description', 'descripcion', 'descripcion_resumen', 'control_description', 'objective']);
  const statusExpr = textExpr('tc', tcCols, ['status', 'health_status', 'applicability']);
  const scoreExpr = tcCols.has('score') ? `COALESCE(tc."score", 0)::numeric` : `0::numeric`;

  const searchDoc = buildConcatExpr([
    standardExpr,
    controlRefExpr,
    titleExpr,
    descExpr,
    statusExpr,
  ]);

  const rankExpr = buildRankExpr(searchDoc, standardExpr);

  const sql = `
    WITH raw AS (
      SELECT
        ${standardExpr} AS standard_code,
        ${controlRefExpr} AS control_ref,
        COALESCE(NULLIF(${titleExpr}, ''), NULLIF(${descExpr}, ''), 'Patrón de control') AS pattern_label,
        ${statusExpr} AS status,
        ${scoreExpr} AS score,
        tc."tenant_id" AS tenant_id,
        ${rankExpr} AS rank_score
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON cc."id" = tc."control_id"
      WHERE tc."tenant_id" <> $1::uuid
        AND (
          COALESCE($2, '') = ''
          OR unaccent(lower(${searchDoc})) ILIKE '%' || unaccent(lower($2)) || '%'
          OR similarity(unaccent(lower(${searchDoc})), unaccent(lower($2))) > 0.04
        )
    )
    SELECT
      'control_pattern'::text AS benchmark_type,
      standard_code,
      control_ref,
      pattern_label,
      COUNT(DISTINCT tenant_id)::int AS tenant_sample_size,
      COUNT(*)::int AS occurrences,
      COUNT(*) FILTER (WHERE lower(status) IN ('cumple','saludable','ok','cerrado','closed'))::int AS positive_count,
      COUNT(*) FILTER (WHERE lower(status) IN ('parcial','atencion','atención','pendiente','en proceso'))::int AS attention_count,
      COUNT(*) FILTER (WHERE lower(status) IN ('no cumple','deteriorado','abierta','open','critico','crítico'))::int AS negative_count,
      ROUND(AVG(score)::numeric, 2) AS avg_score,
      MAX(rank_score)::numeric AS rank_score
    FROM raw
    GROUP BY standard_code, control_ref, pattern_label
    HAVING COUNT(DISTINCT tenant_id) >= $3::int
    ORDER BY rank_score DESC, tenant_sample_size DESC, occurrences DESC
    LIMIT $4
  `;

  const result = await client.query(sql, [
    tenantId,
    q,
    minTenants,
    limit,
    standards,
  ]);

  return result.rows;
}

async function searchEvidencePatterns(client, tenantId, q, limit, minTenants, standards) {
  const exists = await tableExists(client, 'evidence_knowledge_chunks');
  if (!exists) return [];

  const cols = await getColumns(client, 'evidence_knowledge_chunks');

  if (!cols.has('tenant_id')) return [];

  const standardExpr = cols.has('standard_code')
    ? `COALESCE(ekc."standard_code"::text, '')`
    : "''";

  const clauseExpr = cols.has('clause')
    ? `COALESCE(ekc."clause"::text, '')`
    : "''";

  const chunkTypeExpr = cols.has('chunk_type')
    ? `COALESCE(ekc."chunk_type"::text, 'evidence')`
    : "'evidence'";

  const metadataExpr = cols.has('metadata_json')
    ? `COALESCE(ekc."metadata_json"::text, '')`
    : "''";

  const approvedExpr = cols.has('is_approved_signal')
    ? `COALESCE(ekc."is_approved_signal", false)`
    : `false`;

  const negativeExpr = cols.has('is_negative_signal')
    ? `COALESCE(ekc."is_negative_signal", false)`
    : `false`;

  const searchDoc = buildConcatExpr([
    standardExpr,
    clauseExpr,
    chunkTypeExpr,
    metadataExpr,
  ]);

  const rankExpr = buildRankExpr(searchDoc, standardExpr);

  const sql = `
    WITH raw AS (
      SELECT
        ${standardExpr} AS standard_code,
        ${clauseExpr} AS control_ref,
        ${chunkTypeExpr} AS pattern_label,
        ${approvedExpr} AS approved_signal,
        ${negativeExpr} AS negative_signal,
        ekc."tenant_id" AS tenant_id,
        ${rankExpr} AS rank_score
      FROM evidence_knowledge_chunks ekc
      WHERE ekc."tenant_id" <> $1::uuid
        AND (
          COALESCE($2, '') = ''
          OR unaccent(lower(${searchDoc})) ILIKE '%' || unaccent(lower($2)) || '%'
          OR similarity(unaccent(lower(${searchDoc})), unaccent(lower($2))) > 0.04
        )
    )
    SELECT
      'evidence_pattern'::text AS benchmark_type,
      standard_code,
      control_ref,
      pattern_label,
      COUNT(DISTINCT tenant_id)::int AS tenant_sample_size,
      COUNT(*)::int AS occurrences,
      COUNT(*) FILTER (WHERE approved_signal = true)::int AS positive_count,
      0::int AS attention_count,
      COUNT(*) FILTER (WHERE negative_signal = true)::int AS negative_count,
      NULL::numeric AS avg_score,
      MAX(rank_score)::numeric AS rank_score
    FROM raw
    GROUP BY standard_code, control_ref, pattern_label
    HAVING COUNT(DISTINCT tenant_id) >= $3::int
    ORDER BY rank_score DESC, tenant_sample_size DESC, occurrences DESC
    LIMIT $4
  `;

  const result = await client.query(sql, [
    tenantId,
    q,
    minTenants,
    limit,
    standards,
  ]);

  return result.rows;
}


function detectBenchmarkIntent(q) {
  const normalized = normalizeText(q);

  return {
    wantsEvidence:
      /\b(evidencia|evidencias|registro|registros|documento|documentos|respaldo|trazabilidad)\b/.test(normalized),

    wantsNonconformity:
      /\b(no conformidad|no conformidades|nc|incumplimiento|incumplimientos)\b/.test(normalized),

    wantsAction:
      /\b(accion correctiva|acciones correctivas|accion|acciones|capa|causa raiz|causa raíz|remediacion|correccion)\b/.test(normalized),

    wantsFinding:
      /\b(hallazgo|hallazgos|observacion|observaciones|brecha|brechas)\b/.test(normalized),

    wantsRisk:
      /\b(riesgo|riesgos|amenaza|vulnerabilidad|impacto|probabilidad)\b/.test(normalized),

    wantsAccess:
      /\b(acceso|accesos|credencial|credenciales|privilegio|privilegios|rbac|autenticacion|autenticación)\b/.test(normalized),
  };
}

function buildBenchmarkTokens(q) {
  const stopwords = new Set([
    'para', 'como', 'cual', 'cuales', 'debo', 'debe', 'tener',
    'necesito', 'sobre', 'segun', 'según', 'iso', 'accion'
  ]);

  return normalizeText(q)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopwords.has(token))
    .slice(0, 12);
}

function applyBenchmarkIntentBoost(row, q) {
  const intent = detectBenchmarkIntent(q);
  const tokens = buildBenchmarkTokens(q);

  const haystack = normalizeText([
    row.benchmark_type,
    row.standard_code,
    row.control_ref,
    row.pattern_label,
  ].filter(Boolean).join(' '));

  let boost = 0;
  let tokenHits = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) tokenHits += 1;
  }

  if (intent.wantsEvidence) {
    if (row.benchmark_type === 'evidence_pattern') boost += 12;
    if (haystack.includes('evidencia') || haystack.includes('registro') || haystack.includes('documento')) boost += 5;
  }

  if (intent.wantsNonconformity) {
    if (haystack.includes('no conformidad') || haystack.includes('conformidades') || haystack.includes('incumplimiento')) boost += 14;
  }

  if (intent.wantsAction) {
    if (haystack.includes('accion correctiva') || haystack.includes('acciones correctivas') || haystack.includes('capa') || haystack.includes('correctiva')) boost += 14;
  }

  if (intent.wantsFinding) {
    if (haystack.includes('hallazgo') || haystack.includes('brecha') || haystack.includes('observacion')) boost += 10;
  }

  if (intent.wantsRisk) {
    if (haystack.includes('riesgo') || haystack.includes('amenaza') || haystack.includes('vulnerabilidad')) boost += 8;
  }

  if (intent.wantsAccess) {
    if (haystack.includes('acceso') || haystack.includes('rbac') || haystack.includes('credencial')) boost += 12;
  }

  const tokenBoost = tokenHits * 2.5;

  let tokenPenalty = 0;
  if (tokens.length >= 2 && tokenHits === 0) tokenPenalty = 6;

  const rank = Math.max(
    0,
    Number(row.rank_score || 0) + boost + tokenBoost - tokenPenalty
  );

  return {
    ...row,
    base_rank_score: Number(row.rank_score || 0),
    rank_score: rank,
    benchmark_intent_boost: boost,
    benchmark_token_hits: tokenHits,
    benchmark_token_penalty: tokenPenalty,
  };
}


function buildBenchmarkGuidance(rows) {
  const top = rows.slice(0, 5);

  return top.map((row) => ({
    benchmark_type: row.benchmark_type,
    standard_code: row.standard_code || null,
    control_ref: row.control_ref || null,
    pattern_label: row.pattern_label || 'Patrón anonimizado',
    tenant_sample_size: Number(row.tenant_sample_size || 0),
    occurrences: Number(row.occurrences || 0),
    status_distribution: {
      positive: Number(row.positive_count || 0),
      attention: Number(row.attention_count || 0),
      negative: Number(row.negative_count || 0),
    },
    avg_score: row.avg_score !== null && row.avg_score !== undefined
      ? Number(row.avg_score)
      : null,
    rank_score: Number(row.rank_score || 0),
    base_rank_score: Number(row.base_rank_score || 0),
    benchmark_intent_boost: Number(row.benchmark_intent_boost || 0),
    benchmark_token_hits: Number(row.benchmark_token_hits || 0),
    benchmark_token_penalty: Number(row.benchmark_token_penalty || 0),
  }));
}

async function benchmarkSearch({ tenantId, q, limit = 12, minTenants = 2 }) {
  const client = await pool.connect();

  try {
    const cleanQ = cleanQuery(q);
    const standards = detectStandards(cleanQ);

    const safeLimit = Math.max(1, Math.min(Number(limit || 12), 50));
    const safeMinTenants = Math.max(1, Math.min(Number(minTenants || 2), 10));

    const [controlPatterns, evidencePatterns] = await Promise.all([
      searchControlPatterns(client, tenantId, cleanQ, safeLimit, safeMinTenants, standards),
      searchEvidencePatterns(client, tenantId, cleanQ, safeLimit, safeMinTenants, standards),
    ]);

    const rows = [...controlPatterns, ...evidencePatterns]
      .map((row) => applyBenchmarkIntentBoost(row, cleanQ))
      .sort((a, b) => Number(b.rank_score || 0) - Number(a.rank_score || 0))
      .slice(0, safeLimit);

    const topRank = Number(rows[0]?.rank_score || 0);
    const strongHits = rows.filter((row) => Number(row.rank_score || 0) >= 14).length;
    const mediumHits = rows.filter((row) => Number(row.rank_score || 0) >= 7).length;

    let confidence_hint = 'baja';
    if (topRank >= 20 && strongHits >= 2) confidence_hint = 'alta';
    else if (topRank >= 10 || mediumHits >= 2 || strongHits >= 1) confidence_hint = 'media';

    return {
      ok: true,
      source_level: 'anonymized_benchmark',
      source_label: 'Buenas prácticas anonimizadas',
      tenant_id: tenantId,
      query: cleanQ,
      normalized_query: normalizeText(cleanQ),
      detected_standards: standards,
      min_tenants: safeMinTenants,
      total: rows.length,
      strong_hits: strongHits,
      medium_hits: mediumHits,
      top_rank: topRank,
      confidence_hint,
      data: buildBenchmarkGuidance(rows),
      privacy_guardrails: {
        excludes_current_tenant: true,
        exposes_other_tenant_ids: false,
        exposes_company_names: false,
        exposes_users: false,
        exposes_raw_evidence_content: false,
        aggregation_min_tenants: safeMinTenants,
      },
    };
  } finally {
    client.release();
  }
}

async function handleBenchmark(req, res) {
  try {
    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const isPlatform = isPlatformRole(role);
    const userTenantId = getUserTenantId(req.user);

    const tenantId =
      req.query?.tenant_id ||
      req.body?.tenant_id ||
      userTenantId;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id requerido para benchmark anonimizado',
      });
    }

    if (!isPlatform && String(tenantId) !== String(userTenantId)) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes permiso para consultar benchmark de este tenant',
      });
    }

    const q = cleanQuery(req.query?.q || req.body?.q || req.body?.question || '');
    const limit = Number(req.query?.limit || req.body?.limit || 12);

    // Producción: usuarios tenant no pueden bajar de 2 empresas.
    // Superadmin puede usar min_tenants=1 para pruebas controladas.
    const requestedMinTenants = Number(req.query?.min_tenants || req.body?.min_tenants || 2);
    const minTenants = isPlatform
      ? requestedMinTenants
      : Math.max(2, requestedMinTenants);

    const result = await benchmarkSearch({
      tenantId,
      q,
      limit,
      minTenants,
    });

    return res.json(result);
  } catch (error) {
    console.error('ERROR AI BENCHMARK SEARCH:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error ejecutando benchmark anonimizado',
      ...errorDetail(error),
    });
  }
}

router.get('/', auth, handleBenchmark);
router.post('/', auth, handleBenchmark);

module.exports = router;
module.exports.benchmarkSearch = benchmarkSearch;
