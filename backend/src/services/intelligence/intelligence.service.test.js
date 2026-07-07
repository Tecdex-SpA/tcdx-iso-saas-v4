const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') {
    return {
      Pool: class {
        async query() {
          return { rows: [], rowCount: 0 };
        }
      },
    };
  }
  if (request === 'jsonwebtoken') {
    return {
      verify() {
        return {};
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const auth = require('../../middleware/auth');
const { enforceTenantRequestScope } = require('../../middleware/tenantScope.middleware');

const intelligenceRepository = require('./intelligence.repository');
const knowledgeService = require('../knowledge-base/knowledge.service');

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function runAuthNoTokenTest() {
  const req = { headers: {}, originalUrl: '/api/intelligence/brief/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const res = createMockResponse();
  let nextCalled = false;
  await auth(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.code, 'NO_TOKEN');
}

function runTenantMismatchTest() {
  const req = {
    method: 'GET',
    originalUrl: '/api/intelligence/brief/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    user: {
      role: 'admin',
      tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    },
    params: {},
    query: {},
    body: {},
  };
  const res = createMockResponse();
  let nextCalled = false;
  enforceTenantRequestScope(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, 'TENANT_SCOPE_MISMATCH');
}

async function runBriefFallbackTest() {
  intelligenceRepository.getTenantIntelligenceDataset = async ({ tenantId }) => ({
    tenant: { tenant_id: tenantId, name: 'Tenant Demo', active_standards: [] },
    scope: { context_version: 'test' },
    priority_controls: [],
    recent_evidences: [],
    risks: [],
    recent_findings: [],
    recent_action_plans: [],
    kpis: [],
    effective_health_summary: [],
    source_trace: [],
    limitations: ['No se encontraron controles disponibles para este tenant.'],
  });
  knowledgeService.buildKnowledgeContextForTenantDataset = async () => ({
    source_file: 'base_conocimiento_iso_grc_ia_tcdx_1000_registros.md',
    seed_version: 'v2',
    total_available_items: 0,
    sources_used: [],
    standards_covered: [],
    knowledge_items_used: [],
    rules_used: [],
    coverage_score: 0,
    license_warnings: [],
    missing_coverage: ['dataset_without_entities'],
  });

  delete require.cache[require.resolve('./intelligence.service')];
  const intelligence = require('./intelligence.service');
  const brief = await intelligence.buildTenantIntelligenceBrief({
    tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user: { role: 'admin', tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  });

  assert.equal(brief.ok, true);
  assert.equal(brief.knowledge_context.seed_version, 'v2');
  assert.equal(brief.confidence.level, 'baja');
  assert.ok(brief.brief.limitations.length > 0);
}

const kbBasis = {
  item_key: 'iso_9001.4.contexto_de_la_organizacion.governance',
  source_record_id: 'KB-0001',
  standard_family: 'ISO_9001',
  standard_code: 'ISO 9001:2015 + Amd 1:2024',
  clause_or_control: '4',
  domain: 'Contexto de la organización',
  license_class: 'derived_summary',
};

function installKnowledgeStubs({ hasKnowledge = true } = {}) {
  knowledgeService.matchKnowledgeToTenantEntity = async () => hasKnowledge ? ({
    matches: [{
      item_key: kbBasis.item_key,
      source_record_id: kbBasis.source_record_id,
      source_key: 'iso_9001_2015',
      standard_family: kbBasis.standard_family,
      standard_code: kbBasis.standard_code,
      clause_or_control: kbBasis.clause_or_control,
      domain: kbBasis.domain,
      item_type: 'governance_guidance',
      title: 'Contexto - governance',
      intent_summary: 'Criterio derivado de gobernanza.',
      license_class: 'derived_summary',
      match_score: 90,
      knowledge_basis: kbBasis,
    }],
    coverage_score: 90,
    missing_coverage: [],
    license_warnings: [],
  }) : ({
    matches: [],
    coverage_score: 0,
    missing_coverage: ['Sin cobertura KB para entity'],
    license_warnings: [],
  });
  knowledgeService.getEvidenceExpectations = async () => hasKnowledge ? [{
    item_key: kbBasis.item_key,
    expectation_text: 'documento vigente aprobado con responsable',
  }] : [];
  knowledgeService.getAuditQuestions = async () => hasKnowledge ? [{
    item_key: kbBasis.item_key,
    question_text: '¿Existe evidencia vigente y aprobada?',
  }] : [];
  knowledgeService.getCommonGaps = async () => hasKnowledge ? [{
    item_key: kbBasis.item_key,
    gap_text: 'Gobernanza no trazable.',
  }] : [];
  knowledgeService.getRecommendedActions = async () => hasKnowledge ? [{
    item_key: kbBasis.item_key,
    action_text: 'Formalizar responsable, evidencia y seguimiento.',
    action_basis: 'knowledge_basis: KB-0001',
  }] : [];
  knowledgeService.getRuleHints = async () => hasKnowledge ? [{
    item_key: kbBasis.item_key,
    hint_text: 'Si no existe evidencia vigente, reducir readiness.',
  }] : [];
  knowledgeService.buildKnowledgeContextForTenantDataset = async (dataset) => ({
    source_file: 'base_conocimiento_iso_grc_ia_tcdx_1000_registros.md',
    seed_version: 'v2',
    total_available_items: hasKnowledge ? 1000 : 0,
    sources_used: hasKnowledge ? ['iso_9001_2015'] : [],
    standards_covered: hasKnowledge ? ['ISO 9001:2015 + Amd 1:2024'] : [],
    knowledge_items_used: hasKnowledge ? [kbBasis] : [],
    rules_used: hasKnowledge ? [`${kbBasis.item_key}:governance_guidance`] : [],
    coverage_score: hasKnowledge ? 90 : 0,
    license_warnings: [],
    missing_coverage: hasKnowledge ? [] : ['dataset_without_kb'],
  });
}

function baseTenantDataset(overrides = {}) {
  return {
    tenant: {
      tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Tenant Demo',
      active_standards: [{ standard_code: 'ISO 9001:2015 + Amd 1:2024' }],
    },
    scope: { context_version: 'test' },
    priority_controls: [],
    recent_evidences: [],
    risks: [],
    audits: [],
    recent_findings: [],
    recent_nonconformities: [],
    recent_action_plans: [],
    kpis: [],
    effective_health_summary: [],
    source_trace: [{ source: 'internal_db', reference: 'test', used_for: 'unit' }],
    limitations: [],
    ...overrides,
  };
}

async function buildBriefForDataset(dataset, { hasKnowledge = true } = {}) {
  installKnowledgeStubs({ hasKnowledge });
  intelligenceRepository.getTenantIntelligenceDataset = async () => dataset;
  delete require.cache[require.resolve('./intelligence.service')];
  const intelligence = require('./intelligence.service');
  return intelligence.buildTenantIntelligenceBrief({
    tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user: { role: 'admin', tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  });
}

async function runPhase2PipelineTests() {
  const lowEvidenceBrief = await buildBriefForDataset(baseTenantDataset({
    priority_controls: [{
      id: 'control-1',
      standard_code: 'ISO 9001:2015 + Amd 1:2024',
      clause_or_control: '4',
      domain: 'Contexto de la organización',
      title: 'Control contexto',
      status: 'activo',
      evidence_count: 0,
    }],
  }));
  assert.equal(lowEvidenceBrief.ok, true);
  assert.ok(lowEvidenceBrief.audit_readiness.score < 75);
  assert.ok(lowEvidenceBrief.findings.some((finding) => finding.rule_key === 'control_active_without_verifiable_evidence'));

  const overdueBrief = await buildBriefForDataset(baseTenantDataset({
    recent_action_plans: [{
      id: 'action-1',
      title: 'Cerrar brecha documental',
      status: 'abierto',
      due_date: '2020-01-01',
      priority: 'alta',
    }],
  }));
  assert.ok(overdueBrief.findings.some((finding) => finding.rule_key === 'action_plan_overdue'));
  assert.ok(overdueBrief.next_best_actions.some((action) => action.action_basis && action.urgency));

  const criticalRiskBrief = await buildBriefForDataset(baseTenantDataset({
    risks: [{
      id: 'risk-1',
      title: 'Riesgo critico sin tratamiento',
      severity: 'critica',
      risk_level: 'critica',
    }],
  }));
  const criticalFinding = criticalRiskBrief.findings.find((finding) => finding.rule_key === 'high_risk_without_treatment');
  assert.equal(criticalFinding.severity, 'critica');
  assert.ok(criticalFinding.knowledge_basis.length > 0);

  const noOwnerBrief = await buildBriefForDataset(baseTenantDataset({
    priority_controls: [{
      id: 'control-2',
      title: 'Control critico sin owner',
      severity: 'alta',
      status: 'activo',
      evidence_count: 1,
    }],
  }));
  assert.ok(noOwnerBrief.findings.some((finding) => finding.rule_key === 'critical_control_without_owner'));

  const evidenceMismatchBrief = await buildBriefForDataset(baseTenantDataset({
    recent_evidences: [{
      id: 'evidence-1',
      title: 'captura temporal no aprobada',
      status: 'pendiente',
      tenant_control_id: 'control-1',
    }],
  }));
  assert.ok(evidenceMismatchBrief.findings.some((finding) => finding.rule_key === 'evidence_does_not_match_expected_kb'));

  const highScoreLowQualityBrief = await buildBriefForDataset(baseTenantDataset({
    priority_controls: [{
      id: 'control-3',
      title: 'Control con evidencia',
      status: 'activo',
      evidence_count: 1,
      approved_evidence_count: 1,
    }],
    recent_evidences: [{
      id: 'evidence-2',
      title: 'documento vigente aprobado con responsable',
      status: 'aprobada',
      tenant_control_id: 'control-3',
      owner: 'calidad',
      updated_at: new Date().toISOString(),
    }],
    recent_action_plans: [{
      id: 'action-2',
      title: 'Accion cerrada',
      status: 'cerrado',
      evidence_count: 1,
    }],
    source_trace: [],
    limitations: ['Fuente de riesgos no disponible', 'Fuente de hallazgos no disponible', 'Fuente de KPIs no disponible'],
  }));
  assert.ok(highScoreLowQualityBrief.findings.some((finding) => finding.rule_key === 'score_high_data_quality_low'));

  const noKbBrief = await buildBriefForDataset(baseTenantDataset({
    priority_controls: [{
      id: 'control-4',
      title: 'Control sin KB',
      status: 'activo',
      evidence_count: 0,
    }],
  }), { hasKnowledge: false });
  assert.ok(['baja', 'media'].includes(noKbBrief.confidence.level));
  assert.equal(noKbBrief.knowledge_context.coverage_score, 0);
  assert.ok(noKbBrief.metric_explanations.find((item) => item.metric === 'knowledge_coverage'));
}

async function runTests() {
  await runAuthNoTokenTest();
  runTenantMismatchTest();
  await runBriefFallbackTest();
  await runPhase2PipelineTests();
  console.log('intelligence.service tests OK');
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
