'use strict';

const pool = require('../../config/db');
const {
  normalizeStandardCode,
  normalizeVersionCode,
  buildProfileContextForReport,
} = require('../config/standardReportProfiles');

function asString(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function percent(value, total) {
  const safeTotal = toNumber(total, 0);
  if (!safeTotal) return 0;

  return Math.round((toNumber(value, 0) / safeTotal) * 1000) / 10;
}

function clampPercent(value) {
  const n = toNumber(value, 0);

  if (n < 0) return 0;
  if (n > 100) return 100;

  return Math.round(n * 10) / 10;
}

function normalizeStatus(value) {
  return asString(value).toLowerCase();
}

function getDefaultVersionForStandard(standardCode) {
  const standard = normalizeStandardCode(standardCode);

  if (standard === 'ISO9001') return '2015';
  if (standard === 'ISO27001') return '2022';
  if (standard === 'ISO42001') return '2023';

  return null;
}

async function safeQuery(sql, params = [], fallback = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows || fallback;
  } catch (error) {
    console.error('REPORT COVERAGE SAFE QUERY ERROR:', error.message);
    return fallback;
  }
}

function classifyCoverage(metrics) {
  const tenantStandardActive = metrics.tenant_standard_active === true;

  if (!tenantStandardActive) {
    return {
      status: 'not_active',
      label: 'Norma no activa',
      severity: 'gray',
      can_generate_executive: false,
      can_generate_operational: false,
      can_generate_audit: false,
    };
  }

  const hasIsoVersion = metrics.has_iso_version === true;
  const totalClauses = toNumber(metrics.total_iso_clauses, 0);
  const totalIsoControls = toNumber(metrics.total_iso_controls, 0);
  const linkedIsoControls = toNumber(metrics.linked_iso_controls, 0);
  const tenantControls = toNumber(metrics.tenant_controls_count, 0);
  const healthRecords = toNumber(metrics.health_records_count, 0);
  const evidenceCount = toNumber(metrics.evidence_count, 0);
  const assessmentCount = toNumber(metrics.assessments_count, 0);
  const riskRuns = toNumber(metrics.risk_runs_count, 0);

  const catalogCoveragePct = clampPercent(
    metrics.catalog_coverage_pct ||
      percent(linkedIsoControls, totalIsoControls)
  );

  const tenantControlCoveragePct = clampPercent(
    metrics.tenant_control_coverage_pct ||
      percent(tenantControls, linkedIsoControls || totalIsoControls)
  );

  const operationalCoveragePct = clampPercent(
    metrics.operational_coverage_pct ||
      Math.round(
        (
          Math.min(tenantControlCoveragePct, 100) +
          Math.min(percent(healthRecords, Math.max(tenantControls, 1)), 100) +
          Math.min(percent(evidenceCount, Math.max(tenantControls, 1)), 100)
        ) / 3
      )
  );

  const hasCatalogMinimum =
    hasIsoVersion &&
    totalClauses > 0 &&
    totalIsoControls > 0 &&
    catalogCoveragePct >= 70;

  const hasOperationalMinimum =
    tenantControls > 0 ||
    healthRecords > 0 ||
    evidenceCount > 0 ||
    assessmentCount > 0 ||
    riskRuns > 0;

  if (
    hasCatalogMinimum &&
    tenantControls > 0 &&
    operationalCoveragePct >= 30
  ) {
    return {
      status: 'complete',
      label: 'Cobertura completa',
      severity: 'green',
      can_generate_executive: true,
      can_generate_operational: true,
      can_generate_audit: true,
    };
  }

  if (
    tenantStandardActive &&
    (
      hasCatalogMinimum ||
      hasOperationalMinimum ||
      tenantControls > 0
    )
  ) {
    return {
      status: 'partial',
      label: 'Cobertura parcial',
      severity: 'yellow',
      can_generate_executive: true,
      can_generate_operational: hasOperationalMinimum,
      can_generate_audit: tenantControls > 0 || assessmentCount > 0,
    };
  }

  return {
    status: 'insufficient',
    label: 'Sin datos suficientes',
    severity: 'red',
    can_generate_executive: false,
    can_generate_operational: false,
    can_generate_audit: false,
  };
}

