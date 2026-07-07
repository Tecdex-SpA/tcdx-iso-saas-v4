function calculateKnowledgeCoverage({ entityCount = 0, matchedCount = 0, missingCoverage = [] } = {}) {
  const total = Math.max(Number(entityCount || 0), 0);
  if (total === 0) {
    return {
      coverage_score: 0,
      missing_coverage: missingCoverage.length ? missingCoverage : ['dataset_without_entities'],
    };
  }
  const score = Math.round((Math.max(Number(matchedCount || 0), 0) / total) * 100);
  return {
    coverage_score: Math.max(0, Math.min(100, score)),
    missing_coverage: missingCoverage,
  };
}

module.exports = {
  calculateKnowledgeCoverage,
};
