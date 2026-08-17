'use strict';

const crypto = require('crypto');
const { COUNT_SEMANTICS } = require('./countSemantics.service');
const { STATUS_SEMANTICS_BY_SOURCE } = require('./statusSemantics.service');

const AVAILABILITY = new Set(['available', 'partially_available', 'source_unavailable', 'legacy_adapter_required']);
const SOURCE_STATUSES = new Set(['draft', 'reviewed', 'approved', 'published', 'retired']);
const ROUTE_TO_FIX_BY_ENTITY = Object.freeze({
  compliance: '/cumplimiento',
  readiness: '/diagnostico',
  risk: '/riesgos',
  control: '/controles',
  audit: '/auditorias',
  incident: '/incidentes',
  evidence: '/evidencias',
  loss: '/eventos-perdida',
  continuity: '/continuidad',
  asset: '/activos',
  supplier: '/proveedores',
  survey: '/encuestas',
  assurance: '/tests',
  data_quality: '/datos/calidad',
  data_lineage: '/datos/lineage',
  statistics: '/metricas',
  health: '/metricas',
  maturity: '/evaluaciones',
  currency_conversion: null,
});
const CAPABILITY_BY_ENTITY = Object.freeze({
  compliance: 'compliance.management',
  readiness: 'metrics.indicators.read',
  risk: 'risk.management',
  control: 'controls.management',
  audit: 'audit.management',
  incident: 'incidents.management',
  evidence: 'evidence.management',
  loss: 'loss.events',
  continuity: 'continuity.management',
  asset: 'assets.management',
  supplier: 'tprm.suppliers',
  survey: 'surveys.engine',
  assurance: 'assurance.testing',
  data_quality: 'metrics.data_trust',
  data_lineage: 'data.lineage',
  statistics: 'metrics.engine',
  health: 'metrics.indicators.read',
  maturity: 'surveys.engine',
  currency_conversion: null,
});

function temporal(definition) {
  return Object.freeze({
    classification: definition.classification,
    canonical_time_field: definition.canonical_time_field || '__event_time',
    source_time_fields: Object.freeze(definition.source_time_fields || ['__event_time']),
    fallback_time_fields: Object.freeze(definition.fallback_time_fields || []),
    valid_from_fields: Object.freeze(definition.valid_from_fields || []),
    valid_to_fields: Object.freeze(definition.valid_to_fields || []),
    time_meaning: definition.time_meaning,
    timezone_policy: definition.timezone_policy || 'tenant_timezone',
    period_policy: definition.period_policy || 'start_inclusive_end_exclusive',
    validity_policy: definition.validity_policy || 'canonical_time_in_requested_period',
    missing_time_policy: definition.missing_time_policy || 'exclude_when_period_requested',
    as_of_policy: definition.as_of_policy || 'exclude_future_canonical_time',
  });
}

