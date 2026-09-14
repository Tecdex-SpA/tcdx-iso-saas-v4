const {
  isAreaOwnerUser,
  isPlatformUser,
  isTenantAdminUser,
} = require('../services/auth/roleCompatibility.service');

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireCommercialCapability } = require('../middleware/commercialEntitlement.middleware');
const { resolveLocale } = require('../utils/locale');
const { insertActionPlan } = require('../utils/actionPlanPersistence');

const requireAiComplianceRead = requireCommercialCapability('ai.compliance', {
  requiredPermission: 'ai.view',
  mode: 'read',
});
const requireActionsManage = requireCommercialCapability('iso.actions', {
  requiredPermission: 'actions.manage',
  mode: 'write',
});

// =============================
// 🔐 VALIDADOR UUID
// =============================
const isUUID = (str) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

const ensureTenantAccess = (req, tenantId) => {
  if (isPlatformUser(req.user)) return true;
  return req.user?.tenant_id === tenantId;
};

const canCreateAiActionDraft = (user) => {
  return isPlatformUser(user) || isTenantAdminUser(user) || isAreaOwnerUser(user);
};

const getUserId = (user) => user?.user_id || user?.userId || user?.id || null;

const priorityForStatus = (status) => {
  if (status === 'no cumple') return 'alta';
  if (status === 'parcial' || status === 'pendiente') return 'media';
  return 'baja';
};

const auditorExplanationForStatus = (status) => {
  if (status === 'no cumple') {
    return 'El control no se encuentra implementado, lo que representa un riesgo significativo y requiere acción inmediata.';
  }
  if (status === 'parcial') {
    return 'El control está parcialmente implementado, pero necesita fortalecerse para cumplir completamente con la norma.';
  }
  if (status === 'pendiente') {
    return 'El control aún no ha sido evaluado o implementado formalmente, por lo que requiere revisión prioritaria.';
  }
  return 'El control está implementado correctamente, pero debe mantenerse bajo monitoreo continuo.';
};

