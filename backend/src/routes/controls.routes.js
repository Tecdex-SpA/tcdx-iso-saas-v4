const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');


function deriveWorkbenchHealthStatus(row) {
  const explicitHealth = String(
    row.derived_health_status ||
    row.health_status ||
    row.tenant_health_status ||
    ''
  ).toLowerCase().trim()

  const declaredStatus = String(
    row.declared_status ||
    row.status ||
    ''
  ).toLowerCase().trim()

  const score = Number(
    row.declared_score ??
    row.score ??
    row.health_score ??
    0
  )

  const evidenceCount = Number(row.evidence_count || 0)
  const pendingEvidenceCount = Number(row.pending_evidence_count || 0)
  const openFindings = Number(row.open_findings_count || 0)
  const openNonconformities = Number(row.open_nonconformities_count || 0)

  if (
    ['saludable', 'atencion', 'deteriorado', 'critico'].includes(explicitHealth) &&
    Number(row.health_score || 0) > 0
  ) {
    return explicitHealth
  }

  if (
    ['cumple', 'aprobada', 'aprobado'].includes(declaredStatus) &&
    score >= 80 &&
    evidenceCount > 0 &&
    pendingEvidenceCount === 0 &&
    openFindings === 0 &&
    openNonconformities === 0
  ) {
    return 'saludable'
  }

  if (
    ['cumple', 'parcial'].includes(declaredStatus) &&
    score >= 50 &&
    evidenceCount > 0
  ) {
    return 'atencion'
  }

  if (explicitHealth) return explicitHealth

  return 'deteriorado'
}

function deriveWorkbenchHealthScore(row) {
  const existing = Number(row.health_score || 0)
  const declaredScore = Number(row.declared_score ?? row.score ?? 0)
  const evidenceCount = Number(row.evidence_count || 0)

  if (existing > 0) return existing
  if (declaredScore > 0 && evidenceCount > 0) return Math.max(0, Math.min(100, declaredScore))

  return existing
}


