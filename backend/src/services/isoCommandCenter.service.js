const pool = require('../config/db');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const OPTIONAL_TABLES = [
  'iso_express_assessments',
  'iso_express_assessment_gaps',
  'iso_generated_documents',
  'iso_operational_suggestions',
  'iso_recommended_action_conversions',
  'iso_risk_matrix_items',
  'action_plans',
  'findings',
  'tenant_nonconformities',
  'v_iso_control_catalog_coverage',
];

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(normalizeRole(role));
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function resolveTenantId(user, requestedTenantId) {
  const role = user?.role || user?.user_role || user?.userRole;
  if (requestedTenantId && isPlatformRole(role)) return requestedTenantId;
  return getUserTenantId(user);
}

function assertTenantAccess(user, tenantId) {
  if (isPlatformRole(user?.role || user?.user_role || user?.userRole)) return;

  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
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

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, round2(value)));
}

function readinessLabel(score) {
  if (score >= 85) return 'listo';
  if (score >= 70) return 'avanzado';
  if (score >= 50) return 'en_progreso';
  return 'requiere_atencion';
}

function semaphoreFor({ score, publicationStatus, certifiable }) {
  if (publicationStatus === 'transition_prep' || certifiable === false) return 'transicion';
  if (score >= 75) return 'saludable';
  if (score >= 50) return 'atencion';
  return 'critico';
}

async function tableExists(tableName) {
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [tableName]
  );
  return result.rowCount > 0;
}

async function getExistingTables(notes) {
  const existing = new Set();

  await Promise.all(OPTIONAL_TABLES.map(async (tableName) => {
    if (await tableExists(tableName)) existing.add(tableName);
  }));

  OPTIONAL_TABLES
    .filter((tableName) => !existing.has(tableName))
    .forEach((tableName) => notes.push(`Fuente opcional no disponible: ${tableName}`));

  return existing;
}

async function queryRows(sql, params = [], notes, label, fallback = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    notes.push(`No se pudo consultar ${label}: ${error.code || error.message}`);
    return fallback;
  }
}

async function getTenantStandards(tenantId, notes) {
  return queryRows(
    `
    WITH active_standards AS (
      SELECT DISTINCT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active IS DISTINCT FROM false
    )
    SELECT
      v.standard_code,
      v.version_code,
      v.display_name,
      v.publication_status,
      v.certifiable,
      TRUE AS tenant_standard_active
    FROM active_standards a
    JOIN iso_standard_versions v
      ON v.standard_code = a.standard_code
     AND v.is_active = true
    ORDER BY v.standard_code, v.version_code
    `,
    [tenantId],
    notes,
    'normas activas del tenant'
  );
}

function keyOf(standardCode, versionCode) {
  return `${standardCode || ''}::${versionCode || ''}`;
}

function indexBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => map.set(keyFn(row), row));
  return map;
}

