const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const soaIntelligence = require('../services/soaIntelligence.service');
const {
  normalizeIsoCode,
  isoQueryAliases,
  isSoAStandard,
} = require('../utils/isoStandards');
const {
  normalizeSoAPayload,
  validateSoAState,
  normalizeImplementationStatus,
} = require('../utils/soaValidation');
const {
  buildSoAMetrics,
  withInconsistencies,
} = require('../utils/soaMetrics');

const READ_ONLY_ROLES = ['auditor'];
const MANAGE_ROLES = ['admin', 'tenant_admin', 'superadmin'];

// =============================
// 🔐 AUTORIZACIÓN BÁSICA
// =============================
const ensureTenantAccess = (req, tenantId) => {
  if (req.user?.role === 'superadmin') return true;
  return req.user?.tenant_id === tenantId;
};

const canManageSoA = (req, tenantId) => {
  if (!ensureTenantAccess(req, tenantId)) return false;
  return MANAGE_ROLES.includes(String(req.user?.role || '').toLowerCase());
};

const getUserId = (req) => req.user?.id || req.user?.user_id || req.user?.sub || null;

const normalizeIso = (value) => normalizeIsoCode(value);

const countValue = (result, key = 'total') => Number(result.rows[0]?.[key] || 0);

const getSoAPreflight = async (client, tenantId, iso) => {
  const canonicalIso = normalizeIso(iso);
  const isoAliases = isoQueryAliases(canonicalIso);
  const usesSoA = isSoAStandard(canonicalIso);

  if (!usesSoA) {
    return {
      tenant_id: tenantId,
      iso: canonicalIso,
      uses_soa: false,
      standard_active: false,
      active_operations_count: 0,
      catalog_controls_count: 0,
      tenant_controls_count: 0,
      legacy_controls_count: 0,
      soa_rows_count: 0,
      data_source: null,
      can_initialize_soa: false,
      blocking_reason: 'standard_does_not_use_soa',
      recommended_action: null
    };
  }

  const standardResult = await client.query(
    `
    SELECT is_active
    FROM tenant_standards
    WHERE tenant_id = $1
      AND standard_code = ANY($2::text[])
    LIMIT 1
    `,
    [tenantId, isoAliases]
  );
  const standardActive = standardResult.rows[0]?.is_active === true;

  const activeOpsResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM tenant_standard_operations tso
    JOIN tenant_operations op
      ON op.id = tso.operation_id
     AND op.tenant_id = tso.tenant_id
    WHERE tso.tenant_id = $1
      AND tso.standard_code = ANY($2::text[])
      AND tso.is_active = TRUE
      AND op.is_active = TRUE
    `,
    [tenantId, isoAliases]
  );

  const catalogResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM controls_catalog cc
    WHERE cc.iso = ANY($1::text[])
      AND cc.is_active = TRUE
      AND (cc.tenant_id IS NULL OR cc.tenant_id = $2)
    `,
    [isoAliases, tenantId]
  );

  const tenantControlsResult = await client.query(
    `
    SELECT COUNT(DISTINCT tc.id)::int AS total
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
     AND op.is_active = TRUE
    JOIN tenant_standard_operations tso
      ON tso.operation_id = tc.operation_id
     AND tso.tenant_id = tc.tenant_id
     AND tso.standard_code = ANY($2::text[])
     AND tso.is_active = TRUE
    WHERE tc.tenant_id = $1
      AND cc.iso = ANY($2::text[])
      AND cc.is_active = TRUE
    `,
    [tenantId, isoAliases]
  );

  const legacyControlsResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM controls
    WHERE tenant_id = $1
      AND iso_code = ANY($2::text[])
    `,
    [tenantId, isoAliases]
  );

  const soaRowsResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM control_soa cs
    JOIN controls c
      ON c.id = cs.tenant_control_id
    WHERE c.tenant_id = $1
      AND c.iso_code = ANY($2::text[])
    `,
    [tenantId, isoAliases]
  );

  const activeOperationsCount = countValue(activeOpsResult);
  const tenantControlsCount = countValue(tenantControlsResult);
  const legacyControlsCount = countValue(legacyControlsResult);
  const soaRowsCount = countValue(soaRowsResult);

  let blockingReason = null;
  if (!standardActive) blockingReason = 'standard_not_active';
  else if (activeOperationsCount === 0) blockingReason = 'no_active_operations';
  else if (tenantControlsCount === 0) blockingReason = 'no_tenant_controls';

  const canInitialize = !blockingReason && (legacyControlsCount === 0 || soaRowsCount < legacyControlsCount);

  return {
    tenant_id: tenantId,
    iso: canonicalIso,
    uses_soa: true,
    standard_active: standardActive,
    active_operations_count: activeOperationsCount,
    catalog_controls_count: countValue(catalogResult),
    tenant_controls_count: tenantControlsCount,
    legacy_controls_count: legacyControlsCount,
    soa_rows_count: soaRowsCount,
    data_source: tenantControlsCount > 0 ? 'tenant_controls' : 'controls',
    can_initialize_soa: canInitialize,
    blocking_reason: blockingReason,
    recommended_action: canInitialize ? 'initialize_soa_from_tenant_controls' : null
  };
};

