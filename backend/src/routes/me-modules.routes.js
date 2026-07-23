const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { errorDetail } = require('../utils/errorResponse');

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

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isPlatformRole(role) {
  const normalized = normalizeRole(role);

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalized);
}

function isDealerRole(role) {
  return normalizeRole(role) === 'dealer';
}

function buildModuleMap(rows) {
  const map = {};

  rows.forEach((row) => {
    map[row.module_key] = {
      module_key: row.module_key,
      module_name: row.module_name,
      module_description: row.module_description,
      sort_order: row.sort_order,
      is_enabled: row.is_enabled === true,
      enabled_at: row.enabled_at,
      disabled_at: row.disabled_at,
      notes: row.notes,
      metadata: row.metadata || {},
    };
  });

  return map;
}

// =====================================================
// GET /api/me/modules
// Devuelve los módulos SaaS disponibles para el usuario autenticado.
// Para usuarios tenant: usa tenant_id del token.
// Para superadmin/platform_admin: permite todo.
// Para dealer: no aplica módulos tenant directos.
// =====================================================
router.get('/modules', auth, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const userId = getUserId(req.user);
    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const tenantId = getUserTenantId(req.user);

    const isPlatform = isPlatformRole(role);
    const isDealer = isDealerRole(role);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    // Plataforma no se bloquea por módulos de tenant.
    if (isPlatform) {
      const result = await pool.query(
        `
        SELECT
          sm.module_key,
          sm.display_name AS module_name,
          sm.description AS module_description,
          sm.sort_order,
          TRUE AS is_enabled,
          NULL::timestamp AS enabled_at,
          NULL::timestamp AS disabled_at,
          'Acceso plataforma'::text AS notes,
          '{}'::jsonb AS metadata
        FROM saas_modules sm
        WHERE sm.is_active = TRUE
        ORDER BY sm.sort_order, sm.module_key
        `
      );

      return res.json({
        ok: true,
        scope: {
          user_id: userId,
          role,
          tenant_id: null,
          is_platform: true,
          is_dealer: false,
        },
        data: result.rows,
        module_map: buildModuleMap(result.rows),
      });
    }

    // Dealer usa su propio portal; no debe depender de módulos del tenant.
    if (isDealer) {
      return res.json({
        ok: true,
        scope: {
          user_id: userId,
          role,
          tenant_id: null,
          is_platform: false,
          is_dealer: true,
        },
        data: [],
        module_map: {},
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'El usuario no tiene tenant_id asociado',
      });
    }

    const tenantServiceResult = await pool.query(
      `
      SELECT
        id,
        name,
        COALESCE(service_status, 'active') AS service_status,
        suspended_at,
        suspension_reason,
        deleted_at,
        deletion_reason
      FROM tenants
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );

    const tenantService = tenantServiceResult.rows[0] || null;

    if (!tenantService) {
      return res.status(404).json({
        ok: false,
        error: 'Empresa no encontrada para el usuario autenticado',
      });
    }

    const result = await pool.query(
      `
      SELECT
        tenant_id,
        tenant_name,
        module_key,
        module_name,
        module_description,
        sort_order,
        is_enabled,
        enabled_at,
        disabled_at,
        notes,
        metadata
      FROM v_tenant_modules
      WHERE tenant_id = $1::uuid
      ORDER BY sort_order, module_key
      `,
      [tenantId]
    );

    return res.json({
      ok: true,
      scope: {
        user_id: userId,
        role,
        tenant_id: tenantId,
        tenant_name: tenantService.name,
        service_status: tenantService.service_status,
        suspended_at: tenantService.suspended_at,
        suspension_reason: tenantService.suspension_reason,
        deleted_at: tenantService.deleted_at,
        deletion_reason: tenantService.deletion_reason,
        is_platform: false,
        is_dealer: false,
      },
      data: result.rows,
      module_map: buildModuleMap(result.rows),
    });
  } catch (error) {
    console.error('ERROR GET ME MODULES:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo módulos contratados del usuario',
      ...errorDetail(error),
    });
  }
});

module.exports = router;
