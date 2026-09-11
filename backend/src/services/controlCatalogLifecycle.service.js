'use strict';

function effectiveCatalogPredicate({
  catalogAlias = 'cc',
  catalogModeSql = 'ts.catalog_mode',
  tenantIdSql,
} = {}) {
  if (!tenantIdSql) {
    throw new Error('tenantIdSql is required');
  }

  const mode = `COALESCE(${catalogModeSql}, 'generic')`;
  const globalCatalog = `${catalogAlias}.tenant_id IS NULL`;
  const tenantCatalog = `${catalogAlias}.tenant_id = ${tenantIdSql}`;

  return `
    (
      (${mode} = 'generic' AND ${globalCatalog})
      OR
      (${mode} = 'personalized' AND ${tenantCatalog})
      OR
      (${mode} = 'mixed' AND (${globalCatalog} OR ${tenantCatalog}))
    )
  `;
}

function standardMembershipPredicate({
  catalogAlias = 'cc',
  standardCodeSql,
} = {}) {
  if (!standardCodeSql) {
    throw new Error('standardCodeSql is required');
  }

  const normalizedStandard = `upper(trim(${standardCodeSql}))`;

  return `
    (
      upper(trim(${catalogAlias}.iso)) = ${normalizedStandard}
      OR EXISTS (
        SELECT 1
        FROM controls_catalog_standards ccs_scope
        WHERE ccs_scope.control_id = ${catalogAlias}.id
          AND upper(trim(ccs_scope.standard_code)) = ${normalizedStandard}
      )
    )
  `;
}

function catalogScopeExpression({
  catalogAlias = 'cc',
  tenantIdSql,
} = {}) {
  if (!tenantIdSql) {
    throw new Error('tenantIdSql is required');
  }

  return `
    CASE
      WHEN ${catalogAlias}.tenant_id IS NULL THEN 'global'
      WHEN ${catalogAlias}.tenant_id = ${tenantIdSql} THEN 'tenant'
      ELSE 'out_of_scope'
    END
  `;
}

function equivalenceKeyExpression({ catalogAlias = 'cc' } = {}) {
  return `COALESCE(${catalogAlias}.base_control_id, ${catalogAlias}.id)`;
}

function effectiveCatalogOrder({
  catalogAlias = 'cc',
  tenantIdSql,
  standardCodeSql,
} = {}) {
  if (!tenantIdSql || !standardCodeSql) {
    throw new Error('tenantIdSql and standardCodeSql are required');
  }

  const normalizedStandard = `upper(trim(${standardCodeSql}))`;

  return `
    CASE WHEN ${catalogAlias}.tenant_id = ${tenantIdSql} THEN 0 ELSE 1 END,
    CASE WHEN upper(trim(${catalogAlias}.iso)) = ${normalizedStandard} THEN 0 ELSE 1 END,
    ${catalogAlias}.code,
    ${catalogAlias}.id
  `;
}

module.exports = {
  catalogScopeExpression,
  effectiveCatalogOrder,
  effectiveCatalogPredicate,
  equivalenceKeyExpression,
  standardMembershipPredicate,
};
