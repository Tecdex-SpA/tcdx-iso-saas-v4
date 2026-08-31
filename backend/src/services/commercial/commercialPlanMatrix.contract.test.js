'use strict';

const assert = require('node:assert/strict');

const {
  CLASSIFICATIONS,
  COMMERCIAL_PLAN_CAPABILITIES,
  ADDON_CAPABILITIES,
  capabilitiesForAddon,
  INTERNAL_ROUTE_CAPABILITIES,
  capabilitiesForPlan,
  classificationSummary,
  evaluatePlanCapabilityAccess,
  planAllowsCapability,
} = require('./commercialPlanMatrix.service');

function keys(rows) {
  return rows.map((row) => row.capability_key).sort();
}

function capabilityKeysByClassification(classification) {
  return keys(COMMERCIAL_PLAN_CAPABILITIES.filter((row) => row.classification === classification));
}

function assertExactSet(actual, expected, label) {
  assert.deepStrictEqual([...actual].sort(), [...expected].sort(), label);
}

function assertAllAllowed(planKey, capabilityKeys, label) {
  for (const capabilityKey of capabilityKeys) {
    assert.equal(planAllowsCapability(planKey, capabilityKey), true, `${label} should allow ${capabilityKey}`);
  }
}

function assertAllDenied(planKey, capabilityKeys, label) {
  for (const capabilityKey of capabilityKeys) {
    assert.equal(planAllowsCapability(planKey, capabilityKey), false, `${label} should deny ${capabilityKey}`);
  }
}

function assertAccessDeniedFor(reasonCode, overrides) {
  const result = evaluatePlanCapabilityAccess({
    planKey: 'enterprise',
    capabilityKey: 'metrics.catalog',
    ...overrides,
  });

  assert.equal(result.enabled, false);
  assert.equal(result.decision, 'denied');
  assert.equal(result.reason_code, reasonCode);
}

const isoOnly = capabilityKeysByClassification(CLASSIFICATIONS.ISO_ONLY);
const operationalRisk = capabilityKeysByClassification(CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION);
const grcAdvanced = capabilityKeysByClassification(CLASSIFICATIONS.GRC_ADVANCED);
const aiAddon = capabilityKeysByClassification(CLASSIFICATIONS.AI_ADDON);
const allNonAiCommercial = keys(COMMERCIAL_PLAN_CAPABILITIES.filter((row) => row.classification !== CLASSIFICATIONS.AI_ADDON));

assertExactSet(keys(capabilitiesForPlan('pyme')), isoOnly, 'ISO_ACTUAL must equal ISO_EXPECTED');
assertExactSet(keys(capabilitiesForPlan('iso')), isoOnly, 'ISO alias must equal ISO_EXPECTED');
assertAllAllowed('pyme', isoOnly, 'ISO');
assertAllDenied('pyme', operationalRisk, 'ISO');
assertAllDenied('pyme', grcAdvanced, 'ISO');
assertAllDenied('pyme', aiAddon, 'ISO');

assertExactSet(
  keys(capabilitiesForPlan('empresa')),
  [...isoOnly, ...operationalRisk],
  'ISO_RISK_ACTUAL must equal ISO_EXPECTED + OPERATIONAL_RISK_EXPECTED'
);
assertExactSet(
  keys(capabilitiesForPlan('iso_operational_risk')),
  [...isoOnly, ...operationalRisk],
  'ISO + Riesgo alias must equal ISO_EXPECTED + OPERATIONAL_RISK_EXPECTED'
);
assertAllAllowed('empresa', isoOnly, 'ISO + Riesgo Operativo');
assertAllAllowed('empresa', operationalRisk, 'ISO + Riesgo Operativo');
assertAllDenied('empresa', grcAdvanced, 'ISO + Riesgo Operativo');
assertAllDenied('empresa', aiAddon, 'ISO + Riesgo Operativo');

assertExactSet(keys(capabilitiesForPlan('enterprise')), allNonAiCommercial, 'GRC_ACTUAL must equal all tenant commercial non-AI functionality');
assertExactSet(keys(capabilitiesForPlan('grc')), allNonAiCommercial, 'GRC alias must equal all tenant commercial non-AI functionality');
assertAllAllowed('enterprise', allNonAiCommercial, 'GRC');
assertAllDenied('enterprise', aiAddon, 'GRC without AI add-on');

