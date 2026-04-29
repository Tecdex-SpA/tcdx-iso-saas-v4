const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

const { buildReportData } = require('../reports/services/reportData.service');
const {
  renderExecutivePremiumTemplate,
} = require('../reports/templates/executivePremium.template');

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_EXECUTABLE_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
].filter(Boolean);

function normalizeRole(role) {
  const raw = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const aliases = {
    admin: 'admin',
    administrator: 'admin',
    administrador: 'admin',
    tenant_admin: 'admin',
    admin_tenant: 'admin',
    cliente_admin: 'admin',
    admin_cliente: 'admin',
    company_admin: 'admin',
    account_admin: 'admin',
    user_admin: 'admin',
    administrador_rieltec: 'admin',

    manager: 'manager',
    gerente: 'manager',
    gerencia: 'manager',
    management: 'manager',

    compliance: 'compliance',
    compliance_manager: 'compliance',
    compliance_admin: 'compliance',
    encargado_cumplimiento: 'compliance',
    responsable_cumplimiento: 'compliance',

    auditor: 'auditor',
    internal_auditor: 'auditor',
    auditor_interno: 'auditor',
    external_auditor: 'auditor',
    auditor_externo: 'auditor',

    dealer: 'dealer',
    partner: 'dealer',
    reseller: 'dealer',

    superadmin: 'superadmin',
    super_admin: 'superadmin',
    owner: 'superadmin',

    platform_admin: 'platform_admin',
    admin_global: 'platform_admin',
    global_admin: 'platform_admin',
    administrador_global: 'platform_admin',
    plataforma_admin: 'platform_admin',
    admin_plataforma: 'platform_admin',
  };

  if (aliases[raw]) return aliases[raw];

  if (raw.includes('dealer') || raw.includes('partner') || raw.includes('reseller')) {
    return 'dealer';
  }

  if (
    raw.includes('superadmin') ||
    raw.includes('super_admin') ||
    raw.includes('platform') ||
    raw.includes('plataforma') ||
    raw.includes('global') ||
    raw.includes('owner')
  ) {
    return 'platform_admin';
  }

  if (raw.includes('auditor')) {
    return 'auditor';
  }

  if (raw.includes('compliance') || raw.includes('cumplimiento')) {
    return 'compliance';
  }

  if (raw.includes('manager') || raw.includes('gerente') || raw.includes('gerencia')) {
    return 'manager';
  }

  if (raw.includes('admin') || raw.includes('administrador')) {
    return 'admin';
  }

  return raw;
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

function isPlatformRole(role) {
  return ['superadmin', 'platform_admin'].includes(normalizeRole(role));
}

function isDealerRole(role) {
  return normalizeRole(role) === 'dealer';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

function safeObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function firstExistingPath(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function getReportType(reportTypeCode) {
  const result = await pool.query(
    `
    SELECT
      code,
      name,
      description,
      category,
      default_format,
      template_key,
      is_active,
      sort_order,
      metadata
    FROM report_types
    WHERE code = $1
      AND is_active = TRUE
    LIMIT 1
    `,
    [reportTypeCode]
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

async function getReportAccess(reportTypeCode, role) {
  const normalizedRole = normalizeRole(role);

  const result = await pool.query(
    `
    SELECT
      can_view,
      can_generate,
      can_schedule
    FROM report_access_rules
    WHERE report_type_code = $1
      AND role_code = $2
    LIMIT 1
    `,
    [reportTypeCode, normalizedRole]
  );

  return result.rowCount > 0
    ? result.rows[0]
    : {
        can_view: false,
        can_generate: false,
        can_schedule: false,
      };
}

async function dealerHasTenantAccess(userId, tenantId) {
  const result = await pool.query(
    `
    SELECT id
    FROM dealer_tenant_access
    WHERE dealer_user_id = $1::uuid
      AND tenant_id = $2::uuid
      AND is_active = TRUE
    LIMIT 1
    `,
    [userId, tenantId]
  );

  return result.rowCount > 0;
}

async function getTenantById(tenantId) {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      logo_url,
      created_at
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

function buildReportTitle(reportType, reportTypeCode, period) {
  const fallbackTitles = {
    executive_summary: 'Informe para Gerencia',
    audit_report: 'Informe para Auditoría',
    control_status: 'Informe de Control de Estado',
    platform_client_monthly: 'Informe Mensual de Plataforma por Cliente',
  };

  const baseTitle =
    reportType?.name || fallbackTitles[reportTypeCode] || 'Informe Ejecutivo';

  if (!period) return baseTitle;

  return `${baseTitle} - ${period}`;
}

async function generatePdfFromHtml(html, outputPath) {
  const executablePath = firstExistingPath(CHROME_CANDIDATES);

  if (!executablePath) {
    throw new Error(
      'No se encontró Chromium/Chrome. Verifica PUPPETEER_EXECUTABLE_PATH o instala chromium.'
    );
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-zygote',
      '--single-process',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1440, height: 1100 });
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });
    await page.emulateMediaType('screen');

    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });
  } finally {
    await browser.close();
  }
}