function buildCoverageWarnings(metrics, classification) {
  const warnings = [];

  if (classification.status === 'not_active') {
    warnings.push('La norma no está activa para este cliente.');
    return warnings;
  }

  if (!metrics.has_iso_version) {
    warnings.push('No existe versión ISO técnica registrada para esta norma.');
  }

  if (toNumber(metrics.total_iso_clauses, 0) === 0) {
    warnings.push('No existen cláusulas ISO cargadas para esta versión.');
  }

  if (toNumber(metrics.total_iso_controls, 0) === 0) {
    warnings.push('No existen controles ISO técnicos cargados para esta versión.');
  }

  if (toNumber(metrics.catalog_coverage_pct, 0) < 70) {
    warnings.push('La cobertura de mapeo entre controles ISO y catálogo operativo es baja.');
  }

  if (toNumber(metrics.tenant_controls_count, 0) === 0) {
    warnings.push('El cliente no tiene controles operativos inicializados para esta norma.');
  }

  if (toNumber(metrics.evidence_count, 0) === 0) {
    warnings.push('No existen evidencias asociadas a esta norma o sus controles.');
  }

  if (toNumber(metrics.health_records_count, 0) === 0) {
    warnings.push('No existen cálculos recientes de salud de controles para esta norma.');
  }

  if (warnings.length === 0 && classification.status === 'complete') {
    warnings.push('La norma tiene cobertura suficiente para informes premium.');
  }

  return warnings;
}

async function getStandardVersion({ standardCode, versionCode }) {
  const standard = normalizeStandardCode(standardCode);
  const version = normalizeVersionCode(versionCode || getDefaultVersionForStandard(standard));

  if (!standard || !version) {
    return null;
  }

  const rows = await safeQuery(
    `
    SELECT
      id,
      standard_code,
      version_code,
      display_name,
      publication_status,
      certifiable,
      notes,
      is_active
    FROM iso_standard_versions
    WHERE standard_code = $1
      AND version_code = $2
      AND is_active IS DISTINCT FROM false
    LIMIT 1
    `,
    [standard, version],
    []
  );

  return rows[0] || null;
}

