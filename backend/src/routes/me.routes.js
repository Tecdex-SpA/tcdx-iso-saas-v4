const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const { errorDetail } = require('../utils/errorResponse');
const {
  buildGovernanceContext,
} = require('../services/governance.service');
const {
  DEFAULT_FEATURES,
  getTenantAiSettings,
} = require('../services/tenantAiSettings.service');

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
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

function getHomePathByRole(role) {
  const normalizedRole = normalizeRole(role);

  if (
    normalizedRole === 'superadmin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'admin_global' ||
    normalizedRole === 'global_admin' ||
    normalizedRole === 'owner'
  ) {
    return '/admin-saas';
  }

  if (normalizedRole === 'dealer') {
    return '/dealer';
  }

  return '/dashboard';
}

function isPlatformRole(role) {
  const normalizedRole = normalizeRole(role);
  return (
    normalizedRole === 'superadmin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'admin_global' ||
    normalizedRole === 'global_admin' ||
    normalizedRole === 'owner'
  );
}

function buildAiEntitlements(settings, { platform = false } = {}) {
  if (platform) {
    return {
      enabled: true,
      plan: 'enterprise',
      web_enabled: true,
      report_enabled: true,
      auditor_enabled: true,
      features: { ...DEFAULT_FEATURES },
      quota: {
        monthly: null,
        used: 0,
      },
    };
  }

  const features = {
    ...DEFAULT_FEATURES,
    ...(settings?.ai_features_json || {}),
  };
  const enabled = settings?.ai_enabled === true && settings?.ai_plan !== 'none';

  return {
    enabled,
    plan: enabled ? (settings?.ai_plan || 'standard') : 'none',
    web_enabled: enabled && settings?.ai_web_enabled !== false && features.web_research !== false,
    report_enabled: enabled && settings?.ai_report_enabled !== false && features.report_enrichment !== false,
    auditor_enabled: enabled && settings?.ai_auditor_enabled !== false && features.auditor !== false,
    features: {
      auditor: enabled && settings?.ai_auditor_enabled !== false && features.auditor !== false,
      suggestions: enabled && features.suggestions !== false,
      web_research: enabled && settings?.ai_web_enabled !== false && features.web_research !== false,
      report_enrichment: enabled && settings?.ai_report_enabled !== false && features.report_enrichment !== false,
      document_generation: enabled && features.document_generation !== false,
      company_profile_analysis: enabled && features.company_profile_analysis !== false,
    },
    quota: {
      monthly: settings?.ai_monthly_quota ?? null,
      used: Number(settings?.ai_quota_used || 0),
    },
  };
}

// =====================================================
// GET /api/me/session
// Valida token y devuelve contexto mínimo de sesión
// =====================================================
router.get('/session', auth, async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const tenantId = getUserTenantId(req.user);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(u.name), ''), u.email) AS display_name,
        u.role,
        u.tenant_id,
        t.name AS tenant_name,
        t.logo_url AS tenant_logo_url
      FROM users u
      LEFT JOIN tenants t
        ON t.id = u.tenant_id
      WHERE u.id = $1::uuid
      LIMIT 1
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado',
      });
    }

    const row = result.rows[0];
    const role =
      row.role ||
      req.user?.role ||
      req.user?.user_role ||
      req.user?.userRole ||
      '';

    return res.json({
      ok: true,
      session: {
        user: {
          id: row.id,
          email: row.email,
          display_name: row.display_name,
          role,
          tenant_id: row.tenant_id || tenantId || null,
        },
        tenant: row.tenant_id
          ? {
              id: row.tenant_id,
              name: row.tenant_name || null,
              logo_url: row.tenant_logo_url || null,
            }
          : null,
        home_path: getHomePathByRole(role),
        token: {
          expires_at: req.user?.exp
            ? new Date(Number(req.user.exp) * 1000).toISOString()
            : null,
        },
      },
    });
  } catch (error) {
    console.error('ERROR /api/me/session:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo sesión del usuario',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /api/me/governance
// Devuelve contexto SaaS completo del usuario autenticado
// =====================================================
router.get('/governance', auth, async (req, res) => {
  try {
    const context = await buildGovernanceContext(req.user);

    if (!context?.user?.id) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado',
      });
    }

    return res.json({
      ok: true,
      data: context,
    });
  } catch (error) {
    console.error('ERROR /api/me/governance:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo contexto de gobernanza del usuario',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /api/me/permissions
// Devuelve solo permisos del usuario autenticado
// =====================================================
router.get('/permissions', auth, async (req, res) => {
  try {
    const context = await buildGovernanceContext(req.user);

    if (!context?.user?.id) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario no encontrado',
      });
    }

    return res.json({
      ok: true,
      user: context.user,
      role: context.role,
      permissions: context.permissions,
      permission_map: context.permission_map,
    });
  } catch (error) {
    console.error('ERROR /api/me/permissions:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo permisos del usuario',
      ...errorDetail(error),
    });
  }
});

// =====================================================
// GET /api/me/entitlements
// Devuelve capacidades contratadas del tenant autenticado
// =====================================================
router.get('/entitlements', auth, async (req, res) => {
  try {
    const tenantId = getUserTenantId(req.user);
    const role =
      req.user?.role ||
      req.user?.user_role ||
      req.user?.userRole ||
      '';

    const platform = isPlatformRole(role) && !tenantId;
    const settings = platform ? null : await getTenantAiSettings(tenantId);

    return res.json({
      ok: true,
      tenant_id: tenantId || null,
      ai: buildAiEntitlements(settings, { platform }),
    });
  } catch (error) {
    console.error('ERROR /api/me/entitlements:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo capacidades del tenant',
      ...errorDetail(error),
    });
  }
});

module.exports = router;