async function resolveTargetTenantId({ role, userId, userTenantId, requestedTenantId }) {
  if (isPlatformRole(role)) {
    return requestedTenantId || userTenantId || null;
  }

  if (isDealerRole(role)) {
    return requestedTenantId || null;
  }

  return userTenantId || null;
}

async function ensureTargetTenantAccess({ role, userId, userTenantId, targetTenantId }) {
  if (!targetTenantId) {
    throw new Error('tenant_id es obligatorio para generar este informe');
  }

  if (isPlatformRole(role)) {
    return true;
  }

  if (isDealerRole(role)) {
    const hasAccess = await dealerHasTenantAccess(userId, targetTenantId);

    if (!hasAccess) {
      throw new Error('El dealer no tiene acceso a este cliente');
    }

    return true;
  }

  if (!userTenantId || String(userTenantId) !== String(targetTenantId)) {
    throw new Error('No autorizado para generar informes sobre este tenant');
  }

  return true;
}

// =====================================================
// GET /api/reports/types
// Devuelve reportes disponibles según perfil del usuario.
// =====================================================
router.get('/types', auth, async (req, res) => {
  try {
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
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
        rt.code,
        rt.name,
        rt.description,
        rt.category,
        rt.default_format,
        rt.template_key,
        rt.sort_order,
        rt.metadata,
        rar.can_view,
        rar.can_generate,
        rar.can_schedule
      FROM report_types rt
      INNER JOIN report_access_rules rar
        ON rar.report_type_code = rt.code
      WHERE rt.is_active = TRUE
        AND rar.role_code = $1
        AND rar.can_view = TRUE
      ORDER BY rt.sort_order ASC, rt.name ASC
      `,
      [role]
    );

    return res.json({
      ok: true,
      scope: {
        user_id: userId,
        tenant_id: tenantId,
        original_role: originalRole || null,
        role,
        is_platform: isPlatformRole(role),
        is_dealer: isDealerRole(role),
      },
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET REPORT TYPES:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo tipos de reportes disponibles',
      detail: error.message,
    });
  }
});

// =====================================================
// GET /api/reports/clients
// Para superadmin/platform_admin: devuelve todos los tenants.
// Para dealer: devuelve solo clientes asignados.
// Para usuario tenant: devuelve su propio tenant.
// =====================================================
router.get('/clients', auth, async (req, res) => {
  try {
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const tenantId = getUserTenantId(req.user);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    if (isPlatformRole(role)) {
      const result = await pool.query(
        `
        SELECT
          id,
          name,
          logo_url,
          created_at
        FROM tenants
        ORDER BY name ASC
        `
      );

      return res.json({
        ok: true,
        scope: {
          original_role: originalRole || null,
          role,
          mode: 'platform',
        },
        data: result.rows,
      });
    }

    if (isDealerRole(role)) {
      const result = await pool.query(
        `
        SELECT
          t.id,
          t.name,
          t.logo_url,
          dta.created_at AS assigned_at
        FROM dealer_tenant_access dta
        INNER JOIN tenants t
          ON t.id = dta.tenant_id
        WHERE dta.dealer_user_id = $1::uuid
          AND dta.is_active = TRUE
        ORDER BY t.name ASC
        `,
        [userId]
      );

      return res.json({
        ok: true,
        scope: {
          original_role: originalRole || null,
          role,
          mode: 'dealer',
        },
        data: result.rows,
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'El usuario no tiene tenant_id asociado',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        logo_url,
        created_at
      FROM tenants
      WHERE id = $1::uuid
      `,
      [tenantId]
    );

    return res.json({
      ok: true,
      scope: {
        original_role: originalRole || null,
        role,
        mode: 'tenant',
      },
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET REPORT CLIENTS:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo clientes disponibles para reportes',
      detail: error.message,
    });
  }
});