// =============================
// 🧱 BOOTSTRAP SOA
// crea filas faltantes para controles del tenant/iso
// =============================
const bootstrapSoA = async (client, tenantId, iso) => {
  const isoAliases = isoQueryAliases(iso);
  const result = await client.query(
    `
    INSERT INTO control_soa (tenant_control_id)
    SELECT c.id
    FROM controls c
    LEFT JOIN control_soa cs
      ON cs.tenant_control_id = c.id
    WHERE c.tenant_id = $1
      AND c.iso_code = ANY($2::text[])
      AND cs.tenant_control_id IS NULL
    RETURNING tenant_control_id
    `,
    [tenantId, isoAliases]
  );
  return result.rows;
};

const materializeControlsFromTenantControls = async (client, tenantId, iso) => {
  const canonicalIso = normalizeIso(iso);
  const isoAliases = isoQueryAliases(canonicalIso);
  const result = await client.query(
    `
    WITH source_controls AS (
      SELECT DISTINCT ON (tc.control_id)
        tc.tenant_id,
        $2::text AS iso_code,
        cc.clause,
        COALESCE(NULLIF(tc.status, ''), 'pendiente') AS status,
        COALESCE(ROUND(tc.score)::int, 0) AS score,
        tc.control_id AS catalog_control_id,
        tc.created_at
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON cc.id = tc.control_id
      JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tc.tenant_id
       AND op.is_active = TRUE
      JOIN tenant_standard_operations tso
        ON tso.operation_id = tc.operation_id
       AND tso.tenant_id = tc.tenant_id
       AND tso.standard_code = ANY($3::text[])
       AND tso.is_active = TRUE
      WHERE tc.tenant_id = $1
        AND cc.iso = ANY($3::text[])
        AND cc.is_active = TRUE
      ORDER BY tc.control_id, tc.created_at DESC NULLS LAST, tc.id
    )
    INSERT INTO controls (
      tenant_id,
      iso_code,
      clause,
      status,
      score,
      catalog_control_id
    )
    SELECT
      sc.tenant_id,
      sc.iso_code,
      sc.clause,
      sc.status,
      sc.score,
      sc.catalog_control_id
    FROM source_controls sc
    WHERE NOT EXISTS (
      SELECT 1
      FROM controls c
      WHERE c.tenant_id = sc.tenant_id
        AND c.iso_code = ANY($3::text[])
        AND c.catalog_control_id = sc.catalog_control_id
    )
    `,
    [tenantId, canonicalIso, isoAliases]
  );

  return result.rowCount || 0;
};