async function loadContext(tenantId, notes) {
  const existing = await getExistingTables(notes);
  const standards = await getTenantStandards(tenantId, notes);
  const standardKeys = standards.map((row) => keyOf(row.standard_code, row.version_code));

  const [
    coverageRows,
    assessmentRows,
    gapRows,
    riskRows,
    suggestionRows,
    conversionRows,
    documentRows,
    actionRows,
    findingRows,
    ncRows,
  ] = await Promise.all([
    existing.has('v_iso_control_catalog_coverage')
      ? queryRows(
        `
        SELECT *
        FROM v_iso_control_catalog_coverage
        `,
        [],
        notes,
        'cobertura iso/control catalog'
      )
      : [],
    existing.has('iso_express_assessments')
      ? queryRows(
        `
        SELECT DISTINCT ON (standard_code, version_code)
          id,
          standard_code,
          version_code,
          readiness_score,
          readiness_level,
          gaps_count,
          critical_gaps_count,
          high_gaps_count,
          created_at
        FROM iso_express_assessments
        WHERE tenant_id = $1::uuid
          AND assessment_status IS DISTINCT FROM 'archived'
        ORDER BY standard_code, version_code, created_at DESC
        `,
        [tenantId],
        notes,
        'diagnostico express'
      )
      : [],
    existing.has('iso_express_assessment_gaps')
      ? queryRows(
        `
        SELECT
          g.standard_code,
          g.version_code,
          COUNT(*)::integer AS gaps_count,
          COUNT(*) FILTER (WHERE g.severity IN ('critica','critico'))::integer AS critical_gaps_count,
          COUNT(*) FILTER (WHERE g.severity IN ('alta','alto'))::integer AS high_gaps_count
        FROM iso_express_assessment_gaps g
        JOIN iso_express_assessments a
          ON a.id = g.assessment_id
         AND a.tenant_id = g.tenant_id
        WHERE g.tenant_id = $1::uuid
          AND a.assessment_status IS DISTINCT FROM 'archived'
        GROUP BY g.standard_code, g.version_code
        `,
        [tenantId],
        notes,
        'brechas diagnostico'
      )
      : [],
    existing.has('iso_risk_matrix_items')
      ? queryRows(
        `
        SELECT
          standard_code,
          version_code,
          COUNT(*)::integer AS risks_count,
          COUNT(*) FILTER (WHERE residual_risk_level = 'critico')::integer AS critical_risks,
          COUNT(*) FILTER (WHERE residual_risk_level = 'alto')::integer AS high_risks,
          COUNT(*) FILTER (WHERE status = 'accepted')::integer AS accepted_risks
        FROM iso_risk_matrix_items
        WHERE tenant_id = $1::uuid
          AND status IS DISTINCT FROM 'archived'
        GROUP BY standard_code, version_code
        `,
        [tenantId],
        notes,
        'matriz de riesgos'
      )
      : [],
    existing.has('iso_operational_suggestions')
      ? queryRows(
        `
        SELECT
          standard_code,
          COUNT(*)::integer AS total_suggestions,
          COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending_suggestions,
          COUNT(*) FILTER (WHERE status IN ('applied','approved'))::integer AS converted_suggestions,
          COUNT(*) FILTER (WHERE priority = 'critica')::integer AS critical_suggestions,
          COUNT(*) FILTER (WHERE priority = 'alta')::integer AS high_suggestions
        FROM iso_operational_suggestions
        WHERE tenant_id = $1::uuid
          AND status IS DISTINCT FROM 'archived'
        GROUP BY standard_code
        `,
        [tenantId],
        notes,
        'acciones recomendadas'
      )
      : [],
    existing.has('iso_recommended_action_conversions')
      ? queryRows(
        `
        SELECT
          s.standard_code,
          COUNT(*)::integer AS conversions_count
        FROM iso_recommended_action_conversions c
        JOIN iso_operational_suggestions s
          ON s.id = c.recommendation_id
         AND s.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1::uuid
          AND c.conversion_status = 'converted'
        GROUP BY s.standard_code
        `,
        [tenantId],
        notes,
        'conversiones recomendadas'
      )
      : [],
    existing.has('iso_generated_documents')
      ? queryRows(
        `
        SELECT
          standard_code,
          version_code,
          COUNT(*)::integer AS documents_count,
          COUNT(*) FILTER (WHERE document_status = 'approved')::integer AS approved_documents
        FROM iso_generated_documents
        WHERE tenant_id = $1::uuid
          AND document_status IS DISTINCT FROM 'archived'
        GROUP BY standard_code, version_code
        `,
        [tenantId],
        notes,
        'documentos ISO'
      )
      : [],
    existing.has('action_plans')
      ? queryRows(
        `
        SELECT
          iso_code AS standard_code,
          COUNT(*)::integer AS open_action_plans,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE)::integer AS overdue_action_plans
        FROM action_plans
        WHERE tenant_id = $1::uuid
          AND status NOT IN ('completado','cancelado')
        GROUP BY iso_code
        `,
        [tenantId],
        notes,
        'planes de accion'
      )
      : [],
    existing.has('findings')
      ? queryRows(
        `
        SELECT
          iso_code AS standard_code,
          COUNT(*)::integer AS open_findings,
          COUNT(*) FILTER (WHERE severity = 'alta')::integer AS high_findings
        FROM findings
        WHERE tenant_id = $1::uuid
          AND status IS DISTINCT FROM 'cerrado'
        GROUP BY iso_code
        `,
        [tenantId],
        notes,
        'hallazgos'
      )
      : [],
    existing.has('tenant_nonconformities')
      ? queryRows(
        `
        SELECT
          cc.iso AS standard_code,
          COUNT(*)::integer AS open_nonconformities
        FROM tenant_nonconformities nc
        LEFT JOIN controls_catalog cc
          ON cc.id = nc.control_id
        WHERE nc.tenant_id = $1::uuid
          AND nc.status NOT IN ('resuelta','cerrada','cerrado')
        GROUP BY cc.iso
        `,
        [tenantId],
        notes,
        'no conformidades'
      )
      : [],
  ]);

  return {
    existing,
    standards,
    standardKeys,
    coverageByKey: indexBy(coverageRows, (row) => keyOf(row.standard_code, row.version_code)),
    assessmentsByKey: indexBy(assessmentRows, (row) => keyOf(row.standard_code, row.version_code)),
    gapsByKey: indexBy(gapRows, (row) => keyOf(row.standard_code, row.version_code)),
    risksByKey: indexBy(riskRows, (row) => keyOf(row.standard_code, row.version_code)),
    suggestionsByStandard: indexBy(suggestionRows, (row) => row.standard_code || ''),
    conversionsByStandard: indexBy(conversionRows, (row) => row.standard_code || ''),
    documentsByKey: indexBy(documentRows, (row) => keyOf(row.standard_code, row.version_code)),
    actionsByStandard: indexBy(actionRows, (row) => row.standard_code || ''),
    findingsByStandard: indexBy(findingRows, (row) => row.standard_code || ''),
    ncByStandard: indexBy(ncRows, (row) => row.standard_code || ''),
  };
}

