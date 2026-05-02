-- =========================================================
-- TCDX ISO SaaS - AI General Knowledge Bootstrap
-- Capa separada para conocimiento general no-tenant.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_bootstrap_knowledge_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  provider text NOT NULL DEFAULT 'internal_seed',
  dry_run boolean NOT NULL DEFAULT false,
  require_review boolean NOT NULL DEFAULT true,
  topics_requested_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  topics_processed integer NOT NULL DEFAULT 0,
  items_created integer NOT NULL DEFAULT 0,
  items_pending_review integer NOT NULL DEFAULT 0,
  items_approved integer NOT NULL DEFAULT 0,
  items_rejected integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  log_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ai_bootstrap_runs_status CHECK (
    status IN ('running', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT chk_ai_bootstrap_runs_mode CHECK (
    mode IN ('seeds', 'brave', 'all', 'dry_run', 'reindex')
  )
);

CREATE TABLE IF NOT EXISTS ai_bootstrap_knowledge_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  query_templates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  domain text,
  module text,
  standard_code text,
  knowledge_types_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority text NOT NULL DEFAULT 'medium',
  max_results integer NOT NULL DEFAULT 5,
  source_file text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_bootstrap_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text,
  source_provider text NOT NULL DEFAULT 'internal_seed',
  source_domain text,
  source_type text NOT NULL DEFAULT 'internal_seed',
  title text,
  summary text,
  trust_score numeric(5,2) NOT NULL DEFAULT 90,
  retrieved_at timestamp without time zone,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_bootstrap_sources_url_provider
ON ai_bootstrap_knowledge_sources(source_provider, source_url);

CREATE TABLE IF NOT EXISTS ai_bootstrap_knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES ai_bootstrap_knowledge_topics(id) ON DELETE SET NULL,
  source_id uuid REFERENCES ai_bootstrap_knowledge_sources(id) ON DELETE SET NULL,
  run_id uuid REFERENCES ai_bootstrap_knowledge_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content text,
  practical_use text,
  recommended_application text,
  limitations text,
  knowledge_type text NOT NULL,
  domain text,
  module text,
  standard_code text,
  clause_or_control text,
  tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  trust_score numeric(5,2) NOT NULL DEFAULT 90,
  freshness_score numeric(5,2) NOT NULL DEFAULT 80,
  usefulness_score numeric(5,2) NOT NULL DEFAULT 90,
  confidence_score numeric(5,2) NOT NULL DEFAULT 85,
  source_type text NOT NULL DEFAULT 'internal_seed',
  origin text NOT NULL DEFAULT 'bootstrap_seed',
  status text NOT NULL DEFAULT 'bootstrap_pending_review',
  source_url text,
  source_provider text NOT NULL DEFAULT 'internal_seed',
  retrieved_at timestamp without time zone,
  fingerprint text NOT NULL,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  approved_by uuid,
  approved_at timestamp without time zone,
  reviewed_by uuid,
  reviewed_at timestamp without time zone,
  rejection_reason text,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ai_bootstrap_items_status CHECK (
    status IN (
      'bootstrap_pending_review',
      'bootstrap_approved',
      'bootstrap_rejected',
      'bootstrap_archived'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_bootstrap_items_fingerprint
ON ai_bootstrap_knowledge_items(fingerprint);

CREATE INDEX IF NOT EXISTS idx_ai_bootstrap_items_status
ON ai_bootstrap_knowledge_items(status);

CREATE INDEX IF NOT EXISTS idx_ai_bootstrap_items_module
ON ai_bootstrap_knowledge_items(module);

CREATE INDEX IF NOT EXISTS idx_ai_bootstrap_items_domain
ON ai_bootstrap_knowledge_items(domain);

CREATE INDEX IF NOT EXISTS idx_ai_bootstrap_items_standard
ON ai_bootstrap_knowledge_items(standard_code);

CREATE INDEX IF NOT EXISTS idx_ai_bootstrap_items_type
ON ai_bootstrap_knowledge_items(knowledge_type);

CREATE INDEX IF NOT EXISTS idx_ai_bootstrap_items_created
ON ai_bootstrap_knowledge_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_bootstrap_runs_created
ON ai_bootstrap_knowledge_runs(created_at DESC);