const TEMPORAL_SEMANTICS_BY_SOURCE = Object.freeze({
  compliance_requirements_assessments: temporal({ classification: 'latest_effective_state', source_time_fields: ['assessed_at', 'updated_at', 'created_at'], fallback_time_fields: ['assessed_at'], time_meaning: 'compliance_mapping_assessment_state_time', validity_policy: 'state_effective_at_period_or_as_of' }),
  grc_readiness_operational_snapshot: temporal({ classification: 'state_snapshot', source_time_fields: ['source_as_of', 'period_end', 'updated_at', 'created_at'], time_meaning: 'readiness_snapshot_as_of_time', validity_policy: 'snapshot_effective_at_period_or_as_of' }),
  risk_register_controls: temporal({ classification: 'latest_effective_state', source_time_fields: ['effective_at', 'completed_at', 'assessed_at', 'measured_at', 'updated_at', 'created_at'], time_meaning: 'risk_assessment_effective_time', validity_policy: 'latest_completed_or_reviewed_state_at_as_of' }),
  control_assurance_evidence: temporal({ classification: 'state_snapshot', source_time_fields: ['calculated_at', 'assessed_at', 'measured_at', 'updated_at', 'created_at'], time_meaning: 'control_assurance_calculation_time', validity_policy: 'assurance_state_effective_at_period_or_as_of' }),
  audit_findings_actions: temporal({ classification: 'validity_interval', source_time_fields: ['latest_update_at', 'opened_at', 'created_at', 'source_as_of', 'period_start', 'generated_at', 'closed_at', 'completed_at', 'period_end'], valid_from_fields: ['opened_at', 'created_at', 'period_start', 'source_as_of', 'generated_at'], valid_to_fields: ['closed_at', 'completed_at', 'period_end'], time_meaning: 'action_lifecycle_or_snapshot_finding_time', validity_policy: 'action_or_finding_state_in_requested_period' }),
  incident_operational_events: temporal({ classification: 'event_stream', source_time_fields: ['reported_at', 'detected_at', 'created_at'], time_meaning: 'incident_report_or_detection_time', validity_policy: 'event_time_in_requested_period' }),
  evidence_freshness_records: temporal({ classification: 'validity_interval', source_time_fields: ['reviewed_at', 'submitted_at', 'decided_at', 'created_at', 'expires_at'], valid_from_fields: ['reviewed_at', 'submitted_at', 'decided_at', 'created_at'], valid_to_fields: ['expires_at'], time_meaning: 'evidence_review_or_submission_time', validity_policy: 'evidence_state_and_expiration_at_as_of' }),
  loss_events_operational: temporal({ classification: 'event_stream', source_time_fields: ['event_date', 'occurred_at'], time_meaning: 'loss_occurrence_time', validity_policy: 'loss_occurrence_in_requested_period', missing_time_policy: 'exclude_with_reason' }),
  continuity_resilience_tests: temporal({ classification: 'event_stream', source_time_fields: ['completed_at', 'tested_at', 'scheduled_at'], time_meaning: 'resilience_test_completion_time', validity_policy: 'completed_test_in_requested_period' }),
  asset_inventory_security: temporal({ classification: 'latest_effective_state', source_time_fields: ['updated_at', 'created_at'], time_meaning: 'asset_inventory_state_time', validity_policy: 'asset_state_effective_at_period_or_as_of' }),
  supplier_tprm_assessments: temporal({ classification: 'state_snapshot', source_time_fields: ['approved_at', 'submitted_at', 'updated_at', 'created_at'], time_meaning: 'supplier_assessment_decision_time', validity_policy: 'published_supplier_assessment_at_period_or_as_of' }),
  survey_response_scoring: temporal({ classification: 'event_stream', source_time_fields: ['submitted_at'], time_meaning: 'survey_response_submission_time', validity_policy: 'submitted_response_in_requested_period' }),
  assurance_test_results: temporal({ classification: 'event_stream', source_time_fields: ['executed_at', 'tested_at', 'created_at'], time_meaning: 'assurance_test_execution_time', validity_policy: 'test_execution_in_requested_period' }),
  data_quality_observations: temporal({ classification: 'event_stream', source_time_fields: ['assessed_at'], time_meaning: 'data_quality_assessment_time', validity_policy: 'assessment_time_in_requested_period' }),
  data_lineage_observations: temporal({ classification: 'event_stream', source_time_fields: ['created_at'], time_meaning: 'lineage_relation_observation_time', validity_policy: 'lineage_observation_in_requested_period' }),
  statistical_metric_measurements: temporal({ classification: 'event_stream', source_time_fields: ['measured_at', 'calculated_at', 'period_end'], time_meaning: 'metric_measurement_time', validity_policy: 'measurement_time_in_requested_period' }),
  indicator_data_trust_assessments: temporal({ classification: 'event_stream', source_time_fields: ['assessed_at'], time_meaning: 'data_trust_assessment_time', validity_policy: 'assessment_time_in_requested_period' }),
  grc_health_components: temporal({ classification: 'validity_interval', source_time_fields: ['period_end', 'completed_at', 'started_at'], valid_from_fields: ['period_start', 'started_at'], valid_to_fields: ['period_end', 'completed_at'], time_meaning: 'official_calculation_period_end_or_completion_time', validity_policy: 'calculation_period_overlaps_requested_period' }),
  maturity_assessments: temporal({ classification: 'event_stream', source_time_fields: ['evaluated_at', 'confirmed_at', 'measured_at', 'source_timestamp', 'calculated_at', 'period_end', 'created_at'], time_meaning: 'maturity_evaluation_or_measurement_time', validity_policy: 'maturity_observation_in_requested_period' }),
  external_fx_rates: temporal({ classification: 'latest_effective_state', source_time_fields: ['effective_at'], time_meaning: 'fx_rate_effective_time', validity_policy: 'rate_effective_at_period_or_as_of' }),
});