const getSoACount = async (client, tenantId, iso) => {
  const isoAliases = isoQueryAliases(iso);
  const result = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM control_soa cs
    JOIN controls c
      ON c.id = cs.tenant_control_id
    WHERE c.tenant_id = $1
      AND c.iso_code = ANY($2::text[])
    `,
    [tenantId, isoAliases]
  );
  return countValue(result);
};

const insertSoAChangeLog = async (
  client,
  { tenantId, tenantControlId, source, field, oldValue, newValue, reason = null, userId = null, assessmentId = null }
) => {
  await client.query(
    `
    INSERT INTO control_soa_change_log (
      tenant_id, tenant_control_id, assessment_id, source, field_changed,
      old_value, new_value, reason, changed_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      tenantId,
      tenantControlId,
      assessmentId,
      source,
      field,
      oldValue === null || oldValue === undefined ? null : String(oldValue),
      newValue === null || newValue === undefined ? null : String(newValue),
      reason,
      userId,
    ]
  );
};

const getSoARows = async (client, tenantId, iso, tenantControlId = null) => {
  const isoAliases = isoQueryAliases(iso);
  const params = [tenantId, isoAliases];
  let controlFilter = '';
  if (tenantControlId) {
    params.push(tenantControlId);
    controlFilter = `AND c.id = $${params.length}`;
  }

  const result = await client.query(
    `
    SELECT
      c.id AS tenant_control_id,
      c.id AS controls_id_legacy,
      tc_primary.id AS modern_tenant_control_id,
      c.tenant_id,
      $2::text[] AS iso_aliases,
      c.iso_code AS iso,
      c.clause,
      COALESCE(cc.category, 'General') AS category,
      COALESCE(cc.description, 'Control ' || c.clause) AS description,
      COALESCE(NULLIF(c.status, ''), 'pendiente') AS diagnostic_status,
      cs.applicable,
      cs.implementation_status,
      cs.justification,
      cs.notes,
      cs.owner,
      cs.review_date,
      cs.created_at,
      cs.updated_at,
      COALESCE(ev.evidence_count, 0)::int AS evidence_count,
      COALESCE(ev.valid_evidence_count, 0)::int AS valid_evidence_count,
      COALESCE(ev.expired_evidence_count, 0)::int AS expired_evidence_count,
      COALESCE(ev.rejected_evidence_count, 0)::int AS rejected_evidence_count,
      COALESCE(f.open_findings_count, 0)::int AS open_findings_count,
      COALESCE(nc.open_nonconformities_count, 0)::int AS open_nonconformities_count,
      COALESCE(ri.high_or_critical_risk_count, 0)::int AS high_or_critical_risk_count,
      COALESCE(ap.overdue_actions_count, 0)::int AS overdue_actions_count
    FROM control_soa cs
    JOIN controls c
      ON c.id = cs.tenant_control_id
    LEFT JOIN LATERAL (
      SELECT tc.id
      FROM tenant_controls tc
      WHERE tc.tenant_id = c.tenant_id
        AND tc.control_id = c.catalog_control_id
      ORDER BY tc.created_at ASC NULLS LAST, tc.id ASC
      LIMIT 1
    ) tc_primary ON TRUE
    LEFT JOIN LATERAL (
      SELECT cc2.*
      FROM controls_catalog cc2
      WHERE cc2.id = c.catalog_control_id
         OR (
           c.catalog_control_id IS NULL
           AND cc2.iso = ANY($2::text[])
           AND cc2.clause = c.clause
         )
      ORDER BY
        CASE WHEN cc2.id = c.catalog_control_id THEN 0 ELSE 1 END,
        cc2.id
      LIMIT 1
    ) cc ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT e.id)::int AS evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE (
            e.validated = TRUE
            OR lower(COALESCE(e.status, '')) IN ('aprobada','aprobado','approved','validada','validated')
          )
          AND lower(COALESCE(e.status, '')) NOT IN ('rechazada','rechazado','rejected')
          AND (e.expires_at IS NULL OR e.expires_at >= CURRENT_DATE)
        )::int AS valid_evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE e.expires_at IS NOT NULL AND e.expires_at < CURRENT_DATE
        )::int AS expired_evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE lower(COALESCE(e.status, '')) IN ('rechazada','rechazado','rejected')
        )::int AS rejected_evidence_count
      FROM evidences e
      WHERE e.tenant_id = c.tenant_id
        AND (
          e.control_id = c.id
          OR e.tenant_control_id = c.id
          OR (tc_primary.id IS NOT NULL AND e.tenant_control_id = tc_primary.id)
        )
    ) ev ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT f.id)::int AS open_findings_count
      FROM findings f
      WHERE f.tenant_id = c.tenant_id
        AND (f.iso_code = c.iso_code OR f.iso_code = ANY($2::text[]))
        AND (f.tenant_control_id = c.id OR (tc_primary.id IS NOT NULL AND f.tenant_control_id = tc_primary.id))
        AND f.closed_at IS NULL
        AND lower(COALESCE(f.status, 'abierto')) NOT IN ('cerrado','closed','resuelto','resolved')
    ) f ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT nc.id)::int AS open_nonconformities_count
      FROM tenant_nonconformities nc
      WHERE nc.tenant_id = c.tenant_id
        AND (nc.control_id = c.id OR (tc_primary.id IS NOT NULL AND nc.control_id = tc_primary.id))
        AND nc.resolved_at IS NULL
        AND lower(COALESCE(nc.status, 'abierta')) NOT IN ('cerrada','closed','resuelta','resolved')
    ) nc ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT ri.id)::int AS high_or_critical_risk_count
      FROM iso_risk_matrix_items ri
      WHERE ri.tenant_id = c.tenant_id
        AND (ri.standard_code = c.iso_code OR ri.standard_code = ANY($2::text[]))
        AND (
          ri.catalog_control_id = c.catalog_control_id
          OR (tc_primary.id IS NOT NULL AND ri.tenant_control_id = tc_primary.id)
        )
        AND lower(COALESCE(ri.status, 'suggested')) NOT IN ('rejected','archived','closed','cerrado')
        AND (
          lower(COALESCE(ri.inherent_risk_level, '')) IN ('alto','critico','crítico')
          OR lower(COALESCE(ri.residual_risk_level, '')) IN ('alto','critico','crítico')
        )
    ) ri ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT ap.id)::int AS overdue_actions_count
      FROM action_plans ap
      WHERE ap.tenant_id = c.tenant_id
        AND (ap.iso_code = c.iso_code OR ap.iso_code = ANY($2::text[]))
        AND (ap.tenant_control_id = c.id OR (tc_primary.id IS NOT NULL AND ap.tenant_control_id = tc_primary.id))
        AND ap.due_date IS NOT NULL
        AND ap.due_date < CURRENT_DATE
        AND lower(COALESCE(ap.status, 'abierto')) NOT IN ('cerrado','closed','completado','completed','cancelado')
    ) ap ON TRUE
    WHERE c.tenant_id = $1
      AND c.iso_code = ANY($2::text[])
      ${controlFilter}
    ORDER BY c.clause, c.created_at
    `,
    params
  );

  return withInconsistencies(result.rows);
};

