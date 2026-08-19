BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS knowledge_document_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  knowledge_document_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'TENANT',
  document_key text NOT NULL,
  document_version text NOT NULL,
  ingestion_status text NOT NULL,
  idempotency_key text NOT NULL,
  original_file_reference text NOT NULL,
  original_file_checksum text NOT NULL,
  extracted_text_reference text,
  extracted_text_checksum text,
  content_checksum text NOT NULL,
  detected_mime text NOT NULL,
  file_size bigint NOT NULL,
  original_filename text NOT NULL,
  sanitized_filename text NOT NULL,
  extraction_method text,
  extraction_status text NOT NULL,
  classification text NOT NULL,
  sensitive_classification text NOT NULL DEFAULT 'none',
  chunking_status text NOT NULL,
  chunk_count integer NOT NULL DEFAULT 0,
  malware_scan_status text NOT NULL DEFAULT 'not_available',
  actor_user_id uuid,
  correlation_id text,
  error_code text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_document_ingestions_scope_check
    CHECK (scope = 'TENANT'),
  CONSTRAINT knowledge_document_ingestions_status_check
    CHECK (ingestion_status IN ('requested','processing','completed','replayed','rejected','error')),
  CONSTRAINT knowledge_document_ingestions_extraction_status_check
    CHECK (extraction_status IN ('pending','extracted','no_text','failed','not_supported')),
  CONSTRAINT knowledge_document_ingestions_chunking_status_check
    CHECK (chunking_status IN ('pending','chunked','no_text','skipped','error')),
  CONSTRAINT knowledge_document_ingestions_sensitive_check
    CHECK (sensitive_classification IN ('none','sensitive','secret_detected')),
  CONSTRAINT knowledge_document_ingestions_malware_check
    CHECK (malware_scan_status IN ('not_available','skipped','passed','failed')),
  CONSTRAINT knowledge_document_ingestions_file_size_check
    CHECK (file_size >= 0),
  CONSTRAINT knowledge_document_ingestions_chunk_count_check
    CHECK (chunk_count >= 0),
  CONSTRAINT knowledge_document_ingestions_original_checksum_check
    CHECK (original_file_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_document_ingestions_extracted_checksum_check
    CHECK (extracted_text_checksum IS NULL OR extracted_text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_document_ingestions_content_checksum_check
    CHECK (content_checksum ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_document_ingestions_idempotency
  ON knowledge_document_ingestions(tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_ingestions_tenant_created
  ON knowledge_document_ingestions(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_ingestions_document
  ON knowledge_document_ingestions(tenant_id, knowledge_document_id);

CREATE TABLE IF NOT EXISTS knowledge_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  document_version text NOT NULL,
  chunk_ordinal integer NOT NULL,
  chunk_text text NOT NULL,
  text_checksum text NOT NULL,
  page_number integer,
  section_label text,
  heading text,
  source_start_offset integer,
  source_end_offset integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_document_chunks_ordinal_check
    CHECK (chunk_ordinal >= 0),
  CONSTRAINT knowledge_document_chunks_text_checksum_check
    CHECK (text_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_document_chunks_offsets_check
    CHECK (
      source_start_offset IS NULL
      OR source_end_offset IS NULL
      OR source_end_offset >= source_start_offset
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_document_chunks_document_ordinal
  ON knowledge_document_chunks(tenant_id, knowledge_document_id, document_version, chunk_ordinal);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_document
  ON knowledge_document_chunks(tenant_id, knowledge_document_id);

CREATE TABLE IF NOT EXISTS knowledge_document_ingestion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ingestion_id uuid REFERENCES knowledge_document_ingestions(id) ON DELETE SET NULL,
  knowledge_document_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  action text NOT NULL,
  status text NOT NULL,
  actor_user_id uuid,
  original_file_checksum text,
  extracted_text_checksum text,
  ingestion_contract_version text NOT NULL,
  extraction_method text,
  correlation_id text,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_document_ingestion_audit_original_checksum_check
    CHECK (original_file_checksum IS NULL OR original_file_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT knowledge_document_ingestion_audit_extracted_checksum_check
    CHECK (extracted_text_checksum IS NULL OR extracted_text_checksum ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_ingestion_audit_tenant_created
  ON knowledge_document_ingestion_audit(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_ingestion_audit_ingestion
  ON knowledge_document_ingestion_audit(tenant_id, ingestion_id);

COMMENT ON TABLE knowledge_document_ingestions IS
  'Tenant-scoped knowledge ingestion runs for knowledge-ingestion-pipeline-v1. No embeddings or vector columns are stored here.';

COMMENT ON TABLE knowledge_document_chunks IS
  'Deterministic chunk manifest for tenant knowledge documents. Embeddings/pgvector are intentionally deferred to 6.10-03.';

COMMENT ON TABLE knowledge_document_ingestion_audit IS
  'Audit ledger for tenant knowledge ingestion without storing document text or secrets.';

COMMIT;
