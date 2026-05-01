const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { errorDetail } = require('../utils/errorResponse');

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || null;
}

function isPlatform(user) {
  return ['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(normalizeRole(user));
}

function isTenantAdmin(user) {
  return ['admin', 'tenant_admin'].includes(normalizeRole(user));
}

function isDealer(user) {
  return normalizeRole(user) === 'dealer';
}

async function dealerHasTenantAccess(userId, tenantId) {
  const exists = await pool.query(
    `
    SELECT 1
    FROM dealer_tenant_access
    WHERE dealer_user_id = $1::uuid
      AND tenant_id = $2::uuid
      AND is_active = TRUE
    LIMIT 1
    `,
    [userId, tenantId]
  );

  return exists.rowCount > 0;
}

async function ensureBillingAccess(req, tenantId) {
  if (isPlatform(req.user)) return true;

  if (isDealer(req.user)) {
    return dealerHasTenantAccess(getUserId(req.user), tenantId);
  }

  if (isTenantAdmin(req.user)) {
    return String(getUserTenantId(req.user)) === String(tenantId);
  }

  return false;
}

async function tableExists(tableName) {
  const result = await pool.query(`SELECT to_regclass($1) AS exists`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.exists);
}

async function countQuery(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return Number(result.rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getOrCreateBillingSettings(tenantId) {
  await pool.query(
    `
    INSERT INTO tenant_billing_settings (tenant_id)
    VALUES ($1::uuid)
    ON CONFLICT (tenant_id) DO NOTHING
    `,
    [tenantId]
  );

  const result = await pool.query(
    `
    SELECT *
    FROM tenant_billing_settings
    WHERE tenant_id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0];
}

async function buildPreinvoice(tenantId, period = currentPeriod()) {
  const settings = await getOrCreateBillingSettings(tenantId);

  const tenantResult = await pool.query(
    `SELECT id, name, logo, logo_url FROM tenants WHERE id = $1::uuid LIMIT 1`,
    [tenantId]
  );

  const tenant = tenantResult.rows[0] || null;

  const activeStandardsCount = await countQuery(
    `
    SELECT COUNT(*)::int AS total
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND is_active = TRUE
    `,
    [tenantId]
  );

  let activeModulesCount = 0;

  if (await tableExists('tenant_modules')) {
    activeModulesCount = await countQuery(
      `
      SELECT COUNT(*)::int AS total
      FROM tenant_modules
      WHERE tenant_id = $1::uuid
        AND is_enabled = TRUE
      `,
      [tenantId]
    );
  }

  const aiUnitsUsed = await countQuery(
    `
    SELECT COUNT(*)::int AS total
    FROM ai_auditor_runs
    WHERE tenant_id = $1::uuid
      AND to_char(created_at, 'YYYY-MM') = $2
    `,
    [tenantId, period]
  );

  const reportExports = await countQuery(
    `
    SELECT COUNT(*)::int AS total
    FROM report_exports
    WHERE tenant_id = $1::uuid
      AND to_char(generated_at, 'YYYY-MM') = $2
    `,
    [tenantId, period]
  );

  const aiUnitsExtra = Math.max(0, aiUnitsUsed - Number(settings.included_ai_units || 0));

  const baseMonthlyUf = Number(settings.base_monthly_uf || 0);
  const standardsUf = activeStandardsCount * Number(settings.price_per_active_standard_uf || 0);
  const modulesUf = activeModulesCount * Number(settings.price_per_active_module_uf || 0);
  const aiExtraUf = aiUnitsExtra * Number(settings.price_per_extra_ai_unit_uf || 0);
  const totalUf = baseMonthlyUf + standardsUf + modulesUf + aiExtraUf;

  return {
    tenant,
    period,
    settings,
    usage: {
      active_standards_count: activeStandardsCount,
      active_modules_count: activeModulesCount,
      ai_units_used: aiUnitsUsed,
      ai_units_extra: aiUnitsExtra,
      report_exports: reportExports,
      users_not_charged: true,
    },
    amounts: {
      base_monthly_uf: Number(baseMonthlyUf.toFixed(2)),
      standards_uf: Number(standardsUf.toFixed(2)),
      modules_uf: Number(modulesUf.toFixed(2)),
      ai_extra_uf: Number(aiExtraUf.toFixed(2)),
      total_uf: Number(totalUf.toFixed(2)),
      currency: settings.currency || 'UF',
    },
    commercial_note:
      'Modelo SaaS sin cobro por usuario. La variable principal considera normas ISO activas, módulos y consumo IA adicional.',
  };
}

router.get('/preinvoice/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const period = String(req.query.period || currentPeriod());

    if (!(await ensureBillingAccess(req, tenant_id))) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para prefacturación de este tenant',
      });
    }

    const data = await buildPreinvoice(tenant_id, period);

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error('ERROR GET PREINVOICE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error generando prefacturación',
      ...errorDetail(error),
    });
  }
});

router.post('/preinvoice/:tenant_id/materialize', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const period = String(req.body?.period || req.query.period || currentPeriod());

    if (!(await ensureBillingAccess(req, tenant_id))) {
      return res.status(403).json({
        ok: false,
        code: 'RBAC_DENIED',
        error: 'No autorizado para prefacturación de este tenant',
      });
    }

    const invoice = await buildPreinvoice(tenant_id, period);
    const s = invoice.settings;
    const u = invoice.usage;
    const a = invoice.amounts;

    const result = await pool.query(
      `
      INSERT INTO tenant_monthly_preinvoices (
        tenant_id,
        period,
        plan_code,
        active_standards_count,
        active_modules_count,
        ai_units_used,
        ai_units_extra,
        base_monthly_uf,
        standards_uf,
        modules_uf,
        ai_extra_uf,
        total_uf,
        detail_json
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
      ON CONFLICT (tenant_id, period)
      DO UPDATE SET
        plan_code = EXCLUDED.plan_code,
        active_standards_count = EXCLUDED.active_standards_count,
        active_modules_count = EXCLUDED.active_modules_count,
        ai_units_used = EXCLUDED.ai_units_used,
        ai_units_extra = EXCLUDED.ai_units_extra,
        base_monthly_uf = EXCLUDED.base_monthly_uf,
        standards_uf = EXCLUDED.standards_uf,
        modules_uf = EXCLUDED.modules_uf,
        ai_extra_uf = EXCLUDED.ai_extra_uf,
        total_uf = EXCLUDED.total_uf,
        detail_json = EXCLUDED.detail_json,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        tenant_id,
        period,
        s.plan_code,
        u.active_standards_count,
        u.active_modules_count,
        u.ai_units_used,
        u.ai_units_extra,
        a.base_monthly_uf,
        a.standards_uf,
        a.modules_uf,
        a.ai_extra_uf,
        a.total_uf,
        JSON.stringify(invoice),
      ]
    );

    return res.json({
      ok: true,
      data: result.rows[0],
      preinvoice: invoice,
    });
  } catch (error) {
    console.error('ERROR MATERIALIZE PREINVOICE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error guardando prefacturación',
      ...errorDetail(error),
    });
  }
});

module.exports = router;
