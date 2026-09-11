'use strict';

const indicatorGovernance = require('./indicators/indicatorGovernance.service');
const { FUNCTIONAL_INDICATORS } = require('./indicators/functionalIndicatorCatalog');
const { normalizeIsoCode } = require('../utils/isoStandards');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FACT_FORMULA_CODES = Object.freeze({
  compliance: Object.freeze(['F5_5_COMPLIANCE_WEIGHTED', 'F5_5_COVERAGE']),
  diagnostic: Object.freeze(['F5_5_COMPLIANCE_WEIGHTED', 'F5_5_COVERAGE']),
  soa: Object.freeze(['F5_5_COMPLIANCE_WEIGHTED', 'F5_5_COVERAGE']),
  evidence: Object.freeze(['F5_5_FRESHNESS_CONTINUOUS']),
  finding: Object.freeze(['F5_5_SEVERITY_INDEX']),
  nonconformity: Object.freeze([]),
  action: Object.freeze(['F5_5_WEIGHTED_PROGRESS']),
  risk: Object.freeze(['F5_5_INHERENT_RISK', 'F5_5_RESIDUAL_RISK']),
  scope: Object.freeze([
    'F5_5_COMPLIANCE_WEIGHTED',
    'F5_5_COVERAGE',
    'F5_5_INHERENT_RISK',
    'F5_5_RESIDUAL_RISK',
    'F5_5_WEIGHTED_PROGRESS',
    'F5_5_FRESHNESS_CONTINUOUS',
  ]),
});

const METRIC_CODES_BY_FORMULA = Object.freeze(
  FUNCTIONAL_INDICATORS.reduce((acc, item) => {
    if (!item?.formula_code || !item?.functional_code) return acc;
    acc[item.formula_code] = Object.freeze([...(acc[item.formula_code] || []), item.functional_code]);
    return acc;
  }, {})
);

const METRICS_BY_FACT_TYPE = Object.freeze(
  Object.fromEntries(Object.entries(FACT_FORMULA_CODES).map(([factType, formulaCodes]) => [
    factType,
    Object.freeze(formulaCodes.flatMap((formulaCode) => METRIC_CODES_BY_FORMULA[formulaCode] || [])),
  ]))
);

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function normalizeUuid(value) {
  const candidate = String(value || '').trim();
  return UUID_RE.test(candidate) ? candidate : null;
}

function scopeFor({ tenantId, user }) {
  return { tenant_id: tenantId, tenantId, user };
}

function serializeError(error) {
  return {
    code: error?.code || 'OFFICIAL_INDICATOR_PUBLICATION_FAILED',
    message: String(error?.message || error || 'No fue posible publicar el indicador oficial.').slice(0, 280),
    status: Number(error?.status || error?.statusCode || 500),
  };
}

function failedRecalculationResult({ tenantId, factType, metricCodes = [], error } = {}) {
  const serialized = serializeError(error);
  const results = unique(metricCodes).map((metricCode) => ({
    metric_code: metricCode,
    status: 'failed',
    error: serialized,
  }));

  return {
    status: 'completed_with_failures',
    tenant_id: tenantId || null,
    fact_type: factType || null,
    metric_codes: unique(metricCodes),
    summary: {
      total: results.length,
      published: 0,
      calculated: 0,
      failed: results.length || 1,
    },
    results,
    error: serialized,
  };
}

function normalizeControlImplementationStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['cumple', 'compliant', 'conform', 'effective', 'implemented', 'implementado'].includes(normalized)) {
    return 'implementado';
  }

  if (['parcial', 'partial', 'partially_compliant', 'in_progress', 'en progreso'].includes(normalized)) {
    return 'parcial';
  }

  if (['no cumple', 'non_compliant', 'non_conform', 'ineffective', 'not_implemented', 'no implementado'].includes(normalized)) {
    return 'no implementado';
  }

  if (['no aplica', 'not_applicable', 'not applicable', 'na', 'n/a'].includes(normalized)) {
    return 'no aplica';
  }

  return 'pendiente';
}

function resolveControlApplicability(value, implementationStatus) {
  if (value !== undefined && value !== null) return Boolean(value);
  return normalizeControlImplementationStatus(implementationStatus) !== 'no aplica';
}

