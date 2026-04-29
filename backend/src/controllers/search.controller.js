const db = require('../config/db');

const normalize = (v) => String(v || '').trim().toLowerCase();

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

function rankScore({ title, subtitle, type }, q) {
  const t = normalize(title);
  const s = normalize(subtitle);
  const k = `${t} ${s} ${normalize(type)}`;

  if (t === q) return 1000;
  if (t.startsWith(q)) return 800;
  if (t.includes(q)) return 650;
  if (s === q) return 500;
  if (s.startsWith(q)) return 420;
  if (s.includes(q)) return 360;
  if (k.includes(q)) return 220;
  return 100;
}

function dedupeAndSort(rows, q) {
  const seen = new Map();

  for (const row of rows) {
    const clean = {
      id: String(row.id),
      type: row.type,
      title: row.title || 'Sin título',
      subtitle: row.subtitle || '',
      href: row.href || '/dashboard',
    };

    const score = rankScore(clean, q);
    const key = `${clean.type}|${clean.href}|${clean.title}`;

    if (!seen.has(key) || seen.get(key)._score < score) {
      seen.set(key, { ...clean, _score: score });
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b._score - a._score || a.title.localeCompare(b.title))
    .slice(0, 12)
    .map(({ _score, ...rest }) => rest);
}

async function globalSearch(req, res) {
  try {
    const { tenantId } = req.params;
    const q = normalize(req.query.q);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requerido' });
    }

    if (!(await ensureTenantAccess(req, tenantId))) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const like = `%${q}%`;

    const [
      standardsRes,
      clausesRes,
      controlsRes,
      auditsRes,
      plansRes,
      findingsRes,
      evidencesRes,
      assetsRes,
      risksRes,
    ] = await Promise.all([
      // NORMAS ACTIVAS Y OPERATIVAS
      db.query(
        `
        SELECT
          ts.standard_code AS id,
          'norma' AS type,
          ts.standard_code AS title,
          COALESCE(s.name, 'Norma') AS subtitle,
          '/controles?iso=' || ts.standard_code AS href
        FROM tenant_standards ts
        LEFT JOIN standards s
          ON s.code = ts.standard_code
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
          AND (
            ts.standard_code ILIKE $2
            OR COALESCE(s.name, '') ILIKE $2
          )
        ORDER BY ts.standard_code
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // CLÁUSULAS REALES DESDE TENANT_CONTROLS + CONTROLS_CATALOG
      db.query(
        `
        SELECT DISTINCT ON (cc.clause, scope_match.standard_code, tc.operation_id)
          md5(
            COALESCE(scope_match.standard_code, '')
            || '|' ||
            COALESCE(cc.clause, '')
            || '|' ||
            COALESCE(tc.operation_id::text, '')
          ) AS id,
          'clausula' AS type,
          'Cláusula ' || COALESCE(cc.clause, 'Sin cláusula') AS title,
          COALESCE(scope_match.standard_code, cc.iso, 'Sin norma') || ' · ' || COALESCE(op.name, 'Sin operación') AS subtitle,
          '/controles?iso=' || COALESCE(scope_match.standard_code, cc.iso, '') ||
          '&operation_id=' || tc.operation_id ||
          '&clause=' || COALESCE(cc.clause, '') AS href
        FROM tenant_controls tc
        JOIN controls_catalog cc
          ON cc.id = tc.control_id
         AND cc.is_active = TRUE
        JOIN tenant_operations op
          ON op.id = tc.operation_id
         AND op.tenant_id = tc.tenant_id
         AND op.is_active = TRUE
        LEFT JOIN LATERAL (
          SELECT tso.standard_code
          FROM tenant_standard_operations tso
          JOIN tenant_standards ts
            ON ts.tenant_id = tso.tenant_id
           AND ts.standard_code = tso.standard_code
           AND ts.is_active = TRUE
          WHERE tso.tenant_id = tc.tenant_id
            AND tso.operation_id = tc.operation_id
            AND tso.is_active = TRUE
            AND (
              cc.iso = tso.standard_code
              OR EXISTS (
                SELECT 1
                FROM controls_catalog_standards ccs
                WHERE ccs.control_id = cc.id
                  AND ccs.standard_code = tso.standard_code
              )
            )
          ORDER BY
            CASE WHEN tso.standard_code = cc.iso THEN 0 ELSE 1 END,
            tso.standard_code
          LIMIT 1
        ) scope_match ON TRUE
        WHERE tc.tenant_id = $1
          AND cc.clause IS NOT NULL
          AND (
            COALESCE(cc.clause, '') ILIKE $2
            OR ('cláusula ' || COALESCE(cc.clause, '')) ILIKE $2
            OR COALESCE(cc.category, '') ILIKE $2
            OR COALESCE(scope_match.standard_code, cc.iso, '') ILIKE $2
          )
        ORDER BY cc.clause, scope_match.standard_code, tc.operation_id
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // CONTROLES OPERATIVOS
      db.query(
        `
        SELECT
          tc.id::text AS id,
          'control' AS type,
          'Control ' || COALESCE(cc.clause, 'Sin cláusula') AS title,
          COALESCE(scope_match.standard_code, cc.iso, 'Sin norma') ||
          ' · ' ||
          COALESCE(op.name, 'Sin operación') ||
          ' · ' ||
          COALESCE(tc.status, 'sin estado') AS subtitle,
          '/controles?iso=' || COALESCE(scope_match.standard_code, cc.iso, '') ||
          '&operation_id=' || tc.operation_id ||
          '&id=' || tc.id AS href
        FROM tenant_controls tc
        JOIN controls_catalog cc
          ON cc.id = tc.control_id
         AND cc.is_active = TRUE
        JOIN tenant_operations op
          ON op.id = tc.operation_id
         AND op.tenant_id = tc.tenant_id
         AND op.is_active = TRUE
        LEFT JOIN LATERAL (
          SELECT tso.standard_code
          FROM tenant_standard_operations tso
          JOIN tenant_standards ts
            ON ts.tenant_id = tso.tenant_id
           AND ts.standard_code = tso.standard_code
           AND ts.is_active = TRUE
          WHERE tso.tenant_id = tc.tenant_id
            AND tso.operation_id = tc.operation_id
            AND tso.is_active = TRUE
            AND (
              cc.iso = tso.standard_code
              OR EXISTS (
                SELECT 1
                FROM controls_catalog_standards ccs
                WHERE ccs.control_id = cc.id
                  AND ccs.standard_code = tso.standard_code
              )
            )
          ORDER BY
            CASE WHEN tso.standard_code = cc.iso THEN 0 ELSE 1 END,
            tso.standard_code
          LIMIT 1
        ) scope_match ON TRUE
        WHERE tc.tenant_id = $1
          AND (
            COALESCE(cc.clause, '') ILIKE $2
            OR COALESCE(cc.description, '') ILIKE $2
            OR COALESCE(cc.category, '') ILIKE $2
            OR COALESCE(tc.status, '') ILIKE $2
            OR COALESCE(op.name, '') ILIKE $2
            OR COALESCE(scope_match.standard_code, cc.iso, '') ILIKE $2
          )
        ORDER BY tc.updated_at DESC NULLS LAST, tc.id DESC
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // AUDITORÍAS
      db.query(
        `
        SELECT
          a.id::text AS id,
          'auditoria' AS type,
          COALESCE(a.iso, 'Auditoría') AS title,
          COALESCE(a.status, 'Sin estado') || ' · ' || COALESCE(a.auditor_name, 'Sin auditor') AS subtitle,
          '/auditorias?id=' || a.id ||
          CASE
            WHEN a.iso IS NOT NULL THEN '&iso=' || a.iso
            ELSE ''
          END AS href
        FROM audits a
        WHERE a.tenant_id = $1
          AND (
            COALESCE(a.iso, '') ILIKE $2
            OR COALESCE(a.status, '') ILIKE $2
            OR COALESCE(a.auditor_name, '') ILIKE $2
            OR COALESCE(a.requester_name, '') ILIKE $2
          )
        ORDER BY a.start_date DESC NULLS LAST, a.id DESC
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // PLANES DE ACCIÓN
      db.query(
        `
        SELECT
          ap.id::text AS id,
          'plan' AS type,
          COALESCE(ap.title, 'Plan de acción') AS title,
          COALESCE(ap.status, 'Sin estado') || ' · ' || COALESCE(ap.iso_code, 'Sin norma') AS subtitle,
          '/plan-accion?id=' || ap.id ||
          CASE
            WHEN ap.iso_code IS NOT NULL THEN '&iso=' || ap.iso_code
            ELSE ''
          END ||
          CASE
            WHEN ap.tenant_control_id IS NOT NULL THEN '&tenant_control_id=' || ap.tenant_control_id
            ELSE ''
          END AS href
        FROM action_plans ap
        WHERE ap.tenant_id = $1
          AND (
            COALESCE(ap.title, '') ILIKE $2
            OR COALESCE(ap.description, '') ILIKE $2
            OR COALESCE(ap.owner, '') ILIKE $2
            OR COALESCE(ap.status, '') ILIKE $2
            OR COALESCE(ap.iso_code, '') ILIKE $2
          )
        ORDER BY ap.updated_at DESC NULLS LAST, ap.id DESC
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // HALLAZGOS
      db.query(
        `
        SELECT
          f.id::text AS id,
          'hallazgo' AS type,
          COALESCE(f.title, 'Hallazgo') AS title,
          COALESCE(f.status, 'Sin estado') || ' · ' || COALESCE(f.severity, 'Sin severidad') AS subtitle,
          '/hallazgos?id=' || f.id ||
          CASE
            WHEN f.iso_code IS NOT NULL THEN '&iso=' || f.iso_code
            ELSE ''
          END AS href
        FROM findings f
        WHERE f.tenant_id = $1
          AND (
            COALESCE(f.title, '') ILIKE $2
            OR COALESCE(f.description, '') ILIKE $2
            OR COALESCE(f.status, '') ILIKE $2
            OR COALESCE(f.severity, '') ILIKE $2
            OR COALESCE(f.iso_code, '') ILIKE $2
          )
        ORDER BY f.updated_at DESC NULLS LAST, f.id DESC
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // EVIDENCIAS
      db.query(
        `
        SELECT
          e.id::text AS id,
          'evidencia' AS type,
          COALESCE(NULLIF(e.description, ''), NULLIF(e.file_name, ''), 'Evidencia') AS title,
          COALESCE(e.status, 'Sin estado') || CASE WHEN e.validated THEN ' · validada' ELSE ' · pendiente' END AS subtitle,
          '/evidencias?id=' || e.id ||
          CASE
            WHEN ctx.standard_code IS NOT NULL THEN '&iso=' || ctx.standard_code
            ELSE ''
          END ||
          CASE
            WHEN ctx.tenant_control_id IS NOT NULL THEN '&tenant_control_id=' || ctx.tenant_control_id
            ELSE ''
          END AS href
        FROM evidences e
        LEFT JOIN LATERAL (
          SELECT
            tc.id AS tenant_control_id,
            cc.iso AS standard_code
          FROM tenant_controls tc
          JOIN controls_catalog cc
            ON cc.id = tc.control_id
           AND cc.is_active = TRUE
          WHERE tc.tenant_id = e.tenant_id
            AND (
              tc.id = e.tenant_control_id
              OR (
                e.tenant_control_id IS NULL
                AND e.control_id IS NOT NULL
                AND tc.control_id = e.control_id
              )
            )
          ORDER BY tc.created_at DESC NULLS LAST, tc.id DESC
          LIMIT 1
        ) ctx ON TRUE
        WHERE e.tenant_id = $1
          AND (
            COALESCE(e.description, '') ILIKE $2
            OR COALESCE(e.file_name, '') ILIKE $2
            OR COALESCE(e.status, '') ILIKE $2
          )
        ORDER BY e.created_at DESC NULLS LAST, e.id DESC
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // ACTIVOS
      db.query(
        `
        SELECT
          a.id::text AS id,
          'activo' AS type,
          COALESCE(a.name, 'Activo') AS title,
          COALESCE(a.type, 'Sin tipo') || ' · ' || COALESCE(a.criticality, 'Sin criticidad') AS subtitle,
          '/activos?id=' || a.id ||
          CASE
            WHEN a.iso IS NOT NULL THEN '&iso=' || a.iso
            ELSE ''
          END AS href
        FROM assets a
        WHERE a.tenant_id = $1
          AND (
            COALESCE(a.name, '') ILIKE $2
            OR COALESCE(a.type, '') ILIKE $2
            OR COALESCE(a.owner, '') ILIKE $2
            OR COALESCE(a.iso, '') ILIKE $2
          )
        ORDER BY a.created_at DESC NULLS LAST, a.id DESC
        LIMIT 20
        `,
        [tenantId, like]
      ),

      // RIESGOS DE ACTIVOS -> deep link a Activos para abrir contexto correcto
      db.query(
        `
        SELECT
          ar.id::text AS id,
          'riesgo' AS type,
          COALESCE(ar.risk, 'Riesgo') AS title,
          COALESCE(ar.level, 'Sin nivel') || ' · ' || COALESCE(a.name, 'Sin activo') AS subtitle,
          '/activos?id=' || a.id ||
          CASE
            WHEN a.iso IS NOT NULL THEN '&iso=' || a.iso
            ELSE ''
          END AS href
        FROM asset_risks ar
        JOIN assets a
          ON a.id = ar.asset_id
        WHERE a.tenant_id = $1
          AND (
            COALESCE(ar.risk, '') ILIKE $2
            OR COALESCE(ar.impact, '') ILIKE $2
            OR COALESCE(ar.probability, '') ILIKE $2
            OR COALESCE(ar.level, '') ILIKE $2
            OR COALESCE(a.name, '') ILIKE $2
          )
        ORDER BY ar.id DESC
        LIMIT 20
        `,
        [tenantId, like]
      ),
    ]);

    const results = dedupeAndSort(
      [
        ...standardsRes.rows,
        ...clausesRes.rows,
        ...controlsRes.rows,
        ...auditsRes.rows,
        ...plansRes.rows,
        ...findingsRes.rows,
        ...evidencesRes.rows,
        ...assetsRes.rows,
        ...risksRes.rows,
      ],
      q
    );

    return res.json(results);
  } catch (err) {
    console.error('GLOBAL SEARCH ERROR:', err);
    return res.status(500).json({ error: 'Error en búsqueda global' });
  }
}

async function getRecentSearchHistory(req, res) {
  try {
    const { tenantId } = req.params;
    const requestedUserId = req.query.userId || null;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requerido' });
    }

    if (!(await ensureTenantAccess(req, tenantId))) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const currentUserId = getUserId(req.user);

    let effectiveUserId = currentUserId;

    if (isPlatformRole(role) && requestedUserId) {
      effectiveUserId = requestedUserId;
    }

    let query = `
      SELECT DISTINCT ON (query, COALESCE(result_href, ''))
        id::text,
        query,
        result_type,
        result_title,
        result_href,
        clicked_at
      FROM search_history
      WHERE tenant_id = $1
    `;
    const params = [tenantId];

    if (effectiveUserId) {
      query += ` AND user_id = $2`;
      params.push(effectiveUserId);
    }

    query += `
      ORDER BY query, COALESCE(result_href, ''), clicked_at DESC
      LIMIT 8
    `;

    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error('SEARCH HISTORY ERROR:', err);
    return res.status(500).json({ error: 'Error obteniendo historial' });
  }
}

async function trackSearchClick(req, res) {
  try {
    const {
      tenantId,
      userId,
      query,
      resultType,
      resultTitle,
      resultHref,
    } = req.body || {};

    if (!tenantId || !query) {
      return res.status(400).json({ error: 'tenantId y query son requeridos' });
    }

    if (!(await ensureTenantAccess(req, tenantId))) {
      return res.status(403).json({ error: 'No autorizado para este tenant' });
    }

    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const currentUserId = getUserId(req.user);

    const effectiveUserId = isPlatformRole(role)
      ? userId || currentUserId || null
      : currentUserId || null;

    await db.query(
      `
      INSERT INTO search_history (
        tenant_id,
        user_id,
        query,
        result_type,
        result_title,
        result_href
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        tenantId,
        effectiveUserId,
        String(query).trim(),
        resultType || null,
        resultTitle || null,
        resultHref || null,
      ]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('TRACK SEARCH CLICK ERROR:', err);
    return res.status(500).json({ error: 'Error guardando historial' });
  }
}

module.exports = {
  globalSearch,
  getRecentSearchHistory,
  trackSearchClick,
};
