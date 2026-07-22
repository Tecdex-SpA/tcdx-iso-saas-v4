#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function lineEvidence(file, line) {
  return { evidenceFile: file || '', evidenceLine: line || null };
}

function classify({ finding, currentKeys, currentAuthByMessage }) {
  const current = currentKeys.has(finding.key);
  const base = {
    findingId: finding.key,
    endpoint: null,
    method: null,
    routeFile: null,
    handler: null,
    service: null,
    repository: null,
    authMechanism: null,
    permissionMechanism: null,
    tenantMechanism: null,
    dataScopeMechanism: null,
    publicJustification: null,
    evidenceFile: null,
    evidenceLine: null,
    classification: 'requires_dynamic_verification',
    severity: finding.severity,
    actionRequired: 'dynamic_verification_required',
    status: current ? 'remaining' : 'removed_by_detector_correction',
    originalCategory: finding.category,
    message: finding.message,
  };

  const endpointMatch = finding.message.match(/^Endpoint without static (auth|tenant\/data scope) signal: (\w+)\s+([^\s]+)\s+\(([^)]+)\)$/);
  if (endpointMatch) {
    base.method = endpointMatch[2];
    base.endpoint = endpointMatch[3];
    base.routeFile = endpointMatch[4];
    const evidence = currentAuthByMessage.get(finding.message);
    if (evidence) {
      base.endpoint = evidence.endpoint;
      base.routeFile = evidence.sourceFile;
      base.evidenceFile = evidence.appMountFile || evidence.sourceFile;
      base.evidenceLine = evidence.appMountLine || evidence.sourceLine || null;
      base.authMechanism = evidence.authMechanism || null;
      base.permissionMechanism = evidence.permissionMechanism || null;
      base.tenantMechanism = evidence.tenantMechanism || null;
      base.dataScopeMechanism = evidence.dataScope || null;
      base.publicJustification = evidence.publicJustification || null;
    }
    if (!current) {
      if (finding.category === 'endpoint_without_auth_signal') {
        base.classification = 'middleware_global_not_detected';
        base.severity = 'low';
        base.actionRequired = 'none_detector_corrected';
      } else {
        base.classification = 'repository_scope_not_detected';
        base.severity = 'low';
        base.actionRequired = 'none_detector_corrected_or_file_scope_detected';
      }
    } else if (finding.category === 'endpoint_without_tenant_scope_signal') {
      base.classification = 'requires_dynamic_verification';
      base.actionRequired = 'prove_or_add_tenant_scope';
    }
    return base;
  }

  const capFlag = finding.message.match(/^Non-productive visible capability without feature flag: (.+)$/);
  if (capFlag) {
    base.endpoint = capFlag[1];
    base.classification = current ? 'critical' : 'capability_contract_completed';
    base.actionRequired = current ? 'classify_capability_disposition_and_add_authoritative_flag_or_complete_backend_contract' : 'none_contract_completed';
    return base;
  }

  const e2e = finding.message.match(/^Productive capability without E2E proof: (.+)$/);
  if (e2e) {
    base.endpoint = e2e[1];
    base.classification = current ? 'high' : 'e2e_coverage_added';
    base.actionRequired = current ? 'implement_critical_e2e_or_attach_existing_evidence' : 'none_e2e_coverage_added';
    return base;
  }

  if (finding.message.includes('capabilities lack backend endpoint association')) {
    base.classification = current ? 'high' : 'endpoint_mapping_completed';
    base.actionRequired = current ? 'improve_route_endpoint_mapping_or_complete_contracts' : 'none_endpoint_mapping_completed';
    return base;
  }

  return base;
}

const baseline = readJson('config/phase0/contract-findings-baseline.json');
const currentReport = readJson('artifacts/fase-0/phase0-contracts-check.json');
const authMatrix = readJson('config/security/authorization-matrix.json');
const currentKeys = new Set(currentReport.findings.map((f) => f.key));
const currentAuthByMessage = new Map();
for (const endpoint of authMatrix.authorization) {
  currentAuthByMessage.set(`Endpoint without static auth signal: ${endpoint.method} ${endpoint.endpoint} (${endpoint.sourceFile})`, endpoint);
  currentAuthByMessage.set(`Endpoint without static tenant/data scope signal: ${endpoint.method} ${endpoint.endpoint} (${endpoint.sourceFile})`, endpoint);
  if (endpoint.sourceRoutePath) {
    currentAuthByMessage.set(`Endpoint without static auth signal: ${endpoint.method} ${endpoint.sourceRoutePath} (${endpoint.sourceFile})`, endpoint);
    currentAuthByMessage.set(`Endpoint without static tenant/data scope signal: ${endpoint.method} ${endpoint.sourceRoutePath} (${endpoint.sourceFile})`, endpoint);
  }
}
const originalFindingsByKey = new Map();
for (const finding of [
  ...(Array.isArray(baseline.findings) ? baseline.findings : []),
  ...(Array.isArray(baseline.removedFindings) ? baseline.removedFindings : []),
]) {
  originalFindingsByKey.set(finding.key, finding);
}

const originalFindings = Array.from(originalFindingsByKey.values());
const findings = originalFindings.map((finding) => classify({ finding, currentKeys, currentAuthByMessage }));
const counts = findings.reduce((acc, finding) => {
  acc.byClassification[finding.classification] = (acc.byClassification[finding.classification] || 0) + 1;
  acc.byStatus[finding.status] = (acc.byStatus[finding.status] || 0) + 1;
  acc.bySeverity[finding.severity] = (acc.bySeverity[finding.severity] || 0) + 1;
  return acc;
}, { byClassification: {}, byStatus: {}, bySeverity: {} });
const report = {
  generatedAt: new Date().toISOString(),
  baselineSha: baseline.generatedFromSha,
  currentBaselineFindings: Array.isArray(baseline.findings) ? baseline.findings.length : 0,
  analyzedSha: currentReport.analyzedSha,
  originalFindings: originalFindings.length,
  currentFindings: currentReport.currentFindings,
  removedFindings: findings.filter((finding) => finding.status === 'removed_by_detector_correction').length,
  counts,
  findings,
};
ensureDir('artifacts/fase-0/finding-classification.json');
fs.writeFileSync('artifacts/fase-0/finding-classification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ originalFindings: report.originalFindings, currentFindings: report.currentFindings, counts }, null, 2));
