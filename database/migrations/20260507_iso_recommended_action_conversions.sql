-- =========================================================
-- TCDX ISO SaaS - Safe ISO Recommended Action Conversions
-- Fase 1.9: trazabilidad de conversiones desde sugerencias ISO
-- hacia objetos operativos del SaaS.
--
-- Modo no destructivo:
-- - Solo crea tabla/indices iso_*.
-- - No crea planes, hallazgos, no conformidades ni evidencias.
-- - No modifica tenant_controls, tenant_standards ni evidences.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS iso_recommended_action_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  recommendation_id uuid NOT NULL REFERENCES iso_operational_suggestions(id),
  target_type text NOT NULL,
  target_table text NULL,
  target_id uuid NULL,
  conversion_status text NOT NULL DEFAULT 'converted',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  converted_by uuid NULL REFERENCES users(id),
  converted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_iso_recommended_action_conversions_target_type CHECK (
    target_type IN (
      'action_plan',
      'finding',
      'nonconformity',
      'evidence_request',
      'audit_task',
      'risk_mitigation',
      'control_review'
    )
  ),
  CONSTRAINT chk_iso_recommended_action_conversions_status CHECK (
    conversion_status IN ('dry_run', 'converted', 'blocked', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_conversions_tenant
  ON iso_recommended_action_conversions(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_conversions_recommendation
  ON iso_recommended_action_conversions(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_conversions_target
  ON iso_recommended_action_conversions(target_type, target_table, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_iso_recommended_action_conversions_target
  ON iso_recommended_action_conversions(recommendation_id, target_type, target_id)
  WHERE target_id IS NOT NULL;

COMMENT ON TABLE iso_recommended_action_conversions IS
  'Trazabilidad de conversiones confirmadas de recomendaciones ISO a objetos operativos reales. Los dry-run no insertan filas en esta tabla.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tecdex_user') THEN
    GRANT SELECT, INSERT, UPDATE ON iso_recommended_action_conversions TO tecdex_user;
  END IF;
END $$;
