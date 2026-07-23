-- TCDX ISO SaaS v4 - Phase 1R operational closeout
-- Additive tenant bootstrap state and reproducible configuration evidence.

BEGIN;

CREATE TABLE IF NOT EXISTS grc_tenant_configurations (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'initialized'
    CHECK (status IN ('initialized', 'ready', 'degraded')),
  bootstrap_version integer NOT NULL DEFAULT 1 CHECK (bootstrap_version > 0),
  scheduler_config jsonb NOT NULL DEFAULT
    '{"enabled":true,"window_minutes":5,"max_attempts":5,"base_backoff_seconds":30}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  initialized_by uuid REFERENCES users(id) ON DELETE SET NULL,
  initialized_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  validation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_bootstrap_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  bootstrap_version integer NOT NULL DEFAULT 1 CHECK (bootstrap_version > 0),
  response jsonb NOT NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_grc_bootstrap_runs_tenant_created
  ON grc_bootstrap_runs (tenant_id, created_at DESC);

ALTER TABLE grc_requirement_control_mappings
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON TABLE grc_tenant_configurations IS
  'Explicit, tenant-scoped Phase 1 GRC operational configuration; never enables the SaaS module.';
COMMENT ON TABLE grc_bootstrap_runs IS
  'Auditable idempotency ledger for explicit Phase 1 GRC tenant bootstrap operations.';

-- Identifier-only roots allow legitimate tenant mappings without copying licensed clauses.
INSERT INTO grc_framework_requirements (
  tenant_id, version_id, reference_code, permitted_title,
  tcdx_interpretation, content_classification, metadata
)
SELECT
  NULL,
  v.id,
  'FRAMEWORK-ROOT',
  NULL,
  'Referencia de cobertura general pendiente de desglose autorizado.',
  f.content_classification,
  jsonb_build_object('bootstrap_safe', TRUE, 'licensed_text_included', FALSE)
FROM grc_framework_versions v
JOIN grc_frameworks f ON f.id = v.framework_id
WHERE v.tenant_id IS NULL
  AND f.tenant_id IS NULL
  AND v.status = 'published'
ON CONFLICT (tenant_id, version_id, reference_code) DO NOTHING;

COMMIT;
