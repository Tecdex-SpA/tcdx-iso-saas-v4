'use strict';

const COUNT_SEMANTICS = Object.freeze({
  received: 'physical_rows_after_tenant_source_scope',
  eligible: 'rows_after_contract_dataset_eligibility',
  usable: 'eligible_rows_with_valid_formula_inputs',
  excluded: 'unique_physical_rows_not_used_by_formula',
  ineligible: 'received_rows_excluded_by_contract_dataset_validation',
  eligible_unusable: 'eligible_rows_excluded_by_formula_input_validation',
  exclusionIssueCount: 'distinct_exclusion_issue_categories',
  exclusionIssueInstanceCount: 'total_exclusion_issue_instances',
  population_size: 'official_eligible_population_size',
});

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`COUNT_SEMANTIC_INVALID:${field}`);
  }
  return value;
}

function countExclusionIssueCategories(exclusions = []) {
  const categories = new Set();
  for (const issue of exclusions || []) {
    const category = issue?.code || issue?.reason || issue?.field || null;
    if (category) categories.add(String(category));
  }
  return categories.size;
}

function buildPopulationCounts({ received = 0, eligible = 0, usable = 0, exclusions = [] } = {}) {
  const receivedCount = nonNegativeInteger(received, 'received');
  const eligibleCount = nonNegativeInteger(eligible, 'eligible');
  const usableCount = nonNegativeInteger(usable, 'usable');
  if (eligibleCount > receivedCount) throw new Error('COUNT_SEMANTIC_INVALID:eligible_gt_received');
  if (usableCount > eligibleCount) throw new Error('COUNT_SEMANTIC_INVALID:usable_gt_eligible');
  return Object.freeze({
    received: receivedCount,
    eligible: eligibleCount,
    usable: usableCount,
    excluded: receivedCount - usableCount,
    ineligible: receivedCount - eligibleCount,
    eligible_unusable: eligibleCount - usableCount,
    exclusionIssueCount: countExclusionIssueCategories(exclusions),
    exclusionIssueInstanceCount: Array.isArray(exclusions) ? exclusions.length : 0,
    population_size: eligibleCount,
  });
}

module.exports = { COUNT_SEMANTICS, buildPopulationCounts, countExclusionIssueCategories };
