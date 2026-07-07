const scoring = require('./intelligence.scoring');

function degradeLevel(level) {
  if (level === 'alta') return 'media';
  if (level === 'media') return 'baja';
  return 'baja';
}

function confidenceFromScore(score) {
  if (score >= 75) return 'alta';
  if (score >= 45) return 'media';
  return 'baja';
}

function buildConfidenceProfile(dataset = {}, findings = [], knowledgeContext = {}) {
  const base = scoring.calculateConfidenceScore(dataset, findings, knowledgeContext);
  const warnings = [];
  let level = base.level;
  let score = base.score;

  if (!knowledgeContext || Number(knowledgeContext.coverage_score || 0) < 35) {
    warnings.push('Cobertura Knowledge Base baja o ausente.');
    score = Math.min(score, 55);
    level = degradeLevel(level);
  }
  if (!dataset || Object.values(base.components).filter((value) => Number(value) > 0).length <= 2) {
    warnings.push('Datos operacionales insuficientes para alta confianza.');
    score = Math.min(score, 40);
    level = 'baja';
  }
  if (findings.some((finding) => finding.rule_key === 'ai_response_without_knowledge_basis')) {
    warnings.push('Existe respuesta IA sin knowledge_basis; se degrada confianza.');
    score = Math.min(score, 45);
    level = 'baja';
  }

  return {
    score,
    level: confidenceFromScore(score) === 'alta' && level !== 'alta' ? level : confidenceFromScore(score),
    components: base.components,
    warnings,
  };
}

module.exports = {
  buildConfidenceProfile,
  confidenceFromScore,
  degradeLevel,
};
