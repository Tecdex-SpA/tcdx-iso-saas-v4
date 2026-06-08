-- Sprint 3.5 document index exclusions.
-- Non-destructive: creates the exclusion ledger if missing and allows the logical
-- excluded status in document_index. Does not normalize existing statuses.

CREATE TABLE IF NOT EXISTS tenant_document_index_exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  source_id UUID NULL,
  document_index_id UUID NULL REFERENCES document_index(id) ON DELETE SET NULL,
  provider_file_id TEXT NOT NULL,
  exclusion_scope TEXT NOT NULL DEFAULT 'item',
  reason TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  excluded_by_user_id UUID NULL,
  excluded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  restored_by_user_id UUID NULL,
  restored_at TIMESTAMP WITHOUT TIME ZONE NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_document_index_exclusions_scope_check
    CHECK (exclusion_scope IN ('item', 'subtree'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_document_index_exclusions_active
  ON tenant_document_index_exclusions (tenant_id, provider, provider_file_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tenant_document_index_exclusions_tenant_active
  ON tenant_document_index_exclusions (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_document_index_exclusions_doc
  ON tenant_document_index_exclusions (tenant_id, document_index_id);

CREATE INDEX IF NOT EXISTS idx_tenant_document_index_exclusions_provider_file
  ON tenant_document_index_exclusions (tenant_id, provider, provider_file_id);

ALTER TABLE document_index
  DROP CONSTRAINT IF EXISTS document_index_status_check;

ALTER TABLE document_index
  ADD CONSTRAINT document_index_status_check
  CHECK (status IN (
    'indexed',
    'updated',
    'missing',
    'ignored',
    'error',
    'pending_analysis',
    'analyzed',
    'excluded'
  ));