// =============================
// 🧭 PREFLIGHT SOA
// diagnostico no destructivo del origen de datos
// =============================
router.get('/:tenant_id/preflight', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!iso) {
      return res.status(400).json({ error: 'iso es obligatoria' });
    }

    const preflight = await getSoAPreflight(pool, tenant_id, iso);
    res.json(preflight);
  } catch (err) {
    console.error('ERROR PREFLIGHT SOA:', err);
    res.status(500).json({ error: 'Error diagnosticando SoA' });
  }
});

// =============================
// 🚀 INITIALIZE SOA
// materializa controls desde tenant_controls y crea control_soa faltante
// =============================
router.post('/:tenant_id/initialize', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!canManageSoA(req, tenant_id) || READ_ONLY_ROLES.includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'No autorizado para inicializar SoA' });
    }

    if (!iso) {
      return res.status(400).json({ error: 'iso es obligatoria' });
    }

    await client.query('BEGIN');

    const preflightBefore = await getSoAPreflight(client, tenant_id, iso);
    if (!preflightBefore.uses_soa) {
      await client.query('ROLLBACK');
      return res.status(400).json(preflightBefore);
    }
    if (!preflightBefore.standard_active || preflightBefore.blocking_reason) {
      await client.query('ROLLBACK');
      return res.status(409).json(preflightBefore);
    }

    const legacyControlsBefore = preflightBefore.legacy_controls_count;
    const soaRowsBefore = preflightBefore.soa_rows_count;
    const legacyControlsCreated = await materializeControlsFromTenantControls(client, tenant_id, iso);
    const createdSoARows = await bootstrapSoA(client, tenant_id, iso);
    for (const row of createdSoARows) {
      await insertSoAChangeLog(client, {
        tenantId: tenant_id,
        tenantControlId: row.tenant_control_id,
        source: 'initialize',
        field: 'tenant_control_id',
        oldValue: null,
        newValue: row.tenant_control_id,
        reason: 'Inicializacion explicita SoA',
        userId: getUserId(req),
      });
    }
    const soaRowsTotal = await getSoACount(client, tenant_id, iso);

    await client.query('COMMIT');

    res.json({
      ok: true,
      tenant_id,
      iso,
      tenant_controls_count: preflightBefore.tenant_controls_count,
      legacy_controls_before: legacyControlsBefore,
      legacy_controls_created: legacyControlsCreated,
      soa_rows_created: createdSoARows.length,
      soa_rows_total: soaRowsTotal,
      message: legacyControlsCreated === 0 && createdSoARows.length === 0 && soaRowsTotal === soaRowsBefore
        ? 'SoA ya inicializado'
        : 'SoA inicializado desde controles existentes'
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR INITIALIZE SOA:', err);
    res.status(500).json({ error: 'Error inicializando SoA' });
  } finally {
    client.release();
  }
});

