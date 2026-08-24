-- =========================================================
-- TCDX ISO SaaS v4 - F6.13-A Operational Learning
-- Recommendation Decision Ledger + Effectiveness Feedback
-- Loop + Operational Memory.
--
-- Forward-only, additive, tenant-scoped.
-- Does not create priority, observation, gap, KB or retrieval truth.
-- =========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS recommendation_decision_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  decision_key text NOT NULL,
  idempotency_key text NOT NULL,
  contract_version text NOT NULL DEFAULT 'recommendation-decision-ledger-v1',
  recommendation_id uuid NULL REFERENCES iso_operational_suggestions(id) ON DELETE SET NULL,
  recommendation_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation_version text NULL,
  subject_type text NOT NULL,
  subject_id uuid NULL,
  source_intelligence_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text NOT NULL,
  decision_status text NOT NULL DEFAULT 'recorded',
  decision_reason text NOT NULL,
  decision_actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision_at timestamptz NOT NULL,
  correlation_id text NOT NULL,
  previous_decision_id uuid NULL REFERENCES recommendation_decision_ledger(id) ON DELETE SET NULL,
  human_modification jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_recommendation_decision_ledger_contract CHECK (contract_version = 'recommendation-decision-ledger-v1'),
  CONSTRAINT chk_recommendation_decision_ledger_decision CHECK (
    decision IN ('accepted','modified','rejected','deferred','escalated','executed','cancelled')
  ),
  CONSTRAINT chk_recommendation_decision_ledger_status CHECK (
    decision_status IN ('recorded','linked_to_action','superseded','cancelled')
  ),
  CONSTRAINT chk_recommendation_decision_ledger_reason CHECK (length(trim(decision_reason)) > 0),
  CONSTRAINT chk_recommendation_decision_ledger_correlation CHECK (length(trim(correlation_id)) > 0),
  CONSTRAINT chk_recommendation_decision_ledger_idempotency CHECK (length(trim(idempotency_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recommendation_decision_ledger_tenant_decision_key
  ON recommendation_decision_ledger(tenant_id, decision_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recommendation_decision_ledger_tenant_idempotency
  ON recommendation_decision_ledger(tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_recommendation_decision_ledger_tenant_created
  ON recommendation_decision_ledger(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_decision_ledger_recommendation
  ON recommendation_decision_ledger(tenant_id, recommendation_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_decision_ledger_subject
  ON recommendation_decision_ledger(tenant_id, subject_type, subject_id);

CREATE TABLE IF NOT EXISTS recommendation_effectiveness_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  evaluation_key text NOT NULL,
  idempotency_key text NOT NULL,
  contract_version text NOT NULL DEFAULT 'effectiveness-feedback-loop-v1',
  decision_id uuid NOT NULL REFERENCES recommendation_decision_ledger(id) ON DELETE RESTRICT,
  action_conversion_id uuid NULL REFERENCES iso_recommended_action_conversions(id) ON DELETE SET NULL,
  action_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodology text NOT NULL,
  expected_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  effectiveness_result text NOT NULL,
  confidence numeric(5,4) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  data_trust jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluation_window_start timestamptz NULL,
  evaluation_window_end timestamptz NULL,
  observation_time timestamptz NULL,
  evaluated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  evaluated_at timestamptz NOT NULL,
  correlation_id text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_recommendation_effectiveness_contract CHECK (contract_version = 'effectiveness-feedback-loop-v1'),
  CONSTRAINT chk_recommendation_effectiveness_result CHECK (
    effectiveness_result IN ('effective','partially_effective','ineffective','inconclusive','insufficient_data')
  ),
  CONSTRAINT chk_recommendation_effectiveness_methodology CHECK (length(trim(methodology)) > 0),
  CONSTRAINT chk_recommendation_effectiveness_correlation CHECK (length(trim(correlation_id)) > 0),
  CONSTRAINT chk_recommendation_effectiveness_idempotency CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT chk_recommendation_effectiveness_window CHECK (
    evaluation_window_start IS NULL
    OR evaluation_window_end IS NULL
    OR evaluation_window_end >= evaluation_window_start
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recommendation_effectiveness_tenant_evaluation_key
  ON recommendation_effectiveness_evaluations(tenant_id, evaluation_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recommendation_effectiveness_tenant_idempotency
  ON recommendation_effectiveness_evaluations(tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_recommendation_effectiveness_tenant_created
  ON recommendation_effectiveness_evaluations(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_effectiveness_decision
  ON recommendation_effectiveness_evaluations(tenant_id, decision_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_effectiveness_result
  ON recommendation_effectiveness_evaluations(tenant_id, effectiveness_result, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS operational_memory_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  case_key text NOT NULL,
  idempotency_key text NOT NULL,
  contract_version text NOT NULL DEFAULT 'operational-memory-v1',
  lifecycle_status text NOT NULL DEFAULT 'candidate',
  case_type text NOT NULL DEFAULT 'recommendation_case',
  title text NOT NULL,
  summary text NOT NULL,
  summary_checksum char(64) NOT NULL,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  effectiveness_evaluations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_lessons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_decision_id uuid NULL REFERENCES recommendation_decision_ledger(id) ON DELETE SET NULL,
  source_effectiveness_evaluation_id uuid NULL REFERENCES recommendation_effectiveness_evaluations(id) ON DELETE SET NULL,
  data_trust jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_by uuid NULL REFERENCES users(id) ON DELETE RESTRICT,
  confirmed_at timestamptz NULL,
  confirmation_reason text NULL,
  correlation_id text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_operational_memory_contract CHECK (contract_version = 'operational-memory-v1'),
  CONSTRAINT chk_operational_memory_lifecycle CHECK (
    lifecycle_status IN ('candidate','confirmed','rejected','deprecated')
  ),
  CONSTRAINT chk_operational_memory_case_type CHECK (
    case_type IN ('recommendation_case','effectiveness_case','lesson_candidate','ai_hypothesis')
  ),
  CONSTRAINT chk_operational_memory_confirmation CHECK (
    lifecycle_status <> 'confirmed'
    OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL AND length(trim(COALESCE(confirmation_reason, ''))) > 0)
  ),
  CONSTRAINT chk_operational_memory_correlation CHECK (length(trim(correlation_id)) > 0),
  CONSTRAINT chk_operational_memory_idempotency CHECK (length(trim(idempotency_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_operational_memory_cases_tenant_case_key
  ON operational_memory_cases(tenant_id, case_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_operational_memory_cases_tenant_idempotency
  ON operational_memory_cases(tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_operational_memory_cases_tenant_lifecycle
  ON operational_memory_cases(tenant_id, lifecycle_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_memory_cases_source_decision
  ON operational_memory_cases(tenant_id, source_decision_id);

CREATE TABLE IF NOT EXISTS operational_memory_case_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES operational_memory_cases(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NULL,
  target_key text NULL,
  target_contract_version text NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_operational_memory_case_links_type CHECK (
    link_type IN ('observation','gap','priority','action','recommendation','effectiveness','knowledge','regulatory','impact_graph','source_context')
  ),
  CONSTRAINT chk_operational_memory_case_links_target CHECK (
    target_id IS NOT NULL OR length(trim(COALESCE(target_key, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_memory_case_links_case
  ON operational_memory_case_links(tenant_id, case_id);

CREATE INDEX IF NOT EXISTS idx_operational_memory_case_links_target
  ON operational_memory_case_links(tenant_id, target_type, target_id);

COMMENT ON TABLE recommendation_decision_ledger IS
  'F6.13-A append-only human decision ledger for recommendations/actions. References canonical recommendation, intelligence and priority context; it does not create operational truth or allow AI final decisions.';

COMMENT ON TABLE recommendation_effectiveness_evaluations IS
  'F6.13-A before/after effectiveness evaluations for decisions/actions. Closed status is not treated as effectiveness evidence.';

COMMENT ON TABLE operational_memory_cases IS
  'F6.13-A governed tenant-scoped operational memory cases. Separates facts, decisions, outcomes, evaluations, confirmed lessons and AI hypotheses without creating a second KB or retrieval engine.';

COMMENT ON TABLE operational_memory_case_links IS
  'F6.13-A references from operational memory cases to canonical GRC, priority, knowledge and regulatory objects.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tecdex_user') THEN
    GRANT SELECT, INSERT ON recommendation_decision_ledger TO tecdex_user;
    GRANT SELECT, INSERT ON recommendation_effectiveness_evaluations TO tecdex_user;
    GRANT SELECT, INSERT, UPDATE ON operational_memory_cases TO tecdex_user;
    GRANT SELECT, INSERT ON operational_memory_case_links TO tecdex_user;
  END IF;
END $$;

COMMIT;
