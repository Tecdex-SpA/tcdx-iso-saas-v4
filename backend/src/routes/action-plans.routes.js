const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireCommercialCapability } = require('../middleware/commercialEntitlement.middleware');
const aiContextBuilder = require('../services/aiContextBuilder.service');
const { runOperationalAiReview } = require('../services/aiOperationalReview.service');
const { resolveSoAControlReference } = require('../utils/soaControlResolver');
const {
  ACTIVE_CONTROL_REMEDIATION_STATUSES,
} = require('../services/actionPlanTraceability.service');

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

function isSuperAdmin(user) {
  const role = String(
    user?.role || user?.user_role || user?.userRole || ''
  ).toLowerCase();

  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(role);
}

const ensureTenantAccess = (req, tenantId) => {
  if (isSuperAdmin(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
};

const allowedPriorities = ['alta', 'media', 'baja'];
const allowedStatuses = [
  'abierto',
  'en progreso',
  'bloqueado',
  'completado',
  'cancelado',
];
const allowedSources = [
  'manual',
  'nonconformity',
  'risk',
  'audit',
  'control',
  'ia',
  'finding',
];
const allowedApprovalStatuses = [
  'no_requerida',
  'pendiente_aprobacion',
  'aprobada',
  'devuelta',
];
const requireActionsRead = requireCommercialCapability('iso.actions', {
  requiredPermission: 'actions.view',
  mode: 'read',
});
const requireActionsManage = requireCommercialCapability('iso.actions', {
  requiredPermission: 'actions.manage',
  mode: 'write',
});
const requireActionsApprove = requireCommercialCapability('iso.actions', {
  requiredPermission: 'actions.approve',
  mode: 'write',
});
const requireActionsDelete = requireCommercialCapability('iso.actions', {
  requiredPermission: 'actions.delete',
  mode: 'write',
});
const requireAiComplianceRead = requireCommercialCapability('ai.compliance', {
  requiredPermission: 'ai.view',
  mode: 'read',
});

const operationalStandardExistsSql = `
  EXISTS (
    SELECT 1
    FROM tenant_standards ts
    WHERE ts.tenant_id = $1
      AND ts.standard_code = $2
      AND ts.is_active = TRUE
      AND EXISTS (
        SELECT 1
        FROM tenant_standard_operations tso
        JOIN tenant_operations op
          ON op.id = tso.operation_id
         AND op.tenant_id = tso.tenant_id
         AND op.is_active = TRUE
        WHERE tso.tenant_id = ts.tenant_id
          AND tso.standard_code = ts.standard_code
          AND tso.is_active = TRUE
      )
  )
`;

async function ensureOperationalStandard(client, tenantId, standardCode) {
  return client.query(
    `
    SELECT 1
    WHERE ${operationalStandardExistsSql}
    LIMIT 1
    `,
    [tenantId, standardCode]
  );
}

async function ensureOperationalControlModern(
  client,
  tenantId,
  standardCode,
  tenantControlId
) {
  if (!tenantControlId || !tenantId || !standardCode) {
    return { rowCount: 0 };
  }

  return client.query(
    `
    SELECT 1
    FROM tenant_controls tc
    JOIN tenant_standard_operations tso
      ON tso.tenant_id = tc.tenant_id
     AND tso.standard_code = $2
     AND tso.operation_id = tc.operation_id
     AND tso.is_active = TRUE
    JOIN tenant_operations op
      ON op.id = tso.operation_id
     AND op.tenant_id = tso.tenant_id
     AND op.is_active = TRUE
    JOIN tenant_standards ts
      ON ts.tenant_id = tso.tenant_id
     AND ts.standard_code = tso.standard_code
     AND ts.is_active = TRUE
    WHERE tc.tenant_id = $1
      AND tc.id = $3
    LIMIT 1
    `,
    [tenantId, standardCode, tenantControlId]
  );
}

async function ensureActionPlanOperationalScope(client, actionPlanRow) {
  const standard = await ensureOperationalStandard(
    client,
    actionPlanRow.tenant_id,
    actionPlanRow.iso_code
  );

  if (standard.rowCount === 0) {
    return false;
  }

  if (!actionPlanRow.tenant_control_id) {
    return true;
  }

  const control = await ensureOperationalControlModern(
    client,
    actionPlanRow.tenant_id,
    actionPlanRow.iso_code,
    actionPlanRow.tenant_control_id
  );

  return control.rowCount > 0;
}

const getLinkedRecord = async (table, id) => {
  const map = {
    tenant_controls: `SELECT id, tenant_id FROM tenant_controls WHERE id = $1 LIMIT 1`,
    findings: `SELECT id, tenant_id FROM findings WHERE id = $1 LIMIT 1`,
    tenant_nonconformities: `SELECT id, tenant_id FROM tenant_nonconformities WHERE id = $1 LIMIT 1`,
    audits: `SELECT id, tenant_id FROM audits WHERE id = $1 LIMIT 1`,
    assets: `SELECT id, tenant_id FROM assets WHERE id = $1 LIMIT 1`,
  };

  if (!map[table]) {
    throw new Error(`Tabla no permitida: ${table}`);
  }

  return pool.query(map[table], [id]);
};

const inferSource = ({
  source_type,
  source_id,
  finding_id,
  nonconformity_id,
  audit_id,
  tenant_control_id,
  asset_id,
}) => {
  if (source_type && source_id) {
    return { source_type, source_id };
  }

  if (finding_id) return { source_type: 'finding', source_id: finding_id };
  if (nonconformity_id) {
    return { source_type: 'nonconformity', source_id: nonconformity_id };
  }
  if (audit_id) return { source_type: 'audit', source_id: audit_id };
  if (tenant_control_id) {
    return { source_type: 'control', source_id: tenant_control_id };
  }
  if (asset_id) return { source_type: 'risk', source_id: asset_id };

  return { source_type: 'manual', source_id: null };
};

function normalizeProgress(value, currentValue = 0, nextStatus = '') {
  const current = Math.max(0, Math.min(100, Number(currentValue) || 0));

  if (value === null || value === undefined || value === '') {
    if (nextStatus === 'completado') return 100;
    return current;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return current;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function getAutoTrackingComment(currentStatus, nextStatus) {
  if (nextStatus !== currentStatus) {
    if (nextStatus === 'en progreso') return 'Plan marcado como en progreso.';
    if (nextStatus === 'bloqueado') return 'Plan bloqueado.';
    if (nextStatus === 'completado') return 'Plan marcado como completado.';
    if (nextStatus === 'cancelado') return 'Plan cancelado.';
    if (nextStatus === 'abierto') return 'Plan actualizado a abierto.';
  }

  return 'Seguimiento actualizado.';
}

function isActiveControlRemediation({ sourceType, tenantControlId, isoCode, status }) {
  return (
    sourceType === 'control' &&
    Boolean(tenantControlId) &&
    Boolean(isoCode) &&
    ACTIVE_CONTROL_REMEDIATION_STATUSES.includes(status)
  );
}

async function findActiveControlRemediationPlan(
  client,
  { tenantId, tenantControlId, isoCode }
) {
  if (!tenantId || !tenantControlId || !isoCode) {
    return null;
  }

  const result = await client.query(
    `
    SELECT id
    FROM action_plans
    WHERE tenant_id = $1
      AND tenant_control_id = $2
      AND iso_code = $3
      AND source_type = 'control'
      AND status = ANY($4::text[])
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1
    `,
    [tenantId, tenantControlId, isoCode, ACTIVE_CONTROL_REMEDIATION_STATUSES]
  );

  return result.rows[0] || null;
}

function isActiveControlRemediationConflict(error) {
  return (
    error?.code === '23505' &&
    error?.constraint === 'uq_action_plans_one_active_control_remediation'
  );
}

/**
 * findings.tenant_control_id apunta a controls.id (legacy).
 * action_plans.tenant_control_id apunta a tenant_controls.id (moderno).
 *
 * Este helper traduce:
 * findings.tenant_control_id (controls.id legacy)
 * -> controls.catalog_control_id
 * -> tenant_controls.id del tenant actual
 */
const resolveModernTenantControlIdFromFinding = async (
  db,
  tenantId,
  findingId
) => {
  const result = await db.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno
    FROM findings f
    JOIN controls c
      ON c.id = f.tenant_control_id
    JOIN tenant_controls tc
      ON tc.tenant_id = f.tenant_id
     AND tc.control_id = c.catalog_control_id
    WHERE f.id = $1
      AND f.tenant_id = $2
    LIMIT 1
    `,
    [findingId, tenantId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0].tenant_control_id_moderno || null;
};

const enrichedActionPlansSelect = `
  SELECT
    ap.*,

    f.title AS finding_title,
    f.finding_type AS finding_type,
    f.severity AS finding_severity,

    nc.control_description AS nonconformity_title,
    nc.status AS nonconformity_status,

    a.iso AS audit_iso,
    a.start_date AS audit_start_date,
    a.end_date AS audit_end_date,
    a.auditor_name AS audit_auditor_name,
    a.auditor_type AS audit_auditor_type,

    ast.name AS asset_name,
    ast.type AS asset_type,
    ast.owner AS asset_owner,

    tc.status AS tenant_control_status,
    tc.operation_id AS tenant_control_operation_id,
    cc.iso AS control_iso,
    cc.clause AS control_clause,
    cc.description AS control_description,
    cc.category AS control_category,

    COALESCE(ev.evidence_count, 0) AS evidence_count,
    COALESCE(ev.approved_evidence_count, 0) AS approved_evidence_count,
    COALESCE(ev.pending_evidence_count, 0) AS pending_evidence_count,
    COALESCE(ev.rejected_evidence_count, 0) AS rejected_evidence_count,
    ev.latest_evidence_at,
    ev.latest_evidence_status,
    COALESCE(ev.evidences_json, '[]'::jsonb) AS evidences_json,

    COALESCE(upd.updates_count, 0) AS updates_count,
    upd.latest_update_at,
    COALESCE(
      upd.latest_progress_percent,
      CASE
        WHEN ap.status = 'completado' THEN 100
        WHEN ap.status = 'en progreso' THEN 50
        ELSE 0
      END
    )::int AS latest_progress_percent,
    upd.latest_update_comment,
    upd.latest_status_after,
    upd.latest_blocked_reason,
    COALESCE(upd.updates_json, '[]'::jsonb) AS updates_json,
    COALESCE(orig.origin_relations_json, '[]'::jsonb) AS origin_relations_json

  FROM action_plans ap
  LEFT JOIN findings f
    ON ap.finding_id = f.id
  LEFT JOIN tenant_nonconformities nc
    ON ap.nonconformity_id = nc.id
  LEFT JOIN audits a
    ON ap.audit_id = a.id
  LEFT JOIN assets ast
    ON ap.asset_id = ast.id
  LEFT JOIN tenant_controls tc
    ON ap.tenant_control_id = tc.id
  LEFT JOIN controls_catalog cc
    ON tc.control_id = cc.id

  LEFT JOIN LATERAL (
    WITH evidence_items AS (
      SELECT
        'evidence:' || e.id::text AS item_key,
        e.id,
        e.tenant_id,
        e.control_id,
        e.tenant_control_id,
        e.description,
        e.file_name,
        e.file_path,
        e.status,
        COALESCE(e.validated, false) AS validated,
        e.reviewed_by,
        e.reviewed_at,
        e.expires_at,
        e.evidence_type,
        e.rejection_reason,
        e.created_at,
        e.metadata->>'action_plan_id' AS action_plan_id,
        CASE
          WHEN e.metadata->>'action_plan_id' = ap.id::text THEN true
          ELSE false
        END AS linked_to_this_plan,
        false AS is_document_link,
        'evidence' AS source_type,
        e.id AS source_id,
        NULL::text AS evidence_usage
      FROM evidences e
      WHERE e.tenant_id = ap.tenant_id
        AND (
          e.metadata->>'action_plan_id' = ap.id::text
          OR (
            ap.tenant_control_id IS NOT NULL
            AND e.tenant_control_id = ap.tenant_control_id
          )
        )

      UNION ALL

      (
        SELECT DISTINCT ON (l.source_type, l.source_id, l.evidence_usage)
          l.source_type || ':' || l.source_id::text AS item_key,
          COALESCE(e_link.id, l.id) AS id,
          l.tenant_id,
          e_link.control_id,
          e_link.tenant_control_id,
          COALESCE(e_link.description, d.file_name, l.target_label, 'Evidencia documental') AS description,
          COALESCE(e_link.file_name, d.file_name, l.document_key, 'Documento') AS file_name,
          COALESCE(e_link.file_path, d.local_storage_path, d.file_url) AS file_path,
          CASE
            WHEN l.source_type = 'evidence' THEN COALESCE(e_link.status, l.status)
            ELSE COALESCE(l.status, 'active')
          END AS status,
          CASE
            WHEN l.source_type = 'evidence' THEN COALESCE(e_link.validated, false)
            ELSE false
          END AS validated,
          e_link.reviewed_by,
          COALESCE(e_link.reviewed_at, l.reviewed_at) AS reviewed_at,
          e_link.expires_at,
          COALESCE(e_link.evidence_type, l.evidence_usage) AS evidence_type,
          e_link.rejection_reason,
          COALESCE(e_link.created_at, l.reviewed_at, l.updated_at, l.created_at) AS created_at,
          ap.id::text AS action_plan_id,
          true AS linked_to_this_plan,
          true AS is_document_link,
          l.source_type,
          l.source_id,
          l.evidence_usage
        FROM tenant_document_object_links l
        LEFT JOIN evidences e_link
          ON l.source_type = 'evidence'
         AND e_link.tenant_id = l.tenant_id
         AND e_link.id = l.source_id
        LEFT JOIN document_index d
          ON l.source_type = 'document_index'
         AND d.tenant_id = l.tenant_id
         AND d.id = l.source_id
        WHERE l.tenant_id = ap.tenant_id
          AND l.target_type = 'action'
          AND l.target_id = ap.id
          AND l.is_active = true
          AND LOWER(COALESCE(l.status, 'active')) = 'active'
          AND LOWER(COALESCE(l.relation_type, 'associated')) = 'associated'
          AND l.evidence_usage IN (
            'action_evidence',
            'remediation_evidence',
            'supporting_evidence',
            'primary_evidence'
          )
        ORDER BY l.source_type, l.source_id, l.evidence_usage, COALESCE(l.reviewed_at, l.updated_at, l.created_at) DESC NULLS LAST
      )
    ),
    deduped_evidence AS (
      SELECT DISTINCT ON (item_key) *
      FROM evidence_items
      ORDER BY item_key, linked_to_this_plan DESC, is_document_link ASC, created_at DESC NULLS LAST
    )
    SELECT
      COUNT(*)::int AS evidence_count,

      COUNT(*) FILTER (
        WHERE linked_to_this_plan = true
      )::int AS direct_plan_evidence_count,

      COUNT(*) FILTER (
        WHERE ap.tenant_control_id IS NOT NULL
          AND tenant_control_id = ap.tenant_control_id
          AND linked_to_this_plan = false
      )::int AS control_context_evidence_count,

      COUNT(*) FILTER (
        WHERE (
          LOWER(COALESCE(status, '')) IN ('aprobada', 'aprobado', 'approved')
          OR validated = true
        )
      )::int AS approved_evidence_count,

      COUNT(*) FILTER (
        WHERE linked_to_this_plan = true
          AND (
            LOWER(COALESCE(status, '')) IN ('aprobada', 'aprobado', 'approved')
            OR validated = true
          )
      )::int AS approved_direct_plan_evidence_count,

      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) IN ('pendiente', 'pending', 'en revision', 'en revisión')
          OR (
            is_document_link = true
            AND COALESCE(validated, false) = false
            AND LOWER(COALESCE(status, '')) NOT IN ('aprobada', 'aprobado', 'approved', 'rechazada', 'rechazado', 'rejected')
          )
      )::int AS pending_evidence_count,

      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) IN ('rechazada', 'rechazado', 'rejected')
      )::int AS rejected_evidence_count,

      MAX(created_at) AS latest_evidence_at,

      (
        SELECT latest.status
        FROM deduped_evidence latest
        ORDER BY latest.created_at DESC NULLS LAST
        LIMIT 1
      ) AS latest_evidence_status,

      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'tenant_id', tenant_id,
          'control_id', control_id,
          'tenant_control_id', tenant_control_id,
          'description', description,
          'file_name', file_name,
          'file_path', file_path,
          'status', status,
          'validated', validated,
          'reviewed_by', reviewed_by,
          'reviewed_at', reviewed_at,
          'expires_at', expires_at,
          'evidence_type', evidence_type,
          'rejection_reason', rejection_reason,
          'created_at', created_at,
          'action_plan_id', action_plan_id,
          'linked_to_this_plan', linked_to_this_plan,
          'is_document_link', is_document_link,
          'source_type', source_type,
          'source_id', source_id,
          'evidence_usage', evidence_usage
        )
        ORDER BY created_at DESC
      ) FILTER (WHERE id IS NOT NULL) AS evidences_json

    FROM deduped_evidence
  ) ev ON TRUE

  LEFT JOIN LATERAL (
    SELECT
      COUNT(u.id)::int AS updates_count,
      MAX(u.created_at) AS latest_update_at,

      (
        SELECT u2.comment
        FROM action_plan_updates u2
        WHERE u2.action_plan_id = ap.id
        ORDER BY u2.created_at DESC
        LIMIT 1
      ) AS latest_update_comment,

      (
        SELECT u2.progress_percent
        FROM action_plan_updates u2
        WHERE u2.action_plan_id = ap.id
        ORDER BY u2.created_at DESC
        LIMIT 1
      ) AS latest_progress_percent,

      (
        SELECT u2.status_after
        FROM action_plan_updates u2
        WHERE u2.action_plan_id = ap.id
        ORDER BY u2.created_at DESC
        LIMIT 1
      ) AS latest_status_after,

      (
        SELECT u2.blocked_reason
        FROM action_plan_updates u2
        WHERE u2.action_plan_id = ap.id
        ORDER BY u2.created_at DESC
        LIMIT 1
      ) AS latest_blocked_reason,

      jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'action_plan_id', u.action_plan_id,
          'tenant_id', u.tenant_id,
          'comment', u.comment,
          'progress_percent', u.progress_percent,
          'status_after', u.status_after,
          'blocked_reason', u.blocked_reason,
          'created_by', u.created_by,
          'created_at', u.created_at,
          'updated_at', u.updated_at
        )
        ORDER BY u.created_at DESC
      ) FILTER (WHERE u.id IS NOT NULL) AS updates_json

    FROM action_plan_updates u
    WHERE u.action_plan_id = ap.id
  ) upd ON TRUE

  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'source_type', r.source_type,
        'source_id', r.source_id,
        'target_type', r.target_type,
        'target_id', r.target_id,
        'relation_type', r.relation_type,
        'status', r.status,
        'provenance', r.provenance,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      ORDER BY r.source_type, r.source_id
    ) FILTER (WHERE r.id IS NOT NULL) AS origin_relations_json
    FROM grc_phase2_relations r
    WHERE r.tenant_id = ap.tenant_id
      AND r.target_type = 'action'
      AND r.target_id = ap.id
      AND r.relation_type = 'originates_action'
      AND r.status = 'active'
      AND r.valid_to IS NULL
  ) orig ON TRUE
