const pool = require('../config/db');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const ALLOWED_RUN_TYPES = new Set([
  'automated',
  'manual_review',
  'transition_readiness',
  'asset_based',
]);

const ALLOWED_REVIEW_STATUS = new Set([
  'suggested',
  'accepted',
  'rejected',
  'needs_review',
  'archived',
]);

const RISK_MATRIX_WRITE_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
  'admin',
  'tenant_admin',
  'operativo',
  'responsable_area',
  'area_owner',
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
  return user?.user_id || user?.userId || user?.id || null;
}

function assertTenantAccess(user, tenantId) {
  const role = user?.role || user?.user_role || user?.userRole;
  if (isPlatformRole(role)) return;

  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function canManageRiskMatrix(user) {
  return RISK_MATRIX_WRITE_ROLES.has(normalizeRole(user?.role || user?.user_role || user?.userRole));
}

function assertCanManageRiskMatrix(user) {
  if (!canManageRiskMatrix(user)) {
    throw publicError(403, 'RISK_MATRIX_WRITE_DENIED', 'No autorizado para editar matriz de riesgos');
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

function normalizeRunType(value, standardCode, versionCode) {
  const runType = String(value || '').trim() || (versionCode === '2026_FDIS' ? 'transition_readiness' : 'automated');

  if (!ALLOWED_RUN_TYPES.has(runType)) {
    throw publicError(400, 'INVALID_RUN_TYPE', 'run_type invalido');
  }

  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS' && runType !== 'transition_readiness') {
    throw publicError(
      400,
      'ISO9001_2026_TRANSITION_ONLY',
      'ISO9001 2026_FDIS solo permite matriz de riesgos de preparacion/transicion'
    );
  }

  return runType;
}

function boolValue(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'si', 'sí'].includes(String(value).toLowerCase());
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min = 1, max = 5) {
  const n = Math.round(numberValue(value, min));
  return Math.max(min, Math.min(max, n));
}

function parseRiskAxis(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw publicError(400, 'INVALID_RISK_AXIS', `${field} debe ser un entero entre 1 y 5`);
  }
  return n;
}

function round2(value) {
  return Math.round(numberValue(value) * 100) / 100;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'object') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function riskLevel(score) {
  if (score >= 16) return 'critico';
  if (score >= 10) return 'alto';
  if (score >= 5) return 'medio';
  return 'bajo';
}

function riskPosture(avgResidual, criticalCount, highCount) {
  if (criticalCount > 0 || avgResidual >= 16) return 'critica';
  if (highCount > 2 || avgResidual >= 10) return 'alta';
  if (avgResidual >= 5) return 'moderada';
  return 'controlada';
}

function levelPriority(level) {
  if (level === 'critico') return 'critica';
  if (level === 'alto') return 'alta';
  if (level === 'medio') return 'media';
  return 'baja';
}

function treatmentStrategy(level) {
  if (level === 'critico' || level === 'alto') return 'mitigar';
  if (level === 'medio') return 'monitorear';
  return 'aceptar';
}

function criticalityImpactBoost(criticality) {
  const value = normalizeText(criticality);
  if (['critica', 'critico', 'critical', 'alta', 'alto', 'high'].some((word) => value.includes(word))) return 1;
  if (['baja', 'bajo', 'low'].some((word) => value.includes(word))) return -1;
  return 0;
}

function controlEffectiveness(control) {
  if (!control) return 0;

  let score = 20;

  if (control.tenant_control_id) score += 25;
  if (Number(control.approved_evidence_count || 0) > 0) score += 25;
  if (Number(control.evidence_count || 0) > 0) score += 10;

  const healthScore = Number(control.health_score);
  if (Number.isFinite(healthScore) && healthScore > 0) {
    score += Math.max(-20, Math.min(20, healthScore - 60));
  }

  const health = normalizeText(control.health_status);
  if (health.includes('saludable') || health.includes('healthy')) score += 15;
  if (health.includes('atencion') || health.includes('warning')) score -= 5;
  if (health.includes('deteriorado') || health.includes('critical')) score -= 25;

  if (control.evidence_gap) score -= 15;
  if (!control.catalog_control_id) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function residualFactor(effectiveness) {
  if (effectiveness >= 80) return 2;
  if (effectiveness >= 55) return 1;
  return 0;
}

function calculateRiskAxes({ likelihood, impact, controlEffectiveness = 0 }) {
  const inherentRiskScore = likelihood * impact;
  const inherentRiskLevel = riskLevel(inherentRiskScore);
  const effectiveness = numberValue(controlEffectiveness, 0);
  const reduction = residualFactor(effectiveness);
  const residualLikelihood = clampInt(likelihood - reduction);
  const residualImpact = clampInt(impact - (effectiveness >= 85 ? 1 : 0));
  const residualRiskScore = residualLikelihood * residualImpact;
  const residualRiskLevel = riskLevel(residualRiskScore);

  return {
    likelihood,
    impact,
    inherent_risk_score: inherentRiskScore,
    inherent_risk_level: inherentRiskLevel,
    residual_likelihood: residualLikelihood,
    residual_impact: residualImpact,
    residual_risk_score: residualRiskScore,
    residual_risk_level: residualRiskLevel,
    treatment_strategy: treatmentStrategy(residualRiskLevel),
  };
}

function buildCoverageWarning({ standardCode, versionCode, certifiable, coveragePct }) {
  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    return 'ISO9001 2026_FDIS es solo preparacion de transicion; no es version final certificable.';
  }

  if (standardCode === 'ISO42001' && coveragePct <= 0) {
    return 'ISO42001 se tratara como matriz preliminar de gobierno IA porque falta mapeo operativo suficiente.';
  }

  if (coveragePct < 30) {
    return 'Cobertura operativa baja: la matriz usa iso_* y requiere revision humana antes de auditoria formal.';
  }

  if (coveragePct < 80) {
    return 'Cobertura operativa parcial: complementar mapeos gobernados para mayor precision.';
  }

  if (!certifiable) {
    return 'Version no certificable: usar solo para preparacion o analisis preliminar.';
  }

  return null;
}

function defaultTemplateForTransition(version) {
  return [
    {
      id: null,
      risk_code: 'QMS26-RISK-01',
      title: 'Uso prematuro de version no certificable',
      description: 'La organizacion podria tratar ISO9001 2026_FDIS como base certificable final antes de publicacion definitiva.',
      category: 'transicion',
      suggested_controls: [],
      suggested_treatments: ['mantener ISO9001:2015 como base certificable', 'documentar caveats', 'validar fuentes antes de decisiones'],
      default_likelihood: 4,
      default_impact: 4,
      standard_code: 'ISO9001',
      version_code: version,
    },
    {
      id: null,
      risk_code: 'QMS26-RISK-02',
      title: 'Cambio documental no reversible',
      description: 'Documentos o procesos podrian modificarse con supuestos FDIS sin control de reversibilidad.',
      category: 'documentacion',
      suggested_controls: [],
      suggested_treatments: ['crear plan reversible', 'aprobar impactos', 'separar preparacion de cumplimiento final'],
      default_likelihood: 3,
      default_impact: 4,
      standard_code: 'ISO9001',
      version_code: version,
    },
  ];
}

