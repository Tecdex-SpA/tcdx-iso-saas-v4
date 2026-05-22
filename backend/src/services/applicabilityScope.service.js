'use strict';

const {
  assertTenantApplicabilityReady,
  getTenantApplicableControls,
  getTenantApplicableKpis,
} = require('./companyProfileApplicabilityEngine.service');

function key(value) {
  return value === null || value === undefined ? '' : String(value);
}

function collectControlKeys(rows = []) {
  const keys = {
    tenantControlIds: new Set(),
    catalogControlIds: new Set(),
    codes: new Set(),
    names: new Set(),
  };
  for (const row of rows) {
    if (row.tenant_control_id) keys.tenantControlIds.add(key(row.tenant_control_id));
    if (row.control_catalog_id) keys.catalogControlIds.add(key(row.control_catalog_id));
    if (row.control_code) keys.codes.add(key(row.control_code));
    if (row.control_name) keys.names.add(key(row.control_name).toLowerCase());
  }
  return keys;
}

function collectKpiKeys(rows = []) {
  const keys = {
    definitionIds: new Set(),
    codes: new Set(),
    names: new Set(),
  };
  for (const row of rows) {
    if (row.kpi_definition_id) keys.definitionIds.add(key(row.kpi_definition_id));
    if (row.kpi_code) keys.codes.add(key(row.kpi_code));
    if (row.kpi_name) keys.names.add(key(row.kpi_name).toLowerCase());
  }
  return keys;
}

function rowControlName(row = {}) {
  return key(row.control_name || row.description || row.control_description || row.name).toLowerCase();
}

function rowControlCode(row = {}) {
  return key(row.control_code || row.clause || row.code);
}

function rowKpiName(row = {}) {
  return key(row.kpi_name || row.name || row.custom_label).toLowerCase();
}

function rowKpiCode(row = {}) {
  return key(row.kpi_code || row.code);
}

async function filterApplicableControls(rows = [], tenantId, options = {}) {
  if (!tenantId || !Array.isArray(rows) || rows.length === 0) return rows;
  const summary = await assertTenantApplicabilityReady({ tenantId });
  const applicable = await getTenantApplicableControls({
    tenantId,
    filters: {
      standard_code: options.standardCode || options.standard_code || null,
      limit: 1000,
    },
  });
  if (!applicable.length) return [];
  const keys = collectControlKeys(applicable);
  return rows
    .filter((row) => {
      const tenantControlId = key(row.tenant_control_id || row.id);
      const catalogControlId = key(row.control_catalog_id || row.control_id || row.id);
      const code = rowControlCode(row);
      const name = rowControlName(row);
      return (
        (tenantControlId && keys.tenantControlIds.has(tenantControlId)) ||
        (catalogControlId && keys.catalogControlIds.has(catalogControlId)) ||
        (code && keys.codes.has(code)) ||
        (name && keys.names.has(name))
      );
    })
    .map((row) => ({
      ...row,
      company_profile_applicability_applied: true,
      applicability_universe_active: summary.active_universe,
    }));
}

async function filterApplicableKpis(rows = [], tenantId) {
  if (!tenantId || !Array.isArray(rows) || rows.length === 0) return rows;
  const summary = await assertTenantApplicabilityReady({ tenantId });
  const applicable = await getTenantApplicableKpis({ tenantId, filters: { limit: 1000 } });
  if (!applicable.length) return [];
  const keys = collectKpiKeys(applicable);
  return rows
    .filter((row) => {
      const definitionId = key(row.kpi_definition_id || row.kpi_id || row.id);
      const code = rowKpiCode(row);
      const name = rowKpiName(row);
      return (
        (definitionId && keys.definitionIds.has(definitionId)) ||
        (code && keys.codes.has(code)) ||
        (name && keys.names.has(name))
      );
    })
    .map((row) => ({
      ...row,
      company_profile_applicability_applied: true,
      applicability_universe_active: summary.active_universe,
    }));
}

function buildApplicabilityJoinSql(alias, objectType) {
  const table = objectType === 'kpi' ? 'tenant_applicable_kpis' : 'tenant_applicable_controls';
  const tenantColumn = `${alias}.tenant_id`;
  if (objectType === 'kpi') {
    return `
      INNER JOIN ${table} tas
        ON tas.tenant_id = ${tenantColumn}
       AND tas.active = true
       AND tas.visible_to_tenant = true
       AND (
         tas.kpi_definition_id = ${alias}.kpi_id
         OR tas.kpi_definition_id = ${alias}.id
         OR tas.kpi_code = ${alias}.code
       )
    `;
  }
  return `
    INNER JOIN ${table} tas
      ON tas.tenant_id = ${tenantColumn}
     AND tas.active = true
     AND tas.visible_to_tenant = true
     AND (
       tas.tenant_control_id = ${alias}.tenant_control_id
       OR tas.control_catalog_id = ${alias}.catalog_control_id
       OR tas.control_catalog_id = ${alias}.control_id
     )
  `;
}

module.exports = {
  filterApplicableControls,
  filterApplicableKpis,
  buildApplicabilityJoinSql,
};