const FORMULA_SOURCE_MAP = Object.freeze({
  F5_5_COMPLIANCE_WEIGHTED: 'compliance_requirements_assessments',
  F5_5_COVERAGE: 'compliance_requirements_assessments',
  F5_5_READINESS: 'grc_readiness_operational_snapshot',
  F5_5_INHERENT_RISK: 'risk_register_controls',
  F5_5_RESIDUAL_RISK: 'risk_register_controls',
  F5_5_COMBINED_EFFECTIVENESS: 'control_assurance_evidence',
  F5_5_CONTROL_EFFECTIVENESS: 'control_assurance_evidence',
  F5_5_CONTROL_COVERAGE: 'control_assurance_evidence',
  F5_5_FREQUENCY_COMPLIANCE: 'control_assurance_evidence',
  F5_5_FAILURE_RATE: 'assurance_test_results',
  F5_5_SEVERITY_INDEX: 'audit_findings_actions',
  F5_5_CLOSURE_RATE: 'audit_findings_actions',
  F5_5_MTTC: 'audit_findings_actions',
  F5_5_AGE: 'audit_findings_actions',
  F5_5_WEIGHTED_PROGRESS: 'audit_findings_actions',
  F5_5_OVERDUE_RATE: 'audit_findings_actions',
  F5_5_EXPECTED_LOSS: 'loss_events_operational',
  F5_5_NET_LOSS: 'loss_events_operational',
  F5_5_LOSS_SEVERITY: 'loss_events_operational',
  F5_5_PARAMETRIC_VAR: 'loss_events_operational',
  F5_5_MONTE_CARLO: 'loss_events_operational',
  F5_5_FMEA_RPN: 'risk_register_controls',
  F5_5_AVAILABILITY: 'continuity_resilience_tests',
  F5_5_MTBF: 'continuity_resilience_tests',
  F5_5_MTTR: 'continuity_resilience_tests',
  F5_5_SLA_COMPLIANCE: 'continuity_resilience_tests',
  F5_5_RTO_GAP: 'continuity_resilience_tests',
  F5_5_RPO_GAP: 'continuity_resilience_tests',
  F5_5_ASSET_CRITICALITY: 'asset_inventory_security',
  F5_5_SUPPLIER_RISK: 'supplier_tprm_assessments',
  F5_5_SURVEY_SCORE: 'survey_response_scoring',
  F5_5_CRONBACH_ALPHA: 'survey_response_scoring',
  F5_5_RESPONSE_RATE: 'survey_response_scoring',
  F5_5_DROPOUT_RATE: 'survey_response_scoring',
  F5_5_ASSURANCE_SCORE: 'assurance_test_results',
  F5_5_SAMPLE_SIZE: 'statistical_metric_measurements',
  F5_5_COMPLETENESS: 'data_quality_observations',
  F5_5_ACCURACY: 'data_quality_observations',
  F5_5_CONSISTENCY: 'data_quality_observations',
  F5_5_FRESHNESS_CONTINUOUS: 'data_quality_observations',
  F5_5_LINEAGE_SCORE: 'data_lineage_observations',
  F5_5_Z_SCORE: 'statistical_metric_measurements',
  F5_5_ROBUST_Z_SCORE: 'statistical_metric_measurements',
  F5_5_LINEAR_TREND: 'statistical_metric_measurements',
  F5_5_PERCENT_VARIATION: 'statistical_metric_measurements',
  F5_5_MOVING_AVERAGE: 'statistical_metric_measurements',
  F5_5_EMA: 'statistical_metric_measurements',
  F5_5_CONFIDENCE_INTERVAL: 'statistical_metric_measurements',
  F5_5_GRC_HEALTH: 'grc_health_components',
  F5_5_MATURITY: 'maturity_assessments',
  F5_C3_DATA_TRUST: 'indicator_data_trust_assessments',
  F5_C3_OPERATIONAL_PERFORMANCE: 'grc_health_components',
  F5_C3_SUPPLIER_HEALTH: 'supplier_tprm_assessments',
});

const INDICATOR_SOURCE_MAP = Object.freeze({
  'INCIDENTS': 'incident_operational_events',
  'EVIDENCE-FRESH': 'evidence_freshness_records',
});

function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex');
}