function defaultTemplateForIso42001() {
  return [
    {
      id: null,
      risk_code: 'AIMS-RISK-BASE-01',
      title: 'Inventario IA incompleto',
      description: 'Sistemas, proveedores o usos de IA pueden operar sin propietario, finalidad ni evaluacion de impacto.',
      category: 'gobernanza_ia',
      suggested_controls: ['AIMS-OPS-01', 'AIMS-OPS-02'],
      suggested_treatments: ['crear inventario IA', 'clasificar criticidad', 'asignar propietarios'],
      default_likelihood: 4,
      default_impact: 4,
      standard_code: 'ISO42001',
      version_code: '2023',
    },
    {
      id: null,
      risk_code: 'AIMS-RISK-BASE-02',
      title: 'Decision automatizada sin supervision humana',
      description: 'Una decision apoyada por IA podria afectar personas o procesos sin revision, explicabilidad ni registro.',
      category: 'supervision_humana',
      suggested_controls: ['AIMS-OPS-04', 'AIMS-EVL-01'],
      suggested_treatments: ['definir puntos de aprobacion', 'registrar decisiones', 'monitorear sesgo y desempeno'],
      default_likelihood: 3,
      default_impact: 5,
      standard_code: 'ISO42001',
      version_code: '2023',
    },
  ];
}

async function getStandardVersion(standardCode, versionCode) {
  const result = await pool.query(
    `
    SELECT id, standard_code, version_code, display_name, publication_status, certifiable, notes
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

async function assertStandardAllowedForTenant({ tenantId, user, standardCode, versionCode }) {
  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    const has9001 = await tenantHasStandard(tenantId, 'ISO9001');
    if (!has9001) {
      throw publicError(400, 'ISO9001_REQUIRED_FOR_TRANSITION', 'El tenant debe tener ISO9001 activa para matriz de transicion FDIS');
    }
    return;
  }

  const active = await tenantHasStandard(tenantId, standardCode);
  const platform = isPlatformRole(user?.role || user?.user_role || user?.userRole);

  if (!active && !(platform && standardCode === 'ISO42001')) {
    throw publicError(400, 'TENANT_STANDARD_NOT_ACTIVE', 'La norma no esta activa para este tenant');
  }
}

async function fetchCoverage(standardCode, versionCode) {
  const result = await pool.query(
    `
    SELECT *
    FROM v_iso_control_catalog_coverage
    WHERE standard_code = $1
      AND version_code = $2
    LIMIT 1
    `,
    [standardCode, versionCode]
  );

  return result.rows[0] || {};
}

async function fetchRiskTemplates(standardCode, versionCode) {
  const result = await pool.query(
    `
    SELECT *
    FROM iso_risk_templates
    WHERE standard_code = $1
      AND version_code = $2
    ORDER BY risk_code
    `,
    [standardCode, versionCode]
  );

  if (result.rows.length > 0) return result.rows;
  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') return defaultTemplateForTransition(versionCode);
  if (standardCode === 'ISO42001') return defaultTemplateForIso42001();
  return [];
}

async function fetchAssets(tenantId, standardCode, includeAssets) {
  if (!includeAssets) return [];

  const result = await pool.query(
    `
    SELECT DISTINCT ON (a.id)
      a.id,
      a.name,
      a.type,
      a.criticality,
      a.owner,
      a.iso,
      ast.standard_code AS asset_standard_code,
      CASE
        WHEN ast.standard_code = $2 THEN 1
        WHEN REPLACE(UPPER(COALESCE(a.iso, '')), ' ', '') = $2 THEN 2
        WHEN $2 = 'ISO42001' AND (
          LOWER(COALESCE(a.name, '') || ' ' || COALESCE(a.type, '')) LIKE '%ia%'
          OR LOWER(COALESCE(a.name, '') || ' ' || COALESCE(a.type, '')) LIKE '%ai%'
          OR LOWER(COALESCE(a.name, '') || ' ' || COALESCE(a.type, '')) LIKE '%modelo%'
        ) THEN 3
        ELSE 9
      END AS relevance_rank
    FROM assets a
    LEFT JOIN asset_standards ast
      ON ast.asset_id = a.id
    WHERE a.tenant_id = $1::uuid
    ORDER BY a.id, relevance_rank ASC, a.created_at DESC NULLS LAST
    LIMIT 60
    `,
    [tenantId, standardCode]
  );

  const relevant = result.rows.filter((asset) => Number(asset.relevance_rank || 9) <= 3);
  return relevant.length > 0 ? relevant : result.rows.slice(0, 20);
}

async function fetchExistingAssetRisks(tenantId, standardCode, includeExisting) {
  if (!includeExisting) return [];

  const result = await pool.query(
    `
    SELECT
      ar.id,
      ar.asset_id,
      ar.risk,
      ar.impact,
      ar.probability,
      ar.level,
      a.name AS asset_name,
      a.type AS asset_type,
      a.criticality AS asset_criticality,
      a.iso AS asset_iso
    FROM asset_risks ar
    INNER JOIN assets a
      ON a.id = ar.asset_id
    WHERE a.tenant_id = $1::uuid
      AND (
        REPLACE(UPPER(COALESCE(a.iso, '')), ' ', '') = $2
        OR $2 IN ('ISO9001', 'ISO27001', 'ISO42001')
      )
    ORDER BY ar.created_at DESC NULLS LAST
    LIMIT 40
    `,
    [tenantId, standardCode]
  );

  return result.rows;
}

async function latestAssessment(tenantId, standardCode, versionCode, sourceAssessmentId) {
  if (sourceAssessmentId) {
    const byId = await pool.query(
      `
      SELECT *
      FROM iso_express_assessments
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND standard_code = $3
        AND version_code = $4
      LIMIT 1
      `,
      [sourceAssessmentId, tenantId, standardCode, versionCode]
    );
    return byId.rows[0] || null;
  }

  const result = await pool.query(
    `
    SELECT *
    FROM iso_express_assessments
    WHERE tenant_id = $1::uuid
      AND standard_code = $2
      AND version_code = $3
      AND assessment_status IS DISTINCT FROM 'archived'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, standardCode, versionCode]
  );

  return result.rows[0] || null;
}

