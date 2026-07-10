'use strict';

const { normalizeIsoCode } = require('./isoStandards');

async function resolveSoAControlReference(client, tenantId, rawControlId, isoCode = null) {
  if (!rawControlId || !tenantId) return null;

  const value = String(rawControlId).trim();
  if (!value) return null;

  const byTenantControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      c.id AS controls_id_legacy,
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
    LEFT JOIN LATERAL (
      SELECT c1.id
      FROM controls c1
      WHERE c1.tenant_id = tc.tenant_id
        AND c1.catalog_control_id = tc.control_id
      ORDER BY c1.created_at ASC NULLS LAST, c1.id ASC
      LIMIT 1
    ) c ON TRUE
    WHERE tc.id = $1
      AND tc.tenant_id = $2
    LIMIT 1
    `,
    [value, tenantId]
  );

  if (byTenantControl.rowCount > 0) {
    return applyIsoMismatch(byTenantControl.rows[0], isoCode);
  }

  const byLegacyControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      c.id AS controls_id_legacy,
      c.tenant_id,
      c.catalog_control_id,
      tc.operation_id,
      cc.iso,
      cc.clause,
      cc.description,
      cc.category
    FROM controls c
    JOIN controls_catalog cc
      ON cc.id = c.catalog_control_id
    JOIN tenant_controls tc
      ON tc.tenant_id = c.tenant_id
     AND tc.control_id = c.catalog_control_id
    WHERE c.id = $1
      AND c.tenant_id = $2
    ORDER BY tc.created_at ASC NULLS LAST, tc.id ASC
    LIMIT 1
    `,
    [value, tenantId]
  );

  if (byLegacyControl.rowCount > 0) {
    return applyIsoMismatch(byLegacyControl.rows[0], isoCode);
  }

  const byCatalogControl = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id_moderno,
      c.id AS controls_id_legacy,
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
    LEFT JOIN LATERAL (
      SELECT c1.id
      FROM controls c1
      WHERE c1.tenant_id = tc.tenant_id
        AND c1.catalog_control_id = tc.control_id
      ORDER BY c1.created_at ASC NULLS LAST, c1.id ASC
      LIMIT 1
    ) c ON TRUE
    WHERE tc.control_id = $1
      AND tc.tenant_id = $2
    ORDER BY tc.created_at ASC NULLS LAST, tc.id ASC
    LIMIT 1
    `,
    [value, tenantId]
  );

  if (byCatalogControl.rowCount > 0) {
    return applyIsoMismatch(byCatalogControl.rows[0], isoCode);
  }

  return null;
}

function applyIsoMismatch(row, isoCode) {
  if (!isoCode || normalizeIsoCode(row.iso) === normalizeIsoCode(isoCode)) return row;
  return { ...row, iso_mismatch: true };
}

module.exports = {
  resolveSoAControlReference,
};
