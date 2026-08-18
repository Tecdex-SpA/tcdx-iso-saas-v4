-- TCDX ISO SaaS v4 - F6.8-02 governed Observation emitter outbox.
-- Adds tenant-scoped, retry-safe event storage for automatic canonical Observation emission.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS grc_observation_emission_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  producer_type text NOT NULL,
  producer_id uuid NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  source_table text NOT NULL,
  source_record_id text NOT NULL,
  source_snapshot_id uuid,
  rule_code text NOT NULL,
  rule_version integer NOT NULL DEFAULT 1 CHECK (rule_version > 0),
  idempotency_key char(64) NOT NULL,
  observation_identity jsonb NOT NULL,
  observed_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ignored','completed','failed','dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  observation_id uuid REFERENCES grc_observations(id) ON DELETE SET NULL,
  correlation_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  CHECK (status IN ('ignored','failed','dead_letter') OR observed_at IS NOT NULL),
  CHECK (status <> 'completed' OR observation_id IS NOT NULL),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_grc_observation_emission_pending
  ON grc_observation_emission_outbox (tenant_id, status, next_attempt_at, created_at)
  WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS idx_grc_observation_emission_source
  ON grc_observation_emission_outbox (tenant_id, producer_type, producer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_observation_emission_rule
  ON grc_observation_emission_outbox (tenant_id, rule_code, rule_version, status);

CREATE OR REPLACE FUNCTION touch_grc_observation_emission_outbox_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grc_observation_emission_outbox_updated_at ON grc_observation_emission_outbox;
CREATE TRIGGER trg_grc_observation_emission_outbox_updated_at
BEFORE UPDATE ON grc_observation_emission_outbox
FOR EACH ROW EXECUTE FUNCTION touch_grc_observation_emission_outbox_updated_at();

DO $$
BEGIN
  IF to_regclass('public.grc_observation_links') IS NOT NULL THEN
    RAISE EXCEPTION 'F6.8-02 refuses parallel observation relation table grc_observation_links';
  END IF;
  IF to_regclass('public.grc_observations') IS NULL OR to_regclass('public.grc_observation_relations') IS NULL THEN
    RAISE EXCEPTION 'F6.8-02 requires canonical observation tables before outbox bootstrap';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_semantic_observation_history'
      AND tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'F6.8-02 requires canonical observation history immutability trigger';
  END IF;
END $$;

COMMIT;