assertExactSet(keys(capabilitiesForAddon('ai')), ADDON_CAPABILITIES.ai, 'AI add-on must expose canonical AI capabilities');

for (const capability of COMMERCIAL_PLAN_CAPABILITIES) {
  assert.ok(capability.functional_capability, `${capability.capability_key} must describe real functionality`);
  assert.ok(capability.module_key, `${capability.capability_key} must declare module`);
  assert.ok(capability.feature_key, `${capability.capability_key} must declare feature`);
  assert.ok(Array.isArray(capability.routes) && capability.routes.length > 0, `${capability.capability_key} must map routes`);
  assert.ok(
    Array.isArray(capability.backend_endpoints) && capability.backend_endpoints.length > 0,
    `${capability.capability_key} must map backend endpoints/services`
  );
  assert.ok(capability.required_permission, `${capability.capability_key} must keep RBAC permission in chain`);
}

for (const internal of INTERNAL_ROUTE_CAPABILITIES) {
  assert.equal(planAllowsCapability('pyme', internal.capability_key), false, `${internal.capability_key} must not be in ISO`);
  assert.equal(planAllowsCapability('empresa', internal.capability_key), false, `${internal.capability_key} must not be in ISO + Riesgo`);
  assert.equal(planAllowsCapability('enterprise', internal.capability_key), false, `${internal.capability_key} must not be in GRC tenant plan`);
}

assert.deepStrictEqual(classificationSummary()[CLASSIFICATIONS.ISO_ONLY].sort(), isoOnly);
assert.deepStrictEqual(classificationSummary()[CLASSIFICATIONS.OPERATIONAL_RISK_EXTENSION].sort(), operationalRisk);
assert.deepStrictEqual(classificationSummary()[CLASSIFICATIONS.GRC_ADVANCED].sort(), grcAdvanced);
assert.deepStrictEqual(classificationSummary()[CLASSIFICATIONS.AI_ADDON].sort(), aiAddon);
assert.deepStrictEqual(
  classificationSummary()[CLASSIFICATIONS.PLATFORM_INTERNAL].sort(),
  ['core.profile', 'platform.admin', 'tenant.admin'].sort()
);
assert.deepStrictEqual(classificationSummary()[CLASSIFICATIONS.DEALER_INTERNAL], ['dealer.console']);

assert.equal(planAllowsCapability('pyme', 'grc.phase3'), false);
assert.equal(planAllowsCapability('pyme', 'loss.events'), false);
assert.equal(planAllowsCapability('empresa', 'loss.events'), true);
assert.equal(planAllowsCapability('empresa', 'assurance.testing'), false);
assert.equal(planAllowsCapability('empresa', 'reports.premium'), false);
assert.equal(planAllowsCapability('enterprise', 'ai.auditor'), false);
assert.equal(planAllowsCapability('enterprise', 'data.semantic_layer'), true);

assert.equal(evaluatePlanCapabilityAccess({ planKey: 'pyme', capabilityKey: 'iso.compliance' }).enabled, true);
assert.equal(evaluatePlanCapabilityAccess({ planKey: 'pyme', capabilityKey: 'risk.quantitative' }).reason_code, 'CAPABILITY_NOT_INCLUDED_IN_PLAN');
assert.equal(evaluatePlanCapabilityAccess({ planKey: 'empresa', capabilityKey: 'reporting.studio' }).reason_code, 'CAPABILITY_NOT_INCLUDED_IN_PLAN');
assert.equal(evaluatePlanCapabilityAccess({ planKey: 'enterprise', capabilityKey: 'core.profile' }).reason_code, 'CAPABILITY_NOT_COMMERCIAL');
assert.equal(evaluatePlanCapabilityAccess({ planKey: 'enterprise', capabilityKey: 'ai.compliance' }).reason_code, 'ADDON_REQUIRED');

assertAccessDeniedFor('RBAC_PERMISSION_REQUIRED', { hasPermission: false });
assertAccessDeniedFor('SCOPE_FORBIDDEN', { scopeAllowed: false });
assertAccessDeniedFor('SUBSCRIPTION_INACTIVE', { subscriptionStatus: 'canceled' });
assertAccessDeniedFor('TENANT_NOT_ACTIVE', { tenantStatus: 'suspended' });
assertAccessDeniedFor('MODULE_NOT_ACTIVE', { moduleActive: false });

process.stdout.write('COMMERCIAL_PLAN_MATRIX_CONTRACT_PASS\n');