// =====================================================
// GET /api/reports/exports
// Historial de informes generados con filtros.
// =====================================================
router.get('/exports', auth, async (req, res) => {
  try {
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    const {
      report_type_code,
      tenant_id,
      q,
      date_from,
      date_to,
      status,
      limit,
    } = req.query || {};

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    const params = [];
    const where = [];

    function addParam(value) {
      params.push(value);
      return `$${params.length}`;
    }

    if (isPlatformRole(role)) {
      if (tenant_id) {
        where.push(`re.tenant_id = ${addParam(tenant_id)}::uuid`);
      }
    } else if (isDealerRole(role)) {
      where.push(`
        re.tenant_id IN (
          SELECT dta.tenant_id
          FROM dealer_tenant_access dta
          WHERE dta.dealer_user_id = ${addParam(userId)}::uuid
            AND dta.is_active = TRUE
        )
      `);

      if (tenant_id) {
        where.push(`re.tenant_id = ${addParam(tenant_id)}::uuid`);
      }
    } else {
      if (!userTenantId) {
        return res.status(400).json({
          ok: false,
          error: 'El usuario no tiene tenant_id asociado',
        });
      }

      where.push(`re.tenant_id = ${addParam(userTenantId)}::uuid`);
    }

    if (report_type_code) {
      where.push(`re.report_type_code = ${addParam(report_type_code)}`);
    }

    if (status) {
      where.push(`LOWER(COALESCE(re.status, '')) = LOWER(${addParam(status)})`);
    }

    if (date_from) {
      where.push(`re.generated_at >= ${addParam(date_from)}::date`);
    }

    if (date_to) {
      where.push(`re.generated_at < (${addParam(date_to)}::date + INTERVAL '1 day')`);
    }

    if (q) {
      const search = `%${q}%`;
      const p = addParam(search);

      where.push(`
        (
          re.report_title ILIKE ${p}
          OR re.report_type_code ILIKE ${p}
          OR t.name ILIKE ${p}
          OR u.email ILIKE ${p}
          OR COALESCE(u.full_name, u.name, '') ILIKE ${p}
        )
      `);
    }

    const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);

    const sql = `
      SELECT
        re.id,
        re.tenant_id,
        t.name AS tenant_name,
        re.requested_by,
        COALESCE(u.full_name, u.name, u.email, 'Usuario no identificado') AS requested_by_name,
        u.email AS requested_by_email,
        re.report_type_code,
        COALESCE(rt.name, re.report_title) AS report_type_name,
        re.report_title,
        re.report_format,
        re.status,
        re.file_url,
        re.generated_at
      FROM report_exports re
      LEFT JOIN tenants t
        ON t.id = re.tenant_id
      LEFT JOIN users u
        ON u.id = re.requested_by
      LEFT JOIN report_types rt
        ON rt.code = re.report_type_code
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY re.generated_at DESC
      LIMIT ${safeLimit}
    `;

    const result = await pool.query(sql, params);

    return res.json({
      ok: true,
      scope: {
        original_role: originalRole || null,
        role,
        tenant_id: userTenantId || null,
        is_platform: isPlatformRole(role),
        is_dealer: isDealerRole(role),
      },
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET REPORT EXPORTS:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo historial de informes',
      detail: error.message,
    });
  }
});

// =====================================================
// POST /api/reports/generate
// Genera PDF premium según tipo de reporte y perfil.
// =====================================================
router.post('/generate', auth, async (req, res) => {
  try {
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    const { report_type_code, tenant_id, period, metadata } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    if (!report_type_code) {
      return res.status(400).json({
        ok: false,
        error: 'report_type_code es obligatorio',
      });
    }

    const reportType = await getReportType(report_type_code);

    if (!reportType) {
      return res.status(404).json({
        ok: false,
        error: 'El tipo de reporte no existe o no está activo',
      });
    }

    const access = await getReportAccess(report_type_code, role);

    if (!access.can_generate) {
      return res.status(403).json({
        ok: false,
        error: 'El perfil del usuario no puede generar este tipo de informe',
        scope: {
          original_role: originalRole || null,
          normalized_role: role,
          report_type_code,
        },
      });
    }

    const targetTenantId = await resolveTargetTenantId({
      role,
      userId,
      userTenantId,
      requestedTenantId: tenant_id,
    });

    await ensureTargetTenantAccess({
      role,
      userId,
      userTenantId,
      targetTenantId,
    });

    const tenant = await getTenantById(targetTenantId);

    if (!tenant) {
      return res.status(404).json({
        ok: false,
        error: 'El tenant indicado no existe',
      });
    }

    const reportData = await buildReportData({
      tenantId: targetTenantId,
      reportTypeCode: report_type_code,
      requestedBy: userId,
      period: period || null,
      requesterRole: role,
    });

    const html = renderExecutivePremiumTemplate(reportData);

    const reportTitle = buildReportTitle(reportType, report_type_code, period);
    const tenantFolder = path.join(
      __dirname,
      '..',
      '..',
      'uploads',
      'reports',
      String(targetTenantId)
    );

    fs.mkdirSync(tenantFolder, { recursive: true });

    const fileName = `${slugify(report_type_code)}-${slugify(
      tenant.name
    )}-${Date.now()}.pdf`;

    const outputPath = path.join(tenantFolder, fileName);

    await generatePdfFromHtml(html, outputPath);

    const fileUrl = `/uploads/reports/${targetTenantId}/${fileName}`;

    const exportMetadata = {
      ...safeObject(metadata),
      template_key: reportType.template_key || null,
      requester_role: role,
      original_role: originalRole || null,
      tenant_name: tenant.name,
      generated_from: safeObject(metadata).generated_from || '/exportes',
      source: safeObject(metadata).source || 'frontend_exportes',
    };

    const exportResult = await pool.query(
      `
      INSERT INTO report_exports (
        tenant_id,
        requested_by,
        report_type_code,
        report_title,
        report_format,
        status,
        file_url,
        payload_json,
        metadata
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        'generated',
        $6,
        $7::jsonb,
        $8::jsonb
      )
      RETURNING *
      `,
      [
        targetTenantId,
        userId,
        report_type_code,
        reportTitle,
        reportType.default_format || 'pdf',
        fileUrl,
        JSON.stringify(reportData),
        JSON.stringify(exportMetadata),
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Informe generado correctamente',
      data: {
        export: exportResult.rows[0],
        file_url: fileUrl,
      },
    });
  } catch (error) {
    console.error('ERROR GENERATE REPORT:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error generando informe',
      detail: error.message,
    });
  }
});

