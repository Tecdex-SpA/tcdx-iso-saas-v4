'use strict';

const {
  assertTenantApplicabilityReady,
  getTenantApplicabilitySummary,
  getTenantApplicableControls,
  getTenantApplicableKpis,
  getTenantApplicableEvidenceRequirements,
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
    standards: new Set(),
  };
  for (const row of rows) {
    if (row.tenant_control_id) keys.tenantControlIds.add(key(row.tenant_control_id));
    if (row.control_catalog_id) keys.catalogControlIds.add(key(row.control_catalog_id));
    if (row.control_code) keys.codes.add(key(row.control_code));
    if (row.control_name) keys.names.add(key(row.control_name).toLowerCase());
    if (row.standard_code) keys.standards.add(key(row.standard_code));
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

function rowStandardCode(row = {}) {
  return key(row.standard_code || row.iso || row.standard);
}

function hasControlIdentity(row = {}) {
  return Boolean(
    row.tenant_control_id ||
      row.control_catalog_id ||
      row.control_id ||
      row.control_code ||
      row.control_name ||
      row.control_description ||
      row.description ||
      row.name ||
      row.clause ||
      row.code
  );
}

function rowKpiName(row = {}) {
  return key(row.kpi_name || row.name || row.custom_label).toLowerCase();
}

function rowKpiCode(row = {}) {
  return key(row.kpi_code || row.code);
}

function hasKpiIdentity(row = {}) {
  return Boolean(
    row.kpi_definition_id ||
      row.kpi_id ||
      row.kpi_code ||
      row.kpi_name ||
      row.name ||
      row.custom_label ||
      row.code
  );
}

function annotate(row, summary) {
  return {
    ...row,
    company_profile_applicability_applied: true,
    applicability_universe_active: summary.active_universe,
  };
}

function buildScopeMeta(summary = {}, extra = {}) {
  const activeUniverse = summary.active_universe !== false && Boolean(summary.tenant_filter_enforced);
  return {
    tenant_filter_enforced: true,
    filtered_by_tenant_id: true,
    applicability_universe_applied: activeUniverse,
    filtered_by_applicability_universe: activeUniverse,
    active_universe: activeUniverse,
    applicability_universe_missing: !activeUniverse,
    calculation_mode: activeUniverse ? 'applicability_universe' : 'legacy_raw_scope',
    effective_controls_count: Number(summary.applicable_controls_count || 0),
    excluded_controls_count: Number(summary.exclusions_count || 0),
    effective_kpis_count: Number(summary.applicable_kpis_count || 0),
    excluded_kpis_count: Number(summary.excluded_kpis_count || 0),
    effective_evidence_requirements_count: Number(summary.applicable_evidence_requirements_count || 0),
    ...extra,
  };
}

async function getTenantApplicabilityScope(tenantId) {
  if (!tenantId) {
    return buildScopeMeta({ active_universe: false, tenant_filter_enforced: false }, {
      tenant_filter_enforced: false,
      filtered_by_tenant_id: false,
      warning: 'tenant_id_missing',
    });
  }
  try {
    const summary = await getTenantApplicabilitySummary({ tenantId });
    return buildScopeMeta(summary, { tenant_id: tenantId });
  } catch (error) {
    return buildScopeMeta({ active_universe: false }, {
      tenant_id: tenantId,
      warning: 'applicability_scope_unavailable',
      error_type: error?.code || error?.name || 'APPLICABILITY_SCOPE_ERROR',
    });
  }
}

async function requireActiveApplicabilityUniverse(tenantId) {
  const summary = await assertTenantApplicabilityReady({ tenantId });
  return buildScopeMeta(summary, { tenant_id: tenantId });
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
      const standard = rowStandardCode(row);
      if (!hasControlIdentity(row)) {
        return standard ? keys.standards.has(standard) : true;
      }
      const tenantControlId = key(row.tenant_control_id || row.id);
      const catalogControlId = key(row.control_catalog_id || row.control_id || row.id);
      const code = rowControlCode(row);
      const name = rowControlName(row);
      const standardMatches = standard && keys.standards.has(standard);
      return (
        (tenantControlId && keys.tenantControlIds.has(tenantControlId)) ||
        (catalogControlId && keys.catalogControlIds.has(catalogControlId)) ||
        (code && keys.codes.has(code)) ||
        (name && keys.names.has(name)) ||
        (!tenantControlId && !catalogControlId && !code && !name && standardMatches)
      );
    })
    .map((row) => annotate(row, summary));
}

