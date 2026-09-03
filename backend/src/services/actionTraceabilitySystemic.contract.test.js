const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ACTION_ORIGIN_RELATION_TYPE,
  ACTIVE_CONTROL_REMEDIATION_STATUSES,
  PHASE2_ACTION_ORIGIN_TYPES,
  isActiveControlRemediationStatus,
  listActionPlanOriginRelations,
  upsertActionPlanOriginRelation,
} = require('./actionPlanTraceability.service');

const root = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const actionPlansRoute = read('backend/src/routes/action-plans.routes.js');
const findingsRoute = read('backend/src/routes/findings.routes.js');
const aiComplianceRoute = read('backend/src/routes/ai-compliance.routes.js');
const operationalService = read('backend/src/services/isoOperationalExecution.service.js');
const recommendedService = read('backend/src/services/isoRecommendedActions.service.js');
const indexesMap = read('docs/database-live-map/indexes.md');
const controlsRoute = read('backend/src/routes/controls.routes.js');
const planPage = read('frontend/src/app/plan-accion/page.tsx');
const ncPage = read('frontend/src/app/no-conformidades/page.tsx');
const findingsPage = read('frontend/src/app/hallazgos/page.tsx');
const aiSuggestionsPage = read('frontend/src/app/ia-compliance/sugerencias/page.tsx');

function extractArrayValues(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `${label} must be present`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

const sqlActiveControlRemediationStatuses = extractArrayValues(
  indexesMap,
  /uq_action_plans_one_active_control_remediation[\s\S]*?status = ANY \(ARRAY\[([^\]]+)\]\)/,
  'protected active remediation SQL predicate'
);
const actionPlanStatusValues = extractArrayValues(
  read('docs/database-live-map/constraints.md'),
  /chk_action_plans_status \| CHECK \| CHECK \(status = ANY \(ARRAY\[([^\]]+)\]\)\)/,
  'action_plans status check'
);

assert.match(
  indexesMap,
  /uq_action_plans_one_active_control_remediation ON public\.action_plans USING btree \(tenant_id, tenant_control_id, iso_code\) WHERE \(\(source_type = 'control'::text\) AND \(tenant_control_id IS NOT NULL\) AND \(status = ANY \(ARRAY\['abierto'::text, 'en progreso'::text, 'bloqueado'::text\]\)\)\)/,
  'protected active control remediation unique index must stay documented exactly'
);

assert.deepStrictEqual(
  ACTIVE_CONTROL_REMEDIATION_STATUSES,
  sqlActiveControlRemediationStatuses,
  'application active remediation statuses must match SQL predicate order and values'
);

for (const status of actionPlanStatusValues) {
  const codeActive = isActiveControlRemediationStatus(status);
  const sqlActive = sqlActiveControlRemediationStatuses.includes(status);
  assert.strictEqual(
    codeActive,
    sqlActive,
    `active remediation semantic mismatch for status ${status}`
  );
}

