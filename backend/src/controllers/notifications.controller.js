const db = require('../config/db');
const { resolveLocale } = require('../utils/locale');

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

function isPlatformRole(role) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalizeRole(role));
}

function isDealerRole(role) {
  return normalizeRole(role) === 'dealer';
}

async function dealerHasTenantAccess(userId, tenantId) {
  if (!userId || !tenantId) return false;

  const result = await db.query(
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

  return result.rowCount > 0;
}

async function ensureTenantAccess(req, tenantId) {
  const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
  const userId = getUserId(req.user);
  const userTenantId = getUserTenantId(req.user);

  if (!tenantId) return false;

  if (isPlatformRole(role)) return true;

  if (isDealerRole(role)) {
    return dealerHasTenantAccess(userId, tenantId);
  }

  return String(userTenantId || '') === String(tenantId);
}

async function upsertNotification(tenantId, item) {
  await db.query(
    `
    INSERT INTO notifications (
      tenant_id,
      type,
      title,
      description,
      href,
      level,
      dedupe_key,
      is_read,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
    ON CONFLICT (tenant_id, dedupe_key)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      href = EXCLUDED.href,
      level = EXCLUDED.level,
      is_read = CASE
        WHEN notifications.title IS DISTINCT FROM EXCLUDED.title
          OR notifications.description IS DISTINCT FROM EXCLUDED.description
          OR notifications.href IS DISTINCT FROM EXCLUDED.href
          OR notifications.level IS DISTINCT FROM EXCLUDED.level
        THEN FALSE
        ELSE notifications.is_read
      END,
      updated_at = NOW()
    `,
    [
      tenantId,
      item.type,
      item.title,
      item.description,
      item.href,
      item.level,
      item.dedupeKey,
    ]
  );
}

async function removeNotification(tenantId, dedupeKey) {
  await db.query(
    `
    DELETE FROM notifications
    WHERE tenant_id = $1
      AND dedupe_key = $2
    `,
    [tenantId, dedupeKey]
  );
}

async function syncNotificationsForTenant(tenantId) {
  const [
    overduePlansRes,
    overdueFindingsRes,
    highRisksRes,
    upcomingAuditsRes,
    deterioratedControlsRes,
    pendingEvidenceRes,
  ] = await Promise.all([
    db.query(
      `
      WITH active_scope AS (
        SELECT DISTINCT ts.standard_code
        FROM tenant_standards ts
        WHERE ts.tenant_id = $1
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
      SELECT COUNT(*)::int AS total
      FROM action_plans ap
      WHERE ap.tenant_id = $1
        AND ap.due_date IS NOT NULL
        AND ap.due_date < CURRENT_DATE
        AND LOWER(COALESCE(ap.status, '')) NOT IN ('completado', 'cancelado', 'cerrado')
        AND (
          ap.iso_code IS NULL
          OR EXISTS (
            SELECT 1
            FROM active_scope s
            WHERE s.standard_code = ap.iso_code
          )
        )
      `,
      [tenantId]
    ),

    db.query(
      `
      WITH active_scope AS (
        SELECT DISTINCT ts.standard_code
        FROM tenant_standards ts
        WHERE ts.tenant_id = $1
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
      SELECT COUNT(*)::int AS total
      FROM findings f
      WHERE f.tenant_id = $1
        AND f.due_date IS NOT NULL
        AND f.due_date < CURRENT_DATE
        AND LOWER(COALESCE(f.status, '')) <> 'cerrado'
        AND (
          f.iso_code IS NULL
          OR EXISTS (
            SELECT 1
            FROM active_scope s
            WHERE s.standard_code = f.iso_code
          )
        )
      `,
      [tenantId]
    ),

    db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM asset_risks ar
      JOIN assets a
        ON a.id = ar.asset_id
      WHERE a.tenant_id = $1
        AND LOWER(COALESCE(ar.level, '')) = 'alto'
      `,
      [tenantId]
    ),

    db.query(
      `
      WITH active_scope AS (
        SELECT DISTINCT ts.standard_code
        FROM tenant_standards ts
        WHERE ts.tenant_id = $1
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
      SELECT COUNT(*)::int AS total
      FROM audits a
      WHERE a.tenant_id = $1
        AND a.start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND LOWER(COALESCE(a.status, '')) <> 'completada'
        AND (
          a.iso IS NULL
          OR EXISTS (
            SELECT 1
            FROM active_scope s
            WHERE s.standard_code = a.iso
          )
        )
      `,
      [tenantId]
    ),

    db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM tenant_controls tc
      JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tc.tenant_id
       AND op.is_active = TRUE
      WHERE tc.tenant_id = $1
        AND (
          LOWER(COALESCE(tc.health_status, '')) = 'deteriorado'
          OR LOWER(COALESCE(tc.status, '')) = 'no cumple'
          OR COALESCE(tc.score, 100) < 50
        )
      `,
      [tenantId]
    ),

    db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM evidences e
      WHERE e.tenant_id = $1
        AND LOWER(COALESCE(e.status, '')) IN ('pending', 'pendiente', 'uploaded', 'subida')
      `,
      [tenantId]
    ),
  ]);

  const items = [
    {
      type: 'system',
      title: 'Planes atrasados',
      description: `${overduePlansRes.rows[0].total} planes vencidos`,
      href: '/plan-accion',
      level: 'critical',
      dedupeKey: 'system:overdue-plans',
      active: Number(overduePlansRes.rows[0].total || 0) > 0,
    },
    {
      type: 'system',
      title: 'Hallazgos vencidos',
      description: `${overdueFindingsRes.rows[0].total} hallazgos atrasados`,
      href: '/hallazgos',
      level: 'critical',
      dedupeKey: 'system:overdue-findings',
      active: Number(overdueFindingsRes.rows[0].total || 0) > 0,
    },
    {
      type: 'system',
      title: 'Riesgos críticos',
      description: `${highRisksRes.rows[0].total} riesgos altos`,
      href: '/activos',
      level: 'critical',
      dedupeKey: 'system:high-risks',
      active: Number(highRisksRes.rows[0].total || 0) > 0,
    },
    {
      type: 'system',
      title: 'Auditorías próximas',
      description: `${upcomingAuditsRes.rows[0].total} auditorías dentro de 7 días`,
      href: '/auditorias',
      level: 'warning',
      dedupeKey: 'system:upcoming-audits',
      active: Number(upcomingAuditsRes.rows[0].total || 0) > 0,
    },
    {
      type: 'system',
      title: 'Controles deteriorados',
      description: `${deterioratedControlsRes.rows[0].total} controles requieren atención`,
      href: '/controles',
      level: 'warning',
      dedupeKey: 'system:deteriorated-controls',
      active: Number(deterioratedControlsRes.rows[0].total || 0) > 0,
    },
    {
      type: 'system',
      title: 'Evidencias pendientes',
      description: `${pendingEvidenceRes.rows[0].total} evidencias esperando revisión`,
      href: '/evidencias',
      level: 'info',
      dedupeKey: 'system:pending-evidences',
      active: Number(pendingEvidenceRes.rows[0].total || 0) > 0,
    },
  ];

  for (const item of items) {
    if (item.active) {
      await upsertNotification(tenantId, item);
    } else {
      await removeNotification(tenantId, item.dedupeKey);
    }
  }
}

async function getNotifications(req, res) {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);

    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requerido' });
    }

    if (!(await ensureTenantAccess(req, tenantId))) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    await syncNotificationsForTenant(tenantId);

    const { rows } = await db.query(
      `
      SELECT
        id::text,
        title,
        description,
        href,
        level,
        is_read,
        created_at,
        updated_at
      FROM notifications
      WHERE tenant_id = $1
      ORDER BY
        is_read ASC,
        CASE level
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          ELSE 3
        END,
        updated_at DESC
      LIMIT 12
      `,
      [tenantId]
    );

    const unreadCount = rows.filter((r) => !r.is_read).length;

    return res.json({
      locale,
      unreadCount,
      items: rows,
    });
  } catch (err) {
    console.error('GET NOTIFICATIONS ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
}

async function markNotificationRead(req, res) {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);

    const { id } = req.params;

    const current = await db.query(
      `
      SELECT id, tenant_id
      FROM notifications
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const notification = current.rows[0];

    if (!(await ensureTenantAccess(req, notification.tenant_id))) {
      return res.status(403).json({ error: 'No autorizado para esta notificación' });
    }

    await db.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          updated_at = NOW()
      WHERE id = $1::uuid
      `,
      [id]
    );

    return res.json({ ok: true, locale });
  } catch (err) {
    console.error('MARK NOTIFICATION READ ERROR:', err);
    return res.status(500).json({ error: 'Error marcando notificación' });
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);

    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requerido' });
    }

    if (!(await ensureTenantAccess(req, tenantId))) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    await db.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          updated_at = NOW()
      WHERE tenant_id = $1::uuid
        AND is_read = FALSE
      `,
      [tenantId]
    );

    return res.json({ ok: true, locale });
  } catch (err) {
    console.error('MARK ALL NOTIFICATIONS READ ERROR:', err);
    return res.status(500).json({ error: 'Error marcando notificaciones' });
  }
}

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