function resolveAffectedMetricCodes({ factType, metricCodes = [] } = {}) {
  const baseMetrics = unique([
    ...(METRICS_BY_FACT_TYPE[factType] || []),
    ...metricCodes,
  ]);
  const needsTrustRefresh = baseMetrics.some((metricCode) => !['DATA-TRUST', 'GRC-HEALTH'].includes(metricCode));
  return unique([
    ...baseMetrics.filter((metricCode) => !['DATA-TRUST', 'GRC-HEALTH'].includes(metricCode)),
    ...(needsTrustRefresh || baseMetrics.includes('DATA-TRUST') ? ['DATA-TRUST'] : []),
    ...(needsTrustRefresh || baseMetrics.includes('DATA-TRUST') || baseMetrics.includes('GRC-HEALTH') ? ['GRC-HEALTH'] : []),
  ]);
}

function assuranceFromImplementationStatus(value) {
  const normalized = normalizeControlImplementationStatus(value);
  if (['implementado', 'parcial', 'no implementado'].includes(normalized)) {
    return {
      status: 'skipped',
      code: 'ASSURANCE_STATUS_SCORE_CONVERSION_UNGOVERNED',
      reason: 'No existe contrato local que autorice convertir implementation_status a grc_control_assurance.status/score.',
    };
  }
  return null;
}

async function recordMappedControlAssurance({ client, tenantId, tenantControlId, implementationStatus } = {}) {
  const projection = assuranceFromImplementationStatus(implementationStatus);
  if (projection?.status === 'skipped') {
    return projection;
  }

  if (projection === null) {
    return { status: 'skipped', code: 'NO_ASSURANCE_PROJECTION_FOR_STATUS' };
  }

  const relationCheck = await client.query(
    `
    SELECT
      to_regclass('public.grc_requirement_control_mappings') IS NOT NULL AS has_mappings,
      to_regclass('public.grc_control_assurance') IS NOT NULL AS has_assurance
    `
  );
  if (relationCheck.rows[0]?.has_mappings !== true || relationCheck.rows[0]?.has_assurance !== true) {
    return { status: 'skipped', code: 'GRC_MAPPING_OR_ASSURANCE_ABSENT' };
  }

  const mapping = await client.query(
    `
    SELECT 1
    FROM grc_requirement_control_mappings m
    JOIN grc_framework_requirements r
      ON r.id = m.requirement_id
    WHERE COALESCE(m.tenant_id, r.tenant_id) = $1::uuid
      AND m.tenant_control_id = $2::uuid
      AND COALESCE(m.mapping_type, '') <> 'not_equivalent'
      AND COALESCE(m.status, '') IN ('published', 'reviewed')
    LIMIT 1
    `,
    [tenantId, tenantControlId]
  );

  if (mapping.rowCount === 0) {
    return { status: 'skipped', code: 'NO_GOVERNED_REQUIREMENT_MAPPING' };
  }

  const assurance = await client.query(
    `
    INSERT INTO grc_control_assurance (
      tenant_id,
      tenant_control_id,
      assurance_status,
      score,
      reason_codes,
      formula_version,
      calculated_at
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      ARRAY['soa_assessment_applied']::text[],
      'grc-post-mutation-soa-v1',
      NOW()
    )
    ON CONFLICT (tenant_id, tenant_control_id)
    DO UPDATE SET
      assurance_status = EXCLUDED.assurance_status,
      score = EXCLUDED.score,
      reason_codes = EXCLUDED.reason_codes,
      formula_version = EXCLUDED.formula_version,
      calculated_at = NOW()
    RETURNING id, assurance_status, score
    `,
    [tenantId, tenantControlId, projection.status, projection.score]
  );

  return {
    status: 'projected',
    source: 'grc_control_assurance',
    assurance: assurance.rows[0] || null,
  };
}

