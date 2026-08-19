BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE knowledge_document_chunks
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'TENANT';

UPDATE knowledge_document_chunks
   SET scope='TENANT'
 WHERE scope IS NULL;

ALTER TABLE knowledge_document_chunks
  ALTER COLUMN tenant_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname='knowledge_document_chunks_scope_check'
       AND conrelid='knowledge_document_chunks'::regclass
  ) THEN
    ALTER TABLE knowledge_document_chunks
      ADD CONSTRAINT knowledge_document_chunks_scope_check
      CHECK (scope IN ('TENANT','REGULATORY'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname='knowledge_document_chunks_scope_tenant_check'
       AND conrelid='knowledge_document_chunks'::regclass
  ) THEN
    ALTER TABLE knowledge_document_chunks
      ADD CONSTRAINT knowledge_document_chunks_scope_tenant_check
      CHECK (
        (scope='TENANT' AND tenant_id IS NOT NULL)
        OR (scope='REGULATORY' AND tenant_id IS NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_document_chunks_scope_document_ordinal
  ON knowledge_document_chunks(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), knowledge_document_id, document_version, chunk_ordinal);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_scope_document
  ON knowledge_document_chunks(scope, knowledge_document_id);

CREATE TABLE IF NOT EXISTS regulatory_authoritative_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  scope text NOT NULL DEFAULT 'JURISDICTIONAL',
  tenant_id uuid,
  authority_classification text NOT NULL,
  authority_type text NOT NULL,
  jurisdiction text NOT NULL,
  country_region text,
  issuing_authority text NOT NULL,
  official_name text NOT NULL,
  stable_identifier text NOT NULL,
  official_domain text NOT NULL,
  official_source_uri text NOT NULL,
  allowed_ingestion_method text NOT NULL,
  content_type text,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_to timestamptz,
  owner text NOT NULL DEFAULT 'CODEX_B_REGULATORY',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_successful_fetch_at timestamptz,
  health_status text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_authoritative_sources_scope_check
    CHECK (scope IN ('GLOBAL','JURISDICTIONAL','TENANT_PRIVATE')),
  CONSTRAINT regulatory_authoritative_sources_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','JURISDICTIONAL') AND tenant_id IS NULL)
    ),
  CONSTRAINT regulatory_authoritative_sources_classification_check
    CHECK (authority_classification IN ('AUTHORITATIVE','APPROVED_REFERENCE','INFORMATIONAL')),
  CONSTRAINT regulatory_authoritative_sources_method_check
    CHECK (allowed_ingestion_method IN ('manual_upload','official_url_fetch','api','registry_reference')),
  CONSTRAINT regulatory_authoritative_sources_status_check
    CHECK (status IN ('draft','active','deprecated','rejected','error')),
  CONSTRAINT regulatory_authoritative_sources_health_check
    CHECK (health_status IN ('unknown','healthy','degraded','unreachable','not_checked')),
  CONSTRAINT regulatory_authoritative_sources_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_sources_scope_key
  ON regulatory_authoritative_sources(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), source_key);

CREATE INDEX IF NOT EXISTS idx_regulatory_sources_jurisdiction
  ON regulatory_authoritative_sources(jurisdiction, authority_classification, status);

CREATE INDEX IF NOT EXISTS idx_regulatory_sources_stable_identifier
  ON regulatory_authoritative_sources(stable_identifier);

