const repository = require('./knowledge.repository');
const {
  normalizeFamily,
  normalizeStandardCode,
  normalizeText,
} = require('./knowledge.guardrails');

function normalizeSearchFilters(filters = {}) {
  return {
    q: normalizeText(filters.q || filters.query),
    standard_family: filters.standard_family ? normalizeFamily(filters.standard_family) : '',
    standard_code: filters.standard_code ? normalizeStandardCode(filters.standard_code) : '',
    clause_or_control: normalizeText(filters.clause_or_control || filters.control_code || filters.clause),
    domain: normalizeText(filters.domain),
    item_type: normalizeText(filters.item_type),
    license_class: normalizeText(filters.license_class).toLowerCase(),
    use_in_system: normalizeText(filters.use_in_system),
  };
}

async function searchKnowledge(filters = {}, options = {}) {
  const normalized = normalizeSearchFilters(filters);
  return repository.searchItems(normalized, options);
}

module.exports = {
  normalizeSearchFilters,
  searchKnowledge,
};
