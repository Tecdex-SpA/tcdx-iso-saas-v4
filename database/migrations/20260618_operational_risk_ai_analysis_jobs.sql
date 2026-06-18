-- =========================================================
-- TCDX ISO SaaS - Operational Risk AI Analysis Jobs
-- Historial asincrono para analisis AI Beta-PERT.
--
-- Modo no destructivo:
-- - Solo crea tabla nueva operational_risk_ai_analysis_jobs.
-- - No modifica simulaciones ni recomendaciones existentes.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS operational_risk_ai_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  simulation_id uuid NULL REFERENCES operational_risk_simulations(id) ON DELETE CASCADE,
  source_risk_id uuid NULL REFERENCES iso_risk_matrix_items(id),
  status text NOT NULL DEFAULT 'pending',
  prompt_version text NOT NULL DEFAULT 'beta-pert-operational-risk-v1',
  ai_model text NULL,
  request_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_json jsonb NULL,
  error_code text NULL,
  error_message text NULL,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  CONSTRAINT chk_operational_risk_ai_analysis_job_status CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'timeout')
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_risk_ai_jobs_tenant_sim_created
  ON operational_risk_ai_analysis_jobs(tenant_id, simulation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_risk_ai_jobs_tenant_source_created
  ON operational_risk_ai_analysis_jobs(tenant_id, source_risk_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_risk_ai_jobs_status_created
  ON operational_risk_ai_analysis_jobs(status, created_at);
