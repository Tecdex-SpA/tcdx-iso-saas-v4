const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
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

function isPlatform(user) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalizeRole(user));
}

function canManageAuditExecution(user) {
  return ['admin', 'tenant_admin', 'auditor'].includes(normalizeRole(user)) || isPlatform(user);
}

function canReadAuditExecution(user) {
  return ['admin', 'tenant_admin', 'auditor', 'operativo', 'viewer'].includes(normalizeRole(user)) || isPlatform(user);
}

function ensureTenantAccess(req, tenantId) {
  if (isPlatform(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
}

async function getAudit(auditId) {
  const result = await pool.query(
    `
    SELECT *
    FROM audits
    WHERE id = $1
    LIMIT 1
    `,
    [auditId]
  );

  return result.rows[0] || null;
}

async function tableExists(tableName) {
  const result = await pool.query(`SELECT to_regclass($1) AS exists`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.exists);
}

async function getColumns(tableName) {
  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

function colExpr(alias, columns, candidates, fallbackSql) {
  const found = candidates.find((column) => columns.has(column));
  return found ? `${alias}."${found}"` : fallbackSql;
}

async function seedChecklistIfEmpty(audit) {
  const existing = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM audit_control_reviews
    WHERE audit_id = $1::uuid
    `,
    [audit.id]
  );

  if (Number(existing.rows[0]?.total || 0) > 0) {
    return;
  }

  const tcCols = await getColumns('tenant_controls');
  const hasCatalog = await tableExists('controls_catalog');
  const ccCols = hasCatalog ? await getColumns('controls_catalog') : new Set();

  const tcStandardExpr = colExpr('tc', tcCols, ['standard_code', 'iso', 'iso_code'], 'NULL');
  const tcTitleExpr = colExpr('tc', tcCols, ['title', 'name', 'control_title'], 'NULL');
  const tcCodeExpr = colExpr('tc', tcCols, ['control_code', 'code'], 'NULL');
  const tcClauseExpr = colExpr('tc', tcCols, ['clause', 'clause_code'], 'NULL');
  const tcStatusExpr = colExpr('tc', tcCols, ['status'], 'NULL');
  const tcHealthExpr = colExpr('tc', tcCols, ['health_status'], 'NULL');
  const tcControlIdExpr = colExpr('tc', tcCols, ['control_id'], 'NULL');

  const ccStandardExpr = hasCatalog ? colExpr('cc', ccCols, ['standard_code', 'iso', 'iso_code'], 'NULL') : 'NULL';
  const ccTitleExpr = hasCatalog ? colExpr('cc', ccCols, ['title', 'name', 'control_title', 'description'], 'NULL') : 'NULL';
  const ccCodeExpr = hasCatalog ? colExpr('cc', ccCols, ['control_code', 'code'], 'NULL') : 'NULL';
  const ccClauseExpr = hasCatalog ? colExpr('cc', ccCols, ['clause', 'clause_code'], 'NULL') : 'NULL';

  const joinCatalog =
    hasCatalog && tcCols.has('control_id')
      ? `LEFT JOIN controls_catalog cc ON cc.id::text = tc.control_id::text`
      : '';

  const standardWhereParts = [];

  if (tcCols.has('standard_code')) standardWhereParts.push(`tc.standard_code = $2`);
  if (tcCols.has('iso')) standardWhereParts.push(`tc.iso = $2`);
  if (tcCols.has('iso_code')) standardWhereParts.push(`tc.iso_code = $2`);

  if (hasCatalog) {
    if (ccCols.has('standard_code')) standardWhereParts.push(`cc.standard_code = $2`);
    if (ccCols.has('iso')) standardWhereParts.push(`cc.iso = $2`);
    if (ccCols.has('iso_code')) standardWhereParts.push(`cc.iso_code = $2`);
  }

  const standardWhere = standardWhereParts.length
    ? `AND (${standardWhereParts.join(' OR ')})`
    : '';

  const sql = `
    INSERT INTO audit_control_reviews (
      audit_id,
      tenant_id,
      tenant_control_id,
      control_code,
      control_title,
      clause,
      initial_status,
      initial_health_status
    )
    SELECT
      $3::uuid AS audit_id,
      tc.tenant_id,
      tc.id,
      COALESCE(${tcCodeExpr}::text, ${ccCodeExpr}::text, tc.id::text) AS control_code,
      COALESCE(${tcTitleExpr}::text, ${ccTitleExpr}::text, 'Control sin título') AS control_title,
      COALESCE(${tcClauseExpr}::text, ${ccClauseExpr}::text, '-') AS clause,
      ${tcStatusExpr}::text AS initial_status,
      ${tcHealthExpr}::text AS initial_health_status
    FROM tenant_controls tc
    ${joinCatalog}
    WHERE tc.tenant_id = $1::uuid
      ${standardWhere}
    ORDER BY COALESCE(${tcClauseExpr}::text, ${ccClauseExpr}::text, ''), COALESCE(${tcCodeExpr}::text, ${ccCodeExpr}::text, tc.id::text)
    LIMIT 250
    ON CONFLICT (audit_id, tenant_control_id)
    WHERE tenant_control_id IS NOT NULL
    DO NOTHING
  `;

  await pool.query(sql, [audit.tenant_id, audit.iso, audit.id]);
}

router.get('/:audit_id/checklist', auth, async (req, res) => {
  try {
    if (!canReadAuditExecution(req.user)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado' });
    }

    const audit = await getAudit(req.params.audit_id);

    if (!audit) {
      return res.status(404).json({ ok: false, error: 'Auditoría no encontrada' });
    }

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para este tenant' });
    }

    await seedChecklistIfEmpty(audit);

    const result = await pool.query(
      `
      SELECT *
      FROM audit_control_reviews
      WHERE audit_id = $1::uuid
      ORDER BY clause NULLS LAST, control_code NULLS LAST, created_at ASC
      `,
      [audit.id]
    );

    return res.json({
      ok: true,
      audit,
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET AUDIT CHECKLIST:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo checklist de auditoría',
      detail: error.message,
    });
  }
});

router.put('/review/:review_id', auth, async (req, res) => {
  try {
    if (!canManageAuditExecution(req.user)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para revisar controles' });
    }

    const { result, notes } = req.body || {};
    const normalized = String(result || 'pendiente').toLowerCase().trim();

    const allowed = ['pendiente', 'conforme', 'observacion', 'no_conforme', 'no_aplica', 'sin_evidencia'];

    if (!allowed.includes(normalized)) {
      return res.status(400).json({
        ok: false,
        error: `Resultado inválido. Usa: ${allowed.join(', ')}`,
      });
    }

    const current = await pool.query(
      `
      SELECT acr.*, a.tenant_id
      FROM audit_control_reviews acr
      JOIN audits a ON a.id = acr.audit_id
      WHERE acr.id = $1::uuid
      LIMIT 1
      `,
      [req.params.review_id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Revisión no encontrada' });
    }

    if (!ensureTenantAccess(req, current.rows[0].tenant_id)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para este tenant' });
    }

    const updated = await pool.query(
      `
      UPDATE audit_control_reviews
      SET
        result = $1,
        notes = $2,
        reviewed_by = $3::uuid,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4::uuid
      RETURNING *
      `,
      [normalized, notes || null, getUserId(req.user), req.params.review_id]
    );

    return res.json({
      ok: true,
      data: updated.rows[0],
    });
  } catch (error) {
    console.error('ERROR UPDATE AUDIT REVIEW:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error actualizando revisión',
      detail: error.message,
    });
  }
});

router.get('/:audit_id/summary', auth, async (req, res) => {
  try {
    if (!canReadAuditExecution(req.user)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado' });
    }

    const audit = await getAudit(req.params.audit_id);

    if (!audit) {
      return res.status(404).json({ ok: false, error: 'Auditoría no encontrada' });
    }

    if (!ensureTenantAccess(req, audit.tenant_id)) {
      return res.status(403).json({ ok: false, code: 'RBAC_DENIED', error: 'No autorizado para este tenant' });
    }

    await seedChecklistIfEmpty(audit);

    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE result = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE result = 'conforme')::int AS conformes,
        COUNT(*) FILTER (WHERE result = 'observacion')::int AS observaciones,
        COUNT(*) FILTER (WHERE result = 'no_conforme')::int AS no_conformes,
        COUNT(*) FILTER (WHERE result = 'no_aplica')::int AS no_aplica,
        COUNT(*) FILTER (WHERE result = 'sin_evidencia')::int AS sin_evidencia
      FROM audit_control_reviews
      WHERE audit_id = $1::uuid
      `,
      [audit.id]
    );

    return res.json({
      ok: true,
      audit,
      summary: result.rows[0] || {},
      note: 'La auditoría en ejecución no deteriora KPI hasta que sus resultados sean formalizados como hallazgos, acciones o evidencias.',
    });
  } catch (error) {
    console.error('ERROR GET AUDIT EXECUTION SUMMARY:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo resumen de ejecución',
      detail: error.message,
    });
  }
});

module.exports = router;
