const repository = require('./knowledge.repository');
const { calculateKnowledgeCoverage } = require('./knowledge.coverage');
const { searchKnowledge } = require('./knowledge.search');
const {
  DEFAULT_KNOWLEDGE_CONTEXT,
  ENTITY_TYPES,
} = require('./knowledge.types');
const {
  normalizeFamily,
  normalizeStandardCode,
  normalizeText,
} = require('./knowledge.guardrails');

function normalizeEntityType(entityType) {
  const normalized = normalizeText(entityType).toLowerCase();
  if (normalized === 'soa') return 'soa_item';
  if (normalized === 'finding') return 'audit_finding';
  if (normalized === 'action') return 'action_plan';
  return ENTITY_TYPES.has(normalized) ? normalized : normalized;
}

function normalizeEntityInput(input = {}) {
  return {
    entityType: normalizeEntityType(input.entityType || input.entity_type),
    standardFamily: input.standardFamily ? normalizeFamily(input.standardFamily) : normalizeFamily(input.standard_family),
    standardCode: input.standardCode ? normalizeStandardCode(input.standardCode) : normalizeStandardCode(input.standard_code),
    clauseOrControl: normalizeText(input.clauseOrControl || input.clause_or_control || input.control_code),
    domain: normalizeText(input.domain || input.category || input.theme),
    title: normalizeText(input.title || input.name || input.description),
    tags: Array.isArray(input.tags) ? input.tags.map(normalizeText).filter(Boolean) : [],
    severity: normalizeText(input.severity || input.severity_default).toLowerCase(),
  };
}

function buildCandidateQueries(entity) {
  const queries = [];
  const base = {
    standard_family: entity.standardFamily,
    standard_code: entity.standardCode,
    clause_or_control: entity.clauseOrControl,
    domain: entity.domain,
  };

  if (entity.entityType === 'control' || entity.entityType === 'soa_item') {
    queries.push(base);
    queries.push({ standard_family: entity.standardFamily, clause_or_control: entity.clauseOrControl });
    queries.push({ standard_code: entity.standardCode, domain: entity.domain });
  } else if (entity.entityType === 'evidence') {
    queries.push(base);
    queries.push({ standard_family: entity.standardFamily, clause_or_control: entity.clauseOrControl, item_type: 'evidence_guidance' });
    queries.push({ q: [entity.title, entity.domain, ...entity.tags].filter(Boolean).join(' ') });
  } else if (entity.entityType === 'risk') {
    queries.push({ standard_family: entity.standardFamily, domain: entity.domain, item_type: 'risk_guidance' });
    queries.push({ standard_code: entity.standardCode, q: [entity.title, entity.domain, ...entity.tags].filter(Boolean).join(' ') });
    queries.push({ q: [entity.title, entity.domain, 'riesgo risk'].filter(Boolean).join(' ') });
  } else if (entity.entityType === 'audit_finding') {
    queries.push({ standard_family: entity.standardFamily, standard_code: entity.standardCode, domain: entity.domain });
    queries.push({ q: [entity.title, entity.severity, entity.domain, 'hallazgo brecha gap'].filter(Boolean).join(' ') });
  } else if (entity.entityType === 'action_plan') {
    queries.push({ standard_family: entity.standardFamily, clause_or_control: entity.clauseOrControl });
    queries.push({ q: [entity.title, entity.domain, 'accion recomendada action'].filter(Boolean).join(' ') });
  } else {
    queries.push(base);
    queries.push({ q: [entity.title, entity.domain, ...entity.tags].filter(Boolean).join(' ') });
  }

  return queries.filter((query) => Object.values(query).some(Boolean));
}

function scoreMatch(entity, item) {
  let score = 0;
  if (entity.standardFamily && item.standard_family === entity.standardFamily) score += 30;
  if (entity.standardCode && normalizeStandardCode(item.standard_code) === entity.standardCode) score += 25;
  if (entity.clauseOrControl && item.clause_or_control === entity.clauseOrControl) score += 25;
  if (entity.domain && normalizeText(item.domain).toLowerCase() === entity.domain.toLowerCase()) score += 15;
  if (entity.tags.some((tag) => (item.tags || []).includes(tag.toLowerCase()))) score += 5;
  return Math.min(100, score || 10);
}

function licenseWarnings(items) {
  return items
    .filter((item) => item.license_class && item.license_class !== 'derived_summary' && item.license_class !== 'open_reference')
    .map((item) => ({
      item_key: item.item_key,
      license_class: item.license_class,
      warning: 'Uso restringido: no exponer texto protegido ni enviar contenido completo al LLM.',
    }));
}

