'use strict';

const { normalizeIsoCode } = require('./isoStandards');

function applyIsoMismatch(row, isoCode) {
  if (!isoCode || normalizeIsoCode(row.iso) === normalizeIsoCode(isoCode)) return row;
  return { ...row, iso_mismatch: true };
}

function pickUnambiguous(rows, mode) {
  if (rows.length <= 1) return rows[0] || null;

  return {
    ambiguous: true,
    candidate_count: rows.length,
    candidates: rows.map((row) => ({
      tenant_control_id_moderno: row.tenant_control_id_moderno,
      catalog_control_id: row.catalog_control_id,
      operation_id: row.operation_id,
      operation_code: row.operation_code || null,
      operation_name: row.operation_name || null,
    })),
  };
}

async function resolveTenantControl(
  client,
  {
    tenantId,
    rawControlId,
    isoCode = null,
    mode = 'strict',
  }
) {
  if (!rawControlId || !tenantId) return null;

  const value = String(rawControlId).trim();
  if (!value) return null;

  const byTenantControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      tc.tenant_id,
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      op.code AS operation_code,
      op.name AS operation_name,
      op.is_active AS operation_is_active,
      cc.iso,
      cc.clause,
      cc.description,
      cc.category,
      'tenant_control' AS identity_source
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    LEFT JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
    WHERE tc.id = $1::uuid
      AND tc.tenant_id = $2::uuid
    LIMIT 1
    `,
    [value, tenantId]
  );

  if (byTenantControl.rowCount > 0) {
    return applyIsoMismatch(byTenantControl.rows[0], isoCode);
  }

  const byCatalogControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      tc.tenant_id,
      cc.id AS catalog_control_id,
      tc.operation_id,
      op.code AS operation_code,
      op.name AS operation_name,
      op.is_active AS operation_is_active,
      cc.iso,
      cc.clause,
      cc.description,
      cc.category,
      'catalog_control' AS identity_source
    FROM controls_catalog cc
    JOIN tenant_controls tc
      ON tc.tenant_id = $2::uuid
     AND tc.control_id = cc.id
    LEFT JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
    WHERE cc.id = $1::uuid
    ORDER BY
      CASE WHEN op.is_default = TRUE THEN 0 ELSE 1 END,
      tc.created_at ASC NULLS LAST,
      tc.id ASC
    `,
    [value, tenantId]
  );

  if (byCatalogControl.rowCount > 0) {
    return applyIsoMismatch(pickUnambiguous(byCatalogControl.rows, mode), isoCode);
  }

  return null;
}

function assertResolvedTenantControl(result) {
  if (!result) {
    const error = new Error('TENANT_CONTROL_NOT_RESOLVED');
    error.code = 'TENANT_CONTROL_NOT_RESOLVED';
    throw error;
  }

  if (result.ambiguous) {
    const error = new Error('TENANT_CONTROL_ID_AMBIGUOUS');
    error.code = 'TENANT_CONTROL_ID_AMBIGUOUS';
    error.details = result.candidates || [];
    throw error;
  }

  if (!result.tenant_control_id_moderno) {
    const error = new Error('TENANT_CONTROL_ID_MISSING');
    error.code = 'TENANT_CONTROL_ID_MISSING';
    throw error;
  }

  return result;
}

module.exports = {
  resolveTenantControl,
  assertResolvedTenantControl,
  _private: {
    pickUnambiguous,
  },
};
