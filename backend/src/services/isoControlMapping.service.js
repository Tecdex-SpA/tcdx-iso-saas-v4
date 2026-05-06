const pool = require('../config/db');

const ALLOWED_VERSION_KEYS = new Set([
  'ISO9001:2015',
  'ISO9001:2026_FDIS',
  'ISO27001:2022',
  'ISO42001:2023',
]);

const ALLOWED_STANDARDS = new Set(['ISO9001', 'ISO27001', 'ISO42001']);

const STANDARD_ALIASES = {
  ISO9001: ['ISO9001', 'ISOIEC9001', '9001'],
  ISO27001: ['ISO27001', 'ISOIEC27001', '27001'],
  ISO42001: ['ISO42001', 'ISOIEC42001', '42001'],
};

const AUTO_APPLY_VERSION_KEYS = new Set([
  'ISO9001:2015',
  'ISO27001:2022',
]);

const AUTO_APPLY_RELATIONSHIP_TYPES = new Set([
  'equivalent',
  'partial',
  'supports',
  'related',
  'legacy_catalog',
]);

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeStandardCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('ISO/IEC', 'ISO')
    .replace('ISO-', 'ISO');
}

function normalizeVersionCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeComparable(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeUuidOrNull(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function assertStandard(standardCode) {
  const normalized = normalizeStandardCode(standardCode);

  if (!ALLOWED_STANDARDS.has(normalized)) {
    throw publicError(400, 'ISO_STANDARD_NOT_ALLOWED', 'Norma ISO no soportada en esta fase');
  }

  return normalized;
}

function assertVersion(standardCode, versionCode) {
  const normalizedStandard = assertStandard(standardCode);
  const normalizedVersion = normalizeVersionCode(versionCode);

  if (!ALLOWED_VERSION_KEYS.has(`${normalizedStandard}:${normalizedVersion}`)) {
    throw publicError(400, 'ISO_VERSION_NOT_ALLOWED', 'Version ISO no soportada en esta fase');
  }

  return {
    standardCode: normalizedStandard,
    versionCode: normalizedVersion,
  };
}

function canAutoApplyVersion(standardCode, versionCode) {
  return AUTO_APPLY_VERSION_KEYS.has(`${standardCode}:${versionCode}`);
}

function sanitizeConfidence(value, fallback = 0.75) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(0.99, parsed));
}

function addWhere(filters, values, columnName, value, normalizer = (x) => x) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return;
  }

  values.push(normalizer(value));
  filters.push(`${columnName} = $${values.length}`);
}

async function listCoverage(filters = {}) {
  const where = [];
  const values = [];

  addWhere(where, values, 'standard_code', filters.standard_code, assertStandard);
  addWhere(where, values, 'version_code', filters.version_code, normalizeVersionCode);

  const result = await pool.query(
    `
    SELECT
      standard_code,
      version_code,
      total_iso_controls,
      linked_iso_controls,
      unlinked_iso_controls,
      linked_catalog_controls,
      coverage_pct,
      equivalent_links,
      partial_links,
      related_links,
      transition_links,
      needs_review_count
    FROM v_iso_control_catalog_coverage
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY standard_code, version_code
    `,
    values
  );

  return result.rows;
}

async function listUnlinkedIsoControls(filters = {}) {
  const where = [];
  const values = [];

  addWhere(where, values, 'standard_code', filters.standard_code, assertStandard);
  addWhere(where, values, 'version_code', filters.version_code, normalizeVersionCode);

  const result = await pool.query(
    `
    SELECT
      iso_control_id,
      standard_code,
      version_code,
      control_code,
      title,
      clause_code,
      domain,
      default_priority
    FROM v_iso_controls_without_catalog_link
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY standard_code, version_code, control_code
    `,
    values
  );

  return result.rows;
}

