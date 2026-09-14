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

  const normalizeSql = (valueSql) => {
    return `regexp_replace(replace(upper(COALESCE(${valueSql}, '')), 'ISOIEC', 'ISO'), '[^A-Z0-9]', '', 'g')`;
  };

  const normalizedStandard = normalizeSql(standardCodeSql);
  const normalizedCatalogIso = normalizeSql(`${catalogAlias}.iso`);
  const normalizedRelationStandard = normalizeSql('ccs_scope.standard_code');
  const matchesVersionIdentity = (candidateSql, versionAlias) => `
    ${normalizeSql(candidateSql)} IN (
      ${normalizeSql(`${versionAlias}.standard_code`)},
      ${normalizeSql(`${versionAlias}.standard_code || ${versionAlias}.version_code`)},
      ${normalizeSql(`${versionAlias}.standard_code || '_' || ${versionAlias}.version_code`)}
    )
  `;

  return `
    (
      ${normalizedCatalogIso} = ${normalizedStandard}
      OR EXISTS (
        SELECT 1
        FROM iso_standard_versions isv_scope
        WHERE isv_scope.is_active IS TRUE
          AND ${matchesVersionIdentity(standardCodeSql, 'isv_scope')}
          AND ${matchesVersionIdentity(`${catalogAlias}.iso`, 'isv_scope')}
      )
      OR EXISTS (
        SELECT 1
        FROM controls_catalog_standards ccs_scope
        WHERE ccs_scope.control_id = ${catalogAlias}.id
          AND (
            ${normalizedRelationStandard} = ${normalizedStandard}
            OR EXISTS (
              SELECT 1
              FROM iso_standard_versions isv_relation_scope
              WHERE isv_relation_scope.is_active IS TRUE
                AND ${matchesVersionIdentity(standardCodeSql, 'isv_relation_scope')}
                AND ${matchesVersionIdentity('ccs_scope.standard_code', 'isv_relation_scope')}
            )
          )
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