async function getCoverageForTenantStandard({
  tenantId,
  standardCode,
  versionCode,
  reportTypeCode = 'executive_iso_status',
}) {
  const tenantIdSafe = asString(tenantId);
  const standard = normalizeStandardCode(standardCode);
  const requestedVersion = normalizeVersionCode(versionCode || getDefaultVersionForStandard(standard));

  if (!tenantIdSafe) {
    throw new Error('tenantId requerido para validar cobertura de reportes');
  }

  if (!standard) {
    throw new Error('standardCode requerido para validar cobertura de reportes');
  }

  const version = requestedVersion || getDefaultVersionForStandard(standard) || '';

  const rows = await safeQuery(
    `
    WITH selected_version AS (
      SELECT
        id,
        standard_code,
        version_code,
        display_name,
        publication_status,
        certifiable,
        notes
      FROM iso_standard_versions
      WHERE standard_code = $2
        AND ($3 = '' OR version_code = $3)
        AND is_active IS DISTINCT FROM false
      ORDER BY
        CASE
          WHEN version_code = $3 THEN 0
          ELSE 1
        END,
        version_code DESC
      LIMIT 1
    ),
    tenant_standard AS (
      SELECT
        tenant_id,
        standard_code,
        is_active,
        catalog_mode,
        initialized_at,
        lifecycle_status
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND standard_code = $2
      ORDER BY created_at DESC
      LIMIT 1
    ),
    iso_clause_stats AS (
      SELECT COUNT(*)::integer AS total_iso_clauses
      FROM iso_clauses icl
      JOIN selected_version sv
        ON sv.standard_code = icl.standard_code
       AND sv.version_code = icl.version_code
    ),
    iso_control_stats AS (
      SELECT COUNT(*)::integer AS total_iso_controls
      FROM iso_controls ic
      JOIN selected_version sv
        ON sv.standard_code = ic.standard_code
       AND sv.version_code = ic.version_code
      WHERE ic.is_active IS DISTINCT FROM false
    ),
    catalog_coverage AS (
      SELECT
        COALESCE(MAX(total_iso_controls), 0)::integer AS coverage_total_iso_controls,
        COALESCE(MAX(linked_iso_controls), 0)::integer AS linked_iso_controls,
        COALESCE(MAX(unlinked_iso_controls), 0)::integer AS unlinked_iso_controls,
        COALESCE(MAX(linked_catalog_controls), 0)::integer AS linked_catalog_controls,
        COALESCE(MAX(coverage_pct), 0)::numeric AS catalog_coverage_pct
      FROM v_iso_control_catalog_coverage v
      JOIN selected_version sv
        ON sv.standard_code = v.standard_code
       AND sv.version_code = v.version_code
    ),
    tenant_control_stats AS (
      SELECT
        COUNT(DISTINCT tc.id)::integer AS tenant_controls_count,
        COUNT(DISTINCT tc.id) FILTER (
          WHERE LOWER(COALESCE(tc.status, '')) IN ('implementado', 'implemented', 'cumple', 'activo')
        )::integer AS implemented_controls_count,
        COUNT(DISTINCT tc.id) FILTER (
          WHERE tc.responsible_user_id IS NOT NULL
        )::integer AS controls_with_responsible_count,
        COUNT(DISTINCT tc.id) FILTER (
          WHERE tc.due_date IS NOT NULL AND tc.due_date < CURRENT_DATE
        )::integer AS overdue_controls_count
      FROM tenant_controls tc
      LEFT JOIN controls_catalog cc
        ON cc.id = tc.control_id
      LEFT JOIN controls_catalog_standards ccs
        ON ccs.control_id = tc.control_id
      WHERE tc.tenant_id = $1::uuid
        AND (
          cc.iso = $2
          OR ccs.standard_code = $2
        )
    ),
    latest_health AS (
      SELECT DISTINCT ON (chs.tenant_control_id)
        chs.tenant_control_id,
        chs.health_status,
        chs.health_score,
        chs.calculated_at
      FROM control_health_scores chs
      WHERE chs.tenant_id = $1::uuid
        AND chs.standard_code = $2
      ORDER BY chs.tenant_control_id, chs.calculated_at DESC NULLS LAST
    ),
    health_stats AS (
      SELECT
        COUNT(*)::integer AS health_records_count,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(health_status, '')) IN ('saludable', 'healthy')
        )::integer AS healthy_controls_count,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(health_status, '')) IN ('atencion', 'attention', 'warning')
        )::integer AS attention_controls_count,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(health_status, '')) IN ('deteriorado', 'critical')
        )::integer AS deteriorated_controls_count,
        ROUND(AVG(COALESCE(health_score, 0))::numeric, 2) AS avg_health_score,
        MAX(calculated_at) AS last_health_calculated_at
      FROM latest_health
    ),
    evidence_stats AS (
      SELECT
        COUNT(DISTINCT e.id)::integer AS evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE LOWER(COALESCE(e.status, '')) IN ('aprobada', 'aprobado', 'approved')
        )::integer AS approved_evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE LOWER(COALESCE(e.status, '')) IN ('pendiente', 'pending', 'uploaded', 'subida', 'en revision', 'en revisión')
        )::integer AS pending_evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE e.expires_at IS NOT NULL AND e.expires_at < CURRENT_DATE
        )::integer AS expired_evidence_count
      FROM evidences e
      LEFT JOIN tenant_controls tc
        ON tc.id = e.tenant_control_id
      LEFT JOIN controls_catalog cc
        ON cc.id = COALESCE(tc.control_id, e.control_id)
      LEFT JOIN controls_catalog_standards ccs
        ON ccs.control_id = COALESCE(tc.control_id, e.control_id)
      WHERE e.tenant_id = $1::uuid
        AND COALESCE(e.status, '') <> 'deleted'
        AND (
          cc.iso = $2
          OR ccs.standard_code = $2
        )
    ),
    expected_evidence_stats AS (
      SELECT COUNT(*)::integer AS expected_evidence_count
      FROM iso_evidence_expectations iee
      JOIN selected_version sv
        ON sv.standard_code = iee.standard_code
       AND sv.version_code = iee.version_code
    ),
    assessment_stats AS (
      SELECT
        COUNT(*)::integer AS assessments_count,
        MAX(created_at) AS last_assessment_at,
        ROUND(AVG(readiness_score)::numeric, 2) AS avg_readiness_score,
        ROUND(AVG(maturity_score)::numeric, 2) AS avg_maturity_score
      FROM iso_express_assessments iea
      JOIN selected_version sv
        ON sv.standard_code = iea.standard_code
       AND sv.version_code = iea.version_code
      WHERE iea.tenant_id = $1::uuid
        AND iea.assessment_status IN ('calculated', 'completed')
    ),
    risk_stats AS (
      SELECT
        COUNT(*)::integer AS risk_runs_count,
        MAX(created_at) AS last_risk_run_at
      FROM iso_risk_matrix_runs irmr
      JOIN selected_version sv
        ON sv.standard_code = irmr.standard_code
       AND sv.version_code = irmr.version_code
      WHERE irmr.tenant_id = $1::uuid
        AND irmr.run_status = 'completed'
    ),
    risk_template_stats AS (
      SELECT COUNT(*)::integer AS risk_templates_count
      FROM iso_risk_templates irt
      JOIN selected_version sv
        ON sv.standard_code = irt.standard_code
       AND sv.version_code = irt.version_code
    )
    SELECT
      $1::uuid AS tenant_id,
      $2::text AS requested_standard_code,
      $3::text AS requested_version_code,

      sv.id AS standard_version_id,
      sv.standard_code,
      sv.version_code,
      sv.display_name,
      sv.publication_status,
      sv.certifiable,
      sv.notes,

      CASE WHEN sv.id IS NULL THEN false ELSE true END AS has_iso_version,
      CASE WHEN ts.tenant_id IS NULL THEN false ELSE COALESCE(ts.is_active, true) END AS tenant_standard_active,
      ts.catalog_mode,
      ts.initialized_at,
      ts.lifecycle_status,

      COALESCE(ics.total_iso_clauses, 0)::integer AS total_iso_clauses,
      COALESCE(ict.total_iso_controls, 0)::integer AS total_iso_controls,

      COALESCE(cc.coverage_total_iso_controls, 0)::integer AS coverage_total_iso_controls,
      COALESCE(cc.linked_iso_controls, 0)::integer AS linked_iso_controls,
      COALESCE(cc.unlinked_iso_controls, 0)::integer AS unlinked_iso_controls,
      COALESCE(cc.linked_catalog_controls, 0)::integer AS linked_catalog_controls,
      COALESCE(cc.catalog_coverage_pct, 0)::numeric AS catalog_coverage_pct,

      COALESCE(tcs.tenant_controls_count, 0)::integer AS tenant_controls_count,
      COALESCE(tcs.implemented_controls_count, 0)::integer AS implemented_controls_count,
      COALESCE(tcs.controls_with_responsible_count, 0)::integer AS controls_with_responsible_count,
      COALESCE(tcs.overdue_controls_count, 0)::integer AS overdue_controls_count,

      COALESCE(hs.health_records_count, 0)::integer AS health_records_count,
      COALESCE(hs.healthy_controls_count, 0)::integer AS healthy_controls_count,
      COALESCE(hs.attention_controls_count, 0)::integer AS attention_controls_count,
      COALESCE(hs.deteriorated_controls_count, 0)::integer AS deteriorated_controls_count,
      COALESCE(hs.avg_health_score, 0)::numeric AS avg_health_score,
      hs.last_health_calculated_at,

      COALESCE(es.evidence_count, 0)::integer AS evidence_count,
      COALESCE(es.approved_evidence_count, 0)::integer AS approved_evidence_count,
      COALESCE(es.pending_evidence_count, 0)::integer AS pending_evidence_count,
      COALESCE(es.expired_evidence_count, 0)::integer AS expired_evidence_count,

      COALESCE(ees.expected_evidence_count, 0)::integer AS expected_evidence_count,

      COALESCE(assess.assessments_count, 0)::integer AS assessments_count,
      assess.last_assessment_at,
      COALESCE(assess.avg_readiness_score, 0)::numeric AS avg_readiness_score,
      COALESCE(assess.avg_maturity_score, 0)::numeric AS avg_maturity_score,

      COALESCE(rs.risk_runs_count, 0)::integer AS risk_runs_count,
      rs.last_risk_run_at,

      COALESCE(rts.risk_templates_count, 0)::integer AS risk_templates_count
    FROM selected_version sv
    FULL JOIN tenant_standard ts
      ON true
    CROSS JOIN iso_clause_stats ics
    CROSS JOIN iso_control_stats ict
    CROSS JOIN catalog_coverage cc
    CROSS JOIN tenant_control_stats tcs
    CROSS JOIN health_stats hs
    CROSS JOIN evidence_stats es
    CROSS JOIN expected_evidence_stats ees
    CROSS JOIN assessment_stats assess
    CROSS JOIN risk_stats rs
    CROSS JOIN risk_template_stats rts
    LIMIT 1
    `,
    [tenantIdSafe, standard, version],
    []
  );

  let metrics = rows[0] || null;

  if (!metrics) {
    const standardVersion = await getStandardVersion({
      standardCode: standard,
      versionCode: version,
    });

    metrics = {
      tenant_id: tenantIdSafe,
      requested_standard_code: standard,
      requested_version_code: version,
      standard_version_id: standardVersion?.id || null,
      standard_code: standardVersion?.standard_code || standard,
      version_code: standardVersion?.version_code || version,
      display_name: standardVersion?.display_name || `${standard}:${version}`,
      publication_status: standardVersion?.publication_status || null,
      certifiable: standardVersion?.certifiable === true,
      notes: standardVersion?.notes || null,
      has_iso_version: !!standardVersion,
      tenant_standard_active: false,
      total_iso_clauses: 0,
      total_iso_controls: 0,
      linked_iso_controls: 0,
      catalog_coverage_pct: 0,
      tenant_controls_count: 0,
      health_records_count: 0,
      evidence_count: 0,
      expected_evidence_count: 0,
      assessments_count: 0,
      risk_runs_count: 0,
      risk_templates_count: 0,
    };
  }

  metrics.standard_code = metrics.standard_code || standard;
  metrics.version_code = metrics.version_code || version;

  metrics.catalog_coverage_pct = clampPercent(metrics.catalog_coverage_pct);
  metrics.tenant_control_coverage_pct = clampPercent(
    percent(
      metrics.tenant_controls_count,
      metrics.linked_iso_controls || metrics.total_iso_controls
    )
  );

  metrics.evidence_coverage_pct = clampPercent(
    percent(
      metrics.approved_evidence_count || metrics.evidence_count,
      metrics.expected_evidence_count || metrics.tenant_controls_count
    )
  );

  metrics.health_coverage_pct = clampPercent(
    percent(metrics.health_records_count, metrics.tenant_controls_count)
  );

  metrics.operational_coverage_pct = clampPercent(
    Math.round(
      (
        metrics.tenant_control_coverage_pct +
        metrics.evidence_coverage_pct +
        metrics.health_coverage_pct
      ) / 3
    )
  );

  const classification = classifyCoverage(metrics);
  const warnings = buildCoverageWarnings(metrics, classification);
  const profile_context = buildProfileContextForReport({
    standardCode: metrics.standard_code,
    versionCode: metrics.version_code,
    reportTypeCode,
  });

  return {
    tenant_id: tenantIdSafe,
    standard_code: metrics.standard_code,
    version_code: metrics.version_code,
    display_name:
      metrics.display_name ||
      profile_context.display_name ||
      `${metrics.standard_code}:${metrics.version_code}`,

    coverage_status: classification.status,
    coverage_label: classification.label,
    coverage_severity: classification.severity,

    can_generate_executive: classification.can_generate_executive,
    can_generate_operational: classification.can_generate_operational,
    can_generate_audit: classification.can_generate_audit,

    profile_context,

    metrics: {
      has_iso_version: metrics.has_iso_version === true,
      tenant_standard_active: metrics.tenant_standard_active === true,
      certifiable: metrics.certifiable === true,
      publication_status: metrics.publication_status || null,
      catalog_mode: metrics.catalog_mode || null,
      lifecycle_status: metrics.lifecycle_status || null,

      total_iso_clauses: toNumber(metrics.total_iso_clauses, 0),
      total_iso_controls: toNumber(metrics.total_iso_controls, 0),
      linked_iso_controls: toNumber(metrics.linked_iso_controls, 0),
      unlinked_iso_controls: toNumber(metrics.unlinked_iso_controls, 0),
      linked_catalog_controls: toNumber(metrics.linked_catalog_controls, 0),

      catalog_coverage_pct: toNumber(metrics.catalog_coverage_pct, 0),
      tenant_control_coverage_pct: toNumber(metrics.tenant_control_coverage_pct, 0),
      operational_coverage_pct: toNumber(metrics.operational_coverage_pct, 0),
      evidence_coverage_pct: toNumber(metrics.evidence_coverage_pct, 0),
      health_coverage_pct: toNumber(metrics.health_coverage_pct, 0),

      tenant_controls_count: toNumber(metrics.tenant_controls_count, 0),
      implemented_controls_count: toNumber(metrics.implemented_controls_count, 0),
      controls_with_responsible_count: toNumber(metrics.controls_with_responsible_count, 0),
      overdue_controls_count: toNumber(metrics.overdue_controls_count, 0),

      health_records_count: toNumber(metrics.health_records_count, 0),
      healthy_controls_count: toNumber(metrics.healthy_controls_count, 0),
      attention_controls_count: toNumber(metrics.attention_controls_count, 0),
      deteriorated_controls_count: toNumber(metrics.deteriorated_controls_count, 0),
      avg_health_score: toNumber(metrics.avg_health_score, 0),
      last_health_calculated_at: metrics.last_health_calculated_at || null,

      evidence_count: toNumber(metrics.evidence_count, 0),
      approved_evidence_count: toNumber(metrics.approved_evidence_count, 0),
      pending_evidence_count: toNumber(metrics.pending_evidence_count, 0),
      expired_evidence_count: toNumber(metrics.expired_evidence_count, 0),
      expected_evidence_count: toNumber(metrics.expected_evidence_count, 0),

      assessments_count: toNumber(metrics.assessments_count, 0),
      last_assessment_at: metrics.last_assessment_at || null,
      avg_readiness_score: toNumber(metrics.avg_readiness_score, 0),
      avg_maturity_score: toNumber(metrics.avg_maturity_score, 0),

      risk_runs_count: toNumber(metrics.risk_runs_count, 0),
      last_risk_run_at: metrics.last_risk_run_at || null,
      risk_templates_count: toNumber(metrics.risk_templates_count, 0),
    },

    warnings,
  };
}

