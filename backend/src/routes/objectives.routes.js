const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

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

function ensureTenantAccess(req, tenantId) {
  if (isSuperAdmin(req.user)) return true;
  return String(getUserTenantId(req.user)) === String(tenantId);
}

function normalizeNullableText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeProgress(value, targetValue, actualValue, status) {
  const explicit = normalizeNumber(value);

  if (explicit !== null) {
    return Math.max(0, Math.min(100, Math.round(explicit * 100) / 100));
  }

  const target = normalizeNumber(targetValue);
  const actual = normalizeNumber(actualValue);

  if (target !== null && target > 0 && actual !== null) {
    return Math.max(0, Math.min(100, Math.round((actual / target) * 10000) / 100));
  }

  const s = String(status || '').toLowerCase();
  if (['cumplido', 'cumplida', 'completado', 'completada', 'cerrado', 'cerrada', 'completed', 'achieved', 'done'].includes(s)) {
    return 100;
  }

  return null;
}

function normalizeStatus(value) {
  const raw = String(value || '').trim().toLowerCase();

  const map = {
    pendiente: 'pendiente',
    pending: 'pendiente',

    en_progreso: 'en_progreso',
    'en progreso': 'en_progreso',
    progreso: 'en_progreso',
    in_progress: 'en_progreso',
    'in progress': 'en_progreso',

    cumplido: 'cumplido',
    cumplida: 'cumplido',
    completado: 'cumplido',
    completada: 'cumplido',
    cerrado: 'cumplido',
    cerrada: 'cumplido',
    completed: 'cumplido',
    achieved: 'cumplido',
    done: 'cumplido',

    atrasado: 'atrasado',
    atrasada: 'atrasado',
    overdue: 'atrasado',

    cancelado: 'cancelado',
    cancelada: 'cancelado',
    cancelled: 'cancelado',
  };

  return map[raw] || 'en_progreso';
}

function objectiveSelectSql() {
  return `
    SELECT
      id,
      tenant_id,
      standard_code,
      title,
      description,
      owner,
      period_type,
      period_start,
      period_end,
      target_value,
      actual_value,
      progress_percent,
      status,
      is_active,
      evidence_url,
      notes,
      created_at,
      updated_at
    FROM management_objectives
  `;
}

// =====================================================
// GET /api/objectives/:tenant_id
// =====================================================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { standard_code, status, active = 'true' } = req.query;

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ ok: false, error: 'No autorizado para este tenant' });
    }

    const params = [tenant_id];
    let idx = 2;

    let query = `
      ${objectiveSelectSql()}
      WHERE tenant_id = $1
    `;

    if (active !== 'all') {
      query += ` AND is_active = ${active === 'false' ? 'false' : 'true'}`;
    }

    if (standard_code && standard_code !== 'ALL') {
      query += ` AND (standard_code = $${idx} OR standard_code IS NULL)`;
      params.push(String(standard_code));
      idx++;
    }

    if (status && status !== 'ALL') {
      query += ` AND status = $${idx}`;
      params.push(String(status));
      idx++;
    }

    query += `
      ORDER BY
        COALESCE(period_end, current_date) DESC,
        created_at DESC
    `;

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('ERROR GET OBJECTIVES:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error obteniendo objetivos',
      detail: error.message,
    });
  }
});