async function fetchAssessmentGaps(tenantId, assessmentId, includeDiagnosticGaps) {
  if (!includeDiagnosticGaps || !assessmentId) return [];

  const result = await pool.query(
    `
    SELECT *
    FROM iso_express_assessment_gaps
    WHERE tenant_id = $1::uuid
      AND assessment_id = $2::uuid
    ORDER BY
      CASE severity
        WHEN 'critica' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'media' THEN 3
        ELSE 4
      END,
      created_at DESC
    LIMIT 60
    `,
    [tenantId, assessmentId]
  );

  return result.rows;
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
        )::integer AS approved_evidence_count
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
        jsonb_agg(
          jsonb_build_object(
            'evidence_name', evidence_name,
            'evidence_type', evidence_type,
            'required_level', required_level
          )
          ORDER BY evidence_name
        ) AS evidence_expectations,
        COUNT(*)::integer AS expected_evidence_count
      FROM iso_evidence_expectations
      WHERE standard_code = $2
        AND version_code = $3
      GROUP BY control_id
    )
    SELECT
      ic.id AS iso_control_id,
      ic.control_code,
      ic.title AS control_title,
      ic.domain,
      ic.default_priority,
      ic.owner_role_suggested,
      l.catalog_control_id,
      l.relationship_type AS mapping_relationship_type,
      l.confidence AS mapping_confidence,
      tc.id AS tenant_control_id,
      tc.status AS implementation_status,
      COALESCE(lh.health_status, tc.health_status) AS health_status,
      lh.health_score,
      COALESCE(es.evidence_count, 0)::integer AS evidence_count,
      COALESCE(es.approved_evidence_count, 0)::integer AS approved_evidence_count,
      COALESCE(ex.expected_evidence_count, 0)::integer AS expected_evidence_count,
      COALESCE(ex.evidence_expectations, '[]'::jsonb) AS evidence_expectations,
      CASE
        WHEN COALESCE(ex.expected_evidence_count, 0) > 0
          THEN COALESCE(es.approved_evidence_count, 0) < 1
        ELSE COALESCE(es.evidence_count, 0) = 0
      END AS evidence_gap
    FROM iso_controls ic
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
    WHERE ic.standard_code = $2
      AND ic.version_code = $3
      AND ic.is_active IS DISTINCT FROM false
    ORDER BY ic.control_code
    `,
    [tenantId, standardCode, versionCode]
  );

  return result.rows.map((row) => ({
    ...row,
    effectiveness_score: controlEffectiveness(row),
  }));
}

function matchControl(template, controls, gap) {
  const suggested = Array.isArray(template.suggested_controls) ? template.suggested_controls : [];
  const exact = controls.find((control) => suggested.includes(control.control_code));
  if (exact) return exact;

  if (gap?.iso_control_id) {
    const byGap = controls.find((control) => String(control.iso_control_id) === String(gap.iso_control_id));
    if (byGap) return byGap;
  }

  const haystack = normalizeText([
    template.title,
    template.description,
    template.category,
    gap?.title,
    gap?.description,
  ].join(' '));

  return controls.find((control) => {
    const controlText = normalizeText([
      control.control_code,
      control.control_title,
      control.domain,
    ].join(' '));
    return controlText && haystack.includes(controlText.split(' ')[0]);
  }) || controls[0] || null;
}

function assetMatchesTemplate(asset, template, standardCode) {
  if (!asset) return false;
  if (standardCode === 'ISO27001') return true;
  if (standardCode === 'ISO42001') {
    const text = normalizeText(`${asset.name} ${asset.type}`);
    return ['ia', 'ai', 'modelo', 'algoritmo', 'datos', 'software', 'sistema'].some((word) => text.includes(word));
  }
  if (standardCode === 'ISO9001') {
    const text = normalizeText(`${asset.name} ${asset.type} ${template.category}`);
    return ['proceso', 'cliente', 'proveedor', 'servicio', 'documento', 'calidad'].some((word) => text.includes(word));
  }
  return true;
}

function buildSuggestedActions({ template, level, control, gap, asset, standardCode, versionCode }) {
  const treatments = safeJsonArray(template.suggested_treatments)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const base = treatments.length > 0
    ? treatments
    : ['asignar responsable', 'definir tratamiento', 'verificar eficacia'];

  const actions = base.slice(0, 4).map((item) => ({
    title: item.charAt(0).toUpperCase() + item.slice(1),
    description: `Accion sugerida para ${template.title}${asset?.name ? ` en ${asset.name}` : ''}.`,
    owner_role: control?.owner_role_suggested || 'Responsable de cumplimiento',
    due_days: level === 'critico' || level === 'alto' ? 30 : 60,
    priority: levelPriority(level),
    action_type: 'risk_treatment',
  }));

  if (control?.evidence_gap) {
    actions.unshift({
      title: `Completar evidencia para ${control.control_code}`,
      description: 'Cargar o aprobar evidencia vigente antes de cerrar el tratamiento.',
      owner_role: control.owner_role_suggested || 'Responsable del control',
      due_days: 30,
      priority: 'alta',
      action_type: 'missing_evidence',
    });
  }

  if (gap) {
    actions.unshift({
      title: gap.title,
      description: gap.recommendation || gap.description || 'Revisar brecha identificada por diagnostico express.',
      owner_role: gap.suggested_owner_role || control?.owner_role_suggested || 'Responsable de cumplimiento',
      due_days: Math.min(Number(gap.suggested_due_days || 30), 60),
      priority: gap.severity === 'critica' ? 'critica' : gap.severity === 'alta' ? 'alta' : 'media',
      action_type: gap.gap_type || 'diagnostic_gap',
    });
  }

  if (standardCode === 'ISO9001' && versionCode === '2026_FDIS') {
    actions.unshift({
      title: 'Mantener caveat de no certificabilidad',
      description: 'Registrar que esta matriz es solo de preparacion de transicion y no sustituye ISO9001:2015.',
      owner_role: 'Responsable de calidad',
      due_days: 30,
      priority: 'critica',
      action_type: 'transition_warning',
    });
  }

  return actions.slice(0, 6);
}

function buildRiskItem({ template, asset, control, gap, assessment, standardCode, versionCode, existingAssetRisk = null }) {
  let likelihood = clampInt(template.default_likelihood || 3);
  let impact = clampInt(template.default_impact || 3);

  if (asset) impact = clampInt(impact + criticalityImpactBoost(asset.criticality));
  if (gap?.severity === 'critica') {
    likelihood = clampInt(likelihood + 1);
    impact = clampInt(impact + 1);
  } else if (gap?.severity === 'alta') {
    likelihood = clampInt(likelihood + 1);
  }
  if (control?.evidence_gap) likelihood = clampInt(likelihood + 1);
  if (String(control?.health_status || '').toLowerCase() === 'deteriorado') likelihood = clampInt(likelihood + 1);
  if (existingAssetRisk) likelihood = clampInt(likelihood + 1);

  const effectiveness = controlEffectiveness(control);
  const axes = calculateRiskAxes({
    likelihood,
    impact,
    controlEffectiveness: effectiveness,
  });
  const actions = buildSuggestedActions({
    template,
    level: axes.residual_risk_level,
    control,
    gap,
    asset,
    standardCode,
    versionCode,
  });

  const confidence = Math.max(
    0.55,
    Math.min(
      0.95,
      (template.id ? 0.75 : 0.65) +
        (asset ? 0.05 : 0) +
        (control?.catalog_control_id ? 0.08 : 0) +
        (assessment ? 0.04 : 0) +
        (gap ? 0.05 : 0)
    )
  );

  const title = asset?.name
    ? `${template.title} - ${asset.name}`
    : template.title;

  return {
    risk_template_id: template.id,
    asset_id: asset?.id || null,
    iso_control_id: control?.iso_control_id || gap?.iso_control_id || null,
    catalog_control_id: control?.catalog_control_id || null,
    tenant_control_id: control?.tenant_control_id || null,
    source_assessment_id: assessment?.id || null,
    source_gap_id: gap?.id || null,
    risk_code: template.risk_code || null,
    risk_title: title,
    risk_description: template.description || gap?.description || existingAssetRisk?.risk || null,
    risk_category: template.category || gap?.gap_type || null,
    asset_name: asset?.name || existingAssetRisk?.asset_name || null,
    asset_type: asset?.type || existingAssetRisk?.asset_type || null,
    asset_criticality: asset?.criticality || existingAssetRisk?.asset_criticality || null,
    likelihood: axes.likelihood,
    impact: axes.impact,
    inherent_risk_score: axes.inherent_risk_score,
    inherent_risk_level: axes.inherent_risk_level,
    control_effectiveness_score: effectiveness,
    residual_likelihood: axes.residual_likelihood,
    residual_impact: axes.residual_impact,
    residual_risk_score: axes.residual_risk_score,
    residual_risk_level: axes.residual_risk_level,
    treatment_strategy: axes.treatment_strategy,
    suggested_controls: Array.isArray(template.suggested_controls) ? template.suggested_controls : [],
    suggested_actions: actions,
    evidence_expectations: control?.evidence_expectations || [],
    status: confidence < 0.7 || versionCode === '2026_FDIS' || standardCode === 'ISO42001' ? 'needs_review' : 'suggested',
    confidence: round2(confidence),
    source_type: gap ? 'diagnostic_gap' : existingAssetRisk ? 'existing_asset_risk' : 'risk_template',
    source_trace_json: {
      template_code: template.risk_code || null,
      asset_id: asset?.id || existingAssetRisk?.asset_id || null,
      control_code: control?.control_code || gap?.control_code || null,
      control_effectiveness: effectiveness,
      evidence_gap: Boolean(control?.evidence_gap),
      diagnostic_gap_id: gap?.id || null,
      existing_asset_risk_id: existingAssetRisk?.id || null,
      certifiable_warning: versionCode === '2026_FDIS'
        ? 'ISO9001 2026_FDIS no es version final certificable.'
        : null,
    },
  };
}

function summarize(items, assets, templates, version, coverageWarning, sourceAssessmentId = null) {
  const count = items.length;
  const critical = items.filter((item) => item.residual_risk_level === 'critico').length;
  const high = items.filter((item) => item.residual_risk_level === 'alto').length;
  const medium = items.filter((item) => item.residual_risk_level === 'medio').length;
  const low = items.filter((item) => item.residual_risk_level === 'bajo').length;
  const inherentAvg = count ? round2(items.reduce((sum, item) => sum + item.inherent_risk_score, 0) / count) : 0;
  const residualAvg = count ? round2(items.reduce((sum, item) => sum + item.residual_risk_score, 0) / count) : 0;
  const posture = riskPosture(residualAvg, critical, high);

  return {
    total_assets: assets.length,
    total_risk_templates: templates.length,
    suggested_risks_count: count,
    critical_risks_count: critical,
    high_risks_count: high,
    medium_risks_count: medium,
    low_risks_count: low,
    inherent_risk_avg: inherentAvg,
    residual_risk_avg: residualAvg,
    risk_posture: posture,
    source_assessment_id: sourceAssessmentId,
    certifiable_version: version.certifiable === true,
    coverage_warning: coverageWarning,
    top_risks: [...items]
      .sort((a, b) => b.residual_risk_score - a.residual_risk_score)
      .slice(0, 8)
      .map((item) => ({
        risk_title: item.risk_title,
        residual_risk_score: item.residual_risk_score,
        residual_risk_level: item.residual_risk_level,
        asset_name: item.asset_name,
        treatment_strategy: item.treatment_strategy,
      })),
  };
}

function buildCandidateItems({ templates, assets, controls, gaps, assessment, standardCode, versionCode, existingAssetRisks }) {
  const items = [];
  const seen = new Set();
  const rankedGaps = gaps.filter((gap) => ['critica', 'alta'].includes(String(gap.severity || '').toLowerCase()));
  const assetPool = assets.length > 0 ? assets : [null];

  for (const template of templates) {
    const relatedGaps = rankedGaps.filter((gap) => {
      const text = normalizeText(`${template.title} ${template.description} ${template.category}`);
      return text.includes(normalizeText(gap.control_code)) ||
        text.includes(normalizeText(gap.gap_type)) ||
        normalizeText(gap.title).split(' ').some((word) => word.length > 5 && text.includes(word));
    });
    const selectedGaps = relatedGaps.length ? relatedGaps.slice(0, 2) : [null];
    const selectedAssets = assetPool
      .filter((asset) => !asset || assetMatchesTemplate(asset, template, standardCode))
      .slice(0, standardCode === 'ISO27001' ? 8 : 5);
    const finalAssets = selectedAssets.length > 0 ? selectedAssets : assetPool.slice(0, 3);

    for (const asset of finalAssets) {
      for (const gap of selectedGaps) {
        const control = matchControl(template, controls, gap);
        const item = buildRiskItem({
          template,
          asset,
          control,
          gap,
          assessment,
          standardCode,
          versionCode,
        });
        const key = `${item.risk_code || item.risk_title}|${item.asset_id || 'no_asset'}|${item.iso_control_id || 'no_control'}|${item.source_gap_id || 'no_gap'}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(item);
        }
      }
    }
  }

  for (const existing of existingAssetRisks.slice(0, 12)) {
    const template = templates.find((candidate) => {
      const text = normalizeText(`${candidate.title} ${candidate.description} ${candidate.category}`);
      return normalizeText(existing.risk).split(' ').some((word) => word.length > 5 && text.includes(word));
    }) || templates[0];

    if (!template) continue;

    const asset = {
      id: existing.asset_id,
      name: existing.asset_name,
      type: existing.asset_type,
      criticality: existing.asset_criticality,
    };
    const control = matchControl(template, controls, null);
    const item = buildRiskItem({
      template,
      asset,
      control,
      gap: null,
      assessment,
      standardCode,
      versionCode,
      existingAssetRisk: existing,
    });
    const key = `existing|${existing.id}|${item.risk_code || item.risk_title}|${item.asset_id || 'no_asset'}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }

  if (standardCode === 'ISO42001' && assets.length === 0) {
    for (const template of defaultTemplateForIso42001()) {
      const item = buildRiskItem({
        template,
        asset: null,
        control: matchControl(template, controls, null),
        gap: null,
        assessment,
        standardCode,
        versionCode,
      });
      item.risk_title = `${item.risk_title} (sin inventario IA asociado)`;
      item.source_trace_json.no_ai_assets_detected = true;
      items.push(item);
    }
  }

  return items
    .sort((a, b) => b.residual_risk_score - a.residual_risk_score)
    .slice(0, 120);
}

async function listOptions(tenantId, user) {
  assertTenantAccess(user, tenantId);

  const result = await pool.query(
    `
    WITH tenant_versions AS (
      SELECT
        ts.tenant_id,
        ts.standard_code,
        v.version_code,
        v.display_name,
        v.certifiable,
        v.publication_status,
        true AS tenant_standard_active
      FROM tenant_standards ts
      JOIN iso_standard_versions v
        ON v.standard_code = ts.standard_code
       AND v.is_active = true
      WHERE ts.tenant_id = $1::uuid
        AND ts.is_active IS DISTINCT FROM false
        AND (
          v.certifiable = true
          OR (v.standard_code = 'ISO9001' AND v.version_code = '2026_FDIS')
        )
    )
    SELECT
      tv.*,
      COALESCE(c.coverage_pct, 0) AS catalog_coverage_pct,
      COALESCE(css.sync_status, 'not_started') AS sync_status,
      lr.run_id AS latest_run_id,
      lr.risk_posture AS latest_risk_posture,
      lr.residual_risk_avg AS latest_residual_risk_avg,
      a.id AS latest_assessment_id,
      a.readiness_score AS latest_readiness_score,
      (SELECT COUNT(*)::integer FROM assets WHERE tenant_id = $1::uuid) AS assets_count,
      (
        SELECT COUNT(*)::integer
        FROM iso_risk_templates rt
        WHERE rt.standard_code = tv.standard_code
          AND rt.version_code = tv.version_code
      ) AS risk_templates_count
    FROM tenant_versions tv
    LEFT JOIN v_iso_control_catalog_coverage c
      ON c.standard_code = tv.standard_code
     AND c.version_code = tv.version_code
    LEFT JOIN iso_catalog_sync_status css
      ON css.standard_code = tv.standard_code
     AND css.version_code = tv.version_code
     AND css.sync_target = 'controls_catalog'
    LEFT JOIN v_iso_risk_matrix_latest_runs lr
      ON lr.tenant_id = tv.tenant_id
     AND lr.standard_code = tv.standard_code
     AND lr.version_code = tv.version_code
    LEFT JOIN LATERAL (
      SELECT id, readiness_score
      FROM iso_express_assessments
      WHERE tenant_id = tv.tenant_id
        AND standard_code = tv.standard_code
        AND version_code = tv.version_code
        AND assessment_status IS DISTINCT FROM 'archived'
      ORDER BY created_at DESC
      LIMIT 1
    ) a ON true
    ORDER BY
      CASE
        WHEN tv.standard_code = 'ISO9001' AND tv.version_code = '2015' THEN 1
        WHEN tv.standard_code = 'ISO27001' THEN 2
        WHEN tv.standard_code = 'ISO42001' THEN 3
        WHEN tv.version_code = '2026_FDIS' THEN 4
        ELSE 9
      END,
      tv.standard_code,
      tv.version_code
    `,
    [tenantId]
  );

  return result.rows.map((row) => {
    const coveragePct = Number(row.catalog_coverage_pct || 0);
    const warnings = [];
    if (row.standard_code === 'ISO9001' && row.version_code === '2026_FDIS') {
      warnings.push('Solo preparacion de transicion: no certificable.');
    } else if (row.standard_code === 'ISO42001' && coveragePct <= 0) {
      warnings.push('Matriz preliminar: falta mapeo operativo e inventario IA suficiente.');
    } else if (coveragePct < 30) {
      warnings.push('Cobertura operativa baja; requiere revision humana.');
    } else if (coveragePct < 80) {
      warnings.push('Cobertura operativa parcial.');
    }

    return {
      tenant_id: row.tenant_id,
      standard_code: row.standard_code,
      version_code: row.version_code,
      display_name: row.display_name,
      certifiable: row.certifiable,
      publication_status: row.publication_status,
      run_type: row.version_code === '2026_FDIS' ? 'transition_readiness' : 'automated',
      catalog_coverage_pct: coveragePct,
      sync_status: row.sync_status,
      latest_run_id: row.latest_run_id,
      latest_risk_posture: row.latest_risk_posture,
      latest_residual_risk_avg: row.latest_residual_risk_avg,
      latest_assessment_id: row.latest_assessment_id,
      latest_readiness_score: row.latest_readiness_score,
      assets_count: Number(row.assets_count || 0),
      risk_templates_count: Number(row.risk_templates_count || 0),
      recommended: row.standard_code === 'ISO9001' && row.version_code === '2015',
      warnings,
    };
  });
}

async function generateRiskMatrix({ tenantId, user, payload = {} }) {
  assertTenantAccess(user, tenantId);

  const standardCode = normalizeStandardCode(payload.standard_code);
  const versionCode = normalizeVersionCode(payload.version_code);
  const runType = normalizeRunType(payload.run_type, standardCode, versionCode);
  const dryRun = boolValue(payload.dry_run, false);
  const includeAssets = boolValue(payload.include_assets, true);
  const includeDiagnosticGaps = boolValue(payload.include_diagnostic_gaps, true);
  const includeExistingAssetRisks = boolValue(payload.include_existing_asset_risks, true);

  if (!standardCode || !versionCode) {
    throw publicError(400, 'STANDARD_VERSION_REQUIRED', 'standard_code y version_code son requeridos');
  }

  const version = await getStandardVersion(standardCode, versionCode);
  await assertStandardAllowedForTenant({ tenantId, user, standardCode, versionCode });

  const [coverage, templates, assets, assessment, controls, existingAssetRisks] = await Promise.all([
    fetchCoverage(standardCode, versionCode),
    fetchRiskTemplates(standardCode, versionCode),
    fetchAssets(tenantId, standardCode, includeAssets),
    latestAssessment(tenantId, standardCode, versionCode, payload.source_assessment_id || null),
    fetchControlRows(tenantId, standardCode, versionCode),
    fetchExistingAssetRisks(tenantId, standardCode, includeExistingAssetRisks),
  ]);
  const gaps = await fetchAssessmentGaps(tenantId, assessment?.id, includeDiagnosticGaps);
  const coveragePct = Number(coverage.coverage_pct || 0);
  const coverageWarning = buildCoverageWarning({
    standardCode,
    versionCode,
    certifiable: version.certifiable,
    coveragePct,
  });
  const items = buildCandidateItems({
    templates,
    assets,
    controls,
    gaps,
    assessment,
    standardCode,
    versionCode,
    existingAssetRisks,
  });
  const summary = summarize(items, assets, templates, version, coverageWarning, assessment?.id || null);
  const inputJson = {
    standard_code: standardCode,
    version_code: versionCode,
    run_type: runType,
    dry_run: dryRun,
    include_assets: includeAssets,
    include_diagnostic_gaps: includeDiagnosticGaps,
    include_existing_asset_risks: includeExistingAssetRisks,
    source_assessment_id: assessment?.id || null,
  };
  const resultJson = {
    scoring_model: 'iso_risk_matrix_v1',
    coverage_pct: coveragePct,
    controls_considered: controls.length,
    diagnostic_gaps_considered: gaps.length,
    existing_asset_risks_considered: existingAssetRisks.length,
  };

  if (dryRun) {
    return {
      dry_run: true,
      run: {
        tenant_id: tenantId,
        standard_code: standardCode,
        version_code: versionCode,
        run_type: runType,
        certifiable_version: version.certifiable === true,
        coverage_warning: coverageWarning,
        ...summary,
      },
      items,
      actions: items.flatMap((item) => item.suggested_actions.map((action) => ({
        ...action,
        risk_title: item.risk_title,
      }))),
      summary,
      warnings: coverageWarning ? [coverageWarning] : [],
    };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const runInsert = await client.query(
      `
      INSERT INTO iso_risk_matrix_runs (
        tenant_id, standard_code, version_code, source_assessment_id, run_type,
        run_status, requested_by, certifiable_version, coverage_warning,
        total_assets, total_risk_templates, suggested_risks_count,
        accepted_risks_count, rejected_risks_count, critical_risks_count,
        high_risks_count, medium_risks_count, low_risks_count,
        inherent_risk_avg, residual_risk_avg, risk_posture,
        summary_json, input_json, result_json, completed_at
      )
      VALUES (
        $1::uuid,$2,$3,$4::uuid,$5,'completed',$6::uuid,$7,$8,
        $9,$10,$11,0,0,$12,$13,$14,$15,$16,$17,$18,
        $19::jsonb,$20::jsonb,$21::jsonb,NOW()
      )
      RETURNING *
      `,
      [
        tenantId,
        standardCode,
        versionCode,
        assessment?.id || null,
        runType,
        getUserId(user),
        version.certifiable === true,
        coverageWarning,
        summary.total_assets,
        summary.total_risk_templates,
        summary.suggested_risks_count,
        summary.critical_risks_count,
        summary.high_risks_count,
        summary.medium_risks_count,
        summary.low_risks_count,
        summary.inherent_risk_avg,
        summary.residual_risk_avg,
        summary.risk_posture,
        JSON.stringify(summary),
        JSON.stringify(inputJson),
        JSON.stringify(resultJson),
      ]
    );
    const run = runInsert.rows[0];
    const savedItems = [];
    const savedActions = [];

    for (const item of items) {
      const itemInsert = await client.query(
        `
        INSERT INTO iso_risk_matrix_items (
          run_id, tenant_id, standard_code, version_code, risk_template_id,
          asset_id, iso_control_id, catalog_control_id, tenant_control_id,
          source_assessment_id, source_gap_id, risk_code, risk_title,
          risk_description, risk_category, asset_name, asset_type,
          asset_criticality, likelihood, impact, inherent_risk_score,
          inherent_risk_level, control_effectiveness_score, residual_likelihood,
          residual_impact, residual_risk_score, residual_risk_level,
          treatment_strategy, suggested_controls, suggested_actions,
          evidence_expectations, status, confidence, source_type, source_trace_json
        )
        VALUES (
          $1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::uuid,
          $10::uuid,$11::uuid,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
          $23,$24,$25,$26,$27,$28,$29,$30::jsonb,$31::jsonb,$32,$33,$34,$35::jsonb
        )
        RETURNING *
        `,
        [
          run.id,
          tenantId,
          standardCode,
          versionCode,
          item.risk_template_id,
          item.asset_id,
          item.iso_control_id,
          item.catalog_control_id,
          item.tenant_control_id,
          item.source_assessment_id,
          item.source_gap_id,
          item.risk_code,
          item.risk_title,
          item.risk_description,
          item.risk_category,
          item.asset_name,
          item.asset_type,
          item.asset_criticality,
          item.likelihood,
          item.impact,
          item.inherent_risk_score,
          item.inherent_risk_level,
          item.control_effectiveness_score,
          item.residual_likelihood,
          item.residual_impact,
          item.residual_risk_score,
          item.residual_risk_level,
          item.treatment_strategy,
          item.suggested_controls,
          JSON.stringify(item.suggested_actions),
          JSON.stringify(item.evidence_expectations || []),
          item.status,
          item.confidence,
          item.source_type,
          JSON.stringify(item.source_trace_json || {}),
        ]
      );
      const savedItem = itemInsert.rows[0];
      savedItems.push(savedItem);

      for (const action of item.suggested_actions) {
        const actionInsert = await client.query(
          `
          INSERT INTO iso_risk_matrix_actions (
            run_id, risk_item_id, tenant_id, action_title, action_description,
            suggested_owner_role, suggested_due_days, priority, action_type,
            creates_action_plan_candidate, status, metadata
          )
          VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,true,'suggested',$10::jsonb)
          RETURNING *
          `,
          [
            run.id,
            savedItem.id,
            tenantId,
            action.title,
            action.description,
            action.owner_role,
            action.due_days,
            action.priority,
            action.action_type,
            JSON.stringify({ risk_code: item.risk_code, asset_id: item.asset_id }),
          ]
        );
        savedActions.push(actionInsert.rows[0]);
      }
    }

    await client.query(
      `
      INSERT INTO iso_risk_matrix_audit_log (
        run_id, tenant_id, action, actor_user_id, new_data, metadata
      )
      VALUES ($1::uuid,$2::uuid,'generate',$3::uuid,$4::jsonb,$5::jsonb)
      `,
      [
        run.id,
        tenantId,
        getUserId(user),
        JSON.stringify(summary),
        JSON.stringify({ dry_run: false, standard_code: standardCode, version_code: versionCode }),
      ]
    );

    await client.query('COMMIT');

    return {
      dry_run: false,
      run,
      items: savedItems,
      actions: savedActions,
      summary,
      warnings: coverageWarning ? [coverageWarning] : [],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listRuns(tenantId, user, filters = {}) {
  assertTenantAccess(user, tenantId);
  const params = [tenantId];
  const where = ['tenant_id = $1::uuid'];

  if (filters.standard_code) {
    params.push(normalizeStandardCode(filters.standard_code));
    where.push(`standard_code = $${params.length}`);
  }

  if (filters.version_code) {
    params.push(normalizeVersionCode(filters.version_code));
    where.push(`version_code = $${params.length}`);
  }

  if (filters.status) {
    params.push(String(filters.status));
    where.push(`run_status = $${params.length}`);
  } else {
    where.push(`run_status IS DISTINCT FROM 'archived'`);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM iso_risk_matrix_runs
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT 80
    `,
    params
  );

  return result.rows;
}