async function matchKnowledgeToTenantEntity(input = {}) {
  const entity = normalizeEntityInput(input);
  const queries = buildCandidateQueries(entity);
  const byKey = new Map();
  for (const query of queries) {
    const rows = await searchKnowledge(query, { limit: 12 });
    for (const row of rows) {
      if (!byKey.has(row.item_key)) {
        byKey.set(row.item_key, {
          ...row,
          match_score: scoreMatch(entity, row),
          knowledge_basis: {
            item_key: row.item_key,
            standard_family: row.standard_family,
            standard_code: row.standard_code,
            clause_or_control: row.clause_or_control,
            domain: row.domain,
            license_class: row.license_class,
          },
        });
      }
    }
  }

  const matches = Array.from(byKey.values())
    .sort((a, b) => b.match_score - a.match_score || a.item_key.localeCompare(b.item_key))
    .slice(0, 10);

  const missing = [];
  if (!matches.length) missing.push(`Sin cobertura KB para ${entity.entityType || 'entity'}`);
  if (!entity.standardFamily && !entity.standardCode) missing.push('Entidad sin norma/familia para matching fuerte');

  return {
    matches,
    coverage_score: matches.length ? Math.max(40, matches[0].match_score) : 0,
    missing_coverage: missing,
    license_warnings: licenseWarnings(matches),
  };
}

async function getKnowledgeForControl(control = {}) {
  return matchKnowledgeToTenantEntity({ ...control, entityType: 'control' });
}

async function getEvidenceExpectations(filters = {}) {
  const items = await searchKnowledge({ ...filters, item_type: filters.item_type || 'evidence_guidance' }, { limit: filters.limit || 20 });
  const rows = await repository.getChildRows('knowledge_evidence_expectations', items.map((item) => item.item_key));
  return rows;
}

async function getAuditQuestions(filters = {}) {
  const items = await searchKnowledge(filters, { limit: filters.limit || 20 });
  return repository.getChildRows('knowledge_audit_questions', items.map((item) => item.item_key));
}

async function getRecommendedActions(filters = {}) {
  const items = await searchKnowledge(filters, { limit: filters.limit || 20 });
  return repository.getChildRows('knowledge_recommended_actions', items.map((item) => item.item_key));
}

async function getRuleHints(filters = {}) {
  const items = await searchKnowledge(filters, { limit: filters.limit || 20 });
  return repository.getChildRows('knowledge_rule_hints', items.map((item) => item.item_key));
}

function entityFromDatasetRow(entityType, row) {
  return {
    entityType,
    standardFamily: row.standard_family || row.standardFamily || row.standard_code || row.norma_tipo,
    standardCode: row.standard_code || row.standardCode || row.norma_tipo,
    clauseOrControl: row.control_code || row.clause_or_control || row.clause_code,
    domain: row.domain || row.control_domain || row.process_name || row.kpi_category || row.category,
    title: row.title || row.name || row.control_title || row.finding_title || row.description || row.risk_name,
    tags: [row.status, row.severity, row.effective_health_status, row.health_status].filter(Boolean),
    severity: row.severity,
  };
}

async function buildKnowledgeContextForTenantDataset(dataset = {}) {
  const entityGroups = [
    ['control', dataset.priority_controls || dataset.controls || []],
    ['evidence', dataset.recent_evidences || dataset.evidences || []],
    ['risk', dataset.risks || dataset.top_risks || []],
    ['audit_finding', dataset.recent_findings || dataset.findings || []],
    ['action_plan', dataset.recent_action_plans || dataset.action_plans || []],
    ['health_signal', dataset.effective_health_summary || []],
    ['kpi', dataset.kpis || []],
  ];

  const itemsUsed = new Map();
  const rulesUsed = new Set();
  const standardsCovered = new Set();
  const sourcesUsed = new Set();
  const missingCoverage = [];
  const licenseWarningsList = [];
  let entityCount = 0;
  let matchedCount = 0;

  for (const [entityType, rows] of entityGroups) {
    const limitedRows = Array.isArray(rows) ? rows.slice(0, 20) : [];
    for (const row of limitedRows) {
      entityCount += 1;
      const result = await matchKnowledgeToTenantEntity(entityFromDatasetRow(entityType, row));
      if (result.matches.length) matchedCount += 1;
      result.missing_coverage.forEach((item) => missingCoverage.push(item));
      result.license_warnings.forEach((item) => licenseWarningsList.push(item));
      result.matches.slice(0, 3).forEach((item) => {
        itemsUsed.set(item.item_key, item);
        if (item.source_key) sourcesUsed.add(item.source_key);
        if (item.standard_code) standardsCovered.add(item.standard_code);
        if (item.item_type) rulesUsed.add(`${item.item_key}:${item.item_type}`);
      });
    }
  }

  const coverage = calculateKnowledgeCoverage({ entityCount, matchedCount, missingCoverage });
  return {
    ...DEFAULT_KNOWLEDGE_CONTEXT,
    total_available_items: await repository.countAvailableItems(),
    sources_used: Array.from(sourcesUsed),
    standards_covered: Array.from(standardsCovered),
    knowledge_items_used: Array.from(itemsUsed.values()).map((item) => item.knowledge_basis || item),
    rules_used: Array.from(rulesUsed),
    coverage_score: coverage.coverage_score,
    license_warnings: licenseWarningsList,
    missing_coverage: coverage.missing_coverage,
  };
}

module.exports = {
  buildKnowledgeContextForTenantDataset,
  calculateKnowledgeCoverage,
  getAuditQuestions,
  getEvidenceExpectations,
  getKnowledgeForControl,
  getRecommendedActions,
  getRuleHints,
  matchKnowledgeToTenantEntity,
  searchKnowledge,
};