async function listCoverageForTenant({ tenantId, reportTypeCode = 'executive_iso_status' }) {
  const tenantIdSafe = asString(tenantId);

  if (!tenantIdSafe) {
    throw new Error('tenantId requerido para listar cobertura de normas');
  }

  const rows = await safeQuery(
    `
    SELECT
      ts.standard_code,
      COALESCE(
        CASE
          WHEN ts.standard_code = 'ISO9001' THEN '2015'
          WHEN ts.standard_code = 'ISO27001' THEN '2022'
          WHEN ts.standard_code = 'ISO42001' THEN '2023'
          ELSE NULL
        END,
        (
          SELECT version_code
          FROM iso_standard_versions v
          WHERE v.standard_code = ts.standard_code
            AND v.is_active IS DISTINCT FROM false
          ORDER BY certifiable DESC, version_code DESC
          LIMIT 1
        )
      ) AS version_code
    FROM tenant_standards ts
    WHERE ts.tenant_id = $1::uuid
      AND ts.is_active IS DISTINCT FROM false
    ORDER BY
      CASE
        WHEN ts.standard_code = 'ISO9001' THEN 1
        WHEN ts.standard_code = 'ISO27001' THEN 2
        WHEN ts.standard_code = 'ISO42001' THEN 3
        ELSE 9
      END,
      ts.standard_code
    `,
    [tenantIdSafe],
    []
  );

  const result = [];

  for (const row of rows) {
    result.push(
      await getCoverageForTenantStandard({
        tenantId: tenantIdSafe,
        standardCode: row.standard_code,
        versionCode: row.version_code,
        reportTypeCode,
      })
    );
  }

  return result;
}

