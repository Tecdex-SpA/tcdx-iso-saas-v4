'use strict';

const { normalizeIsoCode } = require('./isoStandards');

function ambiguousSoAControl(rows) {
  if (rows.length <= 1) return rows[0] || null;
  return {
    ambiguous: true,
    candidate_count: rows.length,
    candidates: rows.map((row) => ({
      tenant_control_id_moderno: row.tenant_control_id_moderno,
      catalog_control_id: row.catalog_control_id,
      operation_id: row.operation_id,
    })),
  };
}

async function resolveSoAControlReference(client, tenantId, rawControlId, isoCode = null) {
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
      cc.iso,
      cc.clause,
      cc.description,
      cc.category
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    WHERE tc.id = $1
      AND tc.tenant_id = $2
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
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      cc.iso,
      cc.clause,
      cc.description,
      cc.category
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    WHERE tc.control_id = $1
      AND tc.tenant_id = $2
    ORDER BY tc.created_at ASC NULLS LAST, tc.id ASC
    `,
    [value, tenantId]
  );

  if (byCatalogControl.rowCount > 0) {
    return applyIsoMismatch(ambiguousSoAControl(byCatalogControl.rows), isoCode);
  }

  return null;
}

function applyIsoMismatch(row, isoCode) {
  if (!row || row.ambiguous) return row;
  if (!isoCode || normalizeIsoCode(row.iso) === normalizeIsoCode(isoCode)) return row;
  return { ...row, iso_mismatch: true };
}

module.exports = {
  resolveSoAControlReference,
  _private: {
    ambiguousSoAControl,
  },
};
