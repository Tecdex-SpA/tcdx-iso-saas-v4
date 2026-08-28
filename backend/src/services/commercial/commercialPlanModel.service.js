'use strict';

const { classifyCapability } = require('./commercialPlanMatrix.service');

function normalizeCommercialKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_');
}

const STANDARD_COMMERCIAL_PLANS = [
  {
    standard_plan_key: 'iso',
    plan_key: 'pyme',
    display_name: 'ISO',
    description: 'Dashboard, cumplimiento ISO, controles, evidencias, auditorias, hallazgos, acciones, reportes ISO y matriz de riesgo ISO.',
    sort_order: 10,
  },
  {
    standard_plan_key: 'iso_operational_risk',
    plan_key: 'empresa',
    display_name: 'ISO + Riesgo Operativo',
    description: 'Plan ISO mas riesgo operacional, BIA, continuidad, crisis, eventos de perdida y riesgo cuantitativo.',
    sort_order: 20,
  },
  {
    standard_plan_key: 'grc',
    plan_key: 'enterprise',
    display_name: 'GRC',
    description: 'Catalogo GRC contratado y activo, sin bypass de RBAC ni scope.',
    sort_order: 30,
  },
];

const HISTORIC_PLANS = [
  {
    standard_plan_key: 'demo',
    plan_key: 'demo',
    display_name: 'Demo',
    description: 'Plan historico de evaluacion controlada.',
    sort_order: 90,
    historic: true,
  },
  {
    standard_plan_key: 'legacy',
    plan_key: 'legacy',
    display_name: 'Legacy compatible',
    description: 'Plan historico de compatibilidad para contratos existentes.',
    sort_order: 100,
    historic: true,
  },
];

const ALL_KNOWN_PLANS = [...STANDARD_COMMERCIAL_PLANS, ...HISTORIC_PLANS];

const PLAN_ALIASES = new Map();
for (const plan of ALL_KNOWN_PLANS) {
  PLAN_ALIASES.set(normalizeCommercialKey(plan.plan_key), plan.plan_key);
  PLAN_ALIASES.set(normalizeCommercialKey(plan.standard_plan_key), plan.plan_key);
  PLAN_ALIASES.set(normalizeCommercialKey(plan.display_name), plan.plan_key);
}

PLAN_ALIASES.set('iso_riesgo_operativo', 'empresa');
PLAN_ALIASES.set('iso_riesgo_operacional', 'empresa');
PLAN_ALIASES.set('iso_operativo', 'empresa');
PLAN_ALIASES.set('iso_operational', 'empresa');
PLAN_ALIASES.set('iso_operational_risk', 'empresa');
PLAN_ALIASES.set('iso_riesgo', 'empresa');

function getCommercialPlanDefinition(planKey) {
  const normalized = normalizeCommercialPlanKey(planKey);
  return ALL_KNOWN_PLANS.find((plan) => plan.plan_key === normalized) || null;
}

function normalizeCommercialPlanKey(value, fallback = '') {
  const normalized = normalizeCommercialKey(value);
  if (!normalized) return fallback;
  return PLAN_ALIASES.get(normalized) || normalized;
}

function isKnownCommercialPlan(value) {
  return Boolean(getCommercialPlanDefinition(value));
}

function getAllowedContractPlanKeys() {
  return ALL_KNOWN_PLANS.map((plan) => plan.plan_key);
}

function decorateCommercialPlan(plan) {
  const definition = getCommercialPlanDefinition(plan?.plan_key);
  if (!definition) {
    return {
      ...plan,
      standard_commercial_plan: false,
      commercial_plan_key: plan?.plan_key || null,
      commercial_display_name: plan?.display_name || plan?.plan_key || null,
    };
  }

  return {
    ...plan,
    standard_commercial_plan: definition.historic !== true,
    historic_commercial_plan: definition.historic === true,
    commercial_plan_key: definition.standard_plan_key,
    commercial_display_name: definition.display_name,
    commercial_description: definition.description,
    commercial_sort_order: definition.sort_order,
  };
}

function buildStandardCommercialPlans({ plans = [], versions = [], modules = [], planCapabilities = [] } = {}) {
  const planByKey = new Map(plans.map((plan) => [plan.plan_key, plan]));
  const moduleByKey = new Map(modules.map((module) => [module.module_key, module]));

  return STANDARD_COMMERCIAL_PLANS.map((definition) => {
    const publishedVersions = versions
      .filter((version) => version.plan_key === definition.plan_key && version.status === 'published')
      .sort((left, right) => Number(right.version_number || 0) - Number(left.version_number || 0));
    const currentVersion = publishedVersions[0] || null;
    const capabilities = planCapabilities.filter((row) => row.plan_key === definition.plan_key);
    const moduleKeys = [...new Set(capabilities.map((row) => row.module_key).filter(Boolean))];

    return {
      ...definition,
      source_plan_key: definition.plan_key,
      persisted_plan_key: definition.plan_key,
      current_version_id: currentVersion?.id || currentVersion?.plan_version_id || null,
      current_version_number: currentVersion?.version_number || null,
      status: planByKey.get(definition.plan_key)?.status || 'active',
      modules: moduleKeys.map((moduleKey) => ({
        module_key: moduleKey,
        display_name: moduleByKey.get(moduleKey)?.display_name || moduleKey,
        description: moduleByKey.get(moduleKey)?.description || null,
      })),
      capabilities: capabilities.map((row) => ({
        capability_key: row.capability_key,
        module_key: row.module_key,
        required_permission: row.required_permission || null,
        functional_domain: classifyCapability(row.capability_key)?.classification || null,
      })),
    };
  });
}

module.exports = {
  STANDARD_COMMERCIAL_PLANS,
  HISTORIC_PLANS,
  normalizeCommercialPlanKey,
  isKnownCommercialPlan,
  getAllowedContractPlanKeys,
  getCommercialPlanDefinition,
  decorateCommercialPlan,
  buildStandardCommercialPlans,
};