function calculateReadiness({ coverage, assessment, gaps, risks, suggestions, documents }) {
  const dimensions = [];

  const coverageScore = clampScore(toNumber(coverage?.coverage_pct, 0));
  dimensions.push({ key: 'coverage', score: coverageScore, weight: 30 });

  if (assessment) {
    dimensions.push({
      key: 'diagnostic',
      score: clampScore(assessment.readiness_score),
      weight: 25,
    });
  } else if (gaps) {
    const gapScore = 100
      - toNumber(gaps.critical_gaps_count) * 18
      - toNumber(gaps.high_gaps_count) * 10
      - Math.max(0, toNumber(gaps.gaps_count) - toNumber(gaps.critical_gaps_count) - toNumber(gaps.high_gaps_count)) * 4;
    dimensions.push({ key: 'diagnostic', score: clampScore(gapScore), weight: 25 });
  }

  if (risks) {
    const riskScore = 100
      - toNumber(risks.critical_risks) * 22
      - toNumber(risks.high_risks) * 11;
    dimensions.push({ key: 'risks', score: clampScore(riskScore), weight: 20 });
  }

  if (suggestions) {
    const pending = toNumber(suggestions.pending_suggestions);
    const converted = toNumber(suggestions.converted_suggestions);
    const total = pending + converted;
    const actionScore = total > 0
      ? (converted / total) * 100
      : 75;
    dimensions.push({ key: 'actions', score: clampScore(actionScore), weight: 15 });
  }

  if (documents) {
    const docScore = toNumber(documents.documents_count) > 0
      ? 85 + Math.min(10, toNumber(documents.approved_documents) * 5)
      : 45;
    dimensions.push({ key: 'evidence_documents', score: clampScore(docScore), weight: 10 });
  }

  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return {
      score: 0,
      label: 'sin_datos',
      dimensions,
      data_quality: 'limited',
    };
  }

  const score = clampScore(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
  const expectedDimensions = ['coverage', 'diagnostic', 'risks', 'actions', 'evidence_documents'];
  const missing = expectedDimensions.filter((key) => !dimensions.some((item) => item.key === key));

  return {
    score,
    label: readinessLabel(score),
    dimensions,
    data_quality: missing.length === 0 ? 'complete' : (missing.length <= 2 ? 'partial' : 'limited'),
    missing_dimensions: missing,
  };
}