async function listUnlinkedCatalogControls(filters = {}) {
  const where = ['tenant_id IS NULL'];
  const values = [];

  if (filters.standard_code) {
    const normalized = assertStandard(filters.standard_code);
    const aliases = STANDARD_ALIASES[normalized] || [normalized];
    values.push(aliases);
    where.push(`
      (
        regexp_replace(upper(coalesce(catalog_standard_code, '')), '[^A-Z0-9]', '', 'g') = ANY($${values.length}::text[])
        OR regexp_replace(upper(coalesce(catalog_iso, '')), '[^A-Z0-9]', '', 'g') = ANY($${values.length}::text[])
      )
    `);
  }

  if (filters.iso) {
    values.push(normalizeComparable(filters.iso));
    where.push(`regexp_replace(upper(coalesce(catalog_iso, '')), '[^A-Z0-9]', '', 'g') = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      catalog_control_id,
      catalog_iso,
      catalog_standard_code,
      clause,
      category,
      description,
      source_type,
      is_active
    FROM v_catalog_controls_without_iso_link
    WHERE ${where.join(' AND ')}
    ORDER BY catalog_iso NULLS LAST, catalog_standard_code NULLS LAST, clause NULLS LAST, category NULLS LAST
    LIMIT 500
    `,
    values
  );

  return result.rows;
}

async function listCatalogLinks(filters = {}) {
  const where = ['l.is_active IS DISTINCT FROM false'];
  const values = [];

  addWhere(where, values, 'l.standard_code', filters.standard_code, assertStandard);
  addWhere(where, values, 'l.version_code', filters.version_code, normalizeVersionCode);
  addWhere(where, values, 'l.relationship_type', filters.relationship_type, (value) => String(value || '').trim());

  if (filters.min_confidence !== undefined && filters.min_confidence !== null && String(filters.min_confidence).trim() !== '') {
    values.push(sanitizeConfidence(filters.min_confidence, 0));
    where.push(`l.confidence >= $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      l.id,
      l.iso_control_id,
      ic.control_code,
      ic.title,
      l.catalog_control_id,
      l.standard_code,
      l.version_code,
      l.catalog_iso,
      l.catalog_clause,
      l.relationship_type,
      l.confidence,
      l.mapping_source,
      l.notes,
      l.created_at,
      l.updated_at
    FROM iso_control_catalog_links l
    JOIN iso_controls ic
      ON ic.id = l.iso_control_id
    WHERE ${where.join(' AND ')}
    ORDER BY l.standard_code, l.version_code, ic.control_code, l.confidence DESC
    `,
    values
  );

  return result.rows;
}

async function listSyncStatus() {
  const result = await pool.query(`
    SELECT
      standard_code,
      version_code,
      sync_target,
      sync_status,
      linked_controls_count,
      total_iso_controls_count,
      coverage_pct,
      notes,
      updated_at
    FROM v_iso_catalog_sync_summary
    ORDER BY standard_code, version_code, sync_target
  `);

  return result.rows;
}

function deriveKeywords(control) {
  const text = normalizeToken([
    control.control_code,
    control.title,
    control.description,
    control.domain,
    control.control_type,
  ].filter(Boolean).join(' '));

  const keywords = new Set();
  const add = (items) => items.forEach((item) => keywords.add(normalizeToken(item)));

  for (const rawWord of text.split(/[^a-z0-9]+/).filter((word) => word.length >= 5)) {
    keywords.add(rawWord);
  }

  if (text.includes('proveedor') || text.includes('supplier')) add(['proveedor', 'proveedores', 'supplier']);
  if (text.includes('document')) add(['documento', 'documentada', 'documental', 'document']);
  if (text.includes('auditor')) add(['auditoria', 'auditoria interna', 'audit']);
  if (text.includes('riesgo') || text.includes('risk')) add(['riesgo', 'riesgos', 'risk']);
  if (text.includes('acceso') || text.includes('identidad')) add(['acceso', 'identidad', 'privilegio', 'access']);
  if (text.includes('backup') || text.includes('respaldo')) add(['backup', 'respaldo', 'restauracion']);
  if (text.includes('vulnerabilidad')) add(['vulnerabilidad', 'vulnerabilidades', 'vulnerability']);
  if (text.includes('incidente')) add(['incidente', 'incidentes', 'incident']);
  if (text.includes('activo')) add(['activo', 'activos', 'asset']);
  if (text.includes('cifrado')) add(['cifrado', 'encryption']);
  if (text.includes('monitoreo') || text.includes('seguimiento')) add(['monitoreo', 'seguimiento', 'logs']);
  if (text.includes('politica')) add(['politica', 'policy']);
  if (text.includes('objetivo')) add(['objetivo', 'indicador', 'kpi']);
  if (text.includes('contexto')) add(['contexto', 'partes interesadas']);
  if (text.includes('alcance')) add(['alcance', 'scope']);
  if (text.includes('competencia')) add(['competencia', 'formacion', 'capacitacion']);
  if (text.includes('direccion')) add(['direccion', 'revision por la direccion', 'management review']);
  if (text.includes('no conform')) add(['no conformidad', 'accion correctiva', 'correctiva']);
  if (text.includes('supervision')) add(['supervision humana', 'supervision']);
  if (text.includes('transparen')) add(['transparencia', 'explicabilidad']);
  if (text.includes('sesgo')) add(['sesgo', 'bias']);
  if (text.includes('generativa')) add(['ia generativa', 'generativa']);

  return Array.from(keywords).filter(Boolean).slice(0, 30);
}

function clauseMatches(isoClause, catalogClause) {
  const isoValue = normalizeComparable(isoClause);
  const catalogValue = normalizeComparable(catalogClause);

  if (!isoValue || !catalogValue) return false;
  return catalogValue === isoValue || catalogValue.startsWith(isoValue);
}

function scoreCandidate({ control, catalog, keywords }) {
  const catalogText = normalizeToken([
    catalog.catalog_iso,
    catalog.catalog_clause,
    catalog.catalog_category,
    catalog.catalog_description,
  ].filter(Boolean).join(' '));
  const domain = normalizeToken(control.domain);
  const matchingKeywords = keywords.filter((keyword) => keyword && catalogText.includes(keyword));
  const clauseMatch = clauseMatches(control.clause_code, catalog.catalog_clause);

  if (!clauseMatch && matchingKeywords.length === 0) {
    return null;
  }

  let confidence = 0.55;

  if (clauseMatch) confidence += 0.2;
  confidence += Math.min(0.21, matchingKeywords.length * 0.07);

  if (domain && normalizeToken(catalog.catalog_category).includes(domain)) {
    confidence += 0.04;
  }

  if (normalizeToken(catalog.catalog_description).includes(normalizeToken(control.title))) {
    confidence += 0.05;
  }

  let relationshipType = 'related';

  if (control.version_code === '2026_FDIS') {
    confidence = Math.min(confidence, 0.8);
    relationshipType = 'transition';
  } else if (confidence >= 0.93 && clauseMatch && matchingKeywords.length >= 3) {
    relationshipType = 'equivalent';
  } else if (confidence >= 0.85) {
    relationshipType = 'partial';
  }

  return {
    confidence: Number(Math.min(0.95, confidence).toFixed(2)),
    relationshipType,
    clauseMatch,
    matchingKeywords,
  };
}

async function fetchIsoControls(standardCode, versionCode) {
  const result = await pool.query(
    `
    SELECT
      ic.id,
      ic.standard_code,
      ic.version_code,
      ic.control_code,
      ic.title,
      ic.description,
      ic.control_type,
      ic.domain,
      cl.clause_code
    FROM iso_controls ic
    LEFT JOIN iso_clauses cl
      ON cl.id = ic.clause_id
    WHERE ic.standard_code = $1
      AND ic.version_code = $2
      AND ic.is_active IS DISTINCT FROM false
    ORDER BY ic.control_code
    `,
    [standardCode, versionCode]
  );

  return result.rows;
}

async function fetchCatalogControls(standardCode) {
  const aliases = STANDARD_ALIASES[standardCode] || [standardCode];
  const result = await pool.query(
    `
    WITH catalog_standards AS (
      SELECT
        control_id,
        array_agg(DISTINCT standard_code) FILTER (WHERE standard_code IS NOT NULL) AS standard_codes
      FROM controls_catalog_standards
      GROUP BY control_id
    )
    SELECT
      cc.id AS catalog_control_id,
      cc.iso AS catalog_iso,
      cc.clause AS catalog_clause,
      cc.category AS catalog_category,
      cc.description AS catalog_description,
      cc.source_type,
      COALESCE(cs.standard_codes, ARRAY[]::text[]) AS catalog_standard_codes
    FROM controls_catalog cc
    LEFT JOIN catalog_standards cs
      ON cs.control_id = cc.id
    WHERE cc.is_active IS DISTINCT FROM false
      AND cc.tenant_id IS NULL
      AND (
        regexp_replace(upper(coalesce(cc.iso, '')), '[^A-Z0-9]', '', 'g') = ANY($1::text[])
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(cs.standard_codes, ARRAY[]::text[])) s(value)
          WHERE regexp_replace(upper(s.value), '[^A-Z0-9]', '', 'g') = ANY($1::text[])
        )
      )
    ORDER BY cc.iso NULLS LAST, cc.clause NULLS LAST, cc.category NULLS LAST, cc.id
    `,
    [aliases]
  );

  return result.rows;
}

async function fetchEquivalentConflicts(catalogControlIds = []) {
  if (!catalogControlIds.length) return new Map();

  const result = await pool.query(
    `
    SELECT
      catalog_control_id,
      iso_control_id,
      relationship_type
    FROM iso_control_catalog_links
    WHERE catalog_control_id = ANY($1::uuid[])
      AND is_active IS DISTINCT FROM false
      AND relationship_type = 'equivalent'
    `,
    [catalogControlIds]
  );

  const map = new Map();

  for (const row of result.rows) {
    const key = String(row.catalog_control_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  return map;
}

async function getMappingSuggestions({
  standardCode,
  versionCode,
  minConfidence = 0.75,
} = {}) {
  const params = assertVersion(standardCode, versionCode);
  const threshold = sanitizeConfidence(minConfidence, 0.75);
  const [isoControls, catalogControls] = await Promise.all([
    fetchIsoControls(params.standardCode, params.versionCode),
    fetchCatalogControls(params.standardCode),
  ]);

  const bestSuggestions = [];

  for (const control of isoControls) {
    const keywords = deriveKeywords(control);
    let best = null;

    for (const catalog of catalogControls) {
      const score = scoreCandidate({ control, catalog, keywords });

      if (!score || score.confidence < threshold) continue;

      const suggestion = {
        iso_control_id: control.id,
        standard_code: control.standard_code,
        version_code: control.version_code,
        control_code: control.control_code,
        title: control.title,
        candidate_catalog_control_id: catalog.catalog_control_id,
        catalog_iso: catalog.catalog_iso,
        catalog_clause: catalog.catalog_clause,
        catalog_category: catalog.catalog_category,
        catalog_description: catalog.catalog_description,
        suggested_relationship_type: score.relationshipType,
        confidence: score.confidence,
        reason: [
          score.clauseMatch ? 'clause_match' : null,
          score.matchingKeywords.length ? `keywords:${score.matchingKeywords.slice(0, 6).join(',')}` : null,
        ].filter(Boolean).join('; ') || 'textual_similarity',
        can_auto_apply: false,
      };

      if (
        !best ||
        suggestion.confidence > best.confidence ||
        (
          suggestion.confidence === best.confidence &&
          String(suggestion.candidate_catalog_control_id) < String(best.candidate_catalog_control_id)
        )
      ) {
        best = suggestion;
      }
    }

    if (best) bestSuggestions.push(best);
  }

  const conflicts = await fetchEquivalentConflicts(
    bestSuggestions.map((item) => item.candidate_catalog_control_id)
  );

  return bestSuggestions
    .map((suggestion) => {
      const activeEquivalentConflicts = conflicts
        .get(String(suggestion.candidate_catalog_control_id)) || [];
      const hasEquivalentConflict = activeEquivalentConflicts.some(
        (link) => String(link.iso_control_id) !== String(suggestion.iso_control_id)
      );

      const isTransition9001 =
        suggestion.standard_code === 'ISO9001' &&
        suggestion.version_code === '2026_FDIS';
      const allowedAutoApplyVersion = canAutoApplyVersion(
        suggestion.standard_code,
        suggestion.version_code
      );
      const allowedRelationship = AUTO_APPLY_RELATIONSHIP_TYPES.has(
        suggestion.suggested_relationship_type
      );

      return {
        ...suggestion,
        can_auto_apply:
          suggestion.confidence >= 0.85 &&
          !hasEquivalentConflict &&
          allowedAutoApplyVersion &&
          allowedRelationship &&
          !isTransition9001,
        conflict_reason: hasEquivalentConflict
          ? 'catalog_control_has_active_equivalent_link'
          : (!allowedAutoApplyVersion ? 'standard_version_requires_human_review' : null),
      };
    })
    .sort((a, b) => {
      if (a.standard_code !== b.standard_code) return a.standard_code.localeCompare(b.standard_code);
      if (a.version_code !== b.version_code) return a.version_code.localeCompare(b.version_code);
      return a.control_code.localeCompare(b.control_code);
    });
}

async function updateControlsCatalogSyncStatus(client, standardCode, versionCode) {
  await client.query(
    `
    WITH coverage AS (
      SELECT
        ic.standard_code,
        ic.version_code,
        COUNT(DISTINCT ic.id)::integer AS total_iso_controls,
        COUNT(DISTINCT l.iso_control_id)::integer AS linked_iso_controls
      FROM iso_controls ic
      LEFT JOIN iso_control_catalog_links l
        ON l.iso_control_id = ic.id
       AND l.is_active IS DISTINCT FROM false
      WHERE ic.standard_code = $1
        AND ic.version_code = $2
        AND ic.is_active IS DISTINCT FROM false
      GROUP BY ic.standard_code, ic.version_code
    )
    INSERT INTO iso_catalog_sync_status (
      standard_code,
      version_code,
      sync_target,
      sync_status,
      linked_controls_count,
      total_iso_controls_count,
      notes,
      metadata
    )
    SELECT
      c.standard_code,
      c.version_code,
      'controls_catalog',
      CASE
        WHEN c.standard_code = 'ISO42001' AND c.linked_iso_controls < c.total_iso_controls THEN 'needs_review'
        WHEN c.version_code = '2026_FDIS' THEN
          CASE WHEN c.linked_iso_controls > 0 THEN 'partial' ELSE 'needs_review' END
        WHEN c.linked_iso_controls = 0 THEN 'not_started'
        WHEN c.linked_iso_controls >= c.total_iso_controls THEN 'complete'
        ELSE 'partial'
      END,
      c.linked_iso_controls,
      c.total_iso_controls,
      CASE
        WHEN c.version_code = '2026_FDIS' THEN 'ISO9001 2026_FDIS sigue como preparacion no certificable.'
        ELSE 'Estado actualizado por apply-suggestions fase 1.2.'
      END,
      jsonb_build_object('phase', '1.2', 'mapping_source', 'api_apply_suggestions')
    FROM coverage c
    ON CONFLICT (standard_code, version_code, sync_target)
    DO UPDATE SET
      sync_status = EXCLUDED.sync_status,
      linked_controls_count = EXCLUDED.linked_controls_count,
      total_iso_controls_count = EXCLUDED.total_iso_controls_count,
      notes = EXCLUDED.notes,
      metadata = EXCLUDED.metadata,
      updated_at = now()
    `,
    [standardCode, versionCode]
  );
}

function summarizeSuggestions(suggestions = [], appliedCount = 0) {
  const candidatesTotal = suggestions.length;
  const canAutoApply = suggestions.filter((item) => item.can_auto_apply).length;
  const conflicts = suggestions.filter((item) => item.conflict_reason).length;

  return {
    candidates_total: candidatesTotal,
    can_auto_apply: canAutoApply,
    would_apply: canAutoApply,
    applied: appliedCount,
    skipped: Math.max(candidatesTotal - canAutoApply, 0),
    conflicts,
  };
}

async function logApplyRun(clientOrPool, {
  standardCode,
  versionCode,
  dryRun,
  minConfidence,
  summary,
  requestedBy = null,
  requestedRole = null,
  requestPayload = {},
} = {}) {
  const executor = clientOrPool || pool;

  try {
    await executor.query(
      `
      INSERT INTO iso_control_mapping_apply_log (
        standard_code,
        version_code,
        dry_run,
        min_confidence,
        candidates_total,
        can_auto_apply_count,
        applied_count,
        skipped_count,
        conflict_count,
        requested_by,
        requested_role,
        request_payload,
        result_summary
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)
      `,
      [
        standardCode,
        versionCode,
        dryRun === true,
        minConfidence,
        summary?.candidates_total || 0,
        summary?.can_auto_apply || 0,
        summary?.applied || 0,
        summary?.skipped || 0,
        summary?.conflicts || 0,
        normalizeUuidOrNull(requestedBy),
        requestedRole || null,
        JSON.stringify(requestPayload || {}),
        JSON.stringify(summary || {}),
      ]
    );
  } catch (error) {
    if (error.code === '42P01') {
      console.warn('iso_control_mapping_apply_log no existe; omitiendo log de apply-suggestions');
      return;
    }

    throw error;
  }
}

async function getReviewQueue({
  standardCode,
  versionCode,
  minConfidence = 0.75,
  maxConfidence = null,
  includeAutoApplicable = false,
} = {}) {
  const params = standardCode && versionCode
    ? assertVersion(standardCode, versionCode)
    : {
        standardCode: standardCode ? assertStandard(standardCode) : null,
        versionCode: versionCode ? normalizeVersionCode(versionCode) : null,
      };
  const threshold = sanitizeConfidence(minConfidence, 0.75);
  const maxThreshold = maxConfidence === null || maxConfidence === undefined || String(maxConfidence).trim() === ''
    ? null
    : sanitizeConfidence(maxConfidence, 0.99);
  const pairs = params.standardCode && params.versionCode
    ? [params]
    : [
        { standardCode: 'ISO9001', versionCode: '2015' },
        { standardCode: 'ISO9001', versionCode: '2026_FDIS' },
        { standardCode: 'ISO27001', versionCode: '2022' },
        { standardCode: 'ISO42001', versionCode: '2023' },
      ].filter((pair) => {
        if (params.standardCode && pair.standardCode !== params.standardCode) return false;
        if (params.versionCode && pair.versionCode !== params.versionCode) return false;
        return true;
      });
  const rows = [];

  for (const pair of pairs) {
    const suggestions = await getMappingSuggestions({
      standardCode: pair.standardCode,
      versionCode: pair.versionCode,
      minConfidence: threshold,
    });

    for (const suggestion of suggestions) {
      if (!includeAutoApplicable && suggestion.can_auto_apply) continue;
      if (maxThreshold !== null && suggestion.confidence > maxThreshold) continue;

      rows.push({
        ...suggestion,
        review_reason: suggestion.conflict_reason ||
          (suggestion.can_auto_apply ? 'auto_applicable' : 'requires_human_review'),
      });
    }
  }

  return rows.sort((a, b) => {
    if (a.standard_code !== b.standard_code) return a.standard_code.localeCompare(b.standard_code);
    if (a.version_code !== b.version_code) return a.version_code.localeCompare(b.version_code);
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.control_code.localeCompare(b.control_code);
  });
}

async function getApplicationSummary() {
  const [coverage, syncStatus, linksByRelationship, linksBySource, unlinkedIso, unlinkedCatalog, recentRuns] = await Promise.all([
    listCoverage(),
    listSyncStatus(),
    pool.query(`
      SELECT
        standard_code,
        version_code,
        relationship_type,
        COUNT(*)::integer AS links
      FROM iso_control_catalog_links
      WHERE is_active IS DISTINCT FROM false
      GROUP BY standard_code, version_code, relationship_type
      ORDER BY standard_code, version_code, relationship_type
    `),
    pool.query(`
      SELECT
        standard_code,
        version_code,
        mapping_source,
        COUNT(*)::integer AS links
      FROM iso_control_catalog_links
      WHERE is_active IS DISTINCT FROM false
      GROUP BY standard_code, version_code, mapping_source
      ORDER BY standard_code, version_code, mapping_source
    `),
    pool.query(`
      SELECT
        standard_code,
        version_code,
        COUNT(*)::integer AS controls_without_link
      FROM v_iso_controls_without_catalog_link
      GROUP BY standard_code, version_code
      ORDER BY standard_code, version_code
    `),
    pool.query(`
      SELECT
        COALESCE(catalog_iso, catalog_standard_code, 'UNKNOWN') AS catalog_scope,
        COUNT(*)::integer AS controls_without_link
      FROM v_catalog_controls_without_iso_link
      WHERE tenant_id IS NULL
      GROUP BY COALESCE(catalog_iso, catalog_standard_code, 'UNKNOWN')
      ORDER BY catalog_scope
    `),
    pool.query(`
      SELECT
        standard_code,
        version_code,
        dry_run,
        min_confidence,
        candidates_total,
        can_auto_apply_count,
        applied_count,
        skipped_count,
        conflict_count,
        requested_by,
        requested_role,
        created_at
      FROM iso_control_mapping_apply_log
      ORDER BY created_at DESC
      LIMIT 10
    `).catch((error) => {
      if (error.code === '42P01') return { rows: [] };
      throw error;
    }),
  ]);

  return {
    coverage,
    sync_status: syncStatus,
    links_by_relationship_type: linksByRelationship.rows,
    links_by_mapping_source: linksBySource.rows,
    unlinked_iso_controls: unlinkedIso.rows,
    unlinked_catalog_controls: unlinkedCatalog.rows,
    recent_apply_runs: recentRuns.rows,
  };
}

async function applySuggestions({
  standardCode,
  versionCode,
  minConfidence = 0.85,
  dryRun = true,
  requestedBy = null,
  requestedRole = null,
  requestPayload = {},
} = {}) {
  const params = assertVersion(standardCode, versionCode);
  const threshold = sanitizeConfidence(minConfidence, 0.85);
  const suggestions = await getMappingSuggestions({
    standardCode: params.standardCode,
    versionCode: params.versionCode,
    minConfidence: threshold,
  });
  const applicable = suggestions.filter((suggestion) => suggestion.can_auto_apply);
  const baseSummary = summarizeSuggestions(suggestions, 0);

  if (dryRun !== false) {
    await logApplyRun(pool, {
      standardCode: params.standardCode,
      versionCode: params.versionCode,
      dryRun: true,
      minConfidence: threshold,
      summary: baseSummary,
      requestedBy,
      requestedRole,
      requestPayload,
    });

    return {
      success: true,
      dry_run: true,
      standard_code: params.standardCode,
      version_code: params.versionCode,
      min_confidence: threshold,
      summary: baseSummary,
      items: applicable,
    };
  }

  if (!canAutoApplyVersion(params.standardCode, params.versionCode)) {
    const blockedSummary = {
      ...baseSummary,
      would_apply: 0,
      applied: 0,
      skipped: suggestions.length,
    };

    await logApplyRun(pool, {
      standardCode: params.standardCode,
      versionCode: params.versionCode,
      dryRun: false,
      minConfidence: threshold,
      summary: blockedSummary,
      requestedBy,
      requestedRole,
      requestPayload: {
        ...requestPayload,
        blocked_reason: 'standard_version_requires_human_review',
      },
    });

    throw publicError(
      400,
      'ISO_MAPPING_APPLY_BLOCKED',
      'Esta norma/version requiere revision humana y no permite aplicacion automatica en esta fase'
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const suggestion of applicable) {
      await client.query(
        `
        INSERT INTO iso_control_catalog_links (
          iso_control_id,
          catalog_control_id,
          standard_code,
          version_code,
          control_code,
          catalog_iso,
          catalog_clause,
          relationship_type,
          confidence,
          mapping_source,
          notes,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'api_apply_suggestions',$10,true)
        ON CONFLICT (iso_control_id, catalog_control_id)
        DO UPDATE SET
          standard_code = EXCLUDED.standard_code,
          version_code = EXCLUDED.version_code,
          control_code = EXCLUDED.control_code,
          catalog_iso = EXCLUDED.catalog_iso,
          catalog_clause = EXCLUDED.catalog_clause,
          relationship_type = EXCLUDED.relationship_type,
          confidence = EXCLUDED.confidence,
          mapping_source = EXCLUDED.mapping_source,
          notes = EXCLUDED.notes,
          is_active = true,
          updated_at = now()
        `,
        [
          suggestion.iso_control_id,
          suggestion.candidate_catalog_control_id,
          suggestion.standard_code,
          suggestion.version_code,
          suggestion.control_code,
          suggestion.catalog_iso,
          suggestion.catalog_clause,
          suggestion.suggested_relationship_type,
          suggestion.confidence,
          suggestion.reason,
        ]
      );
    }

    await updateControlsCatalogSyncStatus(client, params.standardCode, params.versionCode);
    const appliedSummary = summarizeSuggestions(suggestions, applicable.length);
    await logApplyRun(client, {
      standardCode: params.standardCode,
      versionCode: params.versionCode,
      dryRun: false,
      minConfidence: threshold,
      summary: appliedSummary,
      requestedBy,
      requestedRole,
      requestPayload,
    });
    await client.query('COMMIT');

    return {
      success: true,
      dry_run: false,
      standard_code: params.standardCode,
      version_code: params.versionCode,
      min_confidence: threshold,
      summary: appliedSummary,
      items: applicable,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  normalizeStandardCode,
  normalizeVersionCode,
  listCoverage,
  listUnlinkedIsoControls,
  listUnlinkedCatalogControls,
  listCatalogLinks,
  listSyncStatus,
  getMappingSuggestions,
  getReviewQueue,
  getApplicationSummary,
  applySuggestions,
};