function getWorkbenchDerivedHealth(row) {
  const healthScore = Number(row.health_score || 0)
  const existingHealth = String(
    row.derived_health_status ||
    row.tenant_health_status ||
    row.health_status ||
    ''
  ).toLowerCase().trim()

  const status = String(
    row.declared_status ||
    row.status ||
    ''
  ).toLowerCase().trim()

  const score = Number(row.declared_score || row.score || 0)
  const evidenceCount = Number(row.evidence_count || 0)
  const pendingEvidenceCount = Number(row.pending_evidence_count || 0)
  const openFindings = Number(row.open_findings_count || 0)
  const openNonconformities = Number(row.open_nonconformities_count || 0)

  if (
    healthScore > 0 &&
    ['saludable', 'atencion', 'deteriorado', 'critico'].includes(existingHealth)
  ) {
    return {
      derived_health_status: existingHealth,
      health_score: healthScore,
    }
  }

  if (
    status === 'cumple' &&
    score >= 80 &&
    evidenceCount > 0 &&
    pendingEvidenceCount === 0 &&
    openFindings === 0 &&
    openNonconformities === 0
  ) {
    return {
      derived_health_status: 'saludable',
      health_score: Math.max(0, Math.min(100, score)),
    }
  }

  if (
    ['cumple', 'parcial'].includes(status) &&
    score >= 50 &&
    evidenceCount > 0
  ) {
    return {
      derived_health_status: 'atencion',
      health_score: Math.max(0, Math.min(100, score)),
    }
  }

  return {
    derived_health_status: existingHealth || 'deteriorado',
    health_score: healthScore,
  }
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
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

function isSuperAdmin(req) {
  const role = normalizeRole(
    req.user?.role || req.user?.user_role || req.user?.userRole
  );

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(role);
}

function isAuditor(req) {
  const role = normalizeRole(
    req.user?.role || req.user?.user_role || req.user?.userRole
  );

  return role === 'auditor';
}

function canAccessTenant(req, tenantId) {
  if (isSuperAdmin(req)) return true;

  const userTenantId = getUserTenantId(req.user);
  return Boolean(userTenantId && tenantId && String(userTenantId) === String(tenantId));
}

function canManageControls(req, tenantId) {
  if (isAuditor(req)) return false;
  return canAccessTenant(req, tenantId);
}

function isUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function normalizeStandardsList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

async function ensureDefaultOperation(client, tenantId) {
  const existing = await client.query(
    `
    SELECT *
    FROM tenant_operations
    WHERE tenant_id = $1
      AND is_default = TRUE
    LIMIT 1
    `,
    [tenantId]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  const created = await client.query(
    `
    INSERT INTO tenant_operations (
      tenant_id,
      code,
      name,
      description,
      operation_type,
      is_active,
      is_default,
      sort_order,
      metadata
    )
    VALUES (
      $1,
      'GENERAL',
      'Toda la empresa',
      'Operación por defecto',
      'empresa',
      TRUE,
      TRUE,
      0,
      '{}'::jsonb
    )
    RETURNING *
    `,
    [tenantId]
  );

  return created.rows[0];
}

async function resolveScopedOperation(client, tenantId, isoCode, requestedOperationId) {
  await ensureDefaultOperation(client, tenantId);

  if (requestedOperationId) {
    if (!isUUID(requestedOperationId)) {
      throw new Error('operation_id inválido');
    }

    const requested = await client.query(
      `
      SELECT
        op.id,
        op.name,
        op.code,
        op.is_default,
        op.operation_type
      FROM tenant_standard_operations tso
      JOIN tenant_operations op
        ON op.id = tso.operation_id
      WHERE tso.tenant_id = $1
        AND tso.standard_code = $2
        AND tso.is_active = TRUE
        AND op.is_active = TRUE
        AND op.id = $3
      LIMIT 1
      `,
      [tenantId, isoCode, requestedOperationId]
    );

    if (requested.rowCount === 0) {
      throw new Error(
        'La operación seleccionada no está activa para esa norma en esta empresa.'
      );
    }

    return requested.rows[0];
  }

  const fallback = await client.query(
    `
    SELECT
      op.id,
      op.name,
      op.code,
      op.is_default,
      op.operation_type
    FROM tenant_standard_operations tso
    JOIN tenant_operations op
      ON op.id = tso.operation_id
    WHERE tso.tenant_id = $1
      AND tso.standard_code = $2
      AND tso.is_active = TRUE
      AND op.is_active = TRUE
    ORDER BY
      op.is_default DESC,
      op.sort_order,
      op.name
    LIMIT 1
    `,
    [tenantId, isoCode]
  );

  if (fallback.rowCount === 0) {
    throw new Error(
      'La norma seleccionada no tiene una operación activa asignada.'
    );
  }

  return fallback.rows[0];
}

async function ensureTenantControl(client, tenantId, operationId, controlId) {
  await client.query(
    `
    INSERT INTO tenant_controls (tenant_id, operation_id, control_id, status)
    SELECT $1, $2, $3, 'pendiente'
    WHERE NOT EXISTS (
      SELECT 1
      FROM tenant_controls
      WHERE tenant_id = $1
        AND operation_id = $2
        AND control_id = $3
    )
    `,
    [tenantId, operationId, controlId]
  );
}

async function getCatalogMode(tenantId, isoCode) {
  const result = await pool.query(
    `
    SELECT catalog_mode
    FROM tenant_standards
    WHERE tenant_id = $1
      AND standard_code = $2
    LIMIT 1
    `,
    [tenantId, isoCode]
  );

  if (result.rowCount === 0) return 'generic';
  return result.rows[0].catalog_mode || 'generic';
}

async function resolveResponsibleUserId(client, tenantId, rawValue) {
  const value = String(rawValue || '').trim();

  if (!value) return null;

  if (isUUID(value)) {
    const byId = await client.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [value, tenantId]
    );

    if (byId.rowCount > 0) {
      return byId.rows[0].id;
    }

    throw new Error(
      'El responsable indicado no pertenece a esta empresa o no existe.'
    );
  }

  const byEmail = await client.query(
    `
    SELECT id
    FROM users
    WHERE tenant_id = $1
      AND LOWER(email) = LOWER($2)
    LIMIT 1
    `,
    [tenantId, value]
  );

  if (byEmail.rowCount > 0) {
    return byEmail.rows[0].id;
  }

  throw new Error(
    'No se encontró un usuario de esta empresa con ese email. Usa un email válido o un UUID de usuario.'
  );
}

async function resolveControlRefs(client, tenantId, tenantControlId) {
  const result = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id,
      tc.tenant_id,
      tc.operation_id,
      op.name AS operation_name,
      op.code AS operation_code,
      op.operation_type,
      tc.control_id AS catalog_control_id,
      tc.status AS declared_status,
      tc.score AS declared_score,
      tc.priority,
      tc.due_date,
      tc.applicability,
      tc.responsible_user_id,
      cc.iso AS primary_standard_code,
      cc.clause,
      cc.category,
      cc.description,
      COALESCE(
        rel.valid_for_standards,
        CASE
          WHEN cc.iso IS NOT NULL THEN ARRAY[cc.iso]::text[]
          ELSE ARRAY[]::text[]
        END
      ) AS valid_for_standards,
      c.id AS controls_id_legacy
    FROM tenant_controls tc
    JOIN tenant_operations op
      ON op.id = tc.operation_id
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    LEFT JOIN LATERAL (
      SELECT
        array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code) AS valid_for_standards
      FROM controls_catalog_standards ccs
      WHERE ccs.control_id = cc.id
    ) rel ON TRUE
    LEFT JOIN controls c
      ON c.catalog_control_id = cc.id
    WHERE tc.id = $1
      AND tc.tenant_id = $2
    LIMIT 1
    `,
    [tenantControlId, tenantId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

async function getTenantControlByCatalog(tenantId, operationId, controlId) {
  const result = await pool.query(
    `
    SELECT *
    FROM tenant_controls
    WHERE tenant_id = $1
      AND operation_id = $2
      AND control_id = $3
    ORDER BY created_at DESC NULLS LAST, id
    LIMIT 1
    `,
    [tenantId, operationId, controlId]
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

async function getCatalogControlForTenant(
  client,
  tenantId,
  operationId,
  isoCode,
  controlId,
  catalogMode
) {
  const result = await client.query(
    `
    WITH operation_scope AS (
      SELECT
        op.id,
        op.name
      FROM tenant_operations op
      WHERE op.id = $2
        AND op.tenant_id = $1
        AND op.is_active = TRUE
    ),
    candidate_controls AS (
      SELECT
        cc.id,
        $3::text AS iso,
        os.id AS operation_id,
        os.name AS operation_name,
        cc.iso AS primary_standard_code,
        COALESCE(rel.display_clause, cc.clause) AS clause,
        cc.category,
        cc.description,
        cc.source_type,
        cc.tenant_id,
        cc.base_control_id,
        cc.is_active,
        tc.id AS tenant_control_id,
        COALESCE(
          rel.valid_for_standards,
          CASE
            WHEN cc.iso IS NOT NULL THEN ARRAY[cc.iso]::text[]
            ELSE ARRAY[]::text[]
          END
        ) AS valid_for_standards,
        COALESCE(
          rel.also_valid_for,
          CASE
            WHEN cc.iso IS NOT NULL AND cc.iso <> $3 THEN ARRAY[cc.iso]::text[]
            ELSE ARRAY[]::text[]
          END
        ) AS also_valid_for,
        CASE
          WHEN cc.source_type = 'personalized' THEN 'personalized|' || cc.id::text
          ELSE md5(
            lower(regexp_replace(trim(coalesce(cc.description, '')), '\\s+', ' ', 'g'))
            || '||' ||
            lower(regexp_replace(trim(coalesce(cc.category, '')), '\\s+', ' ', 'g'))
            || '||' ||
            array_to_string(
              COALESCE(
                rel.valid_for_standards,
                CASE
                  WHEN cc.iso IS NOT NULL THEN ARRAY[cc.iso]::text[]
                  ELSE ARRAY[]::text[]
                END
              ),
              ','
            )
          )
        END AS equivalence_key
      FROM controls_catalog cc
      CROSS JOIN operation_scope os
      LEFT JOIN tenant_controls tc
        ON tc.control_id = cc.id
       AND tc.tenant_id = $1
       AND tc.operation_id = $2
      LEFT JOIN LATERAL (
        SELECT
          array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code) AS valid_for_standards,
          array_remove(
            array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code),
            $3::text
          ) AS also_valid_for,
          MAX(CASE WHEN ccs.standard_code = $3 THEN ccs.clause END) AS display_clause
        FROM controls_catalog_standards ccs
        WHERE ccs.control_id = cc.id
      ) rel ON TRUE
      WHERE cc.is_active = TRUE
        AND (
          ($4 = 'generic' AND cc.source_type = 'generic' AND cc.tenant_id IS NULL)
          OR
          ($4 = 'personalized' AND cc.source_type = 'personalized' AND cc.tenant_id = $1)
          OR
          ($4 = 'mixed' AND (
            (cc.source_type = 'generic' AND cc.tenant_id IS NULL)
            OR
            (cc.source_type = 'personalized' AND cc.tenant_id = $1)
          ))
        )
        AND (
          cc.iso = $3
          OR EXISTS (
            SELECT 1
            FROM controls_catalog_standards ccs_req
            WHERE ccs_req.control_id = cc.id
              AND ccs_req.standard_code = $3
          )
        )
    ),
    ranked_controls AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY equivalence_key
          ORDER BY
            CASE WHEN tenant_control_id IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN primary_standard_code = $3 THEN 0 ELSE 1 END,
            id
        ) AS rn
      FROM candidate_controls
    )
    SELECT *
    FROM ranked_controls
    WHERE id = $5
       OR (
         equivalence_key IN (
           SELECT equivalence_key
           FROM ranked_controls
           WHERE id = $5
         )
         AND rn = 1
       )
    ORDER BY
      CASE WHEN id = $5 THEN 0 ELSE 1 END,
      rn
    LIMIT 1
    `,
    [tenantId, operationId, isoCode, catalogMode, controlId]
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

async function getTenantControlDependencies(client, tenantId, tenantControlId) {
  const control = await resolveControlRefs(client, tenantId, tenantControlId);

  if (!control) {
    return null;
  }

  const evidenceResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM evidences e
    WHERE e.tenant_id = $1
      AND (
        e.tenant_control_id = $2
        OR e.control_id = $3
      )
      AND COALESCE(e.status, '') <> 'deleted'
    `,
    [tenantId, control.tenant_control_id, control.catalog_control_id]
  );

  const nonconformityResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM tenant_nonconformities tnc
    WHERE tnc.tenant_id = $1
      AND tnc.control_id = $2
      AND (
        tnc.resolved_at IS NULL
        OR LOWER(COALESCE(tnc.status, '')) <> 'resuelta'
      )
    `,
    [tenantId, control.catalog_control_id]
  );

  const findingResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM findings f
    WHERE f.tenant_id = $1
      AND (
        f.tenant_control_id = $2
        OR f.tenant_control_id = $3::uuid
      )
      AND LOWER(COALESCE(f.status, '')) <> 'cerrado'
    `,
    [tenantId, control.tenant_control_id, control.controls_id_legacy || null]
  );

  const actionPlanResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM action_plans ap
    WHERE ap.tenant_id = $1
      AND (
        ap.tenant_control_id = $2
        OR ap.tenant_control_id = $3::uuid
        OR (ap.source_type = 'control' AND ap.source_id = $2)
        OR (ap.source_type = 'control' AND ap.source_id = $3::uuid)
      )
      AND LOWER(COALESCE(ap.status, '')) NOT IN ('cerrado', 'completado', 'cancelado')
    `,
    [tenantId, control.tenant_control_id, control.controls_id_legacy || null]
  );

  const dependencies = {
    evidences: Number(evidenceResult.rows[0]?.total || 0),
    findings: Number(findingResult.rows[0]?.total || 0),
    nonconformities: Number(nonconformityResult.rows[0]?.total || 0),
    action_plans: Number(actionPlanResult.rows[0]?.total || 0),
  };

  return {
    control,
    dependencies,
    hasDependencies: Object.values(dependencies).some(
      (value) => Number(value || 0) > 0
    ),
  };
}

// =====================================
// WORKBENCH OPERATIVO
// =====================================
router.get('/workbench/:tenant_id/:iso', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, iso } = req.params;
    const requestedOperationId = String(req.query.operation_id || '').trim() || null;

    if (!canAccessTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const operation = await resolveScopedOperation(
      client,
      tenant_id,
      iso,
      requestedOperationId
    );

    const catalogMode = await getCatalogMode(tenant_id, iso);

    const result = await client.query(
      `
      WITH latest_health AS (
        SELECT DISTINCT ON (chs.tenant_control_id)
          chs.tenant_control_id,
          chs.standard_code,
          chs.health_status,
          COALESCE(chs.health_score, 0) AS health_score,
          chs.calculated_at
        FROM control_health_scores chs
        WHERE chs.tenant_id = $1
          AND chs.standard_code = $3
        ORDER BY chs.tenant_control_id, chs.calculated_at DESC NULLS LAST
      ),
      evidence_stats AS (
        SELECT
          tc.id AS tenant_control_id,
          COUNT(e.id)::int AS evidence_count,
          COUNT(*) FILTER (
            WHERE e.id IS NOT NULL
              AND LOWER(COALESCE(e.status, '')) IN ('pending', 'pendiente', 'uploaded', 'subida')
          )::int AS pending_evidence_count,
          MAX(e.created_at) AS last_evidence_at
        FROM tenant_controls tc
        LEFT JOIN evidences e
          ON e.tenant_id = tc.tenant_id
         AND COALESCE(e.status, '') <> 'deleted'
         AND (
              e.tenant_control_id = tc.id
              OR (
                e.tenant_control_id IS NULL
                AND e.control_id = tc.control_id
                AND (
                  e.metadata->>'operation_id' IS NULL
                  OR e.metadata->>'operation_id' = tc.operation_id::text
                )
              )
         )
        WHERE tc.tenant_id = $1
          AND tc.operation_id = $2
        GROUP BY tc.id
      ),
      nonconformity_stats AS (
        SELECT
          tc.id AS tenant_control_id,
          COUNT(tnc.id) FILTER (
            WHERE tnc.id IS NOT NULL
              AND (
                tnc.resolved_at IS NULL
                OR LOWER(COALESCE(tnc.status,'')) <> 'resuelta'
              )
          )::int AS open_nonconformities_count,
          COUNT(tnc.id)::int AS total_nonconformities_count,
          MAX(tnc.detected_at) AS last_nonconformity_at
        FROM tenant_controls tc
        LEFT JOIN tenant_nonconformities tnc
          ON tnc.tenant_id = tc.tenant_id
         AND (
              tnc.control_id = tc.control_id
         )
        WHERE tc.tenant_id = $1
          AND tc.operation_id = $2
        GROUP BY tc.id
      ),
      legacy_controls AS (
        SELECT DISTINCT ON (catalog_control_id)
          catalog_control_id,
          id AS controls_id_legacy
        FROM controls
        WHERE catalog_control_id IS NOT NULL
        ORDER BY catalog_control_id, created_at DESC NULLS LAST, id
      ),
      finding_stats AS (
        SELECT
          tc.id AS tenant_control_id,
          COUNT(f.id) FILTER (
            WHERE f.id IS NOT NULL
              AND LOWER(COALESCE(f.status,'')) <> 'cerrado'
          )::int AS open_findings_count,
          COUNT(f.id)::int AS total_findings_count,
          MAX(f.created_at) AS last_finding_at
        FROM tenant_controls tc
        LEFT JOIN legacy_controls lc
          ON lc.catalog_control_id = tc.control_id
        LEFT JOIN findings f
          ON f.tenant_id = tc.tenant_id
         AND (
              f.tenant_control_id = tc.id
              OR (
                lc.controls_id_legacy IS NOT NULL
                AND f.tenant_control_id = lc.controls_id_legacy              )
         )
        WHERE tc.tenant_id = $1
          AND tc.operation_id = $2
        GROUP BY tc.id
      ),
      candidate_controls AS (
        SELECT
          tc.id AS tenant_control_id,
          tc.tenant_id,
          tc.operation_id,
          op.name AS operation_name,
          op.code AS operation_code,
          op.operation_type,
          tc.control_id AS catalog_control_id,
          $3::text AS iso,
          cc.iso AS primary_standard_code,
          COALESCE(rel.display_clause, cc.clause) AS clause,
          cc.category,
          cc.description,
          cc.source_type,
          $4::text AS catalog_mode,
          COALESCE(
            rel.valid_for_standards,
            CASE
              WHEN cc.iso IS NOT NULL THEN ARRAY[cc.iso]::text[]
              ELSE ARRAY[]::text[]
            END
          ) AS valid_for_standards,
          COALESCE(
            rel.also_valid_for,
            CASE
              WHEN cc.iso IS NOT NULL AND cc.iso <> $3 THEN ARRAY[cc.iso]::text[]
              ELSE ARRAY[]::text[]
            END
          ) AS also_valid_for,

          tc.status AS declared_status,
          tc.score AS declared_score,
          tc.health_status AS tenant_health_status,
        veh.effective_health_score AS effective_health_score,
        veh.effective_health_status AS effective_health_status,
        veh.compliance_bucket AS effective_compliance_bucket,
        veh.evidence_quality_status AS effective_evidence_quality_status,
        veh.approved_evidence_count AS effective_approved_evidence_count,
        veh.official_evidence_count AS effective_official_evidence_count,
        veh.open_action_plans_count AS effective_open_action_plans_count,
        veh.overdue_action_plans_count AS effective_overdue_action_plans_count,
        veh.is_in_active_operational_scope AS effective_is_in_active_operational_scope,
        veh.health_trace_json AS effective_health_trace_json,
          tc.last_reviewed_at,
          tc.due_date,
          tc.priority,
          tc.applicability,
          tc.responsible_user_id,

          u.email AS responsible_user_email,
          COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(u.name), ''), u.email) AS responsible_user_name,

          lh.health_status AS derived_health_status,
          lh.health_score,
          lh.calculated_at AS health_calculated_at,

          COALESCE(es.evidence_count, 0) AS evidence_count,
          COALESCE(es.pending_evidence_count, 0) AS pending_evidence_count,
          es.last_evidence_at,

          COALESCE(ns.open_nonconformities_count, 0) AS open_nonconformities_count,
          COALESCE(ns.total_nonconformities_count, 0) AS total_nonconformities_count,
          ns.last_nonconformity_at,

          COALESCE(fs.open_findings_count, 0) AS open_findings_count,
          COALESCE(fs.total_findings_count, 0) AS total_findings_count,
          fs.last_finding_at,

          CASE
            WHEN cc.source_type = 'personalized' THEN 'personalized|' || cc.id::text
            ELSE md5(
              lower(regexp_replace(trim(coalesce(cc.description, '')), '\\s+', ' ', 'g'))
              || '||' ||
              lower(regexp_replace(trim(coalesce(cc.category, '')), '\\s+', ' ', 'g'))
              || '||' ||
              array_to_string(
                COALESCE(
                  rel.valid_for_standards,
                  CASE
                    WHEN cc.iso IS NOT NULL THEN ARRAY[cc.iso]::text[]
                    ELSE ARRAY[]::text[]
                  END
                ),
                ','
              )
            )
          END AS equivalence_key

        FROM tenant_controls tc
        JOIN tenant_operations op
          ON op.id = tc.operation_id
        JOIN controls_catalog cc
          ON tc.control_id = cc.id
        LEFT JOIN LATERAL (
          SELECT
            array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code) AS valid_for_standards,
            array_remove(
              array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code),
              $3::text
            ) AS also_valid_for,
            MAX(CASE WHEN ccs.standard_code = $3 THEN ccs.clause END) AS display_clause
          FROM controls_catalog_standards ccs
          WHERE ccs.control_id = cc.id
        ) rel ON TRUE
        LEFT JOIN public.v_iso_control_effective_health veh
          ON veh.tenant_control_id = tc.id
         AND veh.tenant_id = tc.tenant_id
        LEFT JOIN users u
          ON u.id = tc.responsible_user_id
        LEFT JOIN latest_health lh
          ON lh.tenant_control_id = tc.id
        LEFT JOIN evidence_stats es
          ON es.tenant_control_id = tc.id
        LEFT JOIN nonconformity_stats ns
          ON ns.tenant_control_id = tc.id
        LEFT JOIN finding_stats fs
          ON fs.tenant_control_id = tc.id
        WHERE tc.tenant_id = $1
          AND tc.operation_id = $2
          AND cc.is_active = TRUE
          AND (
            ($4 = 'generic' AND cc.source_type = 'generic' AND cc.tenant_id IS NULL)
            OR
            ($4 = 'personalized' AND cc.source_type = 'personalized' AND cc.tenant_id = $1)
            OR
            ($4 = 'mixed' AND (
              (cc.source_type = 'generic' AND cc.tenant_id IS NULL)
              OR
              (cc.source_type = 'personalized' AND cc.tenant_id = $1)
            ))
          )
          AND (
            cc.iso = $3
            OR EXISTS (
              SELECT 1
              FROM controls_catalog_standards ccs_req
              WHERE ccs_req.control_id = cc.id
                AND ccs_req.standard_code = $3
            )
          )
      ),
      ranked_controls AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY equivalence_key
            ORDER BY
              CASE WHEN primary_standard_code = $3 THEN 0 ELSE 1 END,
              clause NULLS LAST,
              catalog_control_id
          ) AS rn
        FROM candidate_controls
      )
      SELECT *
      FROM ranked_controls
      WHERE rn = 1
      ORDER BY
        clause NULLS LAST,
        CASE
          WHEN COALESCE(health_score, 0) < 50 THEN 1
          WHEN COALESCE(health_score, 0) < 80 THEN 2
          ELSE 3
        END,
        COALESCE(evidence_count, 0) ASC,
        COALESCE(open_findings_count, 0) DESC,
        COALESCE(open_nonconformities_count, 0) DESC,
        category NULLS LAST,
        description NULLS LAST,
        tenant_control_id
      `,
      [tenant_id, operation.id, iso, catalogMode]
    );

    const items = result.rows.map((row) => {
      const fallbackHealth = getWorkbenchDerivedHealth(row);

      const effectiveHealthScore =
        row.effective_health_score !== null && row.effective_health_score !== undefined
          ? Number(row.effective_health_score || 0)
          : Number(fallbackHealth.health_score || 0);

      const effectiveHealthStatus =
        row.effective_health_status ||
        fallbackHealth.derived_health_status ||
        'sin_datos';

      let complianceBucket =
        row.effective_compliance_bucket ||
        row.compliance_bucket ||
        null;

      if (!complianceBucket) {
        if (effectiveHealthScore >= 80) complianceBucket = 'cumple';
        else if (effectiveHealthScore >= 50) complianceBucket = 'parcial';
        else if (effectiveHealthScore > 0) complianceBucket = 'no_cumple';
        else complianceBucket = 'sin_datos';
      }

      return {
        ...row,

        // Compatibilidad con frontend actual.
        health_score: effectiveHealthScore,
        derived_health_status: effectiveHealthStatus,
        compliance_bucket: complianceBucket,

        // Campos nuevos para salud efectiva / auditoría / KPI.
        effective_health_score: effectiveHealthScore,
        effective_health_status: effectiveHealthStatus,
        evidence_quality_status: row.effective_evidence_quality_status || row.evidence_quality_status || 'sin_evidencia',
        approved_evidence_count: Number(row.effective_approved_evidence_count ?? row.approved_evidence_count ?? 0),
        official_evidence_count: Number(row.effective_official_evidence_count ?? row.official_evidence_count ?? 0),
        open_action_plans_count: Number(row.effective_open_action_plans_count ?? row.open_action_plans_count ?? 0),
        overdue_action_plans_count: Number(row.effective_overdue_action_plans_count ?? row.overdue_action_plans_count ?? 0),
        is_in_active_operational_scope:
          row.effective_is_in_active_operational_scope ??
          row.is_in_active_operational_scope ??
          true,
        health_trace_json: row.effective_health_trace_json || row.health_trace_json || null,
      };
    });

    const summary = {
      total_controls: items.length,
      healthy_controls: items.filter(
        (item) => Number(item.health_score || 0) >= 80
      ).length,
      attention_controls: items.filter((item) => {
        const score = Number(item.health_score || 0);
        return score >= 50 && score < 80;
      }).length,
      deteriorated_controls: items.filter(
        (item) => Number(item.health_score || 0) < 50
      ).length,
      controls_without_evidence: items.filter(
        (item) => Number(item.evidence_count || 0) === 0
      ).length,
      controls_with_open_nc: items.filter(
        (item) => Number(item.open_nonconformities_count || 0) > 0
      ).length,
      average_health_score:
        items.length > 0
          ? Number(
              (
                items.reduce(
                  (acc, item) => acc + Number(item.health_score || 0),
                  0
                ) / items.length
              ).toFixed(2)
            )
          : 0,
      catalog_mode: catalogMode,
    };

    return res.json({
      ok: true,
      tenant_id,
      iso,
      operation,
      catalog_mode: catalogMode,
      summary,
      items,
    });
  } catch (err) {
    console.error('ERROR GET CONTROLS WORKBENCH:', err);

    const message = err?.message || 'Error obteniendo workbench de controles';
    const isInactiveOperationError = message.includes(
      'La operación seleccionada no está activa para esa norma en esta empresa'
    );

    return res.status(isInactiveOperationError ? 400 : 500).json({
      error: isInactiveOperationError
        ? message
        : 'Error obteniendo workbench de controles',
      ...(isInactiveOperationError ? {} : { detail: message }),
    });
  } finally {
    client.release();
  }
});

// =====================================
// UPDATE OPERATIVO
// =====================================
router.put('/workbench/:tenant_control_id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_control_id } = req.params;
    const {
      tenant_id,
      status,
      score,
      priority,
      due_date,
      last_reviewed_at,
      responsible_user_id,
      applicability,
      mark_reviewed_now,
    } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id es obligatorio' });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const current = await client.query(
      `
      SELECT *
      FROM tenant_controls
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [tenant_control_id, tenant_id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'tenant_control no encontrado' });
    }

    const resolvedResponsibleUserId =
      responsible_user_id === undefined
        ? undefined
        : await resolveResponsibleUserId(client, tenant_id, responsible_user_id);

    let resolvedLastReviewedAt = null;
    if (mark_reviewed_now === true) {
      resolvedLastReviewedAt = new Date().toISOString();
    } else if (last_reviewed_at) {
      resolvedLastReviewedAt = last_reviewed_at;
    }

    const result = await client.query(
      `
      UPDATE tenant_controls
      SET
        status = COALESCE($1, status),
        score = COALESCE($2, score),
        priority = COALESCE($3, priority),
        due_date = COALESCE($4, due_date),
        last_reviewed_at = COALESCE($5, last_reviewed_at),
        responsible_user_id = COALESCE($6, responsible_user_id),
        applicability = COALESCE($7, applicability),
        updated_at = NOW()
      WHERE id = $8
        AND tenant_id = $9
      RETURNING *
      `,
      [
        status ?? null,
        score ?? null,
        priority ?? null,
        due_date ?? null,
        resolvedLastReviewedAt ?? null,
        resolvedResponsibleUserId ?? null,
        applicability ?? null,
        tenant_control_id,
        tenant_id,
      ]
    );

    return res.json({
      ok: true,
      updated: result.rows[0],
    });
  } catch (err) {
    console.error('ERROR UPDATE CONTROL WORKBENCH:', err);
    return res.status(500).json({
      error: 'Error actualizando control operativo',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// QUICK NC
// =====================================
router.post('/workbench/:tenant_control_id/quick-nonconformity', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_control_id } = req.params;
    const { tenant_id } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id es obligatorio' });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const control = await resolveControlRefs(client, tenant_id, tenant_control_id);

    if (!control) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const existing = await client.query(
      `
      SELECT *
      FROM tenant_nonconformities
      WHERE tenant_id = $1
        AND control_id = $2
        AND (
          resolved_at IS NULL
          OR LOWER(COALESCE(status,'')) <> 'resuelta'
        )
      ORDER BY detected_at DESC NULLS LAST, id DESC
      LIMIT 1
      `,
      [tenant_id, control.catalog_control_id]
    );

    if (existing.rowCount > 0) {
      return res.json({
        ok: true,
        already_exists: true,
        nonconformity: existing.rows[0],
      });
    }

    const created = await client.query(
      `
      INSERT INTO tenant_nonconformities (
        tenant_id,
        control_id,
        control_description,
        status,
        detected_at
      )
      VALUES ($1, $2, $3, 'abierta', NOW())
      RETURNING *
      `,
      [tenant_id, control.catalog_control_id, control.description]
    );

    return res.json({
      ok: true,
      already_exists: false,
      nonconformity: created.rows[0],
    });
  } catch (err) {
    console.error('ERROR QUICK NONCONFORMITY:', err);
    return res.status(500).json({
      error: 'Error creando/abriendo no conformidad',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// QUICK FINDING
// =====================================
router.post('/workbench/:tenant_control_id/quick-finding', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_control_id } = req.params;
    const { tenant_id, iso_code } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id es obligatorio' });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const control = await resolveControlRefs(client, tenant_id, tenant_control_id);

    if (!control) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const effectiveIso = String(iso_code || '').trim() || control.primary_standard_code;

    if (
      effectiveIso &&
      Array.isArray(control.valid_for_standards) &&
      control.valid_for_standards.length > 0 &&
      !control.valid_for_standards.includes(effectiveIso)
    ) {
      return res.status(400).json({
        error: 'El control indicado no aplica a la norma seleccionada.',
      });
    }

    const existing = await client.query(
      `
      SELECT *
      FROM findings
      WHERE tenant_id = $1
        AND iso_code = $2
        AND LOWER(COALESCE(status,'')) <> 'cerrado'
        AND (
          tenant_control_id = $3
          OR tenant_control_id = $4::uuid
        )
      ORDER BY created_at DESC NULLS LAST, id DESC
      LIMIT 1
      `,
      [
        tenant_id,
        effectiveIso,
        control.controls_id_legacy || control.tenant_control_id,
        control.tenant_control_id,
      ]
    );

    if (existing.rowCount > 0) {
      return res.json({
        ok: true,
        already_exists: true,
        finding: existing.rows[0],
      });
    }

    const created = await client.query(
      `
      INSERT INTO findings (
        tenant_id,
        iso_code,
        title,
        description,
        finding_type,
        severity,
        status,
        source_type,
        tenant_control_id,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, 'observacion', 'media', 'abierto', 'manual', $5, $6, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        tenant_id,
        effectiveIso,
        'Hallazgo en control: ' + control.description,
        'Hallazgo generado desde Workbench de Controles para ' + control.description + '.',
        control.controls_id_legacy || control.tenant_control_id,
        getUserId(req.user),
      ]
    );

    return res.json({
      ok: true,
      already_exists: false,
      finding: created.rows[0],
    });
  } catch (err) {
    console.error('ERROR QUICK FINDING:', err);
    return res.status(500).json({
      error: 'Error creando/abriendo hallazgo',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// QUICK ACTION PLAN
// =====================================
router.post('/workbench/:tenant_control_id/quick-action-plan', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_control_id } = req.params;
    const { tenant_id, iso_code } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id es obligatorio' });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const control = await resolveControlRefs(client, tenant_id, tenant_control_id);

    if (!control) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const effectiveIso = String(iso_code || '').trim() || control.primary_standard_code;

    if (
      effectiveIso &&
      Array.isArray(control.valid_for_standards) &&
      control.valid_for_standards.length > 0 &&
      !control.valid_for_standards.includes(effectiveIso)
    ) {
      return res.status(400).json({
        error: 'El control indicado no aplica a la norma seleccionada.',
      });
    }

    const existing = await client.query(
      `
      SELECT *
      FROM action_plans ap
      WHERE ap.tenant_id = $1
        AND ($4::text IS NULL OR ap.iso_code = $4)
        AND (
          ap.tenant_control_id = $2
          OR ap.tenant_control_id = $3::uuid
          OR (ap.source_type = 'control' AND ap.source_id = $2)
          OR (ap.source_type = 'control' AND ap.source_id = $3::uuid)
        )
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(ap.status, '')) IN ('abierto', 'en progreso', 'bloqueado', 'pendiente', 'pendiente_aprobacion')
            THEN 0
          ELSE 1
        END,
        ap.updated_at DESC NULLS LAST,
        ap.created_at DESC NULLS LAST,
        ap.id DESC
      LIMIT 1
      `,
      [
        tenant_id,
        control.tenant_control_id,
        control.controls_id_legacy || null,
        effectiveIso || null,
      ]
    );

    if (existing.rowCount > 0) {
      return res.json({
        ok: true,
        already_exists: true,
        action_plan: existing.rows[0],
      });
    }

    const priority =
      String(control.declared_status || '').toLowerCase() === 'no cumple'
        ? 'alta'
        : String(control.declared_status || '').toLowerCase() === 'parcial'
        ? 'media'
        : 'media';

    const created = await client.query(
      `
      INSERT INTO action_plans (
        tenant_id,
        iso_code,
        title,
        description,
        priority,
        owner,
        status,
        source_type,
        tenant_control_id,
        source_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        '',
        'abierto',
        'control',
        $6,
        $7
      )
      RETURNING *
      `,
      [
        tenant_id,
        effectiveIso,
        `Plan de acción para control ${control.clause || ''}`.trim(),
        control.description || 'Plan generado automáticamente desde Controles.',
        priority,
        control.tenant_control_id,
        control.controls_id_legacy || control.tenant_control_id,
      ]
    );

    return res.json({
      ok: true,
      already_exists: false,
      action_plan: created.rows[0],
    });
  } catch (err) {
    console.error('ERROR QUICK ACTION PLAN:', err);
    return res.status(500).json({
      error: 'Error creando/abriendo plan de acción',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// CATÁLOGO
// =====================================
router.get('/catalog/:tenant_id/:iso', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, iso } = req.params;
    const requestedOperationId = String(req.query.operation_id || '').trim() || null;

    if (!canAccessTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const operation = await resolveScopedOperation(
      client,
      tenant_id,
      iso,
      requestedOperationId
    );

    const catalogMode = await getCatalogMode(tenant_id, iso);

    const controlsResult = await client.query(
      `
      WITH operation_scope AS (
        SELECT
          op.id,
          op.name
        FROM tenant_operations op
        WHERE op.id = $2
          AND op.tenant_id = $1
          AND op.is_active = TRUE
      ),
      candidate_controls AS (
        SELECT
          cc.id,
          $3::text AS iso,
          os.id AS operation_id,
          os.name AS operation_name,
          cc.iso AS primary_standard_code,
          COALESCE(rel.display_clause, cc.clause) AS clause,
          cc.category,
          cc.description,
          cc.source_type,
          cc.tenant_id,
          cc.base_control_id,
          cc.is_active,
          tc.id AS tenant_control_id,
          tc.status,
          base.description AS base_description,
          COALESCE(
            rel.valid_for_standards,
            CASE
              WHEN cc.iso IS NOT NULL THEN ARRAY[cc.iso]::text[]
              ELSE ARRAY[]::text[]
            END
          ) AS valid_for_standards,
          COALESCE(
            rel.also_valid_for,
            CASE
              WHEN cc.iso IS NOT NULL AND cc.iso <> $3 THEN ARRAY[cc.iso]::text[]
              ELSE ARRAY[]::text[]
            END
          ) AS also_valid_for,
          CASE
            WHEN cc.source_type = 'personalized' THEN 'personalized|' || cc.id::text
            ELSE md5(
              lower(regexp_replace(trim(coalesce(cc.description, '')), '\\s+', ' ', 'g'))
              || '||' ||
              lower(regexp_replace(trim(coalesce(cc.category, '')), '\\s+', ' ', 'g'))
              || '||' ||
              array_to_string(
                COALESCE(
                  rel.valid_for_standards,
                  CASE
                    WHEN cc.iso IS NOT NULL THEN ARRAY[cc.iso]::text[]
                    ELSE ARRAY[]::text[]
                  END
                ),
                ','
              )
            )
          END AS equivalence_key
        FROM controls_catalog cc
        CROSS JOIN operation_scope os
        LEFT JOIN tenant_controls tc
          ON tc.control_id = cc.id
         AND tc.tenant_id = $1
         AND tc.operation_id = $2
        LEFT JOIN controls_catalog base
          ON base.id = cc.base_control_id
        LEFT JOIN LATERAL (
          SELECT
            array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code) AS valid_for_standards,
            array_remove(
              array_agg(DISTINCT ccs.standard_code ORDER BY ccs.standard_code),
              $3::text
            ) AS also_valid_for,
            MAX(CASE WHEN ccs.standard_code = $3 THEN ccs.clause END) AS display_clause
          FROM controls_catalog_standards ccs
          WHERE ccs.control_id = cc.id
        ) rel ON TRUE
        WHERE cc.is_active = TRUE
          AND (
            ($4 = 'generic' AND cc.source_type = 'generic' AND cc.tenant_id IS NULL)
            OR
            ($4 = 'personalized' AND cc.source_type = 'personalized' AND cc.tenant_id = $1)
            OR
            ($4 = 'mixed' AND (
              (cc.source_type = 'generic' AND cc.tenant_id IS NULL)
              OR
              (cc.source_type = 'personalized' AND cc.tenant_id = $1)
            ))
          )
          AND (
            cc.iso = $3
            OR EXISTS (
              SELECT 1
              FROM controls_catalog_standards ccs_req
              WHERE ccs_req.control_id = cc.id
                AND ccs_req.standard_code = $3
            )
          )
      ),
      ranked_controls AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY equivalence_key
            ORDER BY
              CASE WHEN tenant_control_id IS NOT NULL THEN 0 ELSE 1 END,
              CASE WHEN primary_standard_code = $3 THEN 0 ELSE 1 END,
              id
          ) AS rn
        FROM candidate_controls
      )
      SELECT *
      FROM ranked_controls
      WHERE rn = 1
      ORDER BY
        clause NULLS LAST,
        category NULLS LAST,
        description
      `,
      [tenant_id, operation.id, iso, catalogMode]
    );

    const allRows = controlsResult.rows;
    const genericControls = allRows.filter((row) => row.source_type === 'generic');
    const personalizedControls = allRows.filter(
      (row) => row.source_type === 'personalized'
    );

    let effectiveControls = [];
    if (catalogMode === 'generic') {
      effectiveControls = genericControls;
    } else if (catalogMode === 'personalized') {
      effectiveControls = personalizedControls;
    } else {
      effectiveControls = [...genericControls, ...personalizedControls];
    }

    return res.json({
      operation,
      catalog_mode: catalogMode,
      generic_controls: genericControls,
      personalized_controls: personalizedControls,
      effective_controls: effectiveControls,
    });
  } catch (err) {
    console.error('ERROR GET CONTROL CATALOG:', err);
    return res.status(500).json({
      error: 'Error obteniendo catálogo de controles',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// HABILITAR CONTROL
// =====================================
router.post('/catalog/:control_id/enable', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { control_id } = req.params;
    const { tenant_id, operation_id, iso } = req.body;

    if (!tenant_id || !operation_id || !iso) {
      return res.status(400).json({
        error: 'tenant_id, operation_id e iso son obligatorios'
      });
    }

    if (!isUUID(control_id)) {
      return res.status(400).json({ error: 'control_id inválido' });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const operation = await resolveScopedOperation(client, tenant_id, iso, operation_id);
    const catalogMode = await getCatalogMode(tenant_id, iso);

    const catalogControl = await getCatalogControlForTenant(
      client,
      tenant_id,
      operation.id,
      iso,
      control_id,
      catalogMode
    );

    if (!catalogControl) {
      return res.status(404).json({
        error:
          'El control no existe, no está activo o no está disponible para esta empresa en la operación seleccionada.',
      });
    }

    if (catalogControl.tenant_control_id) {
      const existing = await pool.query(
        `
        SELECT *
        FROM tenant_controls
        WHERE id = $1
        LIMIT 1
        `,
        [catalogControl.tenant_control_id]
      );

      return res.json({
        ok: true,
        already_enabled: true,
        tenant_control: existing.rows[0] || null,
        control: catalogControl,
        operation,
      });
    }

    let tenantControl = await getTenantControlByCatalog(
      tenant_id,
      operation.id,
      catalogControl.id
    );
    const alreadyEnabled = Boolean(tenantControl);

    if (!tenantControl) {
      await ensureTenantControl(client, tenant_id, operation.id, catalogControl.id);
      tenantControl = await getTenantControlByCatalog(
        tenant_id,
        operation.id,
        catalogControl.id
      );
    }

    return res.json({
      ok: true,
      already_enabled: alreadyEnabled,
      tenant_control: tenantControl,
      control: catalogControl,
      operation,
    });
  } catch (err) {
    console.error('ERROR ENABLE CONTROL FROM CATALOG:', err);
    return res.status(500).json({
      error: 'Error habilitando control desde catálogo',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// DESHABILITAR CONTROL
// =====================================
router.post('/catalog/:control_id/disable', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { control_id } = req.params;
    const { tenant_id, operation_id } = req.body;

    if (!tenant_id || !operation_id) {
      return res.status(400).json({
        error: 'tenant_id y operation_id son obligatorios'
      });
    }

    if (!isUUID(control_id)) {
      return res.status(400).json({ error: 'control_id inválido' });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const tenantControl = await getTenantControlByCatalog(
      tenant_id,
      operation_id,
      control_id
    );

    if (!tenantControl) {
      return res.status(404).json({
        error: 'El control no está habilitado para esta operación.',
      });
    }

    const dependencyCheck = await getTenantControlDependencies(
      client,
      tenant_id,
      tenantControl.id
    );

    if (!dependencyCheck) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    if (dependencyCheck.hasDependencies) {
      return res.status(409).json({
        error:
          'No se puede deshabilitar este control porque ya tiene gestión asociada. Primero libera o cierra sus relaciones.',
        dependencies: dependencyCheck.dependencies,
        tenant_control_id: tenantControl.id,
        control_id,
      });
    }

    await client.query(
      `
      DELETE FROM tenant_controls
      WHERE id = $1
        AND tenant_id = $2
      `,
      [tenantControl.id, tenant_id]
    );

    return res.json({
      ok: true,
      disabled: true,
      tenant_control_id: tenantControl.id,
      control_id,
      dependencies: dependencyCheck.dependencies,
    });
  } catch (err) {
    console.error('ERROR DISABLE CONTROL FROM CATALOG:', err);
    return res.status(500).json({
      error: 'Error deshabilitando control desde catálogo',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// MODO CATÁLOGO
// =====================================
router.put('/catalog-mode/:tenant_id/:iso', auth, async (req, res) => {
  try {
    const { tenant_id, iso } = req.params;
    const { catalog_mode } = req.body;

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!['generic', 'personalized', 'mixed'].includes(catalog_mode)) {
      return res.status(400).json({ error: 'catalog_mode inválido' });
    }

    const result = await pool.query(
      `
      UPDATE tenant_standards
      SET catalog_mode = $1
      WHERE tenant_id = $2
        AND standard_code = $3
      RETURNING *
      `,
      [catalog_mode, tenant_id, iso]
    );

    return res.json({
      ok: true,
      updated: result.rows[0] || null,
    });
  } catch (err) {
    console.error('ERROR UPDATE CATALOG MODE:', err);
    return res.status(500).json({
      error: 'Error actualizando modo de catálogo',
      detail: err.message,
    });
  }
});

// =====================================
// CONTROL PERSONALIZADO NUEVO
// =====================================
router.post('/catalog/custom', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      tenant_id,
      iso,
      clause,
      category,
      description,
      valid_for_standards,
    } = req.body;

    if (!tenant_id || !iso || !description) {
      return res.status(400).json({
        error: 'tenant_id, iso y description son obligatorios',
      });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await client.query('BEGIN');

    const insertResult = await client.query(
      `
      INSERT INTO controls_catalog (
        tenant_id,
        iso,
        clause,
        category,
        description,
        source_type,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, 'personalized', TRUE)
      RETURNING *
      `,
      [
        tenant_id,
        iso,
        clause || null,
        category || null,
        description,
      ]
    );

    const created = insertResult.rows[0];

    const standardsToLink = new Set([
      iso,
      ...normalizeStandardsList(valid_for_standards),
    ]);

    for (const standardCode of standardsToLink) {
      await client.query(
        `
        INSERT INTO controls_catalog_standards (
          control_id,
          standard_code,
          clause,
          is_primary
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (control_id, standard_code)
        DO UPDATE SET
          clause = COALESCE(EXCLUDED.clause, controls_catalog_standards.clause),
          is_primary = controls_catalog_standards.is_primary OR EXCLUDED.is_primary,
          updated_at = NOW()
        `,
        [created.id, standardCode, clause || null, standardCode === iso]
      );
    }

    await client.query('COMMIT');

    return res.json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR CREATE CUSTOM CONTROL:', err);
    return res.status(500).json({
      error: 'Error creando control personalizado',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// COPIAR A PERSONALIZADO
// =====================================
router.post('/catalog/copy/:control_id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { control_id } = req.params;
    const {
      tenant_id,
      clause,
      category,
      description,
      valid_for_standards,
    } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id es obligatorio' });
    }

    if (!canManageControls(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const baseResult = await client.query(
      `
      SELECT *
      FROM controls_catalog
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [control_id]
    );

    if (baseResult.rowCount === 0) {
      return res.status(404).json({ error: 'Control base no encontrado' });
    }

    const base = baseResult.rows[0];

    await client.query('BEGIN');

    const insertResult = await client.query(
      `
      INSERT INTO controls_catalog (
        tenant_id,
        iso,
        clause,
        category,
        description,
        source_type,
        is_active,
        base_control_id
      )
      VALUES ($1, $2, $3, $4, $5, 'personalized', TRUE, $6)
      RETURNING *
      `,
      [
        tenant_id,
        base.iso,
        clause ?? base.clause,
        category ?? base.category,
        description ?? base.description,
        base.id,
      ]
    );

    const created = insertResult.rows[0];

    const baseStandards = await client.query(
      `
      SELECT standard_code, clause, is_primary
      FROM controls_catalog_standards
      WHERE control_id = $1
      `,
      [base.id]
    );

    const standardsMap = new Map();

    if (baseStandards.rowCount > 0) {
      for (const row of baseStandards.rows) {
        standardsMap.set(row.standard_code, {
          clause: row.standard_code === base.iso ? (clause ?? base.clause) : row.clause,
          is_primary: Boolean(row.is_primary),
        });
      }
    } else {
      standardsMap.set(base.iso, {
        clause: clause ?? base.clause,
        is_primary: true,
      });
    }

    for (const standardCode of normalizeStandardsList(valid_for_standards)) {
      if (!standardsMap.has(standardCode)) {
        standardsMap.set(standardCode, {
          clause: clause ?? base.clause,
          is_primary: false,
        });
      }
    }

    for (const [standardCode, values] of standardsMap.entries()) {
      await client.query(
        `
        INSERT INTO controls_catalog_standards (
          control_id,
          standard_code,
          clause,
          is_primary
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (control_id, standard_code)
        DO UPDATE SET
          clause = COALESCE(EXCLUDED.clause, controls_catalog_standards.clause),
          is_primary = controls_catalog_standards.is_primary OR EXCLUDED.is_primary,
          updated_at = NOW()
        `,
        [created.id, standardCode, values.clause, values.is_primary]
      );
    }

    await client.query('COMMIT');

    return res.json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR COPY CONTROL:', err);
    return res.status(500).json({
      error: 'Error copiando control',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// EDITAR PERSONALIZADO
// =====================================
router.put('/catalog/custom/:id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { clause, category, description, is_active, valid_for_standards } = req.body;

    const current = await client.query(
      `
      SELECT *
      FROM controls_catalog
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const row = current.rows[0];

    if (row.source_type !== 'personalized' || !row.tenant_id) {
      return res.status(400).json({
        error: 'Solo se pueden editar controles personalizados',
      });
    }

    if (!canManageControls(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `
      UPDATE controls_catalog
      SET
        clause = $1,
        category = $2,
        description = $3,
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [
        clause ?? row.clause,
        category ?? row.category,
        description ?? row.description,
        typeof is_active === 'boolean' ? is_active : null,
        id,
      ]
    );

    if (valid_for_standards !== undefined) {
      const normalized = new Set([
        row.iso,
        ...normalizeStandardsList(valid_for_standards),
      ]);

      await client.query(
        `
        DELETE FROM controls_catalog_standards
        WHERE control_id = $1
          AND standard_code <> ALL($2::text[])
        `,
        [id, Array.from(normalized)]
      );

      for (const standardCode of normalized) {
        await client.query(
          `
          INSERT INTO controls_catalog_standards (
            control_id,
            standard_code,
            clause,
            is_primary
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (control_id, standard_code)
          DO UPDATE SET
            clause = COALESCE(EXCLUDED.clause, controls_catalog_standards.clause),
            is_primary = EXCLUDED.is_primary,
            updated_at = NOW()
          `,
          [id, standardCode, clause ?? row.clause, standardCode === row.iso]
        );
      }
    } else {
      await client.query(
        `
        UPDATE controls_catalog_standards
        SET clause = $1,
            updated_at = NOW()
        WHERE control_id = $2
          AND standard_code = $3
        `,
        [clause ?? row.clause, id, row.iso]
      );
    }

    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR UPDATE CUSTOM CONTROL:', err);
    return res.status(500).json({
      error: 'Error actualizando control personalizado',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =====================================
// DESACTIVAR PERSONALIZADO
// =====================================
router.delete('/catalog/custom/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const current = await pool.query(
      `
      SELECT *
      FROM controls_catalog
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const row = current.rows[0];

    if (row.source_type !== 'personalized' || !row.tenant_id) {
      return res.status(400).json({
        error: 'Solo se pueden desactivar controles personalizados',
      });
    }

    if (!canManageControls(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await pool.query(
      `
      UPDATE controls_catalog
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('ERROR DELETE CUSTOM CONTROL:', err);
    return res.status(500).json({
      error: 'Error desactivando control personalizado',
      detail: err.message,
    });
  }
});

// =====================================
// LEGACY
// =====================================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!canAccessTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result = await pool.query(
      `
      SELECT id, clause, status, score
      FROM controls
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      `,
      [tenant_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR LEGACY GET CONTROLS:', err);
    return res.status(500).json({
      error: 'Error controls',
      detail: err.message,
    });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, score } = req.body;

    if (isAuditor(req)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const tenantId = getUserTenantId(req.user);

    const result = await pool.query(
      `
      UPDATE controls
      SET status = $1, score = $2
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
      `,
      [status, score, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR LEGACY UPDATE CONTROL:', err);
    return res.status(500).json({
      error: 'Error update control',
      detail: err.message,
    });
  }
});

module.exports = router;
