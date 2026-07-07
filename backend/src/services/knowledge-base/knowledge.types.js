const KNOWLEDGE_SEED_VERSION = 'v2';
const KNOWLEDGE_SOURCE_FILE = 'base_conocimiento_iso_grc_ia_tcdx_1000_registros.md';

const ALLOWED_LICENSE_CLASSES = new Set([
  'derived_summary',
  'open_reference',
  'internal_methodology',
  'licensed_internal',
]);

const DEFAULT_KNOWLEDGE_CONTEXT = {
  source_file: KNOWLEDGE_SOURCE_FILE,
  seed_version: KNOWLEDGE_SEED_VERSION,
  total_available_items: 0,
  sources_used: [],
  standards_covered: [],
  knowledge_items_used: [],
  rules_used: [],
  coverage_score: 0,
  license_warnings: [],
  missing_coverage: [],
};

const ENTITY_TYPES = new Set([
  'control',
  'soa_item',
  'evidence',
  'risk',
  'audit_finding',
  'action_plan',
  'tenant_standard',
  'kpi',
  'health_signal',
]);

module.exports = {
  ALLOWED_LICENSE_CLASSES,
  DEFAULT_KNOWLEDGE_CONTEXT,
  ENTITY_TYPES,
  KNOWLEDGE_SEED_VERSION,
  KNOWLEDGE_SOURCE_FILE,
};