// =============================
// 🧠 SOA INTELLIGENCE
// recomendaciones separadas del SoA oficial
// =============================
router.get('/:tenant_id/intelligence', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }
    if (!iso) return res.status(400).json({ error: 'iso es obligatoria' });
    if (!isSoAStandard(iso)) return res.status(400).json({ error: 'La norma no usa SoA' });

    const result = await soaIntelligence.getSoAIntelligence({ tenantId: tenant_id, iso });
    res.json(result);
  } catch (err) {
    console.error('ERROR GET SOA INTELLIGENCE:', err);
    res.status(500).json({ error: 'Error obteniendo inteligencia SoA' });
  }
});

router.get('/:tenant_id/intelligence/:tenant_control_id', auth, async (req, res) => {
  try {
    const { tenant_id, tenant_control_id } = req.params;
    const iso = normalizeIso(req.query.iso);

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }
    if (!iso) return res.status(400).json({ error: 'iso es obligatoria' });
    if (!isSoAStandard(iso)) return res.status(400).json({ error: 'La norma no usa SoA' });

    const result = await soaIntelligence.getSoAControlContext({ tenantId: tenant_id, iso, tenantControlId: tenant_control_id });
    if (!result) return res.status(404).json({ error: 'Control SoA no encontrado' });
    res.json(result);
  } catch (err) {
    console.error('ERROR GET SOA CONTROL INTELLIGENCE:', err);
    res.status(500).json({ error: 'Error obteniendo contexto SoA' });
  }
});

router.get('/:tenant_id/assessments', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);
    if (!ensureTenantAccess(req, tenant_id)) return res.status(403).json({ error: 'No autorizado para este tenant' });
    if (!iso) return res.status(400).json({ error: 'iso es obligatoria' });
    const result = await soaIntelligence.listAssessments({ tenantId: tenant_id, iso });
    res.json(result);
  } catch (err) {
    console.error('ERROR LIST SOA ASSESSMENTS:', err);
    res.status(500).json({ error: 'Error listando assessments SoA' });
  }
});

router.post('/:tenant_id/assessments/run', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);
    const tenantControlId = req.body?.tenant_control_id;
    const useAi = req.body?.use_ai === true;

    if (!ensureTenantAccess(req, tenant_id)) return res.status(403).json({ error: 'No autorizado para este tenant' });
    if (!canManageSoA(req, tenant_id) || READ_ONLY_ROLES.includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'No autorizado para ejecutar evaluación SoA' });
    }
    if (!iso) return res.status(400).json({ error: 'iso es obligatoria' });
    if (!tenantControlId) return res.status(400).json({ error: 'tenant_control_id es obligatorio' });

    const result = await soaIntelligence.runSystemAssessment({ tenantId: tenant_id, iso, tenantControlId, userId: getUserId(req), useAi });
    if (!result) return res.status(404).json({ error: 'Control SoA no encontrado' });
    res.json({ ok: true, assessment: result });
  } catch (err) {
    console.error('ERROR RUN SOA ASSESSMENT:', err);
    res.status(500).json({ error: 'Error ejecutando assessment SoA' });
  }
});