async function getRunOrThrow(tenantId, runId) {
  const result = await pool.query(
    `
    SELECT *
    FROM iso_risk_matrix_runs
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, runId]
  );

  if (!result.rowCount) {
    throw publicError(404, 'RISK_MATRIX_RUN_NOT_FOUND', 'Matriz no encontrada');
  }

  return result.rows[0];
}

async function getRunDetail(tenantId, runId, user) {
  assertTenantAccess(user, tenantId);
  const run = await getRunOrThrow(tenantId, runId);
  const [items, actions] = await Promise.all([
    listRunItems(tenantId, runId, user, {}),
    listRunActions(tenantId, runId, user),
  ]);

  return {
    run,
    items,
    actions,
    summary: run.summary_json || {},
  };
}

async function listRunItems(tenantId, runId, user, filters = {}) {
  assertTenantAccess(user, tenantId);
  const params = [tenantId, runId];
  const where = ['tenant_id = $1::uuid', 'run_id = $2::uuid'];

  if (filters.level) {
    params.push(String(filters.level).toLowerCase());
    where.push(`residual_risk_level = $${params.length}`);
  }

  if (filters.status) {
    params.push(String(filters.status).toLowerCase());
    where.push(`status = $${params.length}`);
  }

  if (filters.asset_id) {
    params.push(filters.asset_id);
    where.push(`asset_id = $${params.length}::uuid`);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM iso_risk_matrix_items
    WHERE ${where.join(' AND ')}
    ORDER BY residual_risk_score DESC, inherent_risk_score DESC, created_at ASC
    LIMIT 200
    `,
    params
  );

  return result.rows;
}

