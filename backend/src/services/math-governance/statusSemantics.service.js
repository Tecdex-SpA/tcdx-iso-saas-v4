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
    suggested: entry('suggested', false, 'status_not_eligible'),
    active: entry('active', true, 'risk_active'),
    open: entry('active', true, 'risk_active'),
    assessed: entry('assessed', true, 'risk_assessed'),
    reviewed: entry('reviewed', true, 'risk_reviewed'),
    completed: entry('completed', true, 'risk_completed'),
    accepted: entry('accepted', true, 'risk_accepted'),
    needs_review: entry('needs_review', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
    archived: entry('archived', false, 'status_not_eligible'),
    retired: entry('archived', false, 'status_not_eligible'),
  }),
  control: Object.freeze({
    unknown: entry('unknown', false, 'status_not_eligible'),
    incomplete: entry('incomplete', true, 'control_incomplete'),
    degraded: entry('partially_effective', true, 'control_degraded'),
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
    abierto: entry('open', true, 'audit_action_open'),
    open: entry('open', true, 'audit_action_open'),
    pending: entry('open', true, 'audit_action_open'),
    en_progreso: entry('in_progress', true, 'audit_action_in_progress'),
    in_progress: entry('in_progress', true, 'audit_action_in_progress'),
    active: entry('in_progress', true, 'audit_action_in_progress'),
    bloqueado: entry('blocked', true, 'audit_action_blocked'),
    blocked: entry('blocked', true, 'audit_action_blocked'),
    cerrado: entry('closed', true, 'audit_action_closed'),
    closed: entry('closed', true, 'audit_action_closed'),
    completado: entry('completed', true, 'audit_action_completed'),
    completed: entry('completed', true, 'audit_action_completed'),
    resuelto: entry('resolved', true, 'audit_action_resolved'),
    resolved: entry('resolved', true, 'audit_action_resolved'),
    overdue: entry('overdue', true, 'audit_action_overdue'),
    not_applicable: entry('not_applicable', true, 'audit_status_not_applicable'),
    na: entry('not_applicable', true, 'audit_status_not_applicable'),
    cancelado: entry('cancelled', false, 'status_not_eligible'),
    cancelled: entry('cancelled', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
    archived: entry('archived', false, 'status_not_eligible'),
  }),
  incident: Object.freeze({
    reported: entry('reported', true, 'incident_reported'),
    triaged: entry('triaged', true, 'incident_triaged'),
    classified: entry('classified', true, 'incident_classified'),
    open: entry('open', true, 'incident_open'),
    active: entry('open', true, 'incident_open'),
    investigating: entry('investigating', true, 'incident_investigating'),
    contained: entry('contained', true, 'incident_contained'),
    recovering: entry('recovering', true, 'incident_recovering'),
    resolved: entry('resolved', true, 'incident_resolved'),
    post_incident_review: entry('post_incident_review', true, 'incident_post_incident_review'),
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
    under_review: entry('under_review', false, 'status_not_eligible'),
    confirmed: entry('confirmed', true, 'loss_confirmed'),
    approved: entry('confirmed', true, 'loss_confirmed'),
    booked: entry('confirmed', true, 'loss_confirmed'),
    recovered_partial: entry('recovered_partial', true, 'loss_recovered_partial'),
    closed: entry('closed', true, 'loss_closed'),
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
    under_review: entry('under_review', false, 'status_not_eligible'),
    completed: entry('completed', true, 'supplier_completed'),
    active: entry('active', true, 'supplier_active'),
    current: entry('active', true, 'supplier_active'),
    qualified: entry('qualified', true, 'supplier_qualified'),
    draft: entry('draft', false, 'status_not_eligible'),
    invited: entry('invited', false, 'status_not_eligible'),
    in_progress: entry('in_progress', false, 'status_not_eligible'),
    remediation_required: entry('remediation_required', false, 'status_not_eligible'),
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
    pass_with_observations: entry('pass_with_observations', true, 'assurance_pass_with_observations'),
    passed_with_observations: entry('pass_with_observations', true, 'assurance_pass_with_observations'),
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
    trusted: entry('trusted', true, 'data_trust_trusted'),
    acceptable: entry('acceptable', true, 'data_trust_acceptable'),
    attention: entry('attention', true, 'data_trust_attention'),
    untrusted: entry('untrusted', true, 'data_trust_untrusted'),
    unknown: entry('unknown', true, 'data_trust_unknown'),
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
    confirmed: entry('evaluated', true, 'maturity_confirmed'),
    applied: entry('published', true, 'maturity_applied'),
    valid: entry('calculated', true, 'maturity_measurement_valid'),
    estimated: entry('calculated', true, 'maturity_measurement_estimated'),
    draft: entry('draft', false, 'status_not_eligible'),
    previewed: entry('draft', false, 'status_not_eligible'),
    rejected: entry('rejected', false, 'status_not_eligible'),
    incomplete: entry('incomplete', false, 'status_not_eligible'),
    inconsistent: entry('inconsistent', false, 'status_not_eligible'),
    unknown: entry('unknown', false, 'status_not_eligible'),
    unmeasured: entry('unmeasured', false, 'status_not_eligible'),
    source_unavailable: entry('source_unavailable', false, 'status_not_eligible'),
    mapping_required: entry('mapping_required', false, 'status_not_eligible'),
    insufficient_data: entry('insufficient_data', false, 'status_not_eligible'),
    insufficient_coverage: entry('insufficient_coverage', false, 'status_not_eligible'),
    stale_source: entry('stale_source', false, 'status_not_eligible'),
    dependency_pending: entry('dependency_pending', false, 'status_not_eligible'),
    source_incompatible: entry('source_incompatible', false, 'status_not_eligible'),
    validation_failed: entry('validation_failed', false, 'status_not_eligible'),
    technical_error: entry('technical_error', false, 'status_not_eligible'),
  }),
  currency_conversion: Object.freeze({
    published: entry('published', true, 'fx_rate_published'),
    active: entry('published', true, 'fx_rate_published'),
    draft: entry('draft', false, 'status_not_eligible'),
  }),
});