CREATE TABLE IF NOT EXISTS regulatory_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  scope text NOT NULL DEFAULT 'REGULATORY',
  tenant_id uuid,
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  regulation_source_identifier text NOT NULL,
  version_identifier text NOT NULL,
  retrieved_uri text NOT NULL,
  original_artifact_reference text,
  original_artifact_checksum text,
  extracted_text_reference text,
  extracted_text_checksum text,
  content_checksum text NOT NULL,
  acquired_at timestamptz NOT NULL,
  publication_date date,
  effective_from timestamptz,
  effective_to timestamptz,
  ingestion_contract_version text NOT NULL,
  parser_version text NOT NULL,
  extraction_method text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'active',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_ingestions_scope_check
    CHECK (scope IN ('REGULATORY','TENANT_PRIVATE')),
  CONSTRAINT regulatory_ingestions_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope='REGULATORY' AND tenant_id IS NULL)
    ),
  CONSTRAINT regulatory_ingestions_status_check
    CHECK (lifecycle_status IN ('draft','active','deprecated','rejected','error')),
  CONSTRAINT regulatory_ingestions_original_checksum_check
    CHECK (original_artifact_checksum IS NULL OR original_artifact_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_ingestions_extracted_checksum_check
    CHECK (extracted_text_checksum IS NULL OR extracted_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_ingestions_content_checksum_check
    CHECK (content_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_ingestions_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_ingestions_source_version_checksum
  ON regulatory_ingestions(source_id, regulation_source_identifier, version_identifier, content_checksum);

CREATE INDEX IF NOT EXISTS idx_regulatory_ingestions_document
  ON regulatory_ingestions(knowledge_document_id);

CREATE INDEX IF NOT EXISTS idx_regulatory_ingestions_source_acquired
  ON regulatory_ingestions(source_id, acquired_at DESC);

CREATE TABLE IF NOT EXISTS regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_key text NOT NULL,
  scope text NOT NULL DEFAULT 'JURISDICTIONAL',
  tenant_id uuid,
  jurisdiction text NOT NULL,
  source_id uuid NOT NULL REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  issuing_authority text NOT NULL,
  official_identifier text NOT NULL,
  official_title text NOT NULL,
  regulation_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulations_scope_check
    CHECK (scope IN ('GLOBAL','JURISDICTIONAL','TENANT_PRIVATE')),
  CONSTRAINT regulations_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','JURISDICTIONAL') AND tenant_id IS NULL)
    ),
  CONSTRAINT regulations_status_check
    CHECK (status IN ('draft','reviewed','published','deprecated','rejected','error'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulations_scope_key
  ON regulations(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), regulation_key);

CREATE INDEX IF NOT EXISTS idx_regulations_jurisdiction
  ON regulations(jurisdiction, status);

CREATE INDEX IF NOT EXISTS idx_regulations_source
  ON regulations(source_id);

CREATE TABLE IF NOT EXISTS regulation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  regulatory_ingestion_id uuid REFERENCES regulatory_ingestions(id) ON DELETE SET NULL,
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  version_identifier text NOT NULL,
  publication_date date,
  effective_from timestamptz,
  effective_to timestamptz,
  content_checksum text NOT NULL,
  supersedes_version_id uuid REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulation_versions_status_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT regulation_versions_content_checksum_check
    CHECK (content_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulation_versions_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulation_versions_identity
  ON regulation_versions(regulation_id, version_identifier);

CREATE INDEX IF NOT EXISTS idx_regulation_versions_regulation_status
  ON regulation_versions(regulation_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_regulation_versions_document
  ON regulation_versions(knowledge_document_id);

CREATE TABLE IF NOT EXISTS legal_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  regulation_version_id uuid NOT NULL REFERENCES regulation_versions(id) ON DELETE CASCADE,
  obligation_key text NOT NULL,
  reference text,
  obligation_text text NOT NULL,
  obligation_text_checksum text NOT NULL,
  subject text,
  action_type text,
  requirement_summary text,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  source_chunk_id uuid REFERENCES knowledge_document_chunks(id) ON DELETE SET NULL,
  source_text_checksum text,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_obligations_status_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT legal_obligations_text_checksum_check
    CHECK (obligation_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT legal_obligations_source_checksum_check
    CHECK (source_text_checksum IS NULL OR source_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT legal_obligations_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_legal_obligations_version_key
  ON legal_obligations(regulation_version_id, obligation_key);

CREATE INDEX IF NOT EXISTS idx_legal_obligations_regulation
  ON legal_obligations(regulation_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_legal_obligations_version
  ON legal_obligations(regulation_version_id);

CREATE INDEX IF NOT EXISTS idx_legal_obligations_effective
  ON legal_obligations(lifecycle_status, effective_from, effective_to);

COMMENT ON TABLE regulatory_authoritative_sources IS
  'Governed authoritative source registry for Regulatory Intelligence. General web results are not legal source of truth.';

COMMENT ON TABLE regulatory_ingestions IS
  'Immutable/versioned regulatory ingestion ledger linked to authoritative source registry and canonical knowledge_documents.';

COMMENT ON TABLE regulations IS
  'Stable legal/regulatory identity. Not a specific publication artifact.';

COMMENT ON TABLE regulation_versions IS
  'Immutable regulation publication/version linked to a canonical REGULATORY knowledge_document.';

COMMENT ON TABLE legal_obligations IS
  'Governed, auditable legal obligations. LLM suggestions are not authoritative publication truth.';

COMMIT;