router.post('/:tenant_id/assessments/run-batch', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);
    const limit = Number(req.body?.limit || 50);
    const useAi = req.body?.use_ai === true;

    if (!ensureTenantAccess(req, tenant_id)) return res.status(403).json({ error: 'No autorizado para este tenant' });
    if (!canManageSoA(req, tenant_id) || READ_ONLY_ROLES.includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'No autorizado para ejecutar lote SoA' });
    }
    if (!iso) return res.status(400).json({ error: 'iso es obligatoria' });

    const result = await soaIntelligence.runSystemAssessmentBatch({ tenantId: tenant_id, iso, limit, userId: getUserId(req), useAi });
    res.json(result);
  } catch (err) {
    console.error('ERROR RUN SOA ASSESSMENT BATCH:', err);
    res.status(500).json({ error: 'Error ejecutando lote SoA' });
  }
});

router.post('/:tenant_id/assessments/:assessment_id/apply', auth, async (req, res) => {
  try {
    const { tenant_id, assessment_id } = req.params;
    if (!ensureTenantAccess(req, tenant_id)) return res.status(403).json({ error: 'No autorizado para este tenant' });
    if (!canManageSoA(req, tenant_id) || READ_ONLY_ROLES.includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'No autorizado para aplicar sugerencias SoA' });
    }
    const result = await soaIntelligence.applyAssessment({ tenantId: tenant_id, assessmentId: assessment_id, userId: getUserId(req) });
    if (!result) return res.status(404).json({ error: 'Assessment no encontrado' });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('ERROR APPLY SOA ASSESSMENT:', err);
    const status = err?.code === 'ASSESSMENT_CLOSED' ? 409 : 500;
    res.status(status).json({ error: err?.code === 'ASSESSMENT_CLOSED' ? err.message : 'Error aplicando assessment SoA' });
  }
});

router.post('/:tenant_id/assessments/:assessment_id/reject', auth, async (req, res) => {
  try {
    const { tenant_id, assessment_id } = req.params;
    if (!ensureTenantAccess(req, tenant_id)) return res.status(403).json({ error: 'No autorizado para este tenant' });
    if (!canManageSoA(req, tenant_id) || READ_ONLY_ROLES.includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'No autorizado para rechazar sugerencias SoA' });
    }
    const assessment = await soaIntelligence.rejectAssessment({ tenantId: tenant_id, assessmentId: assessment_id, userId: getUserId(req) });
    if (!assessment) return res.status(404).json({ error: 'Assessment no encontrado o ya cerrado' });
    res.json({ ok: true, assessment });
  } catch (err) {
    console.error('ERROR REJECT SOA ASSESSMENT:', err);
    res.status(500).json({ error: 'Error rechazando assessment SoA' });
  }
});

router.get('/:tenant_id/change-log', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);
    if (!ensureTenantAccess(req, tenant_id)) return res.status(403).json({ error: 'No autorizado para este tenant' });
    if (!iso) return res.status(400).json({ error: 'iso es obligatoria' });
    const result = await soaIntelligence.getChangeLog({ tenantId: tenant_id, iso });
    res.json(result);
  } catch (err) {
    console.error('ERROR GET SOA CHANGE LOG:', err);
    res.status(500).json({ error: 'Error obteniendo historial SoA' });
  }
});

