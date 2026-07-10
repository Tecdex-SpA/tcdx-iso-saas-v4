-- Fase 5.5 SOA: indices no destructivos para lectura, metricas y auditoria.
-- No borra datos ni cambia contratos existentes.

DO $$
BEGIN
  IF to_regclass('public.control_soa') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_control_soa_tenant_control ON control_soa (tenant_control_id)';
  END IF;

  IF to_regclass('public.control_soa_change_log') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_control_soa_change_log_tenant_changed_at ON control_soa_change_log (tenant_id, changed_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_control_soa_change_log_control_changed_at ON control_soa_change_log (tenant_control_id, changed_at DESC)';
  END IF;
END $$;