// =====================================================
// POST /api/reports/schedules
// Programa un reporte mensual para un tenant.
// =====================================================
router.post('/schedules', auth, async (req, res) => {
  try {
    const originalRole =
      req.user?.role || req.user?.user_role || req.user?.userRole;

    const role = normalizeRole(originalRole);
    const userId = getUserId(req.user);
    const userTenantId = getUserTenantId(req.user);

    const {
      tenant_id,
      report_type_code,
      day_of_month,
      recipients,
      notes,
      metadata,
    } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no identificado en token',
      });
    }

    if (!isPlatformRole(role) && !isDealerRole(role)) {
      return res.status(403).json({
        ok: false,
        error:
          'Solo superadmin, platform_admin o dealer pueden programar informes mensuales de cliente',
        scope: {
          original_role: originalRole || null,
          normalized_role: role,
        },
      });
    }

    if (!tenant_id) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id es obligatorio',
      });
    }

    if (!report_type_code) {
      return res.status(400).json({
        ok: false,
        error: 'report_type_code es obligatorio',
      });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe indicar al menos un destinatario en recipients',
      });
    }

    const reportType = await getReportType(report_type_code);

    if (!reportType) {
      return res.status(404).json({
        ok: false,
        error: 'El tipo de reporte no existe o no está activo',
      });
    }

    const access = await getReportAccess(report_type_code, role);

    if (!access.can_schedule) {
      return res.status(403).json({
        ok: false,
        error: 'El perfil del usuario no puede programar este tipo de informe',
        scope: {
          original_role: originalRole || null,
          normalized_role: role,
          report_type_code,
        },
      });
    }

    await ensureTargetTenantAccess({
      role,
      userId,
      userTenantId,
      targetTenantId: tenant_id,
    });

    const targetTenant = await getTenantById(tenant_id);

    if (!targetTenant) {
      return res.status(404).json({
        ok: false,
        error: 'El tenant indicado no existe',
      });
    }

    const selectedDay = Number(day_of_month || 1);

    if (Number.isNaN(selectedDay) || selectedDay < 1 || selectedDay > 28) {
      return res.status(400).json({
        ok: false,
        error: 'day_of_month debe estar entre 1 y 28',
      });
    }

    const normalizedRecipients = recipients
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    if (normalizedRecipients.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe indicar al menos un destinatario válido',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO report_schedules (
        tenant_id,
        report_type_code,
        frequency,
        day_of_month,
        recipients,
        is_active,
        created_by,
        notes,
        metadata
      )
      VALUES (
        $1::uuid,
        $2,
        'monthly',
        $3,
        $4::jsonb,
        TRUE,
        $5::uuid,
        $6,
        $7::jsonb
      )
      RETURNING *
      `,
      [
        tenant_id,
        report_type_code,
        selectedDay,
        JSON.stringify(normalizedRecipients),
        userId,
        notes || null,
        JSON.stringify({
          ...safeObject(metadata),
          tenant_name: targetTenant.name,
          report_name: reportType.name,
          requester_role: role,
          original_role: originalRole || null,
        }),
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Programación mensual de reporte creada correctamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('ERROR CREATE REPORT SCHEDULE:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error creando programación mensual de reporte',
      detail: error.message,
    });
  }
});

module.exports = router;
