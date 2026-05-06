const pool = require('../config/db');

const ALLOWED_VERSION_KEYS = new Set([
  'ISO9001:2015',
  'ISO9001:2026_FDIS',
  'ISO27001:2022',
  'ISO42001:2023',
]);

const ALLOWED_STANDARDS = new Set(['ISO9001', 'ISO27001', 'ISO42001']);

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

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
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
  const key = `${normalizedStandard}:${normalizedVersion}`;

  if (!ALLOWED_VERSION_KEYS.has(key)) {
    throw publicError(400, 'ISO_VERSION_NOT_ALLOWED', 'Version ISO no soportada en esta fase');
  }

  return {
    standardCode: normalizedStandard,
    versionCode: normalizedVersion,
  };
}

async function listStandards() {
  const result = await pool.query(`
    SELECT
      s.standard_code,
      s.display_name,
      s.family,
      s.description,
      s.is_active,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'version_code', v.version_code,
            'display_name', v.display_name,
            'publication_status', v.publication_status,
            'certifiable', v.certifiable,
            'replaces_version', v.replaces_version,
            'effective_from', v.effective_from,
            'transition_until', v.transition_until,
            'notes', v.notes,
            'is_active', v.is_active
          )
          ORDER BY v.version_code
        ) FILTER (WHERE v.id IS NOT NULL),
        '[]'::jsonb
      ) AS versions
    FROM iso_standards s
    LEFT JOIN iso_standard_versions v
      ON v.standard_id = s.id
     AND v.is_active = true
    WHERE s.is_active = true
    GROUP BY s.id
    ORDER BY s.standard_code
  `);

  return result.rows;
}

async function listVersions(standardCode) {
  const normalizedStandard = assertStandard(standardCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      display_name,
      publication_status,
      certifiable,
      replaces_version,
      effective_from,
      transition_until,
      source_policy,
      notes,
      is_active
    FROM iso_standard_versions
    WHERE standard_code = $1
      AND is_active = true
    ORDER BY version_code
    `,
    [normalizedStandard]
  );

  return result.rows;
}

async function listClauses(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      clause_code,
      title,
      summary,
      parent_clause_code,
      sort_order,
      is_required
    FROM iso_clauses
    WHERE standard_code = $1
      AND version_code = $2
    ORDER BY sort_order ASC, clause_code ASC
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listControls(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      c.id,
      c.standard_code,
      c.version_code,
      c.control_code,
      c.title,
      c.description,
      c.control_type,
      c.domain,
      c.default_priority,
      c.default_frequency,
      c.owner_role_suggested,
      c.copyright_safe_summary,
      c.is_active,
      jsonb_build_object(
        'id', cl.id,
        'clause_code', cl.clause_code,
        'title', cl.title,
        'summary', cl.summary
      ) AS clause
    FROM iso_controls c
    LEFT JOIN iso_clauses cl
      ON cl.id = c.clause_id
    WHERE c.standard_code = $1
      AND c.version_code = $2
      AND c.is_active = true
    ORDER BY COALESCE(cl.sort_order, 999999), c.control_code
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listEvidenceExpectations(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      e.id,
      e.standard_code,
      e.version_code,
      e.control_code,
      c.title AS control_title,
      e.evidence_name,
      e.evidence_type,
      e.description,
      e.required_level,
      e.freshness_days,
      e.validation_criteria,
      e.ai_review_guidance
    FROM iso_evidence_expectations e
    LEFT JOIN iso_controls c
      ON c.id = e.control_id
    WHERE e.standard_code = $1
      AND e.version_code = $2
    ORDER BY e.control_code, e.evidence_name
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listPolicyTemplates(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      template_code,
      title,
      objective,
      scope_guidance,
      sections_json,
      variables_json,
      related_control_codes,
      is_active
    FROM iso_policy_templates
    WHERE standard_code = $1
      AND version_code = $2
      AND is_active = true
    ORDER BY template_code
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listProcedureTemplates(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      template_code,
      title,
      objective,
      scope_guidance,
      steps_json,
      roles_json,
      records_json,
      related_control_codes,
      is_active
    FROM iso_procedure_templates
    WHERE standard_code = $1
      AND version_code = $2
      AND is_active = true
    ORDER BY template_code
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listRiskTemplates(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      risk_code,
      title,
      description,
      category,
      typical_causes,
      typical_consequences,
      suggested_controls,
      suggested_treatments,
      default_likelihood,
      default_impact
    FROM iso_risk_templates
    WHERE standard_code = $1
      AND version_code = $2
    ORDER BY risk_code
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listAuditQuestions(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      q.id,
      q.standard_code,
      q.version_code,
      c.control_code,
      c.title AS control_title,
      cl.clause_code,
      cl.title AS clause_title,
      q.question,
      q.expected_evidence,
      q.auditor_criteria,
      q.severity_if_missing
    FROM iso_audit_questions q
    LEFT JOIN iso_controls c
      ON c.id = q.control_id
    LEFT JOIN iso_clauses cl
      ON cl.id = q.clause_id
    WHERE q.standard_code = $1
      AND q.version_code = $2
    ORDER BY COALESCE(cl.sort_order, 999999), c.control_code, q.question
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listGapRules(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      rule_code,
      name,
      description,
      condition_json,
      severity,
      recommendation,
      creates_finding_suggestion,
      creates_action_suggestion
    FROM iso_gap_rules
    WHERE standard_code = $1
      AND version_code = $2
    ORDER BY rule_code
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listMaturityRules(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      maturity_level,
      name,
      criteria_json,
      min_score,
      max_score,
      recommendation
    FROM iso_maturity_rules
    WHERE standard_code = $1
      AND version_code = $2
    ORDER BY maturity_level
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listAiGuidance(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      guidance_type,
      system_instruction,
      evaluation_criteria,
      forbidden_claims,
      preferred_output_schema,
      locale
    FROM iso_ai_guidance
    WHERE standard_code = $1
      AND version_code = $2
    ORDER BY guidance_type, locale
    `,
    [params.standardCode, params.versionCode]
  );

  return result.rows;
}