`;

const getEnrichedActionPlanById = async (client, id) => {
  return client.query(
    `
    ${enrichedActionPlansSelect}
    WHERE ap.id = $1
    LIMIT 1
    `,
    [id]
  );
};

// =============================
// 📋 OBTENER SEGUIMIENTOS DE UN PLAN
// =============================
router.get('/:id/updates', auth, requireActionsRead, async (req, res) => {
  try {
    const { id } = req.params;

    const current = await getEnrichedActionPlanById(pool, id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const inScope = await ensureActionPlanOperationalScope(pool, row);
    if (!inScope) {
      return res.status(400).json({
        error: 'El plan ya no pertenece al alcance operativo activo de esta empresa',
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM action_plan_updates
      WHERE action_plan_id = $1
      ORDER BY created_at DESC
      `,
      [id]
    );

    return res.json({
      ok: true,
      data: result.rows,
      action_plan: row,
    });
  } catch (err) {
    console.error('ERROR GET ACTION PLAN UPDATES:', err);
    return res
      .status(500)
      .json({ error: 'Error obteniendo seguimientos', detail: err.message });
  }
});

// =============================
// ➕ REGISTRAR SEGUIMIENTO DE PLAN
// =============================
router.post('/:id/updates', auth, requireActionsManage, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { comment, progress_percent, status_after, blocked_reason } =
      req.body || {};

    const current = await getEnrichedActionPlanById(client, id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const inScope = await ensureActionPlanOperationalScope(client, row);
    if (!inScope) {
      return res.status(400).json({
        error: 'El plan ya no pertenece al alcance operativo activo de esta empresa',
      });
    }

    const finalComment = String(comment || '').trim();

    if (!finalComment) {
      return res.status(400).json({ error: 'comment es obligatorio' });
    }

    const nextStatus = status_after || row.status;

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: 'status_after inválido' });
    }

    const blockedReasonText = String(blocked_reason || '').trim() || null;

    if (nextStatus === 'bloqueado' && !blockedReasonText) {
      return res.status(400).json({
        error: 'blocked_reason es obligatorio cuando el plan queda bloqueado',
      });
    }

    const finalProgress = normalizeProgress(
      progress_percent,
      row.latest_progress_percent || 0,
      nextStatus
    );

    let nextApprovalStatus = row.approval_status;

    if (
      nextStatus !== 'completado' &&
      ['pendiente_aprobacion', 'aprobada'].includes(row.approval_status)
    ) {
      nextApprovalStatus = 'no_requerida';
    }

    await client.query('BEGIN');

    if (!allowedApprovalStatuses.includes(nextApprovalStatus)) {
      nextApprovalStatus = 'no_requerida';
    }

    if (
      nextStatus !== row.status ||
      nextApprovalStatus !== row.approval_status
    ) {
      const completedAt =
        nextStatus === 'completado' ? row.completed_at || new Date() : null;

      await client.query(
        `
        UPDATE action_plans
        SET
          status = $1,
          completed_at = $2,
          approval_status = $3,
          updated_at = NOW()
        WHERE id = $4
        `,
        [nextStatus, completedAt, nextApprovalStatus, id]
      );

      if (nextStatus === 'completado') {
        if (row.finding_id) {
          await client.query(
            `
            UPDATE findings
            SET status = 'cerrado',
                closed_at = COALESCE(closed_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
              AND status != 'cerrado'
            `,
            [row.finding_id]
          );
        }

        if (row.nonconformity_id) {
          await client.query(
            `
            UPDATE tenant_nonconformities
            SET status = 'pendiente_aprobacion'
            WHERE id = $1
              AND status != 'resuelta'
            `,
            [row.nonconformity_id]
          );
        }
      }
    }

    const insertResult = await client.query(
      `
      INSERT INTO action_plan_updates (
        action_plan_id,
        tenant_id,
        comment,
        progress_percent,
        status_after,
        blocked_reason,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        id,
        row.tenant_id,
        finalComment,
        finalProgress,
        nextStatus,
        blockedReasonText,
        getUserId(req.user),
      ]
    );

    const actionPlanResult = await getEnrichedActionPlanById(client, id);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      update: insertResult.rows[0],
      action_plan: actionPlanResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR CREATE ACTION PLAN UPDATE:', err);
    return res
      .status(500)
      .json({ error: 'Error registrando seguimiento', detail: err.message });
  } finally {
    client.release();
  }
});

// =============================
// ✅ SOLICITAR APROBACIÓN DE CIERRE
// =============================
router.post('/:id/request-approval', auth, requireActionsManage, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { comment } = req.body || {};

    const current = await getEnrichedActionPlanById(client, id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const inScope = await ensureActionPlanOperationalScope(client, row);
    if (!inScope) {
      return res.status(400).json({
        error: 'El plan ya no pertenece al alcance operativo activo de esta empresa',
      });
    }

    if (row.status !== 'completado') {
      return res.status(400).json({
        error: 'Solo se puede solicitar aprobación para planes completados',
      });
    }

    if (row.approval_status === 'pendiente_aprobacion') {
      return res.status(400).json({
        error: 'El plan ya está pendiente de aprobación',
      });
    }

    if (row.approval_status === 'aprobada') {
      return res.status(400).json({
        error: 'El plan ya fue aprobado',
      });
    }

    if (Number(row.approved_direct_plan_evidence_count || 0) <= 0) {
      return res.status(400).json({
        error:
          'Debes contar con al menos una evidencia directa del plan aprobada para solicitar aprobación',
      });
    }

    const requestComment =
      String(comment || '').trim() || 'Cierre enviado a aprobación.';

    await client.query('BEGIN');

    await client.query(
      `
      UPDATE action_plans
      SET
        approval_status = 'pendiente_aprobacion',
        approval_requested_at = NOW(),
        approval_requested_by = $1,
        approval_reviewed_at = NULL,
        approval_reviewed_by = NULL,
        approval_comment = $2,
        updated_at = NOW()
      WHERE id = $3
      `,
      [getUserId(req.user), requestComment, id]
    );

    await client.query(
      `
      INSERT INTO action_plan_updates (
        action_plan_id,
        tenant_id,
        comment,
        progress_percent,
        status_after,
        blocked_reason,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        id,
        row.tenant_id,
        requestComment,
        100,
        'completado',
        null,
        getUserId(req.user),
      ]
    );

    const result = await getEnrichedActionPlanById(client, id);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR REQUEST APPROVAL ACTION PLAN:', err);
    return res.status(500).json({
      error: 'Error solicitando aprobación del cierre',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

// =============================
// 👨‍⚖️ REVISAR APROBACIÓN DE CIERRE
// decision: approved | rework
// =============================
router.post('/:id/review-approval', auth, requireActionsApprove, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { decision, comment } = req.body || {};

    const current = await getEnrichedActionPlanById(client, id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const inScope = await ensureActionPlanOperationalScope(client, row);
    if (!inScope) {
      return res.status(400).json({
        error: 'El plan ya no pertenece al alcance operativo activo de esta empresa',
      });
    }

    if (row.approval_status !== 'pendiente_aprobacion') {
      return res.status(400).json({
        error: 'El plan no está pendiente de aprobación',
      });
    }

    if (!['approved', 'rework'].includes(String(decision || ''))) {
      return res.status(400).json({
        error: 'decision inválida. Usa approved o rework',
      });
    }

    const reviewComment = String(comment || '').trim();

    if (decision === 'rework' && !reviewComment) {
      return res.status(400).json({
        error: 'Debes indicar un comentario al devolver a corrección',
      });
    }

    await client.query('BEGIN');

    if (decision === 'approved') {
      const finalComment = reviewComment || 'Cierre aprobado.';

      await client.query(
        `
        UPDATE action_plans
        SET
          status = 'completado',
          completed_at = COALESCE(completed_at, NOW()),
          approval_status = 'aprobada',
          approval_reviewed_at = NOW(),
          approval_reviewed_by = $1,
          approval_comment = $2,
          updated_at = NOW()
        WHERE id = $3
        `,
        [getUserId(req.user), finalComment, id]
      );

      await client.query(
        `
        INSERT INTO action_plan_updates (
          action_plan_id,
          tenant_id,
          comment,
          progress_percent,
          status_after,
          blocked_reason,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          id,
          row.tenant_id,
          finalComment,
          100,
          'completado',
          null,
          getUserId(req.user),
        ]
      );
    }

    if (decision === 'rework') {
      await client.query(
        `
        UPDATE action_plans
        SET
          status = 'en progreso',
          completed_at = NULL,
          approval_status = 'devuelta',
          approval_reviewed_at = NOW(),
          approval_reviewed_by = $1,
          approval_comment = $2,
          updated_at = NOW()
        WHERE id = $3
        `,
        [getUserId(req.user), reviewComment, id]
      );

      await client.query(
        `
        INSERT INTO action_plan_updates (
          action_plan_id,
          tenant_id,
          comment,
          progress_percent,
          status_after,
          blocked_reason,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          id,
          row.tenant_id,
          reviewComment,
          Math.max(Number(row.latest_progress_percent || 0), 60),
          'en progreso',
          null,
          getUserId(req.user),
        ]
      );
    }

    const result = await getEnrichedActionPlanById(client, id);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR REVIEW APPROVAL ACTION PLAN:', err);
    return res.status(500).json({
      error: 'Error revisando aprobación del cierre',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

router.post('/:id/ai-review', auth, requireActionsRead, requireAiComplianceRead, async (req, res) => {
  try {
    const actionPlanId = req.params.id;
    const requestedTenantId = req.body?.tenant_id || req.query?.tenant_id || getUserTenantId(req.user);

    if (!requestedTenantId) {
      return res.status(400).json({ ok: false, error: 'tenant_id requerido' });
    }

    if (!ensureTenantAccess(req, requestedTenantId)) {
      return res.status(403).json({ ok: false, error: 'No autorizado para este tenant' });
    }

    const planResult = await pool.query(
      `
      SELECT *
      FROM action_plans
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [actionPlanId, requestedTenantId]
    );

    if (planResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Plan de acción no encontrado' });
    }

    const plan = planResult.rows[0];
    const tenantId = requestedTenantId;

    const context = plan.tenant_control_id
      ? await aiContextBuilder.buildAiControlContext({
          tenantId,
          tenantControlId: plan.tenant_control_id,
          standardCode: req.body?.standard_code || plan.standard_code || null,
          operationId: req.body?.operation_id || plan.operation_id || null,
        })
      : await aiContextBuilder.buildAiActionPlanContext({ tenantId, actionPlanId });

    context.scope.action_plan_id = actionPlanId;
    context.recent_action_plans = [plan, ...(context.recent_action_plans || [])].slice(0, 10);

    const aiResult = await runOperationalAiReview({
      tenantId,
      moduleOrigin: 'plan-accion',
      taskType: 'action_plan_review',
      context,
      body: req.body || {},
      entityLabel: `plan de acción ${plan.title || actionPlanId}`,
      defaultQuestion: 'Evalúa si este plan de acción es suficiente, qué evidencia requiere y qué criterios de cierre debe cumplir.',
    });

    return res.json({
      ...aiResult,
      tenant_id: tenantId,
      action_plan_id: actionPlanId,
    });
  } catch (err) {
    console.error('ERROR ACTION PLAN AI REVIEW:', err);
    return res.status(500).json({ ok: false, error: 'Error ejecutando revisión IA de plan de acción' });
  }
});

// =============================
// 📋 LISTAR PLANES
// solo alcance operativo real
// =============================
router.get('/:tenant_id', auth, requireActionsRead, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { iso, status } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    let query = `
      WITH enriched AS (
        ${enrichedActionPlansSelect}
        JOIN tenant_standards ts
          ON ts.tenant_id = ap.tenant_id
         AND ts.standard_code = ap.iso_code
        WHERE ap.tenant_id = $1
          AND ts.is_active = TRUE
          AND EXISTS (
            SELECT 1
            FROM tenant_standard_operations tso_any
            JOIN tenant_operations op_any
              ON op_any.id = tso_any.operation_id
             AND op_any.tenant_id = tso_any.tenant_id
             AND op_any.is_active = TRUE
            WHERE tso_any.tenant_id = ap.tenant_id
              AND tso_any.standard_code = ap.iso_code
              AND tso_any.is_active = TRUE
          )
          AND (
            ap.tenant_control_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM tenant_controls tc_scope
              JOIN tenant_standard_operations tso_scope
                ON tso_scope.tenant_id = tc_scope.tenant_id
               AND tso_scope.standard_code = ap.iso_code
               AND tso_scope.operation_id = tc_scope.operation_id
               AND tso_scope.is_active = TRUE
              JOIN tenant_operations op_scope
                ON op_scope.id = tso_scope.operation_id
               AND op_scope.tenant_id = tso_scope.tenant_id
               AND op_scope.is_active = TRUE
              WHERE tc_scope.id = ap.tenant_control_id
                AND tc_scope.tenant_id = ap.tenant_id
            )
          )
      )
      SELECT *
      FROM enriched
      WHERE 1=1
    `;

    const params = [tenant_id];
    let idx = 2;

    if (iso) {
      query += ` AND iso_code = $${idx}`;
      params.push(iso);
      idx++;
    }

    if (status) {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET ACTION PLANS:', err);
    return res.status(500).json({
      error: 'Error obteniendo planes de acción',
    });
  }
});

// =============================
// ➕ CREAR PLAN
// =============================
router.post('/', auth, requireActionsManage, async (req, res) => {
  const client = await pool.connect();
  let controlRemediationDedupe = null;

  try {
    let {
      tenant_id,
      iso_code,
      title,
      description,
      source_type,
      source_id,
      priority,
      status,
      owner,
      due_date,
      tenant_control_id,
      finding_id,
      nonconformity_id,
      audit_id,
      asset_id,
    } = req.body;

    if (!tenant_id || !title) {
      return res
        .status(400)
        .json({ error: 'tenant_id y title son obligatorios' });
    }

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (tenant_control_id) {
      const resolvedControl = await resolveSoAControlReference(
        client,
        tenant_id,
        tenant_control_id,
        iso_code
      );

      if (!resolvedControl) {
        return res
          .status(400)
          .json({ error: 'No se pudo resolver el control asociado al plan de acción para este tenant' });
      }

      if (resolvedControl.iso_mismatch) {
        return res
          .status(400)
          .json({ error: 'El control asociado no pertenece a la norma ISO seleccionada' });
      }

      if (!resolvedControl.tenant_control_id_moderno) {
        return res
          .status(400)
          .json({ error: 'El control no tiene tenant_controls.id resoluble para este tenant' });
      }

      tenant_control_id = resolvedControl.tenant_control_id_moderno;
      if (!iso_code) iso_code = resolvedControl.iso;
    }

    if (finding_id) {
      const linked = await getLinkedRecord('findings', finding_id);
      if (
        linked.rowCount === 0 ||
        String(linked.rows[0].tenant_id) !== String(tenant_id)
      ) {
        return res
          .status(400)
          .json({ error: 'finding_id inválido para este tenant' });
      }

      if (!iso_code) {
        const findingResult = await client.query(
          `
          SELECT iso_code
          FROM findings
          WHERE id = $1
          LIMIT 1
          `,
          [finding_id]
        );

        if (findingResult.rowCount > 0) {
          iso_code = findingResult.rows[0].iso_code;
        }
      }

      if (!tenant_control_id) {
        tenant_control_id = await resolveModernTenantControlIdFromFinding(
          client,
          tenant_id,
          finding_id
        );
      }

      if (!tenant_control_id) {
        return res.status(400).json({
          error:
            'El hallazgo no tiene un control vinculado. Debes asociar el hallazgo a un control antes de crear el plan de acción.',
        });
      }
    }

    if (nonconformity_id) {
      const linked = await getLinkedRecord(
        'tenant_nonconformities',
        nonconformity_id
      );
      if (
        linked.rowCount === 0 ||
        String(linked.rows[0].tenant_id) !== String(tenant_id)
      ) {
        return res
          .status(400)
          .json({ error: 'nonconformity_id inválido para este tenant' });
      }
    }

    if (audit_id) {
      const linked = await getLinkedRecord('audits', audit_id);
      if (
        linked.rowCount === 0 ||
        String(linked.rows[0].tenant_id) !== String(tenant_id)
      ) {
        return res
          .status(400)
          .json({ error: 'audit_id inválido para este tenant' });
      }
    }

    if (asset_id) {
      const linked = await getLinkedRecord('assets', asset_id);
      if (
        linked.rowCount === 0 ||
        String(linked.rows[0].tenant_id) !== String(tenant_id)
      ) {
        return res
          .status(400)
          .json({ error: 'asset_id inválido para este tenant' });
      }
    }

    if (!iso_code) {
      return res.status(400).json({ error: 'iso_code es obligatorio' });
    }

    const activeStandard = await ensureOperationalStandard(
      client,
      tenant_id,
      iso_code
    );

    if (activeStandard.rowCount === 0) {
      return res.status(400).json({
        error:
          'La norma seleccionada no está dentro del alcance operativo activo de esta empresa',
      });
    }

    if (tenant_control_id) {
      const activeControl = await ensureOperationalControlModern(
        client,
        tenant_id,
        iso_code,
        tenant_control_id
      );

      if (activeControl.rowCount === 0) {
        return res.status(400).json({
          error:
            'El control asociado no pertenece al alcance operativo activo de la norma seleccionada',
        });
      }
    }

    const finalPriority = priority || 'media';
    const finalStatus = status || 'abierto';

    if (!allowedPriorities.includes(finalPriority)) {
      return res.status(400).json({ error: 'priority inválida' });
    }

    if (!allowedStatuses.includes(finalStatus)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    const source = inferSource({
      source_type,
      source_id,
      finding_id,
      nonconformity_id,
      audit_id,
      tenant_control_id,
      asset_id,
    });

    if (!allowedSources.includes(source.source_type)) {
      return res.status(400).json({ error: 'source_type inválido' });
    }

    controlRemediationDedupe = {
      tenantId: tenant_id,
      tenantControlId: tenant_control_id || null,
      isoCode: iso_code,
      sourceType: source.source_type,
      status: finalStatus,
    };

    await client.query('BEGIN');

    if (isActiveControlRemediation(controlRemediationDedupe)) {
      const reusablePlan = await findActiveControlRemediationPlan(
        client,
        controlRemediationDedupe
      );

      if (reusablePlan) {
        const result = await getEnrichedActionPlanById(client, reusablePlan.id);

        await client.query('COMMIT');

        return res.json({
          ...result.rows[0],
          ok: true,
          already_exists: true,
          idempotency: 'active_control_remediation_reused',
        });
      }
    }

    const insertResult = await client.query(
      `
      INSERT INTO action_plans (
        tenant_id,
        iso_code,
        title,
        description,
        source_type,
        source_id,
        priority,
        status,
        owner,
        due_date,
        created_by,
        tenant_control_id,
        finding_id,
        nonconformity_id,
        audit_id,
        asset_id,
        approval_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'no_requerida')
      RETURNING id
      `,
      [
        tenant_id,
        iso_code,
        title,
        description || null,
        source.source_type,
        source.source_id,
        finalPriority,
        finalStatus,
        owner || null,
        due_date || null,
        getUserId(req.user),
        tenant_control_id || null,
        finding_id || null,
        nonconformity_id || null,
        audit_id || null,
        asset_id || null,
      ]
    );

    await client.query(
      `
      INSERT INTO action_plan_updates (
        action_plan_id,
        tenant_id,
        comment,
        progress_percent,
        status_after,
        blocked_reason,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        insertResult.rows[0].id,
        tenant_id,
        'Plan creado.',
        normalizeProgress(null, 0, finalStatus),
        finalStatus,
        null,
        getUserId(req.user),
      ]
    );

    const result = await getEnrichedActionPlanById(
      client,
      insertResult.rows[0].id
    );

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');

    if (
      isActiveControlRemediationConflict(err) &&
      isActiveControlRemediation(controlRemediationDedupe)
    ) {
      const reusablePlan = await findActiveControlRemediationPlan(
        pool,
        controlRemediationDedupe
      );

      if (reusablePlan) {
        const result = await getEnrichedActionPlanById(pool, reusablePlan.id);
        return res.json({
          ...result.rows[0],
          ok: true,
          already_exists: true,
          idempotency: 'active_control_remediation_reused_after_conflict',
        });
      }

      return res.status(409).json({
        ok: false,
        code: 'ACTIVE_CONTROL_REMEDIATION_CONFLICT',
        error:
          'Ya existe una remediación activa para este control y norma. Revisa el plan activo antes de crear otro.',
      });
    }

    console.error('ERROR CREATE ACTION PLAN:', err);
    return res
      .status(500)
      .json({ error: 'Error creando plan de acción' });
  } finally {
    client.release();
  }
});

// =============================
// ✏️ ACTUALIZAR PLAN
// =============================
router.put('/:id', auth, requireActionsManage, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      title,
      description,
      priority,
      status,
      owner,
      due_date,
      tracking_comment,
      progress_percent,
      blocked_reason,
    } = req.body || {};

    const current = await getEnrichedActionPlanById(client, id);

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const inScope = await ensureActionPlanOperationalScope(client, row);
    if (!inScope) {
      return res.status(400).json({
        error: 'El plan ya no pertenece al alcance operativo activo de esta empresa',
      });
    }

    const finalPriority = priority ?? row.priority;
    const nextStatus = status ?? row.status;

    if (!allowedPriorities.includes(finalPriority)) {
      return res.status(400).json({ error: 'priority inválida' });
    }

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    const blockedReasonText = String(blocked_reason || '').trim() || null;

    if (nextStatus === 'bloqueado' && !blockedReasonText) {
      return res.status(400).json({
        error: 'blocked_reason es obligatorio cuando el plan queda bloqueado',
      });
    }

    const shouldCreateTracking =
      String(tracking_comment || '').trim() !== '' ||
      (progress_percent !== undefined && progress_percent !== null) ||
      blockedReasonText !== null ||
      nextStatus !== row.status;

    const finalComment =
      String(tracking_comment || '').trim() ||
      getAutoTrackingComment(row.status, nextStatus);

    const finalProgress = normalizeProgress(
      progress_percent,
      row.latest_progress_percent || 0,
      nextStatus
    );

    let nextApprovalStatus = row.approval_status;

    if (
      nextStatus !== 'completado' &&
      ['pendiente_aprobacion', 'aprobada'].includes(row.approval_status)
    ) {
      nextApprovalStatus = 'no_requerida';
    }

    if (!allowedApprovalStatuses.includes(nextApprovalStatus)) {
      nextApprovalStatus = 'no_requerida';
    }

    const completedAt =
      nextStatus === 'completado' ? row.completed_at || new Date() : null;

    await client.query('BEGIN');

    await client.query(
      `
      UPDATE action_plans
      SET
        title = $1,
        description = $2,
        priority = $3,
        status = $4,
        owner = $5,
        due_date = $6,
        completed_at = $7,
        approval_status = $8,
        updated_at = NOW()
      WHERE id = $9
      `,
      [
        title ?? row.title,
        description ?? row.description,
        finalPriority,
        nextStatus,
        owner ?? row.owner,
        due_date ?? row.due_date,
        completedAt,
        nextApprovalStatus,
        id,
      ]
    );

    if (nextStatus === 'completado') {
      if (row.finding_id) {
        await client.query(
          `
          UPDATE findings
          SET status = 'cerrado',
              closed_at = COALESCE(closed_at, NOW()),
              updated_at = NOW()
          WHERE id = $1
            AND status != 'cerrado'
          `,
          [row.finding_id]
        );
      }

      if (row.nonconformity_id) {
        await client.query(
          `
          UPDATE tenant_nonconformities
          SET status = 'pendiente_aprobacion'
          WHERE id = $1
            AND status != 'resuelta'
          `,
          [row.nonconformity_id]
        );
      }
    }

    if (shouldCreateTracking) {
      await client.query(
        `
        INSERT INTO action_plan_updates (
          action_plan_id,
          tenant_id,
          comment,
          progress_percent,
          status_after,
          blocked_reason,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          id,
          row.tenant_id,
          finalComment,
          finalProgress,
          nextStatus,
          blockedReasonText,
          getUserId(req.user),
        ]
      );
    }

    const result = await getEnrichedActionPlanById(client, id);

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR UPDATE ACTION PLAN:', err);
    return res.status(500).json({
      error: 'Error actualizando plan de acción',
    });
  } finally {
    client.release();
  }
});

// =============================
// 🗑️ ELIMINAR PLAN
// =============================
router.delete('/:id', auth, requireActionsDelete, async (req, res) => {
  try {
    const { id } = req.params;

    const current = await pool.query(
      `
      SELECT *
      FROM action_plans
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const row = current.rows[0];

    if (!ensureTenantAccess(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const inScope = await ensureActionPlanOperationalScope(pool, row);
    if (!inScope) {
      return res.status(400).json({
        error: 'El plan ya no pertenece al alcance operativo activo de esta empresa',
      });
    }

    await pool.query(`DELETE FROM action_plans WHERE id = $1`, [id]);

    return res.json({ success: true });
  } catch (err) {
    console.error('ERROR DELETE ACTION PLAN:', err);
    return res.status(500).json({
      error: 'Error eliminando plan de acción',
      detail: err.message,
    });
  }
});

module.exports = router;