function buildStandardRows(context) {
  return context.standards.map((standard) => {
    const key = keyOf(standard.standard_code, standard.version_code);
    const coverage = context.coverageByKey.get(key) || {};
    const assessment = context.assessmentsByKey.get(key) || null;
    const gaps = context.gapsByKey.get(key) || null;
    const risks = context.risksByKey.get(key) || null;
    const suggestions = context.suggestionsByStandard.get(standard.standard_code) || null;
    const conversions = context.conversionsByStandard.get(standard.standard_code) || null;
    const documents = context.documentsByKey.get(key) || null;
    const actions = context.actionsByStandard.get(standard.standard_code) || null;
    const findings = context.findingsByStandard.get(standard.standard_code) || null;
    const nc = context.ncByStandard.get(standard.standard_code) || null;
    const readiness = calculateReadiness({ coverage, assessment, gaps, risks, suggestions, documents });

    return {
      standard_code: standard.standard_code,
      version_code: standard.version_code,
      display_name: standard.display_name,
      certifiable: standard.certifiable,
      publication_status: standard.publication_status,
      coverage_pct: round2(coverage.coverage_pct || 0),
      total_iso_controls: toNumber(coverage.total_iso_controls),
      linked_iso_controls: toNumber(coverage.linked_iso_controls),
      unlinked_iso_controls: toNumber(coverage.unlinked_iso_controls),
      recommended_actions_open: toNumber(suggestions?.pending_suggestions),
      recommended_actions_converted: toNumber(suggestions?.converted_suggestions) + toNumber(conversions?.conversions_count),
      high_risks: toNumber(risks?.high_risks),
      critical_risks: toNumber(risks?.critical_risks),
      gaps_count: toNumber(gaps?.gaps_count || assessment?.gaps_count),
      critical_gaps_count: toNumber(gaps?.critical_gaps_count || assessment?.critical_gaps_count),
      high_gaps_count: toNumber(gaps?.high_gaps_count || assessment?.high_gaps_count),
      documents_generated: toNumber(documents?.documents_count),
      open_action_plans: toNumber(actions?.open_action_plans),
      overdue_action_plans: toNumber(actions?.overdue_action_plans),
      open_findings: toNumber(findings?.open_findings),
      open_nonconformities: toNumber(nc?.open_nonconformities),
      readiness_score: readiness.score,
      readiness_label: readiness.label,
      readiness_dimensions: readiness.dimensions,
      data_quality: readiness.data_quality,
      semaphore: semaphoreFor({
        score: readiness.score,
        publicationStatus: standard.publication_status,
        certifiable: standard.certifiable,
      }),
    };
  });
}

function buildGlobalSummary(standards) {
  const activeStandards = standards.length;
  const readinessAvg = activeStandards
    ? round2(standards.reduce((sum, item) => sum + toNumber(item.readiness_score), 0) / activeStandards)
    : 0;
  const totalControls = standards.reduce((sum, item) => sum + item.total_iso_controls, 0);
  const linkedControls = standards.reduce((sum, item) => sum + item.linked_iso_controls, 0);

  return {
    active_standards: activeStandards,
    certifiable_standards: standards.filter((item) => item.certifiable === true).length,
    transition_standards: standards.filter((item) => item.publication_status === 'transition_prep' || item.certifiable === false).length,
    iso_controls_total: totalControls,
    iso_controls_linked: linkedControls,
    coverage_pct: totalControls > 0 ? round2((linkedControls / totalControls) * 100) : 0,
    recommended_actions_open: standards.reduce((sum, item) => sum + item.recommended_actions_open, 0),
    recommended_actions_converted: standards.reduce((sum, item) => sum + item.recommended_actions_converted, 0),
    high_risks: standards.reduce((sum, item) => sum + item.high_risks + item.critical_risks, 0),
    open_findings: standards.reduce((sum, item) => sum + item.open_findings, 0),
    open_nonconformities: standards.reduce((sum, item) => sum + item.open_nonconformities, 0),
    open_action_plans: standards.reduce((sum, item) => sum + item.open_action_plans, 0),
    readiness_score: readinessAvg,
    readiness_label: readinessLabel(readinessAvg),
  };
}

