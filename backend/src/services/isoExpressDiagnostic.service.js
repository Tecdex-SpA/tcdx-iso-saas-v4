const pool = require('../config/db');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const ALLOWED_ASSESSMENT_TYPES = new Set([
  'express',
  'transition_readiness',
  'certification_readiness',
]);

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

function getUserId(user) {
  return user?.user_id || user?.id || null;
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

function ensureTenantAccess(user, tenantId) {
  const role = normalizeRole(user?.role || user?.user_role || user?.userRole);

  if (isPlatformRole(role)) return true;

  return String(getUserTenantId(user) || '') === String(tenantId || '');
}

function assertTenantAccess(user, tenantId) {
  if (!ensureTenantAccess(user, tenantId)) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function normalizeAssessmentType(value, version) {
  const requested = String(value || '').trim() || (version === '2026_FDIS' ? 'transition_readiness' : 'express');

  if (!ALLOWED_ASSESSMENT_TYPES.has(requested)) {
    throw publicError(400, 'INVALID_ASSESSMENT_TYPE', 'assessment_type invalido');
  }

  return requested;
}

function readinessLevel(score, assessmentType) {
  if (assessmentType === 'transition_readiness') {
    if (score >= 85) return 'transicion_alta';
    if (score >= 70) return 'transicion_avanzada';
    if (score >= 50) return 'transicion_en_progreso';
    if (score >= 30) return 'transicion_inicial';
    return 'transicion_critica';
  }

  if (score >= 85) return 'listo';
  if (score >= 70) return 'avanzado';
  if (score >= 50) return 'en_progreso';
  if (score >= 30) return 'inicial';
  return 'critico';
}

function severityRank(severity) {
  const key = String(severity || '').toLowerCase();
  if (key === 'critica' || key === 'critico') return 4;
  if (key === 'alta' || key === 'alto') return 3;
  if (key === 'media' || key === 'medio') return 2;
  return 1;
}

function highestSeverity(...values) {
  const sorted = values
    .filter(Boolean)
    .sort((a, b) => severityRank(b) - severityRank(a));
  return sorted[0] || 'media';
}

function statusScore(status) {
  const normalized = String(status || '').toLowerCase().trim();

  if (['cumple', 'compliant', 'implementado', 'implemented'].includes(normalized)) return 85;
  if (['parcial', 'partial', 'en progreso', 'in_progress'].includes(normalized)) return 60;
  if (['no aplica', 'not applicable'].includes(normalized)) return 70;
  if (['no cumple', 'non-compliant', 'deteriorado'].includes(normalized)) return 25;
  if (['pendiente', 'pending'].includes(normalized)) return 45;
  return 50;
}

function healthAdjustment(healthStatus, healthScore) {
  const status = String(healthStatus || '').toLowerCase();
  const score = Number(healthScore);

  if (Number.isFinite(score) && score > 0) {
    if (score >= 80) return 10;
    if (score >= 50) return 0;
    return -20;
  }

  if (['saludable', 'healthy'].includes(status)) return 10;
  if (['atencion', 'attention', 'warning'].includes(status)) return -5;
  if (['deteriorado', 'critical'].includes(status)) return -20;
  return 0;
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

function itemRecommendation(item) {
  if (!item.catalog_control_id) return 'Mapear el requisito ISO con un control operativo antes de usarlo para auditoria.';
  if (!item.tenant_control_id) return 'Inicializar o vincular el control operativo para este tenant sin modificar el catalogo global.';
  if (item.evidence_gap) return 'Cargar evidencia vigente y relacionada con el control.';
  if (String(item.health_status || '').toLowerCase() === 'deteriorado') return 'Revisar el control deteriorado, causa y acciones de estabilizacion.';
  return 'Mantener seguimiento y evidencia vigente.';
}

function buildGap({ item, gapType, severity, title, description, recommendation, dueDays = 30, metadata = {} }) {
  return {
    iso_control_id: item.iso_control_id || null,
    control_code: item.control_code || null,
    gap_type: gapType,
    severity,
    title,
    description,
    recommendation,
    suggested_action_type: gapType,
    suggested_owner_role: item.owner_role_suggested || null,
    suggested_due_days: dueDays,
    metadata,
  };
}

function buildPlan(gaps, assessmentType, standardCode, versionCode) {
  const byPriority = [...gaps].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const plan30 = byPriority
    .filter((gap) => ['critica', 'alta'].includes(gap.severity) || ['missing_evidence', 'missing_tenant_control'].includes(gap.gap_type))
    .slice(0, 8)
    .map((gap) => ({
      title: gap.title,
      control_code: gap.control_code,
      due_days: Math.min(gap.suggested_due_days || 30, 30),
      recommendation: gap.recommendation,
    }));
  const plan60 = byPriority
    .filter((gap) => !plan30.some((item) => item.title === gap.title && item.control_code === gap.control_code))
    .slice(0, 8)
    .map((gap) => ({
      title: gap.title,
      control_code: gap.control_code,
      due_days: 60,
      recommendation: gap.recommendation,
    }));
  const plan90 = [
    {
      title: assessmentType === 'transition_readiness'
        ? 'Revisar avance de preparacion de transicion'
        : 'Ejecutar auditoria interna focalizada',
      control_code: null,
      due_days: 90,
      recommendation: assessmentType === 'transition_readiness'
        ? 'Validar supuestos, caveats y cambios publicados antes de decisiones de certificacion.'
        : 'Usar brechas cerradas y evidencias nuevas para una auditoria interna de preparacion.',
    },
    {
      title: 'Revision ejecutiva del sistema',
      control_code: null,
      due_days: 90,
      recommendation: 'Presentar score, riesgos, brechas y decisiones de recursos a la direccion.',
    },
  ];

  if (standardCode === 'ISO42001') {
    plan90.unshift({
      title: 'Gobierno operativo de IA',
      control_code: null,
      due_days: 90,
      recommendation: 'Definir inventario IA, responsables, datos usados, supervision humana y monitoreo de sesgo/desempeno.',
    });
  }

  if (versionCode === '2026_FDIS') {
    plan30.unshift({
      title: 'Caveat de no certificabilidad',
      control_code: null,
      due_days: 30,
      recommendation: 'Comunicar que ISO9001 2026_FDIS es solo preparacion de transicion y no certificacion final.',
    });
  }

  return { plan30, plan60, plan90 };
}

async function getStandardVersion(standardCode, versionCode) {
  const result = await pool.query(
    `
    SELECT
      id,
      standard_code,
      version_code,
      display_name,
      publication_status,
      certifiable,
      notes
    FROM iso_standard_versions
    WHERE standard_code = $1
      AND version_code = $2
      AND is_active = true
    LIMIT 1
    `,
    [standardCode, versionCode]
  );

  if (!result.rowCount) {
    throw publicError(404, 'ISO_VERSION_NOT_FOUND', 'Version ISO no encontrada');
  }

  return result.rows[0];
}

async function tenantHasStandard(tenantId, standardCode) {
  const result = await pool.query(
    `
    SELECT 1
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND standard_code = $2
      AND is_active IS DISTINCT FROM false
    LIMIT 1
    `,
    [tenantId, standardCode]
  );

  return result.rowCount > 0;
}

async function getAssessmentOptions(tenantId, user) {
  assertTenantAccess(user, tenantId);

  const role = normalizeRole(user?.role || user?.user_role || user?.userRole);
  const platform = isPlatformRole(role);
  const result = await pool.query(
    `
    SELECT
      r.tenant_id,
      r.standard_code,
      r.version_code,
      v.display_name,
      r.certifiable,
      r.publication_status,
      r.tenant_standard_active,
      r.catalog_coverage_pct,
      r.sync_status,
      r.recommended_assessment_type,
      r.warning_text
    FROM v_iso_express_tenant_standard_readiness r
    JOIN iso_standard_versions v
      ON v.standard_code = r.standard_code
     AND v.version_code = r.version_code
    WHERE r.tenant_id = $1::uuid
    ORDER BY
      CASE
        WHEN r.standard_code = 'ISO9001' AND r.version_code = '2015' THEN 1
        WHEN r.standard_code = 'ISO27001' THEN 2
        WHEN r.standard_code = 'ISO42001' THEN 3
        WHEN r.version_code = '2026_FDIS' THEN 4
        ELSE 9
      END,
      r.standard_code,
      r.version_code
    `,
    [tenantId]
  );

  let rows = result.rows;

  if (platform && !rows.some((row) => row.standard_code === 'ISO42001')) {
    const extra = await pool.query(
      `
      SELECT
        $1::uuid AS tenant_id,
        v.standard_code,
        v.version_code,
        v.display_name,
        v.certifiable,
        v.publication_status,
        false AS tenant_standard_active,
        COALESCE(c.coverage_pct, 0)::numeric AS catalog_coverage_pct,
        COALESCE(s.sync_status, 'not_started') AS sync_status,
        'express' AS recommended_assessment_type,
        'Evaluacion preliminar: la norma no esta activa para este tenant.' AS warning_text
      FROM iso_standard_versions v
      LEFT JOIN v_iso_control_catalog_coverage c
        ON c.standard_code = v.standard_code
       AND c.version_code = v.version_code
      LEFT JOIN iso_catalog_sync_status s
        ON s.standard_code = v.standard_code
       AND s.version_code = v.version_code
       AND s.sync_target = 'controls_catalog'
      WHERE v.standard_code = 'ISO42001'
        AND v.version_code = '2023'
      `,
      [tenantId]
    );
    rows = rows.concat(extra.rows);
  }

  return rows.map((row) => ({
    tenant_id: row.tenant_id,
    standard_code: row.standard_code,
    version_code: row.version_code,
    display_name: row.display_name,
    certifiable: row.certifiable,
    publication_status: row.publication_status,
    assessment_type: row.recommended_assessment_type,
    catalog_coverage_pct: Number(row.catalog_coverage_pct || 0),
    sync_status: row.sync_status,
    recommended:
      row.standard_code === 'ISO9001' &&
      row.version_code === '2015' &&
      Number(row.catalog_coverage_pct || 0) >= 70,
    warnings: row.warning_text ? [row.warning_text] : [],
  }));
}

async function fetchControlRows(tenantId, standardCode, versionCode) {
  const result = await pool.query(
    `
    WITH latest_health AS (
      SELECT DISTINCT ON (tenant_control_id)
        tenant_control_id,
        health_status,
        health_score
      FROM control_health_scores
      ORDER BY tenant_control_id, calculated_at DESC NULLS LAST
    ),
    evidence_stats AS (
      SELECT
        tc.id AS tenant_control_id,
        COUNT(e.id)::integer AS evidence_count,
        COUNT(e.id) FILTER (
          WHERE LOWER(COALESCE(e.status, '')) IN ('aprobada', 'aprobado', 'approved')
        )::integer AS approved_evidence_count,
        COUNT(e.id) FILTER (
          WHERE LOWER(COALESCE(e.status, '')) IN ('pendiente', 'pending', 'en revision', 'en revisión', 'uploaded', 'subida')
        )::integer AS pending_evidence_count,
        COUNT(e.id) FILTER (
          WHERE LOWER(COALESCE(e.status, '')) IN ('rechazada', 'rechazado', 'rejected')
        )::integer AS rejected_evidence_count
      FROM tenant_controls tc
      LEFT JOIN evidences e
        ON e.tenant_id = tc.tenant_id
       AND (
          e.tenant_control_id = tc.id
          OR (
            e.tenant_control_id IS NULL
            AND e.control_id = tc.control_id
          )
       )
       AND COALESCE(e.status, '') <> 'deleted'
      WHERE tc.tenant_id = $1::uuid
      GROUP BY tc.id
    ),
    expected AS (
      SELECT
        control_id,
        COUNT(*)::integer AS expected_evidence_count
      FROM iso_evidence_expectations
      WHERE standard_code = $2
        AND version_code = $3
      GROUP BY control_id
    ),
    risks AS (
      SELECT
        control_code,
        string_agg(title, '; ' ORDER BY risk_code) AS risk_hint
      FROM (
        SELECT
          risk_code,
          title,
          unnest(suggested_controls) AS control_code
        FROM iso_risk_templates
        WHERE standard_code = $2
          AND version_code = $3
      ) risk_controls
      GROUP BY control_code
    )
    SELECT
      ic.id AS iso_control_id,
      ic.control_code,
      ic.title AS control_title,
      ic.description AS control_description,
      ic.domain,
      ic.default_priority,
      ic.owner_role_suggested,
      cl.clause_code,
      l.catalog_control_id,
      l.relationship_type AS mapping_relationship_type,
      l.confidence AS mapping_confidence,
      tc.id AS tenant_control_id,
      tc.status AS implementation_status,
      COALESCE(lh.health_status, tc.health_status) AS health_status,
      lh.health_score,
      COALESCE(es.evidence_count, 0)::integer AS evidence_count,
      COALESCE(es.approved_evidence_count, 0)::integer AS approved_evidence_count,
      COALESCE(es.pending_evidence_count, 0)::integer AS pending_evidence_count,
      COALESCE(es.rejected_evidence_count, 0)::integer AS rejected_evidence_count,
      COALESCE(ex.expected_evidence_count, 0)::integer AS expected_evidence_count,
      r.risk_hint
    FROM iso_controls ic
    LEFT JOIN iso_clauses cl
      ON cl.id = ic.clause_id
    LEFT JOIN iso_control_catalog_links l
      ON l.iso_control_id = ic.id
     AND l.is_active IS DISTINCT FROM false
    LEFT JOIN tenant_controls tc
      ON tc.tenant_id = $1::uuid
     AND tc.control_id = l.catalog_control_id
    LEFT JOIN latest_health lh
      ON lh.tenant_control_id = tc.id
    LEFT JOIN evidence_stats es
      ON es.tenant_control_id = tc.id
    LEFT JOIN expected ex
      ON ex.control_id = ic.id
    LEFT JOIN risks r
      ON r.control_code = ic.control_code
    WHERE ic.standard_code = $2
      AND ic.version_code = $3
      AND ic.is_active IS DISTINCT FROM false
    ORDER BY COALESCE(cl.sort_order, 999999), ic.control_code
    `,
    [tenantId, standardCode, versionCode]
  );

  return result.rows;
}

function evaluateItem(row) {
  const mapped = Boolean(row.catalog_control_id);
  const hasTenantControl = Boolean(row.tenant_control_id);
  const evidenceCount = Number(row.evidence_count || 0);
  const approvedEvidenceCount = Number(row.approved_evidence_count || 0);
  const expectedEvidenceCount = Number(row.expected_evidence_count || 0);
  const hasExpectedEvidence = expectedEvidenceCount > 0;
  const evidenceGap = hasExpectedEvidence
    ? approvedEvidenceCount < Math.max(1, Math.min(expectedEvidenceCount, 2))
    : evidenceCount === 0;
  const controlGap = !mapped || !hasTenantControl;

  let score = 20;

  if (mapped && !hasTenantControl) score = 35;
  if (mapped && hasTenantControl) score = statusScore(row.implementation_status);
  if (mapped && hasTenantControl && evidenceCount > 0) score += 10;
  if (mapped && hasTenantControl && approvedEvidenceCount > 0) score += 15;
  if (evidenceGap) score -= 15;
  score += healthAdjustment(row.health_status, row.health_score);

  const gaps = [];

  if (!mapped) {
    gaps.push(buildGap({
      item: row,
      gapType: 'missing_mapping',
      severity: 'alta',
      title: `Sin mapeo operativo para ${row.control_code}`,
      description: 'El requisito existe en iso_controls pero no tiene link activo hacia controls_catalog.',
      recommendation: 'Revisar y aprobar un mapeo gobernado antes de usar el control en auditoria operativa.',
      dueDays: 60,
    }));
  } else if (!hasTenantControl) {
    gaps.push(buildGap({
      item: row,
      gapType: 'missing_tenant_control',
      severity: 'alta',
      title: `Control no inicializado para tenant: ${row.control_code}`,
      description: 'Existe link hacia controls_catalog, pero el tenant no tiene tenant_control correspondiente.',
      recommendation: 'Revisar alcance operativo y habilitar el control desde el flujo existente, sin inicializacion automatica.',
      dueDays: 30,
    }));
  }

  if (hasTenantControl && evidenceGap) {
    gaps.push(buildGap({
      item: row,
      gapType: 'missing_evidence',
      severity: hasExpectedEvidence ? 'alta' : 'media',
      title: `Evidencia insuficiente para ${row.control_code}`,
      description: 'El control no tiene evidencia aprobada suficiente frente a la expectativa normativa.',
      recommendation: 'Cargar o aprobar evidencia vigente vinculada al control.',
      dueDays: 30,
      metadata: {
        expected_evidence_count: expectedEvidenceCount,
        approved_evidence_count: approvedEvidenceCount,
      },
    }));
  }

  if (String(row.health_status || '').toLowerCase() === 'deteriorado') {
    gaps.push(buildGap({
      item: row,
      gapType: 'weak_control_status',
      severity: 'critica',
      title: `Control deteriorado: ${row.control_code}`,
      description: 'El health status del control indica deterioro.',
      recommendation: 'Priorizar revision de causa, evidencia y accion correctiva.',
      dueDays: 30,
    }));
  }

  const gapSeverity = highestSeverity(...gaps.map((gap) => gap.severity));

  return {
    item: {
      iso_control_id: row.iso_control_id,
      control_code: row.control_code,
      control_title: row.control_title,
      clause_code: row.clause_code,
      catalog_control_id: row.catalog_control_id,
      tenant_control_id: row.tenant_control_id,
      mapping_relationship_type: row.mapping_relationship_type,
      mapping_confidence: row.mapping_confidence,
      implementation_status: row.implementation_status,
      health_status: row.health_status,
      health_score: row.health_score,
      evidence_count: evidenceCount,
      approved_evidence_count: approvedEvidenceCount,
      pending_evidence_count: Number(row.pending_evidence_count || 0),
      rejected_evidence_count: Number(row.rejected_evidence_count || 0),
      has_expected_evidence: hasExpectedEvidence,
      expected_evidence_count: expectedEvidenceCount,
      evidence_gap: evidenceGap,
      control_gap: controlGap,
      risk_hint: row.risk_hint,
      gap_severity: gapSeverity,
      recommendation: itemRecommendation({
        ...row,
        evidence_gap: evidenceGap,
      }),
      item_score: clampScore(score),
      item_result_json: {
        mapped,
        has_tenant_control: hasTenantControl,
        has_expected_evidence: hasExpectedEvidence,
      },
      owner_role_suggested: row.owner_role_suggested,
    },
    gaps,
  };
}

function buildCoverageWarning({ standardCode, versionCode, certifiable, coveragePct }) {
  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    return 'ISO9001 2026_FDIS es solo preparacion de transicion, no version final certificable.';
  }

  if (standardCode === 'ISO42001' && coveragePct <= 0) {
    return 'ISO42001 se evaluara preliminarmente con iso_* porque no hay mapeo operativo suficiente.';
  }

  if (coveragePct < 30) {
    return 'Cobertura operativa baja: el diagnostico es preliminar y requiere revision humana.';
  }

  if (coveragePct < 80) {
    return 'Cobertura operativa parcial: complementar mapeos antes de usar para auditoria formal.';
  }

  if (!certifiable) {
    return 'Version no certificable: usar solo como diagnostico preliminar.';
  }

  return null;
}

async function calculateAssessment({ tenantId, user, standardCode, versionCode, assessmentType, answers = [] }) {
  assertTenantAccess(user, tenantId);

  const normalizedStandard = normalizeStandardCode(standardCode);
  const normalizedVersion = normalizeVersionCode(versionCode);
  const version = await getStandardVersion(normalizedStandard, normalizedVersion);
  const effectiveType = normalizeAssessmentType(assessmentType, normalizedVersion);

  if (normalizedVersion === '2026_FDIS' && effectiveType !== 'transition_readiness') {
    throw publicError(
      400,
      'ISO9001_2026_TRANSITION_ONLY',
      'ISO9001 2026_FDIS solo permite diagnostico de preparacion/transicion'
    );
  }

  if (effectiveType === 'certification_readiness' && version.certifiable !== true) {
    throw publicError(400, 'VERSION_NOT_CERTIFIABLE', 'La version seleccionada no es certificable');
  }

  if (normalizedVersion === '2026_FDIS') {
    const has9001 = await tenantHasStandard(tenantId, 'ISO9001');
    if (!has9001) {
      throw publicError(400, 'ISO9001_REQUIRED_FOR_TRANSITION', 'El tenant debe tener ISO9001 activa para evaluar transicion FDIS');
    }
  } else {
    const hasStandard = await tenantHasStandard(tenantId, normalizedStandard);
    const platform = isPlatformRole(user?.role || user?.user_role || user?.userRole);
    if (!hasStandard && !(platform && normalizedStandard === 'ISO42001')) {
      throw publicError(400, 'TENANT_STANDARD_NOT_ACTIVE', 'La norma no esta activa para este tenant');
    }
  }

  const [controlRows, coverageRows] = await Promise.all([
    fetchControlRows(tenantId, normalizedStandard, normalizedVersion),
    pool.query(
      `
      SELECT *
      FROM v_iso_control_catalog_coverage
      WHERE standard_code = $1
        AND version_code = $2
      LIMIT 1
      `,
      [normalizedStandard, normalizedVersion]
    ),
  ]);

  const coverage = coverageRows.rows[0] || {};
  const evaluated = controlRows.map(evaluateItem);
  const items = evaluated.map((entry) => entry.item);
  const gaps = evaluated.flatMap((entry) => entry.gaps);
  const totalIsoControls = items.length;
  const mappedControlsCount = items.filter((item) => item.catalog_control_id).length;
  const evaluatedControlsCount = items.filter((item) => item.tenant_control_id).length;
  const controlsWithEvidenceCount = items.filter((item) => item.approved_evidence_count > 0 || item.evidence_count > 0).length;
  const controlsWithoutEvidenceCount = items.filter((item) => item.evidence_gap).length;
  const avgItemScore = totalIsoControls
    ? items.reduce((sum, item) => sum + Number(item.item_score || 0), 0) / totalIsoControls
    : 0;
  const coveragePct = Number(coverage.coverage_pct || 0);
  const coveragePenalty = coveragePct < 30 ? 15 : coveragePct < 80 ? 5 : 0;
  const criticalGaps = gaps.filter((gap) => gap.severity === 'critica').length;
  const highGaps = gaps.filter((gap) => gap.severity === 'alta').length;
  const mediumGaps = gaps.filter((gap) => gap.severity === 'media').length;
  const lowGaps = gaps.filter((gap) => gap.severity === 'baja').length;
  const gapPenalty = criticalGaps * 5 + highGaps * 2 + mediumGaps;
  const readinessScore = clampScore(avgItemScore - coveragePenalty - gapPenalty);
  const maturityScore = clampScore(avgItemScore - coveragePenalty);
  const riskScore = clampScore(100 - readinessScore + criticalGaps * 3 + highGaps * 2);
  const level = readinessLevel(readinessScore, effectiveType);
  const coverageWarning = buildCoverageWarning({
    standardCode: normalizedStandard,
    versionCode: normalizedVersion,
    certifiable: version.certifiable,
    coveragePct,
  });

  if (coverageWarning) {
    gaps.unshift({
      iso_control_id: null,
      control_code: null,
      gap_type: normalizedVersion === '2026_FDIS' ? 'transition_warning' : 'coverage_warning',
      severity: normalizedVersion === '2026_FDIS' ? 'critica' : 'media',
      title: normalizedVersion === '2026_FDIS'
        ? 'Version de transicion no certificable'
        : 'Cobertura operativa parcial',
      description: coverageWarning,
      recommendation: normalizedVersion === '2026_FDIS'
        ? 'Usar este resultado solo para preparacion de transicion y mantener ISO9001:2015 como base certificable.'
        : 'Completar mapeos gobernados antes de auditoria formal.',
      suggested_action_type: 'review',
      suggested_owner_role: 'Responsable de compliance',
      suggested_due_days: 30,
      metadata: { coverage_pct: coveragePct },
    });
  }

  const plans = buildPlan(gaps, effectiveType, normalizedStandard, normalizedVersion);
  const summary = {
    display_name: version.display_name,
    certifiable: version.certifiable,
    publication_status: version.publication_status,
    coverage_pct: coveragePct,
    coverage_warning: coverageWarning,
    readiness_score: readinessScore,
    readiness_level: level,
    top_gaps: gaps.slice(0, 8).map((gap) => ({
      gap_type: gap.gap_type,
      severity: gap.severity,
      title: gap.title,
      recommendation: gap.recommendation,
      control_code: gap.control_code,
    })),
  };
  const resultJson = {
    scoring_model: 'iso_express_v1',
    avg_item_score: Number(avgItemScore.toFixed(2)),
    coverage_penalty: coveragePenalty,
    gap_penalty: gapPenalty,
    controls: {
      total_iso_controls: totalIsoControls,
      mapped_controls_count: mappedControlsCount,
      evaluated_controls_count: evaluatedControlsCount,
      controls_with_evidence_count: controlsWithEvidenceCount,
      controls_without_evidence_count: controlsWithoutEvidenceCount,
    },
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const assessmentInsert = await client.query(
      `
      INSERT INTO iso_express_assessments (
        tenant_id,
        standard_code,
        version_code,
        assessment_type,
        assessment_status,
        requested_by,
        source,
        certifiable_version,
        coverage_warning,
        readiness_score,
        readiness_level,
        total_iso_controls,
        mapped_controls_count,
        evaluated_controls_count,
        controls_with_evidence_count,
        controls_without_evidence_count,
        gaps_count,
        critical_gaps_count,
        high_gaps_count,
        medium_gaps_count,
        low_gaps_count,
        risk_score,
        maturity_score,
        plan_30_json,
        plan_60_json,
        plan_90_json,
        summary_json,
        input_json,
        result_json,
        completed_at
      )
      VALUES (
        $1::uuid,$2,$3,$4,'calculated',$5::uuid,'manual',$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
        $22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,$27::jsonb,NOW()
      )
      RETURNING *
      `,
      [
        tenantId,
        normalizedStandard,
        normalizedVersion,
        effectiveType,
        getUserId(user),
        version.certifiable === true,
        coverageWarning,
        readinessScore,
        level,
        totalIsoControls,
        mappedControlsCount,
        evaluatedControlsCount,
        controlsWithEvidenceCount,
        controlsWithoutEvidenceCount,
        gaps.length,
        gaps.filter((gap) => gap.severity === 'critica').length,
        gaps.filter((gap) => gap.severity === 'alta').length,
        gaps.filter((gap) => gap.severity === 'media').length,
        gaps.filter((gap) => gap.severity === 'baja').length,
        riskScore,
        maturityScore,
        JSON.stringify(plans.plan30),
        JSON.stringify(plans.plan60),
        JSON.stringify(plans.plan90),
        JSON.stringify(summary),
        JSON.stringify({ answers }),
        JSON.stringify(resultJson),
      ]
    );
    const assessment = assessmentInsert.rows[0];

    for (const item of items) {
      await client.query(
        `
        INSERT INTO iso_express_assessment_items (
          assessment_id, tenant_id, standard_code, version_code, iso_control_id,
          control_code, control_title, clause_code, catalog_control_id, tenant_control_id,
          mapping_relationship_type, mapping_confidence, implementation_status,
          health_status, health_score, evidence_count, approved_evidence_count,
          pending_evidence_count, rejected_evidence_count, has_expected_evidence,
          expected_evidence_count, evidence_gap, control_gap, risk_hint,
          gap_severity, recommendation, item_score, item_result_json
        )
        VALUES (
          $1::uuid,$2::uuid,$3,$4,$5::uuid,$6,$7,$8,$9::uuid,$10::uuid,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
          $25,$26,$27,$28::jsonb
        )
        `,
        [
          assessment.id,
          tenantId,
          normalizedStandard,
          normalizedVersion,
          item.iso_control_id,
          item.control_code,
          item.control_title,
          item.clause_code,
          item.catalog_control_id,
          item.tenant_control_id,
          item.mapping_relationship_type,
          item.mapping_confidence,
          item.implementation_status,
          item.health_status,
          item.health_score,
          item.evidence_count,
          item.approved_evidence_count,
          item.pending_evidence_count,
          item.rejected_evidence_count,
          item.has_expected_evidence,
          item.expected_evidence_count,
          item.evidence_gap,
          item.control_gap,
          item.risk_hint,
          item.gap_severity,
          item.recommendation,
          item.item_score,
          JSON.stringify(item.item_result_json || {}),
        ]
      );
    }

    for (const gap of gaps) {
      await client.query(
        `
        INSERT INTO iso_express_assessment_gaps (
          assessment_id, tenant_id, standard_code, version_code, iso_control_id,
          control_code, gap_type, severity, title, description, recommendation,
          suggested_action_type, suggested_owner_role, suggested_due_days, source, metadata
        )
        VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13,$14,'diagnostic_engine',$15::jsonb)
        `,
        [
          assessment.id,
          tenantId,
          normalizedStandard,
          normalizedVersion,
          gap.iso_control_id,
          gap.control_code,
          gap.gap_type,
          gap.severity,
          gap.title,
          gap.description,
          gap.recommendation,
          gap.suggested_action_type,
          gap.suggested_owner_role,
          gap.suggested_due_days,
          JSON.stringify(gap.metadata || {}),
        ]
      );
    }

    for (const answer of Array.isArray(answers) ? answers : []) {
      await client.query(
        `
        INSERT INTO iso_express_assessment_answers (
          assessment_id, tenant_id, question_code, question_text, answer_value, answer_score, notes
        )
        VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7)
        `,
        [
          assessment.id,
          tenantId,
          String(answer.question_code || ''),
          String(answer.question_text || ''),
          answer.answer_value == null ? null : String(answer.answer_value),
          Number.isFinite(Number(answer.answer_score)) ? Number(answer.answer_score) : null,
          answer.notes == null ? null : String(answer.notes),
        ]
      );
    }

    await client.query(
      `
      INSERT INTO iso_express_assessment_audit_log (
        assessment_id, tenant_id, action, actor_user_id, new_data, metadata
      )
      VALUES ($1::uuid,$2::uuid,'calculate',$3::uuid,$4::jsonb,$5::jsonb)
      `,
      [
        assessment.id,
        tenantId,
        getUserId(user),
        JSON.stringify(summary),
        JSON.stringify({ standard_code: normalizedStandard, version_code: normalizedVersion }),
      ]
    );

    await client.query('COMMIT');

    return {
      assessment,
      items,
      gaps,
      answers,
      summary,
      plan_30: plans.plan30,
      plan_60: plans.plan60,
      plan_90: plans.plan90,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listLatestAssessments(tenantId, user, filters = {}) {
  assertTenantAccess(user, tenantId);

  const where = ['tenant_id = $1::uuid'];
  const values = [tenantId];

  if (filters.standard_code) {
    values.push(normalizeStandardCode(filters.standard_code));
    where.push(`standard_code = $${values.length}`);
  }

  if (filters.version_code) {
    values.push(normalizeVersionCode(filters.version_code));
    where.push(`version_code = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM iso_express_assessments
    WHERE ${where.join(' AND ')}
      AND assessment_status IS DISTINCT FROM 'archived'
    ORDER BY created_at DESC
    LIMIT 20
    `,
    values
  );

  return result.rows;
}

async function getAssessmentDetail(tenantId, assessmentId, user) {
  assertTenantAccess(user, tenantId);

  const assessmentResult = await pool.query(
    `
    SELECT *
    FROM iso_express_assessments
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [assessmentId, tenantId]
  );

  if (!assessmentResult.rowCount) {
    throw publicError(404, 'ASSESSMENT_NOT_FOUND', 'Diagnostico no encontrado');
  }

  const [items, gaps, answers] = await Promise.all([
    pool.query(
      `
      SELECT *
      FROM iso_express_assessment_items
      WHERE assessment_id = $1::uuid
      ORDER BY clause_code NULLS LAST, control_code
      `,
      [assessmentId]
    ),
    pool.query(
      `
      SELECT *
      FROM iso_express_assessment_gaps
      WHERE assessment_id = $1::uuid
      ORDER BY
        CASE severity
          WHEN 'critica' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          ELSE 4
        END,
        created_at
      `,
      [assessmentId]
    ),
    pool.query(
      `
      SELECT *
      FROM iso_express_assessment_answers
      WHERE assessment_id = $1::uuid
      ORDER BY created_at
      `,
      [assessmentId]
    ),
  ]);

  const assessment = assessmentResult.rows[0];

  return {
    assessment,
    items: items.rows,
    gaps: gaps.rows,
    answers: answers.rows,
    summary: assessment.summary_json || {},
    plan_30: assessment.plan_30_json || [],
    plan_60: assessment.plan_60_json || [],
    plan_90: assessment.plan_90_json || [],
  };
}

async function listGaps(tenantId, assessmentId, user) {
  const detail = await getAssessmentDetail(tenantId, assessmentId, user);
  return detail.gaps;
}

async function getPlan(tenantId, assessmentId, user) {
  const detail = await getAssessmentDetail(tenantId, assessmentId, user);

  return {
    assessment_id: assessmentId,
    plan_30: detail.plan_30,
    plan_60: detail.plan_60,
    plan_90: detail.plan_90,
  };
}

async function archiveAssessment(tenantId, assessmentId, user) {
  assertTenantAccess(user, tenantId);

  const result = await pool.query(
    `
    UPDATE iso_express_assessments
    SET assessment_status = 'archived',
        updated_at = now()
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    RETURNING *
    `,
    [assessmentId, tenantId]
  );

  if (!result.rowCount) {
    throw publicError(404, 'ASSESSMENT_NOT_FOUND', 'Diagnostico no encontrado');
  }

  await pool.query(
    `
    INSERT INTO iso_express_assessment_audit_log (
      assessment_id, tenant_id, action, actor_user_id, metadata
    )
    VALUES ($1::uuid,$2::uuid,'archive',$3::uuid,'{}'::jsonb)
    `,
    [assessmentId, tenantId, getUserId(user)]
  );

  return result.rows[0];
}

async function getReadiness(tenantId, user, filters = {}) {
  assertTenantAccess(user, tenantId);

  const rows = await listLatestAssessments(tenantId, user, {
    standard_code: filters.standard_code,
    version_code: filters.version_code,
  });
  const latest = rows[0] || null;

  if (!latest) {
    return {
      tenant_id: tenantId,
      latest: null,
      readiness_score: 0,
      readiness_level: 'sin_diagnostico',
    };
  }

  return {
    tenant_id: tenantId,
    latest,
    readiness_score: Number(latest.readiness_score || 0),
    readiness_level: latest.readiness_level,
    summary: latest.summary_json || {},
  };
}

module.exports = {
  getAssessmentOptions,
  calculateAssessment,
  listLatestAssessments,
  getAssessmentDetail,
  listGaps,
  getPlan,
  archiveAssessment,
  getReadiness,
};
