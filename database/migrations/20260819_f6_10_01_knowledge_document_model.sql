BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_key text NOT NULL,
  scope text NOT NULL,
  tenant_id uuid,
  classification text NOT NULL DEFAULT 'internal',
  document_type text NOT NULL,
  title text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_to timestamptz,
  supersedes_document_id uuid REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  source_authority text NOT NULL,
  source_uri_or_reference text,
  original_file_reference text,
  original_file_checksum text,
  extracted_text_reference text,
  extracted_text_checksum text,
  content_checksum text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_documents_scope_check
    CHECK (scope IN ('GLOBAL','REGULATORY','TENANT')),
  CONSTRAINT knowledge_documents_tenant_scope_check
    CHECK (
      (scope = 'TENANT' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','REGULATORY') AND tenant_id IS NULL)
    ),
  CONSTRAINT knowledge_documents_status_check
    CHECK (status IN ('draft','indexing','active','deprecated','rejected','error')),
  CONSTRAINT knowledge_documents_source_authority_check
    CHECK (source_authority IN ('tcdx_internal','authoritative','tenant_private','imported','derived')),
  CONSTRAINT knowledge_documents_regulatory_authority_check
    CHECK (scope <> 'REGULATORY' OR source_authority = 'authoritative'),
  CONSTRAINT knowledge_documents_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  CONSTRAINT knowledge_documents_original_checksum_check
    CHECK (original_file_checksum IS NULL OR original_file_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_documents_extracted_checksum_check
    CHECK (extracted_text_checksum IS NULL OR extracted_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_documents_content_checksum_check
    CHECK (content_checksum ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_documents_scope_key_version
  ON knowledge_documents(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), document_key, version);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant_scope_status
  ON knowledge_documents(tenant_id, scope, status);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_effective
  ON knowledge_documents(scope, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_checksum
  ON knowledge_documents(content_checksum);

ALTER TABLE knowledge_sources
  ADD COLUMN IF NOT EXISTS knowledge_document_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_document_id
  ON knowledge_sources(knowledge_document_id);

COMMENT ON TABLE knowledge_documents IS
  'Canonical Knowledge Document model for GLOBAL, REGULATORY and TENANT knowledge. Operational attachments are not promoted automatically.';

COMMENT ON COLUMN knowledge_documents.original_file_reference IS
  'Reference to existing storage/index owner; this table does not store binary content.';

COMMENT ON COLUMN knowledge_documents.extracted_text_reference IS
  'Reference to extracted text storage/output prepared for future ingestion/chunking; no pgvector or embedding is created in 6.10-01.';

COMMIT;