function canGenerateReportByCoverage(coverage, reportTypeCode) {
  const code = asString(reportTypeCode);

  if (!coverage) return false;

  if (code === 'executive_iso_status' || code === 'executive_summary') {
    return coverage.can_generate_executive === true;
  }

  if (
    code === 'control_health_report' ||
    code === 'control_status' ||
    code === 'iso_risk_report' ||
    code === 'action_plan_report' ||
    code === 'maturity_gap_diagnostic'
  ) {
    return coverage.can_generate_operational === true;
  }

  if (code === 'internal_audit_report' || code === 'audit_report') {
    return coverage.can_generate_audit === true;
  }

  return coverage.coverage_status === 'complete' || coverage.coverage_status === 'partial';
}

function assertCanGenerateReportByCoverage(coverage, reportTypeCode) {
  if (canGenerateReportByCoverage(coverage, reportTypeCode)) {
    return true;
  }

  const error = new Error(
    coverage?.warnings?.[0] ||
      'La norma seleccionada no tiene información suficiente para generar este informe.'
  );

  error.status = 400;
  error.code = 'REPORT_COVERAGE_INSUFFICIENT';
  error.coverage = coverage;

  throw error;
}

module.exports = {
  normalizeStatus,
  getDefaultVersionForStandard,
  classifyCoverage,
  buildCoverageWarnings,
  getCoverageForTenantStandard,
  listCoverageForTenant,
  canGenerateReportByCoverage,
  assertCanGenerateReportByCoverage,
};
