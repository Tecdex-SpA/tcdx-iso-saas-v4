-- =========================================================
-- TCDX ISO SaaS v4 - Knowledge Base v2 / Intelligence Layer
-- Global knowledge catalog. Tenant operational data remains in
-- tenant-scoped tables and is only enriched at service/query time.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  source_name text NOT NULL,
  source_type text,
  license_class text NOT NULL DEFAULT 'derived_summary',
  use_in_system text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_file text,
  seed_version text NOT NULL DEFAULT 'v2',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL UNIQUE,
  source_key text NOT NULL REFERENCES knowledge_sources(source_key) ON UPDATE CASCADE,
  source_record_id text,
  standard_family text,
  standard_code text,
  clause_or_control text,
  domain text,
  item_type text,
  title text,
  intent_summary text NOT NULL,
  license_class text NOT NULL DEFAULT 'derived_summary',
  use_in_system text[] NOT NULL DEFAULT ARRAY[]::text[],
  search_text text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  severity_default text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_evidence_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  expectation_text text NOT NULL,
  evidence_type text,
  required_level text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_audit_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'audit',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_common_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  gap_text text NOT NULL,
  severity_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_recommended_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  action_text text NOT NULL,
  action_basis text NOT NULL,
  priority_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  rule_key text NOT NULL,
  rule_type text NOT NULL DEFAULT 'hint',
  rule_text text NOT NULL,
  severity_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_key, rule_key)
);

CREATE TABLE IF NOT EXISTS knowledge_rule_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  hint_text text NOT NULL,
  severity_default text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  entity_type text NOT NULL,
  standard_family text,
  standard_code text,
  clause_or_control text,
  domain text,
  match_weight numeric(5,2) NOT NULL DEFAULT 1,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_narrative_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text REFERENCES knowledge_items(item_key) ON DELETE CASCADE ON UPDATE CASCADE,
  template_key text NOT NULL UNIQUE,
  template_type text NOT NULL,
  locale text NOT NULL DEFAULT 'es',
  body text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file text NOT NULL,
  seed_version text NOT NULL DEFAULT 'v2',
  source_sha256 text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  valid_records integer NOT NULL DEFAULT 0,
  inserted_items integer NOT NULL DEFAULT 0,
  updated_items integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  error_message text,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_item_key
  ON knowledge_items(item_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_source_key
  ON knowledge_items(source_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_standard_family
  ON knowledge_items(standard_family);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_standard_code
  ON knowledge_items(standard_code);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_clause_or_control
  ON knowledge_items(clause_or_control);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_domain
  ON knowledge_items(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_item_type
  ON knowledge_items(item_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_license_class
  ON knowledge_items(license_class);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_use_in_system
  ON knowledge_items USING gin(use_in_system);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_tags
  ON knowledge_items USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_search_trgm
  ON knowledge_items USING gin(search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_item_key
  ON knowledge_evidence_expectations(item_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_questions_item_key
  ON knowledge_audit_questions(item_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_common_gaps_item_key
  ON knowledge_common_gaps(item_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_recommended_actions_item_key
  ON knowledge_recommended_actions(item_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_rules_item_key
  ON knowledge_rules(item_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_rule_hints_item_key
  ON knowledge_rule_hints(item_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_mappings_lookup
  ON knowledge_mappings(entity_type, standard_family, standard_code, clause_or_control, domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_import_runs_source_file
  ON knowledge_import_runs(source_file, seed_version, started_at DESC);
