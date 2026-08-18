-- TCDX ISO SaaS v4 - F6.8-01-HF1 Observation architecture reconciliation.
-- Preserves the Phase 5-C2 canonical semantic observation model.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'grc_observations'
      AND column_name = 'source_identity_hash'
  ) THEN
    RAISE EXCEPTION 'grc_observations is not the canonical semantic observation table; refusing unsafe reconciliation';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_grc_observations_touch_updated_at ON grc_observations;
DROP FUNCTION IF EXISTS grc_touch_observation_updated_at();

DO $$
BEGIN
  IF to_regclass('public.grc_observation_links') IS NOT NULL THEN
    INSERT INTO grc_observation_relations (
      tenant_id,
      observation_id,
      related_entity_type,
      related_entity_id,
      relation_type,
      confidence,
      valid_from,
      valid_until,
      created_by,
      created_at,
      metadata
    )
    SELECT
      link.tenant_id,
      link.observation_id,
      link.target_type,
      link.target_id,
      CASE link.relation_type
        WHEN 'relates_to' THEN 'related_to'
        WHEN 'evidence_for' THEN 'evidences'
        WHEN 'impacts' THEN 'affects'
        WHEN 'caused_by' THEN 'derived_from'
        ELSE 'related_to'
      END,
      1,
      COALESCE(link.created_at, now()),
      CASE
        WHEN COALESCE(link.is_active, true) THEN NULL
        ELSE COALESCE(link.created_at, now()) + interval '1 microsecond'
      END,
      link.created_by,
      COALESCE(link.created_at, now()),
      COALESCE(link.metadata, '{}'::jsonb) || jsonb_build_object(
        'reconciled_from', 'grc_observation_links',
        'original_relation_type', link.relation_type,
        'original_source', link.source,
        'original_active', COALESCE(link.is_active, true)
      )
    FROM grc_observation_links link
    JOIN grc_observations observation
      ON observation.id = link.observation_id
     AND observation.tenant_id = link.tenant_id
    ON CONFLICT (tenant_id, observation_id, related_entity_type, related_entity_id, relation_type)
    DO UPDATE SET
      metadata = grc_observation_relations.metadata || EXCLUDED.metadata,
      valid_until = COALESCE(grc_observation_relations.valid_until, EXCLUDED.valid_until);

    DROP TABLE grc_observation_links;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_status_value
  ON grc_observations (tenant_id, status_value, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_source
  ON grc_observations (tenant_id, source_table, source_record_id);

CREATE INDEX IF NOT EXISTS idx_grc_observations_tenant_severity
  ON grc_observations (tenant_id, severity_value, observed_at DESC);

COMMIT;
