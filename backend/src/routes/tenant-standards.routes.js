const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

const isSuperAdmin = (req) => req.user?.role === 'superadmin';
const isAdmin = (req) => req.user?.role === 'admin' || req.user?.role === 'tenant_admin';

const canAccessTenant = (req, tenantId) => {
  if (isSuperAdmin(req)) return true;
  return req.user?.tenant_id === tenantId;
};

const canManageTenant = (req, tenantId) => {
  if (isSuperAdmin(req)) return true;
  if (isAdmin(req) && req.user?.tenant_id === tenantId) return true;
  return false;
};

const getCatalogMode = async (tenantId, standardCode) => {
  const result = await pool.query(
    `
    SELECT catalog_mode
    FROM tenant_standards
    WHERE tenant_id = $1
      AND standard_code = $2
    LIMIT 1
    `,
    [tenantId, standardCode]
  );

  if (result.rowCount === 0) return 'generic';
  return result.rows[0].catalog_mode || 'generic';
};

function normalizeOperationType(value) {
  const normalized = String(value || 'operacion').trim().toLowerCase();

  if (
    [
      'empresa',
      'operacion',
      'proceso',
      'sede',
      'area',
      'unidad',
      'servicio',
      'planta',
      'sucursal'
    ].includes(normalized)
  ) {
    return normalized;
  }

  return 'operacion';
}

function normalizeOperationIds(value) {
  if (!Array.isArray(value)) return [];

  const unique = new Set();

  for (const item of value) {
    const v = String(item || '').trim();
    if (v) unique.add(v);
  }

  return Array.from(unique);
}

