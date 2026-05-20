CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  industry text NULL,
  subindustry text NULL,
  company_size text NULL,
  maturity_level text NULL,
  risk_appetite text NULL,
  allow_web_research boolean NOT NULL DEFAULT false,
  allow_document_context boolean NOT NULL DEFAULT true,
  allow_ai_recommendations boolean NOT NULL DEFAULT true,
  context_document_file_id uuid NULL,
  context_document_url text NULL,
  ai_profile_summary_json jsonb NULL,
  ai_research_trace_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_company_profiles
  ADD COLUMN IF NOT EXISTS profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS industry text NULL,
  ADD COLUMN IF NOT EXISTS subindustry text NULL,
  ADD COLUMN IF NOT EXISTS company_size text NULL,
  ADD COLUMN IF NOT EXISTS maturity_level text NULL,
  ADD COLUMN IF NOT EXISTS risk_appetite text NULL,
  ADD COLUMN IF NOT EXISTS allow_web_research boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_document_context boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_ai_recommendations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS context_document_file_id uuid NULL,
  ADD COLUMN IF NOT EXISTS context_document_url text NULL,
  ADD COLUMN IF NOT EXISTS ai_profile_summary_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS ai_research_trace_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_company_profiles_tenant
  ON tenant_company_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_company_profiles_industry
  ON tenant_company_profiles (industry, subindustry);

CREATE INDEX IF NOT EXISTS idx_tenant_company_profiles_updated_at
  ON tenant_company_profiles (updated_at DESC);