async function recordControlSoAAssessment({
  client,
  tenantId,
  tenantControlId,
  isoCode,
  implementationStatus,
  applicable,
  userId = null,
  source = 'system',
  metadata = {},
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('recordControlSoAAssessment requiere un cliente transaccional.');
  }

  if (!tenantId || !tenantControlId || !isoCode) {
    throw new Error('recordControlSoAAssessment requiere tenantId, tenantControlId e isoCode.');
  }

  const normalizedImplementationStatus = normalizeControlImplementationStatus(implementationStatus);
  const resolvedApplicable = resolveControlApplicability(applicable, normalizedImplementationStatus);
  const canonicalIsoCode = normalizeIsoCode(isoCode);
  const normalizedUserId = normalizeUuid(userId);

  const result = await client.query(
    `
    INSERT INTO control_soa_assessments (
      tenant_id,
      tenant_control_id,
      iso_code,
      source,
      status,
      suggested_applicable,
      suggested_implementation_status,
      evidence_summary,
      reviewed_by,
      reviewed_at,
      applied_by,
      applied_at,
      updated_at
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      'applied',
      $5,
      $6,
      $7::jsonb,
      $8::uuid,
      CASE WHEN $8::uuid IS NULL THEN NULL ELSE NOW() END,
      $8::uuid,
      CASE WHEN $8::uuid IS NULL THEN NULL ELSE NOW() END,
      NOW()
    )
    RETURNING id, tenant_id, tenant_control_id, iso_code, status, suggested_applicable, suggested_implementation_status
    `,
    [
      tenantId,
      tenantControlId,
      canonicalIsoCode,
      source,
      resolvedApplicable,
      normalizedImplementationStatus,
      JSON.stringify({
        producer: metadata.producer || null,
        route: metadata.endpoint || null,
        fact_type: metadata.factType || null,
      }),
      normalizedUserId,
    ]
  );

  const assuranceProjection = await recordMappedControlAssurance({
    client,
    tenantId,
    tenantControlId,
    implementationStatus: normalizedImplementationStatus,
  });

  return {
    ...(result.rows[0] || {}),
    assurance_projection: assuranceProjection,
  };
}

async function publishMetric({ indicatorService, scope, metricCode, body, requestId }) {
  const calculation = await indicatorService.calculateIndicator(scope, metricCode, body, requestId);
  const entry = {
    metric_code: metricCode,
    status: 'calculated',
    calculation,
    snapshot: null,
  };

  if (calculation?.measurement?.id) {
    const snapshotResult = await indicatorService.createSnapshot(
      scope,
      metricCode,
      { measurement_id: calculation.measurement.id, period: body.period || {}, source: 'grc_post_mutation_orchestration' },
      requestId
    );
    const snapshotId = snapshotResult?.snapshot?.snapshot_id || snapshotResult?.snapshot?.id || snapshotResult?.id || null;
    if (snapshotId) {
      entry.snapshot = await indicatorService.publishSnapshot(scope, snapshotId, requestId);
    } else {
      entry.snapshot = {
        status: 'failed',
        error_code: 'INDICATOR_SNAPSHOT_ID_MISSING',
        message: 'La medición oficial no produjo un snapshot publicable.',
      };
    }
  }

  return entry;
}

async function publishAffectedOfficialIndicators({
  tenantId,
  user,
  factType,
  metricCodes = [],
  period = {},
  requestId = null,
  metadata = {},
  dependencies = {},
} = {}) {
  if (!tenantId) {
    return {
      status: 'skipped',
      code: 'TENANT_REQUIRED',
      metric_codes: [],
      results: [],
    };
  }

  let affectedMetricCodes = [];

  try {
    const indicatorService = dependencies.indicatorService || indicatorGovernance;
    affectedMetricCodes = resolveAffectedMetricCodes({ factType, metricCodes });
    const scope = scopeFor({ tenantId, user });
    const body = {
      period,
      metadata: {
        source: 'grc_post_mutation_orchestration',
        fact_type: factType || null,
        ...metadata,
      },
    };
    const results = [];

    for (const metricCode of affectedMetricCodes) {
      try {
        results.push(await publishMetric({ indicatorService, scope, metricCode, body, requestId }));
      } catch (error) {
        results.push({
          metric_code: metricCode,
          status: 'failed',
          error: serializeError(error),
        });
      }
    }

    const summary = {
      total: results.length,
      published: results.filter((item) => ['published', 'already_published'].includes(item.snapshot?.status)).length,
      calculated: results.filter((item) => item.status === 'calculated').length,
      failed: results.filter((item) => item.status === 'failed' || item.snapshot?.status === 'failed').length,
    };

    return {
      status: summary.failed ? 'completed_with_failures' : 'completed',
      tenant_id: tenantId,
      fact_type: factType || null,
      metric_codes: affectedMetricCodes,
      summary,
      results,
    };
  } catch (error) {
    return failedRecalculationResult({
      tenantId,
      factType,
      metricCodes: affectedMetricCodes.length ? affectedMetricCodes : metricCodes,
      error,
    });
  }
}

module.exports = {
  METRICS_BY_FACT_TYPE,
  normalizeControlImplementationStatus,
  recordControlSoAAssessment,
  resolveAffectedMetricCodes,
  publishAffectedOfficialIndicators,
};