async function ensureDefaultOperation(client, tenantId) {
  const existing = await client.query(
    `
    SELECT *
    FROM tenant_operations
    WHERE tenant_id = $1
      AND is_default = TRUE
    LIMIT 1
    `,
    [tenantId]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  const created = await client.query(
    `
    INSERT INTO tenant_operations (
      tenant_id,
      code,
      name,
      description,
      operation_type,
      is_active,
      is_default,
      sort_order,
      metadata
    )
    VALUES (
      $1,
      'GENERAL',
      'Toda la empresa',
      'Alcance general inicial',
      'empresa',
      TRUE,
      TRUE,
      0,
      '{}'::jsonb
    )
    RETURNING *
    `,
    [tenantId]
  );

  return created.rows[0];
}

async function syncTenantStandardFromOperations(client, tenantId, standardCode) {
  const activeResult = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM tenant_standard_operations tso
    JOIN tenant_operations op
      ON op.id = tso.operation_id
    WHERE tso.tenant_id = $1
      AND tso.standard_code = $2
      AND tso.is_active = TRUE
      AND op.is_active = TRUE
    `,
    [tenantId, standardCode]
  );

  const activeCount = Number(activeResult.rows[0]?.total || 0);
  const isActive = activeCount > 0;

  await client.query(
    `
    INSERT INTO tenant_standards (
      tenant_id,
      standard_code,
      is_active,
      initialized_at,
      catalog_mode
    )
    VALUES (
      $1,
      $2,
      $3,
      CASE WHEN $3 THEN NOW() ELSE NULL END,
      'generic'
    )
    ON CONFLICT (tenant_id, standard_code)
    DO UPDATE SET
      is_active = EXCLUDED.is_active,
      initialized_at = CASE
        WHEN EXCLUDED.is_active THEN COALESCE(tenant_standards.initialized_at, NOW())
        ELSE tenant_standards.initialized_at
      END,
      catalog_mode = COALESCE(tenant_standards.catalog_mode, 'generic')
    `,
    [tenantId, standardCode, isActive]
  );

  const refreshed = await client.query(
    `
    SELECT tenant_id, standard_code, is_active, initialized_at, catalog_mode
    FROM tenant_standards
    WHERE tenant_id = $1
      AND standard_code = $2
    LIMIT 1
    `,
    [tenantId, standardCode]
  );

  return refreshed.rows[0] || null;
}

async function getActiveScopeOperations(client, tenantId) {
  const result = await client.query(
    `
    SELECT
      op.id,
      op.tenant_id,
      op.code,
      op.name,
      op.description,
      op.operation_type,
      op.is_active,
      op.is_default,
      op.sort_order,
      op.metadata,
      op.created_at,
      op.updated_at,
      COUNT(tso.id) FILTER (WHERE tso.is_active = TRUE)::int AS mapped_standards_count,
      COALESCE(
        array_agg(DISTINCT tso.standard_code ORDER BY tso.standard_code)
          FILTER (WHERE tso.is_active = TRUE),
        ARRAY[]::text[]
      ) AS mapped_standard_codes
    FROM tenant_operations op
    LEFT JOIN tenant_standard_operations tso
      ON tso.operation_id = op.id
     AND tso.tenant_id = op.tenant_id
    WHERE op.tenant_id = $1
      AND op.is_active = TRUE
    GROUP BY
      op.id,
      op.tenant_id,
      op.code,
      op.name,
      op.description,
      op.operation_type,
      op.is_active,
      op.is_default,
      op.sort_order,
      op.metadata,
      op.created_at,
      op.updated_at
    ORDER BY
      op.is_default DESC,
      op.sort_order,
      op.name
    `,
    [tenantId]
  );

  return result.rows;
}

async function getOperationalScopeStandards(client, tenantId) {
  const result = await client.query(
    `
    SELECT
      ts.tenant_id,
      ts.standard_code AS code,
      COALESCE(s.name, ts.standard_code) AS name,
      ts.is_active,
      ts.catalog_mode,
      ts.initialized_at,
      scope.active_operations_count,
      scope.active_operation_ids
    FROM tenant_standards ts
    LEFT JOIN standards s
      ON s.code = ts.standard_code
    JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (
          WHERE tso.is_active = TRUE
            AND op.is_active = TRUE
        )::int AS active_operations_count,
        COALESCE(
          array_agg(tso.operation_id ORDER BY op.is_default DESC, op.sort_order, op.name)
            FILTER (
              WHERE tso.is_active = TRUE
                AND op.is_active = TRUE
            ),
          ARRAY[]::uuid[]
        ) AS active_operation_ids
      FROM tenant_standard_operations tso
      JOIN tenant_operations op
        ON op.id = tso.operation_id
       AND op.tenant_id = tso.tenant_id
      WHERE tso.tenant_id = ts.tenant_id
        AND tso.standard_code = ts.standard_code
    ) scope ON TRUE
    WHERE ts.tenant_id = $1
      AND ts.is_active = TRUE
      AND scope.active_operations_count > 0
    ORDER BY ts.standard_code
    `,
    [tenantId]
  );

  return result.rows;
}

// =============================
// OPERACIONES DE UNA EMPRESA
// =============================
router.get('/operations/:tenant_id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id } = req.params;

    if (!canAccessTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await ensureDefaultOperation(client, tenant_id);

    const result = await client.query(
      `
      SELECT
        op.id,
        op.tenant_id,
        op.code,
        op.name,
        op.description,
        op.operation_type,
        op.is_active,
        op.is_default,
        op.sort_order,
        op.metadata,
        op.created_at,
        op.updated_at,
        COUNT(tso.id) FILTER (WHERE tso.is_active = TRUE)::int AS active_standards_count,
        COALESCE(
          array_agg(DISTINCT tso.standard_code ORDER BY tso.standard_code)
            FILTER (WHERE tso.is_active = TRUE),
          ARRAY[]::text[]
        ) AS active_standards
      FROM tenant_operations op
      LEFT JOIN tenant_standard_operations tso
        ON tso.operation_id = op.id
       AND tso.tenant_id = op.tenant_id
      WHERE op.tenant_id = $1
      GROUP BY
        op.id,
        op.tenant_id,
        op.code,
        op.name,
        op.description,
        op.operation_type,
        op.is_active,
        op.is_default,
        op.sort_order,
        op.metadata,
        op.created_at,
        op.updated_at
      ORDER BY
        op.is_default DESC,
        op.sort_order,
        op.name
      `,
      [tenant_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET TENANT OPERATIONS:', err);
    return res.status(500).json({
      error: 'Error obteniendo operaciones',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// CREAR OPERACIÓN
// =============================
router.post('/operations', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      tenant_id,
      code,
      name,
      description,
      operation_type,
      is_active = true,
      is_default = false,
      sort_order = 0,
      metadata = {}
    } = req.body || {};

    if (!tenant_id || !name) {
      return res.status(400).json({
        error: 'tenant_id y name son obligatorios'
      });
    }

    if (!canManageTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await client.query('BEGIN');

    await ensureDefaultOperation(client, tenant_id);

    if (is_default === true) {
      await client.query(
        `
        UPDATE tenant_operations
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE tenant_id = $1
        `,
        [tenant_id]
      );
    }

    const result = await client.query(
      `
      INSERT INTO tenant_operations (
        tenant_id,
        code,
        name,
        description,
        operation_type,
        is_active,
        is_default,
        sort_order,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING *
      `,
      [
        tenant_id,
        code ? String(code).trim() : null,
        String(name).trim(),
        description ? String(description).trim() : null,
        normalizeOperationType(operation_type),
        Boolean(is_active),
        Boolean(is_default),
        Number(sort_order || 0),
        JSON.stringify(metadata || {})
      ]
    );

    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR CREATE TENANT OPERATION:', err);
    return res.status(500).json({
      error: 'Error creando operación',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// EDITAR OPERACIÓN
// =============================
router.put('/operations/:operation_id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { operation_id } = req.params;
    const {
      code,
      name,
      description,
      operation_type,
      is_active,
      is_default,
      sort_order,
      metadata
    } = req.body || {};

    const current = await client.query(
      `
      SELECT *
      FROM tenant_operations
      WHERE id = $1
      LIMIT 1
      `,
      [operation_id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    const row = current.rows[0];

    if (!canManageTenant(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await client.query('BEGIN');

    if (is_default === true) {
      await client.query(
        `
        UPDATE tenant_operations
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE tenant_id = $1
          AND id <> $2
        `,
        [row.tenant_id, operation_id]
      );
    }

    const result = await client.query(
      `
      UPDATE tenant_operations
      SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        operation_type = COALESCE($4, operation_type),
        is_active = COALESCE($5, is_active),
        is_default = COALESCE($6, is_default),
        sort_order = COALESCE($7, sort_order),
        metadata = COALESCE($8::jsonb, metadata),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
      `,
      [
        code !== undefined ? (code ? String(code).trim() : null) : null,
        name !== undefined ? String(name).trim() : null,
        description !== undefined ? (description ? String(description).trim() : null) : null,
        operation_type !== undefined ? normalizeOperationType(operation_type) : null,
        typeof is_active === 'boolean' ? is_active : null,
        typeof is_default === 'boolean' ? is_default : null,
        sort_order !== undefined ? Number(sort_order || 0) : null,
        metadata !== undefined ? JSON.stringify(metadata || {}) : null,
        operation_id
      ]
    );

    if (row.is_active === true && result.rows[0]?.is_active === false) {
      await client.query(
        `
        UPDATE tenant_standard_operations
        SET is_active = FALSE,
            updated_at = NOW()
        WHERE tenant_id = $1
          AND operation_id = $2
        `,
        [row.tenant_id, operation_id]
      );

      const standardsResult = await client.query(
        `
        SELECT DISTINCT standard_code
        FROM tenant_standard_operations
        WHERE tenant_id = $1
          AND operation_id = $2
        `,
        [row.tenant_id, operation_id]
      );

      for (const s of standardsResult.rows) {
        await syncTenantStandardFromOperations(client, row.tenant_id, s.standard_code);
      }
    }

    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR UPDATE TENANT OPERATION:', err);
    return res.status(500).json({
      error: 'Error actualizando operación',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// DESACTIVAR OPERACIÓN
// =============================
router.put('/operations/:operation_id/deactivate', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { operation_id } = req.params;

    const current = await client.query(
      `
      SELECT *
      FROM tenant_operations
      WHERE id = $1
      LIMIT 1
      `,
      [operation_id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    const row = current.rows[0];

    if (!canManageTenant(req, row.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (row.is_default === true) {
      return res.status(400).json({
        error: 'No se puede desactivar la operación por defecto.'
      });
    }

    await client.query('BEGIN');

    await client.query(
      `
      UPDATE tenant_operations
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [operation_id]
    );

    await client.query(
      `
      UPDATE tenant_standard_operations
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE tenant_id = $1
        AND operation_id = $2
      `,
      [row.tenant_id, operation_id]
    );

    const standardsResult = await client.query(
      `
      SELECT DISTINCT standard_code
      FROM tenant_standard_operations
      WHERE tenant_id = $1
        AND operation_id = $2
      `,
      [row.tenant_id, operation_id]
    );

    for (const s of standardsResult.rows) {
      await syncTenantStandardFromOperations(client, row.tenant_id, s.standard_code);
    }

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR DEACTIVATE TENANT OPERATION:', err);
    return res.status(500).json({
      error: 'Error desactivando operación',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// MATRIZ OPERATIVA DE ALCANCE NORMA ↔ OPERACIÓN
// Regla única:
// - tenant_standards.is_active = TRUE
// - tenant_standard_operations.is_active = TRUE
// - tenant_operations.is_active = TRUE
// =============================
router.get('/scope/:tenant_id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id } = req.params;

    if (!canAccessTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await ensureDefaultOperation(client, tenant_id);

    const [operations, standards] = await Promise.all([
      getActiveScopeOperations(client, tenant_id),
      getOperationalScopeStandards(client, tenant_id)
    ]);

    return res.json({
      scope_rule: {
        standard_must_be_active: true,
        mapping_must_be_active: true,
        operation_must_be_active: true
      },
      operations,
      standards
    });
  } catch (err) {
    console.error('ERROR GET TENANT SCOPE MATRIX:', err);
    return res.status(500).json({
      error: 'Error obteniendo matriz de alcance',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// ACTUALIZAR ALCANCE DE UNA NORMA
// =============================
router.put('/scope/:tenant_id/:standard_code', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, standard_code } = req.params;
    const { operation_ids = [] } = req.body || {};

    if (!canManageTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const normalizedOperationIds = normalizeOperationIds(operation_ids);

    const standardExists = await client.query(
      `
      SELECT code, name
      FROM standards
      WHERE code = $1
      LIMIT 1
      `,
      [standard_code]
    );

    if (standardExists.rowCount === 0) {
      return res.status(404).json({ error: 'Norma no encontrada en catálogo' });
    }

    await client.query('BEGIN');
    await ensureDefaultOperation(client, tenant_id);

    if (normalizedOperationIds.length > 0) {
      const operationsCheck = await client.query(
        `
        SELECT id
        FROM tenant_operations
        WHERE tenant_id = $1
          AND is_active = TRUE
          AND id = ANY($2::uuid[])
        `,
        [tenant_id, normalizedOperationIds]
      );

      if (operationsCheck.rowCount !== normalizedOperationIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Una o más operaciones no existen o no están activas para esta empresa.'
        });
      }
    }

    await client.query(
      `
      INSERT INTO tenant_standards (
        tenant_id,
        standard_code,
        is_active,
        initialized_at,
        catalog_mode
      )
      VALUES ($1, $2, FALSE, NULL, 'generic')
      ON CONFLICT (tenant_id, standard_code)
      DO NOTHING
      `,
      [tenant_id, standard_code]
    );

    await client.query(
      `
      UPDATE tenant_standard_operations
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE tenant_id = $1
        AND standard_code = $2
      `,
      [tenant_id, standard_code]
    );

    for (const operationId of normalizedOperationIds) {
      await client.query(
        `
        INSERT INTO tenant_standard_operations (
          tenant_id,
          standard_code,
          operation_id,
          is_active,
          notes
        )
        VALUES ($1, $2, $3, TRUE, 'Asignado desde gestión de alcance')
        ON CONFLICT (tenant_id, standard_code, operation_id)
        DO UPDATE SET
          is_active = TRUE,
          updated_at = NOW()
        `,
        [tenant_id, standard_code, operationId]
      );
    }

    const refreshedStandard = await syncTenantStandardFromOperations(
      client,
      tenant_id,
      standard_code
    );

    const mappings = await client.query(
      `
      SELECT
        tso.tenant_id,
        tso.standard_code,
        tso.operation_id,
        tso.is_active
      FROM tenant_standard_operations tso
      JOIN tenant_operations op
        ON op.id = tso.operation_id
      WHERE tso.tenant_id = $1
        AND tso.standard_code = $2
        AND tso.is_active = TRUE
        AND op.is_active = TRUE
      ORDER BY tso.operation_id
      `,
      [tenant_id, standard_code]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      standard: refreshedStandard,
      active_operation_ids: mappings.rows.map((m) => m.operation_id)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR UPDATE TENANT STANDARD SCOPE:', err);
    return res.status(500).json({
      error: 'Error actualizando alcance de la norma',
      detail: err.message
    });
  } finally {
    client.release();
  }
});

// =============================
// LISTAR NORMAS DE UN TENANT
// Mantiene uso administrativo/comercial,
// pero ahora informa explícitamente si una norma
// está operativamente activa para vistas núcleo.
// =============================
router.get('/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    if (!canAccessTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result = await pool.query(
      `
      SELECT
        COALESCE(ts.id, gen_random_uuid()) AS id,
        $1::uuid AS tenant_id,
        s.code AS standard_code,
        s.code AS code,
        s.name,
        COALESCE(ts.is_active, FALSE) AS is_active,
        COALESCE(ts.catalog_mode, 'generic') AS catalog_mode,
        ts.initialized_at,
        ts.created_at,

        COALESCE(cat.catalog_controls, 0) AS catalog_controls,
        COALESCE(tct.tenant_controls, 0) AS tenant_controls,
        COALESCE(scope.active_operations_count, 0) AS active_operations_count,
        COALESCE(scope.active_operation_ids, ARRAY[]::uuid[]) AS active_operation_ids,
        (
          COALESCE(ts.is_active, FALSE)
          AND COALESCE(scope.active_operations_count, 0) > 0
        ) AS is_operationally_active

      FROM standards s
      LEFT JOIN tenant_standards ts
        ON ts.tenant_id = $1
       AND ts.standard_code = s.code

      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS catalog_controls
        FROM controls_catalog cc
        WHERE cc.iso = s.code
          AND cc.is_active = TRUE
          AND cc.source_type = 'generic'
          AND cc.tenant_id IS NULL
      ) cat ON TRUE

      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS tenant_controls
        FROM tenant_controls tc
        JOIN controls_catalog cc2
          ON cc2.id = tc.control_id
        WHERE tc.tenant_id = $1
          AND cc2.iso = s.code
          AND cc2.is_active = TRUE
      ) tct ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE tso.is_active = TRUE AND op.is_active = TRUE)::int AS active_operations_count,
          COALESCE(
            array_agg(tso.operation_id ORDER BY op.is_default DESC, op.sort_order, op.name)
              FILTER (WHERE tso.is_active = TRUE AND op.is_active = TRUE),
            ARRAY[]::uuid[]
          ) AS active_operation_ids
        FROM tenant_standard_operations tso
        JOIN tenant_operations op
          ON op.id = tso.operation_id
        WHERE tso.tenant_id = $1
          AND tso.standard_code = s.code
      ) scope ON TRUE

      ORDER BY
        (
          COALESCE(ts.is_active, FALSE)
          AND COALESCE(scope.active_operations_count, 0) > 0
        ) DESC,
        COALESCE(ts.is_active, FALSE) DESC,
        s.code
      `,
      [tenant_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('ERROR TENANT STANDARDS:', err);
    res.status(500).json({ error: 'Error tenant standards' });
  }
});

// =============================
// INICIALIZAR NORMA
// =============================
router.post('/initialize', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, standard_code } = req.body;

    if (!tenant_id || !standard_code) {
      return res.status(400).json({ error: 'tenant_id y standard_code son obligatorios' });
    }

    if (!canManageTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const standardExists = await client.query(
      `
      SELECT code, name
      FROM standards
      WHERE code = $1
      LIMIT 1
      `,
      [standard_code]
    );

    if (standardExists.rowCount === 0) {
      return res.status(404).json({ error: 'Norma no encontrada en catálogo' });
    }

    await client.query('BEGIN');

    const defaultOperation = await ensureDefaultOperation(client, tenant_id);

    await client.query(
      `
      INSERT INTO tenant_standards (
        tenant_id,
        standard_code,
        is_active,
        initialized_at,
        catalog_mode
      )
      VALUES ($1, $2, TRUE, NOW(), 'generic')
      ON CONFLICT (tenant_id, standard_code)
      DO UPDATE SET
        is_active = TRUE,
        initialized_at = COALESCE(tenant_standards.initialized_at, NOW())
      `,
      [tenant_id, standard_code]
    );

    await client.query(
      `
      INSERT INTO tenant_standard_operations (
        tenant_id,
        standard_code,
        operation_id,
        is_active,
        notes
      )
      VALUES ($1, $2, $3, TRUE, 'Asignación inicial a operación por defecto')
      ON CONFLICT (tenant_id, standard_code, operation_id)
      DO UPDATE SET
        is_active = TRUE,
        updated_at = NOW()
      `,
      [tenant_id, standard_code, defaultOperation.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      standard_code,
      inserted_count: 0,
      operation_id: defaultOperation.id,
      message: 'Norma activada. Los controles quedan disponibles, no habilitados por defecto.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR INITIALIZE STANDARD:', err);
    res.status(500).json({ error: 'Error inicializando norma' });
  } finally {
    client.release();
  }
});

// =============================
// DESACTIVAR NORMA
// =============================
router.put('/deactivate', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, standard_code } = req.body;

    if (!tenant_id || !standard_code) {
      return res.status(400).json({ error: 'tenant_id y standard_code son obligatorios' });
    }

    if (!canManageTenant(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `
      UPDATE tenant_standards
      SET is_active = FALSE
      WHERE tenant_id = $1
        AND standard_code = $2
      RETURNING *
      `,
      [tenant_id, standard_code]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La norma no estaba asociada a esta empresa' });
    }

    await client.query(
      `
      UPDATE tenant_standard_operations
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE tenant_id = $1
        AND standard_code = $2
      `,
      [tenant_id, standard_code]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      standard_code
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR DEACTIVATE STANDARD:', err);
    res.status(500).json({ error: 'Error desactivando norma' });
  } finally {
    client.release();
  }
});

module.exports = router;
