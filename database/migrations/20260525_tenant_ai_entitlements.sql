-- Tenant-level AI entitlements for plan/billing control.
-- Idempotent: safe to run more than once.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_plan text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_web_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auditor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_monthly_quota integer NULL,
  ADD COLUMN IF NOT EXISTS ai_quota_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_features_json jsonb NOT NULL DEFAULT
    '{
      "company_profile_analysis": true,
      "report_enrichment": true,
      "auditor": true,
      "web_research": true,
      "document_generation": true,
      "suggestions": true
    }'::jsonb;

-- Preserve current production behavior for already-created tenants. New tenants
-- default to no AI until SaaS/admin enables it explicitly.
UPDATE tenants
SET
  ai_enabled = TRUE,
  ai_plan = CASE WHEN ai_plan = 'none' THEN 'standard' ELSE ai_plan END,
  ai_web_enabled = TRUE,
  ai_report_enabled = TRUE,
  ai_auditor_enabled = TRUE
WHERE created_at < now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_ai_plan_check'
      AND conrelid = 'tenants'::regclass
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_ai_plan_check
      CHECK (ai_plan IN ('none', 'basic', 'standard', 'pro', 'premium', 'enterprise'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_ai_enabled
  ON tenants (ai_enabled);

CREATE INDEX IF NOT EXISTS idx_tenants_ai_plan
  ON tenants (ai_plan);