// =====================================================
// POST /api/objectives
// =====================================================
router.post('/', auth, async (req, res) => {
  try {
    const {
      tenant_id,
      standard_code,
      title,
      description,
      owner,
      period_type = 'mensual',
      period_start,
      period_end,
      target_value,
      actual_value,
      progress_percent,
      status = 'en_progreso',
      evidence_url,
      notes,
    } = req.body || {};

    if (!tenant_id || !ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ ok: false, error: 'No autorizado para este tenant' });
    }

    const cleanTitle = String(title || '').trim();

    if (!cleanTitle) {
      return res.status(400).json({ ok: false, error: 'El título del objetivo es obligatorio' });
    }

    const normalizedStatus = normalizeStatus(status);
    const normalizedProgress = normalizeProgress(
      progress_percent,
      target_value,
      actual_value,
      normalizedStatus
    );

    const result = await pool.query(
      `
      INSERT INTO management_objectives (
        tenant_id,
        standard_code,
        title,
        description,
        owner,
        period_type,
        period_start,
        period_end,
        target_value,
        actual_value,
        progress_percent,
        status,
        is_active,
        evidence_url,
        notes
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        NULLIF($7, '')::date,
        NULLIF($8, '')::date,
        $9,
        $10,
        $11,
        $12,
        true,
        $13,
        $14
      )
      RETURNING *
      `,
      [
        tenant_id,
        normalizeNullableText(standard_code),
        cleanTitle,
        normalizeNullableText(description),
        normalizeNullableText(owner),
        String(period_type || 'mensual'),
        period_start || null,
        period_end || null,
        normalizeNumber(target_value),
        normalizeNumber(actual_value),
        normalizedProgress,
        normalizedStatus,
        normalizeNullableText(evidence_url),
        normalizeNullableText(notes),
      ]
    );

    return res.status(201).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('ERROR CREATE OBJECTIVE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error creando objetivo',
      detail: error.message,
    });
  }
});

// =====================================================
// PUT /api/objectives/:id
// =====================================================
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const current = await pool.query(
      `SELECT id, tenant_id FROM management_objectives WHERE id = $1::uuid LIMIT 1`,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Objetivo no encontrado' });
    }

    const tenantId = current.rows[0].tenant_id;

    if (!ensureTenantAccess(req, tenantId)) {
      return res.status(403).json({ ok: false, error: 'No autorizado para este tenant' });
    }

    const {
      standard_code,
      title,
      description,
      owner,
      period_type,
      period_start,
      period_end,
      target_value,
      actual_value,
      progress_percent,
      status,
      evidence_url,
      notes,
      is_active,
    } = req.body || {};

    const cleanTitle = String(title || '').trim();

    if (!cleanTitle) {
      return res.status(400).json({ ok: false, error: 'El título del objetivo es obligatorio' });
    }

    const normalizedStatus = normalizeStatus(status);
    const normalizedProgress = normalizeProgress(
      progress_percent,
      target_value,
      actual_value,
      normalizedStatus
    );

    const result = await pool.query(
      `
      UPDATE management_objectives
      SET
        standard_code = $1,
        title = $2,
        description = $3,
        owner = $4,
        period_type = $5,
        period_start = NULLIF($6, '')::date,
        period_end = NULLIF($7, '')::date,
        target_value = $8,
        actual_value = $9,
        progress_percent = $10,
        status = $11,
        evidence_url = $12,
        notes = $13,
        is_active = COALESCE($14, is_active)
      WHERE id = $15::uuid
      RETURNING *
      `,
      [
        normalizeNullableText(standard_code),
        cleanTitle,
        normalizeNullableText(description),
        normalizeNullableText(owner),
        String(period_type || 'mensual'),
        period_start || null,
        period_end || null,
        normalizeNumber(target_value),
        normalizeNumber(actual_value),
        normalizedProgress,
        normalizedStatus,
        normalizeNullableText(evidence_url),
        normalizeNullableText(notes),
        typeof is_active === 'boolean' ? is_active : null,
        id,
      ]
    );

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('ERROR UPDATE OBJECTIVE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error actualizando objetivo',
      detail: error.message,
    });
  }
});

// =====================================================
// DELETE /api/objectives/:id
// Soft delete
// =====================================================
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const current = await pool.query(
      `SELECT id, tenant_id FROM management_objectives WHERE id = $1::uuid LIMIT 1`,
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Objetivo no encontrado' });
    }

    const tenantId = current.rows[0].tenant_id;

    if (!ensureTenantAccess(req, tenantId)) {
      return res.status(403).json({ ok: false, error: 'No autorizado para este tenant' });
    }

    const result = await pool.query(
      `
      UPDATE management_objectives
      SET
        is_active = false,
        status = 'cancelado'
      WHERE id = $1::uuid
      RETURNING *
      `,
      [id]
    );

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('ERROR DELETE OBJECTIVE:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error eliminando objetivo',
      detail: error.message,
    });
  }
});

module.exports = router;
