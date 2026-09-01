#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const {
  CLASSIFICATIONS,
  COMMERCIAL_PLAN_CAPABILITIES,
  capabilitiesForPlan,
} = require(path.join(root, 'backend/src/services/commercial/commercialPlanMatrix.service'));

const MIGRATION = Object.freeze({
  id: '20260828_commercial_standard_plan_matrix',
  file: path.join(root, 'database/migrations/20260828_commercial_standard_plan_matrix.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026082801;

const PLAN_KEYS = Object.freeze(['pyme', 'empresa', 'enterprise']);
const PLAN_LABELS = Object.freeze({
  pyme: 'ISO',
  empresa: 'ISO + Riesgo Operativo',
  enterprise: 'GRC',
});

function sanitize(error) {
  return String(error?.message || 'Commercial Plan Matrix migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function sortUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function capabilityKeys(planKey) {
  return sortUnique(capabilitiesForPlan(planKey).map((capability) => capability.capability_key));
}

function moduleKeys(planKey) {
  return sortUnique(capabilitiesForPlan(planKey).map((capability) => capability.module_key));
}

const EXPECTED = Object.freeze({
  pyme: Object.freeze({
    capabilities: capabilityKeys('pyme'),
    modules: moduleKeys('pyme'),
  }),
  empresa: Object.freeze({
    capabilities: capabilityKeys('empresa'),
    modules: moduleKeys('empresa'),
  }),
  enterprise: Object.freeze({
    capabilities: capabilityKeys('enterprise'),
    modules: moduleKeys('enterprise'),
  }),
});

const HISTORICAL_AI_ADDON_CLASSIFICATION_EVOLUTION = Object.freeze({
  'ai.auditor': Object.freeze({
    historical: CLASSIFICATIONS.GRC_ADVANCED,
    evolved: CLASSIFICATIONS.AI_ADDON,
  }),
  'ai.compliance': Object.freeze({
    historical: CLASSIFICATIONS.GRC_ADVANCED,
    evolved: CLASSIFICATIONS.AI_ADDON,
  }),
});

const HISTORICAL_REQUIRED_PERMISSION_EVOLUTION = Object.freeze({
  'ai.compliance': Object.freeze({
    historical: 'ai_compliance.read',
    evolved: 'ai.view',
  }),
  'iso.actions': Object.freeze({
    historical: 'actions.read',
    evolved: 'actions.view',
  }),
});

const EXPECTED_CLASSIFICATIONS = Object.freeze(
  COMMERCIAL_PLAN_CAPABILITIES.reduce((acc, capability) => {
    acc[capability.capability_key] = capability.classification;
    return acc;
  }, {}),
);

const EXPECTED_REQUIRED_PERMISSIONS = Object.freeze(
  COMMERCIAL_PLAN_CAPABILITIES.reduce((acc, capability) => {
    acc[capability.capability_key] = capability.required_permission;
    return acc;
  }, {}),
);

const HISTORICAL_EXPECTED_CLASSIFICATIONS = Object.freeze(
  COMMERCIAL_PLAN_CAPABILITIES.reduce((acc, capability) => {
    acc[capability.capability_key] =
      HISTORICAL_AI_ADDON_CLASSIFICATION_EVOLUTION[capability.capability_key]?.historical ||
      capability.classification;
    return acc;
  }, {}),
);

function historicalCapabilitiesForPlan(planKey) {
  const normalizedPlanKey = String(planKey || '').trim().toLowerCase();
  const plan = normalizedPlanKey === 'iso'
    ? 'pyme'
    : normalizedPlanKey === 'iso_operational_risk'
      ? 'empresa'
      : normalizedPlanKey === 'grc'
        ? 'enterprise'
        : normalizedPlanKey;

  return COMMERCIAL_PLAN_CAPABILITIES.filter((capability) => {
    const classification = HISTORICAL_EXPECTED_CLASSIFICATIONS[capability.capability_key];
    if (plan === 'pyme') return classification === CLASSIFICATIONS.ISO_ONLY;
    if (plan === 'empresa') {
      return [
        CLASSIFICATIONS.ISO_ONLY,
        CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION,
      ].includes(classification);
    }
    if (plan === 'enterprise') {
      return [
        CLASSIFICATIONS.ISO_ONLY,
        CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION,
        CLASSIFICATIONS.GRC_ADVANCED,
      ].includes(classification);
    }
    return false;
  });
}

function historicalCapabilityKeys(planKey) {
  return sortUnique(historicalCapabilitiesForPlan(planKey).map((capability) => capability.capability_key));
}

function historicalModuleKeys(planKey) {
  return sortUnique(historicalCapabilitiesForPlan(planKey).map((capability) => capability.module_key));
}

const HISTORICAL_EXPECTED = Object.freeze({
  pyme: Object.freeze({
    capabilities: historicalCapabilityKeys('pyme'),
    modules: historicalModuleKeys('pyme'),
  }),
  empresa: Object.freeze({
    capabilities: historicalCapabilityKeys('empresa'),
    modules: historicalModuleKeys('empresa'),
  }),
  enterprise: Object.freeze({
    capabilities: historicalCapabilityKeys('enterprise'),
    modules: historicalModuleKeys('enterprise'),
  }),
});

function normalizeClassification(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeRequiredPermission(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function isAllowedCatalogClassification({ capability_key: capabilityKey, actual_classification: actualClassification }) {
  const key = String(capabilityKey || '').trim();
  const historicalClassification = HISTORICAL_EXPECTED_CLASSIFICATIONS[key];
  const expectedClassification = EXPECTED_CLASSIFICATIONS[key];
  const actual = normalizeClassification(actualClassification || historicalClassification);

  if (!historicalClassification || !expectedClassification) return false;
  if (actual === normalizeClassification(historicalClassification)) return true;

  const allowedEvolution = HISTORICAL_AI_ADDON_CLASSIFICATION_EVOLUTION[key];
  return Boolean(
    allowedEvolution &&
      normalizeClassification(allowedEvolution.historical) === normalizeClassification(historicalClassification) &&
      normalizeClassification(allowedEvolution.evolved) === normalizeClassification(expectedClassification) &&
      actual === normalizeClassification(allowedEvolution.evolved)
  );
}

function findCatalogClassificationDrift(rows) {
  return sortUnique(
    rows
      .filter((row) => !isAllowedCatalogClassification(row))
      .map((row) => row.capability_key)
  );
}

function findAcceptedCatalogClassificationEvolution(rows) {
  return sortUnique(
    rows
      .filter((row) => {
        const key = String(row.capability_key || '').trim();
        const actual = normalizeClassification(row.actual_classification || HISTORICAL_EXPECTED_CLASSIFICATIONS[key]);
        return (
          isAllowedCatalogClassification(row) &&
          actual !== normalizeClassification(HISTORICAL_EXPECTED_CLASSIFICATIONS[key])
        );
      })
      .map((row) => row.capability_key)
  );
}

function isAllowedCatalogPermission({ capability_key: capabilityKey, required_permission: rowExpectedPermission, actual_required_permission: actualRequiredPermission }) {
  const key = String(capabilityKey || '').trim();
  const expectedPermission = normalizeRequiredPermission(
    Object.prototype.hasOwnProperty.call(EXPECTED_REQUIRED_PERMISSIONS, key)
      ? EXPECTED_REQUIRED_PERMISSIONS[key]
      : rowExpectedPermission
  );
  const actualPermission = normalizeRequiredPermission(actualRequiredPermission);

  if (!Object.prototype.hasOwnProperty.call(EXPECTED_REQUIRED_PERMISSIONS, key)) return false;
  if (actualPermission === expectedPermission) return true;

  const allowedEvolution = HISTORICAL_REQUIRED_PERMISSION_EVOLUTION[key];
  return Boolean(
    allowedEvolution &&
      normalizeRequiredPermission(allowedEvolution.evolved) === expectedPermission &&
      actualPermission === normalizeRequiredPermission(allowedEvolution.historical)
  );
}

function findCatalogPermissionDrift(rows) {
  return sortUnique(
    rows
      .filter((row) => !isAllowedCatalogPermission(row))
      .map((row) => row.capability_key)
  );
}

function findAcceptedCatalogPermissionEvolution(rows) {
  return sortUnique(
    rows
      .filter((row) => {
        const key = String(row.capability_key || '').trim();
        const expectedPermission = normalizeRequiredPermission(EXPECTED_REQUIRED_PERMISSIONS[key]);
        const actualPermission = normalizeRequiredPermission(row.actual_required_permission);
        return (
          isAllowedCatalogPermission(row) &&
          actualPermission !== expectedPermission
        );
      })
      .map((row) => row.capability_key)
  );
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`Commercial Plan Matrix migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }

  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateMigrationSqlScope(sql);
  validateMigrationSqlMatchesCanonicalMatrix(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function validateMigrationSqlScope(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const forbidden = [
    /\binsert\s+into\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_subscriptions|tenant_contracts|tenants)\b/,
    /\bupdate\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_subscriptions|tenant_contracts|tenants)\b/,
    /\bdelete\s+from\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
    /\balter\s+\b/,
  ];

  const requiredWrites = [
    /\bupdate\s+(?:public\.)?commercial_plans\b/,
    /\binsert\s+into\s+(?:public\.)?commercial_modules\b/,
    /\binsert\s+into\s+(?:public\.)?commercial_features\b/,
    /\binsert\s+into\s+(?:public\.)?commercial_technical_capabilities\b/,
    /\binsert\s+into\s+(?:public\.)?module_features\b/,
    /\binsert\s+into\s+(?:public\.)?feature_capabilities\b/,
    /\binsert\s+into\s+(?:public\.)?plan_version_modules\b/,
    /\bupdate\s+(?:public\.)?plan_version_modules\b/,
  ];

  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`Commercial Plan Matrix migration contains forbidden SQL scope: ${violation}`);

  const missingRequiredWrite = requiredWrites.find((pattern) => !pattern.test(normalized));
  if (missingRequiredWrite) {
    throw new Error(`Commercial Plan Matrix migration missing expected SQL operation: ${missingRequiredWrite}`);
  }

  if (!/\bclassification\s+in\s*\('iso_only','operational_risk_extension','grc_advanced'\)/.test(normalized)) {
    throw new Error('Commercial Plan Matrix migration must classify capabilities as ISO_ONLY/OPERATIONAL_RISK_EXTENSION/GRC_ADVANCED');
  }
}

function validateMigrationSqlMatchesCanonicalMatrix(sql) {
  const missing = [];
  const historicalClassifications = COMMERCIAL_PLAN_CAPABILITIES.map((capability) =>
    capability.classification === CLASSIFICATIONS.AI_ADDON ? CLASSIFICATIONS.GRC_ADVANCED : capability.classification
  );
  const expectedTokens = [
    'ISO = ONLY_ISO',
    'ISO_RISK = ISO + OPERATIONAL_RISK_ONLY',
    'GRC = ALL_TENANT_COMMERCIAL_CAPABILITIES',
    ...PLAN_KEYS,
    ...COMMERCIAL_PLAN_CAPABILITIES.map((capability) => capability.capability_key),
    ...COMMERCIAL_PLAN_CAPABILITIES.map((capability) => capability.module_key),
    ...historicalClassifications,
  ];

  for (const token of sortUnique(expectedTokens)) {
    if (!sql.includes(token)) missing.push(token);
  }

  if (missing.length) {
    throw new Error(`Commercial Plan Matrix migration does not include canonical matrix tokens: ${missing.join(', ')}`);
  }
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for Commercial Plan Matrix migrations');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) {
    throw new Error('Commercial Plan Matrix migration must contain one outer BEGIN/COMMIT pair');
  }
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

async function requireBaseSchema(client) {
  const result = await client.query(`WITH required_columns(table_name, column_name) AS (
      VALUES
        ('commercial_plans','plan_key'),
        ('commercial_plans','display_name'),
        ('commercial_plans','description'),
        ('commercial_plan_versions','id'),
        ('commercial_plan_versions','plan_key'),
        ('commercial_plan_versions','status'),
        ('commercial_plan_versions','version_number'),
        ('plan_version_modules','plan_version_id'),
        ('plan_version_modules','module_key'),
        ('plan_version_modules','included'),
        ('commercial_modules','module_key'),
        ('commercial_modules','status'),
        ('commercial_features','feature_key'),
        ('commercial_features','status'),
        ('commercial_technical_capabilities','capability_key'),
        ('commercial_technical_capabilities','required_permission'),
        ('commercial_technical_capabilities','status'),
        ('commercial_technical_capabilities','metadata'),
        ('module_features','module_key'),
        ('module_features','feature_key'),
        ('feature_capabilities','feature_key'),
        ('feature_capabilities','capability_key'),
        ('schema_migrations','migration_id'),
        ('schema_migrations','checksum'),
        ('schema_migrations','status'),
        ('schema_migrations','details')
    ),
    column_state AS (
      SELECT
        rc.table_name,
        rc.column_name,
        (c.column_name IS NOT NULL) AS ready
      FROM required_columns rc
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = rc.table_name
       AND c.column_name = rc.column_name
    )
    SELECT
      current_user AS migration_user,
      to_regclass('public.commercial_plans') IS NOT NULL AS commercial_plans_ready,
      to_regclass('public.commercial_plan_versions') IS NOT NULL AS commercial_plan_versions_ready,
      to_regclass('public.plan_version_modules') IS NOT NULL AS plan_version_modules_ready,
      to_regclass('public.commercial_modules') IS NOT NULL AS commercial_modules_ready,
      to_regclass('public.commercial_features') IS NOT NULL AS commercial_features_ready,
      to_regclass('public.commercial_technical_capabilities') IS NOT NULL AS commercial_technical_capabilities_ready,
      to_regclass('public.module_features') IS NOT NULL AS module_features_ready,
      to_regclass('public.feature_capabilities') IS NOT NULL AS feature_capabilities_ready,
      to_regclass('public.schema_migrations') IS NOT NULL AS schema_migrations_ready,
      to_regclass('public.v_commercial_plan_capabilities') IS NOT NULL AS v_commercial_plan_capabilities_ready,
      COALESCE(bool_and(ready), false) AS required_columns_ready
    FROM column_state`);

  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`Commercial Plan Matrix schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function requirePlans(client) {
  const result = await client.query(
    `WITH expected(plan_key) AS (
       SELECT unnest($1::text[])
     )
     SELECT
       e.plan_key,
       p.plan_key IS NOT NULL AS plan_exists,
       EXISTS (
         SELECT 1
         FROM public.commercial_plan_versions cpv
         WHERE cpv.plan_key = e.plan_key
           AND cpv.status = 'published'
       ) AS published_version_exists
     FROM expected e
     LEFT JOIN public.commercial_plans p ON p.plan_key = e.plan_key
     ORDER BY e.plan_key`,
    [PLAN_KEYS],
  );

  for (const row of result.rows) {
    process.stdout.write(`${row.plan_key}_plan_exists=${row.plan_exists}\n`);
    process.stdout.write(`${row.plan_key}_published_version_exists=${row.published_version_exists}\n`);
  }

  const failed = result.rows.filter((row) => row.plan_exists !== true || row.published_version_exists !== true);
  if (failed.length) {
    throw new Error(`Commercial Plan Matrix preflight failed: missing standard plans ${failed.map((row) => row.plan_key).join(', ')}`);
  }
}

async function inspectCurrentCatalog(client) {
  const expectedCapabilities = sortUnique(COMMERCIAL_PLAN_CAPABILITIES.map((capability) => capability.capability_key));
  const expectedModules = sortUnique(COMMERCIAL_PLAN_CAPABILITIES.map((capability) => capability.module_key));

  const capabilityResult = await client.query(
    `WITH expected(capability_key, historical_classification, expected_classification) AS (
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
     )
     SELECT
       count(*)::int AS expected_capabilities,
       count(ctc.capability_key)::int AS existing_capabilities,
       count(ctc.capability_key) FILTER (WHERE ctc.status = 'active')::int AS active_capabilities,
       COALESCE(array_agg(e.capability_key ORDER BY e.capability_key) FILTER (WHERE ctc.capability_key IS NULL), ARRAY[]::text[]) AS missing_capabilities,
       COALESCE(array_agg(e.capability_key ORDER BY e.capability_key) FILTER (WHERE ctc.capability_key IS NOT NULL AND ctc.status IS DISTINCT FROM 'active'), ARRAY[]::text[]) AS inactive_capabilities
     FROM expected e
     LEFT JOIN public.commercial_technical_capabilities ctc
       ON ctc.capability_key = e.capability_key`,
    [
      expectedCapabilities,
      expectedCapabilities.map((key) => HISTORICAL_EXPECTED_CLASSIFICATIONS[key]),
      expectedCapabilities.map((key) => EXPECTED_CLASSIFICATIONS[key]),
    ],
  );

  const catalogResult = await client.query(
    `WITH expected(capability_key, historical_classification, expected_classification, required_permission) AS (
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
     )
     SELECT
       e.capability_key,
       e.historical_classification,
       e.expected_classification,
       e.required_permission,
       ctc.required_permission AS actual_required_permission,
       COALESCE(ctc.metadata->>'commercial_classification', e.historical_classification) AS actual_classification
     FROM expected e
     LEFT JOIN public.commercial_technical_capabilities ctc
       ON ctc.capability_key = e.capability_key
     WHERE ctc.capability_key IS NOT NULL
       AND ctc.status = 'active'
     ORDER BY e.capability_key`,
    [
      expectedCapabilities,
      expectedCapabilities.map((key) => HISTORICAL_EXPECTED_CLASSIFICATIONS[key]),
      expectedCapabilities.map((key) => EXPECTED_CLASSIFICATIONS[key]),
      expectedCapabilities.map((key) => EXPECTED_REQUIRED_PERMISSIONS[key]),
    ],
  );

  const moduleResult = await client.query(
    `WITH expected(module_key) AS (
       SELECT unnest($1::text[])
     )
     SELECT
       count(*)::int AS expected_modules,
       count(cm.module_key)::int AS existing_modules,
       count(cm.module_key) FILTER (WHERE cm.status = 'active')::int AS active_modules,
       COALESCE(array_agg(e.module_key ORDER BY e.module_key) FILTER (WHERE cm.module_key IS NULL), ARRAY[]::text[]) AS missing_modules,
       COALESCE(array_agg(e.module_key ORDER BY e.module_key) FILTER (WHERE cm.module_key IS NOT NULL AND cm.status IS DISTINCT FROM 'active'), ARRAY[]::text[]) AS inactive_modules
     FROM expected e
     LEFT JOIN public.commercial_modules cm
       ON cm.module_key = e.module_key`,
    [expectedModules],
  );

  const capabilityRow = capabilityResult.rows[0] || {};
  const moduleRow = moduleResult.rows[0] || {};
  const classificationDrift = findCatalogClassificationDrift(catalogResult.rows);
  const acceptedClassificationEvolution = findAcceptedCatalogClassificationEvolution(catalogResult.rows);
  const permissionDrift = findCatalogPermissionDrift(catalogResult.rows);
  const acceptedPermissionEvolution = findAcceptedCatalogPermissionEvolution(catalogResult.rows);
  process.stdout.write(`expected_capabilities=${capabilityRow.expected_capabilities}\n`);
  process.stdout.write(`existing_capabilities=${capabilityRow.existing_capabilities}\n`);
  process.stdout.write(`active_capabilities=${capabilityRow.active_capabilities}\n`);
  process.stdout.write(`missing_capabilities=${capabilityRow.missing_capabilities?.length ? capabilityRow.missing_capabilities.join(',') : 'none'}\n`);
  process.stdout.write(`inactive_capabilities=${capabilityRow.inactive_capabilities?.length ? capabilityRow.inactive_capabilities.join(',') : 'none'}\n`);
  process.stdout.write(`permission_drift=${permissionDrift.length ? permissionDrift.join(',') : 'none'}\n`);
  process.stdout.write(`accepted_permission_evolution=${acceptedPermissionEvolution.length ? acceptedPermissionEvolution.join(',') : 'none'}\n`);
  process.stdout.write(`classification_drift=${classificationDrift.length ? classificationDrift.join(',') : 'none'}\n`);
  process.stdout.write(`accepted_classification_evolution=${acceptedClassificationEvolution.length ? acceptedClassificationEvolution.join(',') : 'none'}\n`);
  process.stdout.write(`expected_modules=${moduleRow.expected_modules}\n`);
  process.stdout.write(`existing_modules=${moduleRow.existing_modules}\n`);
  process.stdout.write(`active_modules=${moduleRow.active_modules}\n`);
  process.stdout.write(`missing_modules=${moduleRow.missing_modules?.length ? moduleRow.missing_modules.join(',') : 'none'}\n`);
  process.stdout.write(`inactive_modules=${moduleRow.inactive_modules?.length ? moduleRow.inactive_modules.join(',') : 'none'}\n`);

  if (classificationDrift.length) {
    throw new Error(`Commercial Plan Matrix preflight failed: capability classification drift ${classificationDrift.join(', ')}`);
  }
  if (permissionDrift.length) {
    throw new Error(`Commercial Plan Matrix preflight failed: capability permission drift ${permissionDrift.join(', ')}`);
  }

  return { capabilityRow, moduleRow, classificationDrift, acceptedClassificationEvolution, permissionDrift, acceptedPermissionEvolution };
}

async function migrationState(client, migration) {
  const result = await client.query(
    'SELECT checksum,status FROM public.schema_migrations WHERE migration_id=$1',
    [migration.id],
  );
  if (!result.rowCount) return 'pending';

  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return 'already_applied';
  if (row.status === 'applied') return 'checksum_mismatch';
  if (row.status === 'running') return 'running';
  if (row.status === 'failed') return 'pending';
  return row.status || 'pending';
}

function assertMigrationStateIsSafe(state, migration) {
  if (state === 'checksum_mismatch') {
    const error = new Error(`Commercial Plan Matrix migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`Commercial Plan Matrix migration ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`Commercial Plan Matrix migration ledger has unsupported status ${state}: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
}

async function preflight(client, migration) {
  await requireBaseSchema(client);
  await requirePlans(client);
  await inspectCurrentCatalog(client);
  const state = await migrationState(client, migration);
  process.stdout.write(`migration_state=${state}\n`);
  process.stdout.write(`Commercial Plan Matrix migration preflight OK: pending=${state === 'pending' ? migration.id : 'none'}\n`);
  assertMigrationStateIsSafe(state, migration);
  return state === 'already_applied';
}

function diff(expected, actual) {
  const actualSet = new Set(actual);
  return expected.filter((item) => !actualSet.has(item));
}

function extras(expected, actual) {
  const expectedSet = new Set(expected);
  return actual.filter((item) => !expectedSet.has(item));
}

function assertExact(name, expected, actual) {
  const missing = diff(expected, actual);
  const extra = extras(expected, actual);
  if (missing.length || extra.length) {
    throw new Error(`${name} mismatch: missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'}`);
  }
  return { missing, extra };
}

function compareExact(expected, actual) {
  return {
    missing: diff(expected, actual),
    extra: extras(expected, actual),
  };
}

function assertExactVariant(name, variants, actual) {
  const comparisons = variants.map((variant) => ({
    name: variant.name,
    ...compareExact(variant.expected, actual),
  }));
  const match = comparisons.find((comparison) => comparison.missing.length === 0 && comparison.extra.length === 0);
  if (match) return match;

  throw new Error(`${name} mismatch: ${comparisons.map((comparison) =>
    `${comparison.name}{missing=${comparison.missing.join(',') || 'none'} extra=${comparison.extra.join(',') || 'none'}}`
  ).join(' ')}`);
}

async function fetchPlanState(client) {
  const result = await client.query(
    `SELECT plan_key, module_key, capability_key
     FROM public.v_commercial_plan_capabilities
     WHERE plan_key = ANY($1::text[])
     ORDER BY plan_key, module_key, capability_key`,
    [PLAN_KEYS],
  );

  const state = {};
  for (const planKey of PLAN_KEYS) state[planKey] = { capabilities: [], modules: [] };
  for (const row of result.rows) {
    if (!state[row.plan_key]) continue;
    state[row.plan_key].capabilities.push(row.capability_key);
    state[row.plan_key].modules.push(row.module_key);
  }
  for (const planKey of PLAN_KEYS) {
    state[planKey].capabilities = sortUnique(state[planKey].capabilities);
    state[planKey].modules = sortUnique(state[planKey].modules);
  }
  return state;
}

async function fetchCapabilityCatalogState(client) {
  const expectedCapabilities = sortUnique(COMMERCIAL_PLAN_CAPABILITIES.map((capability) => capability.capability_key));
  const result = await client.query(
    `WITH expected(capability_key, historical_classification, expected_classification, required_permission) AS (
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
     )
     SELECT
       e.capability_key,
       e.historical_classification,
       e.expected_classification,
       e.required_permission,
       ctc.status,
       ctc.required_permission AS actual_required_permission,
       COALESCE(ctc.metadata->>'commercial_classification', e.historical_classification) AS actual_classification
     FROM expected e
     LEFT JOIN public.commercial_technical_capabilities ctc
       ON ctc.capability_key = e.capability_key`,
    [
      expectedCapabilities,
      expectedCapabilities.map((key) => HISTORICAL_EXPECTED_CLASSIFICATIONS[key]),
      expectedCapabilities.map((key) => EXPECTED_CLASSIFICATIONS[key]),
      expectedCapabilities.map((key) => COMMERCIAL_PLAN_CAPABILITIES.find((capability) => capability.capability_key === key).required_permission),
    ],
  );

  const rows = result.rows;
  return {
    expected_count: rows.length,
    active_count: rows.filter((row) => row.status === 'active').length,
    missing: sortUnique(rows.filter((row) => !row.status).map((row) => row.capability_key)),
    inactive: sortUnique(rows.filter((row) => row.status && row.status !== 'active').map((row) => row.capability_key)),
    permission_drift: findCatalogPermissionDrift(rows),
    accepted_permission_evolution: findAcceptedCatalogPermissionEvolution(rows),
    classification_drift: findCatalogClassificationDrift(rows),
    accepted_classification_evolution: findAcceptedCatalogClassificationEvolution(rows),
  };
}

async function postconditions(client) {
  const planState = await fetchPlanState(client);
  const catalogState = await fetchCapabilityCatalogState(client);
  const isoAdvanced = COMMERCIAL_PLAN_CAPABILITIES
    .filter((capability) => capability.classification !== CLASSIFICATIONS.ISO_ONLY)
    .map((capability) => capability.capability_key);
  const isoRiskGrcAdvanced = COMMERCIAL_PLAN_CAPABILITIES
    .filter((capability) => capability.classification === CLASSIFICATIONS.GRC_ADVANCED)
    .map((capability) => capability.capability_key);

  const iso = assertExact('ISO capability matrix', EXPECTED.pyme.capabilities, planState.pyme.capabilities);
  const isoModules = assertExact('ISO module matrix', EXPECTED.pyme.modules, planState.pyme.modules);
  const isoRisk = assertExact('ISO + Riesgo capability matrix', EXPECTED.empresa.capabilities, planState.empresa.capabilities);
  const isoRiskModules = assertExact('ISO + Riesgo module matrix', EXPECTED.empresa.modules, planState.empresa.modules);
  const grc = assertExactVariant('GRC capability matrix', [
    { name: 'historical_grc_with_ai', expected: HISTORICAL_EXPECTED.enterprise.capabilities },
    { name: 'evolved_grc_without_ai', expected: EXPECTED.enterprise.capabilities },
  ], planState.enterprise.capabilities);
  const grcModules = assertExactVariant('GRC module matrix', [
    { name: 'historical_grc_with_ai', expected: HISTORICAL_EXPECTED.enterprise.modules },
    { name: 'evolved_grc_without_ai', expected: EXPECTED.enterprise.modules },
  ], planState.enterprise.modules);
  const isoOverexposure = planState.pyme.capabilities.filter((capabilityKey) => isoAdvanced.includes(capabilityKey));
  const isoRiskOverexposure = planState.empresa.capabilities.filter((capabilityKey) => isoRiskGrcAdvanced.includes(capabilityKey));

  if (isoOverexposure.length) throw new Error(`ISO overexposure: ${isoOverexposure.join(', ')}`);
  if (isoRiskOverexposure.length) throw new Error(`ISO + Riesgo GRC overexposure: ${isoRiskOverexposure.join(', ')}`);

  const catalogFailures = {
    missing: catalogState.missing || [],
    inactive: catalogState.inactive || [],
    permission_drift: catalogState.permission_drift || [],
    accepted_permission_evolution: catalogState.accepted_permission_evolution || [],
    classification_drift: catalogState.classification_drift || [],
    accepted_classification_evolution: catalogState.accepted_classification_evolution || [],
  };
  if ([
    catalogFailures.missing,
    catalogFailures.inactive,
    catalogFailures.permission_drift,
    catalogFailures.classification_drift,
  ].some((values) => values.length)) {
    throw new Error(`Commercial capability catalog postcondition failed: ${JSON.stringify(catalogFailures)}`);
  }

  const coverage = `${catalogState.active_count}/${catalogState.expected_count}`;
  const coveragePct = Number(catalogState.expected_count) === 0
    ? '0%'
    : `${Math.round((Number(catalogState.active_count) / Number(catalogState.expected_count)) * 100)}%`;

  const details = {
    ISO_MATRIX_OK: true,
    ISO_MODULES_OK: isoModules.missing.length === 0 && isoModules.extra.length === 0,
    ISO_OVEREXPOSURE: isoOverexposure.length,
    ISO_UNDEREXPOSURE: iso.missing.length,
    ISO_RISK_MATRIX_OK: true,
    ISO_RISK_MODULES_OK: isoRiskModules.missing.length === 0 && isoRiskModules.extra.length === 0,
    ISO_RISK_GRC_OVEREXPOSURE: isoRiskOverexposure.length,
    ISO_RISK_UNDEREXPOSURE: isoRisk.missing.length,
    GRC_MATRIX_OK: true,
    GRC_MODULES_OK: grcModules.missing.length === 0 && grcModules.extra.length === 0,
    GRC_MATRIX_VARIANT: grc.name,
    GRC_MODULES_VARIANT: grcModules.name,
    GRC_CAPABILITIES_EXPECTED: Number(catalogState.expected_count),
    GRC_CAPABILITIES_ACTIVE: Number(catalogState.active_count),
    GRC_MISSING: grc.missing.length,
    GRC_COVERAGE: coveragePct,
    GRC_COVERAGE_RATIO: coverage,
    PERMISSION_DRIFT: catalogState.permission_drift?.join(',') || 'none',
    ACCEPTED_PERMISSION_EVOLUTION: catalogState.accepted_permission_evolution?.join(',') || 'none',
    CLASSIFICATION_DRIFT: catalogState.classification_drift?.join(',') || 'none',
    ACCEPTED_CLASSIFICATION_EVOLUTION: catalogState.accepted_classification_evolution?.join(',') || 'none',
  };

  for (const [key, value] of Object.entries(details)) process.stdout.write(`${key}=${value}\n`);
  return details;
}

async function run(mode) {
  const migration = readMigration();
  if (mode === 'checksum') {
    process.stdout.write(`${migration.id} checksum=${migration.checksum}\n`);
    return;
  }

  const client = new Client({ connectionString: databaseUrl() });
  const started = Date.now();
  let locked = false;
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) {
      throw new Error('Another Commercial Plan Matrix migration process holds the advisory lock');
    }
    locked = true;

    const done = await preflight(client, migration);
    if (mode === 'preflight') return;
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');

    if (done) {
      await postconditions(client);
      process.stdout.write('Commercial Plan Matrix migration applied: already_applied\n');
      return;
    }

    await client.query('BEGIN');
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_by,status,details)
      VALUES ($1,$2,current_user,'running',$3::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
    [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]);
    await client.query(unwrapTransaction(migration.sql));
    const details = await postconditions(client);
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`Commercial Plan Matrix migration applied: ${migration.id}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger && mode === 'apply') {
      await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_by,status,details)
        VALUES ($1,$2,current_user,'failed',$3::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='failed',details=EXCLUDED.details`,
      [migration.id, migration.checksum, JSON.stringify({ error: sanitize(error) })]).catch(() => null);
    }
    throw error;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1,$2)', [LOCK_NAMESPACE, LOCK_KEY]).catch(() => null);
    await client.end().catch(() => null);
  }
}

if (require.main === module) {
  const arg = process.argv[2] || '--preflight';
  run(arg.replace(/^--/, '')).catch((error) => {
    console.error(`ERROR: ${sanitize(error)}`);
    process.exit(1);
  });
}

module.exports = {
  run,
  _private: {
    HISTORICAL_AI_ADDON_CLASSIFICATION_EVOLUTION,
    HISTORICAL_REQUIRED_PERMISSION_EVOLUTION,
    EXPECTED_CLASSIFICATIONS,
    EXPECTED_REQUIRED_PERMISSIONS,
    HISTORICAL_EXPECTED_CLASSIFICATIONS,
    findAcceptedCatalogPermissionEvolution,
    findAcceptedCatalogClassificationEvolution,
    findCatalogPermissionDrift,
    findCatalogClassificationDrift,
    isAllowedCatalogPermission,
    isAllowedCatalogClassification,
  },
};
