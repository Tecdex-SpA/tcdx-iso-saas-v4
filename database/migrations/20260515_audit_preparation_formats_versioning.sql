-- =========================================================
-- TCDX ISO SaaS - Audit preparation formats/versioning
--
-- Minimal additive migration for commercial-ready document
-- outputs and ISO traceability. Does not modify legacy
-- operational tables.
-- =========================================================

ALTER TABLE audit_package_documents
  DROP CONSTRAINT IF EXISTS chk_audit_package_documents_status;

ALTER TABLE audit_package_documents
  ADD COLUMN IF NOT EXISTS generated_file_url text NULL,
  ADD COLUMN IF NOT EXISTS output_format varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS mime_type varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint NULL,
  ADD COLUMN IF NOT EXISTS file_hash varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS version varchar(50) NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prepared_by uuid NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS effective_from date NULL,
  ADD COLUMN IF NOT EXISTS expires_at date NULL,
  ADD COLUMN IF NOT EXISTS supersedes_document_id uuid NULL REFERENCES audit_package_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_document_id uuid NULL REFERENCES audit_package_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_notes text NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text NULL;

ALTER TABLE audit_package_documents
  ADD CONSTRAINT chk_audit_package_documents_status CHECK (
    document_status IN (
      'draft',
      'imported',
      'analyzed',
      'generated',
      'updated_from_platform',
      'requires_validation',
      'in_review',
      'approved',
      'rejected',
      'obsolete',
      'superseded',
      'published',
      'exported'
    )
  );

ALTER TABLE audit_package_documents
  ADD CONSTRAINT chk_audit_package_documents_output CHECK (
    output_format IS NULL OR output_format IN ('docx', 'xlsx', 'pptx', 'pdf', 'md')
  );

CREATE INDEX IF NOT EXISTS idx_audit_package_documents_current
  ON audit_package_documents(package_id, is_current, document_status);

CREATE INDEX IF NOT EXISTS idx_audit_package_documents_supersedes
  ON audit_package_documents(supersedes_document_id);

COMMENT ON COLUMN audit_package_documents.generated_file_url IS
  'Authenticated/generated file reference for the rendered document artifact.';

COMMENT ON COLUMN audit_package_documents.is_current IS
  'Marks the current version within a package/template chain.';
