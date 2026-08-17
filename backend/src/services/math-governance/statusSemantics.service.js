'use strict';

function entry(canonicalStatus, eligible = true, reason = 'status_mapped') {
  return Object.freeze({ canonical_status: canonicalStatus, eligible, reason });
}

function statusSemantics({ domain, sourceField = 'status', canonicalField = sourceField, version = 1, required = false }) {
  return Object.freeze({
    domain,
    source_field: sourceField,
    canonical_field: canonicalField,
    mapping_version: `${domain}-status-map-v${version}`,
    unknown_policy: 'exclude_visible',
    required,
  });
}

const DOMAIN_STATUS_MAPPINGS = Object.freeze({
  compliance: Object.freeze({
    conform: entry('conform', true, 'compliance_conform'),
    compliant: entry('conform', true, 'compliance_conform'),
    effective: entry('conform', true, 'compliance_conform'),
    implemented: entry('conform', true, 'compliance_conform'),
    approved: entry('conform', true, 'compliance_conform'),
    partial: entry('partial', true, 'compliance_partial'),
    partially_compliant: entry('partial', true, 'compliance_partial'),
    in_progress: entry('partial', true, 'compliance_partial'),
    non_conform: entry('non_conform', true, 'compliance_non_conform'),
    non_compliant: entry('non_conform', true, 'compliance_non_conform'),
    ineffective: entry('non_conform', true, 'compliance_non_conform'),
    rejected: entry('non_conform', false, 'status_not_eligible'),
    not_applicable: entry('not_applicable', true, 'compliance_not_applicable'),
    na: entry('not_applicable', true, 'compliance_not_applicable'),
    pending: entry('pending', true, 'compliance_pending'),
    not_evaluated: entry('pending', true, 'compliance_pending'),
    draft: entry('pending', false, 'status_not_eligible'),
    deleted: entry('retired', false, 'status_not_eligible'),
    retired: entry('retired', false, 'status_not_eligible'),
  }),
  readiness: Object.freeze({
    ready: entry('ready', true, 'readiness_ready'),
    calculated: entry('ready', true, 'readiness_ready'),
    partial: entry('partial', true, 'readiness_partial'),
    draft: entry('draft', false, 'status_not_eligible'),
  }),
  risk: Object.freeze({
    active: entry('active', true, 'risk_active'),
    open: entry('active', true, 'risk_active'),
    assessed: entry('assessed', true, 'risk_assessed'),
    reviewed: entry('reviewed', true, 'risk_reviewed'),
    completed: entry('completed', true, 'risk_completed'),
    accepted: entry('accepted', true, 'risk_accepted'),
    rejected: entry('rejected', false, 'status_not_eligible'),
    archived: entry('archived', false, 'status_not_eligible'),
    retired: entry('archived', false, 'status_not_eligible'),
  }),
  control: Object.freeze({
    effective: entry('effective', true, 'control_effective'),
    partially_effective: entry('partially_effective', true, 'control_partially_effective'),
    ineffective: entry('ineffective', true, 'control_ineffective'),
    pass: entry('effective', true, 'control_effective'),
    passed: entry('effective', true, 'control_effective'),
    fail: entry('ineffective', true, 'control_ineffective'),
    failed: entry('ineffective', true, 'control_ineffective'),
    pending: entry('pending', true, 'control_pending'),
    draft: entry('draft', false, 'status_not_eligible'),
    retired: entry('retired', false, 'status_not_eligible'),
  }),
  audit: Object.freeze({
    open: entry('open', true, 'audit_action_open'),
    pending: entry('open', true, 'audit_action_open'),
    in_progress: entry('in_progress', true, 'audit_action_in_progress'),
    active: entry('in_progress', true, 'audit_action_in_progress'),
    closed: entry('closed', true, 'audit_action_closed'),
    completed: entry('completed', true, 'audit_action_completed'),
    resolved: entry('resolved', true, 'audit_action_resolved'),
    overdue: entry('overdue', true, 'audit_action_overdue'),
    cancelled: entry('cancelled', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
    archived: entry('archived', false, 'status_not_eligible'),
  }),
  incident: Object.freeze({
    open: entry('open', true, 'incident_open'),
    active: entry('open', true, 'incident_open'),
    investigating: entry('investigating', true, 'incident_investigating'),
    contained: entry('contained', true, 'incident_contained'),
    resolved: entry('resolved', true, 'incident_resolved'),
    closed: entry('closed', true, 'incident_closed'),
    cancelled: entry('cancelled', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
  }),
  evidence: Object.freeze({
    approved: entry('approved', true, 'evidence_approved'),
    aprobada: entry('approved', true, 'evidence_approved'),
    accepted: entry('approved', true, 'evidence_approved'),
    valid: entry('approved', true, 'evidence_approved'),
    submitted: entry('submitted', true, 'evidence_submitted'),
    pending: entry('pending', true, 'evidence_pending'),
    pendiente: entry('pending', true, 'evidence_pending'),
    reviewed: entry('reviewed', true, 'evidence_reviewed'),
    reopened: entry('reopened', true, 'evidence_reopened'),
    rejected: entry('rejected', false, 'status_not_eligible'),
    expired: entry('expired', false, 'status_not_eligible'),
  }),
  loss: Object.freeze({
    confirmed: entry('confirmed', true, 'loss_confirmed'),
    approved: entry('confirmed', true, 'loss_confirmed'),
    booked: entry('confirmed', true, 'loss_confirmed'),
    draft: entry('draft', false, 'status_not_eligible'),
    cancelled: entry('cancelled', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
  }),
  continuity: Object.freeze({
    within_sla: entry('within_sla', true, 'continuity_within_sla'),
    pass: entry('within_sla', true, 'continuity_within_sla'),
    passed: entry('within_sla', true, 'continuity_within_sla'),
    passed_with_observations: entry('within_sla', true, 'continuity_within_sla'),
    completed: entry('within_sla', true, 'continuity_within_sla'),
    successful: entry('within_sla', true, 'continuity_within_sla'),
    failed: entry('failed', true, 'continuity_failed'),
    failure: entry('failed', true, 'continuity_failed'),
    planned: entry('planned', false, 'status_not_eligible'),
    draft: entry('draft', false, 'status_not_eligible'),
    scheduled: entry('scheduled', false, 'status_not_eligible'),
    cancelled: entry('cancelled', false, 'status_not_eligible'),
  }),
  asset: Object.freeze({
    active: entry('active', true, 'asset_active'),
    current: entry('active', true, 'asset_active'),
    retired: entry('retired', false, 'status_not_eligible'),
    archived: entry('archived', false, 'status_not_eligible'),
  }),
  supplier: Object.freeze({
    approved: entry('approved', true, 'supplier_approved'),
    submitted: entry('submitted', true, 'supplier_submitted'),
    completed: entry('completed', true, 'supplier_completed'),
    active: entry('active', true, 'supplier_active'),
    current: entry('active', true, 'supplier_active'),
    qualified: entry('qualified', true, 'supplier_qualified'),
    draft: entry('draft', false, 'status_not_eligible'),
    invited: entry('invited', false, 'status_not_eligible'),
    in_progress: entry('in_progress', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
    expired: entry('expired', false, 'status_not_eligible'),
  }),
  survey: Object.freeze({
    completed: entry('completed', true, 'survey_completed'),
    submitted: entry('submitted', true, 'survey_submitted'),
    approved: entry('approved', true, 'survey_approved'),
    not_applicable: entry('not_applicable', true, 'survey_not_applicable'),
    na: entry('not_applicable', true, 'survey_not_applicable'),
    in_progress: entry('in_progress', true, 'survey_in_progress'),
    draft: entry('draft', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
  }),
  assurance: Object.freeze({
    pass: entry('pass', true, 'assurance_pass'),
    passed: entry('pass', true, 'assurance_pass'),
    fail: entry('fail', true, 'assurance_fail'),
    failed: entry('fail', true, 'assurance_fail'),
    inconclusive: entry('inconclusive', true, 'assurance_inconclusive'),
    not_applicable: entry('not_applicable', true, 'assurance_not_applicable'),
    pending: entry('pending', false, 'status_not_eligible'),
    draft: entry('draft', false, 'status_not_eligible'),
  }),
  data_quality: Object.freeze({
    valid: entry('valid', true, 'data_quality_valid'),
    assessed: entry('assessed', true, 'data_quality_assessed'),
    failed: entry('failed', true, 'data_quality_failed'),
  }),
  data_lineage: Object.freeze({
    active: entry('active', true, 'lineage_active'),
    current: entry('active', true, 'lineage_active'),
    retired: entry('retired', false, 'status_not_eligible'),
  }),
  statistics: Object.freeze({
    calculated: entry('calculated', true, 'statistics_calculated'),
    published: entry('published', true, 'statistics_published'),
    approved: entry('approved', true, 'statistics_approved'),
    draft: entry('draft', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
  }),
  data_trust: Object.freeze({
    assessed: entry('assessed', true, 'data_trust_assessed'),
    calculated: entry('calculated', true, 'data_trust_calculated'),
    approved: entry('approved', true, 'data_trust_approved'),
    draft: entry('draft', false, 'status_not_eligible'),
  }),
  health: Object.freeze({
    calculated: entry('calculated', true, 'health_calculated'),
    completed: entry('calculated', true, 'health_calculated'),
    failed: entry('failed', false, 'status_not_eligible'),
    cancelled: entry('cancelled', false, 'status_not_eligible'),
  }),
  maturity: Object.freeze({
    evaluated: entry('evaluated', true, 'maturity_evaluated'),
    calculated: entry('calculated', true, 'maturity_calculated'),
    published: entry('published', true, 'maturity_published'),
    approved: entry('approved', true, 'maturity_approved'),
    draft: entry('draft', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
  }),
  currency_conversion: Object.freeze({
    published: entry('published', true, 'fx_rate_published'),
    active: entry('published', true, 'fx_rate_published'),
    draft: entry('draft', false, 'status_not_eligible'),
  }),
});

const STATUS_SEMANTICS_BY_SOURCE = Object.freeze({
  compliance_requirements_assessments: statusSemantics({ domain: 'compliance', required: true }),
  grc_readiness_operational_snapshot: statusSemantics({ domain: 'readiness' }),
  risk_register_controls: statusSemantics({ domain: 'risk' }),
  control_assurance_evidence: statusSemantics({ domain: 'control' }),
  audit_findings_actions: statusSemantics({ domain: 'audit', required: true }),
  incident_operational_events: statusSemantics({ domain: 'incident', required: true }),
  evidence_freshness_records: statusSemantics({ domain: 'evidence' }),
  loss_events_operational: statusSemantics({ domain: 'loss' }),
  continuity_resilience_tests: statusSemantics({ domain: 'continuity' }),
  asset_inventory_security: statusSemantics({ domain: 'asset' }),
  supplier_tprm_assessments: statusSemantics({ domain: 'supplier', required: true }),
  survey_response_scoring: statusSemantics({ domain: 'survey', required: true }),
  assurance_test_results: statusSemantics({ domain: 'assurance', sourceField: 'result', canonicalField: 'result', required: true }),
  data_quality_observations: statusSemantics({ domain: 'data_quality' }),
  data_lineage_observations: statusSemantics({ domain: 'data_lineage' }),
  statistical_metric_measurements: statusSemantics({ domain: 'statistics' }),
  indicator_data_trust_assessments: statusSemantics({ domain: 'data_trust', sourceField: 'trust_status', canonicalField: 'trust_status' }),
  grc_health_components: statusSemantics({ domain: 'health', sourceField: 'run_status', canonicalField: 'run_status' }),
  maturity_assessments: statusSemantics({ domain: 'maturity' }),
  external_fx_rates: statusSemantics({ domain: 'currency_conversion' }),
});

function normalizeSourceStatus(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function normalizeStatus(domain, sourceStatus, options = {}) {
  const normalized = normalizeSourceStatus(sourceStatus);
  const mappingVersion = options.mapping_version || `${domain}-status-map-v1`;
  if (!normalized) {
    return Object.freeze({
      source_status: sourceStatus ?? null,
      canonical_status: null,
      domain,
      mapping_version: mappingVersion,
      reason: options.required ? 'status_missing' : 'status_not_provided_optional',
      mapped: !options.required,
      eligible: !options.required,
    });
  }
  const mapping = DOMAIN_STATUS_MAPPINGS[domain]?.[normalized];
  if (!mapping) {
    return Object.freeze({
      source_status: sourceStatus,
      canonical_status: 'unknown',
      domain,
      mapping_version: mappingVersion,
      reason: 'status_unmapped',
      mapped: false,
      eligible: false,
    });
  }
  return Object.freeze({
    source_status: sourceStatus,
    canonical_status: mapping.canonical_status,
    domain,
    mapping_version: mappingVersion,
    reason: mapping.reason,
    mapped: true,
    eligible: mapping.eligible,
  });
}

function normalizeRowStatus(row, statusSemantics = null) {
  if (!statusSemantics?.domain || !row || typeof row !== 'object') return row;
  const sourceField = statusSemantics.source_field || 'status';
  const canonicalField = statusSemantics.canonical_field || sourceField;
  const sourceStatus = row[sourceField] ?? null;
  const normalized = normalizeStatus(statusSemantics.domain, sourceStatus, statusSemantics);
  const next = {
    ...row,
    __status_normalization: normalized,
  };
  if (normalized.canonical_status !== null) next[canonicalField] = normalized.canonical_status;
  return next;
}

function normalizeRowsStatus(rows, statusSemantics = null) {
  return (rows || []).map((row) => normalizeRowStatus(row, statusSemantics));
}

module.exports = {
  DOMAIN_STATUS_MAPPINGS,
  STATUS_SEMANTICS_BY_SOURCE,
  normalizeStatus,
  normalizeRowStatus,
  normalizeRowsStatus,
};