async function listCrosswalks(filters = {}) {
  const values = [];
  const where = [];

  const filterMap = [
    ['source_standard_code', 'source_standard_code', assertStandard],
    ['source_version_code', 'source_version_code', normalizeVersionCode],
    ['target_standard_code', 'target_standard_code', assertStandard],
    ['target_version_code', 'target_version_code', normalizeVersionCode],
  ];

  for (const [queryKey, columnName, normalizer] of filterMap) {
    if (filters[queryKey]) {
      values.push(normalizer(filters[queryKey]));
      where.push(`${columnName} = $${values.length}`);
    }
  }

  const result = await pool.query(
    `
    SELECT
      id,
      source_standard_code,
      source_version_code,
      source_control_code,
      target_standard_code,
      target_version_code,
      target_control_code,
      relationship_type,
      reuse_evidence,
      notes
    FROM iso_control_mappings
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY
      source_standard_code,
      source_version_code,
      source_control_code,
      target_standard_code,
      target_version_code,
      target_control_code
    `,
    values
  );

  return result.rows;
}

async function getIso9001TransitionGuidance() {
  const result = await pool.query(`
    SELECT
      source_standard_code AS source_standard_code,
      source_version_code AS source_version_code,
      target_standard_code AS target_standard_code,
      target_version_code AS target_version_code,
      transition_status,
      certifiable_target,
      guidance_summary,
      recommended_actions,
      caveats
    FROM iso_transition_guidance
    WHERE source_standard_code = 'ISO9001'
      AND source_version_code = '2015'
      AND target_standard_code = 'ISO9001'
      AND target_version_code = '2026_FDIS'
    LIMIT 1
  `);

  if (!result.rowCount) {
    throw publicError(404, 'ISO_TRANSITION_NOT_FOUND', 'Guia de transicion no encontrada');
  }

  const row = result.rows[0];

  return {
    source: {
      standard_code: row.source_standard_code,
      version_code: row.source_version_code,
    },
    target: {
      standard_code: row.target_standard_code,
      version_code: row.target_version_code,
    },
    certifiable_target: row.certifiable_target,
    transition_status: row.transition_status,
    guidance_summary: row.guidance_summary,
    recommended_actions: row.recommended_actions || [],
    caveats: row.caveats || [],
  };
}

async function listCatalogLinks(standardCode, versionCode) {
  const params = assertVersion(standardCode, versionCode);
  const result = await pool.query(
    `
    SELECT
      l.iso_control_id,
      c.control_code,
      c.title,
      l.catalog_control_id,
      l.catalog_iso,
      l.catalog_clause,
      l.relationship_type,
      l.confidence,
      l.mapping_source,
      l.notes
    FROM iso_control_catalog_links l
    JOIN iso_controls c
      ON c.id = l.iso_control_id
    WHERE l.standard_code = $1
      AND l.version_code = $2
      AND l.is_active = true
    ORDER BY c.control_code, l.catalog_iso, l.catalog_clause
    `,
    [params.standardCode, params.versionCode]
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
      last_checked_at,
      linked_controls_count,
      total_iso_controls_count,
      notes,
      metadata
    FROM iso_catalog_sync_status
    ORDER BY standard_code, version_code, sync_target
  `);

  return result.rows;
}

module.exports = {
  normalizeStandardCode,
  normalizeVersionCode,
  listStandards,
  listVersions,
  listClauses,
  listControls,
  listEvidenceExpectations,
  listPolicyTemplates,
  listProcedureTemplates,
  listRiskTemplates,
  listAuditQuestions,
  listGapRules,
  listMaturityRules,
  listAiGuidance,
  listCrosswalks,
  getIso9001TransitionGuidance,
  listCatalogLinks,
  listSyncStatus,
};