// =============================
// 📋 GET SOA POR TENANT + ISO
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const iso = normalizeIso(req.query.iso);

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!iso) {
      return res.status(400).json({ error: 'iso es obligatoria' });
    }

    if (!isSoAStandard(iso)) {
      return res.status(400).json({ error: 'La norma no usa SoA' });
    }

    const rows = await getSoARows(pool, tenant_id, iso);
    const metrics = buildSoAMetrics(rows);
    const preflight = rows.length === 0
      ? await getSoAPreflight(pool, tenant_id, iso)
      : null;

    res.json({
      tenant_id,
      iso,
      requires_initialization: rows.length === 0 && Boolean(preflight?.can_initialize_soa),
      message: rows.length === 0
        ? 'SoA sin filas materializadas. Usa POST /api/soa/:tenant_id/initialize para inicializar.'
        : null,
      rows,
      metrics,
      inconsistencies: rows
        .filter((row) => Array.isArray(row.inconsistencies) && row.inconsistencies.length > 0)
        .map((row) => ({
          tenant_control_id: row.tenant_control_id,
          modern_tenant_control_id: row.modern_tenant_control_id,
          clause: row.clause,
          codes: row.inconsistencies,
        })),
      preflight,
    });

  } catch (err) {
    console.error('ERROR GET SOA:', err);
    res.status(500).json({ error: 'Error obteniendo SoA' });
  }
});

// =============================
// 💾 UPDATE SOA
// =============================
router.put('/:tenant_control_id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_control_id } = req.params;
    const requestedStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'implementation_status')
      ? normalizeImplementationStatus(req.body.implementation_status)
      : null;

    if (req.body?.applicable === true && requestedStatus === 'no aplica') {
      return res.status(400).json({ error: 'applicable=true no permite implementation_status=no aplica' });
    }

    await client.query('BEGIN');

    const controlResult = await client.query(
      `
      SELECT id, tenant_id, iso_code
      FROM controls
      WHERE id = $1
      LIMIT 1
      `,
      [tenant_control_id]
    );

    if (controlResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const control = controlResult.rows[0];

    if (!ensureTenantAccess(req, control.tenant_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!canManageSoA(req, control.tenant_id) || READ_ONLY_ROLES.includes(String(req.user?.role || '').toLowerCase())) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No autorizado para modificar SoA' });
    }

    if (!isSoAStandard(control.iso_code)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este control no pertenece a una norma SoA' });
    }

    const currentResult = await client.query(
      `
      SELECT applicable, implementation_status, justification, notes, owner, review_date
      FROM control_soa
      WHERE tenant_control_id = $1
      FOR UPDATE
      `,
      [tenant_control_id]
    );

    const current = currentResult.rows[0] || {};
    const next = normalizeSoAPayload(req.body || {}, current);
    const validation = validateSoAState(next);

    if (!validation.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Estado SoA inválido',
        details: validation.errors,
      });
    }

    await client.query(
      `
      INSERT INTO control_soa (
        tenant_control_id,
        applicable,
        implementation_status,
        justification,
        notes,
        owner,
        review_date,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (tenant_control_id)
      DO UPDATE SET
        applicable = EXCLUDED.applicable,
        implementation_status = EXCLUDED.implementation_status,
        justification = EXCLUDED.justification,
        notes = EXCLUDED.notes,
        owner = EXCLUDED.owner,
        review_date = EXCLUDED.review_date,
        updated_at = NOW()
      `,
      [
        tenant_control_id,
        next.applicable,
        next.implementation_status,
        next.justification,
        next.notes,
        next.owner,
        next.review_date
      ]
    );

    const changeFields = ['applicable', 'implementation_status', 'justification', 'notes', 'owner', 'review_date'];
    for (const field of changeFields) {
      const oldValue = field === 'implementation_status'
        ? normalizeImplementationStatus(current[field])
        : current[field] ?? null;
      const newValue = next[field] ?? null;
      if (String(oldValue ?? '') !== String(newValue ?? '')) {
        await insertSoAChangeLog(client, {
          tenantId: control.tenant_id,
          tenantControlId: tenant_control_id,
          source: 'manual',
          field,
          oldValue,
          newValue,
          reason: 'Actualizacion manual SoA',
          userId: getUserId(req),
        });
      }
    }

    const rows = await getSoARows(client, control.tenant_id, control.iso_code, tenant_control_id);
    await client.query('COMMIT');
    res.json(rows[0]);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR UPDATE SOA:', err);
    res.status(500).json({ error: 'Error actualizando SoA' });
  } finally {
    client.release();
  }
});

module.exports = router;