// =============================
// ✅ IA RECOMMENDATIONS
// Solo normas activas + tenant_controls
// =============================
router.get('/recommendations/:tenant_id', auth, requireAiComplianceRead, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const { tenant_id } = req.params;

    if (!isUUID(tenant_id)) {
      return res.status(400).json({ error: 'tenant_id inválido' });
    }

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT ON (tc.id)
        tc.id AS tenant_control_id,
        tc.tenant_id,
        cc.id AS catalog_control_id,
        cc.iso,
        cc.clause,
        COALESCE(cc.category, '') AS category,
        COALESCE(cc.description, 'Control sin información') AS description,
        COALESCE(NULLIF(tc.status, ''), 'pendiente') AS status,
        COALESCE(g.accion, 'Implementar el control, definir responsables y documentar el proceso.') AS accion,
        COALESCE(g.evidencia, 'Generar evidencia documentada.') AS evidencia
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON tc.control_id = cc.id
      JOIN tenant_standards ts
        ON ts.tenant_id = tc.tenant_id
       AND ts.standard_code = cc.iso
      LEFT JOIN iso_clause_guides g
        ON g.iso = cc.iso
       AND (
         g.clause = cc.clause
         OR g.clause LIKE cc.clause || '%'
       )
      WHERE tc.tenant_id = $1
        AND ts.is_active = TRUE
        AND cc.is_active = TRUE
      ORDER BY tc.id, g.clause
      `,
      [tenant_id]
    );

    const response = result.rows.map((c) => {
      return {
        tenant_control_id: c.tenant_control_id,
        tenant_id: c.tenant_id,
        iso: c.iso || 'N/A',
        clause: c.clause || '-',
        category: c.category || '',
        description: c.description || 'Control sin información',
        prioridad: priorityForStatus(c.status),
        accion: c.accion,
        evidencia: c.evidencia,
        catalog_control_id: c.catalog_control_id,
        auditor_explicacion: auditorExplanationForStatus(c.status)
      };
    });

    res.json(response);

  } catch (err) {
    console.error('ERROR IA:', err);
    res.status(500).json({ error: 'Error IA recommendations' });
  }
});

// =============================
// 🔥 APPLY IA LEGACY
// Compatibilidad: ya no aplica cambios directos; crea un borrador revisable.
// =============================
router.put('/apply/:tenant_control_id', auth, requireAiComplianceRead, requireActionsManage, async (req, res) => {
  const client = await pool.connect();

  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const { tenant_control_id } = req.params;

    if (!isUUID(tenant_control_id)) {
      return res.status(400).json({ error: 'control_id inválido' });
    }

    if (!canCreateAiActionDraft(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'AI_ACTION_DRAFT_FORBIDDEN',
        message: 'No autorizado para crear borradores de plan de acción desde recomendaciones IA.'
      });
    }

    const controlResult = await client.query(
      `
      SELECT
        tc.id AS tenant_control_id,
        tc.tenant_id,
        COALESCE(NULLIF(tc.status, ''), 'pendiente') AS status,
        tc.operation_id,
        cc.id AS catalog_control_id,
        cc.iso,
        cc.clause,
        COALESCE(cc.category, '') AS category,
        cc.description AS control_description,
        cc.is_active AS catalog_is_active,
        ts.is_active AS standard_is_active,
        COALESCE(g.accion, 'Implementar el control, definir responsables y documentar el proceso.') AS accion,
        COALESCE(g.evidencia, 'Generar evidencia documentada.') AS evidencia
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON tc.control_id = cc.id
      JOIN tenant_standards ts
        ON ts.tenant_id = tc.tenant_id
       AND ts.standard_code = cc.iso
      LEFT JOIN iso_clause_guides g
        ON g.iso = cc.iso
       AND (
         g.clause = cc.clause
         OR g.clause LIKE cc.clause || '%'
       )
      WHERE tc.id = $1
      ORDER BY g.clause
      LIMIT 1
      `,
      [tenant_control_id]
    );

    if (controlResult.rowCount === 0) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    const control = controlResult.rows[0];

    if (!ensureTenantAccess(req, control.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!control.standard_is_active || !control.catalog_is_active) {
      return res.status(400).json({ error: 'La norma o el control ya no están activos para esta empresa' });
    }

    const operationalScope = await client.query(
      `
      SELECT 1
      FROM tenant_standard_operations tso
      JOIN tenant_operations op
        ON op.id = tso.operation_id
       AND op.tenant_id = tso.tenant_id
       AND op.is_active = TRUE
      WHERE tso.tenant_id = $1
        AND tso.standard_code = $2
        AND tso.operation_id = $3
        AND tso.is_active = TRUE
      LIMIT 1
      `,
      [control.tenant_id, control.iso, control.operation_id]
    );

    if (operationalScope.rowCount === 0) {
      return res.status(400).json({
        success: false,
        code: 'AI_ACTION_DRAFT_OUT_OF_SCOPE',
        message: 'El control no pertenece al alcance operativo activo para crear un borrador de plan de acción.'
      });
    }

    await client.query('BEGIN');

    const existingDraft = await client.query(
      `
      SELECT id
      FROM action_plans
      WHERE tenant_id = $1
        AND tenant_control_id = $2
        AND source_type = 'ia'
        AND source_id = $2
        AND status IN ('abierto', 'en progreso', 'bloqueado')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [control.tenant_id, tenant_control_id]
    );

    let actionPlanId;
    let reused = false;

    if (existingDraft.rowCount > 0) {
      actionPlanId = existingDraft.rows[0].id;
      reused = true;
    } else {
      const priority = priorityForStatus(control.status);
      const auditorExplanation = auditorExplanationForStatus(control.status);
      const title = `Borrador IA: ${control.iso || 'ISO'} ${control.clause || ''}`.trim();
      const description = [
        `Recomendación IA legacy para revisión humana del control ${control.iso || 'N/A'} ${control.clause || '-'}.`,
        '',
        `Acción sugerida: ${control.accion}`,
        `Evidencia sugerida: ${control.evidencia}`,
        `Explicación auditor: ${auditorExplanation}`,
        '',
        'La IA no aplica cambios directamente. Este borrador debe revisarse y gestionarse dentro del flujo normal de planes de acción.'
      ].join('\n');

      const insertPlan = await insertActionPlan(client, {
        tenant_id: control.tenant_id,
        iso_code: control.iso,
        title,
        description,
        source_type: 'ia',
        source_id: tenant_control_id,
        priority,
        status: 'abierto',
        owner: null,
        due_date: null,
        created_by: getUserId(req.user),
        tenant_control_id,
        approval_status: 'no_requerida',
        ai_source_level: 'legacy_deterministic',
        ai_source_label: 'legacy_ai_recommendations',
        ai_confidence: 'low',
        ai_confidence_score: 0.35,
        ai_orchestration_json: JSON.stringify({
          origin: 'legacy_ai_apply_replacement',
          direct_apply_disabled: true,
          tenant_control_id,
          catalog_control_id: control.catalog_control_id,
          iso: control.iso,
          clause: control.clause,
          status: control.status,
          suggested_action: control.accion,
          suggested_evidence: control.evidencia
        }),
        ai_enhanced_answer_json: JSON.stringify({
          human_review_required: true,
          action: control.accion,
          evidence: control.evidencia,
          auditor_explanation: auditorExplanation
        })
      }, { returning: 'id' });

      actionPlanId = insertPlan.rows[0].id;
    }

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
      VALUES ($1,$2,$3,0,'abierto',NULL,$4)
      `,
      [
        actionPlanId,
        control.tenant_id,
        reused
          ? 'Borrador IA reutilizado. La recomendación no fue aplicada directamente.'
          : 'Borrador creado desde recomendación IA legacy. Requiere revisión humana.',
        getUserId(req.user)
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      code: reused ? 'AI_ACTION_DRAFT_REUSED' : 'AI_ACTION_DRAFT_CREATED',
      message: 'La recomendación IA no fue aplicada directamente. Se dejó un borrador revisable de plan de acción.',
      direct_apply_disabled: true,
      action_plan_id: actionPlanId,
      tenant_control_id,
      tenant_id: control.tenant_id,
      status: 'abierto',
      reused
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR APPLY IA:', err);
    res.status(500).json({ error: 'Error apply IA' });
  } finally {
    client.release();
  }
});

module.exports = router;