function buildPriorities(standards) {
  const priorities = [];

  standards.forEach((standard) => {
    if (standard.publication_status === 'transition_prep' || standard.certifiable === false) {
      priorities.push({
        priority: 'media',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `${standard.standard_code} ${standard.version_code}: mantener como transicion no certificable`,
        reason: 'Evitar decisiones de certificacion final sobre una version de preparacion.',
        route: '/diagnostico',
      });
    }

    if (standard.unlinked_iso_controls > 0) {
      priorities.push({
        priority: standard.unlinked_iso_controls >= 5 ? 'alta' : 'media',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `Cerrar ${standard.unlinked_iso_controls} control(es) ISO sin mapeo operativo`,
        reason: 'Mejorar cobertura normativa-operativa antes de auditorias y reportes ejecutivos.',
        route: '/acciones-recomendadas',
      });
    }

    if (standard.critical_risks + standard.high_risks > 0) {
      priorities.push({
        priority: standard.critical_risks > 0 ? 'critica' : 'alta',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `Gestionar ${standard.critical_risks + standard.high_risks} riesgo(s) alto/critico`,
        reason: 'Reducir exposicion antes de revision ejecutiva o auditoria.',
        route: '/matriz-riesgo',
      });
    }

    if (standard.recommended_actions_open > 0) {
      priorities.push({
        priority: standard.recommended_actions_open > 5 ? 'alta' : 'media',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `Convertir o descartar ${standard.recommended_actions_open} accion(es) recomendada(s)`,
        reason: 'Transformar inteligencia ISO en trabajo operativo trazable.',
        route: '/acciones-recomendadas',
      });
    }

    if (standard.open_nonconformities > 0 || standard.open_findings > 0) {
      priorities.push({
        priority: standard.open_nonconformities > 0 ? 'alta' : 'media',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `Resolver hallazgos/no conformidades abiertas`,
        reason: `${standard.open_findings} hallazgo(s) y ${standard.open_nonconformities} no conformidad(es) abiertos.`,
        route: standard.open_nonconformities > 0 ? '/no-conformidades' : '/hallazgos',
      });
    }

    if (standard.overdue_action_plans > 0) {
      priorities.push({
        priority: 'alta',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `Regularizar ${standard.overdue_action_plans} plan(es) vencido(s)`,
        reason: 'Los planes vencidos degradan readiness y trazabilidad de ejecucion.',
        route: '/plan-accion',
      });
    }
  });

  const rank = { critica: 1, alta: 2, media: 3, baja: 4 };
  return priorities
    .sort((a, b) => (rank[a.priority] || 9) - (rank[b.priority] || 9))
    .slice(0, 10);
}