const PRODUCER_STATUS_CONTRACTS = Object.freeze({
  risk: Object.freeze(['suggested', 'accepted', 'rejected', 'needs_review', 'archived']),
  control: Object.freeze(['unknown', 'incomplete', 'degraded', 'effective', 'ineffective']),
  audit: Object.freeze(['abierto', 'en progreso', 'bloqueado', 'completado', 'cancelado']),
  maturity: Object.freeze(['draft', 'previewed', 'confirmed', 'applied', 'rejected', 'valid', 'estimated', 'incomplete', 'inconsistent', 'unknown']),
  incident: Object.freeze(['reported', 'triaged', 'classified', 'active', 'contained', 'recovering', 'resolved', 'post_incident_review', 'closed']),
  loss: Object.freeze(['draft', 'under_review', 'confirmed', 'recovered_partial', 'closed', 'cancelled']),
  supplier: Object.freeze(['draft', 'invited', 'in_progress', 'submitted', 'under_review', 'remediation_required', 'approved', 'rejected', 'expired']),
  assurance: Object.freeze(['pass', 'pass_with_observations', 'fail', 'not_applicable', 'inconclusive']),
  data_trust: Object.freeze(['trusted', 'acceptable', 'attention', 'untrusted', 'unknown']),
});

const STATUS_SEMANTICS_BY_SOURCE = Object.freeze({
  compliance_requirements_assessments: statusSemantics({ domain: 'compliance', required: true }),
  grc_readiness_operational_snapshot: statusSemantics({ domain: 'readiness' }),
  risk_register_controls: statusSemantics({ domain: 'risk', version: 2 }),
  control_assurance_evidence: statusSemantics({ domain: 'control', version: 2 }),
  audit_findings_actions: statusSemantics({ domain: 'audit', version: 3, required: true }),
  incident_operational_events: statusSemantics({ domain: 'incident', version: 2, required: true }),
  evidence_freshness_records: statusSemantics({ domain: 'evidence' }),
  loss_events_operational: statusSemantics({ domain: 'loss', version: 2 }),
  continuity_resilience_tests: statusSemantics({ domain: 'continuity' }),
  asset_inventory_security: statusSemantics({ domain: 'asset' }),
  supplier_tprm_assessments: statusSemantics({ domain: 'supplier', version: 2, required: true }),
  survey_response_scoring: statusSemantics({ domain: 'survey', required: true }),
  assurance_test_results: statusSemantics({ domain: 'assurance', version: 2, sourceField: 'result', canonicalField: 'result', required: true }),
  data_quality_observations: statusSemantics({ domain: 'data_quality' }),
  data_lineage_observations: statusSemantics({ domain: 'data_lineage' }),
  statistical_metric_measurements: statusSemantics({ domain: 'statistics' }),
  indicator_data_trust_assessments: statusSemantics({ domain: 'data_trust', version: 2, sourceField: 'trust_status', canonicalField: 'trust_status' }),
  grc_health_components: statusSemantics({ domain: 'health', sourceField: 'run_status', canonicalField: 'run_status' }),
  maturity_assessments: statusSemantics({ domain: 'maturity', version: 2 }),
  external_fx_rates: statusSemantics({ domain: 'currency_conversion' }),
});

function normalizeSourceStatus(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
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
  PRODUCER_STATUS_CONTRACTS,
  STATUS_SEMANTICS_BY_SOURCE,
  normalizeStatus,
  normalizeRowStatus,
  normalizeRowsStatus,
};
