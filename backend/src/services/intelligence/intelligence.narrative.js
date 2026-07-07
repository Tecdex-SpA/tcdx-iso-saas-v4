const { fallbackToDeterministicNarrative } = require('./intelligence.guardrails');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sectionFromStructured(structured = {}, type = 'executive') {
  const summaryField = {
    executive: 'executive_summary',
    technical: 'technical_summary',
    audit: 'audit_summary',
    commercial_demo: 'executive_summary',
  }[type] || 'executive_summary';

  return {
    type,
    what_happens: structured[summaryField] || structured.executive_summary || '',
    why_it_matters: structured.technical_summary || structured.audit_summary || '',
    evidence_basis: asArray(structured.knowledge_basis),
    recommended_actions: asArray(structured.recommendations),
    confidence: structured.confidence || 'baja',
    limitations: asArray(structured.limitations),
    assumptions: asArray(structured.assumptions),
    should_escalate_to_human: structured.should_escalate_to_human === true,
  };
}

function buildNarrativeSet(structured = {}) {
  return {
    executive: sectionFromStructured(structured, 'executive'),
    technical: sectionFromStructured(structured, 'technical'),
    audit: sectionFromStructured(structured, 'audit'),
    commercial_demo: sectionFromStructured({
      ...structured,
      executive_summary: structured.executive_summary
        ? `${structured.executive_summary} Esta vista es demostrativa y requiere validacion humana antes de decisiones auditables.`
        : '',
    }, 'commercial_demo'),
    structured,
  };
}

function buildDeterministicNarratives(context = {}, reason = 'ai_disabled') {
  return buildNarrativeSet(fallbackToDeterministicNarrative(context, reason));
}

module.exports = {
  buildDeterministicNarratives,
  buildNarrativeSet,
  sectionFromStructured,
};