async function getActivity(tenantId, existing, notes, limit = 20) {
  const events = [];

  async function addEvents(tableName, query, mapper) {
    if (!existing.has(tableName)) return;
    const rows = await queryRows(query, [tenantId, limit], notes, `actividad ${tableName}`);
    rows.forEach((row) => events.push(mapper(row)));
  }

  await Promise.all([
    addEvents('iso_operational_suggestions',
      `
      SELECT id, standard_code, title, status, created_at
      FROM iso_operational_suggestions
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2
      `,
      (row) => ({
        id: row.id,
        type: row.status === 'pending' ? 'accion_recomendada' : 'accion_recomendada_actualizada',
        title: row.title,
        standard_code: row.standard_code,
        created_at: row.created_at,
        route: '/acciones-recomendadas',
      })
    ),
    addEvents('iso_recommended_action_conversions',
      `
      SELECT c.id, c.target_type, c.target_id, c.converted_at, s.standard_code, s.title
      FROM iso_recommended_action_conversions c
      JOIN iso_operational_suggestions s
        ON s.id = c.recommendation_id
       AND s.tenant_id = c.tenant_id
      WHERE c.tenant_id = $1::uuid
      ORDER BY c.converted_at DESC
      LIMIT $2
      `,
      (row) => ({
        id: row.id,
        type: 'accion_convertida',
        title: `Convertida: ${row.title}`,
        standard_code: row.standard_code,
        created_at: row.converted_at,
        route: '/acciones-recomendadas',
      })
    ),
    addEvents('action_plans',
      `
      SELECT id, iso_code AS standard_code, title, created_at
      FROM action_plans
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2
      `,
      (row) => ({
        id: row.id,
        type: 'plan_accion',
        title: row.title,
        standard_code: row.standard_code,
        created_at: row.created_at,
        route: `/plan-accion?id=${row.id}`,
      })
    ),
    addEvents('findings',
      `
      SELECT id, iso_code AS standard_code, title, created_at
      FROM findings
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2
      `,
      (row) => ({
        id: row.id,
        type: 'hallazgo',
        title: row.title,
        standard_code: row.standard_code,
        created_at: row.created_at,
        route: `/hallazgos?id=${row.id}`,
      })
    ),
    addEvents('iso_generated_documents',
      `
      SELECT id, standard_code, title, created_at
      FROM iso_generated_documents
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2
      `,
      (row) => ({
        id: row.id,
        type: 'documento_iso',
        title: row.title,
        standard_code: row.standard_code,
        created_at: row.created_at,
        route: `/documentos?id=${row.id}`,
      })
    ),
    addEvents('iso_express_assessments',
      `
      SELECT id, standard_code, version_code, readiness_score, created_at
      FROM iso_express_assessments
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2
      `,
      (row) => ({
        id: row.id,
        type: 'diagnostico_iso',
        title: `Diagnostico ${row.standard_code} ${row.version_code}: ${round2(row.readiness_score)}%`,
        standard_code: row.standard_code,
        version_code: row.version_code,
        created_at: row.created_at,
        route: '/diagnostico',
      })
    ),
    addEvents('iso_risk_matrix_items',
      `
      SELECT id, standard_code, version_code, risk_title, created_at
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT $2
      `,
      (row) => ({
        id: row.id,
        type: 'riesgo_iso',
        title: row.risk_title,
        standard_code: row.standard_code,
        version_code: row.version_code,
        created_at: row.created_at,
        route: '/matriz-riesgo',
      })
    ),
  ]);

  return events
    .filter((event) => event.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

function dataQuality(notes, standards) {
  const dimensionQuality = standards.map((standard) => standard.data_quality);
  if (notes.length > 6 || dimensionQuality.includes('limited')) {
    return { level: 'limited', notes };
  }
  if (notes.length > 0 || dimensionQuality.includes('partial')) {
    return { level: 'partial', notes };
  }
  return { level: 'complete', notes };
}

async function buildCommandCenter(user, filters = {}) {
  const tenantId = resolveTenantId(user, filters.tenant_id);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  assertTenantAccess(user, tenantId);

  const notes = [];
  const context = await loadContext(tenantId, notes);
  let standards = buildStandardRows(context);

  const standardCode = filters.standard_code ? normalizeStandardCode(filters.standard_code) : null;
  const versionCode = filters.version_code ? normalizeVersionCode(filters.version_code) : null;

  if (standardCode) {
    standards = standards.filter((standard) => standard.standard_code === standardCode);
  }
  if (versionCode) {
    standards = standards.filter((standard) => standard.version_code === versionCode);
  }

  const summary = buildGlobalSummary(standards);
  const priorities = buildPriorities(standards);
  const activity = await getActivity(tenantId, context.existing, notes, 20);

  return {
    tenant_id: tenantId,
    summary,
    standards,
    priorities,
    activity,
    data_quality: dataQuality(notes, standards),
  };
}

function isTransitionStandard(standard) {
  return standard?.publication_status === 'transition_prep' || standard?.certifiable === false;
}

function uniqueStandardCount(standards) {
  return new Set(standards.map((standard) => standard.standard_code).filter(Boolean)).size;
}

function buildUnifiedAlerts({ transitionStandards, standards, dataQualityResult }) {
  const alerts = [];

  transitionStandards.forEach((standard) => {
    alerts.push({
      level: 'info',
      type: 'transition',
      standard_code: standard.standard_code,
      version_code: standard.version_code,
      title: `${standard.standard_code} ${standard.version_code} es solo transicion`,
      message: 'Se muestra como preparacion no certificable y no como norma operativa final.',
      route: '/diagnostico',
    });
  });

  standards
    .filter((standard) => standard.semaphore === 'critico' || standard.readiness_score < 50)
    .slice(0, 5)
    .forEach((standard) => {
      alerts.push({
        level: 'warning',
        type: 'readiness',
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        title: `${standard.standard_code} requiere atencion`,
        message: `Readiness actual ${standard.readiness_score}%. Priorizar brechas, riesgos y acciones abiertas.`,
        route: '/acciones-recomendadas',
      });
    });

  if (dataQualityResult?.level !== 'complete') {
    alerts.push({
      level: 'warning',
      type: 'data_quality',
      title: 'Datos parciales',
      message: 'Algunas fuentes opcionales no estan disponibles o no tienen datos suficientes.',
      route: null,
    });
  }

  return alerts;
}

function buildQuickLinks() {
  return [
    { label: 'Diagnostico ISO', route: '/diagnostico', kind: 'diagnostic' },
    { label: 'Matriz de riesgos', route: '/matriz-riesgo', kind: 'risks' },
    { label: 'Acciones recomendadas', route: '/acciones-recomendadas', kind: 'actions' },
    { label: 'Documentos ISO', route: '/documentos', kind: 'documents' },
    { label: 'Auditor ISO', route: '/auditor-iso', kind: 'auditor' },
    { label: 'Evidencias', route: '/evidencias', kind: 'evidence' },
    { label: 'Controles', route: '/controles', kind: 'controls' },
  ];
}

async function getUnified(user, filters = {}) {
  const data = await buildCommandCenter(user, filters);
  const transitionStandards = data.standards.filter(isTransitionStandard);
  const operationalStandards = data.standards.filter((standard) => !isTransitionStandard(standard));
  const operationalSummary = buildGlobalSummary(operationalStandards);
  const quality = dataQuality(data.data_quality?.notes || [], operationalStandards);

  return {
    tenant_id: data.tenant_id,
    tenant: {
      id: data.tenant_id,
    },
    summary: {
      ...operationalSummary,
      contracted_standards: uniqueStandardCount(operationalStandards),
      transition_standards: transitionStandards.length,
      total_versions_evaluated: operationalStandards.length,
    },
    standard_cards: operationalStandards,
    standards: operationalStandards,
    transition_items: transitionStandards.map((standard) => ({
      standard_code: standard.standard_code,
      version_code: standard.version_code,
      display_name: standard.display_name,
      certifiable: false,
      publication_status: standard.publication_status,
      readiness_score: standard.readiness_score,
      warning: 'Version de preparacion/transicion no certificable.',
      route: '/diagnostico',
    })),
    health: {
      readiness_score: operationalSummary.readiness_score,
      readiness_label: operationalSummary.readiness_label,
      coverage_pct: operationalSummary.coverage_pct,
      data_quality: quality.level,
    },
    workflow: {
      suggested: operationalSummary.recommended_actions_open,
      converted: operationalSummary.recommended_actions_converted,
      open_action_plans: operationalSummary.open_action_plans,
      open_findings: operationalSummary.open_findings,
      open_nonconformities: operationalSummary.open_nonconformities,
    },
    risks: {
      high_or_critical: operationalSummary.high_risks,
      standards_with_risk: operationalStandards.filter((standard) => standard.high_risks + standard.critical_risks > 0).length,
    },
    priorities: data.priorities
      .filter((priority) => operationalStandards.some(
        (standard) =>
          standard.standard_code === priority.standard_code &&
          standard.version_code === priority.version_code
      ))
      .slice(0, 10),
    transition_priorities: data.priorities
      .filter((priority) => transitionStandards.some(
        (standard) =>
          standard.standard_code === priority.standard_code &&
          standard.version_code === priority.version_code
      )),
    activity: data.activity.filter((event) => operationalStandards.some(
      (standard) => standard.standard_code === event.standard_code || !event.standard_code
    )),
    alerts: buildUnifiedAlerts({
      transitionStandards,
      standards: operationalStandards,
      dataQualityResult: quality,
    }),
    quick_links: buildQuickLinks(),
    data_quality: quality,
  };
}

async function getSummary(user, filters = {}) {
  return buildCommandCenter(user, filters);
}

async function getStandards(user, filters = {}) {
  const data = await buildCommandCenter(user, filters);
  return {
    tenant_id: data.tenant_id,
    standards: data.standards,
    data_quality: data.data_quality,
  };
}

async function getStandardDetail(user, standardCode, versionCode, filters = {}) {
  const data = await buildCommandCenter(user, {
    ...filters,
    standard_code: standardCode,
    version_code: versionCode,
  });

  if (!data.standards.length) {
    throw publicError(404, 'STANDARD_NOT_FOUND', 'Norma/version no encontrada para este tenant');
  }

  return {
    tenant_id: data.tenant_id,
    standard: data.standards[0],
    priorities: data.priorities,
    activity: data.activity.filter((event) => event.standard_code === data.standards[0].standard_code).slice(0, 10),
    data_quality: data.data_quality,
  };
}

async function getReadiness(user, filters = {}) {
  const data = await buildCommandCenter(user, filters);
  return {
    tenant_id: data.tenant_id,
    readiness_score: data.summary.readiness_score,
    readiness_label: data.summary.readiness_label,
    standards: data.standards.map((standard) => ({
      standard_code: standard.standard_code,
      version_code: standard.version_code,
      readiness_score: standard.readiness_score,
      readiness_label: standard.readiness_label,
      readiness_dimensions: standard.readiness_dimensions,
      semaphore: standard.semaphore,
      data_quality: standard.data_quality,
    })),
    data_quality: data.data_quality,
  };
}

async function getActivityOnly(user, filters = {}) {
  const data = await buildCommandCenter(user, filters);
  return {
    tenant_id: data.tenant_id,
    activity: data.activity,
    data_quality: data.data_quality,
  };
}

module.exports = {
  getSummary,
  getStandards,
  getStandardDetail,
  getReadiness,
  getActivity: getActivityOnly,
  getUnified,
};
