#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function classifyFinding(message) {
  if (message.startsWith('Invalid runtimeState')) {
    return { category: 'invalid_runtime_state', severity: 'critical' };
  }
  if (message.startsWith('Visible productive capability without endpoint')) {
    return { category: 'productive_capability_without_endpoint', severity: 'critical' };
  }
  if (message.startsWith('Non-productive visible capability without feature flag')) {
    return { category: 'non_productive_visible_without_feature_flag', severity: 'critical' };
  }
  if (message.startsWith('Endpoint without static auth signal')) {
    return { category: 'endpoint_without_auth_signal', severity: 'critical' };
  }
  if (message.startsWith('Endpoint without static tenant/data scope signal')) {
    return { category: 'endpoint_without_tenant_scope_signal', severity: 'high' };
  }
  if (message.startsWith('Productive capability without E2E proof')) {
    return { category: 'productive_capability_without_e2e', severity: 'high' };
  }
  if (message.includes('capabilities lack backend endpoint association')) {
    return { category: 'capabilities_without_endpoint_association', severity: 'high' };
  }
  return { category: 'other', severity: 'medium' };
}

function findingKey(category, message) {
  return crypto.createHash('sha256').update(`${category}|${message}`).digest('hex').slice(0, 16);
}

function addFinding(findings, message) {
  const { category, severity } = classifyFinding(message);
  findings.push({
    key: findingKey(category, message),
    category,
    severity,
    message,
  });
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function currentSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (_error) {
    return null;
  }
}

const catalog = readJson('config/capabilities/catalog.json');
const auth = readJson('config/security/authorization-matrix.json');
const summary = readJson('artifacts/fase-0/inventory-summary.json');
const baseline = readJson('config/phase0/contract-findings-baseline.json');

const findings = [];
for (const cap of catalog.capabilities) {
  if (!['productive', 'partial', 'internal', 'beta', 'disabled'].includes(cap.runtimeState)) {
    addFinding(findings, `Invalid runtimeState for ${cap.code}`);
  }
  if (cap.visible && cap.runtimeState === 'productive' && cap.backendEndpoints.length === 0) {
    addFinding(findings, `Visible productive capability without endpoint: ${cap.code}`);
  }
  if (cap.runtimeState === 'productive' && !cap.testCoverage?.e2e) {
    addFinding(findings, `Productive capability without E2E proof: ${cap.code}`);
  }
  if (['partial', 'internal', 'beta', 'disabled'].includes(cap.runtimeState) && cap.visible && !cap.featureFlag) {
    addFinding(findings, `Non-productive visible capability without feature flag: ${cap.code}`);
  }
}
for (const endpoint of auth.authorization) {
  if (endpoint.authSignal !== 'true') {
    addFinding(findings, `Endpoint without static auth signal: ${endpoint.method} ${endpoint.endpoint} (${endpoint.sourceFile})`);
  }
  if (endpoint.dataScope === 'unknown') {
    addFinding(findings, `Endpoint without static tenant/data scope signal: ${endpoint.method} ${endpoint.endpoint} (${endpoint.sourceFile})`);
  }
}
if (summary.capabilitiesWithoutEndpoint > 0) {
  addFinding(findings, `${summary.capabilitiesWithoutEndpoint} capabilities lack backend endpoint association by static inventory`);
}

const baselineFindings = Array.isArray(baseline.findings) ? baseline.findings : [];
const baselineKeys = new Set(baselineFindings.map((finding) => finding.key));
const currentKeys = new Set(findings.map((finding) => finding.key));
const newFindings = findings.filter((finding) => !baselineKeys.has(finding.key));
const removedFindings = baselineFindings.filter((finding) => !currentKeys.has(finding.key));
const newCriticalFindings = newFindings.filter((finding) => finding.severity === 'critical');
const currentCount = findings.length;
const maximumAllowedFindings = Number(baseline.maximumAllowedFindings);
const targetFindings = Number(baseline.targetFindings ?? 0);
const variation = currentCount - maximumAllowedFindings;

let status;
let shouldFail = false;
if (currentCount === 0) {
  status = 'VERIFIED';
} else if (currentCount > maximumAllowedFindings) {
  status = 'REGRESSION';
  shouldFail = true;
} else if (newCriticalFindings.length > 0) {
  status = 'REGRESSION';
  shouldFail = true;
} else if (currentCount < maximumAllowedFindings) {
  status = 'IMPROVED';
} else {
  status = 'BASELINE_ACCEPTED';
}

const phaseStatus = currentCount === 0 && baseline.phaseStatus === 'closed' ? 'CLOSED' : 'OPEN';
const report = {
  checkedAt: new Date().toISOString(),
  analyzedSha: currentSha(),
  status,
  phaseStatus,
  phaseOpenReason: currentCount > targetFindings ? 'Fase 0 continúa abierta mientras existan hallazgos contractuales.' : null,
  currentFindings: currentCount,
  maximumAllowedFindings,
  targetFindings,
  variation,
  regressions: status === 'REGRESSION' ? Math.max(variation, newFindings.length, newCriticalFindings.length) : 0,
  newCriticalFindings: newCriticalFindings.length,
  baselineGeneratedFromSha: baseline.generatedFromSha,
  baselineGeneratedAt: baseline.generatedAt,
  countsByCategory: countBy(findings, 'category'),
  countsBySeverity: countBy(findings, 'severity'),
  baselineCountsByCategory: baseline.countsByCategory || {},
  baselineCountsBySeverity: baseline.countsBySeverity || {},
  newFindings,
  removedFindings,
  findings,
};

fs.mkdirSync('artifacts/fase-0', { recursive: true });
fs.writeFileSync('artifacts/fase-0/phase0-contracts-check.json', JSON.stringify(report, null, 2) + '\n');

const summaryLine = [
  `status=${status}`,
  `phaseStatus=${phaseStatus}`,
  `currentFindings=${currentCount}`,
  `maximumAllowedFindings=${maximumAllowedFindings}`,
  `variation=${variation}`,
  `newFindings=${newFindings.length}`,
  `removedFindings=${removedFindings.length}`,
  `newCriticalFindings=${newCriticalFindings.length}`,
  `analyzedSha=${report.analyzedSha}`,
].join(' ');

if (phaseStatus === 'OPEN') {
  console.warn('Fase 0 ABIERTA: existen hallazgos contractuales pendientes. Este check solo controla regresiones contra la baseline decreciente.');
}
console.log(`phase0 contracts check ${summaryLine}`);
console.log(`categories=${JSON.stringify(report.countsByCategory)}`);
console.log('report=artifacts/fase-0/phase0-contracts-check.json');

if (shouldFail) {
  if (newCriticalFindings.length > 0) {
    console.error(`REGRESSION: ${newCriticalFindings.length} new critical finding(s) detected.`);
  }
  if (currentCount > maximumAllowedFindings) {
    console.error(`REGRESSION: current findings ${currentCount} exceed baseline ${maximumAllowedFindings}.`);
  }
  process.exit(1);
}