async function listRunActions(tenantId, runId, user) {
  assertTenantAccess(user, tenantId);
  const result = await pool.query(
    `
    SELECT
      a.*,
      i.risk_title,
      i.residual_risk_level,
      i.asset_name
    FROM iso_risk_matrix_actions a
    JOIN iso_risk_matrix_items i
      ON i.id = a.risk_item_id
    WHERE a.tenant_id = $1::uuid
      AND a.run_id = $2::uuid
    ORDER BY
      CASE a.priority
        WHEN 'critica' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'media' THEN 3
        ELSE 4
      END,
      a.created_at ASC
    LIMIT 250
    `,
    [tenantId, runId]
  );

  return result.rows;
}

async function getLatest(tenantId, user, filters = {}) {
  assertTenantAccess(user, tenantId);
  const standardCode = filters.standard_code ? normalizeStandardCode(filters.standard_code) : null;
  const versionCode = filters.version_code ? normalizeVersionCode(filters.version_code) : null;
  const params = [tenantId];
  const where = ['tenant_id = $1::uuid'];

  if (standardCode) {
    params.push(standardCode);
    where.push(`standard_code = $${params.length}`);
  }
  if (versionCode) {
    params.push(versionCode);
    where.push(`version_code = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM v_iso_risk_matrix_latest_runs
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT 1
    `,
    params
  );

  if (!result.rowCount) return null;
  return getRunDetail(tenantId, result.rows[0].run_id, user);
}

async function getSummary(tenantId, user) {
  assertTenantAccess(user, tenantId);
  const result = await pool.query(
    `
    SELECT *
    FROM v_iso_risk_matrix_summary
    WHERE tenant_id = $1::uuid
    ORDER BY created_at DESC
    LIMIT 80
    `,
    [tenantId]
  );

  return result.rows;
}

async function refreshRunRiskSummary(client, runId) {
  const counts = await client.query(
    `
    SELECT
      COUNT(*)::integer AS suggested_risks_count,
      COUNT(*) FILTER (WHERE status = 'accepted')::integer AS accepted_risks_count,
      COUNT(*) FILTER (WHERE status = 'rejected')::integer AS rejected_risks_count,
      COUNT(*) FILTER (WHERE residual_risk_level = 'critico')::integer AS critical_risks_count,
      COUNT(*) FILTER (WHERE residual_risk_level = 'alto')::integer AS high_risks_count,
      COUNT(*) FILTER (WHERE residual_risk_level = 'medio')::integer AS medium_risks_count,
      COUNT(*) FILTER (WHERE residual_risk_level = 'bajo')::integer AS low_risks_count,
      COALESCE(ROUND(AVG(inherent_risk_score)::numeric, 2), 0) AS inherent_risk_avg,
      COALESCE(ROUND(AVG(residual_risk_score)::numeric, 2), 0) AS residual_risk_avg
    FROM iso_risk_matrix_items
    WHERE run_id = $1::uuid
    `,
    [runId]
  );

  const row = counts.rows[0] || {};
  const summaryPatch = {
    suggested_risks_count: Number(row.suggested_risks_count || 0),
    accepted_risks_count: Number(row.accepted_risks_count || 0),
    rejected_risks_count: Number(row.rejected_risks_count || 0),
    critical_risks_count: Number(row.critical_risks_count || 0),
    high_risks_count: Number(row.high_risks_count || 0),
    medium_risks_count: Number(row.medium_risks_count || 0),
    low_risks_count: Number(row.low_risks_count || 0),
    inherent_risk_avg: Number(row.inherent_risk_avg || 0),
    residual_risk_avg: Number(row.residual_risk_avg || 0),
  };
  const posture = riskPosture(
    summaryPatch.residual_risk_avg,
    summaryPatch.critical_risks_count,
    summaryPatch.high_risks_count
  );

  const updated = await client.query(
    `
    UPDATE iso_risk_matrix_runs
    SET
      suggested_risks_count = $2,
      accepted_risks_count = $3,
      rejected_risks_count = $4,
      critical_risks_count = $5,
      high_risks_count = $6,
      medium_risks_count = $7,
      low_risks_count = $8,
      inherent_risk_avg = $9,
      residual_risk_avg = $10,
      risk_posture = $11,
      summary_json = COALESCE(summary_json, '{}'::jsonb) || $12::jsonb,
      result_json = COALESCE(result_json, '{}'::jsonb) || jsonb_build_object('summary', (COALESCE(summary_json, '{}'::jsonb) || $12::jsonb)),
      updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [
      runId,
      summaryPatch.suggested_risks_count,
      summaryPatch.accepted_risks_count,
      summaryPatch.rejected_risks_count,
      summaryPatch.critical_risks_count,
      summaryPatch.high_risks_count,
      summaryPatch.medium_risks_count,
      summaryPatch.low_risks_count,
      summaryPatch.inherent_risk_avg,
      summaryPatch.residual_risk_avg,
      posture,
      JSON.stringify({ ...summaryPatch, risk_posture: posture }),
    ]
  );

  return updated.rows[0] || null;
}

async function updateItemRiskInputs(tenantId, itemId, user, payload = {}) {
  assertTenantAccess(user, tenantId);
  assertCanManageRiskMatrix(user);

  const likelihood = parseRiskAxis(payload.likelihood ?? payload.probability, 'likelihood');
  const impact = parseRiskAxis(payload.impact, 'impact');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query(
      `
      SELECT *
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      FOR UPDATE
      `,
      [tenantId, itemId]
    );

    if (!current.rowCount) {
      throw publicError(404, 'RISK_MATRIX_ITEM_NOT_FOUND', 'Riesgo sugerido no encontrado');
    }

    const before = current.rows[0];
    const axes = calculateRiskAxes({
      likelihood,
      impact,
      controlEffectiveness: before.control_effectiveness_score,
    });

    const updated = await client.query(
      `
      UPDATE iso_risk_matrix_items
      SET
        likelihood = $3,
        impact = $4,
        inherent_risk_score = $5,
        inherent_risk_level = $6,
        residual_likelihood = $7,
        residual_impact = $8,
        residual_risk_score = $9,
        residual_risk_level = $10,
        treatment_strategy = $11,
        updated_at = NOW()
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      RETURNING *
      `,
      [
        tenantId,
        itemId,
        axes.likelihood,
        axes.impact,
        axes.inherent_risk_score,
        axes.inherent_risk_level,
        axes.residual_likelihood,
        axes.residual_impact,
        axes.residual_risk_score,
        axes.residual_risk_level,
        axes.treatment_strategy,
      ]
    );

    await client.query(
      `
      INSERT INTO iso_risk_matrix_audit_log (
        run_id, risk_item_id, tenant_id, action, actor_user_id, old_data, new_data
      )
      VALUES ($1::uuid,$2::uuid,$3::uuid,'update_risk_inputs',$4::uuid,$5::jsonb,$6::jsonb)
      `,
      [
        updated.rows[0].run_id,
        itemId,
        tenantId,
        getUserId(user),
        JSON.stringify({
          likelihood: before.likelihood,
          impact: before.impact,
          inherent_risk_score: before.inherent_risk_score,
          inherent_risk_level: before.inherent_risk_level,
          residual_likelihood: before.residual_likelihood,
          residual_impact: before.residual_impact,
          residual_risk_score: before.residual_risk_score,
          residual_risk_level: before.residual_risk_level,
          treatment_strategy: before.treatment_strategy,
        }),
        JSON.stringify({
          ...axes,
          reason: payload.reason || null,
        }),
      ]
    );

    const run = await refreshRunRiskSummary(client, updated.rows[0].run_id);

    await client.query('COMMIT');
    return {
      item: updated.rows[0],
      run,
      source_contract: 'risk_register',
      formula_code: 'F5_5_INHERENT_RISK',
      formula_input: {
        probability: axes.likelihood,
        impact: axes.impact,
      },
      calculated_value: axes.inherent_risk_score,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reviewItem(tenantId, itemId, user, payload = {}) {
  assertTenantAccess(user, tenantId);
  const status = String(payload.status || '').toLowerCase().trim();

  if (!ALLOWED_REVIEW_STATUS.has(status)) {
    throw publicError(400, 'INVALID_RISK_REVIEW_STATUS', 'Estado de revision invalido');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query(
      `
      SELECT *
      FROM iso_risk_matrix_items
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      LIMIT 1
      `,
      [tenantId, itemId]
    );

    if (!current.rowCount) {
      throw publicError(404, 'RISK_MATRIX_ITEM_NOT_FOUND', 'Riesgo sugerido no encontrado');
    }

    const updated = await client.query(
      `
      UPDATE iso_risk_matrix_items
      SET
        status = $3,
        reviewer_user_id = $4::uuid,
        reviewed_at = NOW(),
        review_comment = $5,
        updated_at = NOW()
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      RETURNING *
      `,
      [tenantId, itemId, status, getUserId(user), payload.review_comment || null]
    );

    await client.query(
      `
      INSERT INTO iso_risk_matrix_audit_log (
        run_id, risk_item_id, tenant_id, action, actor_user_id, old_data, new_data
      )
      VALUES ($1::uuid,$2::uuid,$3::uuid,'review_item',$4::uuid,$5::jsonb,$6::jsonb)
      `,
      [
        updated.rows[0].run_id,
        itemId,
        tenantId,
        getUserId(user),
        JSON.stringify({ status: current.rows[0].status }),
        JSON.stringify({ status, review_comment: payload.review_comment || null }),
      ]
    );

    await client.query(
      `
      UPDATE iso_risk_matrix_runs r
      SET
        accepted_risks_count = counts.accepted,
        rejected_risks_count = counts.rejected,
        updated_at = NOW()
      FROM (
        SELECT
          run_id,
          COUNT(*) FILTER (WHERE status = 'accepted')::integer AS accepted,
          COUNT(*) FILTER (WHERE status = 'rejected')::integer AS rejected
        FROM iso_risk_matrix_items
        WHERE run_id = $1::uuid
        GROUP BY run_id
      ) counts
      WHERE r.id = counts.run_id
      `,
      [updated.rows[0].run_id]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function archiveRun(tenantId, runId, user) {
  assertTenantAccess(user, tenantId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const run = await client.query(
      `
      UPDATE iso_risk_matrix_runs
      SET run_status = 'archived', updated_at = NOW()
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      RETURNING *
      `,
      [tenantId, runId]
    );

    if (!run.rowCount) {
      throw publicError(404, 'RISK_MATRIX_RUN_NOT_FOUND', 'Matriz no encontrada');
    }

    await client.query(
      `
      INSERT INTO iso_risk_matrix_audit_log (
        run_id, tenant_id, action, actor_user_id, new_data
      )
      VALUES ($1::uuid,$2::uuid,'archive_run',$3::uuid,$4::jsonb)
      `,
      [
        runId,
        tenantId,
        getUserId(user),
        JSON.stringify({ run_status: 'archived' }),
      ]
    );
    await client.query('COMMIT');
    return run.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listOptions,
  generateRiskMatrix,
  listRuns,
  getRunDetail,
  listRunItems,
  listRunActions,
  getLatest,
  getSummary,
  updateItemRiskInputs,
  reviewItem,
  archiveRun,
  _private: {
    calculateRiskAxes,
    canManageRiskMatrix,
    parseRiskAxis,
    riskLevel,
  },
};