async function filterApplicableKpis(rows = [], tenantId) {
  if (!tenantId || !Array.isArray(rows) || rows.length === 0) return rows;
  const summary = await assertTenantApplicabilityReady({ tenantId });
  const applicable = await getTenantApplicableKpis({ tenantId, filters: { limit: 1000 } });
  if (!applicable.length) return [];
  const keys = collectKpiKeys(applicable);
  return rows
    .filter((row) => {
      if (!hasKpiIdentity(row)) return true;
      const definitionId = key(row.kpi_definition_id || row.kpi_id || row.id);
      const code = rowKpiCode(row);
      const name = rowKpiName(row);
      return (
        (definitionId && keys.definitionIds.has(definitionId)) ||
        (code && keys.codes.has(code)) ||
        (name && keys.names.has(name))
      );
    })
    .map((row) => annotate(row, summary));
}

async function filterApplicableEvidenceRequirements(rows = [], tenantId) {
  if (!tenantId || !Array.isArray(rows) || rows.length === 0) return rows;
  const summary = await assertTenantApplicabilityReady({ tenantId });
  const applicable = await getTenantApplicableEvidenceRequirements({ tenantId, filters: { limit: 1000 } });
  if (!applicable.length) return [];
  const names = new Set(applicable.map((row) => key(row.evidence_name).toLowerCase()).filter(Boolean));
  const types = new Set(applicable.map((row) => key(row.evidence_type).toLowerCase()).filter(Boolean));
  return rows
    .filter((row) => {
      const name = key(row.evidence_name || row.title || row.name || row.description).toLowerCase();
      const type = key(row.evidence_type || row.type || row.category).toLowerCase();
      return (name && names.has(name)) || (type && types.has(type)) || (!name && !type);
    })
    .map((row) => annotate(row, summary));
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

function buildApplicabilityJoinForControls(alias) {
  return buildApplicabilityJoinSql(alias, 'control');
}

function buildApplicabilityJoinForKpis(alias) {
  return buildApplicabilityJoinSql(alias, 'kpi');
}

function buildApplicabilityJoinForEvidence(alias) {
  return `
    INNER JOIN tenant_applicable_evidence_requirements tas
      ON tas.tenant_id = ${alias}.tenant_id
     AND tas.active = true
     AND tas.visible_to_tenant = true
     AND (
       tas.related_control_id = ${alias}.tenant_control_id
       OR lower(tas.evidence_name) = lower(${alias}.title)
       OR lower(tas.evidence_name) = lower(${alias}.name)
     )
  `;
}

function assertApplicabilityApplied(responseMeta = {}) {
  return Boolean(
    responseMeta.tenant_filter_enforced === true &&
      responseMeta.filtered_by_tenant_id === true &&
      responseMeta.applicability_universe_applied === true &&
      responseMeta.filtered_by_applicability_universe === true
  );
}

module.exports = {
  getTenantApplicabilityScope,
  requireActiveApplicabilityUniverse,
  filterApplicableControls,
  filterApplicableKpis,
  filterApplicableEvidenceRequirements,
  buildApplicabilityJoinSql,
  buildApplicabilityJoinForControls,
  buildApplicabilityJoinForKpis,
  buildApplicabilityJoinForEvidence,
  assertApplicabilityApplied,
  buildScopeMeta,
};