function contract(definition) {
  if (!AVAILABILITY.has(definition.availability)) throw new Error(`Invalid source availability: ${definition.source_code}`);
  if (!SOURCE_STATUSES.has(definition.status || 'published')) throw new Error(`Invalid source status: ${definition.source_code}`);
  const normalized = Object.freeze({
    source_code: definition.source_code,
    entity: definition.entity,
    tables: Object.freeze(definition.tables || []),
    columns: Object.freeze(definition.columns || []),
    joins: Object.freeze(definition.joins || []),
    tenant_filter: Object.freeze(definition.tenant_filter || { column: 'tenant_id', required: true }),
    status_filter: Object.freeze(definition.status_filter || {}),
    period: Object.freeze(definition.period || { column: null, mode: 'contract_temporal_semantics' }),
    timezone: definition.timezone || 'tenant_timezone',
    unit: definition.unit || null,
    scale_metadata: Object.freeze(definition.scale_metadata || {}),
    count_semantics: Object.freeze(definition.count_semantics || COUNT_SEMANTICS),
    temporal_semantics: Object.freeze(definition.temporal_semantics || TEMPORAL_SEMANTICS_BY_SOURCE[definition.source_code] || {}),
    status_semantics: Object.freeze(definition.status_semantics || STATUS_SEMANTICS_BY_SOURCE[definition.source_code] || {}),
    cardinality: definition.cardinality || 'one_to_many',
    required_fields: Object.freeze(definition.required_fields || ['id', 'tenant_id']),
    exclusions: Object.freeze(definition.exclusions || []),
    null_policy: definition.null_policy || 'exclude_invalid_rows',
    availability: definition.availability,
    version: definition.version || 1,
    status: definition.status || 'published',
    adapter: definition.adapter || definition.source_code,
    variable_map: Object.freeze(definition.variable_map || {}),
    query: definition.query || null,
    limitations: definition.limitations || null,
    route_to_fix: definition.route_to_fix === undefined ? ROUTE_TO_FIX_BY_ENTITY[definition.entity] || null : definition.route_to_fix,
    required_capability: definition.required_capability === undefined ? CAPABILITY_BY_ENTITY[definition.entity] || null : definition.required_capability,
  });
  const {
    route_to_fix: _routeToFix,
    required_capability: _requiredCapability,
    ...governed
  } = normalized;
  return Object.freeze({ ...normalized, checksum: checksum(governed) });
}

