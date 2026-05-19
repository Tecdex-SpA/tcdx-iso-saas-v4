-- =========================================================
-- TCDX ISO SaaS
-- Jobs asincronos persistentes para IA, reportes y exportes
-- Migracion no destructiva e idempotente
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tcdx_async_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  priority text NULL,
  model_mode text NULL,
  source_module text NULL,
  request_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json jsonb NULL,
  result_file_id uuid NULL,
  result_file_url text NULL,
  result_download_url text NULL,
  error_json jsonb NULL,
  request_id text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tcdx_async_jobs
  ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS priority text NULL,
  ADD COLUMN IF NOT EXISTS model_mode text NULL,
  ADD COLUMN IF NOT EXISTS source_module text NULL,
  ADD COLUMN IF NOT EXISTS request_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS result_file_id uuid NULL,
  ADD COLUMN IF NOT EXISTS result_file_url text NULL,
  ADD COLUMN IF NOT EXISTS result_download_url text NULL,
  ADD COLUMN IF NOT EXISTS error_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tcdx_async_jobs_tenant_created
  ON tcdx_async_jobs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tcdx_async_jobs_tenant_status_created
  ON tcdx_async_jobs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tcdx_async_jobs_user_created
  ON tcdx_async_jobs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tcdx_async_jobs_type_status
  ON tcdx_async_jobs (job_type, status);

CREATE INDEX IF NOT EXISTS idx_tcdx_async_jobs_request_id
  ON tcdx_async_jobs (request_id)
  WHERE request_id IS NOT NULL;
