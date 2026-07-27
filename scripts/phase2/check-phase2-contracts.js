#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const requiredDocs = [
  'docs/product/fase-2-scope.md',
  'docs/product/fase-2-closeout.md',
  'docs/product/fase-2-execution-ledger.md',
  'docs/architecture/fase-2-integrated-grc-model.md',
  'docs/architecture/fase-2-domain-events-and-rules.md',
  'docs/security/fase-2-rbac-matrix.md',
  'docs/security/fase-2-tenant-isolation.md',
  'docs/security/fase-2-dependency-remediation.md',
  'docs/integrations/fase-2-connector-framework.md',
  'docs/integrations/microsoft.md',
  'docs/integrations/google-workspace.md',
  'docs/integrations/jira-confluence.md',
  'docs/integrations/github.md',
  'docs/operations/fase-2-runbook.md',
  'docs/qa/fase-2-test-plan.md',
  'docs/qa/fase-2-runtime-qa.md',
];
const requiredPages = [
  'frontend/src/app/grc-global/page.tsx',
  'frontend/src/app/privacidad/page.tsx',
  'frontend/src/app/privacidad/actividades/page.tsx',
  'frontend/src/app/privacidad/actividades/[id]/page.tsx',
  'frontend/src/app/privacidad/dpia/page.tsx',
  'frontend/src/app/privacidad/solicitudes/page.tsx',
  'frontend/src/app/privacidad/brechas/page.tsx',
  'frontend/src/app/incidentes/page.tsx',
  'frontend/src/app/incidentes/[id]/page.tsx',
  'frontend/src/app/proveedores/page.tsx',
  'frontend/src/app/proveedores/[id]/page.tsx',
  'frontend/src/app/proveedores/evaluaciones/page.tsx',
  'frontend/src/app/proveedores/cuestionarios/page.tsx',
  'frontend/src/app/portal-proveedor/page.tsx',
  'frontend/src/app/conectores/page.tsx',
  'frontend/src/app/conectores/[id]/page.tsx',
  'frontend/src/app/conectores/sincronizaciones/page.tsx',
  'frontend/src/app/conectores/salud/page.tsx',
];
const files = [...requiredDocs, ...requiredPages];
const missingFiles = files.filter(relative => !fs.existsSync(path.join(root, relative)));
if (missingFiles.length) throw new Error(`Missing Phase 2 files: ${missingFiles.join(', ')}`);

const rules = read('backend/src/services/grc/phase2Rules.js');
const migration = read('database/migrations/20260727_phase2_integrated_grc.sql');
const routes = `${read('backend/src/routes/phase2.routes.js')}\n${read('backend/src/routes/supplier-portal.routes.js')}\n${read('backend/src/routes/phase2-external.routes.js')}`;
const events = [
  'privacy.processing.created', 'privacy.processing.reviewed', 'privacy.dpia.required',
  'privacy.request.opened', 'privacy.request.overdue', 'privacy.breach.opened', 'privacy.breach.closed',
  'incident.opened', 'incident.classified', 'incident.severity.changed',
  'incident.containment.completed', 'incident.recovery.completed', 'incident.closed',
  'supplier.created', 'supplier.criticality.changed', 'supplier.assessment.started',
  'supplier.assessment.submitted', 'supplier.assessment.approved', 'supplier.assessment.expired',
  'supplier.incident.linked', 'supplier.exit.started', 'supplier.exit.completed',
  'connector.sync.started', 'connector.sync.completed', 'connector.sync.failed',
  'connector.record.normalized', 'connector.alert.created', 'control.assurance.changed',
  'evidence.received', 'evidence.expired', 'evidence.rejected', 'risk.reassessment.required',
  'finding.created', 'nonconformity.created', 'action.created', 'action.overdue',
  'action.effectiveness.verified', 'obligation.due',
];
const permissions = [
  'privacy.read', 'privacy.manage', 'privacy.approve', 'privacy.dpia.manage',
  'privacy.requests.manage', 'privacy.breaches.manage', 'incidents.read', 'incidents.manage',
  'incidents.command', 'incidents.close', 'incidents.notifications.manage', 'suppliers.read',
  'suppliers.manage', 'suppliers.assess', 'suppliers.approve', 'suppliers.portal.manage',
  'connectors.read', 'connectors.manage', 'connectors.credentials.manage',
  'connectors.sync.run', 'connectors.logs.read', 'grc.phase2.export',
];
const missingEvents = events.filter(value => !rules.includes(`'${value}'`));
const missingPermissions = permissions.filter(value => !migration.includes(`'${value}'`));
const routeMarkers = [
  '/privacy/processing-activities', '/privacy/dpias', '/privacy/requests', '/privacy/breaches',
  '/incidents', '/suppliers', '/questionnaires', '/assessments', '/connectors',
  '/reports/:domain', '/executive', '/exchange', '/evidence', '/webhooks/:integrationId',
];
const missingRoutes = routeMarkers.filter(value => !routes.includes(value));
if (missingEvents.length || missingPermissions.length || missingRoutes.length) {
  throw new Error(`Phase 2 contract gaps: events=${missingEvents.join(',')} permissions=${missingPermissions.join(',')} routes=${missingRoutes.join(',')}`);
}

const scanFiles = [
  'backend/src/services/grc/phase2.service.js',
  'backend/src/services/grc/phase2Rules.js',
  'backend/src/services/grc/phase2ConnectorAdapters.js',
  'backend/src/routes/phase2.routes.js',
  'backend/src/routes/supplier-portal.routes.js',
  'frontend/src/components/phase2/Phase2Workspace.tsx',
  'frontend/tests/e2e/phase2-grc.spec.ts',
  'database/migrations/20260727_phase2_integrated_grc.sql',
];
const violations = scanFiles.filter(relative => {
  const source = read(relative);
  return /\b(TODO|FIXME)\b/.test(source)
    || /test\.(skip|fixme)\s*\(|\.only\s*\(|continue-on-error/i.test(source);
});
if (violations.length) throw new Error(`Forbidden Phase 2 debt marker: ${violations.join(', ')}`);

process.stdout.write(`Phase 2 contracts: VERIFIED events=${events.length} permissions=${permissions.length} pages=${requiredPages.length} docs=${requiredDocs.length}\n`);