assert.match(actionPlansRoute, /function findActiveControlRemediationPlan/);
assert.match(actionPlansRoute, /ACTIVE_CONTROL_REMEDIATION_STATUSES/);
assert.doesNotMatch(actionPlansRoute, /const activeControlRemediationStatuses = \[/);
assert.match(actionPlansRoute, /idempotency: 'active_control_remediation_reused'/);
assert.match(actionPlansRoute, /isActiveControlRemediationConflict/);
assert.doesNotMatch(
  actionPlansRoute,
  /progress_percent !== undefined\s*\|\|\s*progress_percent !== null/,
  'progress_percent absent must not be treated as provided'
);
assert.match(
  actionPlansRoute,
  /progress_percent !== undefined && progress_percent !== null/,
  'progress_percent tracking must require an explicit non-null value'
);

assert.match(actionPlansRoute, /router\.get\('\/:tenant_id'/, 'plan list endpoint must exist');
assert.match(actionPlansRoute, /getEnrichedActionPlanById/, 'plan detail reader must reuse enriched projection');
assert.match(actionPlansRoute, /origin_relations_json/, 'plan detail reader must expose persisted origin relations');
assert.match(actionPlansRoute, /FROM grc_phase2_relations r[\s\S]*r\.target_type = 'action'[\s\S]*r\.target_id = ap\.id[\s\S]*r\.relation_type = 'originates_action'/, 'plan to origin reconstruction must read persisted GRC relations');
assert.match(actionPlansRoute, /tenant_document_object_links l/, 'plan evidence reader must include document links');
assert.match(actionPlansRoute, /l\.target_type = 'action'/, 'plan evidence reader must scope document links to action targets');
assert.match(actionPlansRoute, /l\.tenant_id = ap\.tenant_id/, 'plan evidence links must be tenant-scoped');
assert.match(actionPlansRoute, /l\.is_active = true/, 'inactive evidence links must not count');
assert.match(actionPlansRoute, /LOWER\(COALESCE\(l\.relation_type, 'associated'\)\) = 'associated'/, 'reference links must not count as plan evidence');
assert.match(actionPlansRoute, /is_document_link = true[\s\S]*COALESCE\(validated, false\) = false/, 'document links must be pending unless formally approved');
assert.match(actionPlansRoute, /SELECT DISTINCT ON \(item_key\)/, 'plan evidence projection must dedupe formal evidence and document links');

assert.match(controlsRoute, /tenant_document_object_links tdol/, 'control evidence reader must include document links');
assert.match(controlsRoute, /tdol\.target_type = 'control'/, 'control evidence links must target controls');
assert.match(controlsRoute, /tdol\.tenant_id = tc\.tenant_id/, 'control evidence links must be tenant-scoped');

assert.match(findingsRoute, /WHERE tenant_id = \$2[\s\S]*finding_id = \$1/, 'finding to action dedupe must be tenant-scoped');
assert.match(findingsRoute, /FROM grc_phase2_relations r[\s\S]*r\.source_type = 'finding'[\s\S]*r\.target_type = 'action'[\s\S]*r\.relation_type = 'originates_action'/, 'finding reuse must recover existing plan through persisted relation authority');
assert.match(findingsRoute, /upsertActionPlanOriginRelation\(client,[\s\S]*originType: 'finding'[\s\S]*actionPlanId: existing\.id/, 'finding reuse must persist origin relation for reused plan');
assert.match(findingsRoute, /upsertActionPlanOriginRelation\(client,[\s\S]*originType: 'finding'[\s\S]*actionPlanId: actionResult\.rows\[0\]\.id/, 'finding create must persist origin relation');
assert.doesNotMatch(findingsRoute, /Error creando acción desde hallazgo'[\s\S]{0,80}detail: err\.message/, 'finding action errors must not expose raw SQL detail');

assert.match(operationalService, /function findReusableActionPlan/, 'operational suggestions must reuse compatible action plans');
assert.match(operationalService, /source_type = 'control'[\s\S]*status = ANY\(\$4::text\[\]\)/, 'suggestion conversion must honor active control remediation uniqueness');
assert.match(operationalService, /row\.status === 'applied'[\s\S]*row\.created_record_id/, 'suggestion retry must return existing target');
assert.doesNotMatch(
  operationalService,
  /Plan reutilizado desde sugerencia ISO[\s\S]{0,500}VALUES \(\$1,\$2,\$3,0,\$4,NULL,\$5\)/,
  'pure suggestion reuse must not create a false progress_percent=0 update'
);

assert.match(recommendedService, /async function getExistingConversion/, 'recommended action conversion must read conversion authority');
assert.match(recommendedService, /existing_conversion_reused/, 'recommended action retry must reuse existing conversion');
assert.match(recommendedService, /iso_recommended_action_conversions/, 'recommended action conversion must use conversion trace table');
assert.match(recommendedService, /idx_iso_recommended_action_conversions_target|target_id/, 'recommended action conversion must be reconstructable from target plan');

assert.match(aiComplianceRoute, /const sourceType = 'ia';/, 'AI suggestion action plans must use allowed action_plans source_type');
assert.match(aiComplianceRoute, /const status = 'abierto';/, 'AI suggestion action plans must use allowed action_plans status');
assert.match(aiComplianceRoute, /source_id,[\s\S]*finding_id/, 'AI suggestion action plans must persist source_id trace');
assert.match(aiComplianceRoute, /source_type,[\s\S]*source_id,[\s\S]*priority/, 'NC action plan insert must persist source_id');
assert.match(aiComplianceRoute, /FROM grc_phase2_relations r[\s\S]*r\.source_type = 'nonconformity'[\s\S]*r\.target_type = 'action'[\s\S]*r\.relation_type = 'originates_action'/, 'NC reuse must recover existing plan through persisted relation authority');
assert.match(aiComplianceRoute, /upsertActionPlanOriginRelation\(client,[\s\S]*originType: 'nonconformity'[\s\S]*actionPlanId: reusablePlan\.id/, 'NC reuse must persist origin relation for reused plan');
assert.match(aiComplianceRoute, /upsertActionPlanOriginRelation\(client,[\s\S]*originType: 'nonconformity'[\s\S]*actionPlanId: savedRow\.id/, 'NC create must persist origin relation');
assert.match(aiComplianceRoute, /const currentProgress = await getLatestActionPlanProgress\(client, reusablePlan\.id\);[\s\S]*progressPercent: nextProgress/, 'NC plan update must snapshot current progress instead of defaulting to zero');
assert.match(aiComplianceRoute, /comment: 'Plan creado desde borrador IA de no conformidad\.'[\s\S]*progressPercent: 0/, 'real initial zero progress remains valid for newly created plans');
assert.doesNotMatch(aiComplianceRoute, /Error creando acción desde borrador IA de no conformidad'[\s\S]{0,100}errorDetail\(error\)/, 'NC to action errors must not expose raw SQL detail');

assert.strictEqual(ACTION_ORIGIN_RELATION_TYPE, 'originates_action');
assert.deepStrictEqual(PHASE2_ACTION_ORIGIN_TYPES, ['finding', 'nonconformity']);

const originRelationCalls = [];
const fakeClient = {
  async query(sql, params) {
    originRelationCalls.push({ sql, params });
    return {
      rows: [{
        tenant_id: params[0],
        source_type: params[1],
        source_id: params[2],
        target_type: 'action',
        target_id: params[3],
        relation_type: params[4],
      }],
    };
  },
};

(async () => {
  const relation = await upsertActionPlanOriginRelation(fakeClient, {
    tenantId: '00000000-0000-4000-8000-000000000001',
    originType: 'finding',
    originId: '00000000-0000-4000-8000-000000000002',
    actionPlanId: '00000000-0000-4000-8000-000000000003',
    createdBy: null,
    provenance: { reused: true },
  });

  assert.strictEqual(relation.source_type, 'finding');
  assert.strictEqual(relation.target_type, 'action');
  assert.strictEqual(relation.relation_type, ACTION_ORIGIN_RELATION_TYPE);
  assert.match(originRelationCalls[0].sql, /INSERT INTO grc_phase2_relations/);
  assert.match(originRelationCalls[0].sql, /ON CONFLICT \([\s\S]*tenant_id,[\s\S]*source_type,[\s\S]*target_type,[\s\S]*relation_type,[\s\S]*version/);
  assert.match(originRelationCalls[0].sql, /FROM action_plans ap[\s\S]*ap\.tenant_id = \$1::uuid[\s\S]*ap\.id = \$4::uuid/);

  originRelationCalls.length = 0;
  const origins = await listActionPlanOriginRelations(
    fakeClient,
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003'
  );

  assert.strictEqual(origins.length, 1);
  assert.match(originRelationCalls[0].sql, /FROM grc_phase2_relations/);
  assert.match(originRelationCalls[0].sql, /target_type = 'action'[\s\S]*target_id = \$2::uuid/);
  assert.match(originRelationCalls[0].sql, /relation_type = \$3/);

assert.doesNotMatch(planPage, /alert\(/, 'plan action page must not use native alert in focal flows');
assert.doesNotMatch(ncPage, /alert\(/, 'nonconformities focal page must not use native alert');
assert.doesNotMatch(findingsPage, /alert\(/, 'findings focal page must not use native alert');
assert.doesNotMatch(aiSuggestionsPage, /alert\(/, 'AI suggestions page must not use native alert');
assert.match(findingsPage, /replace\(\/\\\/api\\\/\?\$\/, ''\)\.replace\(\/\\\/\$\/, ''\)/, 'AI feedback base URL must avoid /api/api');
assert.match(findingsPage, /fetch\(`\$\{apiBase\}\/api\/ai-feedback`/, 'AI feedback must post to real backend route');

console.log('ACTION_TRACEABILITY_SYSTEMIC_CONTRACT_PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
