BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE data_lineage_edges
  DROP CONSTRAINT IF EXISTS data_lineage_edges_relation_type_check;

ALTER TABLE data_lineage_edges
  ADD CONSTRAINT data_lineage_edges_relation_type_check
  CHECK (relation_type IN (
    'derived_from',
    'measured_from',
    'validated_by',
    'supported_by',
    'affects',
    'mitigates',
    'tests',
    'evidences',
    'generates',
    'requires',
    'aggregates',
    'reported_in',
    'snapshot_of',
    'owned_by',
    'related_to'
  ));

CREATE INDEX IF NOT EXISTS idx_data_lineage_relation
  ON data_lineage_edges (tenant_id, relation_type, created_at DESC);

CREATE TABLE IF NOT EXISTS data_trust_score_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  version_key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  weights jsonb NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','retired')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_trust_score_versions_unique
  ON data_trust_score_versions (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), version_key, version_number);

CREATE TABLE IF NOT EXISTS grc_analytical_impact_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  trigger_entity_type text NOT NULL,
  trigger_status text NOT NULL,
  target_entity_type text NOT NULL,
  relation_type text NOT NULL CHECK (relation_type IN (
    'derived_from','measured_from','validated_by','supported_by','affects','mitigates',
    'tests','evidences','generates','requires','aggregates','reported_in','snapshot_of',
    'owned_by','related_to'
  )),
  effect_type text NOT NULL CHECK (effect_type IN ('warning','recalculate_metric','review_task','snapshot','audit_only')),
  rule_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','retired')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_impact_rules_unique
  ON grc_analytical_impact_rules (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_key, version_number);

CREATE INDEX IF NOT EXISTS idx_grc_impact_rules_trigger
  ON grc_analytical_impact_rules (tenant_id, trigger_entity_type, trigger_status, status);

CREATE TABLE IF NOT EXISTS grc_analytical_impact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES grc_analytical_impact_rules(id) ON DELETE SET NULL,
  source_entity_type text NOT NULL,
  source_entity_id uuid NOT NULL,
  target_entity_type text,
  target_entity_id uuid,
  effect_type text NOT NULL CHECK (effect_type IN ('warning','recalculate_metric','review_task','snapshot','audit_only')),
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation text NOT NULL,
  correlation_id text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_grc_impact_events_source
  ON grc_analytical_impact_events (tenant_id, source_entity_type, source_entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_impact_events_target
  ON grc_analytical_impact_events (tenant_id, target_entity_type, target_entity_id, created_at DESC);

INSERT INTO data_trust_score_versions (version_key, version_number, weights, status, metadata)
SELECT
  'data_trust_score',
  2,
  '{
    "completeness": 0.12,
    "accuracy": 0.12,
    "consistency": 0.10,
    "freshness": 0.12,
    "lineage": 0.10,
    "validation": 0.10,
    "stability": 0.06,
    "coverage": 0.06,
    "source_availability": 0.08,
    "assurance_result": 0.06,
    "evidence_trace": 0.04,
    "dimension_quality": 0.04
  }'::jsonb,
  'published',
  '{"reason":"Hotfix Fase 5 incorpora contexto GRC, fuente, assurance, evidencia y dimensiones."}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM data_trust_score_versions
  WHERE tenant_id IS NULL AND version_key = 'data_trust_score' AND version_number = 2
);

UPDATE data_trust_score_versions
SET weights = '{
    "completeness": 0.12,
    "accuracy": 0.12,
    "consistency": 0.10,
    "freshness": 0.12,
    "lineage": 0.10,
    "validation": 0.10,
    "stability": 0.06,
    "coverage": 0.06,
    "source_availability": 0.08,
    "assurance_result": 0.06,
    "evidence_trace": 0.04,
    "dimension_quality": 0.04
  }'::jsonb,
  status = 'published',
  metadata = metadata || '{"reason":"Hotfix Fase 5 incorpora contexto GRC, fuente, assurance, evidencia y dimensiones."}'::jsonb
WHERE tenant_id IS NULL AND version_key = 'data_trust_score' AND version_number = 2;

WITH rules(rule_key, version_number, trigger_entity_type, trigger_status, target_entity_type, relation_type, effect_type, rule_definition, status, metadata) AS (
  VALUES
    ('evidence_expired_reduces_control_trust', 1, 'evidence', 'expired', 'control', 'affects', 'warning', '{"summary":"Evidencia vencida reduce confianza analitica del control asociado."}'::jsonb, 'published', '{}'::jsonb),
    ('assurance_test_failed_affects_control_risk', 1, 'assurance_test_execution', 'fail', 'control', 'affects', 'review_task', '{"summary":"Test fallido marca control/riesgo para revision sin cambiar decision aprobada."}'::jsonb, 'published', '{}'::jsonb),
    ('loss_event_confirmed_updates_kri', 1, 'loss_event', 'confirmed', 'metric_definition', 'affects', 'recalculate_metric', '{"summary":"Perdida confirmada alimenta KRI de perdidas y resumen ejecutivo."}'::jsonb, 'published', '{}'::jsonb),
    ('source_unavailable_limits_metric_trust', 1, 'data_source', 'unavailable', 'metric_definition', 'affects', 'warning', '{"summary":"Fuente no disponible limita confianza de metricas dependientes."}'::jsonb, 'published', '{}'::jsonb),
    ('measurement_rejected_warns_dashboard_report', 1, 'metric_measurement', 'rejected', 'dashboard_definition', 'affects', 'warning', '{"summary":"Medicion rechazada debe advertirse en dashboards y reportes consumidores."}'::jsonb, 'published', '{}'::jsonb),
    ('overdue_action_affects_operational_state', 1, 'action', 'overdue', 'metric_definition', 'affects', 'warning', '{"summary":"Accion vencida afecta indicadores operacionales de remediacion."}'::jsonb, 'published', '{}'::jsonb),
    ('critical_supplier_without_assessment_affects_tprm', 1, 'supplier', 'critical_without_assessment', 'risk', 'affects', 'review_task', '{"summary":"Proveedor critico sin assessment vigente afecta riesgo de terceros."}'::jsonb, 'published', '{}'::jsonb)
)
INSERT INTO grc_analytical_impact_rules (
  rule_key, version_number, trigger_entity_type, trigger_status, target_entity_type,
  relation_type, effect_type, rule_definition, status, metadata
)
SELECT rule_key, version_number, trigger_entity_type, trigger_status, target_entity_type,
       relation_type, effect_type, rule_definition, status, metadata
FROM rules
WHERE NOT EXISTS (
  SELECT 1 FROM grc_analytical_impact_rules r
  WHERE r.tenant_id IS NULL
    AND r.rule_key = rules.rule_key
    AND r.version_number = rules.version_number
);

COMMIT;
