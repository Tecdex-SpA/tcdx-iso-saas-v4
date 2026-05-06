-- =========================================================
-- TCDX ISO SaaS - ISO control mapping apply log
-- Fase 1.3: trazabilidad de dry-run y aplicacion controlada.
--
-- Modo no destructivo:
-- - Crea solo tabla e indices iso_*.
-- - No modifica tablas operativas.
-- =========================================================

CREATE TABLE IF NOT EXISTS iso_control_mapping_apply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL,
  version_code text NOT NULL,
  dry_run boolean NOT NULL,
  min_confidence numeric NOT NULL,
  candidates_total integer NOT NULL DEFAULT 0,
  can_auto_apply_count integer NOT NULL DEFAULT 0,
  applied_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  requested_by uuid,
  requested_role text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_control_mapping_apply_log_standard_version
  ON iso_control_mapping_apply_log(standard_code, version_code);

CREATE INDEX IF NOT EXISTS idx_iso_control_mapping_apply_log_dry_run
  ON iso_control_mapping_apply_log(dry_run);

CREATE INDEX IF NOT EXISTS idx_iso_control_mapping_apply_log_created_at
  ON iso_control_mapping_apply_log(created_at);

CREATE INDEX IF NOT EXISTS idx_iso_control_mapping_apply_log_requested_by
  ON iso_control_mapping_apply_log(requested_by);

COMMENT ON TABLE iso_control_mapping_apply_log IS
  'Trazabilidad de dry-runs y aplicaciones reales de sugerencias de mapeo ISO sin guardar tokens ni secretos.';