const SOURCE_CONTRACTS = Object.freeze([
  contract({
    source_code: 'compliance_requirements_assessments', entity: 'compliance',
    tables: ['grc_framework_requirements', 'grc_requirement_control_mappings', 'grc_control_assurance'],
    columns: ['tenant_id', 'requirement_id', 'tenant_control_id', 'mapping_type', 'coverage_level', 'status', 'score', 'created_at', 'updated_at'],
    joins: ['grc_requirement_control_mappings.requirement_id -> grc_framework_requirements.id', 'grc_control_assurance.tenant_control_id -> grc_requirement_control_mappings.tenant_control_id'],
    required_fields: ['id', 'tenant_id', 'status'], status_filter: { excluded: ['deleted', 'retired', 'rejected'] },
    variable_map: { assessments: 'rows[{status,weight,applicability}]', evaluated: 'count(status not pending)', applicable: 'count(applicability=true)' },
    availability: 'available', version: 5,
    limitations: 'El adaptador normaliza mappings publicados/revisados y assurance de control; requisitos sin mapping permanecen pendientes y no se convierten en cero.'
  }),
  contract({
    source_code: 'grc_readiness_operational_snapshot', entity: 'readiness',
    tables: ['grc_readiness_snapshots', 'grc_readiness_results', 'grc_readiness_findings'],
    columns: ['tenant_id','snapshot_id','dimension','score','weight','source_as_of','severity'], required_fields: ['id','tenant_id','score'],
    variable_map: { compliance: 'dimension=compliance', evidence: 'dimension=evidence', health: 'dimension=health', actions: 'dimension=actions' },
    availability: 'available', version: 5,
    limitations: 'Usa el snapshot más reciente del período; dimensiones ausentes producen unmeasured en vez de imputación.'
  }),
  contract({
    source_code: 'risk_register_controls', entity: 'risk',
    tables: ['iso_risk_matrix_items', 'iso_risk_matrix_runs', 'grc_quantitative_risk_assessments', 'grc_control_assurance'],
    columns: ['tenant_id','risk_id','probability','likelihood','impact','inherent_risk_score','exposure','severity','occurrence','detection','tenant_control_id','score','status'], required_fields: ['id','tenant_id'],
    variable_map: { risks: 'rows[{source_record,probability|likelihood,impact,inherent_risk_score=probability*impact}]', aggregation_method: 'arithmetic_mean', probability: 'probability|likelihood', impact: 'impact', inherentRisk: 'mean(rows.probability*rows.impact)', controlEffectiveness: 'assurance_score normalized by scale_metadata.controlEffectiveness', severity: 'severity', occurrence: 'occurrence', detection: 'detection' },
    scale_metadata: {
      variables: {
        probability: { source_fields: ['probability','likelihood'], source_scale: 'SCORE_1_5', source_unit: 'score', source_min: 1, source_max: 5, canonical_scale: 'SCORE_1_5', canonical_unit: 'score', canonical_min: 1, canonical_max: 5, normalization_strategy: 'identity_integer', precision: 0, allow_null: false, allow_zero: false },
        impact: { source_fields: ['impact'], source_scale: 'SCORE_1_5', source_unit: 'score', source_min: 1, source_max: 5, canonical_scale: 'SCORE_1_5', canonical_unit: 'score', canonical_min: 1, canonical_max: 5, normalization_strategy: 'identity_integer', precision: 0, allow_null: false, allow_zero: false },
        controlEffectiveness: { source_fields: ['assurance_score','control_effectiveness','control_effectiveness_score','control_score','effectiveness_score'], source_scale: 'PERCENT_0_100', source_unit: 'percent', source_min: 0, source_max: 100, canonical_scale: 'RATIO_0_1', canonical_unit: 'ratio', canonical_min: 0, canonical_max: 1, normalization_strategy: 'percent_to_ratio', precision: 4, allow_null: true, allow_zero: true },
      },
    },
    availability: 'available', version: 7,
    limitations: 'RISK-INHERENT calcula el promedio aritmetico del portafolio de riesgos utilizables del tenant; excluye filas sin probabilidad/likelihood o impacto validos 1..5, no usa rows[0], no deduplica por titulo y no cruza tenants.'
  }),
  contract({
    source_code: 'control_assurance_evidence', entity: 'control',
    tables: ['grc_control_assurance', 'grc_evidence_links', 'grc_evidence_quality_scores'],
    columns: ['tenant_id','tenant_control_id','score','assurance_status','calculated_at','evidence_score'], required_fields: ['id','tenant_id','score'],
    variable_map: { design: 'design_score|design_effectiveness only; normalized by scale_metadata.design', implementation: 'implementation_score|implementation_effectiveness only; normalized by scale_metadata.implementation', operation: 'operation_score|operation_effectiveness|operating_effectiveness only; normalized by scale_metadata.operation', evidence: 'evidence_score|evidence_effectiveness only; normalized by scale_metadata.evidence', effectivenesses: 'rows.score as aggregate assurance score normalized by scale_metadata.effectivenesses' },
    scale_metadata: {
      variables: {
        design: { source_fields: ['design_score','design_effectiveness'], source_scale: 'PERCENT_0_100', source_unit: 'percent', source_min: 0, source_max: 100, canonical_scale: 'RATIO_0_1', canonical_unit: 'ratio', canonical_min: 0, canonical_max: 1, normalization_strategy: 'percent_to_ratio', precision: 4, allow_null: false, allow_zero: true },
        implementation: { source_fields: ['implementation_score','implementation_effectiveness'], source_scale: 'PERCENT_0_100', source_unit: 'percent', source_min: 0, source_max: 100, canonical_scale: 'RATIO_0_1', canonical_unit: 'ratio', canonical_min: 0, canonical_max: 1, normalization_strategy: 'percent_to_ratio', precision: 4, allow_null: false, allow_zero: true },
        operation: { source_fields: ['operation_score','operation_effectiveness','operating_effectiveness'], source_scale: 'PERCENT_0_100', source_unit: 'percent', source_min: 0, source_max: 100, canonical_scale: 'RATIO_0_1', canonical_unit: 'ratio', canonical_min: 0, canonical_max: 1, normalization_strategy: 'percent_to_ratio', precision: 4, allow_null: false, allow_zero: true },
        evidence: { source_fields: ['evidence_score','evidence_effectiveness'], source_scale: 'PERCENT_0_100', source_unit: 'percent', source_min: 0, source_max: 100, canonical_scale: 'RATIO_0_1', canonical_unit: 'ratio', canonical_min: 0, canonical_max: 1, normalization_strategy: 'percent_to_ratio', precision: 4, allow_null: false, allow_zero: true },
        effectivenesses: { source_fields: ['score'], source_scale: 'PERCENT_0_100', source_unit: 'percent', source_min: 0, source_max: 100, canonical_scale: 'RATIO_0_1', canonical_unit: 'ratio', canonical_min: 0, canonical_max: 1, normalization_strategy: 'percent_to_ratio', precision: 4, allow_null: false, allow_zero: true },
      },
    },
    availability: 'available', version: 7,
    limitations: 'El score agregado de assurance es una fuente valida solo para score compuesto/effectivenesses; F5_5_CONTROL_EFFECTIVENESS requiere dimensiones D/I/O/E explicitas y nunca fabrica dimensiones desde score.'
  }),
  contract({
    source_code: 'audit_findings_actions', entity: 'audit',
    tables: ['action_plans', 'action_plan_updates', 'grc_readiness_findings', 'grc_effectiveness_verifications'],
    columns: ['tenant_id','severity','status','created_at','opened_at','closed_at','completed_at','due_date','due_at','progress_percent','latest_progress_percent','latest_status_after','latest_update_at','source_as_of','period_start','period_end','generated_at','approved_evidence_count','pending_evidence_count','weight'], required_fields: ['id','tenant_id','status'],
    variable_map: { low: 'count(severity=low)', medium: 'count(severity=medium)', high: 'count(severity=high)', critical: 'count(severity=critical)', items: 'rows[{createdAt,openedAt,closedAt,dueAt,progress,weight,overdue}]' },
    availability: 'available', version: 8,
    limitations: 'Acciones y remediación usan action_plans enriquecidos con el último action_plan_updates válido; hallazgos snapshot de readiness no tienen status operacional y se marcan not_applicable; progreso ausente queda unmeasured y no se convierte en cero.'
  }),
  contract({
    source_code: 'incident_operational_events', entity: 'incident',
    tables: ['grc_incidents', 'grc_incident_impacts', 'grc_incident_timeline'],
    columns: ['tenant_id','incident_number','status','category','priority','calculated_severity','confirmed_severity','reported_at','contained_at','resolved_at','closed_at','financial_impact','duration_minutes','customer_impact'], required_fields: ['id','tenant_id','status'],
    variable_map: { low: 'count(calculated_severity=low)', medium: 'count(calculated_severity=medium)', high: 'count(calculated_severity=high)', critical: 'count(calculated_severity=critical)' },
    availability: 'available', version: 5,
    limitations: 'El indicador INCIDENTS usa severidad de grc_incidents. Impactos financieros, cliente y duración permanecen dimensiones separadas cuando existan; no se replican desde un único campo.'
  }),
  contract({
    source_code: 'evidence_freshness_records', entity: 'evidence',
    tables: ['evidences', 'grc_evidence_submissions', 'grc_evidence_versions', 'grc_evidence_reviews'],
    columns: ['tenant_id','status','validated','created_at','reviewed_at','expires_at','version','submitted_at','decided_at','freshness_score','appears_expired'], required_fields: ['id','tenant_id'],
    variable_map: { ageHours: 'now - effective evidence date', halfLifeHours: '30 days default', status: 'approval/freshness eligibility' },
    availability: 'available', version: 4,
    limitations: 'Freshness de evidencia usa evidencia real, revisión y expiración; data quality freshness conserva su contrato separado.'
  }),
  contract({
    source_code: 'loss_events_operational', entity: 'loss',
    tables: ['loss_events','loss_recoveries'],
    columns: ['tenant_id','occurred_at','event_date','gross_loss','gross_loss_amount','recoveries','recovery_amount','net_loss','net_loss_amount','currency','status','created_at','updated_at'],
    required_fields: ['id','tenant_id','event_date'],
    variable_map: { grossLoss: 'gross_loss_amount|gross_loss', recoveries: 'recovery_amount|recoveries', netLosses: 'net_loss_amount|net_loss|gross-recoveries', eventDate: 'occurred_at|event_date only; missing/future occurrence is excluded by temporal_semantics' },
    unit: 'currency',
    availability: 'available',
    version: 6,
    limitations: 'Normaliza columnas reales de loss_events usadas por la UI. Loss occurrence time proviene de occurred_at/event_date; fechas ausentes o futuras se excluyen con razon temporal auditable, sin fallback a created_at.'
  }),
  contract({ source_code: 'continuity_resilience_tests', entity: 'continuity', tables: ['grc_bia_assessments','grc_continuity_plans','grc_continuity_tests'], columns: ['tenant_id','rto_hours','rpo_hours','actual_recovery_hours','actual_data_loss_hours','result','tested_at','status'], required_fields: ['id','tenant_id'], unit: 'hours', availability: 'available', version: 4 }),
  contract({ source_code: 'asset_inventory_security', entity: 'asset', tables: ['data_elements'], columns: ['tenant_id','name','classification','owner_user_id','metadata','status'], required_fields: ['id','tenant_id'], availability: 'available', version: 4, limitations: 'Package 4 binds asset criticality to data_elements until a dedicated asset inventory table supersedes it.' }),
  contract({
    source_code: 'supplier_tprm_assessments', entity: 'supplier',
    tables: ['grc_suppliers','grc_supplier_assessments','grc_supplier_answers','grc_supplier_contracts'],
    columns: ['tenant_id','supplier_id','criticality','compliance_score','security_score','dependency_score','resilience_score','privacy_score','performance_score','assurance_score','continuity_score','incident_health_score','data_trust_score','status'], required_fields: ['id','tenant_id','status'],
    scale_metadata: {
      variables: {
        supplierRiskDimensions: { source_fields: ['compliance_score','security_score','dependency_score','privacy_score','resilience_score'], source_scale: 'SCORE_0_5', source_unit: 'score', source_min: 0, source_max: 5, canonical_scale: 'SCORE_0_5', canonical_unit: 'score', canonical_min: 0, canonical_max: 5, normalization_strategy: 'identity', precision: 2, allow_null: false, allow_zero: true },
        supplierRiskHealth: { source_fields: ['compliance_score','security_score','dependency_score','privacy_score','resilience_score'], source_scale: 'SCORE_0_5', source_unit: 'score', source_min: 0, source_max: 5, canonical_scale: 'PERCENT_0_100', canonical_unit: 'percent', canonical_min: 0, canonical_max: 100, normalization_strategy: 'score_0_5_to_percent', precision: 2, allow_null: false, allow_zero: true },
      },
    },
    availability: 'available',
    version: 5,
    limitations: 'Supplier risk dimensions use declared 0..5 score scale; supplier health converts 0..5 to percent through scale metadata, not by magnitude.'
  }),
  contract({ source_code: 'survey_response_scoring', entity: 'survey', tables: ['survey_definitions','survey_versions','survey_questions','assessment_campaigns','assessment_recipients','survey_responses','survey_response_items'], columns: ['tenant_id','response_id','question_id','score','max_score','weight','status','submitted_at'], required_fields: ['id','tenant_id','status'], availability: 'available', version: 4 }),
  contract({ source_code: 'assurance_test_results', entity: 'assurance', tables: ['assurance_test_definitions','assurance_test_executions','assurance_test_samples','assurance_test_results','assurance_test_exceptions'], columns: ['tenant_id','execution_id','sample_id','result','weight','exception_count','status','executed_at'], required_fields: ['id','tenant_id','result'], availability: 'available', version: 5 }),
  contract({ source_code: 'data_quality_observations', entity: 'data_quality', tables: ['data_quality_rules','data_quality_assessments','metric_validations'], columns: ['tenant_id','rule_type','expected_count','valid_count','invalid_count','coverage','assessed_at'], required_fields: ['id','tenant_id'], availability: 'available', version: 4 }),
  contract({ source_code: 'data_lineage_observations', entity: 'data_lineage', tables: ['data_lineage_edges','data_sources','data_elements'], columns: ['tenant_id','source_entity_type','source_entity_id','target_entity_type','target_entity_id','relation_type','created_at'], required_fields: ['id','tenant_id','relation_type'], availability: 'available', version: 4 }),
  contract({ source_code: 'statistical_metric_measurements', entity: 'statistics', tables: ['metric_measurements','metric_definitions','metric_dimensions'], columns: ['tenant_id','metric_id','numeric_value','measured_at','unit','dimension_values','status'], required_fields: ['id','tenant_id','numeric_value'], cardinality: 'time_series', availability: 'available', version: 4 }),
  contract({
    source_code: 'indicator_data_trust_assessments', entity: 'data_trust',
    tables: ['metric_trust_assessments'], columns: ['tenant_id','dimensions','trust_status','assessed_at','assessment_checksum'],
    required_fields: ['id','tenant_id','dimensions'],
    variable_map: { completeness:'dimensions.completeness.score',accuracy:'dimensions.accuracy.score',consistency:'dimensions.consistency.score',freshness:'dimensions.freshness.score',lineage:'dimensions.lineage.score',validation:'dimensions.validation.score',stability:'dimensions.stability.score',coverage:'dimensions.coverage.score' },
    availability: 'available', version: 5,
    limitations: 'Compone únicamente las ocho dimensiones persistidas; una dimensión desconocida impide calcular y nunca se renormaliza.'
  }),
  contract({
    source_code: 'grc_health_components', entity: 'health',
    tables: ['calculation_runs','calculation_outputs','data_trust_scores'],
    columns: ['tenant_id','formula_code','output_value','trust_score','period_start','period_end','started_at','completed_at','run_status'], required_fields: ['id','tenant_id','formula_code'],
    variable_map: { risk: 'latest risk output', compliance: 'latest compliance output', actions: 'latest actions output', evidence: 'latest evidence/trust output', dataTrust: 'latest trust score' },
    availability: 'available', version: 6,
    limitations: 'Solo consume outputs oficiales calculados y aprobados; componentes ausentes dejan Health como unmeasured.'
  }),
  contract({
    source_code: 'maturity_assessments', entity: 'maturity',
    tables: ['survey_evaluations','metric_measurements'],
    columns: ['tenant_id','score','numeric_value','weight','evaluated_at','confirmed_at','measured_at','source_timestamp','calculated_at','period_start','period_end','created_at','status','metadata'], required_fields: ['id','tenant_id'],
    variable_map: { levels: 'rows[{level|score|numeric_value,weight}]' },
    scale_metadata: {
      variables: {
        level: { source_fields: ['level','maturity_level','numeric_value','value_numeric'], source_scale: 'SCORE_0_5', source_unit: 'level', source_min: 0, source_max: 5, canonical_scale: 'SCORE_0_5', canonical_unit: 'level', canonical_min: 0, canonical_max: 5, normalization_strategy: 'identity', precision: 2, allow_null: false, allow_zero: true },
        score: { source_fields: ['score','total_score'], source_scale: 'PERCENT_0_100', source_unit: 'percent', source_min: 0, source_max: 100, canonical_scale: 'SCORE_0_5', canonical_unit: 'level', canonical_min: 0, canonical_max: 5, normalization_strategy: 'percent_to_score_0_5', precision: 2, allow_null: false, allow_zero: true },
      },
    },
    availability: 'available', version: 7,
    limitations: 'Prioriza evaluaciones confirmadas/aplicadas y usa mediciones de madurez como fallback; estados preview/draft son conocidos pero no elegibles. La escala de nivel se declara en el contrato y no se infiere por magnitud.'
  }),
  contract({ source_code: 'external_fx_rates', entity: 'currency_conversion', tables: ['external_fx_rates'], columns: ['base_currency','quote_currency','rate','effective_at','source'], required_fields: ['base_currency','quote_currency','rate'], availability: 'source_unavailable', version: 4, limitations: 'No official tenant-safe FX source is configured; loss calculations must not mix currencies.' }),
]);

const SOURCE_CONTRACT_MAP = new Map(SOURCE_CONTRACTS.map((item) => [item.source_code, item]));

function getSourceCodeForFormula(formulaCode) { return FORMULA_SOURCE_MAP[formulaCode] || 'source_unavailable'; }
function getSourceCodeForIndicator(indicatorCode, formulaCode) { return INDICATOR_SOURCE_MAP[indicatorCode] || getSourceCodeForFormula(formulaCode); }
function listSourceContracts() { return SOURCE_CONTRACTS.map((item) => ({ ...item })); }
function getSourceContract(sourceCode) { const value = SOURCE_CONTRACT_MAP.get(sourceCode); return value ? { ...value } : null; }
function listFormulaSourceBindings() { return Object.entries(FORMULA_SOURCE_MAP).map(([formula_code, source_code]) => ({ formula_code, source_code, contract: getSourceContract(source_code) })); }

module.exports = { AVAILABILITY, FORMULA_SOURCE_MAP, SOURCE_CONTRACTS, TEMPORAL_SEMANTICS_BY_SOURCE, STATUS_SEMANTICS_BY_SOURCE, getSourceCodeForFormula, getSourceCodeForIndicator, getSourceContract, listSourceContracts, listFormulaSourceBindings };
